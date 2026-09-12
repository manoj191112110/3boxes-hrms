'use client';

import { useEffect, useState, useCallback } from 'react';
import { FiZap, FiRefreshCw, FiActivity, FiAlertTriangle, FiTrendingUp } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import { useCompanyContextStore } from '@/store/companyContextStore';
import ModuleTips from '@/components/ModuleTips';

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

interface BurnoutFlag {
  id: string;
  riskScore: number;
  riskLevel: string;
  factors: { overtime?: number; leaveUsage?: number; activityScore?: number };
  recommendations: string | null;
  notifiedManager: boolean;
  acknowledgedAt: string | null;
  createdAt: string;
  employee: { id: string; firstName: string; lastName: string; employeeId: string; email: string };
}

export default function BurnoutPage() {
  const { user } = useAuthStore();
  const scopeQuery = useCompanyContextStore(s => s.scopeQuery);
  const selectedTenantId = useCompanyContextStore(s => s.selectedTenantId);
  const isAdmin = ['super_admin', 'tenant_admin', 'admin'].includes(user?.role || '');

  const [items, setItems] = useState<BurnoutFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const sq = scopeQuery();
      const r = await fetch(`/api/attendance/burnout?limit=100${sq ? `&${sq}` : ''}`, { headers: getAuthHeaders() });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed');
      setItems(d.burnoutFlags || []);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [scopeQuery, selectedTenantId]);

  useEffect(() => { if (isAdmin) fetchItems(); }, [fetchItems, isAdmin]);

  const runAnalysis = async () => {
    setRunning(true);
    try {
      const r = await fetch('/api/attendance/burnout/run', { method: 'POST', headers: getAuthHeaders() });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed');
      toast.success(`Generated ${d.generated || 0} new burnout flags`);
      fetchItems();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setRunning(false);
    }
  };

  const stats = {
    critical: items.filter(i => i.riskLevel === 'critical').length,
    high: items.filter(i => i.riskLevel === 'high').length,
    moderate: items.filter(i => i.riskLevel === 'moderate').length,
  };

  const levelColor = (lvl: string) => ({
    critical: 'bg-red-100 text-red-700 border-red-200',
    high: 'bg-orange-100 text-orange-700 border-orange-200',
    moderate: 'bg-amber-100 text-amber-700 border-amber-200',
    low: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  }[lvl] || 'bg-slate-100 text-slate-700 border-slate-200');

  if (!isAdmin) {
    return (
      <div className="text-center py-12">
        <FiZap className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <p className="text-slate-500">Burnout Analytics is available to managers and HR admins only.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <FiActivity className="w-6 h-6 text-rose-500" />
            AI Burnout Analytics
          </h1>
          <p className="text-sm text-slate-500 mt-1">Detect employees at risk of burnout from overtime + low leave + high activity</p>
        </div>
        <button onClick={runAnalysis} disabled={running} className="3boxes-btn-primary flex items-center gap-2">
          {running ? <FiRefreshCw className="w-4 h-4 animate-spin" /> : <FiZap className="w-4 h-4" />}
          Run AI Analysis
        </button>
      </div>

      <ModuleTips moduleKey="attendance-burnout">
        <p><strong>REQ-AI-ATT-03:</strong> The AI analyzes the correlation between high Overtime, low Leave usage, and high Collaboration Hub activity to flag employees at high risk of burnout. Risk score weights: Overtime (40%), Leave usage (30%), Activity (30%). Levels: low (ignored), moderate, high, critical.</p>
      </ModuleTips>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-4 border border-red-200">
          <p className="text-xs uppercase tracking-wider text-red-600">Critical Risk</p>
          <p className="text-3xl font-bold text-red-700 mt-1">{stats.critical}</p>
          <p className="text-xs text-slate-500 mt-1">Immediate intervention recommended</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-orange-200">
          <p className="text-xs uppercase tracking-wider text-orange-600">High Risk</p>
          <p className="text-3xl font-bold text-orange-700 mt-1">{stats.high}</p>
          <p className="text-xs text-slate-500 mt-1">Reduce workload, encourage leave</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-amber-200">
          <p className="text-xs uppercase tracking-wider text-amber-600">Moderate Risk</p>
          <p className="text-3xl font-bold text-amber-700 mt-1">{stats.moderate}</p>
          <p className="text-xs text-slate-500 mt-1">Monitor closely</p>
        </div>
      </div>

      <div className="thb-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Employee</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Risk Score</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Level</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Factors</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Recommendations</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Flagged On</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={6} className="text-center py-8 text-slate-400">Loading...</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-slate-500">
                  <FiActivity className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  No burnout flags yet. Click <strong>Run AI Analysis</strong> to compute.
                </td></tr>
              ) : items.map(f => (
                <tr key={f.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-700">
                    <p className="font-medium">{f.employee.firstName} {f.employee.lastName}</p>
                    <p className="text-xs text-slate-500">{f.employee.employeeId} · {f.employee.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full ${f.riskLevel === 'critical' ? 'bg-red-500' : f.riskLevel === 'high' ? 'bg-orange-500' : 'bg-amber-500'}`} style={{ width: `${Math.round(f.riskScore * 100)}%` }} />
                      </div>
                      <span className="text-xs font-medium text-slate-700">{Math.round(f.riskScore * 100)}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full border font-medium ${levelColor(f.riskLevel)}`}>{f.riskLevel}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    {f.factors?.overtime != null && <span className="inline-flex items-center gap-0.5 mr-2"><FiTrendingUp className="w-3 h-3" /> OT {Math.round((f.factors.overtime || 0) * 100)}%</span>}
                    {f.factors?.leaveUsage != null && <span className="mr-2">🏖️ {Math.round((f.factors.leaveUsage || 0) * 100)}%</span>}
                    {f.factors?.activityScore != null && <span>⚡ {Math.round((f.factors.activityScore || 0) * 100)}%</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-700 max-w-sm">{f.recommendations || '—'}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{new Date(f.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
