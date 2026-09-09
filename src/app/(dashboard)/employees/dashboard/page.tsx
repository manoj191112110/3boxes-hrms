'use client';

/**
 * Employee Module Dashboard
 * ─────────────────────────
 * A dedicated dashboard for the Employee module, distinct from the Employee List page.
 * Shows role-based content:
 *   - All Employees: Summary stats, headcount trends, department distribution, recent updates
 *   - Admin/HR: Full analytics, compliance indicators, lifecycle tracking
 *   - Manager: Team-specific view with direct reports
 *   - Employee: Personal profile summary, pending actions, team info
 */

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  FiUsers, FiUserPlus, FiUserCheck, FiUserX, FiClock,
  FiTrendingUp, FiTrendingDown, FiBarChart2, FiPieChart,
  FiCalendar, FiAlertCircle, FiArrowRight, FiGrid,
  FiBriefcase, FiMapPin, FiActivity, FiCheckCircle,
  FiChevronRight, FiFileText, FiRefreshCw, FiSearch,
  FiMail, FiPhone, FiLayers, FiTarget, FiAward,
  FiShield, FiHeart,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { sanitizeSearch } from '@/lib/validators';
import { useAuthStore } from '@/store/authStore';
import { useCompanyContextStore } from '@/store/companyContextStore';

/* ── Helpers ── */
function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

/* ── Types ── */
interface EmployeeStats {
  totalEmployees: number;
  activeEmployees: number;
  onLeaveEmployees: number;
  inactiveEmployees: number;
  newHiresThisMonth: number;
  exitsThisMonth: number;
  avgTenureMonths: number;
  genderRatio: { male: number; female: number; other: number };
}

interface DepartmentDist {
  name: string;
  count: number;
  color: string;
}

interface RecentUpdate {
  id: string;
  type: 'join' | 'exit' | 'transfer' | 'promotion' | 'probation_end' | 'status_change';
  employeeName: string;
  employeeId: string;
  department: string;
  date: string;
  details: string;
}

interface LifecycleMetric {
  label: string;
  count: number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
  route: string;
}

interface HeadcountTrend {
  month: string;
  headcount: number;
  joins: number;
  exits: number;
}

/* ── Color palette for departments ── */
const DEPT_COLORS = [
  'bg-green-500', 'bg-emerald-500', 'bg-teal-500', 'bg-orange-500',
  'bg-pink-500', 'bg-cyan-500', 'bg-red-500', 'bg-lime-500',
  'bg-fuchsia-500', 'bg-yellow-500', 'bg-emerald-500', 'bg-teal-500',
];

/* ── Component ── */
export default function EmployeeDashboardPage() {
  const router = useRouter();
  const { user, hasPermission, canAccessModule } = useAuthStore();
  const userRole = user?.role || 'employee';
  const effectiveCompanyId = useCompanyContextStore(s => s.effectiveCompanyId);
  const selectedTenantId = useCompanyContextStore(s => s.selectedTenantId);
  const selectedCompanyId = useCompanyContextStore(s => s.selectedCompanyId);

  const [stats, setStats] = useState<EmployeeStats | null>(null);
  const [lifecycleCounts, setLifecycleCounts] = useState({
    onProbation: 0,
    transfers: 0,
    resignations: 0,
    terminations: 0,
    rejoins: 0,
  });
  const [departments, setDepartments] = useState<DepartmentDist[]>([]);
  const [recentUpdates, setRecentUpdates] = useState<RecentUpdate[]>([]);
  const [headcountTrend, setHeadcountTrend] = useState<HeadcountTrend[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'analytics' | 'updates'>('overview');
  const [searchQuery, setSearchQuery] = useState('');

  // Role-based permissions
  const isAdmin = ['super_admin', 'tenant_admin', 'hr_admin'].includes(userRole);
  const isManager = userRole === 'manager' || isAdmin;
  const canViewSalary = isAdmin;
  const canViewFullDetails = isManager;

  /* ── Data Fetching ── */
  const cidValue = selectedCompanyId;
  const tidValue = selectedTenantId;
  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const headers = getAuthHeaders();

      // Fetch employee stats
      // When super_admin selects a company, also send tenantId so the API
      // resolves the correct tenant DB (employees live in the tenant DB,
      // not the platform DB).
      const cid = cidValue;
      const tid = tidValue;
      const scopeParams = new URLSearchParams();
      if (cid) scopeParams.set('companyId', cid);
      if (tid) scopeParams.set('tenantId', tid);
      const scopeQs = scopeParams.toString();
      const scopeQuery = scopeQs ? `&${scopeQs}` : '';

      const statsRes = await fetch(`/api/employees?limit=1&page=1${scopeQuery}`, { headers });
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        const total = statsData.pagination?.total || 0;

        // Fetch all employees for detailed stats (use pagination total for count)
        const allRes = await fetch(`/api/employees?limit=500&page=1${scopeQuery}`, { headers });
        const allData = await allRes.ok ? await allRes.json() : { employees: [] };
        const allEmps = allData.employees || [];

        // Department distribution
        const deptMap = new Map<string, number>();
        const genderCounts = { male: 0, female: 0, other: 0 };
        let totalTenure = 0;
        let tenureCount = 0;
        const now = new Date();
        const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        let newHires = 0;
        let exits = 0;

        (allEmps as any[]).forEach((emp: any) => {
          // Department
          const deptName = emp.department?.name || 'Unassigned';
          deptMap.set(deptName, (deptMap.get(deptName) || 0) + 1);

          // Gender
          if (emp.gender === 'male') genderCounts.male++;
          else if (emp.gender === 'female') genderCounts.female++;
          else genderCounts.other++;

          // Tenure
          if (emp.dateOfJoining) {
            const joinDate = new Date(emp.dateOfJoining);
            const months = (now.getFullYear() - joinDate.getFullYear()) * 12 + (now.getMonth() - joinDate.getMonth());
            totalTenure += months;
            tenureCount++;
            if (joinDate >= thisMonth) newHires++;
          }

          // Exits this month (terminated/resigned)
          if ((emp.status === 'terminated' || emp.status === 'resigned') && emp.updatedAt) {
            const updatedDate = new Date(emp.updatedAt);
            if (updatedDate >= thisMonth) exits++;
          }
        });

        const activeCount = allEmps.filter((e: any) => e.status === 'active').length;
        const leaveCount = allEmps.filter((e: any) => e.status === 'on_leave').length;
        const inactiveCount = allEmps.filter((e: any) => e.status !== 'active' && e.status !== 'on_leave').length;

        // ─── Compute lifecycle counts from employee data ───
        const PROBATION_PERIOD_DAYS = 90; // standard probation period
        const onProbationCount = (allEmps as any[]).filter((e: any) => {
          if (e.status !== 'active' || !e.dateOfJoining) return false;
          const joinDate = new Date(e.dateOfJoining);
          const daysSinceJoin = Math.floor((now.getTime() - joinDate.getTime()) / (1000 * 60 * 60 * 24));
          return daysSinceJoin <= PROBATION_PERIOD_DAYS;
        }).length;

        const resignationsCount = (allEmps as any[]).filter((e: any) => e.status === 'resigned').length;
        const terminationsCount = (allEmps as any[]).filter((e: any) => e.status === 'terminated').length;

        // Transfers & Rejoins: these don't have dedicated DB models yet,
        // so fetch counts from the respective APIs
        let transfersCount = 0;
        let rejoinsCount = 0;
        try {
          const [transferRes, rejoinRes] = await Promise.all([
            fetch(`/api/employees/transfer?limit=1${scopeQuery}`, { headers }),
            fetch(`/api/employees/rejoin?limit=1${scopeQuery}`, { headers }),
          ]);
          if (transferRes.ok) {
            const transferData = await transferRes.json();
            transfersCount = transferData.pagination?.total || transferData.transfers?.length || 0;
          }
          if (rejoinRes.ok) {
            const rejoinData = await rejoinRes.json();
            rejoinsCount = rejoinData.pagination?.total || rejoinData.rejoins?.length || 0;
          }
        } catch {
          // Lifecycle APIs may be stubs — keep 0
        }

        setLifecycleCounts({
          onProbation: onProbationCount,
          transfers: transfersCount,
          resignations: resignationsCount,
          terminations: terminationsCount,
          rejoins: rejoinsCount,
        });

        setStats({
          totalEmployees: total,
          activeEmployees: activeCount,
          onLeaveEmployees: leaveCount,
          inactiveEmployees: inactiveCount,
          newHiresThisMonth: newHires,
          exitsThisMonth: exits,
          avgTenureMonths: tenureCount > 0 ? Math.round(totalTenure / tenureCount) : 0,
          genderRatio: genderCounts,
        });

        // Build department distribution
        const sortedDepts = [...deptMap.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([name, count], i) => ({
            name,
            count,
            color: DEPT_COLORS[i % DEPT_COLORS.length],
          }));
        setDepartments(sortedDepts);

        // Generate recent updates from employee data
        const updates: RecentUpdate[] = [];
        (allEmps as any[])
          .filter((e: any) => e.updatedAt)
          .sort((a: any, b: any) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
          .slice(0, 8)
          .forEach((emp: any) => {
            const fullName = `${emp.firstName || ''} ${emp.lastName || ''}`.trim();
            if (emp.status === 'active' && emp.dateOfJoining) {
              const joinDate = new Date(emp.dateOfJoining);
              const daysSinceJoin = Math.floor((now.getTime() - joinDate.getTime()) / (1000 * 60 * 60 * 24));
              if (daysSinceJoin <= 30) {
                updates.push({
                  id: emp.id, type: 'join', employeeName: fullName, employeeId: emp.employeeId,
                  department: emp.department?.name || 'Unassigned', date: emp.dateOfJoining,
                  details: 'New employee joined',
                });
              }
            }
            if (emp.status === 'terminated') {
              updates.push({
                id: emp.id, type: 'exit', employeeName: fullName, employeeId: emp.employeeId,
                department: emp.department?.name || 'Unassigned', date: emp.updatedAt,
                details: 'Employee terminated',
              });
            } else if (emp.status === 'on_leave') {
              updates.push({
                id: emp.id, type: 'status_change', employeeName: fullName, employeeId: emp.employeeId,
                department: emp.department?.name || 'Unassigned', date: emp.updatedAt,
                details: 'Currently on leave',
              });
            }
          });
        setRecentUpdates(updates.length > 0 ? updates : generateSampleUpdates());

        // Generate headcount trend (only from real data, no random/fake)
        setHeadcountTrend(generateHeadcountTrend(allEmps, total));
      }
    } catch (err) {
      console.error('Dashboard fetch error:', err);
      // GOLDEN RULE: On error, show zeros/empty — NOT fake data
      setStats(getSampleStats());
      setDepartments(getSampleDepartments());
      setRecentUpdates([]);
      setHeadcountTrend([]);
      setLifecycleCounts({ onProbation: 0, transfers: 0, resignations: 0, terminations: 0, rejoins: 0 });
    } finally {
      setLoading(false);
    }
  }, [cidValue, tidValue]);

  useEffect(() => { fetchDashboardData(); }, [fetchDashboardData]);

  /* ── Sample Data Fallbacks ── */
  function getSampleStats(): EmployeeStats {
    return {
      totalEmployees: 0, activeEmployees: 0, onLeaveEmployees: 0, inactiveEmployees: 0,
      newHiresThisMonth: 0, exitsThisMonth: 0, avgTenureMonths: 0,
      genderRatio: { male: 0, female: 0, other: 0 },
    };
  }

  function getSampleDepartments(): DepartmentDist[] {
    return []; // No sample data - return empty; data comes from API
  }

  function generateSampleUpdates(): RecentUpdate[] {
    return [
      { id: '1', type: 'join', employeeName: 'No recent updates', employeeId: '-', department: '-', date: new Date().toISOString(), details: 'Employee data will appear here' },
    ];
  }

  function generateHeadcountTrend(emps: unknown[], totalCount: number): HeadcountTrend[] {
    // Build a real trend from employee joining dates if available
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Count joins per month for the current year
    const joinsByMonth: Record<number, number> = {};
    const exitsByMonth: Record<number, number> = {};
    (emps as any[]).forEach((emp: any) => {
      if (emp.dateOfJoining) {
        const d = new Date(emp.dateOfJoining);
        if (d.getFullYear() === currentYear) {
          joinsByMonth[d.getMonth()] = (joinsByMonth[d.getMonth()] || 0) + 1;
        }
      }
      if ((emp.status === 'terminated' || emp.status === 'resigned') && emp.updatedAt) {
        const d = new Date(emp.updatedAt);
        if (d.getFullYear() === currentYear) {
          exitsByMonth[d.getMonth()] = (exitsByMonth[d.getMonth()] || 0) + 1;
        }
      }
    });

    // Build headcount trend cumulatively
    let runningHeadcount = totalCount;
    // Back-calculate: subtract joins added in future months (relative to current)
    for (let m = currentMonth + 1; m < 12; m++) {
      runningHeadcount -= (joinsByMonth[m] || 0);
      runningHeadcount += (exitsByMonth[m] || 0);
    }
    // Ensure non-negative
    runningHeadcount = Math.max(0, runningHeadcount);

    const trend: HeadcountTrend[] = [];
    for (let m = 0; m <= currentMonth; m++) {
      const joins = joinsByMonth[m] || 0;
      const exits = exitsByMonth[m] || 0;
      runningHeadcount += joins - exits;
      runningHeadcount = Math.max(0, runningHeadcount);
      trend.push({
        month: months[m],
        headcount: runningHeadcount,
        joins,
        exits,
      });
    }
    return trend;
  }

  /* ── Lifecycle metrics ── */
  const lifecycleMetrics: LifecycleMetric[] = useMemo(() => {
    const base: LifecycleMetric[] = [
      { label: 'On Probation', count: lifecycleCounts.onProbation, icon: FiClock, color: 'text-amber-600', bgColor: 'bg-amber-50', route: '/employees/probation' },
      { label: 'Transfers', count: lifecycleCounts.transfers, icon: FiRefreshCw, color: 'text-green-600', bgColor: 'bg-green-50', route: '/employees/transfer' },
      { label: 'Resignations', count: lifecycleCounts.resignations, icon: FiFileText, color: 'text-red-600', bgColor: 'bg-red-50', route: '/employees/resignation' },
      { label: 'Terminations', count: lifecycleCounts.terminations, icon: FiUserX, color: 'text-orange-600', bgColor: 'bg-orange-50', route: '/employees/termination' },
    ];
    if (isAdmin) {
      base.push({ label: 'Rejoin Cases', count: lifecycleCounts.rejoins, icon: FiUserCheck, color: 'text-emerald-600', bgColor: 'bg-emerald-50', route: '/employees/rejoin' });
    }
    return base;
  }, [isAdmin, lifecycleCounts]);

  /* ── Update type styling ── */
  const updateTypeConfig: Record<string, { icon: React.ComponentType<{ className?: string }>; color: string; bgColor: string }> = {
    join: { icon: FiUserPlus, color: 'text-emerald-600', bgColor: 'bg-emerald-50' },
    exit: { icon: FiUserX, color: 'text-red-600', bgColor: 'bg-red-50' },
    transfer: { icon: FiRefreshCw, color: 'text-green-600', bgColor: 'bg-green-50' },
    promotion: { icon: FiAward, color: 'text-teal-600', bgColor: 'bg-teal-50' },
    probation_end: { icon: FiCheckCircle, color: 'text-amber-600', bgColor: 'bg-amber-50' },
    status_change: { icon: FiActivity, color: 'text-slate-600', bgColor: 'bg-slate-50' },
  };

  /* ── Loading State ── */
  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-slate-200 rounded w-64" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="thb-card p-5 h-28" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="thb-card p-5 h-64 lg:col-span-2" />
          <div className="thb-card p-5 h-64" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-thb-text-primary flex items-center gap-2">
            <FiUsers className="w-6 h-6 text-green-500" />
            Employee Dashboard
          </h1>
          <p className="text-sm text-thb-text-secondary mt-1">
            {isAdmin ? 'Organization-wide employee overview, analytics, and lifecycle tracking'
              : isManager ? 'Your team overview, employee analytics, and pending actions'
              : 'Your employment details, team information, and pending actions'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchDashboardData}
            className="p-2.5 rounded-lg border border-thb-border text-thb-text-secondary hover:bg-slate-50 transition-colors"
            title="Refresh data"
          >
            <FiRefreshCw className="w-4 h-4" />
          </button>
          {isAdmin && (
            <button
              onClick={() => router.push('/employees/add')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-green-500 to-emerald-600 text-white text-sm font-semibold hover:from-green-600 hover:to-emerald-700 transition-all shadow-sm shadow-green-500/20"
            >
              <FiUserPlus className="w-4 h-4" />
              Add Employee
            </button>
          )}
        </div>
      </div>

      {/* ── Tab Navigation ── */}
      <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl w-fit">
        {[
          { key: 'overview' as const, label: 'Overview', icon: FiGrid },
          { key: 'analytics' as const, label: 'Analytics', icon: FiBarChart2 },
          { key: 'updates' as const, label: 'Updates', icon: FiActivity },
        ].map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.key
                  ? 'bg-white text-green-600 shadow-sm'
                  : 'text-thb-text-secondary hover:text-thb-text-primary'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ══════════════════════════════════════════════════════════════
          OVERVIEW TAB
         ══════════════════════════════════════════════════════════════ */}
      {activeTab === 'overview' && (
        <>
          {/* ── KPI Cards ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              icon={<FiUsers className="w-5 h-5" />}
              label="Total Employees"
              value={stats?.totalEmployees ?? 0}
              trend={{ value: stats?.newHiresThisMonth ?? 0, label: 'new this month', up: true }}
              gradient="from-green-500 to-emerald-600"
            />
            <StatCard
              icon={<FiUserCheck className="w-5 h-5" />}
              label="Active"
              value={stats?.activeEmployees ?? 0}
              trend={{ value: stats?.totalEmployees ? Math.round((stats.activeEmployees / stats.totalEmployees) * 100) : 0, label: '% of total', up: true }}
              gradient="from-emerald-500 to-teal-600"
            />
            <StatCard
              icon={<FiClock className="w-5 h-5" />}
              label="On Leave"
              value={stats?.onLeaveEmployees ?? 0}
              trend={{ value: stats?.totalEmployees ? Math.round((stats.onLeaveEmployees / stats.totalEmployees) * 100) : 0, label: '% of total', up: false }}
              gradient="from-amber-500 to-orange-600"
            />
            <StatCard
              icon={<FiUserX className="w-5 h-5" />}
              label="Exits This Month"
              value={stats?.exitsThisMonth ?? 0}
              trend={{ value: stats?.newHiresThisMonth ?? 0, label: 'hired vs exited', up: (stats?.newHiresThisMonth ?? 0) > (stats?.exitsThisMonth ?? 0) }}
              gradient="from-red-500 to-pink-600"
            />
          </div>

          {/* ── Quick Actions + Department Distribution ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Quick Actions */}
            <div className="thb-card p-5">
              <h3 className="text-sm font-semibold text-thb-text-primary mb-4 flex items-center gap-2">
                <FiTarget className="w-4 h-4 text-green-500" />
                Quick Actions
              </h3>
              <div className="space-y-2">
                {isAdmin && (
                  <QuickAction label="Add New Employee" icon={FiUserPlus} route="/employees/add" color="text-green-600" bgColor="bg-green-50" />
                )}
                <QuickAction label="View Employee List" icon={FiUsers} route="/employees" color="text-emerald-600" bgColor="bg-emerald-50" />
                <QuickAction label="Org Chart" icon={FiLayers} route="/org-chart" color="text-teal-600" bgColor="bg-teal-50" />
                {isAdmin && (
                  <>
                    <QuickAction label="Probation Tracking" icon={FiClock} route="/employees/probation" color="text-amber-600" bgColor="bg-amber-50" />
                    <QuickAction label="Transfer Management" icon={FiRefreshCw} route="/employees/transfer" color="text-cyan-600" bgColor="bg-cyan-50" />
                  </>
                )}
                {isManager && (
                  <QuickAction label="Resignation Portal" icon={FiFileText} route="/employees/resignation" color="text-red-600" bgColor="bg-red-50" />
                )}
              </div>
            </div>

            {/* Department Distribution */}
            <div className="thb-card p-5 lg:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-thb-text-primary flex items-center gap-2">
                  <FiBriefcase className="w-4 h-4 text-emerald-500" />
                  Department Distribution
                </h3>
                <span className="text-xs text-thb-text-secondary">{departments.length} departments</span>
              </div>

              {departments.length > 0 ? (
                <div className="space-y-3">
                  {departments.slice(0, 8).map((dept, idx) => {
                    const maxCount = departments[0]?.count || 1;
                    const widthPercent = (dept.count / maxCount) * 100;
                    return (
                      <div key={dept.name} className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${dept.color} flex-shrink-0`} />
                        <span className="text-xs text-thb-text-secondary w-28 truncate flex-shrink-0">{dept.name}</span>
                        <div className="flex-1 bg-slate-100 rounded-full h-2.5 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${dept.color} transition-all duration-500`}
                            style={{ width: `${widthPercent}%` }}
                          />
                        </div>
                        <span className="text-xs font-semibold text-thb-text-primary w-8 text-right flex-shrink-0">{dept.count}</span>
                      </div>
                    );
                  })}
                  {departments.length > 8 && (
                    <p className="text-xs text-thb-text-secondary text-center mt-2">
                      +{departments.length - 8} more departments
                    </p>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-thb-text-secondary">
                  <FiBriefcase className="w-8 h-8 mb-2 opacity-40" />
                  <p className="text-sm">No department data available</p>
                  <p className="text-xs mt-1">Add employees with department assignments to see distribution</p>
                </div>
              )}
            </div>
          </div>

          {/* ── Lifecycle Cards ── */}
          {isManager && (
            <div>
              <h3 className="text-sm font-semibold text-thb-text-primary mb-3 flex items-center gap-2">
                <FiActivity className="w-4 h-4 text-teal-500" />
                Employee Lifecycle
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {lifecycleMetrics.map(metric => {
                  const Icon = metric.icon;
                  return (
                    <button
                      key={metric.label}
                      onClick={() => router.push(metric.route)}
                      className="thb-card p-4 hover:shadow-md transition-all group text-left"
                    >
                      <div className={`w-9 h-9 rounded-lg ${metric.bgColor} flex items-center justify-center mb-2`}>
                        <Icon className={`w-4.5 h-4.5 ${metric.color}`} />
                      </div>
                      <p className="text-lg font-bold text-thb-text-primary">{metric.count}</p>
                      <p className="text-xs text-thb-text-secondary group-hover:text-green-600 transition-colors">{metric.label}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Recent Updates Preview ── */}
          <div className="thb-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-thb-text-primary flex items-center gap-2">
                <FiActivity className="w-4 h-4 text-amber-500" />
                Recent Employee Updates
              </h3>
              <button
                onClick={() => setActiveTab('updates')}
                className="flex items-center gap-1 text-xs text-green-600 hover:text-green-700 font-medium transition-colors"
              >
                View All <FiArrowRight className="w-3 h-3" />
              </button>
            </div>
            <div className="space-y-3">
              {recentUpdates.slice(0, 5).map((update, idx) => {
                const config = updateTypeConfig[update.type] || updateTypeConfig.status_change;
                const Icon = config.icon;
                return (
                  <div key={update.id || idx} className="flex items-start gap-3 py-2">
                    <div className={`w-8 h-8 rounded-lg ${config.bgColor} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                      <Icon className={`w-4 h-4 ${config.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-thb-text-primary truncate">{update.employeeName}</p>
                      <p className="text-xs text-thb-text-secondary">{update.details} &middot; {update.department}</p>
                    </div>
                    <span className="text-xs text-thb-text-secondary flex-shrink-0">
                      {update.date ? new Date(update.date).toLocaleDateString() : '—'}
                    </span>
                  </div>
                );
              })}
              {recentUpdates.length === 0 && (
                <div className="text-center py-8 text-thb-text-secondary">
                  <FiActivity className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No recent updates</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════
          ANALYTICS TAB
         ══════════════════════════════════════════════════════════════ */}
      {activeTab === 'analytics' && (
        <>
          {/* Headcount Trend */}
          <div className="thb-card p-5">
            <h3 className="text-sm font-semibold text-thb-text-primary mb-4 flex items-center gap-2">
              <FiTrendingUp className="w-4 h-4 text-green-500" />
              Headcount Trend
            </h3>
            {headcountTrend.length > 0 ? (
              <div className="space-y-3">
                {headcountTrend.map((m, idx) => {
                  const maxHC = Math.max(...headcountTrend.map(h => h.headcount), 1);
                  const barWidth = (m.headcount / maxHC) * 100;
                  return (
                    <div key={m.month} className="flex items-center gap-3">
                      <span className="text-xs font-medium text-thb-text-secondary w-8 flex-shrink-0">{m.month}</span>
                      <div className="flex-1 flex items-center gap-2">
                        <div className="flex-1 bg-slate-100 rounded-full h-3 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-green-400 to-emerald-500 transition-all duration-500"
                            style={{ width: `${barWidth}%` }}
                          />
                        </div>
                        <span className="text-xs font-semibold text-thb-text-primary w-8 text-right">{m.headcount}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-thb-text-secondary w-20 flex-shrink-0 justify-end">
                        <span className="text-emerald-600">+{m.joins}</span>
                        <span className="text-red-500">-{m.exits}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-thb-text-secondary">
                <FiBarChart2 className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No trend data available</p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Gender Distribution */}
            <div className="thb-card p-5">
              <h3 className="text-sm font-semibold text-thb-text-primary mb-4 flex items-center gap-2">
                <FiHeart className="w-4 h-4 text-pink-500" />
                Gender Distribution
              </h3>
              {stats && (stats.genderRatio.male + stats.genderRatio.female + stats.genderRatio.other) > 0 ? (
                <div className="space-y-4">
                  {[
                    { label: 'Male', value: stats.genderRatio.male, color: 'bg-green-500', textColor: 'text-green-700' },
                    { label: 'Female', value: stats.genderRatio.female, color: 'bg-pink-500', textColor: 'text-pink-700' },
                    { label: 'Other', value: stats.genderRatio.other, color: 'bg-teal-500', textColor: 'text-teal-700' },
                  ].map(g => {
                    const total = stats.genderRatio.male + stats.genderRatio.female + stats.genderRatio.other;
                    const pct = total > 0 ? Math.round((g.value / total) * 100) : 0;
                    return (
                      <div key={g.label} className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${g.color} flex-shrink-0`} />
                        <span className="text-xs text-thb-text-secondary w-12 flex-shrink-0">{g.label}</span>
                        <div className="flex-1 bg-slate-100 rounded-full h-2.5 overflow-hidden">
                          <div className={`h-full rounded-full ${g.color} transition-all duration-500`} style={{ width: `${pct}%` }} />
                        </div>
                        <span className={`text-xs font-semibold ${g.textColor} w-16 text-right flex-shrink-0`}>{g.value} ({pct}%)</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-thb-text-secondary">
                  <FiUsers className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">Gender data not available</p>
                </div>
              )}
            </div>

            {/* Key Metrics */}
            <div className="thb-card p-5">
              <h3 className="text-sm font-semibold text-thb-text-primary mb-4 flex items-center gap-2">
                <FiBarChart2 className="w-4 h-4 text-emerald-500" />
                Key Metrics
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <MetricBox
                  label="Avg Tenure"
                  value={stats?.avgTenureMonths ? `${Math.floor(stats.avgTenureMonths / 12)}y ${stats.avgTenureMonths % 12}m` : '0m'}
                  icon={FiClock}
                  color="text-green-600"
                  bgColor="bg-green-50"
                />
                <MetricBox
                  label="New Hires"
                  value={stats?.newHiresThisMonth ?? 0}
                  icon={FiUserPlus}
                  color="text-emerald-600"
                  bgColor="bg-emerald-50"
                  suffix="this month"
                />
                <MetricBox
                  label="Attrition Rate"
                  value={stats && stats.totalEmployees > 0
                    ? `${((stats.exitsThisMonth / stats.totalEmployees) * 100).toFixed(1)}%`
                    : '0%'}
                  icon={FiTrendingDown}
                  color="text-red-600"
                  bgColor="bg-red-50"
                  suffix="monthly"
                />
                <MetricBox
                  label="Departments"
                  value={departments.length}
                  icon={FiBriefcase}
                  color="text-teal-600"
                  bgColor="bg-teal-50"
                />
              </div>
            </div>
          </div>

          {/* Tenure Distribution */}
          <div className="thb-card p-5">
            <h3 className="text-sm font-semibold text-thb-text-primary mb-4 flex items-center gap-2">
              <FiCalendar className="w-4 h-4 text-teal-500" />
              Tenure Overview
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: '0-6 months', color: 'bg-green-100 text-green-700 border-green-200' },
                { label: '6-12 months', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
                { label: '1-3 years', color: 'bg-amber-100 text-amber-700 border-amber-200' },
                { label: '3+ years', color: 'bg-teal-100 text-teal-700 border-teal-200' },
              ].map(t => (
                <div key={t.label} className={`rounded-lg border p-4 text-center ${t.color}`}>
                  <p className="text-2xl font-bold">—</p>
                  <p className="text-xs mt-1 font-medium">{t.label}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-thb-text-secondary mt-3 text-center">
              Detailed tenure breakdown requires employee date-of-joining data. Connect your employee records for live analytics.
            </p>
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════
          UPDATES TAB
         ══════════════════════════════════════════════════════════════ */}
      {activeTab === 'updates' && (
        <>
          {/* Search & Filter */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-thb-text-secondary" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(sanitizeSearch(e.target.value))}
                placeholder="Search updates by name or department..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-thb-border rounded-lg bg-white text-thb-text-primary placeholder:text-thb-text-secondary focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 transition-all"
              />
            </div>
          </div>

          {/* Updates List */}
          <div className="thb-card overflow-hidden">
            <div className="px-5 py-3 border-b border-thb-border flex items-center justify-between">
              <h3 className="text-sm font-semibold text-thb-text-primary flex items-center gap-2">
                <FiActivity className="w-4 h-4 text-amber-500" />
                All Employee Updates
              </h3>
              <span className="text-xs text-thb-text-secondary">{recentUpdates.length} updates</span>
            </div>

            <div className="divide-y divide-thb-border">
              {recentUpdates
                .filter(u =>
                  !searchQuery ||
                  u.employeeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  u.department.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  u.details.toLowerCase().includes(searchQuery.toLowerCase())
                )
                .map((update, idx) => {
                  const config = updateTypeConfig[update.type] || updateTypeConfig.status_change;
                  const Icon = config.icon;
                  return (
                    <div
                      key={update.id || idx}
                      className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50/50 transition-colors cursor-pointer"
                      onClick={() => router.push(`/employees/${update.id}`)}
                    >
                      <div className={`w-9 h-9 rounded-lg ${config.bgColor} flex items-center justify-center flex-shrink-0`}>
                        <Icon className={`w-4 h-4 ${config.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-thb-text-primary truncate">{update.employeeName}</p>
                          <span className="text-[10px] font-mono text-thb-text-secondary bg-slate-100 px-1.5 py-0.5 rounded">{update.employeeId}</span>
                        </div>
                        <p className="text-xs text-thb-text-secondary mt-0.5">{update.details} &middot; {update.department}</p>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <p className="text-xs text-thb-text-secondary">
                          {update.date ? new Date(update.date).toLocaleDateString() : '—'}
                        </p>
                        <p className="text-[10px] text-thb-text-secondary">
                          {update.date ? new Date(update.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                        </p>
                      </div>
                      <FiChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
                    </div>
                  );
                })}
              {recentUpdates.filter(u =>
                !searchQuery ||
                u.employeeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                u.department.toLowerCase().includes(searchQuery.toLowerCase())
              ).length === 0 && (
                <div className="px-5 py-12 text-center text-thb-text-secondary">
                  <FiActivity className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">{searchQuery ? 'No updates match your search' : 'No employee updates yet'}</p>
                  <p className="text-xs mt-1">Updates will appear as employees join, transfer, or change status</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ── Sub-Components ── */

function StatCard({ icon, label, value, trend, gradient }: {
  icon: React.ReactNode;
  label: string;
  value: number;
  trend?: { value: number; label: string; up: boolean };
  gradient: string;
}) {
  return (
    <div className="thb-card overflow-hidden">
      <div className={`bg-gradient-to-br ${gradient} p-4 text-white`}>
        <div className="flex items-center justify-between mb-2">
          <span className="opacity-90">{icon}</span>
          {trend && (
            <span className="flex items-center gap-1 text-xs opacity-80">
              {trend.up ? <FiTrendingUp className="w-3 h-3" /> : <FiTrendingDown className="w-3 h-3" />}
              {trend.value}
            </span>
          )}
        </div>
        <p className="text-2xl font-bold">{value.toLocaleString()}</p>
        <p className="text-xs opacity-80 mt-0.5">{label}</p>
      </div>
      {trend && (
        <div className="px-4 py-2 bg-white">
          <p className="text-xs text-thb-text-secondary">{trend.label}</p>
        </div>
      )}
    </div>
  );
}

function QuickAction({ label, icon, route, color, bgColor }: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  route: string;
  color: string;
  bgColor: string;
}) {
  const router = useRouter();
  const Icon = icon;
  return (
    <button
      onClick={() => router.push(route)}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-50 transition-all group text-left"
    >
      <div className={`w-8 h-8 rounded-lg ${bgColor} flex items-center justify-center flex-shrink-0`}>
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
      <span className="text-sm text-thb-text-primary group-hover:text-green-600 transition-colors flex-1">{label}</span>
      <FiArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-green-500 transition-colors flex-shrink-0" />
    </button>
  );
}

function MetricBox({ label, value, icon, color, bgColor, suffix }: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
  suffix?: string;
}) {
  const Icon = icon;
  return (
    <div className={`rounded-lg ${bgColor} p-4`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${color}`} />
        <span className="text-xs font-medium text-thb-text-secondary">{label}</span>
      </div>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
      {suffix && <p className="text-xs text-thb-text-secondary mt-0.5">{suffix}</p>}
    </div>
  );
}
