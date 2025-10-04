import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAuth } from '@/lib/withAuth'
import { sendWhatsAppViaGateway } from '@/lib/whatsapp'

export async function POST(req: NextRequest) {
  const auth = requireAuth(req)
  if ('cookies' in auth) return auth as any

  // Only providers/admins can send
  if (!(auth.user.role === 'provider' || auth.user.role === 'admin')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  try {
    const { id, text } = await req.json().catch(() => ({})) as { id?: string; text?: string }
    if (!id || !text) return NextResponse.json({ error: 'id and text required' }, { status: 400 })

    const doc = await prisma.document.findUnique({ where: { id }, select: { id: true, metadata: true } })
    if (!doc) return NextResponse.json({ error: 'not found' }, { status: 404 })

    const meta = (doc.metadata as any) || {}
    const phoneE164: string | null = meta.phoneE164 || null
    const subjectType: 'patient' | 'visitor' | null = meta.subjectType || null
    const subjectId: string | null = meta.subjectId || null

    if (!phoneE164) return NextResponse.json({ error: 'escalation missing phoneE164' }, { status: 400 })

    const body = String(text || '').trim()
    if (!body) return NextResponse.json({ error: 'text required' }, { status: 400 })

    await sendWhatsAppViaGateway({ toE164: phoneE164, body })

    // Log to a conversation if exists
    try {
      if (subjectType === 'patient' && subjectId) {
        const convo = await prisma.conversation.findFirst({ where: { patientId: subjectId, subjectType: 'patient' as any }, orderBy: { updatedAt: 'desc' } })
        if (convo) await prisma.commMessage.create({ data: { conversationId: convo.id, direction: 'outbound', via: 'whatsapp', body, senderType: 'user' } })
      } else if (subjectType === 'visitor' && subjectId) {
        const convo = await prisma.conversation.findFirst({ where: { visitorId: subjectId, subjectType: 'visitor' as any }, orderBy: { updatedAt: 'desc' } })
        if (convo) await prisma.commMessage.create({ data: { conversationId: convo.id, direction: 'outbound', via: 'whatsapp', body, senderType: 'user' } })
      }
    } catch {}

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 })
  }
}
