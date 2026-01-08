"use client"

import * as Dialog from "@radix-ui/react-dialog";
import * as Tabs from "@radix-ui/react-tabs";
import { useEffect, useState } from "react";

type PatientItem = { id: string; name: string | null; phoneE164: string | null; createdAt: string };

export default function PatientsPage() {
  const [items, setItems] = useState<PatientItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phoneE164, setPhoneE164] = useState("");
  const [message, setMessage] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState(""); // yyyy-mm-dd
  const [sex, setSex] = useState("");
  // Simple fields that we will map to JSON for the backend
  const [mrn, setMrn] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [addrLine1, setAddrLine1] = useState("");
  const [addrCity, setAddrCity] = useState("");
  const [addrState, setAddrState] = useState("");
  const [addrPostal, setAddrPostal] = useState("");
  const [addrCountry, setAddrCountry] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/patients/list", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load patients");
      setItems(data.items || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function onDeleteConfirmed() {
    if (!confirmDeleteId) return;
    setDeletingId(confirmDeleteId);
    try {
      const res = await fetch('/api/admin/patients/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: confirmDeleteId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `Failed (${res.status})`);
      setConfirmDeleteId(null);
      await load();
    } catch (e: any) {
      alert(e?.message || 'Failed to delete patient');
    } finally {
      setDeletingId(null);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\+\d{6,15}$/.test(phoneE164)) {
      alert("Invalid phone. Use E.164 format like +15551234567");
      return;
    }
    // Build identifiers/address JSON from simple fields
    const identifiers = [
      mrn ? { system: 'mrn', value: mrn } : null,
      nationalId ? { system: 'national-id', value: nationalId } : null,
    ].filter(Boolean);
    const address = (addrLine1 || addrCity || addrState || addrPostal || addrCountry)
      ? { line: addrLine1 ? [addrLine1] : [], city: addrCity || undefined, state: addrState || undefined, postalCode: addrPostal || undefined, country: addrCountry || undefined }
      : undefined;
    // Validate date if provided
    let dobToSend: string | undefined = undefined;
    if (dateOfBirth) {
      const d = new Date(dateOfBirth);
      if (isNaN(d.getTime())) {
        alert("Invalid date of birth");
        return;
      }
      dobToSend = d.toISOString();
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/patients/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phoneE164,
          firstName: firstName || undefined,
          lastName: lastName || undefined,
          message: message || undefined,
          dateOfBirth: dobToSend,
          sex: sex || undefined,
          identifiers,
          address,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to create patient");
      setOpen(false);
      setFirstName("");
      setLastName("");
      setPhoneE164("");
      setMessage("");
      setDateOfBirth("");
      setSex("");
      setMrn("");
      setNationalId("");
      setAddrLine1("");
      setAddrCity("");
      setAddrState("");
      setAddrPostal("");
      setAddrCountry("");
      await load();
    } catch (e: any) {
      alert(e?.message || "Error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Patients</h1>
        <Dialog.Root open={open} onOpenChange={setOpen}>
          <Dialog.Trigger asChild>
            <button className="bg-blue-600 text-white px-4 py-2 rounded">Add Patient</button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 bg-black/40" />
            <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl bg-white rounded shadow-lg max-h-[85vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b px-4 py-3 flex items-center justify-between">
                <Dialog.Title className="text-lg font-semibold">Add Patient</Dialog.Title>
                <Dialog.Close asChild>
                  <button className="text-gray-500 px-2">✕</button>
                </Dialog.Close>
              </div>
              <div className="p-4">
                <Tabs.Root defaultValue="basic">
                  <Tabs.List className="flex gap-2 border-b mb-4">
                    <Tabs.Trigger value="basic" className="px-3 py-1.5 text-sm border-b-2 data-[state=active]:border-blue-600">Basic</Tabs.Trigger>
                    <Tabs.Trigger value="contacts" className="px-3 py-1.5 text-sm border-b-2 data-[state=active]:border-blue-600">Contacts & IDs</Tabs.Trigger>
                    <Tabs.Trigger value="address" className="px-3 py-1.5 text-sm border-b-2 data-[state=active]:border-blue-600">Address</Tabs.Trigger>
                    <Tabs.Trigger value="message" className="px-3 py-1.5 text-sm border-b-2 data-[state=active]:border-blue-600">Message</Tabs.Trigger>
                  </Tabs.List>

                  <form onSubmit={onSubmit} className="space-y-6">
                    <Tabs.Content value="basic" className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium mb-1">First name</label>
                          <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className="border rounded px-3 py-2 w-full" placeholder="Jane" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">Last name</label>
                          <input value={lastName} onChange={(e) => setLastName(e.target.value)} className="border rounded px-3 py-2 w-full" placeholder="Doe" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium mb-1">Date of birth</label>
                          <input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} className="border rounded px-3 py-2 w-full" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">Sex</label>
                          <select value={sex} onChange={(e) => setSex(e.target.value)} className="border rounded px-3 py-2 w-full">
                            <option value="">Select…</option>
                            <option value="male">Male</option>
                            <option value="female">Female</option>
                            <option value="other">Other</option>
                            <option value="unknown">Unknown</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Phone (E.164)</label>
                        <input value={phoneE164} onChange={(e) => setPhoneE164(e.target.value)} className="border rounded px-3 py-2 w-full" placeholder="+15551234567" required />
                        <p className="text-xs text-gray-500 mt-1">Required. Must start with + and country code.</p>
                      </div>
                    </Tabs.Content>

                    <Tabs.Content value="contacts" className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium mb-1">MRN</label>
                          <input value={mrn} onChange={(e) => setMrn(e.target.value)} className="border rounded px-3 py-2 w-full" placeholder="123456" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">National ID</label>
                          <input value={nationalId} onChange={(e) => setNationalId(e.target.value)} className="border rounded px-3 py-2 w-full" placeholder="A1234567" />
                        </div>
                      </div>
                    </Tabs.Content>

                    <Tabs.Content value="address" className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">Address line</label>
                        <input value={addrLine1} onChange={(e) => setAddrLine1(e.target.value)} className="border rounded px-3 py-2 w-full" placeholder="123 Street" />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium mb-1">City</label>
                          <input value={addrCity} onChange={(e) => setAddrCity(e.target.value)} className="border rounded px-3 py-2 w-full" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">Province</label>
                          <select value={addrState} onChange={(e) => setAddrState(e.target.value)} className="border rounded px-3 py-2 w-full">
                            <option value="">Select…</option>
                            <option value="Western Area">Western Area</option>
                            <option value="Northern Province">Northern Province</option>
                            <option value="Southern Province">Southern Province</option>
                            <option value="Eastern Province">Eastern Province</option>
                          </select>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium mb-1">Postal code</label>
                          <input value={addrPostal} onChange={(e) => setAddrPostal(e.target.value)} className="border rounded px-3 py-2 w-full" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">Country</label>
                          <input value={addrCountry} onChange={(e) => setAddrCountry(e.target.value)} className="border rounded px-3 py-2 w-full" placeholder="NG" />
                        </div>
                      </div>
                    </Tabs.Content>

                    <Tabs.Content value="message" className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">Welcome message (optional)</label>
                        <textarea value={message} onChange={(e) => setMessage(e.target.value)} className="border rounded px-3 py-2 w-full h-24" placeholder="Hi! This is your clinic on WhatsApp..." />
                      </div>
                    </Tabs.Content>

                    <div className="flex items-center justify-end gap-2">
                      <Dialog.Close asChild>
                        <button type="button" className="px-4 py-2 rounded border">Cancel</button>
                      </Dialog.Close>
                      <button type="submit" disabled={submitting} className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50">
                        {submitting ? "Submitting…" : "Create & Send WhatsApp"}
                      </button>
                    </div>
                  </form>
                </Tabs.Root>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </div>

      <div className="border rounded">
        <div className="grid grid-cols-4 text-xs font-medium uppercase text-gray-500 border-b px-3 py-2">
          <div>Name</div>
          <div>Phone</div>
          <div>Created</div>
          <div>Actions</div>
        </div>
        {loading ? (
          <div className="p-4 text-sm">Loading…</div>
        ) : items.length === 0 ? (
          <div className="p-4 text-sm text-gray-600">No patients yet.</div>
        ) : (
          items.map((p) => (
            <div key={p.id} className="grid grid-cols-4 items-center px-3 py-2 border-b last:border-b-0 text-sm">
              <div>{p.name || "-"}</div>
              <div>{p.phoneE164 || "-"}</div>
              <div className="text-xs text-gray-500">{new Date(p.createdAt).toLocaleString()}</div>
              <div className="text-xs">
                <a className="text-blue-600 hover:underline mr-3" href={`/dashboard/patients/${p.id}`}>View</a>
                <button
                  className="text-teal-700 hover:underline"
                  onClick={async ()=>{
                    try {
                      const res = await fetch(`/api/admin/patients/${p.id}/notify-access`, { method:'POST' })
                      const d = await res.json(); if (!res.ok) throw new Error(d?.error || 'Failed')
                      alert('Patient notified on WhatsApp')
                    } catch(e:any) { alert(e?.message || 'Failed') }
                  }}
                >Notify access</button>

                <button
                  className="text-red-600 hover:underline ml-3"
                  onClick={() => setConfirmDeleteId(p.id)}
                >Delete</button>
              </div>
            </div>
          ))
        )}
      </div>

      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setConfirmDeleteId(null)} />
          <div className="relative bg-white w-full max-w-md rounded shadow-lg p-4">
            <div className="mb-3">
              <h3 className="text-lg font-semibold">Delete patient?</h3>
              <p className="text-sm text-gray-600 mt-1">This will remove the patient record and associated data. This action cannot be undone.</p>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button onClick={() => setConfirmDeleteId(null)} className="px-4 py-2 rounded border">Cancel</button>
              <button onClick={onDeleteConfirmed} disabled={deletingId === confirmDeleteId} className="bg-red-600 text-white px-4 py-2 rounded disabled:opacity-50">
                {deletingId === confirmDeleteId ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
