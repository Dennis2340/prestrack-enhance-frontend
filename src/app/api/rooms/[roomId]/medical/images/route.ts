// src/app/api/rooms/[roomId]/medical/images/route.ts
import { NextResponse } from "next/server";
import { db } from "@/db";
import { BUSINESS_CONFIG } from "../../../../../../../config";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params;

    // Verify room and get guest
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
                        id: true,
                        name: true,
                        email: true
                      }
                    }
                  },
                  orderBy: { createdAt: 'desc' }
                }
              }
            }
          }
        }
      }
    });

    if (!room?.guest) {
      return NextResponse.json(
        { error: 'No guest found in this room' }, 
        { status: 404 }
      );
    }

    // If no medical context exists, return empty array
    if (!room.guest.medicalContext) {
      return NextResponse.json({ images: [] });
    }

    // Format the response
    const images = room.guest.medicalContext.medicalImages.map(image => ({
      id: image.id,
      url: image.url,
      name: image.fileName,
      fileType: image.fileType,
      description: image.description,
      uploadedAt: image.createdAt,
      uploader: {
        id: image.uploaderId,
        name: image.uploader?.name || 'Unknown',
        email: image.uploader?.email || null
      },
      analysis: image.analysisResult ? {
        result: image.analysisResult,
        model: image.analysisModel || 'Unknown',
        confidence: image.confidence,
        analyzedAt: image.analysisDate
      } : null
    }));

    return NextResponse.json({ images });

  } catch (error) {
    console.error("Error fetching medical images:", error);
    return NextResponse.json(
      { error: "Failed to fetch medical images" },
      { status: 500 }
    );
  }
}