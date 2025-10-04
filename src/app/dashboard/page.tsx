"use client"

import { useEffect, useState } from 'react'

type RxBrief = { id: string; medicationName: string; createdAt: string; patient?: { id: string; firstName: string | null; lastName: string | null } | null }
type UpcomingBrief = { id: string; scheduledTime: string; prescription?: { id: string; medicationName: string; patient?: { id: string; firstName: string | null; lastName: string | null } | null } | null }

export default function DashboardOverview() {
  const [loading, setLoading] = useState(true)
  const [patients, setPatients] = useState<number>(0)
  const [conversations, setConversations] = useState<number>(0)
  const [tasks, setTasks] = useState<number>(0)
  const [latest, setLatest] = useState<RxBrief[]>([])
  const [upcoming, setUpcoming] = useState<UpcomingBrief[]>([])

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/overview/stats', { cache: 'no-store' })
      const d = await res.json()
      if (res.ok) {
        setPatients(Number(d.patients || 0))
        setConversations(Number(d.conversations || 0))
        setTasks(Number(d.tasks || 0))
        setLatest(Array.isArray(d.latestPrescriptions) ? d.latestPrescriptions : [])
        setUpcoming(Array.isArray(d.upcomingReminders) ? d.upcomingReminders : [])
      }
    } catch {}
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Overview</h1>
        <button onClick={load} className="px-3 py-1.5 rounded border text-sm">Refresh</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-lg border bg-white p-4 text-gray-700">Patients: {loading ? '…' : patients}</div>
        <div className="rounded-lg border bg-white p-4 text-gray-700">Conversations: {loading ? '…' : conversations}</div>
        <div className="rounded-lg border bg-white p-4 text-gray-700">Tasks (Reminders): {loading ? '…' : tasks}</div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-lg border bg-white p-4 text-gray-700">
          <div className="text-sm font-medium mb-2">Recent prescriptions</div>
          {loading ? (
            <div className="text-sm">Loading…</div>
          ) : latest.length === 0 ? (
            <div className="text-sm text-gray-500">No recent prescriptions.</div>
          ) : (
            <div className="divide-y">
              {latest.map((r)=>{
                const name = [r.patient?.firstName, r.patient?.lastName].filter(Boolean).join(' ')
                return (
                  <div key={r.id} className="py-2 text-sm">
                    <div className="font-medium">{r.medicationName}</div>
                    <div className="text-xs text-gray-500">Patient: {name || '—'} • {new Date(r.createdAt).toLocaleString()}</div>
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
                    <div className="text-xs text-gray-500">Patient: {name || '—'} • {new Date(u.scheduledTime).toLocaleString()}</div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
