import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { ensureVisitorByPhone, ensureVisitorConversation } from "@/lib/contacts";

export async function POST(req: Request) {
  try {
    const { chatbotId, event, message, from, phoneE164, displayName } = await req.json().catch(() => ({}));

    // Basic validation
    const ev = String(event || "").trim().toLowerCase();

    if (ev === "connected" || ev === "disconnected") {
      // Acknowledge status without persisting (no MetaEvent model in current schema)
      return NextResponse.json({ status: "ok" });
    }

    if (ev === "message") {
      const phone = typeof phoneE164 === "string" && /^\+\d{6,15}$/.test(phoneE164)
        ? phoneE164
        : (() => {
            const local = String(from || "").split("@")[0];
            return /^\d{6,15}$/.test(local) ? `+${local}` : null;
          })();

      if (!phone) return NextResponse.json({ error: "missing phone" }, { status: 400 });

      // Ensure visitor + conversation
      const visitor = await ensureVisitorByPhone(phone, displayName);
      const convo = await ensureVisitorConversation(visitor.id);

      const body = String(message || "").slice(0, 4000);
      await prisma.commMessage.create({
        data: {
          conversationId: convo.id,
          direction: "inbound",
          via: "whatsapp",
          body,
          senderType: "patient",
          meta: { from, chatbotId },
        },
      });

      return NextResponse.json({ status: "ok", conversationId: convo.id });
    }

    return NextResponse.json({ status: "ignored" });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "failed" }, { status: 500 });
  }
}
