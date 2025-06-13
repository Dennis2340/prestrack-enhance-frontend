import { NextResponse } from "next/server";
import { db } from "@/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get("roomId");
    const businessId = searchParams.get("businessId");

    if (!roomId || !businessId) {
      return NextResponse.json({ error: "Room ID and Business ID are required" }, { status: 400 });
    }

  

    const room = await db.room.findUnique({
      where: { id: roomId, businessId },
      select: { guestId: true }
    });

    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    const medicalContext = await db.medicalContext.findUnique({
      where: { guestId: room.guestId }
    });

    return NextResponse.json({ medicalContext }, { status: 200 });
  } catch (error) {
    console.error("Error fetching medical context:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get("roomId");
    const businessId = searchParams.get("businessId");

    if (!roomId || !businessId) {
      return NextResponse.json({ error: "Room ID and Business ID are required" }, { status: 400 });
    }

    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await request.json();
    const { pregnancyStatus, gestationalAge, dueDate, highRisk, conditions, medications } = data;

    const room = await db.room.findUnique({
      where: { id: roomId, businessId },
      select: { guestId: true }
    });

    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    const updatedContext = await db.medicalContext.upsert({
      where: { guestId: room.guestId },
      update: {
        pregnancyStatus,
        gestationalAge,
        dueDate,
        highRisk,
        conditions,
        medications,
        updatedAt: new Date()
      },
      create: {
        guestId: room.guestId,
        pregnancyStatus,
        gestationalAge,
        dueDate,
        highRisk,
        conditions,
        medications
      }
    });

    return NextResponse.json({ medicalContext: updatedContext }, { status: 200 });
  } catch (error) {
    console.error("Error updating medical context:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
