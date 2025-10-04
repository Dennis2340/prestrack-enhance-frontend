import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAuth } from '@/lib/withAuth'

export async function GET(req: NextRequest) {
  const auth = requireAuth(req)
  if ('cookies' in auth) return auth as any
  try {
    const [patients, conversations, tasks] = await Promise.all([
      prisma.patient.count(),
      prisma.conversation.count(),
      prisma.task.count(),
    ])
    const latestPrescriptions = await prisma.prescription.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, medicationName: true, createdAt: true, patient: { select: { id: true, firstName: true, lastName: true } } },
    })
    const upcomingReminders = await prisma.task.findMany({
      where: { type: 'medication_reminder' as any, scheduledTime: { gte: new Date() } },
      orderBy: { scheduledTime: 'asc' },
      take: 5,
      select: { id: true, scheduledTime: true, prescription: { select: { id: true, medicationName: true, patient: { select: { id: true, firstName: true, lastName: true } } } } },
    })
    return NextResponse.json({ patients, conversations, tasks, latestPrescriptions, upcomingReminders })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 })
  }
}
