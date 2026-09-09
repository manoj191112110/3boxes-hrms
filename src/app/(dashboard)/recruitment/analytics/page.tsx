'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  FiBarChart2, FiClock, FiTrendingUp, FiBriefcase, FiUsers,
  FiCheckCircle, FiXCircle, FiArrowLeft, FiRefreshCw,
  FiTarget, FiDollarSign, FiExternalLink,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
  LineChart, Line, Area, AreaChart,
} from 'recharts';

/* ── Helpers ── */
function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

function formatINR(amount: number): string {
  if (!amount || isNaN(amount)) return 'INR 0';
  // Indian-style lakh/crore formatting
  if (amount >= 10000000) return `INR ${(amount / 10000000).toFixed(2)} Cr`;
  if (amount >= 100000) return `INR ${(amount / 100000).toFixed(2)} L`;
  return `INR ${amount.toLocaleString('en-IN')}`;
}

const FUNNEL_STAGES = [
  { key: 'applied', label: 'Applied', color: '#3b82f6' },
  { key: 'screening', label: 'Screening', color: '#f59e0b' },
  { key: 'interview', label: 'Interview', color: '#f97316' },
  { key: 'offered', label: 'Offered', color: '#8b5cf6' },
  { key: 'hired', label: 'Hired', color: '#10b981' },
];

const SOURCE_COLORS: Record<string, string> = {
  website: '#3b82f6',
  referral: '#10b981',
  linkedin: '#0a66c2',
  indeed: '#2164f3',
  glassdoor: '#0caa41',
  stepstone: '#7a1fa2',
  naukri: '#ff7555',
  other: '#94a3b8',
  internal_careers: '#6366f1',
};

interface AnalyticsData {
  costPerHire: { amount: number; currency: string; breakdown: Record<string, number> };
  timeToFill: { avgDays: number; byDepartment: { department: string; avgDays: number; filledCount: number }[] };
  timeToHire: { avgDays: number; byDepartment: { department: string; avgDays: number; hiresCount: number }[] };
  funnelByStage: Record<string, number>;
  offersAccepted: number;
  offersRejected: number;
  offerAcceptanceRate: number;
  activeJobs: number;
  openRequisitions: number;
  bySource: Record<string, number>;
  byDepartment: { department: string; open: number; filled: number; avgTimeToFill: number }[];
  monthlyTrend: { month: string; hires: number; applications: number }[];
  boardPostings?: { total: number; posted: number; closed: number; failed: number; pending: number };
  generatedAt?: string;
}

/* ── KPI Card ── */
function KpiCard({
  icon, label, value, sublabel, accent,
}: { icon: React.ReactNode; label: string; value: string; sublabel?: string; accent: string }) {
  return (
    <div className="thb-card p-5 flex items-start gap-4">
      <div className={`w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0 ${accent}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-thb-text-secondary uppercase tracking-wider">{label}</p>
        <p className="text-2xl font-bold text-thb-text-primary mt-1 truncate">{value}</p>
        {sublabel && <p className="text-xs text-thb-text-muted mt-1">{sublabel}</p>}
      </div>
    </div>
  );
}

export default function RecruitmentAnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async (silent = false) => {
    try {
      if (silent) setRefreshing(true); else setLoading(true);
      const res = await fetch('/api/recruitment-analytics', { headers: getAuthHeaders() });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Failed to load analytics');
      }
      const json = await res.json();
      setData(json);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { queueMicrotask(() => fetchData()); }, [fetchData]);

  /* Funnel chart data */
  const funnelData = FUNNEL_STAGES.map(s => ({
    name: s.label,
    value: (data?.funnelByStage?.[s.key] ?? 0),
    color: s.color,
  }));

  /* Source pie data */
  const sourceEntries = Object.entries(data?.bySource || {});
  const sourceData = sourceEntries
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name, value, color: SOURCE_COLORS[name] || '#94a3b8' }));
  const totalSources = sourceData.reduce((s, d) => s + d.value, 0);

  /* Department table data */
  const deptRows = (data?.byDepartment || []).slice().sort((a, b) => (b.open + b.filled) - (a.open + a.filled));

  /* Monthly trend data */
  const trendData = (data?.monthlyTrend || []).map(t => ({
    month: t.month,
    hires: t.hires,
    applications: t.applications,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-thb-text-primary flex items-center gap-2">
            <FiBarChart2 className="w-6 h-6 text-teal-500" />
            Recruitment Analytics
          </h1>
          <p className="text-thb-text-secondary mt-1">
            Cost per Hire, Time to Fill, funnel conversion, and source effectiveness
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/recruitment"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-thb-border text-sm font-medium text-thb-text-secondary hover:bg-slate-50 transition-colors"
          >
            <FiArrowLeft className="w-4 h-4" /> Back to Recruitment
          </Link>
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-3 py-2 bg-teal-500 text-white rounded-lg text-sm font-medium hover:bg-teal-600 disabled:opacity-50 transition-colors"
          >
            <FiRefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="thb-card p-5 animate-pulse">
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-lg bg-slate-200" />
                <div className="flex-1">
                  <div className="h-3 w-20 bg-slate-200 rounded mb-2" />
                  <div className="h-6 w-24 bg-slate-200 rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : !data ? (
        <div className="thb-card p-12 text-center">
          <FiBarChart2 className="w-10 h-10 text-thb-text-muted mx-auto mb-3" />
          <p className="text-thb-text-secondary font-medium">Unable to load analytics</p>
        </div>
      ) : (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              icon={<FiDollarSign className="w-5 h-5 text-emerald-600" />}
              label="Cost per Hire"
              value={formatINR(data.costPerHire?.amount ?? 0)}
              sublabel={`Based on ${data.costPerHire?.breakdown?.hiresConsidered ?? 0} hire(s) in last 30 days`}
              accent="bg-emerald-50"
            />
            <KpiCard
              icon={<FiClock className="w-5 h-5 text-green-600" />}
              label="Time to Fill"
              value={`${data.timeToFill?.avgDays ?? 0} days`}
              sublabel={`Avg across ${Array.isArray(data.timeToFill?.byDepartment) ? data.timeToFill.byDepartment.length : 0} dept(s)`}
              accent="bg-green-50"
            />
            <KpiCard
              icon={<FiTrendingUp className="w-5 h-5 text-teal-600" />}
              label="Offer Acceptance Rate"
              value={`${data.offerAcceptanceRate ?? 0}%`}
              sublabel={`${data.offersAccepted ?? 0} accepted / ${data.offersRejected ?? 0} rejected`}
              accent="bg-teal-50"
            />
            <KpiCard
              icon={<FiBriefcase className="w-5 h-5 text-amber-600" />}
              label="Active Jobs"
              value={`${data.activeJobs ?? 0}`}
              sublabel={`${data.openRequisitions ?? 0} open requisition(s)`}
              accent="bg-amber-50"
            />
          </div>

          {/* Funnel + Source breakdown row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Funnel chart */}
            <div className="thb-card p-5 lg:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-thb-text-primary flex items-center gap-2">
                  <FiTarget className="w-4 h-4 text-green-500" /> Hiring Funnel
                </h2>
                <span className="text-xs text-thb-text-muted">
                  {data.funnelByStage?.applied ?? 0} total applications
                </span>
              </div>
            {funnelData.length > 0 && funnelData.some(d => d.value > 0) ? (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={funnelData} layout="vertical" margin={{ left: 20, right: 30, top: 10, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis type="number" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} stroke="#64748b" width={80} />
                    <Tooltip
                      contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
                      formatter={((v: number) => [`${v} candidate(s)`, 'Count']) as never}
                    />
                    <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                      {funnelData.map((entry, idx) => (
                        <Cell key={`cell-${idx}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-72 flex items-center justify-center text-sm text-thb-text-muted">
                No funnel data yet
              </div>
            )}

              {/* Conversion rates */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-4 pt-4 border-t border-thb-border">
                {FUNNEL_STAGES.map((stage, i) => {
                  const current = data.funnelByStage?.[stage.key] ?? 0;
                  const prev = i === 0 ? current : (data.funnelByStage?.[FUNNEL_STAGES[i - 1].key] ?? 0);
                  const conv = prev > 0 ? Math.round((current / prev) * 100) : 0;
                  return (
                    <div key={stage.key} className="text-center">
                      <p className="text-xs text-thb-text-muted uppercase tracking-wider">{stage.label}</p>
                      <p className="text-lg font-bold text-thb-text-primary mt-1">{current}</p>
                      {i > 0 && (
                        <p className="text-[10px] text-thb-text-muted mt-0.5">{conv}% conversion</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Source breakdown */}
            <div className="thb-card p-5">
              <h2 className="text-base font-semibold text-thb-text-primary mb-4 flex items-center gap-2">
                <FiUsers className="w-4 h-4 text-teal-500" /> Application Sources
              </h2>
              {sourceData.length > 0 ? (
                <>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={sourceData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={70}
                          innerRadius={40}
                          paddingAngle={2}
                        >
                          {sourceData.map((entry, idx) => (
                            <Cell key={`cell-${idx}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
                          formatter={((v: number, n: string) => [`${v} (${totalSources > 0 ? Math.round((v / totalSources) * 100) : 0}%)`, n]) as never}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-1.5 mt-3">
                    {sourceData.slice().sort((a, b) => b.value - a.value).map((s) => (
                      <div key={s.name} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-sm" style={{ background: s.color }} />
                          <span className="capitalize text-thb-text-secondary">{s.name}</span>
                        </div>
                        <span className="font-medium text-thb-text-primary">
                          {s.value} ({totalSources > 0 ? Math.round((s.value / totalSources) * 100) : 0}%)
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="h-48 flex items-center justify-center text-sm text-thb-text-muted">
                  No source data
                </div>
              )}
            </div>
          </div>

          {/* Department table + monthly trend */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Department table */}
            <div className="thb-card overflow-hidden lg:col-span-1">
              <div className="p-5 border-b border-thb-border">
                <h2 className="text-base font-semibold text-thb-text-primary flex items-center gap-2">
                  <FiBriefcase className="w-4 h-4 text-green-500" /> By Department
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-thb-border bg-slate-50/50">
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Department</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Open</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Filled</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Avg TTF</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deptRows.length > 0 ? deptRows.map((d) => (
                      <tr key={d.department} className="border-b border-thb-border/50 hover:bg-slate-50/50">
                        <td className="px-4 py-2.5 text-sm font-medium text-thb-text-primary">{d.department}</td>
                        <td className="px-4 py-2.5 text-sm text-right text-green-600 font-medium">{d.open}</td>
                        <td className="px-4 py-2.5 text-sm text-right text-emerald-600 font-medium">{d.filled}</td>
                        <td className="px-4 py-2.5 text-sm text-right text-thb-text-secondary">
                          {d.avgTimeToFill > 0 ? `${d.avgTimeToFill}d` : '—'}
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-sm text-thb-text-muted">
                          No department data
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Monthly trend */}
            <div className="thb-card p-5 lg:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-thb-text-primary flex items-center gap-2">
                  <FiTrendingUp className="w-4 h-4 text-teal-500" /> 6-Month Trend
                </h2>
                <div className="flex items-center gap-4 text-xs">
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-1.5 rounded-sm bg-teal-500" />
                    <span className="text-thb-text-secondary">Applications</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-1.5 rounded-sm bg-emerald-500" />
                    <span className="text-thb-text-secondary">Hires</span>
                  </span>
                </div>
              </div>
              {trendData.length > 0 ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trendData} margin={{ left: -10, right: 10, top: 10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="appsGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="hiresGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                      <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" allowDecimals={false} />
                      <Tooltip
                        contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
                      />
                      <Area type="monotone" dataKey="applications" stroke="#8b5cf6" strokeWidth={2} fill="url(#appsGrad)" />
                      <Area type="monotone" dataKey="hires" stroke="#10b981" strokeWidth={2} fill="url(#hiresGrad)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center text-sm text-thb-text-muted">
                  No trend data yet
                </div>
              )}
            </div>
          </div>

          {/* Time to Fill + Time to Hire by dept */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="thb-card p-5">
              <h2 className="text-base font-semibold text-thb-text-primary mb-4 flex items-center gap-2">
                <FiClock className="w-4 h-4 text-green-500" /> Time to Fill by Department
              </h2>
              {Array.isArray(data.timeToFill?.byDepartment) && data.timeToFill.byDepartment.length > 0 ? (
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.timeToFill.byDepartment} margin={{ left: -10, right: 10, top: 10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="department" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                      <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" allowDecimals={false} />
                      <Tooltip
                        contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
                        formatter={((v: number) => [`${v} days`, 'Avg TTF']) as never}
                      />
                      <Bar dataKey="avgDays" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-56 flex items-center justify-center text-sm text-thb-text-muted">
                  No filled jobs with closingDate set yet
                </div>
              )}
            </div>

            <div className="thb-card p-5">
              <h2 className="text-base font-semibold text-thb-text-primary mb-4 flex items-center gap-2">
                <FiClock className="w-4 h-4 text-emerald-500" /> Time to Hire by Department
              </h2>
              {Array.isArray(data.timeToHire?.byDepartment) && data.timeToHire.byDepartment.length > 0 ? (
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.timeToHire.byDepartment} margin={{ left: -10, right: 10, top: 10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="department" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                      <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" allowDecimals={false} />
                      <Tooltip
                        contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
                        formatter={((v: number) => [`${v} days`, 'Avg TTH']) as never}
                      />
                      <Bar dataKey="avgDays" fill="#10b981" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-56 flex items-center justify-center text-sm text-thb-text-muted">
                  No hires with linked offer + application yet
                </div>
              )}
            </div>
          </div>

          {/* Offers summary + Board postings summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="thb-card p-5">
              <p className="text-xs font-medium text-thb-text-secondary uppercase tracking-wider">Offers Accepted</p>
              <div className="flex items-center gap-3 mt-2">
                <FiCheckCircle className="w-7 h-7 text-emerald-500" />
                <span className="text-2xl font-bold text-thb-text-primary">{data.offersAccepted ?? 0}</span>
              </div>
            </div>
            <div className="thb-card p-5">
              <p className="text-xs font-medium text-thb-text-secondary uppercase tracking-wider">Offers Rejected</p>
              <div className="flex items-center gap-3 mt-2">
                <FiXCircle className="w-7 h-7 text-red-500" />
                <span className="text-2xl font-bold text-thb-text-primary">{data.offersRejected ?? 0}</span>
              </div>
            </div>
            <div className="thb-card p-5">
              <p className="text-xs font-medium text-thb-text-secondary uppercase tracking-wider">Board Postings</p>
              <div className="flex items-center gap-3 mt-2">
                <FiExternalLink className="w-7 h-7 text-teal-500" />
                <div>
                  <span className="text-2xl font-bold text-thb-text-primary">{data.boardPostings?.total ?? 0}</span>
                  <span className="text-xs text-thb-text-muted ml-2">
                    ({data.boardPostings?.posted ?? 0} live, {data.boardPostings?.closed ?? 0} closed)
                  </span>
                </div>
              </div>
              <Link
                href="/recruitment/job-boards"
                className="text-xs text-teal-600 hover:text-teal-700 font-medium mt-2 inline-block"
              >
                Manage board postings →
              </Link>
            </div>
          </div>

          {/* Footer note */}
          <p className="text-xs text-thb-text-muted text-center pt-2">
            Cost per Hire formula: (offeredSalary × 0.1 + INR 50,000 fixed) per hire in last 30 days, averaged.
            All amounts normalized to INR. Generated at {data.generatedAt ? new Date(data.generatedAt).toLocaleString() : '—'}.
          </p>
        </>
      )}
    </div>
  );
}
