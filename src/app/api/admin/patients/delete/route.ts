import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function POST(req: Request) {
  try {
    const { id } = (await req.json().catch(() => ({}))) as { id?: string }
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    try {
      await prisma.$transaction([
        prisma.commMessage.deleteMany({ where: { conversation: { patientId: id } } as any }),
        prisma.conversation.deleteMany({ where: { patientId: id } }),
        prisma.contactChannel.deleteMany({ where: { patientId: id } }),

        prisma.aNCObservation.deleteMany({ where: { encounter: { pregnancy: { patientId: id } } } as any }),
        prisma.aNCEncounter.deleteMany({ where: { pregnancy: { patientId: id } } as any }),
        prisma.aNCIntervention.deleteMany({ where: { pregnancy: { patientId: id } } as any }),
        prisma.pregnancy.deleteMany({ where: { patientId: id } }),

        prisma.dosageSchedule.deleteMany({ where: { prescription: { patientId: id } } as any }),
        prisma.adherence.deleteMany({ where: { patientId: id } }),
        prisma.task.deleteMany({ where: { patientId: id } }),
        prisma.prescription.deleteMany({ where: { patientId: id } }),

        prisma.escalation.deleteMany({ where: { patientId: id } }),
        prisma.immunization.deleteMany({ where: { patientId: id } }),
        prisma.document.deleteMany({ where: { patientId: id } }),
        prisma.fhirLink.deleteMany({ where: { patientId: id } }),

        prisma.patient.delete({ where: { id } }),
      ])
    } catch (e: any) {
      return NextResponse.json({ error: e?.message || 'Failed to delete patient' }, { status: 409 })
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 })
  }
}
