'use client';

import { useAuthStore } from '@/store/authStore';
import { useCallback, useEffect, useState } from 'react';
import { FiBook, FiPlus, FiEdit2, FiTrash2, FiEye, FiX, FiSearch, FiRefreshCw } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useCompanyContextStore } from '@/store/companyContextStore';

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

// --- Types ---
interface PayrollComponentRef {
  id: string;
  code: string;
  name: string;
  componentType: string;
}

interface GLAccountMapping {
  id: string;
  legalEntityId: string;
  componentId: string;
  component: PayrollComponentRef;
  debitAccount: string;
  creditAccount: string;
  costCenterSource: string;
  specificCostCenter: string | null;
  postingType: string;
  intercompanyAccount: string | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  companyId: string | null;
  createdAt: string;
  updatedAt: string;
}

// --- Constants ---
const COST_CENTER_SOURCE_OPTIONS = [
  { value: 'EMPLOYEE_DEFAULT', label: 'Employee Default' },
  { value: 'COMPONENT_SPECIFIC', label: 'Component Specific' },
  { value: 'DIMENSION_SPLIT', label: 'Dimension Split' },
];

const POSTING_TYPE_OPTIONS = [
  { value: 'ACCRUAL', label: 'Accrual' },
  { value: 'ACTUAL', label: 'Actual' },
  { value: 'BOTH', label: 'Both' },
];

// --- Badge Helpers ---
function getPostingTypeBadge(type: string) {
  const map: Record<string, string> = {
    ACCRUAL: 'thb-badge thb-badge-warning',
    ACTUAL: 'thb-badge thb-badge-success',
    BOTH: 'thb-badge thb-badge-info',
  };
  return map[type] || 'thb-badge thb-badge-info';
}

function getCostCenterBadge(source: string) {
  const map: Record<string, string> = {
    EMPLOYEE_DEFAULT: 'thb-badge thb-badge-info',
    COMPONENT_SPECIFIC: 'thb-badge thb-badge-warning',
    DIMENSION_SPLIT: 'thb-badge thb-badge-purple',
  };
  return map[source] || 'thb-badge thb-badge-info';
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
  legalEntityId: '',
  componentId: '',
  debitAccount: '',
  creditAccount: '',
  costCenterSource: 'EMPLOYEE_DEFAULT',
  specificCostCenter: '',
  postingType: 'ACTUAL',
  intercompanyAccount: '',
  effectiveFrom: new Date().toISOString().split('T')[0],
  effectiveTo: '',
};

export default function GLMappingPage() {
  const { user } = useAuthStore();
  const effectiveCompanyId = useCompanyContextStore(s => s.effectiveCompanyId);
  const isAdmin = user?.role === 'super_admin' || user?.role === 'tenant_admin' || user?.role === 'admin' || user?.role === 'admin';

  const [mappings, setMappings] = useState<GLAccountMapping[]>([]);
  const [components, setComponents] = useState<PayrollComponentRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [viewingMapping, setViewingMapping] = useState<GLAccountMapping | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [form, setForm] = useState({ ...emptyForm });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [mappingRes, compRes] = await Promise.all([
        fetch(`/api/payroll/gl-mappings?${scopeQuery}` , { headers: getAuthHeaders() }),
        fetch(`/api/payroll/components?${scopeQuery}` , { headers: getAuthHeaders() }),
      ]);
      if (mappingRes.ok) {
        const data = await mappingRes.json();
        setMappings(Array.isArray(data.data) ? data.data : []);
      }
      if (compRes.ok) {
        const data = await compRes.json();
        const compList = Array.isArray(data) ? data : data.data || [];
        setComponents(compList.map((c: { id: string; code: string; name: string; componentType: string }) => ({ id: c.id, code: c.code, name: c.name, componentType: c.componentType })));
      }
    } catch {
      toast.error('Failed to load GL mappings');
    } finally {
      setLoading(false);
    }
  }, []);
  const cid = effectiveCompanyId();
  const scopeQuery = cid ? `companyId=${cid}&` : '';


  useEffect(() => { queueMicrotask(() => fetchData()); }, [fetchData]);

  const totalMappings = mappings.length;
  const accrualCount = mappings.filter(m => m.postingType === 'ACCRUAL').length;
  const actualCount = mappings.filter(m => m.postingType === 'ACTUAL').length;
  const bothCount = mappings.filter(m => m.postingType === 'BOTH').length;

  const filteredMappings = mappings.filter(m => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return m.debitAccount.toLowerCase().includes(q) || m.creditAccount.toLowerCase().includes(q) || m.component?.code?.toLowerCase().includes(q) || m.component?.name?.toLowerCase().includes(q) || m.legalEntityId.toLowerCase().includes(q);
  });

  const handleAddNew = () => {
    setForm({ ...emptyForm });
    setEditingId(null);
    setShowForm(true);
    setViewingMapping(null);
    setTimeout(() => document.getElementById('crud-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  const handleEdit = (m: GLAccountMapping) => {
    setForm({
      legalEntityId: m.legalEntityId,
      componentId: m.componentId,
      debitAccount: m.debitAccount,
      creditAccount: m.creditAccount,
      costCenterSource: m.costCenterSource,
      specificCostCenter: m.specificCostCenter || '',
      postingType: m.postingType,
      intercompanyAccount: m.intercompanyAccount || '',
      effectiveFrom: m.effectiveFrom ? new Date(m.effectiveFrom).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      effectiveTo: m.effectiveTo ? new Date(m.effectiveTo).toISOString().split('T')[0] : '',
    });
    setEditingId(m.id);
    setShowForm(true);
    setViewingMapping(null);
    setTimeout(() => document.getElementById('crud-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  const handleSubmit = async () => {
    if (!form.legalEntityId.trim()) { toast.error('Legal Entity ID is required'); return; }
    if (!form.componentId) { toast.error('Payroll component is required'); return; }
    if (!form.debitAccount.trim()) { toast.error('Debit account is required'); return; }
    if (!form.creditAccount.trim()) { toast.error('Credit account is required'); return; }
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        specificCostCenter: form.specificCostCenter || null,
        intercompanyAccount: form.intercompanyAccount || null,
        effectiveFrom: new Date(form.effectiveFrom).toISOString(),
        effectiveTo: form.effectiveTo ? new Date(form.effectiveTo).toISOString() : null,
      };
      if (editingId) {
        const res = await fetch(`/api/payroll/gl-mappings/${editingId}?${scopeQuery}` , { method: 'PUT', headers: getAuthHeaders(), body: JSON.stringify(payload) });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed to update'); }
        toast.success('GL mapping updated');
      } else {
        const res = await fetch(`/api/payroll/gl-mappings?${scopeQuery}` , { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(payload) });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed to create'); }
        toast.success('GL mapping created');
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
      const res = await fetch(`/api/payroll/gl-mappings/${id}?${scopeQuery}` , { method: 'DELETE', headers: getAuthHeaders() });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed to delete'); }
      toast.success('GL mapping deleted');
      setDeleteConfirmId(null);
      if (viewingMapping?.id === id) setViewingMapping(null);
      fetchData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setDeleting(false);
    }
  };

  const formatStr = (s: string) => s.replace(/_/g, ' ');

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-thb-text-primary flex items-center gap-2">
            <FiBook className="w-6 h-6 text-emerald-500" />
            GL Account Mapping
          </h1>
          <p className="text-thb-text-secondary mt-1">Map payroll components to general ledger accounts for accounting integration</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => fetchData()} className="p-2.5 rounded-lg border border-thb-border text-thb-text-secondary hover:bg-slate-50 transition-colors" title="Refresh"><FiRefreshCw className="w-4 h-4" /></button>
          {isAdmin && (
            <button onClick={handleAddNew} className="inline-flex items-center gap-2 px-4 py-2.5 bg-green-500 text-white rounded-lg hover:bg-green-600 font-medium text-sm shadow-sm shadow-green-500/25 transition-colors">
              <FiPlus className="w-4 h-4" /> Add Mapping
            </button>
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="thb-card thb-card-hover p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center"><FiBook className="w-5 h-5 text-emerald-500" /></div>
            <div><p className="text-xs font-medium text-thb-text-secondary">Total Mappings</p><p className="text-xl font-bold text-thb-text-primary">{totalMappings}</p></div>
          </div>
        </div>
        <div className="thb-card thb-card-hover p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center"><FiBook className="w-5 h-5 text-amber-500" /></div>
            <div><p className="text-xs font-medium text-thb-text-secondary">Accrual</p><p className="text-xl font-bold text-thb-text-primary">{accrualCount}</p></div>
          </div>
        </div>
        <div className="thb-card thb-card-hover p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center"><FiBook className="w-5 h-5 text-emerald-500" /></div>
            <div><p className="text-xs font-medium text-thb-text-secondary">Actual</p><p className="text-xl font-bold text-thb-text-primary">{actualCount}</p></div>
          </div>
        </div>
        <div className="thb-card thb-card-hover p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center"><FiBook className="w-5 h-5 text-green-500" /></div>
            <div><p className="text-xs font-medium text-thb-text-secondary">Both</p><p className="text-xl font-bold text-thb-text-primary">{bothCount}</p></div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="thb-card p-4">
        <div className="relative">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-thb-text-muted" />
          <input type="text" placeholder="Search by GL account, component code/name, entity..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" />
        </div>
      </div>

      {/* View Panel */}
      {viewingMapping && (
        <div className="thb-card border-l-4 border-l-emerald-500">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold text-thb-text-primary">{viewingMapping.component?.name || 'GL Mapping'}</h2>
                <p className="text-sm text-thb-text-secondary mt-0.5">{viewingMapping.component?.code} &middot; {viewingMapping.legalEntityId}</p>
              </div>
              <div className="flex items-center gap-2">
                {isAdmin && <button onClick={() => handleEdit(viewingMapping)} className="px-3 py-1.5 rounded-lg bg-green-500 text-white text-xs font-medium hover:bg-green-600 transition-colors flex items-center gap-1"><FiEdit2 className="w-3.5 h-3.5" /> Edit</button>}
                <button onClick={() => setViewingMapping(null)} className="p-2 rounded-lg text-thb-text-muted hover:text-thb-text-primary hover:bg-slate-100 transition-colors"><FiX className="w-5 h-5" /></button>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <DetailItem label="Component" value={viewingMapping.component?.name} />
              <DetailItem label="Component Code" value={viewingMapping.component?.code} />
              <DetailItem label="Legal Entity" value={viewingMapping.legalEntityId} />
              <DetailItem label="Debit Account" value={viewingMapping.debitAccount} />
              <DetailItem label="Credit Account" value={viewingMapping.creditAccount} />
              <DetailItem label="Posting Type" value={formatStr(viewingMapping.postingType)} badge={getPostingTypeBadge(viewingMapping.postingType)} />
              <DetailItem label="Cost Center Source" value={formatStr(viewingMapping.costCenterSource)} badge={getCostCenterBadge(viewingMapping.costCenterSource)} />
              <DetailItem label="Specific Cost Center" value={viewingMapping.specificCostCenter} />
              <DetailItem label="Intercompany Account" value={viewingMapping.intercompanyAccount} />
              <DetailItem label="Effective From" value={viewingMapping.effectiveFrom ? new Date(viewingMapping.effectiveFrom).toLocaleDateString() : null} />
              <DetailItem label="Effective To" value={viewingMapping.effectiveTo ? new Date(viewingMapping.effectiveTo).toLocaleDateString() : null} />
            </div>
          </div>
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div id="crud-form" className="thb-card border-l-4 border-l-green-500">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-thb-text-primary">{editingId ? 'Edit GL Mapping' : 'Create GL Mapping'}</h2>
              <button onClick={() => { setShowForm(false); setEditingId(null); }} className="p-2 rounded-lg text-thb-text-muted hover:text-thb-text-primary hover:bg-slate-100 transition-colors"><FiX className="w-5 h-5" /></button>
            </div>
            <div className="mb-5">
              <h3 className="text-sm font-semibold text-thb-text-primary mb-3">Entity & Component</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Legal Entity ID *</label>
                  <input value={form.legalEntityId} onChange={(e) => setForm({ ...form, legalEntityId: e.target.value })} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" placeholder="e.g. LE-001" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Payroll Component *</label>
                  <select value={form.componentId} onChange={(e) => setForm({ ...form, componentId: e.target.value })} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400">
                    <option value="">Select Component</option>
                    {components.map(c => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="mb-5">
              <h3 className="text-sm font-semibold text-thb-text-primary mb-3">GL Accounts</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Debit Account *</label>
                  <input value={form.debitAccount} onChange={(e) => setForm({ ...form, debitAccount: e.target.value })} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" placeholder="e.g. GL-5001" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Credit Account *</label>
                  <input value={form.creditAccount} onChange={(e) => setForm({ ...form, creditAccount: e.target.value })} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" placeholder="e.g. GL-2001" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Posting Type</label>
                  <select value={form.postingType} onChange={(e) => setForm({ ...form, postingType: e.target.value })} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400">
                    {POSTING_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="mb-5">
              <h3 className="text-sm font-semibold text-thb-text-primary mb-3">Cost Center & Intercompany</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Cost Center Source</label>
                  <select value={form.costCenterSource} onChange={(e) => setForm({ ...form, costCenterSource: e.target.value })} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400">
                    {COST_CENTER_SOURCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                {form.costCenterSource === 'COMPONENT_SPECIFIC' && (
                  <div>
                    <label className="block text-xs font-medium text-thb-text-secondary mb-1">Specific Cost Center</label>
                    <input value={form.specificCostCenter} onChange={(e) => setForm({ ...form, specificCostCenter: e.target.value })} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" placeholder="e.g. CC-1001" />
                  </div>
                )}
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Intercompany Account</label>
                  <input value={form.intercompanyAccount} onChange={(e) => setForm({ ...form, intercompanyAccount: e.target.value })} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" placeholder="e.g. GL-IC-001" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Effective From</label>
                  <input type="date" value={form.effectiveFrom} onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Effective To</label>
                  <input type="date" value={form.effectiveTo} onChange={(e) => setForm({ ...form, effectiveTo: e.target.value })} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" />
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-thb-border">
              <button onClick={() => { setShowForm(false); setEditingId(null); }} className="px-4 py-2.5 rounded-lg border border-thb-border text-sm font-medium text-thb-text-secondary hover:bg-slate-50 transition-colors">Cancel</button>
              <button onClick={handleSubmit} disabled={submitting} className="px-6 py-2.5 rounded-lg bg-green-500 text-white text-sm font-medium hover:bg-green-600 disabled:opacity-50 shadow-sm shadow-green-500/25 transition-colors">
                {submitting ? 'Saving...' : editingId ? 'Update Mapping' : 'Create Mapping'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="thb-card overflow-hidden"><div className="p-5 space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-12 bg-slate-100 rounded animate-pulse" />)}</div></div>
      ) : filteredMappings.length === 0 ? (
        <div className="thb-card p-12 text-center">
          <FiBook className="w-12 h-12 text-thb-text-muted mx-auto mb-3" />
          <p className="text-thb-text-secondary font-medium">No GL mappings found</p>
          <p className="text-sm text-thb-text-muted mt-1">Create your first GL account mapping</p>
        </div>
      ) : (
        <div className="thb-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-thb-border">
                <tr>{['Component', 'Debit GL', 'Credit GL', 'Posting', 'Cost Center Src', 'Effective', 'Actions'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-thb-text-muted uppercase tracking-wider">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredMappings.map(m => (
                  deleteConfirmId === m.id ? (
                    <tr key={m.id} className="bg-red-50">
                      <td colSpan={7} className="px-4 py-3">
                        <p className="text-sm text-red-700 font-medium mb-2">Delete GL mapping for &quot;{m.component?.name || m.componentId}&quot;?</p>
                        <div className="flex items-center gap-2">
                          <button onClick={() => handleDelete(m.id)} disabled={deleting} className="px-3 py-1.5 bg-red-500 text-white text-xs font-medium rounded-lg hover:bg-red-600 disabled:opacity-50">{deleting ? 'Deleting...' : 'Confirm'}</button>
                          <button onClick={() => setDeleteConfirmId(null)} className="px-3 py-1.5 border border-thb-border text-xs font-medium rounded-lg hover:bg-slate-50">Cancel</button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <tr key={m.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-sm font-medium text-thb-text-primary">{m.component?.name || '—'}</p>
                          <p className="text-xs text-thb-text-muted">{m.component?.code}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm font-mono text-thb-text-primary">{m.debitAccount}</td>
                      <td className="px-4 py-3 text-sm font-mono text-thb-text-secondary">{m.creditAccount}</td>
                      <td className="px-4 py-3"><span className={getPostingTypeBadge(m.postingType)}>{formatStr(m.postingType)}</span></td>
                      <td className="px-4 py-3"><span className={getCostCenterBadge(m.costCenterSource)}>{formatStr(m.costCenterSource)}</span></td>
                      <td className="px-4 py-3 text-sm text-thb-text-secondary">{m.effectiveFrom ? new Date(m.effectiveFrom).toLocaleDateString() : '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => setViewingMapping(m)} className="p-1.5 rounded-lg text-thb-text-muted hover:text-green-500 hover:bg-green-50 transition-colors" title="View"><FiEye className="w-4 h-4" /></button>
                          {isAdmin && <button onClick={() => handleEdit(m)} className="p-1.5 rounded-lg text-thb-text-muted hover:text-amber-500 hover:bg-amber-50 transition-colors" title="Edit"><FiEdit2 className="w-4 h-4" /></button>}
                          {isAdmin && <button onClick={() => setDeleteConfirmId(m.id)} className="p-1.5 rounded-lg text-thb-text-muted hover:text-red-500 hover:bg-red-50 transition-colors" title="Delete"><FiTrash2 className="w-4 h-4" /></button>}
                        </div>
                      </td>
                    </tr>
                  )
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
