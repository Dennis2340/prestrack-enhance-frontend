import { NextResponse } from 'next/server'
import { agentRespond, setAgentIncomingPhone, clearAgentIncomingPhone, setRagSessionKey, clearRagSessionKey } from '@/lib/agent'

export async function POST(req: Request) {
  try {
    const { message, phoneE164, sessionKey } = await req.json().catch(() => ({})) as { message?: string; phoneE164?: string; sessionKey?: string }
    if (!message || typeof message !== 'string') return NextResponse.json({ error: 'message required' }, { status: 400 })

    let answer = ''
    let matches: any[] = []
    try {
      if (phoneE164 && /^\+\d{6,15}$/.test(phoneE164)) setAgentIncomingPhone(phoneE164)
      if (sessionKey) setRagSessionKey(sessionKey)
      const res = await agentRespond({ message, whatsappStyle: true })
      answer = res.answer
      matches = res.matches
    } finally {
      clearRagSessionKey()
      clearAgentIncomingPhone()
    }

    return NextResponse.json({ ok: true, answer, matches })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 })
  }
}
