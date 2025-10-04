"use client"

import { useCallback, useEffect, useMemo, useState } from 'react'
import { uploadFiles } from '@/lib/uploadthing'

type Source = { url: string; addedAt: string; fileId?: string | null; jobId?: string | null; stage?: string; progress?: number; updated?: string }

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
          return { ...s, stage: data.stage || s.stage, progress: typeof data.progress === 'number' ? data.progress : s.progress, updated: data.updated || s.updated }
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
      const jobs = (data.jobs || []) as Array<{ jobId: string; url: string }>
      // Merge into sources, attaching jobId by URL
      const byUrl = new Map(jobs.map(j => [j.url, j.jobId]))
      const next = [...sources]
      for (const u of allUrls) {
        const existing = next.find(s => s.url === u)
        const jobId = byUrl.get(u) || null
        if (existing) {
          existing.jobId = jobId
          existing.addedAt = existing.addedAt || now
        } else {
          next.unshift({ url: u, addedAt: now, jobId })
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

  const onDelete = useCallback(async (url: string) => {
    if (!confirm('Delete this source from the vector store?')) return
    try {
      const resp = await fetch('/api/admin/geneline/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error || 'Delete failed')
      const next = sources.filter(s => s.url !== url)
      saveSources(next)
    } catch (e: any) {
      alert(e?.message || 'Delete failed')
    }
  }, [sources, saveSources])

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-semibold">RAG Sources</h1>
        <button onClick={() => setOpen(true)} className="bg-blue-600 text-white px-4 py-2 rounded">Add Sources</button>
      </div>
      <p className="text-sm text-gray-600 mb-4">Manage your data sources. Add new PDFs via UploadThing or paste URLs. We enqueue ingestion and show status.</p>

      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-2">Data Sources</h2>
        <div className="mb-2">
          <button onClick={refreshStatuses} className="px-3 py-1.5 rounded border text-sm">Refresh Status</button>
        </div>
        <div className="space-y-2">
          {sources.length === 0 && <div className="text-sm text-gray-500">No sources tracked yet.</div>}
          {sources.map((s) => (
            <div key={s.url} className="border rounded p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <div className="text-sm font-mono break-all">{s.url}</div>
                <div className="text-xs text-gray-600">Added {new Date(s.addedAt).toLocaleString()} {s.stage ? `• ${s.stage}` : ''} {typeof s.progress === 'number' ? `• ${s.progress}%` : ''}</div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => onDelete(s.url)} className="text-red-600 text-sm hover:underline">Delete</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="relative bg-white w-full max-w-2xl rounded shadow-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold">Add Sources</h2>
              <button onClick={() => setOpen(false)} className="text-gray-500">✕</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Upload PDF files</label>
                <input type="file" accept="application/pdf" multiple onChange={onSelect} />
                {fileInputs && <div className="text-xs text-gray-500 mt-1">Selected: {fileInputs || 'none'}</div>}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Or paste URLs (one per line)</label>
                <textarea value={urls} onChange={(e) => setUrls(e.target.value)} placeholder="https://example.com/doc.pdf\nhttps://cdn.site/file.txt" className="border rounded px-3 py-2 w-full h-32" />
              </div>
              <div className="flex items-center justify-end gap-2">
                <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 rounded border">Cancel</button>
                <button onClick={async () => { await handleUploadThenIngest(); setOpen(false); }} disabled={uploading || ingesting || (files.length === 0 && !urls.trim())} className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50">
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
