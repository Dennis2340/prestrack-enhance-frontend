import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { toFhirImmunization } from "@/lib/fhir/map";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const patientId = String((await params).id);
    const p = await prisma.patient.findUnique({ where: { id: patientId }, select: { id: true, firstName: true, lastName: true } });
    if (!p) return NextResponse.json({ error: "Patient not found" }, { status: 404 });

    const ims = await (prisma as any).immunization.findMany({ where: { patientId }, orderBy: { occurrenceDateTime: "asc" } });
    const resources = ims.map((im) => toFhirImmunization(im as any, p as any));
    return NextResponse.json(resources);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "failed" }, { status: 500 });
  }
}
