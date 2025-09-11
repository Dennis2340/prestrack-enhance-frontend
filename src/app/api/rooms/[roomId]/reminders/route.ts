import { NextResponse } from "next/server";
import { db } from "@/db";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import { ReminderStatus } from "@prisma/client"; // Import ReminderStatus type
import { derivePhoneFromEmail, formatE164, sendWhatsAppViaGateway } from "@/lib/whatsapp";

export async function GET(request: Request, ctx: { params: { roomId: string } }) {
  try {
    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get("roomId") || ctx?.params?.roomId || undefined;
    const businessId = searchParams.get("businessId");
    const status = searchParams.get("status");

    if (!roomId || !businessId) {
      return NextResponse.json({ error: "Room ID and Business ID are required" }, { status: 400 });
    }

     // Get the session user from Kinde.
     const { getUser } = getKindeServerSession();
     const { id: userId } = await getUser();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // First get the room to find the guestId
    const room = await db.room.findUnique({
      where: { id: roomId },
      select: { guestId: true }
    });

    if (!room || !room.guestId) {
      return NextResponse.json({ error: "Room or guest not found" }, { status: 404 });
    }

    const reminders = await db.reminder.findMany({
      where: {
        guestId: room.guestId,
        agentId: userId,
        ...(status ? { status: status as ReminderStatus } : {})
      },
      include: {
        guest: { select: { name: true } },
        agent: { select: { name: true } }
      },
      orderBy: { scheduledTime: "asc" }
    });

    return NextResponse.json({ reminders }, { status: 200 });
  } catch (error) {
    console.error("Error fetching reminders:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request, ctx: { params: { roomId: string } }) {
  try {
    const { searchParams } = new URL(request.url);
    let roomId = searchParams.get("roomId") || ctx?.params?.roomId || undefined;
    const businessId = searchParams.get("businessId");

    if (!roomId || !businessId) {
      return NextResponse.json({ error: "Room ID and Business ID are required" }, { status: 400 });
    }

   // Get the session user from Kinde.
   const { getUser } = getKindeServerSession();
   const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await request.json();
    const { guestId, message, scheduledTime, phoneE164, phone, roomId: roomIdFromBody } = data || {};
    if (!roomId && roomIdFromBody && typeof roomIdFromBody === "string") {
      roomId = roomIdFromBody;
    }

    let reminder = await db.reminder.create({
      data: {
        guestId,
        agentId: user.id,
        message,
        scheduledTime: new Date(scheduledTime),
        status: "pending"
      }
    });

    // Fetch guest details to derive phone number
    const guest = await db.user.findUnique({
      where: { id: guestId },
      select: { email: true, name: true }
    });

    const derived = derivePhoneFromEmail(guest?.email);
    const toE164 = formatE164(phoneE164 || phone || derived);

    if (!toE164) {
      // Can't send WhatsApp without a phone. Return created reminder with pending status.
      return NextResponse.json({
        reminder,
        warning: "No phone could be derived for guest; WhatsApp not sent.",
      }, { status: 201 });
    }

    // Format WhatsApp message
    const humanTime = new Date(scheduledTime).toLocaleString();
    const doctorName = user.given_name || user.family_name ? `${user.given_name || ""} ${user.family_name || ""}`.trim() : (user.email || "Doctor");
    const body = `Hello${guest?.name ? ` ${guest.name}` : ""}, this is a reminder from ${doctorName}:\n\n${message}\n\nScheduled time: ${humanTime}`;

    try {
      await sendWhatsAppViaGateway({ toE164, body });
      // mark reminder as sent
      reminder = await db.reminder.update({
        where: { id: reminder.id },
        data: { status: "sent", sentTime: new Date(), updatedAt: new Date() },
      });
    } catch (e) {
      console.error("Failed to send WhatsApp for reminder:", e);
      reminder = await db.reminder.update({
        where: { id: reminder.id },
        data: { status: "failed", updatedAt: new Date() },
      });
      return NextResponse.json({
        reminder,
        error: "WhatsApp send failed",
      }, { status: 207 }); // 207 Multi-Status indicating partial success
    }

    return NextResponse.json({ reminder }, { status: 201 });
  } catch (error) {
    console.error("Error creating reminder:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const reminderId = searchParams.get("reminderId");
    const businessId = searchParams.get("businessId");

    if (!reminderId || !businessId) {
      return NextResponse.json({ error: "Reminder ID and Business ID are required" }, { status: 400 });
    }

    // Get the session user from Kinde.
    const { getUser } = getKindeServerSession();
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await request.json();
    const { status, message, scheduledTime } = data;

    const updatedReminder = await db.reminder.update({
      where: { id: reminderId },
      data: {
        ...(status && { status }),
        ...(message && { message }),
        ...(scheduledTime && { scheduledTime: new Date(scheduledTime) }),
        updatedAt: new Date()
      },
      include: {
        guest: true,
        agent: true
      }
    });

    // Verify the businessId through the guest or agent relationship
    if (updatedReminder.guest?.businessId !== businessId && updatedReminder.agent?.businessId !== businessId) {
      throw new Error("Reminder not found for this business");
    }

    return NextResponse.json({ reminder: updatedReminder }, { status: 200 });
  } catch (error) {
    console.error("Error updating reminder:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
