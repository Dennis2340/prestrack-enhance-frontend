import { NextResponse } from "next/server";
import { db } from "@/db";
import { OpenAI } from "openai";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import { BUSINESS_CONFIG } from "../../../../../../../config";

type Message = {
  role: "system" | "user" | "assistant";
  content: string;
};


const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params;

    if (!roomId || !BUSINESS_CONFIG.businessId) {
      return NextResponse.json({ error: "Room ID and Business ID are required" }, { status: 400 });
    }

    // Get the guest ID from the room
    const room = await db.room.findUnique({
      where: { id: roomId, businessId:BUSINESS_CONFIG.businessId },
      select: { guestId: true }
    });

    if (!room?.guestId) {
      return NextResponse.json({ error: "No guest found in this room" }, { status: 404 });
    }

    const data = await request.json();
    const { message, patientId } = data;

    // Get conversation history
    const messages = await db.message.findMany({
      where: { roomId },
      include: {
        sender: true,
        taggedAgents: true
      },
      orderBy: { timestamp: "asc" }
    });

    // Get medical context
    const medicalContext = await db.medicalContext.findUnique({
      where: { guestId: room.guestId },
      include: {
        guest: true
      }
    });

    // Prepare context for AI
    const context: Message[] = [
      { role: "system", content: "You are a medical professional providing accurate and compassionate healthcare advice." },
      { role: "system", content: "Patient medical context: " + 
        (medicalContext ? JSON.stringify(medicalContext, null, 2) : "No medical context available") }
    ];

    // Add conversation history
    messages.forEach(msg => {
      context.push({
        role: msg.senderType === "guest" ? "user" : "assistant" as const,
        content: msg.content
      } as Message);
    });

    // Add current message
    context.push({ role: "user" as const, content: message } as Message);

    // Get AI response
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: context,
      temperature: 0.7,
      max_tokens: 1000,
      stream: false
    });

    const response = completion.choices[0].message?.content;

    console.log(response)
    // Save AI response as a message
    const timestamp = Date.now();
    await db.conversationMemory.create({
      data: {
        roomId,
        key: `ai_response_${timestamp}`,
        value: response,
      },
    });

    return NextResponse.json({ response });
  } catch (error) {
    console.error("AI conversation error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
