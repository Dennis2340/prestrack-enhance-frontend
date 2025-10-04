const BASE_URL = process.env.PUBLIC_BASE_URL || 'https://message.geneline-x.net'

function authHeaders() {
  const key = process.env.GENELINE_X_API_KEY
  if (!key) throw new Error('GENELINE_X_API_KEY is not set')
  return {
    'X-API-Key': key,
    'Authorization': `Bearer ${key}`,
  }
}

export async function genelineFetch(path: string, init: RequestInit = {}) {
  const url = `${BASE_URL}${path}`
  const headers = new Headers(init.headers)
  const a = authHeaders()
  headers.set('X-API-Key', a['X-API-Key'])
  headers.set('Authorization', a['Authorization'] as string)
  return fetch(url, { ...init, headers })
}

export async function enqueueIngestion(input: {
  files: Array<{ url: string; filename: string; mime?: string; metadata?: Record<string, any> }>
  namespace: string
}) {
  const res = await genelineFetch('/api/v1/files/ingest-urls', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Ingestion request failed: ${res.status} ${text}`)
  }
  return res.json() as Promise<{ jobs: Array<{ jobId: string; url: string }> }>
}

export async function getJob(jobId: string) {
  const res = await genelineFetch(`/api/v1/jobs/${jobId}`)
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Job fetch failed: ${res.status} ${text}`)
  }
  return res.json() as Promise<{
    jobId: string
    message?: string
    progress?: number
    stage?: string
    total?: number
    updated?: string
  }>
}

export async function embeddingsSearch(input: {
  query: string
  namespace: string
  indexName?: string
  topK?: number
  filter?: Record<string, any>
}) {
  const body = {
    query: input.query,
    namespace: input.namespace,
    topK: input.topK ?? 5,
    ...(input.indexName ? { indexName: input.indexName } : {}),
    ...(input.filter ? { filter: input.filter } : {}),
  }
  const res = await genelineFetch('/api/v1/embeddings/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Embeddings search failed: ${res.status} ${text}`)
  }
  return res.json() as Promise<{
    matches: Array<{
      id: string
      score: number
      metadata?: Record<string, any>
    }>
  }>
}

export async function deleteFile(input: { url?: string; fileId?: string; namespace?: string }) {
  // Preferred path: delete by fileId via /api/v1/files/{fileId}
  if (input.fileId) {
    const path = `/api/v1/files/${encodeURIComponent(input.fileId)}`
    // Some servers accept DELETE with JSON body; include namespace when provided
    const res = await genelineFetch(path, {
      method: 'DELETE',
      headers: input.namespace ? { 'Content-Type': 'application/json' } : undefined,
      body: input.namespace ? JSON.stringify({ namespace: input.namespace }) : undefined,
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Delete file by id failed: ${res.status} ${text}`)
    }
    return res.json().catch(() => ({}))
  }

  // Fallback: purge by URL
  if (input.url) {
    const body: Record<string, any> = { url: input.url }
    if (input.namespace) body.namespace = input.namespace
    const res = await genelineFetch('/api/v1/files/purge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Purge by URL failed: ${res.status} ${text}`)
    }
    return res.json().catch(() => ({}))
  }

  throw new Error('deleteFile requires url or fileId')
}

// Send a message to a chatbot and stream plain-text AI response
// Uses GENELINE_X_CHATBOT_ID as the chatbot identifier (maps to namespace per server config)
export async function sendChatbotMessage(input: { message: string; email?: string }) {
  const chatbotId = process.env.GENELINE_X_CHATBOT_ID || process.env.GENELINE_X_NAMESPACE || "default"
  const body = {
    chatbotId,
    ...(input.email ? { email: input.email } : {}),
    message: String(input.message || "").trim(),
  }
  if (!body.message) throw new Error("message is required")

  const res = await genelineFetch('/api/v1/message', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/plain' },
    body: JSON.stringify(body),
  })
  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => '')
    throw new Error(`message request failed: ${res.status} ${text}`)
  }

  // Read streamed text/plain response
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let out = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    out += decoder.decode(value, { stream: true })
  }
  out += decoder.decode()
  return out.trim()
}
