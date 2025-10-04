import { NextResponse } from 'next/server'
import { invitePatient } from '@/lib/invite'

export async function POST(req: Request) {
  try {
    const { phoneE164, firstName, lastName, name, message, dateOfBirth, sex, externalId, identifiers, address } = await req.json().catch(() => ({}))
    if (!phoneE164 || !/^\+\d{6,15}$/.test(phoneE164)) {
      return NextResponse.json({ error: 'Invalid phoneE164 (E.164 required: +15551234567)' }, { status: 400 })
    }
    const res = await invitePatient({ phoneE164, firstName, lastName, name, message, dateOfBirth, sex, externalId, identifiers, address })
    return NextResponse.json({ status: 'ok', ...res })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 })
  }
}
