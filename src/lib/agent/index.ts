// Core agent entry. Minimal, safe scaffolding to be wired into API later.

import { ragSearch } from "./tools/rag";

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
  return String(text || "")
    .replace(/\s+$/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^#+\s*/gm, "")
    .replace(/\*{2,}/g, "*")
    .trim();
}

export async function agentRespond(opts: {
  message: string;
  topK?: number;
  whatsappStyle?: boolean;
  history?: AgentHistoryItem[];
}): Promise<AgentResponse> {
  const msg = String(opts.message || "").trim();
  const topK = Number(opts.topK ?? process.env.RAG_DEFAULT_TOPK ?? 5);

  // Always call RAG first; keep simple scaffolding for now
  const { results } = await ragSearch({ query: msg, topK, sessionKey: getRagSessionKey() || undefined });

  // Placeholder answer for now; API layer can replace with full agent later
  let answer = "";
  let billable = false;

  if (opts.whatsappStyle) {
    answer = formatWhatsApp(answer);
  } else {
    answer = answer.trim();
  }

  return { answer, matches: results, billable };
}
