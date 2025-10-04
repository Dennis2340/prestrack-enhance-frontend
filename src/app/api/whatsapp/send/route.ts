import { NextResponse } from "next/server";
import { sendWhatsAppViaGateway } from "@/lib/whatsapp";
import { ensureVisitorByPhone, ensureVisitorConversation } from "@/lib/contacts";
import prisma from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const { phoneE164, message, displayName } = await req.json().catch(() => ({}));
    if (!phoneE164 || !/^\+\d{6,15}$/.test(phoneE164)) {
      return NextResponse.json({ error: "Invalid phoneE164" }, { status: 400 });
    }
    const body = String(message || "").trim();
    if (!body) return NextResponse.json({ error: "Empty message" }, { status: 400 });

    // Send via gateway
    const resp = await sendWhatsAppViaGateway({ toE164: phoneE164, body });

    // Persist visitor + conversation + outbound message
    const visitor = await ensureVisitorByPhone(phoneE164, displayName);
    const convo = await ensureVisitorConversation(visitor.id);
    const saved = await prisma.commMessage.create({
      data: {
        conversationId: convo.id,
        direction: "outbound",
        via: "whatsapp",
        body,
        senderType: "system",
      },
    });

    return NextResponse.json({ status: "ok", gateway: resp, conversationId: convo.id, messageId: saved.id });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "failed" }, { status: 500 });
  }
}
