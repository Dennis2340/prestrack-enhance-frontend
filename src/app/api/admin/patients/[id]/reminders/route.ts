import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAuth } from '@/lib/withAuth'

function toUtcDate(dateISO: string, hm: string): Date {
  // dateISO: 'YYYY-MM-DD'; hm: 'HH:MM'
  const [y, m, d] = String(dateISO).split('-').map((n) => parseInt(n, 10))
  const [hh, mm] = String(hm || '09:00').split(':').map((n) => parseInt(n, 10))
  const y2 = isFinite(y) ? y : new Date().getUTCFullYear()
  const m2 = isFinite(m) ? m - 1 : new Date().getUTCMonth()
  const d2 = isFinite(d) ? d : new Date().getUTCDate()
  const hh2 = isFinite(hh) ? hh : 9
  const mm2 = isFinite(mm) ? mm : 0
  return new Date(Date.UTC(y2, m2, d2, hh2, mm2, 0))
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = (await params).id
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const now = new Date()
    const items = await prisma.task.findMany({
      where: { subjectType: 'patient' as any, patientId: id, type: 'reminder' as any, scheduledTime: { gte: now } },
      orderBy: { scheduledTime: 'asc' },
      take: 50,
      select: { id: true, scheduledTime: true, status: true, notes: true }
    })
    return NextResponse.json({ items })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireAuth(req)
  if ('cookies' in auth) return auth as any
  try {
    const id = (await params).id
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const body = await req.json().catch(() => ({})) as any
    const message = typeof body.message === 'string' ? body.message.trim() : ''
    const date = String(body.date || '').trim() // YYYY-MM-DD
    const times: string[] = Array.isArray(body.times) ? body.times.map(String) : []
    if (!date || times.length === 0) return NextResponse.json({ error: 'date and times are required' }, { status: 400 })

    const data = times.map((t) => ({
      type: 'reminder' as any,
      status: 'pending' as any,
      scheduledTime: toUtcDate(date, t),
      subjectType: 'patient' as any,
      patientId: id,
      notes: message || undefined,
    }))

    const created = await prisma.task.createMany({ data })
    return NextResponse.json({ ok: true, created: created.count })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 })
  }
}
