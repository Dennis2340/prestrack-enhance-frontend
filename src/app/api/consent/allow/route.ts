import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const token = searchParams.get('token') || ''
    if (!token) {
      return new Response(`<html><body><h3>Invalid link</h3></body></html>`, { headers: { 'Content-Type': 'text/html' }, status: 400 })
    }

    const doc = await prisma.document.findFirst({ where: { typeCode: 'consent_access', hash: token } })
    if (!doc) {
      return new Response(`<html><body><h3>Consent request not found or expired.</h3></body></html>`, { headers: { 'Content-Type': 'text/html' }, status: 404 })
    }

    await prisma.document.update({ where: { id: doc.id }, data: { title: 'Provider Consent Granted', metadata: { ...(doc.metadata as any), granted: true } } })

    return new Response(`<html><body style="font-family:sans-serif"><h2>Consent Granted</h2><p>Thank you. Your care provider can now access your information for this session.</p></body></html>`, { headers: { 'Content-Type': 'text/html' } })
  } catch (e: any) {
    return new Response(`<html><body><h3>${(e?.message || 'Error')}</h3></body></html>`, { headers: { 'Content-Type': 'text/html' }, status: 500 })
  }
}
