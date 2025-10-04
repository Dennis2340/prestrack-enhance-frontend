import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAuth } from '@/lib/withAuth'

// Create medication reminder tasks for the next N days at specified times (HH:MM)
export async function POST(req: NextRequest, { params }: { params: Promise<{ rxId: string }> }) {
  const auth = requireAuth(req)
  if ('cookies' in auth) return auth as any
  try {
    const rxId = (await params).rxId
    if (!rxId) return NextResponse.json({ error: 'rxId required' }, { status: 400 })
    const body = await req.json().catch(() => ({})) as any
    const days = Math.max(1, Math.min(60, Number(body.days || 7)))
    const times: string[] = Array.isArray(body.times) ? body.times.map(String) : []
    if (times.length === 0) return NextResponse.json({ error: 'times required' }, { status: 400 })

    const rx = await prisma.prescription.findUnique({ where: { id: rxId }, select: { id: true, patientId: true, timezone: true } })
    if (!rx) return NextResponse.json({ error: 'not found' }, { status: 404 })

    const tz = rx.timezone || 'UTC'
    const now = new Date()
    const tasks: any[] = []
    for (let d = 0; d < days; d++) {
      for (const t of times) {
        const [hh, mm] = String(t).split(':').map((n) => parseInt(n, 10))
        if (Number.isFinite(hh) && Number.isFinite(mm)) {
          const dt = new Date(now)
          dt.setUTCDate(now.getUTCDate() + d)
          // naive: schedule in UTC, assume times are local tz if needed (can be improved)
          dt.setUTCHours(hh, mm, 0, 0)
          tasks.push({
            type: 'medication_reminder',
            status: 'pending',
            scheduledTime: dt,
            subjectType: 'patient',
            patientId: rx.patientId,
            prescriptionId: rx.id,
          })
        }
      }
    }

    if (tasks.length === 0) return NextResponse.json({ error: 'no valid times' }, { status: 400 })

    const created = await prisma.task.createMany({ data: tasks })
    return NextResponse.json({ ok: true, created: created.count })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 })
  }
}
