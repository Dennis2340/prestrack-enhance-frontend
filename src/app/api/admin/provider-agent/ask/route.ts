import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAuth } from '@/lib/withAuth'
import { agentRespond, setAgentIncomingPhone } from '@/lib/agent'

async function resolvePatientIdByPhone(phoneE164: string): Promise<string | null> {
  const cc = await prisma.contactChannel.findFirst({ where: { ownerType: 'patient', type: 'whatsapp', value: phoneE164 }, select: { patientId: true } })
  return cc?.patientId || null
}

async function hasGrantedConsent(patientId: string): Promise<boolean> {
  const doc = await prisma.document.findFirst({
    where: { patientId, typeCode: 'consent_access' },
    orderBy: { updatedAt: 'desc' },
    select: { metadata: true },
  })
  const meta: any = doc?.metadata || {}
  return Boolean(meta.granted)
}

export async function POST(req: NextRequest) {
  const auth = requireAuth(req)
  if ('cookies' in auth) return auth as any
  try {
    const { question, patientPhoneE164 } = await req.json().catch(() => ({}))
    const q = String(question || '').trim()
    if (!q) return NextResponse.json({ error: 'question required' }, { status: 400 })

    // General scope by default
    let phoneCtx: string | null = null

    if (patientPhoneE164) {
      if (!/^\+\d{6,15}$/.test(String(patientPhoneE164))) {
        return NextResponse.json({ error: 'invalid patientPhoneE164' }, { status: 400 })
      }
      const pid = await resolvePatientIdByPhone(patientPhoneE164)
      if (!pid) return NextResponse.json({ error: 'patient not found for phone' }, { status: 404 })
      const granted = await hasGrantedConsent(pid)
      if (!granted) return NextResponse.json({ error: 'consent not granted by patient' }, { status: 403 })
      phoneCtx = patientPhoneE164
    }

    // Run agent
    setAgentIncomingPhone(phoneCtx)
    const res = await agentRespond({ message: q, whatsappStyle: false })
    // clear after use
    setAgentIncomingPhone(null)

    return NextResponse.json({ answer: res.answer, matches: res.matches, billable: res.billable })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 })
  }
}
