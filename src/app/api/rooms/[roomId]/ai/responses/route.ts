import { NextResponse } from "next/server";
import { db } from "@/db";
import { BUSINESS_CONFIG } from "../../../../../../../config";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params;

    if (!roomId || !BUSINESS_CONFIG.businessId) {
      return NextResponse.json(
        { error: "Room ID and Business ID are required" },
        { status: 400 }
      );
    }

    // Verify room exists
    const room = await db.room.findUnique({
      where: { id: roomId, businessId: BUSINESS_CONFIG.businessId },
      select: { id: true },
    });

    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    // Fetch AI responses
    const aiResponses = await db.conversationMemory.findMany({
      where: {
        roomId,
        key: { startsWith: "ai_response_" },
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(
      aiResponses.map((res) => ({
        id: res.id,
        roomId: res.roomId,
        content: res.value,
        timestamp: res.createdAt.toISOString(),
      }))
    );
  } catch (error) {
    console.error("Error fetching AI responses:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}