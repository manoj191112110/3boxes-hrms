'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  FiPlus, FiX, FiTrash2, FiEye, FiEdit2,
  FiFileText, FiSearch, FiCheckCircle, FiClock, FiStar,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import { useCompanyContextStore } from '@/store/companyContextStore';

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

// --- Types ---
interface ComponentMapping {
  id?: string;
  componentName: string;
  componentCategory: string;
  allocationMethod: string;
  allocationValue: number;
  calculationSequence: number;
  isStatutory: boolean;
  isTaxable: boolean;
  frequency: string;
}

interface CTCTemplate {
  id: string;
  name: string;
  countryCode: string;
  currencyCode: string;
  ctcType: string;
  basePayPct: number | null;
  isDefault: boolean;
  status: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  version: number;
  companyId: string | null;
  componentMappings: ComponentMapping[];
  createdAt: string;
  updatedAt: string;
}

// --- Badge Helpers ---
function getStatusBadge(status: string) {
  const map: Record<string, string> = {
    ACTIVE: 'thb-badge thb-badge-success',
    DRAFT: 'thb-badge thb-badge-warning',
    INACTIVE: 'thb-badge thb-badge-error',
  };
  return map[status] || 'thb-badge thb-badge-info';
}

function getCategoryBadge(category: string) {
  const map: Record<string, string> = {
    EARNING: 'thb-badge thb-badge-success',
    DEDUCTION: 'thb-badge thb-badge-error',
    EMPLOYER_CONTRIBUTION: 'thb-badge thb-badge-info',
    REIMBURSEMENT: 'thb-badge thb-badge-warning',
    BENEFIT_IN_KIND: 'thb-badge thb-badge-purple',
  };
  return map[category] || 'thb-badge thb-badge-info';
}

// --- Constants ---
const COUNTRY_OPTIONS = [
  { value: 'IND', label: 'India (IND)' },
  { value: 'USA', label: 'United States (USA)' },
  { value: 'GBR', label: 'United Kingdom (GBR)' },
  { value: 'SGP', label: 'Singapore (SGP)' },
  { value: 'UAE', label: 'UAE (UAE)' },
  { value: 'AUS', label: 'Australia (AUS)' },
];

const CURRENCY_MAP: Record<string, string> = {
  IND: 'INR', USA: 'USD', GBR: 'GBP', SGP: 'SGD', UAE: 'AED', AUS: 'AUD',
};

const CURRENCY_OPTIONS = [
  { value: 'INR', label: 'INR (₹) — Indian Rupee' },
  { value: 'USD', label: 'USD ($) — US Dollar' },
  { value: 'GBP', label: 'GBP (£) — British Pound' },
  { value: 'SGD', label: 'SGD (S$) — Singapore Dollar' },
  { value: 'AED', label: 'AED (د.إ) — UAE Dirham' },
  { value: 'AUD', label: 'AUD (A$) — Australian Dollar' },
];

const CATEGORY_OPTIONS = [
  { value: 'EARNING', label: 'Earning' },
  { value: 'DEDUCTION', label: 'Deduction' },
  { value: 'EMPLOYER_CONTRIBUTION', label: 'Employer Contribution' },
  { value: 'REIMBURSEMENT', label: 'Reimbursement' },
  { value: 'BENEFIT_IN_KIND', label: 'Benefit in Kind' },
];

const ALLOCATION_OPTIONS = [
  { value: 'PERCENTAGE_OF_CTC', label: '% of CTC' },
  { value: 'FIXED_AMOUNT', label: 'Fixed Amount' },
  { value: 'PERCENTAGE_OF_COMPONENT', label: '% of Component' },
  { value: 'FORMULA', label: 'Formula' },
  { value: 'PRORATA', label: 'Pro-Rata' },
];

const FREQUENCY_OPTIONS = [
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'QUARTERLY', label: 'Quarterly' },
  { value: 'ANNUAL', label: 'Annual' },
  { value: 'ONCE', label: 'Once' },
  { value: 'VARIABLE', label: 'Variable' },
];

const emptyComponentMapping: ComponentMapping = {
  componentName: '',
  componentCategory: 'EARNING',
  allocationMethod: 'PERCENTAGE_OF_CTC',
  allocationValue: 0,
  calculationSequence: 1,
  isStatutory: false,
  isTaxable: true,
  frequency: 'MONTHLY',
};

const emptyForm = {
  name: '',
  countryCode: 'IND',
  currencyCode: 'INR',
  ctcType: 'ANNUAL',
  basePayPct: 40,
  isDefault: false,
  status: 'DRAFT',
  effectiveFrom: new Date().toISOString().split('T')[0],
  effectiveTo: '',
};

export default function CTCTemplatesPage() {
  const { user } = useAuthStore();
  const effectiveCompanyId = useCompanyContextStore(s => s.effectiveCompanyId);
  const isAdmin = user?.role === 'super_admin' || user?.role === 'tenant_admin' || user?.role === 'admin';

  const [templates, setTemplates] = useState<CTCTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [viewingTemplate, setViewingTemplate] = useState<CTCTemplate | null>(null);
  const [viewLoading, setViewLoading] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [countryFilter, setCountryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Form state
  const [form, setForm] = useState({ ...emptyForm });
  const [mappings, setMappings] = useState<ComponentMapping[]>([{ ...emptyComponentMapping }]);

  // --- Data Fetching ---
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (countryFilter) params.set('countryCode', countryFilter);
      if (statusFilter) params.set('status', statusFilter);
      const qs = params.toString();
      const url = `/api/payroll/ctc-templates${qs ? `?${qs}` : ''}`;
      const res = await fetch(url, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setTemplates(Array.isArray(data) ? data : data.data || []);
      }
    } catch {
      toast.error('Failed to load CTC templates');
    } finally {
      setLoading(false);
    }
  }, [countryFilter, statusFilter]);
  const cid = effectiveCompanyId();
  const scopeQuery = cid ? `companyId=${cid}&` : '';


  useEffect(() => { queueMicrotask(() => fetchData()); }, [fetchData]);

  // --- Computed Stats ---
  const totalTemplates = templates.length;
  const activeTemplates = templates.filter(t => t.status === 'ACTIVE').length;
  const draftTemplates = templates.filter(t => t.status === 'DRAFT').length;
  const defaultTemplates = templates.filter(t => t.isDefault).length;

  // --- Filtered List ---
  const filteredTemplates = templates.filter(t => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!t.name.toLowerCase().includes(q) && !t.countryCode.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  // --- Handlers ---
  const handleAddNew = () => {
    setForm({ ...emptyForm });
    setMappings([{ ...emptyComponentMapping }]);
    setEditingId(null);
    setShowForm(true);
    setViewingTemplate(null);
    setTimeout(() => document.getElementById('crud-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  const handleEdit = (t: CTCTemplate) => {
    setForm({
      name: t.name,
      countryCode: t.countryCode,
      currencyCode: t.currencyCode,
      ctcType: t.ctcType,
      basePayPct: t.basePayPct ?? 40,
      isDefault: t.isDefault,
      status: t.status,
      effectiveFrom: t.effectiveFrom ? new Date(t.effectiveFrom).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      effectiveTo: t.effectiveTo ? new Date(t.effectiveTo).toISOString().split('T')[0] : '',
    });
    setMappings(
      t.componentMappings && t.componentMappings.length > 0
        ? t.componentMappings.map(m => ({ ...m }))
        : [{ ...emptyComponentMapping }]
    );
    setEditingId(t.id);
    setShowForm(true);
    setViewingTemplate(null);
    setTimeout(() => document.getElementById('crud-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm({ ...emptyForm });
    setMappings([{ ...emptyComponentMapping }]);
  };

  const handleView = async (t: CTCTemplate) => {
    setViewLoading(true);
    setViewingTemplate(null);
    try {
      const res = await fetch(`/api/payroll/ctc-templates/${t.id}?${scopeQuery}` , { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setViewingTemplate(data.data || data);
      } else {
        setViewingTemplate(t);
      }
    } catch {
      setViewingTemplate(t);
    } finally {
      setViewLoading(false);
      setShowForm(false);
      setTimeout(() => document.getElementById('view-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    }
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) { toast.error('Template name is required'); return; }
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        basePayPct: form.basePayPct ? Number(form.basePayPct) : null,
        effectiveTo: form.effectiveTo || null,
        componentMappings: mappings.map((m, idx) => ({
          ...m,
          calculationSequence: m.calculationSequence || idx + 1,
          allocationValue: Number(m.allocationValue) || 0,
        })),
      };

      if (editingId) {
        const res = await fetch(`/api/payroll/ctc-templates/${editingId}?${scopeQuery}` , {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify(payload),
        });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed to update'); }
        toast.success('CTC template updated successfully');
      } else {
        const res = await fetch(`/api/payroll/ctc-templates?${scopeQuery}` , {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify(payload),
        });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed to create'); }
        toast.success('CTC template created successfully');
      }
      handleCancelForm();
      fetchData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/payroll/ctc-templates/${id}?${scopeQuery}` , { method: 'DELETE', headers: getAuthHeaders() });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed to delete'); }
      toast.success('CTC template deleted successfully');
      setDeleteConfirmId(null);
      if (viewingTemplate?.id === id) { setViewingTemplate(null); }
      fetchData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setDeleting(false);
    }
  };

  // --- Component Mapping Helpers ---
  const addMapping = () => {
    setMappings([...mappings, { ...emptyComponentMapping, calculationSequence: mappings.length + 1 }]);
  };

  const removeMapping = (index: number) => {
    setMappings(mappings.filter((_, i) => i !== index));
  };

  const updateMapping = (index: number, field: keyof ComponentMapping, value: string | number | boolean) => {
    const updated = [...mappings];
    updated[index] = { ...updated[index], [field]: value };
    setMappings(updated);
  };

  // --- Country Change → Auto-set Currency ---
  const handleCountryChange = (countryCode: string) => {
    setForm({
      ...form,
      countryCode,
      currencyCode: CURRENCY_MAP[countryCode] || form.currencyCode,
    });
  };

  // --- Format Helpers ---
  const formatAllocationValue = (method: string, value: number) => {
    if (method === 'PERCENTAGE_OF_CTC' || method === 'PERCENTAGE_OF_COMPONENT') return `${value}%`;
    if (method === 'FIXED_AMOUNT') return `${value.toLocaleString()}`;
    return `${value}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-thb-text-primary flex items-center gap-2">
            <FiFileText className="w-6 h-6 text-emerald-500" />
            CTC Templates
          </h1>
          <p className="text-thb-text-secondary mt-1">Configure CTC breakdown templates with component mappings</p>
        </div>
        {isAdmin && (
          <button
            onClick={handleAddNew}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-green-500 text-white rounded-lg hover:bg-green-600 font-medium text-sm shadow-sm shadow-green-500/25 transition-colors"
          >
            <FiPlus className="w-4 h-4" /> Add Template
          </button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="thb-card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
              <FiFileText className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <p className="text-xs font-medium text-thb-text-secondary">Total Templates</p>
              <p className="text-xl font-bold text-thb-text-primary">{totalTemplates}</p>
            </div>
          </div>
        </div>
        <div className="thb-card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
              <FiCheckCircle className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-xs font-medium text-thb-text-secondary">Active</p>
              <p className="text-xl font-bold text-thb-text-primary">{activeTemplates}</p>
            </div>
          </div>
        </div>
        <div className="thb-card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
              <FiClock className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <p className="text-xs font-medium text-thb-text-secondary">Draft</p>
              <p className="text-xl font-bold text-thb-text-primary">{draftTemplates}</p>
            </div>
          </div>
        </div>
        <div className="thb-card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center">
              <FiStar className="w-5 h-5 text-teal-500" />
            </div>
            <div>
              <p className="text-xs font-medium text-thb-text-secondary">Default</p>
              <p className="text-xl font-bold text-thb-text-primary">{defaultTemplates}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search / Filter Bar */}
      <div className="thb-card p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-thb-text-muted" />
            <input
              type="text"
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
            />
          </div>
          <select
            value={countryFilter}
            onChange={(e) => setCountryFilter(e.target.value)}
            className="px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 min-w-[160px]"
          >
            <option value="">All Countries</option>
            {COUNTRY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 min-w-[140px]"
          >
            <option value="">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </div>
      </div>

      {/* View Panel */}
      {viewingTemplate && (
        <div id="view-panel" className="thb-card border-l-4 border-l-emerald-500">
          <div className="p-6">
            {viewLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-500" />
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-lg font-semibold text-thb-text-primary">{viewingTemplate.name}</h2>
                    <p className="text-sm text-thb-text-secondary mt-0.5">
                      {viewingTemplate.countryCode} &middot; {viewingTemplate.currencyCode} &middot; {viewingTemplate.ctcType}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {isAdmin && (
                      <button
                        onClick={() => handleEdit(viewingTemplate)}
                        className="px-3 py-1.5 rounded-lg bg-green-500 text-white text-xs font-medium hover:bg-green-600 transition-colors flex items-center gap-1"
                      >
                        <FiEdit2 className="w-3.5 h-3.5" /> Edit
                      </button>
                    )}
                    <button
                      onClick={() => setViewingTemplate(null)}
                      className="p-2 rounded-lg text-thb-text-muted hover:text-thb-text-primary hover:bg-slate-100 transition-colors"
                    >
                      <FiX className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  <div>
                    <span className="text-xs font-medium text-thb-text-secondary">Country</span>
                    <p className="text-sm font-medium text-thb-text-primary mt-0.5">{viewingTemplate.countryCode}</p>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-thb-text-secondary">Currency</span>
                    <p className="text-sm font-medium text-thb-text-primary mt-0.5">{viewingTemplate.currencyCode}</p>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-thb-text-secondary">CTC Type</span>
                    <p className="text-sm font-medium text-thb-text-primary mt-0.5">{viewingTemplate.ctcType}</p>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-thb-text-secondary">Base Pay %</span>
                    <p className="text-sm font-medium text-thb-text-primary mt-0.5">{viewingTemplate.basePayPct ?? '—'}{viewingTemplate.basePayPct ? '%' : ''}</p>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-thb-text-secondary">Status</span>
                    <p className="mt-0.5"><span className={getStatusBadge(viewingTemplate.status)}>{viewingTemplate.status}</span></p>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-thb-text-secondary">Default</span>
                    <p className="mt-0.5">
                      <span className={viewingTemplate.isDefault ? 'thb-badge thb-badge-success' : 'thb-badge bg-slate-100 text-slate-600'}>
                        {viewingTemplate.isDefault ? 'Yes' : 'No'}
                      </span>
                    </p>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-thb-text-secondary">Effective From</span>
                    <p className="text-sm font-medium text-thb-text-primary mt-0.5">
                      {viewingTemplate.effectiveFrom ? new Date(viewingTemplate.effectiveFrom).toLocaleDateString() : '—'}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-thb-text-secondary">Effective To</span>
                    <p className="text-sm font-medium text-thb-text-primary mt-0.5">
                      {viewingTemplate.effectiveTo ? new Date(viewingTemplate.effectiveTo).toLocaleDateString() : '—'}
                    </p>
                  </div>
                </div>

                {/* Component Mappings Mini-Table */}
                <div>
                  <h3 className="text-sm font-semibold text-thb-text-primary mb-3">
                    Component Mappings ({(viewingTemplate.componentMappings || []).length})
                  </h3>
                  {(viewingTemplate.componentMappings || []).length === 0 ? (
                    <p className="text-sm text-thb-text-secondary text-center py-6">No component mappings defined</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-thb-border bg-slate-50/50">
                            <th className="text-left px-3 py-2 text-xs font-semibold text-thb-text-secondary uppercase">#</th>
                            <th className="text-left px-3 py-2 text-xs font-semibold text-thb-text-secondary uppercase">Component</th>
                            <th className="text-left px-3 py-2 text-xs font-semibold text-thb-text-secondary uppercase">Category</th>
                            <th className="text-left px-3 py-2 text-xs font-semibold text-thb-text-secondary uppercase">Method</th>
                            <th className="text-left px-3 py-2 text-xs font-semibold text-thb-text-secondary uppercase">Value</th>
                            <th className="text-left px-3 py-2 text-xs font-semibold text-thb-text-secondary uppercase">Freq</th>
                            <th className="text-left px-3 py-2 text-xs font-semibold text-thb-text-secondary uppercase">Statutory</th>
                            <th className="text-left px-3 py-2 text-xs font-semibold text-thb-text-secondary uppercase">Taxable</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-thb-border/50">
                          {(viewingTemplate.componentMappings || []).map((c, i) => (
                            <tr key={c.id || i} className="hover:bg-slate-50/50 transition-colors">
                              <td className="px-3 py-2 text-sm text-thb-text-secondary">{c.calculationSequence || i + 1}</td>
                              <td className="px-3 py-2 text-sm font-medium text-thb-text-primary">{c.componentName}</td>
                              <td className="px-3 py-2"><span className={getCategoryBadge(c.componentCategory)}>{c.componentCategory.replace(/_/g, ' ')}</span></td>
                              <td className="px-3 py-2 text-sm text-thb-text-secondary">{c.allocationMethod.replace(/_/g, ' ')}</td>
                              <td className="px-3 py-2 text-sm font-medium text-thb-text-primary">{formatAllocationValue(c.allocationMethod, c.allocationValue)}</td>
                              <td className="px-3 py-2 text-sm text-thb-text-secondary">{c.frequency}</td>
                              <td className="px-3 py-2 text-sm text-thb-text-secondary">{c.isStatutory ? 'Yes' : 'No'}</td>
                              <td className="px-3 py-2 text-sm text-thb-text-secondary">{c.isTaxable ? 'Yes' : 'No'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Embedded Inline Form */}
      {showForm && (
        <div id="crud-form" className="thb-card border-l-4 border-l-green-500">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-thb-text-primary">
                {editingId ? 'Edit CTC Template' : 'Create CTC Template'}
              </h2>
              <button
                onClick={handleCancelForm}
                className="p-2 rounded-lg text-thb-text-muted hover:text-thb-text-primary hover:bg-slate-100 transition-colors"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>

            {/* Template Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Template Name *</label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                  placeholder="e.g. India Standard CTC"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Country Code</label>
                <select
                  value={form.countryCode}
                  onChange={(e) => handleCountryChange(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                >
                  {COUNTRY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Currency Code</label>
                <select
                  value={form.currencyCode}
                  onChange={(e) => setForm({ ...form, currencyCode: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                >
                  {CURRENCY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">CTC Type</label>
                <select
                  value={form.ctcType}
                  onChange={(e) => setForm({ ...form, ctcType: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                >
                  <option value="ANNUAL">Annual</option>
                  <option value="MONTHLY">Monthly</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Base Pay % of CTC</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  value={form.basePayPct}
                  onChange={(e) => setForm({ ...form, basePayPct: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                  placeholder="e.g. 40"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Status</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                >
                  <option value="DRAFT">Draft</option>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Effective From</label>
                <input
                  type="date"
                  value={form.effectiveFrom}
                  onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Effective To</label>
                <input
                  type="date"
                  value={form.effectiveTo}
                  onChange={(e) => setForm({ ...form, effectiveTo: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                />
              </div>
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-2 text-sm text-thb-text-secondary cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isDefault}
                    onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
                    className="rounded border-thb-border"
                  />
                  <span className="font-medium">Set as Default Template</span>
                </label>
              </div>
            </div>

            {/* Component Mappings Sub-section */}
            <div className="mt-6 pt-4 border-t border-thb-border">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-thb-text-primary">Component Mappings</h3>
                <button
                  type="button"
                  onClick={addMapping}
                  className="text-xs font-medium text-green-500 hover:text-green-600 flex items-center gap-1"
                >
                  <FiPlus className="w-3.5 h-3.5" /> Add Component
                </button>
              </div>
              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {mappings.map((comp, idx) => (
                  <div key={idx} className="p-3 border border-thb-border rounded-lg bg-slate-50/50 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-1">
                        <span className="text-xs font-semibold text-thb-text-muted w-6">{idx + 1}.</span>
                        <input
                          value={comp.componentName}
                          onChange={(e) => updateMapping(idx, 'componentName', e.target.value)}
                          placeholder="Component name"
                          className="flex-1 px-2 py-1.5 border border-thb-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-green-500/20 bg-white"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeMapping(idx)}
                        className="ml-2 p-1 text-red-400 hover:text-red-600 transition-colors"
                        title="Remove"
                      >
                        <FiX className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <select
                        value={comp.componentCategory}
                        onChange={(e) => updateMapping(idx, 'componentCategory', e.target.value)}
                        className="px-2 py-1.5 border border-thb-border rounded text-xs focus:outline-none bg-white"
                      >
                        {CATEGORY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                      <select
                        value={comp.allocationMethod}
                        onChange={(e) => updateMapping(idx, 'allocationMethod', e.target.value)}
                        className="px-2 py-1.5 border border-thb-border rounded text-xs focus:outline-none bg-white"
                      >
                        {ALLOCATION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                      <input
                        type="number"
                        value={comp.allocationValue}
                        onChange={(e) => updateMapping(idx, 'allocationValue', parseFloat(e.target.value) || 0)}
                        placeholder="Value"
                        className="px-2 py-1.5 border border-thb-border rounded text-xs focus:outline-none bg-white"
                      />
                      <select
                        value={comp.frequency}
                        onChange={(e) => updateMapping(idx, 'frequency', e.target.value)}
                        className="px-2 py-1.5 border border-thb-border rounded text-xs focus:outline-none bg-white"
                      >
                        {FREQUENCY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </div>
                    <div className="flex items-center gap-4 flex-wrap">
                      <div className="flex items-center gap-1">
                        <label className="text-xs text-thb-text-secondary">Seq:</label>
                        <input
                          type="number"
                          min={1}
                          value={comp.calculationSequence}
                          onChange={(e) => updateMapping(idx, 'calculationSequence', parseInt(e.target.value) || 1)}
                          className="w-14 px-2 py-1 border border-thb-border rounded text-xs focus:outline-none bg-white"
                        />
                      </div>
                      <label className="flex items-center gap-1.5 text-xs text-thb-text-secondary cursor-pointer">
                        <input
                          type="checkbox"
                          checked={comp.isStatutory}
                          onChange={(e) => updateMapping(idx, 'isStatutory', e.target.checked)}
                          className="rounded"
                        />
                        Statutory
                      </label>
                      <label className="flex items-center gap-1.5 text-xs text-thb-text-secondary cursor-pointer">
                        <input
                          type="checkbox"
                          checked={comp.isTaxable}
                          onChange={(e) => updateMapping(idx, 'isTaxable', e.target.checked)}
                          className="rounded"
                        />
                        Taxable
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Form Actions */}
            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-thb-border">
              <button
                onClick={handleCancelForm}
                className="px-4 py-2.5 rounded-lg border border-thb-border text-sm font-medium text-thb-text-secondary hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="px-6 py-2.5 rounded-lg bg-green-500 text-white text-sm font-medium hover:bg-green-600 disabled:opacity-50 shadow-sm shadow-green-500/25 transition-colors"
              >
                {submitting ? 'Saving...' : editingId ? 'Update Template' : 'Create Template'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Data Table */}
      {loading ? (
        <div className="thb-card overflow-hidden">
          <div className="p-5 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-12 bg-slate-100 rounded animate-pulse" />
            ))}
          </div>
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="thb-card p-12 text-center">
          <FiFileText className="w-12 h-12 text-thb-text-muted mx-auto mb-3" />
          <p className="text-thb-text-secondary font-medium">No CTC templates found</p>
          <p className="text-sm text-thb-text-muted mt-1">Create your first CTC template to get started</p>
        </div>
      ) : (
        <div className="thb-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-thb-border">
                <tr>
                  {['Name', 'Country', 'Currency', 'CTC Type', 'Base Pay %', 'Status', 'Default', 'Actions'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-thb-text-muted uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTemplates.map((t) => (
                  deleteConfirmId === t.id ? (
                    <tr key={t.id} className="bg-red-50">
                      <td colSpan={8} className="px-4 py-3">
                        <p className="text-sm text-red-700 font-medium mb-2">
                          Are you sure you want to delete &quot;{t.name}&quot;?
                        </p>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleDelete(t.id)}
                            disabled={deleting}
                            className="px-3 py-1.5 bg-red-500 text-white text-xs font-medium rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors"
                          >
                            {deleting ? 'Deleting...' : 'Confirm'}
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(null)}
                            className="px-3 py-1.5 border border-thb-border text-xs font-medium rounded-lg hover:bg-slate-50 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-xs font-bold">
                            {t.name[0]}
                          </div>
                          <span className="text-sm font-medium text-thb-text-primary">{t.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-thb-text-secondary">{t.countryCode}</td>
                      <td className="px-4 py-3 text-sm text-thb-text-secondary">{t.currencyCode}</td>
                      <td className="px-4 py-3 text-sm text-thb-text-secondary">{t.ctcType}</td>
                      <td className="px-4 py-3 text-sm font-medium text-thb-text-primary">
                        {t.basePayPct != null ? `${t.basePayPct}%` : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={getStatusBadge(t.status)}>{t.status}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={t.isDefault ? 'thb-badge thb-badge-success' : 'thb-badge bg-slate-100 text-slate-600'}>
                          {t.isDefault ? 'Default' : 'No'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleView(t)}
                            className="p-1.5 rounded-lg text-thb-text-muted hover:text-emerald-500 hover:bg-emerald-50 transition-colors"
                            title="View"
                          >
                            <FiEye className="w-3.5 h-3.5" />
                          </button>
                          {isAdmin && (
                            <>
                              <button
                                onClick={() => handleEdit(t)}
                                className="p-1.5 rounded-lg text-thb-text-muted hover:text-green-500 hover:bg-green-50 transition-colors"
                                title="Edit"
                              >
                                <FiEdit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setDeleteConfirmId(t.id)}
                                className="p-1.5 rounded-lg text-thb-text-muted hover:text-red-500 hover:bg-red-50 transition-colors"
                                title="Delete"
                              >
                                <FiTrash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
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
