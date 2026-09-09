'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  FiBarChart2, FiUsers, FiBriefcase, FiCheckCircle, FiXCircle,
  FiArrowLeft, FiRefreshCw, FiTrendingUp, FiFileText, FiAward,
  FiClock, FiTarget, FiActivity, FiExternalLink, FiCalendar,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
  LineChart, Line, AreaChart, Area,
} from 'recharts';
import { useAuthStore } from '@/store/authStore';
import ModuleIntro from '@/components/ModuleIntro';

/* ── Helpers ── */
function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

const STATUS_COLORS: Record<string, string> = {
  applied: '#3b82f6',
  screening: '#f59e0b',
  interview: '#f97316',
  offered: '#8b5cf6',
  hired: '#10b981',
  rejected: '#ef4444',
  talent_pool: '#6366f1',
};

const FORMAT_COLORS: Record<string, string> = {
  pdf: '#ef4444',
  docx: '#2563eb',
  doc: '#1e40af',
  text: '#64748b',
  unknown: '#cbd5e1',
};

interface AnalyticsData {
  window: { days: number; since: string; until: string };
  summary: {
    uniqueCandidates: number;
    totalApplications: number;
    applicationsPerCandidate: number;
    resumeUploadCount: number;
    resumeUploadRate: number;
    parseSuccessCount: number;
    parseFailureCount: number;
    parseSuccessRate: number | null;
    avgParseConfidence: number | null;
  };
  funnel: Record<string, number>;
  conversion: {
    applied_to_screening: number;
    screening_to_interview: number;
    interview_to_offer: number;
    offer_to_hire: number;
    overall_applied_to_hire: number;
  };
  registrationsOverTime: { date: string; count: number }[];
  applicationsOverTime: { date: string; count: number }[];
  byCompany: { name: string; count: number }[];
  byDepartment: { name: string; count: number }[];
  byJobPosting: { id: string; title: string; count: number; company?: string }[];
  byTenant: { id: string; name: string; count: number }[];
  bySource: { name: string; count: number }[];
  resumeBySourceFormat: { format: string; count: number }[];
  topSkills: { skill: string; count: number }[];
}

const FUNNEL_STAGES = [
  { key: 'applied', label: 'Applied', color: STATUS_COLORS.applied },
  { key: 'screening', label: 'Screening', color: STATUS_COLORS.screening },
  { key: 'interview', label: 'Interview', color: STATUS_COLORS.interview },
  { key: 'offered', label: 'Offered', color: STATUS_COLORS.offered },
  { key: 'hired', label: 'Hired', color: STATUS_COLORS.hired },
];

export default function CandidateFlowAnalyticsPage() {
  const { user } = useAuthStore();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(90);

  const fetchData = useCallback(async (windowDays: number) => {
    setLoading(true);
    try {
      const r = await fetch(`/api/analytics/candidate-flow?days=${windowDays}`, { headers: getAuthHeaders() });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed');
      setData(d);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(days);
  }, [days, fetchData]);

  const funnelChartData = data
    ? FUNNEL_STAGES.map(s => ({ name: s.label, count: data.funnel[s.key] || 0, fill: s.color }))
    : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <Link href="/recruitment" className="inline-flex items-center gap-1 text-xs text-thb-text-secondary hover:text-thb-text-primary mb-2">
            <FiArrowLeft className="w-3 h-3" /> Back to Recruitment
          </Link>
          <h1 className="text-2xl font-bold text-thb-text-primary flex items-center gap-2">
            <FiBarChart2 className="w-6 h-6 text-teal-600" /> Candidate Flow Analytics
          </h1>
          <p className="text-sm text-thb-text-secondary mt-1">
            Track registrations, applications, resume uploads, and the candidate-to-hire funnel
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={days}
            onChange={(e) => setDays(parseInt(e.target.value, 10))}
            className="px-3 py-2 border border-thb-border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
            <option value={180}>Last 6 months</option>
            <option value={365}>Last 1 year</option>
          </select>
          <button
            onClick={() => fetchData(days)}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3 py-2 border border-thb-border rounded-lg text-sm font-medium text-thb-text-secondary hover:bg-slate-50 disabled:opacity-50"
          >
            <FiRefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      <ModuleIntro
        title="Candidate Flow Analytics"
        subtitle="Registrations → Applications → Resume uploads → Screening → Interview → Offer → Hire"
        srsRef="REQ-STAT-01..05 · REQ-ANALYTICS-CAND-01"
        icon={<FiBarChart2 className="w-4 h-4" />}
        accent="violet"
        quickStats={
          data ? (
            <>
              <span><b className="text-slate-700">{data.summary.uniqueCandidates}</b> candidates</span>
              <span><b className="text-teal-600">{data.summary.totalApplications}</b> applications</span>
              <span><b className="text-emerald-600">{data.summary.resumeUploadCount}</b> resumes uploaded</span>
              <span><b className="text-green-600">{data.funnel.hired}</b> hired</span>
            </>
          ) : null
        }
      />

      {loading || !data ? (
        <div className="thb-card p-12 text-center">
          <div className="w-10 h-10 border-3 border-teal-200 border-t-teal-600 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-thb-text-secondary">Loading candidate flow analytics…</p>
        </div>
      ) : (
        <>
          {/* Summary KPI cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <KpiCard
              icon={<FiUsers className="w-5 h-5 text-white" />}
              label="Unique Candidates"
              value={String(data.summary.uniqueCandidates)}
              sublabel={`${data.summary.applicationsPerCandidate} apps/candidate`}
              accent="bg-green-500"
            />
            <KpiCard
              icon={<FiBriefcase className="w-5 h-5 text-white" />}
              label="Total Applications"
              value={String(data.summary.totalApplications)}
              sublabel={`last ${days} days`}
              accent="bg-teal-500"
            />
            <KpiCard
              icon={<FiFileText className="w-5 h-5 text-white" />}
              label="Resumes Uploaded"
              value={String(data.summary.resumeUploadCount)}
              sublabel={`${data.summary.resumeUploadRate}% of applications`}
              accent="bg-emerald-500"
            />
            <KpiCard
              icon={<FiCheckCircle className="w-5 h-5 text-white" />}
              label="Parse Success Rate"
              value={data.summary.parseSuccessRate !== null ? `${data.summary.parseSuccessRate}%` : '—'}
              sublabel={`${data.summary.parseSuccessCount}/${data.summary.parseSuccessCount + data.summary.parseFailureCount} parsed`}
              accent="bg-amber-500"
            />
            <KpiCard
              icon={<FiTrendingUp className="w-5 h-5 text-white" />}
              label="Avg Parse Confidence"
              value={data.summary.avgParseConfidence !== null ? `${data.summary.avgParseConfidence}%` : '—'}
              sublabel="across successful parses"
              accent="bg-rose-500"
            />
            <KpiCard
              icon={<FiAward className="w-5 h-5 text-white" />}
              label="Overall Hire Rate"
              value={`${data.conversion.overall_applied_to_hire}%`}
              sublabel={`${data.funnel.hired} hired of ${data.summary.totalApplications}`}
              accent="bg-emerald-500"
            />
          </div>

          {/* Conversion funnel */}
          <div className="thb-card p-5">
            <h3 className="text-sm font-semibold text-thb-text-primary mb-1 flex items-center gap-2">
              <FiActivity className="w-4 h-4 text-teal-600" /> Candidate Conversion Funnel
            </h3>
            <p className="text-xs text-thb-text-muted mb-4">
              How candidates progress through each stage of the hiring pipeline
            </p>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={funnelChartData} layout="vertical" margin={{ left: 20, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={80} />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                    formatter={((v: any) => [v, 'Candidates']) as any}
                  />
                  <Bar dataKey="count" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <div className="space-y-3">
                <ConversionRow
                  label="Applied → Screening"
                  rate={data.conversion.applied_to_screening}
                  from={data.funnel.applied}
                  to={data.funnel.screening}
                />
                <ConversionRow
                  label="Screening → Interview"
                  rate={data.conversion.screening_to_interview}
                  from={data.funnel.screening}
                  to={data.funnel.interview}
                />
                <ConversionRow
                  label="Interview → Offer"
                  rate={data.conversion.interview_to_offer}
                  from={data.funnel.interview}
                  to={data.funnel.offered}
                />
                <ConversionRow
                  label="Offer → Hire"
                  rate={data.conversion.offer_to_hire}
                  from={data.funnel.offered}
                  to={data.funnel.hired}
                />
                <div className="pt-3 mt-3 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-thb-text-primary">Overall: Applied → Hired</span>
                    <span className={`text-lg font-bold ${data.conversion.overall_applied_to_hire >= 10 ? 'text-emerald-600' : data.conversion.overall_applied_to_hire >= 5 ? 'text-amber-600' : 'text-rose-600'}`}>
                      {data.conversion.overall_applied_to_hire}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Time-series: registrations + applications over time */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="thb-card p-5">
              <h3 className="text-sm font-semibold text-thb-text-primary mb-1 flex items-center gap-2">
                <FiUsers className="w-4 h-4 text-green-500" /> Candidate Registrations Over Time
              </h3>
              <p className="text-xs text-thb-text-muted mb-4">New unique candidate emails (first application date)</p>
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={data.registrationsOverTime} margin={{ left: -10, right: 10 }}>
                  <defs>
                    <linearGradient id="regGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d: string) => d.slice(5)} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Area type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} fill="url(#regGrad)" name="New candidates" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="thb-card p-5">
              <h3 className="text-sm font-semibold text-thb-text-primary mb-1 flex items-center gap-2">
                <FiBriefcase className="w-4 h-4 text-teal-500" /> Applications Over Time
              </h3>
              <p className="text-xs text-thb-text-muted mb-4">All job applications submitted (daily)</p>
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={data.applicationsOverTime} margin={{ left: -10, right: 10 }}>
                  <defs>
                    <linearGradient id="appGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d: string) => d.slice(5)} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Area type="monotone" dataKey="count" stroke="#8b5cf6" strokeWidth={2} fill="url(#appGrad)" name="Applications" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Applications by company / department / job / source / tenant */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* By company */}
            <div className="thb-card p-5">
              <h3 className="text-sm font-semibold text-thb-text-primary mb-3 flex items-center gap-2">
                <FiBriefcase className="w-4 h-4 text-emerald-600" /> Applications by Company
              </h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={data.byCompany} layout="vertical" margin={{ left: 20, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={100} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Bar dataKey="count" fill="#10b981" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* By department */}
            <div className="thb-card p-5">
              <h3 className="text-sm font-semibold text-thb-text-primary mb-3 flex items-center gap-2">
                <FiUsers className="w-4 h-4 text-green-600" /> Applications by Department
              </h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={data.byDepartment} layout="vertical" margin={{ left: 20, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={120} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* By source */}
            <div className="thb-card p-5">
              <h3 className="text-sm font-semibold text-thb-text-primary mb-3 flex items-center gap-2">
                <FiTarget className="w-4 h-4 text-amber-600" /> Application Sources
              </h3>
              {data.bySource.length === 0 ? (
                <p className="text-sm text-thb-text-muted text-center py-12">No source data</p>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={data.bySource}
                      dataKey="count"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      label={(entry: any) => `${entry.name}: ${entry.count}`}
                      labelLine={false}
                    >
                      {data.bySource.map((entry, i) => (
                        <Cell
                          key={`src-${i}`}
                          fill={
                            entry.name === 'website' ? '#3b82f6' :
                            entry.name === 'referral' ? '#10b981' :
                            entry.name === 'linkedin' ? '#0a66c2' :
                            entry.name === 'naukri' ? '#ff7555' :
                            entry.name === 'indeed' ? '#2164f3' :
                            entry.name === 'glassdoor' ? '#0caa41' :
                            '#94a3b8'
                          }
                        />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Resume parse by format */}
            <div className="thb-card p-5">
              <h3 className="text-sm font-semibold text-thb-text-primary mb-3 flex items-center gap-2">
                <FiFileText className="w-4 h-4 text-rose-600" /> Resume Uploads by Format
              </h3>
              {data.resumeBySourceFormat.length === 0 ? (
                <p className="text-sm text-thb-text-muted text-center py-12">No resumes parsed yet</p>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={data.resumeBySourceFormat}
                      dataKey="count"
                      nameKey="format"
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      label={(entry: any) => `${entry.format}: ${entry.count}`}
                      labelLine={false}
                    >
                      {data.resumeBySourceFormat.map((entry, i) => (
                        <Cell key={`fmt-${i}`} fill={FORMAT_COLORS[entry.format] || '#cbd5e1'} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Top job postings + Top skills */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="thb-card p-5">
              <h3 className="text-sm font-semibold text-thb-text-primary mb-3 flex items-center gap-2">
                <FiBriefcase className="w-4 h-4 text-teal-600" /> Top Job Postings by Applications
              </h3>
              {data.byJobPosting.length === 0 ? (
                <p className="text-sm text-thb-text-muted text-center py-12">No applications yet</p>
              ) : (
                <div className="space-y-2">
                  {data.byJobPosting.map((job, i) => (
                    <div key={job.id} className="flex items-center gap-3 py-2 border-b border-slate-50 last:border-0">
                      <span className="text-xs font-mono text-thb-text-muted w-6">#{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <Link href={`/recruitment/${job.id}`} className="text-sm font-medium text-thb-text-primary hover:text-teal-600 hover:underline truncate block">
                          {job.title}
                        </Link>
                        {job.company && <p className="text-xs text-thb-text-muted">{job.company}</p>}
                      </div>
                      <span className="text-sm font-bold text-teal-600">{job.count}</span>
                      <Link href={`/recruitment/${job.id}`} className="text-thb-text-muted hover:text-teal-600">
                        <FiExternalLink className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="thb-card p-5">
              <h3 className="text-sm font-semibold text-thb-text-primary mb-3 flex items-center gap-2">
                <FiAward className="w-4 h-4 text-amber-600" /> Top Skills (from parsed resumes)
              </h3>
              {data.topSkills.length === 0 ? (
                <p className="text-sm text-thb-text-muted text-center py-12">No parsed resumes with skills yet</p>
              ) : (
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={data.topSkills.slice(0, 12)} layout="vertical" margin={{ left: 20, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                    <YAxis type="category" dataKey="skill" tick={{ fontSize: 10 }} width={100} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Bar dataKey="count" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Tenant breakdown (only useful if multiple tenants) */}
          {data.byTenant.length > 1 && (
            <div className="thb-card p-5">
              <h3 className="text-sm font-semibold text-thb-text-primary mb-3 flex items-center gap-2">
                <FiUsers className="w-4 h-4 text-emerald-600" /> Applications by Tenant
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {data.byTenant.map(t => (
                  <div key={t.id} className="p-3 rounded-lg border border-slate-200 bg-slate-50">
                    <p className="text-xs font-medium text-thb-text-secondary truncate">{t.name}</p>
                    <p className="text-xl font-bold text-thb-text-primary mt-1">{t.count}</p>
                    <p className="text-[10px] text-thb-text-muted">applications</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function KpiCard({
  icon, label, value, sublabel, accent,
}: { icon: React.ReactNode; label: string; value: string; sublabel?: string; accent: string }) {
  return (
    <div className="thb-card p-4 flex items-start gap-3">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${accent}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-medium text-thb-text-secondary uppercase tracking-wider truncate">{label}</p>
        <p className="text-xl font-bold text-thb-text-primary mt-0.5 truncate">{value}</p>
        {sublabel && <p className="text-[10px] text-thb-text-muted mt-0.5 truncate">{sublabel}</p>}
      </div>
    </div>
  );
}

function ConversionRow({ label, rate, from, to }: { label: string; rate: number; from: number; to: number }) {
  const color = rate >= 50 ? 'text-emerald-600' : rate >= 25 ? 'text-amber-600' : 'text-rose-600';
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-xs font-medium text-thb-text-primary">{label}</p>
        <p className="text-[10px] text-thb-text-muted">{from} → {to}</p>
      </div>
      <span className={`text-sm font-bold ${color}`}>{rate}%</span>
    </div>
  );
}
