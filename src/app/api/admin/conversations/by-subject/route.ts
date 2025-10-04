import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAuth } from '@/lib/withAuth'

export async function GET(req: NextRequest) {
  const auth = requireAuth(req)
  if ('cookies' in auth) return auth as any

  try {
    const { searchParams } = new URL(req.url)
    const subjectType = searchParams.get('subjectType') as 'patient' | 'visitor' | null
    const subjectId = searchParams.get('subjectId')
    const take = Number(searchParams.get('take') || 50)
    if (!subjectType || !subjectId) return NextResponse.json({ error: 'subjectType and subjectId required' }, { status: 400 })

    const convo = await prisma.conversation.findFirst({
      where: subjectType === 'patient' ? { patientId: subjectId, subjectType: 'patient' as any } : { visitorId: subjectId, subjectType: 'visitor' as any },
      orderBy: { updatedAt: 'desc' },
    })

    const messages = convo
      ? await prisma.commMessage.findMany({ where: { conversationId: convo.id }, orderBy: { createdAt: 'desc' }, take })
      : []

    return NextResponse.json({ conversationId: convo?.id || null, messages })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 })
  }
}
