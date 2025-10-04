"use client"

import { useState } from "react"

export default function ProviderAgentPage() {
  const [patientPhone, setPatientPhone] = useState("")
  const [question, setQuestion] = useState("")
  const [scope, setScope] = useState<'general'|'patient'>('general')
  const [sending, setSending] = useState(false)
  const [answer, setAnswer] = useState<string>("")

  async function onRequestConsent() {
    if (!/^\+\d{6,15}$/.test(patientPhone)) { alert('Enter valid E.164 phone'); return }
    setSending(true)
    try {
      const res = await fetch('/api/admin/provider-agent/request-consent', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ patientPhoneE164: patientPhone }) })
      const data = await res.json(); if (!res.ok) throw new Error(data?.error || 'Failed')
      alert('Consent request sent to patient on WhatsApp')
    } catch(e:any) { alert(e?.message || 'Failed') }
    finally { setSending(false) }
  }

  async function onAsk() {
    if (!question.trim()) { alert('Enter a question'); return }
    if (scope === 'patient' && !/^\+\d{6,15}$/.test(patientPhone)) { alert('Enter valid E.164 phone for patient-scoped questions'); return }
    setSending(true)
    setAnswer("")
    try {
      const res = await fetch('/api/admin/provider-agent/ask', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ question, patientPhoneE164: scope==='patient' ? patientPhone : undefined }) })
      const data = await res.json(); if (!res.ok) throw new Error(data?.error || 'Failed')
      setAnswer(String(data.answer || ''))
    } catch(e:any) { alert(e?.message || 'Failed') }
    finally { setSending(false) }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold">Provider Agent</h1>

      <div className="border rounded p-4 space-y-3">
        <div className="text-sm font-medium">Request Patient Consent</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-center">
          <label className="text-sm text-gray-600">Patient phone (E.164)</label>
          <input value={patientPhone} onChange={e=> setPatientPhone(e.target.value)} className="border rounded px-3 py-2 md:col-span-2" placeholder="+15551234567" />
        </div>
        <div className="flex items-center justify-end">
          <button onClick={onRequestConsent} disabled={sending} className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50">{sending ? 'Sending…' : 'Send Consent Request'}</button>
        </div>
      </div>

      <div className="border rounded p-4 space-y-3">
        <div className="text-sm font-medium">Ask the Agent</div>
        <div className="flex gap-4 text-sm">
          <label className="inline-flex items-center gap-2"><input type="radio" checked={scope==='general'} onChange={()=> setScope('general')} /> General</label>
          <label className="inline-flex items-center gap-2"><input type="radio" checked={scope==='patient'} onChange={()=> setScope('patient')} /> Patient-scoped</label>
        </div>
        {scope==='patient' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-center">
            <label className="text-sm text-gray-600">Patient phone (E.164)</label>
            <input value={patientPhone} onChange={e=> setPatientPhone(e.target.value)} className="border rounded px-3 py-2 md:col-span-2" placeholder="+15551234567" />
          </div>
        )}
        <textarea value={question} onChange={e=> setQuestion(e.target.value)} className="border rounded w-full h-28 px-3 py-2" placeholder="Your question (e.g., summarize recent labs, or ask a guideline question)" />
        <div className="flex items-center justify-end">
          <button onClick={onAsk} disabled={sending} className="bg-green-600 text-white px-4 py-2 rounded disabled:opacity-50">{sending ? 'Asking…' : 'Ask'}</button>
        </div>
        {answer && (
          <div className="bg-gray-50 rounded p-3 text-sm whitespace-pre-wrap">{answer}</div>
        )}
      </div>
    </div>
  )
}
