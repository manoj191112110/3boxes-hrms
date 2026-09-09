'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  FiPlus, FiX, FiEdit2, FiCheck, FiDollarSign,
  FiSearch, FiRefreshCw, FiFileText, FiClock, FiCheckCircle,
  FiList, FiUser, FiTrendingUp, FiTrendingDown,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import { useCompanyContextStore } from '@/store/companyContextStore';

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

interface EmployeeOption {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface FNFCalculation {
  id: string;
  employeeId: string;
  separationId: string | null;
  pendingSalary: number;
  leaveEncashment: number;
  bonus: number;
  incentives: number;
  reimbursements: number;
  noticeRecovery: number;
  assetRecovery: number;
  loanRecovery: number;
  taxDeduction: number;
  otherRecoveries: number;
  totalEarnings: number;
  totalDeductions: number;
  netAmount: number;
  currency: string;
  status: string;
  approvedBy: string | null;
  approvedAt: string | null;
  paidAt: string | null;
  remarks: string | null;
  createdAt: string;
  employee?: {
    employeeId: string;
    firstName: string;
    lastName: string;
    email: string;
    department?: { name: string };
    designation?: { title: string };
  };
}

function getStatusBadge(status: string) {
  const map: Record<string, string> = {
    pending: 'thb-badge thb-badge-warning',
    approved: 'thb-badge thb-badge-success',
    paid: 'thb-badge thb-badge-info',
    cancelled: 'thb-badge thb-badge-error',
  };
  return map[status] || 'thb-badge thb-badge-info';
}

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'paid', label: 'Paid' },
  { value: 'cancelled', label: 'Cancelled' },
];

const CURRENCY_OPTIONS = [
  { value: 'INR', label: 'INR' },
  { value: 'USD', label: 'USD' },
  { value: 'GBP', label: 'GBP' },
  { value: 'SGD', label: 'SGD' },
  { value: 'AED', label: 'AED' },
];

const emptyForm = {
  employeeId: '',
  separationId: '',
  pendingSalary: '' as string,
  leaveEncashment: '' as string,
  bonus: '' as string,
  incentives: '' as string,
  reimbursements: '' as string,
  noticeRecovery: '' as string,
  assetRecovery: '' as string,
  loanRecovery: '' as string,
  taxDeduction: '' as string,
  otherRecoveries: '' as string,
  currency: 'INR',
  remarks: '',
};

export default function FNFSettlementPage() {
  const { user } = useAuthStore();
  const effectiveCompanyId = useCompanyContextStore(s => s.effectiveCompanyId);
  const isAdmin = user?.role === 'super_admin' || user?.role === 'tenant_admin' || user?.role === 'admin';

  const [records, setRecords] = useState<FNFCalculation[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailData, setDetailData] = useState<FNFCalculation & { separation?: unknown } | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [employeeFilter, setEmployeeFilter] = useState('');
  const [form, setForm] = useState({ ...emptyForm });

  const fetchEmployees = useCallback(async () => {
    try {
      const res = await fetch(`/api/employees?${scopeQuery}limit=200`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        const list = data.employees || data.data || [];
        setEmployees(list.map((e: Record<string, unknown>) => ({
          id: e.id as string,
          employeeId: e.employeeId as string,
          firstName: e.firstName as string,
          lastName: e.lastName as string,
          email: e.email as string,
        })));
      }
    } catch { /* silently fail */ }
  }, []);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (employeeFilter) params.set('employeeId', employeeFilter);
      const qs = params.toString();
      const url = `/api/payroll/fnf${qs ? `?${qs}` : ''}`;
      const res = await fetch(url, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setRecords(Array.isArray(data) ? data : data.data || []);
      }
    } catch {
      toast.error('Failed to load F&F settlements');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, employeeFilter]);
  const cid = effectiveCompanyId();
  const scopeQuery = cid ? `companyId=${cid}&` : '';


  useEffect(() => {
    queueMicrotask(() => {
      fetchData();
      fetchEmployees();
    });
  }, [fetchData, fetchEmployees]);

  // Computed
  const totalCount = records.length;
  const pendingCount = records.filter(r => r.status === 'pending').length;
  const approvedCount = records.filter(r => r.status === 'approved').length;
  const paidCount = records.filter(r => r.status === 'paid').length;
  const totalNetAmount = records.reduce((sum, r) => sum + r.netAmount, 0);

  // Auto-calculate form totals
  const calcFormTotals = () => {
    const earnings = ['pendingSalary', 'leaveEncashment', 'bonus', 'incentives', 'reimbursements'] as const;
    const deductions = ['noticeRecovery', 'assetRecovery', 'loanRecovery', 'taxDeduction', 'otherRecoveries'] as const;
    const totalE = earnings.reduce((s, k) => s + (parseFloat(form[k]) || 0), 0);
    const totalD = deductions.reduce((s, k) => s + (parseFloat(form[k]) || 0), 0);
    return { totalEarnings: totalE, totalDeductions: totalD, netAmount: totalE - totalD };
  };
  const formTotals = calcFormTotals();

  const filteredRecords = records.filter(r => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const emp = employees.find(e => e.employeeId === r.employeeId);
      const empName = emp ? `${emp.firstName} ${emp.lastName}`.toLowerCase() : '';
      if (!r.employeeId.toLowerCase().includes(q) && !empName.includes(q) && !(r.remarks || '').toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const getEmployeeDisplay = (empId: string) => {
    const emp = employees.find(e => e.employeeId === empId || e.id === empId);
    if (emp) return `${emp.firstName} ${emp.lastName}`;
    return empId;
  };

  const formatCurrency = (val: number, curr: string = 'INR') => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: curr, minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(val);
  };

  const formatDate = (d: string | null) => d ? new Date(d).toLocaleDateString() : '—';

  const handleAddNew = () => {
    setForm({ ...emptyForm });
    setEditingId(null);
    setShowForm(true);
    setTimeout(() => document.getElementById('fnf-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  const handleEdit = (item: FNFCalculation) => {
    setForm({
      employeeId: item.employeeId,
      separationId: item.separationId || '',
      pendingSalary: String(item.pendingSalary),
      leaveEncashment: String(item.leaveEncashment),
      bonus: String(item.bonus),
      incentives: String(item.incentives),
      reimbursements: String(item.reimbursements),
      noticeRecovery: String(item.noticeRecovery),
      assetRecovery: String(item.assetRecovery),
      loanRecovery: String(item.loanRecovery),
      taxDeduction: String(item.taxDeduction),
      otherRecoveries: String(item.otherRecoveries),
      currency: item.currency || 'INR',
      remarks: item.remarks || '',
    });
    setEditingId(item.id);
    setShowForm(true);
    setTimeout(() => document.getElementById('fnf-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm({ ...emptyForm });
  };

  const handleSubmit = async () => {
    if (!form.employeeId.trim()) { toast.error('Employee is required'); return; }
    setSubmitting(true);
    try {
      const payload = {
        employeeId: form.employeeId,
        separationId: form.separationId || null,
        pendingSalary: parseFloat(form.pendingSalary) || 0,
        leaveEncashment: parseFloat(form.leaveEncashment) || 0,
        bonus: parseFloat(form.bonus) || 0,
        incentives: parseFloat(form.incentives) || 0,
        reimbursements: parseFloat(form.reimbursements) || 0,
        noticeRecovery: parseFloat(form.noticeRecovery) || 0,
        assetRecovery: parseFloat(form.assetRecovery) || 0,
        loanRecovery: parseFloat(form.loanRecovery) || 0,
        taxDeduction: parseFloat(form.taxDeduction) || 0,
        otherRecoveries: parseFloat(form.otherRecoveries) || 0,
        currency: form.currency,
        remarks: form.remarks || null,
      };

      if (editingId) {
        const res = await fetch(`/api/payroll/fnf/${editingId}?${scopeQuery}` , {
          method: 'PUT', headers: getAuthHeaders(), body: JSON.stringify(payload),
        });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed to update'); }
        toast.success('F&F calculation updated successfully');
      } else {
        const res = await fetch(`/api/payroll/fnf?${scopeQuery}` , {
          method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(payload),
        });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed to create'); }
        toast.success('F&F calculation created successfully');
      }
      handleCancelForm();
      fetchData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusAction = async (id: string, status: string) => {
    try {
      const res = await fetch(`/api/payroll/fnf/${id}?${scopeQuery}` , {
        method: 'PATCH', headers: getAuthHeaders(), body: JSON.stringify({ status }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed'); }
      toast.success(`F&F ${status} successfully`);
      fetchData();
      if (detailId === id) setDetailId(null);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    }
  };

  const handleViewDetail = async (id: string) => {
    try {
      const res = await fetch(`/api/payroll/fnf/${id}?${scopeQuery}` , { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setDetailData(data.data);
        setDetailId(id);
      }
    } catch {
      toast.error('Failed to load F&F details');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-thb-text-primary flex items-center gap-2">
            <FiFileText className="w-6 h-6 text-emerald-500" />
            Full & Final Settlement
          </h1>
          <p className="text-thb-text-secondary mt-1">Manage employee F&F calculations and settlements</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => fetchData()} className="p-2.5 rounded-lg border border-thb-border text-thb-text-secondary hover:bg-slate-50 transition-colors" title="Refresh">
            <FiRefreshCw className="w-4 h-4" />
          </button>
          {isAdmin && (
            <button onClick={handleAddNew} className="inline-flex items-center gap-2 px-4 py-2.5 bg-green-500 text-white rounded-lg hover:bg-green-600 font-medium text-sm shadow-sm shadow-green-500/25 transition-colors">
              <FiPlus className="w-4 h-4" /> New F&F
            </button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <div className="thb-card thb-card-hover p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
              <FiList className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-xs font-medium text-thb-text-secondary">Total</p>
              <p className="text-xl font-bold text-thb-text-primary">{totalCount}</p>
            </div>
          </div>
        </div>
        <div className="thb-card thb-card-hover p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
              <FiClock className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <p className="text-xs font-medium text-thb-text-secondary">Pending</p>
              <p className="text-xl font-bold text-thb-text-primary">{pendingCount}</p>
            </div>
          </div>
        </div>
        <div className="thb-card thb-card-hover p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
              <FiCheckCircle className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <p className="text-xs font-medium text-thb-text-secondary">Approved</p>
              <p className="text-xl font-bold text-thb-text-primary">{approvedCount}</p>
            </div>
          </div>
        </div>
        <div className="thb-card thb-card-hover p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center">
              <FiDollarSign className="w-5 h-5 text-teal-500" />
            </div>
            <div>
              <p className="text-xs font-medium text-thb-text-secondary">Paid</p>
              <p className="text-xl font-bold text-thb-text-primary">{paidCount}</p>
            </div>
          </div>
        </div>
        <div className="thb-card thb-card-hover p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center">
              <FiTrendingUp className="w-5 h-5 text-teal-500" />
            </div>
            <div>
              <p className="text-xs font-medium text-thb-text-secondary">Total Net</p>
              <p className="text-lg font-bold text-thb-text-primary">{formatCurrency(totalNetAmount)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search / Filter */}
      <div className="thb-card p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-thb-text-muted" />
            <input type="text" placeholder="Search by employee, remarks..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 min-w-[150px]">
            {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select value={employeeFilter} onChange={(e) => setEmployeeFilter(e.target.value)}
            className="px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 min-w-[160px]">
            <option value="">All Employees</option>
            {employees.map(e => (
              <option key={e.id} value={e.employeeId}>{e.firstName} {e.lastName} ({e.employeeId})</option>
            ))}
          </select>
        </div>
      </div>

      {/* Create/Edit Form */}
      {showForm && (
        <div id="fnf-form" className="thb-card border-l-4 border-l-green-500">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-thb-text-primary">
                {editingId ? 'Edit F&F Calculation' : 'Create F&F Calculation'}
              </h2>
              <button onClick={handleCancelForm} className="p-2 rounded-lg text-thb-text-muted hover:text-thb-text-primary hover:bg-slate-100 transition-colors">
                <FiX className="w-5 h-5" />
              </button>
            </div>

            {/* Employee & Separation */}
            <div className="mb-5">
              <h3 className="text-sm font-semibold text-thb-text-primary mb-3">Employee Details</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Employee *</label>
                  {employees.length > 0 ? (
                    <select value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400">
                      <option value="">Select Employee...</option>
                      {employees.map(e => (
                        <option key={e.id} value={e.employeeId}>{e.firstName} {e.lastName} ({e.employeeId})</option>
                      ))}
                    </select>
                  ) : (
                    <input value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                      placeholder="Enter Employee ID" />
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Separation ID</label>
                  <input value={form.separationId} onChange={(e) => setForm({ ...form, separationId: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                    placeholder="Optional separation reference" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Currency</label>
                  <select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400">
                    {CURRENCY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Earnings */}
            <div className="mb-5">
              <h3 className="text-sm font-semibold text-thb-text-primary mb-3 flex items-center gap-2">
                <FiTrendingUp className="w-4 h-4 text-emerald-500" /> Earnings
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  { key: 'pendingSalary', label: 'Pending Salary' },
                  { key: 'leaveEncashment', label: 'Leave Encashment' },
                  { key: 'bonus', label: 'Bonus' },
                  { key: 'incentives', label: 'Incentives' },
                  { key: 'reimbursements', label: 'Reimbursements' },
                ].map(({ key, label }) => (
                  <div key={key}>
                    <label className="block text-xs font-medium text-thb-text-secondary mb-1">{label}</label>
                    <input type="number" step="0.01" min="0" value={form[key as keyof typeof form]}
                      onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                      placeholder="0.00" />
                  </div>
                ))}
              </div>
              <div className="mt-3 px-3 py-2 bg-emerald-50 rounded-lg">
                <span className="text-xs font-medium text-emerald-700">Total Earnings: {formatCurrency(formTotals.totalEarnings, form.currency)}</span>
              </div>
            </div>

            {/* Deductions */}
            <div className="mb-5">
              <h3 className="text-sm font-semibold text-thb-text-primary mb-3 flex items-center gap-2">
                <FiTrendingDown className="w-4 h-4 text-red-500" /> Deductions
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  { key: 'noticeRecovery', label: 'Notice Recovery' },
                  { key: 'assetRecovery', label: 'Asset Recovery' },
                  { key: 'loanRecovery', label: 'Loan Recovery' },
                  { key: 'taxDeduction', label: 'Tax Deduction' },
                  { key: 'otherRecoveries', label: 'Other Recoveries' },
                ].map(({ key, label }) => (
                  <div key={key}>
                    <label className="block text-xs font-medium text-thb-text-secondary mb-1">{label}</label>
                    <input type="number" step="0.01" min="0" value={form[key as keyof typeof form]}
                      onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                      placeholder="0.00" />
                  </div>
                ))}
              </div>
              <div className="mt-3 px-3 py-2 bg-red-50 rounded-lg">
                <span className="text-xs font-medium text-red-700">Total Deductions: {formatCurrency(formTotals.totalDeductions, form.currency)}</span>
              </div>
            </div>

            {/* Net Amount & Remarks */}
            <div className="mb-5">
              <h3 className="text-sm font-semibold text-thb-text-primary mb-3">Summary</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="px-4 py-3 bg-slate-50 rounded-lg border border-thb-border">
                  <p className="text-xs font-medium text-thb-text-secondary mb-1">Net Amount</p>
                  <p className={`text-2xl font-bold ${formTotals.netAmount >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {formatCurrency(formTotals.netAmount, form.currency)}
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Remarks</label>
                  <textarea value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} rows={3}
                    className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 resize-none"
                    placeholder="Additional notes..." />
                </div>
              </div>
            </div>

            {/* Form Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-thb-border">
              <button onClick={handleCancelForm} className="px-4 py-2.5 rounded-lg border border-thb-border text-sm font-medium text-thb-text-secondary hover:bg-slate-50 transition-colors">
                Cancel
              </button>
              <button onClick={handleSubmit} disabled={submitting}
                className="px-6 py-2.5 rounded-lg bg-green-500 text-white text-sm font-medium hover:bg-green-600 disabled:opacity-50 shadow-sm shadow-green-500/25 transition-colors">
                {submitting ? 'Saving...' : editingId ? 'Update F&F' : 'Create F&F'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail View */}
      {detailId && detailData && (
        <div className="thb-card border-l-4 border-l-teal-500">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-thb-text-primary">F&F Settlement Detail</h2>
              <button onClick={() => { setDetailId(null); setDetailData(null); }} className="p-2 rounded-lg text-thb-text-muted hover:text-thb-text-primary hover:bg-slate-100 transition-colors">
                <FiX className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Employee Info */}
              <div>
                <h3 className="text-sm font-semibold text-thb-text-primary mb-3">Employee Details</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-thb-text-secondary">Name</span><span className="font-medium text-thb-text-primary">{detailData.employee?.firstName} {detailData.employee?.lastName}</span></div>
                  <div className="flex justify-between"><span className="text-thb-text-secondary">Employee ID</span><span className="font-medium text-thb-text-primary">{detailData.employee?.employeeId}</span></div>
                  <div className="flex justify-between"><span className="text-thb-text-secondary">Department</span><span className="font-medium text-thb-text-primary">{detailData.employee?.department?.name || '—'}</span></div>
                  <div className="flex justify-between"><span className="text-thb-text-secondary">Designation</span><span className="font-medium text-thb-text-primary">{detailData.employee?.designation?.title || '—'}</span></div>
                  <div className="flex justify-between"><span className="text-thb-text-secondary">Status</span><span className={getStatusBadge(detailData.status)}>{detailData.status.charAt(0).toUpperCase() + detailData.status.slice(1)}</span></div>
                  <div className="flex justify-between"><span className="text-thb-text-secondary">Approved At</span><span className="font-medium text-thb-text-primary">{formatDate(detailData.approvedAt)}</span></div>
                  <div className="flex justify-between"><span className="text-thb-text-secondary">Paid At</span><span className="font-medium text-thb-text-primary">{formatDate(detailData.paidAt)}</span></div>
                </div>
              </div>
              {/* Financial Summary */}
              <div>
                <h3 className="text-sm font-semibold text-thb-text-primary mb-3">Financial Summary</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-thb-text-secondary">Pending Salary</span><span className="font-medium text-thb-text-primary">{formatCurrency(detailData.pendingSalary, detailData.currency)}</span></div>
                  <div className="flex justify-between"><span className="text-thb-text-secondary">Leave Encashment</span><span className="font-medium text-thb-text-primary">{formatCurrency(detailData.leaveEncashment, detailData.currency)}</span></div>
                  <div className="flex justify-between"><span className="text-thb-text-secondary">Bonus</span><span className="font-medium text-thb-text-primary">{formatCurrency(detailData.bonus, detailData.currency)}</span></div>
                  <div className="flex justify-between"><span className="text-thb-text-secondary">Incentives</span><span className="font-medium text-thb-text-primary">{formatCurrency(detailData.incentives, detailData.currency)}</span></div>
                  <div className="flex justify-between"><span className="text-thb-text-secondary">Reimbursements</span><span className="font-medium text-thb-text-primary">{formatCurrency(detailData.reimbursements, detailData.currency)}</span></div>
                  <div className="flex justify-between border-t border-thb-border pt-2"><span className="font-medium text-emerald-700">Total Earnings</span><span className="font-bold text-emerald-700">{formatCurrency(detailData.totalEarnings, detailData.currency)}</span></div>
                  <div className="flex justify-between"><span className="text-thb-text-secondary">Notice Recovery</span><span className="font-medium text-red-600">{formatCurrency(detailData.noticeRecovery, detailData.currency)}</span></div>
                  <div className="flex justify-between"><span className="text-thb-text-secondary">Asset Recovery</span><span className="font-medium text-red-600">{formatCurrency(detailData.assetRecovery, detailData.currency)}</span></div>
                  <div className="flex justify-between"><span className="text-thb-text-secondary">Loan Recovery</span><span className="font-medium text-red-600">{formatCurrency(detailData.loanRecovery, detailData.currency)}</span></div>
                  <div className="flex justify-between"><span className="text-thb-text-secondary">Tax Deduction</span><span className="font-medium text-red-600">{formatCurrency(detailData.taxDeduction, detailData.currency)}</span></div>
                  <div className="flex justify-between"><span className="text-thb-text-secondary">Other Recoveries</span><span className="font-medium text-red-600">{formatCurrency(detailData.otherRecoveries, detailData.currency)}</span></div>
                  <div className="flex justify-between border-t border-thb-border pt-2"><span className="font-medium text-red-700">Total Deductions</span><span className="font-bold text-red-700">{formatCurrency(detailData.totalDeductions, detailData.currency)}</span></div>
                  <div className="flex justify-between border-t-2 border-thb-border pt-2"><span className="font-bold text-thb-text-primary">Net Amount</span><span className={`text-lg font-bold ${detailData.netAmount >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatCurrency(detailData.netAmount, detailData.currency)}</span></div>
                </div>
                {detailData.remarks && (
                  <div className="mt-3 px-3 py-2 bg-slate-50 rounded-lg text-sm text-thb-text-secondary">
                    <span className="font-medium">Remarks:</span> {detailData.remarks}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Data Table */}
      {loading ? (
        <div className="thb-card overflow-hidden">
          <div className="p-5 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 bg-slate-100 rounded animate-pulse" />
            ))}
          </div>
        </div>
      ) : filteredRecords.length === 0 ? (
        <div className="thb-card p-12 text-center">
          <FiFileText className="w-12 h-12 text-thb-text-muted mx-auto mb-3" />
          <p className="text-thb-text-secondary font-medium">No F&F settlements found</p>
          <p className="text-sm text-thb-text-muted mt-1">Create your first F&F calculation to get started</p>
        </div>
      ) : (
        <div className="thb-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead className="bg-slate-50 border-b border-thb-border">
                <tr>
                  {['Employee', 'Total Earnings', 'Total Deductions', 'Net Amount', 'Currency', 'Status', 'Created', 'Actions'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-thb-text-muted uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRecords.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                          <FiUser className="w-3.5 h-3.5 text-slate-500" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-thb-text-primary truncate max-w-[150px]">{getEmployeeDisplay(item.employeeId)}</p>
                          <p className="text-xs text-thb-text-muted">{item.employeeId}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-medium text-emerald-600">{formatCurrency(item.totalEarnings, item.currency)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-medium text-red-600">{formatCurrency(item.totalDeductions, item.currency)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-sm font-bold ${item.netAmount >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{formatCurrency(item.netAmount, item.currency)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-thb-text-secondary">{item.currency}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={getStatusBadge(item.status)}>{item.status.charAt(0).toUpperCase() + item.status.slice(1)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-thb-text-secondary">{formatDate(item.createdAt)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleViewDetail(item.id)} className="p-1.5 rounded-lg text-thb-text-muted hover:text-green-500 hover:bg-green-50 transition-colors" title="View Details">
                          <FiSearch className="w-3.5 h-3.5" />
                        </button>
                        {isAdmin && item.status === 'pending' && (
                          <>
                            <button onClick={() => handleEdit(item)} className="p-1.5 rounded-lg text-thb-text-muted hover:text-amber-500 hover:bg-amber-50 transition-colors" title="Edit">
                              <FiEdit2 className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => handleStatusAction(item.id, 'approved')} className="p-1.5 rounded-lg text-thb-text-muted hover:text-emerald-500 hover:bg-emerald-50 transition-colors" title="Approve">
                              <FiCheck className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                        {isAdmin && item.status === 'approved' && (
                          <button onClick={() => handleStatusAction(item.id, 'paid')} className="p-1.5 rounded-lg text-thb-text-muted hover:text-teal-500 hover:bg-teal-50 transition-colors" title="Mark as Paid">
                            <FiDollarSign className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
