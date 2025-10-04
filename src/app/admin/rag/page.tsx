"use client"

import { useCallback, useEffect, useMemo, useState } from 'react'

type FileInput = { url: string; filename: string; mime?: string; metadata?: Record<string, any> }

type Job = { jobId: string; message?: string; progress?: number; stage?: string; total?: number; updated?: string }

export default function RagAdminPage() {
  const [namespace, setNamespace] = useState<string>(process.env.NEXT_PUBLIC_GENELINE_NAMESPACE || '')
  const [urls, setUrls] = useState<string>('')
  const [jobs, setJobs] = useState<Job[]>([])
  const [submitting, setSubmitting] = useState(false)

  const files = useMemo<FileInput[]>(() => {
    return urls
      .split(/\n+/)
      .map(s => s.trim())
      .filter(Boolean)
      .map((u) => ({ url: u, filename: u.split('/').pop() || 'file' }))
  }, [urls])

  const enqueue = useCallback(async () => {
    setSubmitting(true)
    try {
      const res = await fetch('/api/admin/geneline/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files, namespace: namespace || undefined }),
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      const newJobs: Job[] = (data.jobs || []).map((j: any) => ({ jobId: j.jobId }))
      setJobs(prev => [...newJobs, ...prev])
      setUrls('')
    } catch (e: any) {
      alert(e?.message || 'Failed to enqueue ingestion')
    } finally {
      setSubmitting(false)
    }
  }, [files, namespace])

  useEffect(() => {
    let timer: any
    const poll = async () => {
      try {
        const updated = await Promise.all(jobs.map(async (j) => {
          const res = await fetch(`/api/admin/geneline/job?id=${encodeURIComponent(j.jobId)}`)
          if (!res.ok) return j
          const data = await res.json()
          return { ...j, ...data }
        }))
        setJobs(updated)
      } catch {}
      timer = setTimeout(poll, 4000)
    }
    if (jobs.length) poll()
    return () => { if (timer) clearTimeout(timer) }
  }, [jobs.length])

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">RAG Ingestion</h1>

      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Namespace (optional)</label>
        <input value={namespace} onChange={(e) => setNamespace(e.target.value)} placeholder="default" className="border rounded px-3 py-2 w-full" />
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Resource URLs (one per line)</label>
        <textarea value={urls} onChange={(e) => setUrls(e.target.value)} placeholder="https://example.com/file.pdf\nhttps://cdn.site/doc.txt" className="border rounded px-3 py-2 w-full h-40" />
      </div>

      <button onClick={enqueue} disabled={submitting || files.length === 0} className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50">
        {submitting ? 'Submitting…' : 'Enqueue Ingestion'}
      </button>

      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-2">Jobs</h2>
        <div className="space-y-2">
          {jobs.length === 0 && <div className="text-sm text-gray-500">No jobs yet.</div>}
          {jobs.map((j) => (
            <div key={j.jobId} className="border rounded p-3">
              <div className="text-sm font-mono">{j.jobId}</div>
              <div className="text-sm">{j.stage || 'pending'} {typeof j.progress === 'number' ? `(${j.progress}%)` : ''}</div>
              {j.message && <div className="text-xs text-gray-600">{j.message}</div>}
              {j.updated && <div className="text-xs text-gray-400">updated {j.updated}</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
