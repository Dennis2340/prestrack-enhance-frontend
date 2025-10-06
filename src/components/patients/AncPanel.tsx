"use client";
import { useEffect, useState } from "react";

export default function AncPanel({ patientId }: { patientId: string }) {
  // Intake
  const [lmp, setLmp] = useState("");
  const [gravida, setGravida] = useState("");
  const [para, setPara] = useState("");
  const [savingIntake, setSavingIntake] = useState(false);
  const [edd, setEdd] = useState<string | null>(null);

  // Contact
  const [encDate, setEncDate] = useState("");
  const [bp, setBp] = useState(""); // e.g., 120/80
  const [weight, setWeight] = useState("");
  const [fundalHeight, setFundalHeight] = useState("");
  const [fhr, setFhr] = useState("");
  const [iptp, setIptp] = useState("none"); // none|given
  const [iptpDoseText, setIptpDoseText] = useState("");
  const [tt, setTt] = useState("none"); // none|given
  const [ttBatch, setTtBatch] = useState("");
  const [savingContact, setSavingContact] = useState(false);
  // Labs
  const [hivResult, setHivResult] = useState("unknown"); // negative|positive|unknown
  const [syphilisResult, setSyphilisResult] = useState("unknown"); // negative|positive|unknown
  const [hb, setHb] = useState(""); // g/dL
  const [malariaRdt, setMalariaRdt] = useState("unknown"); // negative|positive|unknown
  // Danger signs (checkboxes)
  const [danger, setDanger] = useState<{[k:string]: boolean}>({
    severe_headache: false,
    blurred_vision: false,
    vaginal_bleeding: false,
    severe_abdominal_pain: false,
    reduced_fetal_movements: false,
    fever: false,
  });

  // Indicators
  const [ind, setInd] = useState<{
    encountersCount?: number;
    iptpCount?: number;
    ttCount?: number;
    lastHb?: number | null;
    lastHbAt?: string | null;
    lastIptpDate?: string | null;
    lastTtDate?: string | null;
    lmp?: string | null;
    edd?: string | null;
    screening?: { hiv?: boolean; syphilis?: boolean; malariaRdt?: boolean };
  } | null>(null);
  // Local modal for confirmations/errors
  const [modal, setModal] = useState<{ open: boolean; title: string; message: string; kind: 'success' | 'error' }>({ open: false, title: '', message: '', kind: 'success' });
  function show(kind: 'success'|'error', title: string, message: string) {
    setModal({ open: true, title, message, kind });
  }
  // View more details modal
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [details, setDetails] = useState<any | null>(null);
  // UI warnings for schedule checks
  const [iptpWarn, setIptpWarn] = useState<string | null>(null);
  const [ttWarn, setTtWarn] = useState<string | null>(null);
  async function openDetails() {
    if (!patientId) return;
    setDetailsOpen(true);
    setDetailsLoading(true);
    try {
      const res = await fetch(`/api/admin/patients/${patientId}/anc/summary`, { cache: 'no-store' });
      const d = await res.json();
      if (d?.ok === false) throw new Error(d?.error || 'Failed to load');
      setDetails(d);
    } catch (e: any) {
      setDetails({ error: e?.message || 'Failed to load' });
    } finally {
      setDetailsLoading(false);
    }
  }
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/admin/patients/${patientId}/anc/indicators`, { cache: 'no-store' });
        const d = await res.json().catch(()=>({}));
        if (!cancelled) setInd(d || null);
      } catch {}
    }
    if (patientId) load();
    return () => { cancelled = true };
  }, [patientId]);

  // Compute non-blocking warnings when inputs/indicators change
  useEffect(() => {
    try {
      setIptpWarn(null); setTtWarn(null);
      if (!ind) return;
      if (!encDate) return;
      const enc = new Date(encDate);
      if (iptp === 'given') {
        // GA from LMP or EDD
        const lmp = ind.lmp ? new Date(ind.lmp) : null;
        const edd = ind.edd ? new Date(ind.edd) : null;
        let gaWeeks: number | null = null;
        if (lmp) {
          gaWeeks = Math.floor((enc.getTime() - lmp.getTime()) / (7*24*60*60*1000));
        } else if (edd) {
          const daysToEdd = Math.floor((edd.getTime() - enc.getTime()) / (24*60*60*1000));
          gaWeeks = 40 - Math.floor(daysToEdd/7);
        }
        const msgs: string[] = [];
        if (gaWeeks != null && gaWeeks < 13) msgs.push('IPTp typically starts from ~13 weeks GA.');
        if (ind.lastIptpDate) {
          const last = new Date(ind.lastIptpDate);
          const diffDays = Math.floor((enc.getTime() - last.getTime())/(24*60*60*1000));
          if (diffDays < 28) msgs.push('Last IPTp was < 4 weeks ago.');
        }
        setIptpWarn(msgs.length ? msgs.join(' ') : null);
      }
      if (tt === 'given') {
        if (ind.lastTtDate) {
          const last = new Date(ind.lastTtDate);
          const enc = new Date(encDate);
          const diffDays = Math.floor((enc.getTime() - last.getTime())/(24*60*60*1000));
          if (diffDays < 28) setTtWarn('Last TT dose was < 4 weeks ago.');
        }
      }
    } catch {}
  }, [ind, encDate, iptp, tt]);

  async function submitIntake(e: React.FormEvent) {
    e.preventDefault();
    if (!patientId) return;
    setSavingIntake(true);
    try {
      const res = await fetch(`/api/admin/patients/${patientId}/anc/intake`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lmp: lmp || undefined, gravida: gravida || undefined, para: para || undefined }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d?.error || "Failed");
      setEdd(d.edd || null);
      show('success', 'Saved', 'ANC intake saved');
    } catch (e: any) {
      show('error', 'Error', e?.message || 'Failed');
    } finally {
      setSavingIntake(false);
    }
  }

  async function submitContact(e: React.FormEvent) {
    e.preventDefault();
    if (!patientId) return;
    if (!encDate) { show('error', 'Missing date', 'Encounter date is required'); return; }
    setSavingContact(true);
    try {
      const obs: any[] = [];
      if (bp.trim()) {
        obs.push({ codeSystem: "custom", code: "bp", valueCodeableConcept: { text: bp.trim() } });
      }
      // Validations for numeric inputs
      const weightNum = weight.trim() ? Number(weight) : undefined;
      if (weightNum !== undefined) {
        if (!Number.isFinite(weightNum) || weightNum <= 0 || weightNum > 300) {
          show('error', 'Invalid weight', 'Please enter a valid weight in kg (0 - 300).'); setSavingContact(false); return;
        }
        obs.push({ codeSystem: "LOINC", code: "29463-7", valueQuantity: { value: weightNum, unit: "kg" } });
      }
      const fhNum = fundalHeight.trim() ? Number(fundalHeight) : undefined;
      if (fhNum !== undefined) {
        if (!Number.isFinite(fhNum) || fhNum <= 0 || fhNum > 60) {
          show('error', 'Invalid fundal height', 'Please enter a valid fundal height in cm (0 - 60).'); setSavingContact(false); return;
        }
        obs.push({ codeSystem: "custom", code: "fundal-height", valueQuantity: { value: fhNum, unit: "cm" } });
      }
      const fhrNum = fhr.trim() ? Number(fhr) : undefined;
      if (fhrNum !== undefined) {
        if (!Number.isFinite(fhrNum) || fhrNum < 60 || fhrNum > 220) {
          show('error', 'Invalid FHR', 'Please enter a valid fetal heart rate in bpm (60 - 220).'); setSavingContact(false); return;
        }
        obs.push({ codeSystem: "custom", code: "fhr", valueQuantity: { value: fhrNum, unit: "bpm" } });
      }
      const interventions: any[] = [];
      if (iptp === "given") {
        interventions.push({ type: "iptp", date: encDate, doseText: iptpDoseText || undefined });
      }
      const immunizations: any[] = [];
      if (tt === "given") {
        immunizations.push({ vaccineCode: "TT", vaccineSystem: "local", occurrenceDateTime: encDate, lotNumber: ttBatch || undefined });
      }
      const dangerSigns = Object.entries(danger).filter(([k,v])=> !!v).map(([k])=> k);
      const res = await fetch(`/api/admin/patients/${patientId}/anc/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: encDate,
          observations: obs,
          interventions,
          immunizations,
          // Labs/screens
          hivResult: hivResult !== 'unknown' ? hivResult : undefined,
          syphilisResult: syphilisResult !== 'unknown' ? syphilisResult : undefined,
          hb: hb.trim() ? (() => { const v = Number(hb); if (!Number.isFinite(v) || v < 3 || v > 25) { throw new Error('Hemoglobin must be between 3 and 25 g/dL'); } return v; })() : undefined,
          malariaRdt: malariaRdt !== 'unknown' ? malariaRdt : undefined,
          // Danger signs
          dangerSigns,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d?.error || "Failed");
      show('success', 'Saved', 'ANC contact saved');
      setBp(""); setWeight(""); setFundalHeight(""); setFhr(""); setIptp("none"); setIptpDoseText(""); setTt("none"); setTtBatch("");
      setHivResult("unknown"); setSyphilisResult("unknown"); setHb(""); setMalariaRdt("unknown");
      setDanger({ severe_headache:false, blurred_vision:false, vaginal_bleeding:false, severe_abdominal_pain:false, reduced_fetal_movements:false, fever:false });
      // refresh indicators
      try { const r = await fetch(`/api/admin/patients/${patientId}/anc/indicators`, { cache: 'no-store' }); const dd = await r.json(); setInd(dd||null); } catch {}
    } catch (e: any) {
      show('error', 'Error', e?.message || 'Failed');
    } finally {
      setSavingContact(false);
    }
  }

  return (
    <div className="relative">
      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="border rounded p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-medium">ANC Summary</div>
          <button type="button" onClick={openDetails} className="text-xs px-2 py-1 border rounded">View more</button>
        </div>
        {!ind ? (
          <div className="text-xs text-gray-500">Loading…</div>
        ) : (
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="border rounded p-2">
              <div className="font-medium">Contacts</div>
              <div>{ind.encountersCount ?? 0}</div>
            </div>
            
            <div className="border rounded p-2">
              <div className="font-medium">IPTp doses</div>
              <div>{ind.iptpCount ?? 0}</div>
            </div>
            <div className="border rounded p-2">
              <div className="font-medium">TT doses</div>
              <div>{ind.ttCount ?? 0}</div>
            </div>
            <div className="border rounded p-2">
              <div className="font-medium">Last Hb</div>
              <div>{(ind.lastHb ?? null) === null ? '-' : `${ind.lastHb} g/dL`}{ind.lastHbAt ? ` • ${new Date(ind.lastHbAt).toLocaleDateString()}` : ''}</div>
            </div>
          </div>
        )}
      </div>
      <div className="border rounded p-3">
        <div className="text-sm font-medium mb-2">ANC Intake</div>
        <form onSubmit={submitIntake} className="space-y-3 text-sm">
          <div>
            <label className="block text-xs font-medium mb-1">Last Menstrual Period (LMP)</label>
            <input type="date" value={lmp} onChange={e=> setLmp(e.target.value)} className="border rounded px-3 py-2 w-full" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium mb-1">Gravida</label>
              <input value={gravida} onChange={e=> setGravida(e.target.value)} className="border rounded px-3 py-2 w-full" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Para</label>
              <input value={para} onChange={e=> setPara(e.target.value)} className="border rounded px-3 py-2 w-full" />
            </div>
          </div>
          {edd && (<div className="text-xs text-gray-600">Calculated EDD: {new Date(edd).toLocaleDateString()}</div>)}
          <div className="flex items-center justify-end">
            <button type="submit" disabled={savingIntake} className="bg-blue-600 text-white px-3 py-2 rounded disabled:opacity-50">{savingIntake ? "Saving…" : "Save Intake"}</button>
          </div>
        </form>
      </div>

      <div className="border rounded p-3">
        <div className="text-sm font-medium mb-2">ANC Contact</div>
        <form onSubmit={submitContact} className="space-y-3 text-sm">
          <div>
            <label className="block text-xs font-medium mb-1">Encounter Date</label>
            <input type="date" value={encDate} onChange={e=> setEncDate(e.target.value)} className="border rounded px-3 py-2 w-full" required />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium mb-1">Blood Pressure (e.g., 120/80)</label>
              <input value={bp} onChange={e=> setBp(e.target.value)} className="border rounded px-3 py-2 w-full" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Weight (kg)</label>
              <input type="number" min={1} max={300} step={0.1} value={weight} onChange={e=> setWeight(e.target.value)} className="border rounded px-3 py-2 w-full" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium mb-1">Fundal Height (cm)</label>
              <input type="number" min={1} max={60} step={0.1} value={fundalHeight} onChange={e=> setFundalHeight(e.target.value)} className="border rounded px-3 py-2 w-full" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Fetal Heart Rate (bpm)</label>
              <input type="number" min={60} max={220} step={1} value={fhr} onChange={e=> setFhr(e.target.value)} className="border rounded px-3 py-2 w-full" />
            </div>
          </div>
          
            <div>
              <label className="block text-xs font-medium mb-1">IPTp</label>
              <select value={iptp} onChange={e=> setIptp(e.target.value)} className="border rounded px-3 py-2 w-full">
                <option value="none">Not given</option>
                <option value="given">Given today</option>
              </select>
              {iptp === "given" && (
                <input value={iptpDoseText} onChange={e=> setIptpDoseText(e.target.value)} placeholder="Dose notes (optional)" className="mt-2 border rounded px-3 py-2 w-full" />
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium mb-1">HIV result</label>
                <select value={hivResult} onChange={e=> setHivResult(e.target.value)} className="border rounded px-3 py-2 w-full">
                  <option value="unknown">Unknown</option>
                  <option value="negative">Negative</option>
                  <option value="positive">Positive</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Syphilis result</label>
                <select value={syphilisResult} onChange={e=> setSyphilisResult(e.target.value)} className="border rounded px-3 py-2 w-full">
                  <option value="unknown">Unknown</option>
                  <option value="negative">Negative</option>
                  <option value="positive">Positive</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium mb-1">Hemoglobin (g/dL)</label>
                <input value={hb} onChange={e=> setHb(e.target.value)} className="border rounded px-3 py-2 w-full" placeholder="e.g., 10.5" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Malaria RDT</label>
                <select value={malariaRdt} onChange={e=> setMalariaRdt(e.target.value)} className="border rounded px-3 py-2 w-full">
                  <option value="unknown">Unknown</option>
                  <option value="negative">Negative</option>
                  <option value="positive">Positive</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Danger signs</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: 'severe_headache', label: 'Severe headache' },
                  { key: 'blurred_vision', label: 'Blurred vision' },
                  { key: 'vaginal_bleeding', label: 'Vaginal bleeding' },
                  { key: 'severe_abdominal_pain', label: 'Severe abdominal pain' },
                  { key: 'reduced_fetal_movements', label: 'Reduced fetal movements' },
                  { key: 'fever', label: 'Fever' },
                ].map((it)=> (
                  <label key={it.key} className="flex items-center gap-2 text-xs">
                    <input type="checkbox" checked={!!danger[it.key]} onChange={(e)=> setDanger(prev=> ({ ...prev, [it.key]: e.target.checked }))} /> {it.label}
                  </label>
                ))}
              </div>
            </div>
            <div>
              {tt === 'given' && ttWarn && <div className="mb-2 text-xs text-amber-700">{ttWarn}</div>}
            </div>
            <div className="flex items-center justify-end">
              <button type="submit" disabled={savingContact} className="bg-teal-600 text-white px-3 py-2 rounded disabled:opacity-50">{savingContact ? "Saving…" : "Save Contact"}</button>
            </div>
          </form>
        </div>
        <div className="border rounded p-3">
          <div className="text-sm font-medium mb-2">ANC Indicators</div>
          {!ind ? (
            <div className="text-xs text-gray-500">Loading…</div>
          ) : (
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="border rounded p-2">
                <div className="font-medium">Contacts</div>
                <div>{ind.encountersCount ?? 0}</div>
              </div>
              <div className="border rounded p-2">
                <div className="font-medium">IPTp doses</div>
                <div>{ind.iptpCount ?? 0}</div>
              </div>
              <div className="border rounded p-2">
                <div className="font-medium">TT doses</div>
                <div>{ind.ttCount ?? 0}</div>
              </div>
              <div className="border rounded p-2">
                <div className="font-medium">Last Hb</div>
                <div>{(ind.lastHb ?? null) === null ? '-' : `${ind.lastHb} g/dL`}{ind.lastHbAt ? ` • ${new Date(ind.lastHbAt).toLocaleDateString()}` : ''}</div>
              </div>
            </div>
          )}
        </div>
      </div>
      {modal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded shadow p-4 w-[90%] max-w-sm">
            <div className={`text-sm font-medium ${modal.kind === 'success' ? 'text-green-700' : 'text-red-700'}`}>{modal.title}</div>
            <div className="mt-1 text-sm">{modal.message}</div>
            <div className="mt-3 flex justify-end">
              <button className="px-3 py-2 border rounded" onClick={() => setModal({ ...modal, open: false })}>OK</button>
            </div>
          </div>
        </div>
      )}
      {detailsOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 overflow-y-auto">
          <div className="bg-white rounded shadow p-5 w-[95%] max-w-2xl text-base my-8 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div className="text-lg font-semibold">ANC Details</div>
              <button className="text-sm px-2 py-1 border rounded" onClick={()=> setDetailsOpen(false)}>Close</button>
            </div>
            {detailsLoading ? (
              <div className="mt-4 text-base text-gray-600">Loading…</div>
            ) : details?.error ? (
              <div className="mt-4 text-base text-red-600">{details.error}</div>
            ) : (
              <div className="mt-4 space-y-4">
                <div>
                  <div className="text-base font-medium">Indicators</div>
                  <div className="grid grid-cols-2 gap-3 mt-2">
                    <div className="border rounded p-3">Contacts: {details?.indicators?.encountersCount ?? 0}</div>
                    <div className="border rounded p-3">IPTp doses: {details?.indicators?.iptpCount ?? 0}</div>
                    <div className="border rounded p-3">TT doses: {details?.indicators?.ttCount ?? 0}</div>
                    <div className="border rounded p-3">Last Hb: {details?.indicators?.lastHb ?? '-'} {details?.indicators?.lastHbAt ? `(${new Date(details.indicators.lastHbAt).toLocaleDateString()})` : ''}</div>
                  </div>
                </div>
                <div>
                  <div className="text-base font-medium">Latest encounter</div>
                  {!details?.latestEncounter ? (
                    <div className="text-gray-600">No encounters yet.</div>
                  ) : (
                    <div className="space-y-3">
                      <div>Date: {new Date(details.latestEncounter.date).toLocaleDateString()}</div>
                      <div className="text-base font-medium">Observations</div>
                      <div className="max-h-56 overflow-auto border rounded p-3">
                        {(details.latestEncounter.observations || []).map((o: any, idx: number) => (
                          <div key={idx} className="py-2 border-b last:border-b-0">
                            <div className="font-medium">{o.codeSystem}:{o.code}</div>
                            {o.valueQuantity && <div>Value: {o.valueQuantity.value} {o.valueQuantity.unit}</div>}
                            {o.valueCodeableConcept?.text && <div>Value: {o.valueCodeableConcept.text}</div>}
                            {o.note && <div>Note: {o.note}</div>}
                          </div>
                        ))}
                      </div>
                      <div className="text-base font-medium mt-2">Interventions</div>
                      <div className="max-h-44 overflow-auto border rounded p-3">
                        {(details.latestEncounter.interventions || []).map((iv: any, idx: number) => (
                          <div key={idx} className="py-2 border-b last:border-b-0">
                            <div className="font-medium">Type: {iv.type} • {new Date(iv.date).toLocaleDateString()}</div>
                            {iv.medicationCode && <div>Med: {iv.medicationSystem || 'local'}:{iv.medicationCode}</div>}
                            {iv.doseText && <div>Dose: {iv.doseText}</div>}
                          </div>
                        ))}
                      </div>
                      <div className="text-base font-medium mt-2">Immunizations</div>
                      <div className="max-h-44 overflow-auto border rounded p-3">
                        {(details.latestEncounter.immunizations || []).map((im: any, idx: number) => (
                          <div key={idx} className="py-2 border-b last:border-b-0">
                            <div className="font-medium">{im.vaccineSystem || 'local'}:{im.vaccineCode} • {new Date(im.occurrenceDateTime).toLocaleDateString()}</div>
                            {im.lotNumber && <div>Lot: {im.lotNumber}</div>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
