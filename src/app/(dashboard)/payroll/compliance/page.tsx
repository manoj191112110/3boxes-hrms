'use client';

import { useAuthStore } from '@/store/authStore';
import { useCallback, useEffect, useState } from 'react';
import { FiCalendar, FiPlus, FiEdit2, FiTrash2, FiEye, FiX, FiSearch, FiRefreshCw, FiAlertTriangle, FiCheckCircle, FiClock, FiFileText } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useCompanyContextStore } from '@/store/companyContextStore';

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

// --- Types ---
interface ComplianceFiling {
  id: string;
  complianceId: string;
  payrollRunId: string | null;
  filingPeriod: string;
  filingStatus: string;
  generatedDate: string;
  submittedDate: string | null;
  acknowledgementRef: string | null;
  filingAmount: number | null;
  penaltyAmount: number | null;
  filePath: string | null;
  submittedBy: string | null;
  reviewedBy: string | null;
  rejectionReason: string | null;
  resubmissionDate: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ComplianceObligation {
  id: string;
  name: string;
  countryCode: string;
  authorityName: string;
  filingType: string;
  frequency: string;
  dueDateRule: string;
  graceDays: number | null;
  penaltyType: string | null;
  penaltyValue: number | null;
  responsibleRole: string;
  escalationRole: string | null;
  reminderDaysBefore: string | null;
  autoGenerate: boolean;
  filingFormat: string | null;
  isActive: boolean;
  companyId: string | null;
  filings: ComplianceFiling[];
  createdAt: string;
  updatedAt: string;
}

// --- Constants ---
const COUNTRY_OPTIONS = [
  { value: 'IND', label: 'India' },
  { value: 'USA', label: 'United States' },
  { value: 'GBR', label: 'United Kingdom' },
  { value: 'SGP', label: 'Singapore' },
  { value: 'UAE', label: 'UAE' },
  { value: 'AUS', label: 'Australia' },
];

const FILING_TYPE_OPTIONS = [
  { value: 'RETURN', label: 'Return' },
  { value: 'CHALLAN', label: 'Challan' },
  { value: 'CERTIFICATE', label: 'Certificate' },
  { value: 'REGISTRATION', label: 'Registration' },
  { value: 'REPORT', label: 'Report' },
  { value: 'DECLARATION', label: 'Declaration' },
];

const FREQUENCY_OPTIONS = [
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'QUARTERLY', label: 'Quarterly' },
  { value: 'HALF_YEARLY', label: 'Half-Yearly' },
  { value: 'ANNUAL', label: 'Annual' },
  { value: 'ONE_TIME', label: 'One Time' },
];

const PENALTY_TYPE_OPTIONS = [
  { value: 'FIXED_AMOUNT', label: 'Fixed Amount' },
  { value: 'PERCENTAGE_PER_DAY', label: '% Per Day' },
  { value: 'PERCENTAGE_PER_MONTH', label: '% Per Month' },
  { value: 'PROGRESSIVE', label: 'Progressive' },
];

const FILING_STATUS_OPTIONS = [
  { value: 'GENERATED', label: 'Generated' },
  { value: 'UNDER_REVIEW', label: 'Under Review' },
  { value: 'SUBMITTED', label: 'Submitted' },
  { value: 'ACKNOWLEDGED', label: 'Acknowledged' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'PENALTY_APPLIED', label: 'Penalty Applied' },
];

// --- Badge Helpers ---
function getFilingTypeBadge(type: string) {
  const map: Record<string, string> = {
    RETURN: 'thb-badge thb-badge-info',
    CHALLAN: 'thb-badge thb-badge-warning',
    CERTIFICATE: 'thb-badge thb-badge-success',
    REGISTRATION: 'thb-badge thb-badge-purple',
    REPORT: 'thb-badge thb-badge-info',
    DECLARATION: 'thb-badge thb-badge-warning',
  };
  return map[type] || 'thb-badge thb-badge-info';
}

function getFrequencyBadge(freq: string) {
  const map: Record<string, string> = {
    MONTHLY: 'thb-badge thb-badge-info',
    QUARTERLY: 'thb-badge thb-badge-success',
    HALF_YEARLY: 'thb-badge thb-badge-warning',
    ANNUAL: 'thb-badge thb-badge-purple',
    ONE_TIME: 'thb-badge thb-badge-error',
  };
  return map[freq] || 'thb-badge thb-badge-info';
}

function getFilingStatusBadge(status: string) {
  const map: Record<string, string> = {
    GENERATED: 'thb-badge thb-badge-info',
    UNDER_REVIEW: 'thb-badge thb-badge-warning',
    SUBMITTED: 'thb-badge thb-badge-purple',
    ACKNOWLEDGED: 'thb-badge thb-badge-success',
    REJECTED: 'thb-badge thb-badge-error',
    PENALTY_APPLIED: 'thb-badge thb-badge-error',
  };
  return map[status] || 'thb-badge thb-badge-info';
}

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
  name: '',
  countryCode: 'IND',
  authorityName: '',
  filingType: 'RETURN',
  frequency: 'MONTHLY',
  dueDateRule: 'D+15',
  graceDays: '',
  penaltyType: '',
  penaltyValue: '',
  responsibleRole: 'PAYROLL_ADMIN',
  escalationRole: '',
  reminderDaysBefore: '7,3,1',
  autoGenerate: false,
  filingFormat: '',
  isActive: true,
};

export default function CompliancePage() {
  const { user } = useAuthStore();
  const effectiveCompanyId = useCompanyContextStore(s => s.effectiveCompanyId);
  const isAdmin = user?.role === 'super_admin' || user?.role === 'tenant_admin' || user?.role === 'admin';

  const [obligations, setObligations] = useState<ComplianceObligation[]>([]);
  const [filings, setFilings] = useState<ComplianceFiling[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'obligations' | 'filings'>('obligations');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [viewingObligation, setViewingObligation] = useState<ComplianceObligation | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [countryFilter, setCountryFilter] = useState('');
  const [frequencyFilter, setFrequencyFilter] = useState('');
  const [form, setForm] = useState({ ...emptyForm });

  // Filing status transition
  const [transitioningFilingId, setTransitioningFilingId] = useState<string | null>(null);

  const FILING_TRANSITIONS: Record<string, string[]> = {
    GENERATED: ['UNDER_REVIEW'],
    UNDER_REVIEW: ['SUBMITTED', 'REJECTED'],
    SUBMITTED: ['ACKNOWLEDGED', 'REJECTED'],
    REJECTED: ['UNDER_REVIEW', 'SUBMITTED'],
    ACKNOWLEDGED: [],
    PENALTY_APPLIED: [],
  };

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (countryFilter) params.set('countryCode', countryFilter);
      if (frequencyFilter) params.set('frequency', frequencyFilter);
      const qs = params.toString();

      const [oblRes, filRes] = await Promise.all([
        fetch(`/api/payroll/compliance${qs ? `?${qs}` : ''}`, { headers: getAuthHeaders() }),
        fetch(`/api/payroll/compliance-filings?${scopeQuery}` , { headers: getAuthHeaders() }),
      ]);

      if (oblRes.ok) {
        const data = await oblRes.json();
        setObligations(Array.isArray(data.data) ? data.data : []);
      }
      if (filRes.ok) {
        const data = await filRes.json();
        setFilings(Array.isArray(data.data) ? data.data : []);
      }
    } catch {
      toast.error('Failed to load compliance data');
    } finally {
      setLoading(false);
    }
  }, [countryFilter, frequencyFilter]);
  const cid = effectiveCompanyId();
  const scopeQuery = cid ? `companyId=${cid}&` : '';


  useEffect(() => { queueMicrotask(() => fetchData()); }, [fetchData]);

  const totalObligations = obligations.length;
  const activeObligations = obligations.filter(o => o.isActive).length;
  const pendingFilings = filings.filter(f => f.filingStatus === 'GENERATED' || f.filingStatus === 'UNDER_REVIEW').length;
  const overdueFilings = filings.filter(f => f.filingStatus === 'REJECTED' || f.filingStatus === 'PENALTY_APPLIED').length;

  const filteredObligations = obligations.filter(o => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return o.name.toLowerCase().includes(q) || o.countryCode.toLowerCase().includes(q) || o.authorityName.toLowerCase().includes(q);
  });

  const filteredFilings = filings.filter(f => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return f.filingPeriod.toLowerCase().includes(q) || f.filingStatus.toLowerCase().includes(q);
  });

  const handleAddNew = () => {
    setForm({ ...emptyForm });
    setEditingId(null);
    setShowForm(true);
    setViewingObligation(null);
    setTimeout(() => document.getElementById('crud-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  const handleEdit = (o: ComplianceObligation) => {
    setForm({
      name: o.name,
      countryCode: o.countryCode,
      authorityName: o.authorityName,
      filingType: o.filingType,
      frequency: o.frequency,
      dueDateRule: o.dueDateRule,
      graceDays: o.graceDays != null ? String(o.graceDays) : '',
      penaltyType: o.penaltyType || '',
      penaltyValue: o.penaltyValue != null ? String(o.penaltyValue) : '',
      responsibleRole: o.responsibleRole,
      escalationRole: o.escalationRole || '',
      reminderDaysBefore: o.reminderDaysBefore || '',
      autoGenerate: o.autoGenerate,
      filingFormat: o.filingFormat || '',
      isActive: o.isActive,
    });
    setEditingId(o.id);
    setShowForm(true);
    setViewingObligation(null);
    setTimeout(() => document.getElementById('crud-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) { toast.error('Compliance name is required'); return; }
    if (!form.authorityName.trim()) { toast.error('Authority name is required'); return; }
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        graceDays: form.graceDays ? parseInt(form.graceDays) : null,
        penaltyType: form.penaltyType || null,
        penaltyValue: form.penaltyValue ? parseFloat(form.penaltyValue) : null,
        escalationRole: form.escalationRole || null,
        reminderDaysBefore: form.reminderDaysBefore || null,
        filingFormat: form.filingFormat || null,
      };
      if (editingId) {
        const res = await fetch(`/api/payroll/compliance/${editingId}?${scopeQuery}` , { method: 'PUT', headers: getAuthHeaders(), body: JSON.stringify(payload) });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed to update'); }
        toast.success('Compliance obligation updated');
      } else {
        const res = await fetch(`/api/payroll/compliance?${scopeQuery}` , { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(payload) });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed to create'); }
        toast.success('Compliance obligation created');
      }
      setShowForm(false); setEditingId(null); fetchData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/payroll/compliance/${id}?${scopeQuery}` , { method: 'DELETE', headers: getAuthHeaders() });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed to delete'); }
      toast.success('Compliance obligation deleted');
      setDeleteConfirmId(null);
      if (viewingObligation?.id === id) setViewingObligation(null);
      fetchData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setDeleting(false);
    }
  };

  const handleFilingTransition = async (filingId: string, newStatus: string) => {
    setTransitioningFilingId(filingId);
    try {
      const body: Record<string, string> = { filingStatus: newStatus };
      if (newStatus === 'ACKNOWLEDGED') {
        const ref = prompt('Enter acknowledgement reference:');
        if (!ref) { setTransitioningFilingId(null); return; }
        body.acknowledgementRef = ref;
      }
      if (newStatus === 'REJECTED') {
        const reason = prompt('Enter rejection reason:');
        if (!reason) { setTransitioningFilingId(null); return; }
        body.rejectionReason = reason;
      }
      const res = await fetch(`/api/payroll/compliance-filings/${filingId}?${scopeQuery}` , {
        method: 'PATCH', headers: getAuthHeaders(), body: JSON.stringify(body),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed to transition'); }
      toast.success(`Filing status updated to ${newStatus.replace(/_/g, ' ')}`);
      fetchData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setTransitioningFilingId(null);
    }
  };

  const formatStr = (s: string) => s.replace(/_/g, ' ');

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-thb-text-primary flex items-center gap-2">
            <FiCalendar className="w-6 h-6 text-teal-500" />
            Compliance Management
          </h1>
          <p className="text-thb-text-secondary mt-1">Track statutory filing obligations and compliance status across countries</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => fetchData()} className="p-2.5 rounded-lg border border-thb-border text-thb-text-secondary hover:bg-slate-50 transition-colors" title="Refresh"><FiRefreshCw className="w-4 h-4" /></button>
          {isAdmin && (
            <button onClick={handleAddNew} className="inline-flex items-center gap-2 px-4 py-2.5 bg-green-500 text-white rounded-lg hover:bg-green-600 font-medium text-sm shadow-sm shadow-green-500/25 transition-colors">
              <FiPlus className="w-4 h-4" /> Add Obligation
            </button>
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="thb-card thb-card-hover p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center"><FiCalendar className="w-5 h-5 text-teal-500" /></div>
            <div><p className="text-xs font-medium text-thb-text-secondary">Total Obligations</p><p className="text-xl font-bold text-thb-text-primary">{totalObligations}</p></div>
          </div>
        </div>
        <div className="thb-card thb-card-hover p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center"><FiCheckCircle className="w-5 h-5 text-emerald-500" /></div>
            <div><p className="text-xs font-medium text-thb-text-secondary">Active</p><p className="text-xl font-bold text-thb-text-primary">{activeObligations}</p></div>
          </div>
        </div>
        <div className="thb-card thb-card-hover p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center"><FiClock className="w-5 h-5 text-amber-500" /></div>
            <div><p className="text-xs font-medium text-thb-text-secondary">Pending Filings</p><p className="text-xl font-bold text-thb-text-primary">{pendingFilings}</p></div>
          </div>
        </div>
        <div className="thb-card thb-card-hover p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center"><FiAlertTriangle className="w-5 h-5 text-red-500" /></div>
            <div><p className="text-xs font-medium text-thb-text-secondary">Overdue/Rejected</p><p className="text-xl font-bold text-thb-text-primary">{overdueFilings}</p></div>
          </div>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg w-fit">
        <button onClick={() => setActiveTab('obligations')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'obligations' ? 'bg-white text-green-600 shadow-sm' : 'text-thb-text-secondary hover:text-thb-text-primary'}`}>Obligations</button>
        <button onClick={() => setActiveTab('filings')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'filings' ? 'bg-white text-green-600 shadow-sm' : 'text-thb-text-secondary hover:text-thb-text-primary'}`}>Filings</button>
      </div>

      {/* Filters */}
      <div className="thb-card p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-thb-text-muted" />
            <input type="text" placeholder={`Search ${activeTab === 'obligations' ? 'by name, country, authority' : 'by period, status'}...`} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" />
          </div>
          <select value={countryFilter} onChange={(e) => setCountryFilter(e.target.value)} className="px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 min-w-[150px]">
            <option value="">All Countries</option>
            {COUNTRY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select value={frequencyFilter} onChange={(e) => setFrequencyFilter(e.target.value)} className="px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 min-w-[150px]">
            <option value="">All Frequencies</option>
            {FREQUENCY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      {/* View Panel */}
      {viewingObligation && (
        <div className="thb-card border-l-4 border-l-teal-500">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold text-thb-text-primary">{viewingObligation.name}</h2>
                <p className="text-sm text-thb-text-secondary mt-0.5">{viewingObligation.countryCode} &middot; {viewingObligation.authorityName}</p>
              </div>
              <div className="flex items-center gap-2">
                {isAdmin && <button onClick={() => handleEdit(viewingObligation)} className="px-3 py-1.5 rounded-lg bg-green-500 text-white text-xs font-medium hover:bg-green-600 transition-colors flex items-center gap-1"><FiEdit2 className="w-3.5 h-3.5" /> Edit</button>}
                <button onClick={() => setViewingObligation(null)} className="p-2 rounded-lg text-thb-text-muted hover:text-thb-text-primary hover:bg-slate-100 transition-colors"><FiX className="w-5 h-5" /></button>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <DetailItem label="Name" value={viewingObligation.name} />
              <DetailItem label="Country" value={viewingObligation.countryCode} />
              <DetailItem label="Authority" value={viewingObligation.authorityName} />
              <DetailItem label="Filing Type" value={formatStr(viewingObligation.filingType)} badge={getFilingTypeBadge(viewingObligation.filingType)} />
              <DetailItem label="Frequency" value={formatStr(viewingObligation.frequency)} badge={getFrequencyBadge(viewingObligation.frequency)} />
              <DetailItem label="Due Date Rule" value={viewingObligation.dueDateRule} />
              <DetailItem label="Grace Days" value={viewingObligation.graceDays} />
              <DetailItem label="Penalty Type" value={viewingObligation.penaltyType ? formatStr(viewingObligation.penaltyType) : null} />
              <DetailItem label="Penalty Value" value={viewingObligation.penaltyValue} />
              <DetailItem label="Responsible Role" value={viewingObligation.responsibleRole} />
              <DetailItem label="Escalation Role" value={viewingObligation.escalationRole} />
              <DetailItem label="Reminder Days" value={viewingObligation.reminderDaysBefore} />
              <DetailItem label="Auto Generate" value={viewingObligation.autoGenerate} />
              <DetailItem label="Filing Format" value={viewingObligation.filingFormat} />
              <DetailItem label="Active" value={viewingObligation.isActive} badge={viewingObligation.isActive ? 'thb-badge thb-badge-success' : 'thb-badge thb-badge-error'} />
              <DetailItem label="Filings" value={viewingObligation.filings?.length || 0} />
            </div>
            {viewingObligation.filings && viewingObligation.filings.length > 0 && (
              <div className="mt-6 pt-4 border-t border-thb-border">
                <h3 className="text-sm font-semibold text-thb-text-primary mb-3">Recent Filings</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-thb-border">
                      <tr>{['Period', 'Status', 'Amount', 'Generated', 'Submitted'].map(h => <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-thb-text-muted uppercase tracking-wider">{h}</th>)}</tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {viewingObligation.filings.map(f => (
                        <tr key={f.id} className="hover:bg-slate-50/50">
                          <td className="px-3 py-2 text-thb-text-primary">{f.filingPeriod}</td>
                          <td className="px-3 py-2"><span className={getFilingStatusBadge(f.filingStatus)}>{formatStr(f.filingStatus)}</span></td>
                          <td className="px-3 py-2 text-thb-text-secondary">{f.filingAmount ?? '—'}</td>
                          <td className="px-3 py-2 text-thb-text-secondary">{f.generatedDate ? new Date(f.generatedDate).toLocaleDateString() : '—'}</td>
                          <td className="px-3 py-2 text-thb-text-secondary">{f.submittedDate ? new Date(f.submittedDate).toLocaleDateString() : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div id="crud-form" className="thb-card border-l-4 border-l-green-500">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-thb-text-primary">{editingId ? 'Edit Compliance Obligation' : 'Create Compliance Obligation'}</h2>
              <button onClick={() => { setShowForm(false); setEditingId(null); }} className="p-2 rounded-lg text-thb-text-muted hover:text-thb-text-primary hover:bg-slate-100 transition-colors"><FiX className="w-5 h-5" /></button>
            </div>
            <div className="mb-5">
              <h3 className="text-sm font-semibold text-thb-text-primary mb-3">Obligation Details</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Name <span className="text-red-500 font-bold">*</span></label>
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" placeholder="e.g. Monthly PF ECR Filing" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Country <span className="text-red-500 font-bold">*</span></label>
                  <select value={form.countryCode} onChange={(e) => setForm({ ...form, countryCode: e.target.value })} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400">
                    {COUNTRY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Authority Name <span className="text-red-500 font-bold">*</span></label>
                  <input value={form.authorityName} onChange={(e) => setForm({ ...form, authorityName: e.target.value })} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" placeholder="e.g. EPFO, IRS, HMRC" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Filing Type</label>
                  <select value={form.filingType} onChange={(e) => setForm({ ...form, filingType: e.target.value })} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400">
                    {FILING_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Frequency</label>
                  <select value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400">
                    {FREQUENCY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Due Date Rule <span className="text-red-500 font-bold">*</span></label>
                  <input value={form.dueDateRule} onChange={(e) => setForm({ ...form, dueDateRule: e.target.value })} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" placeholder='e.g. "D+15", "Q_END+30"' />
                </div>
              </div>
            </div>
            <div className="mb-5">
              <h3 className="text-sm font-semibold text-thb-text-primary mb-3">Penalty & Responsibility</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Penalty Type</label>
                  <select value={form.penaltyType} onChange={(e) => setForm({ ...form, penaltyType: e.target.value })} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400">
                    <option value="">None</option>
                    {PENALTY_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Penalty Value</label>
                  <input type="number" step="0.01" value={form.penaltyValue} onChange={(e) => setForm({ ...form, penaltyValue: e.target.value })} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" placeholder="Amount or percentage" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Grace Days</label>
                  <input type="number" value={form.graceDays} onChange={(e) => setForm({ ...form, graceDays: e.target.value })} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" placeholder="e.g. 5" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Responsible Role</label>
                  <input value={form.responsibleRole} onChange={(e) => setForm({ ...form, responsibleRole: e.target.value })} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" placeholder="e.g. PAYROLL_ADMIN" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Escalation Role</label>
                  <input value={form.escalationRole} onChange={(e) => setForm({ ...form, escalationRole: e.target.value })} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" placeholder="e.g. HR_MANAGER" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Reminder Days Before</label>
                  <input value={form.reminderDaysBefore} onChange={(e) => setForm({ ...form, reminderDaysBefore: e.target.value })} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" placeholder='e.g. "7,3,1"' />
                </div>
              </div>
            </div>
            <div className="mb-5">
              <h3 className="text-sm font-semibold text-thb-text-primary mb-3">Automation</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="flex items-end pb-1"><label className="flex items-center gap-2 text-sm text-thb-text-secondary cursor-pointer"><input type="checkbox" checked={form.autoGenerate} onChange={(e) => setForm({ ...form, autoGenerate: e.target.checked })} className="rounded border-thb-border" /><span className="font-medium">Auto-Generate on Payroll Close</span></label></div>
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Filing Format</label>
                  <input value={form.filingFormat} onChange={(e) => setForm({ ...form, filingFormat: e.target.value })} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" placeholder='e.g. "ECR_CSV", "RTI_XML"' />
                </div>
                <div className="flex items-end pb-1"><label className="flex items-center gap-2 text-sm text-thb-text-secondary cursor-pointer"><input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="rounded border-thb-border" /><span className="font-medium">Active</span></label></div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-thb-border">
              <button onClick={() => { setShowForm(false); setEditingId(null); }} className="px-4 py-2.5 rounded-lg border border-thb-border text-sm font-medium text-thb-text-secondary hover:bg-slate-50 transition-colors">Cancel</button>
              <button onClick={handleSubmit} disabled={submitting} className="px-6 py-2.5 rounded-lg bg-green-500 text-white text-sm font-medium hover:bg-green-600 disabled:opacity-50 shadow-sm shadow-green-500/25 transition-colors">
                {submitting ? 'Saving...' : editingId ? 'Update Obligation' : 'Create Obligation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="thb-card overflow-hidden"><div className="p-5 space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-12 bg-slate-100 rounded animate-pulse" />)}</div></div>
      ) : activeTab === 'obligations' ? (
        filteredObligations.length === 0 ? (
          <div className="thb-card p-12 text-center">
            <FiCalendar className="w-12 h-12 text-thb-text-muted mx-auto mb-3" />
            <p className="text-thb-text-secondary font-medium">No compliance obligations found</p>
            <p className="text-sm text-thb-text-muted mt-1">Create your first compliance obligation</p>
          </div>
        ) : (
          <div className="thb-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-thb-border">
                  <tr>{['Name', 'Country', 'Authority', 'Filing Type', 'Frequency', 'Due Rule', 'Active', 'Actions'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-thb-text-muted uppercase tracking-wider">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredObligations.map(o => (
                    deleteConfirmId === o.id ? (
                      <tr key={o.id} className="bg-red-50">
                        <td colSpan={8} className="px-4 py-3">
                          <p className="text-sm text-red-700 font-medium mb-2">Delete &quot;{o.name}&quot; and all {o.filings?.length || 0} filings?</p>
                          <div className="flex items-center gap-2">
                            <button onClick={() => handleDelete(o.id)} disabled={deleting} className="px-3 py-1.5 bg-red-500 text-white text-xs font-medium rounded-lg hover:bg-red-600 disabled:opacity-50">{deleting ? 'Deleting...' : 'Confirm'}</button>
                            <button onClick={() => setDeleteConfirmId(null)} className="px-3 py-1.5 border border-thb-border text-xs font-medium rounded-lg hover:bg-slate-50">Cancel</button>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      <tr key={o.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-3 text-sm font-medium text-thb-text-primary">{o.name}</td>
                        <td className="px-4 py-3 text-sm text-thb-text-secondary">{o.countryCode}</td>
                        <td className="px-4 py-3 text-sm text-thb-text-secondary">{o.authorityName}</td>
                        <td className="px-4 py-3"><span className={getFilingTypeBadge(o.filingType)}>{formatStr(o.filingType)}</span></td>
                        <td className="px-4 py-3"><span className={getFrequencyBadge(o.frequency)}>{formatStr(o.frequency)}</span></td>
                        <td className="px-4 py-3 text-sm text-thb-text-secondary">{o.dueDateRule}</td>
                        <td className="px-4 py-3">{o.isActive ? <span className="thb-badge thb-badge-success">Active</span> : <span className="thb-badge thb-badge-error">Inactive</span>}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button onClick={() => setViewingObligation(o)} className="p-1.5 rounded-lg text-thb-text-muted hover:text-green-500 hover:bg-green-50 transition-colors" title="View"><FiEye className="w-4 h-4" /></button>
                            {isAdmin && <button onClick={() => handleEdit(o)} className="p-1.5 rounded-lg text-thb-text-muted hover:text-amber-500 hover:bg-amber-50 transition-colors" title="Edit"><FiEdit2 className="w-4 h-4" /></button>}
                            {isAdmin && <button onClick={() => setDeleteConfirmId(o.id)} className="p-1.5 rounded-lg text-thb-text-muted hover:text-red-500 hover:bg-red-50 transition-colors" title="Delete"><FiTrash2 className="w-4 h-4" /></button>}
                          </div>
                        </td>
                      </tr>
                    )
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : filteredFilings.length === 0 ? (
        <div className="thb-card p-12 text-center">
          <FiFileText className="w-12 h-12 text-thb-text-muted mx-auto mb-3" />
          <p className="text-thb-text-secondary font-medium">No compliance filings found</p>
          <p className="text-sm text-thb-text-muted mt-1">Filings are auto-generated when payroll runs are closed</p>
        </div>
      ) : (
        <div className="thb-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-thb-border">
                <tr>{['Period', 'Status', 'Amount', 'Penalty', 'Generated', 'Submitted', 'Actions'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-thb-text-muted uppercase tracking-wider">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredFilings.map(f => (
                  <tr key={f.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-thb-text-primary">{f.filingPeriod}</td>
                    <td className="px-4 py-3"><span className={getFilingStatusBadge(f.filingStatus)}>{formatStr(f.filingStatus)}</span></td>
                    <td className="px-4 py-3 text-sm text-thb-text-secondary">{f.filingAmount != null ? `₹${f.filingAmount.toLocaleString()}` : '—'}</td>
                    <td className="px-4 py-3 text-sm">{f.penaltyAmount ? <span className="text-red-600 font-medium">₹{f.penaltyAmount.toLocaleString()}</span> : '—'}</td>
                    <td className="px-4 py-3 text-sm text-thb-text-secondary">{f.generatedDate ? new Date(f.generatedDate).toLocaleDateString() : '—'}</td>
                    <td className="px-4 py-3 text-sm text-thb-text-secondary">{f.submittedDate ? new Date(f.submittedDate).toLocaleDateString() : '—'}</td>
                    <td className="px-4 py-3">
                      {isAdmin && FILING_TRANSITIONS[f.filingStatus]?.length > 0 && (
                        <div className="flex items-center gap-1">
                          {FILING_TRANSITIONS[f.filingStatus].map(nextStatus => (
                            <button
                              key={nextStatus}
                              onClick={() => handleFilingTransition(f.id, nextStatus)}
                              disabled={transitioningFilingId === f.id}
                              className="px-2 py-1 rounded text-xs font-medium border border-thb-border hover:bg-slate-50 disabled:opacity-50 transition-colors"
                            >
                              {nextStatus === 'SUBMITTED' ? 'Submit' : nextStatus === 'UNDER_REVIEW' ? 'Review' : nextStatus === 'ACKNOWLEDGED' ? 'Acknowledge' : formatStr(nextStatus)}
                            </button>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
