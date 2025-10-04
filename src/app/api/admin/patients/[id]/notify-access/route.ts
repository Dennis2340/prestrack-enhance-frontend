import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAuth } from '@/lib/withAuth'
import { sendWhatsAppViaGateway } from '@/lib/whatsapp'

async function getPatientWhatsapp(phoneById: string) {
  const phone = await prisma.contactChannel.findFirst({
    where: { ownerType: 'patient', patientId: phoneById, type: 'whatsapp' },
    orderBy: { preferred: 'desc' },
    select: { value: true },
  })
  return phone?.value || null
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireAuth(req)
  if ('cookies' in auth) return auth as any
  try {
    const id = (await params).id
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    // resolve provider identity
    const provider = await prisma.providerProfile.findFirst({ where: { userId: auth.user.sub }, select: { phoneE164: true, user: { select: { name: true, email: true } } } })
    const providerName = provider?.user?.name || provider?.user?.email || 'A care provider'
    const providerPhone = provider?.phoneE164 || 'unknown'

    const patient = await prisma.patient.findUnique({ where: { id }, select: { firstName: true, lastName: true } })
    const patientName = [patient?.firstName, patient?.lastName].filter(Boolean).join(' ') || 'Patient'
    const toE164 = await getPatientWhatsapp(id)
    if (!toE164) return NextResponse.json({ error: 'patient has no WhatsApp contact' }, { status: 400 })

    // log access as a document record
    const timestamp = new Date().toISOString()
    await prisma.document.create({
      data: {
        patientId: id,
        url: 'internal:access_log',
        filename: 'access_log.json',
        contentType: 'application/json',
        title: 'Access Log',
        typeCode: 'access_log',
        metadata: { at: timestamp, providerName, providerPhone },
      },
    })

    const body = `Prestrack notice:\n${providerName} (${providerPhone}) viewed your medical record on ${timestamp}.\nIf this wasn’t you, reply STOP.`
    await sendWhatsAppViaGateway({ toE164, body })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 })
  }
}
