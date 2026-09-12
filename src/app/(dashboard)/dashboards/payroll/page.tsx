'use client';

/* ───────────────────────────────────────────────────────────────
   3Boxes HRMS — Payroll Dashboard
   A SmartHR-style payroll overview with stat cards, trend charts,
   breakdown visualisations, recent runs table, pending items and
   quick-action shortcuts.
   ─────────────────────────────────────────────────────────────── */

import { useEffect, useState, useRef, Suspense } from 'react';
import {
  FiDollarSign,
  FiTrendingDown,
  FiCreditCard,
  FiBriefcase,
  FiClock,
  FiPauseCircle,
  FiBarChart2,
  FiUsers,
  FiArrowRight,
  FiPlay,
  FiFileText,
  FiSettings,
  FiDownload,
  FiLayout,
  FiCalendar,
  FiCheckCircle,
  FiAlertTriangle,
  FiLoader,
  FiRefreshCw,
  FiExternalLink,
  FiZap,
  FiGrid,
} from 'react-icons/fi';
import ModuleDashboardShell, { DashboardTabConfig } from '@/components/ModuleDashboardShell';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import { useCompanyContextStore } from '@/store/companyContextStore';
import { getClientSiteMode } from '@/lib/site-mode';

/* ─── Colours ─── */
const COLORS: Record<string, string> = {
  indigo: '#6366F1',
  emerald: '#10B981',
  amber: '#F59E0B',
  pink: '#EC4899',
  cyan: '#06B6D4',
  violet: '#8B5CF6',
};
const PIE_COLORS = [COLORS.indigo, COLORS.emerald, COLORS.amber, COLORS.pink, COLORS.cyan, COLORS.violet];

/* ─── Auth helper ─── */
function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/* ─── Currency formatter ─── */
function fmtCurrency(val: number): string {
  if (val >= 1_00_00_000) return `₹${(val / 1_00_00_000).toFixed(2)} Cr`;
  if (val >= 1_00_000) return `₹${(val / 1_00_000).toFixed(2)} L`;
  return `₹${val.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function fmtShort(val: number): string {
  if (val >= 1_00_00_000) return `${(val / 1_00_00_000).toFixed(1)}Cr`;
  if (val >= 1_00_000) return `${(val / 1_00_000).toFixed(1)}L`;
  if (val >= 1_000) return `${(val / 1_000).toFixed(1)}K`;
  return String(val);
}

/* ─── Types ─── */
interface DashboardMetrics {
  totalEmployeesProcessed: number;
  totalActiveEmployees: number;
  totalGrossPay: number;
  totalDeductions: number;
  totalNetPay: number;
  totalEmployerContrib: number;
  pendingApprovals: number;
  activeHolds: number;
}

interface MonthlyTrendItem {
  period: string;
  grossPay: number;
  deductions: number;
  netPay: number;
  employerContrib: number;
  employees: number;
}

interface DepartmentItem {
  departmentId: string;
  departmentName: string;
  headcount: number;
  totalSalary: number;
  avgSalary: number;
}

interface RecentRun {
  id: string;
  payrollPeriod: string;
  runStatus: string;
  totalEmployees: number;
  totalGrossPay: number;
  totalNetPay: number;
  runType?: string;
  createdAt: string;
}

interface DashboardData {
  currentPeriod: string;
  metrics: DashboardMetrics;
  recentRuns: RecentRun[];
  monthlyTrend: MonthlyTrendItem[];
  departmentBreakdown: DepartmentItem[];
}

/* ─── Fallback demo data ─── */
const DEMO_DATA: DashboardData = {
  currentPeriod: '2026-07',
  metrics: {
    totalEmployeesProcessed: 248,
    totalActiveEmployees: 312,
    totalGrossPay: 1_85_40_000,
    totalDeductions: 42_60_000,
    totalNetPay: 1_42_80_000,
    totalEmployerContrib: 28_35_000,
    pendingApprovals: 3,
    activeHolds: 5,
  },
  recentRuns: [
    { id: 'r1', payrollPeriod: '2026-07', runStatus: 'PROCESSED', totalEmployees: 248, totalGrossPay: 1_85_40_000, totalNetPay: 1_42_80_000, runType: 'REGULAR', createdAt: '2026-07-01T10:00:00Z' },
    { id: 'r2', payrollPeriod: '2026-06', runStatus: 'PROCESSED', totalEmployees: 244, totalGrossPay: 1_82_10_000, totalNetPay: 1_40_20_000, runType: 'REGULAR', createdAt: '2026-06-01T10:00:00Z' },
    { id: 'r3', payrollPeriod: '2026-05', runStatus: 'REVIEW', totalEmployees: 240, totalGrossPay: 1_79_50_000, totalNetPay: 1_38_30_000, runType: 'REGULAR', createdAt: '2026-05-01T10:00:00Z' },
    { id: 'r4', payrollPeriod: '2026-04', runStatus: 'PROCESSED', totalEmployees: 236, totalGrossPay: 1_76_80_000, totalNetPay: 1_36_10_000, runType: 'SUPPLEMENTAL', createdAt: '2026-04-01T10:00:00Z' },
    { id: 'r5', payrollPeriod: '2026-03', runStatus: 'DRAFT', totalEmployees: 232, totalGrossPay: 1_74_00_000, totalNetPay: 1_34_00_000, runType: 'REGULAR', createdAt: '2026-03-01T10:00:00Z' },
  ],
  monthlyTrend: [
    { period: '2026-02', grossPay: 1_68_00_000, deductions: 38_40_000, netPay: 1_29_60_000, employerContrib: 25_20_000, employees: 224 },
    { period: '2026-03', grossPay: 1_74_00_000, deductions: 39_80_000, netPay: 1_34_20_000, employerContrib: 26_10_000, employees: 232 },
    { period: '2026-04', grossPay: 1_76_80_000, deductions: 40_40_000, netPay: 1_36_40_000, employerContrib: 26_52_000, employees: 236 },
    { period: '2026-05', grossPay: 1_79_50_000, deductions: 41_00_000, netPay: 1_38_50_000, employerContrib: 26_92_000, employees: 240 },
    { period: '2026-06', grossPay: 1_82_10_000, deductions: 41_80_000, netPay: 1_40_30_000, employerContrib: 27_31_000, employees: 244 },
    { period: '2026-07', grossPay: 1_85_40_000, deductions: 42_60_000, netPay: 1_42_80_000, employerContrib: 28_35_000, employees: 248 },
  ],
  departmentBreakdown: [
    { departmentId: 'd1', departmentName: 'Engineering', headcount: 86, totalSalary: 72_00_000, avgSalary: 83_721 },
    { departmentId: 'd2', departmentName: 'Sales', headcount: 62, totalSalary: 40_30_000, avgSalary: 64_839 },
    { departmentId: 'd3', departmentName: 'Marketing', headcount: 34, totalSalary: 21_10_000, avgSalary: 62_059 },
    { departmentId: 'd4', departmentName: 'Finance', headcount: 28, totalSalary: 19_60_000, avgSalary: 70_000 },
    { departmentId: 'd5', departmentName: 'HR', headcount: 24, totalSalary: 16_80_000, avgSalary: 70_000 },
    { departmentId: 'd6', departmentName: 'Operations', headcount: 78, totalSalary: 15_60_000, avgSalary: 20_000 },
  ],
};

/* ─── Status badge helper ─── */
function statusBadge(status: string) {
  const s = status.toUpperCase();
  const map: Record<string, { cls: string; label: string }> = {
    PROCESSED: { cls: 'thb-badge thb-badge-success', label: 'Processed' },
    COMPLETED: { cls: 'thb-badge thb-badge-success', label: 'Completed' },
    REVIEW:    { cls: 'thb-badge thb-badge-warning', label: 'Review' },
    DRAFT:     { cls: 'thb-badge thb-badge-info', label: 'Draft' },
    FAILED:    { cls: 'thb-badge thb-badge-error', label: 'Failed' },
    ON_HOLD:   { cls: 'thb-badge thb-badge-purple', label: 'On Hold' },
  };
  const info = map[s] || { cls: 'thb-badge thb-badge-info', label: status };
  return <span className={info.cls}>{info.label}</span>;
}

/* ─── Custom tooltip ─── */
interface ChartTooltipProps {
  active?: boolean;
  payload?: Array<{ color: string; name: string; value: number }>;
  label?: string;
}

function ChartTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="thb-card p-3 text-xs" style={{ background: '#fff', border: '1px solid #E2E8F0' }}>
      <p className="font-semibold text-slate-700 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-full" style={{ background: p.color }} />
          {p.name}: {fmtCurrency(p.value)}
        </p>
      ))}
    </div>
  );
}

interface PieTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; payload?: { percent?: number } }>;
}

function PieTooltip({ active, payload }: PieTooltipProps) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div className="thb-card p-3 text-xs" style={{ background: '#fff', border: '1px solid #E2E8F0' }}>
      <p className="font-semibold text-slate-700">{d.name}: {fmtCurrency(d.value)}</p>
      {d.payload?.percent !== undefined && (
        <p className="text-slate-500">{((d.payload.percent as number) * 100).toFixed(1)}%</p>
      )}
    </div>
  );
}

/* ─── Stat card ─── */
interface StatCardProps {
  title: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
  sub?: string;
}

function StatCard({ title, value, icon: Icon, color, bgColor, sub }: StatCardProps) {
  return (
    <div className="thb-card thb-card-hover p-5 flex items-start gap-4">
      <div className={`flex items-center justify-center w-12 h-12 rounded-xl ${bgColor}`}>
        <Icon className={`w-6 h-6 ${color}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-500 truncate">{title}</p>
        <p className={`text-xl font-bold mt-0.5 ${color}`}>{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
      </div>
    </div>
  );
}

/* ─── Skeleton loader ─── */
function SkeletonCard() {
  return (
    <div className="thb-card p-5 animate-pulse">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl bg-slate-200" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-24 bg-slate-200 rounded" />
          <div className="h-6 w-32 bg-slate-200 rounded" />
          <div className="h-3 w-16 bg-slate-100 rounded" />
        </div>
      </div>
    </div>
  );
}

function SkeletonChart() {
  return (
    <div className="thb-card p-6 animate-pulse">
      <div className="h-4 w-40 bg-slate-200 rounded mb-4" />
      <div className="h-56 bg-slate-100 rounded" />
    </div>
  );
}

function SkeletonTable() {
  return (
    <div className="thb-card p-6 animate-pulse space-y-3">
      <div className="h-4 w-48 bg-slate-200 rounded" />
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex gap-4">
          <div className="h-4 w-20 bg-slate-200 rounded" />
          <div className="h-4 w-16 bg-slate-100 rounded" />
          <div className="h-4 w-12 bg-slate-100 rounded" />
          <div className="h-4 w-24 bg-slate-100 rounded" />
          <div className="h-4 w-24 bg-slate-100 rounded" />
          <div className="h-4 w-16 bg-slate-100 rounded" />
        </div>
      ))}
    </div>
  );
}

/* ── Placeholder Tabs ── */

const payrollTabs: DashboardTabConfig[] = [
  { label: 'Overview', key: 'overview', icon: <FiGrid className="w-4 h-4" /> },
  { label: 'Reports', key: 'reports', icon: <FiFileText className="w-4 h-4" />, isNew: true },
  { label: 'Settings', key: 'settings', icon: <FiSettings className="w-4 h-4" />, isNew: true },
];

function PayrollReportsPlaceholder() {
  return (
    <div className="flex flex-col items-center py-8">
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg mb-4">
        <FiFileText className="w-7 h-7 text-white" />
      </div>
      <h3 className="text-lg font-bold text-thb-text-primary mb-1">Reports & Analytics</h3>
      <p className="text-sm text-thb-text-secondary text-center max-w-md mb-4">
        Payroll registers, tax reports, and salary analytics
      </p>
      <a href="/payroll/reports" className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors">
        <FiBarChart2 className="w-4 h-4" /> Go to Reports
      </a>
    </div>
  );
}

function PayrollSettingsPlaceholder() {
  return (
    <div className="flex flex-col items-center py-8">
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-slate-500 to-slate-700 flex items-center justify-center shadow-lg mb-4">
        <FiSettings className="w-7 h-7 text-white" />
      </div>
      <h3 className="text-lg font-bold text-thb-text-primary mb-1">Settings & Configuration</h3>
      <p className="text-sm text-thb-text-secondary text-center max-w-md mb-4">
        Configure salary structures, tax slabs, deduction rules, and payroll cycles
      </p>
      <a href="/payroll/salary-settings" className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors">
        <FiSettings className="w-4 h-4" /> Go to Settings
      </a>
    </div>
  );
}

function PayrollPageContent() {
  return (
    <ModuleDashboardShell
      moduleKey="payroll"
      moduleLabel="Payroll"
      moduleIcon={<FiDollarSign className="w-5 h-5 text-white" />}
      gradientColor="from-green-500 to-emerald-600"
      tabs={payrollTabs}
      overviewContent={<PayrollContent />}
      children={{
        reports: <PayrollReportsPlaceholder />,
        settings: <PayrollSettingsPlaceholder />,
      }}
    />
  );
}

export default function PayrollDashboardPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-20"><div className="animate-spin w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full" /></div>}>
      <PayrollPageContent />
    </Suspense>
  );
}

/* ── Payroll Content ── */

function PayrollContent() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const initialFetchDone = useRef(false);

  useAuthStore();
  const { selectedCompany } = useCompanyContextStore();

  /* ─── Fetch dashboard data ─── */
  async function doFetch(showToast = false, companyId?: string) {
    if (showToast) setRefreshing(true);
    else setLoading(true);

    try {
      const params = new URLSearchParams();
      const cid = companyId || selectedCompany?.id;
      if (cid) params.set('companyId', cid);

      const res = await fetch(`/api/payroll/dashboard?${params.toString()}`, {
        headers: getAuthHeaders(),
      });

      if (res.ok) {
        const json = await res.json();
        const m = json.metrics || {};
        const hasData = m.totalGrossPay > 0 || m.totalNetPay > 0;
        // GOLDEN RULE: On LIVE site, NEVER fall back to DEMO_DATA — show real data
        // even if it's zeros. DEMO_DATA is only for the demo/showcase site.
        const isLive = getClientSiteMode() === 'live';
        setData(hasData || isLive ? json : DEMO_DATA);
      } else {
        // On API failure, only use DEMO_DATA on demo sites
        const isLive = getClientSiteMode() === 'live';
        if (isLive) {
          setData(json || { metrics: {}, recentRuns: [], monthlyTrend: [], departmentBreakdown: [] });
        } else {
          setData(DEMO_DATA);
        }
      }
    } catch {
      // On error, only use DEMO_DATA on demo sites
      const isLive = getClientSiteMode() === 'live';
      if (!isLive) {
        setData(DEMO_DATA);
        if (showToast) toast.error('Could not refresh dashboard — showing demo data');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    if (!initialFetchDone.current) {
      initialFetchDone.current = true;
      doFetch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-fetch when company changes
  useEffect(() => {
    if (initialFetchDone.current) {
      doFetch(false, selectedCompany?.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCompany?.id]);

  /* ─── Derived chart data ─── */
  const trendChartData = (data?.monthlyTrend || []).map(t => ({
    period: t.period,
    Gross: t.grossPay,
    Deductions: t.deductions,
    'Net Pay': t.netPay,
  }));

  const deptChartData = (data?.departmentBreakdown || []).map(d => ({
    name: d.departmentName,
    salary: d.totalSalary,
    headcount: d.headcount,
  }));

  // Payroll run status distribution
  const runStatusData = (() => {
    const runs = data?.recentRuns || [];
    const counts: Record<string, number> = { Processed: 0, Review: 0, Draft: 0 };
    runs.forEach(r => {
      const s = r.runStatus?.toUpperCase();
      if (s === 'PROCESSED' || s === 'COMPLETED') counts.Processed++;
      else if (s === 'REVIEW') counts.Review++;
      else counts.Draft++;
    });
    // Ensure at least demo values — DEMO ONLY (GOLDEN RULE: no dummy data on live)
    const isDemoMode = getClientSiteMode() !== 'live';
    if (isDemoMode && counts.Processed + counts.Review + counts.Draft === 0) {
      counts.Processed = 3;
      counts.Review = 1;
      counts.Draft = 1;
    }
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  })();

  // Cost distribution (derived from current metrics)
  const costDistributionData = (() => {
    const m = data?.metrics;
    const isDemoMode = getClientSiteMode() !== 'live';
    if (!m || m.totalGrossPay === 0) {
      // On LIVE, show empty array instead of fake values
      if (!isDemoMode) return [];
      return [
        { name: 'Basic', value: 85_00_000 },
        { name: 'HRA', value: 38_00_000 },
        { name: 'Allowances', value: 35_40_000 },
        { name: 'Deductions', value: 42_60_000 },
      ];
    }
    const basic = Math.round(m.totalGrossPay * 0.46);
    const hra = Math.round(m.totalGrossPay * 0.2);
    const allowances = m.totalGrossPay - basic - hra;
    return [
      { name: 'Basic', value: basic },
      { name: 'HRA', value: hra },
      { name: 'Allowances', value: allowances },
      { name: 'Deductions', value: m.totalDeductions },
    ];
  })();

  // Pending items — GOLDEN RULE: use 0 as fallback, NOT DEMO_DATA
  const pendingApprovals = data?.metrics?.pendingApprovals ?? 0;
  const activeHolds = data?.metrics?.activeHolds ?? 0;

  // Upcoming filing deadlines — DEMO ONLY (on live, show empty until real config API exists)
  const filingDeadlines = getClientSiteMode() !== 'live' ? [
    { title: 'TDS Return Q1', due: '2026-07-31', status: 'AMBER' },
    { title: 'PF Monthly Return', due: '2026-07-15', status: 'RED' },
    { title: 'ESI Half-Yearly', due: '2026-08-11', status: 'GREEN' },
    { title: 'Professional Tax', due: '2026-07-31', status: 'AMBER' },
  ] : [];

  /* ─── Quick actions ─── */
  const quickActions = [
    { label: 'Run Payroll', icon: FiPlay, color: 'text-emerald-600', bg: 'bg-emerald-50', route: '/payroll/processing' },
    { label: 'View Payslips', icon: FiFileText, color: 'text-emerald-600', bg: 'bg-emerald-50', route: '/payroll/payslips' },
    { label: 'Tax Settings', icon: FiSettings, color: 'text-amber-600', bg: 'bg-amber-50', route: '/payroll/tax-slabs' },
    { label: 'Bank Files', icon: FiDownload, color: 'text-cyan-600', bg: 'bg-cyan-50', route: '/payroll/bank-files' },
    { label: 'GL Mapping', icon: FiLayout, color: 'text-teal-600', bg: 'bg-teal-50', route: '/payroll/gl-mapping' },
    { label: 'Compliance Calendar', icon: FiCalendar, color: 'text-pink-600', bg: 'bg-pink-50', route: '/payroll/compliance' },
  ];

  /* ═══ RENDER ═══ */
  return (
    <div className="min-h-screen bg-[var(--thb-background)]">
      {/* ─── Hero ─── */}
      <div
        className="relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 40%, #06B6D4 100%)',
        }}
      >
        <div className="absolute inset-0 opacity-10">
          <svg width="100%" height="100%">
            <defs>
              <pattern id="hero-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#hero-grid)" />
          </svg>
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <FiDollarSign className="w-8 h-8 text-white/90" />
                <h1 className="text-2xl sm:text-3xl font-bold text-white">Payroll Dashboard</h1>
              </div>
              <p className="text-white/70 text-sm sm:text-base">
                3Boxes HRMS — Comprehensive payroll overview &amp; analytics
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="thb-badge bg-white/20 text-white backdrop-blur-sm text-sm px-4 py-1.5">
                <FiCalendar className="w-4 h-4 mr-1.5" />
                {data?.currentPeriod || '2026-07'}
              </span>
              <button
                onClick={() => doFetch(true)}
                className="p-2 rounded-lg bg-white/20 hover:bg-white/30 text-white transition-colors"
                title="Refresh dashboard"
              >
                <FiRefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* ─── Stat Cards ─── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {loading ? (
            [...Array(6)].map((_, i) => <SkeletonCard key={i} />)
          ) : (
            <>
              <StatCard
                title="Total Gross Pay"
                value={fmtCurrency(data?.metrics?.totalGrossPay ?? 0)}
                icon={FiDollarSign}
                color="text-emerald-600"
                bgColor="bg-emerald-50"
                sub={`${data?.metrics?.totalEmployeesProcessed ?? 0} employees`}
              />
              <StatCard
                title="Total Deductions"
                value={fmtCurrency(data?.metrics?.totalDeductions ?? 0)}
                icon={FiTrendingDown}
                color="text-pink-600"
                bgColor="bg-pink-50"
                sub="Tax, PF, ESI &amp; others"
              />
              <StatCard
                title="Net Pay Disbursed"
                value={fmtCurrency(data?.metrics?.totalNetPay ?? 0)}
                icon={FiCreditCard}
                color="text-emerald-600"
                bgColor="bg-emerald-50"
                sub="Credited to bank accounts"
              />
              <StatCard
                title="Employer Contributions"
                value={fmtCurrency(data?.metrics?.totalEmployerContrib ?? 0)}
                icon={FiBriefcase}
                color="text-amber-600"
                bgColor="bg-amber-50"
                sub="PF, ESI, Gratuity"
              />
              <StatCard
                title="Pending Approvals"
                value={String(pendingApprovals)}
                icon={FiClock}
                color="text-orange-600"
                bgColor="bg-orange-50"
                sub={pendingApprovals > 0 ? 'Requires attention' : 'All clear'}
              />
              <StatCard
                title="Active Holds"
                value={String(activeHolds)}
                icon={FiPauseCircle}
                color="text-teal-600"
                bgColor="bg-teal-50"
                sub={activeHolds > 0 ? 'On payroll hold' : 'No holds'}
              />
            </>
          )}
        </div>

        {/* ─── Charts Row 1: Monthly Trend + Department Breakdown ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Monthly Payroll Trend — Area Chart */}
          <div className="lg:col-span-3 thb-card p-6">
            {loading ? (
              <SkeletonChart />
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-semibold text-slate-800 flex items-center gap-2">
                    <FiBarChart2 className="w-5 h-5 text-emerald-500" />
                    Monthly Payroll Trend
                  </h3>
                  <span className="text-xs text-slate-400">Last 6 months</span>
                </div>
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={trendChartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                    <defs>
                      <linearGradient id="gradGross" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={COLORS.indigo} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={COLORS.indigo} stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="gradNet" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={COLORS.emerald} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={COLORS.emerald} stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="gradDeduct" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={COLORS.pink} stopOpacity={0.25} />
                        <stop offset="95%" stopColor={COLORS.pink} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#94A3B8' }} />
                    <YAxis
                      tickFormatter={fmtShort}
                      tick={{ fontSize: 11, fill: '#94A3B8' }}
                      width={48}
                    />
                    <Tooltip content={<ChartTooltip />} />
                    <Area type="monotone" dataKey="Gross" stroke={COLORS.indigo} strokeWidth={2} fill="url(#gradGross)" name="Gross Pay" />
                    <Area type="monotone" dataKey="Deductions" stroke={COLORS.pink} strokeWidth={2} fill="url(#gradDeduct)" name="Deductions" />
                    <Area type="monotone" dataKey="Net Pay" stroke={COLORS.emerald} strokeWidth={2} fill="url(#gradNet)" name="Net Pay" />
                  </AreaChart>
                </ResponsiveContainer>
                <div className="flex items-center justify-center gap-6 mt-3 text-xs text-slate-500">
                  <span className="flex items-center gap-1.5"><span className="w-3 h-1 rounded" style={{ background: COLORS.indigo }} /> Gross</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-1 rounded" style={{ background: COLORS.pink }} /> Deductions</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-1 rounded" style={{ background: COLORS.emerald }} /> Net Pay</span>
                </div>
              </>
            )}
          </div>

          {/* Department Salary Breakdown — Horizontal Bar Chart */}
          <div className="lg:col-span-2 thb-card p-6">
            {loading ? (
              <SkeletonChart />
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-semibold text-slate-800 flex items-center gap-2">
                    <FiUsers className="w-5 h-5 text-teal-500" />
                    Dept. Salary Breakdown
                  </h3>
                </div>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={deptChartData} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={false} />
                    <XAxis type="number" tickFormatter={fmtShort} tick={{ fontSize: 11, fill: '#94A3B8' }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#64748B' }} width={80} />
                    <Tooltip
                      formatter={(val: number) => fmtCurrency(val)}
                      contentStyle={{ fontSize: 12, border: '1px solid #E2E8F0', borderRadius: 8 }}
                    />
                    <Bar dataKey="salary" radius={[0, 4, 4, 0]} maxBarSize={24}>
                      {deptChartData.map((_, idx) => (
                        <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap gap-2 mt-3 text-xs text-slate-500">
                  {deptChartData.map((d, i) => (
                    <span key={i} className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      {d.name} ({d.headcount})
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* ─── Charts Row 2: Pie Charts ─── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Payroll Run Status Distribution */}
          <div className="thb-card p-6">
            {loading ? (
              <SkeletonChart />
            ) : (
              <>
                <h3 className="text-base font-semibold text-slate-800 flex items-center gap-2 mb-4">
                  <FiLoader className="w-5 h-5 text-cyan-500" />
                  Payroll Run Status
                </h3>
                <div className="flex items-center">
                  <ResponsiveContainer width="60%" height={220}>
                    <PieChart>
                      <Pie
                        data={runStatusData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={90}
                        paddingAngle={3}
                        dataKey="value"
                        nameKey="name"
                      >
                        {runStatusData.map((_, idx) => (
                          <Cell key={idx} fill={PIE_COLORS[idx]} stroke="none" />
                        ))}
                      </Pie>
                      <Tooltip content={<PieTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-3">
                    {runStatusData.map((d, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <span className="w-3 h-3 rounded-full" style={{ background: PIE_COLORS[i] }} />
                        <span className="text-slate-600">{d.name}</span>
                        <span className="ml-auto font-semibold text-slate-800">{d.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Cost Distribution */}
          <div className="thb-card p-6">
            {loading ? (
              <SkeletonChart />
            ) : (
              <>
                <h3 className="text-base font-semibold text-slate-800 flex items-center gap-2 mb-4">
                  <FiDollarSign className="w-5 h-5 text-amber-500" />
                  Cost Distribution
                </h3>
                <div className="flex items-center">
                  <ResponsiveContainer width="60%" height={220}>
                    <PieChart>
                      <Pie
                        data={costDistributionData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={90}
                        paddingAngle={3}
                        dataKey="value"
                        nameKey="name"
                      >
                        {costDistributionData.map((_, idx) => (
                          <Cell key={idx} fill={PIE_COLORS[idx]} stroke="none" />
                        ))}
                      </Pie>
                      <Tooltip content={<PieTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-3">
                    {costDistributionData.map((d, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <span className="w-3 h-3 rounded-full" style={{ background: PIE_COLORS[i] }} />
                        <span className="text-slate-600">{d.name}</span>
                        <span className="ml-auto font-semibold text-slate-800">{fmtCurrency(d.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ─── Recent Payroll Runs Table ─── */}
        <div className="thb-card p-6">
          {loading ? (
            <SkeletonTable />
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-slate-800 flex items-center gap-2">
                  <FiFileText className="w-5 h-5 text-emerald-500" />
                  Recent Payroll Runs
                </h3>
                <a
                  href="/payroll/processing"
                  className="text-sm text-emerald-600 hover:text-emerald-800 flex items-center gap-1 transition-colors"
                >
                  View all <FiArrowRight className="w-3.5 h-3.5" />
                </a>
              </div>
              <div className="overflow-x-auto -mx-6 px-6">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider border-b border-slate-100">
                      <th className="pb-3 pr-4">Period</th>
                      <th className="pb-3 pr-4">Status</th>
                      <th className="pb-3 pr-4">Type</th>
                      <th className="pb-3 pr-4 text-right">Employees</th>
                      <th className="pb-3 pr-4 text-right">Gross Pay</th>
                      <th className="pb-3 pr-4 text-right">Net Pay</th>
                      <th className="pb-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.recentRuns || []).map((run, idx) => (
                      <tr
                        key={run.id || idx}
                        className="border-b border-slate-50 hover:bg-slate-25 transition-colors"
                      >
                        <td className="py-3 pr-4 font-medium text-slate-700">{run.payrollPeriod}</td>
                        <td className="py-3 pr-4">{statusBadge(run.runStatus)}</td>
                        <td className="py-3 pr-4 text-slate-500">{run.runType || 'Regular'}</td>
                        <td className="py-3 pr-4 text-right text-slate-600">{run.totalEmployees}</td>
                        <td className="py-3 pr-4 text-right text-slate-700 font-medium">{fmtCurrency(run.totalGrossPay)}</td>
                        <td className="py-3 pr-4 text-right text-slate-700 font-medium">{fmtCurrency(run.totalNetPay)}</td>
                        <td className="py-3 text-right">
                          <a
                            href={`/payroll/processing`}
                            className="inline-flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-800 transition-colors"
                          >
                            View <FiExternalLink className="w-3 h-3" />
                          </a>
                        </td>
                      </tr>
                    ))}
                    {(data?.recentRuns || []).length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-400">
                          No payroll runs found. Run your first payroll to see data here.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* ─── Bottom Row: Pending Items + Quick Actions ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 pb-8">
          {/* Pending Items Panel */}
          <div className="lg:col-span-2 space-y-4">
            <h3 className="text-base font-semibold text-slate-800 flex items-center gap-2">
              <FiAlertTriangle className="w-5 h-5 text-amber-500" />
              Pending Items
            </h3>

            {/* Pending approvals card */}
            <div className="thb-card thb-card-hover p-4 flex items-center gap-4 cursor-pointer" onClick={() => window.location.href = '/payroll/approvals'}>
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-orange-50">
                <FiClock className="w-5 h-5 text-orange-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-slate-600">Pending Approvals</p>
                <p className="text-lg font-bold text-orange-600">{pendingApprovals}</p>
              </div>
              <FiArrowRight className="w-4 h-4 text-slate-300" />
            </div>

            {/* Active holds card */}
            <div className="thb-card thb-card-hover p-4 flex items-center gap-4 cursor-pointer" onClick={() => window.location.href = '/payroll/holds'}>
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-teal-50">
                <FiPauseCircle className="w-5 h-5 text-teal-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-slate-600">Active Holds</p>
                <p className="text-lg font-bold text-teal-600">{activeHolds}</p>
              </div>
              <FiArrowRight className="w-4 h-4 text-slate-300" />
            </div>

            {/* Upcoming filing deadlines */}
            <div className="thb-card p-4">
              <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-1.5">
                <FiCalendar className="w-4 h-4 text-slate-400" />
                Upcoming Filing Deadlines
              </h4>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {filingDeadlines.map((f, i) => (
                  <div key={i} className="flex items-center justify-between text-xs py-1.5 px-2 rounded-md bg-slate-25">
                    <span className="text-slate-700 font-medium">{f.title}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400">{f.due}</span>
                      <span
                        className={`w-2 h-2 rounded-full ${
                          f.status === 'GREEN'
                            ? 'bg-emerald-500'
                            : f.status === 'AMBER'
                            ? 'bg-amber-500'
                            : 'bg-red-500'
                        }`}
                        title={f.status === 'GREEN' ? 'On track' : f.status === 'AMBER' ? 'Due soon' : 'Overdue'}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="lg:col-span-3">
            <h3 className="text-base font-semibold text-slate-800 flex items-center gap-2 mb-4">
              <FiZap className="w-5 h-5 text-emerald-500" />
              Quick Actions
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {quickActions.map((action, idx) => (
                <a
                  key={idx}
                  href={action.route}
                  className="thb-card thb-card-hover p-5 flex flex-col items-center text-center gap-3 group"
                >
                  <div className={`w-12 h-12 rounded-xl ${action.bg} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                    <action.icon className={`w-6 h-6 ${action.color}`} />
                  </div>
                  <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900 transition-colors">
                    {action.label}
                  </span>
                </a>
              ))}
            </div>

            {/* Summary footer inside quick actions area */}
            <div className="thb-card mt-4 p-4 bg-gradient-to-r from-emerald-50 to-cyan-50 border-emerald-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500">3Boxes HRMS Payroll Module</p>
                  <p className="text-sm font-semibold text-slate-700 mt-0.5">
                    Current period: <span className="text-emerald-600">{data?.currentPeriod || '—'}</span>
                  </p>
                </div>
                <div className="flex items-center gap-1 text-xs text-slate-400">
                  <FiCheckCircle className="w-4 h-4 text-emerald-500" />
                  System operational
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
