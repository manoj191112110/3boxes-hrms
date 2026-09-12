'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  FiBarChart2, FiDatabase, FiUsers, FiCpu, FiHardDrive,
  FiActivity, FiLayers, FiRefreshCw,
} from 'react-icons/fi';
import { useAuthStore } from '@/store/authStore';
import { isClientLiveMode } from '@/lib/site-mode';
import { isTenantHiddenClient, PLATFORM_PLACEHOLDER_NAME } from '@/lib/tenant-filter';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

// ─── Types ───────────────────────────────────────────────
interface TenantUsage {
  id: string;
  tenantName: string;
  employeesUsed: number;
  employeesLimit: number;
  storageUsed: number;
  storageLimit: number;
  modules: string[];
  lastActive: string;
  apiCallsToday: number;
}

function getUsageColor(pct: number) {
  if (pct > 90) return 'bg-red-500';
  if (pct > 70) return 'bg-amber-500';
  return 'bg-emerald-500';
}

function getUsageText(pct: number) {
  if (pct > 90) return 'text-red-600';
  if (pct > 70) return 'text-amber-600';
  return 'text-emerald-600';
}

function formatMB(mb: number) {
  if (mb >= 1000) return `${(mb / 1000).toFixed(1)} GB`;
  return `${mb} MB`;
}

export default function TenantUsagePage() {
  const { user } = useAuthStore();
  const liveMode = isClientLiveMode();
  const [usage, setUsage] = useState<TenantUsage[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUsage = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/tenants?limit=100', { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Failed to fetch tenants');
      const data = await res.json();
      const tenants = data.tenants || data || [];

      // ALWAYS filter out hidden tenants (platform placeholder, demo) — never show Marq AI Tech
      const filtered = tenants.filter((t: any) =>
        !isTenantHiddenClient(t.slug) && !(t.name || '').includes(PLATFORM_PLACEHOLDER_NAME)
      );

      const mapped: TenantUsage[] = filtered.map((t: any) => ({
        id: t.id,
        tenantName: t.name || 'Unknown',
        employeesUsed: t._count?.employees || t.employeeCount || 0,
        employeesLimit: t.plan?.employeeLimit || t.employeeLimit || 9999,
        storageUsed: t.storageUsed || 0,
        storageLimit: t.plan?.storageLimit || t.storageLimit || 50000,
        modules: t.modules || t.plan?.features || ['Payroll'],
        lastActive: t.lastActive || t.updatedAt ? new Date(t.lastActive || t.updatedAt || t.createdAt).toISOString().slice(0, 10) : '—',
        apiCallsToday: t.apiCallsToday || 0,
      }));
      setUsage(mapped);
    } catch (err) {
      setUsage([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsage(); }, [fetchUsage]);

  const totalStorage = usage.reduce((s, u) => s + u.storageUsed, 0);
  const avgEmployees = usage.length > 0 ? Math.round(usage.reduce((s, u) => s + u.employeesUsed, 0) / usage.length) : 0;
  const allModules = [...new Set(usage.flatMap((u) => u.modules))];
  const totalApiCalls = usage.reduce((s, u) => s + u.apiCallsToday, 0);

  const employeeDistribution = useMemo(() =>
    usage.map((u) => ({
      tenant: u.tenantName.length > 10 ? u.tenantName.slice(0, 10) : u.tenantName,
      employees: u.employeesUsed,
    })),
    [usage]
  );

  return (
    <div className="space-y-6">
      {/* Hero Banner */}
      <div className="thb-card p-6 bg-gradient-to-r from-cyan-600 via-green-500 to-emerald-500 border-0">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3"><FiBarChart2 className="w-7 h-7" /> Tenant Usage Metrics</h1>
            <p className="text-green-100 mt-1 text-sm">Monitor resource utilization and usage patterns across all tenants</p>
          </div>
          <button onClick={fetchUsage} className="inline-flex items-center gap-2 px-4 py-2.5 bg-white/20 backdrop-blur text-white rounded-lg font-medium text-sm hover:bg-white/30 transition-colors">
            <FiRefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="thb-card p-12 text-center">
          <FiRefreshCw className="w-8 h-8 mx-auto mb-3 text-thb-text-muted animate-spin" />
          <p className="text-thb-text-muted">Loading usage metrics…</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && usage.length === 0 && (
        <div className="thb-card p-12 text-center">
          <FiBarChart2 className="w-12 h-12 mx-auto mb-3 text-thb-text-muted opacity-40" />
          <p className="text-lg font-medium text-thb-text-primary">No tenants found</p>
          <p className="text-sm text-thb-text-muted mt-1">Usage metrics will appear when tenants are created.</p>
        </div>
      )}

      {/* Overview Cards */}
      {!loading && usage.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Storage Used', value: formatMB(totalStorage), icon: <FiHardDrive className="w-5 h-5" />, bg: 'bg-cyan-50 text-cyan-500' },
            { label: 'Avg Employee Count', value: avgEmployees, icon: <FiUsers className="w-5 h-5" />, bg: 'bg-green-50 text-green-500' },
            { label: 'Active Modules', value: allModules.length, icon: <FiLayers className="w-5 h-5" />, bg: 'bg-teal-50 text-teal-500' },
            { label: 'API Calls Today', value: totalApiCalls.toLocaleString(), icon: <FiCpu className="w-5 h-5" />, bg: 'bg-emerald-50 text-emerald-500' },
          ].map((card) => (
            <div key={card.label} className="thb-card p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-thb-text-muted">{card.label}</p>
                  <p className="text-2xl font-bold text-thb-text-primary mt-1">{card.value}</p>
                </div>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${card.bg}`}>{card.icon}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && usage.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Usage Table */}
          <div className="lg:col-span-2 thb-card overflow-hidden">
            <div className="p-4 border-b border-thb-border">
              <h3 className="font-semibold text-thb-text-primary flex items-center gap-2"><FiDatabase className="w-4 h-4" /> Per-Tenant Usage</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs text-thb-text-muted border-b border-thb-border bg-slate-50">
                  <th className="px-4 py-3 font-medium">Tenant</th>
                  <th className="px-4 py-3 font-medium">Employees</th>
                  <th className="px-4 py-3 font-medium">Storage</th>
                  <th className="px-4 py-3 font-medium">Modules</th>
                  <th className="px-4 py-3 font-medium">API Today</th>
                  <th className="px-4 py-3 font-medium">Last Active</th>
                </tr></thead>
                <tbody>
                  {usage.map((u) => {
                    const empPct = u.employeesLimit > 0 ? Math.round((u.employeesUsed / u.employeesLimit) * 100) : 0;
                    const stoPct = u.storageLimit > 0 ? Math.round((u.storageUsed / u.storageLimit) * 100) : 0;
                    return (
                      <tr key={u.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-3 font-medium text-thb-text-primary">{u.tenantName}</td>
                        <td className="px-4 py-3">
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-thb-text-secondary">{u.employeesUsed}/{u.employeesLimit}</span>
                              <span className={`font-medium ${getUsageText(empPct)}`}>{empPct}%</span>
                            </div>
                            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full transition-all ${getUsageColor(empPct)}`} style={{ width: `${Math.min(empPct, 100)}%` }} />
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-thb-text-secondary">{formatMB(u.storageUsed)}/{formatMB(u.storageLimit)}</span>
                              <span className={`font-medium ${getUsageText(stoPct)}`}>{stoPct}%</span>
                            </div>
                            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full transition-all ${getUsageColor(stoPct)}`} style={{ width: `${Math.min(stoPct, 100)}%` }} />
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">{u.modules.slice(0, 3).map((m) => <span key={m} className="thb-badge thb-badge-info text-[10px]">{m}</span>)}{u.modules.length > 3 && <span className="thb-badge thb-badge-warning text-[10px]">+{u.modules.length - 3}</span>}</div>
                        </td>
                        <td className="px-4 py-3 text-thb-text-primary font-medium">{u.apiCallsToday.toLocaleString()}</td>
                        <td className="px-4 py-3 text-thb-text-secondary">{u.lastActive}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Employee Distribution Chart */}
          <div className="thb-card p-5">
            <h3 className="font-semibold text-thb-text-primary mb-4 flex items-center gap-2"><FiActivity className="w-4 h-4" /> Employee Distribution</h3>
            {employeeDistribution.length > 0 ? (
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={employeeDistribution} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis type="number" tick={{ fontSize: 11 }} stroke="#94A3B8" />
                    <YAxis dataKey="tenant" type="category" tick={{ fontSize: 11 }} stroke="#94A3B8" width={70} />
                    <Tooltip formatter={(value: number) => [value, 'Employees']} />
                    <Bar dataKey="employees" fill="#3B82F6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-80 flex items-center justify-center text-thb-text-muted text-sm">No data yet</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
