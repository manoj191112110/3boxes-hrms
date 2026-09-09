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
  const isAdmin = ['super_admin', 'tenant_admin', 'admin'].includes(user?.role || '');
  const scopeQuery = useCompanyContextStore(s => s.scopeQuery);
  const selectedTenantId = useCompanyContextStore(s => s.selectedTenantId);

  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [records, setRecords] = useState<ProbationRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const updateField = (field: string, value: string | number | boolean) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const [employeeList, setEmployeeList] = useState<Array<{ id: string; employeeId: string; firstName: string; lastName: string; department?: { id: string; name: string } | null; designation?: { id: string; title: string } | null }>>([]);
  useEffect(() => {
    const sq = scopeQuery();
    fetch(`/api/employees?limit=100&status=active${sq ? `&${sq}` : ''}`, { headers: getAuthHeaders() })
      .then(r => r.ok ? r.json() : { employees: [] })
      .then(d => setEmployeeList(d.employees || []))
      .catch(() => setEmployeeList([]));
  }, [scopeQuery, selectedTenantId]);

  const handleEmployeeSelect = (employeeId: string) => {
    updateField('employeeId', employeeId);
    if (employeeId) {
      const emp = employeeList.find(e => e.id === employeeId);
      if (emp) {
        updateField('employeeName', `${emp.firstName} ${emp.lastName}`);
        updateField('employeeCode', emp.employeeId);
        updateField('department', emp.department?.name || '');
        updateField('designation', emp.designation?.title || '');
      }
    } else {
      updateField('employeeName', '');
      updateField('employeeCode', '');
      updateField('department', '');
      updateField('designation', '');
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
          <label className="block text-xs font-medium text-thb-text-secondary mb-1">Select Employee *</label>
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
            <label className="block text-xs font-medium text-thb-text-secondary mb-1">Probation Start Date *</label>
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
            <label className="block text-xs font-medium text-thb-text-secondary mb-1">Decision *</label>
            <select value={form.decision} onChange={e => updateField('decision', e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400">
              {DECISIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-thb-text-secondary mb-1 flex items-center gap-1"><FiCalendar className="w-3 h-3" /> Effective Date *</label>
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
        <button onClick={handleSubmit} disabled={submitting} className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-600 text-white rounded-xl hover:bg-amber-700 font-medium text-sm shadow-sm transition-all">
          {submitting ? <FiRefreshCw className="w-4 h-4 animate-spin" /> : <FiCheckCircle className="w-4 h-4" />}
          {submitting ? 'Submitting...' : 'Submit Probation Review'}
        </button>
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
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={6} className="text-center py-8 text-slate-400">Loading...</td></tr>
              ) : records.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12">
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
