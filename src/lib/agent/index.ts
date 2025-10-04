// Core agent entry. Minimal, safe scaffolding to be wired into API later.

import { ragSearch } from "./tools/rag";
import OpenAI from "openai";
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

  // Strict grounding: if nothing relevant was found, do not proceed to the LLM.
  if (!results || results.length === 0) {
    const fallback = "I don't have that information in my available context. I can only help with health‑related questions about your care. Please ask a health‑related question.";
    const answer = opts.whatsappStyle ? formatWhatsApp(fallback) : fallback;
    return { answer, matches: [], billable: false };
  }

  // Compose with OpenAI when configured
  let answer = "";
  let billable = false;
  const hasOpenAI = !!process.env.OPENAI_API_KEY;
  try {
    console.log(`[agent] message len=%d topK=%d scope=%s patientPhone=%s openai=%s matches=%d`,
      msg.length, topK, patientScopedPhone ? 'patient' : 'general', patientScopedPhone ? 'yes' : 'no', hasOpenAI ? 'yes' : 'no', results.length)
  } catch {}

  if (hasOpenAI) {
    try {
      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const sys = `You are Prestrack, a helpful clinical assistant answering over WhatsApp. Keep replies concise, readable, and actionable:
- Limit to ~6 short lines.
- Prefer short sentences and simple bullets.
- Include only the most relevant facts from context.
- If unsure, say you don't know.
- Avoid long URLs unless essential.

STRICT GROUNDING AND DOMAIN RULES (MANDATORY):
- Use ONLY the provided Context below. Do NOT add any information that is not explicitly present in Context.
- If the user asks about anything outside health/clinical matters, reply: "I only support health-related questions about your care. Please ask a health-related question."
- If the Context does not contain the needed information, clearly say: "Not in my available context." and ask the user to clarify a health-related question.
- Never speculate or fabricate details. Keep answers narrowly scoped to the Context.`;
      const context = results.slice(0, Math.max(1, Math.min(8, topK))).map((r, i) => `# Source ${i + 1}: ${r.title}${r.sourceUrl ? `\nURL: ${r.sourceUrl}` : ''}\n${r.text}`).join("\n\n");
      const prompt = `User question:\n${msg}\n\nContext:\n${context}\n\nWrite a WhatsApp-friendly answer now:`;
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
