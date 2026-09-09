'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function VendorInvoicesPage() {
  const [vis, setVis] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  useEffect(() => { loadVIs(); }, []);
  async function loadVIs(): Promise<void> {
    setLoading(true);
    const token = localStorage.getItem('tb_token');
    const r = await fetch('/api/vendor-invoices', { headers: { Authorization: `Bearer ${token}` } });
    setVis((await r.json()).vendorInvoices || []); setLoading(false);
  }
  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Vendor Invoices (AP)</h1>
          <p className="text-sm text-gray-600 mt-1">3-way matching: PO ↔ Invoice ↔ Timesheet (REQ-VEN-09/10)</p>
        </div>
        <button onClick={() => setShowCreate(!showCreate)} className="px-4 py-2 bg-green-600 text-white rounded">+ New Vendor Invoice</button>
      </div>
      {showCreate && <CreateVIForm onCreated={() => { setShowCreate(false); loadVIs(); }} />}
      {loading ? <div className="text-gray-500">Loading...</div> : (
        <div className="overflow-x-auto bg-white border rounded">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase">
              <tr>
                <th className="px-3 py-2 text-left">Invoice #</th>
                <th className="px-3 py-2 text-left">Vendor</th>
                <th className="px-3 py-2 text-left">PO #</th>
                <th className="px-3 py-2 text-right">Amount</th>
                <th className="px-3 py-2 text-center">Match Status</th>
                <th className="px-3 py-2 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {vis.map(v => (
                <tr key={v.id} className="border-t">
                  <td className="px-3 py-2 font-mono text-xs">{v.invoiceNumber}</td>
                  <td className="px-3 py-2">{v.vendor?.name}</td>
                  <td className="px-3 py-2 font-mono text-xs">{v.po?.poNumber || '-'}</td>
                  <td className="px-3 py-2 text-right">{v.currency} {v.totalAmount?.toLocaleString()}</td>
                  <td className="px-3 py-2 text-center">
                    {v.matchedJson ? (
                      <div className="text-xs space-x-1">
                        <span className={v.matchedJson.poMatched ? 'text-green-600' : 'text-red-600'}>{v.matchedJson.poMatched ? '✓ PO' : '✗ PO'}</span>
                        <span className={v.matchedJson.timesheetMatched ? 'text-green-600' : 'text-red-600'}>{v.matchedJson.timesheetMatched ? '✓ TS' : '✗ TS'}</span>
                      </div>
                    ) : <span className="text-xs text-gray-400">no match</span>}
                  </td>
                  <td className="px-3 py-2 text-center"><span className={`text-xs px-2 py-0.5 rounded ${v.status === 'matched' ? 'bg-green-100 text-green-700' : v.status === 'mismatched' ? 'bg-red-100 text-red-700' : 'bg-gray-100'}`}>{v.status}</span></td>
                </tr>
              ))}
              {vis.length === 0 && <tr><td colSpan={6} className="text-center text-gray-500 py-8">No vendor invoices yet</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  function CreateVIForm({ onCreated }: { onCreated: () => void }) {
    const [form, setForm] = useState({ vendorId: '', poId: '', invoiceNumber: '', invoiceDate: '', currency: 'INR', totalAmount: 0, autoMatch: true });
    const [vendors, setVendors] = useState<any[]>([]);
    const [pos, setPOs] = useState<any[]>([]);
    useEffect(() => { (async () => {
      const token = localStorage.getItem('tb_token');
      const v = await fetch('/api/vendors?limit=100', { headers: { Authorization: `Bearer ${token}` } });
      setVendors((await v.json()).vendors || []);
      const p = await fetch('/api/purchase-orders', { headers: { Authorization: `Bearer ${token}` } });
      setPOs((await p.json()).purchaseOrders || []);
    })(); }, []);
    async function submit(e: any) {
      e.preventDefault();
      const token = localStorage.getItem('tb_token');
      const r = await fetch('/api/vendor-invoices', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(form) });
      if (r.ok) onCreated(); else alert((await r.json()).error);
    }
    return (
      <form onSubmit={submit} className="bg-white border rounded p-4 space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <select required value={form.vendorId} onChange={e => setForm({...form, vendorId: e.target.value})} className="border rounded px-2 py-1">
            <option value="">Vendor...</option>
            {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
          <select value={form.poId} onChange={e => setForm({...form, poId: e.target.value})} className="border rounded px-2 py-1">
            <option value="">PO (optional, for 3-way match)...</option>
            {pos.filter((p: any) => !form.vendorId || p.vendorId === form.vendorId).map(p => <option key={p.id} value={p.id}>{p.poNumber} — {p.currency} {p.totalAmount}</option>)}
          </select>
          <input placeholder="Invoice #" required value={form.invoiceNumber} onChange={e => setForm({...form, invoiceNumber: e.target.value})} className="border rounded px-2 py-1" />
          <input type="date" required value={form.invoiceDate} onChange={e => setForm({...form, invoiceDate: e.target.value})} className="border rounded px-2 py-1" />
          <input type="number" step="0.01" placeholder="Amount" required value={form.totalAmount} onChange={e => setForm({...form, totalAmount: parseFloat(e.target.value)})} className="border rounded px-2 py-1" />
          <select value={form.currency} onChange={e => setForm({...form, currency: e.target.value})} className="border rounded px-2 py-1">
            <option>INR</option><option>USD</option><option>EUR</option><option>GBP</option><option>AED</option>
          </select>
        </div>
        <label className="text-sm flex items-center gap-2"><input type="checkbox" checked={form.autoMatch} onChange={e => setForm({...form, autoMatch: e.target.checked})} /> Run 3-way match automatically</label>
        <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded">Create & Match</button>
      </form>
    );
  }
}
