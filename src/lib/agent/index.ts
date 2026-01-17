// Core agent entry. Minimal, safe scaffolding to be wired into API later.

import { ragSearch } from "./tools/rag";
import OpenAI from "openai";
import { createMedicalEscalation } from "./tools/medical";
import { fetchPatientContextByPhone } from "./tools/patientContext";
import prisma from "@/lib/prisma";

export type AgentHistoryItem = { role: "user" | "assistant" | "system"; content: string };
export type RagSearchResult = { title: string; text: string; score: number; sourceUrl?: string };
export type AgentResponse = { answer: string; matches: RagSearchResult[]; billable: boolean };

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

function detectAncDangerSigns(text: string): string[] {
  const t = String(text || "").toLowerCase();
  const hits: string[] = [];
  if (/severe\s+headache/.test(t) || (t.includes('headache') && t.includes('severe'))) hits.push('severe headache');
  if (/blurred\s+vision/.test(t) || (t.includes('vision') && (t.includes('blur') || t.includes('blurry')))) hits.push('blurred vision');
  if (/(heavy|lots\s+of)\s+(vaginal\s+)?bleeding/.test(t) || (t.includes('bleeding') && t.includes('heavy'))) hits.push('heavy vaginal bleeding');
  if (/severe\s+(abdominal|stomach)\s+pain/.test(t) || (t.includes('abdominal') && t.includes('pain') && t.includes('severe'))) hits.push('severe abdominal pain');
  if (/reduced\s+fetal\s+movements?/.test(t) || /baby\s+(not\s+moving|stopped\s+moving|moving\s+less)/.test(t)) hits.push('reduced fetal movements');
  if (/\bfever\b/.test(t) && (/(38(\.|\s*)?c)/.test(t) || t.includes('102') || t.includes('high fever'))) hits.push('fever');
  if (/(convulsions?|seizures?)/.test(t)) hits.push('convulsions/seizure');
  if (/(severe\s+)?short(ness)?\s+of\s+breath/.test(t) || (t.includes('breath') && t.includes('short'))) hits.push('severe shortness of breath');
  if (/swelling\s+of\s+(face|hands)/.test(t) || (t.includes('swelling') && (t.includes('face') || t.includes('hands')))) hits.push('swelling of face/hands');
  return Array.from(new Set(hits));
}

function formatProviderFallback(results: RagSearchResult[], topK: number) {
  const top = results.slice(0, Math.max(1, Math.min(8, topK)));
  if (top.length === 0) return 'No relevant lines in sources.';

  const lines: string[] = [];
  lines.push('Sources:');
  for (let i = 0; i < top.length; i++) {
    const r = top[i];
    const url = r.sourceUrl ? ` — ${r.sourceUrl}` : '';
    lines.push(`[S${i + 1}] ${r.title}${url}`);
  }

  lines.push('');
  lines.push('Quoted lines:');
  for (let i = 0; i < top.length; i++) {
    const r = top[i];
    const raw = String(r.text || '');
    const excerpt = raw
      .split(/\r?\n/)
      .map(s => s.trim())
      .filter(Boolean)
      .slice(0, 3);
    if (excerpt.length === 0) continue;
    for (const q of excerpt) {
      // Keep each quote short-ish for WhatsApp readability
      const clipped = q.length > 240 ? q.slice(0, 235) + '…' : q;
      lines.push(`- "${clipped}" [S${i + 1}]`);
    }
  }
  return lines.join('\n');
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
      ? formatWhatsApp("🌸 Welcome to HOA! I'm Prestrack, your women's wellness assistant. I can help you:\n\n• Track menstrual cycles and symptoms\n• Get personalized health guidance\n• Connect with our supportive community\n• Answer your health questions\n\nWhat would you like help with today? If you sent a file, a provider will review it shortly.")
      : "🌸 Welcome to HOA! I'm Prestrack, your women's wellness assistant. I can help you track menstrual cycles, provide health guidance, connect with community support, and answer your health questions. What would you like help with today?";
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

  // Rule-based emergency escalation for patients (works even without OpenAI)
  if (patientScopedPhone) {
    const danger = detectAncDangerSigns(msg);
    if (danger.length > 0) {
      try {
        await createMedicalEscalation({
          phoneE164: patientScopedPhone,
          summary: `ANC danger signs: ${danger.join(', ')} — ${msg}`.slice(0, 180),
          subjectType: 'patient',
          subjectId: null,
        });
      } catch {}
      answer = "I've alerted a healthcare provider right away. If this is a life‑threatening emergency, please call your local emergency number.";
      if (opts.whatsappStyle) answer = formatWhatsApp(answer);
      return { answer, matches: results, billable: false };
    }
  }
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
        const providerSys = `You are Prestrack, a women's wellness AI assistant helping healthcare providers over WhatsApp.\n\nSTRUCTURE (MANDATORY):\n1) One short intro sentence addressing the provider (no claims).\n2) Quoted bullets of factual content from sources, each ending with a citation like [S1], [S2].\n3) One short closing sentence (e.g., availability of further details), no new claims.\n\nSELECTION: Select only lines that directly answer the question. Omit generic lists of topics or headings that are not answering the question.\n\nRULES:\n- Do NOT paraphrase factual content beyond direct quotes.\n- Use ONLY the provided Sources; no external knowledge.\n- No layman simplification; keep clinical phrasing as quoted.\n- If no relevant content, reply: "No relevant lines in sources."\n- Do NOT output unrelated sections or headings just because they match keywords.`
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
    answer = formatProviderFallback(results, topK);
    if (opts.whatsappStyle) answer = formatWhatsApp(answer);
    return { answer, matches: results, billable: false };
  }

  if (hasOpenAI) {
    try {
      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const base = `You are Prestrack, a compassionate women's wellness AI assistant answering over WhatsApp. Keep replies concise, readable, and actionable:
 - Limit to ~6 short lines.
 - Prefer short sentences and simple bullets.
 - Prefer using the provided Context when available; summarize only the most relevant facts from Context.
 - If Context is missing or thin, provide general, evidence-based health guidance within common clinical practice. Keep it high-level and safe.
 - Avoid long URLs unless essential.
 - Do not mention scheduling or booking appointments.`;

      const patientStyle = `
TONE AND STYLE FOR PATIENTS:
- Use plain language (layman's terms). Avoid or explain any medical jargon in simple words.
- Aim for a ~5th–8th grade reading level.
- Focus on clear steps the person can take now (hydration, rest, OTC options with cautions, when to seek urgent care).
- Be reassuring, practical, and non-alarming.
`;

      const safety = `
DOMAIN AND SAFETY (MANDATORY):
- Only answer health/clinical questions. If the topic is unrelated to health, ask the user to provide a health-related question.
- If unsure, say you don't know.
`;
      const sys = [base, patientStyle, safety].join("\n\n");

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
      const prompt = `User message:\n${msg}\n\nContext (may be empty):\n${context}\n\nInstructions:\n- Answer in plain language that a patient can understand.\n- Use the Context when relevant; otherwise give safe general guidance.\n- Keep it concise and WhatsApp-friendly.`;
      const completion = await client.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        temperature: 0.2,
        messages: [
          { role: 'system', content: sys },
          ...(opts.history || []).map(h => ({ role: h.role, content: h.content } as any)),
          { role: 'user', content: prompt },
        ],
      });
      answer = (completion.choices?.[0]?.message?.content || '').trim();
      billable = true;
      if (!answer) answer = "Please tell me a bit more about what's going on (your symptoms and how long it's been).";
    } catch (e: any) {
      console.error('[agent->openai] error', e?.message || e);
    }
  }

  // Fallback if OpenAI missing or failed
  if (!answer && results.length > 0) {
    if (providerScopedPhone) {
      answer = formatProviderFallback(results, topK);
    } else {
      const r = results[0];
      const raw = String(r?.text || '').trim();
      const excerpt = raw
        .split(/\r?\n/)
        .map(s => s.trim())
        .filter(Boolean)
        .slice(0, 4)
        .join(' ');
      const clipped = excerpt.length > 520 ? excerpt.slice(0, 515) + '…' : excerpt;
      answer = clipped
        ? `Here's what I found that may help:\n${clipped}`
        : "I couldn't find enough detail in the sources. Can you tell me your symptoms and how long it's been happening?";
    }
  }

  if (opts.whatsappStyle) {
    answer = formatWhatsApp(answer);
  } else {
    answer = answer.trim();
  }

  return { answer, matches: results, billable };
}
