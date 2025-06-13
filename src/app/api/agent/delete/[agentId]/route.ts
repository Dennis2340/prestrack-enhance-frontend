import { NextResponse } from "next/server";
import { db } from "@/db";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ agentId: string }>}
) {
  try {
    const { agentId } = await params;

    if (!agentId) {
      return NextResponse.json({ error: "Agent ID is required" }, { status: 400 });
    }

    const agent = await db.user.findUnique({
      where: { agentId },
    });

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    await db.user.delete({
      where: { agentId },
    });

    return NextResponse.json({ message: "Agent deleted successfully" }, { status: 200 });
  } catch (error) {
    console.error("Error deleting agent:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}