// Core agent entry. Minimal, safe scaffolding to be wired into API later.

import { ragSearch } from "./tools/rag";
import OpenAI from "openai";
import { createMedicalEscalation } from "./tools/medical";
import { fetchPatientContextByPhone } from "./tools/patientContext";
import { scheduleMeeting, getAvailableSlots } from "./tools/scheduling";
import { 
  startSchedulingSession, 
  processTimeSelection,
  handleProviderApprovalResponse
} from "./tools/interactiveScheduling";
import prisma from "@/lib/prisma";

export type AgentHistoryItem = { role: "user" | "assistant" | "system"; content: string };
export type RagSearchResult = { title: string; text: string; score: number; sourceUrl?: string };
export type AgentResponse = { answer: string; matches: RagSearchResult[]; billable: boolean };

// Helper function to get patient by phone
async function getPatientByPhone(phoneE164: string) {
  try {
    const contact = await prisma.contactChannel.findFirst({
      where: { type: 'whatsapp', value: phoneE164 },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true } }
      }
    });

    return contact?.patient || null;
  } catch {
    return null;
  }
}

// Optional per-request context shared with tools
let INCOMING_PHONE_E164: string | null = null;
export function setAgentIncomingPhone(phoneE164: string | null) {
  INCOMING_PHONE_E164 = (phoneE164 || "").trim() || null;
}
export function getAgentIncomingPhone() {
  return INCOMING_PHONE_E164;
}
export function clearAgentIncomingPhone() {
  INCOMING_PHONE_E164 = null;
}

// Session cache key for RAG
let RAG_SESSION_KEY: string | null = null;
export function setRagSessionKey(key: string) {
  RAG_SESSION_KEY = key || null;
}
export function clearRagSessionKey() {
  RAG_SESSION_KEY = null;
}
export function getRagSessionKey() {
  return RAG_SESSION_KEY;
}

function formatWhatsApp(text: string): string {
  let t = String(text || "");
  t = t.replace(/\s+$/g, "");
  t = t.replace(/\n{3,}/g, "\n\n");
  t = t.replace(/^#+\s*/gm, "");
  t = t.replace(/\*{2,}/g, "*");
  // hard limit ~900 chars to keep under WhatsApp wall-of-text
  if (t.length > 900) t = t.slice(0, 880) + "\n…";
  return t.trim();
}

export async function agentRespond(opts: {
  message: string;
  topK?: number;
  whatsappStyle?: boolean;
  history?: AgentHistoryItem[];
}): Promise<AgentResponse> {
  const msg = String(opts.message || "").trim();
  const topK = Number(opts.topK ?? process.env.RAG_DEFAULT_TOPK ?? 5);

  // If no message text (e.g., media-only), avoid RAG/LLM and return a friendly default
  if (!msg) {
    const answer = opts.whatsappStyle
      ? formatWhatsApp("🌸 Welcome to HOA! I'm Luna, your women's wellness assistant. I can help you:\n\n• Schedule appointments with healthcare providers\n• Track menstrual cycles and symptoms\n• Get personalized health guidance\n• Connect with our supportive community\n• Answer your health questions\n\nWhat would you like help with today? If you sent a file, a provider will review it shortly.")
      : "🌸 Welcome to HOA! I'm Luna, your women's wellness assistant. I can help you schedule appointments, track menstrual cycles, provide health guidance, connect with community support, and answer your health questions. What would you like help with today?";
    return { answer, matches: [], billable: false };
  }

  // Resolve scope: try patient by phone; else provider by phone; else general
  const rawPhone = getAgentIncomingPhone();
  const phoneE164 = rawPhone && /^\+\d{6,15}$/.test(rawPhone) ? rawPhone : undefined;
  let patientScopedPhone: string | undefined = undefined;
  let providerScopedPhone: string | undefined = undefined;
  try {
    if (phoneE164) {
      const cc = await prisma.contactChannel.findFirst({
        where: { type: 'whatsapp', value: phoneE164, ownerType: 'patient' },
        select: { id: true, patientId: true },
      });
      if (cc?.patientId) patientScopedPhone = phoneE164;
      if (!patientScopedPhone) {
        // Detect provider via providerProfile.phoneE164
        const prov = await prisma.providerProfile.findFirst({ where: { phoneE164: phoneE164 as any }, select: { id: true } });
        if (prov?.id) providerScopedPhone = phoneE164;
      }
    }
  } catch (e:any) {
    console.error('[agent->scope] lookup error', e?.message || e);
  }
  try { console.log(`[agent] scope=%s`, patientScopedPhone ? 'patient' : (providerScopedPhone ? 'provider' : 'general')) } catch {}
  const { results } = await ragSearch({ query: msg, topK, sessionKey: getRagSessionKey() || undefined, patientPhoneE164: patientScopedPhone });
  // Fetch personal patient context for tailoring (patients only)
  let personalContext: Awaited<ReturnType<typeof fetchPatientContextByPhone>> = null;
  if (patientScopedPhone) {
    try { personalContext = await fetchPatientContextByPhone(patientScopedPhone); } catch {}
  }

  // Compose with OpenAI when configured
  let answer = "";
  let billable = false;
  const hasOpenAI = !!process.env.OPENAI_API_KEY;
  try {
    console.log(
      `[agent] message len=%d topK=%d scope=%s patientPhone=%s openai=%s matches=%d`,
      msg.length,
      topK,
      patientScopedPhone ? 'patient' : 'general',
      patientScopedPhone ? 'yes' : 'no',
      hasOpenAI ? 'yes' : 'no',
      results.length
    );
  } catch {}

  // Provider technical mode: use LLM with strict quoting (no paraphrasing). Fallback to raw list if OpenAI unavailable.
  if (providerScopedPhone) {
    // Greeting/empty-intent guard for providers
    const isGreeting = /^(hi|hello|hey|good\s*(morning|afternoon|evening)|how\s*are\s*you\??)$/i.test(msg);
    if (isGreeting) {
      let purpose = "I surface quoted lines from your technical sources with [S#] citations. Ask a specific clinical question or guideline to retrieve relevant excerpts.";
      if (opts.whatsappStyle) purpose = formatWhatsApp(purpose);
      return { answer: purpose, matches: results, billable: false };
    }
    if (hasOpenAI) {
      try {
        const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        const providerSys = `You are Luna, a women's wellness AI assistant helping healthcare providers over WhatsApp.\n\nSTRUCTURE (MANDATORY):\n1) One short intro sentence addressing the provider (no claims).\n2) Quoted bullets of factual content from sources, each ending with a citation like [S1], [S2].\n3) One short closing sentence (e.g., availability of further details), no new claims.\n\nSELECTION: Select only lines that directly answer the question. Omit generic lists of topics or headings that are not answering the question.\n\nRULES:\n- Do NOT paraphrase factual content beyond direct quotes.\n- Use ONLY the provided Sources; no external knowledge.\n- No layman simplification; keep clinical phrasing as quoted.\n- If no relevant content, reply: "No relevant lines in sources."\n- Do NOT output unrelated sections or headings just because they match keywords.`
        const ctx = results.slice(0, Math.max(1, Math.min(8, topK))).map((r, i) => `# Source ${i + 1}: ${r.title}${r.sourceUrl ? `\nURL: ${r.sourceUrl}` : ''}\n${r.text}`).join("\n\n");
        const providerPrompt = `Provider question:\n${msg}\n\nSources:\n${ctx}\n\nSelect only directly relevant lines that answer the question (avoid generic enumerations). Follow the STRUCTURE exactly: intro line, quoted bullets with [S#], closing line.`;
        const completion = await client.chat.completions.create({
          model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
          temperature: 0,
          messages: [
            { role: 'system', content: providerSys },
            { role: 'user', content: providerPrompt },
          ],
        });
        answer = (completion.choices?.[0]?.message?.content || '').trim();
        if (!answer) answer = 'No relevant lines in sources.';
        if (opts.whatsappStyle) answer = formatWhatsApp(answer);
        return { answer, matches: results, billable: true };
      } catch (e:any) {
        // fall through to raw fallback
      }
    }
    // Raw fallback
    const top = results.slice(0, Math.max(1, Math.min(8, topK)));
    if (top.length === 0) {
      answer = 'No matching technical sources.';
    } else {
      const lines: string[] = [];
      lines.push(`Results (${top.length}):`);
      for (let i = 0; i < top.length; i++) {
        const r = top[i];
        const url = r.sourceUrl ? ` — ${r.sourceUrl}` : '';
        lines.push(`${i + 1}. ${r.title}${url}`);
        const snippet = (r.text || '').slice(0, 400).trim();
        if (snippet) lines.push(snippet);
      }
      answer = lines.join('\n');
    }
    if (opts.whatsappStyle) answer = formatWhatsApp(answer);
    return { answer, matches: results, billable: false };
  }

  if (hasOpenAI) {
    try {
      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const base = `You are Luna, a compassionate women's wellness AI assistant answering over WhatsApp. Keep replies concise, readable, and actionable:
 - Limit to ~6 short lines.
 - Prefer short sentences and simple bullets.
 - Prefer using the provided Context when available; summarize only the most relevant facts from Context.
 - If Context is missing or thin, provide general, evidence-based health guidance within common clinical practice. Keep it high-level and safe.
 - Avoid long URLs unless essential.
 - You can help schedule appointments with healthcare providers.`;

      const patientStyle = `
TONE AND STYLE FOR PATIENTS:
- Use plain language (layman's terms). Avoid or explain any medical jargon in simple words.
- Aim for a ~5th–8th grade reading level.
- Focus on clear steps the person can take now (hydration, rest, OTC options with cautions, when to seek urgent care).
- Be reassuring, practical, and non-alarming.
`;

      const providerStyle = `
TONE AND STYLE FOR PROVIDERS/GENERAL:
- Be concise and practical. You may keep brief clinical terminology when appropriate.
`;

      const safety = `
DOMAIN AND SAFETY (MANDATORY):
- Only answer health/clinical questions. If the topic is unrelated to health, ask the user to provide a health-related question.
- If unsure, say you don't know.
`;

      const scheduling = `
SCHEDULING CAPABILITIES:
- IMPORTANT: We use an INTERACTIVE scheduling flow with provider approval.
- When users ask to schedule/book/see a doctor with a specific time, use action='start_interactive_scheduling' and immediately create the approval request. DO NOT check availability.
- If user already provided a specific time (preferred_time), you may use action='process_time_selection' to create the approval request directly.
- For "available times" / "availability" you may use action='check_availability' ONLY if no time was provided.
- Include provider_name if specified, otherwise use any available provider.
- Include preferred_time if mentioned (e.g., "tomorrow morning", "next week").
- Include reason for appointment if mentioned.
`;

      const escalation = `
WHEN TO ESCALATE (MANDATORY):
If the user indicates ANC danger signs (any of: severe headache, blurred vision, heavy vaginal bleeding, severe abdominal pain, reduced fetal movements, fever ≥38°C, convulsions/seizure, severe shortness of breath, swelling of face/hands), set action='escalate' and include a short escalate_summary. Keep reply concise and reassuring.
`;

      const outputFormat = `
OUTPUT FORMAT (MANDATORY):
Return a single JSON object with keys:
- action: 'answer' | 'escalate' | 'onboard_name' | 'check_availability' | 'start_interactive_scheduling' | 'process_time_selection'
- answer: string (message to send to the user, WhatsApp-friendly)
- escalate_summary?: string (short summary if action is 'escalate')
- name?: string (when action is 'onboard_name', the visitor name to save)
- provider_name?: string (for scheduling actions)
- preferred_time?: string (for scheduling actions)
- reason?: string (reason for appointment)
- date?: string (YYYY-MM-DD for availability checks)
- session_id?: string (for interactive scheduling session)
Example:
{"action":"answer","answer":"..."}
Example:
{"action":"start_interactive_scheduling","answer":"I'll help you schedule an appointment! Let me check availability...","provider_name":"Dr. Smith"}
`;

      const sys = [
        base,
        (providerScopedPhone ? providerStyle : patientStyle),
        safety,
        scheduling,
        escalation,
        outputFormat,
      ].join("\n\n");

      const ragBlock = results.slice(0, Math.max(1, Math.min(8, topK))).map((r, i) => `# Source ${i + 1}: ${r.title}${r.sourceUrl ? `\nURL: ${r.sourceUrl}` : ''}\n${r.text}`).join("\n\n");
      // Build a concise Personal Context section if available
      const pc = personalContext;
      const personalBlock = pc ? (() => {
        const lines: string[] = [];
        if (pc.name) lines.push(`Name: ${pc.name}`);
        if (pc.pregnancy) {
          const p = pc.pregnancy;
          const parts: string[] = [];
          if (typeof p.gaWeeks === 'number') parts.push(`GA ~${p.gaWeeks} wks`);
          if (p.edd) parts.push(`EDD ${new Date(p.edd).toLocaleDateString()}`);
          if (p.lastContactDate) parts.push(`Last ANC ${new Date(p.lastContactDate).toLocaleDateString()}`);
          if (p.lastIptpDate) parts.push(`IPTp on ${new Date(p.lastIptpDate).toLocaleDateString()}`);
          if (p.lastTtDate) parts.push(`TT on ${new Date(p.lastTtDate).toLocaleDateString()}`);
          if (parts.length) lines.push(`Pregnancy: ${parts.join(' • ')}`);
          if (p.lastVitals) {
            const v = p.lastVitals;
            const vparts: string[] = [];
            if (v.bp) vparts.push(`BP ${v.bp}`);
            if (typeof v.weightKg === 'number') vparts.push(`Wt ${v.weightKg} kg`);
            if (typeof v.fundalHeightCm === 'number') vparts.push(`FH ${v.fundalHeightCm} cm`);
            if (typeof v.fhrBpm === 'number') vparts.push(`FHR ${v.fhrBpm} bpm`);
            if (vparts.length) lines.push(`Recent vitals: ${vparts.join(' • ')}`);
          }
        }
        if (pc.prescriptions && pc.prescriptions.length) {
          const meds = pc.prescriptions.slice(0, 5).map(m => `${m.medicationName}${m.strength ? ` (${m.strength})` : ''}`).join(", ");
          if (meds) lines.push(`Active meds: ${meds}`);
        }
        if (pc.upcomingReminders && pc.upcomingReminders.length) {
          const next = pc.upcomingReminders[0];
          lines.push(`Next reminder: ${new Date(next.when).toLocaleString()}${next.medicationName ? ` for ${next.medicationName}` : ''}`);
        }
        return lines.length ? `Personal Context:\n${lines.join('\n')}` : '';
      })() : '';
      const context = [personalBlock, ragBlock].filter(Boolean).join("\n\n");
      const prompt = `User question:\n${msg}\n\nContext (may be empty):\n${context}\n\nDecide:\n- If urgent, use action='escalate' and include escalate_summary.\n- If the user provided their name or you can safely infer it (first name only is OK), you may set action='onboard_name' and include name.\n- Otherwise, use action='answer'.\nAlways include an 'answer' that responds helpfully to the user, even when escalating or onboarding.\nOutput only the JSON.`;
      const completion = await client.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        temperature: 0.2,
        messages: [
          { role: 'system', content: sys },
          ...(opts.history || []).map(h => ({ role: h.role, content: h.content } as any)),
          { role: 'user', content: prompt },
        ],
      });
      const raw = (completion.choices?.[0]?.message?.content || '').trim();
      billable = true;
      // Parse tool-style JSON
      let parsed: any = null;
      try { parsed = JSON.parse(raw); } catch {}
      if (parsed && typeof parsed === 'object') {
        const action = String(parsed.action || 'answer').toLowerCase();
        const providedAnswer = typeof parsed.answer === 'string' ? parsed.answer : '';
        const activePhone = (patientScopedPhone || phoneE164) as string | undefined;
        const providerName = typeof parsed.provider_name === 'string' ? parsed.provider_name : undefined;
        const preferredTime = typeof parsed.preferred_time === 'string' ? parsed.preferred_time : undefined;
        const reason = typeof parsed.reason === 'string' ? parsed.reason : undefined;
        if (action === 'escalate' && patientScopedPhone) {
          try {
            await createMedicalEscalation({ phoneE164: patientScopedPhone, summary: String(parsed.escalate_summary || msg).slice(0,180), subjectType: 'patient', subjectId: null });
          } catch {}
          // Always send a human-friendly confirmation, do not expose JSON
          answer = "I've alerted a healthcare provider right away. If this is a life‑threatening emergency, please call your local emergency number.";
        } else if (action === 'onboard_name') {
          // For visitors (non-patient scope), set displayName using phone lookup
          if (!patientScopedPhone) {
            try {
              const phone = getAgentIncomingPhone();
              if (phone) {
                const vis = await prisma.visitor.findFirst({ where: { contacts: { some: { type: 'whatsapp', value: phone } } }, select: { id: true } });
                if (vis && typeof parsed.name === 'string' && parsed.name.trim()) {
                  await prisma.visitor.update({ where: { id: vis.id }, data: { displayName: parsed.name.trim() } });
                }
              }
            } catch {}
          }
          // Send the provided answer or a friendly default
          answer = providedAnswer || "🌸 Thanks — noted! I'm Luna, your women's wellness assistant. I can help you schedule appointments, track cycles, provide health guidance, or connect with our community. What would you like help with today?";
        } else if ((action === 'start_interactive_scheduling' || action === 'schedule_meeting') && activePhone) {
          try {
            const patient = await getPatientByPhone(activePhone);
            const providerName = typeof parsed.provider_name === 'string' ? parsed.provider_name : undefined;
            
            // If user provided a time, create approval request directly
            if (preferredTime) {
              const result = await startSchedulingSession(activePhone, patient?.id || '', providerName);
              const followup = await processTimeSelection(result.session.id, activePhone, preferredTime, reason);
              answer = providedAnswer || followup;
            } else {
              // No time provided - start session and ask for time
              const result = await startSchedulingSession(activePhone, patient?.id || '', providerName);
              answer = providedAnswer || result.message;
            }
          } catch (e: any) {
            console.error('[Agent->start_interactive_scheduling] error', e?.message || e);
            answer = "I'm having trouble starting the scheduling process. Please try again later.";
          }
        } else if (action === 'process_time_selection' && activePhone) {
          try {
            const message = await processTimeSelection(
              parsed.session_id || '',
              activePhone,
              preferredTime || 'tomorrow at 2 PM',
              reason
            );
            answer = providedAnswer || message;
          } catch (e: any) {
            console.error('[Agent->process_time_selection] error', e?.message || e);
            answer = "I'm having trouble scheduling your appointment. Please try again.";
          }
        } else if (action === 'check_availability' && activePhone) {
          // Keep this lightweight: direct user into the interactive flow.
          // (We avoid claiming a meeting is created before provider approval.)
          answer = providedAnswer || "I can help you schedule this. Tell me a preferred time (e.g., 'tomorrow at 2 PM'), and I'll send it to the provider for approval.";
        } else if (providerScopedPhone && (msg.toLowerCase().includes('confirm') || msg.toLowerCase().includes('decline') || msg.toLowerCase().includes('pending') || msg.toLowerCase().trim() === 'yes' || msg.toLowerCase().trim() === 'no')) {
          // Handle provider responses for meeting approvals
          try {
            const result = await handleProviderApprovalResponse(providerScopedPhone, msg);
            answer = providedAnswer || result.response;
          } catch (e: any) {
            console.error('[Agent->provider_response] error', e?.message || e);
            answer = "I'm having trouble processing your response. Please try again.";
          }
        } else if (providedAnswer) {
          answer = providedAnswer;
        } else {
          // Safe default if the model omitted 'answer'
          answer = "Thanks — I’ve noted your request. A provider will review and follow up here shortly.";
        }
      } else {
        // Fallback: if raw looks like JSON, hide it behind a friendly line
        if (/^\s*\{[\s\S]*\}\s*$/.test(raw)) {
          answer = "Thanks — I’ve noted your request. A provider will review and follow up here shortly.";
        } else {
          answer = raw;
        }
      }
    } catch (e: any) {
      console.error('[agent->openai] error', e?.message || e);
    }
  }

  // Fallback summarizer if OpenAI missing or failed
  if (!answer && results.length > 0) {
    const top = results.slice(0, Math.min(3, results.length));
    const lines = [
      top.length === 1 ? `I found 1 relevant source:` : `I found ${top.length} relevant sources:`,
      ...top.map((r, i) => `${i + 1}. ${r.title}${r.sourceUrl ? ` — ${r.sourceUrl}` : ""}`),
    ];
    answer = lines.join("\n");
  }

  if (opts.whatsappStyle) {
    answer = formatWhatsApp(answer);
  } else {
    answer = answer.trim();
  }

  return { answer, matches: results, billable };
}
