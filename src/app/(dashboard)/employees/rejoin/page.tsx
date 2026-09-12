'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  FiUserCheck,
  FiArrowLeft,
  FiUser,
  FiCalendar,
  FiFileText,
  FiRefreshCw,
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

const EMPLOYMENT_TYPES = [
  { value: 'full_time', label: 'Full-time' },
  { value: 'part_time', label: 'Part-time' },
  { value: 'contract', label: 'Contract' },
];

interface RejoinRecord {
  id: string;
  employeeName: string;
  previousCode: string;
  newCode: string;
  rejoinDate: string;
  department: string;
  status: string;
  createdAt: string;
}

const initialForm = {
  previousEmployeeId: '',
  previousEmployeeCode: '',
  previousDepartment: '',
  previousDesignation: '',
  rejoinDate: new Date().toISOString().split('T')[0],
  newDepartment: '',
  newDesignation: '',
  newEmployeeCode: '',
  employmentType: 'full_time',
  reportingManager: '',
  serviceContinuity: true,
  leaveBalanceCarryForward: true,
  gratuityContinuity: true,
  rejoinReason: '',
  hrComments: '',
};

export default function RejoinPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const isAdmin = ['super_admin', 'tenant_admin', 'admin'].includes(user?.role || '');
  const { departments, designations, selectedCompanyId } = useCompanyData();
  const scopeQuery = useCompanyContextStore(s => s.scopeQuery);
  const selectedTenantId = useCompanyContextStore(s => s.selectedTenantId);

  // Derive dropdown options from API data (company-scoped)
  const DEPARTMENTS = departments.map(d => ({ value: d.id, label: d.name }));
  const DESIGNATIONS = designations.map(d => ({ value: d.id, label: d.title }));

  // Fetch resigned/terminated employees for dropdown
  const [resignedEmployees, setResignedEmployees] = useState<Array<{ id: string; employeeId: string; firstName: string; lastName: string; department?: { id: string; name: string } | null; designation?: { id: string; title: string } | null; status: string }>>([]);
  useEffect(() => {
    const sq = scopeQuery();
    fetch(`/api/employees?limit=500${sq ? `&${sq}` : ''}`, { headers: getAuthHeaders() })
      .then(r => r.ok ? r.json() : { employees: [] })
      .then(d => {
        const allEmps = d.employees || [];
        // Filter: only resigned or terminated employees are eligible for rejoin
        // (inactive is NOT a real employee status — only active/on_leave/terminated/resigned exist)
        setResignedEmployees(allEmps.filter((e: { status: string }) => e.status === 'resigned' || e.status === 'terminated'));
      })
      .catch(() => setResignedEmployees([]));
  }, [selectedCompanyId, scopeQuery, selectedTenantId]);

  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [records, setRecords] = useState<RejoinRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const updateField = (field: string, value: string | boolean) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handlePreviousEmployeeSelect = (employeeId: string) => {
    updateField('previousEmployeeId', employeeId);
    if (employeeId) {
      const emp = resignedEmployees.find(e => e.id === employeeId);
      if (emp) {
        updateField('previousEmployeeCode', emp.employeeId);
        updateField('previousDepartment', emp.department?.name || '');
        updateField('previousDesignation', emp.designation?.title || '');
      }
    } else {
      updateField('previousEmployeeCode', '');
      updateField('previousDepartment', '');
      updateField('previousDesignation', '');
    }
  };

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams([['limit', '50']]);
      const sq = scopeQuery();
      const res = await fetch(`/api/employees/rejoin?${params.toString()}${sq ? `&${sq}` : ''}`, { headers: getAuthHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      setRecords(data.rejoins || data.data || []);
    } catch {
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [selectedCompanyId, scopeQuery, selectedTenantId]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  const validate = (): string | null => {
    if (!form.previousEmployeeId) return 'Please select the previous employee record';
    if (!form.rejoinDate) return 'Rejoin Date is required';
    if (!form.newDepartment) return 'New Department is required';
    if (!form.newDesignation) return 'New Designation is required';
    if (!form.rejoinReason.trim() || form.rejoinReason.trim().length < 20) return 'Rejoin reason must be at least 20 characters';
    // Reporting Manager name validation: only letters, spaces, hyphens, apostrophes, periods
    if (form.reportingManager.trim()) {
      if (!/^[A-Za-z\u00C0-\u017F\u0900-\u097F\s.'-]+$/.test(form.reportingManager.trim())) {
        return 'Reporting Manager name must contain only letters, spaces, hyphens, apostrophes, or periods. Numbers and special characters are not allowed.';
      }
    }
    return null;
  };

  const handleSubmit = async () => {
    const error = validate();
    if (error) { toast.error(error); return; }

    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        employeeId: form.previousEmployeeId,
        previousEmployeeId: form.previousEmployeeId,
        rejoinDate: form.rejoinDate,
        departmentId: form.newDepartment,
        designationId: form.newDesignation,
        newDepartment: form.newDepartment,
        newDesignation: form.newDesignation,
        newEmployeeCode: form.newEmployeeCode.trim() || null,
        employmentType: form.employmentType,
        reportingManager: form.reportingManager.trim() || null,
        serviceContinuity: form.serviceContinuity,
        leaveBalanceCarryForward: form.leaveBalanceCarryForward,
        gratuityContinuity: form.gratuityContinuity,
        rejoinReason: form.rejoinReason.trim(),
        hrComments: form.hrComments.trim() || null,
      };

      const res = await fetch('/api/employees/rejoin', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit rejoin request');

      toast.success('Rejoin request submitted successfully');
      setForm(initialForm);
      fetchRecords();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to submit rejoin request');
    } finally {
      setSubmitting(false);
    }
  };

  const deptLabel = (v: string) => DEPARTMENTS.find(d => d.value === v)?.label || v;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/employees')} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500">
          <FiArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-thb-text-primary flex items-center gap-2">
            <FiUserCheck className="w-6 h-6 text-emerald-500" />
            Rejoin Employee
          </h1>
          <p className="text-sm text-slate-500 mt-1">Process employee rejoining with continuity tracking for service, leaves, and gratuity</p>
        </div>
      </div>

      {/* Previous Employment */}
      <div className="thb-card p-6 rounded-xl">
        <h2 className="text-lg font-semibold text-thb-text-primary flex items-center gap-2 mb-4">
          <FiUser className="w-5 h-5 text-slate-500" />
          Previous Employment
        </h2>
        <div>
          <label className="block text-xs font-medium text-thb-text-secondary mb-1">Select Past Employee <span className="text-red-500 font-bold">*</span></label>
          <select value={form.previousEmployeeId} onChange={e => handlePreviousEmployeeSelect(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 max-w-md">
            <option value="">Select Previously Employed</option>
            {resignedEmployees.map(e => <option key={e.id} value={e.id}>{e.employeeId} — {e.firstName} {e.lastName} ({e.status === 'resigned' ? 'Resigned' : 'Terminated'})</option>)}
          </select>
        </div>
        {form.previousEmployeeId && (
          <div className="mt-4 p-3 bg-slate-50 rounded-lg">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Previous Details</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
              <div><span className="text-slate-500">Employee Code:</span> <span className="font-medium text-slate-700">{form.previousEmployeeCode}</span></div>
              <div><span className="text-slate-500">Department:</span> <span className="font-medium text-slate-700">{form.previousDepartment}</span></div>
              <div><span className="text-slate-500">Designation:</span> <span className="font-medium text-slate-700">{form.previousDesignation}</span></div>
            </div>
          </div>
        )}
      </div>

      {/* Rejoin Details */}
      <div className="thb-card p-6 rounded-xl">
        <h2 className="text-lg font-semibold text-thb-text-primary flex items-center gap-2 mb-4">
          <FiCalendar className="w-5 h-5 text-teal-500" />
          Rejoin Details
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-thb-text-secondary mb-1 flex items-center gap-1"><FiCalendar className="w-3 h-3" />Rejoin Date <span className="text-red-500 font-bold">*</span></label>
            <input type="date" value={form.rejoinDate} onChange={e => updateField('rejoinDate', e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" />
          </div>
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
            <label className="block text-xs font-medium text-thb-text-secondary mb-1">New Employee Code</label>
            <input type="text" value={form.newEmployeeCode} onChange={e => updateField('newEmployeeCode', e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" placeholder="Auto-generated if empty" />
          </div>
          <div>
            <label className="block text-xs font-medium text-thb-text-secondary mb-1">Employment Type</label>
            <select value={form.employmentType} onChange={e => updateField('employmentType', e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400">
              {EMPLOYMENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-thb-text-secondary mb-1">Reporting Manager</label>
            <input type="text" value={form.reportingManager} onChange={e => updateField('reportingManager', e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" placeholder="Enter manager name" />
          </div>
        </div>
      </div>

      {/* Continuity */}
      <div className="thb-card p-6 rounded-xl">
        <h2 className="text-lg font-semibold text-thb-text-primary flex items-center gap-2 mb-4">
          <FiCheckCircle className="w-5 h-5 text-emerald-500" />
          Continuity Options
        </h2>
        <div className="space-y-3">
          <label className="flex items-start gap-3 text-sm text-slate-700 cursor-pointer">
            <input type="checkbox" checked={form.serviceContinuity} onChange={e => updateField('serviceContinuity', e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 mt-0.5" />
            <div><strong>Service Continuity</strong><p className="text-xs text-slate-400 mt-0.5">Count previous service period towards total tenure for benefits and gratuity calculation</p></div>
          </label>
          <label className="flex items-start gap-3 text-sm text-slate-700 cursor-pointer">
            <input type="checkbox" checked={form.leaveBalanceCarryForward} onChange={e => updateField('leaveBalanceCarryForward', e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 mt-0.5" />
            <div><strong>Leave Balance Carry Forward</strong><p className="text-xs text-slate-400 mt-0.5">Carry forward unused leave balance from previous employment period</p></div>
          </label>
          <label className="flex items-start gap-3 text-sm text-slate-700 cursor-pointer">
            <input type="checkbox" checked={form.gratuityContinuity} onChange={e => updateField('gratuityContinuity', e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 mt-0.5" />
            <div><strong>Gratuity Continuity</strong><p className="text-xs text-slate-400 mt-0.5">Continue gratuity accumulation from previous employment without reset</p></div>
          </label>
        </div>
        {!form.serviceContinuity && (
          <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm text-amber-700">
              <FiAlertCircle className="w-4 h-4 inline mr-1" />
              Without service continuity, the employee will be treated as a new hire for tenure-based benefits and gratuity calculations.
            </p>
          </div>
        )}
      </div>

      {/* Comments */}
      <div className="thb-card p-6 rounded-xl">
        <h2 className="text-lg font-semibold text-thb-text-primary flex items-center gap-2 mb-4">
          <FiFileText className="w-5 h-5 text-slate-500" />
          Comments
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-thb-text-secondary mb-1">Rejoin Reason * <span className="font-normal text-slate-400">(min 20 chars)</span></label>
            <textarea value={form.rejoinReason} onChange={e => updateField('rejoinReason', e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" rows={3} placeholder="Describe the reason for rejoining the organization..." />
            <p className="text-[10px] text-slate-400 mt-0.5">{form.rejoinReason.length}/20 min characters</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-thb-text-secondary mb-1">HR Comments</label>
            <textarea value={form.hrComments} onChange={e => updateField('hrComments', e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" rows={3} placeholder="Any additional comments from HR..." />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <button onClick={() => router.push('/employees')} className="inline-flex items-center gap-2 px-4 py-2.5 bg-white text-thb-text-secondary border border-thb-border rounded-xl hover:bg-slate-50 font-medium text-sm transition-all">
          <FiArrowLeft className="w-4 h-4" /> Cancel
        </button>
        <button onClick={handleSubmit} disabled={submitting} className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 font-medium text-sm shadow-sm transition-all">
          {submitting ? <FiRefreshCw className="w-4 h-4 animate-spin" /> : <FiUserCheck className="w-4 h-4" />}
          {submitting ? 'Processing...' : 'Submit Rejoin Request'}
        </button>
      </div>

      {/* Rejoin Records */}
      <div className="thb-card overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
          <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <FiUserCheck className="w-4 h-4 text-emerald-500" />
            Rejoin Requests
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Employee</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Previous Code</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">New Code</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Rejoin Date</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Department</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={6} className="text-center py-8 text-slate-400">Loading...</td></tr>
              ) : records.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12">
                  <FiUserCheck className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-slate-500">No rejoin requests yet</p>
                  <p className="text-xs text-slate-400 mt-1">Submit a rejoin request using the form above</p>
                </td></tr>
              ) : records.map(r => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-700">{r.employeeName}</td>
                  <td className="px-4 py-3 text-slate-600">{r.previousCode}</td>
                  <td className="px-4 py-3 text-slate-600">{r.newCode}</td>
                  <td className="px-4 py-3 text-slate-600">{fmtDate(r.rejoinDate)}</td>
                  <td className="px-4 py-3 text-slate-600">{deptLabel(r.department)}</td>
                  <td className="px-4 py-3"><span className={getStatusBadge(r.status)}>{r.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
