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

        // Create medical escalation ONLY for patients; visitors are logged without escalation
        const summary = `Media received${text ? ` — ${String(text).slice(0, 180)}` : ''}`
        if (subjectType === 'patient' && subjectId) {
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
        }

        // Log inbound media into the conversation as a JSON body so UI can render it
        try {
          const mediaJson = JSON.stringify({
            kind: 'media',
            mimetype: mime,
            url: mediaObj?.url || mediaObj?.mediaUrl || null,
            filename: mediaObj?.filename || null,
            size: typeof mediaObj?.size === 'number' ? mediaObj.size : undefined,
            caption: text || undefined,
          })
          if (subjectType === 'patient' && subjectId) {
            let convo = await prisma.conversation.findFirst({ where: { patientId: subjectId, subjectType: 'patient' as any }, orderBy: { updatedAt: 'desc' } })
            if (!convo) {
              convo = await prisma.conversation.create({ data: { subjectType: 'patient' as any, patientId: subjectId, channel: 'whatsapp' as any, status: 'open' as any, lastMessageAt: new Date() } })
            }
            await prisma.commMessage.create({ data: { conversationId: convo.id, direction: 'inbound', via: 'whatsapp', body: mediaJson, senderType: 'patient' } })
          } else if (subjectType === 'visitor' && subjectId) {
            let convo = await prisma.conversation.findFirst({ where: { visitorId: subjectId, subjectType: 'visitor' as any }, orderBy: { updatedAt: 'desc' } })
            if (!convo) {
              convo = await prisma.conversation.create({ data: { subjectType: 'visitor' as any, visitorId: subjectId, channel: 'whatsapp' as any, status: 'open' as any, lastMessageAt: new Date() } })
            }
            await prisma.commMessage.create({ data: { conversationId: convo.id, direction: 'inbound', via: 'whatsapp', body: mediaJson, senderType: 'visitor' } })
          }
        } catch {}

        // Optionally: log a message row if a conversation exists
        try {
          if (subjectType === 'patient' && subjectId) {
            const convo = await prisma.conversation.findFirst({ where: { patientId: subjectId, subjectType: 'patient' as any }, orderBy: { updatedAt: 'desc' } })
            if (convo) await prisma.commMessage.create({ data: { conversationId: convo.id, direction: 'outbound', via: 'whatsapp', body: `[AUTO ESCALATION CREATED] ${summary}`, senderType: 'system' } })
          }
        } catch {}
      } catch {}
    })()

    // If this request contains media, immediately reassure the user while background escalation runs.
    try {
      const mime = String(mediaObj?.mimetype || mediaObj?.mimeType || mediaObj?.contentType || '')
      const isMedia = /^(audio|video|image|application)\//i.test(mime)
      if (isMedia) {
        const reassuring = `Thanks — your file was received. We will review it and follow up here shortly.`
        return NextResponse.json({ status: 'ok', answer: reassuring })
      }
    } catch {}

    // Identify subject and ensure visitor onboarding for unknown users
    let isPatient = false
    let patientId: string | null = null
    let visitorId: string | null = null
    let visitorName: string | null = null
    try {
      const ccP = await prisma.contactChannel.findFirst({ where: { type: 'whatsapp', value: phoneE164, patientId: { not: null } }, select: { patientId: true } })
      if (ccP?.patientId) {
        isPatient = true
        patientId = ccP.patientId
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

    // Removed hardcoded visitor name prompt; onboarding is handled by the agent via tool when appropriate

    // Ensure conversation + log inbound text for analytics/history
    try {
      const incomingText = String(text || '').trim()
      if (incomingText) {
        if (isPatient && patientId) {
          let convo = await prisma.conversation.findFirst({ where: { subjectType: 'patient' as any, patientId }, orderBy: { updatedAt: 'desc' } })
          if (!convo) {
            convo = await prisma.conversation.create({ data: { subjectType: 'patient' as any, patientId, channel: 'whatsapp' as any, status: 'open' as any, lastMessageAt: new Date() } })
          }
          await prisma.commMessage.create({ data: { conversationId: convo.id, direction: 'inbound', via: 'whatsapp', body: incomingText, senderType: 'patient', senderId: patientId } })
        } else if (visitorId) {
          let convo = await prisma.conversation.findFirst({ where: { subjectType: 'visitor' as any, visitorId }, orderBy: { updatedAt: 'desc' } })
          if (!convo) {
            convo = await prisma.conversation.create({ data: { subjectType: 'visitor' as any, visitorId, channel: 'whatsapp' as any, status: 'open' as any, lastMessageAt: new Date() } })
          }
          await prisma.commMessage.create({ data: { conversationId: convo.id, direction: 'inbound', via: 'whatsapp', body: incomingText, senderType: 'visitor', senderId: visitorId } })
        }
      }
    } catch {}

    // Escalation intent is now handled by the agent via tool-call; avoid regex-based escalation here to prevent duplicates

    // Fully agentic reply (with short conversation history, last 3 messages)
    let final = ''
    try {
      setAgentIncomingPhone(phoneE164)

      // Build conversation-aware history
      let convoId: string | null = null
      try {
        if (isPatient && patientId) {
          const c = await prisma.conversation.findFirst({ where: { subjectType: 'patient' as any, patientId }, orderBy: { updatedAt: 'desc' }, select: { id: true } })
          convoId = c?.id || null
        } else if (visitorId) {
          const c = await prisma.conversation.findFirst({ where: { subjectType: 'visitor' as any, visitorId }, orderBy: { updatedAt: 'desc' }, select: { id: true } })
          convoId = c?.id || null
        }
      } catch {}

      let history: Array<{ role: 'user'|'assistant'|'system'; content: string }> = []
      if (convoId) {
        try {
          const recent = await prisma.commMessage.findMany({ where: { conversationId: convoId }, orderBy: { createdAt: 'desc' }, take: 3 })
          const ordered = [...recent].reverse()
          history = ordered.map((m: any) => ({
            role: m.senderType === 'agent' ? 'assistant' : (m.senderType === 'system' ? 'system' : 'user'),
            content: String(m.body || ''),
          }))
        } catch {}
      }

      const { answer } = await agentRespond({ message: String(text || ''), whatsappStyle: true, history })
      final = answer || 'How can I help you today?'
    } finally {
      clearAgentIncomingPhone()
    }

    // Log agent reply to conversation so providers can review context
    try {
      if (final.trim()) {
        if (isPatient && patientId) {
          let convo = await prisma.conversation.findFirst({ where: { subjectType: 'patient' as any, patientId }, orderBy: { updatedAt: 'desc' } })
          if (!convo) {
            convo = await prisma.conversation.create({ data: { subjectType: 'patient' as any, patientId, channel: 'whatsapp' as any, status: 'open' as any, lastMessageAt: new Date() } })
          }
          await prisma.commMessage.create({ data: { conversationId: convo.id, direction: 'outbound', via: 'whatsapp', body: final, senderType: 'agent' } })
        } else if (visitorId) {
          let convo = await prisma.conversation.findFirst({ where: { subjectType: 'visitor' as any, visitorId }, orderBy: { updatedAt: 'desc' } })
          if (!convo) {
            convo = await prisma.conversation.create({ data: { subjectType: 'visitor' as any, visitorId, channel: 'whatsapp' as any, status: 'open' as any, lastMessageAt: new Date() } })
          }
          await prisma.commMessage.create({ data: { conversationId: convo.id, direction: 'outbound', via: 'whatsapp', body: final, senderType: 'agent' } })
        }
      }
    } catch {}

    return NextResponse.json({ status: 'ok', answer: final })
  } catch (err: any) {
    console.error('[whatsapp webhook] error', err?.message || err)
    return NextResponse.json({ status: 'ok', answer: 'Please try again in a moment.' })
  }
}
