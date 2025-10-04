import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAuth } from '@/lib/withAuth'

function toDateAt(timeHM: string, day: Date, tz: string): Date {
  // timeHM: "HH:MM"; tz currently unused (server in UTC); could integrate luxon later
  const [hh, mm] = String(timeHM || '09:00').split(':').map((n) => parseInt(n, 10))
  const d = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), isFinite(hh) ? hh : 9, isFinite(mm) ? mm : 0, 0))
  return d
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireAuth(req)
  if ('cookies' in auth) return auth as any
  try {
    const id = (await params).id
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const body = await req.json().catch(() => ({})) as any
    const days: number = Math.min(Math.max(parseInt(body.days ?? '7', 10) || 7, 1), 90)
    const times: string[] = Array.isArray(body.times) && body.times.length ? body.times : ['09:00']

    const rx = await prisma.prescription.findUnique({ where: { id }, select: { id: true, patientId: true, timezone: true, startDate: true, endDate: true } })
    if (!rx) return NextResponse.json({ error: 'prescription not found' }, { status: 404 })

    const tz = rx.timezone || 'UTC'
    const start = new Date()
    const endCap = new Date(start)
    endCap.setUTCDate(endCap.getUTCDate() + days)

    // clamp to prescription date range if set
    const rangeStart = rx.startDate && rx.startDate > start ? rx.startDate : start
    const rangeEnd = rx.endDate && rx.endDate < endCap ? rx.endDate : endCap

    const toCreate: any[] = []
    const cursor = new Date(Date.UTC(rangeStart.getUTCFullYear(), rangeStart.getUTCMonth(), rangeStart.getUTCDate()))
    while (cursor <= rangeEnd) {
      for (const t of times) {
        const when = toDateAt(t, cursor, tz)
        if (when >= rangeStart && when <= rangeEnd) {
          toCreate.push({
            type: 'medication_reminder' as any,
            status: 'pending' as any,
            scheduledTime: when,
            subjectType: 'patient' as any,
            patientId: rx.patientId,
            prescriptionId: rx.id,
            notes: `Reminder for prescription ${rx.id} at ${t}`,
          })
        }
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1)
    }

    if (toCreate.length === 0) return NextResponse.json({ ok: true, created: 0 })

    await prisma.task.createMany({ data: toCreate })
    return NextResponse.json({ ok: true, created: toCreate.length })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 })
  }
}
