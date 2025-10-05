import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// Returns a lightweight audit view for a patient: recent CommMessages and escalation Documents
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const patientId = String((await params).id);
    const url = new URL(req.url);
    const limit = Math.max(1, Math.min(200, Number(url.searchParams.get("limit") || 50)));

    const patient = await prisma.patient.findUnique({ where: { id: patientId }, select: { id: true } });
    if (!patient) return NextResponse.json({ error: "Patient not found" }, { status: 404 });

    // Get latest conversation for patient and recent messages
    const convo = await prisma.conversation.findFirst({
      where: { subjectType: "patient" as any, patientId },
      orderBy: { updatedAt: "desc" },
      select: { id: true },
    });

    const messages = convo
      ? await prisma.commMessage.findMany({
          where: { conversationId: convo.id },
          orderBy: { createdAt: "desc" },
          take: limit,
          select: {
            id: true,
            createdAt: true,
            direction: true,
            via: true,
            body: true,
            senderType: true,
            senderId: true,
            meta: true,
          },
        })
      : [];

    // Escalation documents for the patient (agent-created or otherwise)
    const escalations = await prisma.document.findMany({
      where: { patientId, typeCode: "medical_escalation" },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        createdAt: true,
        updatedAt: true,
        title: true,
        typeCode: true,
        metadata: true,
      },
    });

    return NextResponse.json({
      conversationId: convo?.id ?? null,
      messages,
      escalations,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "failed" }, { status: 500 });
  }
}
