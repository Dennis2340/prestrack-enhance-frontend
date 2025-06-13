import { NextResponse } from "next/server";
import { db } from "@/db";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params;
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get("businessId");

    if (!businessId) {
      return NextResponse.json({ error: "Business ID is required" }, { status: 400 });
    }

    const messages = await db.message.findMany({
      where: { roomId, room: { businessId } },
      orderBy: { timestamp: "asc" },
      include: { sender: true },
    });

    return NextResponse.json({ messages }, { status: 200 });
  } catch (error) {
    console.error("Error fetching messages for room:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params;

    await db.message.deleteMany({
      where: { roomId },
    });

    await db.room.delete({
      where: { id: roomId },
    });

    return NextResponse.json({ message: "Room deleted successfully" }, { status: 200 });
  } catch (error) {
    console.error("Error deleting room:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}