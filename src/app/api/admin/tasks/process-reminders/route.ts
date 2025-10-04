import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAuth } from '@/lib/withAuth'
import { sendWhatsAppViaGateway } from '@/lib/whatsapp'

async function resolvePatientWhatsapp(patientId: string): Promise<string | null> {
  const cc = await prisma.contactChannel.findFirst({ where: { ownerType: 'patient', patientId, type: 'whatsapp' }, orderBy: { preferred: 'desc' }, select: { value: true } })
  return cc?.value || null
}

export async function POST(req: NextRequest) {
  const auth = requireAuth(req)
  if ('cookies' in auth) return auth as any
  try {
    // Optional limit param
    const { limit } = await req.json().catch(() => ({})) as { limit?: number }
    const take = Math.min(Math.max(Number(limit ?? 20) || 20, 1), 200)

    const now = new Date()
    const due = await prisma.task.findMany({
      where: { type: 'medication_reminder', status: 'pending', scheduledTime: { lte: now } },
      orderBy: { scheduledTime: 'asc' },
      take,
      select: { id: true, patientId: true, prescriptionId: true, scheduledTime: true, notes: true },
    })

    let sent = 0
    for (const t of due) {
      try {
        if (!t.patientId) { await prisma.task.update({ where: { id: t.id }, data: { status: 'failed', metadata: { reason: 'no_patient' } } }); continue }
        const to = await resolvePatientWhatsapp(t.patientId)
        if (!to) { await prisma.task.update({ where: { id: t.id }, data: { status: 'failed', metadata: { reason: 'no_whatsapp' } } }); continue }

        const body = `Prestrack reminder:\nPlease take your medication as prescribed.\n${t.notes || ''}`.trim()
        await sendWhatsAppViaGateway({ toE164: to, body })
        await prisma.task.update({ where: { id: t.id }, data: { status: 'sent', metadata: { sentAt: new Date().toISOString() } } })
        sent++
      } catch (e: any) {
        await prisma.task.update({ where: { id: t.id }, data: { status: 'failed', metadata: { error: String(e?.message || e) } } })
      }
    }

    return NextResponse.json({ ok: true, processed: due.length, sent })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 })
  }
}
