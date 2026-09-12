'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  FiRefreshCw,
  FiArrowLeft,
  FiUser,
  FiBriefcase,
  FiMapPin,
  FiCalendar,
  FiFileText,
  FiCheckCircle,
  FiAlertCircle,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import { useCompanyData } from '@/components/company/useCompanyData';
import { useCompanyContextStore } from '@/store/companyContextStore';

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

function getStatusBadge(status: string) {
  const map: Record<string, string> = {
    pending: 'thb-badge thb-badge-warning',
    approved: 'thb-badge thb-badge-success',
    rejected: 'thb-badge thb-badge-error',
    cancelled: 'thb-badge thb-badge-info',
  };
  return map[status] || 'thb-badge thb-badge-info';
}

function fmtDate(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

const TRANSFER_TYPES = [
  { value: 'permanent', label: 'Permanent' },
  { value: 'temporary', label: 'Temporary' },
  { value: 'deputation', label: 'Deputation' },
];

interface TransferRecord {
  id: string;
  employeeName: string;
  employeeCode: string;
  fromDepartment: string;
  toDepartment: string;
  transferDate: string;
  transferType: string;
  status: string;
  createdAt: string;
}

const initialForm = {
  employeeId: '',
  currentDepartment: '',
  currentDesignation: '',
  currentLocation: '',
  newDepartment: '',
  newDesignation: '',
  newLocation: '',
  transferDate: new Date().toISOString().split('T')[0],
  transferType: 'permanent',
  reason: '',
  reportingManager: '',
  comments: '',
};

export default function TransferPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const isAdmin = ['super_admin', 'tenant_admin', 'admin'].includes(user?.role || '');
  const { departments, designations, branches, selectedCompanyId } = useCompanyData();
  const scopeQuery = useCompanyContextStore(s => s.scopeQuery);
  const selectedTenantId = useCompanyContextStore(s => s.selectedTenantId);

  // Derive dropdown options from API data (company-scoped)
  const DEPARTMENTS = departments.map(d => ({ value: d.id, label: d.name }));
  const DESIGNATIONS = designations.map(d => ({ value: d.id, label: d.title }));
  const LOCATIONS = branches.map(b => ({ value: b.id, label: b.name + (b.city ? `, ${b.city}` : '') }));

  // Fetch employees for dropdown (only active employees — exclude inactive/terminated/resigned)
  const [employeeList, setEmployeeList] = useState<Array<{ id: string; employeeId: string; firstName: string; lastName: string; status?: string; department?: { id: string; name: string } | null; designation?: { id: string; title: string } | null; branch?: { id: string; name: string } | null }>>([]);
  useEffect(() => {
    const sq = scopeQuery();
    fetch(`/api/employees?limit=500${sq ? `&${sq}` : ''}`, { headers: getAuthHeaders() })
      .then(r => r.ok ? r.json() : { employees: [] })
      .then(d => {
        const allEmps = d.employees || [];
        // Filter: only active employees can be transferred
        setEmployeeList(allEmps.filter((e: { status?: string }) => e.status === 'active' || !e.status));
      })
      .catch(() => setEmployeeList([]));
  }, [selectedCompanyId, scopeQuery, selectedTenantId]);

  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [records, setRecords] = useState<TransferRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const updateField = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams([['limit', '50']]);
      const sq = scopeQuery();
      const res = await fetch(`/api/employees/transfer?${params.toString()}${sq ? `&${sq}` : ''}`, { headers: getAuthHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      setRecords(data.transfers || data.data || []);
    } catch {
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [selectedCompanyId, scopeQuery, selectedTenantId]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  // Auto-fill when employee is selected from API data
  const handleEmployeeSelect = (employeeId: string) => {
    updateField('employeeId', employeeId);
    if (employeeId) {
      const emp = employeeList.find(e => e.id === employeeId);
      if (emp) {
        updateField('currentDepartment', emp.department?.id || '');
        updateField('currentDesignation', emp.designation?.id || '');
        updateField('currentLocation', emp.branch?.id || '');
      }
    } else {
      updateField('currentDepartment', '');
      updateField('currentDesignation', '');
      updateField('currentLocation', '');
    }
  };

  const validate = (): string | null => {
    if (!form.employeeId) return 'Please select an employee';
    if (!form.newDepartment) return 'New Department is required';
    if (!form.newDesignation) return 'New Designation is required';
    if (!form.newLocation) return 'New Location is required';
    if (!form.transferDate) return 'Transfer Date is required';
    if (!form.reason.trim() || form.reason.trim().length < 20) return 'Reason must be at least 20 characters';
    if (form.newDepartment === form.currentDepartment && form.newDesignation === form.currentDesignation && form.newLocation === form.currentLocation) {
      return 'At least one detail must change in the transfer';
    }
    return null;
  };

  const handleSubmit = async () => {
    const error = validate();
    if (error) {
      toast.error(error);
      return;
    }

    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        employeeId: form.employeeId,
        currentDepartment: form.currentDepartment,
        currentDesignation: form.currentDesignation,
        currentLocation: form.currentLocation,
        newDepartment: form.newDepartment,
        newDesignation: form.newDesignation,
        newLocation: form.newLocation,
        transferDate: form.transferDate,
        transferType: form.transferType,
        reason: form.reason.trim(),
        reportingManager: form.reportingManager || null,
        comments: form.comments.trim() || null,
      };

      const res = await fetch('/api/employees/transfer', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit transfer request');

      toast.success('Transfer request submitted successfully');
      setForm(initialForm);
      fetchRecords();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to submit transfer request');
    } finally {
      setSubmitting(false);
    }
  };

  const transferTypeLabel = (v: string) => TRANSFER_TYPES.find(t => t.value === v)?.label || v;
  const deptLabel = (v: string) => DEPARTMENTS.find(d => d.value === v)?.label || (v || '—');
  const desgLabel = (v: string) => DESIGNATIONS.find(d => d.value === v)?.label || (v || '—');
  const locLabel = (v: string) => LOCATIONS.find(l => l.value === v)?.label || (v || '—');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/employees')} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500">
          <FiArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-thb-text-primary flex items-center gap-2">
            <FiRefreshCw className="w-6 h-6 text-cyan-500" />
            Transfer Employee
          </h1>
          <p className="text-sm text-slate-500 mt-1">Initiate employee transfer across departments, designations, or locations</p>
        </div>
      </div>

      {/* Select Employee */}
      <div className="thb-card p-6 rounded-xl">
        <h2 className="text-lg font-semibold text-thb-text-primary flex items-center gap-2 mb-4">
          <FiUser className="w-5 h-5 text-cyan-500" />
          Select Employee
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-thb-text-secondary mb-1">Employee <span className="text-red-500 font-bold">*</span></label>
            <select value={form.employeeId} onChange={e => handleEmployeeSelect(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400">
              <option value="">Select Employee</option>
              {employeeList.map(e => <option key={e.id} value={e.id}>{e.employeeId} — {e.firstName} {e.lastName}</option>)}
            </select>
          </div>
        </div>

        {/* Current Details (auto-filled) */}
        {form.employeeId && (
          <div className="mt-4 p-3 bg-slate-50 rounded-lg">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Current Details</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              <div><span className="text-slate-500">Department:</span> <span className="font-medium text-slate-700">{deptLabel(form.currentDepartment)}</span></div>
              <div><span className="text-slate-500">Designation:</span> <span className="font-medium text-slate-700">{desgLabel(form.currentDesignation)}</span></div>
              <div><span className="text-slate-500">Location:</span> <span className="font-medium text-slate-700">{locLabel(form.currentLocation)}</span></div>
            </div>
          </div>
        )}
      </div>

      {/* Transfer Details */}
      <div className="thb-card p-6 rounded-xl">
        <h2 className="text-lg font-semibold text-thb-text-primary flex items-center gap-2 mb-4">
          <FiBriefcase className="w-5 h-5 text-teal-500" />
          Transfer Details
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-thb-text-secondary mb-1">New Department <span className="text-red-500 font-bold">*</span></label>
            <select value={form.newDepartment} onChange={e => updateField('newDepartment', e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400">
              <option value="">Select Department</option>
              {DEPARTMENTS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-thb-text-secondary mb-1">New Designation <span className="text-red-500 font-bold">*</span></label>
            <select value={form.newDesignation} onChange={e => updateField('newDesignation', e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400">
              <option value="">Select Designation</option>
              {DESIGNATIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-thb-text-secondary mb-1 flex items-center gap-1"><FiMapPin className="w-3 h-3" />New Location <span className="text-red-500 font-bold">*</span></label>
            <select value={form.newLocation} onChange={e => updateField('newLocation', e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400">
              <option value="">Select Location</option>
              {LOCATIONS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-thb-text-secondary mb-1 flex items-center gap-1"><FiCalendar className="w-3 h-3" />Transfer Date <span className="text-red-500 font-bold">*</span></label>
            <input type="date" value={form.transferDate} onChange={e => updateField('transferDate', e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-thb-text-secondary mb-1">Transfer Type</label>
            <select value={form.transferType} onChange={e => updateField('transferType', e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400">
              {TRANSFER_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
        </div>

        <div className="mt-4">
          <label className="block text-xs font-medium text-thb-text-secondary mb-1">Reason for Transfer * <span className="font-normal text-slate-400">(min 20 chars)</span></label>
          <textarea value={form.reason} onChange={e => updateField('reason', e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" rows={3} placeholder="Provide a detailed reason for the transfer..." />
          <p className="text-[10px] text-slate-400 mt-0.5">{form.reason.length}/20 min characters</p>
        </div>
      </div>

      {/* Approval */}
      <div className="thb-card p-6 rounded-xl">
        <h2 className="text-lg font-semibold text-thb-text-primary flex items-center gap-2 mb-4">
          <FiCheckCircle className="w-5 h-5 text-emerald-500" />
          Approval
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-thb-text-secondary mb-1">Reporting Manager</label>
            <select value={form.reportingManager} onChange={e => updateField('reportingManager', e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400">
              <option value="">Select Manager</option>
              {employeeList.filter(e => e.designation?.title?.toLowerCase().includes('manager') || e.designation?.title?.toLowerCase().includes('lead') || e.designation?.title?.toLowerCase().includes('director')).map(e => <option key={e.id} value={e.id}>{e.employeeId} — {e.firstName} {e.lastName}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-thb-text-secondary mb-1 flex items-center gap-1"><FiFileText className="w-3 h-3" /> Comments for Approver</label>
            <textarea value={form.comments} onChange={e => updateField('comments', e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" rows={2} placeholder="Any additional comments..." />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <button onClick={() => router.push('/employees')} className="inline-flex items-center gap-2 px-4 py-2.5 bg-white text-thb-text-secondary border border-thb-border rounded-xl hover:bg-slate-50 font-medium text-sm transition-all">
          <FiArrowLeft className="w-4 h-4" /> Cancel
        </button>
        <button onClick={handleSubmit} disabled={submitting} className="inline-flex items-center gap-2 px-5 py-2.5 bg-cyan-600 text-white rounded-xl hover:bg-cyan-700 font-medium text-sm shadow-sm transition-all">
          {submitting ? <FiRefreshCw className="w-4 h-4 animate-spin" /> : <FiRefreshCw className="w-4 h-4" />}
          {submitting ? 'Submitting...' : 'Submit Transfer Request'}
        </button>
      </div>

      {/* Recent Transfer Requests */}
      <div className="thb-card overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
          <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <FiRefreshCw className="w-4 h-4 text-cyan-500" />
            Recent Transfer Requests
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Employee</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">From</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">To</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Transfer Date</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Type</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={6} className="text-center py-8 text-slate-400">Loading...</td></tr>
              ) : records.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12">
                  <FiRefreshCw className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-slate-500">No transfer requests yet</p>
                  <p className="text-xs text-slate-400 mt-1">Submit a transfer request using the form above</p>
                </td></tr>
              ) : records.map(r => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-700">{r.employeeName} <span className="text-slate-400 text-xs">({r.employeeCode})</span></td>
                  <td className="px-4 py-3 text-slate-600">{r.fromDepartment}</td>
                  <td className="px-4 py-3 text-slate-600">{r.toDepartment}</td>
                  <td className="px-4 py-3 text-slate-600">{fmtDate(r.transferDate)}</td>
                  <td className="px-4 py-3 text-slate-600">{transferTypeLabel(r.transferType)}</td>
                  <td className="px-4 py-3">
                    <span className={getStatusBadge(r.status)}>{r.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
