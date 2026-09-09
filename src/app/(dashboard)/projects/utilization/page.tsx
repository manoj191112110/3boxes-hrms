'use client';
import { useEffect, useState } from 'react';

export default function UtilizationPage() {
  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [weeks, setWeeks] = useState(12);
  const [projectId, setProjectId] = useState('');

  useEffect(() => { load(); }, [weeks, projectId]);

  async function load() {
    setLoading(true);
    try {
      const token = localStorage.getItem('tb_token');
      const params = new URLSearchParams({ weeks: String(weeks), persist: '1' });
      if (projectId) params.set('projectId', projectId);
      const r = await fetch(`/api/projects/utilization?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await r.json();
      setSnapshots(data.snapshots || []);
      setSummary(data.summary || null);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  function utilizationColor(pct: number) {
    if (pct >= 80) return 'text-green-600 bg-green-50';
    if (pct >= 60) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Project Utilization Report</h1>
        <p className="text-sm text-gray-600 mt-1">Billable vs non-billable hours · Utilization rate per resource per week (REQ-PM-05)</p>
      </div>

      <div className="bg-white border rounded-lg p-4 flex flex-wrap gap-4 items-center">
        <label className="text-sm">
          Weeks:
          <select value={weeks} onChange={(e) => setWeeks(Number(e.target.value))} className="ml-2 border rounded px-2 py-1">
            <option value={4}>4 weeks</option>
            <option value={12}>12 weeks</option>
            <option value={26}>26 weeks</option>
            <option value={52}>52 weeks</option>
          </select>
        </label>
        <label className="text-sm">
          Project ID (optional):
          <input type="text" value={projectId} onChange={(e) => setProjectId(e.target.value)} placeholder="Filter by project" className="ml-2 border rounded px-2 py-1 w-64" />
        </label>
        <button onClick={load} className="ml-auto bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700">Refresh</button>
      </div>

      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white border rounded-lg p-4">
            <div className="text-xs uppercase text-gray-500">Avg Utilization</div>
            <div className="text-2xl font-bold text-green-600">{summary.avgUtilizationPct}%</div>
          </div>
          <div className="bg-white border rounded-lg p-4">
            <div className="text-xs uppercase text-gray-500">Billable Hours</div>
            <div className="text-2xl font-bold text-green-600">{summary.totalBillableHours.toLocaleString()}</div>
          </div>
          <div className="bg-white border rounded-lg p-4">
            <div className="text-xs uppercase text-gray-500">Non-Billable Hours</div>
            <div className="text-2xl font-bold text-orange-600">{summary.totalNonBillableHours.toLocaleString()}</div>
          </div>
          <div className="bg-white border rounded-lg p-4">
            <div className="text-xs uppercase text-gray-500">Snapshots</div>
            <div className="text-2xl font-bold">{summary.totalSnapshots}</div>
          </div>
        </div>
      )}

      <div className="bg-white border rounded-lg overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase">
            <tr>
              <th className="px-3 py-2 text-left">Project</th>
              <th className="px-3 py-2 text-left">Employee</th>
              <th className="px-3 py-2 text-left">Week Start</th>
              <th className="px-3 py-2 text-right">Billable</th>
              <th className="px-3 py-2 text-right">Non-Billable</th>
              <th className="px-3 py-2 text-right">Total</th>
              <th className="px-3 py-2 text-right">Utilization</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="text-center py-6 text-gray-500">Loading…</td></tr>
            ) : snapshots.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-6 text-gray-500">No timesheet data found in the selected window.</td></tr>
            ) : snapshots.map((s, i) => (
              <tr key={i} className="border-t hover:bg-gray-50">
                <td className="px-3 py-2 font-medium">{s.projectName} <span className="text-xs text-gray-500">{s.projectCode}</span></td>
                <td className="px-3 py-2">{s.employeeName}</td>
                <td className="px-3 py-2 text-xs text-gray-500">{new Date(s.weekStart).toLocaleDateString()}</td>
                <td className="px-3 py-2 text-right text-green-700">{s.billableHours}</td>
                <td className="px-3 py-2 text-right text-orange-700">{s.nonBillableHours}</td>
                <td className="px-3 py-2 text-right font-medium">{s.totalHours}</td>
                <td className={`px-3 py-2 text-right font-bold ${utilizationColor(s.utilizationPct)}`}>
                  {s.utilizationPct}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
