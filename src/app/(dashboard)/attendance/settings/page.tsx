'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  FiSettings, FiSave, FiRefreshCw, FiMonitor, FiMapPin, FiCamera, FiClock,
  FiFileText, FiPlus, FiSearch, FiEye, FiEdit2, FiTrash2, FiX, FiAlertTriangle,
  FiList, FiSliders, FiBookOpen, FiCheck, FiChevronDown, FiGitBranch, FiDownload,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import { useCompanyContextStore } from '@/store/companyContextStore';
import { useCompanyData, apiFetch, fmtDate, getStatusBadge } from '@/components/company/useCompanyData';
import type { PolicyRecord } from '@/components/company/useCompanyData';
import { PolicyFileUploadField, PolicyFileDownloadLink } from '@/components/hrms/PolicyFileField';
import { PolicyVersionHistoryButton, PolicyAcknowledgeButton, PolicyAcknowledgmentTracker } from '@/components/hrms/PolicyVersionHistory';
import WorkflowBuilderTab from './WorkflowBuilderTab';

// ─── Helpers ────────────────────────────────────────────────────────
function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

// ─── Types ──────────────────────────────────────────────────────────
interface PolicyConfig {
  id: string;
  name: string;
  roundEnabled: boolean;
  roundMinutes: number;
  roundDirection: string;
  lateGraceMinutes: number;
  earlyGraceMinutes: number;
  autoOvertimeEnabled: boolean;
  overtimeThresholdMinutes: number;
  autoApprovePermissionMinutes: number;
  autoApproveMinAttendancePct: number;
  wfhActivityMonitoringEnabled: boolean;
  wfhInactivityThresholdHours: number;
  lateMarkAllowancePerMonth: number;
  lateMarkHalfDayOnExceed: boolean;
  halfDayAfterMinutes: number;
  lateMarkNotApplicableOnTour: boolean;
  shiftStartDefault: string;
  shiftEndDefault: string;
  breakDurationMinutes: number;
  gatePassMaxPerMonth: number;
  gatePassHalfDayOnExceed: boolean;
  gatePassHalfDayNextDay: boolean;
  gatePassEarlyHours: number;
  canteenEnabled: boolean;
  canteenFreeForGeneralShift: boolean;
  canteenFreeForNightShift: boolean;
  canteenOtfreeThresholdHours: number;
}

interface AttendancePolicyRule {
  id: string;
  name: string;
  policyId?: string;
  companyId: string;
  employmentType: string;
  branchId?: string;
  branch?: { id: string; name: string };
  departmentId?: string;
  department?: { id: string; name: string };
  shiftStartDefault: string;
  shiftEndDefault: string;
  breakDurationMinutes: number;
  lateGraceMinutes: number;
  earlyGraceMinutes: number;
  lateMarkAllowancePerMonth: number;
  lateMarkHalfDayOnExceed: boolean;
  halfDayAfterMinutes: number;
  lateMarkNotApplicableOnTour: boolean;
  autoOvertimeEnabled: boolean;
  overtimeThresholdMinutes: number;
  gatePassMaxPerMonth: number;
  gatePassHalfDayOnExceed: boolean;
  gatePassHalfDayNextDay: boolean;
  gatePassEarlyHours: number;
  priority: number;
  status: string;
}

// ─── Tab types ──────────────────────────────────────────────────────
// NOTE: 'rules' tab was removed in the unification pass — all policy rule
// fields (shift, grace, late-mark, OT, gate-pass) are now configured inside
// the 'workflows' tab alongside the approval chain. The old AttendancePolicyRule
// table is still read as a legacy fallback at runtime (see lib/attendance-workflow.ts
// loadWorkflowConfig) so existing saved rules continue to apply until an admin
// saves a unified workflow config.
type TabKey = 'documents' | 'workflows';

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: 'documents', label: 'Policy Documents', icon: <FiBookOpen className="w-4 h-4" /> },
  { key: 'workflows', label: 'Policy Rules & Approval Workflows', icon: <FiGitBranch className="w-4 h-4" /> },
];

const EMPLOYMENT_TYPES = [
  { value: 'all', label: 'All Types' },
  { value: 'full-time', label: 'Full-Time' },
  { value: 'part-time', label: 'Part-Time' },
  { value: 'contract', label: 'Contract' },
  { value: 'internship', label: 'Internship' },
];

const POLICY_CATEGORY = 'attendance';

// ─── Shared UI bits ─────────────────────────────────────────────────
function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${checked ? 'bg-teal-500' : 'bg-slate-200'}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  );
}

const inputCls = 'w-full px-3 py-2 border border-thb-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20';
const selectCls = 'w-full px-3 py-2 border border-thb-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 bg-white';

// ─── Main Page ──────────────────────────────────────────────────────
function AttendanceSettingsContent() {
  const { user } = useAuthStore();
  const scopeQuery = useCompanyContextStore(s => s.scopeQuery);
  const companyId = useCompanyContextStore(s => s.effectiveCompanyId());
  const selectedTenantId = useCompanyContextStore(s => s.selectedTenantId);
  const isAdmin = ['super_admin', 'tenant_admin', 'admin'].includes(user?.role || '');
  const searchParams = useSearchParams()
  const router = useRouter()

  const tabFromUrl = searchParams.get('tab') as TabKey | null
  const validTabs: TabKey[] = ['documents', 'workflows']
  const defaultTab = (tabFromUrl && validTabs.includes(tabFromUrl)) ? tabFromUrl : 'documents'
  const [activeTab, setActiveTab] = useState<TabKey>(defaultTab);

  useEffect(() => {
    const t = searchParams.get('tab') as TabKey | null
    if (t && validTabs.includes(t) && t !== activeTab) {
      setActiveTab(t)
    }
  }, [searchParams])

  if (!isAdmin) {
    return (
      <div className="text-center py-12">
        <FiSettings className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <p className="text-slate-500">Attendance settings are restricted to HR admins.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-teal-50">
          <FiSettings className="w-5 h-5 text-teal-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-thb-text-primary">Attendance Settings</h1>
          <p className="text-sm text-thb-text-secondary">Manage policy documents, scoped rules, and global configuration</p>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => { setActiveTab(tab.key); router.replace(`/attendance/settings?tab=${tab.key}`) }}
            className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.key
                ? 'bg-white text-teal-700 shadow-sm'
                : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'documents' && <PolicyDocumentsTab />}
      {activeTab === 'workflows' && <WorkflowBuilderTab companyId={companyId} />}
    </div>
  );
}

export default function AttendanceSettingsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-20"><div className="animate-spin w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full" /></div>}>
      <AttendanceSettingsContent />
    </Suspense>
  )
}

// ═══════════════════════════════════════════════════════════════════
//  TAB 1: Policy Documents
// ═══════════════════════════════════════════════════════════════════
function PolicyDocumentsTab() {
  const { policies, loading, isAdmin, fetchPolicies } = useCompanyData();
  const companyId = useCompanyContextStore(s => s.effectiveCompanyId());
  const scopeQuery = useCompanyContextStore(s => s.scopeQuery);
  const selectedTenantId = useCompanyContextStore(s => s.selectedTenantId);

  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [viewingRecord, setViewingRecord] = useState<PolicyRecord | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteName, setDeleteName] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const docInputCls = 'w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400';
  const q = search.toLowerCase();
  const categoryPolicies = policies.filter(p => p.category === POLICY_CATEGORY);
  const fPolicies = categoryPolicies.filter(p =>
    p.title.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)
  );

  const getDefaultForm = (): Record<string, string> => ({
    title: '', category: POLICY_CATEGORY, description: '', version: '1.0', status: 'active', effectiveDate: '', expiryDate: '',
    fileUrl: '', fileName: '', fileSize: '', fileMimeType: ''
  });

  const getFormFromRecord = (r: PolicyRecord): Record<string, string> => {
    const f = getDefaultForm();
    Object.keys(f).forEach(k => {
      if ((r as Record<string, unknown>)[k] !== undefined && (r as Record<string, unknown>)[k] !== null)
        f[k] = String((r as Record<string, unknown>)[k]);
    });
    return f;
  };

  const openAdd = () => { setEditingId(null); setForm(getDefaultForm()); setShowForm(true); setViewingRecord(null); setDeleteConfirmId(null); };
  const openEdit = (r: PolicyRecord) => { setEditingId(r.id); setForm(getFormFromRecord(r)); setShowForm(true); setViewingRecord(null); setDeleteConfirmId(null); };
  const openView = (r: PolicyRecord) => { setViewingRecord(r); setShowForm(false); setDeleteConfirmId(null); };
  const handleCancelForm = () => { setShowForm(false); setEditingId(null); setForm({}); };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!form.title || !form.title.trim()) { toast.error('Policy title is required'); return; }
    if (form.version && !/^\d+(\.\d+)*$/.test(form.version)) { toast.error('Enter a valid version number (e.g., 1.0, 2.1)'); return; }
    if (form.effectiveDate && form.expiryDate && new Date(form.effectiveDate) > new Date(form.expiryDate)) {
      toast.error('Effective Date cannot be later than Expiry Date'); return;
    }
    const duplicatePolicy = policies.find(p =>
      p.title.toLowerCase() === form.title.toLowerCase() &&
      (p.version || '').toLowerCase() === (form.version || '').toLowerCase() &&
      p.id !== editingId
    );
    if (duplicatePolicy) { toast.error('A policy with this title and version already exists'); return; }

    setSubmitting(true);
    try {
      const isEdit = !!editingId;
      const body: Record<string, unknown> = { ...form, companyId, category: POLICY_CATEGORY };
      if (isEdit) body.id = editingId;
      if (!companyId) { toast.error('Company ID is required'); setSubmitting(false); return; }
      const sq = scopeQuery();
      const cidParam = sq ? `?${sq}` : '';
      await apiFetch(`/api/policies${cidParam}`, { method: isEdit ? 'PUT' : 'POST', body: JSON.stringify(body) });
      toast.success(`Policy ${isEdit ? 'updated' : 'created'} successfully`);
      handleCancelForm();
      fetchPolicies();
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Operation failed'); }
    finally { setSubmitting(false); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const sq = scopeQuery();
      const cidParam = sq ? `&${sq}` : '';
      await apiFetch(`/api/policies?id=${deleteConfirmId}${cidParam}`, { method: 'DELETE' });
      toast.success('Deleted successfully');
      fetchPolicies();
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Delete failed'); }
    finally { setDeleting(false); setDeleteConfirmId(null); setDeleteName(''); }
  };

  const updateForm = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }));

  return (
    <div className="space-y-6">
      {/* Action Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FiFileText className="w-5 h-5 text-teal-500" />
          <h2 className="text-lg font-semibold text-thb-text-primary">Attendance Policy Documents</h2>
          <span className="text-xs text-thb-text-muted">({categoryPolicies.length})</span>
        </div>
        {isAdmin && (
          <button onClick={openAdd} className="inline-flex items-center gap-2 px-4 py-2.5 bg-teal-500 text-white rounded-lg hover:bg-teal-600 font-medium text-sm shadow-sm shadow-teal-500/25 transition-colors">
            <FiPlus className="w-4 h-4" /> Add Policy
          </button>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-thb-text-muted" />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by title..." className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-thb-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400" />
      </div>

      {/* View Detail */}
      {viewingRecord && (
        <div className="thb-card border-l-4 border-l-teal-500">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-thb-text-primary flex items-center gap-2"><FiEye className="w-5 h-5 text-teal-500" /> Policy Details</h2>
              <button onClick={() => setViewingRecord(null)} className="p-2 rounded-lg text-thb-text-muted hover:text-thb-text-primary hover:bg-slate-100 transition-colors"><FiX className="w-5 h-5" /></button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                ['Title', viewingRecord.title], ['Category', viewingRecord.category], ['Version', `v${viewingRecord.version}`],
                ['Status', viewingRecord.status], ['Effective Date', viewingRecord.effectiveDate ? fmtDate(viewingRecord.effectiveDate) : '—'], ['Expiry Date', viewingRecord.expiryDate ? fmtDate(viewingRecord.expiryDate) : '—'],
                ['Description', viewingRecord.description],
              ].map(([label, value]) => (
                <div key={String(label)} className={label === 'Description' ? 'sm:col-span-2 lg:col-span-3' : ''}>
                  <p className="text-xs font-medium text-thb-text-muted mb-1">{label}</p>
                  <p className="text-sm font-medium text-thb-text-primary whitespace-pre-wrap">{value || '—'}</p>
                </div>
              ))}
            </div>
            {viewingRecord.fileUrl && (
              <div className="mt-4 pt-4 border-t border-thb-border/50 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-thb-text-muted mb-0.5">Policy Document</p>
                  <p className="text-sm font-medium text-thb-text-primary truncate">{viewingRecord.fileName || 'Attached document'}</p>
                </div>
                <PolicyFileDownloadLink fileUrl={viewingRecord.fileUrl} fileName={viewingRecord.fileName} />
                <div className="flex items-center gap-2 flex-wrap pt-1">
                  <PolicyAcknowledgeButton policyId={viewingRecord.id} />
                  <PolicyAcknowledgmentTracker policyId={viewingRecord.id} />
                  <PolicyVersionHistoryButton policyId={viewingRecord.id} />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Inline Form */}
      {showForm && (
        <div className="thb-card border-l-4 border-l-teal-500">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-thb-text-primary">{editingId ? 'Edit' : 'Add'} Attendance Policy</h2>
              <button onClick={handleCancelForm} className="p-2 rounded-lg text-thb-text-muted hover:text-thb-text-primary hover:bg-slate-100 transition-colors"><FiX className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div><label className="block text-xs font-medium text-thb-text-secondary mb-1">Title <span className="text-red-500 font-bold">*</span></label><input type="text" value={form.title || ''} onChange={e => updateForm('title', e.target.value)} required className={docInputCls} placeholder="Policy title" /></div>
                <div><label className="block text-xs font-medium text-thb-text-secondary mb-1">Version</label><input type="text" value={form.version || '1.0'} onChange={e => updateForm('version', e.target.value)} className={docInputCls} placeholder="1.0" /></div>
                <div className="sm:col-span-2 lg:col-span-3"><label className="block text-xs font-medium text-thb-text-secondary mb-1">Description <span className="text-[10px] font-normal text-thb-text-muted">— short summary only; attach the full policy document below</span></label><input type="text" value={form.description || ''} onChange={e => updateForm('description', e.target.value)} className={docInputCls} placeholder="Brief description" /></div>
                <PolicyFileUploadField form={form} updateForm={updateForm} inputClass={docInputCls} />
                <div><label className="block text-xs font-medium text-thb-text-secondary mb-1">Effective Date</label><input type="date" value={form.effectiveDate || ''} onChange={e => updateForm('effectiveDate', e.target.value)} className={docInputCls} /></div>
                <div><label className="block text-xs font-medium text-thb-text-secondary mb-1">Expiry Date</label><input type="date" value={form.expiryDate || ''} onChange={e => updateForm('expiryDate', e.target.value)} className={docInputCls} /></div>
                <div><label className="block text-xs font-medium text-thb-text-secondary mb-1">Status</label><select value={form.status || 'active'} onChange={e => updateForm('status', e.target.value)} className={docInputCls}><option value="active">Active</option><option value="draft">Draft</option><option value="inactive">Inactive</option></select></div>
              </div>
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-thb-border">
                <button type="button" onClick={handleCancelForm} className="px-4 py-2.5 rounded-lg border border-thb-border text-sm font-medium text-thb-text-secondary hover:bg-slate-50 transition-colors">Cancel</button>
                <button type="submit" disabled={submitting} className="px-6 py-2.5 rounded-lg bg-teal-500 text-white text-sm font-medium hover:bg-teal-600 disabled:opacity-50 shadow-sm shadow-teal-500/25 transition-colors">
                  {submitting ? 'Saving...' : editingId ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Table */}
      {loading.policies ? (
        <div className="flex items-center justify-center py-12"><FiSettings className="w-8 h-8 animate-spin text-teal-400" /></div>
      ) : (
        <div className="thb-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider border-b border-thb-border bg-slate-50/50">Policy</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider border-b border-thb-border bg-slate-50/50">Version</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider border-b border-thb-border bg-slate-50/50">Effective</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider border-b border-thb-border bg-slate-50/50">Status</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider border-b border-thb-border bg-slate-50/50">Actions</th>
                </tr>
              </thead>
              <tbody>
                {fPolicies.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center">
                      <FiFileText className="w-10 h-10 text-thb-text-muted mx-auto mb-3" />
                      <p className="text-thb-text-secondary font-medium">No attendance policies found</p>
                    </td>
                  </tr>
                ) : fPolicies.map(p => {
                  const badge = getStatusBadge(p.status);
                  return (
                    <tr key={p.id} className={`transition-colors ${deleteConfirmId === p.id ? 'bg-red-50' : 'hover:bg-slate-50/50'}`}>
                      {deleteConfirmId === p.id ? (
                        <td colSpan={5} className="px-4 py-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2"><FiAlertTriangle className="w-4 h-4 text-red-500" /><span className="text-sm text-red-600">Delete <b>{p.title}</b>?</span></div>
                            <div className="flex items-center gap-2">
                              <button onClick={() => { setDeleteConfirmId(null); setDeleteName(''); }} className="px-3 py-1 text-xs font-medium rounded-lg border border-thb-border hover:bg-slate-50">Cancel</button>
                              <button onClick={handleDelete} disabled={deleting} className="px-3 py-1 text-xs font-medium rounded-lg bg-red-500 text-white hover:bg-red-600 disabled:opacity-50">{deleting ? 'Deleting...' : 'Delete'}</button>
                            </div>
                          </div>
                        </td>
                      ) : (
                        <>
                          <td className="px-4 py-3 text-sm font-medium text-thb-text-primary border-b border-thb-border/50">{p.title}</td>
                          <td className="px-4 py-3 text-sm text-thb-text-secondary border-b border-thb-border/50">v{p.version}</td>
                          <td className="px-4 py-3 text-sm text-thb-text-secondary border-b border-thb-border/50">{p.effectiveDate ? fmtDate(p.effectiveDate) : '—'}</td>
                          <td className="px-4 py-3 text-sm border-b border-thb-border/50"><span className={badge.className}>{badge.label}</span></td>
                          <td className="px-4 py-3 text-sm text-right border-b border-thb-border/50">
                            <div className="flex items-center justify-end gap-1">
                              {p.fileUrl && <a href={p.fileUrl} {...(p.fileUrl.startsWith('data:') ? { download: p.fileName || p.title } : { target: '_blank', rel: 'noopener noreferrer' })} className="p-1.5 rounded-lg text-thb-text-muted hover:text-teal-500 hover:bg-teal-50 transition-colors" title="Download policy document"><FiDownload className="w-3.5 h-3.5" /></a>}
                              <button onClick={() => openView(p)} className="p-1.5 rounded-lg text-thb-text-muted hover:text-teal-500 hover:bg-teal-50 transition-colors" title="View"><FiEye className="w-3.5 h-3.5" /></button>
                              <PolicyVersionHistoryButton policyId={p.id} iconOnly className="p-1.5 rounded-lg text-thb-text-muted hover:text-indigo-500 hover:bg-indigo-50 transition-colors" />
                              {isAdmin && <>
                                <button onClick={() => openEdit(p)} className="p-1.5 rounded-lg text-thb-text-muted hover:text-green-500 hover:bg-green-50 transition-colors" title="Edit"><FiEdit2 className="w-3.5 h-3.5" /></button>
                                <button onClick={() => { setDeleteConfirmId(p.id); setDeleteName(p.title); }} className="p-1.5 rounded-lg text-thb-text-muted hover:text-red-500 hover:bg-red-50 transition-colors" title="Delete"><FiTrash2 className="w-3.5 h-3.5" /></button>
                              </>}
                            </div>
                          </td>
                        </>
                      )}
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

// ═══════════════════════════════════════════════════════════════════
//  TAB 2: Policy Rules
// ═══════════════════════════════════════════════════════════════════
function PolicyRulesTab({ companyId, scopeQuery }: { companyId: string; scopeQuery: () => string }) {
  const { policies, branches, departments, fetchPolicies, fetchBranches, fetchDepartments } = useCompanyData();

  const [rules, setRules] = useState<AttendancePolicyRule[]>([]);
  const [loadingRules, setLoadingRules] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingRule, setEditingRule] = useState<AttendancePolicyRule | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const emptyRule = (): AttendancePolicyRule => ({
    id: '', name: '', companyId: companyId || '', employmentType: 'all',
    shiftStartDefault: '09:00', shiftEndDefault: '17:30', breakDurationMinutes: 30,
    lateGraceMinutes: 15, earlyGraceMinutes: 10,
    lateMarkAllowancePerMonth: 4, lateMarkHalfDayOnExceed: true, halfDayAfterMinutes: 21, lateMarkNotApplicableOnTour: true,
    autoOvertimeEnabled: true, overtimeThresholdMinutes: 480,
    gatePassMaxPerMonth: 1, gatePassHalfDayOnExceed: true, gatePassHalfDayNextDay: true, gatePassEarlyHours: 1,
    priority: 0, status: 'active',
  });
  const [form, setForm] = useState<AttendancePolicyRule>(emptyRule());

  const fetchRules = async () => {
    setLoadingRules(true);
    try {
      const sq = scopeQuery();
      const res = await fetch(`/api/attendance-policy-rules${sq ? `?${sq}` : ''}`, { headers: getAuthHeaders() });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed');
      setRules(d.data || []);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load rules');
    } finally {
      setLoadingRules(false);
    }
  };

  useEffect(() => { fetchRules(); }, []);

  const openAdd = () => { setEditingRule(null); setForm(emptyRule()); setShowForm(true); setDeleteConfirmId(null); };
  const openEdit = (r: AttendancePolicyRule) => { setEditingRule(r); setForm({ ...r }); setShowForm(true); setDeleteConfirmId(null); };
  const handleCancelForm = () => { setShowForm(false); setEditingRule(null); };

  const updateForm = <K extends keyof AttendancePolicyRule>(k: K, v: AttendancePolicyRule[K]) => setForm(prev => ({ ...prev, [k]: v }));

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!form.name.trim()) { toast.error('Rule name is required'); return; }

    setSubmitting(true);
    try {
      const isEdit = !!editingRule;
      const body = { ...form, companyId: companyId || form.companyId };
      if (isEdit) body.id = editingRule!.id;

      const res = await fetch('/api/attendance-policy-rules', {
        method: isEdit ? 'PUT' : 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(body),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed');

      toast.success(`Rule ${isEdit ? 'updated' : 'created'} successfully`);
      handleCancelForm();
      fetchRules();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Operation failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/attendance-policy-rules?id=${deleteConfirmId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed');
      toast.success('Rule deleted');
      fetchRules();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setDeleting(false);
      setDeleteConfirmId(null);
    }
  };

  const attendancePolicies = policies.filter(p => p.category === POLICY_CATEGORY);

  return (
    <div className="space-y-6">
      {/* Action Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FiList className="w-5 h-5 text-teal-500" />
          <h2 className="text-lg font-semibold text-thb-text-primary">Attendance Policy Rules</h2>
          <span className="text-xs text-thb-text-muted">({rules.length})</span>
        </div>
        <button onClick={openAdd} className="inline-flex items-center gap-2 px-4 py-2.5 bg-teal-500 text-white rounded-lg hover:bg-teal-600 font-medium text-sm shadow-sm shadow-teal-500/25 transition-colors">
          <FiPlus className="w-4 h-4" /> Add Rule
        </button>
      </div>

      {/* Inline Form */}
      {showForm && (
        <div className="thb-card border-l-4 border-l-teal-500">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-thb-text-primary">{editingRule ? 'Edit' : 'Add'} Policy Rule</h2>
              <button onClick={handleCancelForm} className="p-2 rounded-lg text-thb-text-muted hover:text-thb-text-primary hover:bg-slate-100 transition-colors"><FiX className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Identity & Scope */}
              <div>
                <h3 className="text-xs font-semibold text-thb-text-muted uppercase tracking-wider mb-3">Identity & Scope</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-thb-text-secondary mb-1">Rule Name <span className="text-red-500 font-bold">*</span></label>
                    <input type="text" value={form.name} onChange={e => updateForm('name', e.target.value)} required className={inputCls} placeholder="e.g. Full-Time Office Rule" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-thb-text-secondary mb-1">Policy Document</label>
                    <select value={form.policyId || ''} onChange={e => updateForm('policyId', e.target.value || undefined)} className={selectCls}>
                      <option value="">— None —</option>
                      {attendancePolicies.map(p => <option key={p.id} value={p.id}>{p.title} (v{p.version})</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-thb-text-secondary mb-1">Employment Type</label>
                    <select value={form.employmentType} onChange={e => updateForm('employmentType', e.target.value)} className={selectCls}>
                      {EMPLOYMENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-thb-text-secondary mb-1">Branch</label>
                    <select value={form.branchId || ''} onChange={e => updateForm('branchId', e.target.value || undefined)} className={selectCls}>
                      <option value="">— All Branches —</option>
                      {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-thb-text-secondary mb-1">Department</label>
                    <select value={form.departmentId || ''} onChange={e => updateForm('departmentId', e.target.value || undefined)} className={selectCls}>
                      <option value="">— All Departments —</option>
                      {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-thb-text-secondary mb-1">Priority</label>
                    <input type="number" value={form.priority} onChange={e => updateForm('priority', Number(e.target.value))} min={0} className={inputCls} />
                    <p className="text-[10px] text-thb-text-muted mt-1">Higher = matched first</p>
                  </div>
                </div>
              </div>

              {/* Shift Settings */}
              <div className="pt-4 border-t border-thb-border">
                <h3 className="text-xs font-semibold text-thb-text-muted uppercase tracking-wider mb-3">Shift Settings</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-thb-text-secondary mb-1">Shift Start</label>
                    <input type="time" value={form.shiftStartDefault} onChange={e => updateForm('shiftStartDefault', e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-thb-text-secondary mb-1">Shift End</label>
                    <input type="time" value={form.shiftEndDefault} onChange={e => updateForm('shiftEndDefault', e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-thb-text-secondary mb-1">Break Duration (min)</label>
                    <input type="number" value={form.breakDurationMinutes} onChange={e => updateForm('breakDurationMinutes', Number(e.target.value))} min={0} className={inputCls} />
                  </div>
                </div>
              </div>

              {/* Grace Periods */}
              <div className="pt-4 border-t border-thb-border">
                <h3 className="text-xs font-semibold text-thb-text-muted uppercase tracking-wider mb-3">Grace Periods</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-thb-text-secondary mb-1">Late Grace (min)</label>
                    <input type="number" value={form.lateGraceMinutes} onChange={e => updateForm('lateGraceMinutes', Number(e.target.value))} min={0} className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-thb-text-secondary mb-1">Early Grace (min)</label>
                    <input type="number" value={form.earlyGraceMinutes} onChange={e => updateForm('earlyGraceMinutes', Number(e.target.value))} min={0} className={inputCls} />
                  </div>
                </div>
              </div>

              {/* Late Mark Policy */}
              <div className="pt-4 border-t border-thb-border">
                <h3 className="text-xs font-semibold text-thb-text-muted uppercase tracking-wider mb-3">Late Mark Policy</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3">
                  <div>
                    <label className="block text-xs font-medium text-thb-text-secondary mb-1">Late Mark Allowance / Month</label>
                    <input type="number" value={form.lateMarkAllowancePerMonth} onChange={e => updateForm('lateMarkAllowancePerMonth', Number(e.target.value))} min={0} className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-thb-text-secondary mb-1">Half Day After (min)</label>
                    <input type="number" value={form.halfDayAfterMinutes} onChange={e => updateForm('halfDayAfterMinutes', Number(e.target.value))} min={0} className={inputCls} />
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-thb-text-primary">Half Day on Exceeding Allowance</p>
                    <Toggle checked={form.lateMarkHalfDayOnExceed} onChange={() => updateForm('lateMarkHalfDayOnExceed', !form.lateMarkHalfDayOnExceed)} />
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-thb-text-primary">Late Mark Not Applicable on Tour/OD</p>
                    <Toggle checked={form.lateMarkNotApplicableOnTour} onChange={() => updateForm('lateMarkNotApplicableOnTour', !form.lateMarkNotApplicableOnTour)} />
                  </div>
                </div>
              </div>

              {/* OT Policy */}
              <div className="pt-4 border-t border-thb-border">
                <h3 className="text-xs font-semibold text-thb-text-muted uppercase tracking-wider mb-3">Overtime Policy</h3>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-medium text-thb-text-primary">Auto Overtime Detection</p>
                  <Toggle checked={form.autoOvertimeEnabled} onChange={() => updateForm('autoOvertimeEnabled', !form.autoOvertimeEnabled)} />
                </div>
                {form.autoOvertimeEnabled && (
                  <div className="pl-4 border-l-2 border-teal-200">
                    <label className="block text-xs font-medium text-thb-text-secondary mb-1">OT Threshold (min)</label>
                    <input type="number" value={form.overtimeThresholdMinutes} onChange={e => updateForm('overtimeThresholdMinutes', Number(e.target.value))} min={0} className={`${inputCls} max-w-[200px]`} />
                    <p className="text-xs text-thb-text-muted mt-1">Minutes after standard hours before OT kicks in</p>
                  </div>
                )}
              </div>

              {/* Gate Pass Policy */}
              <div className="pt-4 border-t border-thb-border">
                <h3 className="text-xs font-semibold text-thb-text-muted uppercase tracking-wider mb-3">Gate Pass Policy</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3">
                  <div>
                    <label className="block text-xs font-medium text-thb-text-secondary mb-1">Max Gate Passes / Month</label>
                    <input type="number" value={form.gatePassMaxPerMonth} onChange={e => updateForm('gatePassMaxPerMonth', Number(e.target.value))} min={0} className={inputCls} />
                    <p className="text-[10px] text-thb-text-muted mt-1">0 = unlimited</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-thb-text-secondary mb-1">Early Departure (hrs)</label>
                    <input type="number" value={form.gatePassEarlyHours} onChange={e => updateForm('gatePassEarlyHours', Number(e.target.value))} min={0} className={inputCls} />
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-thb-text-primary">Half Day on 2nd Gate Pass</p>
                    <Toggle checked={form.gatePassHalfDayOnExceed} onChange={() => updateForm('gatePassHalfDayOnExceed', !form.gatePassHalfDayOnExceed)} />
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-thb-text-primary">Half Day Gate Pass → Next Day Half Day</p>
                    <Toggle checked={form.gatePassHalfDayNextDay} onChange={() => updateForm('gatePassHalfDayNextDay', !form.gatePassHalfDayNextDay)} />
                  </div>
                </div>
              </div>

              {/* Status */}
              <div className="pt-4 border-t border-thb-border">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-thb-text-secondary mb-1">Status</label>
                    <select value={form.status} onChange={e => updateForm('status', e.target.value)} className={selectCls}>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* ── Global Attendance Configuration (merged from Global Config tab) ── */}
              <div className="space-y-4 pt-4 border-t border-thb-border">
                <h3 className="text-sm font-semibold text-thb-text-primary flex items-center gap-2">
                  <FiSliders className="w-4 h-4 text-teal-500" /> Attendance Configuration
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-thb-text-secondary mb-1">Late Grace (minutes)</label>
                    <input type="number" min={0} value={form.lateGraceMinutes} onChange={e => setForm({ ...form, lateGraceMinutes: Number(e.target.value) })} className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-thb-text-secondary mb-1">Early Grace (minutes)</label>
                    <input type="number" min={0} value={form.earlyGraceMinutes} onChange={e => setForm({ ...form, earlyGraceMinutes: Number(e.target.value) })} className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-thb-text-secondary mb-1">Half Day After (minutes late)</label>
                    <input type="number" min={0} value={form.halfDayAfterMinutes} onChange={e => setForm({ ...form, halfDayAfterMinutes: Number(e.target.value) })} className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-thb-text-secondary mb-1">Late Mark Allowance (per month)</label>
                    <input type="number" min={0} value={form.lateMarkAllowancePerMonth} onChange={e => setForm({ ...form, lateMarkAllowancePerMonth: Number(e.target.value) })} className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-thb-text-secondary mb-1">Overtime Threshold (minutes)</label>
                    <input type="number" min={0} value={form.overtimeThresholdMinutes} onChange={e => setForm({ ...form, overtimeThresholdMinutes: Number(e.target.value) })} className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-thb-text-secondary mb-1">Gate Pass Max (per month)</label>
                    <input type="number" min={0} value={form.gatePassMaxPerMonth} onChange={e => setForm({ ...form, gatePassMaxPerMonth: Number(e.target.value) })} className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-thb-text-secondary mb-1">Break Duration (minutes)</label>
                    <input type="number" min={0} value={form.breakDurationMinutes} onChange={e => setForm({ ...form, breakDurationMinutes: Number(e.target.value) })} className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-thb-text-secondary mb-1">Gate Pass Early Hours</label>
                    <input type="number" min={0} value={form.gatePassEarlyHours} onChange={e => setForm({ ...form, gatePassEarlyHours: Number(e.target.value) })} className={inputCls} />
                  </div>
                  <div className="flex items-center gap-2 pt-5">
                    <button type="button" onClick={() => setForm({ ...form, lateMarkHalfDayOnExceed: !form.lateMarkHalfDayOnExceed })} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.lateMarkHalfDayOnExceed ? 'bg-teal-500' : 'bg-slate-200'}`}>
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${form.lateMarkHalfDayOnExceed ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                    <span className="text-xs font-medium text-thb-text-secondary">Half Day on Late Exceed</span>
                  </div>
                  <div className="flex items-center gap-2 pt-5">
                    <button type="button" onClick={() => setForm({ ...form, autoOvertimeEnabled: !form.autoOvertimeEnabled })} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.autoOvertimeEnabled ? 'bg-teal-500' : 'bg-slate-200'}`}>
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${form.autoOvertimeEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                    <span className="text-xs font-medium text-thb-text-secondary">Auto Overtime</span>
                  </div>
                  <div className="flex items-center gap-2 pt-5">
                    <button type="button" onClick={() => setForm({ ...form, gatePassHalfDayOnExceed: !form.gatePassHalfDayOnExceed })} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.gatePassHalfDayOnExceed ? 'bg-teal-500' : 'bg-slate-200'}`}>
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${form.gatePassHalfDayOnExceed ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                    <span className="text-xs font-medium text-thb-text-secondary">Gate Pass Half Day on Exceed</span>
                  </div>
                  <div className="flex items-center gap-2 pt-5">
                    <button type="button" onClick={() => setForm({ ...form, lateMarkNotApplicableOnTour: !form.lateMarkNotApplicableOnTour })} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.lateMarkNotApplicableOnTour ? 'bg-teal-500' : 'bg-slate-200'}`}>
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${form.lateMarkNotApplicableOnTour ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                    <span className="text-xs font-medium text-thb-text-secondary">Late Mark N/A on Tour</span>
                  </div>
                  <div className="flex items-center gap-2 pt-5">
                    <button type="button" onClick={() => setForm({ ...form, gatePassHalfDayNextDay: !form.gatePassHalfDayNextDay })} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.gatePassHalfDayNextDay ? 'bg-teal-500' : 'bg-slate-200'}`}>
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${form.gatePassHalfDayNextDay ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                    <span className="text-xs font-medium text-thb-text-secondary">Gate Pass Half Day Next Day</span>
                  </div>
                </div>
              </div>

              {/* Form Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-thb-border">
                <button type="button" onClick={handleCancelForm} className="px-4 py-2.5 rounded-lg border border-thb-border text-sm font-medium text-thb-text-secondary hover:bg-slate-50 transition-colors">Cancel</button>
                <button type="submit" disabled={submitting} className="px-6 py-2.5 rounded-lg bg-teal-500 text-white text-sm font-medium hover:bg-teal-600 disabled:opacity-50 shadow-sm shadow-teal-500/25 transition-colors">
                  {submitting ? 'Saving...' : editingRule ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Rules Table */}
      {loadingRules ? (
        <div className="flex items-center justify-center py-12"><FiSettings className="w-8 h-8 animate-spin text-teal-400" /></div>
      ) : (
        <div className="thb-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider border-b border-thb-border bg-slate-50/50">Rule Name</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider border-b border-thb-border bg-slate-50/50">Employment Type</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider border-b border-thb-border bg-slate-50/50">Branch</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider border-b border-thb-border bg-slate-50/50">Department</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider border-b border-thb-border bg-slate-50/50">Shift</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider border-b border-thb-border bg-slate-50/50">Priority</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider border-b border-thb-border bg-slate-50/50">Status</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider border-b border-thb-border bg-slate-50/50">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rules.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center">
                      <FiList className="w-10 h-10 text-thb-text-muted mx-auto mb-3" />
                      <p className="text-thb-text-secondary font-medium">No policy rules configured</p>
                      <p className="text-xs text-thb-text-muted mt-1">Add rules to scope attendance policies by employee type, branch, or department</p>
                    </td>
                  </tr>
                ) : rules.map(rule => {
                  const badge = getStatusBadge(rule.status);
                  const fmtTimeShort = (t: string) => {
                    if (!t) return '';
                    const [h, m] = t.split(':').map(Number);
                    const ampm = h >= 12 ? 'PM' : 'AM';
                    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`;
                  };
                  return (
                    <tr key={rule.id} className={`transition-colors ${deleteConfirmId === rule.id ? 'bg-red-50' : 'hover:bg-slate-50/50'}`}>
                      {deleteConfirmId === rule.id ? (
                        <td colSpan={8} className="px-4 py-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2"><FiAlertTriangle className="w-4 h-4 text-red-500" /><span className="text-sm text-red-600">Delete <b>{rule.name}</b>?</span></div>
                            <div className="flex items-center gap-2">
                              <button onClick={() => setDeleteConfirmId(null)} className="px-3 py-1 text-xs font-medium rounded-lg border border-thb-border hover:bg-slate-50">Cancel</button>
                              <button onClick={handleDelete} disabled={deleting} className="px-3 py-1 text-xs font-medium rounded-lg bg-red-500 text-white hover:bg-red-600 disabled:opacity-50">{deleting ? 'Deleting...' : 'Delete'}</button>
                            </div>
                          </div>
                        </td>
                      ) : (
                        <>
                          <td className="px-4 py-3 text-sm font-medium text-thb-text-primary border-b border-thb-border/50">{rule.name}</td>
                          <td className="px-4 py-3 text-sm text-thb-text-secondary border-b border-thb-border/50 capitalize">{rule.employmentType}</td>
                          <td className="px-4 py-3 text-sm text-thb-text-secondary border-b border-thb-border/50">{rule.branch?.name || '—'}</td>
                          <td className="px-4 py-3 text-sm text-thb-text-secondary border-b border-thb-border/50">{rule.department?.name || '—'}</td>
                          <td className="px-4 py-3 text-sm text-thb-text-secondary border-b border-thb-border/50">{fmtTimeShort(rule.shiftStartDefault)}–{fmtTimeShort(rule.shiftEndDefault)}</td>
                          <td className="px-4 py-3 text-sm text-thb-text-secondary border-b border-thb-border/50">{rule.priority}</td>
                          <td className="px-4 py-3 text-sm border-b border-thb-border/50"><span className={badge.className}>{badge.label}</span></td>
                          <td className="px-4 py-3 text-sm text-right border-b border-thb-border/50">
                            <div className="flex items-center justify-end gap-1">
                              <button onClick={() => openEdit(rule)} className="p-1.5 rounded-lg text-thb-text-muted hover:text-green-500 hover:bg-green-50 transition-colors" title="Edit"><FiEdit2 className="w-3.5 h-3.5" /></button>
                              <button onClick={() => setDeleteConfirmId(rule.id)} className="p-1.5 rounded-lg text-thb-text-muted hover:text-red-500 hover:bg-red-50 transition-colors" title="Delete"><FiTrash2 className="w-3.5 h-3.5" /></button>
                            </div>
                          </td>
                        </>
                      )}
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
