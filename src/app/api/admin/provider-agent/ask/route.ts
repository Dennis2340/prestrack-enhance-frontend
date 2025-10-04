import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAuth } from '@/lib/withAuth'
import { agentRespond, setAgentIncomingPhone } from '@/lib/agent'

async function resolvePatientIdByPhone(phoneE164: string): Promise<string | null> {
  const cc = await prisma.contactChannel.findFirst({ where: { ownerType: 'patient', type: 'whatsapp', value: phoneE164 }, select: { patientId: true } })
  return cc?.patientId || null
}

// Consent enforcement is disabled for authenticated admin/provider dashboard calls.
// If a public endpoint is exposed in the future, add consent checks there.

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
