'use client';

import { useEffect, useState, useCallback, useMemo, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import {
  FiCalendar, FiClock, FiFileText, FiHeadphones,
  FiDollarSign, FiCheckCircle, FiAlertCircle, FiChevronRight,
  FiActivity, FiTarget, FiClock as FiTimeEntry,
  FiArrowRight, FiEdit3,
  FiBarChart2, FiBell, FiUsers, FiGrid, FiSettings,
} from 'react-icons/fi';
import ModuleDashboardShell, { DashboardTabConfig } from '@/components/ModuleDashboardShell';
import {
  BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer,
  Tooltip, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { useAuthStore } from '@/store/authStore';
import { getClientSiteMode } from '@/lib/site-mode';

/* ─────────────────── helpers ─────────────────── */

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

const COLORS: Record<string, string> = {
  indigo: '#6366F1',
  emerald: '#10B981',
  amber: '#F59E0B',
  pink: '#EC4899',
  cyan: '#06B6D4',
  violet: '#8B5CF6',
};
const CHART_COLORS = ['#6366F1', '#10B981', '#F59E0B', '#EC4899', '#06B6D4', '#8B5CF6'];

function formatDate(d: Date) {
  return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
}

function statusBadge(status: string) {
  const s = (status || '').toLowerCase();
  const map: Record<string, string> = {
    paid: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    processed: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    pending: 'bg-amber-50 text-amber-700 ring-amber-200',
    draft: 'bg-slate-100 text-slate-700 ring-slate-200',
    approved: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  };
  const cls = map[s] || 'bg-slate-100 text-slate-700 ring-slate-200';
  const label = s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold ring-1 ${cls}`}>
      {label}
    </span>
  );
}

/* ─────────────────── skeleton ─────────────────── */

function SkeletonBlock({ className = '' }: { className?: string }) {
  return <div className={`bg-slate-200/70 animate-pulse rounded-lg ${className}`} />;
}

function StatSkeleton() {
  return (
    <div className="thb-card bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="space-y-2 flex-1">
          <SkeletonBlock className="h-3 w-24" />
          <SkeletonBlock className="h-7 w-16" />
        </div>
        <SkeletonBlock className="h-10 w-10 rounded-xl" />
      </div>
      <SkeletonBlock className="h-3 w-32 mt-3" />
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className="thb-card bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
      <SkeletonBlock className="h-4 w-40 mb-4" />
      <SkeletonBlock className="h-52 w-full" />
    </div>
  );
}

function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="thb-card bg-white rounded-2xl p-6 border border-slate-100 shadow-sm space-y-3">
      <SkeletonBlock className="h-4 w-32 mb-2" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <SkeletonBlock className="h-9 w-9 rounded-lg" />
          <div className="flex-1 space-y-1">
            <SkeletonBlock className="h-3 w-3/4" />
            <SkeletonBlock className="h-2 w-1/2" />
          </div>
          <SkeletonBlock className="h-5 w-16 rounded-md" />
        </div>
      ))}
    </div>
  );
}

/* ─────────────────── types ─────────────────── */

interface StatCard {
  label: string;
  value: string;
  sub: string;
  icon: React.ReactNode;
  color: string;
  trend?: string;
}

interface ScheduleItem {
  id: string;
  title: string;
  time: string;
  type: 'meeting' | 'event' | 'deadline';
  duration?: string;
}

interface PayslipRow {
  id: string;
  month: string;
  netPay: number;
  status: string;
  currency: string;
}

interface Announcement {
  id: string;
  title: string;
  body: string;
  date: string;
  priority: 'high' | 'medium' | 'low';
}

interface QuickLink {
  label: string;
  icon: React.ReactNode;
  color: string;
  bg: string;
  href: string;
}

/* ─────────────────── demo data ─────────────────── */

const DEMO_STATS: StatCard[] = [
  {
    label: 'Attendance Rate',
    value: '96.5%',
    sub: 'This month • 2 days absent',
    icon: <FiCheckCircle className="w-5 h-5" />,
    color: COLORS.emerald,
    trend: '+1.2%',
  },
  {
    label: 'Leave Balance',
    value: '12.5',
    sub: 'Days remaining this year',
    icon: <FiCalendar className="w-5 h-5" />,
    color: COLORS.indigo,
    trend: '-3 used',
  },
  {
    label: 'Pending Tasks',
    value: '7',
    sub: '3 high priority • 4 normal',
    icon: <FiTarget className="w-5 h-5" />,
    color: COLORS.amber,
  },
  {
    label: 'Upcoming Events',
    value: '4',
    sub: 'Next 7 days',
    icon: <FiActivity className="w-5 h-5" />,
    color: COLORS.pink,
  },
];

const DEMO_ATTENDANCE_TREND = [
  { month: 'Jul', present: 22, absent: 1, late: 1 },
  { month: 'Aug', present: 21, absent: 2, late: 0 },
  { month: 'Sep', present: 20, absent: 0, late: 2 },
  { month: 'Oct', present: 23, absent: 1, late: 0 },
  { month: 'Nov', present: 21, absent: 1, late: 1 },
  { month: 'Dec', present: 19, absent: 2, late: 1 },
];

const DEMO_LEAVE_USAGE = [
  { name: 'Casual Leave', value: 4, color: CHART_COLORS[0] },
  { name: 'Sick Leave', value: 2, color: CHART_COLORS[1] },
  { name: 'Earned Leave', value: 3, color: CHART_COLORS[2] },
  { name: 'Comp Off', value: 1, color: CHART_COLORS[3] },
  { name: 'Remaining', value: 12.5, color: CHART_COLORS[4] },
];

const DEMO_SCHEDULE: ScheduleItem[] = [
  { id: '1', title: 'Daily Stand-up', time: '09:30 AM', type: 'meeting', duration: '15 min' },
  { id: '2', title: 'Sprint Review', time: '11:00 AM', type: 'meeting', duration: '1 hr' },
  { id: '3', title: 'Lunch & Learn — AI in HR', time: '01:00 PM', type: 'event', duration: '45 min' },
  { id: '4', title: 'Q3 Report Deadline', time: '05:00 PM', type: 'deadline' },
  { id: '5', title: '1-on-1 with Manager', time: '04:00 PM', type: 'meeting', duration: '30 min' },
];

const DEMO_PAYSLIPS: PayslipRow[] = [
  { id: '1', month: 'January 2026', netPay: 58420, status: 'paid', currency: '₹' },
  { id: '2', month: 'December 2025', netPay: 58420, status: 'paid', currency: '₹' },
  { id: '3', month: 'November 2025', netPay: 57900, status: 'paid', currency: '₹' },
  { id: '4', month: 'October 2025', netPay: 57900, status: 'paid', currency: '₹' },
  { id: '5', month: 'September 2025', netPay: 56250, status: 'paid', currency: '₹' },
];

const DEMO_ANNOUNCEMENTS: Announcement[] = [
  {
    id: '1',
    title: 'Office Closed — Republic Day',
    body: 'The office will remain closed on 26th January in observance of Republic Day. Enjoy the long weekend!',
    date: '2026-01-20',
    priority: 'high',
  },
  {
    id: '2',
    title: 'New Health Insurance Provider',
    body: 'We are transitioning to a new health insurance provider effective February 1st. Details will be shared via email.',
    date: '2026-01-18',
    priority: 'medium',
  },
  {
    id: '3',
    title: 'Q3 Performance Reviews Open',
    body: 'Self-assessment forms for Q3 are now available. Please complete yours by January 31st.',
    date: '2026-01-15',
    priority: 'low',
  },
];

/* ─────────────────── placeholder tabs ─────────────────── */

const employeeTabs: DashboardTabConfig[] = [
  { label: 'Overview', key: 'overview', icon: <FiGrid className="w-4 h-4" /> },
  { label: 'Reports', key: 'reports', icon: <FiFileText className="w-4 h-4" />, isNew: true },
  { label: 'Settings', key: 'settings', icon: <FiSettings className="w-4 h-4" />, isNew: true },
];

function EmployeeReportsPlaceholder() {
  return (
    <div className="flex flex-col items-center py-8">
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg mb-4">
        <FiFileText className="w-7 h-7 text-white" />
      </div>
      <h3 className="text-lg font-bold text-thb-text-primary mb-1">Reports & Analytics</h3>
      <p className="text-sm text-thb-text-secondary text-center max-w-md mb-4">
        Reports and analytics for employee data
      </p>
      <a href="/employees/dashboard" className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors">
        <FiBarChart2 className="w-4 h-4" /> Go to Reports
      </a>
    </div>
  );
}

function EmployeeSettingsPlaceholder() {
  return (
    <div className="flex flex-col items-center py-8">
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-slate-500 to-slate-700 flex items-center justify-center shadow-lg mb-4">
        <FiSettings className="w-7 h-7 text-white" />
      </div>
      <h3 className="text-lg font-bold text-thb-text-primary mb-1">Settings & Configuration</h3>
      <p className="text-sm text-thb-text-secondary text-center max-w-md mb-4">
        Configure employee module settings and preferences
      </p>
      <a href="/settings" className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors">
        <FiSettings className="w-4 h-4" /> Go to Settings
      </a>
    </div>
  );
}

function EmployeePageContent() {
  return (
    <ModuleDashboardShell
      moduleKey="employee"
      moduleLabel="Employee"
      moduleIcon={<FiUsers className="w-5 h-5 text-white" />}
      gradientColor="from-green-500 to-emerald-600"
      tabs={employeeTabs}
      overviewContent={<EmployeeContent />}
      children={{
        reports: <EmployeeReportsPlaceholder />,
        settings: <EmployeeSettingsPlaceholder />,
      }}
    />
  );
}

export default function EmployeeDashboardPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-20"><div className="animate-spin w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full" /></div>}>
      <EmployeePageContent />
    </Suspense>
  );
}

/* ─────────────────── component ─────────────────── */

function EmployeeContent() {
  const router = useRouter();
  const { user } = useAuthStore();

  const [loading, setLoading] = useState(true);
  // GOLDEN RULE: On LIVE site, initialize with zeros (not demo data).
  const isLiveSite = getClientSiteMode() === 'live';
  const [stats, setStats] = useState<StatCard[]>(isLiveSite ? DEMO_STATS.map(s => ({ ...s, value: 0 })) : DEMO_STATS);
  const [attendanceTrend] = useState(isLiveSite ? [] : DEMO_ATTENDANCE_TREND);
  const [leaveUsage, setLeaveUsage] = useState(isLiveSite ? [] : DEMO_LEAVE_USAGE);
  const [schedule] = useState<ScheduleItem[]>(isLiveSite ? [] : DEMO_SCHEDULE);
  const [payslips, setPayslips] = useState<PayslipRow[]>(isLiveSite ? [] : DEMO_PAYSLIPS);
  const [announcements, setAnnouncements] = useState<Announcement[]>(isLiveSite ? [] : DEMO_ANNOUNCEMENTS);

  const today = useMemo(() => formatDate(new Date()), []);
  const greeting = useMemo(() => getGreeting(), []);
  const employeeName = user?.name || user?.firstName ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : 'Employee';

  /* ── fetch dashboard data ── */

  const fetchDashboard = useCallback(async () => {
    try {
      const headers = getAuthHeaders();

      // Fetch attendance stats
      const attRes = await fetch('/api/attendance?limit=30', { headers });
      if (attRes.ok) {
        const attData = await attRes.json();
        if (attData?.data?.length) {
          const rows = attData.data;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const present = rows.filter((r: any) => r.status === 'present').length;
          const total = rows.length || 1;
          const rate = ((present / total) * 100).toFixed(1);
          setStats(prev => prev.map(s => s.label === 'Attendance Rate' ? { ...s, value: `${rate}%`, sub: `This month • ${total - present} days absent` } : s));
        }
      }

      // Fetch leave balance
      const leaveRes = await fetch('/api/leave/balance', { headers });
      if (leaveRes.ok) {
        const leaveData = await leaveRes.json();
        if (leaveData?.data?.length) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const totalRem = leaveData.data.reduce((acc: number, lb: any) => acc + (lb.remaining || 0), 0);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const usedArr = leaveData.data.map((lb: any) => ({
            name: lb.leaveType?.name || 'Leave',
            value: lb.used || 0,
            color: CHART_COLORS[leaveData.data.indexOf(lb) % CHART_COLORS.length],
          }));
          usedArr.push({ name: 'Remaining', value: totalRem, color: CHART_COLORS[4] });
          setStats(prev => prev.map(s => s.label === 'Leave Balance' ? { ...s, value: `${totalRem}`, sub: 'Days remaining this year' } : s));
          setLeaveUsage(usedArr);
        }
      }

      // Fetch payslips
      const payRes = await fetch('/api/payroll/payslips?limit=5', { headers });
      if (payRes.ok) {
        const payData = await payRes.json();
        if (payData?.data?.length) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const mapped = payData.data.map((p: any) => ({
            id: p.id,
            month: p.month && p.year ? new Date(p.year, p.month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'N/A',
            netPay: p.netSalary || 0,
            status: p.status || 'draft',
            currency: '₹',
          }));
          setPayslips(mapped);
        }
      }

      // Fetch announcements
      const annRes = await fetch('/api/notifications?limit=3&type=announcement', { headers });
      if (annRes.ok) {
        const annData = await annRes.json();
        if (annData?.data?.length) {
          setAnnouncements(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            annData.data.map((a: any) => ({
              id: a.id,
              title: a.title || 'Announcement',
              body: a.message || a.body || '',
              date: a.createdAt ? a.createdAt.split('T')[0] : '',
              priority: a.priority || 'medium',
            }))
          );
        }
      }
    } catch {
      // Silently fall back to demo data
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchDashboard();
    }, 300);
    return () => clearTimeout(timer);
  }, [fetchDashboard]);

  /* ── quick links config ── */

  const quickLinks: QuickLink[] = useMemo(() => [
    { label: 'Apply Leave', icon: <FiCalendar className="w-5 h-5" />, color: COLORS.indigo, bg: 'bg-emerald-50', href: '/leave' },
    { label: 'Submit Expense', icon: <FiDollarSign className="w-5 h-5" />, color: COLORS.emerald, bg: 'bg-emerald-50', href: '/expenses' },
    { label: 'View Payslip', icon: <FiFileText className="w-5 h-5" />, color: COLORS.amber, bg: 'bg-amber-50', href: '/payroll/payslips' },
    { label: 'Update Profile', icon: <FiEdit3 className="w-5 h-5" />, color: COLORS.pink, bg: 'bg-pink-50', href: '/my-profile' },
    { label: 'Time Entry', icon: <FiTimeEntry className="w-5 h-5" />, color: COLORS.cyan, bg: 'bg-cyan-50', href: '/timesheets' },
    { label: 'Helpdesk', icon: <FiHeadphones className="w-5 h-5" />, color: COLORS.violet, bg: 'bg-teal-50', href: '/helpdesk' },
  ], []);

  /* ── schedule icon helper ── */

  function scheduleIcon(type: string) {
    switch (type) {
      case 'meeting': return <FiUsers className="w-4 h-4" />;
      case 'event': return <FiBell className="w-4 h-4" />;
      case 'deadline': return <FiAlertCircle className="w-4 h-4" />;
      default: return <FiClock className="w-4 h-4" />;
    }
  }

  function scheduleColor(type: string) {
    switch (type) {
      case 'meeting': return 'bg-emerald-100 text-emerald-600';
      case 'event': return 'bg-pink-100 text-pink-600';
      case 'deadline': return 'bg-amber-100 text-amber-600';
      default: return 'bg-slate-100 text-slate-600';
    }
  }

  function priorityDot(p: string) {
    switch (p) {
      case 'high': return 'bg-rose-500';
      case 'medium': return 'bg-amber-500';
      default: return 'bg-slate-400';
    }
  }

  /* ── render ── */

  return (
    <div className="min-h-screen bg-slate-50/60">
      {/* ── Hero ── */}
      <div className="relative overflow-hidden rounded-b-3xl" style={{ background: `linear-gradient(135deg, ${COLORS.indigo} 0%, ${COLORS.violet} 100%)` }}>
        <div className="absolute inset-0 opacity-10">
          <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-white/20" />
          <div className="absolute -bottom-32 -left-20 w-72 h-72 rounded-full bg-white/10" />
        </div>
        <div className="relative px-6 py-8 sm:px-8 sm:py-10">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-white/70 text-xs font-medium tracking-wide uppercase">3Boxes HRMS</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                Employee Dashboard
              </h1>
              <p className="text-white/80 mt-1 text-sm sm:text-base">
                {greeting}, <span className="font-semibold text-white">{employeeName}</span>
              </p>
            </div>
            <div className="flex items-center gap-3 text-white/90 text-sm">
              <FiCalendar className="w-4 h-4" />
              <span>{today}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-6 lg:px-8 -mt-2 space-y-6 pb-10">
        {/* ── Stat Cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => <StatSkeleton key={i} />)
            : stats.map((s, i) => (
                <div
                  key={i}
                  className="thb-card thb-card-hover bg-white rounded-2xl p-5 border border-slate-100 shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 cursor-default"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-500 truncate">{s.label}</p>
                      <p className="text-2xl font-bold text-slate-900 mt-1">{s.value}</p>
                    </div>
                    <div
                      className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: `${s.color}15`, color: s.color }}
                    >
                      {s.icon}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-3">
                    {s.trend && (
                      <span
                        className={`text-[11px] font-semibold ${s.trend.startsWith('+') ? 'text-emerald-600' : 'text-slate-500'}`}
                      >
                        {s.trend}
                      </span>
                    )}
                    <span className="text-[11px] text-slate-400 truncate">{s.sub}</span>
                  </div>
                </div>
              ))}
        </div>

        {/* ── Charts Row ── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* Attendance Trend - Bar Chart */}
          <div className="lg:col-span-3 thb-card bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
            {loading ? (
              <ChartSkeleton />
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-slate-800">Monthly Attendance Trend</h3>
                  <span className="text-[11px] text-slate-400">Last 6 months</span>
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={attendanceTrend} barGap={4} barCategoryGap="20%">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        background: '#fff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '12px',
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)',
                        fontSize: '12px',
                      }}
                    />
                    <Bar dataKey="present" fill={COLORS.indigo} radius={[4, 4, 0, 0]} name="Present" />
                    <Bar dataKey="late" fill={COLORS.amber} radius={[4, 4, 0, 0]} name="Late" />
                    <Bar dataKey="absent" fill={COLORS.pink} radius={[4, 4, 0, 0]} name="Absent" />
                  </BarChart>
                </ResponsiveContainer>
              </>
            )}
          </div>

          {/* Leave Usage - Pie Chart */}
          <div className="lg:col-span-2 thb-card bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
            {loading ? (
              <ChartSkeleton />
            ) : (
              <>
                <h3 className="text-sm font-semibold text-slate-800 mb-4">Leave Usage</h3>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={leaveUsage}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                      stroke="none"
                    >
                      {leaveUsage.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: '#fff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '12px',
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)',
                        fontSize: '12px',
                      }}
                      formatter={(value: number, name: string) => [`${value} days`, name]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5">
                  {leaveUsage.map((item, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                      <span className="text-[11px] text-slate-600 truncate">{item.name}</span>
                      <span className="text-[11px] font-semibold text-slate-800 ml-auto">{item.value}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── Schedule + Payslips Row ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* My Schedule */}
          <div className="thb-card bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
            {loading ? (
              <ListSkeleton rows={5} />
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-slate-800">My Schedule — Today</h3>
                  <span className="text-[11px] text-slate-400">{schedule.length} items</span>
                </div>
                <div className="space-y-3 max-h-80 overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin', scrollbarColor: '#cbd5e1 transparent' }}>
                  {schedule.map(item => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 p-3 rounded-xl bg-slate-50/80 hover:bg-slate-100/80 transition-colors group cursor-pointer"
                    >
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${scheduleColor(item.type)}`}>
                        {scheduleIcon(item.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{item.title}</p>
                        <p className="text-[11px] text-slate-500">
                          {item.time}
                          {item.duration && <span className="ml-1">• {item.duration}</span>}
                        </p>
                      </div>
                      <FiChevronRight className="w-4 h-4 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Recent Payslips */}
          <div className="thb-card bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
            {loading ? (
              <ListSkeleton rows={5} />
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-slate-800">Recent Payslips</h3>
                  <button
                    onClick={() => router.push('/payroll/payslips')}
                    className="text-[11px] font-medium text-emerald-600 hover:text-emerald-700 flex items-center gap-1 transition-colors"
                  >
                    View All <FiArrowRight className="w-3 h-3" />
                  </button>
                </div>
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin', scrollbarColor: '#cbd5e1 transparent' }}>
                  {payslips.map(p => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-slate-50/80 hover:bg-slate-100/80 transition-colors group cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
                          <FiFileText className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-800">{p.month}</p>
                          <p className="text-[11px] text-slate-500">Net Pay</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-slate-800">
                          {p.currency}{p.netPay.toLocaleString('en-IN')}
                        </span>
                        {statusBadge(p.status)}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── Quick Links ── */}
        <div className="thb-card bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-800 mb-4">Quick Links</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {quickLinks.map((link, i) => (
              <button
                key={i}
                onClick={() => router.push(link.href)}
                className="thb-card-hover flex flex-col items-center gap-2 p-4 rounded-xl border border-slate-100 bg-white hover:bg-slate-50 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 group"
              >
                <div
                  className={`w-11 h-11 rounded-xl ${link.bg} flex items-center justify-center transition-transform group-hover:scale-110`}
                  style={{ color: link.color }}
                >
                  {link.icon}
                </div>
                <span className="text-xs font-medium text-slate-700 text-center">{link.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Announcements ── */}
        <div className="thb-card bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <FiBell className="w-4 h-4 text-emerald-500" />
              <h3 className="text-sm font-semibold text-slate-800">Announcements</h3>
            </div>
            <span className="text-[11px] text-slate-400">{announcements.length} new</span>
          </div>
          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="p-4 rounded-xl bg-slate-50/80 space-y-2">
                  <SkeletonBlock className="h-4 w-3/4" />
                  <SkeletonBlock className="h-3 w-full" />
                  <SkeletonBlock className="h-3 w-1/2" />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3 max-h-72 overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin', scrollbarColor: '#cbd5e1 transparent' }}>
              {announcements.map(a => (
                <div
                  key={a.id}
                  className="p-4 rounded-xl bg-slate-50/80 hover:bg-slate-100/80 transition-colors group cursor-pointer"
                >
                  <div className="flex items-start gap-3">
                    <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${priorityDot(a.priority)}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-sm font-semibold text-slate-800 truncate">{a.title}</h4>
                        <span className="text-[10px] text-slate-400 flex-shrink-0">
                          {a.date ? new Date(a.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
                        </span>
                      </div>
                      <p className="text-[12px] text-slate-500 mt-1 line-clamp-2 leading-relaxed">{a.body}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Footer branding ── */}
        <div className="text-center pt-2 pb-4">
          <p className="text-[11px] text-slate-400">
            Powered by <span className="font-semibold text-emerald-500">3Boxes HRMS</span> — Your all-in-one HR companion
          </p>
        </div>
      </div>
    </div>
  );
}
