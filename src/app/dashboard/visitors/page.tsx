"use client"

import { useEffect, useState } from 'react'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'

type VisitorItem = { id: string; name: string | null; phoneE164: string | null; createdAt: string }

export default function VisitorsPage() {
  const [items, setItems] = useState<VisitorItem[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [active, setActive] = useState<VisitorItem | null>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [convLoading, setConvLoading] = useState(false)
  const [reply, setReply] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/visitors/list', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to load visitors')
      setItems(data.items || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(()=>{ load() }, [])

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Visitors</h1>
        <button onClick={load} className="px-3 py-1.5 rounded border text-sm">Refresh</button>
      </div>

      <div className="border rounded">
        <div className="grid grid-cols-4 text-xs font-medium uppercase text-gray-500 border-b px-3 py-2">
          <div>Name</div>
          <div>Phone</div>
          <div>Created</div>
          <div>Actions</div>
        </div>
        {loading ? (
          <div className="p-4 text-sm">Loading…</div>
        ) : items.length === 0 ? (
          <div className="p-4 text-sm text-gray-600">No visitors yet.</div>
        ) : (
          items.map(v => (
            <div key={v.id} className="grid grid-cols-4 items-center px-3 py-2 border-b last:border-b-0 text-sm">
              <div>{v.name || '-'}</div>
              <div>{v.phoneE164 || '-'}</div>
              <div className="text-xs text-gray-500">{new Date(v.createdAt).toLocaleString()}</div>
              <div className="text-xs">
                <button className="text-blue-600 hover:underline mr-3" onClick={async ()=>{
                  setActive(v); setMessages([]); setReply(''); setConvLoading(true)
                  try {
                    const url = `/api/admin/conversations/by-subject?subjectType=visitor&subjectId=${encodeURIComponent(v.id)}&take=50`
                    const res = await fetch(url, { cache: 'no-store' })
                    const data = await res.json(); if (res.ok) setMessages(data.messages || [])
                  } catch {}
                  finally { setConvLoading(false) }
                }}>View</button>
                <button
                  className="text-red-600 hover:underline disabled:opacity-50"
                  disabled={deletingId === v.id}
                  onClick={()=>{ setPendingDeleteId(v.id); setConfirmOpen(true) }}
                >Delete</button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Detail drawer */}
      {active && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={()=> setActive(null)} />
          <div className="relative bg-white w-full max-w-3xl rounded shadow-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="text-lg font-semibold">Visitor</div>
                <div className="text-xs text-gray-500">{active.phoneE164 || ''}</div>
              </div>
              <button onClick={()=> setActive(null)} className="text-gray-500">✕</button>
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
                    messages.map((m:any) => {
                      let content: any = m.body
                      try {
                        if (typeof m.body === 'string' && m.body.trim().startsWith('{')) {
                          const j = JSON.parse(m.body)
                          if (j && j.kind === 'media') {
                            const mime = String(j.mimetype || j.mimeType || 'application/octet-stream')
                            if (j.url && /^image\//.test(mime)) {
                              content = (<img src={j.url} alt={j.filename || ''} className="max-h-60 rounded border" />)
                            } else if (j.url && /^audio\//.test(mime)) {
                              content = (<audio controls src={j.url} />)
                            } else if (j.url) {
                              content = (<a className="text-blue-600 underline" href={j.url} target="_blank" rel="noreferrer">Download file</a>)
                            }
                            if (j.caption) {
                              content = (<div className="space-y-1"><div>{content}</div><div className="text-xs whitespace-pre-wrap">{j.caption}</div></div>)
                            }
                          }
                        }
                      } catch {}
                      return (
                        <div key={m.id} className="p-3 text-sm">
                          <div className="text-xs text-gray-500 mb-1">{m.direction} via {m.via} · {new Date(m.createdAt).toLocaleString()}</div>
                          <div className="whitespace-pre-wrap">{content}</div>
                        </div>
                      )
                    })
                  )}
                </div>
              )}
              <div className="flex items-center gap-2">
                <input value={reply} onChange={e=> setReply(e.target.value)} className="border rounded px-3 py-2 w-full" placeholder="Reply to visitor…" />
                <button onClick={async ()=>{
                  if (!reply.trim()) return
                  try {
                    const res = await fetch(`/api/admin/visitors/${active.id}/message`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ body: reply }) })
                    const d = await res.json(); if (!res.ok) throw new Error(d?.error || 'Failed')
                    setReply('')
                    // reload
                    setConvLoading(true)
                    const url = `/api/admin/conversations/by-subject?subjectType=visitor&subjectId=${encodeURIComponent(active.id)}&take=50`
                    const r2 = await fetch(url, { cache: 'no-store' }); const d2 = await r2.json(); if (r2.ok) setMessages(d2.messages || [])
                  } catch(e:any) { alert(e?.message || 'Failed') }
                  finally { setConvLoading(false) }
                }} className="bg-green-600 text-white px-3 py-2 rounded">Send</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm delete dialog */}
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Delete visitor?"
        description="This will remove the visitor and related conversations. This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={async ()=>{
          const id = pendingDeleteId
          if (!id) return
          setDeletingId(id)
          try {
            const res = await fetch('/api/admin/visitors/delete', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id }) })
            const d = await res.json(); if (!res.ok) throw new Error(d?.error || 'Failed')
            await load()
          } catch(e:any) {
            // non-blocking failure path
            console.error(e)
          } finally {
            setDeletingId(null)
            setPendingDeleteId(null)
          }
        }}
      />
    </div>
  )
}
