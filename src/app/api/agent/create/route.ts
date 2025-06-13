import { NextResponse } from "next/server";
import { db } from "@/db";

export async function POST(request: Request) {
  try {
    const { name, email, agentId, businessId } = await request.json();

    if (!name || !email || !agentId || !businessId) {
      return NextResponse.json(
        { error: "Name, email, agent ID, and business ID are required" },
        { status: 400 }
      );
    }

    const existingAgent = await db.user.findUnique({
      where: { email },
    });

    if (existingAgent) {
      return NextResponse.json(
        { error: "Agent with this email already exists" },
        { status: 409 }
      );
    }

    await db.user.create({
      data: {
        name,
        email,
        agentId,
        role: "agent",
        businessId,
      },
    });

    return NextResponse.json({ message: "Agent created successfully" }, { status: 201 });
  } catch (error) {
    console.error("Error creating agent:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}