import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAuth } from '@/lib/withAuth'

export async function GET(req: NextRequest) {
  const auth = requireAuth(req)
  if ('cookies' in auth) return auth as any
  try {
    const url = new URL(req.url)
    const type = url.searchParams.get('type') as 'patient' | 'visitor' | null

    const convos = await prisma.conversation.findMany({
      where: {
        ...(type ? { subjectType: type as any } : {}),
      },
      orderBy: { updatedAt: 'desc' },
      take: 200,
      select: {
        id: true,
        subjectType: true as any,
        patientId: true,
        visitorId: true,
        channel: true as any,
        status: true as any,
        updatedAt: true,
        lastMessageAt: true,
      },
    })

    const items = await Promise.all(convos.map(async (c) => {
      const last = await prisma.commMessage.findFirst({ where: { conversationId: c.id }, orderBy: { createdAt: 'desc' }, select: { body: true, createdAt: true } })
      let name: string | null = null
      if (c.subjectType === 'patient' && c.patientId) {
        const p = await prisma.patient.findUnique({ where: { id: c.patientId }, select: { firstName: true, lastName: true } })
        name = [p?.firstName, p?.lastName].filter(Boolean).join(' ') || 'Patient'
      } else if (c.subjectType === 'visitor' && c.visitorId) {
        const v = await prisma.visitor.findUnique({ where: { id: c.visitorId }, select: { displayName: true } })
        name = v?.displayName || 'Visitor'
      }
      return {
        id: c.id,
        subjectType: c.subjectType,
        name,
        status: c.status,
        updatedAt: c.updatedAt,
        lastMessageAt: c.lastMessageAt,
        lastBody: last?.body || null,
        lastAt: last?.createdAt || null,
      }
    }))

    return NextResponse.json({ items })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 })
  }
}
