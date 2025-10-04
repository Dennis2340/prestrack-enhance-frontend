import { embeddingsSearch } from "@/lib/geneline";

export type RagSearchResult = {
  title: string;
  text: string;
  score: number;
  sourceUrl?: string;
};

// Simple per-process cache with 4-minute TTL
const RAG_CACHE = new Map<string, { at: number; results: RagSearchResult[] }>();
const RAG_TTL_MS = 4 * 60 * 1000;

function makeKey(ns: string, query: string, topK: number, sessionKey?: string) {
  const norm = String(query || "").trim().toLowerCase().replace(/\s+/g, " ").slice(0, 500);
  const sess = sessionKey ? `sess=${sessionKey}|` : "sess=none|";
  return `${sess}ns=${ns}|k=${topK}|q=${norm}`;
}

// Helper to force patient scoping
export async function ragSearchForPatient(input: { query: string; phoneE164: string; topK?: number; sessionKey?: string }) {
  return ragSearch({ query: input.query, topK: input.topK, sessionKey: input.sessionKey, patientPhoneE164: input.phoneE164 });
}

export async function ragSearch({
  query,
  topK,
  sessionKey,
  patientPhoneE164,
}: {
  query: string;
  topK?: number;
  sessionKey?: string;
  patientPhoneE164?: string;
}): Promise<{ results: RagSearchResult[] }> {
  const namespace = process.env.GENELINE_X_NAMESPACE || "default";
  const k = Number(topK ?? process.env.RAG_DEFAULT_TOPK ?? 5);
  const key = makeKey(namespace, query, k, sessionKey);
  const now = Date.now();
  const hit = RAG_CACHE.get(key);
  if (hit && now - hit.at < RAG_TTL_MS) {
    return { results: hit.results };
  }

  let search: any = { matches: [] };
  try {
    const indexName = process.env.GENELINE_X_INDEX;
    const filter = patientPhoneE164 ? { patientPhoneE164 } : undefined;
    search = await embeddingsSearch({
      query,
      namespace,
      topK: k,
      ...(indexName ? { indexName } : {}),
      ...(filter ? { filter } : {}),
    });
  } catch (e: any) {
    console.error("ragSearch embeddingsSearch failed", e?.message || e);
    return { results: [] };
  }

  const matches = (search.matches || [])
    .sort((a: any, b: any) => Number(b.score || 0) - Number(a.score || 0))
    .slice(0, k);

  const results: RagSearchResult[] = matches.map((m: any, i: number) => {
    const meta: any = m.metadata || {};
    const title = meta.title || meta.filename || meta.name || `Match ${i + 1}`;
    const text = String(meta.text || meta.content || meta.chunk || "");
    const sourceUrl = meta.sourceUrl || meta.url || meta.source || undefined;
    const score = Number(m.score || 0);
    const capped = text.length > 4000 ? text.slice(0, 4000) + "…" : text;
    return { title, text: capped, score, sourceUrl };
  });

  RAG_CACHE.set(key, { at: now, results });
  return { results };
}
