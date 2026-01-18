import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const { firstName, lastName } = await req.json().catch(() => ({}))
    const patientId = params.id
    
    if (!patientId) {
      return NextResponse.json({ error: 'Patient ID required' }, { status: 400 })
    }

    const updated = await prisma.patient.update({
      where: { id: patientId },
      data: {
        ...(firstName !== undefined ? { firstName } : {}),
        ...(lastName !== undefined ? { lastName } : {}),
      },
    })

    return NextResponse.json({ status: 'ok', patient: updated })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to update patient' }, { status: 500 })
  }
}
