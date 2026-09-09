'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAutoSeedDemo } from '@/hooks/useAutoSeedDemo';
import { useAuthStore } from '@/store/authStore';

export default function MarketplaceInsightsPage() {
  const [stress, setStress] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Use authStore token — fixes "no token provided" error.
  const token = useAuthStore((s) => s.token);

  // Auto-seed wellness (incl. financial stress flags) demo data on first load
  const { seeded } = useAutoSeedDemo('wellness');

  async function runStress(): Promise<void> {
    if (!token) return;
    setLoading(true);
    try {
      const r = await fetch('/api/marketplace/ai/financial-stress', { headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json().catch(() => ({}));
      setStress(d.results || []);
    } catch {
      setStress([]);
    } finally {
      setLoading(false);
    }
  }

  // Auto-run stress analysis once after seeding completes
  useEffect(() => {
    if (seeded && token) runStress();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seeded, token]);
  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">AI Marketplace Insights</h1>
          <p className="text-sm text-gray-600 mt-1">Financial stress prediction (REQ-AI-MKT-03) · Fraud detection (REQ-AI-MKT-02)</p>
        </div>
        <button onClick={runStress} disabled={loading} className="px-4 py-2 bg-teal-600 text-white rounded">{loading ? 'Scanning...' : '⚡ Run Stress Analysis'}</button>
      </div>
      <div className="bg-yellow-50 border-l-4 border-yellow-500 p-3 text-xs">
        ⚠ Per local privacy laws, results may be anonymized. Tenant Admins can configure identification policy.
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {stress.map(s => (
          <div key={s.flagId} className="bg-white border rounded-lg p-4">
            <div className="flex justify-between">
              <h3 className="font-semibold">{s.employeeName}</h3>
              <span className={`text-xs px-2 py-1 rounded ${s.riskLevel === 'high' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>{s.riskLevel}</span>
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
