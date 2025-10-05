import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { LOINC } from "@/lib/fhir/codes";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const patientId = String((await params).id);
    const db = prisma as any;
    const pregn = await db.pregnancy.findFirst({ where: { patientId, isActive: true }, select: { id: true } });
    if (!pregn) return NextResponse.json({ items: null });

    // Encounters count
    const encountersCount = await db.aNCEncounter.count({ where: { pregnancyId: pregn.id } });

    // IPTp doses
    const iptpCount = await db.aNCIntervention.count({ where: { pregnancyId: pregn.id, type: 'iptp' } });

    // TT doses (patient-level)
    const ttCount = await prisma.immunization.count({ where: { patientId, vaccineCode: 'TT' } });

    // Last Hb
    const lastHbObs = await db.aNCObservation.findFirst({
      where: { codeSystem: 'LOINC', code: LOINC.HEMOGLOBIN, encounter: { pregnancyId: pregn.id } },
      orderBy: { createdAt: 'desc' },
      select: { valueQuantity: true, createdAt: true },
    });
    const lastHb = lastHbObs?.valueQuantity?.value ?? null;
    const lastHbAt = lastHbObs?.createdAt ? new Date(lastHbObs.createdAt).toISOString() : null;

    return NextResponse.json({
      encountersCount,
      iptpCount,
      ttCount,
      lastHb,
      lastHbAt,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 400 });
  }
}
