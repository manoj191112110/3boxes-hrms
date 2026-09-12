'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  FiClock,
  FiArrowLeft,
  FiUser,
  FiCalendar,
  FiStar,
  FiFileText,
  FiRefreshCw,
  FiCheckCircle,
  FiEdit2,
  FiTrash2,
  FiEye,
  FiX,
  FiThumbsUp,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import { useCompanyContextStore } from '@/store/companyContextStore';

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

function getStatusBadge(status: string) {
  const map: Record<string, string> = {
    pending: 'thb-badge thb-badge-warning',
    confirmed: 'thb-badge thb-badge-success',
    extended: 'thb-badge thb-badge-info',
    terminated: 'thb-badge thb-badge-error',
  };
  return map[status] || 'thb-badge thb-badge-info';
}

function fmtDate(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

const PROBATION_PERIODS = [
  { value: 3, label: '3 Months' },
  { value: 6, label: '6 Months' },
  { value: 9, label: '9 Months' },
  { value: 12, label: '12 Months' },
];

const KPI_STATUSES = [
  { value: 'on_track', label: 'On Track' },
  { value: 'delayed', label: 'Delayed' },
  { value: 'at_risk', label: 'At Risk' },
  { value: 'completed', label: 'Completed' },
];

const DECISIONS = [
  { value: 'confirm', label: 'Confirm Employee' },
  { value: 'extend', label: 'Extend Probation' },
  { value: 'terminate', label: 'Terminate Employment' },
];

interface ProbationRecord {
  id: string;
  employeeName: string;
  employeeCode: string;
  probationPeriod: number;
  startDate: string;
  endDate: string;
  decision: string;
  status: string;
  createdAt: string;
  reviewComments?: string;
  workflowStage?: string;
  hrDecision?: string | null;
  hrComments?: string;
  hrActionDate?: string | null;
  mdAction?: string | null;
  mdComments?: string;
  mdActionDate?: string | null;
  autoCreated?: boolean;
  department?: string;
  designation?: string;
  performanceRating?: number;
  kpiStatus?: string;
}

const initialForm = {
  employeeId: '',
  employeeName: '',
  employeeCode: '',
  department: '',
  designation: '',
  probationStartDate: new Date().toISOString().split('T')[0],
  probationPeriod: 6,
  extensionPeriod: 0,
  performanceRating: 3,
  reviewComments: '',
  kpiStatus: 'on_track',
  decision: 'confirm',
  effectiveDate: new Date().toISOString().split('T')[0],
  confirmationLetter: true,
};

export default function ProbationPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const isAdmin = ['super_admin', 'tenant_admin', 'admin', 'company_hr_admin', 'hr_admin', 'manager'].includes((user?.role || '').toLowerCase());
  const scopeQuery = useCompanyContextStore(s => s.scopeQuery);
  const selectedTenantId = useCompanyContextStore(s => s.selectedTenantId);

  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [records, setRecords] = useState<ProbationRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const updateField = (field: string, value: string | number | boolean) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const [employeeList, setEmployeeList] = useState<Array<{ id: string; employeeId: string; firstName: string; lastName: string; status?: string; department?: { id: string; name: string } | null; designation?: { id: string; title: string } | null }>>([]);
  useEffect(() => {
    const sq = scopeQuery();
    fetch(`/api/employees?limit=500${sq ? `&${sq}` : ''}`, { headers: getAuthHeaders() })
      .then(r => r.ok ? r.json() : { employees: [] })
      .then(d => {
        const allEmps = d.employees || [];
        // Filter: only active employees can be put on probation review
        // (inactive/terminated/resigned employees are excluded)
        setEmployeeList(allEmps.filter((e: { status?: string }) => e.status === 'active' || !e.status));
      })
      .catch(() => setEmployeeList([]));
  }, [scopeQuery, selectedTenantId]);

  const handleEmployeeSelect = async (employeeId: string) => {
    updateField('employeeId', employeeId);
    if (employeeId) {
      // Fetch FRESH employee data from the API (not from the cached list)
      // This ensures we get the latest dateOfJoining and other fields
      try {
        const res = await fetch(`/api/employees/${employeeId}`, { headers: getAuthHeaders() });
        if (res.ok) {
          const data = await res.json();
          const emp = data.employee || data;
          updateField('employeeName', `${emp.firstName || ''} ${emp.lastName || ''}`.trim());
          updateField('employeeCode', emp.employeeId || '');
          updateField('department', emp.department?.name || '');
          updateField('designation', emp.designation?.title || '');
          // Auto-populate probation start date from the employee's date of joining
          if (emp.dateOfJoining) {
            const doj = emp.dateOfJoining.split('T')[0];
            updateField('probationStartDate', doj);
          }
        } else {
          // Fallback to cached list
          const emp = employeeList.find(e => e.id === employeeId);
          if (emp) {
            updateField('employeeName', `${emp.firstName} ${emp.lastName}`);
            updateField('employeeCode', emp.employeeId);
            updateField('department', emp.department?.name || '');
            updateField('designation', emp.designation?.title || '');
            if ((emp as any).dateOfJoining) {
              const doj = (emp as any).dateOfJoining.split('T')[0];
              updateField('probationStartDate', doj);
            }
          }
        }
      } catch {
        // Fallback to cached list
        const emp = employeeList.find(e => e.id === employeeId);
        if (emp) {
          updateField('employeeName', `${emp.firstName} ${emp.lastName}`);
          updateField('employeeCode', emp.employeeId);
          updateField('department', emp.department?.name || '');
          updateField('designation', emp.designation?.title || '');
          if ((emp as any).dateOfJoining) {
            const doj = (emp as any).dateOfJoining.split('T')[0];
            updateField('probationStartDate', doj);
          }
        }
      }
    } else {
      updateField('employeeName', '');
      updateField('employeeCode', '');
      updateField('department', '');
      updateField('designation', '');
      updateField('probationStartDate', '');
    }
  };

  // Auto-calculate probation end date
  useEffect(() => {
    if (form.probationStartDate && form.probationPeriod) {
      const start = new Date(form.probationStartDate);
      const end = new Date(start);
      end.setMonth(end.getMonth() + form.probationPeriod + form.extensionPeriod);
      updateField('probationEndDate', end.toISOString().split('T')[0]);
    }
  }, [form.probationStartDate, form.probationPeriod, form.extensionPeriod]);

  const [probationEndDate, setProbationEndDate] = useState('');

  useEffect(() => {
    if (form.probationStartDate && form.probationPeriod) {
      const start = new Date(form.probationStartDate);
      const end = new Date(start);
      end.setMonth(end.getMonth() + form.probationPeriod + form.extensionPeriod);
      setProbationEndDate(end.toISOString().split('T')[0]);
    }
  }, [form.probationStartDate, form.probationPeriod, form.extensionPeriod]);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const sq = scopeQuery();
      const res = await fetch(`/api/employees/probation?limit=50${sq ? `&${sq}` : ''}`, { headers: getAuthHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      setRecords(data.probations || data.data || []);
    } catch {
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [scopeQuery, selectedTenantId]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  const validate = (): string | null => {
    if (!form.employeeId) return 'Please select an employee';
    if (!form.probationStartDate) return 'Probation Start Date is required';
    if (!form.reviewComments.trim() || form.reviewComments.trim().length < 20) return 'Review comments must be at least 20 characters';
    if (form.decision === 'extend' && form.extensionPeriod <= 0) return 'Extension period must be greater than 0';
    return null;
  };

  const handleSubmit = async () => {
    const error = validate();
    if (error) { toast.error(error); return; }

    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        employeeId: form.employeeId,
        probationStartDate: form.probationStartDate,
        probationPeriod: form.probationPeriod,
        extensionPeriod: form.decision === 'extend' ? form.extensionPeriod : 0,
        performanceRating: form.performanceRating,
        reviewComments: form.reviewComments.trim(),
        kpiStatus: form.kpiStatus,
        decision: form.decision,
        effectiveDate: form.effectiveDate,
        confirmationLetter: form.confirmationLetter,
      };

      const res = await fetch('/api/employees/probation', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit probation review');

      toast.success('Probation review submitted successfully');
      setForm(initialForm);
      fetchRecords();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to submit probation review');
    } finally {
      setSubmitting(false);
    }
  };

  const decisionLabel = (v: string) => DECISIONS.find(d => d.value === v)?.label || v;
  const kpiLabel = (v: string) => KPI_STATUSES.find(k => k.value === v)?.label || v;

  // ─── Edit/Delete/Approve handlers ───
  const [viewRecord, setViewRecord] = useState<ProbationRecord | null>(null);
  const [editRecord, setEditRecord] = useState<ProbationRecord | null>(null);
  const [approveRecord, setApproveRecord] = useState<ProbationRecord | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [hrComments, setHrComments] = useState('');
  const [extendPeriod, setExtendPeriod] = useState(1);

  const handleEdit = async (record: ProbationRecord) => {
    // Load the full record via GET to populate the form
    try {
      const res = await fetch(`/api/employees/probation/${record.id}`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Failed to load record');
      const data = await res.json();
      const p = data.probation;
      setForm({
        ...initialForm,
        employeeId: p.employeeId,
        employeeName: p.employeeName,
        employeeCode: p.employeeCode,
        probationStartDate: p.probationStartDate || '',
        probationPeriod: p.probationPeriod || 6,
        extensionPeriod: p.extensionPeriod || 0,
        performanceRating: p.performanceRating || 3,
        reviewComments: p.reviewComments || '',
        kpiStatus: p.kpiStatus || 'pending',
        decision: p.decision || 'pending',
        effectiveDate: p.effectiveDate || '',
        confirmationLetter: p.confirmationLetter || '',
      });
      setEditRecord(record);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load record');
    }
  };

  const handleEditSubmit = async () => {
    if (!editRecord) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/employees/probation/${editRecord.id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          probationStartDate: form.probationStartDate,
          probationPeriod: form.probationPeriod,
          extensionPeriod: form.extensionPeriod,
          performanceRating: form.performanceRating,
          reviewComments: form.reviewComments.trim(),
          kpiStatus: form.kpiStatus,
          decision: form.decision,
          effectiveDate: form.effectiveDate,
          confirmationLetter: form.confirmationLetter,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update');
      toast.success('Probation review updated successfully');
      setEditRecord(null);
      setForm(initialForm);
      fetchRecords();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (record: ProbationRecord) => {
    if (!confirm(`Delete probation review for ${record.employeeName}? This cannot be undone.`)) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/employees/probation/${record.id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete');
      toast.success('Probation review deleted');
      fetchRecords();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete');
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprove = async (action: 'approve' | 'extend' | 'reject') => {
    if (!approveRecord) return;
    setActionLoading(true);
    try {
      const body: Record<string, unknown> = { action, comments: hrComments };
      if (action === 'extend') body.extensionPeriod = extendPeriod;
      const res = await fetch(`/api/employees/probation/${approveRecord.id}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to process');
      toast.success(`Probation review ${action}d successfully`);
      setApproveRecord(null);
      setHrComments('');
      setExtendPeriod(1);
      fetchRecords();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to process');
    } finally {
      setActionLoading(false);
    }
  };

  const statusLabel = (s: string, ws?: string) => {
    if (ws === 'md_review') return 'Awaiting MD Approval';
    if (ws === 'completed' && s === 'completed') return 'Confirmed';
    if (ws === 'completed' && s === 'in_progress') return 'Extended';
    if (ws === 'completed' && s === 'rejected') return 'Terminated';
    const map: Record<string, string> = {
      pending: 'Pending HR Review',
      completed: 'Confirmed',
      in_progress: 'Extended',
      rejected: 'Terminated',
    };
    return map[s] || s;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/employees')} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500">
          <FiArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-thb-text-primary flex items-center gap-2">
            <FiClock className="w-6 h-6 text-amber-500" />
            Probation Review
          </h1>
          <p className="text-sm text-slate-500 mt-1">Review and manage employee probation periods — confirm, extend, or terminate</p>
        </div>
      </div>

      {/* Employee on Probation */}
      <div className="thb-card p-6 rounded-xl">
        <h2 className="text-lg font-semibold text-thb-text-primary flex items-center gap-2 mb-4">
          <FiUser className="w-5 h-5 text-cyan-500" />
          Employee on Probation
        </h2>
        <div>
          <label className="block text-xs font-medium text-thb-text-secondary mb-1">Select Employee <span className="text-red-500 font-bold">*</span></label>
          <select value={form.employeeId} onChange={e => handleEmployeeSelect(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 max-w-md">
            <option value="">Select Employee</option>
            {employeeList.map(e => <option key={e.id} value={e.id}>{e.employeeId} — {e.firstName} {e.lastName}</option>)}
          </select>
        </div>
        {form.employeeId && (
          <div className="mt-4 p-3 bg-slate-50 rounded-lg">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div><span className="text-slate-500">Name:</span> <span className="font-medium text-slate-700">{form.employeeName}</span></div>
              <div><span className="text-slate-500">Code:</span> <span className="font-medium text-slate-700">{form.employeeCode}</span></div>
              <div><span className="text-slate-500">Department:</span> <span className="font-medium text-slate-700">{form.department}</span></div>
              <div><span className="text-slate-500">Designation:</span> <span className="font-medium text-slate-700">{form.designation}</span></div>
            </div>
          </div>
        )}
      </div>

      {/* Probation Details */}
      <div className="thb-card p-6 rounded-xl">
        <h2 className="text-lg font-semibold text-thb-text-primary flex items-center gap-2 mb-4">
          <FiCalendar className="w-5 h-5 text-teal-500" />
          Probation Details
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-thb-text-secondary mb-1">Probation Start Date <span className="text-red-500 font-bold">*</span></label>
            <input type="date" value={form.probationStartDate} onChange={e => updateField('probationStartDate', e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-thb-text-secondary mb-1">Probation Period</label>
            <select value={form.probationPeriod} onChange={e => updateField('probationPeriod', Number(e.target.value))} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400">
              {PROBATION_PERIODS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-thb-text-secondary mb-1">Probation End Date</label>
            <input type="date" value={probationEndDate} readOnly className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" />
          </div>
        </div>
      </div>

      {/* Performance Review */}
      <div className="thb-card p-6 rounded-xl">
        <h2 className="text-lg font-semibold text-thb-text-primary flex items-center gap-2 mb-4">
          <FiStar className="w-5 h-5 text-amber-500" />
          Performance Review
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-thb-text-secondary mb-1">Performance Rating (1-5)</label>
            <select value={form.performanceRating} onChange={e => updateField('performanceRating', Number(e.target.value))} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400">
              {[1, 2, 3, 4, 5].map(r => <option key={r} value={r}>{r} — {r <= 2 ? 'Below Expectations' : r === 3 ? 'Meets Expectations' : r === 4 ? 'Exceeds Expectations' : 'Outstanding'}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-thb-text-secondary mb-1">KPI Status</label>
            <select value={form.kpiStatus} onChange={e => updateField('kpiStatus', e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400">
              {KPI_STATUSES.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}
            </select>
          </div>
        </div>
        <div className="mt-4">
          <label className="block text-xs font-medium text-thb-text-secondary mb-1">Review Comments * <span className="font-normal text-slate-400">(min 20 chars)</span></label>
          <textarea value={form.reviewComments} onChange={e => updateField('reviewComments', e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" rows={3} placeholder="Provide detailed performance review comments..." />
          <p className="text-[10px] text-slate-400 mt-0.5">{form.reviewComments.length}/20 min characters</p>
        </div>
      </div>

      {/* Decision */}
      <div className="thb-card p-6 rounded-xl">
        <h2 className="text-lg font-semibold text-thb-text-primary flex items-center gap-2 mb-4">
          <FiCheckCircle className="w-5 h-5 text-emerald-500" />
          Decision
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-thb-text-secondary mb-1">Decision <span className="text-red-500 font-bold">*</span></label>
            <select value={form.decision} onChange={e => updateField('decision', e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400">
              {DECISIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-thb-text-secondary mb-1 flex items-center gap-1"><FiCalendar className="w-3 h-3" />Effective Date <span className="text-red-500 font-bold">*</span></label>
            <input type="date" value={form.effectiveDate} onChange={e => updateField('effectiveDate', e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" />
          </div>
          <div className="flex items-center gap-3 pt-5">
            <input type="checkbox" id="confirm-letter" checked={form.confirmationLetter} onChange={e => updateField('confirmationLetter', e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
            <label htmlFor="confirm-letter" className="text-sm text-slate-700">Generate Confirmation Letter</label>
          </div>
        </div>

        {form.decision === 'extend' && (
          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <label className="block text-xs font-medium text-amber-700 mb-1">Extension Period (months)</label>
            <select value={form.extensionPeriod} onChange={e => updateField('extensionPeriod', Number(e.target.value))} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 max-w-xs">
              <option value={1}>1 Month</option>
              <option value={2}>2 Months</option>
              <option value={3}>3 Months</option>
              <option value={6}>6 Months</option>
            </select>
            <p className="text-xs text-amber-600 mt-1">The probation period will be extended by the selected duration</p>
          </div>
        )}

        {form.decision === 'terminate' && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm font-medium text-red-700">Warning: This will initiate the termination process for this employee. Ensure all performance reviews and documentation are complete before proceeding.</p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <button onClick={() => router.push('/employees')} className="inline-flex items-center gap-2 px-4 py-2.5 bg-white text-thb-text-secondary border border-thb-border rounded-xl hover:bg-slate-50 font-medium text-sm transition-all">
          <FiArrowLeft className="w-4 h-4" /> Cancel
        </button>
        {editRecord ? (
          <>
            <button onClick={() => { setEditRecord(null); setForm(initialForm); }} className="inline-flex items-center gap-2 px-4 py-2.5 bg-white text-thb-text-secondary border border-thb-border rounded-xl hover:bg-slate-50 font-medium text-sm transition-all">
              <FiX className="w-4 h-4" /> Cancel Edit
            </button>
            <button onClick={handleEditSubmit} disabled={actionLoading} className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-medium text-sm shadow-sm transition-all">
              {actionLoading ? <FiRefreshCw className="w-4 h-4 animate-spin" /> : <FiEdit2 className="w-4 h-4" />}
              {actionLoading ? 'Updating...' : 'Update Review'}
            </button>
          </>
        ) : (
          <button onClick={handleSubmit} disabled={submitting} className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-600 text-white rounded-xl hover:bg-amber-700 font-medium text-sm shadow-sm transition-all">
            {submitting ? <FiRefreshCw className="w-4 h-4 animate-spin" /> : <FiCheckCircle className="w-4 h-4" />}
            {submitting ? 'Submitting...' : 'Submit Probation Review'}
          </button>
        )}
      </div>

      {/* Probation Records */}
      <div className="thb-card overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
          <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <FiClock className="w-4 h-4 text-amber-500" />
            Probation Reviews
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Employee</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Period</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Start</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">End</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Decision</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Status</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={7} className="text-center py-8 text-slate-400">Loading...</td></tr>
              ) : records.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12">
                  <FiClock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-slate-500">No probation reviews yet</p>
                  <p className="text-xs text-slate-400 mt-1">Submit a probation review using the form above</p>
                </td></tr>
              ) : records.map(r => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-700">{r.employeeName} <span className="text-slate-400 text-xs">({r.employeeCode})</span></td>
                  <td className="px-4 py-3 text-slate-600">{r.probationPeriod} months</td>
                  <td className="px-4 py-3 text-slate-600">{fmtDate(r.startDate)}</td>
                  <td className="px-4 py-3 text-slate-600">{fmtDate(r.endDate)}</td>
                  <td className="px-4 py-3 text-slate-600">{decisionLabel(r.decision)}</td>
                  <td className="px-4 py-3"><span className={getStatusBadge(r.status)}>{statusLabel(r.status, r.workflowStage)}</span></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      {/* View */}
                      <button onClick={() => setViewRecord(r)} className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="View details">
                        <FiEye className="w-4 h-4" />
                      </button>
                      {/* Edit — only for pending reviews */}
                      {r.status === 'pending' && (
                        <button onClick={() => handleEdit(r)} className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors" title="Edit review">
                          <FiEdit2 className="w-4 h-4" />
                        </button>
                      )}
                      {/* Delete — only for pending reviews, admin only */}
                      {r.status === 'pending' && isAdmin && (
                        <button onClick={() => handleDelete(r)} disabled={actionLoading} className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50" title="Delete review">
                          <FiTrash2 className="w-4 h-4" />
                        </button>
                      )}
                      {/* Approve/Extend/Reject — admin only, only for pending reviews */}
                      {r.status === 'pending' && isAdmin && (
                        <button onClick={() => { setApproveRecord(r); setHrComments(''); setExtendPeriod(1); }} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors" title={r.workflowStage === 'md_review' ? 'MD/Admin Final Approval' : 'HR Review & Submit to MD'}>
                          <FiThumbsUp className="w-3.5 h-3.5" /> {r.workflowStage === 'md_review' ? 'MD Approve' : 'HR Review'}
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

      {/* ─── View Record Modal ─── */}
      {viewRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => setViewRecord(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-800">Probation Review Details</h3>
              <button onClick={() => setViewRecord(null)} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg">
                <FiX className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-slate-500">Employee:</span> <span className="font-medium text-slate-800">{viewRecord.employeeName}</span></div>
                <div><span className="text-slate-500">Employee ID:</span> <span className="font-medium text-slate-800">{viewRecord.employeeCode}</span></div>
                <div><span className="text-slate-500">Department:</span> <span className="font-medium text-slate-800">{viewRecord.department || '—'}</span></div>
                <div><span className="text-slate-500">Designation:</span> <span className="font-medium text-slate-800">{viewRecord.designation || '—'}</span></div>
                <div><span className="text-slate-500">Start Date:</span> <span className="font-medium text-slate-800">{fmtDate(viewRecord.startDate)}</span></div>
                <div><span className="text-slate-500">End Date:</span> <span className="font-medium text-slate-800">{fmtDate(viewRecord.endDate)}</span></div>
                <div><span className="text-slate-500">Period:</span> <span className="font-medium text-slate-800">{viewRecord.probationPeriod} months</span></div>
                <div><span className="text-slate-500">Extension:</span> <span className="font-medium text-slate-800">{viewRecord.extensionPeriod || 0} months</span></div>
                <div><span className="text-slate-500">Performance:</span> <span className="font-medium text-slate-800">{viewRecord.performanceRating || 0}/5</span></div>
                <div><span className="text-slate-500">KPI Status:</span> <span className="font-medium text-slate-800 capitalize">{viewRecord.kpiStatus || 'pending'}</span></div>
                <div><span className="text-slate-500">Decision:</span> <span className="font-medium text-slate-800">{decisionLabel(viewRecord.decision)}</span></div>
                <div><span className="text-slate-500">Status:</span> <span className="font-medium text-slate-800">{statusLabel(viewRecord.status, viewRecord.workflowStage)}</span></div>
              </div>
              <div>
                <span className="text-slate-500 block mb-1">Review Comments:</span>
                <p className="text-slate-700 bg-slate-50 p-3 rounded-lg whitespace-pre-wrap">{viewRecord.reviewComments || 'No comments provided'}</p>
              </div>
              {viewRecord.autoCreated && (
                <div className="p-2 bg-blue-50 border border-blue-100 rounded-lg">
                  <p className="text-xs text-blue-600">ℹ This review was auto-created when the employee was added with status "Probation".</p>
                </div>
              )}
              {viewRecord.hrDecision && (
                <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg">
                  <p className="text-xs font-semibold text-amber-700 mb-1">HR Decision: {decisionLabel(viewRecord.hrDecision)}</p>
                  <p className="text-xs text-amber-600">{viewRecord.hrComments || 'No HR comments'}</p>
                  {viewRecord.hrActionDate && <p className="text-[10px] text-amber-500 mt-1">Submitted: {fmtDate(viewRecord.hrActionDate)}</p>}
                </div>
              )}
              {viewRecord.mdAction && (
                <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-lg">
                  <p className="text-xs font-semibold text-emerald-700 mb-1">MD/Admin Final Decision: {decisionLabel(viewRecord.mdAction)}</p>
                  <p className="text-xs text-emerald-600">{viewRecord.mdComments || 'No MD comments'}</p>
                  {viewRecord.mdActionDate && <p className="text-[10px] text-emerald-500 mt-1">Finalized: {fmtDate(viewRecord.mdActionDate)}</p>}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── Approve/Reject Modal ─── */}
      {approveRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => setApproveRecord(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-800">Review Probation — {approveRecord.employeeName}</h3>
              <button onClick={() => setApproveRecord(null)} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg">
                <FiX className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="text-sm text-slate-600">
                <p><strong>Employee:</strong> {approveRecord.employeeName} ({approveRecord.employeeCode})</p>
                <p><strong>Department:</strong> {approveRecord.department || '—'}</p>
                <p><strong>Designation:</strong> {approveRecord.designation || '—'}</p>
                <p><strong>Period:</strong> {approveRecord.probationPeriod} months</p>
                <p><strong>Status:</strong> {statusLabel(approveRecord.status, approveRecord.workflowStage)}</p>
              </div>
              {approveRecord.reviewComments && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <p className="text-xs font-semibold text-slate-600 mb-1">Review Comments:</p>
                  <p className="text-xs text-slate-600 whitespace-pre-wrap">{approveRecord.reviewComments}</p>
                </div>
              )}
              {approveRecord.hrDecision && approveRecord.workflowStage === 'md_review' && (
                <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg">
                  <p className="text-xs font-semibold text-amber-700 mb-1">HR Submitted Decision: {decisionLabel(approveRecord.hrDecision)}</p>
                  <p className="text-xs text-amber-600">{approveRecord.hrComments || 'No HR comments'}</p>
                  <p className="text-[10px] text-amber-500 mt-1">Please review and provide your final decision.</p>
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  {approveRecord.workflowStage === 'md_review' ? 'MD/Admin Comments' : 'HR Comments'} <span className="text-slate-400">(optional)</span>
                </label>
                <textarea value={hrComments} onChange={e => setHrComments(e.target.value)} rows={3} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 resize-none" placeholder="Add your comments for this decision..." />
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleApprove('approve')} disabled={actionLoading} className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium text-sm transition-colors disabled:opacity-50">
                  <FiCheckCircle className="w-4 h-4" /> Confirm
                </button>
                <button onClick={() => handleApprove('extend')} disabled={actionLoading} className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 font-medium text-sm transition-colors disabled:opacity-50">
                  <FiClock className="w-4 h-4" /> Extend
                </button>
                <button onClick={() => handleApprove('reject')} disabled={actionLoading} className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium text-sm transition-colors disabled:opacity-50">
                  <FiX className="w-4 h-4" /> Reject
                </button>
              </div>
              {actionLoading && <p className="text-xs text-slate-500 text-center">Processing...</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
