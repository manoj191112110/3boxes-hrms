'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  FiClock,
  FiLogIn,
  FiLogOut,
  FiCalendar,
  FiMapPin,
  FiChevronLeft,
  FiChevronRight,
  FiCpu,
  FiMap,
  FiAlertTriangle,
  FiShield,
  FiList,
  FiSearch,
  FiCheckCircle,
  FiXCircle,
  FiAlertCircle,
  FiUserCheck,
  FiEye,
  FiUsers,
  FiFilter,
  FiGrid,
  FiRefreshCw,
  FiDatabase,
} from 'react-icons/fi';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { sanitizeSearch } from '@/lib/validators';
import { useAuthStore } from '@/store/authStore';
import ModuleTips from '@/components/ModuleTips';
import ModuleWorkflow from '@/components/ModuleWorkflow';
import { useCompanyContextStore } from '@/store/companyContextStore';
import { isClientDemoMode } from '@/lib/site-mode';

/* ── Attendance Tips ── */
const attendanceTips = [
  {
    title: 'Configure Shift Timings First',
    description: 'Configure shift timings and overtime rules in Settings before tracking attendance',
  },
  {
    title: 'Use Geofencing',
    description: 'Use the Geofencing feature to ensure employees clock in from approved locations',
  },
  {
    title: 'Customize Thresholds',
    description: 'Late arrival and early departure thresholds can be customized in Attendance Settings',
  },
  {
    title: 'Bulk Import from Biometric',
    description: 'Import attendance data from biometric devices using the bulk import feature',
  },
  {
    title: 'Review Weekly Reports',
    description: 'Review the Attendance Report weekly to identify patterns of absenteeism',
  },
];

/* ── Attendance Workflow Steps ── */
const attendanceWorkflowSteps = [
  { step: 1, title: 'Configure Shift Timings', description: 'Set up work shift schedules and grace periods' },
  { step: 2, title: 'Set Overtime Rules', description: 'Define overtime thresholds and calculation rules' },
  { step: 3, title: 'Employee Checks In', description: 'Employee clocks in at the start of the work day' },
  { step: 4, title: 'Employee Checks Out', description: 'Employee clocks out at the end of the work day' },
  { step: 5, title: 'Auto-Calculate Work Hours', description: 'System calculates total hours and overtime automatically' },
  { step: 6, title: 'Review Monthly Summary', description: 'Review attendance summary for the month' },
  { step: 7, title: 'Generate Attendance Report', description: 'Export attendance data for payroll and compliance' },
];

/* ── Types ── */
interface AttendanceRecord {
  id: string;
  date: string;
  checkIn?: string | null;
  checkOut?: string | null;
  workHours?: number | null;
  overtime?: number | null;
  status: string;
  notes?: string | null;
  location?: string | null;
  employee?: {
    id: string;
    firstName: string;
    lastName: string;
    employeeId: string;
    avatar?: string | null;
  } | null;
}

interface Employee {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
}

/* ── Helpers ── */
function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

function formatDate(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatTime(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function getStatusConfig(status: string) {
  const configs: Record<string, { label: string; dotColor: string; bgColor: string; textColor: string }> = {
    present: { label: 'Present', dotColor: 'bg-emerald-500', bgColor: 'bg-emerald-50', textColor: 'text-emerald-700' },
    absent: { label: 'Absent', dotColor: 'bg-red-500', bgColor: 'bg-red-50', textColor: 'text-red-700' },
    late: { label: 'Late', dotColor: 'bg-amber-500', bgColor: 'bg-amber-50', textColor: 'text-amber-700' },
    on_leave: { label: 'On Leave', dotColor: 'bg-green-500', bgColor: 'bg-green-50', textColor: 'text-green-700' },
    half_day: { label: 'Half Day', dotColor: 'bg-teal-500', bgColor: 'bg-teal-50', textColor: 'text-teal-700' },
    holiday: { label: 'Holiday', dotColor: 'bg-sky-500', bgColor: 'bg-sky-50', textColor: 'text-sky-700' },
    weekend: { label: 'Weekend', dotColor: 'bg-slate-400', bgColor: 'bg-slate-50', textColor: 'text-slate-600' },
  };
  return configs[status] || { label: status, dotColor: 'bg-gray-400', bgColor: 'bg-gray-50', textColor: 'text-gray-600' };
}

function getDayStatusColor(status: string) {
  const map: Record<string, string> = {
    present: 'bg-emerald-500 text-white',
    absent: 'bg-red-500 text-white',
    late: 'bg-orange-400 text-white',
    half_day: 'bg-amber-400 text-white',
    holiday: 'bg-green-400 text-white',
    weekend: 'bg-slate-200 text-slate-500',
    on_leave: 'bg-green-400 text-white',
  };
  return map[status] || 'bg-slate-100 text-slate-400';
}

function getInitials(firstName?: string, lastName?: string) {
  const f = firstName?.charAt(0)?.toUpperCase() || '';
  const l = lastName?.charAt(0)?.toUpperCase() || '';
  return f + l || '?';
}

function calculateLateBy(checkIn: string | null | undefined): string {
  if (!checkIn) return '0m';
  const checkInTime = new Date(checkIn);
  const shiftStart = new Date(checkInTime);
  shiftStart.setHours(9, 15, 0, 0); // 9:15 AM is the threshold
  const diffMs = checkInTime.getTime() - shiftStart.getTime();
  if (diffMs <= 0) return '0m';
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 60) return `${diffMins}m`;
  const hours = Math.floor(diffMins / 60);
  const mins = diffMins % 60;
  return `${hours}h ${mins}m`;
}

function calculateBreakDuration(checkIn: string | null | undefined, checkOut: string | null | undefined, workHours: number | null | undefined): string {
  if (!checkIn || !checkOut || workHours == null) return '—';
  const totalMs = new Date(checkOut).getTime() - new Date(checkIn).getTime();
  const totalHours = totalMs / (1000 * 60 * 60);
  const breakHours = totalHours - workHours;
  if (breakHours <= 0) return '0m';
  const breakMins = Math.round(breakHours * 60);
  if (breakMins < 60) return `${breakMins}m`;
  const h = Math.floor(breakMins / 60);
  const m = breakMins % 60;
  return `${h}h ${m}m`;
}

/* ── Sample Attendance Data removed — data comes from API only ── */

/* ── Component ── */
export default function AttendancePage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'super_admin' || user?.role === 'admin' || user?.role === 'hr';
  const scopeQuery = useCompanyContextStore(s => s.scopeQuery);
  const selectedTenantId = useCompanyContextStore(s => s.selectedTenantId);

  /* ── Active tab ── */
  const [activeTab, setActiveTab] = useState<'admin' | 'self'>(isAdmin ? 'admin' : 'self');

  /* ── Admin view state ── */
  const [adminAttendance, setAdminAttendance] = useState<AttendanceRecord[]>([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  /* ── Self view state ── */
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkingIn, setCheckingIn] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const handleSeedData = async () => {
    try {
      setSeeding(true);
      const res = await fetch('/api/admin/seed-demo-data', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ module: 'attendance' }),
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      toast.success(data.message || 'Attendance demo data seeded');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to seed');
    } finally {
      setSeeding(false);
    }
  };
  const [checkingOut, setCheckingOut] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return { month: now.getMonth(), year: now.getFullYear() };
  });
  const [viewMode, setViewMode] = useState<'table' | 'calendar'>('calendar');

  /* ── Detail modal ── */
  const [detailRecord, setDetailRecord] = useState<AttendanceRecord | null>(null);

  /* ── Fetch admin attendance (all employees for selected date) ── */
  const fetchAdminAttendance = useCallback(async () => {
    try {
      setAdminLoading(true);
      const params = new URLSearchParams({
        date: selectedDate,
        limit: '200',
      });
      const sq = scopeQuery();
      const res = await fetch(`/api/attendance?${params.toString()}${sq ? `&${sq}` : ''}`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        const fetched = data.attendance || [];
        setAdminAttendance(fetched);
      } else {
        setAdminAttendance([]);
      }
    } catch (err) {
      console.error(err);
      setAdminAttendance([]);
    } finally {
      setAdminLoading(false);
    }
  }, [selectedDate, scopeQuery, selectedTenantId]);

  /* ── Find current user's employee record ── */
  const fetchEmployee = useCallback(async () => {
    try {
      // First: use the employee info from auth store if available (most reliable)
      if (user?.employee?.id) {
        setEmployee({
          id: user.employee.id,
          employeeId: user.employee.employeeId,
          firstName: user.employee.firstName,
          lastName: user.employee.lastName,
          email: user.email,
        });
        return;
      }
      // Fallback: fetch from API and match by email or userId
      const sq = scopeQuery();
      const res = await fetch(`/api/employees?limit=500${sq ? `&${sq}` : ''}`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        const myEmp = data.employees?.find((e: { email: string; userId?: string }) =>
          e.email === user?.email || e.userId === user?.id
        );
        if (myEmp) setEmployee(myEmp);
      }
    } catch (err) {
      console.error('fetchEmployee error:', err);
    }
  }, [user?.email, user?.id, user?.employee, scopeQuery, selectedTenantId]);

  /* ── Fetch self attendance ── */
  const fetchAttendance = useCallback(async () => {
    if (!employee) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/attendance?employeeId=${employee.id}&limit=50`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        const fetched = data.attendance || [];
        setAttendance(fetched);
      } else {
        setAttendance([]);
      }
    } catch (err) {
      console.error(err);
      setAttendance([]);
    } finally {
      setLoading(false);
    }
  }, [employee]);

  /* ── Effects ── */
  useEffect(() => { queueMicrotask(() => fetchEmployee()); }, [fetchEmployee]);
  useEffect(() => { if (employee) queueMicrotask(() => fetchAttendance()); }, [employee, fetchAttendance]);
  useEffect(() => { if (isAdmin && activeTab === 'admin') queueMicrotask(() => fetchAdminAttendance()); }, [fetchAdminAttendance, activeTab, isAdmin]);

  /* ── Check In ── */
  const handleCheckIn = async () => {
    if (!employee) {
      toast.error('Employee record not found. Please ensure your profile is set up.');
      return;
    }
    try {
      setCheckingIn(true);
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ employeeId: employee.id, action: 'checkin' }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed'); }
      toast.success('Checked in successfully!');
      await fetchAttendance();
      if (isAdmin) await fetchAdminAttendance();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Check-in failed');
    } finally {
      setCheckingIn(false);
    }
  };

  /* ── Check Out ── */
  const handleCheckOut = async () => {
    if (!employee) {
      toast.error('Employee record not found. Please ensure your profile is set up.');
      return;
    }
    try {
      setCheckingOut(true);
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ employeeId: employee.id, action: 'checkout' }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed'); }
      toast.success('Checked out successfully!');
      await fetchAttendance();
      if (isAdmin) await fetchAdminAttendance();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Check-out failed');
    } finally {
      setCheckingOut(false);
    }
  };

  /* ── Today's status for self view ── */
  // Use UTC-based YYYY-MM-DD string comparison to avoid timezone mismatch
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayRecord = attendance.find(a => {
    const dateStr = new Date(a.date).toISOString().slice(0, 10);
    return dateStr === todayStr;
  });
  const isCheckedIn = !!todayRecord?.checkIn;
  const isCheckedOut = !!todayRecord?.checkOut;

  /* ── Admin stats ── */
  const stats = useMemo(() => {
    const present = adminAttendance.filter(a => a.status === 'present').length;
    const late = adminAttendance.filter(a => a.status === 'late').length;
    const absent = adminAttendance.filter(a => a.status === 'absent').length;
    const onLeave = adminAttendance.filter(a => a.status === 'on_leave').length;
    return {
      totalPresent: present + late,
      totalAbsent: absent,
      lateArrivals: late,
      onLeave,
    };
  }, [adminAttendance]);

  /* ── Filter admin data ── */
  const filteredAttendance = useMemo(() => {
    let data = [...adminAttendance];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      data = data.filter(a =>
        a.employee?.firstName?.toLowerCase().includes(q) ||
        a.employee?.lastName?.toLowerCase().includes(q) ||
        a.employee?.employeeId?.toLowerCase().includes(q)
      );
    }
    // Department filter would need department info in employee data
    // For now, we filter based on available data
    return data;
  }, [adminAttendance, searchQuery]);

  /* ── Calendar data for selected month ── */
  const getCalendarDays = () => {
    const { month, year } = selectedMonth;
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPad = firstDay.getDay();
    const totalDays = lastDay.getDate();
    const days: Array<{ date: number; status: string | null; isCurrentMonth: boolean }> = [];
    for (let i = 0; i < startPad; i++) {
      days.push({ date: 0, status: null, isCurrentMonth: false });
    }
    for (let d = 1; d <= totalDays; d++) {
      const dateStr = new Date(year, month, d).toISOString().split('T')[0];
      const record = attendance.find(a => {
        const aDate = new Date(a.date).toISOString().split('T')[0];
        return aDate === dateStr;
      });
      days.push({ date: d, status: record?.status || null, isCurrentMonth: true });
    }
    return days;
  };

  const calendarDays = getCalendarDays();
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  const navigateMonth = (dir: -1 | 1) => {
    setSelectedMonth(prev => {
      let { month, year } = prev;
      month += dir;
      if (month > 11) { month = 0; year++; }
      if (month < 0) { month = 11; year--; }
      return { month, year };
    });
  };

  /* ── Self view stats ── */
  const presentCount = attendance.filter(a => ['present', 'late'].includes(a.status)).length;
  const lateCount = attendance.filter(a => a.status === 'late').length;
  const totalHours = attendance.reduce((sum, a) => sum + (a.workHours || 0), 0);
  const totalOvertime = attendance.reduce((sum, a) => sum + (a.overtime || 0), 0);

  /* ── Format selected date for display ── */
  const formattedSelectedDate = useMemo(() => {
    const d = new Date(selectedDate + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  }, [selectedDate]);

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-thb-text-primary flex items-center gap-2">
            <FiClock className="w-6 h-6 text-cyan-500" />
            Attendance
          </h1>
          <p className="text-thb-text-secondary mt-1">Track & manage employee attendance</p>
        </div>
        <div className="flex items-center gap-2">
          {isClientDemoMode() && (
          <button onClick={handleSeedData} disabled={seeding} className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 disabled:opacity-50 transition-colors">
            {seeding ? <FiRefreshCw className="w-3.5 h-3.5 animate-spin" /> : <FiDatabase className="w-3.5 h-3.5" />}
            {seeding ? 'Seeding...' : 'Seed Sample Data'}
          </button>
          )}
          {/* Check In / Out buttons — always available */}
          <button
            onClick={handleCheckIn}
            disabled={checkingIn || isCheckedIn}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-all ${
              isCheckedIn
                ? 'bg-emerald-50 text-emerald-600 border border-emerald-200 cursor-default'
                : 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-sm shadow-emerald-500/25 hover:shadow-md'
            }`}
          >
            <FiLogIn className="w-4 h-4" />
            {checkingIn ? 'Checking...' : isCheckedIn ? '✓ Checked In' : 'Check In'}
          </button>
          <button
            onClick={handleCheckOut}
            disabled={checkingOut || !isCheckedIn || isCheckedOut}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-all ${
              !isCheckedIn || isCheckedOut
                ? 'bg-slate-50 text-slate-400 border border-slate-200 cursor-not-allowed'
                : 'bg-rose-500 text-white hover:bg-rose-600 shadow-sm shadow-rose-500/25 hover:shadow-md'
            }`}
          >
            <FiLogOut className="w-4 h-4" />
            {checkingOut ? 'Checking...' : isCheckedOut ? '✓ Checked Out' : 'Check Out'}
          </button>
        </div>
      </div>

      {/* ── Tab Switcher (Admin / Self View) ── */}
      {isAdmin && (
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl w-fit">
          <button
            onClick={() => setActiveTab('admin')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'admin'
                ? 'bg-white text-thb-text-primary shadow-sm'
                : 'text-thb-text-secondary hover:text-thb-text-primary'
            }`}
          >
            <FiUsers className="w-4 h-4" />
            Admin View
          </button>
          <button
            onClick={() => setActiveTab('self')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'self'
                ? 'bg-white text-thb-text-primary shadow-sm'
                : 'text-thb-text-secondary hover:text-thb-text-primary'
            }`}
          >
            <FiUserCheck className="w-4 h-4" />
            My Attendance
          </button>
        </div>
      )}

      {/* ══════════════════════════════════════════════════ */}
      {/* ── ADMIN VIEW ── */}
      {/* ══════════════════════════════════════════════════ */}
      {activeTab === 'admin' && isAdmin && (
        <>
          {/* ── Stats Row ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              icon={<FiCheckCircle className="w-5 h-5" />}
              label="Total Present"
              value={stats.totalPresent}
              iconBg="bg-emerald-100"
              iconColor="text-emerald-600"
              accent="border-l-emerald-500"
            />
            <StatCard
              icon={<FiXCircle className="w-5 h-5" />}
              label="Total Absent"
              value={stats.totalAbsent}
              iconBg="bg-red-100"
              iconColor="text-red-600"
              accent="border-l-red-500"
            />
            <StatCard
              icon={<FiAlertCircle className="w-5 h-5" />}
              label="Late Arrivals"
              value={stats.lateArrivals}
              iconBg="bg-amber-100"
              iconColor="text-amber-600"
              accent="border-l-amber-500"
            />
            <StatCard
              icon={<FiCalendar className="w-5 h-5" />}
              label="On Leave"
              value={stats.onLeave}
              iconBg="bg-green-100"
              iconColor="text-green-600"
              accent="border-l-green-500"
            />
          </div>

          {/* ── Filter Bar ── */}
          <div className="thb-card p-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              {/* Date picker */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <FiCalendar className="w-4 h-4 text-thb-text-secondary" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={e => setSelectedDate(e.target.value)}
                  className="px-3 py-2 text-sm border border-thb-border rounded-lg bg-white text-thb-text-primary focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all"
                />
              </div>

              {/* Department filter */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <FiFilter className="w-4 h-4 text-thb-text-secondary" />
                <select
                  value={selectedDepartment}
                  onChange={e => setSelectedDepartment(e.target.value)}
                  className="px-3 py-2 text-sm border border-thb-border rounded-lg bg-white text-thb-text-primary focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all min-w-[150px]"
                >
                  <option value="all">All Departments</option>
                  <option value="engineering">Engineering</option>
                  <option value="hr">Human Resources</option>
                  <option value="finance">Finance</option>
                  <option value="sales">Sales</option>
                  <option value="marketing">Marketing</option>
                  <option value="operations">Operations</option>
                </select>
              </div>

              {/* Search */}
              <div className="relative flex-1 min-w-[200px]">
                <FiSearch className="w-4 h-4 text-thb-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search employee..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(sanitizeSearch(e.target.value))}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-thb-border rounded-lg bg-white text-thb-text-primary placeholder:text-thb-text-muted focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all"
                />
              </div>

              {/* Date display */}
              <div className="text-sm text-thb-text-secondary flex-shrink-0 hidden md:block">
                {formattedSelectedDate}
              </div>

              {/* Refresh */}
              <button
                onClick={() => fetchAdminAttendance()}
                className="p-2 rounded-lg border border-thb-border text-thb-text-secondary hover:bg-slate-50 hover:text-thb-text-primary transition-colors flex-shrink-0"
                title="Refresh"
              >
                <FiRefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* ── Attendance Table ── */}
          <div className="thb-card overflow-hidden">
            <div className="px-6 py-4 border-b border-thb-border flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-thb-text-primary">Attendance Records</h2>
                <p className="text-xs text-thb-text-muted mt-0.5">{filteredAttendance.length} employee{filteredAttendance.length !== 1 ? 's' : ''} found</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-thb-border bg-slate-50/60">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Employee</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Check In</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Check Out</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Break</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Late By</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Prod. Hours</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {adminLoading ? (
                    Array.from({ length: 6 }).map((_, i) => (
                      <tr key={i} className="border-b border-thb-border/50 animate-pulse">
                        <td className="px-4 py-3"><div className="flex items-center gap-3"><div className="w-8 h-8 rounded-full bg-slate-200" /><div className="space-y-1.5"><div className="h-3 w-24 bg-slate-200 rounded" /><div className="h-2 w-16 bg-slate-100 rounded" /></div></div></td>
                        <td className="px-4 py-3"><div className="h-5 w-16 bg-slate-200 rounded-full" /></td>
                        <td className="px-4 py-3"><div className="h-3 w-14 bg-slate-200 rounded" /></td>
                        <td className="px-4 py-3"><div className="h-3 w-14 bg-slate-200 rounded" /></td>
                        <td className="px-4 py-3"><div className="h-3 w-10 bg-slate-200 rounded" /></td>
                        <td className="px-4 py-3"><div className="h-3 w-10 bg-slate-200 rounded" /></td>
                        <td className="px-4 py-3"><div className="h-3 w-10 bg-slate-200 rounded" /></td>
                        <td className="px-4 py-3"><div className="h-3 w-8 bg-slate-200 rounded" /></td>
                      </tr>
                    ))
                  ) : filteredAttendance.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-16 text-center">
                        <FiUsers className="w-12 h-12 text-thb-text-muted mx-auto mb-3" />
                        <p className="text-thb-text-secondary font-medium">No attendance records found</p>
                        <p className="text-sm text-thb-text-muted mt-1">No employees have checked in for {formattedSelectedDate}</p>
                      </td>
                    </tr>
                  ) : (
                    filteredAttendance.map(a => {
                      const statusConfig = getStatusConfig(a.status);
                      const lateBy = calculateLateBy(a.checkIn);
                      const breakDur = calculateBreakDuration(a.checkIn, a.checkOut, a.workHours);
                      return (
                        <tr key={a.id} className="border-b border-thb-border/50 hover:bg-slate-50/80 transition-colors group">
                          {/* Employee */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-400 to-cyan-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                                {getInitials(a.employee?.firstName, a.employee?.lastName)}
                              </div>
                              <div>
                                <p className="text-sm font-medium text-thb-text-primary">
                                  {a.employee?.firstName || 'Unknown'} {a.employee?.lastName || ''}
                                </p>
                                <p className="text-xs text-thb-text-muted">
                                  {a.employee?.employeeId || '—'}
                                </p>
                              </div>
                            </div>
                          </td>
                          {/* Status */}
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusConfig.bgColor} ${statusConfig.textColor}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dotColor}`} />
                              {statusConfig.label}
                            </span>
                          </td>
                          {/* Check In */}
                          <td className="px-4 py-3 text-sm text-thb-text-secondary">{formatTime(a.checkIn)}</td>
                          {/* Check Out */}
                          <td className="px-4 py-3 text-sm text-thb-text-secondary">{formatTime(a.checkOut)}</td>
                          {/* Break */}
                          <td className="px-4 py-3 text-sm text-thb-text-secondary">{breakDur}</td>
                          {/* Late By */}
                          <td className="px-4 py-3">
                            <span className={`text-sm font-medium ${lateBy !== '0m' ? 'text-red-600' : 'text-thb-text-muted'}`}>
                              {lateBy !== '0m' ? lateBy : '—'}
                            </span>
                          </td>
                          {/* Production Hours */}
                          <td className="px-4 py-3">
                            <span className={`text-sm font-medium ${
                              a.workHours != null
                                ? a.workHours >= 8
                                  ? 'text-emerald-600'
                                  : 'text-amber-600'
                                : 'text-thb-text-muted'
                            }`}>
                              {a.workHours != null ? `${a.workHours.toFixed(1)}h` : '—'}
                            </span>
                          </td>
                          {/* Actions */}
                          <td className="px-4 py-3">
                            <button
                              onClick={() => setDetailRecord(a)}
                              className="inline-flex items-center gap-1 text-xs text-cyan-600 hover:text-cyan-700 font-medium opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <FiEye className="w-3.5 h-3.5" />
                              View
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Quick Links (admin only) ── */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            <QuickLink href="/attendance/biometric" icon={<FiCpu className="w-4 h-4" />} label="Biometric" sub="Devices & enrollments" color="violet" />
            <QuickLink href="/attendance/geofence" icon={<FiMap className="w-4 h-4" />} label="Geofencing" sub="Office perimeters" color="emerald" />
            <QuickLink href="/attendance/regularize" icon={<FiAlertTriangle className="w-4 h-4" />} label="Regularize" sub="Missed punch fix" color="amber" />
            <QuickLink href="/attendance/overtime" icon={<FiClock className="w-4 h-4" />} label="Overtime" sub="OT + comp-off" color="rose" />
            <QuickLink href="/attendance/settings?tab=config" icon={<FiShield className="w-4 h-4" />} label="Policy & Settings" sub="Config + rules" color="violet" />
          </div>

          {/* ── Module Tips & Workflow ── */}
          <ModuleTips
            moduleKey="attendance"
            title="Attendance Tips"
            tips={attendanceTips}
            userRole={user?.role}
          />
          <ModuleWorkflow
            moduleKey="attendance"
            title="How to Track Attendance"
            subtitle="Follow this workflow to set up and monitor attendance"
            steps={attendanceWorkflowSteps}
            accentColor="cyan"
            userRole={user?.role}
          />
        </>
      )}

      {/* ══════════════════════════════════════════════════ */}
      {/* ── SELF VIEW ── */}
      {/* ══════════════════════════════════════════════════ */}
      {activeTab === 'self' && (
        <>
          {/* ── Today's Quick Stats ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              icon={<FiLogIn className="w-5 h-5" />}
              label="Check In"
              value={todayRecord?.checkIn ? formatTime(todayRecord.checkIn) : '—'}
              iconBg="bg-green-100"
              iconColor="text-green-600"
              accent="border-l-green-500"
              isText
            />
            <StatCard
              icon={<FiLogOut className="w-5 h-5" />}
              label="Check Out"
              value={todayRecord?.checkOut ? formatTime(todayRecord.checkOut) : '—'}
              iconBg="bg-red-100"
              iconColor="text-red-600"
              accent="border-l-red-500"
              isText
            />
            <StatCard
              icon={<FiClock className="w-5 h-5" />}
              label="Work Hours"
              value={todayRecord?.workHours != null ? `${todayRecord.workHours.toFixed(1)}h` : '—'}
              iconBg="bg-emerald-100"
              iconColor="text-emerald-600"
              accent="border-l-emerald-500"
              isText
            />
            <StatCard
              icon={<FiCheckCircle className="w-5 h-5" />}
              label="Status"
              value={todayRecord ? getStatusConfig(todayRecord.status).label : 'Not Checked In'}
              iconBg="bg-amber-100"
              iconColor="text-amber-600"
              accent="border-l-amber-500"
              isText
            />
          </div>

          {/* ── View Toggle ── */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
              <button
                onClick={() => setViewMode('calendar')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  viewMode === 'calendar'
                    ? 'bg-white text-thb-text-primary shadow-sm'
                    : 'text-thb-text-secondary hover:text-thb-text-primary'
                }`}
              >
                <FiCalendar className="w-3.5 h-3.5" />
                Calendar
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  viewMode === 'table'
                    ? 'bg-white text-thb-text-primary shadow-sm'
                    : 'text-thb-text-secondary hover:text-thb-text-primary'
                }`}
              >
                <FiGrid className="w-3.5 h-3.5" />
                Table
              </button>
            </div>

            {/* Monthly Summary Mini */}
            <div className="hidden sm:flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5 text-emerald-600 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                {presentCount} Present
              </span>
              <span className="flex items-center gap-1.5 text-amber-600 font-medium">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                {lateCount} Late
              </span>
              <span className="flex items-center gap-1.5 text-green-600 font-medium">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                {totalHours.toFixed(0)}h Total
              </span>
              <span className="flex items-center gap-1.5 text-teal-600 font-medium">
                <span className="w-2 h-2 rounded-full bg-teal-500" />
                {totalOvertime.toFixed(1)}h OT
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* ── Calendar View ── */}
            {viewMode === 'calendar' && (
              <div className="lg:col-span-2 thb-card p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-semibold text-thb-text-primary">Monthly Calendar</h2>
                  <div className="flex items-center gap-2">
                    <button onClick={() => navigateMonth(-1)} className="p-1.5 rounded-lg border border-thb-border text-thb-text-secondary hover:bg-slate-50 transition-colors">
                      <FiChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-sm font-medium text-thb-text-primary min-w-[140px] text-center">
                      {monthNames[selectedMonth.month]} {selectedMonth.year}
                    </span>
                    <button onClick={() => navigateMonth(1)} className="p-1.5 rounded-lg border border-thb-border text-thb-text-secondary hover:bg-slate-50 transition-colors">
                      <FiChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-7 gap-1">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="text-center text-xs font-semibold text-thb-text-muted py-2">{day}</div>
                  ))}
                  {calendarDays.map((day, i) => {
                    if (!day.isCurrentMonth) return <div key={`pad-${i}`} className="aspect-square" />;
                    const today = new Date();
                    const isToday = day.date === today.getDate() && selectedMonth.month === today.getMonth() && selectedMonth.year === today.getFullYear();
                    return (
                      <div
                        key={day.date}
                        className={`aspect-square rounded-lg flex flex-col items-center justify-center text-xs relative transition-transform hover:scale-105 ${
                          day.status ? getDayStatusColor(day.status) : 'bg-slate-50 text-thb-text-muted'
                        } ${isToday ? 'ring-2 ring-cyan-500 ring-offset-1' : ''}`}
                      >
                        <span className="font-medium">{day.date}</span>
                        {day.status && (
                          <span className="text-[8px] leading-none mt-0.5 opacity-80">
                            {day.status === 'present' ? 'P' : day.status === 'late' ? 'L' : day.status === 'absent' ? 'A' : day.status === 'holiday' ? 'H' : day.status === 'weekend' ? 'W' : day.status === 'half_day' ? 'HD' : day.status === 'on_leave' ? 'LV' : ''}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Legend */}
                <div className="flex flex-wrap items-center gap-3 mt-4 pt-4 border-t border-thb-border">
                  {[
                    { label: 'Present', color: 'bg-emerald-500' },
                    { label: 'Late', color: 'bg-orange-400' },
                    { label: 'Absent', color: 'bg-red-500' },
                    { label: 'Half Day', color: 'bg-amber-400' },
                    { label: 'On Leave', color: 'bg-green-400' },
                    { label: 'Weekend', color: 'bg-slate-200' },
                  ].map(l => (
                    <div key={l.label} className="flex items-center gap-1.5">
                      <span className={`w-3 h-3 rounded ${l.color}`} />
                      <span className="text-xs text-thb-text-muted">{l.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Table View ── */}
            {viewMode === 'table' && (
              <div className="lg:col-span-2 thb-card overflow-hidden">
                <div className="px-6 py-4 border-b border-thb-border">
                  <h2 className="text-sm font-semibold text-thb-text-primary">Attendance Records</h2>
                </div>
                <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
                  <table className="w-full">
                    <thead className="sticky top-0 z-10">
                      <tr className="border-b border-thb-border bg-slate-50/90 backdrop-blur-sm">
                        <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Date</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Status</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Check In</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Check Out</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Hours</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">OT</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        Array.from({ length: 5 }).map((_, i) => (
                          <tr key={i} className="border-b border-thb-border/50 animate-pulse">
                            <td className="px-4 py-3"><div className="h-3 w-24 bg-slate-200 rounded" /></td>
                            <td className="px-4 py-3"><div className="h-5 w-16 bg-slate-200 rounded-full" /></td>
                            <td className="px-4 py-3"><div className="h-3 w-16 bg-slate-200 rounded" /></td>
                            <td className="px-4 py-3"><div className="h-3 w-16 bg-slate-200 rounded" /></td>
                            <td className="px-4 py-3"><div className="h-3 w-12 bg-slate-200 rounded" /></td>
                            <td className="px-4 py-3"><div className="h-3 w-12 bg-slate-200 rounded" /></td>
                          </tr>
                        ))
                      ) : attendance.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-12 text-center">
                            <FiClock className="w-10 h-10 text-thb-text-muted mx-auto mb-3" />
                            <p className="text-thb-text-secondary font-medium">No attendance records</p>
                            <p className="text-sm text-thb-text-muted mt-1">Check in to start tracking your attendance</p>
                          </td>
                        </tr>
                      ) : (
                        attendance.map(a => {
                          const statusConfig = getStatusConfig(a.status);
                          return (
                            <tr key={a.id} className="border-b border-thb-border/50 hover:bg-slate-50/50 transition-colors">
                              <td className="px-4 py-3 text-sm font-medium text-thb-text-primary">{formatDate(a.date)}</td>
                              <td className="px-4 py-3">
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusConfig.bgColor} ${statusConfig.textColor}`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dotColor}`} />
                                  {statusConfig.label}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-sm text-thb-text-secondary">{formatTime(a.checkIn)}</td>
                              <td className="px-4 py-3 text-sm text-thb-text-secondary">{formatTime(a.checkOut)}</td>
                              <td className="px-4 py-3 text-sm text-thb-text-secondary">{a.workHours != null ? `${a.workHours}h` : '—'}</td>
                              <td className="px-4 py-3 text-sm text-thb-text-secondary">{a.overtime != null && a.overtime > 0 ? `${a.overtime}h` : '—'}</td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── Sidebar ── */}
            <div className="space-y-4">
              <div className="thb-card p-6">
                <h3 className="text-sm font-semibold text-thb-text-primary mb-4">Monthly Summary</h3>
                <div className="space-y-4">
                  <SummaryRow label="Present Days" value={`${presentCount}`} color="text-emerald-600" barBg="bg-emerald-100" barFill="bg-emerald-500" pct={Math.min(100, (presentCount / 22) * 100)} />
                  <SummaryRow label="Late Arrivals" value={`${lateCount}`} color="text-amber-600" barBg="bg-amber-100" barFill="bg-amber-500" pct={Math.min(100, (lateCount / 22) * 100)} />
                  <SummaryRow label="Total Hours" value={`${totalHours.toFixed(1)}h`} color="text-green-600" barBg="bg-green-100" barFill="bg-green-500" pct={Math.min(100, (totalHours / 176) * 100)} />
                  <SummaryRow label="Overtime" value={`${totalOvertime.toFixed(1)}h`} color="text-teal-600" barBg="bg-teal-100" barFill="bg-teal-500" pct={Math.min(100, totalOvertime > 0 ? (totalOvertime / 20) * 100 : 0)} />
                </div>
              </div>

              <div className="thb-card p-6">
                <h3 className="text-sm font-semibold text-thb-text-primary mb-3">Quick Info</h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <FiCalendar className="w-4 h-4 text-thb-text-muted" />
                    <span className="text-thb-text-secondary">Current Month: </span>
                    <span className="font-medium text-thb-text-primary">{monthNames[selectedMonth.month]}</span>
                  </div>
                  {employee && (
                    <div className="flex items-center gap-2 text-sm">
                      <FiMapPin className="w-4 h-4 text-thb-text-muted" />
                      <span className="text-thb-text-secondary">Employee: </span>
                      <span className="font-medium text-thb-text-primary">{employee.firstName} {employee.lastName}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Quick Links for self view */}
              <div className="thb-card p-4">
                <h3 className="text-xs font-semibold text-thb-text-secondary uppercase tracking-wider mb-3">Quick Links</h3>
                <div className="space-y-1.5">
                  <QuickLinkSmall href="/attendance/regularize" icon={<FiAlertTriangle className="w-3.5 h-3.5" />} label="Regularize" color="text-amber-600" />
                  <QuickLinkSmall href="/attendance/permission" icon={<FiClock className="w-3.5 h-3.5" />} label="Permission" color="text-green-600" />
                  <QuickLinkSmall href="/attendance/gatepass" icon={<FiList className="w-3.5 h-3.5" />} label="Gatepass" color="text-cyan-600" />
                  <QuickLinkSmall href="/attendance/comp-off" icon={<FiCalendar className="w-3.5 h-3.5" />} label="Comp-Off" color="text-emerald-600" />
                </div>
              </div>
            </div>
          </div>

          {/* Module Tips & Workflow (self view) */}
          <ModuleTips
            moduleKey="attendance"
            title="Attendance Tips"
            tips={attendanceTips}
            userRole={user?.role}
          />
          <ModuleWorkflow
            moduleKey="attendance"
            title="How to Track Attendance"
            subtitle="Follow this workflow to set up and monitor attendance"
            steps={attendanceWorkflowSteps}
            accentColor="cyan"
            userRole={user?.role}
          />
        </>
      )}

      {/* ── Detail Modal ── */}
      {detailRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setDetailRecord(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-thb-text-primary">Attendance Detail</h3>
              <button onClick={() => setDetailRecord(null)} className="p-1 rounded-lg hover:bg-slate-100 transition-colors text-thb-text-secondary">
                <FiChevronLeft className="w-5 h-5" />
              </button>
            </div>

            {/* Employee Info */}
            {detailRecord.employee && (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50">
                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-cyan-400 to-cyan-600 flex items-center justify-center text-white text-sm font-bold">
                  {getInitials(detailRecord.employee.firstName, detailRecord.employee.lastName)}
                </div>
                <div>
                  <p className="font-medium text-thb-text-primary">{detailRecord.employee.firstName} {detailRecord.employee.lastName}</p>
                  <p className="text-xs text-thb-text-muted">{detailRecord.employee.employeeId}</p>
                </div>
              </div>
            )}

            {/* Details Grid */}
            <div className="grid grid-cols-2 gap-3">
              <DetailField label="Date" value={formatDate(detailRecord.date)} />
              <DetailField label="Status" value={getStatusConfig(detailRecord.status).label} />
              <DetailField label="Check In" value={formatTime(detailRecord.checkIn)} />
              <DetailField label="Check Out" value={formatTime(detailRecord.checkOut)} />
              <DetailField label="Work Hours" value={detailRecord.workHours != null ? `${detailRecord.workHours.toFixed(2)}h` : '—'} />
              <DetailField label="Overtime" value={detailRecord.overtime != null && detailRecord.overtime > 0 ? `${detailRecord.overtime.toFixed(2)}h` : '—'} />
              <DetailField label="Late By" value={calculateLateBy(detailRecord.checkIn) !== '0m' ? calculateLateBy(detailRecord.checkIn) : 'On time'} />
              <DetailField label="Break" value={calculateBreakDuration(detailRecord.checkIn, detailRecord.checkOut, detailRecord.workHours)} />
            </div>

            {detailRecord.location && (
              <div className="flex items-center gap-2 text-sm text-thb-text-secondary p-2 rounded-lg bg-slate-50">
                <FiMapPin className="w-4 h-4 text-thb-text-muted flex-shrink-0" />
                <span>{detailRecord.location}</span>
              </div>
            )}

            {detailRecord.notes && (
              <div className="p-2 rounded-lg bg-slate-50">
                <p className="text-xs text-thb-text-muted mb-1">Notes</p>
                <p className="text-sm text-thb-text-secondary">{detailRecord.notes}</p>
              </div>
            )}

            <button
              onClick={() => setDetailRecord(null)}
              className="w-full py-2.5 rounded-xl bg-slate-100 text-thb-text-secondary font-medium text-sm hover:bg-slate-200 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Stat Card ── */
function StatCard({ icon, label, value, iconBg, iconColor, accent, isText }: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  iconBg: string;
  iconColor: string;
  accent: string;
  isText?: boolean;
}) {
  return (
    <div className={`thb-card-hover p-4 border-l-4 ${accent} flex items-center gap-4`}>
      <div className={`w-11 h-11 rounded-xl ${iconBg} flex items-center justify-center ${iconColor} flex-shrink-0`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-thb-text-secondary truncate">{label}</p>
        <p className={`text-xl font-bold text-thb-text-primary ${isText ? 'text-lg' : ''}`}>
          {isText ? value : value}
        </p>
      </div>
    </div>
  );
}

/* ── Summary Row with Progress Bar ── */
function SummaryRow({ label, value, color, barBg, barFill, pct }: {
  label: string;
  value: string;
  color: string;
  barBg: string;
  barFill: string;
  pct: number;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-thb-text-secondary">{label}</span>
        <span className={`text-sm font-semibold ${color}`}>{value}</span>
      </div>
      <div className={`h-1.5 rounded-full ${barBg} overflow-hidden`}>
        <div
          className={`h-full rounded-full ${barFill} transition-all duration-500`}
          style={{ width: `${Math.max(2, pct)}%` }}
        />
      </div>
    </div>
  );
}

/* ── Detail Field ── */
function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-2.5 rounded-lg bg-slate-50">
      <p className="text-xs text-thb-text-muted mb-0.5">{label}</p>
      <p className="text-sm font-medium text-thb-text-primary">{value}</p>
    </div>
  );
}

/* ── Quick Link Card ── */
function QuickLink({ href, icon, label, sub, color }: {
  href: string; icon: React.ReactNode; label: string; sub: string; color: string;
}) {
  const colorMap: Record<string, string> = {
    violet: 'border-teal-200 hover:border-teal-300 hover:bg-teal-50 text-teal-600',
    emerald: 'border-emerald-200 hover:border-emerald-300 hover:bg-emerald-50 text-emerald-600',
    amber: 'border-amber-200 hover:border-amber-300 hover:bg-amber-50 text-amber-600',
    blue: 'border-green-200 hover:border-green-300 hover:bg-green-50 text-green-600',
    cyan: 'border-cyan-200 hover:border-cyan-300 hover:bg-cyan-50 text-cyan-600',
    rose: 'border-rose-200 hover:border-rose-300 hover:bg-rose-50 text-rose-600',
  };
  return (
    <Link
      href={href}
      className={`flex flex-col gap-1 p-3 rounded-xl border ${colorMap[color] || colorMap.violet} transition-colors group`}
    >
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-sm font-medium text-thb-text-primary">{label}</span>
      </div>
      <span className="text-[10px] text-thb-text-muted">{sub}</span>
    </Link>
  );
}

/* ── Small Quick Link ── */
function QuickLinkSmall({ href, icon, label, color }: {
  href: string; icon: React.ReactNode; label: string; color: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-slate-50 transition-colors group"
    >
      <span className={color}>{icon}</span>
      <span className="text-sm text-thb-text-secondary group-hover:text-thb-text-primary transition-colors">{label}</span>
    </Link>
  );
}
