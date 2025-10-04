import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAuth } from '@/lib/withAuth'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = (await params).id
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const list = await prisma.prescription.findMany({
      where: { patientId: id },
      orderBy: { createdAt: 'desc' },
      select: { id: true, createdAt: true, updatedAt: true, medicationName: true, strength: true, form: true, startDate: true, endDate: true, status: true },
    })
    return NextResponse.json({ items: list })
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
    const medicationName = String(body.medicationName || '').trim()
    const strength = body.strength ? String(body.strength) : undefined
    const form = body.form ? String(body.form) : undefined
    const startDate = body.startDate ? new Date(body.startDate) : new Date()
    const endDate = body.endDate ? new Date(body.endDate) : null
    const timezone = typeof body.timezone === 'string' && body.timezone.trim() ? String(body.timezone).trim() : undefined
    const medicationCode = typeof body.medicationCode === 'string' && body.medicationCode.trim() ? String(body.medicationCode).trim() : undefined
    const medicationSystem = typeof body.medicationSystem === 'string' && body.medicationSystem.trim() ? String(body.medicationSystem).trim() : undefined
    if (!medicationName) return NextResponse.json({ error: 'medicationName required' }, { status: 400 })

    const created = await prisma.prescription.create({
      data: {
        patientId: id,
        medicationName,
        strength,
        form,
        startDate,
        endDate: endDate || undefined,
        timezone: timezone || undefined,
        medicationCode,
        medicationSystem,
      },
      select: { id: true },
    })
    return NextResponse.json({ ok: true, id: created.id })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 })
  }
}
