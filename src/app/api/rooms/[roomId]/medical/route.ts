import { NextResponse } from "next/server";
import { db } from "@/db";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import { BUSINESS_CONFIG } from "../../../../../../config";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  // Your existing POST handler (unchanged)
  try {
    const { roomId } = await params;
    const { searchParams } = new URL(request.url);

    if (!roomId || !BUSINESS_CONFIG.businessId) {
      return NextResponse.json(
        { error: "Room ID and Business ID are required" },
        { status: 400 }
      );
    }

    const data = await request.json();
    const {
      pregnancyStatus = "",
      gestationalAge = null,
      dueDate = null,
      highRisk = false,
      conditions = {},
      medications = {},
      allergies = {},
      vitalSigns = null,
      fhirPatientId = null,
      fhirReferences = null,
      bloodType = "",
    } = data;

    const room = await db.room.findUnique({
      where: { id: roomId },
      select: { guestId: true },
    });

    if (!room?.guestId) {
      return NextResponse.json(
        { error: "No guest found in this room" },
        { status: 404 }
      );
    }

    const medicalContext = await db.medicalContext.upsert({
      where: { guestId: room.guestId },
      update: { pregnancyStatus, gestationalAge, dueDate, highRisk, conditions, medications, allergies, vitalSigns, fhirPatientId, fhirReferences, bloodType },
      create: { guestId: room.guestId, pregnancyStatus, gestationalAge, dueDate, highRisk, conditions, medications, allergies, vitalSigns, fhirPatientId, fhirReferences, bloodType },
    });

    return NextResponse.json({ medicalContext });
  } catch (error) {
    console.error("Medical context error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { roomId: string } }
) {
  // Your existing PUT handler (unchanged)
  try {
    const { roomId } = params;
    

    if (!roomId || !BUSINESS_CONFIG.businessId) {
      return NextResponse.json(
        { error: "Room ID and Business ID are required" },
        { status: 400 }
      );
    }

    const data = await request.json();
    const {
      pregnancyStatus = "",
      gestationalAge = null,
      dueDate = null,
      highRisk = false,
      conditions = {},
      medications = {},
      allergies = {},
      vitalSigns = null,
      fhirPatientId = null,
      fhirReferences = null,
      bloodType = "",
    } = data;

    const room = await db.room.findUnique({
      where: { id: roomId },
      select: { guestId: true },
    });

    if (!room?.guestId) {
      return NextResponse.json(
        { error: "No guest found in this room" },
        { status: 404 }
      );
    }

    const medicalContext = await db.medicalContext.update({
      where: { guestId: room.guestId },
      data: { pregnancyStatus, gestationalAge, dueDate, highRisk, conditions, medications, allergies, vitalSigns, fhirPatientId, fhirReferences, bloodType },
    });

    return NextResponse.json({ medicalContext });
  } catch (error) {
    console.error("Medical context error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function GET(
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

    const room = await db.room.findUnique({
      where: { id: roomId },
      select: { guestId: true },
    });

    if (!room?.guestId) {
      return NextResponse.json(
        { error: "No guest found in this room" },
        { status: 404 }
      );
    }

    const medicalContext = await db.medicalContext.findUnique({
      where: { guestId: room.guestId },
    });

    if (!medicalContext) {
      return NextResponse.json(
        { error: "No medical context found for this guest" },
        { status: 404 }
      );
    }

    return NextResponse.json(medicalContext);
  } catch (error) {
    console.error("Error fetching medical context:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}