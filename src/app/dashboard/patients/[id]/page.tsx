"use client"

import * as Dialog from "@radix-ui/react-dialog";
import * as Tabs from "@radix-ui/react-tabs";
import { useCallback, useEffect, useMemo, useState } from "react";
// Defer heavy client helpers to runtime to reduce compile-time memory pressure
import { useParams } from "next/navigation";

type Detail = {
  patient: { id: string; firstName: string | null; lastName: string | null; createdAt: string };
  contacts: Array<{ id: string; type: string; value: string; verified: boolean }>;
  phoneE164: string | null;
  conversation: { id: string } | null;
  messages: Array<{ id: string; direction: string; body: string; via: string; createdAt: string }>;
};

type Source = { url: string; addedAt: string; jobId?: string | null; stage?: string; progress?: number };

export default function PatientDetailPage() {
  const params = useParams() as { id: string };
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);

  // Ingestion modal state
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [urls, setUrls] = useState("");
  const [processing, setProcessing] = useState(false);
  const [sources, setSources] = useState<Source[]>([]);
  // Tabs state
  const [tab, setTab] = useState("overview");
  // Medical history form (repeatable inputs)
  const [conditionsArr, setConditionsArr] = useState<string[]>([""]);
  const [surgeriesArr, setSurgeriesArr] = useState<string[]>([""]);
  const [familyHistoryArr, setFamilyHistoryArr] = useState<string[]>([""]);
  const [socialHistoryArr, setSocialHistoryArr] = useState<string[]>([""]);
  const [mhNotify, setMhNotify] = useState(false);
  // Allergies form
  const [allergyRows, setAllergyRows] = useState<Array<{ allergen: string; reaction?: string; severity?: string }>>([
    { allergen: "", reaction: "", severity: "" },
  ]);
  const [allNotify, setAllNotify] = useState(false);
  const [allergiesList, setAllergiesList] = useState<any>(null);
  // Vitals form+list
  const [vitalType, setVitalType] = useState("bp");
  const [vitalValue, setVitalValue] = useState("");
  const [vitalUnits, setVitalUnits] = useState("");
  const [vitalNotify, setVitalNotify] = useState(false);
  const [vitals, setVitals] = useState<Array<any>>([]);
  // Prescriptions
  const [rxList, setRxList] = useState<Array<any>>([])
  const [rxName, setRxName] = useState("")
  const [rxStrength, setRxStrength] = useState("")
  const [rxForm, setRxForm] = useState("")
  const [rxStart, setRxStart] = useState("")
  const [rxEnd, setRxEnd] = useState("")
  const [rxTimes, setRxTimes] = useState<string>("09:00\n21:00")

  const lsKey = useMemo(() => `patient_sources_${detail?.phoneE164 || "unknown"}`.replace(/[^a-zA-Z0-9_]/g, "_"), [detail?.phoneE164]);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/patients/${params.id}/detail`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load");
      setDetail(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [params.id]);

  // Load allergies and vitals on tab switch
  useEffect(() => {
    if (!detail?.patient?.id) return
    if (tab === 'allergies') {
      fetch(`/api/admin/patients/${detail.patient.id}/allergies`).then(r => r.json()).then(d => setAllergiesList(d.allergies || null)).catch(() => {})
    }
    if (tab === 'vitals') {
      fetch(`/api/admin/patients/${detail.patient.id}/vitals`).then(r => r.json()).then(d => setVitals(d.items || [])).catch(() => {})
    }
  }, [tab, detail?.patient?.id])

  useEffect(() => {
    // Load tracked sources for this patient
    try {
      const raw = localStorage.getItem(lsKey);
      if (raw) setSources(JSON.parse(raw));
    } catch {}
  }, [lsKey]);

  // Load prescriptions when tab is prescriptions
  useEffect(() => {
    if (tab === 'prescriptions' && detail?.patient?.id) {
      fetch(`/api/admin/patients/${detail.patient.id}/prescriptions`).then(r=>r.json()).then(d=> setRxList(d.items || [])).catch(()=>{})
    }
  }, [tab, detail?.patient?.id])

  const saveSources = useCallback((next: Source[]) => {
    setSources(next);
    try { localStorage.setItem(lsKey, JSON.stringify(next)) } catch {}
  }, [lsKey]);

  const onSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const list = Array.from(e.target.files || []);
    setFiles(list);
  }, []);

  async function onEnqueue() {
    if (!detail?.patient?.id) return;
    const selectedUrls: string[] = [];
    try {
      setProcessing(true);
      if (files.length > 0) {
        const { uploadFiles } = await import("@/lib/uploadthing");
        const res = await uploadFiles("documents", { files });
        selectedUrls.push(...res.map((r: any) => r.url).filter(Boolean));
      }
      const manual = urls
        .split(/\n+/)
        .map((s) => s.trim())
        .filter(Boolean);
      const all = Array.from(new Set([...selectedUrls, ...manual]));
      if (all.length === 0) return;

      const resp = await fetch(`/api/admin/patients/${detail.patient.id}/ingest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files: all.map((u) => ({ url: u })) }),
      });
      type IngestResponse = { jobs?: Array<{ url: string; jobId: string }>; error?: string };
      const data: IngestResponse = await resp.json();
      if (!resp.ok) throw new Error(data?.error || "Failed to enqueue");

      const now = new Date().toISOString();
      const jobs: Array<{ url: string; jobId: string }> = Array.isArray(data.jobs) ? data.jobs : [];
      const byUrl = new Map<string, string>(jobs.map((j: { url: string; jobId: string }) => [j.url, j.jobId]));
      const next = [...sources];
      for (const u of all) {
        const existing = next.find((s) => s.url === u);
        const jobId: string | null = (byUrl.get(u) as string | undefined) ?? null;
        if (existing) {
          existing.jobId = jobId;
          existing.addedAt = existing.addedAt || now;
        } else {
          next.unshift({ url: u, addedAt: now, jobId });
        }
      }
      saveSources(next);
      setFiles([]);
      setUrls("");
      setOpen(false);
    } catch (e: any) {
      alert(e?.message || "Failed");
    } finally {
      setProcessing(false);
    }
  }

  const refreshStatuses = useCallback(async () => {
    const withJobs = sources.filter((s) => s.jobId);
    if (withJobs.length === 0) return;
    try {
      const updated = await Promise.all(
        withJobs.map(async (s) => {
          try {
            const res = await fetch(`/api/admin/geneline/job?id=${encodeURIComponent(String(s.jobId))}`);
            if (!res.ok) return s;
            const data = await res.json();
            return { ...s, stage: data.stage || s.stage, progress: typeof data.progress === "number" ? data.progress : s.progress };
          } catch {
            return s;
          }
        })
      );
      const merged = sources.map((s) => {
        const nu = updated.find((u) => u.url === s.url);
        return nu ? nu : s;
      });
      saveSources(merged);
    } catch {}
  }, [sources, saveSources]);

  if (loading) return <div className="p-4 text-sm">Loading…</div>;
  if (!detail) return <div className="p-4 text-sm text-red-600">Not found</div>;

  const fullName = [detail.patient.firstName, detail.patient.lastName].filter(Boolean).join(" ") || "Unnamed";

  return (
    <div className="max-w-5xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{fullName}</h1>
          <div className="text-sm text-gray-600">Phone: {detail.phoneE164 || "-"}</div>
        </div>
        <Dialog.Root open={open} onOpenChange={setOpen}>
          <Dialog.Trigger asChild>
            <button className="bg-blue-600 text-white px-4 py-2 rounded">Add Sources</button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 bg-black/40" />
            <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-xl bg-white rounded shadow-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <Dialog.Title className="text-lg font-semibold">Add Patient Sources</Dialog.Title>
                <Dialog.Close asChild>
                  <button className="text-gray-500">✕</button>
                </Dialog.Close>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Upload PDF files</label>
                  <input type="file" accept="application/pdf" multiple onChange={onSelect} />
                  {files.length > 0 && <div className="text-xs text-gray-500 mt-1">Selected: {files.map(f => f.name).join(", ")}</div>}
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Or paste URLs (one per line)</label>
                  <textarea value={urls} onChange={(e) => setUrls(e.target.value)} className="border rounded px-3 py-2 w-full h-32" placeholder="https://example.com/doc.pdf\nhttps://cdn.site/file.txt" />
                </div>
                <div className="flex items-center justify-end gap-2">
                  <Dialog.Close asChild>
                    <button className="px-4 py-2 rounded border">Cancel</button>
                  </Dialog.Close>
                  <button onClick={onEnqueue} disabled={processing || (files.length === 0 && !urls.trim())} className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50">
                    {processing ? "Processing…" : "Upload & Enqueue"}
                  </button>
                </div>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </div>

      <Tabs.Root value={tab} onValueChange={setTab}>
        <Tabs.List className="flex gap-3 border-b">
          <Tabs.Trigger value="overview" className="px-3 py-2 text-sm border-b-2 data-[state=active]:border-blue-600">Overview</Tabs.Trigger>
          <Tabs.Trigger value="documents" className="px-3 py-2 text-sm border-b-2 data-[state=active]:border-blue-600">Documents</Tabs.Trigger>
          <Tabs.Trigger value="medical" className="px-3 py-2 text-sm border-b-2 data-[state=active]:border-blue-600">Medical History</Tabs.Trigger>
          <Tabs.Trigger value="allergies" className="px-3 py-2 text-sm border-b-2 data-[state=active]:border-blue-600">Allergies</Tabs.Trigger>
          <Tabs.Trigger value="vitals" className="px-3 py-2 text-sm border-b-2 data-[state=active]:border-blue-600">Vitals</Tabs.Trigger>
          <Tabs.Trigger value="prescriptions" className="px-3 py-2 text-sm border-b-2 data-[state=active]:border-blue-600">Prescriptions</Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="overview" className="mt-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 border rounded">
              <div className="px-3 py-2 border-b text-sm font-medium">Recent Messages</div>
              <div className="divide-y">
                {detail.messages.length === 0 ? (
                  <div className="p-3 text-sm text-gray-500">No messages yet.</div>
                ) : (
                  detail.messages.map((m) => (
                    <div key={m.id} className="p-3 text-sm">
                      <div className="text-xs text-gray-500 mb-1">{m.direction} via {m.via} · {new Date(m.createdAt).toLocaleString()}</div>
                      <div className="whitespace-pre-wrap">{m.body}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="border rounded p-3">
              <div className="text-sm font-medium mb-2">Sources</div>
              <button onClick={refreshStatuses} className="px-3 py-1.5 rounded border text-sm mb-2">Refresh Status</button>
              <div className="space-y-2">
                {sources.length === 0 ? (
                  <div className="text-sm text-gray-500">No sources yet.</div>
                ) : (
                  sources.map((s) => (
                    <div key={s.url} className="border rounded p-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-xs font-mono break-all">{s.url}</div>
                          <div className="text-xs text-gray-600">{s.stage ? `${s.stage}` : "queued"}{typeof s.progress === "number" ? ` • ${s.progress}%` : ""}</div>
                        </div>
                        <button
                          className="text-xs px-2 py-1 border rounded hover:bg-red-50"
                          onClick={async () => {
                            try {
                              await fetch('/api/admin/geneline/delete', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ url: s.url }) })
                            } catch {}
                            const next = sources.filter(x => x.url !== s.url)
                            saveSources(next)
                          }}
                        >Delete</button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </Tabs.Content>

        <Tabs.Content value="prescriptions" className="mt-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 border rounded">
              <div className="px-3 py-2 border-b text-sm font-medium">Prescriptions</div>
              <div className="divide-y">
                {rxList.length === 0 ? (
                  <div className="p-3 text-sm text-gray-500">No prescriptions.</div>
                ) : (
                  rxList.map((rx:any)=>(
                    <div key={rx.id} className="p-3 text-sm">
                      <div className="font-medium">{rx.medicationName} {rx.strength ? `(${rx.strength})` : ''} {rx.form || ''}</div>
                      <div className="text-xs text-gray-500">Start: {new Date(rx.startDate).toLocaleDateString()} {rx.endDate ? `• End: ${new Date(rx.endDate).toLocaleDateString()}` : ''}</div>
                      <div className="mt-2">
                        <button className="px-2 py-1 text-xs border rounded" onClick={async ()=>{
                          const times = rxTimes.split(/\n+/).map(s=>s.trim()).filter(Boolean)
                          const res = await fetch(`/api/admin/prescriptions/${rx.id}/reminders`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ days: 7, times }) })
                          const d = await res.json(); if (!res.ok) alert(d?.error || 'Failed'); else alert(`Created ${d.created} reminders`)
                        }}>Create 7‑day reminders</button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="border rounded p-3">
              <div className="text-sm font-medium mb-2">Add Prescription</div>
              <div className="space-y-2">
                <input value={rxName} onChange={e=> setRxName(e.target.value)} className="border rounded px-3 py-2 w-full" placeholder="Medication name" />
                <div className="grid grid-cols-2 gap-2">
                  <input value={rxStrength} onChange={e=> setRxStrength(e.target.value)} className="border rounded px-3 py-2 w-full" placeholder="Strength (e.g., 500mg)" />
                  <input value={rxForm} onChange={e=> setRxForm(e.target.value)} className="border rounded px-3 py-2 w-full" placeholder="Form (e.g., tablet)" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input type="date" value={rxStart} onChange={e=> setRxStart(e.target.value)} className="border rounded px-3 py-2 w-full" />
                  <input type="date" value={rxEnd} onChange={e=> setRxEnd(e.target.value)} className="border rounded px-3 py-2 w-full" />
                </div>
                <label className="block text-xs font-medium">Reminder times (HH:MM per line)</label>
                <textarea value={rxTimes} onChange={e=> setRxTimes(e.target.value)} className="border rounded w-full h-20 px-3 py-2 font-mono text-xs" />
                <div className="flex items-center justify-end">
                  <button className="bg-blue-600 text-white px-3 py-2 rounded" onClick={async ()=>{
                    if (!detail?.patient?.id) return
                    if (!rxName.trim()) { alert('Medication name required'); return }
                    const res = await fetch(`/api/admin/patients/${detail.patient.id}/prescriptions`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ medicationName: rxName, strength: rxStrength || undefined, form: rxForm || undefined, startDate: rxStart || undefined, endDate: rxEnd || undefined }) })
                    const d = await res.json(); if (!res.ok) { alert(d?.error || 'Failed'); return }
                    // refresh list
                    const list = await fetch(`/api/admin/patients/${detail.patient.id}/prescriptions`).then(r=>r.json()).catch(()=>({items:[]}))
                    setRxList(list.items || [])
                    setRxName(''); setRxStrength(''); setRxForm(''); setRxStart(''); setRxEnd('')
                  }}>Save</button>
                </div>
              </div>
            </div>
          </div>
        </Tabs.Content>

        <Tabs.Content value="documents" className="mt-3">
          <div className="border rounded p-3">
            <div className="text-sm text-gray-600 mb-2">Manage per-patient documents via the Add Sources button above. These are filtered for RAG using metadata.</div>
            <button onClick={refreshStatuses} className="px-3 py-1.5 rounded border text-sm mb-2">Refresh Status</button>
            <div className="space-y-2">
              {sources.length === 0 ? (
                <div className="text-sm text-gray-500">No sources yet.</div>
              ) : (
                sources.map((s) => (
                  <div key={s.url} className="border rounded p-2">
                    <div className="text-xs font-mono break-all">{s.url}</div>
                    <div className="text-xs text-gray-600">{s.stage ? `${s.stage}` : "queued"}{typeof s.progress === "number" ? ` • ${s.progress}%` : ""}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </Tabs.Content>

        <Tabs.Content value="medical" className="mt-3">
          <div className="border rounded p-4 space-y-5">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">Conditions</label>
                <button type="button" className="text-sm px-2 py-1 border rounded" onClick={() => setConditionsArr((a) => [...a, ""]) }>Add more</button>
              </div>
              <div className="space-y-2">
                {conditionsArr.map((v, idx) => (
                  <div key={`cond-${idx}`} className="flex gap-2">
                    <input value={v} onChange={(e)=>{
                      const next=[...conditionsArr]; next[idx]=e.target.value; setConditionsArr(next);
                    }} className="border rounded px-3 py-2 w-full" placeholder="e.g., Diabetes" />
                    <button type="button" className="px-2 border rounded" onClick={()=> setConditionsArr((a)=> a.filter((_,i)=>i!==idx))}>Remove</button>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">Surgeries</label>
                <button type="button" className="text-sm px-2 py-1 border rounded" onClick={() => setSurgeriesArr((a) => [...a, ""]) }>Add more</button>
              </div>
              <div className="space-y-2">
                {surgeriesArr.map((v, idx) => (
                  <div key={`surg-${idx}`} className="flex gap-2">
                    <input value={v} onChange={(e)=>{
                      const next=[...surgeriesArr]; next[idx]=e.target.value; setSurgeriesArr(next);
                    }} className="border rounded px-3 py-2 w-full" placeholder="e.g., Appendectomy (2019)" />
                    <button type="button" className="px-2 border rounded" onClick={()=> setSurgeriesArr((a)=> a.filter((_,i)=>i!==idx))}>Remove</button>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">Family history</label>
                <button type="button" className="text-sm px-2 py-1 border rounded" onClick={() => setFamilyHistoryArr((a) => [...a, ""]) }>Add more</button>
              </div>
              <div className="space-y-2">
                {familyHistoryArr.map((v, idx) => (
                  <div key={`fam-${idx}`} className="flex gap-2">
                    <input value={v} onChange={(e)=>{
                      const next=[...familyHistoryArr]; next[idx]=e.target.value; setFamilyHistoryArr(next);
                    }} className="border rounded px-3 py-2 w-full" placeholder="e.g., Mother: Hypertension" />
                    <button type="button" className="px-2 border rounded" onClick={()=> setFamilyHistoryArr((a)=> a.filter((_,i)=>i!==idx))}>Remove</button>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">Social history</label>
                <button type="button" className="text-sm px-2 py-1 border rounded" onClick={() => setSocialHistoryArr((a) => [...a, ""]) }>Add more</button>
              </div>
              <div className="space-y-2">
                {socialHistoryArr.map((v, idx) => (
                  <div key={`soc-${idx}`} className="flex gap-2">
                    <input value={v} onChange={(e)=>{
                      const next=[...socialHistoryArr]; next[idx]=e.target.value; setSocialHistoryArr(next);
                    }} className="border rounded px-3 py-2 w-full" placeholder="e.g., Non-smoker" />
                    <button type="button" className="px-2 border rounded" onClick={()=> setSocialHistoryArr((a)=> a.filter((_,i)=>i!==idx))}>Remove</button>
                  </div>
                ))}
              </div>
            </div>
            <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={mhNotify} onChange={(e) => setMhNotify(e.target.checked)} /> Notify providers</label>
            <div className="flex items-center justify-end">
              <button className="bg-blue-600 text-white px-4 py-2 rounded" onClick={async () => {
                if (!detail?.patient?.id) return
                const payload = {
                  conditions: conditionsArr.map(s=>s.trim()).filter(Boolean).map(t=>({ text: t })),
                  surgeries: surgeriesArr.map(s=>s.trim()).filter(Boolean).map(t=>({ text: t })),
                  familyHistory: familyHistoryArr.map(s=>s.trim()).filter(Boolean),
                  socialHistory: socialHistoryArr.map(s=>s.trim()).filter(Boolean),
                }
                const res = await fetch(`/api/admin/patients/${detail.patient.id}/medical`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ history: payload, notifyProviders: mhNotify }) })
                const d = await res.json(); if (!res.ok) alert(d?.error || 'Failed');
              }}>Save</button>
            </div>
          </div>
        </Tabs.Content>

        <Tabs.Content value="allergies" className="mt-3">
          <div className="border rounded p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">Allergies</div>
              <button type="button" className="text-sm px-2 py-1 border rounded" onClick={() => setAllergyRows((rows)=> [...rows, { allergen: "", reaction: "", severity: "" }])}>Add more</button>
            </div>
            <div className="space-y-3">
              {allergyRows.map((row, idx) => (
                <div key={`alg-${idx}`} className="grid grid-cols-3 gap-3">
                  <input value={row.allergen} onChange={(e)=>{
                    const next=[...allergyRows]; next[idx] = { ...next[idx], allergen: e.target.value }; setAllergyRows(next);
                  }} className="border rounded px-3 py-2 w-full" placeholder="Penicillin" />
                  <input value={row.reaction} onChange={(e)=>{
                    const next=[...allergyRows]; next[idx] = { ...next[idx], reaction: e.target.value }; setAllergyRows(next);
                  }} className="border rounded px-3 py-2 w-full" placeholder="Rash" />
                  <div className="flex gap-2">
                    <select value={row.severity} onChange={(e) => {
                      const next=[...allergyRows]; next[idx] = { ...next[idx], severity: e.target.value }; setAllergyRows(next);
                    }} className="border rounded px-3 py-2 w-full">
                      <option value="">Severity…</option>
                      <option value="mild">Mild</option>
                      <option value="moderate">Moderate</option>
                      <option value="severe">Severe</option>
                    </select>
                    <button type="button" className="px-2 border rounded" onClick={()=> setAllergyRows((a)=> a.filter((_,i)=>i!==idx))}>Remove</button>
                  </div>
                </div>
              ))}
            </div>
            <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={allNotify} onChange={(e) => setAllNotify(e.target.checked)} /> Notify providers</label>
            <div className="flex items-center justify-end">
              <button className="bg-blue-600 text-white px-4 py-2 rounded" onClick={async () => {
                if (!detail?.patient?.id) return
                const payload = {
                  list: allergyRows
                    .map(r => ({ allergen: r.allergen?.trim(), reaction: r.reaction?.trim(), severity: r.severity || undefined }))
                    .filter(r => r.allergen),
                }
                const res = await fetch(`/api/admin/patients/${detail.patient.id}/allergies`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ allergies: payload, notifyProviders: allNotify }) })
                const d = await res.json(); if (!res.ok) alert(d?.error || 'Failed');
                else setAllergiesList(payload)
              }}>Save</button>
            </div>
            <div className="text-sm text-gray-700">
              <div className="font-medium mb-1">Current</div>
              <pre className="bg-gray-50 p-3 rounded text-xs overflow-auto">{JSON.stringify(allergiesList, null, 2)}</pre>
            </div>
          </div>
        </Tabs.Content>

        <Tabs.Content value="vitals" className="mt-3">
          <div className="border rounded p-4 space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Type</label>
                <select value={vitalType} onChange={(e) => setVitalType(e.target.value)} className="border rounded px-3 py-2 w-full">
                  <option value="bp">Blood Pressure</option>
                  <option value="hr">Heart Rate</option>
                  <option value="temp">Temperature</option>
                  <option value="spo2">SpO2</option>
                  <option value="weight">Weight</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Value</label>
                <input value={vitalValue} onChange={(e) => setVitalValue(e.target.value)} className="border rounded px-3 py-2 w-full" placeholder="120/80 or 37.0" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Units</label>
                <input value={vitalUnits} onChange={(e) => setVitalUnits(e.target.value)} className="border rounded px-3 py-2 w-full" placeholder="mmHg, bpm, °C, %" />
              </div>
            </div>
            <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={vitalNotify} onChange={(e) => setVitalNotify(e.target.checked)} /> Notify providers</label>
            <div className="flex items-center justify-end">
              <button className="bg-blue-600 text-white px-4 py-2 rounded" onClick={async () => {
                if (!detail?.patient?.id) return
                const res = await fetch(`/api/admin/patients/${detail.patient.id}/vitals`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ type: vitalType, value: vitalValue, units: vitalUnits, notifyProviders: vitalNotify }) })
                const d = await res.json(); if (!res.ok) alert(d?.error || 'Failed');
                else {
                  setVitalType('bp'); setVitalValue(''); setVitalUnits('');
                  const list = await fetch(`/api/admin/patients/${detail.patient.id}/vitals`).then(r=>r.json()).catch(()=>({items:[]}))
                  setVitals(list.items || [])
                }
              }}>Save</button>
            </div>
            <div>
              <div className="text-sm font-medium mb-2">Recent vitals</div>
              <div className="divide-y">
                {vitals.length === 0 ? (
                  <div className="text-sm text-gray-500">No vitals yet.</div>
                ) : (
                  vitals.map((v:any, idx:number) => (
                    <div key={idx} className="py-2 text-sm flex items-center justify-between">
                      <div className="text-gray-700">{v.type}: {v.value} {v.units || ''}</div>
                      <div className="text-xs text-gray-500">{new Date(v.recordedAt).toLocaleString()}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}
