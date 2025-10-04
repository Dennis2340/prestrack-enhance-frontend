import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAuth } from '@/lib/withAuth'
import { sendWhatsAppViaGateway } from '@/lib/whatsapp'

async function resolvePatientWhatsapp(patientId: string): Promise<string | null> {
  const cc = await prisma.contactChannel.findFirst({ where: { ownerType: 'patient', patientId, type: 'whatsapp' }, orderBy: { preferred: 'desc' }, select: { value: true } })
  return cc?.value || null
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireAuth(req)
  if ('cookies' in auth) return auth as any
  try {
    const id = (await params).id
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const { body } = await req.json().catch(() => ({})) as { body?: string }
    const text = String(body || '').trim()
    if (!text) return NextResponse.json({ error: 'body required' }, { status: 400 })

    const toE164 = await resolvePatientWhatsapp(id)
    if (!toE164) return NextResponse.json({ error: 'patient has no whatsapp' }, { status: 400 })

    // ensure conversation exists
    let convo = await prisma.conversation.findFirst({ where: { subjectType: 'patient' as any, patientId: id }, orderBy: { updatedAt: 'desc' } })
    if (!convo) {
      convo = await prisma.conversation.create({ data: { subjectType: 'patient' as any, patientId: id, channel: 'whatsapp' as any, status: 'open' as any, lastMessageAt: new Date() } })
    }

    await sendWhatsAppViaGateway({ toE164, body: text })
    await prisma.commMessage.create({ data: { conversationId: convo.id, direction: 'outbound', via: 'whatsapp', body: text, senderType: 'provider', senderId: auth.user.sub } })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 })
  }
}
