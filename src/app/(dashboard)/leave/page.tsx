'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import {
  FiCalendar, FiPlus, FiCheck, FiX, FiClock,
  FiMessageSquare, FiAlertCircle, FiGrid, FiFileText, FiEye,
  FiShield, FiSearch, FiUserCheck, FiUserX, FiUserPlus,
  FiChevronRight, FiEdit2, FiTrash2, FiDownload,
  FiUser, FiRefreshCw, FiFilter, FiDatabase,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { sanitizeSearch } from '@/lib/validators';
import { useAuthStore } from '@/store/authStore';
import { useCompanyContextStore } from '@/store/companyContextStore';
import { isClientDemoMode } from '@/lib/site-mode';

/* ── Types ── */
interface LeaveRequest {
  id: string;
  startDate: string;
  endDate: string;
  reason?: string | null;
  status: string;
  halfDay: boolean;
  comments?: string | null;
  employee?: { id: string; firstName: string; lastName: string; employeeId: string; avatar?: string | null; department?: { name: string } | null };
  leaveType?: { id: string; name: string; code: string };
  employeeId: string;
  leaveTypeId: string;
}

interface LeaveBalance {
  id: string;
  total: number;
  used: number;
  remaining: number;
  year: number;
  leaveType: { id: string; name: string; code: string };
}

interface LeaveType {
  id: string;
  name: string;
  code: string;
  defaultDays: number;
  isPaid: boolean;
}

interface Employee {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  leaveBalances?: LeaveBalance[];
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

function getStatusBadge(status: string) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    pending: { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', label: 'Pending' },
    approved: { bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700', label: 'Approved' },
    rejected: { bg: 'bg-red-50 border-red-200', text: 'text-red-700', label: 'Rejected' },
    cancelled: { bg: 'bg-slate-50 border-slate-200', text: 'text-slate-600', label: 'Cancelled' },
  };
  return map[status] || { bg: 'bg-green-50 border-green-200', text: 'text-green-700', label: status };
}

function getDaysBetween(start: string, end: string) {
  const s = new Date(start);
  const e = new Date(end);
  return Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

function getAvatarGradient(name: string) {
  const colors = [
    'from-green-500 to-cyan-500', 'from-teal-500 to-teal-500',
    'from-emerald-500 to-teal-500', 'from-orange-500 to-amber-500',
    'from-pink-500 to-rose-500', 'from-emerald-500 to-green-500',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

const initialForm = {
  leaveTypeId: '',
  startDate: '',
  endDate: '',
  reason: '',
  halfDay: false,
  halfDaySlot: 'first_half' as 'first_half' | 'second_half',
};

/* ── Component ── */
function LeavePageContent() {
  const router = useRouter();
  const { user } = useAuthStore();
  const isAdmin = ['super_admin', 'tenant_admin', 'admin', 'hr_admin'].includes(user?.role || '');
  const scopeQuery = useCompanyContextStore(s => s.scopeQuery);
  const selectedTenantId = useCompanyContextStore(s => s.selectedTenantId);

  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [leaveBalances, setLeaveBalances] = useState<LeaveBalance[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const handleSeedData = async () => {
    try {
      setSeeding(true);
      const res = await fetch('/api/admin/seed-demo-data', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ module: 'leave' }),
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      toast.success(data.message || 'Leave demo data seeded');
      fetchData();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to seed');
    } finally {
      setSeeding(false);
    }
  };

  const [actionRowId, setActionRowId] = useState<string | null>(null);
  const [actionType, setActionType] = useState<'approved' | 'rejected' | null>(null);
  const [actionComment, setActionComment] = useState('');
  const [actioning, setActioning] = useState(false);

  // View Leave Application (detail modal + approval history)
  const [viewTarget, setViewTarget] = useState<LeaveRequest | null>(null);
  const [viewSteps, setViewSteps] = useState<Array<{ id: string; tier: number; tierLabel: string; approverTypeLabel?: string; action: string; actionByName?: string | null; actionByEmail?: string | null; comments?: string | null; actionAt?: string | null; createdAt?: string | null }>>([]);
  const [viewLoading, setViewLoading] = useState(false);

  const handleView = async (lr: LeaveRequest) => {
    setViewTarget(lr);
    setViewSteps([]);
    setViewLoading(true);
    try {
      const res = await fetch(`/api/leave/${lr.id}/approval-history`, { headers: getAuthHeaders() });
      if (res.ok) {
        const d = await res.json();
        setViewSteps(d.steps || []);
      }
    } catch { /* modal still shows the application details */ }
    finally { setViewLoading(false); }
  };

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterLeaveType, setFilterLeaveType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [dateRange, setDateRange] = useState({ from: '', to: '' });

  // Holidays overlay (REQ-LVE-03)
  const [holidays, setHolidays] = useState<Array<{ id: string; name: string; date: string; type: string }>>([]);
  // AI collaborative check (REQ-LVE-04)
  const [aiWarning, setAiWarning] = useState<string | null>(null);
  const [aiWarningLoading, setAiWarningLoading] = useState(false);

  /* Fetch data */
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const headers = getAuthHeaders();
      const sq = scopeQuery();
      const leaveRes = await fetch(`/api/leave?limit=100${sq ? `&${sq}` : ''}`, { headers });
      if (leaveRes.ok) {
        const data = await leaveRes.json();
        setLeaveRequests(data.leaveRequests || []);
      }
      const empRes = await fetch(`/api/employees?limit=500${sq ? `&${sq}` : ''}`, { headers });
      if (empRes.ok) {
        const empData = await empRes.json();
        const myEmp = empData.employees?.find((e: { email: string }) => e.email === user?.email);
        if (myEmp) {
          setEmployee(myEmp);
          const detailRes = await fetch(`/api/employees/${myEmp.id}`, { headers });
          if (detailRes.ok) {
            const detailData = await detailRes.json();
            setLeaveBalances(detailData.employee?.leaveBalances || []);
          }
        }
        const ltMap = new Map<string, LeaveType>();
        (empData.employees || []).forEach((e: Employee) => {
          e.leaveBalances?.forEach((lb: LeaveBalance) => {
            ltMap.set(lb.leaveType.id, { ...lb.leaveType, defaultDays: 0, isPaid: true });
          });
        });
        if (ltMap.size === 0) {
          // Fetch REAL leave types from /api/leave-types on BOTH demo and live.
          // (2026-09-09 FIX: this block used to inject hardcoded FAKE ids
          // ('lt_cl', 'lt_sl', ...) on the demo site. Submitting with a fake id
          // violated LeaveRequest.leaveTypeId_fkey → "Internal server error" on
          // every employee self-service apply. Never send ids that are not real
          // LeaveType rows.)
          try {
            const ltRes = await fetch(`/api/leave-types?limit=50${sq ? `&${sq}` : ''}`, { headers });
            if (ltRes.ok) {
              const ltData = await ltRes.json();
              const realTypes = (ltData.leaveTypes || ltData.data || []).map((lt: any) => ({
                id: lt.id,
                name: lt.name,
                code: lt.code,
                defaultDays: lt.defaultDays || 0,
                isPaid: lt.isPaid ?? true,
              }));
              setLeaveTypes(realTypes);
            } else {
              setLeaveTypes([]);
            }
          } catch {
            setLeaveTypes([]);
          }
        } else {
          setLeaveTypes(Array.from(ltMap.values()));
        }
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load leave data');
    } finally {
      setLoading(false);
    }
  }, [user?.email, scopeQuery, selectedTenantId]);

  useEffect(() => { queueMicrotask(() => fetchData()); }, [fetchData]);

  /* Holiday overlay */
  useEffect(() => {
    if (showForm) {
      const sq = scopeQuery();
      fetch(`/api/holidays${sq ? `?${sq}` : ''}`, { headers: getAuthHeaders() })
        .then(r => r.json())
        .then(d => {
          const list = Array.isArray(d) ? d : (d.holidays || d.data || []);
          setHolidays(list.map((h: { id: string; name: string; date: string; type: string }) => ({ id: h.id, name: h.name, date: h.date, type: h.type })));
        })
        .catch(() => { /* non-fatal */ });
    }
  }, [showForm, scopeQuery, selectedTenantId]);

  /* AI collaborative check */
  useEffect(() => {
    if (!employee?.id || !form.startDate || !form.endDate) {
      setAiWarning(null);
      return;
    }
    setAiWarningLoading(true);
    const ctrl = new AbortController();
    const sq = scopeQuery();
    fetch(`/api/leave/collaborative-check${sq ? `?${sq}` : ''}`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ employeeId: employee.id, startDate: form.startDate, endDate: form.endDate }),
      signal: ctrl.signal,
    })
      .then(r => r.json())
      .then(d => setAiWarning(d.warning || null))
      .catch(() => setAiWarning(null))
      .finally(() => setAiWarningLoading(false));
    return () => ctrl.abort();
  }, [employee?.id, form.startDate, form.endDate, scopeQuery, selectedTenantId]);

  /* Actions */
  const handleOpenApplyForm = () => {
    setForm(initialForm);
    setShowForm(true);
    setActionRowId(null);
    setAiWarning(null);
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setForm(initialForm);
    setAiWarning(null);
  };

  /* Export Leave Data */
  const getExportRows = () => filteredLeaves.map(l => ({
    'Employee ID': l.employee?.employeeId || '',
    'Employee Name': l.employee ? `${l.employee.firstName} ${l.employee.lastName}` : '',
    'Department': l.employee?.department?.name || '',
    'Leave Type': l.leaveType?.name || '',
    'Start Date': l.startDate ? new Date(l.startDate).toLocaleDateString() : '',
    'End Date': l.endDate ? new Date(l.endDate).toLocaleDateString() : '',
    'Duration (Days)': getDaysBetween(l.startDate, l.endDate),
    'Half Day': l.halfDay ? 'Yes' : 'No',
    'Status': l.status,
    'Reason': l.reason || '',
  }));

  const handleExportCSV = () => {
    const rows = getExportRows();
    if (rows.length === 0) { toast.error('No data to export'); return; }
    const headers = Object.keys(rows[0]);
    const csvContent = [
      headers.join(','),
      ...rows.map(row => headers.map(h => {
        const val = row[h as keyof typeof row];
        return `"${String(val ?? '').replace(/"/g, '""')}"`;
      }).join(',')),
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `leave-report-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    toast.success('CSV exported successfully');
  };

  const handleExportExcel = async () => {
    const rows = getExportRows();
    if (rows.length === 0) { toast.error('No data to export'); return; }
    try {
      const token = localStorage.getItem('tb_token');
      const res = await fetch(`/api/reports/export?token=${encodeURIComponent(token || '')}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ reportType: 'leave', format: 'excel', data: rows }),
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url;
      a.download = `leave-report-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
      toast.success('Excel exported successfully');
    } catch { toast.error('Excel export failed'); }
  };

  const handleExportPDF = async () => {
    const rows = getExportRows();
    if (rows.length === 0) { toast.error('No data to export'); return; }
    try {
      const token = localStorage.getItem('tb_token');
      const res = await fetch(`/api/reports/export?token=${encodeURIComponent(token || '')}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ reportType: 'leave', format: 'pdf', data: rows }),
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url;
      a.download = `leave-report-${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
      toast.success('PDF exported successfully');
    } catch { toast.error('PDF export failed'); }
  };

  const holidaysInRange = (() => {
    if (!form.startDate || !form.endDate) return [];
    const s = new Date(form.startDate);
    const e = new Date(form.endDate);
    return holidays.filter(h => {
      const hd = new Date(h.date);
      return hd >= s && hd <= e;
    });
  })();

  const handleApply = async () => {
    if (!form.leaveTypeId || !form.startDate || !form.endDate) {
      toast.error('Please fill in all required fields');
      return;
    }
    if (!employee?.id) {
      toast.error('Employee record not found');
      return;
    }
    try {
      setSubmitting(true);
      const res = await fetch('/api/leave', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          employeeId: employee.id,
          leaveTypeId: form.leaveTypeId,
          startDate: form.startDate,
          endDate: form.endDate,
          reason: form.reason,
          halfDay: form.halfDay,
          halfDaySlot: form.halfDay ? form.halfDaySlot : null,
        }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed'); }
      toast.success('Leave request submitted successfully');
      handleCancelForm();
      fetchData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to submit leave request');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenAction = (id: string, action: 'approved' | 'rejected') => {
    setActionRowId(id);
    setActionType(action);
    setActionComment('');
    setShowForm(false);
  };

  const handleCancelAction = () => {
    setActionRowId(null);
    setActionType(null);
    setActionComment('');
  };

  const handleAction = async () => {
    if (!actionRowId || !actionType) return;
    try {
      setActioning(true);
      const res = await fetch(`/api/leave/${actionRowId}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ status: actionType, comments: actionComment }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed'); }
      toast.success(`Leave ${actionType === 'approved' ? 'approved' : 'rejected'} successfully`);
      handleCancelAction();
      fetchData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setActioning(false);
    }
  };

  const handleCancel = async (id: string) => {
    try {
      const res = await fetch(`/api/leave/${id}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ status: 'cancelled' }),
      });
      if (!res.ok) throw new Error('Failed');
      toast.success('Leave cancelled');
      fetchData();
    } catch {
      toast.error('Failed to cancel leave');
    }
  };

  /* Computed stats */
  const pendingCount = leaveRequests.filter(l => l.status === 'pending').length;
  const approvedThisMonth = leaveRequests.filter(l => {
    if (l.status !== 'approved') return false;
    const d = new Date(l.startDate);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;
  const rejectedThisMonth = leaveRequests.filter(l => {
    if (l.status !== 'rejected') return false;
    const d = new Date(l.startDate);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  /* Filtered leaves for table */
  const filteredLeaves = leaveRequests.filter(lr => {
    if (searchQuery) {
      const name = lr.employee ? `${lr.employee.firstName} ${lr.employee.lastName}`.toLowerCase() : '';
      if (!name.includes(searchQuery.toLowerCase()) && !(lr.employee?.employeeId || '').toLowerCase().includes(searchQuery.toLowerCase())) return false;
    }
    if (filterLeaveType && lr.leaveType?.id !== filterLeaveType) return false;
    if (filterStatus && lr.status !== filterStatus) return false;
    if (dateRange.from && new Date(lr.startDate) < new Date(dateRange.from)) return false;
    if (dateRange.to && new Date(lr.endDate) > new Date(dateRange.to)) return false;
    return true;
  });

  /* ── Render ── */
  return (
    <div className="space-y-6">
      {/* Breadcrumb Header - SmartHR Style */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 mb-1">Leaves</h2>
          <nav className="flex items-center gap-1.5 text-sm text-slate-500">
            <button onClick={() => router.push('/')} className="hover:text-green-600 transition-colors">Home</button>
            <span>/</span>
            <button onClick={() => router.push('/leave')} className="hover:text-green-600 transition-colors">Leave</button>
            <span>/</span>
            <span className="text-slate-700 font-medium">Leaves Admin</span>
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <button onClick={handleExportCSV} className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors">
              <FiDownload className="w-3.5 h-3.5" /> CSV
            </button>
            <button onClick={handleExportExcel} className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors">
              <FiDownload className="w-3.5 h-3.5" /> Excel
            </button>
            <button onClick={handleExportPDF} className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors">
              <FiDownload className="w-3.5 h-3.5" /> PDF
            </button>
          </div>
          {isClientDemoMode() && (
          <button onClick={handleSeedData} disabled={seeding} className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 disabled:opacity-50 transition-colors">
            {seeding ? <FiRefreshCw className="w-3.5 h-3.5 animate-spin" /> : <FiDatabase className="w-3.5 h-3.5" />}
            {seeding ? 'Seeding...' : 'Seed Sample Data'}
          </button>
          )}
          <button onClick={handleOpenApplyForm} className="inline-flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium text-sm shadow-sm transition-colors">
            <FiPlus className="w-4 h-4" />
            Add Leave
          </button>
        </div>
      </div>

      {/* ── Stat Cards (SmartHR Style) ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Present */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-between bg-gradient-to-r from-emerald-50 to-emerald-50/30">
          <div className="flex items-center overflow-hidden">
            <div className="w-12 h-12 rounded-full bg-emerald-500 flex items-center justify-center text-white flex-shrink-0">
              <FiUserCheck className="w-5 h-5" />
            </div>
            <div className="ml-3 overflow-hidden">
              <p className="text-xs font-medium text-slate-500 truncate">Total Present</p>
              <h4 className="text-2xl font-bold text-emerald-600">{leaveRequests.length > 0 ? leaveRequests.filter(l => l.status !== 'approved' || l.employeeId === employee?.id).length : 0}</h4>
            </div>
          </div>
          <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700">
            <FiUserCheck className="w-3 h-3" /> Present
          </span>
        </div>

        {/* Planned Leaves */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-between bg-gradient-to-r from-pink-50 to-pink-50/30">
          <div className="flex items-center overflow-hidden">
            <div className="w-12 h-12 rounded-full bg-pink-500 flex items-center justify-center text-white flex-shrink-0">
              <FiCalendar className="w-5 h-5" />
            </div>
            <div className="ml-3 overflow-hidden">
              <p className="text-xs font-medium text-slate-500 truncate">Planned Leaves</p>
              <h4 className="text-2xl font-bold text-pink-600">{approvedThisMonth}</h4>
            </div>
          </div>
          <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-pink-50 text-pink-700">
            <FiCalendar className="w-3 h-3" /> Approved
          </span>
        </div>

        {/* Unplanned/Absent */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-between bg-gradient-to-r from-amber-50 to-amber-50/30">
          <div className="flex items-center overflow-hidden">
            <div className="w-12 h-12 rounded-full bg-amber-500 flex items-center justify-center text-white flex-shrink-0">
              <FiUserX className="w-5 h-5" />
            </div>
            <div className="ml-3 overflow-hidden">
              <p className="text-xs font-medium text-slate-500 truncate">Unplanned Leaves</p>
              <h4 className="text-2xl font-bold text-amber-600">{rejectedThisMonth}</h4>
            </div>
          </div>
          <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700">
            <FiAlertCircle className="w-3 h-3" /> Rejected
          </span>
        </div>

        {/* Pending Requests */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-between bg-gradient-to-r from-green-50 to-green-50/30">
          <div className="flex items-center overflow-hidden">
            <div className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center text-white flex-shrink-0">
              <FiClock className="w-5 h-5" />
            </div>
            <div className="ml-3 overflow-hidden">
              <p className="text-xs font-medium text-slate-500 truncate">Pending Requests</p>
              <h4 className="text-2xl font-bold text-green-600">{pendingCount}</h4>
            </div>
          </div>
          <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-50 text-green-700">
            <FiClock className="w-3 h-3" /> Pending
          </span>
        </div>
      </div>

      {/* ── Leave Balance Cards ── */}
      {leaveBalances.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
          {leaveBalances.map(lb => {
            const usedPct = lb.total > 0 ? (lb.used / lb.total) * 100 : 0;
            const barColor = usedPct > 80 ? 'bg-red-500' : usedPct > 50 ? 'bg-amber-500' : 'bg-emerald-500';
            return (
              <div key={lb.id} className="bg-white rounded-xl border border-slate-200 p-3">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-semibold text-slate-800">{lb.leaveType.name}</h4>
                  <span className="text-[10px] font-mono text-slate-400">{lb.leaveType.code}</span>
                </div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="text-center">
                    <p className="text-lg font-bold text-emerald-600">{lb.remaining}</p>
                    <p className="text-[9px] text-slate-400">Left</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-amber-600">{lb.used}</p>
                    <p className="text-[9px] text-slate-400">Used</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-slate-500">{lb.total}</p>
                    <p className="text-[9px] text-slate-400">Total</p>
                  </div>
                </div>
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full ${barColor} rounded-full transition-all duration-500`} style={{ width: `${Math.min(usedPct, 100)}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Apply Leave Form (Inline) ── */}
      {showForm && (
        <div className="bg-white rounded-xl border border-green-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-green-100 bg-green-50/50">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <FiPlus className="w-4 h-4 text-green-600" /> Apply Leave
            </h3>
            <button onClick={handleCancelForm} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
              <FiX className="w-4 h-4" />
            </button>
          </div>
          <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Leave Type <span className="text-red-500 font-bold">*</span></label>
                <select value={form.leaveTypeId} onChange={e => setForm(p => ({ ...p, leaveTypeId: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400">
                  <option value="">Select Leave Type</option>
                  {leaveTypes.map(lt => <option key={lt.id} value={lt.id}>{lt.name} ({lt.defaultDays} days)</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">From <span className="text-red-500 font-bold">*</span></label>
                  <input type="date" value={form.startDate} onChange={e => setForm(p => ({ ...p, startDate: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">To <span className="text-red-500 font-bold">*</span></label>
                  <input type="date" value={form.endDate} onChange={e => setForm(p => ({ ...p, endDate: e.target.value }))} min={form.startDate} className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" />
                </div>
              </div>
              {form.startDate && form.endDate && (
                <div className="flex items-center justify-between p-3 rounded-lg bg-green-50 border border-green-100">
                  <span className="text-sm text-green-700 font-medium">
                    <FiClock className="w-4 h-4 inline mr-1" />
                    Duration: {getDaysBetween(form.startDate, form.endDate)} day(s){form.halfDay ? ' (0.5 for half day)' : ''}
                  </span>
                  {/* Remaining days from balance */}
                  {form.leaveTypeId && leaveBalances.length > 0 && (
                    <span className="text-xs text-green-600 font-semibold">
                      Remaining: {leaveBalances.find(lb => lb.leaveType.id === form.leaveTypeId)?.remaining || '—'} days
                    </span>
                  )}
                </div>
              )}
              {/* Holiday Calendar Overlay */}
              {holidaysInRange.length > 0 && (
                <div className="p-3 rounded-lg bg-teal-50 border border-teal-200">
                  <p className="text-xs font-semibold text-teal-800 mb-1.5">
                    <FiCalendar className="w-3.5 h-3.5 inline mr-1" />Public Holidays in range:
                  </p>
                  <ul className="text-xs text-teal-700 space-y-0.5">
                    {holidaysInRange.map(h => (
                      <li key={h.id}>• {h.name} — {formatDate(h.date)} ({h.type})</li>
                    ))}
                  </ul>
                </div>
              )}
              {/* AI Collaborative Check */}
              {form.startDate && form.endDate && (
                <div className={`p-3 rounded-lg border ${aiWarning ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'}`}>
                  {aiWarningLoading ? (
                    <p className="text-xs text-slate-600 flex items-center gap-1"><FiClock className="w-3 h-3 animate-spin" /> Checking team availability...</p>
                  ) : aiWarning ? (
                    <p className="text-xs text-amber-800"><FiAlertCircle className="w-3.5 h-3.5 inline mr-1" /><strong>AI Warning:</strong> {aiWarning}</p>
                  ) : (
                    <p className="text-xs text-emerald-700"><FiCheck className="w-3.5 h-3.5 inline mr-1" /><strong>AI Check:</strong> No team conflicts detected.</p>
                  )}
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Reason</label>
                <textarea rows={3} value={form.reason} onChange={e => setForm(p => ({ ...p, reason: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 resize-none" placeholder="Provide a reason for your leave..." />
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={form.halfDay} onChange={e => setForm(p => ({ ...p, halfDay: e.target.checked }))} className="w-4 h-4 rounded border-slate-300 text-green-500 focus:ring-green-500/20" />
                <span className="text-sm text-slate-700">Half Day Leave</span>
              </label>
              {form.halfDay && (
                <div className="ml-7 flex gap-2">
                  <label className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-sm ${form.halfDaySlot === 'first_half' ? 'border-green-500 bg-green-50 text-green-700' : 'border-slate-200 text-slate-600'}`}>
                    <input type="radio" checked={form.halfDaySlot === 'first_half'} onChange={() => setForm(p => ({ ...p, halfDaySlot: 'first_half' }))} className="hidden" />
                    First Half
                  </label>
                  <label className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-sm ${form.halfDaySlot === 'second_half' ? 'border-green-500 bg-green-50 text-green-700' : 'border-slate-200 text-slate-600'}`}>
                    <input type="radio" checked={form.halfDaySlot === 'second_half'} onChange={() => setForm(p => ({ ...p, halfDaySlot: 'second_half' }))} className="hidden" />
                    Second Half
                  </label>
                </div>
              )}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button onClick={handleCancelForm} className="px-4 py-2.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">Cancel</button>
                <button onClick={handleApply} disabled={submitting} className="px-6 py-2.5 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50 shadow-sm transition-colors">
                  {submitting ? 'Submitting...' : 'Add Leave'}
                </button>
              </div>
            </div>
          </div>
      )}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {/* Card Header with Filters */}
        <div className="p-4 border-b border-slate-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h5 className="text-sm font-semibold text-slate-800">Leave List</h5>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Date Range */}
              <div className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600">
                <FiCalendar className="w-3.5 h-3.5 text-slate-400" />
                <input type="date" value={dateRange.from} onChange={e => setDateRange(p => ({ ...p, from: e.target.value }))} className="border-0 p-0 text-xs w-24 focus:outline-none" placeholder="From" />
                <span>—</span>
                <input type="date" value={dateRange.to} onChange={e => setDateRange(p => ({ ...p, to: e.target.value }))} className="border-0 p-0 text-xs w-24 focus:outline-none" placeholder="To" />
              </div>

              {/* Leave Type Filter */}
              <select value={filterLeaveType} onChange={e => setFilterLeaveType(e.target.value)} className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 focus:outline-none focus:ring-1 focus:ring-green-500/20">
                <option value="">Leave Type</option>
                {leaveTypes.map(lt => <option key={lt.id} value={lt.id}>{lt.name}</option>)}
              </select>

              {/* Status Filter */}
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 focus:outline-none focus:ring-1 focus:ring-green-500/20">
                <option value="">All Status</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="cancelled">Cancelled</option>
              </select>

              {/* Search */}
              <div className="relative">
                <FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input type="text" value={searchQuery} onChange={e => setSearchQuery(sanitizeSearch(e.target.value))} placeholder="Search employee..." className="pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs w-40 focus:outline-none focus:ring-1 focus:ring-green-500/20" />
              </div>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <input type="checkbox" className="w-3.5 h-3.5 rounded border-slate-300" />
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Employee</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Leave Type</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">From</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">To</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">No of Days</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-slate-50 animate-pulse">
                    <td className="px-4 py-3"><div className="w-3.5 h-3.5 bg-slate-200 rounded" /></td>
                    <td className="px-4 py-3"><div className="flex items-center gap-3"><div className="w-8 h-8 bg-slate-200 rounded-full" /><div><div className="h-3 w-24 bg-slate-200 rounded mb-1" /><div className="h-2.5 w-16 bg-slate-100 rounded" /></div></div></td>
                    <td className="px-4 py-3"><div className="h-3 w-20 bg-slate-200 rounded" /></td>
                    <td className="px-4 py-3"><div className="h-3 w-20 bg-slate-200 rounded" /></td>
                    <td className="px-4 py-3"><div className="h-3 w-20 bg-slate-200 rounded" /></td>
                    <td className="px-4 py-3"><div className="h-3 w-8 bg-slate-200 rounded" /></td>
                    <td className="px-4 py-3"><div className="h-5 w-16 bg-slate-200 rounded-full" /></td>
                    <td className="px-4 py-3"><div className="h-3 w-16 bg-slate-200 rounded ml-auto" /></td>
                  </tr>
                ))
              ) : filteredLeaves.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <FiCalendar className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-500 font-medium">No leave requests found</p>
                    <p className="text-xs text-slate-400 mt-1">Apply for leave using the &quot;Add Leave&quot; button above</p>
                  </td>
                </tr>
              ) : (
                filteredLeaves.map(lr => {
                  const isActionRow = actionRowId === lr.id;
                  const fullName = lr.employee ? `${lr.employee.firstName} ${lr.employee.lastName}`.trim() : 'Unknown';
                  const dept = lr.employee?.department?.name || '—';
                  const badge = getStatusBadge(lr.status);

                  return (
                    <tr key={lr.id} className={`border-b border-slate-50 transition-colors ${isActionRow ? 'bg-slate-50' : 'hover:bg-slate-50/50'}`}>
                      <td className="px-4 py-3">
                        <input type="checkbox" className="w-3.5 h-3.5 rounded border-slate-300" />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${getAvatarGradient(fullName)} flex items-center justify-center text-white text-sm font-bold flex-shrink-0`}>
                            {fullName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-slate-800">{fullName}</p>
                            <p className="text-xs text-slate-400">{dept}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium text-slate-700">{lr.leaveType?.name || 'Leave'}</span>
                          {lr.halfDay && <span className="text-[10px] text-slate-400">(Half)</span>}
                          {lr.reason && (
                            <span className="relative group">
                              <FiAlertCircle className="w-3.5 h-3.5 text-green-400 cursor-help" />
                              <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1.5 bg-slate-800 text-white text-xs rounded-lg whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 max-w-[200px] truncate">
                                {lr.reason}
                              </span>
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">{formatDate(lr.startDate)}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{formatDate(lr.endDate)}</td>
                      <td className="px-4 py-3 text-sm text-slate-700 font-medium">{getDaysBetween(lr.startDate, lr.endDate)} Days</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${badge.bg} ${badge.text}`}>
                          {badge.label}
                        </span>
                        {(lr as any).workflowStage && (lr as any).workflowStage !== 'final_approval' && (lr as any).workflowStage !== 'rejected' && (
                          <span className="block mt-1 text-[10px] text-slate-500 font-medium">
                            {(lr as any).workflowStage.replace(/_/g, ' ')}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {isActionRow && actionType ? (
                          <div className={`rounded-lg border p-3 ${actionType === 'approved' ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                            <div className="flex items-start gap-2 mb-2">
                              <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${actionType === 'approved' ? 'bg-emerald-100' : 'bg-red-100'}`}>
                                {actionType === 'approved' ? <FiCheck className="w-3.5 h-3.5 text-emerald-500" /> : <FiX className="w-3.5 h-3.5 text-red-500" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="text-xs font-semibold text-slate-800">{actionType === 'approved' ? 'Approve' : 'Reject'} Leave</h4>
                                <p className="text-[10px] text-slate-500 mt-0.5">{lr.leaveType?.name} · {formatDate(lr.startDate)} – {formatDate(lr.endDate)}</p>
                              </div>
                            </div>
                            <textarea rows={2} value={actionComment} onChange={e => setActionComment(e.target.value)} className="w-full px-2 py-1.5 rounded border border-slate-200 text-xs mb-2 resize-none focus:outline-none focus:ring-1 focus:ring-green-500/20" placeholder="Add comment (optional)..." />
                            <div className="flex items-center gap-1.5">
                              <button onClick={handleAction} disabled={actioning} className={`px-2.5 py-1 text-white text-[10px] font-medium rounded disabled:opacity-50 ${actionType === 'approved' ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-red-500 hover:bg-red-600'}`}>
                                {actioning ? 'Processing...' : 'Confirm'}
                              </button>
                              <button onClick={handleCancelAction} className="px-2.5 py-1 border border-slate-200 text-[10px] font-medium rounded hover:bg-white">Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => handleView(lr)} className="p-1.5 rounded-lg text-slate-400 hover:text-green-600 hover:bg-green-50 transition-colors" title="View Leave Application">
                              <FiEye className="w-4 h-4" />
                            </button>
                            {isAdmin && lr.status === 'pending' && (
                              <>
                                <button onClick={() => handleOpenAction(lr.id, 'approved')} className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 transition-colors" title="Approve">
                                  <FiCheck className="w-4 h-4" />
                                </button>
                                <button onClick={() => handleOpenAction(lr.id, 'rejected')} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors" title="Reject">
                                  <FiX className="w-4 h-4" />
                                </button>
                              </>
                            )}
                            {lr.status === 'pending' && lr.employeeId === employee?.id && (
                              <button onClick={() => handleCancel(lr.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors" title="Cancel">
                                <FiX className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer */}
        {filteredLeaves.length > 0 && (
          <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Showing {filteredLeaves.length} of {leaveRequests.length} entries</span>
            <div className="flex items-center gap-1">
              <button className="px-2.5 py-1 rounded border border-slate-200 hover:bg-slate-50 transition-colors">Previous</button>
              <button className="px-2.5 py-1 rounded bg-green-600 text-white">1</button>
              <button className="px-2.5 py-1 rounded border border-slate-200 hover:bg-slate-50 transition-colors">Next</button>
            </div>
          </div>
        )}
      </div>

      {/* ─── View Leave Application Modal ─── */}
      {viewTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50" onClick={() => setViewTarget(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-start justify-between p-5 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-bold text-slate-800">Leave Application</h3>
                <p className="text-xs text-slate-400 mt-0.5">Request ID: {viewTarget.id}</p>
              </div>
              <button onClick={() => setViewTarget(null)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors" title="Close">
                <FiX className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* Application summary */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div className="col-span-2 sm:col-span-1">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Employee</p>
                  {(() => {
                    const fullName = viewTarget.employee ? `${viewTarget.employee.firstName} ${viewTarget.employee.lastName}`.trim() : 'Unknown';
                    return (
                      <div className="flex items-center gap-2.5">
                        <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${getAvatarGradient(fullName)} flex items-center justify-center text-white text-sm font-bold flex-shrink-0`}>
                          {fullName.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate">{fullName}</p>
                          <p className="text-xs text-slate-400 truncate">{viewTarget.employee?.employeeId || '—'}{viewTarget.employee?.department ? ` · ${viewTarget.employee.department.name}` : ''}</p>
                        </div>
                      </div>
                    );
                  })()}
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Leave Type</p>
                  <p className="text-sm font-medium text-slate-800">{viewTarget.leaveType?.name || 'Leave'}</p>
                  {viewTarget.leaveType?.code && <p className="text-xs text-slate-400">{viewTarget.leaveType.code}</p>}
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Status</p>
                  {(() => {
                    const badge = getStatusBadge(viewTarget.status);
                    return (
                      <>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${badge.bg} ${badge.text}`}>{badge.label}</span>
                        {(viewTarget as any).workflowStage && (viewTarget as any).workflowStage !== 'final_approval' && (viewTarget as any).workflowStage !== 'rejected' && (
                          <p className="text-[10px] text-slate-500 mt-1 capitalize">{(viewTarget as any).workflowStage.replace(/_/g, ' ')}</p>
                        )}
                      </>
                    );
                  })()}
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">From</p>
                  <p className="text-sm text-slate-700">{formatDate(viewTarget.startDate)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">To</p>
                  <p className="text-sm text-slate-700">{formatDate(viewTarget.endDate)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Duration</p>
                  <p className="text-sm text-slate-700">{getDaysBetween(viewTarget.startDate, viewTarget.endDate)} day(s){viewTarget.halfDay ? ' · Half day' : ''}</p>
                </div>
              </div>

              {/* Reason */}
              <div>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Reason</p>
                <p className="text-sm text-slate-700 bg-slate-50 rounded-lg px-3 py-2 border border-slate-100 min-h-[38px]">{viewTarget.reason || '—'}</p>
              </div>

              {/* Comments */}
              {viewTarget.comments && (
                <div>
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Comments</p>
                  <p className="text-sm text-slate-700 bg-amber-50 rounded-lg px-3 py-2 border border-amber-100">{viewTarget.comments}</p>
                </div>
              )}

              {/* Approval history */}
              <div>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Approval History</p>
                {viewLoading ? (
                  <div className="flex items-center gap-2 py-3 text-xs text-slate-400">
                    <FiRefreshCw className="w-3.5 h-3.5 animate-spin" /> Loading approval history...
                  </div>
                ) : viewSteps.length === 0 ? (
                  <div className="text-xs text-slate-400 bg-slate-50 rounded-lg px-3 py-2.5 border border-slate-100">
                    No multi-tier workflow steps recorded for this request.
                    {viewTarget.status === 'approved' && ' Approved by the configured approver.'}
                    {viewTarget.status === 'pending' && ' Awaiting manager decision.'}
                  </div>
                ) : (
                  <ol className="space-y-2">
                    {viewSteps.map(step => (
                      <li key={step.id} className="flex items-start gap-3 bg-slate-50 rounded-lg px-3 py-2.5 border border-slate-100">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold ${step.action === 'approved' ? 'bg-emerald-100 text-emerald-600' : step.action === 'rejected' ? 'bg-red-100 text-red-600' : 'bg-slate-200 text-slate-500'}`}>
                          {step.tier}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-slate-700">
                            {step.tierLabel}
                            {step.approverTypeLabel ? <span className="font-normal text-slate-400"> · {step.approverTypeLabel}</span> : null}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {step.action ? <span className={`font-medium ${step.action === 'approved' ? 'text-emerald-600' : step.action === 'rejected' ? 'text-red-500' : 'text-slate-500'}`}>{step.action}</span> : 'pending'}
                            {step.actionByName ? ` by ${step.actionByName}` : ''}
                            {step.actionAt ? ` · ${formatDate(step.actionAt)}` : ''}
                          </p>
                          {step.comments && <p className="text-[11px] text-slate-500 mt-0.5 italic">&ldquo;{step.comments}&rdquo;</p>}
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-slate-100">
              <button onClick={() => setViewTarget(null)} className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function LeavePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-20"><div className="animate-spin w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full" /></div>}>
      <LeavePageContent />
    </Suspense>
  );
}
