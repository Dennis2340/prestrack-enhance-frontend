import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAuth } from '@/lib/withAuth'

export async function POST(req: NextRequest) {
  const auth = requireAuth(req)
  if ('cookies' in auth) return auth as any
  try {
    if (auth.user.role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    const { userId, canUpdateEscalations, canCloseEscalations } = await req.json().catch(()=>({})) as { userId?: string; canUpdateEscalations?: boolean; canCloseEscalations?: boolean }
    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

    const data: any = {}
    if (typeof canUpdateEscalations === 'boolean') data.canUpdateEscalations = canUpdateEscalations
    if (typeof canCloseEscalations === 'boolean') data.canCloseEscalations = canCloseEscalations
    if (Object.keys(data).length === 0) return NextResponse.json({ error: 'no changes' }, { status: 400 })

    await prisma.providerProfile.update({ where: { userId } as any, data })
    return NextResponse.json({ ok: true })
  } catch (e:any) {
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 })
  }
}
