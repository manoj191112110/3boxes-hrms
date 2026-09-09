'use client';

import { useAuthStore } from '@/store/authStore';
import { useCallback, useEffect, useState } from 'react';
import { FiCreditCard, FiPlus, FiEdit2, FiTrash2, FiEye, FiX, FiSearch, FiRefreshCw, FiUser, FiStar } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useCompanyContextStore } from '@/store/companyContextStore';

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

// --- Types ---
interface EmployeeInfo {
  id: string;
  firstName: string;
  lastName: string;
  employeeId: string;
  email: string;
}

interface EmployeePaymentMethod {
  id: string;
  employeeId: string;
  employee?: EmployeeInfo;
  paymentType: string;
  bankName: string | null;
  bankAccountNo: string | null;
  bankIfscCode: string | null;
  bankBranch: string | null;
  accountType: string | null;
  currencyCode: string;
  splitType: string | null;
  splitValue: number | null;
  isPrimary: boolean;
  priority: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

// --- Badge Helpers ---
function getPaymentTypeBadge(type: string) {
  const map: Record<string, string> = {
    DIRECT_DEPOSIT: 'thb-badge thb-badge-info',
    CHEQUE: 'thb-badge thb-badge-warning',
    CASH: 'thb-badge thb-badge-success',
  };
  return map[type] || 'thb-badge thb-badge-info';
}

function getSplitTypeBadge(type: string) {
  const map: Record<string, string> = {
    PERCENTAGE: 'thb-badge thb-badge-purple',
    FIXED_AMOUNT: 'thb-badge thb-badge-warning',
  };
  return map[type] || 'thb-badge thb-badge-info';
}

function getStatusBadge(status: string) {
  return status === 'active' ? 'thb-badge thb-badge-success' : 'thb-badge thb-badge-error';
}

// --- Constants ---
const CURRENCY_OPTIONS = [
  { value: 'INR', label: 'INR (₹)' },
  { value: 'USD', label: 'USD ($)' },
  { value: 'GBP', label: 'GBP (£)' },
  { value: 'SGD', label: 'SGD (S$)' },
  { value: 'AED', label: 'AED (د.إ)' },
  { value: 'AUD', label: 'AUD (A$)' },
];

const PAYMENT_TYPE_OPTIONS = [
  { value: 'DIRECT_DEPOSIT', label: 'Direct Deposit' },
  { value: 'CHEQUE', label: 'Cheque' },
  { value: 'CASH', label: 'Cash' },
];

const ACCOUNT_TYPE_OPTIONS = [
  { value: 'SAVINGS', label: 'Savings' },
  { value: 'CURRENT', label: 'Current' },
  { value: 'SALARY', label: 'Salary' },
];

const SPLIT_TYPE_OPTIONS = [
  { value: '', label: 'None (Full Amount)' },
  { value: 'PERCENTAGE', label: 'Percentage' },
  { value: 'FIXED_AMOUNT', label: 'Fixed Amount' },
];

// --- View Panel Detail Item ---
function DetailItem({ label, value, badge }: { label: string; value: string | number | boolean | null | undefined; badge?: string }) {
  return (
    <div>
      <span className="text-xs font-medium text-thb-text-secondary">{label}</span>
      {badge ? (
        <p className="mt-0.5"><span className={badge}>{value != null ? String(value).replace(/_/g, ' ') : '—'}</span></p>
      ) : (
        <p className="text-sm font-medium text-thb-text-primary mt-0.5">
          {value === true ? 'Yes' : value === false ? 'No' : value != null && value !== '' ? String(value) : '—'}
        </p>
      )}
    </div>
  );
}

const emptyForm = {
  employeeId: '',
  paymentType: 'DIRECT_DEPOSIT',
  bankName: '',
  bankAccountNo: '',
  bankIfscCode: '',
  bankBranch: '',
  accountType: 'SAVINGS',
  currencyCode: 'INR',
  splitType: '',
  splitValue: '' as string,
  isPrimary: true,
  priority: 1,
  effectiveFrom: '',
  effectiveTo: '',
  status: 'active',
};

export default function EmployeePaymentMethodsPage() {
  const { user } = useAuthStore();
  const effectiveCompanyId = useCompanyContextStore(s => s.effectiveCompanyId);
  const isAdmin = user?.role === 'super_admin' || user?.role === 'tenant_admin' || user?.role === 'admin';

  const [paymentMethods, setPaymentMethods] = useState<EmployeePaymentMethod[]>([]);
  const [employees, setEmployees] = useState<EmployeeInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [viewingMethod, setViewingMethod] = useState<EmployeePaymentMethod | null>(null);
  const [viewLoading, setViewLoading] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [employeeFilter, setEmployeeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [paymentTypeFilter, setPaymentTypeFilter] = useState('');
  const [primaryFilter, setPrimaryFilter] = useState('');

  // Form state
  const [form, setForm] = useState({ ...emptyForm });

  // --- Data Fetching ---
  const fetchEmployees = useCallback(async () => {
    try {
      const res = await fetch(`/api/employees?${scopeQuery}limit=500`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : data.data || data.employees || [];
        setEmployees(list.map((e: Record<string, unknown>) => ({
          id: e.id as string,
          firstName: e.firstName as string,
          lastName: e.lastName as string,
          employeeId: e.employeeId as string,
          email: e.email as string,
        })));
      }
    } catch {
      // Silently fail - employees are for dropdown only
    }
  }, []);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (employeeFilter) params.set('employeeId', employeeFilter);
      if (statusFilter) params.set('status', statusFilter);
      if (paymentTypeFilter) params.set('paymentType', paymentTypeFilter);
      if (primaryFilter) params.set('isPrimary', primaryFilter);
      const qs = params.toString();
      const url = `/api/payroll/payment-methods${qs ? `?${qs}` : ''}`;
      const res = await fetch(url, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setPaymentMethods(Array.isArray(data) ? data : data.data || []);
      }
    } catch {
      toast.error('Failed to load payment methods');
    } finally {
      setLoading(false);
    }
  }, [employeeFilter, statusFilter, paymentTypeFilter, primaryFilter]);
  const cid = effectiveCompanyId();
  const scopeQuery = cid ? `companyId=${cid}&` : '';


  useEffect(() => { queueMicrotask(() => { fetchEmployees(); fetchData(); }); }, [fetchEmployees, fetchData]);

  // --- Computed Stats ---
  const totalMethods = paymentMethods.length;
  const primaryCount = paymentMethods.filter(m => m.isPrimary).length;
  const secondaryCount = paymentMethods.filter(m => !m.isPrimary).length;
  const depositCount = paymentMethods.filter(m => m.paymentType === 'DIRECT_DEPOSIT').length;

  // --- Filtered List ---
  const filteredMethods = paymentMethods.filter(m => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const empName = m.employee ? `${m.employee.firstName} ${m.employee.lastName}`.toLowerCase() : '';
      const empId = m.employee?.employeeId?.toLowerCase() || '';
      if (!empName.includes(q) && !empId.includes(q) && !(m.bankName || '').toLowerCase().includes(q)) return false;
    }
    return true;
  });

  // --- Handlers ---
  const handleAddNew = () => {
    setForm({ ...emptyForm });
    setEditingId(null);
    setShowForm(true);
    setViewingMethod(null);
    setTimeout(() => document.getElementById('crud-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  const handleEdit = (m: EmployeePaymentMethod) => {
    setForm({
      employeeId: m.employeeId,
      paymentType: m.paymentType,
      bankName: m.bankName || '',
      bankAccountNo: m.bankAccountNo || '',
      bankIfscCode: m.bankIfscCode || '',
      bankBranch: m.bankBranch || '',
      accountType: m.accountType || 'SAVINGS',
      currencyCode: m.currencyCode,
      splitType: m.splitType || '',
      splitValue: m.splitValue != null ? String(m.splitValue) : '',
      isPrimary: m.isPrimary,
      priority: m.priority,
      effectiveFrom: m.effectiveFrom ? new Date(m.effectiveFrom).toISOString().split('T')[0] : '',
      effectiveTo: m.effectiveTo ? new Date(m.effectiveTo).toISOString().split('T')[0] : '',
      status: m.status,
    });
    setEditingId(m.id);
    setShowForm(true);
    setViewingMethod(null);
    setTimeout(() => document.getElementById('crud-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm({ ...emptyForm });
  };

  const handleView = async (m: EmployeePaymentMethod) => {
    setViewLoading(true);
    setViewingMethod(null);
    try {
      const res = await fetch(`/api/payroll/payment-methods/${m.id}?${scopeQuery}` , { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setViewingMethod(data.data || data);
      } else {
        setViewingMethod(m);
      }
    } catch {
      setViewingMethod(m);
    } finally {
      setViewLoading(false);
      setShowForm(false);
      setTimeout(() => document.getElementById('view-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    }
  };

  const handleSubmit = async () => {
    if (!form.employeeId.trim()) { toast.error('Employee is required'); return; }

    setSubmitting(true);
    try {
      const payload = {
        ...form,
        bankName: form.bankName || null,
        bankAccountNo: form.bankAccountNo || null,
        bankIfscCode: form.bankIfscCode || null,
        bankBranch: form.bankBranch || null,
        accountType: form.accountType || null,
        splitType: form.splitType || null,
        splitValue: form.splitValue ? parseFloat(form.splitValue) : null,
        priority: Number(form.priority),
        effectiveFrom: form.effectiveFrom ? new Date(form.effectiveFrom).toISOString() : new Date().toISOString(),
        effectiveTo: form.effectiveTo ? new Date(form.effectiveTo).toISOString() : null,
      };

      if (editingId) {
        const res = await fetch(`/api/payroll/payment-methods/${editingId}?${scopeQuery}` , {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify(payload),
        });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed to update'); }
        toast.success('Payment method updated successfully');
      } else {
        const res = await fetch(`/api/payroll/payment-methods?${scopeQuery}` , {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify(payload),
        });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed to create'); }
        toast.success('Payment method created successfully');
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
      const res = await fetch(`/api/payroll/payment-methods/${id}?${scopeQuery}` , { method: 'DELETE', headers: getAuthHeaders() });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed to delete'); }
      toast.success('Payment method deactivated successfully');
      setDeleteConfirmId(null);
      if (viewingMethod?.id === id) { setViewingMethod(null); }
      fetchData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setDeleting(false);
    }
  };

  // --- Format Helpers ---
  const formatPaymentType = (t: string) => t.replace(/_/g, ' ');
  const getEmployeeName = (m: EmployeePaymentMethod) => m.employee ? `${m.employee.firstName} ${m.employee.lastName}` : m.employeeId;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-thb-text-primary flex items-center gap-2">
            <FiCreditCard className="w-6 h-6 text-green-500" />
            Employee Payment Methods
          </h1>
          <p className="text-thb-text-secondary mt-1">Manage bank details and split payment configurations for employees</p>
        </div>
        <div className="flex items-center gap-2">
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
              <FiPlus className="w-4 h-4" /> Add Payment Method
            </button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="thb-card thb-card-hover p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
              <FiCreditCard className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <p className="text-xs font-medium text-thb-text-secondary">Total Methods</p>
              <p className="text-xl font-bold text-thb-text-primary">{totalMethods}</p>
            </div>
          </div>
        </div>
        <div className="thb-card thb-card-hover p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
              <FiStar className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <p className="text-xs font-medium text-thb-text-secondary">Primary</p>
              <p className="text-xl font-bold text-thb-text-primary">{primaryCount}</p>
            </div>
          </div>
        </div>
        <div className="thb-card thb-card-hover p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-slate-50 flex items-center justify-center">
              <FiCreditCard className="w-5 h-5 text-slate-500" />
            </div>
            <div>
              <p className="text-xs font-medium text-thb-text-secondary">Secondary</p>
              <p className="text-xl font-bold text-thb-text-primary">{secondaryCount}</p>
            </div>
          </div>
        </div>
        <div className="thb-card thb-card-hover p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
              <FiCreditCard className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-xs font-medium text-thb-text-secondary">Direct Deposit</p>
              <p className="text-xl font-bold text-thb-text-primary">{depositCount}</p>
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
              placeholder="Search by employee name, ID, or bank..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
            />
          </div>
          <select
            value={employeeFilter}
            onChange={(e) => setEmployeeFilter(e.target.value)}
            className="px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 min-w-[180px]"
          >
            <option value="">All Employees</option>
            {employees.map(e => <option key={e.id} value={e.id}>{e.firstName} {e.lastName} ({e.employeeId})</option>)}
          </select>
          <select
            value={paymentTypeFilter}
            onChange={(e) => setPaymentTypeFilter(e.target.value)}
            className="px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 min-w-[150px]"
          >
            <option value="">All Types</option>
            {PAYMENT_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select
            value={primaryFilter}
            onChange={(e) => setPrimaryFilter(e.target.value)}
            className="px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 min-w-[140px]"
          >
            <option value="">All Priority</option>
            <option value="true">Primary</option>
            <option value="false">Secondary</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 min-w-[130px]"
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      {/* View Panel */}
      {viewingMethod && (
        <div id="view-panel" className="thb-card border-l-4 border-l-emerald-500">
          <div className="p-6">
            {viewLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-500" />
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-lg font-semibold text-thb-text-primary flex items-center gap-2">
                      {getEmployeeName(viewingMethod)}
                      {viewingMethod.isPrimary && (
                        <span className="thb-badge thb-badge-warning text-[10px]">Primary</span>
                      )}
                    </h2>
                    <p className="text-sm text-thb-text-secondary mt-0.5">
                      {formatPaymentType(viewingMethod.paymentType)} &middot; {viewingMethod.currencyCode}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {isAdmin && (
                      <button
                        onClick={() => handleEdit(viewingMethod)}
                        className="px-3 py-1.5 rounded-lg bg-green-500 text-white text-xs font-medium hover:bg-green-600 transition-colors flex items-center gap-1"
                      >
                        <FiEdit2 className="w-3.5 h-3.5" /> Edit
                      </button>
                    )}
                    <button
                      onClick={() => setViewingMethod(null)}
                      className="p-2 rounded-lg text-thb-text-muted hover:text-thb-text-primary hover:bg-slate-100 transition-colors"
                    >
                      <FiX className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <DetailItem label="Employee" value={getEmployeeName(viewingMethod)} />
                  <DetailItem label="Payment Type" value={formatPaymentType(viewingMethod.paymentType)} badge={getPaymentTypeBadge(viewingMethod.paymentType)} />
                  <DetailItem label="Bank Name" value={viewingMethod.bankName} />
                  <DetailItem label="Account Number" value={viewingMethod.bankAccountNo} />
                  <DetailItem label="IFSC Code" value={viewingMethod.bankIfscCode} />
                  <DetailItem label="Branch" value={viewingMethod.bankBranch} />
                  <DetailItem label="Account Type" value={viewingMethod.accountType ? formatPaymentType(viewingMethod.accountType) : null} />
                  <DetailItem label="Currency" value={viewingMethod.currencyCode} />
                  <DetailItem label="Split Type" value={viewingMethod.splitType ? formatPaymentType(viewingMethod.splitType) : null} badge={viewingMethod.splitType ? getSplitTypeBadge(viewingMethod.splitType) : undefined} />
                  <DetailItem label="Split Value" value={viewingMethod.splitValue} />
                  <DetailItem label="Is Primary" value={viewingMethod.isPrimary} badge={viewingMethod.isPrimary ? 'thb-badge thb-badge-warning' : undefined} />
                  <DetailItem label="Priority" value={viewingMethod.priority} />
                  <DetailItem label="Status" value={viewingMethod.status} badge={getStatusBadge(viewingMethod.status)} />
                  <DetailItem label="Effective From" value={viewingMethod.effectiveFrom ? new Date(viewingMethod.effectiveFrom).toLocaleDateString() : null} />
                  <DetailItem label="Effective To" value={viewingMethod.effectiveTo ? new Date(viewingMethod.effectiveTo).toLocaleDateString() : null} />
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Embedded Inline Form */}
      {showForm && (
        <div id="crud-form" className="thb-card border-l-4 border-l-green-500">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-thb-text-primary">
                {editingId ? 'Edit Payment Method' : 'Create Payment Method'}
              </h2>
              <button
                onClick={handleCancelForm}
                className="p-2 rounded-lg text-thb-text-muted hover:text-thb-text-primary hover:bg-slate-100 transition-colors"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>

            {/* Employee & Payment Type */}
            <div className="mb-5">
              <h3 className="text-sm font-semibold text-thb-text-primary mb-3">Employee &amp; Payment Type</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Employee *</label>
                  <select
                    value={form.employeeId}
                    onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                  >
                    <option value="">Select Employee</option>
                    {employees.map(e => <option key={e.id} value={e.id}>{e.firstName} {e.lastName} ({e.employeeId})</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Payment Type</label>
                  <select
                    value={form.paymentType}
                    onChange={(e) => setForm({ ...form, paymentType: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                  >
                    {PAYMENT_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Currency</label>
                  <select
                    value={form.currencyCode}
                    onChange={(e) => setForm({ ...form, currencyCode: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                  >
                    {CURRENCY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Bank Details */}
            {form.paymentType === 'DIRECT_DEPOSIT' && (
              <div className="mb-5">
                <h3 className="text-sm font-semibold text-thb-text-primary mb-3">Bank Details</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-thb-text-secondary mb-1">Bank Name</label>
                    <input
                      value={form.bankName}
                      onChange={(e) => setForm({ ...form, bankName: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                      placeholder="e.g. HDFC Bank"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-thb-text-secondary mb-1">Account Number</label>
                    <input
                      value={form.bankAccountNo}
                      onChange={(e) => setForm({ ...form, bankAccountNo: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                      placeholder="e.g. 1234567890"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-thb-text-secondary mb-1">IFSC Code</label>
                    <input
                      value={form.bankIfscCode}
                      onChange={(e) => setForm({ ...form, bankIfscCode: e.target.value.toUpperCase() })}
                      className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                      placeholder="e.g. HDFC0001234"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-thb-text-secondary mb-1">Branch</label>
                    <input
                      value={form.bankBranch}
                      onChange={(e) => setForm({ ...form, bankBranch: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                      placeholder="e.g. Mumbai Branch"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-thb-text-secondary mb-1">Account Type</label>
                    <select
                      value={form.accountType}
                      onChange={(e) => setForm({ ...form, accountType: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                    >
                      {ACCOUNT_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Split Payment */}
            <div className="mb-5">
              <h3 className="text-sm font-semibold text-thb-text-primary mb-3">Split Payment Configuration</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Split Type</label>
                  <select
                    value={form.splitType}
                    onChange={(e) => setForm({ ...form, splitType: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                  >
                    {SPLIT_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                {form.splitType && (
                  <div>
                    <label className="block text-xs font-medium text-thb-text-secondary mb-1">
                      Split Value {form.splitType === 'PERCENTAGE' ? '(%)' : '(Amount)'}
                    </label>
                    <input
                      type="number"
                      step={form.splitType === 'PERCENTAGE' ? '1' : '0.01'}
                      min={0}
                      value={form.splitValue}
                      onChange={(e) => setForm({ ...form, splitValue: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                      placeholder={form.splitType === 'PERCENTAGE' ? 'e.g. 80' : 'e.g. 50000'}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Priority & Effective Dates */}
            <div className="mb-5">
              <h3 className="text-sm font-semibold text-thb-text-primary mb-3">Priority &amp; Effective Dates</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 text-sm text-thb-text-secondary cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.isPrimary}
                      onChange={(e) => setForm({ ...form, isPrimary: e.target.checked })}
                      className="rounded border-thb-border"
                    />
                    <span className="font-medium">Primary Payment Method</span>
                  </label>
                </div>
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Priority</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={form.priority}
                    onChange={(e) => setForm({ ...form, priority: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                    placeholder="1 = highest"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Effective From</label>
                  <input
                    type="date"
                    value={form.effectiveFrom}
                    onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Effective To</label>
                  <input
                    type="date"
                    value={form.effectiveTo}
                    onChange={(e) => setForm({ ...form, effectiveTo: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                  />
                </div>
              </div>
            </div>

            {/* Form Actions */}
            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-thb-border">
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
                {submitting ? 'Saving...' : editingId ? 'Update Payment Method' : 'Create Payment Method'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Data Table */}
      {loading ? (
        <div className="thb-card overflow-hidden">
          <div className="p-5 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-12 bg-slate-100 rounded animate-pulse" />
            ))}
          </div>
        </div>
      ) : filteredMethods.length === 0 ? (
        <div className="thb-card p-12 text-center">
          <FiCreditCard className="w-12 h-12 text-thb-text-muted mx-auto mb-3" />
          <p className="text-thb-text-secondary font-medium">No payment methods found</p>
          <p className="text-sm text-thb-text-muted mt-1">Add a payment method for an employee to get started</p>
        </div>
      ) : (
        <div className="thb-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-thb-border">
                <tr>
                  {['Employee', 'Type', 'Bank / Details', 'Split', 'Currency', 'Primary', 'Priority', 'Status', 'Actions'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-thb-text-muted uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredMethods.map((m) => (
                  deleteConfirmId === m.id ? (
                    <tr key={m.id} className="bg-red-50">
                      <td colSpan={9} className="px-4 py-3">
                        <p className="text-sm text-red-700 font-medium mb-2">
                          Are you sure you want to deactivate this payment method for &quot;{getEmployeeName(m)}&quot;?
                        </p>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleDelete(m.id)}
                            disabled={deleting}
                            className="px-3 py-1.5 bg-red-500 text-white text-xs font-medium rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors"
                          >
                            {deleting ? 'Deleting...' : 'Confirm'}
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(null)}
                            className="px-3 py-1.5 border border-thb-border text-xs font-medium rounded-lg hover:bg-slate-50 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <tr key={m.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-green-50 flex items-center justify-center">
                            <FiUser className="w-3.5 h-3.5 text-green-500" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-thb-text-primary">{getEmployeeName(m)}</p>
                            <p className="text-xs text-thb-text-muted">{m.employee?.employeeId}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={getPaymentTypeBadge(m.paymentType)}>{formatPaymentType(m.paymentType)}</span>
                      </td>
                      <td className="px-4 py-3">
                        {m.paymentType === 'DIRECT_DEPOSIT' ? (
                          <div>
                            <p className="text-sm text-thb-text-primary">{m.bankName || '—'}</p>
                            <p className="text-xs text-thb-text-muted">{m.bankAccountNo ? `••••${m.bankAccountNo.slice(-4)}` : ''}</p>
                          </div>
                        ) : (
                          <p className="text-sm text-thb-text-secondary">{formatPaymentType(m.paymentType)}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {m.splitType ? (
                          <div className="flex items-center gap-1">
                            <span className={getSplitTypeBadge(m.splitType)}>{formatPaymentType(m.splitType)}</span>
                            <span className="text-xs text-thb-text-secondary">{m.splitValue}{m.splitType === 'PERCENTAGE' ? '%' : ''}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-thb-text-muted">Full</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-thb-text-secondary">{m.currencyCode}</td>
                      <td className="px-4 py-3">
                        {m.isPrimary ? (
                          <span className="thb-badge thb-badge-warning">Primary</span>
                        ) : (
                          <span className="thb-badge thb-badge-info">Secondary</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-thb-text-secondary">{m.priority}</td>
                      <td className="px-4 py-3">
                        <span className={getStatusBadge(m.status)}>{m.status}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleView(m)}
                            className="p-1.5 rounded-md text-thb-text-muted hover:text-green-500 hover:bg-green-50 transition-colors"
                            title="View"
                          >
                            <FiEye className="w-4 h-4" />
                          </button>
                          {isAdmin && (
                            <>
                              <button
                                onClick={() => handleEdit(m)}
                                className="p-1.5 rounded-md text-thb-text-muted hover:text-amber-500 hover:bg-amber-50 transition-colors"
                                title="Edit"
                              >
                                <FiEdit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setDeleteConfirmId(m.id)}
                                className="p-1.5 rounded-md text-thb-text-muted hover:text-red-500 hover:bg-red-50 transition-colors"
                                title="Delete"
                              >
                                <FiTrash2 className="w-4 h-4" />
                              </button>
                            </>
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
