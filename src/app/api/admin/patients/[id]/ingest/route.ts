import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { enqueueIngestion } from '@/lib/geneline'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const id = params.id
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const { files } = await req.json().catch(() => ({})) as { files?: Array<{ url: string; filename?: string; mime?: string }> }
    if (!Array.isArray(files) || files.length === 0) {
      return NextResponse.json({ error: 'files required' }, { status: 400 })
    }

    // Find patient's WhatsApp phone for metadata filtering
    const wa = await prisma.contactChannel.findFirst({ where: { patientId: id, type: 'whatsapp' } })
    const phoneE164 = wa?.value
    if (!phoneE164) return NextResponse.json({ error: 'patient has no WhatsApp contact' }, { status: 400 })

    const namespace = process.env.GENELINE_X_NAMESPACE || 'default'

    const jobs = await enqueueIngestion({
      namespace,
      files: files.map((f) => ({
        url: f.url,
        filename: f.filename || f.url.split('/').pop() || 'file',
        mime: f.mime,
        metadata: {
          patientPhoneE164: phoneE164,
          subjectType: 'patient',
          patientId: id,
        },
      })),
    })

    return NextResponse.json(jobs)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 })
  }
}
