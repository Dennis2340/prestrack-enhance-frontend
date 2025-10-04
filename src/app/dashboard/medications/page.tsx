"use client"

import { useEffect, useState } from 'react'

type RxItem = {
  id: string
  medicationName: string
  strength?: string | null
  form?: string | null
  startDate: string
  endDate?: string | null
  status: string
  createdAt: string
  updatedAt: string
  patient?: { id: string; firstName: string | null; lastName: string | null } | null
}

type UpcomingItem = {
  id: string
  scheduledTime: string
  status: string
  prescription?: { id: string; medicationName: string; patient?: { id: string; firstName: string | null; lastName: string | null } | null } | null
}

export default function MedicationsPage() {
  const [loading, setLoading] = useState(true)
  const [prescriptions, setPrescriptions] = useState<RxItem[]>([])
  const [upcoming, setUpcoming] = useState<UpcomingItem[]>([])

  async function load() {
    setLoading(true)
    try {
      const [rxRes, upRes] = await Promise.all([
        fetch('/api/admin/prescriptions/list?take=200', { cache: 'no-store' }),
        fetch('/api/admin/reminders/upcoming?take=50', { cache: 'no-store' }),
      ])
      const rxData = await rxRes.json();
      const upData = await upRes.json();
      if (rxRes.ok) setPrescriptions(Array.isArray(rxData.items) ? rxData.items : [])
      if (upRes.ok) setUpcoming(Array.isArray(upData.items) ? upData.items : [])
    } catch {}
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Medications</h1>
        <button onClick={load} className="px-3 py-1.5 rounded border text-sm">Refresh</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-lg border bg-white p-4 text-gray-700">
          <div className="text-sm font-medium mb-2">Prescriptions</div>
          {loading ? (
            <div className="text-sm">Loading…</div>
          ) : prescriptions.length === 0 ? (
            <div className="text-sm text-gray-500">No prescriptions yet.</div>
          ) : (
            <div className="divide-y">
              {prescriptions.map((rx)=>{
                const name = [rx.patient?.firstName, rx.patient?.lastName].filter(Boolean).join(' ')
                return (
                  <div key={rx.id} className="py-2 text-sm">
                    <div className="font-medium">{rx.medicationName} {rx.strength ? `(${rx.strength})` : ''} {rx.form || ''}</div>
                    <div className="text-xs text-gray-500">Patient: {name || '—'} • Start: {new Date(rx.startDate).toLocaleDateString()} {rx.endDate ? `• End: ${new Date(rx.endDate).toLocaleDateString()}` : ''}</div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
        <div className="rounded-lg border bg-white p-4 text-gray-700">
          <div className="text-sm font-medium mb-2">Upcoming reminders</div>
          {loading ? (
            <div className="text-sm">Loading…</div>
          ) : upcoming.length === 0 ? (
            <div className="text-sm text-gray-500">No upcoming reminders.</div>
          ) : (
            <div className="divide-y">
              {upcoming.map((u)=>{
                const name = [u.prescription?.patient?.firstName, u.prescription?.patient?.lastName].filter(Boolean).join(' ')
                return (
                  <div key={u.id} className="py-2 text-sm">
                    <div className="font-medium">{u.prescription?.medicationName || 'Medication'}</div>
                    <div className="text-xs text-gray-500">Patient: {name || '—'} • At: {new Date(u.scheduledTime).toLocaleString()} • Status: {u.status}</div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
      <div className="rounded-lg border bg-white p-4 text-gray-500">Create prescriptions and schedules will appear here.</div>
    </div>
  )
}
