import prisma from '@/lib/prisma'
import { sendWhatsAppViaGateway } from '@/lib/whatsapp'

export type MedicalEscalationInput = {
  phoneE164: string
  summary?: string
  subjectType: 'patient' | 'visitor'
  subjectId: string | null
  media?: {
    mimeType?: string | null
    url?: string | null
    filename?: string | null
    sizeBytes?: number | null
  } | null
  raw?: any
}

export async function createMedicalEscalation(input: MedicalEscalationInput) {
  if (!/^\+\d{6,15}$/.test(input.phoneE164)) throw new Error('invalid E.164 phone')

  // Ensure we have a patientId to satisfy Document.patientId (schema requires it)
  // If escalation is from a visitor, create/find a placeholder patient linked to this phone.
  let patientIdForDoc: string | null = input.subjectType === 'patient' ? input.subjectId : null
  if (!patientIdForDoc) {
    // Try to find an existing patient by contact channel
    const cc = await prisma.contactChannel.findFirst({ where: { type: 'whatsapp', value: input.phoneE164, patientId: { not: null } }, select: { patientId: true } as any })
    if (cc?.patientId) {
      patientIdForDoc = cc.patientId
    } else {
      // Create a minimal patient and link the WhatsApp contact
      const created = await prisma.patient.create({
        data: {
          firstName: null,
          lastName: null,
          contacts: { create: { ownerType: 'patient' as any, type: 'whatsapp', value: input.phoneE164, verified: true, preferred: true } },
        },
        select: { id: true }
      })
      patientIdForDoc = created.id
    }
  }

  // Fetch patient display name for provider notification
  let displayName: string = 'Patient'
  try {
    const p = await prisma.patient.findUnique({ where: { id: patientIdForDoc! }, select: { firstName: true, lastName: true } })
    const name = [p?.firstName, p?.lastName].filter(Boolean).join(' ').trim()
    if (name) displayName = name
  } catch {}

  // Persist as a Document for lightweight tracking
  const doc = await prisma.document.create({
    data: {
      url: 'internal:medical_escalation',
      filename: 'medical_escalation.json',
      contentType: 'application/json',
      title: 'Medical Escalation',
      typeCode: 'medical_escalation',
      patientId: patientIdForDoc!,
      metadata: {
        phoneE164: input.phoneE164,
        summary: input.summary || null,
        subjectType: input.subjectType,
        subjectId: input.subjectId,
        media: input.media || null,
        status: 'open',
        raw: input.raw ? '[omitted]' : undefined,
      },
    },
  })

  // Notify all providers
  const providers = await prisma.providerProfile.findMany({ where: { phoneE164: { not: null } }, select: { phoneE164: true } })
  const who = `${displayName} (${input.phoneE164})`
  const header = 'Medical escalation'
  const body = `${header}: ${who}\n${input.summary || 'Media received'}`
  await Promise.allSettled(providers.map(p => p.phoneE164 ? sendWhatsAppViaGateway({ toE164: p.phoneE164, body }) : Promise.resolve()))

  // Audit log: record a system message in patient's conversation
  try {
    let convo = await prisma.conversation.findFirst({ where: { subjectType: 'patient' as any, patientId: patientIdForDoc }, orderBy: { updatedAt: 'desc' } })
    if (!convo) {
      convo = await prisma.conversation.create({ data: { subjectType: 'patient' as any, patientId: patientIdForDoc!, channel: 'whatsapp' as any, status: 'open' as any, lastMessageAt: new Date() } })
    }
    await prisma.commMessage.create({ data: { conversationId: (convo as any).id, direction: 'outbound', via: 'whatsapp', body: `System escalation created (Document ${doc.id})`, senderType: 'system' } as any })
  } catch {}

  return { id: doc.id }
}
