'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function ClientInsightsPage() {
  const [tab, setTab] = useState<'churn' | 'margin'>('churn');
  const [churn, setChurn] = useState<any[]>([]);
  const [margin, setMargin] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  async function runChurn(): Promise<void> {
    setLoading(true);
    const token = localStorage.getItem('tb_token');
    const r = await fetch('/api/clients/ai/churn', { headers: { Authorization: `Bearer ${token}` } });
    setChurn((await r.json()).results || []);
    setLoading(false);
  }
  async function runMargin(): Promise<void> {
    setLoading(true);
    const token = localStorage.getItem('tb_token');
    const r = await fetch('/api/clients/ai/margin', { headers: { Authorization: `Bearer ${token}` } });
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
        <button onClick={() => setTab('churn')} className={`px-4 py-2 rounded ${tab === 'churn' ? 'bg-green-600 text-white' : 'bg-gray-100'}`}>Churn Risk</button>
        <button onClick={() => setTab('margin')} className={`px-4 py-2 rounded ${tab === 'margin' ? 'bg-green-600 text-white' : 'bg-gray-100'}`}>Margin Analysis</button>
      </div>
      {loading && <div className="text-gray-500">Running AI analysis...</div>}

      {tab === 'churn' && !loading && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {churn.map(c => (
            <div key={c.clientId} className="bg-white border rounded-lg p-4 shadow-sm">
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-semibold">{c.clientName}</h3>
                <span className={`text-xs px-2 py-1 rounded ${c.riskLevel === 'high' ? 'bg-red-100 text-red-700' : c.riskLevel === 'medium' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>{c.riskLevel}</span>
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
                  <td className={`px-3 py-2 text-right font-semibold ${m.grossMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>{m.grossMargin.toLocaleString()}</td>
                  <td className={`px-3 py-2 text-right font-bold ${m.marginPct >= 20 ? 'text-green-600' : m.marginPct >= 0 ? 'text-yellow-600' : 'text-red-600'}`}>{m.marginPct.toFixed(1)}%</td>
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
