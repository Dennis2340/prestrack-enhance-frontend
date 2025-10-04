import { NextResponse } from 'next/server'
import { enqueueIngestion } from '@/lib/geneline'

export async function POST(req: Request) {
  try {
    const { files, namespace } = await req.json()
    if (!Array.isArray(files) || files.length === 0) {
      return NextResponse.json({ error: 'files required' }, { status: 400 })
    }
    const ns = namespace || process.env.GENELINE_X_NAMESPACE || 'default'
    const jobs = await enqueueIngestion({ files, namespace: ns })
    return NextResponse.json(jobs)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 })
  }
}
