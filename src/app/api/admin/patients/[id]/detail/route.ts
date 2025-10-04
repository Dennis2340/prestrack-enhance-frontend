import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const id = params.id
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const patient = await prisma.patient.findUnique({ where: { id } })
    if (!patient) return NextResponse.json({ error: 'not found' }, { status: 404 })

    const contacts = await prisma.contactChannel.findMany({ where: { patientId: id }, orderBy: { createdAt: 'desc' } })
    const wa = contacts.find((c) => c.type === 'whatsapp')

    const convo = await prisma.conversation.findFirst({
      where: { patientId: id, subjectType: 'patient' as any },
      orderBy: { updatedAt: 'desc' },
    })

    const messages = convo
      ? await prisma.commMessage.findMany({ where: { conversationId: convo.id }, orderBy: { createdAt: 'desc' }, take: 50 })
      : []

    return NextResponse.json({
      patient,
      contacts,
      phoneE164: wa?.value || null,
      conversation: convo || null,
      messages,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 })
  }
}
