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

  // Persist as a Document for lightweight tracking
  const doc = await prisma.document.create({
    data: {
      url: 'internal:medical_escalation',
      filename: 'medical_escalation.json',
      contentType: 'application/json',
      title: 'Medical Escalation',
      typeCode: 'medical_escalation',
      patientId: input.subjectType === 'patient' ? input.subjectId : null,
      metadata: {
        phoneE164: input.phoneE164,
        summary: input.summary || null,
        subjectType: input.subjectType,
        subjectId: input.subjectId,
        media: input.media || null,
        raw: input.raw ? '[omitted]' : undefined,
      },
    },
  })

  // Notify all providers
  const providers = await prisma.providerProfile.findMany({ where: { phoneE164: { not: null } }, select: { phoneE164: true } })
  const who = `(${input.phoneE164})`
  const header = 'Medical escalation'
  const body = `${header}: ${who}\n${input.summary || 'Media received'}`
  await Promise.allSettled(providers.map(p => p.phoneE164 ? sendWhatsAppViaGateway({ toE164: p.phoneE164, body }) : Promise.resolve()))

  return { id: doc.id }
}
