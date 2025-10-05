import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { toFhirEncounter } from "@/lib/fhir/map";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const patientId = String((await params).id);
    const url = new URL(req.url);
    const limit = Math.max(1, Math.min(500, Number(url.searchParams.get('limit') || 200)));
    const p = await prisma.patient.findUnique({ where: { id: patientId }, select: { id: true, firstName: true, lastName: true } });
    if (!p) return NextResponse.json({ error: "Patient not found" }, { status: 404 });

    // Find active pregnancy (optional; export all ANC encounters for patient across pregnancies)
    const encs = await (prisma as any).aNCEncounter.findMany({
      where: { pregnancy: { patientId } },
      orderBy: { date: "asc" },
      take: limit,
    });

    const resources = encs.map((e: any) => toFhirEncounter(e, p as any));
    return NextResponse.json(resources);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "failed" }, { status: 500 });
  }
}
