import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { toFhirEncounter, toFhirImmunization, toFhirObservation } from "@/lib/fhir/map";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const patientId = String((await params).id);
    const p = await prisma.patient.findUnique({ where: { id: patientId }, select: { id: true, firstName: true, lastName: true } });
    if (!p) return NextResponse.json({ error: "Patient not found" }, { status: 404 });

    const encs = await (prisma as any).aNCEncounter.findMany({ where: { pregnancy: { patientId } }, orderBy: { date: "asc" } });
    const obs = await (prisma as any).aNCObservation.findMany({ where: { encounter: { pregnancy: { patientId } } }, orderBy: { createdAt: "asc" }, include: { encounter: true } });
    const ims = await (prisma as any).immunization.findMany({ where: { patientId }, orderBy: { occurrenceDateTime: "asc" } });

    const encounterResources = encs.map((e: any) => toFhirEncounter(e, p as any));
    const observationResources = obs.map((o: any) => toFhirObservation(o, p as any, o.encounter));
    const immunizationResources = ims.map((im: any) => toFhirImmunization(im, p as any));

    const entries = [
      ...encounterResources,
      ...observationResources,
      ...immunizationResources,
    ].map((res: any) => ({ resource: res }));

    const bundle = {
      resourceType: "Bundle",
      type: "collection",
      total: entries.length,
      entry: entries,
    };

    return NextResponse.json(bundle);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "failed" }, { status: 500 });
  }
}
