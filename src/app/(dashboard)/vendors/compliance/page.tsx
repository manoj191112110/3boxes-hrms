'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function VendorCompliancePage() {
  const [vendors, setVendors] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [docs, setDocs] = useState<any[]>([]);
  const [showScan, setShowScan] = useState(false);

  useEffect(() => { loadVendors(); }, []);
  async function loadVendors(): Promise<void> {
    const token = localStorage.getItem('tb_token');
    const r = await fetch('/api/vendors?limit=100', { headers: { Authorization: `Bearer ${token}` } });
    setVendors((await r.json()).vendors || []);
  }
  async function loadDocs(vendorId: string) {
    const token = localStorage.getItem('tb_token');
    const r = await fetch(`/api/vendors/${vendorId}/documents`, { headers: { Authorization: `Bearer ${token}` } });
    setDocs((await r.json()).documents || []);
  }
  async function runScan(): Promise<void> {
    setShowScan(true);
    const token = localStorage.getItem('tb_token');
    const r = await fetch('/api/vendors/compliance-scan', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    const d = await r.json();
    alert(`Compliance scan complete: ${d.total} reminders sent/expired flagged.`);
    setShowScan(false);
    if (selected) loadDocs(selected.id);
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Vendor Compliance Tracker</h1>
          <p className="text-sm text-gray-600 mt-1">Track insurance, DPA, labor licenses with expiry alerts (REQ-VEN-02/03)</p>
        </div>
        <button onClick={runScan} disabled={showScan} className="px-4 py-2 bg-teal-600 text-white rounded hover:bg-teal-700 disabled:opacity-50">
          {showScan ? 'Scanning...' : '⚡ Run AI Compliance Scan'}
        </button>
      </div>

      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-3 bg-white border rounded-lg p-3 max-h-[70vh] overflow-y-auto">
          <input placeholder="Search vendors..." className="w-full border rounded px-2 py-1 mb-2 text-sm" onChange={e => loadVendors()} />
          {vendors.map(v => (
            <button key={v.id} onClick={() => { setSelected(v); loadDocs(v.id); }} className={`w-full text-left px-3 py-2 rounded text-sm ${selected?.id === v.id ? 'bg-green-50 border-l-4 border-green-600' : 'hover:bg-gray-50'}`}>
              <div className="font-medium">{v.name}</div>
              <div className="text-xs text-gray-500">{v.specialization || '-'}</div>
            </button>
          ))}
        </div>
        <div className="col-span-9 bg-white border rounded-lg p-4">
          {!selected ? <div className="text-gray-500 text-center py-12">Select a vendor to view documents</div> : (
            <>
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-semibold text-lg">{selected.name} — Documents</h2>
                <AddDocForm vendorId={selected.id} onAdded={() => loadDocs(selected.id)} />
              </div>
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-xs uppercase">
                  <tr>
                    <th className="px-3 py-2 text-left">Document</th>
                    <th className="px-3 py-2 text-left">Type</th>
                    <th className="px-3 py-2 text-right">Expiry</th>
                    <th className="px-3 py-2 text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {docs.map(d => (
                    <tr key={d.id} className="border-t">
                      <td className="px-3 py-2">{d.name}</td>
                      <td className="px-3 py-2"><span className="text-xs bg-gray-100 px-2 py-0.5 rounded">{d.type}</span></td>
                      <td className="px-3 py-2 text-right">{d.expiryDate ? new Date(d.expiryDate).toLocaleDateString() : '-'}</td>
                      <td className="px-3 py-2 text-center">
                        <span className={`text-xs px-2 py-1 rounded ${d.status === 'expired' ? 'bg-red-100 text-red-700' : d.status === 'expiring' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
                          {d.status === 'expiring' ? `${d.daysToExpiry}d left` : d.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {docs.length === 0 && <tr><td colSpan={4} className="text-center text-gray-500 py-8">No documents tracked</td></tr>}
                </tbody>
              </table>
            </>
          )}
        </div>
      </div>
    </div>
  );

  function AddDocForm({ vendorId, onAdded }: { vendorId: string; onAdded: () => void }) {
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState({ name: '', type: 'insurance', expiryDate: '' });
    async function submit(e: any) {
      e.preventDefault();
      const token = localStorage.getItem('tb_token');
      await fetch(`/api/vendors/${vendorId}/documents`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(form) });
      setOpen(false); setForm({ name: '', type: 'insurance', expiryDate: '' }); onAdded();
    }
    if (!open) return <button onClick={() => setOpen(true)} className="text-sm px-3 py-1 bg-green-600 text-white rounded">+ Add</button>;
    return (
      <form onSubmit={submit} className="flex gap-2 items-end">
        <input placeholder="Doc name" required value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="border rounded px-2 py-1 text-sm" />
        <select value={form.type} onChange={e => setForm({...form, type: e.target.value})} className="border rounded px-2 py-1 text-sm">
          <option value="insurance">Insurance</option>
          <option value="dpa">DPA (GDPR)</option>
          <option value="labor_license">Labor License</option>
          <option value="nda">NDA</option>
          <option value="iso">ISO Cert</option>
          <option value="other">Other</option>
        </select>
        <input type="date" value={form.expiryDate} onChange={e => setForm({...form, expiryDate: e.target.value})} className="border rounded px-2 py-1 text-sm" />
        <button type="submit" className="px-3 py-1 bg-green-600 text-white text-sm rounded">Save</button>
        <button type="button" onClick={() => setOpen(false)} className="px-3 py-1 bg-gray-200 text-sm rounded">Cancel</button>
      </form>
    );
  }
}
