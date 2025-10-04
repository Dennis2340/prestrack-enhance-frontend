import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAuth } from '@/lib/withAuth'

export async function POST(req: NextRequest) {
  const auth = requireAuth(req)
  if ('cookies' in auth) return auth as any
  try {
    const { userId, canUpdateEscalations, canCloseEscalations } = await req.json().catch(()=>({})) as { userId?: string; canUpdateEscalations?: boolean; canCloseEscalations?: boolean }
    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

    // Authorization: admins can update any provider. For local/testing, allow a provider
    // to update their OWN profile when ALLOW_PROVIDER_PRIVILEGE_EDIT=true.
    const allowSelfEdit = process.env.ALLOW_PROVIDER_PRIVILEGE_EDIT === 'true'
    const isSelf = auth.user.sub === userId
    const isAdmin = auth.user.role === 'admin'
    if (!(isAdmin || (allowSelfEdit && isSelf))) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }

    const data: any = {}
    if (typeof canUpdateEscalations === 'boolean') data.canUpdateEscalations = canUpdateEscalations
    if (typeof canCloseEscalations === 'boolean') data.canCloseEscalations = canCloseEscalations
    if (Object.keys(data).length === 0) return NextResponse.json({ error: 'no changes' }, { status: 400 })

    // Ensure a profile exists (upsert for resilience)
    await prisma.providerProfile.upsert({
      where: { userId } as any,
      update: data,
      create: { userId, ...data } as any,
    })
    return NextResponse.json({ ok: true })
  } catch (e:any) {
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 })
  }
}
