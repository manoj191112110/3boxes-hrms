'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  FiPlus, FiX, FiTrash2, FiEdit2, FiCheck, FiXCircle,
  FiSearch, FiRefreshCw, FiFileText, FiClock, FiCheckCircle,
  FiList, FiUser,
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

interface PayrollInput {
  id: string;
  payrollRunId: string | null;
  employeeId: string;
  inputType: string;
  componentCode: string;
  inputValueNumeric: number | null;
  unitType: string | null;
  inputDateFrom: string | null;
  inputDateTo: string | null;
  currencyCode: string | null;
  exchangeRate: number | null;
  approvalStatus: string;
  approvedBy: string | null;
  approvalDate: string | null;
  source: string;
  referenceDocument: string | null;
  remarks: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

// --- Badge Helpers ---
function getApprovalStatusBadge(status: string) {
  const map: Record<string, string> = {
    PENDING: 'thb-badge thb-badge-warning',
    APPROVED: 'thb-badge thb-badge-success',
    REJECTED: 'thb-badge thb-badge-error',
  };
  return map[status] || 'thb-badge thb-badge-info';
}

function getInputTypeBadge(type: string) {
  const map: Record<string, string> = {
    ATTENDANCE: 'thb-badge thb-badge-info',
    LEAVE: 'thb-badge thb-badge-warning',
    OVERTIME: 'thb-badge thb-badge-purple',
    VARIABLE_PAY: 'thb-badge thb-badge-success',
    ONE_TIME: 'thb-badge thb-badge-primary',
    REIMBURSEMENT: 'thb-badge thb-badge-info',
    LOAN: 'thb-badge thb-badge-error',
    INVESTMENT: 'thb-badge thb-badge-purple',
    TAX_ADJ: 'thb-badge thb-badge-warning',
    ORG_CHANGE: 'thb-badge thb-badge-success',
  };
  return map[type] || 'thb-badge thb-badge-info';
}

function getSourceBadge(source: string) {
  const map: Record<string, string> = {
    MANUAL: 'thb-badge thb-badge-info',
    BULK_UPLOAD: 'thb-badge thb-badge-purple',
    API_INTEGRATION: 'thb-badge thb-badge-success',
    SELF_SERVICE: 'thb-badge thb-badge-warning',
    SYSTEM_GENERATED: 'thb-badge thb-badge-primary',
  };
  return map[source] || 'thb-badge thb-badge-info';
}

// --- Constants ---
const INPUT_TYPE_OPTIONS = [
  { value: 'ATTENDANCE', label: 'Attendance' },
  { value: 'LEAVE', label: 'Leave' },
  { value: 'OVERTIME', label: 'Overtime' },
  { value: 'VARIABLE_PAY', label: 'Variable Pay' },
  { value: 'ONE_TIME', label: 'One Time' },
  { value: 'REIMBURSEMENT', label: 'Reimbursement' },
  { value: 'LOAN', label: 'Loan' },
  { value: 'INVESTMENT', label: 'Investment' },
  { value: 'TAX_ADJ', label: 'Tax Adjustment' },
  { value: 'ORG_CHANGE', label: 'Org Change' },
];

const UNIT_TYPE_OPTIONS = [
  { value: 'AMOUNT', label: 'Amount' },
  { value: 'DAYS', label: 'Days' },
  { value: 'HOURS', label: 'Hours' },
  { value: 'PERCENTAGE', label: 'Percentage' },
];

const CURRENCY_CODE_OPTIONS = [
  { value: 'INR', label: 'INR - Indian Rupee' },
  { value: 'USD', label: 'USD - US Dollar' },
  { value: 'GBP', label: 'GBP - British Pound' },
  { value: 'SGD', label: 'SGD - Singapore Dollar' },
  { value: 'AED', label: 'AED - UAE Dirham' },
  { value: 'AUD', label: 'AUD - Australian Dollar' },
];

const SOURCE_OPTIONS = [
  { value: 'MANUAL', label: 'Manual' },
  { value: 'BULK_UPLOAD', label: 'Bulk Upload' },
  { value: 'API_INTEGRATION', label: 'API Integration' },
  { value: 'SELF_SERVICE', label: 'Self Service' },
  { value: 'SYSTEM_GENERATED', label: 'System Generated' },
];

const APPROVAL_STATUS_OPTIONS = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
];

const emptyForm = {
  employeeId: '',
  inputType: 'ATTENDANCE',
  componentCode: '',
  inputValueNumeric: '' as string,
  unitType: 'AMOUNT',
  inputDateFrom: '',
  inputDateTo: '',
  currencyCode: 'INR',
  exchangeRate: '' as string,
  source: 'MANUAL',
  referenceDocument: '',
  remarks: '',
};

export default function PayrollInputsPage() {
  const { user } = useAuthStore();
  const effectiveCompanyId = useCompanyContextStore(s => s.effectiveCompanyId);
  const isAdmin = user?.role === 'super_admin' || user?.role === 'tenant_admin' || user?.role === 'admin';

  const [inputs, setInputs] = useState<PayrollInput[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [bulkProcessing, setBulkProcessing] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [inputTypeFilter, setInputTypeFilter] = useState('');
  const [approvalStatusFilter, setApprovalStatusFilter] = useState('');
  const [employeeFilter, setEmployeeFilter] = useState('');

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);

  // Form state
  const [form, setForm] = useState({ ...emptyForm });

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
      // Silently fail - employees are for dropdown
    }
  }, []);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (inputTypeFilter) params.set('inputType', inputTypeFilter);
      if (approvalStatusFilter) params.set('approvalStatus', approvalStatusFilter);
      if (employeeFilter) params.set('employeeId', employeeFilter);
      const qs = params.toString();
      const url = `/api/payroll/inputs${qs ? `?${qs}` : ''}`;
      const res = await fetch(url, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setInputs(Array.isArray(data) ? data : data.data || []);
      }
    } catch {
      toast.error('Failed to load payroll inputs');
    } finally {
      setLoading(false);
    }
  }, [inputTypeFilter, approvalStatusFilter, employeeFilter]);
  const cid = effectiveCompanyId();
  const scopeQuery = cid ? `companyId=${cid}&` : '';


  useEffect(() => {
    queueMicrotask(() => {
      fetchData();
      fetchEmployees();
    });
  }, [fetchData, fetchEmployees]);

  // --- Computed Stats ---
  const totalInputs = inputs.length;
  const pendingCount = inputs.filter(i => i.approvalStatus === 'PENDING').length;
  const approvedCount = inputs.filter(i => i.approvalStatus === 'APPROVED').length;
  const rejectedCount = inputs.filter(i => i.approvalStatus === 'REJECTED').length;

  // --- Filtered List ---
  const filteredInputs = inputs.filter(i => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const emp = employees.find(e => e.employeeId === i.employeeId);
      const empName = emp ? `${emp.firstName} ${emp.lastName}`.toLowerCase() : '';
      if (
        !i.employeeId.toLowerCase().includes(q) &&
        !empName.includes(q) &&
        !i.componentCode.toLowerCase().includes(q) &&
        !i.inputType.toLowerCase().includes(q) &&
        !i.source.toLowerCase().includes(q) &&
        !(i.referenceDocument || '').toLowerCase().includes(q)
      ) return false;
    }
    return true;
  });

  // --- Bulk selection logic ---
  const pendingInputs = filteredInputs.filter(i => i.approvalStatus === 'PENDING');
  const selectedPendingIds = new Set([...selectedIds].filter(id => pendingInputs.some(p => p.id === id)));

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedIds(new Set());
      setSelectAll(false);
    } else {
      setSelectedIds(new Set(pendingInputs.map(i => i.id)));
      setSelectAll(true);
    }
  };

  const handleSelectRow = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
    setSelectAll(pendingInputs.length > 0 && pendingInputs.every(i => newSet.has(i.id)));
  };

  // --- Employee name resolver ---
  const getEmployeeDisplay = (empId: string) => {
    const emp = employees.find(e => e.employeeId === empId || e.id === empId);
    if (emp) return `${emp.firstName} ${emp.lastName}`;
    return empId;
  };

  // --- Format Helpers ---
  const formatDate = (d: string | null) => d ? new Date(d).toLocaleDateString() : '—';


  // --- Handlers ---
  const handleAddNew = () => {
    setForm({ ...emptyForm });
    setEditingId(null);
    setShowForm(true);
    setTimeout(() => document.getElementById('crud-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  const handleEdit = (item: PayrollInput) => {
    setForm({
      employeeId: item.employeeId,
      inputType: item.inputType,
      componentCode: item.componentCode,
      inputValueNumeric: item.inputValueNumeric != null ? String(item.inputValueNumeric) : '',
      unitType: item.unitType || 'AMOUNT',
      inputDateFrom: item.inputDateFrom ? new Date(item.inputDateFrom).toISOString().split('T')[0] : '',
      inputDateTo: item.inputDateTo ? new Date(item.inputDateTo).toISOString().split('T')[0] : '',
      currencyCode: item.currencyCode || 'INR',
      exchangeRate: item.exchangeRate != null ? String(item.exchangeRate) : '',
      source: item.source,
      referenceDocument: item.referenceDocument || '',
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
    if (!form.employeeId.trim()) { toast.error('Employee ID is required'); return; }
    if (!form.componentCode.trim()) { toast.error('Component code is required'); return; }

    setSubmitting(true);
    try {
      const payload = {
        employeeId: form.employeeId,
        inputType: form.inputType,
        componentCode: form.componentCode,
        inputValueNumeric: form.inputValueNumeric ? parseFloat(form.inputValueNumeric) : null,
        unitType: form.unitType || null,
        inputDateFrom: form.inputDateFrom || null,
        inputDateTo: form.inputDateTo || null,
        currencyCode: form.currencyCode || null,
        exchangeRate: form.exchangeRate ? parseFloat(form.exchangeRate) : null,
        source: form.source,
        referenceDocument: form.referenceDocument || null,
        remarks: form.remarks || null,
      };

      if (editingId) {
        const res = await fetch(`/api/payroll/inputs/${editingId}?${scopeQuery}` , {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify(payload),
        });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed to update'); }
        toast.success('Payroll input updated successfully');
      } else {
        const res = await fetch(`/api/payroll/inputs?${scopeQuery}` , {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify(payload),
        });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed to create'); }
        toast.success('Payroll input created successfully');
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
      const res = await fetch(`/api/payroll/inputs/${id}?${scopeQuery}` , { method: 'DELETE', headers: getAuthHeaders() });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed to delete'); }
      toast.success('Payroll input deleted successfully');
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
      const res = await fetch(`/api/payroll/inputs/${id}?${scopeQuery}` , {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ approvalStatus: 'APPROVED' }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed to approve'); }
      toast.success('Input approved successfully');
      fetchData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to approve');
    }
  };

  const handleReject = async (id: string) => {
    try {
      const res = await fetch(`/api/payroll/inputs/${id}?${scopeQuery}` , {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ approvalStatus: 'REJECTED' }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed to reject'); }
      toast.success('Input rejected');
      fetchData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to reject');
    }
  };

  const handleBulkApprove = async () => {
    if (selectedPendingIds.size === 0) {
      toast.error('No pending items selected');
      return;
    }
    setBulkProcessing(true);
    let successCount = 0;
    let failCount = 0;
    const ids = [...selectedPendingIds];
    for (const id of ids) {
      try {
        const res = await fetch(`/api/payroll/inputs/${id}?${scopeQuery}` , {
          method: 'PATCH',
          headers: getAuthHeaders(),
          body: JSON.stringify({ approvalStatus: 'APPROVED' }),
        });
        if (res.ok) successCount++;
        else failCount++;
      } catch {
        failCount++;
      }
    }
    if (successCount > 0) toast.success(`${successCount} input(s) approved`);
    if (failCount > 0) toast.error(`${failCount} input(s) failed to approve`);
    setSelectedIds(new Set());
    setSelectAll(false);
    setBulkProcessing(false);
    fetchData();
  };

  const handleBulkReject = async () => {
    if (selectedPendingIds.size === 0) {
      toast.error('No pending items selected');
      return;
    }
    setBulkProcessing(true);
    let successCount = 0;
    let failCount = 0;
    const ids = [...selectedPendingIds];
    for (const id of ids) {
      try {
        const res = await fetch(`/api/payroll/inputs/${id}?${scopeQuery}` , {
          method: 'PATCH',
          headers: getAuthHeaders(),
          body: JSON.stringify({ approvalStatus: 'REJECTED' }),
        });
        if (res.ok) successCount++;
        else failCount++;
      } catch {
        failCount++;
      }
    }
    if (successCount > 0) toast.success(`${successCount} input(s) rejected`);
    if (failCount > 0) toast.error(`${failCount} input(s) failed to reject`);
    setSelectedIds(new Set());
    setSelectAll(false);
    setBulkProcessing(false);
    fetchData();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-thb-text-primary flex items-center gap-2">
            <FiFileText className="w-6 h-6 text-emerald-500" />
            Payroll Inputs
          </h1>
          <p className="text-thb-text-secondary mt-1">Manage employee payroll input entries and approvals</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Bulk Action Buttons */}
          {isAdmin && selectedPendingIds.size > 0 && (
            <>
              <button
                onClick={handleBulkApprove}
                disabled={bulkProcessing}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 font-medium text-sm shadow-sm shadow-emerald-500/25 transition-colors disabled:opacity-50"
              >
                <FiCheck className="w-4 h-4" />
                Approve Selected ({selectedPendingIds.size})
              </button>
              <button
                onClick={handleBulkReject}
                disabled={bulkProcessing}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-red-500 text-white rounded-lg hover:bg-red-600 font-medium text-sm shadow-sm shadow-red-500/25 transition-colors disabled:opacity-50"
              >
                <FiXCircle className="w-4 h-4" />
                Reject Selected ({selectedPendingIds.size})
              </button>
            </>
          )}
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
              <FiPlus className="w-4 h-4" /> Add Input
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
              <p className="text-xs font-medium text-thb-text-secondary">Total Inputs</p>
              <p className="text-xl font-bold text-thb-text-primary">{totalInputs}</p>
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
            <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center">
              <FiXCircle className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <p className="text-xs font-medium text-thb-text-secondary">Rejected</p>
              <p className="text-xl font-bold text-thb-text-primary">{rejectedCount}</p>
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
              placeholder="Search by employee, component code, type, source..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
            />
          </div>
          <select
            value={inputTypeFilter}
            onChange={(e) => setInputTypeFilter(e.target.value)}
            className="px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 min-w-[150px]"
          >
            <option value="">All Input Types</option>
            {INPUT_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select
            value={approvalStatusFilter}
            onChange={(e) => setApprovalStatusFilter(e.target.value)}
            className="px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 min-w-[150px]"
          >
            <option value="">All Statuses</option>
            {APPROVAL_STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
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
                {editingId ? 'Edit Payroll Input' : 'Create Payroll Input'}
              </h2>
              <button
                onClick={handleCancelForm}
                className="p-2 rounded-lg text-thb-text-muted hover:text-thb-text-primary hover:bg-slate-100 transition-colors"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>

            {/* Basic Information */}
            <div className="mb-5">
              <h3 className="text-sm font-semibold text-thb-text-primary mb-3">Basic Information</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Employee *</label>
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
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Input Type</label>
                  <select
                    value={form.inputType}
                    onChange={(e) => setForm({ ...form, inputType: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                  >
                    {INPUT_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Component Code *</label>
                  <input
                    required
                    value={form.componentCode}
                    onChange={(e) => setForm({ ...form, componentCode: e.target.value.toUpperCase().replace(/\s+/g, '_') })}
                    className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                    placeholder="e.g. BASIC, HRA, OT_PAY"
                  />
                </div>
              </div>
            </div>

            {/* Value & Unit */}
            <div className="mb-5">
              <h3 className="text-sm font-semibold text-thb-text-primary mb-3">Value & Unit</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Input Value</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.inputValueNumeric}
                    onChange={(e) => setForm({ ...form, inputValueNumeric: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                    placeholder="e.g. 5000, 8.5"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Unit Type</label>
                  <select
                    value={form.unitType}
                    onChange={(e) => setForm({ ...form, unitType: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                  >
                    {UNIT_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Currency</label>
                  <select
                    value={form.currencyCode}
                    onChange={(e) => setForm({ ...form, currencyCode: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                  >
                    {CURRENCY_CODE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Exchange Rate</label>
                  <input
                    type="number"
                    step="0.0001"
                    min="0"
                    value={form.exchangeRate}
                    onChange={(e) => setForm({ ...form, exchangeRate: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                    placeholder="e.g. 1.0, 83.12"
                  />
                </div>
              </div>
            </div>

            {/* Date Range & Source */}
            <div className="mb-5">
              <h3 className="text-sm font-semibold text-thb-text-primary mb-3">Date Range & Source</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Date From</label>
                  <input
                    type="date"
                    value={form.inputDateFrom}
                    onChange={(e) => setForm({ ...form, inputDateFrom: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Date To</label>
                  <input
                    type="date"
                    value={form.inputDateTo}
                    onChange={(e) => setForm({ ...form, inputDateTo: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Source</label>
                  <select
                    value={form.source}
                    onChange={(e) => setForm({ ...form, source: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                  >
                    {SOURCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Reference & Remarks */}
            <div className="mb-5">
              <h3 className="text-sm font-semibold text-thb-text-primary mb-3">Reference & Remarks</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Reference Document</label>
                  <input
                    value={form.referenceDocument}
                    onChange={(e) => setForm({ ...form, referenceDocument: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                    placeholder="e.g. INV-2024-001, POL-OT-01"
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
                {submitting ? 'Saving...' : editingId ? 'Update Input' : 'Create Input'}
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
      ) : filteredInputs.length === 0 ? (
        <div className="thb-card p-12 text-center">
          <FiFileText className="w-12 h-12 text-thb-text-muted mx-auto mb-3" />
          <p className="text-thb-text-secondary font-medium">No payroll inputs found</p>
          <p className="text-sm text-thb-text-muted mt-1">Create your first payroll input to get started</p>
        </div>
      ) : (
        <div className="thb-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead className="bg-slate-50 border-b border-thb-border">
                <tr>
                  {isAdmin && (
                    <th className="px-4 py-3 text-left w-10">
                      <input
                        type="checkbox"
                        checked={selectAll}
                        onChange={handleSelectAll}
                        className="rounded border-thb-border"
                        title="Select all pending items"
                      />
                    </th>
                  )}
                  {['Employee', 'Type', 'Component', 'Value', 'Unit', 'Date Range', 'Source', 'Status', 'Actions'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-thb-text-muted uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredInputs.map((item) => (
                  deleteConfirmId === item.id ? (
                    <tr key={item.id} className="bg-red-50">
                      <td colSpan={isAdmin ? 10 : 9} className="px-4 py-3">
                        <p className="text-sm text-red-700 font-medium mb-2">
                          Are you sure you want to delete this payroll input ({item.componentCode})?
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
                    <tr key={item.id} className={`hover:bg-slate-50/50 transition-colors ${selectedIds.has(item.id) ? 'bg-green-50/50' : ''}`}>
                      {isAdmin && (
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(item.id)}
                            onChange={() => handleSelectRow(item.id)}
                            disabled={item.approvalStatus !== 'PENDING'}
                            className="rounded border-thb-border disabled:opacity-30"
                          />
                        </td>
                      )}
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
                        <span className={getInputTypeBadge(item.inputType)}>
                          {item.inputType.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium text-thb-text-primary">{item.componentCode}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium text-thb-text-primary">
                          {item.inputValueNumeric != null ? item.inputValueNumeric.toLocaleString() : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-thb-text-secondary">
                          {item.unitType ? item.unitType.charAt(0) + item.unitType.slice(1).toLowerCase() : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-thb-text-secondary">
                          {item.inputDateFrom || item.inputDateTo ? (
                            <>
                              {formatDate(item.inputDateFrom)}
                              {item.inputDateFrom && item.inputDateTo && ' — '}
                              {formatDate(item.inputDateTo)}
                            </>
                          ) : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={getSourceBadge(item.source)}>
                          {item.source.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={getApprovalStatusBadge(item.approvalStatus)}>
                          {item.approvalStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {item.approvalStatus === 'PENDING' && isAdmin && (
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
                                className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
                                title="Reject"
                              >
                                <FiXCircle className="w-4 h-4" />
                              </button>
                            </>
                          )}
                          {isAdmin && (
                            <button
                              onClick={() => handleEdit(item)}
                              className="p-1.5 rounded-lg text-green-500 hover:bg-green-50 transition-colors"
                              title="Edit"
                            >
                              <FiEdit2 className="w-4 h-4" />
                            </button>
                          )}
                          {isAdmin && (
                            <button
                              onClick={() => setDeleteConfirmId(item.id)}
                              className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 transition-colors"
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

          {/* Table Footer - Selection Info */}
          {isAdmin && selectedPendingIds.size > 0 && (
            <div className="px-4 py-3 bg-green-50/50 border-t border-green-100 flex items-center justify-between">
              <span className="text-sm text-green-700 font-medium">
                {selectedPendingIds.size} pending item(s) selected
              </span>
              <button
                onClick={() => { setSelectedIds(new Set()); setSelectAll(false); }}
                className="text-xs text-green-600 hover:text-green-800 font-medium"
              >
                Clear Selection
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
