import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET() {
  try {
    const patients = await prisma.patient.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        contacts: true,
      } as any,
    })

    const items = patients.map((p: any) => {
      const wa = (p.contacts || []).find((c: any) => c.type === 'whatsapp')
      const phoneE164 = wa?.value || null
      const fullName = [p.firstName, p.lastName].filter(Boolean).join(' ') || null
      return {
        id: p.id,
        name: fullName,
        phoneE164,
        createdAt: p.createdAt,
      }
    })

    return NextResponse.json({ items })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 })
  }
}
