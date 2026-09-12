'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  FiPlus, FiX, FiEdit2, FiSearch, FiRefreshCw, FiPause,
  FiPlay, FiList, FiUser, FiAlertCircle, FiCheckCircle,
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

interface PayrollHold {
  id: string;
  employeeId: string;
  holdType: string;
  reason: string;
  holdFromPeriod: string;
  holdToPeriod: string | null;
  heldComponents: string | null;
  releasedDate: string | null;
  releasedBy: string | null;
  status: string;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
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
    active: 'thb-badge thb-badge-warning',
    released: 'thb-badge thb-badge-success',
    cancelled: 'thb-badge thb-badge-error',
  };
  return map[status] || 'thb-badge thb-badge-info';
}

function getHoldTypeBadge(type: string) {
  const map: Record<string, string> = {
    FULL_HOLD: 'thb-badge thb-badge-error',
    PARTIAL_HOLD: 'thb-badge thb-badge-warning',
    DEDUCTION_ONLY: 'thb-badge thb-badge-info',
  };
  return map[type] || 'thb-badge thb-badge-info';
}

const HOLD_TYPE_OPTIONS = [
  { value: 'FULL_HOLD', label: 'Full Hold' },
  { value: 'PARTIAL_HOLD', label: 'Partial Hold' },
  { value: 'DEDUCTION_ONLY', label: 'Deduction Only' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'active', label: 'Active' },
  { value: 'released', label: 'Released' },
  { value: 'cancelled', label: 'Cancelled' },
];

const COMPONENT_OPTIONS = [
  { value: 'basicSalary', label: 'Basic Salary' },
  { value: 'hra', label: 'HRA' },
  { value: 'da', label: 'DA' },
  { value: 'conveyance', label: 'Conveyance' },
  { value: 'medical', label: 'Medical' },
  { value: 'otherAllowances', label: 'Other Allowances' },
  { value: 'pf', label: 'PF' },
  { value: 'esi', label: 'ESI' },
  { value: 'tax', label: 'Tax' },
  { value: 'professionalTax', label: 'Professional Tax' },
  { value: 'otherDeductions', label: 'Other Deductions' },
];

const emptyForm = {
  employeeId: '',
  holdType: 'FULL_HOLD',
  reason: '',
  holdFromPeriod: '',
  holdToPeriod: '',
  heldComponents: [] as string[],
};

export default function PayrollHoldsPage() {
  const { user } = useAuthStore();
  const effectiveCompanyId = useCompanyContextStore(s => s.effectiveCompanyId);
  const isAdmin = user?.role === 'super_admin' || user?.role === 'tenant_admin' || user?.role === 'admin';

  const [holds, setHolds] = useState<PayrollHold[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [releasingId, setReleasingId] = useState<string | null>(null);

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
      const url = `/api/payroll/holds${qs ? `?${qs}` : ''}`;
      const res = await fetch(url, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setHolds(Array.isArray(data) ? data : data.data || []);
      }
    } catch {
      toast.error('Failed to load payroll holds');
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

  const totalCount = holds.length;
  const activeCount = holds.filter(h => h.status === 'active').length;
  const releasedCount = holds.filter(h => h.status === 'released').length;
  const cancelledCount = holds.filter(h => h.status === 'cancelled').length;

  const filteredHolds = holds.filter(h => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const emp = employees.find(e => e.employeeId === h.employeeId);
      const empName = emp ? `${emp.firstName} ${emp.lastName}`.toLowerCase() : '';
      if (!h.employeeId.toLowerCase().includes(q) && !empName.includes(q) && !h.reason.toLowerCase().includes(q) && !h.holdType.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const getEmployeeDisplay = (empId: string) => {
    const emp = employees.find(e => e.employeeId === empId || e.id === empId);
    if (emp) return `${emp.firstName} ${emp.lastName}`;
    return empId;
  };

  const formatDate = (d: string | null) => d ? new Date(d).toLocaleDateString() : '—';

  const handleAddNew = () => {
    setForm({ ...emptyForm });
    setEditingId(null);
    setShowForm(true);
    setTimeout(() => document.getElementById('hold-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  const handleEdit = (item: PayrollHold) => {
    let parsedComponents: string[] = [];
    if (item.heldComponents) {
      try { parsedComponents = JSON.parse(item.heldComponents); } catch { parsedComponents = []; }
    }
    setForm({
      employeeId: item.employeeId,
      holdType: item.holdType,
      reason: item.reason,
      holdFromPeriod: item.holdFromPeriod || '',
      holdToPeriod: item.holdToPeriod || '',
      heldComponents: parsedComponents,
    });
    setEditingId(item.id);
    setShowForm(true);
    setTimeout(() => document.getElementById('hold-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm({ ...emptyForm });
  };

  const handleSubmit = async () => {
    if (!form.employeeId.trim()) { toast.error('Employee is required'); return; }
    if (!form.reason.trim()) { toast.error('Reason is required'); return; }
    if (!form.holdFromPeriod) { toast.error('Hold from period is required'); return; }

    setSubmitting(true);
    try {
      const payload = {
        employeeId: form.employeeId,
        holdType: form.holdType,
        reason: form.reason,
        holdFromPeriod: form.holdFromPeriod,
        holdToPeriod: form.holdToPeriod || null,
        heldComponents: form.holdType !== 'FULL_HOLD' && form.heldComponents.length > 0 ? JSON.stringify(form.heldComponents) : null,
      };

      if (editingId) {
        const res = await fetch(`/api/payroll/holds/${editingId}?${scopeQuery}` , {
          method: 'PUT', headers: getAuthHeaders(), body: JSON.stringify(payload),
        });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed to update'); }
        toast.success('Payroll hold updated successfully');
      } else {
        const res = await fetch(`/api/payroll/holds?${scopeQuery}` , {
          method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(payload),
        });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed to create'); }
        toast.success('Payroll hold created successfully');
      }
      handleCancelForm();
      fetchData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRelease = async (id: string) => {
    setReleasingId(id);
    try {
      const res = await fetch(`/api/payroll/holds/${id}?${scopeQuery}` , {
        method: 'PATCH', headers: getAuthHeaders(), body: JSON.stringify({ action: 'release' }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed to release'); }
      toast.success('Payroll hold released successfully');
      fetchData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to release');
    } finally {
      setReleasingId(null);
    }
  };

  const handleCancel = async (id: string) => {
    try {
      const res = await fetch(`/api/payroll/holds/${id}?${scopeQuery}` , {
        method: 'PATCH', headers: getAuthHeaders(), body: JSON.stringify({ action: 'cancel' }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed to cancel'); }
      toast.success('Payroll hold cancelled');
      fetchData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to cancel');
    }
  };

  const toggleComponent = (comp: string) => {
    setForm(prev => ({
      ...prev,
      heldComponents: prev.heldComponents.includes(comp)
        ? prev.heldComponents.filter(c => c !== comp)
        : [...prev.heldComponents, comp],
    }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-thb-text-primary flex items-center gap-2">
            <FiPause className="w-6 h-6 text-amber-500" />
            Payroll Holds
          </h1>
          <p className="text-thb-text-secondary mt-1">Manage payroll holds for employees</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => fetchData()} className="p-2.5 rounded-lg border border-thb-border text-thb-text-secondary hover:bg-slate-50 transition-colors" title="Refresh">
            <FiRefreshCw className="w-4 h-4" />
          </button>
          {isAdmin && (
            <button onClick={handleAddNew} className="inline-flex items-center gap-2 px-4 py-2.5 bg-green-500 text-white rounded-lg hover:bg-green-600 font-medium text-sm shadow-sm shadow-green-500/25 transition-colors">
              <FiPlus className="w-4 h-4" /> New Hold
            </button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="thb-card thb-card-hover p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-slate-50 flex items-center justify-center">
              <FiList className="w-5 h-5 text-slate-500" />
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
              <FiAlertCircle className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <p className="text-xs font-medium text-thb-text-secondary">Active</p>
              <p className="text-xl font-bold text-amber-600">{activeCount}</p>
            </div>
          </div>
        </div>
        <div className="thb-card thb-card-hover p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
              <FiCheckCircle className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <p className="text-xs font-medium text-thb-text-secondary">Released</p>
              <p className="text-xl font-bold text-thb-text-primary">{releasedCount}</p>
            </div>
          </div>
        </div>
        <div className="thb-card thb-card-hover p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center">
              <FiPause className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <p className="text-xs font-medium text-thb-text-secondary">Cancelled</p>
              <p className="text-xl font-bold text-thb-text-primary">{cancelledCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search / Filter */}
      <div className="thb-card p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-thb-text-muted" />
            <input type="text" placeholder="Search by employee, reason, hold type..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
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
        <div id="hold-form" className="thb-card border-l-4 border-l-amber-500">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-thb-text-primary">
                {editingId ? 'Edit Payroll Hold' : 'Create Payroll Hold'}
              </h2>
              <button onClick={handleCancelForm} className="p-2 rounded-lg text-thb-text-muted hover:text-thb-text-primary hover:bg-slate-100 transition-colors">
                <FiX className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-5">
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Employee <span className="text-red-500 font-bold">*</span></label>
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
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Hold Type <span className="text-red-500 font-bold">*</span></label>
                <select value={form.holdType} onChange={(e) => setForm({ ...form, holdType: e.target.value, heldComponents: e.target.value === 'FULL_HOLD' ? [] : form.heldComponents })}
                  className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400">
                  {HOLD_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Hold From Period <span className="text-red-500 font-bold">*</span></label>
                <input type="month" value={form.holdFromPeriod} onChange={(e) => setForm({ ...form, holdFromPeriod: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                  placeholder="e.g. 2026-06" />
              </div>
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Hold To Period</label>
                <input type="month" value={form.holdToPeriod} onChange={(e) => setForm({ ...form, holdToPeriod: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                  placeholder="Leave empty for indefinite" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Reason <span className="text-red-500 font-bold">*</span></label>
                <textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} rows={2}
                  className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 resize-none"
                  placeholder="Reason for payroll hold..." />
              </div>
            </div>

            {/* Held Components for Partial Hold */}
            {form.holdType !== 'FULL_HOLD' && (
              <div className="mb-5">
                <h3 className="text-sm font-semibold text-thb-text-primary mb-3">Held Components</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                  {COMPONENT_OPTIONS.map(comp => (
                    <label key={comp.value} className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${form.heldComponents.includes(comp.value) ? 'bg-amber-50 border-amber-300 text-amber-700' : 'border-thb-border text-thb-text-secondary hover:bg-slate-50'}`}>
                      <input type="checkbox" checked={form.heldComponents.includes(comp.value)} onChange={() => toggleComponent(comp.value)} className="rounded border-thb-border" />
                      <span className="text-sm">{comp.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Form Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-thb-border">
              <button onClick={handleCancelForm} className="px-4 py-2.5 rounded-lg border border-thb-border text-sm font-medium text-thb-text-secondary hover:bg-slate-50 transition-colors">
                Cancel
              </button>
              <button onClick={handleSubmit} disabled={submitting}
                className="px-6 py-2.5 rounded-lg bg-green-500 text-white text-sm font-medium hover:bg-green-600 disabled:opacity-50 shadow-sm shadow-green-500/25 transition-colors">
                {submitting ? 'Saving...' : editingId ? 'Update Hold' : 'Create Hold'}
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
      ) : filteredHolds.length === 0 ? (
        <div className="thb-card p-12 text-center">
          <FiPause className="w-12 h-12 text-thb-text-muted mx-auto mb-3" />
          <p className="text-thb-text-secondary font-medium">No payroll holds found</p>
          <p className="text-sm text-thb-text-muted mt-1">Create a payroll hold to prevent salary processing</p>
        </div>
      ) : (
        <div className="thb-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead className="bg-slate-50 border-b border-thb-border">
                <tr>
                  {['Employee', 'Hold Type', 'Reason', 'Period', 'Components', 'Status', 'Released', 'Actions'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-thb-text-muted uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredHolds.map((item) => {
                  let heldCompLabels: string[] = [];
                  if (item.heldComponents) {
                    try {
                      const parsed = JSON.parse(item.heldComponents);
                      heldCompLabels = parsed.map((c: string) => COMPONENT_OPTIONS.find(o => o.value === c)?.label || c);
                    } catch { /* ignore */ }
                  }

                  return (
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
                        <span className={getHoldTypeBadge(item.holdType)}>
                          {item.holdType.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-thb-text-primary truncate max-w-[200px]" title={item.reason}>{item.reason}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-thb-text-primary">{item.holdFromPeriod}</p>
                        {item.holdToPeriod && <p className="text-xs text-thb-text-muted">to {item.holdToPeriod}</p>}
                        {!item.holdToPeriod && <p className="text-xs text-amber-500">Indefinite</p>}
                      </td>
                      <td className="px-4 py-3">
                        {item.holdType === 'FULL_HOLD' ? (
                          <span className="text-xs font-medium text-red-600">All Components</span>
                        ) : heldCompLabels.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {heldCompLabels.slice(0, 2).map(c => (
                              <span key={c} className="text-xs px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded">{c}</span>
                            ))}
                            {heldCompLabels.length > 2 && (
                              <span className="text-xs px-1.5 py-0.5 bg-slate-100 text-thb-text-muted rounded">+{heldCompLabels.length - 2}</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-thb-text-muted">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={getStatusBadge(item.status)}>{item.status.charAt(0).toUpperCase() + item.status.slice(1)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-thb-text-secondary">{formatDate(item.releasedDate)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {isAdmin && item.status === 'active' && (
                            <>
                              <button onClick={() => handleEdit(item)} className="p-1.5 rounded-lg text-thb-text-muted hover:text-amber-500 hover:bg-amber-50 transition-colors" title="Edit">
                                <FiEdit2 className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => handleRelease(item.id)} disabled={releasingId === item.id}
                                className="p-1.5 rounded-lg text-thb-text-muted hover:text-emerald-500 hover:bg-emerald-50 transition-colors disabled:opacity-50" title="Release Hold">
                                <FiPlay className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => handleCancel(item.id)}
                                className="p-1.5 rounded-lg text-thb-text-muted hover:text-red-500 hover:bg-red-50 transition-colors" title="Cancel Hold">
                                <FiX className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
