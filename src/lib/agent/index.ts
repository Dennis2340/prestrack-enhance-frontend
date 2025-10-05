// Core agent entry. Minimal, safe scaffolding to be wired into API later.

import { ragSearch } from "./tools/rag";
import OpenAI from "openai";
import { createMedicalEscalation } from "./tools/medical";
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
      ? formatWhatsApp("How can I help you today? If you sent a file, a provider will review it shortly.")
      : "How can I help you today?";
    return { answer, matches: [], billable: false };
  }

  // Resolve scope: try patient by phone; if not found -> general RAG (works for visitors/unknown)
  const rawPhone = getAgentIncomingPhone();
  const phoneE164 = rawPhone && /^\+\d{6,15}$/.test(rawPhone) ? rawPhone : undefined;
  let patientScopedPhone: string | undefined = undefined;
  try {
    if (phoneE164) {
      const cc = await prisma.contactChannel.findFirst({
        where: { type: 'whatsapp', value: phoneE164, ownerType: 'patient' },
        select: { id: true, patientId: true },
      });
      if (cc?.patientId) patientScopedPhone = phoneE164;
    }
  } catch (e:any) {
    console.error('[agent->scope] lookup error', e?.message || e);
  }
  try { console.log(`[agent] scope=%s`, patientScopedPhone ? 'patient' : 'general') } catch {}
  const { results } = await ragSearch({ query: msg, topK, sessionKey: getRagSessionKey() || undefined, patientPhoneE164: patientScopedPhone });

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

  if (hasOpenAI) {
    try {
      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const base = `You are Prestrack, a helpful clinical assistant answering over WhatsApp. Keep replies concise, readable, and actionable:
 - Limit to ~6 short lines.
 - Prefer short sentences and simple bullets.
 - Prefer using the provided Context when available; summarize only the most relevant facts from Context.
 - If Context is missing or thin, provide general, evidence-based health guidance within common clinical practice. Keep it high-level and safe.
 - Avoid long URLs unless essential.`;

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
- Do not fabricate specific patient details or records. Avoid firm diagnosis; provide general guidance and when to seek care.
- If unsure, say you don't know.
`;

      const sys = [
        base,
        patientScopedPhone ? patientStyle : providerStyle,
        safety,
        `\n\nOUTPUT FORMAT (MANDATORY):\nReturn a single JSON object with keys:\n- action: 'answer' | 'escalate' | 'onboard_name'\n- answer: string (message to send to the user, WhatsApp-friendly)\n- escalate_summary?: string (short summary if action is 'escalate')\n- name?: string (when action is 'onboard_name', the visitor name to save)\nExample:\n{"action":"answer","answer":"..."}`,
      ].join("\n\n");
      const context = results.slice(0, Math.max(1, Math.min(8, topK))).map((r, i) => `# Source ${i + 1}: ${r.title}${r.sourceUrl ? `\nURL: ${r.sourceUrl}` : ''}\n${r.text}`).join("\n\n");
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
          answer = providedAnswer || "Thanks — noted. How can I help you today?";
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
