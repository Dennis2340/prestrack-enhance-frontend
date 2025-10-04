import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAuth } from '@/lib/withAuth'

export async function GET(req: NextRequest) {
  const auth = requireAuth(req)
  if ('cookies' in auth) return auth as any
  try {
    const take = Math.min(500, Math.max(1, Number(new URL(req.url).searchParams.get('take') || 50)))
    const items = await prisma.prescription.findMany({
      orderBy: { createdAt: 'desc' },
      take,
      select: {
        id: true,
        createdAt: true,
        updatedAt: true,
        medicationName: true,
        strength: true,
        form: true,
        startDate: true,
        endDate: true,
        status: true,
        patient: { select: { id: true, firstName: true, lastName: true } },
      },
    })
    return NextResponse.json({ items })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 })
  }
}
