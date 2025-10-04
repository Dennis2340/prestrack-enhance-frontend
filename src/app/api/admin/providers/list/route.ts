import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET() {
  try {
    const users = await prisma.user.findMany({
      where: { role: 'provider' as any },
      include: { providerProfile: true },
      orderBy: { createdAt: 'desc' },
    })
    const items = users.map((u) => ({
      id: u.id,
      name: u.name || null,
      email: u.email || null,
      phoneE164: u.providerProfile?.phoneE164 || null,
      createdAt: u.createdAt,
    }))
    return NextResponse.json({ items })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 })
  }
}
