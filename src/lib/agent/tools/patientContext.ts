import prisma from '@/lib/prisma'

export type PatientContext = {
  patientId: string
  name: string | null
  prescriptions: Array<{
    id: string
    medicationName: string
    strength?: string | null
    form?: string | null
    startDate?: string | null
    endDate?: string | null
    status?: string | null
  }>
  upcomingReminders: Array<{
    id: string
    when: string
    status: string
    medicationName?: string | null
  }>
  pregnancy?: {
    lmp?: string | null
    edd?: string | null
    gaWeeks?: number | null
    lastContactDate?: string | null
    lastIptpDate?: string | null
    lastTtDate?: string | null
    lastVitals?: {
      bp?: string | null
      weightKg?: number | null
      fundalHeightCm?: number | null
      fhrBpm?: number | null
    } | null
  } | null
}

// Simple in-memory cache (per process)
const CACHE = new Map<string, { at: number; data: PatientContext | null }>()
const TTL_MS = 2 * 60 * 1000 // 2 minutes

export async function fetchPatientContextByPhone(phoneE164: string): Promise<PatientContext | null> {
  const key = `pc:${phoneE164}`
  const hit = CACHE.get(key)
  const now = Date.now()
  if (hit && now - hit.at < TTL_MS) return hit.data

  try {
    // Resolve patient by WhatsApp contact channel
    const cc = await prisma.contactChannel.findFirst({
      where: { type: 'whatsapp', value: phoneE164, patientId: { not: null } },
      select: { patientId: true, patient: { select: { id: true, firstName: true, lastName: true } } } as any,
    })
    const patientId = (cc as any)?.patientId as string | undefined
    const patient = (cc as any)?.patient as { id: string; firstName: string | null; lastName: string | null } | undefined
    if (!patientId) { CACHE.set(key, { at: now, data: null }); return null }

    // Prescriptions
    const rx = await prisma.prescription.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        medicationName: true,
        strength: true,
        form: true,
        startDate: true,
        endDate: true,
        status: true,
      }
    })

    // Upcoming medication reminders
    const nowDate = new Date()
    const reminders = await prisma.task.findMany({
      where: { type: 'medication_reminder' as any, patientId, scheduledTime: { gte: nowDate }, status: { in: ['pending','sent'] as any } },
      orderBy: { scheduledTime: 'asc' },
      take: 10,
      select: { id: true, scheduledTime: true, status: true, prescription: { select: { medicationName: true } } },
    })

    // Pregnancy summary (if any)
    let pregBlock: PatientContext['pregnancy'] = null
    try {
      const db = prisma as any
      const pregnancy = await db.pregnancy.findFirst({
        where: { patientId, isActive: true },
        select: { id: true, lmp: true, edd: true },
      })
      if (pregnancy) {
        // Last ANC encounter
        const lastEnc = await db.aNCEncounter.findFirst({
          where: { pregnancyId: pregnancy.id },
          orderBy: { date: 'desc' },
          select: { id: true, date: true },
        }) as any
        // Last IPTp intervention
        const lastIptp = await db.aNCIntervention.findFirst({
          where: { pregnancyId: pregnancy.id, type: 'iptp' as any },
          orderBy: { date: 'desc' },
          select: { date: true },
        }) as any
        // Last TT immunization
        const lastTt = await db.immunization.findFirst({
          where: { patientId, vaccineCode: 'TT' },
          orderBy: { occurrenceDateTime: 'desc' },
          select: { occurrenceDateTime: true },
        }) as any
        // Latest vitals from latest encounter
        let lastVitals: { bp?: string|null; weightKg?: number|null; fundalHeightCm?: number|null; fhrBpm?: number|null } | null = null
        if (lastEnc?.id) {
          const obs = await db.aNCObservation.findMany({
            where: { encounterId: lastEnc.id },
            select: { codeSystem: true, code: true, valueQuantity: true, valueCodeableConcept: true },
          })
          const getNum = (o:any) => typeof o?.valueQuantity?.value === 'number' ? o.valueQuantity.value : null
          const byCode = (code:string) => obs.find(o=> o.code === code)
          const bpObs = obs.find(o=> o.code === 'bp')
          const wtObs = byCode('29463-7')
          const fhObs = byCode('fundal-height')
          const fhrObs = byCode('fhr')
          lastVitals = {
            bp: (bpObs?.valueCodeableConcept as any)?.text || null,
            weightKg: getNum(wtObs),
            fundalHeightCm: getNum(fhObs),
            fhrBpm: getNum(fhrObs),
          }
        }
        // GA weeks from LMP
        let gaWeeks: number | null = null
        if (pregnancy.lmp) {
          const ms = Date.now() - new Date(pregnancy.lmp as any).getTime()
          gaWeeks = Math.max(0, Math.round(ms / (7 * 24 * 60 * 60 * 1000)))
        }
        pregBlock = {
          lmp: pregnancy.lmp ? new Date(pregnancy.lmp as any).toISOString() : null,
          edd: pregnancy.edd ? new Date(pregnancy.edd as any).toISOString() : null,
          gaWeeks,
          lastContactDate: lastEnc?.date ? new Date(lastEnc.date).toISOString() : null,
          lastIptpDate: lastIptp?.date ? new Date(lastIptp.date).toISOString() : null,
          lastTtDate: lastTt?.occurrenceDateTime ? new Date(lastTt.occurrenceDateTime).toISOString() : null,
          lastVitals,
        }
      }
    } catch {}

    const data: PatientContext = {
      patientId,
      name: [patient?.firstName, patient?.lastName].filter(Boolean).join(' ') || null,
      prescriptions: rx.map(r => ({
        id: r.id,
        medicationName: r.medicationName,
        strength: r.strength ?? null,
        form: r.form ?? null,
        startDate: r.startDate ? r.startDate.toISOString() : null,
        endDate: r.endDate ? r.endDate.toISOString() : null,
        status: r.status ?? null,
      })),
      upcomingReminders: reminders.map(u => ({
        id: u.id,
        when: u.scheduledTime.toISOString(),
        status: u.status as any,
        medicationName: (u as any)?.prescription?.medicationName ?? null,
      })),
      pregnancy: pregBlock,
    }

    CACHE.set(key, { at: now, data })
    return data
  } catch (e) {
    // On any error, avoid crashing the agent; fall back to null
    CACHE.set(key, { at: now, data: null })
    return null
  }
}
