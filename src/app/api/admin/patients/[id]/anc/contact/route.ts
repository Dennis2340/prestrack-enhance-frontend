import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { ancContactSchema } from "@/lib/validation/anc";
import { LOINC, LOCAL, DANGER_SIGNS, UNITS } from "@/lib/fhir/codes";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const patientId = String((await params).id);
    const raw = await req.json().catch(() => ({}));
    const parsed = ancContactSchema.safeParse(raw);
    if (!parsed.success) return NextResponse.json({ error: "Invalid payload", issues: parsed.error.flatten() }, { status: 400 });
    const body = parsed.data as any;
    const dateStr: string | undefined = body.date;
    if (!dateStr) return NextResponse.json({ error: "date is required (YYYY-MM-DD)" }, { status: 400 });
    const date = new Date(dateStr);

    // Find active pregnancy
    const db = prisma as any;
    const pregn = await db.pregnancy.findFirst({ where: { patientId, isActive: true }, select: { id: true, lmp: true, edd: true } });
    if (!pregn) return NextResponse.json({ error: "No active pregnancy" }, { status: 400 });

    // Pre-validate vitals and first-contact requirements before creating encounter
    // Extract incoming observation shortcuts for validation
    const incomingObs: any[] = Array.isArray(body?.observations) ? body.observations : [];
    try {
      // Weight (LOINC 29463-7)
      const w = incomingObs.find((x:any)=> x.codeSystem === 'LOINC' && x.code === LOINC.BODY_WEIGHT)?.valueQuantity?.value;
      if (w != null) {
        const n = Number(w);
        if (!Number.isFinite(n) || n < 1 || n > 300) {
          return NextResponse.json({ error: 'Weight must be 1–300 kg.' }, { status: 400 });
        }
      }
      // Fundal height (custom)
      const fh = incomingObs.find((x:any)=> (x.codeSystem === 'custom' && x.code === 'fundal-height'))?.valueQuantity?.value;
      if (fh != null) {
        const n = Number(fh);
        if (!Number.isFinite(n) || n < 1 || n > 60) {
          return NextResponse.json({ error: 'Fundal height must be 1–60 cm.' }, { status: 400 });
        }
      }
      // FHR (custom)
      const fhrVal = incomingObs.find((x:any)=> (x.codeSystem === 'custom' && x.code === 'fhr'))?.valueQuantity?.value;
      if (fhrVal != null) {
        const n = Number(fhrVal);
        if (!Number.isFinite(n) || n < 60 || n > 220) {
          return NextResponse.json({ error: 'Fetal heart rate must be 60–220 bpm.' }, { status: 400 });
        }
      }
      // First contact baseline labs required
      const priorEncounters = await db.aNCEncounter.count({ where: { pregnancyId: pregn.id } });
      if (priorEncounters === 0) {
        const needHiv = !body.hivResult;
        const needSyph = !body.syphilisResult;
        const needHb = !(typeof body.hb === 'number');
        const needMrdt = !body.malariaRdt;
        if (needHiv || needSyph || needHb || needMrdt) {
          const missing: string[] = [];
          if (needHiv) missing.push('HIV result');
          if (needSyph) missing.push('Syphilis result');
          if (needHb) missing.push('Hemoglobin (Hb)');
          if (needMrdt) missing.push('Malaria RDT');
          return NextResponse.json({ error: `First ANC contact requires baseline labs/screens: ${missing.join(', ')}.` }, { status: 400 });
        }
      }
    } catch {}

    // Create encounter
    const enc = await db.aNCEncounter.create({ data: { pregnancyId: pregn.id, date } });

    // Observations
    const obs: any[] = incomingObs;
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

    // Standardize vitals if present in shorthand via incoming observations
    // BP as text (e.g., from UI) -> create systolic & diastolic LOINC if parseable
    try {
      const rawBp = (obs.find((x:any)=> x.code === LOCAL.BP || x.codeSystem === 'custom' && x.code === 'bp')?.valueCodeableConcept?.text || '').trim();
      const m = rawBp && rawBp.match(/^(\d{2,3})\s*\/\s*(\d{2,3})/);
      if (m) {
        const sys = Number(m[1]);
        const dia = Number(m[2]);
        if (Number.isFinite(sys) && Number.isFinite(dia)) {
          await db.aNCObservation.create({ data: { encounterId: enc.id, codeSystem: 'LOINC', code: LOINC.SYSTOLIC_BP, valueQuantity: { value: sys, unit: UNITS.MM_HG } } });
          await db.aNCObservation.create({ data: { encounterId: enc.id, codeSystem: 'LOINC', code: LOINC.DIASTOLIC_BP, valueQuantity: { value: dia, unit: UNITS.MM_HG } } });
        }
      }
    } catch {}

    // Fetal heart rate: if provided as quantity in custom, also store LOINC version
    try {
      const rawFhr = obs.find((x:any)=> x.code === LOCAL.FHR || (x.codeSystem === 'custom' && x.code === 'fhr'))?.valueQuantity?.value;
      if (typeof rawFhr === 'number' && Number.isFinite(rawFhr)) {
        await db.aNCObservation.create({ data: { encounterId: enc.id, codeSystem: 'LOINC', code: LOINC.HEART_RATE, valueQuantity: { value: rawFhr, unit: UNITS.BPM } } });
      }
    } catch {}

    // Interventions (with DAK-aligned checks)
    const interventions: any[] = Array.isArray(body?.interventions) ? body.interventions : [];
    for (const iv of interventions) {
      const ivDate = new Date(iv.date || dateStr);
      const type = String(iv.type || 'iptp');
      if (type === 'iptp') {
        // GA calculation (fallback to EDD if LMP missing)
        const lmp = pregn.lmp ? new Date(pregn.lmp) : null;
        const edd = pregn.edd ? new Date(pregn.edd) : null;
        const gaDays = lmp ? Math.floor((ivDate.getTime() - lmp.getTime())/(24*60*60*1000)) : (edd ? 280 - Math.floor((edd.getTime() - ivDate.getTime())/(24*60*60*1000)) : null);
        const gaWeeks = gaDays != null ? Math.floor(gaDays/7) : null;
        if (gaWeeks != null && gaWeeks < 13) {
          return NextResponse.json({ error: 'IPTp is recommended from ~13 weeks GA. Please schedule for later.' }, { status: 400 });
        }
        // Spacing: at least 28 days since last IPTp
        const lastIptp = await db.aNCIntervention.findFirst({ where: { pregnancyId: pregn.id, type: 'iptp' }, orderBy: { date: 'desc' }, select: { date: true } });
        if (lastIptp?.date) {
          const diffDays = Math.floor((ivDate.getTime() - new Date(lastIptp.date).getTime())/(24*60*60*1000));
          if (diffDays < 28) {
            return NextResponse.json({ error: 'IPTp doses should be spaced at least 4 weeks apart.' }, { status: 400 });
          }
        }
      }
      if (type !== 'iptp') {
        // future: add rules for iron_folate, calcium, deworming if needed
      }
      await db.aNCIntervention.create({ data: {
        pregnancyId: pregn.id,
        type,
        date: ivDate,
        medicationCode: iv.medicationCode || undefined,
        medicationSystem: iv.medicationSystem || undefined,
        doseText: iv.doseText || undefined,
      }});
    }

    // Immunizations (TT) with spacing check
    const immunizations: any[] = Array.isArray(body?.immunizations) ? body.immunizations : [];
    for (const im of immunizations) {
      const vaxCode = String(im.vaccineCode || 'TT');
      const when = new Date(im.occurrenceDateTime || dateStr);
      if (vaxCode === 'TT') {
        const lastTt = await db.immunization.findFirst({ where: { patientId, vaccineCode: 'TT' }, orderBy: { occurrenceDateTime: 'desc' }, select: { occurrenceDateTime: true } });
        if (lastTt?.occurrenceDateTime) {
          const diffDays = Math.floor((when.getTime() - new Date(lastTt.occurrenceDateTime).getTime())/(24*60*60*1000));
          if (diffDays < 28) {
            return NextResponse.json({ error: 'TT doses should be spaced at least 4 weeks apart.' }, { status: 400 });
          }
        }
      }
      await db.immunization.create({ data: {
        patientId,
        vaccineCode: vaxCode,
        vaccineSystem: String(im.vaccineSystem || 'local'),
        occurrenceDateTime: when,
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
