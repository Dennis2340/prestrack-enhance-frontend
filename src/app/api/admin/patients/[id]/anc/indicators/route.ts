import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { LOINC, LOCAL } from "@/lib/fhir/codes";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const patientId = String((await params).id);
    const db = prisma as any;
    const pregn = await db.pregnancy.findFirst({ where: { patientId, isActive: true }, select: { id: true, lmp: true, edd: true } });
    if (!pregn) return NextResponse.json({ items: null });

    // Encounters count
    const encountersCount = await db.aNCEncounter.count({ where: { pregnancyId: pregn.id } });

    // IPTp doses
    const iptpCount = await db.aNCIntervention.count({ where: { pregnancyId: pregn.id, type: 'iptp' } });
    const lastIptp = await db.aNCIntervention.findFirst({ where: { pregnancyId: pregn.id, type: 'iptp' }, orderBy: { date: 'desc' }, select: { date: true } });

    // TT doses (patient-level)
    const ttCount = await db.immunization.count({ where: { patientId, vaccineCode: 'TT' } });
    const lastTt = await db.immunization.findFirst({ where: { patientId, vaccineCode: 'TT' }, orderBy: { occurrenceDateTime: 'desc' }, select: { occurrenceDateTime: true } });

    // Last Hb
    const lastHbObs = await db.aNCObservation.findFirst({
      where: { codeSystem: 'LOINC', code: LOINC.HEMOGLOBIN, encounter: { pregnancyId: pregn.id } },
      orderBy: { createdAt: 'desc' },
      select: { valueQuantity: true, createdAt: true },
    });
    const lastHb = lastHbObs?.valueQuantity?.value ?? null;
    const lastHbAt = lastHbObs?.createdAt ? new Date(lastHbObs.createdAt).toISOString() : null;

    // Screening coverage (ever done in current pregnancy)
    const everHiv = !!(await db.aNCObservation.findFirst({ where: { codeSystem: 'local', code: LOCAL.HIV_RESULT, encounter: { pregnancyId: pregn.id } }, select: { id: true } }));
    const everSyphilis = !!(await db.aNCObservation.findFirst({ where: { codeSystem: 'local', code: LOCAL.SYPHILIS_RESULT, encounter: { pregnancyId: pregn.id } }, select: { id: true } }));
    const everMalaria = !!(await db.aNCObservation.findFirst({ where: { codeSystem: 'local', code: LOCAL.MALARIA_RDT, encounter: { pregnancyId: pregn.id } }, select: { id: true } }));

    return NextResponse.json({
      encountersCount,
      iptpCount,
      ttCount,
      lastHb,
      lastHbAt,
      lastIptpDate: lastIptp?.date ? new Date(lastIptp.date).toISOString() : null,
      lastTtDate: lastTt?.occurrenceDateTime ? new Date(lastTt.occurrenceDateTime).toISOString() : null,
      lmp: pregn.lmp ? new Date(pregn.lmp).toISOString() : null,
      edd: pregn.edd ? new Date(pregn.edd).toISOString() : null,
      screening: { hiv: everHiv, syphilis: everSyphilis, malariaRdt: everMalaria },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 400 });
  }
}
