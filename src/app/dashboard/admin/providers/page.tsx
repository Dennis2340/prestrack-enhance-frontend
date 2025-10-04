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
  // Provider Agent controls
  const [paPatientPhone, setPaPatientPhone] = useState('')
  const [paQuestion, setPaQuestion] = useState('')
  const [paScope, setPaScope] = useState<'general'|'patient'>('general')
  const [paSending, setPaSending] = useState(false)
  const [paAnswer, setPaAnswer] = useState('')

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
            <div key={p.id} className="grid grid-cols-4 items-center px-3 py-2 border-b last:border-b-0 text-sm">
              <div>{p.name || '-'}</div>
              <div>{p.phoneE164 || '-'}</div>
              <div className="text-xs text-gray-500">{new Date(p.createdAt).toLocaleString()}</div>
              <div className="text-xs">
                <button onClick={() => setConfirmDeleteId(p.id)} disabled={deletingId === p.id} className="text-red-600 hover:underline disabled:opacity-50">
                  Delete
                </button>
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

      {/* Provider Agent */}
      <div className="mt-8 space-y-6">
        <div className="text-xl font-semibold">Provider Agent</div>

        <div className="border rounded p-4 space-y-3">
          <div className="text-sm font-medium">Request Patient Consent</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-center">
            <label className="text-sm text-gray-600">Patient phone (E.164)</label>
            <input value={paPatientPhone} onChange={e=> setPaPatientPhone(e.target.value)} className="border rounded px-3 py-2 md:col-span-2" placeholder="+15551234567" />
          </div>
          <div className="flex items-center justify-end">
            <button onClick={async ()=>{
              if (!/^\+\d{6,15}$/.test(paPatientPhone)) { alert('Enter valid E.164 phone'); return }
              setPaSending(true)
              try {
                const res = await fetch('/api/admin/provider-agent/request-consent', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ patientPhoneE164: paPatientPhone }) })
                const data = await res.json(); if (!res.ok) throw new Error(data?.error || 'Failed')
                alert('Consent request sent to patient on WhatsApp')
              } catch(e:any) { alert(e?.message || 'Failed') }
              finally { setPaSending(false) }
            }} disabled={paSending} className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50">{paSending ? 'Sending…' : 'Send Consent Request'}</button>
          </div>
        </div>

        <div className="border rounded p-4 space-y-3">
          <div className="text-sm font-medium">Ask the Agent</div>
          <div className="flex gap-4 text-sm">
            <label className="inline-flex items-center gap-2"><input type="radio" checked={paScope==='general'} onChange={()=> setPaScope('general')} /> General</label>
            <label className="inline-flex items-center gap-2"><input type="radio" checked={paScope==='patient'} onChange={()=> setPaScope('patient')} /> Patient-scoped</label>
          </div>
          {paScope==='patient' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-center">
              <label className="text-sm text-gray-600">Patient phone (E.164)</label>
              <input value={paPatientPhone} onChange={e=> setPaPatientPhone(e.target.value)} className="border rounded px-3 py-2 md:col-span-2" placeholder="+15551234567" />
            </div>
          )}
          <textarea value={paQuestion} onChange={e=> setPaQuestion(e.target.value)} className="border rounded w-full h-28 px-3 py-2" placeholder="Your question (e.g., summarize recent labs, or ask a guideline question)" />
          <div className="flex items-center justify-end">
            <button onClick={async ()=>{
              if (!paQuestion.trim()) { alert('Enter a question'); return }
              if (paScope==='patient' && !/^\+\d{6,15}$/.test(paPatientPhone)) { alert('Enter valid E.164 phone for patient-scoped questions'); return }
              setPaSending(true); setPaAnswer('')
              try {
                const res = await fetch('/api/admin/provider-agent/ask', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ question: paQuestion, patientPhoneE164: paScope==='patient' ? paPatientPhone : undefined }) })
                const data = await res.json(); if (!res.ok) throw new Error(data?.error || 'Failed')
                setPaAnswer(String(data.answer || ''))
              } catch(e:any) { alert(e?.message || 'Failed') }
              finally { setPaSending(false) }
            }} disabled={paSending} className="bg-green-600 text-white px-4 py-2 rounded disabled:opacity-50">{paSending ? 'Asking…' : 'Ask'}</button>
          </div>
          {paAnswer && (
            <div className="bg-gray-50 rounded p-3 text-sm whitespace-pre-wrap">{paAnswer}</div>
          )}
        </div>
      </div>
    </div>
  )
}
