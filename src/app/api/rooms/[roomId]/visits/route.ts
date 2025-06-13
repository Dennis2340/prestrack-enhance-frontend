import { NextResponse } from "next/server";
import { db } from "@/db";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import { VisitationStatus } from "@prisma/client";

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
    const { guestId, scheduledTime, notes } = data;

    const visit = await db.visitation.create({
      data: {
        guestId,
        agentId: user.id,
        scheduledTime: new Date(scheduledTime),
        notes,
        status: "scheduled"
      }
    });

    return NextResponse.json({ visit }, { status: 201 });
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
