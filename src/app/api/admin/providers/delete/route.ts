import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function POST(req: Request) {
  try {
    const { id } = await req.json().catch(() => ({})) as { id?: string }
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    // Delete provider profile first (if exists), then user
    try {
      await prisma.providerProfile.delete({ where: { userId: id } })
    } catch {}

    try {
      await prisma.user.delete({ where: { id } })
    } catch (e: any) {
      return NextResponse.json({ error: e?.message || 'Failed to delete user' }, { status: 409 })
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 })
  }
}
