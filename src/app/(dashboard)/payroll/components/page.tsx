'use client';

import { useAuthStore } from '@/store/authStore';
import { useCallback, useEffect, useState } from 'react';
import { FiDatabase, FiPlus, FiEdit2, FiTrash2, FiEye, FiX, FiSearch, FiRefreshCw } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useCompanyContextStore } from '@/store/companyContextStore';

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

// --- Types ---
interface PayrollComponent {
  id: string;
  code: string;
  name: string;
  componentType: string;
  componentCategory: string;
  countryCode: string;
  calculationType: string;
  defaultValue: number | null;
  percentageBase: string | null;
  isTaxable: boolean;
  taxTreatment: string | null;
  exemptionSection: string | null;
  maxExemptionAmt: number | null;
  affectsGross: boolean;
  affectsNet: boolean;
  affectsCTC: boolean;
  paymentFrequency: string;
  prorationApplicable: boolean;
  roundingRule: string | null;
  isActive: boolean;
  effectiveFrom: string;
  effectiveTo: string | null;
  companyId: string | null;
  createdAt: string;
  updatedAt: string;
}

// --- Badge Helpers ---
function getTypeBadge(type: string) {
  const map: Record<string, string> = {
    EARNING: 'thb-badge thb-badge-success',
    DEDUCTION: 'thb-badge thb-badge-error',
    EMPLOYER_CONTRIB: 'thb-badge thb-badge-info',
    EMPLOYEE_CONTRIB: 'thb-badge thb-badge-info',
    REIMBURSEMENT: 'thb-badge thb-badge-warning',
    BENEFIT_IN_KIND: 'thb-badge thb-badge-purple',
    INFORMATIONAL: 'thb-badge thb-badge-info',
  };
  return map[type] || 'thb-badge thb-badge-info';
}

function getCategoryBadge(category: string) {
  const map: Record<string, string> = {
    NORMAL: 'thb-badge thb-badge-info',
    STATUTORY: 'thb-badge thb-badge-warning',
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

const COMPONENT_TYPE_OPTIONS = [
  { value: 'EARNING', label: 'Earning' },
  { value: 'DEDUCTION', label: 'Deduction' },
  { value: 'EMPLOYER_CONTRIB', label: 'Employer Contribution' },
  { value: 'EMPLOYEE_CONTRIB', label: 'Employee Contribution' },
  { value: 'REIMBURSEMENT', label: 'Reimbursement' },
  { value: 'BENEFIT_IN_KIND', label: 'Benefit in Kind' },
  { value: 'INFORMATIONAL', label: 'Informational' },
];

const COMPONENT_CATEGORY_OPTIONS = [
  { value: 'NORMAL', label: 'Normal' },
  { value: 'STATUTORY', label: 'Statutory' },
];

const CALCULATION_TYPE_OPTIONS = [
  { value: 'FLAT_AMOUNT', label: 'Flat Amount' },
  { value: 'PERCENTAGE', label: 'Percentage' },
  { value: 'SLAB_BASED', label: 'Slab Based' },
  { value: 'FORMULA', label: 'Formula' },
  { value: 'LOOKUP_TABLE', label: 'Lookup Table' },
  { value: 'MANUAL_ENTRY', label: 'Manual Entry' },
];

const TAX_TREATMENT_OPTIONS = [
  { value: 'FULLY_TAXABLE', label: 'Fully Taxable' },
  { value: 'PARTIALLY_TAXABLE', label: 'Partially Taxable' },
  { value: 'EXEMPT', label: 'Exempt' },
  { value: 'DEFERRED', label: 'Deferred' },
];

const PAYMENT_FREQUENCY_OPTIONS = [
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'QUARTERLY', label: 'Quarterly' },
  { value: 'SEMI_ANNUAL', label: 'Semi-Annual' },
  { value: 'ANNUAL', label: 'Annual' },
  { value: 'ONE_TIME', label: 'One Time' },
  { value: 'VARIABLE', label: 'Variable' },
];

const ROUNDING_RULE_OPTIONS = [
  { value: 'NEAREST', label: 'Nearest' },
  { value: 'CEILING', label: 'Ceiling' },
  { value: 'FLOOR', label: 'Floor' },
  { value: 'NEAREST_10', label: 'Nearest 10' },
  { value: 'NEAREST_100', label: 'Nearest 100' },
  { value: 'BANKERS_ROUNDING', label: 'Bankers Rounding' },
];

// --- View Panel Detail Item ---
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
  componentType: 'EARNING',
  componentCategory: 'NORMAL',
  countryCode: 'IND',
  calculationType: 'FLAT_AMOUNT',
  defaultValue: '' as string,
  percentageBase: '',
  isTaxable: true,
  taxTreatment: 'FULLY_TAXABLE',
  exemptionSection: '',
  maxExemptionAmt: '' as string,
  affectsGross: true,
  affectsNet: true,
  affectsCTC: true,
  paymentFrequency: 'MONTHLY',
  prorationApplicable: true,
  roundingRule: 'NEAREST',
  isActive: true,
};

export default function PayrollComponentsPage() {
  const { user } = useAuthStore();
  const effectiveCompanyId = useCompanyContextStore(s => s.effectiveCompanyId);
  const isAdmin = user?.role === 'super_admin' || user?.role === 'tenant_admin' || user?.role === 'admin';

  const [components, setComponents] = useState<PayrollComponent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [viewingComponent, setViewingComponent] = useState<PayrollComponent | null>(null);
  const [viewLoading, setViewLoading] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [countryFilter, setCountryFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [activeFilter, setActiveFilter] = useState('');

  // Form state
  const [form, setForm] = useState({ ...emptyForm });

  // --- Data Fetching ---
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (countryFilter) params.set('countryCode', countryFilter);
      if (typeFilter) params.set('componentType', typeFilter);
      if (categoryFilter) params.set('componentCategory', categoryFilter);
      if (activeFilter) params.set('isActive', activeFilter);
      const qs = params.toString();
      const url = `/api/payroll/components${qs ? `?${qs}` : ''}`;
      const res = await fetch(url, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setComponents(Array.isArray(data) ? data : data.data || []);
      }
    } catch {
      toast.error('Failed to load payroll components');
    } finally {
      setLoading(false);
    }
  }, [countryFilter, typeFilter, categoryFilter, activeFilter]);
  const cid = effectiveCompanyId();
  const scopeQuery = cid ? `companyId=${cid}&` : '';


  useEffect(() => { queueMicrotask(() => fetchData()); }, [fetchData]);

  // --- Computed Stats ---
  const totalComponents = components.length;
  const earningsCount = components.filter(c => c.componentType === 'EARNING').length;
  const deductionsCount = components.filter(c => c.componentType === 'DEDUCTION').length;
  const statutoryCount = components.filter(c => c.componentCategory === 'STATUTORY').length;

  // --- Filtered List ---
  const filteredComponents = components.filter(c => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!c.name.toLowerCase().includes(q) && !c.code.toLowerCase().includes(q) && !c.countryCode.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  // --- Handlers ---
  const handleAddNew = () => {
    setForm({ ...emptyForm });
    setEditingId(null);
    setShowForm(true);
    setViewingComponent(null);
    setTimeout(() => document.getElementById('crud-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  const handleEdit = (c: PayrollComponent) => {
    setForm({
      code: c.code,
      name: c.name,
      componentType: c.componentType,
      componentCategory: c.componentCategory,
      countryCode: c.countryCode,
      calculationType: c.calculationType,
      defaultValue: c.defaultValue != null ? String(c.defaultValue) : '',
      percentageBase: c.percentageBase || '',
      isTaxable: c.isTaxable,
      taxTreatment: c.taxTreatment || 'FULLY_TAXABLE',
      exemptionSection: c.exemptionSection || '',
      maxExemptionAmt: c.maxExemptionAmt != null ? String(c.maxExemptionAmt) : '',
      affectsGross: c.affectsGross,
      affectsNet: c.affectsNet,
      affectsCTC: c.affectsCTC,
      paymentFrequency: c.paymentFrequency,
      prorationApplicable: c.prorationApplicable,
      roundingRule: c.roundingRule || 'NEAREST',
      isActive: c.isActive,
    });
    setEditingId(c.id);
    setShowForm(true);
    setViewingComponent(null);
    setTimeout(() => document.getElementById('crud-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm({ ...emptyForm });
  };

  const handleView = async (c: PayrollComponent) => {
    setViewLoading(true);
    setViewingComponent(null);
    try {
      const res = await fetch(`/api/payroll/components/${c.id}?${scopeQuery}` , { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setViewingComponent(data.data || data);
      } else {
        setViewingComponent(c);
      }
    } catch {
      setViewingComponent(c);
    } finally {
      setViewLoading(false);
      setShowForm(false);
      setTimeout(() => document.getElementById('view-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    }
  };

  const handleSubmit = async () => {
    if (!form.code.trim()) { toast.error('Component code is required'); return; }
    if (!form.name.trim()) { toast.error('Component name is required'); return; }

    setSubmitting(true);
    try {
      const payload = {
        ...form,
        code: form.code.toUpperCase().replace(/\s+/g, '_'),
        defaultValue: form.defaultValue ? parseFloat(form.defaultValue) : null,
        maxExemptionAmt: form.maxExemptionAmt ? parseFloat(form.maxExemptionAmt) : null,
        percentageBase: form.percentageBase || null,
        taxTreatment: form.taxTreatment || null,
        exemptionSection: form.exemptionSection || null,
        roundingRule: form.roundingRule || null,
      };

      if (editingId) {
        const res = await fetch(`/api/payroll/components/${editingId}?${scopeQuery}` , {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify(payload),
        });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed to update'); }
        toast.success('Component updated successfully');
      } else {
        const res = await fetch(`/api/payroll/components?${scopeQuery}` , {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify(payload),
        });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed to create'); }
        toast.success('Component created successfully');
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
      const res = await fetch(`/api/payroll/components/${id}?${scopeQuery}` , { method: 'DELETE', headers: getAuthHeaders() });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed to delete'); }
      toast.success('Component deactivated successfully');
      setDeleteConfirmId(null);
      if (viewingComponent?.id === id) { setViewingComponent(null); }
      fetchData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setDeleting(false);
    }
  };

  // --- Format Helpers ---
  const formatCalcType = (t: string) => t.replace(/_/g, ' ');
  const formatComponentType = (t: string) => t.replace(/_/g, ' ');
  const formatFrequency = (f: string) => f.replace(/_/g, ' ');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-thb-text-primary flex items-center gap-2">
            <FiDatabase className="w-6 h-6 text-green-500" />
            Component Master
          </h1>
          <p className="text-thb-text-secondary mt-1">Define and manage payroll components across countries</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchData()}
            className="p-2.5 rounded-lg border border-thb-border text-thb-text-secondary hover:bg-slate-50 transition-colors"
            title="Refresh"
          >
            <FiRefreshCw className="w-4 h-4" />
          </button>
          {isAdmin && (
            <button
              onClick={handleAddNew}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-green-500 text-white rounded-lg hover:bg-green-600 font-medium text-sm shadow-sm shadow-green-500/25 transition-colors"
            >
              <FiPlus className="w-4 h-4" /> Add Component
            </button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="thb-card thb-card-hover p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
              <FiDatabase className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <p className="text-xs font-medium text-thb-text-secondary">Total Components</p>
              <p className="text-xl font-bold text-thb-text-primary">{totalComponents}</p>
            </div>
          </div>
        </div>
        <div className="thb-card thb-card-hover p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
              <FiPlus className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-xs font-medium text-thb-text-secondary">Earnings</p>
              <p className="text-xl font-bold text-thb-text-primary">{earningsCount}</p>
            </div>
          </div>
        </div>
        <div className="thb-card thb-card-hover p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center">
              <FiTrash2 className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <p className="text-xs font-medium text-thb-text-secondary">Deductions</p>
              <p className="text-xl font-bold text-thb-text-primary">{deductionsCount}</p>
            </div>
          </div>
        </div>
        <div className="thb-card thb-card-hover p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
              <FiDatabase className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <p className="text-xs font-medium text-thb-text-secondary">Statutory</p>
              <p className="text-xl font-bold text-thb-text-primary">{statutoryCount}</p>
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
              placeholder="Search by code, name, or country..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
            />
          </div>
          <select
            value={countryFilter}
            onChange={(e) => setCountryFilter(e.target.value)}
            className="px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 min-w-[150px]"
          >
            <option value="">All Countries</option>
            {COUNTRY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 min-w-[150px]"
          >
            <option value="">All Types</option>
            <option value="EARNING">Earning</option>
            <option value="DEDUCTION">Deduction</option>
          </select>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 min-w-[140px]"
          >
            <option value="">All Categories</option>
            <option value="NORMAL">Normal</option>
            <option value="STATUTORY">Statutory</option>
          </select>
          <select
            value={activeFilter}
            onChange={(e) => setActiveFilter(e.target.value)}
            className="px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 min-w-[130px]"
          >
            <option value="">All Status</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </div>
      </div>

      {/* View Panel */}
      {viewingComponent && (
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
                    <h2 className="text-lg font-semibold text-thb-text-primary">{viewingComponent.name}</h2>
                    <p className="text-sm text-thb-text-secondary mt-0.5">
                      {viewingComponent.code} &middot; {viewingComponent.countryCode}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {isAdmin && (
                      <button
                        onClick={() => handleEdit(viewingComponent)}
                        className="px-3 py-1.5 rounded-lg bg-green-500 text-white text-xs font-medium hover:bg-green-600 transition-colors flex items-center gap-1"
                      >
                        <FiEdit2 className="w-3.5 h-3.5" /> Edit
                      </button>
                    )}
                    <button
                      onClick={() => setViewingComponent(null)}
                      className="p-2 rounded-lg text-thb-text-muted hover:text-thb-text-primary hover:bg-slate-100 transition-colors"
                    >
                      <FiX className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <DetailItem label="Code" value={viewingComponent.code} />
                  <DetailItem label="Name" value={viewingComponent.name} />
                  <DetailItem label="Component Type" value={formatComponentType(viewingComponent.componentType)} badge={getTypeBadge(viewingComponent.componentType)} />
                  <DetailItem label="Category" value={viewingComponent.componentCategory} badge={getCategoryBadge(viewingComponent.componentCategory)} />
                  <DetailItem label="Country" value={viewingComponent.countryCode} />
                  <DetailItem label="Calculation Type" value={formatCalcType(viewingComponent.calculationType)} />
                  <DetailItem label="Default Value" value={viewingComponent.defaultValue} />
                  <DetailItem label="Percentage Base" value={viewingComponent.percentageBase} />
                  <DetailItem label="Taxable" value={viewingComponent.isTaxable} />
                  <DetailItem label="Tax Treatment" value={viewingComponent.taxTreatment ? formatCalcType(viewingComponent.taxTreatment) : null} />
                  <DetailItem label="Exemption Section" value={viewingComponent.exemptionSection} />
                  <DetailItem label="Max Exemption Amt" value={viewingComponent.maxExemptionAmt} />
                  <DetailItem label="Affects Gross" value={viewingComponent.affectsGross} />
                  <DetailItem label="Affects Net" value={viewingComponent.affectsNet} />
                  <DetailItem label="Affects CTC" value={viewingComponent.affectsCTC} />
                  <DetailItem label="Payment Frequency" value={formatFrequency(viewingComponent.paymentFrequency)} />
                  <DetailItem label="Proration Applicable" value={viewingComponent.prorationApplicable} />
                  <DetailItem label="Rounding Rule" value={viewingComponent.roundingRule ? formatCalcType(viewingComponent.roundingRule) : null} />
                  <DetailItem label="Active" value={viewingComponent.isActive} badge={viewingComponent.isActive ? 'thb-badge thb-badge-success' : 'thb-badge thb-badge-error'} />
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
                {editingId ? 'Edit Component' : 'Create Component'}
              </h2>
              <button
                onClick={handleCancelForm}
                className="p-2 rounded-lg text-thb-text-muted hover:text-thb-text-primary hover:bg-slate-100 transition-colors"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>

            {/* Basic Information */}
            <div className="mb-5">
              <h3 className="text-sm font-semibold text-thb-text-primary mb-3">Basic Information</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Code <span className="text-red-500 font-bold">*</span></label>
                  <input
                    required
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase().replace(/\s+/g, '_') })}
                    className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                    placeholder="e.g. BASIC, HRA, EPF_EE"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Name <span className="text-red-500 font-bold">*</span></label>
                  <input
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                    placeholder="e.g. Basic Salary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Component Type</label>
                  <select
                    value={form.componentType}
                    onChange={(e) => setForm({ ...form, componentType: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                  >
                    {COMPONENT_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Category</label>
                  <select
                    value={form.componentCategory}
                    onChange={(e) => setForm({ ...form, componentCategory: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                  >
                    {COMPONENT_CATEGORY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Country</label>
                  <select
                    value={form.countryCode}
                    onChange={(e) => setForm({ ...form, countryCode: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                  >
                    {COUNTRY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Calculation Type</label>
                  <select
                    value={form.calculationType}
                    onChange={(e) => setForm({ ...form, calculationType: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                  >
                    {CALCULATION_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Calculation & Value */}
            <div className="mb-5">
              <h3 className="text-sm font-semibold text-thb-text-primary mb-3">Calculation & Value</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Default Value</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.defaultValue}
                    onChange={(e) => setForm({ ...form, defaultValue: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                    placeholder="e.g. 50000 or 12"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Percentage Base</label>
                  <input
                    value={form.percentageBase}
                    onChange={(e) => setForm({ ...form, percentageBase: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                    placeholder="e.g. BASIC (component code)"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Rounding Rule</label>
                  <select
                    value={form.roundingRule}
                    onChange={(e) => setForm({ ...form, roundingRule: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                  >
                    {ROUNDING_RULE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Tax Configuration */}
            <div className="mb-5">
              <h3 className="text-sm font-semibold text-thb-text-primary mb-3">Tax Configuration</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 text-sm text-thb-text-secondary cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.isTaxable}
                      onChange={(e) => setForm({ ...form, isTaxable: e.target.checked })}
                      className="rounded border-thb-border"
                    />
                    <span className="font-medium">Taxable</span>
                  </label>
                </div>
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Tax Treatment</label>
                  <select
                    value={form.taxTreatment}
                    onChange={(e) => setForm({ ...form, taxTreatment: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                  >
                    {TAX_TREATMENT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Exemption Section</label>
                  <input
                    value={form.exemptionSection}
                    onChange={(e) => setForm({ ...form, exemptionSection: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                    placeholder='e.g. "80C", "80D"'
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Max Exemption Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.maxExemptionAmt}
                    onChange={(e) => setForm({ ...form, maxExemptionAmt: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                    placeholder="e.g. 150000"
                  />
                </div>
              </div>
            </div>

            {/* Payroll Impact & Frequency */}
            <div className="mb-5">
              <h3 className="text-sm font-semibold text-thb-text-primary mb-3">Payroll Impact & Frequency</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Payment Frequency</label>
                  <select
                    value={form.paymentFrequency}
                    onChange={(e) => setForm({ ...form, paymentFrequency: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                  >
                    {PAYMENT_FREQUENCY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div className="flex items-end pb-1 gap-5">
                  <label className="flex items-center gap-2 text-sm text-thb-text-secondary cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.affectsGross}
                      onChange={(e) => setForm({ ...form, affectsGross: e.target.checked })}
                      className="rounded border-thb-border"
                    />
                    <span className="font-medium">Affects Gross</span>
                  </label>
                </div>
                <div className="flex items-end pb-1 gap-5">
                  <label className="flex items-center gap-2 text-sm text-thb-text-secondary cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.affectsNet}
                      onChange={(e) => setForm({ ...form, affectsNet: e.target.checked })}
                      className="rounded border-thb-border"
                    />
                    <span className="font-medium">Affects Net</span>
                  </label>
                </div>
                <div className="flex items-end pb-1 gap-5">
                  <label className="flex items-center gap-2 text-sm text-thb-text-secondary cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.affectsCTC}
                      onChange={(e) => setForm({ ...form, affectsCTC: e.target.checked })}
                      className="rounded border-thb-border"
                    />
                    <span className="font-medium">Affects CTC</span>
                  </label>
                </div>
                <div className="flex items-end pb-1 gap-5">
                  <label className="flex items-center gap-2 text-sm text-thb-text-secondary cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.prorationApplicable}
                      onChange={(e) => setForm({ ...form, prorationApplicable: e.target.checked })}
                      className="rounded border-thb-border"
                    />
                    <span className="font-medium">Proration Applicable</span>
                  </label>
                </div>
                <div className="flex items-end pb-1 gap-5">
                  <label className="flex items-center gap-2 text-sm text-thb-text-secondary cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.isActive}
                      onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                      className="rounded border-thb-border"
                    />
                    <span className="font-medium">Active</span>
                  </label>
                </div>
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
                {submitting ? 'Saving...' : editingId ? 'Update Component' : 'Create Component'}
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
      ) : filteredComponents.length === 0 ? (
        <div className="thb-card p-12 text-center">
          <FiDatabase className="w-12 h-12 text-thb-text-muted mx-auto mb-3" />
          <p className="text-thb-text-secondary font-medium">No payroll components found</p>
          <p className="text-sm text-thb-text-muted mt-1">Create your first payroll component to get started</p>
        </div>
      ) : (
        <div className="thb-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-thb-border">
                <tr>
                  {['Code', 'Name', 'Type', 'Category', 'Country', 'Calculation', 'Taxable', 'Active', 'Actions'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-thb-text-muted uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredComponents.map((c) => (
                  deleteConfirmId === c.id ? (
                    <tr key={c.id} className="bg-red-50">
                      <td colSpan={9} className="px-4 py-3">
                        <p className="text-sm text-red-700 font-medium mb-2">
                          Are you sure you want to deactivate &quot;{c.name}&quot;?
                        </p>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleDelete(c.id)}
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
                    <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-sm font-mono font-semibold text-thb-text-primary">{c.code}</td>
                      <td className="px-4 py-3 text-sm font-medium text-thb-text-primary">{c.name}</td>
                      <td className="px-4 py-3">
                        <span className={getTypeBadge(c.componentType)}>{formatComponentType(c.componentType)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={getCategoryBadge(c.componentCategory)}>{c.componentCategory}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-thb-text-secondary">{c.countryCode}</td>
                      <td className="px-4 py-3 text-sm text-thb-text-secondary">{formatCalcType(c.calculationType)}</td>
                      <td className="px-4 py-3">
                        <span className={c.isTaxable ? 'thb-badge thb-badge-success' : 'thb-badge thb-badge-error'}>
                          {c.isTaxable ? 'Yes' : 'No'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={c.isActive ? 'thb-badge thb-badge-success' : 'thb-badge thb-badge-error'}>
                          {c.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleView(c)}
                            className="p-1.5 rounded-lg text-thb-text-muted hover:text-green-500 hover:bg-green-50 transition-colors"
                            title="View"
                          >
                            <FiEye className="w-4 h-4" />
                          </button>
                          {isAdmin && (
                            <>
                              <button
                                onClick={() => handleEdit(c)}
                                className="p-1.5 rounded-lg text-thb-text-muted hover:text-green-500 hover:bg-green-50 transition-colors"
                                title="Edit"
                              >
                                <FiEdit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setDeleteConfirmId(c.id)}
                                className="p-1.5 rounded-lg text-thb-text-muted hover:text-red-500 hover:bg-red-50 transition-colors"
                                title="Deactivate"
                              >
                                <FiTrash2 className="w-4 h-4" />
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
