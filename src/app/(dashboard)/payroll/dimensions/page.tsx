'use client';

import { useAuthStore } from '@/store/authStore';
import { useCallback, useEffect, useState } from 'react';
import { FiGrid, FiPlus, FiEdit2, FiTrash2, FiEye, FiX, FiSearch, FiRefreshCw, FiLayers } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useCompanyContextStore } from '@/store/companyContextStore';

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

// --- Types ---
interface EmployeeDimensionAllocation {
  id: string;
  employeeId: string;
  dimensionId: string;
  dimensionValueId: string;
  allocationPct: number;
  allocationAmount: number | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
}

interface DimensionDefinition {
  id: string;
  code: string;
  name: string;
  dimensionType: string;
  hierarchyEnabled: boolean;
  allocationMethod: string;
  isMandatory: boolean;
  allowMultiple: boolean;
  maxAllocations: number | null;
  effectiveFrom: string;
  companyId: string | null;
  allocations: EmployeeDimensionAllocation[];
  createdAt: string;
  updatedAt: string;
}

// --- Constants ---
const DIMENSION_TYPE_OPTIONS = [
  { value: 'STANDARD', label: 'Standard' },
  { value: 'CUSTOM', label: 'Custom' },
];

const ALLOCATION_METHOD_OPTIONS = [
  { value: 'PERCENTAGE', label: 'Percentage' },
  { value: 'AMOUNT', label: 'Fixed Amount' },
  { value: 'HEADCOUNT', label: 'Headcount' },
  { value: 'FTE', label: 'FTE' },
];

const STANDARD_DIMENSIONS = [
  { code: 'DEPT', name: 'Department' },
  { code: 'CC', name: 'Cost Center' },
  { code: 'PROJ', name: 'Project' },
  { code: 'LOC', name: 'Location' },
  { code: 'BU', name: 'Business Unit' },
];

// --- Badge Helpers ---
function getDimTypeBadge(type: string) {
  return type === 'STANDARD' ? 'thb-badge thb-badge-info' : 'thb-badge thb-badge-purple';
}

function getAllocMethodBadge(method: string) {
  const map: Record<string, string> = {
    PERCENTAGE: 'thb-badge thb-badge-success',
    AMOUNT: 'thb-badge thb-badge-warning',
    HEADCOUNT: 'thb-badge thb-badge-info',
    FTE: 'thb-badge thb-badge-purple',
  };
  return map[method] || 'thb-badge thb-badge-info';
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
  code: '',
  name: '',
  dimensionType: 'STANDARD',
  hierarchyEnabled: false,
  allocationMethod: 'PERCENTAGE',
  isMandatory: false,
  allowMultiple: true,
  maxAllocations: '',
  effectiveFrom: new Date().toISOString().split('T')[0],
};

export default function DimensionsPage() {
  const { user } = useAuthStore();
  const effectiveCompanyId = useCompanyContextStore(s => s.effectiveCompanyId);
  const isAdmin = user?.role === 'super_admin' || user?.role === 'tenant_admin' || user?.role === 'admin';

  const [dimensions, setDimensions] = useState<DimensionDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [viewingDimension, setViewingDimension] = useState<DimensionDefinition | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [form, setForm] = useState({ ...emptyForm });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (typeFilter) params.set('dimensionType', typeFilter);
      const qs = params.toString();
      const res = await fetch(`/api/payroll/dimensions${qs ? `?${qs}` : ''}`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setDimensions(Array.isArray(data.data) ? data.data : []);
      }
    } catch {
      toast.error('Failed to load dimensions');
    } finally {
      setLoading(false);
    }
  }, [typeFilter]);
  const cid = effectiveCompanyId();
  const scopeQuery = cid ? `companyId=${cid}&` : '';


  useEffect(() => { queueMicrotask(() => fetchData()); }, [fetchData]);

  const totalDimensions = dimensions.length;
  const standardCount = dimensions.filter(d => d.dimensionType === 'STANDARD').length;
  const customCount = dimensions.filter(d => d.dimensionType === 'CUSTOM').length;
  const totalAllocations = dimensions.reduce((sum, d) => sum + (d.allocations?.length || 0), 0);

  const filteredDimensions = dimensions.filter(d => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return d.code.toLowerCase().includes(q) || d.name.toLowerCase().includes(q);
  });

  const handleAddNew = () => {
    setForm({ ...emptyForm });
    setEditingId(null);
    setShowForm(true);
    setViewingDimension(null);
    setTimeout(() => document.getElementById('crud-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  const handleEdit = (d: DimensionDefinition) => {
    setForm({
      code: d.code,
      name: d.name,
      dimensionType: d.dimensionType,
      hierarchyEnabled: d.hierarchyEnabled,
      allocationMethod: d.allocationMethod,
      isMandatory: d.isMandatory,
      allowMultiple: d.allowMultiple,
      maxAllocations: d.maxAllocations != null ? String(d.maxAllocations) : '',
      effectiveFrom: d.effectiveFrom ? new Date(d.effectiveFrom).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
    });
    setEditingId(d.id);
    setShowForm(true);
    setViewingDimension(null);
    setTimeout(() => document.getElementById('crud-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  const handlePresetSelect = (preset: { code: string; name: string }) => {
    setForm({ ...form, code: preset.code, name: preset.name });
  };

  const handleSubmit = async () => {
    if (!form.code.trim()) { toast.error('Dimension code is required'); return; }
    if (!form.name.trim()) { toast.error('Dimension name is required'); return; }
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        code: form.code.toUpperCase().replace(/\s+/g, '_'),
        maxAllocations: form.maxAllocations ? parseInt(form.maxAllocations) : null,
        effectiveFrom: new Date(form.effectiveFrom).toISOString(),
      };
      if (editingId) {
        const res = await fetch(`/api/payroll/dimensions/${editingId}?${scopeQuery}` , { method: 'PUT', headers: getAuthHeaders(), body: JSON.stringify(payload) });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed to update'); }
        toast.success('Dimension updated');
      } else {
        const res = await fetch(`/api/payroll/dimensions?${scopeQuery}` , { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(payload) });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed to create'); }
        toast.success('Dimension created');
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
      const res = await fetch(`/api/payroll/dimensions/${id}?${scopeQuery}` , { method: 'DELETE', headers: getAuthHeaders() });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed to delete'); }
      toast.success('Dimension deleted');
      setDeleteConfirmId(null);
      if (viewingDimension?.id === id) setViewingDimension(null);
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
            <FiGrid className="w-6 h-6 text-orange-500" />
            Multi-Dimensional Allocation
          </h1>
          <p className="text-thb-text-secondary mt-1">Configure cost allocation dimensions across departments, cost centers, projects, and more</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => fetchData()} className="p-2.5 rounded-lg border border-thb-border text-thb-text-secondary hover:bg-slate-50 transition-colors" title="Refresh"><FiRefreshCw className="w-4 h-4" /></button>
          {isAdmin && (
            <button onClick={handleAddNew} className="inline-flex items-center gap-2 px-4 py-2.5 bg-green-500 text-white rounded-lg hover:bg-green-600 font-medium text-sm shadow-sm shadow-green-500/25 transition-colors">
              <FiPlus className="w-4 h-4" /> Add Dimension
            </button>
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="thb-card thb-card-hover p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center"><FiGrid className="w-5 h-5 text-green-500" /></div>
            <div><p className="text-xs font-medium text-thb-text-secondary">Total Dimensions</p><p className="text-xl font-bold text-thb-text-primary">{totalDimensions}</p></div>
          </div>
        </div>
        <div className="thb-card thb-card-hover p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center"><FiLayers className="w-5 h-5 text-emerald-500" /></div>
            <div><p className="text-xs font-medium text-thb-text-secondary">Standard</p><p className="text-xl font-bold text-thb-text-primary">{standardCount}</p></div>
          </div>
        </div>
        <div className="thb-card thb-card-hover p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center"><FiGrid className="w-5 h-5 text-teal-500" /></div>
            <div><p className="text-xs font-medium text-thb-text-secondary">Custom</p><p className="text-xl font-bold text-thb-text-primary">{customCount}</p></div>
          </div>
        </div>
        <div className="thb-card thb-card-hover p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center"><FiLayers className="w-5 h-5 text-amber-500" /></div>
            <div><p className="text-xs font-medium text-thb-text-secondary">Allocations</p><p className="text-xl font-bold text-thb-text-primary">{totalAllocations}</p></div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="thb-card p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-thb-text-muted" />
            <input type="text" placeholder="Search by code or name..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" />
          </div>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 min-w-[150px]">
            <option value="">All Types</option>
            {DIMENSION_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      {/* View Panel */}
      {viewingDimension && (
        <div id="view-panel" className="thb-card border-l-4 border-l-orange-500">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold text-thb-text-primary">{viewingDimension.name}</h2>
                <p className="text-sm text-thb-text-secondary mt-0.5">{viewingDimension.code}</p>
              </div>
              <div className="flex items-center gap-2">
                {isAdmin && <button onClick={() => handleEdit(viewingDimension)} className="px-3 py-1.5 rounded-lg bg-green-500 text-white text-xs font-medium hover:bg-green-600 transition-colors flex items-center gap-1"><FiEdit2 className="w-3.5 h-3.5" /> Edit</button>}
                <button onClick={() => setViewingDimension(null)} className="p-2 rounded-lg text-thb-text-muted hover:text-thb-text-primary hover:bg-slate-100 transition-colors"><FiX className="w-5 h-5" /></button>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <DetailItem label="Code" value={viewingDimension.code} />
              <DetailItem label="Name" value={viewingDimension.name} />
              <DetailItem label="Type" value={formatStr(viewingDimension.dimensionType)} badge={getDimTypeBadge(viewingDimension.dimensionType)} />
              <DetailItem label="Allocation Method" value={formatStr(viewingDimension.allocationMethod)} badge={getAllocMethodBadge(viewingDimension.allocationMethod)} />
              <DetailItem label="Hierarchy Enabled" value={viewingDimension.hierarchyEnabled} />
              <DetailItem label="Mandatory" value={viewingDimension.isMandatory} />
              <DetailItem label="Allow Multiple" value={viewingDimension.allowMultiple} />
              <DetailItem label="Max Allocations" value={viewingDimension.maxAllocations} />
              <DetailItem label="Effective From" value={viewingDimension.effectiveFrom ? new Date(viewingDimension.effectiveFrom).toLocaleDateString() : null} />
              <DetailItem label="Employee Allocations" value={viewingDimension.allocations?.length || 0} />
            </div>
            {viewingDimension.allocations && viewingDimension.allocations.length > 0 && (
              <div className="mt-6 pt-4 border-t border-thb-border">
                <h3 className="text-sm font-semibold text-thb-text-primary mb-3">Employee Allocations</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-thb-border">
                      <tr>
                        {['Employee', 'Value', 'Allocation %', 'Amount', 'Primary', 'Effective'].map(h => (
                          <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-thb-text-muted uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {viewingDimension.allocations.map(a => (
                        <tr key={a.id} className="hover:bg-slate-50/50">
                          <td className="px-3 py-2 text-thb-text-primary">{a.employeeId}</td>
                          <td className="px-3 py-2 text-thb-text-secondary">{a.dimensionValueId}</td>
                          <td className="px-3 py-2 text-thb-text-primary">{a.allocationPct}%</td>
                          <td className="px-3 py-2 text-thb-text-secondary">{a.allocationAmount ?? '—'}</td>
                          <td className="px-3 py-2">{a.isPrimary ? <span className="thb-badge thb-badge-success">Primary</span> : '—'}</td>
                          <td className="px-3 py-2 text-thb-text-secondary">{a.effectiveFrom ? new Date(a.effectiveFrom).toLocaleDateString() : '—'}</td>
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
              <h2 className="text-lg font-semibold text-thb-text-primary">{editingId ? 'Edit Dimension' : 'Create Dimension'}</h2>
              <button onClick={() => { setShowForm(false); setEditingId(null); }} className="p-2 rounded-lg text-thb-text-muted hover:text-thb-text-primary hover:bg-slate-100 transition-colors"><FiX className="w-5 h-5" /></button>
            </div>

            {!editingId && (
              <div className="mb-5">
                <h3 className="text-sm font-semibold text-thb-text-primary mb-3">Quick Presets</h3>
                <div className="flex flex-wrap gap-2">
                  {STANDARD_DIMENSIONS.map(preset => (
                    <button key={preset.code} onClick={() => handlePresetSelect(preset)} className="px-3 py-1.5 rounded-lg border border-thb-border text-xs font-medium text-thb-text-secondary hover:bg-slate-50 hover:text-green-600 transition-colors">
                      {preset.code} — {preset.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Code <span className="text-red-500 font-bold">*</span></label>
                <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase().replace(/\s+/g, '_') })} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" placeholder="e.g. DEPT, CC, PROJ" />
              </div>
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Name <span className="text-red-500 font-bold">*</span></label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" placeholder="e.g. Department, Cost Center" />
              </div>
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Dimension Type</label>
                <select value={form.dimensionType} onChange={(e) => setForm({ ...form, dimensionType: e.target.value })} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400">
                  {DIMENSION_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Allocation Method</label>
                <select value={form.allocationMethod} onChange={(e) => setForm({ ...form, allocationMethod: e.target.value })} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400">
                  {ALLOCATION_METHOD_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Effective From</label>
                <input type="date" value={form.effectiveFrom} onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Max Allocations</label>
                <input type="number" value={form.maxAllocations} onChange={(e) => setForm({ ...form, maxAllocations: e.target.value })} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" placeholder="Leave empty for unlimited" />
              </div>
              <div className="flex items-end pb-1"><label className="flex items-center gap-2 text-sm text-thb-text-secondary cursor-pointer"><input type="checkbox" checked={form.hierarchyEnabled} onChange={(e) => setForm({ ...form, hierarchyEnabled: e.target.checked })} className="rounded border-thb-border" /><span className="font-medium">Hierarchy Enabled</span></label></div>
              <div className="flex items-end pb-1"><label className="flex items-center gap-2 text-sm text-thb-text-secondary cursor-pointer"><input type="checkbox" checked={form.isMandatory} onChange={(e) => setForm({ ...form, isMandatory: e.target.checked })} className="rounded border-thb-border" /><span className="font-medium">Mandatory</span></label></div>
              <div className="flex items-end pb-1"><label className="flex items-center gap-2 text-sm text-thb-text-secondary cursor-pointer"><input type="checkbox" checked={form.allowMultiple} onChange={(e) => setForm({ ...form, allowMultiple: e.target.checked })} className="rounded border-thb-border" /><span className="font-medium">Allow Multiple</span></label></div>
            </div>
            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-thb-border">
              <button onClick={() => { setShowForm(false); setEditingId(null); }} className="px-4 py-2.5 rounded-lg border border-thb-border text-sm font-medium text-thb-text-secondary hover:bg-slate-50 transition-colors">Cancel</button>
              <button onClick={handleSubmit} disabled={submitting} className="px-6 py-2.5 rounded-lg bg-green-500 text-white text-sm font-medium hover:bg-green-600 disabled:opacity-50 shadow-sm shadow-green-500/25 transition-colors">
                {submitting ? 'Saving...' : editingId ? 'Update Dimension' : 'Create Dimension'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="thb-card overflow-hidden"><div className="p-5 space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-12 bg-slate-100 rounded animate-pulse" />)}</div></div>
      ) : filteredDimensions.length === 0 ? (
        <div className="thb-card p-12 text-center">
          <FiGrid className="w-12 h-12 text-thb-text-muted mx-auto mb-3" />
          <p className="text-thb-text-secondary font-medium">No dimensions found</p>
          <p className="text-sm text-thb-text-muted mt-1">Create your first cost allocation dimension</p>
        </div>
      ) : (
        <div className="thb-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-thb-border">
                <tr>
                  {['Code', 'Name', 'Type', 'Method', 'Mandatory', 'Multiple', 'Allocations', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-thb-text-muted uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredDimensions.map(d => (
                  deleteConfirmId === d.id ? (
                    <tr key={d.id} className="bg-red-50">
                      <td colSpan={8} className="px-4 py-3">
                        <p className="text-sm text-red-700 font-medium mb-2">Delete &quot;{d.name}&quot; and all {d.allocations?.length || 0} allocations?</p>
                        <div className="flex items-center gap-2">
                          <button onClick={() => handleDelete(d.id)} disabled={deleting} className="px-3 py-1.5 bg-red-500 text-white text-xs font-medium rounded-lg hover:bg-red-600 disabled:opacity-50">{deleting ? 'Deleting...' : 'Confirm'}</button>
                          <button onClick={() => setDeleteConfirmId(null)} className="px-3 py-1.5 border border-thb-border text-xs font-medium rounded-lg hover:bg-slate-50">Cancel</button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <tr key={d.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3 text-sm font-medium text-thb-text-primary">{d.code}</td>
                      <td className="px-4 py-3 text-sm text-thb-text-secondary">{d.name}</td>
                      <td className="px-4 py-3"><span className={getDimTypeBadge(d.dimensionType)}>{formatStr(d.dimensionType)}</span></td>
                      <td className="px-4 py-3"><span className={getAllocMethodBadge(d.allocationMethod)}>{formatStr(d.allocationMethod)}</span></td>
                      <td className="px-4 py-3 text-sm">{d.isMandatory ? <span className="thb-badge thb-badge-success">Yes</span> : 'No'}</td>
                      <td className="px-4 py-3 text-sm">{d.allowMultiple ? <span className="thb-badge thb-badge-info">Yes</span> : 'No'}</td>
                      <td className="px-4 py-3 text-sm text-thb-text-secondary">{d.allocations?.length || 0}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => setViewingDimension(d)} className="p-1.5 rounded-lg text-thb-text-muted hover:text-green-500 hover:bg-green-50 transition-colors" title="View"><FiEye className="w-4 h-4" /></button>
                          {isAdmin && <button onClick={() => handleEdit(d)} className="p-1.5 rounded-lg text-thb-text-muted hover:text-amber-500 hover:bg-amber-50 transition-colors" title="Edit"><FiEdit2 className="w-4 h-4" /></button>}
                          {isAdmin && <button onClick={() => setDeleteConfirmId(d.id)} className="p-1.5 rounded-lg text-thb-text-muted hover:text-red-500 hover:bg-red-50 transition-colors" title="Delete"><FiTrash2 className="w-4 h-4" /></button>}
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
