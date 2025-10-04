import { NextResponse } from 'next/server'
import { agentRespond } from '@/lib/agent'
import { sendChatbotMessage } from '@/lib/geneline'

export async function POST(req: Request) {
  try {
    const { message, history, email } = await req.json().catch(() => ({}))
    const text = String(message || '').trim()
    if (!text) return NextResponse.json({ error: 'message required' }, { status: 400 })

    // Prefer direct Geneline chatbot response when configured
    const useDirect = !!process.env.GENELINE_X_CHATBOT_ID
    if (useDirect) {
      const answer = await sendChatbotMessage({ message: text, email })
      return NextResponse.json({ answer, matches: [], billable: answer.length > 0 })
    }

    const res = await agentRespond({ message: text, history })
    return NextResponse.json(res)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 })
  }
}
