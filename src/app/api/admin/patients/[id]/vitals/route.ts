import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { sendWhatsAppViaGateway } from '@/lib/whatsapp'

async function notifyProviders(patientId: string, bodyText: string) {
  const patient = await prisma.patient.findUnique({ where: { id: patientId }, select: { firstName: true, lastName: true } })
  const phone = await prisma.contactChannel.findFirst({ where: { ownerType: 'patient', patientId, type: 'whatsapp' }, orderBy: { preferred: 'desc' }, select: { value: true } })
  const name = [patient?.firstName, patient?.lastName].filter(Boolean).join(' ') || 'Unnamed'
  const phoneE164 = phone?.value || 'unknown'
  const message = `Medical update\nPatient: ${name}\nPhone: ${phoneE164}\n${bodyText}`

  const providers = await prisma.providerProfile.findMany({ where: { phoneE164: { not: null } } })
  await Promise.allSettled(providers.map(p => p.phoneE164 ? sendWhatsAppViaGateway({ toE164: p.phoneE164, body: message }) : Promise.resolve()))
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = (await params).id
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const docs = await prisma.document.findMany({ where: { patientId: id, typeCode: 'vital' }, orderBy: { createdAt: 'desc' }, take: 100 })
    const items = docs.map(d => ({ ...(d.metadata as any), recordedAt: d.createdAt }))
    return NextResponse.json({ items })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 })
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = (await params).id
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const { type, value, units, notifyProviders: notify } = await req.json().catch(() => ({}))
    if (!type || !value) return NextResponse.json({ error: 'type and value required' }, { status: 400 })

    const created = await prisma.document.create({
      data: {
        patientId: id,
        url: 'internal:vital',
        filename: 'vital.json',
        contentType: 'application/json',
        title: 'Vital',
        typeCode: 'vital',
        metadata: { type, value, units },
      },
    })

    if (notify) {
      await notifyProviders(id, `Vital recorded: ${type} = ${value} ${units || ''}`.trim())
    }

    return NextResponse.json({ ok: true, id: created.id })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 })
  }
}
