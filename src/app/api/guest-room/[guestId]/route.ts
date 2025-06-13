import { db } from "@/db";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ guestId: string }> }
) {
  try {
    const { guestId } = await params;

    if (!guestId) {
      return NextResponse.json(
        { error: "Guest ID is required" },
        { status: 400 }
      );
    }

    const guestChats = await db.room.findMany({
      where: { guestId },
      include: {
        messages: {
          orderBy: { timestamp: "desc" },
          take: 5,
          select: {
            id: true,
            content: true,
            timestamp: true,
            sender: { select: { id: true, name: true } },
            senderType: true,
            taggedAgents: { select: { id: true, name: true } },
          },
        },
      },
    });

    return NextResponse.json({ guestChats }, { status: 200 });
  } catch (error) {
    console.error("Error fetching customer rooms:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
