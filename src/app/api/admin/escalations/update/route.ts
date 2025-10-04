import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAuth } from '@/lib/withAuth'
import { sendWhatsAppViaGateway } from '@/lib/whatsapp'

export async function POST(req: NextRequest) {
  const auth = requireAuth(req)
  if ('cookies' in auth) return auth as any

  try {
    const { id, status, note } = await req.json().catch(() => ({})) as { id?: string; status?: 'open' | 'in_progress' | 'closed'; note?: string }
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    // Enforce privileges for providers; admins allowed
    let canUpdate = true
    let canClose = true
    if (auth.user.role === 'provider') {
      const prof = await prisma.providerProfile.findUnique({ where: { userId: auth.user.sub } as any })
      canUpdate = (prof as any)?.canUpdateEscalations ?? false
      canClose = (prof as any)?.canCloseEscalations ?? false
      if (!canUpdate && (status || note)) {
        return NextResponse.json({ error: 'forbidden' }, { status: 403 })
      }
      if (status === 'closed' && !canClose) {
        return NextResponse.json({ error: 'forbidden_close' }, { status: 403 })
      }
    }

    const doc = await prisma.document.findUnique({ where: { id }, select: { id: true, metadata: true } })
    if (!doc) return NextResponse.json({ error: 'not found' }, { status: 404 })

    const meta = Object.assign({}, (doc.metadata as any) || {})
    if (status) meta.status = status
    if (note) {
      const notes = Array.isArray(meta.notes) ? meta.notes : []
      notes.unshift({ at: new Date().toISOString(), by: auth.user.email || auth.user.sub, note: String(note) })
      meta.notes = notes
    }

    await prisma.document.update({ where: { id }, data: { metadata: meta } })

    // Notify all providers of the update to avoid duplicate work
    try {
      const providers = await prisma.providerProfile.findMany({ where: { phoneE164: { not: null } }, select: { phoneE164: true } })
      const updater = auth.user.email || auth.user.sub
      const body = `Escalation ${id} updated by ${updater}${status ? ` — status: ${status}` : ''}${note ? `\nNote: ${String(note).slice(0,180)}` : ''}`
      await Promise.allSettled(providers.map(p => p.phoneE164 ? sendWhatsAppViaGateway({ toE164: p.phoneE164, body }) : Promise.resolve()))
    } catch {}

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 })
  }
}
