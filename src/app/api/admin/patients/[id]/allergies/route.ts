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
    const doc = await prisma.document.findFirst({ where: { patientId: id, typeCode: 'allergies' }, orderBy: { updatedAt: 'desc' } })
    return NextResponse.json({ allergies: (doc?.metadata as any) || null })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 })
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = (await params).id
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const { allergies, notifyProviders: notify } = await req.json().catch(() => ({}))
    if (!allergies || typeof allergies !== 'object') return NextResponse.json({ error: 'allergies object required' }, { status: 400 })

    const created = await prisma.document.create({
      data: {
        patientId: id,
        url: 'internal:allergies',
        filename: 'allergies.json',
        contentType: 'application/json',
        title: 'Allergies',
        typeCode: 'allergies',
        metadata: allergies,
      },
    })

    if (notify) {
      await notifyProviders(id, `Allergies updated.`)
    }

    return NextResponse.json({ ok: true, id: created.id })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 })
  }
}
