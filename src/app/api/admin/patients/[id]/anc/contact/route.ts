import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { ancContactSchema } from "@/lib/validation/anc";
import { LOINC, LOCAL, DANGER_SIGNS } from "@/lib/fhir/codes";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const patientId = String(params.id);
    const raw = await req.json().catch(() => ({}));
    const parsed = ancContactSchema.safeParse(raw);
    if (!parsed.success) return NextResponse.json({ error: "Invalid payload", issues: parsed.error.flatten() }, { status: 400 });
    const body = parsed.data as any;
    const dateStr: string | undefined = body.date;
    if (!dateStr) return NextResponse.json({ error: "date is required (YYYY-MM-DD)" }, { status: 400 });
    const date = new Date(dateStr);

    // Find active pregnancy
    const db = prisma as any;
    const pregn = await db.pregnancy.findFirst({ where: { patientId, isActive: true }, select: { id: true } });
    if (!pregn) return NextResponse.json({ error: "No active pregnancy" }, { status: 400 });

    // Create encounter
    const enc = await db.aNCEncounter.create({ data: { pregnancyId: pregn.id, date } });

    // Observations
    const obs: any[] = Array.isArray(body?.observations) ? body.observations : [];
    for (const o of obs) {
      await db.aNCObservation.create({ data: {
        encounterId: enc.id,
        codeSystem: String(o.codeSystem || 'local'),
        code: String(o.code || 'unknown'),
        valueQuantity: o.valueQuantity ? o.valueQuantity : undefined,
        valueCodeableConcept: o.valueCodeableConcept ? o.valueCodeableConcept : undefined,
        note: o.note ? String(o.note) : undefined,
      }});
    }

    // Labs/screens -> create observations from shorthand fields if present
    if (body.hivResult) {
      await db.aNCObservation.create({ data: { encounterId: enc.id, codeSystem: 'local', code: LOCAL.HIV_RESULT, valueCodeableConcept: { text: String(body.hivResult) } } });
    }
    if (body.syphilisResult) {
      await db.aNCObservation.create({ data: { encounterId: enc.id, codeSystem: 'local', code: LOCAL.SYPHILIS_RESULT, valueCodeableConcept: { text: String(body.syphilisResult) } } });
    }
    if (typeof body.hb === 'number') {
      await db.aNCObservation.create({ data: { encounterId: enc.id, codeSystem: 'LOINC', code: LOINC.HEMOGLOBIN, valueQuantity: { value: body.hb, unit: 'g/dL' } } });
    }
    if (body.malariaRdt) {
      await db.aNCObservation.create({ data: { encounterId: enc.id, codeSystem: 'local', code: LOCAL.MALARIA_RDT, valueCodeableConcept: { text: String(body.malariaRdt) } } });
    }

    // Interventions
    const interventions: any[] = Array.isArray(body?.interventions) ? body.interventions : [];
    for (const iv of interventions) {
      await db.aNCIntervention.create({ data: {
        pregnancyId: pregn.id,
        type: String(iv.type || 'iptp'),
        date: new Date(iv.date || dateStr),
        medicationCode: iv.medicationCode || undefined,
        medicationSystem: iv.medicationSystem || undefined,
        doseText: iv.doseText || undefined,
      }});
    }

    // Immunizations (TT)
    const immunizations: any[] = Array.isArray(body?.immunizations) ? body.immunizations : [];
    for (const im of immunizations) {
      await db.immunization.create({ data: {
        patientId,
        vaccineCode: String(im.vaccineCode || 'TT'),
        vaccineSystem: String(im.vaccineSystem || 'local'),
        occurrenceDateTime: new Date(im.occurrenceDateTime || dateStr),
        lotNumber: im.lotNumber || undefined,
      }});
    }

    // Danger signs -> escalate and schedule next visit
    const danger: string[] = Array.isArray(body?.dangerSigns) ? body.dangerSigns : [];
    const hasDanger = danger.some((k) => (DANGER_SIGNS as readonly string[]).includes(String(k)));
    if (hasDanger) {
      try {
        await prisma.escalation.create({ data: { patientId, reason: 'anc_danger_signs', summary: danger.join(', '), meta: { encounterId: enc.id } as any } as any });
      } catch {}
    }
    // Schedule next visit task in 7 days
    try {
      const when = new Date(date.getTime() + 7 * 24 * 60 * 60 * 1000);
      await prisma.task.create({ data: { subjectType: 'patient' as any, patientId, type: 'visit' as any, status: 'pending' as any, scheduledTime: when, notes: 'Next ANC contact', metadata: { encounterId: enc.id } as any } as any });
    } catch {}

    return NextResponse.json({ ok: true, encounterId: enc.id });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed" }, { status: 400 });
  }
}
