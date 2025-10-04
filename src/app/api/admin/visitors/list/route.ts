import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET() {
  try {
    const visitors = await prisma.visitor.findMany({
      orderBy: { createdAt: 'desc' },
      include: { contacts: true } as any,
    })
    const items = visitors.map((v: any) => {
      const wa = (v.contacts || []).find((c: any) => c.type === 'whatsapp')
      return {
        id: v.id,
        name: v.displayName || null,
        phoneE164: wa?.value || null,
        createdAt: v.createdAt,
      }
    })
    return NextResponse.json({ items })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 })
  }
}
