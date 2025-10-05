import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { toFhirObservation } from "@/lib/fhir/map";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const patientId = String((await params).id);
    const p = await prisma.patient.findUnique({ where: { id: patientId }, select: { id: true, firstName: true, lastName: true } });
    if (!p) return NextResponse.json({ error: "Patient not found" }, { status: 404 });

    const obs = await (prisma as any).aNCObservation.findMany({
      where: { encounter: { pregnancy: { patientId } } },
      orderBy: { createdAt: "asc" },
      include: { encounter: true },
    });

    const resources = obs.map((o: any) => toFhirObservation(o, p as any, o.encounter));
    return NextResponse.json(resources);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "failed" }, { status: 500 });
  }
}
