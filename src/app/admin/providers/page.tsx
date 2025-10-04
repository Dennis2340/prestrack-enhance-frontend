"use client"

import { useState } from 'react'

export default function ProvidersAdminPage() {
  const [name, setName] = useState('')
  const [phoneE164, setPhoneE164] = useState('')
  const [specialty, setSpecialty] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<any>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setResult(null)
    try {
      const res = await fetch('/api/admin/providers/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name || undefined, phoneE164, specialty: specialty || undefined, message: message || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to create provider')
      setResult(data)
      setName('')
      setPhoneE164('')
      setSpecialty('')
      setMessage('')
    } catch (e: any) {
      alert(e?.message || 'Error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">Add Care Provider</h1>
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
          <label className="block text-sm font-medium mb-1">Invite message (optional)</label>
          <textarea value={message} onChange={e => setMessage(e.target.value)} className="border rounded px-3 py-2 w-full h-28" placeholder="Welcome! Your provider account has been set up..." />
        </div>
        <button type="submit" disabled={submitting} className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50">
          {submitting ? 'Submitting…' : 'Create & Send WhatsApp Invite'}
        </button>
      </form>

      {result && (
        <div className="mt-6 border rounded p-4 bg-green-50">
          <div className="font-medium mb-2">Created</div>
          <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}

      <div className="mt-10 border-t pt-6">
        <h2 className="text-xl font-semibold mb-2">RAG Ingestion</h2>
        <p className="text-sm text-gray-600 mb-3">Go to the ingestion page to upload links for grounding: <a href="/admin/rag" className="text-blue-600 underline">/admin/rag</a></p>
      </div>
    </div>
  )
}
