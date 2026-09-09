'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  FiAlertCircle,
  FiArrowLeft,
  FiUser,
  FiCalendar,
  FiFileText,
  FiRefreshCw,
  FiCheckSquare,
  FiPackage,
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

const TERMINATION_TYPES = [
  { value: 'voluntary', label: 'Voluntary Resignation' },
  { value: 'involuntary', label: 'Involuntary Termination' },
  { value: 'for_cause', label: 'Termination for Cause' },
  { value: 'mutual_agreement', label: 'Mutual Agreement' },
  { value: 'layoff', label: 'Layoff / Redundancy' },
  { value: 'retirement', label: 'Retirement' },
];

const REASON_CATEGORIES = [
  { value: 'performance', label: 'Performance' },
  { value: 'misconduct', label: 'Misconduct' },
  { value: 'redundancy', label: 'Redundancy' },
  { value: 'policy_violation', label: 'Policy Violation' },
  { value: 'attendance', label: 'Attendance Issues' },
  { value: 'other', label: 'Other' },
];

const ASSET_ITEMS = [
  { key: 'laptop', label: 'Laptop' },
  { key: 'id_card', label: 'ID Card' },
  { key: 'access_card', label: 'Access Card' },
  { key: 'mobile', label: 'Mobile Phone' },
  { key: 'documents', label: 'Company Documents' },
  { key: 'keys', label: 'Office Keys' },
];

interface TerminationRecord {
  id: string;
  employeeName: string;
  employeeCode: string;
  terminationType: string;
  terminationDate: string;
  reasonCategory: string;
  status: string;
  createdAt: string;
}

const initialForm = {
  employeeId: '',
  employeeName: '',
  employeeCode: '',
  department: '',
  designation: '',
  terminationType: 'involuntary',
  terminationDate: new Date().toISOString().split('T')[0],
  lastWorkingDate: '',
  noticePeriodServed: 'yes',
  reasonCategory: 'performance',
  detailedReason: '',
  assetsToReturn: [] as string[],
  finalSettlementRequired: true,
};

export default function TerminationPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const isAdmin = ['super_admin', 'tenant_admin', 'admin'].includes(user?.role || '');
  const scopeQuery = useCompanyContextStore(s => s.scopeQuery);
  const selectedTenantId = useCompanyContextStore(s => s.selectedTenantId);

  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [records, setRecords] = useState<TerminationRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const updateField = (field: string, value: string | boolean | string[]) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const toggleAsset = (key: string) => {
    setForm(prev => ({
      ...prev,
      assetsToReturn: prev.assetsToReturn.includes(key)
        ? prev.assetsToReturn.filter(a => a !== key)
        : [...prev.assetsToReturn, key],
    }));
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

  // Auto-calculate last working date based on notice period
  useEffect(() => {
    if (form.terminationDate && form.noticePeriodServed === 'no') {
      updateField('lastWorkingDate', form.terminationDate);
    } else if (form.terminationDate && form.noticePeriodServed === 'yes') {
      const termDate = new Date(form.terminationDate);
      const lastDate = new Date(termDate);
      lastDate.setDate(lastDate.getDate() + 30);
      updateField('lastWorkingDate', lastDate.toISOString().split('T')[0]);
    }
  }, [form.terminationDate, form.noticePeriodServed]);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const sq = scopeQuery();
      const res = await fetch(`/api/employees/termination?limit=50${sq ? `&${sq}` : ''}`, { headers: getAuthHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      setRecords(data.terminations || data.data || []);
    } catch {
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [scopeQuery, selectedTenantId]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  const validate = (): string | null => {
    if (!form.employeeId) return 'Please select an employee';
    if (!form.terminationType) return 'Termination Type is required';
    if (!form.terminationDate) return 'Termination Date is required';
    if (!form.lastWorkingDate) return 'Last Working Date is required';
    if (!form.reasonCategory) return 'Reason Category is required';
    if (!form.detailedReason.trim() || form.detailedReason.trim().length < 20) return 'Detailed reason must be at least 20 characters';
    return null;
  };

  const handleSubmit = async () => {
    const error = validate();
    if (error) { toast.error(error); return; }

    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        employeeId: form.employeeId,
        terminationType: form.terminationType,
        terminationDate: form.terminationDate,
        lastWorkingDate: form.lastWorkingDate,
        noticePeriodServed: form.noticePeriodServed === 'yes',
        reasonCategory: form.reasonCategory,
        detailedReason: form.detailedReason.trim(),
        assetsToReturn: form.assetsToReturn,
        finalSettlementRequired: form.finalSettlementRequired,
      };

      const res = await fetch('/api/employees/termination', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit termination');

      toast.success('Termination request submitted successfully');
      setForm(initialForm);
      fetchRecords();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to submit termination request');
    } finally {
      setSubmitting(false);
    }
  };

  const termTypeLabel = (v: string) => TERMINATION_TYPES.find(t => t.value === v)?.label || v;
  const reasonLabel = (v: string) => REASON_CATEGORIES.find(c => c.value === v)?.label || v;

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="text-center">
          <FiAlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">Only administrators can process employee terminations.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/employees')} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500">
          <FiArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-thb-text-primary flex items-center gap-2">
            <FiAlertCircle className="w-6 h-6 text-red-500" />
            Employee Termination
          </h1>
          <p className="text-sm text-slate-500 mt-1">Process employee termination with exit clearance and final settlement tracking</p>
        </div>
      </div>

      {/* Select Employee */}
      <div className="thb-card p-6 rounded-xl">
        <h2 className="text-lg font-semibold text-thb-text-primary flex items-center gap-2 mb-4">
          <FiUser className="w-5 h-5 text-cyan-500" />
          Select Employee
        </h2>
        <div>
          <label className="block text-xs font-medium text-thb-text-secondary mb-1">Employee *</label>
            <select value={form.employeeId} onChange={e => handleEmployeeSelect(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 max-w-md">
              <option value="">Select Employee</option>
              {employeeList.map(e => <option key={e.id} value={e.id}>{e.employeeId} — {e.firstName} {e.lastName}</option>)}
            </select>
        </div>
        {form.employeeId && (
          <div className="mt-4 p-3 bg-slate-50 rounded-lg">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Current Details</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div><span className="text-slate-500">Name:</span> <span className="font-medium text-slate-700">{form.employeeName}</span></div>
              <div><span className="text-slate-500">Code:</span> <span className="font-medium text-slate-700">{form.employeeCode}</span></div>
              <div><span className="text-slate-500">Department:</span> <span className="font-medium text-slate-700">{form.department}</span></div>
              <div><span className="text-slate-500">Designation:</span> <span className="font-medium text-slate-700">{form.designation}</span></div>
            </div>
          </div>
        )}
      </div>

      {/* Termination Details */}
      <div className="thb-card p-6 rounded-xl">
        <h2 className="text-lg font-semibold text-thb-text-primary flex items-center gap-2 mb-4">
          <FiFileText className="w-5 h-5 text-red-500" />
          Termination Details
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-thb-text-secondary mb-1">Termination Type *</label>
            <select value={form.terminationType} onChange={e => updateField('terminationType', e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400">
              {TERMINATION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-thb-text-secondary mb-1 flex items-center gap-1"><FiCalendar className="w-3 h-3" /> Termination Date *</label>
            <input type="date" value={form.terminationDate} onChange={e => updateField('terminationDate', e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-thb-text-secondary mb-1">Last Working Date *</label>
            <input type="date" value={form.lastWorkingDate} onChange={e => updateField('lastWorkingDate', e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-thb-text-secondary mb-1">Notice Period Served</label>
            <select value={form.noticePeriodServed} onChange={e => updateField('noticePeriodServed', e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400">
              <option value="yes">Yes</option>
              <option value="no">No — Immediate</option>
              <option value="partial">Partial</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-thb-text-secondary mb-1">Reason Category *</label>
            <select value={form.reasonCategory} onChange={e => updateField('reasonCategory', e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400">
              {REASON_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
        </div>
        <div className="mt-4">
          <label className="block text-xs font-medium text-thb-text-secondary mb-1">Detailed Reason * <span className="font-normal text-slate-400">(min 20 chars)</span></label>
          <textarea value={form.detailedReason} onChange={e => updateField('detailedReason', e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" rows={3} placeholder="Provide detailed reason for termination..." />
          <p className="text-[10px] text-slate-400 mt-0.5">{form.detailedReason.length}/20 min characters</p>
        </div>
      </div>

      {/* Exit Clearance */}
      <div className="thb-card p-6 rounded-xl">
        <h2 className="text-lg font-semibold text-thb-text-primary flex items-center gap-2 mb-4">
          <FiPackage className="w-5 h-5 text-amber-500" />
          Exit Clearance
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-thb-text-secondary mb-2">Assets to Return</label>
            <div className="space-y-2">
              {ASSET_ITEMS.map(asset => (
                <label key={asset.key} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.assetsToReturn.includes(asset.key)}
                    onChange={() => toggleAsset(asset.key)}
                    className="w-4 h-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
                  />
                  {asset.label}
                </label>
              ))}
            </div>
          </div>
          <div className="flex items-start gap-3 pt-6">
            <input
              type="checkbox"
              id="final-settlement"
              checked={form.finalSettlementRequired}
              onChange={e => updateField('finalSettlementRequired', e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 mt-0.5"
            />
            <label htmlFor="final-settlement" className="text-sm text-slate-700">
              <strong>Final Settlement Required</strong>
              <p className="text-xs text-slate-400 mt-0.5">Process full and final settlement including pending salary, leave encashment, and gratuity</p>
            </label>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <button onClick={() => router.push('/employees')} className="inline-flex items-center gap-2 px-4 py-2.5 bg-white text-thb-text-secondary border border-thb-border rounded-xl hover:bg-slate-50 font-medium text-sm transition-all">
          <FiArrowLeft className="w-4 h-4" /> Cancel
        </button>
        <button onClick={handleSubmit} disabled={submitting} className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 font-medium text-sm shadow-sm transition-all">
          {submitting ? <FiRefreshCw className="w-4 h-4 animate-spin" /> : <FiAlertCircle className="w-4 h-4" />}
          {submitting ? 'Processing...' : 'Submit Termination'}
        </button>
      </div>

      {/* Termination Records */}
      <div className="thb-card overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
          <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <FiAlertCircle className="w-4 h-4 text-red-500" />
            Termination Records
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Employee</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Type</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Date</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Reason</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={5} className="text-center py-8 text-slate-400">Loading...</td></tr>
              ) : records.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-12">
                  <FiAlertCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-slate-500">No termination records</p>
                  <p className="text-xs text-slate-400 mt-1">Submit a termination request using the form above</p>
                </td></tr>
              ) : records.map(r => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-700">{r.employeeName} <span className="text-slate-400 text-xs">({r.employeeCode})</span></td>
                  <td className="px-4 py-3 text-slate-600">{termTypeLabel(r.terminationType)}</td>
                  <td className="px-4 py-3 text-slate-600">{fmtDate(r.terminationDate)}</td>
                  <td className="px-4 py-3 text-slate-600">{reasonLabel(r.reasonCategory)}</td>
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
