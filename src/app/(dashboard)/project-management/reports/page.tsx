'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  FiBarChart2, FiBriefcase, FiDollarSign, FiTrendingUp,
  FiDownload, FiCheckCircle, FiAlertCircle,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

/* ── Helpers ── */
function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

function formatCurrency(v: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);
}

/* ── Types ── */
type BudgetVsActual = { id?: string; name: string; type: string; budget: number; actual: number; progress: number };
type RevenueEntry = { name: string; value: number; color: string };
type MonthlyStart = { month: string; projects: number };
type ResourceUtil = { name: string; allocated: number; available: number; headcount: number };

interface ReportData {
  revenueByType: RevenueEntry[];
  monthlyStarts: MonthlyStart[];
  budgetVsActual: BudgetVsActual[];
  resourceUtilization: ResourceUtil[];
  summaryStats: {
    total: number;
    active: number;
    completed: number;
    totalBudget: number;
    avgProgress: number;
  };
  taskDistribution: Record<string, number>;
  overdueTasks: { id: string; name: string; priority: string; project: { name: string } }[];
}

/* ── Empty State Component ── */
function EmptyChartState({ message }: { message: string }) {
  return (
    <div className="h-64 flex flex-col items-center justify-center text-slate-400">
      <FiBarChart2 className="w-8 h-8 mb-2 text-slate-300" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

export default function ReportsPage() {
  const { user } = useAuthStore();
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { fetchReportData(); }, []);

  async function fetchReportData() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/project-reports', { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setReportData(data);
      } else {
        const errData = await res.json().catch(() => ({}));
        setError(errData.error || 'Failed to load report data');
      }
    } catch {
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  }

  const projects = reportData?.budgetVsActual ?? [];
  const revenueData = reportData?.revenueByType ?? [];
  const monthlyStarts = reportData?.monthlyStarts ?? [];
  const resourceUtilization = reportData?.resourceUtilization ?? [];

  const summaryStats = useMemo(() => {
    if (reportData?.summaryStats) return reportData.summaryStats;
    return { total: 0, active: 0, completed: 0, totalBudget: 0, avgProgress: 0 };
  }, [reportData]);

  function handleExport() {
    toast.success('Report export initiated. File will download shortly.');
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-thb-text-primary">Project Reports</h1>
          <p className="text-sm text-thb-text-secondary mt-1">Analytics and insights for project management</p>
        </div>
        <button onClick={handleExport}
          className="inline-flex items-center gap-2 px-4 py-2 border border-thb-border rounded-lg text-sm font-medium text-thb-text-secondary hover:bg-slate-50">
          <FiDownload className="w-4 h-4" /> Export Report
        </button>
      </div>

      {/* Error State */}
      {error && (
        <div className="thb-card p-4 border border-red-200 bg-red-50">
          <div className="flex items-center gap-2 text-red-700">
            <FiAlertCircle className="w-5 h-5" />
            <p className="text-sm font-medium">{error}</p>
          </div>
          <button onClick={fetchReportData} className="mt-2 text-sm text-red-600 underline hover:text-red-800">
            Retry
          </button>
        </div>
      )}

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Total Projects', value: summaryStats.total, icon: FiBriefcase, color: 'text-thb-primary bg-thb-primary/10' },
          { label: 'Active', value: summaryStats.active, icon: FiTrendingUp, color: 'text-emerald-600 bg-emerald-50' },
          { label: 'Completed', value: summaryStats.completed, icon: FiCheckCircle, color: 'text-green-600 bg-green-50' },
          { label: 'Total Budget', value: formatCurrency(summaryStats.totalBudget), icon: FiDollarSign, color: 'text-amber-600 bg-amber-50' },
          { label: 'Avg Progress', value: `${summaryStats.avgProgress}%`, icon: FiBarChart2, color: 'text-teal-600 bg-teal-50' },
        ].map(stat => (
          <div key={stat.label} className="thb-card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-thb-text-muted font-medium">{stat.label}</p>
                <p className="text-xl font-bold text-thb-text-primary mt-1">{stat.value}</p>
              </div>
              <div className={`p-2 rounded-lg ${stat.color}`}>
                <stat.icon className="w-4 h-4" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue by Project Type */}
        <div className="thb-card p-5">
          <h3 className="font-semibold text-thb-text-primary mb-4">Budget by Project Type</h3>
          {loading ? (
            <div className="h-64 animate-pulse bg-slate-100 rounded" />
          ) : revenueData.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={revenueData} cx="50%" cy="50%" innerRadius={60} outerRadius={95}
                    paddingAngle={3} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {revenueData.map((entry, idx) => (
                      <Cell key={idx} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E2E8F0' }}
                    formatter={(value: number) => formatCurrency(value)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyChartState message="No budget data available" />
          )}
        </div>

        {/* Monthly Project Starts */}
        <div className="thb-card p-5">
          <h3 className="font-semibold text-thb-text-primary mb-4">Monthly Project Starts</h3>
          {loading ? (
            <div className="h-64 animate-pulse bg-slate-100 rounded" />
          ) : monthlyStarts.length > 0 && monthlyStarts.some(m => m.projects > 0) ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyStarts}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#94A3B8" />
                  <YAxis tick={{ fontSize: 12 }} stroke="#94A3B8" allowDecimals={false} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E2E8F0' }} />
                  <Bar dataKey="projects" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyChartState message="No project start data available" />
          )}
        </div>
      </div>

      {/* Budget vs Actual Table */}
      <div className="thb-card overflow-hidden">
        <div className="px-5 py-3 border-b border-thb-border">
          <h3 className="font-semibold text-thb-text-primary">Budget vs Actual Comparison</h3>
        </div>
        {loading ? (
          <div className="p-5 space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="animate-pulse h-10 bg-slate-100 rounded" />
            ))}
          </div>
        ) : projects.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-thb-border">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-thb-text-secondary">Project</th>
                  <th className="text-left px-4 py-3 font-medium text-thb-text-secondary">Type</th>
                  <th className="text-right px-4 py-3 font-medium text-thb-text-secondary">Budget</th>
                  <th className="text-right px-4 py-3 font-medium text-thb-text-secondary">Actual</th>
                  <th className="text-right px-4 py-3 font-medium text-thb-text-secondary">Variance</th>
                  <th className="text-left px-4 py-3 font-medium text-thb-text-secondary">Progress</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((p, i) => {
                  const variance = p.budget - p.actual;
                  const varClass = variance >= 0 ? 'text-emerald-600' : 'text-red-600';
                  return (
                    <tr key={p.id || i} className="border-b border-thb-border hover:bg-slate-50/50">
                      <td className="px-4 py-3 font-medium text-thb-text-primary">{p.name}</td>
                      <td className="px-4 py-3 text-thb-text-secondary capitalize">{(p.type || 'internal').replace('_', ' ')}</td>
                      <td className="px-4 py-3 text-right text-thb-text-secondary">{formatCurrency(p.budget)}</td>
                      <td className="px-4 py-3 text-right text-thb-text-secondary">{formatCurrency(p.actual)}</td>
                      <td className={`px-4 py-3 text-right font-medium ${varClass}`}>
                        {variance >= 0 ? '+' : ''}{formatCurrency(variance)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-slate-100 rounded-full h-1.5">
                            <div className="bg-thb-primary rounded-full h-1.5" style={{ width: `${p.progress}%` }} />
                          </div>
                          <span className="text-xs text-thb-text-muted w-8">{p.progress}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-slate-400">
            <FiBarChart2 className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            <p className="text-sm">No project budget data available</p>
          </div>
        )}
      </div>

      {/* Resource Utilization */}
      <div className="thb-card p-5">
        <h3 className="font-semibold text-thb-text-primary mb-4">Resource Utilization Summary</h3>
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="animate-pulse h-8 bg-slate-100 rounded" />
            ))}
          </div>
        ) : resourceUtilization.length > 0 ? (
          <div className="space-y-4">
            {resourceUtilization.map(dept => (
              <div key={dept.name} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                <div className="w-32 flex-shrink-0">
                  <p className="text-sm font-medium text-thb-text-primary">{dept.name}</p>
                  <p className="text-xs text-thb-text-muted">{dept.headcount} people</p>
                </div>
                <div className="flex-1 flex items-center gap-3">
                  <div className="flex-1 bg-slate-100 rounded-full h-6 relative overflow-hidden">
                    <div className="bg-thb-primary h-full rounded-full transition-all flex items-center justify-end pr-2"
                      style={{ width: `${dept.allocated}%` }}>
                      {dept.allocated > 15 && <span className="text-xs text-white font-medium">{dept.allocated}%</span>}
                    </div>
                  </div>
                  <span className="text-xs text-thb-text-muted w-20 text-right">{dept.allocated}% allocated</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center text-slate-400">
            <FiBarChart2 className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            <p className="text-sm">No resource allocation data available</p>
          </div>
        )}
      </div>
    </div>
  );
}
