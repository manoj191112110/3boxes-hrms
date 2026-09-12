'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  FiPlus, FiX, FiTrash2, FiEdit2, FiCheck, FiXCircle,
  FiSearch, FiRefreshCw, FiClock,
  FiList, FiUser, FiDollarSign, FiCalendar,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import { useCompanyContextStore } from '@/store/companyContextStore';

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

// --- Types ---
interface EmployeeOption {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  salary?: number;
}

interface OvertimeRecord {
  id: string;
  employeeId: string;
  date: string;
  hours: number;
  rateType: string;
  rate: number;
  amount: number;
  reason: string | null;
  project: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  status: string;
  payrollRunId: string | null;
  createdAt: string;
  updatedAt: string;
  employee?: {
    id: string;
    employeeId: string;
    firstName: string;
    lastName: string;
    email: string;
    salary: number | null;
  };
}

// --- Badge Helpers ---
function getOTStatusBadge(status: string) {
  const map: Record<string, string> = {
    pending: 'thb-badge thb-badge-warning',
    approved: 'thb-badge thb-badge-success',
    rejected: 'thb-badge thb-badge-error',
    processed: 'thb-badge thb-badge-info',
  };
  return map[status] || 'thb-badge thb-badge-info';
}

function getRateTypeBadge(type: string) {
  const map: Record<string, string> = {
    FLAT: 'thb-badge thb-badge-info',
    HOURLY_RATE: 'thb-badge thb-badge-success',
    PERCENTAGE_OF_BASIC: 'thb-badge thb-badge-purple',
  };
  return map[type] || 'thb-badge thb-badge-info';
}

// --- Constants ---
const RATE_TYPE_OPTIONS = [
  { value: 'FLAT', label: 'Flat Amount' },
  { value: 'HOURLY_RATE', label: 'Hourly Rate' },
  { value: 'PERCENTAGE_OF_BASIC', label: '% of Basic Salary' },
];

const OT_STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'processed', label: 'Processed' },
];

const emptyForm = {
  employeeId: '',
  date: '',
  hours: '' as string,
  rateType: 'HOURLY_RATE',
  rate: '' as string,
  amount: '' as string,
  reason: '',
  project: '',
};

// --- Amount Calculator ---
function calculateAmount(rateType: string, hours: number, rate: number, basicSalary?: number): number {
  if (rateType === 'FLAT') return rate;
  if (rateType === 'HOURLY_RATE') return hours * rate;
  if (rateType === 'PERCENTAGE_OF_BASIC') return ((basicSalary || 0) * rate) / 100;
  return 0;
}

export default function OvertimePage() {
  const { user } = useAuthStore();
  const effectiveCompanyId = useCompanyContextStore(s => s.effectiveCompanyId);
  const isAdmin = user?.role === 'super_admin' || user?.role === 'tenant_admin' || user?.role === 'admin';

  const [records, setRecords] = useState<OvertimeRecord[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [employeeFilter, setEmployeeFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  // Form state
  const [form, setForm] = useState({ ...emptyForm });

  // --- Computed amount from form ---
  const selectedEmployee = employees.find(e => e.employeeId === form.employeeId);
  const computedAmount = calculateAmount(
    form.rateType,
    parseFloat(form.hours) || 0,
    parseFloat(form.rate) || 0,
    selectedEmployee?.salary || undefined,
  );

  // --- Data Fetching ---
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
          salary: (e.salary as number) || undefined,
        })));
      }
    } catch {
      // Silently fail
    }
  }, []);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (employeeFilter) params.set('employeeId', employeeFilter);
      if (dateFilter) params.set('dateFrom', dateFilter);
      const qs = params.toString();
      const url = `/api/payroll/overtime${qs ? `?${qs}` : ''}`;
      const res = await fetch(url, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setRecords(Array.isArray(data) ? data : data.data || []);
      }
    } catch {
      toast.error('Failed to load overtime records');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, employeeFilter, dateFilter]);
  const cid = effectiveCompanyId();
  const scopeQuery = cid ? `companyId=${cid}&` : '';


  useEffect(() => {
    queueMicrotask(() => {
      fetchData();
      fetchEmployees();
    });
  }, [fetchData, fetchEmployees]);

  // --- Computed Stats ---
  const totalRecords = records.length;
  const totalHours = records.reduce((sum, r) => sum + r.hours, 0);
  const totalAmount = records.reduce((sum, r) => sum + r.amount, 0);
  const pendingCount = records.filter(r => r.status === 'pending').length;

  // --- Filtered List ---
  const filteredRecords = records.filter(r => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const empName = r.employee ? `${r.employee.firstName} ${r.employee.lastName}`.toLowerCase() : '';
      if (
        !r.employeeId.toLowerCase().includes(q) &&
        !empName.includes(q) &&
        !(r.reason || '').toLowerCase().includes(q) &&
        !(r.project || '').toLowerCase().includes(q)
      ) return false;
    }
    return true;
  });

  // --- Employee name resolver ---
  const getEmployeeDisplay = (empId: string) => {
    const emp = employees.find(e => e.employeeId === empId || e.id === empId);
    if (emp) return `${emp.firstName} ${emp.lastName}`;
    return empId;
  };

  // --- Format Helpers ---
  const formatDate = (d: string) => d ? new Date(d).toLocaleDateString() : '—';
  const formatCurrency = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // --- Handlers ---
  const handleAddNew = () => {
    setForm({ ...emptyForm });
    setEditingId(null);
    setShowForm(true);
    setTimeout(() => document.getElementById('crud-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  const handleEdit = (item: OvertimeRecord) => {
    setForm({
      employeeId: item.employeeId,
      date: item.date ? new Date(item.date).toISOString().split('T')[0] : '',
      hours: String(item.hours),
      rateType: item.rateType,
      rate: String(item.rate),
      amount: String(item.amount),
      reason: item.reason || '',
      project: item.project || '',
    });
    setEditingId(item.id);
    setShowForm(true);
    setTimeout(() => document.getElementById('crud-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm({ ...emptyForm });
  };

  const handleSubmit = async () => {
    if (!form.employeeId.trim()) { toast.error('Employee is required'); return; }
    if (!form.date) { toast.error('Date is required'); return; }
    if (!form.hours || parseFloat(form.hours) <= 0) { toast.error('Hours must be greater than 0'); return; }

    setSubmitting(true);
    try {
      const payload = {
        employeeId: form.employeeId,
        date: form.date,
        hours: parseFloat(form.hours),
        rateType: form.rateType,
        rate: parseFloat(form.rate) || 0,
        amount: form.amount ? parseFloat(form.amount) : undefined,
        reason: form.reason || null,
        project: form.project || null,
      };

      if (editingId) {
        const res = await fetch(`/api/payroll/overtime/${editingId}?${scopeQuery}` , {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify(payload),
        });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed to update'); }
        toast.success('Overtime record updated successfully');
      } else {
        const res = await fetch(`/api/payroll/overtime?${scopeQuery}` , {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify(payload),
        });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed to create'); }
        toast.success('Overtime record created successfully');
      }
      handleCancelForm();
      fetchData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/payroll/overtime/${id}?${scopeQuery}` , { method: 'DELETE', headers: getAuthHeaders() });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed to delete'); }
      toast.success('Overtime record deleted successfully');
      setDeleteConfirmId(null);
      fetchData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setDeleting(false);
    }
  };

  // --- Approval Handlers ---
  const handleApprove = async (id: string) => {
    try {
      const res = await fetch(`/api/payroll/overtime/${id}?${scopeQuery}` , {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ status: 'approved' }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed to approve'); }
      toast.success('Overtime approved successfully');
      fetchData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to approve');
    }
  };

  const handleReject = async (id: string) => {
    try {
      const res = await fetch(`/api/payroll/overtime/${id}?${scopeQuery}` , {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ status: 'rejected' }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed to reject'); }
      toast.success('Overtime rejected');
      fetchData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to reject');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-thb-text-primary flex items-center gap-2">
            <FiClock className="w-6 h-6 text-amber-500" />
            Overtime Management
          </h1>
          <p className="text-thb-text-secondary mt-1">Track overtime hours, calculate payouts, and manage approvals</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => fetchData()}
            className="p-2.5 rounded-lg border border-thb-border text-thb-text-secondary hover:bg-slate-50 transition-colors"
            title="Refresh"
          >
            <FiRefreshCw className="w-4 h-4" />
          </button>
          {isAdmin && (
            <button
              onClick={handleAddNew}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-green-500 text-white rounded-lg hover:bg-green-600 font-medium text-sm shadow-sm shadow-green-500/25 transition-colors"
            >
              <FiPlus className="w-4 h-4" /> Add Overtime
            </button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="thb-card thb-card-hover p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
              <FiClock className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <p className="text-xs font-medium text-thb-text-secondary">Total Hours</p>
              <p className="text-xl font-bold text-thb-text-primary">{totalHours.toFixed(1)}</p>
            </div>
          </div>
        </div>
        <div className="thb-card thb-card-hover p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
              <FiDollarSign className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-xs font-medium text-thb-text-secondary">Total Amount</p>
              <p className="text-xl font-bold text-thb-text-primary">${formatCurrency(totalAmount)}</p>
            </div>
          </div>
        </div>
        <div className="thb-card thb-card-hover p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
              <FiList className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <p className="text-xs font-medium text-thb-text-secondary">Total Records</p>
              <p className="text-xl font-bold text-thb-text-primary">{totalRecords}</p>
            </div>
          </div>
        </div>
        <div className="thb-card thb-card-hover p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
              <FiCalendar className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <p className="text-xs font-medium text-thb-text-secondary">Pending Approvals</p>
              <p className="text-xl font-bold text-thb-text-primary">{pendingCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search / Filter Bar */}
      <div className="thb-card p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-thb-text-muted" />
            <input
              type="text"
              placeholder="Search by employee, reason, project..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 min-w-[150px]"
          >
            <option value="">All Statuses</option>
            {OT_STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select
            value={employeeFilter}
            onChange={(e) => setEmployeeFilter(e.target.value)}
            className="px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 min-w-[160px]"
          >
            <option value="">All Employees</option>
            {employees.map(e => (
              <option key={e.id} value={e.employeeId}>
                {e.firstName} {e.lastName} ({e.employeeId})
              </option>
            ))}
          </select>
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 min-w-[150px]"
            placeholder="Filter by date"
          />
        </div>
      </div>

      {/* Embedded Inline Form */}
      {showForm && (
        <div id="crud-form" className="thb-card border-l-4 border-l-green-500">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-thb-text-primary">
                {editingId ? 'Edit Overtime Record' : 'Create Overtime Record'}
              </h2>
              <button
                onClick={handleCancelForm}
                className="p-2 rounded-lg text-thb-text-muted hover:text-thb-text-primary hover:bg-slate-100 transition-colors"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>

            {/* Overtime Details */}
            <div className="mb-5">
              <h3 className="text-sm font-semibold text-thb-text-primary mb-3">Overtime Details</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Employee <span className="text-red-500 font-bold">*</span></label>
                  {employees.length > 0 ? (
                    <select
                      value={form.employeeId}
                      onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                    >
                      <option value="">Select Employee...</option>
                      {employees.map(e => (
                        <option key={e.id} value={e.employeeId}>
                          {e.firstName} {e.lastName} ({e.employeeId})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      required
                      value={form.employeeId}
                      onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                      placeholder="Enter Employee ID"
                    />
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Date <span className="text-red-500 font-bold">*</span></label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Hours <span className="text-red-500 font-bold">*</span></label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    value={form.hours}
                    onChange={(e) => setForm({ ...form, hours: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                    placeholder="e.g. 2, 3.5, 8"
                  />
                </div>
              </div>
            </div>

            {/* Rate & Amount */}
            <div className="mb-5">
              <h3 className="text-sm font-semibold text-thb-text-primary mb-3">Rate & Amount</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Rate Type</label>
                  <select
                    value={form.rateType}
                    onChange={(e) => setForm({ ...form, rateType: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                  >
                    {RATE_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">
                    Rate {form.rateType === 'FLAT' ? '(Amount)' : form.rateType === 'HOURLY_RATE' ? '($/hour)' : '(% of basic)'}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.rate}
                    onChange={(e) => setForm({ ...form, rate: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                    placeholder={
                      form.rateType === 'FLAT' ? 'e.g. 100' :
                      form.rateType === 'HOURLY_RATE' ? 'e.g. 25' :
                      'e.g. 1.5'
                    }
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Amount (Auto-calculated)</label>
                  <div className="w-full px-3 py-2.5 rounded-lg border border-thb-border bg-slate-50 text-sm text-thb-text-primary font-semibold">
                    {computedAmount > 0 ? `$${formatCurrency(computedAmount)}` : '—'}
                  </div>
                  <p className="text-xs text-thb-text-muted mt-1">Based on rate type, hours & rate</p>
                </div>
              </div>
            </div>

            {/* Reason & Project */}
            <div className="mb-5">
              <h3 className="text-sm font-semibold text-thb-text-primary mb-3">Additional Info</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Project</label>
                  <input
                    value={form.project}
                    onChange={(e) => setForm({ ...form, project: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                    placeholder="e.g. Project Alpha, Client Name"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Reason</label>
                  <textarea
                    value={form.reason}
                    onChange={(e) => setForm({ ...form, reason: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 resize-none"
                    placeholder="Reason for overtime..."
                  />
                </div>
              </div>
            </div>

            {/* Form Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-thb-border">
              <button
                onClick={handleCancelForm}
                className="px-4 py-2.5 rounded-lg border border-thb-border text-sm font-medium text-thb-text-secondary hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="px-6 py-2.5 rounded-lg bg-green-500 text-white text-sm font-medium hover:bg-green-600 disabled:opacity-50 shadow-sm shadow-green-500/25 transition-colors"
              >
                {submitting ? 'Saving...' : editingId ? 'Update Overtime' : 'Create Overtime'}
              </button>
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
          <FiClock className="w-12 h-12 text-thb-text-muted mx-auto mb-3" />
          <p className="text-thb-text-secondary font-medium">No overtime records found</p>
          <p className="text-sm text-thb-text-muted mt-1">Create your first overtime record to get started</p>
        </div>
      ) : (
        <div className="thb-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px]">
              <thead className="bg-slate-50 border-b border-thb-border">
                <tr>
                  {['Employee', 'Date', 'Hours', 'Rate Type', 'Rate', 'Amount', 'Project', 'Status', 'Actions'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-thb-text-muted uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRecords.map((item) => (
                  deleteConfirmId === item.id ? (
                    <tr key={item.id} className="bg-red-50">
                      <td colSpan={9} className="px-4 py-3">
                        <p className="text-sm text-red-700 font-medium mb-2">
                          Are you sure you want to delete this overtime record ({item.hours}h on {formatDate(item.date)})?
                        </p>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleDelete(item.id)}
                            disabled={deleting}
                            className="px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                          >
                            {deleting ? 'Deleting...' : 'Delete'}
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(null)}
                            className="px-3 py-1.5 border border-thb-border text-xs font-medium rounded-lg text-thb-text-secondary hover:bg-slate-50 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
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
                        <span className="text-sm text-thb-text-secondary">{formatDate(item.date)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium text-thb-text-primary">{item.hours}h</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={getRateTypeBadge(item.rateType)}>
                          {item.rateType === 'FLAT' ? 'Flat' : item.rateType === 'HOURLY_RATE' ? 'Hourly' : '% Basic'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-thb-text-secondary">
                          {item.rateType === 'FLAT' ? `$${item.rate}` : item.rateType === 'HOURLY_RATE' ? `$${item.rate}/hr` : `${item.rate}%`}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium text-thb-text-primary">${formatCurrency(item.amount)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-thb-text-secondary truncate max-w-[120px] block">{item.project || '—'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={getOTStatusBadge(item.status)}>
                          {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {isAdmin && item.status === 'pending' && (
                            <>
                              <button
                                onClick={() => handleApprove(item.id)}
                                className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors"
                                title="Approve"
                              >
                                <FiCheck className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleReject(item.id)}
                                className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
                                title="Reject"
                              >
                                <FiXCircle className="w-4 h-4" />
                              </button>
                            </>
                          )}
                          {isAdmin && (
                            <button
                              onClick={() => handleEdit(item)}
                              className="p-1.5 rounded-lg text-thb-text-secondary hover:bg-slate-100 transition-colors"
                              title="Edit"
                            >
                              <FiEdit2 className="w-4 h-4" />
                            </button>
                          )}
                          {isAdmin && item.status === 'pending' && (
                            <button
                              onClick={() => setDeleteConfirmId(item.id)}
                              className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
                              title="Delete"
                            >
                              <FiTrash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
