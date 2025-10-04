"use client"

import { useCallback, useEffect, useMemo, useState } from 'react'

type EscItem = {
  id: string
  createdAt: string
  updatedAt: string
  phoneE164: string | null
  subjectType: 'patient' | 'visitor'
  subjectId: string | null
  summary: string | null
  media?: { mimeType?: string | null; url?: string | null; filename?: string | null; sizeBytes?: number | null } | null
  status: 'open' | 'in_progress' | 'closed'
}

type Perms = { canUpdate: boolean; canClose: boolean }

export default function EscalationsPage() {
  const [items, setItems] = useState<EscItem[]>([])
  const [loading, setLoading] = useState(true)
  const [perms, setPerms] = useState<Perms>({ canUpdate: true, canClose: true })
  const [active, setActive] = useState<EscItem | null>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [convLoading, setConvLoading] = useState(false)
  const [reply, setReply] = useState('')
  const [note, setNote] = useState('')
  const [status, setStatus] = useState<'open' | 'in_progress' | 'closed'>('open')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/escalations/list', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to load escalations')
      setItems(data.items || [])
      setPerms(data.permissions || { canUpdate: true, canClose: true })
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(()=>{ load() }, [load])

  const openDetail = useCallback(async (it: EscItem) => {
    setActive(it)
    setStatus(it.status)
    setNote('')
    setReply('')
    setMessages([])
    if (!it.subjectId) return
    setConvLoading(true)
    try {
      const url = `/api/admin/conversations/by-subject?subjectType=${encodeURIComponent(it.subjectType)}&subjectId=${encodeURIComponent(it.subjectId)}&take=50`
      const res = await fetch(url, { cache: 'no-store' })
      const data = await res.json()
      if (res.ok) setMessages(data.messages || [])
    } catch (e) { console.error(e) }
    finally { setConvLoading(false) }
  }, [])

  const mediaPreview = useMemo(() => {
    if (!active?.media?.url) return null
    const mime = String(active.media.mimeType || '')
    const url = active.media.url
    if (mime.startsWith('image/')) return <img src={url!} alt="media" className="max-h-60 rounded border" />
    if (mime.startsWith('video/')) return <video src={url!} controls className="w-full max-h-60 rounded border" />
    if (mime.startsWith('audio/')) return <audio src={url!} controls className="w-full" />
    return <a href={url!} target="_blank" className="text-blue-600 underline">Open attachment</a>
  }, [active?.media])

  async function onSend() {
    if (!active || !reply.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/admin/escalations/message', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id: active.id, text: reply }) })
      const data = await res.json(); if (!res.ok) throw new Error(data?.error || 'Failed to send')
      setReply('')
      if (active.subjectId) openDetail(active)
    } catch (e:any) { alert(e?.message || 'Failed') }
    finally { setSaving(false) }
  }

  async function onUpdate() {
    if (!active) return
    if (!perms.canUpdate) { alert('You do not have permission to update escalations.'); return }
    if (status === 'closed' && !perms.canClose) { alert('You do not have permission to close escalations.'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/admin/escalations/update', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id: active.id, status, note: note || undefined }) })
      const data = await res.json(); if (!res.ok) throw new Error(data?.error || 'Failed to update')
      setNote('')
      await load()
      // sync active row
      const updated = (items.find(x => x.id === active.id) || null)
      if (updated) setActive(updated)
    } catch (e:any) { alert(e?.message || 'Failed') }
    finally { setSaving(false) }
  }

  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Escalations</h1>
        <button onClick={load} className="px-3 py-1.5 rounded border text-sm">Refresh</button>
      </div>

      <div className="border rounded overflow-hidden">
        <div className="grid grid-cols-6 text-xs font-medium uppercase text-gray-500 border-b px-3 py-2">
          <div>Created</div>
          <div>Phone</div>
          <div>Subject</div>
          <div>Summary</div>
          <div>Status</div>
          <div>Actions</div>
        </div>
        {loading ? (
          <div className="p-4 text-sm">Loading…</div>
        ) : items.length === 0 ? (
          <div className="p-4 text-sm text-gray-600">No escalations yet.</div>
        ) : (
          items.map((e) => (
            <div key={e.id} className="grid grid-cols-6 items-center px-3 py-2 border-b last:border-b-0 text-sm">
              <div className="text-xs text-gray-500">{new Date(e.createdAt).toLocaleString()}</div>
              <div>{e.phoneE164 || '-'}</div>
              <div className="capitalize">{e.subjectType}</div>
              <div className="truncate" title={e.summary || ''}>{e.summary || '—'}</div>
              <div>
                <span className="px-2 py-0.5 rounded text-xs border">{e.status}</span>
              </div>
              <div>
                <button onClick={()=>openDetail(e)} className="text-blue-600 hover:underline text-xs">View</button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Detail drawer */}
      {active && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={()=> setActive(null)} />
          <div className="relative bg-white w-full max-w-4xl rounded shadow-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="text-lg font-semibold">Escalation</div>
                <div className="text-xs text-gray-500">{active.phoneE164 || ''} • {active.subjectType}</div>
              </div>
              <button onClick={()=> setActive(null)} className="text-gray-500">✕</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div>
                  <div className="text-sm font-medium">Media</div>
                  <div className="mt-2">{mediaPreview || <div className="text-xs text-gray-500">No media URL</div>}</div>
                  {active.media?.filename && <div className="text-xs text-gray-500 mt-1">{active.media.filename}</div>}
                </div>
                <div>
                  <div className="text-sm font-medium">Summary</div>
                  <div className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">{active.summary || '—'}</div>
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium">Status</label>
                  <select value={status} onChange={e=> setStatus(e.target.value as any)} className="border rounded px-3 py-2 w-full">
                    <option value="open">open</option>
                    <option value="in_progress">in_progress</option>
                    <option value="closed">closed</option>
                  </select>
                  <label className="block text-sm font-medium mt-2">Add note</label>
                  <textarea value={note} onChange={e=> setNote(e.target.value)} className="border rounded px-3 py-2 w-full h-20" placeholder="What you changed / plan to do" />
                  <div className="flex items-center justify-end">
                    <button onClick={onUpdate} disabled={saving} className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50">{saving ? 'Saving…' : 'Update'}</button>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium">Conversation</div>
                {convLoading ? (
                  <div className="text-sm">Loading…</div>
                ) : (
                  <div className="border rounded max-h-80 overflow-auto divide-y">
                    {messages.length === 0 ? (
                      <div className="p-3 text-sm text-gray-500">No messages</div>
                    ) : (
                      messages.map((m:any) => (
                        <div key={m.id} className="p-3 text-sm">
                          <div className="text-xs text-gray-500 mb-1">{m.direction} via {m.via} · {new Date(m.createdAt).toLocaleString()}</div>
                          <div className="whitespace-pre-wrap">{m.body}</div>
                        </div>
                      ))
                    )}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <input value={reply} onChange={e=> setReply(e.target.value)} className="border rounded px-3 py-2 w-full" placeholder="Reply to patient…" />
                  <button onClick={onSend} disabled={saving || !reply.trim()} className="bg-green-600 text-white px-3 py-2 rounded disabled:opacity-50">Send</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
