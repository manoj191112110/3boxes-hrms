'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  FiCalendar, FiClock, FiFileText, FiHeadphones, FiUser,
  FiDollarSign, FiBookOpen, FiTrendingUp, FiCheckCircle,
  FiAlertCircle, FiChevronRight, FiPlus, FiDownload,
  FiActivity, FiTarget, FiAward, FiBriefcase, FiFolder,
  FiSend, FiMessageCircle, FiShield, FiZap, FiHeart,
  FiArrowRight, FiInfo,
} from 'react-icons/fi';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  RadialBarChart, RadialBar,
} from 'recharts';
import { useAuthStore } from '@/store/authStore';
import { useCompanyContextStore } from '@/store/companyContextStore';

/* ---------- helpers ---------- */

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

const LEAVE_COLORS = ['#6366F1', '#10B981', '#F59E0B', '#EC4899', '#06B6D4', '#8B5CF6'];

/* ---------- types ---------- */

interface LeaveBalanceItem {
  id: string;
  leaveTypeId: string;
  leaveType: { id: string; name: string; code: string };
  year: number;
  total: number;
  used: number;
  remaining: number;
  carryForward: number;
}

interface AttendanceRow {
  id?: string;
  date: string;
  status: string;
  checkIn?: string | null;
  checkOut?: string | null;
  workHours?: number | null;
}

interface PayslipRow {
  id: string;
  month: number;
  year: number;
  netSalary: number;
  status: string;
  currency?: string;
  paidDate?: string | null;
}

interface PerformanceRow {
  id: string;
  reviewCycle: string;
  rating: number;
  overallRating?: number;
  status: string;
  reviewDate?: string | null;
  reviewer?: { firstName: string; lastName: string } | null;
}

interface GoalRow {
  id: string;
  title: string;
  progress: number;
  status: string;
  priority: string;
  endDate?: string | null;
}

interface TrainingRow {
  id: string;
  title: string;
  status: string;
  startDate?: string | null;
  endDate?: string | null;
}

interface TrainingEnrollmentRow {
  id: string;
  status: string;
  score?: number | null;
  training: { id: string; title: string; startDate?: string | null; endDate?: string | null };
}

interface TimesheetRow {
  id: string;
  date: string;
  project?: string | { id: string; name: string; code?: string; currency?: string; billingType?: string } | null;
  task?: string | null;
  hours: number;
  status: string;
}

interface TicketRow {
  id: string;
  ticketId: string;
  subject: string;
  status: string;
  priority: string;
  createdAt: string;
}

interface DocumentRow {
  id: string;
  name: string;
  type: string;
  status: string;
  uploadedAt: string;
}

/* ---------- skeleton ---------- */

function SkeletonBlock({ className = '' }: { className?: string }) {
  return <div className={`bg-slate-200/70 animate-pulse rounded-lg ${className}`} />;
}

function StatSkeleton() {
  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
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

/* ---------- main component ---------- */

export default function ESSDashboardPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { effectiveCompanyLabel, effectiveCompanyId, hydrated, hydrate } = useCompanyContextStore();

  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrated, hydrate]);

  const companyName = effectiveCompanyLabel();

  const firstName = user?.name?.split(' ')[0] || 'there';
  const userRole = user?.role || 'employee';
  const currentHour = new Date().getHours();
  const greeting = currentHour < 12 ? 'Good morning' : currentHour < 17 ? 'Good afternoon' : 'Good evening';
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  /* ----- state ----- */
  const [loading, setLoading] = useState(true);
  const [leaveBalances, setLeaveBalances] = useState<LeaveBalanceItem[]>([]);
  const [leaveSummary, setLeaveSummary] = useState({ total: 0, used: 0, remaining: 0 });
  const [attendanceRate, setAttendanceRate] = useState(0);
  const [attendanceRows, setAttendanceRows] = useState<AttendanceRow[]>([]);
  const [pendingLeaves, setPendingLeaves] = useState(0);
  const [payslips, setPayslips] = useState<PayslipRow[]>([]);
  const [performance, setPerformance] = useState<PerformanceRow | null>(null);
  const [goals, setGoals] = useState<GoalRow[]>([]);
  const [training, setTraining] = useState<TrainingEnrollmentRow[]>([]);
  const [timesheets, setTimesheets] = useState<TimesheetRow[]>([]);
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);

  /* ----- fetch ESS data; abort when leaving tab so Modules is not blocked ----- */
  const fetchESS = useCallback(async (signal: AbortSignal) => {
    setLoading(true);
    const headers = getAuthHeaders();
    const cid = effectiveCompanyId();
    const scopeQuery = cid ? `companyId=${cid}&` : '';

    const safe = async (url: string) => {
      try {
        const res = await fetch(url, { headers, signal });
        if (!res.ok) return null;
        return await res.json();
      } catch {
        return null;
      }
    };

    const summaryUrl = `/api/dashboard/summary${cid ? `?companyId=${encodeURIComponent(cid)}` : ''}`;
    const summary = await safe(summaryUrl);
    if (signal.aborted) return;

    const leaveData = summary?.leaveBalance ?? null;
    const attData = summary?.attendance ?? null;
    const leaveReqData = summary?.leavePending ?? null;
    const payslipData = summary?.payslips ?? null;
    const perfData = summary?.performance ?? null;
    const goalsData = summary?.goals ?? null;
    const trainData = summary?.training ?? null;
    const tsData = summary?.timesheets ?? null;
    const ticketData = summary?.tickets ?? null;
    const docData = summary?.documents ?? null;

    /* leave balance */
    if (leaveData?.balances) {
      const balances: LeaveBalanceItem[] = leaveData.balances;
      setLeaveBalances(balances);
      const sum = balances.reduce(
        (acc: { total: number; used: number; remaining: number }, b) => {
          acc.total += b.total || 0;
          acc.used += b.used || 0;
          acc.remaining += b.remaining || 0;
          return acc;
        },
        { total: 0, used: 0, remaining: 0 }
      );
      setLeaveSummary(sum);
    } else if (leaveData?.summary) {
      setLeaveSummary(leaveData.summary);
    }

    /* attendance — filter to current month for accurate rate */
    if (attData?.attendance || attData?.records) {
      const allRows: AttendanceRow[] = attData.attendance || attData.records || [];
      // Only count attendance for the current month
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      const rows = allRows.filter((a) => {
        const d = new Date(a.date);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      });
      setAttendanceRows(rows.length > 0 ? rows : allRows.slice(0, 30));
      const usedRows = rows.length > 0 ? rows : allRows.slice(0, 30);
      if (usedRows.length > 0) {
        const present = usedRows.filter((a) => ['present', 'late', 'half_day'].includes(a.status)).length;
        setAttendanceRate(Math.round((present / usedRows.length) * 100));
      }
    }

    /* pending leaves — use pagination.total for accurate count */
    if (leaveReqData?.leaveRequests || leaveReqData?.leaves) {
      const total = leaveReqData.pagination?.total || leaveReqData.total || 0;
      setPendingLeaves(total || (leaveReqData.leaveRequests || leaveReqData.leaves || []).length);
    }

    /* payslips */
    if (payslipData?.payslips || payslipData?.data) {
      setPayslips((payslipData.payslips || payslipData.data).slice(0, 5));
    }

    /* performance */
    const perfRows = perfData?.reviews || perfData?.data || [];
    if (Array.isArray(perfRows) && perfRows.length > 0) {
      setPerformance(perfRows[0]);
    }

    /* goals */
    if (goalsData?.goals || goalsData?.data) {
      setGoals((goalsData.goals || goalsData.data).slice(0, 5));
    }

    /* training enrollments - the /api/training endpoint may return a list with
       enrollments attached, or we may need to derive from the response */
    if (Array.isArray(trainData?.trainings)) {
      // For ESS we want enrollments; the API may not support that directly,
      // so we just show the list of upcoming trainings the employee can join.
      const upcoming = trainData.trainings
        .filter((t: TrainingRow) => ['upcoming', 'ongoing'].includes(t.status))
        .slice(0, 4)
        .map((t: TrainingRow) => ({
          id: t.id,
          status: t.status,
          score: null,
          training: {
            id: t.id,
            title: t.title,
            startDate: t.startDate,
            endDate: t.endDate,
          },
        }));
      setTraining(upcoming);
    }

    /* timesheets */
    if (tsData?.timesheets || tsData?.data) {
      setTimesheets((tsData.timesheets || tsData.data).slice(0, 5));
    }

    /* tickets */
    if (ticketData?.tickets || ticketData?.data) {
      setTickets((ticketData.tickets || ticketData.data).slice(0, 5));
    }

    /* documents */
    if (docData?.documents || docData?.data) {
      setDocuments((docData.documents || docData.data).slice(0, 5));
    }

    if (!signal.aborted) setLoading(false);
  }, [effectiveCompanyId]);

  useEffect(() => {
    const controller = new AbortController();
    fetchESS(controller.signal);
    return () => controller.abort();
  }, [fetchESS]);

  /* ----- derived data ----- */

  const leaveChartData = useMemo(() => {
    if (leaveBalances.length === 0) return [];
    return leaveBalances.map((b, i) => ({
      name: b.leaveType?.name || 'Leave',
      remaining: b.remaining || 0,
      used: b.used || 0,
      color: LEAVE_COLORS[i % LEAVE_COLORS.length],
    }));
  }, [leaveBalances]);

  const attendanceTrend = useMemo(() => {
    // last 7 attendance records, oldest first
    return [...attendanceRows]
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(-7)
      .map((a) => {
        const d = new Date(a.date);
        return {
          day: d.toLocaleDateString('en-US', { weekday: 'short' }),
          hours: Math.round((a.workHours || 0) * 10) / 10,
          status: a.status,
        };
      });
  }, [attendanceRows]);

  const monthName = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  /* ----- quick actions ----- */
  const quickActions = [
    { icon: <FiCalendar className="w-5 h-5" />, label: 'Apply Leave', href: '/leave', bg: 'from-amber-400 to-orange-500', shadow: 'shadow-orange-500/25' },
    { icon: <FiClock className="w-5 h-5" />, label: 'My Attendance', href: '/attendance', bg: 'from-cyan-400 to-green-500', shadow: 'shadow-green-500/25' },
    { icon: <FiFileText className="w-5 h-5" />, label: 'My Payslips', href: '/payroll', bg: 'from-emerald-400 to-green-500', shadow: 'shadow-green-500/25' },
    { icon: <FiHeadphones className="w-5 h-5" />, label: 'Raise Ticket', href: '/helpdesk', bg: 'from-teal-400 to-teal-500', shadow: 'shadow-teal-500/25' },
    { icon: <FiUser className="w-5 h-5" />, label: 'My Profile', href: '/my-profile', bg: 'from-pink-400 to-rose-500', shadow: 'shadow-rose-500/25' },
    { icon: <FiDollarSign className="w-5 h-5" />, label: 'Expenses', href: '/expenses', bg: 'from-teal-400 to-emerald-500', shadow: 'shadow-emerald-500/25' },
    { icon: <FiBookOpen className="w-5 h-5" />, label: 'Training', href: '/training', bg: 'from-emerald-400 to-green-500', shadow: 'shadow-green-500/25' },
    { icon: <FiTrendingUp className="w-5 h-5" />, label: 'Performance', href: '/performance', bg: 'from-rose-400 to-pink-500', shadow: 'shadow-pink-500/25' },
    { icon: <FiSend className="w-5 h-5" />, label: 'Timesheet', href: '/timesheets', bg: 'from-sky-400 to-emerald-500', shadow: 'shadow-emerald-500/25' },
    { icon: <FiFolder className="w-5 h-5" />, label: 'Documents', href: '/documents', bg: 'from-fuchsia-400 to-teal-500', shadow: 'shadow-teal-500/25' },
    { icon: <FiBriefcase className="w-5 h-5" />, label: 'Assets', href: '/assets', bg: 'from-yellow-400 to-amber-500', shadow: 'shadow-amber-500/25' },
    { icon: <FiHeart className="w-5 h-5" />, label: 'Grievance', href: '/grievances', bg: 'from-red-400 to-rose-500', shadow: 'shadow-rose-500/25' },
  ];

  /* ----- helpers ----- */
  const fmtMoney = (n: number, currency = 'INR') => {
    try {
      return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n || 0);
    } catch {
      return `₹${(n || 0).toLocaleString('en-IN')}`;
    }
  };
  const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
  const monthLabel = (m: number, y: number) => new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

  const statusBadge = (status: string) => {
    const s = (status || '').toLowerCase();
    const map: Record<string, string> = {
      pending: 'bg-amber-50 text-amber-700 ring-amber-200',
      draft: 'bg-slate-100 text-slate-700 ring-slate-200',
      submitted: 'bg-green-50 text-green-700 ring-green-200',
      approved: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
      paid: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
      processed: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
      resolved: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
      closed: 'bg-slate-100 text-slate-700 ring-slate-200',
      rejected: 'bg-rose-50 text-rose-700 ring-rose-200',
      open: 'bg-amber-50 text-amber-700 ring-amber-200',
      in_progress: 'bg-green-50 text-green-700 ring-green-200',
      completed: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
      ongoing: 'bg-green-50 text-green-700 ring-green-200',
      upcoming: 'bg-teal-50 text-teal-700 ring-teal-200',
      enrolled: 'bg-green-50 text-green-700 ring-green-200',
    };
    const cls = map[s] || 'bg-slate-100 text-slate-700 ring-slate-200';
    const label = s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    return <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold ring-1 ${cls}`}>{label}</span>;
  };

  /* ----- render ----- */

  return (
    <div className="space-y-6">
      {/* HERO */}
      <div className="relative rounded-2xl overflow-hidden border-0 shadow-xl shadow-emerald-500/10">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0F172A] via-[#1E3A5F] to-[#312E81]" />
        <div className="absolute top-0 right-0 w-72 h-72 bg-green-500/20 rounded-full blur-[100px]" />
        <div className="absolute bottom-0 left-0 w-56 h-56 bg-teal-500/20 rounded-full blur-[80px]" />
        <div className="relative z-10 px-6 sm:px-8 py-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0 w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 via-teal-500 to-pink-500 flex items-center justify-center shadow-lg ring-2 ring-white/20 text-white text-xl font-bold">
                {firstName[0]?.toUpperCase()}
              </div>
              <div>
                <p className="text-green-300/60 text-xs font-medium tracking-widest uppercase">Employee Self-Service · {companyName}</p>
                <h1 className="text-2xl font-bold text-white">
                  {greeting}, <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-300 to-teal-300">{firstName}</span>!
                </h1>
                <p className="text-green-100/60 text-sm font-medium mt-0.5">{today}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => router.push('/leave')}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 text-white text-sm font-semibold hover:bg-white/20 transition-all"
              >
                <FiPlus className="w-4 h-4" /> Apply Leave
              </button>
              <button
                onClick={() => router.push('/helpdesk')}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-sm font-semibold shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 transition-all"
              >
                <FiHeadphones className="w-4 h-4" /> Raise Ticket
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* STAT CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <StatSkeleton key={i} />)
        ) : (
          [
            { label: 'Leave Balance', value: `${leaveSummary.remaining}`, sub: `${leaveSummary.used} of ${leaveSummary.total} days used`, icon: <FiCalendar className="w-5 h-5" />, bg: 'bg-amber-50 text-amber-600', ring: 'ring-amber-100' },
            { label: 'Attendance Rate', value: `${attendanceRate}%`, sub: `${monthName}`, icon: <FiActivity className="w-5 h-5" />, bg: 'bg-emerald-50 text-emerald-600', ring: 'ring-emerald-100' },
            { label: 'Pending Approvals', value: pendingLeaves, sub: 'Awaiting manager response', icon: <FiClock className="w-5 h-5" />, bg: 'bg-green-50 text-green-600', ring: 'ring-green-100' },
            { label: 'Open Tickets', value: tickets.filter((t) => ['open', 'in_progress'].includes(t.status)).length, sub: 'Helpdesk requests', icon: <FiHeadphones className="w-5 h-5" />, bg: 'bg-teal-50 text-teal-600', ring: 'ring-teal-100' },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500">{s.label}</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">{s.value}</p>
                </div>
                <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center ring-1 ${s.ring}`}>{s.icon}</div>
              </div>
              <p className="text-xs font-medium text-slate-500 mt-2">{s.sub}</p>
            </div>
          ))
        )}
      </div>

      {/* LEAVE + ATTENDANCE */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Leave balance */}
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <FiCalendar className="w-4 h-4 text-emerald-500" /> My Leave Balance
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">{new Date().getFullYear()} entitlements</p>
            </div>
            <button onClick={() => router.push('/leave')} className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 inline-flex items-center">
              View all <FiChevronRight className="w-3 h-3" />
            </button>
          </div>

          {loading ? (
            <div className="h-56"><SkeletonBlock className="h-full w-full" /></div>
          ) : leaveChartData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-slate-400">
              <FiInfo className="w-8 h-8 mb-2" />
              <p className="text-sm">No leave balances configured</p>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="w-44 h-44 flex-shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={leaveChartData}
                      dataKey="remaining"
                      nameKey="name"
                      innerRadius={48}
                      outerRadius={70}
                      paddingAngle={2}
                    >
                      {leaveChartData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v: number, _n, p) => {
                        const item = p?.payload;
                        return [`${v} day(s) remaining · ${item?.used || 0} used`, item?.name];
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 w-full space-y-2">
                {leaveBalances.slice(0, 5).map((b, i) => (
                  <div key={b.id} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: LEAVE_COLORS[i % LEAVE_COLORS.length] }} />
                      <span className="font-medium text-slate-700 truncate">{b.leaveType?.name || 'Leave'}</span>
                    </div>
                    <span className="text-slate-500 font-medium whitespace-nowrap">
                      <span className="text-slate-900 font-bold">{b.remaining}</span>
                      <span className="text-slate-400"> / {b.total}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Attendance trend */}
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <FiActivity className="w-4 h-4 text-emerald-500" /> My Attendance
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">Last 7 records · {monthName}</p>
            </div>
            <button onClick={() => router.push('/attendance')} className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 inline-flex items-center">
              View all <FiChevronRight className="w-3 h-3" />
            </button>
          </div>

          {loading ? (
            <div className="h-56"><SkeletonBlock className="h-full w-full" /></div>
          ) : attendanceTrend.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-slate-400">
              <FiInfo className="w-8 h-8 mb-2" />
              <p className="text-sm">No attendance records yet</p>
            </div>
          ) : (
            <>
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={attendanceTrend} margin={{ top: 5, right: 5, bottom: 0, left: -25 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                    <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} domain={[0, 'auto']} />
                    <Tooltip
                      formatter={(v: number) => [`${v} hrs`, 'Worked']}
                      contentStyle={{ borderRadius: 12, border: '1px solid #E2E8F0', fontSize: 12 }}
                    />
                    <Bar dataKey="hours" fill="#10B981" radius={[6, 6, 0, 0]} barSize={26} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-emerald-50 py-2">
                  <p className="text-[11px] font-medium text-emerald-700/70">Present</p>
                  <p className="text-sm font-bold text-emerald-700">{attendanceRows.filter((a) => a.status === 'present').length}</p>
                </div>
                <div className="rounded-lg bg-amber-50 py-2">
                  <p className="text-[11px] font-medium text-amber-700/70">Late</p>
                  <p className="text-sm font-bold text-amber-700">{attendanceRows.filter((a) => a.status === 'late').length}</p>
                </div>
                <div className="rounded-lg bg-rose-50 py-2">
                  <p className="text-[11px] font-medium text-rose-700/70">Absent</p>
                  <p className="text-sm font-bold text-rose-700">{attendanceRows.filter((a) => a.status === 'absent').length}</p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* PAYSLIPS + PERFORMANCE */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Payslips */}
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <FiFileText className="w-4 h-4 text-emerald-500" /> My Payslips
            </h2>
            <button onClick={() => router.push('/payroll')} className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 inline-flex items-center">
              View all <FiChevronRight className="w-3 h-3" />
            </button>
          </div>
          {loading ? (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <SkeletonBlock key={i} className="h-12 w-full" />)}</div>
          ) : payslips.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-slate-400">
              <FiInfo className="w-8 h-8 mb-2" />
              <p className="text-sm">No payslips available yet</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {payslips.map((p) => (
                <div key={p.id} className="flex items-center justify-between py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">{monthLabel(p.month, p.year)}</p>
                    <p className="text-xs text-slate-500 mt-0.5">Net: {fmtMoney(p.netSalary, p.currency)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {statusBadge(p.status)}
                    <button
                      onClick={() => router.push(`/payroll`)}
                      className="text-slate-400 hover:text-emerald-600 transition-colors"
                      title="View payslip"
                    >
                      <FiDownload className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Performance + Goals */}
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <FiTrendingUp className="w-4 h-4 text-rose-500" /> My Performance
            </h2>
            <button onClick={() => router.push('/performance')} className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 inline-flex items-center">
              View all <FiChevronRight className="w-3 h-3" />
            </button>
          </div>

          {loading ? (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <SkeletonBlock key={i} className="h-12 w-full" />)}</div>
          ) : (
            <>
              {/* Latest review summary */}
              {performance ? (
                <div className="mb-4 p-4 rounded-xl bg-gradient-to-br from-rose-50 to-pink-50 border border-rose-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-rose-700/70">Latest Review · {performance.reviewCycle || 'Current cycle'}</p>
                      <p className="text-2xl font-bold text-rose-700 mt-0.5">
                        {(performance.overallRating ?? performance.rating ?? 0).toFixed(1)}
                        <span className="text-sm font-medium text-rose-400"> / 5</span>
                      </p>
                      <p className="text-xs text-rose-700/70 mt-0.5">
                        {performance.reviewer ? `By ${performance.reviewer.firstName} ${performance.reviewer.lastName}` : 'Self / Manager review'}
                      </p>
                    </div>
                    <div className="w-14 h-14 rounded-full bg-white/70 flex items-center justify-center">
                      <FiAward className="w-7 h-7 text-rose-500" />
                    </div>
                  </div>
                  <div className="mt-2">{statusBadge(performance.status)}</div>
                </div>
              ) : (
                <div className="mb-4 flex flex-col items-center justify-center py-6 text-slate-400">
                  <FiInfo className="w-8 h-8 mb-2" />
                  <p className="text-sm">No performance reviews yet</p>
                </div>
              )}

              {/* Goals progress */}
              <div className="space-y-2.5">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Goals</p>
                {goals.length === 0 ? (
                  <p className="text-sm text-slate-400 py-2">No active goals</p>
                ) : (
                  goals.slice(0, 3).map((g) => (
                    <div key={g.id} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-slate-700 truncate">{g.title}</span>
                        <span className="text-xs font-semibold text-slate-500">{g.progress || 0}%</span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${g.progress >= 75 ? 'bg-emerald-500' : g.progress >= 40 ? 'bg-amber-500' : 'bg-rose-500'}`}
                          style={{ width: `${Math.min(g.progress || 0, 100)}%` }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* TRAINING + TIMESHEETS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Training */}
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <FiBookOpen className="w-4 h-4 text-emerald-500" /> My Training
            </h2>
            <button onClick={() => router.push('/training')} className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 inline-flex items-center">
              View all <FiChevronRight className="w-3 h-3" />
            </button>
          </div>
          {loading ? (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <SkeletonBlock key={i} className="h-12 w-full" />)}</div>
          ) : training.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-slate-400">
              <FiInfo className="w-8 h-8 mb-2" />
              <p className="text-sm">No upcoming training programs</p>
            </div>
          ) : (
            <div className="space-y-3">
              {training.map((t) => (
                <div key={t.id} className="flex items-start gap-3 p-3 rounded-xl bg-slate-50/60 border border-slate-100">
                  <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-400 to-green-500 text-white flex items-center justify-center flex-shrink-0">
                    <FiBookOpen className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900 truncate">{t.training.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {t.training.startDate ? fmtDate(t.training.startDate) : 'Date TBD'}
                      {t.training.endDate ? ` → ${fmtDate(t.training.endDate)}` : ''}
                    </p>
                  </div>
                  {statusBadge(t.status)}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Timesheets */}
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <FiClock className="w-4 h-4 text-sky-500" /> My Timesheets
            </h2>
            <button onClick={() => router.push('/timesheets')} className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 inline-flex items-center">
              View all <FiChevronRight className="w-3 h-3" />
            </button>
          </div>
          {loading ? (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <SkeletonBlock key={i} className="h-12 w-full" />)}</div>
          ) : timesheets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-slate-400">
              <FiInfo className="w-8 h-8 mb-2" />
              <p className="text-sm">No timesheets submitted yet</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {timesheets.map((t) => (
                <div key={t.id} className="flex items-center justify-between py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">{fmtDate(t.date)}</p>
                    <p className="text-xs text-slate-500 mt-0.5 truncate">
                      {(typeof t.project === 'object' && t.project ? t.project.name : t.project) || t.task || 'General'} · {t.hours}h
                    </p>
                  </div>
                  {statusBadge(t.status)}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* TICKETS + DOCUMENTS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Helpdesk tickets */}
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <FiHeadphones className="w-4 h-4 text-teal-500" /> My Helpdesk Tickets
            </h2>
            <button onClick={() => router.push('/helpdesk')} className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 inline-flex items-center">
              View all <FiChevronRight className="w-3 h-3" />
            </button>
          </div>
          {loading ? (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <SkeletonBlock key={i} className="h-12 w-full" />)}</div>
          ) : tickets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-slate-400">
              <FiCheckCircle className="w-8 h-8 mb-2 text-emerald-400" />
              <p className="text-sm">No tickets raised</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {tickets.map((t) => (
                <div key={t.id} className="flex items-center justify-between py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">
                      <span className="text-slate-400 font-mono text-xs mr-2">#{t.ticketId}</span>
                      {t.subject}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">{fmtDate(t.createdAt)}</p>
                  </div>
                  {statusBadge(t.status)}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Documents */}
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <FiFolder className="w-4 h-4 text-fuchsia-500" /> My Documents
            </h2>
            <button onClick={() => router.push('/documents')} className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 inline-flex items-center">
              View all <FiChevronRight className="w-3 h-3" />
            </button>
          </div>
          {loading ? (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <SkeletonBlock key={i} className="h-12 w-full" />)}</div>
          ) : documents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-slate-400">
              <FiInfo className="w-8 h-8 mb-2" />
              <p className="text-sm">No documents uploaded</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {documents.map((d) => (
                <div key={d.id} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-fuchsia-50 text-fuchsia-600 flex items-center justify-center flex-shrink-0">
                      <FiFileText className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{d.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5 capitalize">{d.type.replace(/_/g, ' ')} · {fmtDate(d.uploadedAt)}</p>
                    </div>
                  </div>
                  {statusBadge(d.status)}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* QUICK ACTIONS */}
      <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <FiZap className="w-4 h-4 text-amber-500" /> Quick Actions
          </h2>
          <span className="text-xs text-slate-500">Tap to jump into a self-service flow</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {quickActions.map((a) => (
            <button
              key={a.label}
              onClick={() => router.push(a.href)}
              className={`group flex flex-col items-center gap-2 p-4 rounded-xl bg-gradient-to-br ${a.bg} ${a.shadow} shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all text-white`}
            >
              <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center group-hover:bg-white/30 transition-colors">
                {a.icon}
              </div>
              <span className="text-xs font-semibold text-center">{a.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Footer hint */}
      <div className="flex items-center justify-center pt-2 pb-4">
        <button
          onClick={() => router.push('/home')}
          className="inline-flex items-center gap-2 text-xs font-medium text-slate-500 hover:text-emerald-600 transition-colors"
        >
          <FiArrowRight className="w-3 h-3 rotate-180" /> Back to role-based home
        </button>
      </div>
    </div>
  );
}
