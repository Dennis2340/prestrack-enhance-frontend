import { NextResponse } from 'next/server'
import { deleteFile } from '@/lib/geneline'

export async function POST(req: Request) {
  try {
    const { url, fileId, namespace } = await req.json().catch(() => ({}))
    if (!url && !fileId) return NextResponse.json({ error: 'url or fileId required' }, { status: 400 })
    const res = await deleteFile({ url, fileId, namespace: namespace || process.env.GENELINE_X_NAMESPACE })
    return NextResponse.json({ ok: true, result: res })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 })
  }
}
