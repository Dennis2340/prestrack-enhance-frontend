import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { sendWhatsAppViaGateway } from '@/lib/whatsapp'
import { requireAuth } from '@/lib/withAuth'

async function resolvePatientByPhone(phoneE164: string) {
  const cc = await prisma.contactChannel.findFirst({ where: { ownerType: 'patient', type: 'whatsapp', value: phoneE164 }, select: { patientId: true } })
  if (!cc?.patientId) return null
  const p = await prisma.patient.findUnique({ where: { id: cc.patientId }, select: { id: true, firstName: true, lastName: true } })
  return p
}

export async function POST(req: NextRequest) {
  const auth = requireAuth(req)
  if ('cookies' in auth) return auth as any
  try {
    const { patientPhoneE164 } = await req.json().catch(() => ({}))
    if (!/^\+\d{6,15}$/.test(String(patientPhoneE164 || ''))) return NextResponse.json({ error: 'Valid patientPhoneE164 required' }, { status: 400 })

    // Provider info (optional phone for inclusion in consent metadata)
    const provider = await prisma.providerProfile.findFirst({ where: { userId: auth.user.sub }, select: { phoneE164: true } })

    const patient = await resolvePatientByPhone(patientPhoneE164)
    if (!patient) return NextResponse.json({ error: 'Patient not found for phone' }, { status: 404 })

    const token = crypto.randomUUID()

    // Create/Upsert consent doc keyed by token (hash)
    await prisma.document.create({
      data: {
        patientId: patient.id,
        url: 'internal:consent',
        filename: 'consent.json',
        contentType: 'application/json',
        title: 'Provider Consent Pending',
        typeCode: 'consent_access',
        hash: token,
        metadata: { providerPhoneE164: provider?.phoneE164 || null, patientPhoneE164, granted: false },
      },
    })

    const name = [patient.firstName, patient.lastName].filter(Boolean).join(' ') || 'there'
    const link = `${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/consent/allow?token=${encodeURIComponent(token)}`
    const body = `Hi ${name},\nA care provider is requesting access to view your medical info.\nApprove here: ${link}`

    // Notify patient via WhatsApp
    await sendWhatsAppViaGateway({ toE164: patientPhoneE164, body })

    return NextResponse.json({ ok: true, token })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 })
  }
}
