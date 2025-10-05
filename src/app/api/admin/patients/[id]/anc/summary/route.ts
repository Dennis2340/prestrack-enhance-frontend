import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { LOINC, LOCAL } from "@/lib/fhir/codes";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const patientId = String((await params).id);
    const db = prisma as any;

    const pregnancy = await db.pregnancy.findFirst({ where: { patientId, isActive: true }, select: { id: true } });
    if (!pregnancy) return NextResponse.json({ ok: true, indicators: null, latestEncounter: null });

    // Indicators similar to /indicators
    const encountersCount = await db.aNCEncounter.count({ where: { pregnancyId: pregnancy.id } });
    const iptpCount = await db.aNCIntervention.count({ where: { pregnancyId: pregnancy.id, type: 'iptp' } });
    const ttCount = await db.immunization.count({ where: { patientId, vaccineCode: 'TT' } });
    const lastHbObs = await db.aNCObservation.findFirst({
      where: { codeSystem: 'LOINC', code: LOINC.HEMOGLOBIN, encounter: { pregnancyId: pregnancy.id } },
      orderBy: { createdAt: 'desc' },
      select: { valueQuantity: true, createdAt: true },
    });

    // Latest encounter with details
    const latestEncounter = await db.aNCEncounter.findFirst({
      where: { pregnancyId: pregnancy.id },
      orderBy: { date: 'desc' },
      select: { id: true, date: true },
    });

    let observations: any[] = [];
    let interventions: any[] = [];
    let immunizations: any[] = [];

    if (latestEncounter) {
      observations = await db.aNCObservation.findMany({
        where: { encounterId: latestEncounter.id },
        orderBy: { createdAt: 'asc' },
        select: { codeSystem: true, code: true, valueQuantity: true, valueCodeableConcept: true, note: true, createdAt: true },
      });
      interventions = await db.aNCIntervention.findMany({
        where: { pregnancyId: pregnancy.id },
        orderBy: { date: 'desc' },
        take: 10,
        select: { type: true, date: true, medicationCode: true, medicationSystem: true, doseText: true },
      });
      immunizations = await db.immunization.findMany({
        where: { patientId },
        orderBy: { occurrenceDateTime: 'desc' },
        take: 10,
        select: { vaccineCode: true, vaccineSystem: true, occurrenceDateTime: true, lotNumber: true },
      });
    }

    return NextResponse.json({
      ok: true,
      indicators: {
        encountersCount,
        iptpCount,
        ttCount,
        lastHb: lastHbObs?.valueQuantity?.value ?? null,
        lastHbAt: lastHbObs?.createdAt ?? null,
      },
      latestEncounter: latestEncounter ? {
        id: latestEncounter.id,
        date: latestEncounter.date,
        observations,
        interventions,
        immunizations,
      } : null,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Failed' }, { status: 400 });
  }
}
