'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  FiFileText,
  FiArrowLeft,
  FiUser,
  FiCalendar,
  FiClock,
  FiAlertCircle,
  FiCheckSquare,
  FiRefreshCw,
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

const REASON_CATEGORIES = [
  { value: 'personal', label: 'Personal' },
  { value: 'career_growth', label: 'Career Growth' },
  { value: 'compensation', label: 'Compensation' },
  { value: 'work_environment', label: 'Work Environment' },
  { value: 'relocation', label: 'Relocation' },
  { value: 'health', label: 'Health' },
  { value: 'other', label: 'Other' },
];

interface ResignationRecord {
  id: string;
  employeeName: string;
  employeeCode: string;
  department: string;
  resignationDate: string;
  lastWorkingDate: string;
  reasonCategory: string;
  status: string;
  createdAt: string;
}

const initialForm = {
  employeeName: '',
  employeeCode: '',
  department: '',
  designation: '',
  resignationDate: new Date().toISOString().split('T')[0],
  lastWorkingDate: '',
  reasonCategory: 'personal',
  detailedReason: '',
  noticePeriodDays: 30,
  isNoticePeriodWaived: false,
  waiverReason: '',
  handoverPlan: '',
  pendingTasks: '',
};

export default function ResignationPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const scopeQuery = useCompanyContextStore(s => s.scopeQuery);
  const selectedTenantId = useCompanyContextStore(s => s.selectedTenantId);

  const [form, setForm] = useState({
    ...initialForm,
    employeeName: user?.name || '',
    employeeCode: user?.employee?.employeeId || '',
    department: user?.employee?.department || '',
    designation: user?.employee?.designation || '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [records, setRecords] = useState<ResignationRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const updateField = (field: string, value: string | boolean | number) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  // Auto-calculate last working date based on notice period
  useEffect(() => {
    if (form.resignationDate && form.noticePeriodDays) {
      const resignDate = new Date(form.resignationDate);
      const lastDate = new Date(resignDate);
      lastDate.setDate(lastDate.getDate() + Number(form.noticePeriodDays));
      updateField('lastWorkingDate', lastDate.toISOString().split('T')[0]);
    }
  }, [form.resignationDate, form.noticePeriodDays]);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const sq = scopeQuery();
      const res = await fetch(`/api/employees/resignation?limit=50${sq ? `&${sq}` : ''}`, { headers: getAuthHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      setRecords(data.resignations || data.data || []);
    } catch {
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [scopeQuery, selectedTenantId]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  const validate = (): string | null => {
    if (!form.resignationDate) return 'Resignation Date is required';
    if (!form.lastWorkingDate) return 'Last Working Date is required';
    if (!form.reasonCategory) return 'Reason Category is required';
    if (!form.detailedReason.trim() || form.detailedReason.trim().length < 20) return 'Detailed reason must be at least 20 characters';
    if (form.isNoticePeriodWaived && !form.waiverReason.trim()) return 'Waiver reason is required when notice period is waived';
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
        employeeId: user?.employee?.id || null,
        employeeName: form.employeeName,
        employeeCode: form.employeeCode,
        department: form.department,
        designation: form.designation,
        resignationDate: form.resignationDate,
        lastWorkingDate: form.lastWorkingDate,
        reasonCategory: form.reasonCategory,
        detailedReason: form.detailedReason.trim(),
        noticePeriodDays: form.noticePeriodDays,
        isNoticePeriodWaived: form.isNoticePeriodWaived,
        waiverReason: form.isNoticePeriodWaived ? form.waiverReason.trim() : null,
        handoverPlan: form.handoverPlan.trim() || null,
        pendingTasks: form.pendingTasks.trim() || null,
      };

      const res = await fetch('/api/employees/resignation', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit resignation');

      toast.success('Resignation submitted successfully');
      setForm({ ...initialForm, employeeName: user?.name || '', employeeCode: user?.employee?.employeeId || '', department: user?.employee?.department || '', designation: user?.employee?.designation || '' });
      fetchRecords();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to submit resignation');
    } finally {
      setSubmitting(false);
    }
  };

  const reasonLabel = (v: string) => REASON_CATEGORIES.find(c => c.value === v)?.label || v;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/employees')} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500">
          <FiArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-thb-text-primary flex items-center gap-2">
            <FiFileText className="w-6 h-6 text-amber-500" />
            Resignation
          </h1>
          <p className="text-sm text-slate-500 mt-1">Submit and manage employee resignation requests with notice period tracking</p>
        </div>
      </div>

      {/* Employee Details */}
      <div className="thb-card p-6 rounded-xl">
        <h2 className="text-lg font-semibold text-thb-text-primary flex items-center gap-2 mb-4">
          <FiUser className="w-5 h-5 text-cyan-500" />
          Employee Details
        </h2>
        <div className="p-3 bg-slate-50 rounded-lg">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-sm">
            <div><span className="text-slate-500">Name:</span> <span className="font-medium text-slate-700">{form.employeeName || '—'}</span></div>
            <div><span className="text-slate-500">Employee Code:</span> <span className="font-medium text-slate-700">{form.employeeCode || '—'}</span></div>
            <div><span className="text-slate-500">Department:</span> <span className="font-medium text-slate-700">{form.department || '—'}</span></div>
            <div><span className="text-slate-500">Designation:</span> <span className="font-medium text-slate-700">{form.designation || '—'}</span></div>
          </div>
        </div>
      </div>

      {/* Resignation Details */}
      <div className="thb-card p-6 rounded-xl">
        <h2 className="text-lg font-semibold text-thb-text-primary flex items-center gap-2 mb-4">
          <FiCalendar className="w-5 h-5 text-teal-500" />
          Resignation Details
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-thb-text-secondary mb-1">Resignation Date <span className="text-red-500 font-bold">*</span></label>
            <input type="date" value={form.resignationDate} onChange={e => updateField('resignationDate', e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-thb-text-secondary mb-1">Last Working Date <span className="text-red-500 font-bold">*</span></label>
            <input type="date" value={form.lastWorkingDate} onChange={e => updateField('lastWorkingDate', e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-thb-text-secondary mb-1">Reason Category <span className="text-red-500 font-bold">*</span></label>
            <select value={form.reasonCategory} onChange={e => updateField('reasonCategory', e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400">
              {REASON_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
        </div>
        <div className="mt-4">
          <label className="block text-xs font-medium text-thb-text-secondary mb-1">Detailed Reason * <span className="font-normal text-slate-400">(min 20 chars)</span></label>
          <textarea value={form.detailedReason} onChange={e => updateField('detailedReason', e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" rows={3} placeholder="Please describe your reason for resigning in detail..." />
          <p className="text-[10px] text-slate-400 mt-0.5">{form.detailedReason.length}/20 min characters</p>
        </div>
      </div>

      {/* Notice Period */}
      <div className="thb-card p-6 rounded-xl">
        <h2 className="text-lg font-semibold text-thb-text-primary flex items-center gap-2 mb-4">
          <FiClock className="w-5 h-5 text-amber-500" />
          Notice Period
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-thb-text-secondary mb-1">Notice Period (Days)</label>
            <select value={form.noticePeriodDays} onChange={e => updateField('noticePeriodDays', Number(e.target.value))} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400">
              <option value={7}>7 Days</option>
              <option value={15}>15 Days</option>
              <option value={30}>30 Days</option>
              <option value={60}>60 Days</option>
              <option value={90}>90 Days</option>
            </select>
            <p className="text-[10px] text-slate-400 mt-0.5">Auto-calculated based on company policy</p>
          </div>
          <div className="flex items-center gap-3 pt-5">
            <input type="checkbox" id="notice-waived" checked={form.isNoticePeriodWaived} onChange={e => updateField('isNoticePeriodWaived', e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500" />
            <label htmlFor="notice-waived" className="text-sm text-slate-700">Is Notice Period Waived?</label>
          </div>
        </div>

        {form.isNoticePeriodWaived && (
          <div className="mt-4">
            <label className="block text-xs font-medium text-thb-text-secondary mb-1 flex items-center gap-1"><FiAlertCircle className="w-3 h-3 text-amber-500" />Waiver Reason <span className="text-red-500 font-bold">*</span></label>
            <textarea value={form.waiverReason} onChange={e => updateField('waiverReason', e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" rows={2} placeholder="Provide reason for waiving the notice period..." />
          </div>
        )}

        <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-sm font-medium text-amber-700">
            <FiClock className="w-4 h-4 inline mr-1" />
            Last Working Date: <strong>{fmtDate(form.lastWorkingDate)}</strong> ({form.noticePeriodDays} days notice)
          </p>
        </div>
      </div>

      {/* Exit Process */}
      <div className="thb-card p-6 rounded-xl">
        <h2 className="text-lg font-semibold text-thb-text-primary flex items-center gap-2 mb-4">
          <FiCheckSquare className="w-5 h-5 text-emerald-500" />
          Exit Process
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-thb-text-secondary mb-1">Handover Plan</label>
            <textarea value={form.handoverPlan} onChange={e => updateField('handoverPlan', e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" rows={3} placeholder="Describe your handover plan for ongoing tasks and projects..." />
          </div>
          <div>
            <label className="block text-xs font-medium text-thb-text-secondary mb-1">Pending Tasks</label>
            <textarea value={form.pendingTasks} onChange={e => updateField('pendingTasks', e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" rows={3} placeholder="List any pending tasks or deliverables..." />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <button onClick={() => router.push('/employees')} className="inline-flex items-center gap-2 px-4 py-2.5 bg-white text-thb-text-secondary border border-thb-border rounded-xl hover:bg-slate-50 font-medium text-sm transition-all">
          <FiArrowLeft className="w-4 h-4" /> Cancel
        </button>
        <button onClick={handleSubmit} disabled={submitting} className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-600 text-white rounded-xl hover:bg-amber-700 font-medium text-sm shadow-sm transition-all">
          {submitting ? <FiRefreshCw className="w-4 h-4 animate-spin" /> : <FiFileText className="w-4 h-4" />}
          {submitting ? 'Submitting...' : 'Submit Resignation'}
        </button>
      </div>

      {/* Resignation Records */}
      <div className="thb-card overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
          <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <FiFileText className="w-4 h-4 text-amber-500" />
            Resignation Requests
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Employee</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Department</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Resignation Date</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Last Working Day</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Reason</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={6} className="text-center py-8 text-slate-400">Loading...</td></tr>
              ) : records.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12">
                  <FiFileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-slate-500">No resignation requests yet</p>
                  <p className="text-xs text-slate-400 mt-1">Submit a resignation request using the form above</p>
                </td></tr>
              ) : records.map(r => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-700">{r.employeeName} <span className="text-slate-400 text-xs">({r.employeeCode})</span></td>
                  <td className="px-4 py-3 text-slate-600">{r.department}</td>
                  <td className="px-4 py-3 text-slate-600">{fmtDate(r.resignationDate)}</td>
                  <td className="px-4 py-3 text-slate-600">{fmtDate(r.lastWorkingDate)}</td>
                  <td className="px-4 py-3 text-slate-600">{reasonLabel(r.reasonCategory)}</td>
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
