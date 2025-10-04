"use client"

import { useEffect, useState } from 'react'

type ProviderItem = { id: string; name: string | null; email: string | null; phoneE164: string | null; createdAt: string }

export default function ProvidersDashboardPage() {
  const [items, setItems] = useState<ProviderItem[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [phoneE164, setPhoneE164] = useState('')
  const [specialty, setSpecialty] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [actionOpenId, setActionOpenId] = useState<string | null>(null)
  const [activeProvider, setActiveProvider] = useState<ProviderItem | null>(null)

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/providers/list', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to load providers')
      setItems(data.items || [])
    } catch (e: any) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  async function onDeleteConfirmed() {
    const id = confirmDeleteId
    if (!id) return
    setDeletingId(id)
    try {
      const res = await fetch('/api/admin/providers/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to delete provider')
      await load()
    } catch (e: any) {
      alert(e?.message || 'Delete failed')
    } finally {
      setDeletingId(null)
      setConfirmDeleteId(null)
    }
  }

  useEffect(() => { load() }, [])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      const res = await fetch('/api/admin/providers/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name || undefined, phoneE164, specialty: specialty || undefined, email: email || undefined, password: password || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to create provider')
      setOpen(false)
      setName('')
      setPhoneE164('')
      setSpecialty('')
      setEmail('')
      setPassword('')
      await load()
    } catch (e: any) {
      alert(e?.message || 'Error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Care Providers</h1>
        <button onClick={() => setOpen(true)} className="bg-blue-600 text-white px-4 py-2 rounded">Add Care Provider</button>
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
          <div className="p-4 text-sm text-gray-600">No providers yet.</div>
        ) : (
          items.map((p) => (
            <div key={p.id} className="relative grid grid-cols-4 items-center px-3 py-2 border-b last:border-b-0 text-sm">
              <div>{p.name || '-'}</div>
              <div>{p.phoneE164 || '-'}</div>
              <div className="text-xs text-gray-500">{new Date(p.createdAt).toLocaleString()}</div>
              <div className="text-xs flex items-center gap-3 justify-end">
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-600">Escalation rights</label>
                  <select
                    className="border rounded px-2 py-1 text-xs"
                    defaultValue="none"
                    onChange={async (e)=>{
                      const v = e.target.value
                      // Map select to flags and send a single update call (twice is ok if backend expects individual keys)
                      const payload: any = { userId: (p as any).userId }
                      if (v === 'none') { payload.canUpdateEscalations = false; payload.canCloseEscalations = false }
                      if (v === 'update') { payload.canUpdateEscalations = true; payload.canCloseEscalations = false }
                      if (v === 'close') { payload.canUpdateEscalations = true; payload.canCloseEscalations = true }
                      try {
                        await fetch('/api/admin/providers/update-privileges', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) })
                      } catch {}
                    }}
                  >
                    <option value="none">No access</option>
                    <option value="update">Can update</option>
                    <option value="close">Can update & close</option>
                  </select>
                </div>

                <button
                  className="px-2 py-1 rounded border text-red-600 hover:bg-red-50"
                  onClick={()=> setConfirmDeleteId(p.id)}
                >Delete</button>

                {/* Actions menu */}
                <div className="relative">
                  <button className="px-2 py-1 rounded border" onClick={()=> setActionOpenId(v => v === p.id ? null : p.id)}>⋮</button>
                  {actionOpenId === p.id && (
                    <div className="absolute right-0 mt-1 w-40 bg-white border rounded shadow z-10">
                      <button className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50" onClick={()=>{ setActiveProvider(p); setActionOpenId(null) }}>View</button>
                      <button className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50" onClick={()=>{ setConfirmDeleteId(p.id); setActionOpenId(null) }}>Delete</button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="relative bg-white w-full max-w-lg rounded shadow-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold">Add Care Provider</h2>
              <button onClick={() => setOpen(false)} className="text-gray-500">✕</button>
            </div>
            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Full name (optional)</label>
                <input value={name} onChange={e => setName(e.target.value)} className="border rounded px-3 py-2 w-full" placeholder="Dr. Jane Doe" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Phone (E.164)</label>
                <input value={phoneE164} onChange={e => setPhoneE164(e.target.value)} className="border rounded px-3 py-2 w-full" placeholder="+15551234567" required />
                <p className="text-xs text-gray-500 mt-1">Required. Must start with + and country code.</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Specialty (optional)</label>
                <input value={specialty} onChange={e => setSpecialty(e.target.value)} className="border rounded px-3 py-2 w-full" placeholder="Pediatrics" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Email (optional)</label>
                <input value={email} onChange={e => setEmail(e.target.value)} className="border rounded px-3 py-2 w-full" placeholder="dr.jane@example.com" />
                <p className="text-xs text-gray-500 mt-1">If omitted, a placeholder email will be assigned.</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Password (optional)</label>
                <input value={password} onChange={e => setPassword(e.target.value)} type="text" className="border rounded px-3 py-2 w-full" placeholder="Temporary password" />
                <p className="text-xs text-gray-500 mt-1">If set, the WhatsApp invite will include these credentials and login link.</p>
              </div>
              <div className="flex items-center justify-end gap-2">
                <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 rounded border">Cancel</button>
                <button type="submit" disabled={submitting} className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50">{submitting ? 'Submitting…' : 'Create & Send Invite'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirm modal */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setConfirmDeleteId(null)} />
          <div className="relative bg-white w-full max-w-md rounded shadow-lg p-4">
            <div className="mb-3">
              <h3 className="text-lg font-semibold">Delete provider?</h3>
              <p className="text-sm text-gray-600 mt-1">This will remove the provider account and profile. This action cannot be undone.</p>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button onClick={() => setConfirmDeleteId(null)} className="px-4 py-2 rounded border">Cancel</button>
              <button onClick={onDeleteConfirmed} disabled={deletingId === confirmDeleteId} className="bg-red-600 text-white px-4 py-2 rounded disabled:opacity-50">
                {deletingId === confirmDeleteId ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Provider management only. Agent tools have been moved to the patient detail page. */}

      {/* View drawer */}
      {activeProvider && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={()=> setActiveProvider(null)} />
          <div className="relative bg-white w-full max-w-md rounded shadow-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold">Provider Details</h2>
              <button onClick={()=> setActiveProvider(null)} className="text-gray-500">✕</button>
            </div>
            <div className="space-y-2 text-sm">
              <div><span className="text-gray-500">Name:</span> {activeProvider.name || '-'}</div>
              <div><span className="text-gray-500">Phone:</span> {activeProvider.phoneE164 || '-'}</div>
              <div><span className="text-gray-500">Email:</span> {(activeProvider as any).email || '-'}</div>
              <div><span className="text-gray-500">Created:</span> {new Date(activeProvider.createdAt).toLocaleString()}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
