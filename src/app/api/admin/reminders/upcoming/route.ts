import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAuth } from '@/lib/withAuth'

export async function GET(req: NextRequest) {
  const auth = requireAuth(req)
  if ('cookies' in auth) return auth as any
  try {
    const url = new URL(req.url)
    const take = Math.min(200, Math.max(1, Number(url.searchParams.get('take') || 50)))
    const now = new Date()
    const items = await prisma.task.findMany({
      where: { type: { in: ['medication_reminder','reminder'] as any }, scheduledTime: { gte: now }, status: { in: ['pending','sent'] as any } },
      orderBy: { scheduledTime: 'asc' },
      take,
      select: {
        id: true,
        scheduledTime: true,
        status: true,
        prescription: { select: { id: true, medicationName: true, patient: { select: { id: true, firstName: true, lastName: true } } } },
      }
    })
    return NextResponse.json({ items })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 })
  }
}
