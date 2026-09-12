'use client';
import { useEffect, useState } from 'react';
import { useCompanyContextStore } from '@/store/companyContextStore';

export default function InsightsPage() {
  const [insights, setInsights] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [moduleFilter, setModuleFilter] = useState('');
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [cached, setCached] = useState(false);

  useEffect(() => { load(); }, [moduleFilter]);

  async function load() {
    setLoading(true);
    try {
      const token = localStorage.getItem('tb_token');
      const params = new URLSearchParams({ hours: '6' });
      if (moduleFilter) params.set('module', moduleFilter);
      const r = await fetch(`/api/analytics/insights?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await r.json();
      setInsights(data.insights || []);
      setGeneratedAt(data.generatedAt || null);
      setCached(!!data.cached);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  function severityColor(sev: string) {
    return {
      critical: 'bg-red-100 text-red-700 border-red-200',
      high: 'bg-orange-100 text-orange-700 border-orange-200',
      medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
      low: 'bg-green-100 text-green-700 border-green-200',
    }[sev] || 'bg-gray-100 text-gray-700 border-gray-200';
  }

  function moduleColor(mod: string) {
    return {
      payroll: 'bg-teal-100 text-teal-700',
      attendance: 'bg-green-100 text-green-700',
      recruitment: 'bg-green-100 text-green-700',
      marketplace: 'bg-pink-100 text-pink-700',
      projects: 'bg-emerald-100 text-emerald-700',
    }[mod] || 'bg-gray-100 text-gray-700';
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Anomaly Insights</h1>
          <p className="text-sm text-gray-600 mt-1">Cross-module anomaly detection · Auto-generated text insights (REQ-ENG-07)</p>
        </div>
        <div className="flex gap-2">
          <select value={moduleFilter} onChange={(e) => setModuleFilter(e.target.value)} className="border rounded px-3 py-2 text-sm">
            <option value="">All Modules</option>
            <option value="payroll">Payroll</option>
            <option value="attendance">Attendance</option>
            <option value="recruitment">Recruitment</option>
            <option value="marketplace">Marketplace</option>
            <option value="projects">Projects</option>
          </select>
          <button onClick={load} className="bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700">Refresh</button>
        </div>
      </div>

      {generatedAt && (
        <div className={`text-xs px-3 py-2 rounded border ${cached ? 'bg-green-50 text-green-700 border-green-200' : 'bg-green-50 text-green-700 border-green-200'}`}>
          {cached ? '📦 Cached' : '✨ Freshly generated'} at {new Date(generatedAt).toLocaleString()}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-500">Scanning modules for anomalies…</div>
      ) : insights.length === 0 ? (
        <div className="bg-white border rounded-lg p-12 text-center">
          <div className="text-4xl mb-3">✅</div>
          <p className="text-gray-700 font-medium">No anomalies detected</p>
          <p className="text-sm text-gray-500 mt-1">All modules are operating within normal parameters in the last 6 hours.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {insights.map((ins, i) => (
            <div key={ins.id || i} className="bg-white border rounded-lg p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded ${moduleColor(ins.module)}`}>{ins.module}</span>
                  <span className={`text-xs px-2 py-0.5 rounded border ${severityColor(ins.severity)}`}>{ins.severity}</span>
                </div>
                <span className="text-xs text-gray-500">{new Date(ins.generatedAt).toLocaleString()}</span>
              </div>
              <h3 className="font-semibold text-gray-800">{ins.title}</h3>
              <p className="text-sm text-gray-600 mt-1">{ins.description}</p>
              {ins.recommendedAction && (
                <div className="mt-2 text-xs bg-amber-50 border border-amber-200 rounded p-2 text-amber-800">
                  <b>Recommended action:</b> {ins.recommendedAction}
                </div>
              )}
              {ins.metricValue !== null && ins.metricValue !== undefined && (
                <div className="mt-2 text-xs text-gray-500">
                  Metric: <b>{ins.metric}</b> = {ins.metricValue.toFixed(2)} (baseline: {ins.baselineValue?.toFixed(2)})
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
