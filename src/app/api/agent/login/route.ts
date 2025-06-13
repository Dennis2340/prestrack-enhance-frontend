import { NextResponse } from "next/server";
import { db } from "@/db";

export async function POST(request: Request) {
  try {
    const { email, agentId, businessId } = await request.json();

    if (!email || !agentId || !businessId) {
      return NextResponse.json(
        { error: "Email, Agent ID, and Business ID are required" },
        { status: 400 }
      );
    }

    const agent = await db.user.findFirst({
      where: {
        email: email.trim(), // Ensure no whitespace issues
        agentId: agentId.trim(), // Ensure no whitespace issues
        role: "agent",
        businessId,
      },
    });

    if (!agent) {
      console.log("Agent not found in database for:", {
        email,
        agentId,
        businessId,
      });
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      {
        message: "Login successful",
        agent: { agentId: agent.agentId, name: agent.name, email: agent.email },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error during login:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
