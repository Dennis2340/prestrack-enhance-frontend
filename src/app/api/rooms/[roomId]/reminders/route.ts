import { NextResponse } from "next/server";
import { db } from "@/db";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import { ReminderStatus } from "@prisma/client"; // Import ReminderStatus type

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get("roomId");
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

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get("roomId");
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
    const { guestId, message, scheduledTime } = data;

    const reminder = await db.reminder.create({
      data: {
        guestId,
        agentId: user.id,
        message,
        scheduledTime: new Date(scheduledTime),
        status: "pending"
      }
    });

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
