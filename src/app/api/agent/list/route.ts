import { NextResponse } from "next/server";
import { db } from "@/db";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const businessId = url.searchParams.get("businessId");

    if (!businessId) {
      return new NextResponse(
        JSON.stringify({ error: "businessId is required" }),
        { status: 400 }
      );
    }

    const agents = await db.user.findMany({
      where: {
        role: "agent",
        businessId: businessId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        agentId: true,
        businessId: true,
        AgentPresence: {
          select: {
            isOnline: true,
            lastSeen: true,
          },
        },
      },
    });

    return new NextResponse(JSON.stringify({ agents }), { status: 200 });
  } catch (error) {
    console.error("Error fetching agents:", error);
    return new NextResponse(
      JSON.stringify({ error: "Internal Server Error" }),
      { status: 500 }
    );
  }
}
