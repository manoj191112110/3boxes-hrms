'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  FiPlus, FiX, FiTrash2, FiEdit2, FiCheck, FiXCircle,
  FiSearch, FiRefreshCw, FiDollarSign, FiClock, FiCheckCircle,
  FiList, FiUser, FiAlertTriangle,
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
}

interface Loan {
  id: string;
  employeeId: string;
  loanType: string;
  loanAmount: number;
  interestRate: number;
  tenureMonths: number;
  emiAmount: number;
  outstandingBalance: number;
  disbursedAmount: number;
  disbursedDate: string | null;
  startDate: string;
  endDate: string | null;
  recoveredAmount: number;
  remainingEmis: number;
  status: string;
  approvedBy: string | null;
  approvedAt: string | null;
  remarks: string | null;
  createdAt: string;
  updatedAt: string;
  employee?: {
    id: string;
    employeeId: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

// --- Badge Helpers ---
function getLoanStatusBadge(status: string) {
  const map: Record<string, string> = {
    pending: 'thb-badge thb-badge-warning',
    approved: 'thb-badge thb-badge-success',
    active: 'thb-badge thb-badge-success',
    completed: 'thb-badge thb-badge-info',
    cancelled: 'thb-badge thb-badge-error',
    defaulted: 'thb-badge thb-badge-error',
    rejected: 'thb-badge thb-badge-error',
  };
  return map[status] || 'thb-badge thb-badge-info';
}

function getLoanTypeBadge(type: string) {
  const map: Record<string, string> = {
    PERSONAL: 'thb-badge thb-badge-info',
    EMERGENCY: 'thb-badge thb-badge-error',
    HOUSING: 'thb-badge thb-badge-success',
    VEHICLE: 'thb-badge thb-badge-purple',
    EDUCATION: 'thb-badge thb-badge-primary',
    FESTIVAL: 'thb-badge thb-badge-warning',
    OTHER: 'thb-badge thb-badge-info',
  };
  return map[type] || 'thb-badge thb-badge-info';
}

// --- Constants ---
const LOAN_TYPE_OPTIONS = [
  { value: 'PERSONAL', label: 'Personal' },
  { value: 'EMERGENCY', label: 'Emergency' },
  { value: 'HOUSING', label: 'Housing' },
  { value: 'VEHICLE', label: 'Vehicle' },
  { value: 'EDUCATION', label: 'Education' },
  { value: 'FESTIVAL', label: 'Festival' },
  { value: 'OTHER', label: 'Other' },
];

const LOAN_STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'defaulted', label: 'Defaulted' },
  { value: 'rejected', label: 'Rejected' },
];

const emptyForm = {
  employeeId: '',
  loanType: 'PERSONAL',
  loanAmount: '' as string,
  interestRate: '' as string,
  tenureMonths: '' as string,
  emiAmount: '' as string,
  startDate: '',
  endDate: '',
  disbursedAmount: '' as string,
  disbursedDate: '',
  remarks: '',
};

// --- EMI Calculator ---
function calculateEMI(principal: number, rate: number, months: number): number {
  if (principal <= 0 || months <= 0) return 0;
  if (rate === 0) return principal / months;
  const monthlyRate = rate / 12 / 100;
  const factor = Math.pow(1 + monthlyRate, months);
  return (principal * monthlyRate * factor) / (factor - 1);
}

export default function LoansPage() {
  const { user } = useAuthStore();
  const effectiveCompanyId = useCompanyContextStore(s => s.effectiveCompanyId);
  const isAdmin = user?.role === 'super_admin' || user?.role === 'tenant_admin' || user?.role === 'admin';

  const [loans, setLoans] = useState<Loan[]>([]);
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
  const [loanTypeFilter, setLoanTypeFilter] = useState('');
  const [employeeFilter, setEmployeeFilter] = useState('');

  // Form state
  const [form, setForm] = useState({ ...emptyForm });

  // --- Computed EMI from form ---
  const computedEmi = calculateEMI(
    parseFloat(form.loanAmount) || 0,
    parseFloat(form.interestRate) || 0,
    parseInt(form.tenureMonths) || 0,
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
      if (loanTypeFilter) params.set('loanType', loanTypeFilter);
      if (employeeFilter) params.set('employeeId', employeeFilter);
      const qs = params.toString();
      const url = `/api/payroll/loans${qs ? `?${qs}` : ''}`;
      const res = await fetch(url, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setLoans(Array.isArray(data) ? data : data.data || []);
      }
    } catch {
      toast.error('Failed to load loans');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, loanTypeFilter, employeeFilter]);
  const cid = effectiveCompanyId();
  const scopeQuery = cid ? `companyId=${cid}&` : '';


  useEffect(() => {
    queueMicrotask(() => {
      fetchData();
      fetchEmployees();
    });
  }, [fetchData, fetchEmployees]);

  // --- Computed Stats ---
  const totalLoans = loans.length;
  const activeLoans = loans.filter(l => l.status === 'active');
  const activeCount = activeLoans.length;
  const pendingCount = loans.filter(l => l.status === 'pending').length;
  const totalOutstanding = activeLoans.reduce((sum, l) => sum + l.outstandingBalance, 0);

  // --- Filtered List ---
  const filteredLoans = loans.filter(l => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const empName = l.employee ? `${l.employee.firstName} ${l.employee.lastName}`.toLowerCase() : '';
      if (
        !l.employeeId.toLowerCase().includes(q) &&
        !empName.includes(q) &&
        !l.loanType.toLowerCase().includes(q) &&
        !(l.remarks || '').toLowerCase().includes(q)
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
  const formatDate = (d: string | null) => d ? new Date(d).toLocaleDateString() : '—';
  const formatCurrency = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // --- Handlers ---
  const handleAddNew = () => {
    setForm({ ...emptyForm });
    setEditingId(null);
    setShowForm(true);
    setTimeout(() => document.getElementById('crud-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  const handleEdit = (item: Loan) => {
    setForm({
      employeeId: item.employeeId,
      loanType: item.loanType,
      loanAmount: String(item.loanAmount),
      interestRate: String(item.interestRate),
      tenureMonths: String(item.tenureMonths),
      emiAmount: String(item.emiAmount),
      startDate: item.startDate ? new Date(item.startDate).toISOString().split('T')[0] : '',
      endDate: item.endDate ? new Date(item.endDate).toISOString().split('T')[0] : '',
      disbursedAmount: String(item.disbursedAmount),
      disbursedDate: item.disbursedDate ? new Date(item.disbursedDate).toISOString().split('T')[0] : '',
      remarks: item.remarks || '',
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
    if (!form.loanAmount || parseFloat(form.loanAmount) <= 0) { toast.error('Loan amount must be greater than 0'); return; }
    if (!form.tenureMonths || parseInt(form.tenureMonths) <= 0) { toast.error('Tenure months must be greater than 0'); return; }
    if (!form.startDate) { toast.error('Start date is required'); return; }

    setSubmitting(true);
    try {
      const payload = {
        employeeId: form.employeeId,
        loanType: form.loanType,
        loanAmount: parseFloat(form.loanAmount),
        interestRate: parseFloat(form.interestRate) || 0,
        tenureMonths: parseInt(form.tenureMonths),
        startDate: form.startDate,
        endDate: form.endDate || null,
        disbursedAmount: form.disbursedAmount ? parseFloat(form.disbursedAmount) : undefined,
        disbursedDate: form.disbursedDate || null,
        remarks: form.remarks || null,
      };

      if (editingId) {
        const res = await fetch(`/api/payroll/loans/${editingId}?${scopeQuery}` , {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify(payload),
        });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed to update'); }
        toast.success('Loan updated successfully');
      } else {
        const res = await fetch(`/api/payroll/loans?${scopeQuery}` , {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify(payload),
        });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed to create'); }
        toast.success('Loan created successfully');
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
      const res = await fetch(`/api/payroll/loans/${id}?${scopeQuery}` , { method: 'DELETE', headers: getAuthHeaders() });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed to delete'); }
      toast.success('Loan deleted successfully');
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
      const res = await fetch(`/api/payroll/loans/${id}?${scopeQuery}` , {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ status: 'approved' }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed to approve'); }
      toast.success('Loan approved successfully');
      fetchData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to approve');
    }
  };

  const handleReject = async (id: string) => {
    try {
      const res = await fetch(`/api/payroll/loans/${id}?${scopeQuery}` , {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ status: 'rejected' }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed to reject'); }
      toast.success('Loan rejected');
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
            <FiDollarSign className="w-6 h-6 text-emerald-500" />
            Loan Management
          </h1>
          <p className="text-thb-text-secondary mt-1">Manage employee loans, EMIs, and repayment tracking</p>
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
              <FiPlus className="w-4 h-4" /> Add Loan
            </button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="thb-card thb-card-hover p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
              <FiList className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-xs font-medium text-thb-text-secondary">Total Loans</p>
              <p className="text-xl font-bold text-thb-text-primary">{totalLoans}</p>
            </div>
          </div>
        </div>
        <div className="thb-card thb-card-hover p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
              <FiCheckCircle className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <p className="text-xs font-medium text-thb-text-secondary">Active Loans</p>
              <p className="text-xl font-bold text-thb-text-primary">{activeCount}</p>
            </div>
          </div>
        </div>
        <div className="thb-card thb-card-hover p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
              <FiClock className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <p className="text-xs font-medium text-thb-text-secondary">Pending Approval</p>
              <p className="text-xl font-bold text-thb-text-primary">{pendingCount}</p>
            </div>
          </div>
        </div>
        <div className="thb-card thb-card-hover p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center">
              <FiAlertTriangle className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <p className="text-xs font-medium text-thb-text-secondary">Total Outstanding</p>
              <p className="text-xl font-bold text-thb-text-primary">${formatCurrency(totalOutstanding)}</p>
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
              placeholder="Search by employee, loan type, remarks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
            />
          </div>
          <select
            value={loanTypeFilter}
            onChange={(e) => setLoanTypeFilter(e.target.value)}
            className="px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 min-w-[150px]"
          >
            <option value="">All Loan Types</option>
            {LOAN_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 min-w-[150px]"
          >
            <option value="">All Statuses</option>
            {LOAN_STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
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
        </div>
      </div>

      {/* Embedded Inline Form */}
      {showForm && (
        <div id="crud-form" className="thb-card border-l-4 border-l-green-500">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-thb-text-primary">
                {editingId ? 'Edit Loan' : 'Create Loan'}
              </h2>
              <button
                onClick={handleCancelForm}
                className="p-2 rounded-lg text-thb-text-muted hover:text-thb-text-primary hover:bg-slate-100 transition-colors"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>

            {/* Loan Details */}
            <div className="mb-5">
              <h3 className="text-sm font-semibold text-thb-text-primary mb-3">Loan Details</h3>
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
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Loan Type</label>
                  <select
                    value={form.loanType}
                    onChange={(e) => setForm({ ...form, loanType: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                  >
                    {LOAN_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Loan Amount <span className="text-red-500 font-bold">*</span></label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.loanAmount}
                    onChange={(e) => setForm({ ...form, loanAmount: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                    placeholder="e.g. 50000"
                  />
                </div>
              </div>
            </div>

            {/* EMI Calculation */}
            <div className="mb-5">
              <h3 className="text-sm font-semibold text-thb-text-primary mb-3">EMI Calculation</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Interest Rate (% p.a.)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.interestRate}
                    onChange={(e) => setForm({ ...form, interestRate: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                    placeholder="e.g. 8.5"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Tenure (Months) <span className="text-red-500 font-bold">*</span></label>
                  <input
                    type="number"
                    min="1"
                    value={form.tenureMonths}
                    onChange={(e) => setForm({ ...form, tenureMonths: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                    placeholder="e.g. 12, 24, 36"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">EMI Amount (Auto-calculated)</label>
                  <div className="w-full px-3 py-2.5 rounded-lg border border-thb-border bg-slate-50 text-sm text-thb-text-primary font-semibold">
                    {computedEmi > 0 ? `$${formatCurrency(computedEmi)}` : '—'}
                  </div>
                  <p className="text-xs text-thb-text-muted mt-1">Calculated based on amount, rate & tenure</p>
                </div>
              </div>
            </div>

            {/* Dates */}
            <div className="mb-5">
              <h3 className="text-sm font-semibold text-thb-text-primary mb-3">Dates</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Start Date <span className="text-red-500 font-bold">*</span></label>
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">End Date</label>
                  <input
                    type="date"
                    value={form.endDate}
                    onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Disbursement Date</label>
                  <input
                    type="date"
                    value={form.disbursedDate}
                    onChange={(e) => setForm({ ...form, disbursedDate: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                  />
                </div>
              </div>
            </div>

            {/* Remarks */}
            <div className="mb-5">
              <h3 className="text-sm font-semibold text-thb-text-primary mb-3">Additional</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Disbursed Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.disbursedAmount}
                    onChange={(e) => setForm({ ...form, disbursedAmount: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                    placeholder="Defaults to loan amount"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Remarks</label>
                  <textarea
                    value={form.remarks}
                    onChange={(e) => setForm({ ...form, remarks: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 resize-none"
                    placeholder="Additional notes..."
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
                {submitting ? 'Saving...' : editingId ? 'Update Loan' : 'Create Loan'}
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
      ) : filteredLoans.length === 0 ? (
        <div className="thb-card p-12 text-center">
          <FiDollarSign className="w-12 h-12 text-thb-text-muted mx-auto mb-3" />
          <p className="text-thb-text-secondary font-medium">No loans found</p>
          <p className="text-sm text-thb-text-muted mt-1">Create your first loan to get started</p>
        </div>
      ) : (
        <div className="thb-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px]">
              <thead className="bg-slate-50 border-b border-thb-border">
                <tr>
                  {['Employee', 'Type', 'Amount', 'EMI', 'Outstanding', 'Tenure', 'Remaining', 'Start Date', 'Status', 'Actions'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-thb-text-muted uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLoans.map((item) => (
                  deleteConfirmId === item.id ? (
                    <tr key={item.id} className="bg-red-50">
                      <td colSpan={10} className="px-4 py-3">
                        <p className="text-sm text-red-700 font-medium mb-2">
                          Are you sure you want to delete this {item.loanType} loan of ${formatCurrency(item.loanAmount)}?
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
                        <span className={getLoanTypeBadge(item.loanType)}>
                          {item.loanType}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium text-thb-text-primary">${formatCurrency(item.loanAmount)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium text-thb-text-primary">${formatCurrency(item.emiAmount)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium text-thb-text-primary">${formatCurrency(item.outstandingBalance)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-thb-text-secondary">{item.tenureMonths} mo</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-thb-text-secondary">{item.remainingEmis} EMIs</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-thb-text-secondary">{formatDate(item.startDate)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={getLoanStatusBadge(item.status)}>
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
