import { NextResponse } from 'next/server'
import { deleteFile } from '@/lib/geneline'

export async function POST(req: Request) {
  try {
    const { fileId, namespace, indexName } = await req.json().catch(() => ({}))
    if (!fileId) {
      return NextResponse.json({ error: 'fileId required' }, { status: 400 })
    }
    const res = await deleteFile({ 
      fileId, 
      namespace: namespace || process.env.GENELINE_X_NAMESPACE,
      indexName: indexName || process.env.GENELINE_X_INDEX_NAME
    })
    return NextResponse.json({ ok: true, result: res })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 })
  }
}
