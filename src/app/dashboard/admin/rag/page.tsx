'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { uploadFiles } from '@/lib/uploadthing'

type Source = { url: string; addedAt: string; fileId?: string | null; jobId?: string | null; stage?: string; progress?: number; updated?: string; fileName?: string }

function extractFileName(url: string): string {
  try {
    const urlObj = new URL(url)
    const pathname = urlObj.pathname
    const parts = pathname.split('/')
    const lastPart = parts[parts.length - 1]
    if (lastPart && lastPart.length > 0) {
      return decodeURIComponent(lastPart)
    }
  } catch {}
  return url.split('/').pop() || url
}

const LS_KEY = 'rag_sources_v1'

export default function DashboardRagIngestionPage() {
  const [files, setFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [ingesting, setIngesting] = useState(false)
  const [urls, setUrls] = useState<string>('')
  const [sources, setSources] = useState<Source[]>([])
  const [open, setOpen] = useState(false)

  // Load sources
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY)
      if (raw) setSources(JSON.parse(raw))
    } catch {}
  }, [])

  const saveSources = useCallback((next: Source[]) => {
    setSources(next)
    try { localStorage.setItem(LS_KEY, JSON.stringify(next)) } catch {}
  }, [])

  const fileInputs = useMemo(() => files.map((f) => f.name).join(', '), [files])

  const onSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const list = Array.from(e.target.files || [])
    setFiles(list)
  }, [])

  // Manual refresh of job statuses
  const refreshStatuses = useCallback(async () => {
    const withJobs = sources.filter(s => s.jobId)
    if (withJobs.length === 0) return
    try {
      const updated = await Promise.all(withJobs.map(async (s) => {
        try {
          const res = await fetch(`/api/admin/geneline/job?id=${encodeURIComponent(String(s.jobId))}`)
          if (!res.ok) return s
          const data = await res.json()
          return { 
            ...s, 
            fileId: data.fileId || s.fileId,
            stage: data.stage || s.stage, 
            progress: typeof data.progress === 'number' ? data.progress : s.progress, 
            updated: data.updated || s.updated 
          }
        } catch { return s }
      }))
      const merged = sources.map(s => {
        const nu = updated.find(u => u.url === s.url)
        return nu ? nu : s
      })
      saveSources(merged)
    } catch {}
  }, [sources, saveSources])

  const handleUploadThenIngest = useCallback(async () => {
    if (files.length === 0 && !urls.trim()) return
    try {
      setUploading(true)
      let uploadedUrls: string[] = []

      if (files.length > 0) {
        const res = await uploadFiles('documents', { files })
        uploadedUrls = res.map((r: any) => r.url).filter(Boolean)
      }

      const manualUrls = urls
        .split(/\n+/)
        .map((s) => s.trim())
        .filter(Boolean)
      const allUrls = Array.from(new Set([...uploadedUrls, ...manualUrls]))
      if (allUrls.length === 0) return

      setIngesting(true)
      const resp = await fetch('/api/admin/geneline/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: allUrls.map((u) => ({ url: u, filename: u.split('/').pop() || 'file' })) }),
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error || 'Failed to enqueue ingestion')
      const now = new Date().toISOString()
      const jobs = (data.jobs || []) as Array<{ jobId: string; url: string; fileId?: string }>
      // Merge into sources, attaching jobId and fileId by URL
      const byUrl = new Map(jobs.map(j => [j.url, { jobId: j.jobId, fileId: j.fileId }]))
      const next = [...sources]
      for (const u of allUrls) {
        const existing = next.find(s => s.url === u)
        const jobData = byUrl.get(u)
        const jobId = jobData?.jobId || null
        const fileId = jobData?.fileId || null
        const fileName = extractFileName(u)
        if (existing) {
          existing.jobId = jobId
          existing.fileId = fileId
          existing.addedAt = existing.addedAt || now
          existing.fileName = fileName
        } else {
          next.unshift({ url: u, addedAt: now, jobId, fileId, fileName })
        }
      }
      saveSources(next)
      setFiles([])
      setUrls('')
    } catch (e: any) {
      alert(e?.message || 'Upload/Ingestion failed')
    } finally {
      setUploading(false)
      setIngesting(false)
    }
  }, [files, urls, sources, saveSources])

  const onDelete = useCallback(async (source: Source) => {
    if (!confirm('Delete this source from the vector store?')) return
    
    // Prefer fileId, fallback to generating from URL
    const fileId = source.fileId || source.url
    
    if (!fileId) {
      alert('Cannot delete: missing fileId')
      return
    }
    
    try {
      const resp = await fetch('/api/admin/geneline/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId }),
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error || 'Delete failed')
      const next = sources.filter(s => s.url !== source.url)
      saveSources(next)
    } catch (e: any) {
      alert(e?.message || 'Delete failed')
    }
  }, [sources, saveSources])

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">RAG Sources</h1>
          <p className="text-sm text-gray-600 mt-1">Manage your knowledge base documents</p>
        </div>
        <button onClick={() => setOpen(true)} className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-5 py-2.5 rounded-lg font-medium hover:from-blue-700 hover:to-blue-800 transition-all shadow-sm">Add Sources</button>
      </div>

      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Data Sources</h2>
          <button onClick={refreshStatuses} className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium hover:bg-gray-50 transition-colors">Refresh Status</button>
        </div>
        <div className="space-y-3">
          {sources.length === 0 && <div className="text-sm text-gray-500 text-center py-8 border border-dashed rounded-lg">No sources tracked yet. Click "Add Sources" to get started.</div>}
          {sources.map((s) => (
            <div key={s.url} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow bg-white">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <div className="font-medium text-gray-900">{s.fileName || 'Document'}</div>
                  </div>
                  <div className="text-xs text-gray-500 font-mono break-all mb-2">{s.url}</div>
                  <div className="flex items-center gap-3 text-xs text-gray-600">
                    <span>Added {new Date(s.addedAt).toLocaleDateString()}</span>
                    {s.stage && <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">{s.stage}</span>}
                    {typeof s.progress === 'number' && <span className="font-medium">{s.progress}%</span>}
                  </div>
                </div>
                <button onClick={() => onDelete(s)} className="px-3 py-1.5 text-sm text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition-colors">Delete</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative bg-white w-full max-w-2xl rounded-xl shadow-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Add Sources</h2>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Upload PDF files</label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-blue-400 transition-colors">
                  <input type="file" accept="application/pdf" multiple onChange={onSelect} className="w-full" />
                  {fileInputs && <div className="text-xs text-gray-600 mt-2 font-medium">Selected: {fileInputs || 'none'}</div>}
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Or paste URLs (one per line)</label>
                <textarea value={urls} onChange={(e) => setUrls(e.target.value)} placeholder="https://example.com/doc.pdf\nhttps://cdn.site/file.txt" className="border border-gray-300 rounded-lg px-4 py-3 w-full h-32 focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button type="button" onClick={() => setOpen(false)} className="px-5 py-2.5 rounded-lg border border-gray-300 font-medium hover:bg-gray-50 transition-colors">Cancel</button>
                <button onClick={async () => { await handleUploadThenIngest(); setOpen(false); }} disabled={uploading || ingesting || (files.length === 0 && !urls.trim())} className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-5 py-2.5 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:from-blue-700 hover:to-blue-800 transition-all shadow-sm">
                  {uploading || ingesting ? 'Processing…' : 'Upload & Enqueue'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
