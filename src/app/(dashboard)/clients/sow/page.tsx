'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function SOWPage() {
  const [sows, setSows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => { loadSOWs(); }, []);
  async function loadSOWs(): Promise<void> {
    setLoading(true);
    try {
      const token = localStorage.getItem('tb_token');
      const r = await fetch('/api/clients/sow', { headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json();
      setSows(d.sows || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  async function approve(id: string) {
    if (!confirm('Approve this SOW? This will auto-create a Project shell.')) return;
    const token = localStorage.getItem('tb_token');
    const r = await fetch(`/api/clients/sow/${id}/approve`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
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
        <button onClick={() => setShowCreate(!showCreate)} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
          {showCreate ? 'Close' : '+ New SOW'}
        </button>
      </div>

      {showCreate && <CreateSOWForm onCreated={() => { setShowCreate(false); loadSOWs(); }} />}

      {loading ? <div className="text-gray-500">Loading...</div> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sows.map((s: any) => (
            <div key={s.id} className="bg-white border rounded-lg p-4 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold">{s.title}</h3>
                  <p className="text-xs text-gray-500">{s.client?.name}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded ${s.status === 'approved' ? 'bg-green-100 text-green-700' : s.status === 'ai_parsed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{s.status}</span>
              </div>
              <div className="mt-3 space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Value:</span><span className="font-medium">{s.currency} {(s.totalValue || 0).toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Headcount:</span><span className="font-medium">{s.maxHeadcount || '-'}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">AI Confidence:</span><span className="font-medium">{((s.aiConfidence || 0) * 100).toFixed(0)}%</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Start:</span><span className="font-medium">{s.startDate ? new Date(s.startDate).toLocaleDateString() : '-'}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">End:</span><span className="font-medium">{s.endDate ? new Date(s.endDate).toLocaleDateString() : '-'}</span></div>
                {s.project && <div className="flex justify-between"><span className="text-gray-500">Project:</span><Link href={`/projects/${s.project.id}`} className="text-green-600 hover:underline">{s.project.name}</Link></div>}
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

  function CreateSOWForm({ onCreated }: { onCreated: () => void }) {
    const [form, setForm] = useState({ clientId: '', title: '', fileName: '', rawText: '', currency: 'INR' });
    const [clients, setClients] = useState<any[]>([]);
    useEffect(() => { (async () => {
      const token = localStorage.getItem('tb_token');
      const r = await fetch('/api/clients?limit=100', { headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json(); setClients(d.clients || []);
    })(); }, []);
    async function submit(e: any) {
      e.preventDefault();
      const token = localStorage.getItem('tb_token');
      const r = await fetch('/api/clients/sow', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(form) });
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
        <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded">AI Parse & Save</button>
      </form>
    );
  }
}
