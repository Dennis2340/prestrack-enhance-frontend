import { NextResponse } from 'next/server'
import { agentRespond, setAgentIncomingPhone, clearAgentIncomingPhone } from '@/lib/agent'
import prisma from '@/lib/prisma'
import { createMedicalEscalation } from '@/lib/agent/tools/medical'

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
    const { chatId, text, mediaObj } = extractChatIdAndText(body)
    const phoneE164 = toPhoneE164(chatId || undefined)

    if (!phoneE164) return NextResponse.json({ status: 'ignored_invalid_chatId' })

    // Fire-and-forget: escalate on any media (audio/video/image/application)
    ;(async () => {
      try {
        const mime = String(mediaObj?.mimetype || mediaObj?.mimeType || mediaObj?.contentType || '')
        const isMedia = /^(audio|video|image|application)\//i.test(mime)
        if (!isMedia) return

        // Identify subject: patient by ContactChannel, else visitor by contact
        let subjectName: string | null = null
        let subjectType: 'patient' | 'visitor' = 'visitor'
        let subjectId: string | null = null
        try {
          const cc = await prisma.contactChannel.findFirst({ where: { type: 'whatsapp', value: phoneE164, patientId: { not: null } }, select: { patientId: true, patient: { select: { firstName: true, lastName: true } } } as any })
          if (cc?.patientId) {
            subjectType = 'patient'
            subjectId = cc.patientId
            const fn = (cc as any).patient?.firstName || ''
            const ln = (cc as any).patient?.lastName || ''
            subjectName = [fn, ln].filter(Boolean).join(' ') || null
          } else {
            const vis = await prisma.visitor.findFirst({ where: { contacts: { some: { type: 'whatsapp', value: phoneE164 } } }, select: { id: true, displayName: true } })
            if (vis) {
              subjectType = 'visitor'
              subjectId = vis.id
              subjectName = vis.displayName || null
            }
          }
        } catch {}

        // Create medical escalation record and notify providers
        const summary = `Media received${text ? ` — ${String(text).slice(0, 180)}` : ''}`
        await createMedicalEscalation({
          phoneE164,
          summary,
          subjectType,
          subjectId,
          media: {
            mimeType: mime,
            url: mediaObj?.url || mediaObj?.mediaUrl || null,
            filename: mediaObj?.filename || null,
            sizeBytes: typeof mediaObj?.size === 'number' ? mediaObj.size : undefined,
          },
        })

        // Optionally: log a message row if a conversation exists
        try {
          if (subjectType === 'patient' && subjectId) {
            const convo = await prisma.conversation.findFirst({ where: { patientId: subjectId, subjectType: 'patient' as any }, orderBy: { updatedAt: 'desc' } })
            if (convo) await prisma.commMessage.create({ data: { conversationId: convo.id, direction: 'outbound', via: 'whatsapp', body: `[AUTO ESCALATION CREATED] ${summary}`, senderType: 'system' } })
          } else if (subjectType === 'visitor' && subjectId) {
            const convo = await prisma.conversation.findFirst({ where: { visitorId: subjectId, subjectType: 'visitor' as any }, orderBy: { updatedAt: 'desc' } })
            if (convo) await prisma.commMessage.create({ data: { conversationId: convo.id, direction: 'outbound', via: 'whatsapp', body: `[AUTO ESCALATION CREATED] ${summary}`, senderType: 'system' } })
          }
        } catch {}
      } catch {}
    })()

    // Identify subject and ensure visitor onboarding for unknown users
    let isPatient = false
    let visitorId: string | null = null
    let visitorName: string | null = null
    try {
      const ccP = await prisma.contactChannel.findFirst({ where: { type: 'whatsapp', value: phoneE164, patientId: { not: null } }, select: { patientId: true } })
      if (ccP?.patientId) {
        isPatient = true
      } else {
        // Try existing visitor
        const vis = await prisma.visitor.findFirst({ where: { contacts: { some: { type: 'whatsapp', value: phoneE164 } } }, select: { id: true, displayName: true } })
        if (vis) {
          visitorId = vis.id
          visitorName = vis.displayName || null
        } else {
          // Create Visitor + ContactChannel
          const created = await prisma.visitor.create({ data: { displayName: null, contacts: { create: { ownerType: 'visitor', type: 'whatsapp', value: phoneE164, verified: true, preferred: true } } } })
          visitorId = created.id
          visitorName = null
        }
      }
    } catch {}

    // If visitor without a name, attempt to capture/confirm their name first
    if (!isPatient && visitorId) {
      const incoming = String(text || '').trim()
      const looksLikeName = incoming && /^[A-Za-z\s.'-]{2,60}$/.test(incoming)
      if (!visitorName) {
        if (looksLikeName) {
          try {
            await prisma.visitor.update({ where: { id: visitorId }, data: { displayName: incoming } })
          } catch {}
          const greet = `Thanks, ${incoming}! How can I help you today?`
          return NextResponse.json({ status: 'ok', answer: greet })
        }
        const promptName = `Welcome! I'm your clinic assistant. What's your name?`
        return NextResponse.json({ status: 'ok', answer: promptName })
      }
    }

    // Fully agentic reply
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
