// src/app/api/rooms/[roomId]/ai/analyze-image/route.ts
import { NextResponse } from "next/server";
import { db } from "@/db";
import { OpenAI } from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params;
    const { fileUrl, fileName } = await request.json();

    if (!fileUrl) {
      return NextResponse.json(
        { error: "No file URL provided" }, 
        { status: 400 }
      );
    }

    // Verify room exists
    const room = await db.room.findUnique({
      where: { 
        id: roomId,
        business: {
          id: process.env.NEXT_PUBLIC_BUSINESS_ID
        }
      },
      include: { 
        guest: {
          include: {
            medicalContext: true
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

    // Ensure medical context exists
    let medicalContext = room.guest.medicalContext;
    if (!medicalContext) {
      medicalContext = await db.medicalContext.create({
        data: {
          guestId: room.guest.id,
          bloodType: "Unknown",
          allergies: [],
          medications: [],
          conditions: []
        }
      });
    }

    // Analyze image with OpenAI
    const imageAnalysis = await analyzeMedicalImage(fileUrl);

    console.log("Image analysis:", imageAnalysis);
    // Create the medical image record
    const medicalImage = await db.medicalImage.create({
      data: {
        guestId: room.guest.id,
        medicalContextId: medicalContext.id,
        url: fileUrl,
        fileName: fileName,
        fileType: 'image/' + (fileUrl.split('.').pop()?.toLowerCase() || 'jpeg'),
        analysisModel: 'gpt-4o',
        analysisResult: imageAnalysis,
        confidence: 0.9,
      },
    });

    return NextResponse.json({
      success: true,
      image: medicalImage,
    });

  } catch (error) {
    console.error("Image analysis error:", error);
    return NextResponse.json(
      { error: "Failed to process image: " + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    );
  }
}

async function analyzeMedicalImage(imageUrl: string): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Provide a purely anatomical description of the structures visible in this image—list bones, organs, modality type, and any notable texture or contrast variations, without any diagnostic or advisory language.`
            },
            {
              type: "image_url",
              image_url: { url: imageUrl, detail: "high" }
            }
          ]
        }
      ],
      max_tokens: 2000,
    });

    return response.choices[0]?.message?.content || 'No analysis available';
  } catch (error) {
    console.error("Error analyzing image:", error);
    throw new Error("Failed to analyze image with OpenAI");
  }
}