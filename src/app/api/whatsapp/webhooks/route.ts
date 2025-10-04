import { NextResponse } from 'next/server'
import { agentRespond, setAgentIncomingPhone, clearAgentIncomingPhone } from '@/lib/agent'

function extractChatIdAndText(body: any) {
  const payload = (body && typeof body === 'object' ? (body.payload || {}) : {}) as any
  const mediaObj = (payload.media || body.media || {}) as any
  const chatId: string | undefined =
    body.chatId || body.from || body.message?.from || body.contact || payload.from || payload.chatId || mediaObj.from || undefined
  const text: string | undefined =
    body.text || (typeof body.message === 'string' ? body.message : undefined) || body.message?.text || body.message?.body || body.body || payload.text || payload.body || mediaObj.body || undefined
  const messageId: string | undefined = payload.id || body.id || mediaObj.id || undefined
  return { chatId, text, payload, mediaObj, messageId }
}

function toPhoneE164(chatId?: string) {
  if (!chatId) return null
  const digits = String(chatId).replace(/@.*$/, '').replace(/\D/g, '')
  if (!/^\d{6,15}$/.test(digits)) return null
  return `+${digits}`
}

// Name extraction is intentionally not done here. Let the agent decide and ask.

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const { chatId, text } = extractChatIdAndText(body)
    const phoneE164 = toPhoneE164(chatId || undefined)

    if (!phoneE164) return NextResponse.json({ status: 'ignored_invalid_chatId' })

    // Fully agentic: provide phone context and let the agent decide patient vs visitor handling
    let final = ''
    try {
      setAgentIncomingPhone(phoneE164)
      const { answer } = await agentRespond({ message: String(text || ''), whatsappStyle: true })
      final = answer || 'How can I help you today?'
    } finally {
      clearAgentIncomingPhone()
    }
    return NextResponse.json({ status: 'ok', answer: final })
  } catch (err: any) {
    console.error('[whatsapp webhook] error', err?.message || err)
    return NextResponse.json({ status: 'ok', answer: 'Please try again in a moment.' })
  }
}
