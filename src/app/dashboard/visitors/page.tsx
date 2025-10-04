"use client"

import { useEffect, useState } from 'react'

type VisitorItem = { id: string; name: string | null; phoneE164: string | null; createdAt: string }

export default function VisitorsPage() {
  const [items, setItems] = useState<VisitorItem[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)

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
                <button
                  className="text-red-600 hover:underline disabled:opacity-50"
                  disabled={deletingId === v.id}
                  onClick={async ()=>{
                    if (!confirm('Delete this visitor and related conversations?')) return
                    setDeletingId(v.id)
                    try {
                      const res = await fetch('/api/admin/visitors/delete', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id: v.id }) })
                      const d = await res.json(); if (!res.ok) throw new Error(d?.error || 'Failed')
                      await load()
                    } catch(e:any) { alert(e?.message || 'Failed') }
                    finally { setDeletingId(null) }
                  }}
                >Delete</button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
