import { NextResponse } from "next/server";
import { db } from "@/db";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import { derivePhoneFromEmail, formatE164, sendWhatsAppViaGateway } from "@/lib/whatsapp";

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get("roomId");
    const businessId = searchParams.get("businessId");

    if (!roomId || !businessId) {
      return NextResponse.json({ error: "Room ID and Business ID are required" }, { status: 400 });
    }

    const { getUser } = getKindeServerSession();
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { message } = await request.json();
    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "Missing 'message'" }, { status: 400 });
    }

    // Load room with guest
    const room = await db.room.findUnique({
      where: { id: roomId },
      include: { guest: { select: { id: true, email: true, name: true, businessId: true } } },
    });

    if (!room || !room.guest || room.businessId !== businessId || room.guest.businessId !== businessId) {
      return NextResponse.json({ error: "Room or guest not found for this business" }, { status: 404 });
    }

    const rawPhone = derivePhoneFromEmail(room.guest.email);
    if (!rawPhone) {
      return NextResponse.json({ error: "No phone could be derived for guest" }, { status: 400 });
    }

    const toE164 = formatE164(rawPhone);
    if (!toE164) {
      return NextResponse.json({ error: "Derived phone is invalid" }, { status: 400 });
    }

    // Send via external WhatsApp gateway
    await sendWhatsAppViaGateway({ toE164, body: message });

    // Persist message in DB as coming from doctor/agent
    const saved = await db.message.create({
      data: {
        roomId: room.id,
        senderType: "agent",
        senderId: user.id,
        content: message,
        contentType: "text",
        metadata: { channel: "whatsapp", direction: "outbound" },
      },
    });

    return NextResponse.json({ ok: true, message: saved }, { status: 200 });
  } catch (error: any) {
    console.error("/api/rooms/[roomId]/whatsapp/send error:", error);
    return NextResponse.json({ error: error?.message || "Internal Error" }, { status: 500 });
  }
}
