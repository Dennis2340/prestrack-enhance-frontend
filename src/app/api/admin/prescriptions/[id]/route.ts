import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAuth } from '@/lib/withAuth'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireAuth(req)
  if ('cookies' in auth) return auth as any
  try {
    const id = (await params).id
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const body = await req.json().catch(() => ({})) as any

    const data: any = {}
    if (typeof body.medicationName === 'string') data.medicationName = body.medicationName.trim()
    if (typeof body.strength === 'string') data.strength = body.strength
    if (typeof body.form === 'string') data.form = body.form
    if (body.startDate) data.startDate = new Date(body.startDate)
    if (body.endDate === null) data.endDate = null
    else if (body.endDate) data.endDate = new Date(body.endDate)
    if (typeof body.status === 'string') data.status = body.status
    if (typeof body.medicationCode === 'string') data.medicationCode = body.medicationCode
    if (typeof body.medicationSystem === 'string') data.medicationSystem = body.medicationSystem

    const updated = await prisma.prescription.update({ where: { id }, data })
    return NextResponse.json({ ok: true, id: updated.id })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireAuth(req)
  if ('cookies' in auth) return auth as any
  try {
    const id = (await params).id
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    await prisma.dosageSchedule.deleteMany({ where: { prescriptionId: id } })
    await prisma.task.deleteMany({ where: { prescriptionId: id } })
    await prisma.adherence.deleteMany({ where: { prescriptionId: id } })
    await prisma.prescription.delete({ where: { id } })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 })
  }
}
