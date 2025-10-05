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
    }

    CACHE.set(key, { at: now, data })
    return data
  } catch (e) {
    // On any error, avoid crashing the agent; fall back to null
    CACHE.set(key, { at: now, data: null })
    return null
  }
}
