import { NextResponse } from "next/server";
import { db } from "@/db";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import { VisitationStatus } from "@prisma/client";
import { derivePhoneFromEmail, formatE164, sendWhatsAppViaGateway } from "@/lib/whatsapp";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get("roomId");
    const businessId = searchParams.get("businessId");
    const status = searchParams.get("status");

    if (!roomId || !businessId) {
      return NextResponse.json({ error: "Room ID and Business ID are required" }, { status: 400 });
    }

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

    const visits = await db.visitation.findMany({
      where: {
        guestId: room.guestId,
        agentId: userId,
        ...(status ? { status: status as VisitationStatus } : {})
      },
      include: {
        guest: { select: { name: true } },
        agent: { select: { name: true } }
      },
      orderBy: { scheduledTime: "desc" }
    });

    return NextResponse.json({ visits }, { status: 200 });
  } catch (error) {
    console.error("Error fetching visits:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

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

    const data = await request.json();
    const { guestId, scheduledTime, notes, phoneE164, phone } = data;

    const visit = await db.visitation.create({
      data: {
        guestId,
        agentId: user.id,
        scheduledTime: new Date(scheduledTime),
        notes,
        status: "scheduled"
      }
    });

    // Attempt to notify guest via WhatsApp about the appointment
    try {
      // Load guest to potentially derive phone from email convention
      const guest = await db.user.findUnique({
        where: { id: guestId },
        select: { email: true, name: true },
      });

      const derived = derivePhoneFromEmail(guest?.email);
      const toE164 = formatE164(phoneE164 || phone || derived);

      if (!toE164) {
        return NextResponse.json(
          {
            visit,
            warning: "Appointment created; no WhatsApp number available for notification.",
          },
          { status: 201 }
        );
      }

      const when = new Date(scheduledTime).toLocaleString();
      const doctorName = user.given_name || user.family_name
        ? `${user.given_name || ""} ${user.family_name || ""}`.trim()
        : (user.email || "Doctor");
      const message = `Appointment Scheduled\n\nHello${guest?.name ? ` ${guest.name}` : ""}, you have an appointment with ${doctorName}.\nDate & Time: ${when}${notes ? `\nNotes: ${notes}` : ""}`;

      await sendWhatsAppViaGateway({ toE164, body: message });

      return NextResponse.json({ visit, notified: true }, { status: 201 });
    } catch (notifyErr: any) {
      console.warn("Visit created but WhatsApp notify failed:", notifyErr?.message || notifyErr);
      return NextResponse.json(
        { visit, error: "WhatsApp notification failed" },
        { status: 207 }
      );
    }
  } catch (error) {
    console.error("Error creating visit:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const visitId = searchParams.get("visitId");
    const businessId = searchParams.get("businessId");

    if (!visitId || !businessId) {
      return NextResponse.json({ error: "Visit ID and Business ID are required" }, { status: 400 });
    }

    const { getUser } = getKindeServerSession();
    const user = await getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await request.json();
    const { status, notes } = data;

    const updatedVisit = await db.visitation.update({
      where: { id: visitId },
      data: {
        status: status as VisitationStatus,
        notes,
        ...(status === "completed" ? { completedAt: new Date() } : {})
      }
    });

    return NextResponse.json({ visit: updatedVisit }, { status: 200 });
  } catch (error) {
    console.error("Error updating visit:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
