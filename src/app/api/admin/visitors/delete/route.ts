import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAuth } from '@/lib/withAuth'

export async function POST(req: NextRequest) {
  const auth = requireAuth(req)
  if ('cookies' in auth) return auth as any
  try {
    const { id } = await req.json().catch(() => ({})) as { id?: string }
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    // best-effort cleanup: conversations, contacts, then visitor
    try {
      const convos = await prisma.conversation.findMany({ where: { subjectType: 'visitor' as any, visitorId: id }, select: { id: true } })
      const convoIds = convos.map(c => c.id)
      if (convoIds.length) {
        await prisma.commMessage.deleteMany({ where: { conversationId: { in: convoIds } } })
        await prisma.conversation.deleteMany({ where: { id: { in: convoIds } } })
      }
    } catch {}
    try { await prisma.contactChannel.deleteMany({ where: { ownerType: 'visitor', visitorId: id } }) } catch {}
    await prisma.visitor.delete({ where: { id } })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 })
  }
}
