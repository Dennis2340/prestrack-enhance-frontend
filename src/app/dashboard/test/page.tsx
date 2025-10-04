"use client"

import { useState } from "react"

export default function TestAgentPage() {
  const [message, setMessage] = useState("")
  const [phoneE164, setPhoneE164] = useState("")
  const [loading, setLoading] = useState(false)
  const [answer, setAnswer] = useState<string | null>(null)
  const [matches, setMatches] = useState<Array<{ title: string; sourceUrl?: string; score?: number; text?: string }>>([])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setAnswer(null)
    setMatches([])
    try {
      const res = await fetch('/api/test/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, phoneE164: phoneE164 || undefined, sessionKey: 'test' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed')
      setAnswer(String(data.answer || ''))
      setMatches(Array.isArray(data.matches) ? data.matches : [])
    } catch (e: any) {
      setAnswer(e?.message || 'Failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold mb-4">Test Agent</h1>
      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <label className="block text-sm font-medium mb-1">Message</label>
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} className="border rounded px-3 py-2 w-full h-28" placeholder="Ask a question..." required />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Patient phone (E.164) — optional</label>
          <input value={phoneE164} onChange={(e) => setPhoneE164(e.target.value)} className="border rounded px-3 py-2 w-full" placeholder="+15551234567" />
          <p className="text-xs text-gray-500 mt-1">When provided, the agent searches only this patient's uploaded sources.</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="submit" disabled={loading} className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50">{loading ? 'Testing…' : 'Test'}</button>
          <button type="button" onClick={() => { setAnswer(null); setMatches([]) }} className="px-4 py-2 border rounded">Clear</button>
        </div>
      </form>

      {answer !== null && (
        <div className="mt-6 space-y-4">
          <div className="border rounded p-3">
            <div className="text-sm font-medium mb-1">Answer</div>
            <div className="whitespace-pre-wrap text-sm">{answer}</div>
          </div>
          <div className="border rounded p-3">
            <div className="text-sm font-medium mb-2">Matches</div>
            <div className="space-y-2">
              {matches.length === 0 ? (
                <div className="text-sm text-gray-500">No matches.</div>
              ) : (
                matches.map((m, i) => (
                  <div key={i} className="border rounded p-2">
                    <div className="text-sm font-medium">{m.title}</div>
                    {typeof m.score === 'number' && <div className="text-xs text-gray-500">Score: {m.score.toFixed(3)}</div>}
                    {m.sourceUrl && <div className="text-xs text-blue-600 break-all">{m.sourceUrl}</div>}
                    {m.text && <div className="text-xs text-gray-700 mt-1 line-clamp-3">{m.text}</div>}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
