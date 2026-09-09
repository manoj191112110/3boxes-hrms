'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function PurchaseOrdersPage() {
  const [pos, setPOs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  useEffect(() => { loadPOs(); }, []);
  async function loadPOs(): Promise<void> {
    setLoading(true);
    const token = localStorage.getItem('tb_token');
    const r = await fetch('/api/purchase-orders', { headers: { Authorization: `Bearer ${token}` } });
    setPOs((await r.json()).purchaseOrders || []); setLoading(false);
  }
  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Purchase Orders</h1>
          <p className="text-sm text-gray-600 mt-1">Multi-currency POs against vendors (REQ-VEN-08/10)</p>
        </div>
        <button onClick={() => setShowCreate(!showCreate)} className="px-4 py-2 bg-green-600 text-white rounded">+ New PO</button>
      </div>
      {showCreate && <CreatePOForm onCreated={() => { setShowCreate(false); loadPOs(); }} />}
      {loading ? <div className="text-gray-500">Loading...</div> : (
        <div className="overflow-x-auto bg-white border rounded">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase">
              <tr>
                <th className="px-3 py-2 text-left">PO #</th>
                <th className="px-3 py-2 text-left">Vendor</th>
                <th className="px-3 py-2 text-left">Project</th>
                <th className="px-3 py-2 text-right">Amount</th>
                <th className="px-3 py-2 text-right">Base (INR)</th>
                <th className="px-3 py-2 text-center">Status</th>
                <th className="px-3 py-2 text-right">Invoices</th>
              </tr>
            </thead>
            <tbody>
              {pos.map(p => (
                <tr key={p.id} className="border-t">
                  <td className="px-3 py-2 font-mono text-xs">{p.poNumber}</td>
                  <td className="px-3 py-2">{p.vendor?.name}</td>
                  <td className="px-3 py-2">{p.project?.name || '-'}</td>
                  <td className="px-3 py-2 text-right">{p.currency} {p.totalAmount?.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right text-gray-600">{p.baseAmount?.toLocaleString()}</td>
                  <td className="px-3 py-2 text-center"><span className="text-xs px-2 py-0.5 rounded bg-gray-100">{p.status}</span></td>
                  <td className="px-3 py-2 text-right">{p._count?.vendorInvoices || 0}</td>
                </tr>
              ))}
              {pos.length === 0 && <tr><td colSpan={7} className="text-center text-gray-500 py-8">No POs yet</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  function CreatePOForm({ onCreated }: { onCreated: () => void }) {
    const [form, setForm] = useState({ poNumber: '', vendorId: '', companyId: '', projectId: '', currency: 'INR', lineItems: [{ description: '', quantity: 1, unitPrice: 0 }] });
    const [vendors, setVendors] = useState<any[]>([]);
    const [companies, setCompanies] = useState<any[]>([]);
    useEffect(() => { (async () => {
      const token = localStorage.getItem('tb_token');
      const [v, c] = await Promise.all([
        fetch('/api/vendors?limit=100', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/companies', { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      setVendors((await v.json()).vendors || []);
      setCompanies((await c.json()).companies || []);
    })(); }, []);
    function addLine() { setForm({ ...form, lineItems: [...form.lineItems, { description: '', quantity: 1, unitPrice: 0 }] }); }
    function updateLine(i: number, field: string, val: any) { const li = [...form.lineItems]; li[i] = { ...li[i], [field]: val }; setForm({ ...form, lineItems: li }); }
    async function submit(e: any) {
      e.preventDefault();
      const token = localStorage.getItem('tb_token');
      const r = await fetch('/api/purchase-orders', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(form) });
      if (r.ok) onCreated(); else alert((await r.json()).error);
    }
    return (
      <form onSubmit={submit} className="bg-white border rounded p-4 space-y-3">
        <div className="grid grid-cols-4 gap-2">
          <input placeholder="PO Number" required value={form.poNumber} onChange={e => setForm({...form, poNumber: e.target.value})} className="border rounded px-2 py-1" />
          <select required value={form.vendorId} onChange={e => setForm({...form, vendorId: e.target.value})} className="border rounded px-2 py-1">
            <option value="">Vendor...</option>
            {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
          <select required value={form.companyId} onChange={e => setForm({...form, companyId: e.target.value})} className="border rounded px-2 py-1">
            <option value="">Company...</option>
            {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={form.currency} onChange={e => setForm({...form, currency: e.target.value})} className="border rounded px-2 py-1">
            <option>INR</option><option>USD</option><option>EUR</option><option>GBP</option><option>AED</option>
          </select>
        </div>
        <div className="space-y-2">
          {form.lineItems.map((li, i) => (
            <div key={i} className="grid grid-cols-12 gap-2">
              <input placeholder="Description" required value={li.description} onChange={e => updateLine(i, 'description', e.target.value)} className="col-span-6 border rounded px-2 py-1" />
              <input type="number" step="0.01" placeholder="Qty" required value={li.quantity} onChange={e => updateLine(i, 'quantity', parseFloat(e.target.value))} className="col-span-2 border rounded px-2 py-1" />
              <input type="number" step="0.01" placeholder="Unit Price" required value={li.unitPrice} onChange={e => updateLine(i, 'unitPrice', parseFloat(e.target.value))} className="col-span-2 border rounded px-2 py-1" />
              <div className="col-span-2 text-right text-sm pt-2">{(li.quantity * li.unitPrice).toFixed(2)}</div>
            </div>
          ))}
          <button type="button" onClick={addLine} className="text-sm text-green-600">+ Add line item</button>
        </div>
        <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded">Create PO</button>
      </form>
    );
  }
}
