import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAuth } from '@/lib/withAuth'

export async function GET(req: NextRequest) {
  const auth = requireAuth(req)
  if ('cookies' in auth) return auth as any

  try {
    // Determine permissions for current user
    let canUpdate = true
    let canClose = true
    if (auth.user.role === 'provider') {
      try {
        const prof = await prisma.providerProfile.findUnique({ where: { userId: auth.user.sub } as any })
        if (prof) {
          // Map to existing columns
          canUpdate = (prof as any).notifyEscalation ?? true
          canClose = (prof as any).notifyMedication ?? true
        }
      } catch {}
    }

    const docs = await prisma.document.findMany({
      where: { typeCode: 'medical_escalation' },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        createdAt: true,
        updatedAt: true,
        patientId: true,
        metadata: true,
      },
    })

    const items = docs.map((d: any) => {
      const m = (d.metadata || {}) as any
      return {
        id: d.id,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
        phoneE164: m.phoneE164 || null,
        subjectType: m.subjectType || (m.patientId ? 'patient' : 'visitor'),
        subjectId: m.subjectId || null,
        summary: m.summary || null,
        media: m.media || null,
        status: m.status || 'open',
      }
    })

    return NextResponse.json({ items, permissions: { canUpdate, canClose } })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 })
  }
}
