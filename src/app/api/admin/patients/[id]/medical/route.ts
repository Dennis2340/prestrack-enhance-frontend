import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { sendWhatsAppViaGateway } from '@/lib/whatsapp'

async function notifyProviders(patientId: string, msg: string) {
  // Notify all providers who have phoneE164 configured
  const providers = await prisma.providerProfile.findMany({ where: { phoneE164: { not: null } } })
  await Promise.allSettled(
    providers.map((p) => p.phoneE164 ? sendWhatsAppViaGateway({ toE164: p.phoneE164, body: msg }) : Promise.resolve())
  )
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const doc = await prisma.document.findFirst({
      where: { patientId: id, typeCode: 'medical_history' },
      orderBy: { updatedAt: 'desc' },
    })
    const payload = (doc?.metadata as any) || null
    return NextResponse.json({ history: payload })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 })
  }
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const { history, notifyProviders: notify } = await req.json().catch(() => ({}))
    if (!history || typeof history !== 'object') return NextResponse.json({ error: 'history object required' }, { status: 400 })

    const upserted = await prisma.document.create({
      data: {
        patientId: id,
        url: 'internal:medical_history',
        filename: 'medical_history.json',
        contentType: 'application/json',
        title: 'Medical History',
        typeCode: 'medical_history',
        metadata: history,
      },
    })

    if (notify) {
      await notifyProviders(id, `Patient ${id} medical history updated.`)
    }

    return NextResponse.json({ ok: true, id: upserted.id })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 })
  }
}
