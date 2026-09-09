/**
 * Writes UI dashboard pages for new modules:
 *   /clients/sow          - SOW list + create
 *   /clients/[id]/insights - AI churn + margin
 *   /vendors/[id]/compliance - Documents + expiry
 *   /vendors/[id]/staff    - Vendor staff
 *   /purchase-orders       - PO list + create
 *   /vendor-invoices       - AP invoices + 3-way match
 *   /marketplace           - Marketplace hub
 *   /marketplace/wallet    - Wallet
 *   /marketplace/catalog   - Shopping catalog
 *   /marketplace/insurance - Insurance top-up + claims
 *   /marketplace/ewa       - EWA / salary advance
 *   /marketplace/loans     - Loan marketplace
 *   /marketplace/gifting   - Gifting + recognition
 *   /marketplace/insights  - AI stress + fraud insights (admin)
 *   /client-portal/login   - External client login
 *   /client-portal/dashboard
 *
 * Run: node scripts/build-cv-mkt-pages.js
 */
const fs = require('fs');
const path = require('path');
const ROOT = '/home/z/my-project';

function writePage(filePath, content) {
  if (fs.existsSync(filePath)) { console.log(`[skip] ${filePath}`); return; }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
  console.log(`[write] ${filePath}`);
}

// Common imports
const HEADER = `'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
`;

// ── 1. SOW List Page ───────────────────────────────────────────────────────
writePage(`${ROOT}/src/app/(dashboard)/clients/sow/page.tsx`, `${HEADER}
export default function SOWPage() {
  const [sows, setSows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => { loadSOWs(); }, []);
  async function loadSOWs() {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const r = await fetch('/api/clients/sow', { headers: { Authorization: \`Bearer \${token}\` } });
      const d = await r.json();
      setSows(d.sows || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  async function approve(id) {
    if (!confirm('Approve this SOW? This will auto-create a Project shell.')) return;
    const token = localStorage.getItem('token');
    const r = await fetch(\`/api/clients/sow/\${id}/approve\`, { method: 'POST', headers: { Authorization: \`Bearer \${token}\` } });
    if (r.ok) { alert('SOW approved — project created'); loadSOWs(); }
    else { const e = await r.json(); alert(e.error || 'Failed'); }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Statements of Work (SOW)</h1>
          <p className="text-sm text-gray-600 mt-1">AI-parsed SOWs · auto-generate project shells on approval (REQ-CLT-04/05)</p>
        </div>
        <button onClick={() => setShowCreate(!showCreate)} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
          {showCreate ? 'Close' : '+ New SOW'}
        </button>
      </div>

      {showCreate && <CreateSOWForm onCreated={() => { setShowCreate(false); loadSOWs(); }} />}

      {loading ? <div className="text-gray-500">Loading...</div> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sows.map(s => (
            <div key={s.id} className="bg-white border rounded-lg p-4 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold">{s.title}</h3>
                  <p className="text-xs text-gray-500">{s.client?.name}</p>
                </div>
                <span className={\`text-xs px-2 py-1 rounded \${s.status === 'approved' ? 'bg-green-100 text-green-700' : s.status === 'ai_parsed' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'}\`}>{s.status}</span>
              </div>
              <div className="mt-3 space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Value:</span><span className="font-medium">{s.currency} {(s.totalValue || 0).toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Headcount:</span><span className="font-medium">{s.maxHeadcount || '-'}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">AI Confidence:</span><span className="font-medium">{((s.aiConfidence || 0) * 100).toFixed(0)}%</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Start:</span><span className="font-medium">{s.startDate ? new Date(s.startDate).toLocaleDateString() : '-'}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">End:</span><span className="font-medium">{s.endDate ? new Date(s.endDate).toLocaleDateString() : '-'}</span></div>
                {s.project && <div className="flex justify-between"><span className="text-gray-500">Project:</span><Link href={\`/projects/\${s.project.id}\`} className="text-blue-600 hover:underline">{s.project.name}</Link></div>}
              </div>
              {s.status === 'ai_parsed' && (
                <button onClick={() => approve(s.id)} className="mt-3 w-full px-3 py-1.5 bg-green-600 text-white text-sm rounded hover:bg-green-700">Approve & Generate Project</button>
              )}
            </div>
          ))}
          {sows.length === 0 && <div className="col-span-full text-center text-gray-500 py-12">No SOWs yet. Click "+ New SOW" to upload one.</div>}
        </div>
      )}
    </div>
  );

  function CreateSOWForm({ onCreated }) {
    const [form, setForm] = useState({ clientId: '', title: '', fileName: '', rawText: '', currency: 'INR' });
    const [clients, setClients] = useState([]);
    useEffect(() => { (async () => {
      const token = localStorage.getItem('token');
      const r = await fetch('/api/clients?limit=100', { headers: { Authorization: \`Bearer \${token}\` } });
      const d = await r.json(); setClients(d.clients || []);
    })(); }, []);
    async function submit(e) {
      e.preventDefault();
      const token = localStorage.getItem('token');
      const r = await fetch('/api/clients/sow', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: \`Bearer \${token}\` }, body: JSON.stringify(form) });
      if (r.ok) onCreated();
      else { const e = await r.json(); alert(e.error); }
    }
    return (
      <form onSubmit={submit} className="bg-white border rounded-lg p-4 space-y-3">
        <h3 className="font-semibold">Upload SOW (AI parses raw text automatically)</h3>
        <select required value={form.clientId} onChange={e => setForm({...form, clientId: e.target.value})} className="w-full border rounded px-3 py-2">
          <option value="">Select client...</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input placeholder="SOW title" required value={form.title} onChange={e => setForm({...form, title: e.target.value})} className="w-full border rounded px-3 py-2" />
        <input placeholder="File name (e.g., microsoft-sow-q1.pdf)" value={form.fileName} onChange={e => setForm({...form, fileName: e.target.value})} className="w-full border rounded px-3 py-2" />
        <textarea placeholder="Paste SOW raw text here — AI extracts dates, headcount, bill rates, value" rows={6} value={form.rawText} onChange={e => setForm({...form, rawText: e.target.value})} className="w-full border rounded px-3 py-2 font-mono text-xs" />
        <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">AI Parse & Save</button>
      </form>
    );
  }
}
`);

// ── 2. Client Insights Page (Churn + Margin) ──────────────────────────────
writePage(`${ROOT}/src/app/(dashboard)/clients/insights/page.tsx`, `${HEADER}
export default function ClientInsightsPage() {
  const [tab, setTab] = useState<'churn' | 'margin'>('churn');
  const [churn, setChurn] = useState([]);
  const [margin, setMargin] = useState([]);
  const [loading, setLoading] = useState(false);

  async function runChurn() {
    setLoading(true);
    const token = localStorage.getItem('token');
    const r = await fetch('/api/clients/ai/churn', { headers: { Authorization: \`Bearer \${token}\` } });
    setChurn((await r.json()).results || []);
    setLoading(false);
  }
  async function runMargin() {
    setLoading(true);
    const token = localStorage.getItem('token');
    const r = await fetch('/api/clients/ai/margin', { headers: { Authorization: \`Bearer \${token}\` } });
    setMargin((await r.json()).results || []);
    setLoading(false);
  }
  useEffect(() => { if (tab === 'churn') runChurn(); else runMargin(); }, [tab]);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">AI Client Analytics</h1>
        <p className="text-sm text-gray-600 mt-1">Churn prediction (REQ-AI-CLT-01) & Margin analysis (REQ-AI-CLT-02)</p>
      </div>
      <div className="flex gap-2">
        <button onClick={() => setTab('churn')} className={\`px-4 py-2 rounded \${tab === 'churn' ? 'bg-blue-600 text-white' : 'bg-gray-100'}\`}>Churn Risk</button>
        <button onClick={() => setTab('margin')} className={\`px-4 py-2 rounded \${tab === 'margin' ? 'bg-blue-600 text-white' : 'bg-gray-100'}\`}>Margin Analysis</button>
      </div>
      {loading && <div className="text-gray-500">Running AI analysis...</div>}

      {tab === 'churn' && !loading && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {churn.map(c => (
            <div key={c.clientId} className="bg-white border rounded-lg p-4 shadow-sm">
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-semibold">{c.clientName}</h3>
                <span className={\`text-xs px-2 py-1 rounded \${c.riskLevel === 'high' ? 'bg-red-100 text-red-700' : c.riskLevel === 'medium' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}\`}>{c.riskLevel}</span>
              </div>
              <div className="text-3xl font-bold text-gray-800">{(c.riskScore * 100).toFixed(0)}<span className="text-sm">%</span></div>
              <div className="mt-3 text-xs text-gray-600 space-y-1">
                <div>Overdue invoices: <b>{c.factors.overdueCount}</b></div>
                <div>Avg delay: <b>{c.factors.avgDelayDays}d</b></div>
                <div>Stale projects: <b>{c.factors.staleProjects}</b></div>
              </div>
              <p className="mt-3 text-xs text-gray-700 italic">{c.recommendations}</p>
            </div>
          ))}
        </div>
      )}

      {tab === 'margin' && !loading && (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border rounded">
            <thead className="bg-gray-50 text-xs uppercase">
              <tr>
                <th className="px-3 py-2 text-left">Client</th>
                <th className="px-3 py-2 text-right">Revenue</th>
                <th className="px-3 py-2 text-right">Cost (Emp)</th>
                <th className="px-3 py-2 text-right">Cost (Vendor)</th>
                <th className="px-3 py-2 text-right">Gross Margin</th>
                <th className="px-3 py-2 text-right">Margin %</th>
              </tr>
            </thead>
            <tbody>
              {margin.map(m => (
                <tr key={m.clientId} className="border-t text-sm">
                  <td className="px-3 py-2">{m.clientName}</td>
                  <td className="px-3 py-2 text-right">{m.revenueBase.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right text-red-600">{m.costEmployee.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right text-red-600">{m.costVendor.toLocaleString()}</td>
                  <td className={\`px-3 py-2 text-right font-semibold \${m.grossMargin >= 0 ? 'text-green-600' : 'text-red-600'}\`}>{m.grossMargin.toLocaleString()}</td>
                  <td className={\`px-3 py-2 text-right font-bold \${m.marginPct >= 20 ? 'text-green-600' : m.marginPct >= 0 ? 'text-yellow-600' : 'text-red-600'}\`}>{m.marginPct.toFixed(1)}%</td>
                </tr>
              ))}
              {margin.length === 0 && <tr><td colSpan={6} className="text-center text-gray-500 py-8">No data. Click "Run" to analyze.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
`);

// ── 3. Vendor Compliance Page ─────────────────────────────────────────────
writePage(`${ROOT}/src/app/(dashboard)/vendors/compliance/page.tsx`, `${HEADER}
export default function VendorCompliancePage() {
  const [vendors, setVendors] = useState([]);
  const [selected, setSelected] = useState(null);
  const [docs, setDocs] = useState([]);
  const [showScan, setShowScan] = useState(false);

  useEffect(() => { loadVendors(); }, []);
  async function loadVendors() {
    const token = localStorage.getItem('token');
    const r = await fetch('/api/vendors?limit=100', { headers: { Authorization: \`Bearer \${token}\` } });
    setVendors((await r.json()).vendors || []);
  }
  async function loadDocs(vendorId) {
    const token = localStorage.getItem('token');
    const r = await fetch(\`/api/vendors/\${vendorId}/documents\`, { headers: { Authorization: \`Bearer \${token}\` } });
    setDocs((await r.json()).documents || []);
  }
  async function runScan() {
    setShowScan(true);
    const token = localStorage.getItem('token');
    const r = await fetch('/api/vendors/compliance-scan', { method: 'POST', headers: { Authorization: \`Bearer \${token}\` } });
    const d = await r.json();
    alert(\`Compliance scan complete: \${d.total} reminders sent/expired flagged.\`);
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
        <button onClick={runScan} disabled={showScan} className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50">
          {showScan ? 'Scanning...' : '⚡ Run AI Compliance Scan'}
        </button>
      </div>

      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-3 bg-white border rounded-lg p-3 max-h-[70vh] overflow-y-auto">
          <input placeholder="Search vendors..." className="w-full border rounded px-2 py-1 mb-2 text-sm" onChange={e => loadVendors()} />
          {vendors.map(v => (
            <button key={v.id} onClick={() => { setSelected(v); loadDocs(v.id); }} className={\`w-full text-left px-3 py-2 rounded text-sm \${selected?.id === v.id ? 'bg-blue-50 border-l-4 border-blue-600' : 'hover:bg-gray-50'}\`}>
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
                        <span className={\`text-xs px-2 py-1 rounded \${d.status === 'expired' ? 'bg-red-100 text-red-700' : d.status === 'expiring' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}\`}>
                          {d.status === 'expiring' ? \`\${d.daysToExpiry}d left\` : d.status}
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

  function AddDocForm({ vendorId, onAdded }) {
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState({ name: '', type: 'insurance', expiryDate: '' });
    async function submit(e) {
      e.preventDefault();
      const token = localStorage.getItem('token');
      await fetch(\`/api/vendors/\${vendorId}/documents\`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: \`Bearer \${token}\` }, body: JSON.stringify(form) });
      setOpen(false); setForm({ name: '', type: 'insurance', expiryDate: '' }); onAdded();
    }
    if (!open) return <button onClick={() => setOpen(true)} className="text-sm px-3 py-1 bg-blue-600 text-white rounded">+ Add</button>;
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
`);

// ── 4. Purchase Orders Page ───────────────────────────────────────────────
writePage(`${ROOT}/src/app/(dashboard)/purchase-orders/page.tsx`, `${HEADER}
export default function PurchaseOrdersPage() {
  const [pos, setPOs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  useEffect(() => { loadPOs(); }, []);
  async function loadPOs() {
    setLoading(true);
    const token = localStorage.getItem('token');
    const r = await fetch('/api/purchase-orders', { headers: { Authorization: \`Bearer \${token}\` } });
    setPOs((await r.json()).purchaseOrders || []); setLoading(false);
  }
  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Purchase Orders</h1>
          <p className="text-sm text-gray-600 mt-1">Multi-currency POs against vendors (REQ-VEN-08/10)</p>
        </div>
        <button onClick={() => setShowCreate(!showCreate)} className="px-4 py-2 bg-blue-600 text-white rounded">+ New PO</button>
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

  function CreatePOForm({ onCreated }) {
    const [form, setForm] = useState({ poNumber: '', vendorId: '', companyId: '', projectId: '', currency: 'INR', lineItems: [{ description: '', quantity: 1, unitPrice: 0 }] });
    const [vendors, setVendors] = useState([]);
    const [companies, setCompanies] = useState([]);
    useEffect(() => { (async () => {
      const token = localStorage.getItem('token');
      const [v, c] = await Promise.all([
        fetch('/api/vendors?limit=100', { headers: { Authorization: \`Bearer \${token}\` } }),
        fetch('/api/companies', { headers: { Authorization: \`Bearer \${token}\` } }),
      ]);
      setVendors((await v.json()).vendors || []);
      setCompanies((await c.json()).companies || []);
    })(); }, []);
    function addLine() { setForm({ ...form, lineItems: [...form.lineItems, { description: '', quantity: 1, unitPrice: 0 }] }); }
    function updateLine(i, field, val) { const li = [...form.lineItems]; li[i] = { ...li[i], [field]: val }; setForm({ ...form, lineItems: li }); }
    async function submit(e) {
      e.preventDefault();
      const token = localStorage.getItem('token');
      const r = await fetch('/api/purchase-orders', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: \`Bearer \${token}\` }, body: JSON.stringify(form) });
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
          <button type="button" onClick={addLine} className="text-sm text-blue-600">+ Add line item</button>
        </div>
        <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">Create PO</button>
      </form>
    );
  }
}
`);

// ── 5. Vendor Invoices (AP) Page ──────────────────────────────────────────
writePage(`${ROOT}/src/app/(dashboard)/vendor-invoices/page.tsx`, `${HEADER}
export default function VendorInvoicesPage() {
  const [vis, setVis] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  useEffect(() => { loadVIs(); }, []);
  async function loadVIs() {
    setLoading(true);
    const token = localStorage.getItem('token');
    const r = await fetch('/api/vendor-invoices', { headers: { Authorization: \`Bearer \${token}\` } });
    setVis((await r.json()).vendorInvoices || []); setLoading(false);
  }
  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Vendor Invoices (AP)</h1>
          <p className="text-sm text-gray-600 mt-1">3-way matching: PO ↔ Invoice ↔ Timesheet (REQ-VEN-09/10)</p>
        </div>
        <button onClick={() => setShowCreate(!showCreate)} className="px-4 py-2 bg-blue-600 text-white rounded">+ New Vendor Invoice</button>
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
                  <td className="px-3 py-2 text-center"><span className={\`text-xs px-2 py-0.5 rounded \${v.status === 'matched' ? 'bg-green-100 text-green-700' : v.status === 'mismatched' ? 'bg-red-100 text-red-700' : 'bg-gray-100'}\`}>{v.status}</span></td>
                </tr>
              ))}
              {vis.length === 0 && <tr><td colSpan={6} className="text-center text-gray-500 py-8">No vendor invoices yet</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  function CreateVIForm({ onCreated }) {
    const [form, setForm] = useState({ vendorId: '', poId: '', invoiceNumber: '', invoiceDate: '', currency: 'INR', totalAmount: 0, autoMatch: true });
    const [vendors, setVendors] = useState([]);
    const [pos, setPOs] = useState([]);
    useEffect(() => { (async () => {
      const token = localStorage.getItem('token');
      const v = await fetch('/api/vendors?limit=100', { headers: { Authorization: \`Bearer \${token}\` } });
      setVendors((await v.json()).vendors || []);
      const p = await fetch('/api/purchase-orders', { headers: { Authorization: \`Bearer \${token}\` } });
      setPOs((await p.json()).purchaseOrders || []);
    })(); }, []);
    async function submit(e) {
      e.preventDefault();
      const token = localStorage.getItem('token');
      const r = await fetch('/api/vendor-invoices', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: \`Bearer \${token}\` }, body: JSON.stringify(form) });
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
            {pos.filter(p => !form.vendorId || p.vendorId === form.vendorId).map(p => <option key={p.id} value={p.id}>{p.poNumber} — {p.currency} {p.totalAmount}</option>)}
          </select>
          <input placeholder="Invoice #" required value={form.invoiceNumber} onChange={e => setForm({...form, invoiceNumber: e.target.value})} className="border rounded px-2 py-1" />
          <input type="date" required value={form.invoiceDate} onChange={e => setForm({...form, invoiceDate: e.target.value})} className="border rounded px-2 py-1" />
          <input type="number" step="0.01" placeholder="Amount" required value={form.totalAmount} onChange={e => setForm({...form, totalAmount: parseFloat(e.target.value)})} className="border rounded px-2 py-1" />
          <select value={form.currency} onChange={e => setForm({...form, currency: e.target.value})} className="border rounded px-2 py-1">
            <option>INR</option><option>USD</option><option>EUR</option><option>GBP</option><option>AED</option>
          </select>
        </div>
        <label className="text-sm flex items-center gap-2"><input type="checkbox" checked={form.autoMatch} onChange={e => setForm({...form, autoMatch: e.target.checked})} /> Run 3-way match automatically</label>
        <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">Create & Match</button>
      </form>
    );
  }
}
`);

// ── 6. Marketplace Hub ────────────────────────────────────────────────────
writePage(`${ROOT}/src/app/(dashboard)/marketplace/page.tsx`, `${HEADER}
export default function MarketplaceHub() {
  const tiles = [
    { href: '/marketplace/wallet', title: 'My Wallet', desc: 'Multi-bucket wallet · Co-pay · Tax-exempt categories', icon: '👛', color: 'from-purple-500 to-pink-500' },
    { href: '/marketplace/catalog', title: 'Corporate Catalog', desc: 'Sodexo · Xoxoday · Amazon Business · Corporate rates', icon: '🛍️', color: 'from-blue-500 to-cyan-500' },
    { href: '/marketplace/insurance', title: 'Insurance Top-Up', desc: 'Group + voluntary · AI claims assistant · Payroll deduction', icon: '🛡️', color: 'from-green-500 to-emerald-500' },
    { href: '/marketplace/ewa', title: 'Earned Wage Access', desc: 'Real-time earned-to-date · Wagestream/EarnIn API · 70% cap', icon: '💸', color: 'from-yellow-500 to-orange-500' },
    { href: '/marketplace/loans', title: 'Loan Marketplace', desc: 'Pre-approved offers · e-sign consent · Garnishment', icon: '🏦', color: 'from-indigo-500 to-blue-500' },
    { href: '/marketplace/gifting', title: 'Gifting & Rewards', desc: 'Milestone automation · P2P kudos · Wallet redemption', icon: '🎁', color: 'from-red-500 to-pink-500' },
    { href: '/marketplace/insights', title: 'AI Insights (Admin)', desc: 'Financial stress · Fraud patterns · Wallet audit trail', icon: '🧠', color: 'from-gray-700 to-gray-900' },
  ];
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Marketplace & Financial Wellness</h1>
        <p className="text-sm text-gray-600 mt-1">Corporate Super-App · Multi-currency · Multi-tenant · AI-curated</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tiles.map(t => (
          <Link key={t.href} href={t.href} className="block group">
            <div className={\`bg-gradient-to-br \${t.color} text-white rounded-lg p-5 shadow-lg group-hover:shadow-2xl transition-shadow\`}>
              <div className="text-3xl mb-2">{t.icon}</div>
              <h3 className="text-lg font-bold">{t.title}</h3>
              <p className="text-xs opacity-90 mt-1">{t.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
`);

// ── 7. Wallet Page ────────────────────────────────────────────────────────
writePage(`${ROOT}/src/app/(dashboard)/marketplace/wallet/page.tsx`, `${HEADER}
export default function WalletPage() {
  const [wallet, setWallet] = useState(null);
  const [employeeId, setEmployeeId] = useState('');
  useEffect(() => {
    const u = JSON.parse(localStorage.getItem('user') || '{}');
    if (u.employeeId) { setEmployeeId(u.employeeId); loadWallet(u.employeeId); }
  }, []);
  async function loadWallet(empId) {
    const token = localStorage.getItem('token');
    const r = await fetch(\`/api/wallet?employeeId=\${empId}\`, { headers: { Authorization: \`Bearer \${token}\` } });
    setWallet((await r.json()).wallet);
  }
  if (!wallet) return <div className="p-6 text-gray-500">Loading wallet...</div>;
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Wallet</h1>
        <p className="text-sm text-gray-600 mt-1">Multi-bucket · Co-pay logic · Tax-optimized (REQ-MKT-01/02/03/04)</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {wallet.buckets?.map(b => (
          <div key={b.id} className="bg-white border rounded-lg p-4 shadow-sm">
            <div className="flex justify-between items-start">
              <h3 className="font-semibold capitalize">{b.category.replace(/_/g, ' ')}</h3>
              <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">Employer {b.employerCoPayPct}%</span>
            </div>
            <div className="text-3xl font-bold text-gray-800 mt-2">{wallet.currency} {b.balance.toLocaleString()}</div>
            {b.expiresAt && <div className="text-xs text-gray-500 mt-1">Expires: {new Date(b.expiresAt).toLocaleDateString()}</div>}
          </div>
        ))}
      </div>
      <div className="bg-white border rounded-lg p-4">
        <h3 className="font-semibold mb-3">Recent Transactions</h3>
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase">
            <tr><th className="px-3 py-2 text-left">Type</th><th className="px-3 py-2 text-left">Description</th><th className="px-3 py-2 text-right">Amount</th><th className="px-3 py-2 text-right">Date</th></tr>
          </thead>
          <tbody>
            {wallet.transactions?.map(t => (
              <tr key={t.id} className="border-t">
                <td className="px-3 py-2"><span className={\`text-xs px-2 py-0.5 rounded \${t.type === 'credit' ? 'bg-green-100 text-green-700' : t.type === 'debit' ? 'bg-red-100 text-red-700' : 'bg-gray-100'}\`}>{t.type}</span></td>
                <td className="px-3 py-2">{t.description || '-'}</td>
                <td className={\`px-3 py-2 text-right font-medium \${t.type === 'credit' ? 'text-green-600' : 'text-red-600'}\`}>{t.type === 'debit' ? '-' : '+'}{t.amount}</td>
                <td className="px-3 py-2 text-right text-xs text-gray-500">{new Date(t.createdAt).toLocaleString()}</td>
              </tr>
            ))}
            {(!wallet.transactions || wallet.transactions.length === 0) && <tr><td colSpan={4} className="text-center text-gray-500 py-6">No transactions yet</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
`);

// ── 8. Catalog Page ───────────────────────────────────────────────────────
writePage(`${ROOT}/src/app/(dashboard)/marketplace/catalog/page.tsx`, `${HEADER}
export default function CatalogPage() {
  const [products, setProducts] = useState([]);
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => { load(); }, [category]);
  async function load() {
    setLoading(true);
    const token = localStorage.getItem('token');
    const url = \`/api/marketplace/products\${category ? \`?category=\${category}\` : ''}\`;
    const r = await fetch(url, { headers: { Authorization: \`Bearer \${token}\` } });
    setProducts((await r.json()).products || []); setLoading(false);
  }
  async function buy(p) {
    const u = JSON.parse(localStorage.getItem('user') || '{}');
    if (!u.employeeId) { alert('No employee context'); return; }
    // For demo: use first wallet bucket of allowed category
    const token = localStorage.getItem('token');
    const wr = await fetch(\`/api/wallet?employeeId=\${u.employeeId}\`, { headers: { Authorization: \`Bearer \${token}\` } });
    const wallet = (await wr.json()).wallet;
    const allowed = p.allowedBuckets.split(',').map(s => s.trim());
    const bucket = wallet?.buckets?.find(b => allowed.includes(b.category));
    if (!bucket) { alert(\`No eligible bucket. Allowed: \${p.allowedBuckets}\`); return; }
    if (!confirm(\`Buy \${p.name} for \${p.currency} \${p.corporatePrice} from \${bucket.category} bucket?\`)) return;
    const r = await fetch('/api/marketplace/orders', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: \`Bearer \${token}\` }, body: JSON.stringify({ employeeId: u.employeeId, productId: p.id, qty: 1, walletBucketId: bucket.id }) });
    if (r.ok) { const o = await r.json(); alert(\`✓ Order placed! Code: \${o.order.fulfillmentRef}\`); }
    else { const e = await r.json(); alert(e.error); }
  }
  const cats = ['', 'voucher', 'gift_card', 'physical_goods', 'digital_goods', 'course', 'insurance_topup'];
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Corporate Catalog</h1>
        <p className="text-sm text-gray-600 mt-1">White-labeled · API integrations · Corporate vs public pricing (REQ-SHP-01/02/03)</p>
      </div>
      <div className="flex gap-2">
        {cats.map(c => <button key={c} onClick={() => setCategory(c)} className={\`px-3 py-1 text-sm rounded \${category === c ? 'bg-blue-600 text-white' : 'bg-gray-100'}\`}>{c || 'All'}</button>)}
      </div>
      {loading ? <div className="text-gray-500">Loading...</div> : (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {products.map(p => (
            <div key={p.id} className="bg-white border rounded-lg p-4 shadow-sm">
              <div className="aspect-square bg-gradient-to-br from-gray-100 to-gray-200 rounded mb-3 flex items-center justify-center text-4xl">🎁</div>
              <h3 className="font-semibold text-sm">{p.name}</h3>
              <p className="text-xs text-gray-500 mb-2">{p.providerName} · {p.category}</p>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-xs text-gray-400 line-through">{p.currency} {p.publicPrice}</span>
                <span className="text-lg font-bold text-green-600">{p.currency} {p.corporatePrice}</span>
              </div>
              <div className="text-xs text-gray-500 mb-3">Buckets: {p.allowedBuckets}</div>
              <button onClick={() => buy(p)} className="w-full px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700">Buy Now</button>
            </div>
          ))}
          {products.length === 0 && <div className="col-span-full text-center text-gray-500 py-12">No products in catalog. Add products as super_admin.</div>}
        </div>
      )}
    </div>
  );
}
`);

// ── 9. Insurance Page ─────────────────────────────────────────────────────
writePage(`${ROOT}/src/app/(dashboard)/marketplace/insurance/page.tsx`, `${HEADER}
export default function InsurancePage() {
  const [policies, setPolicies] = useState([]);
  const [claims, setClaims] = useState([]);
  useEffect(() => { load(); }, []);
  async function load() {
    const token = localStorage.getItem('token');
    const [p, c] = await Promise.all([
      fetch('/api/insurance/policies', { headers: { Authorization: \`Bearer \${token}\` } }),
      fetch('/api/insurance/claims', { headers: { Authorization: \`Bearer \${token}\` } }),
    ]);
    setPolicies((await p.json()).policies || []);
    setClaims((await c.json()).claims || []);
  }
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Insurance Top-Up</h1>
        <p className="text-sm text-gray-600 mt-1">Group + voluntary · AI claims assistant · Payroll deduction (REQ-INS-01..05)</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border rounded-lg p-4">
          <h3 className="font-semibold mb-3">Active Policies</h3>
          {policies.map(p => (
            <div key={p.id} className="border-b last:border-0 py-2">
              <div className="flex justify-between">
                <span className="font-medium">{p.policyType.replace(/_/g, ' ')}</span>
                <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">{p.providerName}</span>
              </div>
              <div className="text-xs text-gray-500 mt-1">Coverage: {p.premiumCurrency} {p.coverageAmount.toLocaleString()} · Premium: {p.premiumAmount}/mo · {p.paymentMode}</div>
            </div>
          ))}
          {policies.length === 0 && <div className="text-gray-500 text-sm py-4">No active policies</div>}
        </div>
        <div className="bg-white border rounded-lg p-4">
          <h3 className="font-semibold mb-3">Recent Claims (AI-Assisted)</h3>
          {claims.map(c => (
            <div key={c.id} className="border-b last:border-0 py-2">
              <div className="flex justify-between">
                <span className="font-medium">Claim #{c.id.slice(-6)}</span>
                <span className={\`text-xs px-2 py-0.5 rounded \${c.status === 'approved' || c.status === 'paid' ? 'bg-green-100 text-green-700' : c.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}\`}>{c.status}</span>
              </div>
              <div className="text-xs text-gray-500 mt-1">Amount: {c.claimAmount} · AI Confidence: {((c.aiConfidence || 0) * 100).toFixed(0)}%</div>
            </div>
          ))}
          {claims.length === 0 && <div className="text-gray-500 text-sm py-4">No claims filed</div>}
        </div>
      </div>
    </div>
  );
}
`);

// ── 10. EWA Page ──────────────────────────────────────────────────────────
writePage(`${ROOT}/src/app/(dashboard)/marketplace/ewa/page.tsx`, `${HEADER}
export default function EWAPage() {
  const [requests, setRequests] = useState([]);
  const [earnedToDate, setEarnedToDate] = useState(0);
  const [maxWithdrawable, setMaxWithdrawable] = useState(0);
  const [amount, setAmount] = useState(0);
  useEffect(() => { load(); }, []);
  async function load() {
    const u = JSON.parse(localStorage.getItem('user') || '{}');
    if (!u.employeeId) return;
    const token = localStorage.getItem('token');
    const r = await fetch(\`/api/ewa?employeeId=\${u.employeeId}\`, { headers: { Authorization: \`Bearer \${token}\` } });
    const d = await r.json();
    setRequests(d.requests || []);
  }
  async function request() {
    const u = JSON.parse(localStorage.getItem('user') || '{}');
    if (!u.employeeId || amount <= 0) return;
    const token = localStorage.getItem('token');
    const r = await fetch('/api/ewa', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: \`Bearer \${token}\` }, body: JSON.stringify({ employeeId: u.employeeId, requestedAmount: amount }) });
    if (r.ok) { const d = await r.json(); setEarnedToDate(d.earnedToDate); setMaxWithdrawable(d.maxWithdrawable); setAmount(0); load(); alert(\`EWA approved! Fee: \${d.feeAmount}\`); }
    else { const e = await r.json(); alert(e.error); }
  }
  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold">Earned Wage Access</h1>
        <p className="text-sm text-gray-600 mt-1">Real-time balance · 70% cap · Auto-settled on payroll (REQ-FIN-01/02/03)</p>
      </div>
      <div className="bg-gradient-to-br from-yellow-500 to-orange-500 text-white rounded-lg p-6 shadow-lg">
        <div className="text-sm opacity-90">Available to withdraw (70% of earned-to-date)</div>
        <div className="text-4xl font-bold mt-1">INR {Math.max(0, maxWithdrawable).toFixed(0)}</div>
        <div className="text-xs opacity-75 mt-2">Earned to date: INR {earnedToDate.toFixed(0)} · Fee: 2% · Settles on next payroll</div>
      </div>
      <div className="bg-white border rounded-lg p-4 flex gap-3 items-end">
        <div className="flex-1">
          <label className="text-xs text-gray-600">Amount (INR)</label>
          <input type="number" value={amount} onChange={e => setAmount(parseFloat(e.target.value))} className="w-full border rounded px-3 py-2" />
        </div>
        <button onClick={request} className="px-6 py-2 bg-blue-600 text-white rounded">Request Advance</button>
      </div>
      <div className="bg-white border rounded-lg p-4">
        <h3 className="font-semibold mb-3">History</h3>
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase"><tr><th className="px-3 py-2 text-left">Date</th><th className="px-3 py-2 text-right">Requested</th><th className="px-3 py-2 text-right">Fee</th><th className="px-3 py-2 text-center">Status</th></tr></thead>
          <tbody>
            {requests.map(r => (
              <tr key={r.id} className="border-t">
                <td className="px-3 py-2">{new Date(r.createdAt).toLocaleDateString()}</td>
                <td className="px-3 py-2 text-right">{r.currency} {r.requestedAmount}</td>
                <td className="px-3 py-2 text-right text-red-600">{r.feeAmount}</td>
                <td className="px-3 py-2 text-center"><span className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-700">{r.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
`);

// ── 11. Loans Page ────────────────────────────────────────────────────────
writePage(`${ROOT}/src/app/(dashboard)/marketplace/loans/page.tsx`, `${HEADER}
export default function LoansPage() {
  const [listings, setListings] = useState([]);
  useEffect(() => { load(); }, []);
  async function load() {
    const u = JSON.parse(localStorage.getItem('user') || '{}');
    if (!u.employeeId) return;
    const token = localStorage.getItem('token');
    const r = await fetch(\`/api/loan-marketplace?employeeId=\${u.employeeId}\`, { headers: { Authorization: \`Bearer \${token}\` } });
    setListings((await r.json()).listings || []);
  }
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Loan Marketplace</h1>
        <p className="text-sm text-gray-600 mt-1">Pre-approved offers · e-sign consent · Garnishment (REQ-FIN-04/05/06)</p>
      </div>
      <div className="bg-blue-50 border-l-4 border-blue-600 p-4 text-sm">
        <b>Note:</b> HRMS is a lead generator and repayment facilitator only. No lending is done by the platform. Salary data shared via one-time expiring deep link only.
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {listings.map(l => (
          <div key={l.id} className="bg-white border rounded-lg p-4">
            <div className="flex justify-between">
              <h3 className="font-semibold">{l.bankName}</h3>
              <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">{l.applicationStatus.replace(/_/g, ' ')}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-3 text-sm">
              <div><div className="text-xs text-gray-500">Amount</div><div className="font-medium">{l.currency} {l.offerAmount.toLocaleString()}</div></div>
              <div><div className="text-xs text-gray-500">Rate</div><div className="font-medium">{l.interestRate}%</div></div>
              <div><div className="text-xs text-gray-500">Tenure</div><div className="font-medium">{l.tenureMonths} months</div></div>
              <div><div className="text-xs text-gray-500">EMI</div><div className="font-medium">{l.currency} {l.emiAmount}</div></div>
            </div>
            <div className="mt-3 text-xs">
              {l.consentGiven ? <span className="text-green-600">✓ Consent given · Deep link sent</span> : <span className="text-yellow-700">⏳ Awaiting e-sign consent</span>}
            </div>
            {l.garnishmentActive && <div className="mt-2 text-xs px-2 py-1 bg-red-50 text-red-700 rounded">⚠ Garnishment active — payroll auto-deducts EMI</div>}
          </div>
        ))}
        {listings.length === 0 && <div className="col-span-full text-center text-gray-500 py-12">No pre-approved offers yet. Bank partners will appear here based on your verified employment.</div>}
      </div>
    </div>
  );
}
`);

// ── 12. Gifting & Recognition Page ────────────────────────────────────────
writePage(`${ROOT}/src/app/(dashboard)/marketplace/gifting/page.tsx`, `${HEADER}
export default function GiftingPage() {
  const [tab, setTab] = useState<'gifts' | 'kudos'>('gifts');
  const [gifts, setGifts] = useState([]);
  const [ledger, setLedger] = useState([]);
  useEffect(() => { load(); }, [tab]);
  async function load() {
    const token = localStorage.getItem('token');
    const u = JSON.parse(localStorage.getItem('user') || '{}');
    if (tab === 'gifts') {
      const r = await fetch('/api/gifts', { headers: { Authorization: \`Bearer \${token}\` } });
      setGifts((await r.json()).gifts || []);
    } else {
      const r = await fetch(\`/api/recognition?employeeId=\${u.employeeId || ''}\`, { headers: { Authorization: \`Bearer \${token}\` } });
      const d = await r.json(); setLedger(d.ledger || []);
    }
  }
  async function runMilestones() {
    const token = localStorage.getItem('token');
    const r = await fetch('/api/gifts/milestone-scan', { method: 'POST', headers: { Authorization: \`Bearer \${token}\` } });
    const d = await r.json();
    alert(\`Milestone scan: \${d.totalSent} gifts sent (birthdays: \${d.birthdayGifts}, anniversaries: \${d.anniversaryGifts})\`);
    load();
  }
  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Gifting & Rewards</h1>
          <p className="text-sm text-gray-600 mt-1">Milestone automation · P2P kudos · Wallet redemption (REQ-GFT-01/02/03)</p>
        </div>
        <button onClick={runMilestones} className="px-4 py-2 bg-purple-600 text-white rounded">⚡ Run Milestone Scan</button>
      </div>
      <div className="flex gap-2">
        <button onClick={() => setTab('gifts')} className={\`px-4 py-2 rounded \${tab === 'gifts' ? 'bg-blue-600 text-white' : 'bg-gray-100'}\`}>My Gifts</button>
        <button onClick={() => setTab('kudos')} className={\`px-4 py-2 rounded \${tab === 'kudos' ? 'bg-blue-600 text-white' : 'bg-gray-100'}\`}>My Kudos Points</button>
      </div>
      {tab === 'gifts' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {gifts.map(g => (
            <div key={g.id} className="bg-white border rounded-lg p-4">
              <div className="text-2xl mb-1">{g.triggerEvent === 'birthday' ? '🎂' : g.triggerEvent === 'work_anniversary' ? '🎉' : '🎁'}</div>
              <h3 className="font-semibold capitalize text-sm">{g.triggerEvent.replace(/_/g, ' ')}</h3>
              <p className="text-xs text-gray-600 mt-1">{g.message}</p>
              {g.product && <p className="text-xs text-blue-600 mt-2">{g.product.name}</p>}
              {g.voucherCode && <div className="mt-2 text-xs font-mono bg-gray-100 px-2 py-1 rounded">Code: {g.voucherCode}</div>}
              <div className="mt-2 text-xs text-gray-500">{new Date(g.createdAt).toLocaleDateString()}</div>
            </div>
          ))}
          {gifts.length === 0 && <div className="col-span-full text-center text-gray-500 py-12">No gifts received yet</div>}
        </div>
      )}
      {tab === 'kudos' && (
        <div className="bg-white border rounded-lg p-4">
          <div className="text-3xl font-bold text-purple-600">{ledger.length > 0 ? ledger[0].balanceAfter : 0} <span className="text-base text-gray-600">kudos points</span></div>
          <table className="min-w-full text-sm mt-4">
            <thead className="bg-gray-50 text-xs uppercase"><tr><th className="px-3 py-2 text-left">Date</th><th className="px-3 py-2 text-left">Source</th><th className="px-3 py-2 text-right">Points</th><th className="px-3 py-2 text-right">Balance</th></tr></thead>
            <tbody>
              {ledger.map(l => (
                <tr key={l.id} className="border-t">
                  <td className="px-3 py-2">{new Date(l.createdAt).toLocaleDateString()}</td>
                  <td className="px-3 py-2">{l.source}</td>
                  <td className="px-3 py-2 text-right text-green-600">+{l.points}</td>
                  <td className="px-3 py-2 text-right font-medium">{l.balanceAfter}</td>
                </tr>
              ))}
              {ledger.length === 0 && <tr><td colSpan={4} className="text-center text-gray-500 py-6">No kudos yet — give one to a peer!</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
`);

// ── 13. Marketplace Insights (Admin) ──────────────────────────────────────
writePage(`${ROOT}/src/app/(dashboard)/marketplace/insights/page.tsx`, `${HEADER}
export default function MarketplaceInsightsPage() {
  const [stress, setStress] = useState([]);
  const [loading, setLoading] = useState(false);
  async function runStress() {
    setLoading(true);
    const token = localStorage.getItem('token');
    const r = await fetch('/api/marketplace/ai/financial-stress', { headers: { Authorization: \`Bearer \${token}\` } });
    setStress((await r.json()).results || []); setLoading(false);
  }
  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">AI Marketplace Insights</h1>
          <p className="text-sm text-gray-600 mt-1">Financial stress prediction (REQ-AI-MKT-03) · Fraud detection (REQ-AI-MKT-02)</p>
        </div>
        <button onClick={runStress} disabled={loading} className="px-4 py-2 bg-purple-600 text-white rounded">{loading ? 'Scanning...' : '⚡ Run Stress Analysis'}</button>
      </div>
      <div className="bg-yellow-50 border-l-4 border-yellow-500 p-3 text-xs">
        ⚠ Per local privacy laws, results may be anonymized. Tenant Admins can configure identification policy.
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {stress.map(s => (
          <div key={s.flagId} className="bg-white border rounded-lg p-4">
            <div className="flex justify-between">
              <h3 className="font-semibold">{s.employeeName}</h3>
              <span className={\`text-xs px-2 py-1 rounded \${s.riskLevel === 'high' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}\`}>{s.riskLevel}</span>
            </div>
            <div className="text-2xl font-bold text-gray-800 mt-2">{(s.riskScore * 100).toFixed(0)}%</div>
            <div className="text-xs text-gray-600 mt-2 space-y-1">
              <div>EWA usage (30d): <b>{s.factors.ewaCount}</b></div>
              <div>Active loans: <b>{s.factors.loanCount}</b></div>
              <div>Absences (30d): <b>{s.factors.attendanceDrop}</b></div>
            </div>
            <p className="mt-2 text-xs italic text-gray-700">{s.recommendedAction}</p>
          </div>
        ))}
        {stress.length === 0 && !loading && <div className="col-span-full text-center text-gray-500 py-12">No flagged employees. Click "Run Stress Analysis".</div>}
      </div>
    </div>
  );
}
`);

// ── 14. Client Portal Login Page ──────────────────────────────────────────
writePage(`${ROOT}/src/app/client-portal/login/page.tsx`, `${HEADER}
export default function ClientPortalLogin() {
  const [step, setStep] = useState<'request' | 'verify'>('request');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function requestOtp(e) {
    e.preventDefault(); setError(''); setLoading(true);
    const r = await fetch('/api/client-portal/auth/request-otp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
    setLoading(false);
    if (r.ok) setStep('verify'); else setError((await r.json()).error);
  }
  async function verify(e) {
    e.preventDefault(); setError(''); setLoading(true);
    const r = await fetch('/api/client-portal/auth/verify-otp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, otp }) });
    setLoading(false);
    if (r.ok) { const d = await r.json(); localStorage.setItem('clientPortalToken', d.token); localStorage.setItem('clientPortalUser', JSON.stringify(d.user)); window.location.href = '/client-portal/dashboard'; }
    else setError((await r.json()).error);
  }
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-700 to-indigo-900 flex items-center justify-center p-6">
      <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">🏢</div>
          <h1 className="text-2xl font-bold text-gray-800">Client Portal</h1>
          <p className="text-sm text-gray-600 mt-1">Secure access · MFA enforced · GDPR compliant</p>
        </div>
        {step === 'request' ? (
          <form onSubmit={requestOtp} className="space-y-3">
            <input type="email" placeholder="Your work email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full border rounded px-3 py-2" />
            <button disabled={loading} type="submit" className="w-full bg-blue-600 text-white py-2 rounded">{loading ? 'Sending...' : 'Send OTP'}</button>
          </form>
        ) : (
          <form onSubmit={verify} className="space-y-3">
            <p className="text-sm text-gray-600">Enter the 6-digit OTP sent to <b>{email}</b></p>
            <input maxLength={6} placeholder="123456" required value={otp} onChange={e => setOtp(e.target.value)} className="w-full border rounded px-3 py-2 text-center text-2xl tracking-widest font-mono" />
            <button disabled={loading} type="submit" className="w-full bg-green-600 text-white py-2 rounded">{loading ? 'Verifying...' : 'Verify & Login'}</button>
            <button type="button" onClick={() => setStep('request')} className="w-full text-sm text-gray-500">← Use different email</button>
          </form>
        )}
        {error && <div className="mt-3 text-sm text-red-600 text-center">{error}</div>}
      </div>
    </div>
  );
}
`);

// ── 15. Client Portal Dashboard ───────────────────────────────────────────
writePage(`${ROOT}/src/app/client-portal/dashboard/page.tsx`, `${HEADER}
export default function ClientPortalDashboard() {
  const [data, setData] = useState(null);
  const [approvals, setApprovals] = useState([]);
  useEffect(() => {
    const token = localStorage.getItem('clientPortalToken');
    if (!token) { window.location.href = '/client-portal/login'; return; }
    (async () => {
      const [d, a] = await Promise.all([
        fetch('/api/client-portal/dashboard', { headers: { Authorization: \`Bearer \${token}\` } }),
        fetch('/api/client-portal/approvals', { headers: { Authorization: \`Bearer \${token}\` } }),
      ]);
      if (d.status === 401) { window.location.href = '/client-portal/login'; return; }
      setData(await d.json()); setApprovals((await a.json()).approvals || []);
    })();
  }, []);
  async function approve(id, status) {
    const token = localStorage.getItem('clientPortalToken');
    await fetch('/api/client-portal/approvals', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: \`Bearer \${token}\` }, body: JSON.stringify({ approvalId: id, status }) });
    const a = await fetch('/api/client-portal/approvals', { headers: { Authorization: \`Bearer \${token}\` } });
    setApprovals((await a.json()).approvals || []);
  }
  if (!data) return <div className="min-h-screen flex items-center justify-center text-gray-500">Loading...</div>;
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Client Portal Dashboard</h1>
          <button onClick={() => { localStorage.removeItem('clientPortalToken'); window.location.href = '/client-portal/login'; }} className="text-sm text-red-600">Logout</button>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-lg p-4 shadow"><div className="text-xs text-gray-500">Active Projects</div><div className="text-2xl font-bold">{data.projects?.length || 0}</div></div>
          <div className="bg-white rounded-lg p-4 shadow"><div className="text-xs text-gray-500">Pending Approvals</div><div className="text-2xl font-bold text-yellow-600">{data.pendingApprovals || 0}</div></div>
          <div className="bg-white rounded-lg p-4 shadow"><div className="text-xs text-gray-500">Total Invoices</div><div className="text-2xl font-bold">{data.invoices?.length || 0}</div></div>
        </div>
        <div className="bg-white rounded-lg p-4 shadow">
          <h3 className="font-semibold mb-3">Timesheet Approvals</h3>
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase"><tr><th className="px-3 py-2 text-left">Employee</th><th className="px-3 py-2 text-left">Project</th><th className="px-3 py-2 text-center">Status</th><th className="px-3 py-2 text-center">Action</th></tr></thead>
            <tbody>
              {approvals.map(a => (
                <tr key={a.id} className="border-t">
                  <td className="px-3 py-2">{a.timesheet?.employee ? \`\${a.timesheet.employee.firstName} \${a.timesheet.employee.lastName}\` : '-'}</td>
                  <td className="px-3 py-2">{a.timesheet?.project?.name || '-'}</td>
                  <td className="px-3 py-2 text-center"><span className={\`text-xs px-2 py-0.5 rounded \${a.status === 'approved' ? 'bg-green-100 text-green-700' : a.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}\`}>{a.status}</span></td>
                  <td className="px-3 py-2 text-center">
                    {a.status === 'pending' && (
                      <div className="flex gap-1 justify-center">
                        <button onClick={() => approve(a.id, 'approved')} className="text-xs px-2 py-1 bg-green-600 text-white rounded">✓</button>
                        <button onClick={() => approve(a.id, 'rejected')} className="text-xs px-2 py-1 bg-red-600 text-white rounded">✗</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {approvals.length === 0 && <tr><td colSpan={4} className="text-center text-gray-500 py-6">No pending timesheet approvals</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="bg-white rounded-lg p-4 shadow">
          <h3 className="font-semibold mb-3">Your Invoices</h3>
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase"><tr><th className="px-3 py-2 text-left">#</th><th className="px-3 py-2 text-right">Amount</th><th className="px-3 py-2 text-right">Due</th><th className="px-3 py-2 text-center">Status</th></tr></thead>
            <tbody>
              {data.invoices?.map(i => (
                <tr key={i.id} className="border-t">
                  <td className="px-3 py-2 font-mono text-xs">{i.invoiceNumber}</td>
                  <td className="px-3 py-2 text-right">{i.currency} {i.totalAmount?.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right">{i.dueDate ? new Date(i.dueDate).toLocaleDateString() : '-'}</td>
                  <td className="px-3 py-2 text-center"><span className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-700">{i.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
`);

console.log('UI pages generated.');
