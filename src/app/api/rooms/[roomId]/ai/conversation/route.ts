import { NextResponse } from "next/server";
import { db } from "@/db";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import { BUSINESS_CONFIG } from "../../../../../../../config";
import { OpenAI } from "openai";

type Message = {
  role: "system" | "user" | "assistant";
  content: string;
};

// Initialize Hugging Face client
const hfClient = new OpenAI({
  baseURL: 'https://router.huggingface.co/featherless-ai/v1',
  apiKey: process.env.HF_TOKEN,
});

export async function POST(
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

    // Get the room with guest and medical context
    const room = await db.room.findUnique({
      where: { 
        id: roomId, 
        business: {
          id: BUSINESS_CONFIG.businessId
        }
      },
      include: {
        guest: {
          include: {
            medicalContext: {
              include: {
                medicalImages: {
                  include: {
                    uploader: {
                      select: {
                        name: true,
                        email: true
                      }
                    }
                  },
                  orderBy: { createdAt: 'desc' },
                  take: 5
                }
              }
            }
          }
        }
      }
    });

    if (!room?.guest) {
      return NextResponse.json(
        { error: "No guest found in this room" },
        { status: 404 }
      );
    }

    const data = await request.json();
    const { message } = data;

    if (!message?.trim()) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    // Get conversation history
    const messages = await db.message.findMany({
      where: { roomId },
      include: {
        sender: true,
        taggedAgents: true
      },
      orderBy: { timestamp: "asc" },
      take: 50
    });

    // Prepare context for AI
    const context: Message[] = [
      { 
        role: "system", 
        content: `You are an advanced AI medical assistant designed to help doctors with patient care. Your role is to:
        - Analyze patient medical data and highlight key information
        - Suggest potential diagnoses based on symptoms and medical history
        - Flag any concerning patterns or red flags in the patient's data
        - Provide relevant medical knowledge and treatment considerations
        - Help with differential diagnoses and next steps
        - Maintain a professional, clear, and concise communication style`
      }
    ];

    // Add medical context if available
    if (room.guest.medicalContext) {
      const { medicalContext } = room.guest;
      
      // Basic medical info
      const medicalInfo = {
        bloodType: medicalContext.bloodType || 'Not specified',
        pregnancyStatus: medicalContext.pregnancyStatus || 'Not specified',
        gestationalAge: medicalContext.gestationalAge || 'Not specified',
        highRisk: medicalContext.highRisk ? 'Yes' : 'No',
        conditions: medicalContext.conditions ? JSON.parse(JSON.stringify(medicalContext.conditions)) : [],
        allergies: medicalContext.allergies ? JSON.parse(JSON.stringify(medicalContext.allergies)) : []
      };

      // Format the medical context
      let contextContent = `PATIENT MEDICAL CONTEXT:
- Name: ${room.guest.name}
- Blood Type: ${medicalInfo.bloodType}
- Pregnancy Status: ${medicalInfo.pregnancyStatus}
- Gestational Age: ${medicalInfo.gestationalAge}
- High Risk: ${medicalInfo.highRisk}
- Conditions: ${medicalInfo.conditions.length > 0 ? medicalInfo.conditions.join(', ') : 'None documented'}
- Allergies: ${medicalInfo.allergies.length > 0 ? medicalInfo.allergies.join(', ') : 'None documented'}`;

      // Add medical images with analysis if available
      if (medicalContext.medicalImages?.length > 0) {
        contextContent += '\n\nMEDICAL IMAGES:';
        
        medicalContext.medicalImages.forEach((img, index) => {
          contextContent += `\n\n[Image ${index + 1} - ${img.fileName}]`;
          contextContent += `\n- Uploaded: ${new Date(img.createdAt).toLocaleString()}`;
          if (img.uploader) {
            contextContent += `\n- Uploaded by: ${img.uploader.name || img.uploader.email}`;
          }
          if (img.analysisResult) {
            contextContent += `\n- Analysis (${img.analysisModel || 'Unknown model'} on ${img.analysisDate ? new Date(img.analysisDate).toLocaleDateString() : 'unknown date'}):`;
            contextContent += `\n  ${img.analysisResult.substring(0, 200)}${img.analysisResult.length > 200 ? '...' : ''}`;
            if (img.confidence) {
              contextContent += `\n  Confidence: ${(img.confidence * 100).toFixed(1)}%`;
            }
          } else {
            contextContent += '\n- No analysis available';
          }
        });
      }

      context.push({
        role: "system",
        content: contextContent
      });
    }

    // Add conversation history
    messages.forEach(msg => {
      context.push({
        role: msg.senderType === "guest" ? "user" : "assistant",
        content: msg.content
      });
    });

    // Add current message
    context.push({ role: "user", content: message });

    // Get AI response using Hugging Face model
    const completion = await hfClient.chat.completions.create({
      model: 'Intelligent-Internet/II-Medical-8B-1706',
      messages: context,
      temperature: 0.7,
      max_tokens: 1000
    });

    const response = completion.choices[0]?.message?.content;

    // Save to conversation memory
    if (response) {
      await db.conversationMemory.create({
        data: {
          roomId,
          key: `ai_response_${Date.now()}`,
          value: response,
        },
      });
    }

    return NextResponse.json({ response });

  } catch (error) {
    console.error("AI conversation error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}