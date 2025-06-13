import { NextResponse } from "next/server";
import { db } from "@/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get("businessId");

    if (!businessId) {
      return NextResponse.json({ error: "Business ID is required" }, { status: 400 });
    }

    const rooms = await db.room.findMany({
      where: { status: "active", businessId },
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
        guest: { select: { id: true, name: true, email: true } },
        activeAgents: { select: { id: true, name: true, email: true } },
      },
    });

    return NextResponse.json({ rooms }, { status: 200 });
  } catch (error) {
    console.error("Error fetching rooms:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}