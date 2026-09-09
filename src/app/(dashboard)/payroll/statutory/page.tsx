'use client';

import { useAuthStore } from '@/store/authStore';
import { useCallback, useEffect, useState } from 'react';
import {
  FiShield, FiPlus, FiEdit2, FiTrash2, FiEye, FiX, FiSearch, FiRefreshCw,
  FiChevronDown, FiChevronUp, FiGlobe, FiUsers, FiDatabase, FiAlertTriangle,
} from 'react-icons/fi';
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
  isActive: boolean;
}

interface StatutoryComponent {
  id: string;
  componentId: string;
  componentCode: string;
  componentName: string;
  countryCode: string;
  authorityName: string;
  authorityCode: string | null;
  partyType: string;
  calculationBasis: string;
  basisComponentId: string | null;
  ratePercentage: number | null;
  wageCeiling: number | null;
  maxContributionAmt: number | null;
  minContributionAmt: number | null;
  slabTableId: string | null;
  remittanceFrequency: string;
  remittanceDueDay: number | null;
  filingFrequency: string | null;
  filingFormat: string | null;
  penaltyRatePct: number | null;
  isChallanRequired: boolean;
  challanFormat: string | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  component: PayrollComponent | null;
  createdAt: string;
  updatedAt: string;
}

// --- Badge Helpers ---
function getPartyTypeBadge(type: string) {
  const map: Record<string, string> = {
    EMPLOYEE: 'thb-badge thb-badge-info',
    EMPLOYER: 'thb-badge thb-badge-warning',
    BOTH: 'thb-badge thb-badge-purple',
  };
  return map[type] || 'thb-badge thb-badge-info';
}

function getBasisBadge(basis: string) {
  const map: Record<string, string> = {
    GROSS_PAY: 'thb-badge thb-badge-info',
    BASIC_PAY: 'thb-badge thb-badge-success',
    SPECIFIC_COMPONENT: 'thb-badge thb-badge-warning',
    SLAB_BASED: 'thb-badge thb-badge-purple',
    FLAT_RATE: 'thb-badge thb-badge-error',
  };
  return map[basis] || 'thb-badge thb-badge-info';
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

const PARTY_TYPE_OPTIONS = [
  { value: 'EMPLOYEE', label: 'Employee' },
  { value: 'EMPLOYER', label: 'Employer' },
  { value: 'BOTH', label: 'Both' },
];

const CALCULATION_BASIS_OPTIONS = [
  { value: 'GROSS_PAY', label: 'Gross Pay' },
  { value: 'BASIC_PAY', label: 'Basic Pay' },
  { value: 'SPECIFIC_COMPONENT', label: 'Specific Component' },
  { value: 'SLAB_BASED', label: 'Slab Based' },
  { value: 'FLAT_RATE', label: 'Flat Rate' },
];

const REMITTANCE_FREQUENCY_OPTIONS = [
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'QUARTERLY', label: 'Quarterly' },
  { value: 'ANNUAL', label: 'Annual' },
  { value: 'ON_DEMAND', label: 'On Demand' },
];

const FILING_FREQUENCY_OPTIONS = [
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'QUARTERLY', label: 'Quarterly' },
  { value: 'ANNUAL', label: 'Annual' },
  { value: 'HALF_YEARLY', label: 'Half Yearly' },
];

// --- Country Reference Data ---
const COUNTRY_CATALOG: Record<string, { name: string; components: { code: string; name: string; party: string; rate: string; authority: string }[] }> = {
  IND: {
    name: 'India',
    components: [
      { code: 'EPF_EE', name: 'Employees Provident Fund (Employee)', party: 'EMPLOYEE', rate: '12%', authority: 'EPFO' },
      { code: 'EPF_ER', name: 'Employees Provident Fund (Employer)', party: 'EMPLOYER', rate: '12%', authority: 'EPFO' },
      { code: 'ESI_EE', name: 'Employee State Insurance (Employee)', party: 'EMPLOYEE', rate: '0.75%', authority: 'ESIC' },
      { code: 'ESI_ER', name: 'Employee State Insurance (Employer)', party: 'EMPLOYER', rate: '3.25%', authority: 'ESIC' },
      { code: 'PT', name: 'Professional Tax', party: 'EMPLOYEE', rate: 'Slab', authority: 'State Govt' },
      { code: 'TDS', name: 'Tax Deducted at Source', party: 'EMPLOYEE', rate: 'Slab', authority: 'CBDT / IT Dept' },
      { code: 'LWF', name: 'Labour Welfare Fund', party: 'BOTH', rate: 'Varies', authority: 'State Govt' },
    ],
  },
  USA: {
    name: 'United States',
    components: [
      { code: 'FIT', name: 'Federal Income Tax', party: 'EMPLOYEE', rate: 'Slab', authority: 'IRS' },
      { code: 'SS_EE', name: 'Social Security (Employee)', party: 'EMPLOYEE', rate: '6.2%', authority: 'SSA' },
      { code: 'SS_ER', name: 'Social Security (Employer)', party: 'EMPLOYER', rate: '6.2%', authority: 'SSA' },
      { code: 'MEDICARE_EE', name: 'Medicare (Employee)', party: 'EMPLOYEE', rate: '1.45%', authority: 'IRS' },
      { code: 'MEDICARE_ER', name: 'Medicare (Employer)', party: 'EMPLOYER', rate: '1.45%', authority: 'IRS' },
      { code: 'FUTA', name: 'Federal Unemployment Tax', party: 'EMPLOYER', rate: '6%', authority: 'IRS' },
      { code: 'SUTA', name: 'State Unemployment Tax', party: 'EMPLOYER', rate: 'Varies', authority: 'State Agency' },
    ],
  },
  GBR: {
    name: 'United Kingdom',
    components: [
      { code: 'PAYE', name: 'Pay As You Earn (Income Tax)', party: 'EMPLOYEE', rate: 'Slab', authority: 'HMRC' },
      { code: 'NI_EE', name: 'National Insurance (Employee)', party: 'EMPLOYEE', rate: '12%', authority: 'HMRC' },
      { code: 'NI_ER', name: 'National Insurance (Employer)', party: 'EMPLOYER', rate: '13.8%', authority: 'HMRC' },
      { code: 'PENSION', name: 'Workplace Pension (Auto Enrolment)', party: 'EMPLOYEE', rate: '5%', authority: 'TPR / HMRC' },
      { code: 'APP_LEVY', name: 'Apprenticeship Levy', party: 'EMPLOYER', rate: '0.5%', authority: 'HMRC' },
    ],
  },
  SGP: {
    name: 'Singapore',
    components: [
      { code: 'CPF_EE', name: 'Central Provident Fund (Employee)', party: 'EMPLOYEE', rate: '20%', authority: 'CPFB' },
      { code: 'CPF_ER', name: 'Central Provident Fund (Employer)', party: 'EMPLOYER', rate: '17%', authority: 'CPFB' },
      { code: 'SDL', name: 'Skills Development Levy', party: 'EMPLOYER', rate: '0.25%', authority: 'SSG' },
      { code: 'FWL', name: 'Foreign Worker Levy', party: 'EMPLOYER', rate: 'Varies', authority: 'MOM' },
      { code: 'IRAS', name: 'Income Tax (via IRAS)', party: 'EMPLOYEE', rate: 'Slab', authority: 'IRAS' },
    ],
  },
};

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
  componentCode: '',
  componentName: '',
  countryCode: 'IND',
  authorityName: '',
  authorityCode: '',
  partyType: 'EMPLOYEE',
  calculationBasis: 'BASIC_PAY',
  ratePercentage: '' as string,
  wageCeiling: '' as string,
  maxContributionAmt: '' as string,
  minContributionAmt: '' as string,
  remittanceFrequency: 'MONTHLY',
  remittanceDueDay: '' as string,
  filingFrequency: '',
  filingFormat: '',
  penaltyRatePct: '' as string,
  isChallanRequired: false,
  challanFormat: '',
  effectiveFrom: new Date().toISOString().split('T')[0],
  effectiveTo: '',
};

export default function StatutoryComponentsPage() {
  const { user } = useAuthStore();
  const effectiveCompanyId = useCompanyContextStore(s => s.effectiveCompanyId);
  const isAdmin = user?.role === 'super_admin' || user?.role === 'tenant_admin' || user?.role === 'admin';

  const [components, setComponents] = useState<StatutoryComponent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [viewingComponent, setViewingComponent] = useState<StatutoryComponent | null>(null);
  const [viewLoading, setViewLoading] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [countryFilter, setCountryFilter] = useState('');
  const [partyTypeFilter, setPartyTypeFilter] = useState('');

  // Form state
  const [form, setForm] = useState({ ...emptyForm });

  // Country reference section
  const [expandedCountry, setExpandedCountry] = useState<string | null>(null);

  // --- Data Fetching ---
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (countryFilter) params.set('countryCode', countryFilter);
      if (partyTypeFilter) params.set('partyType', partyTypeFilter);
      const qs = params.toString();
      const url = `/api/payroll/statutory${qs ? `?${qs}` : ''}`;
      const res = await fetch(url, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setComponents(Array.isArray(data) ? data : data.data || []);
      }
    } catch {
      toast.error('Failed to load statutory components');
    } finally {
      setLoading(false);
    }
  }, [countryFilter, partyTypeFilter]);
  const cid = effectiveCompanyId();
  const scopeQuery = cid ? `companyId=${cid}&` : '';


  useEffect(() => { queueMicrotask(() => fetchData()); }, [fetchData]);

  // --- Computed Stats ---
  const totalComponents = components.length;
  const employeeContributions = components.filter(c => c.partyType === 'EMPLOYEE' || c.partyType === 'BOTH').length;
  const employerContributions = components.filter(c => c.partyType === 'EMPLOYER' || c.partyType === 'BOTH').length;
  const countriesCovered = new Set(components.map(c => c.countryCode)).size;

  // --- Filtered List ---
  const filteredComponents = components.filter(c => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!c.componentName.toLowerCase().includes(q) && !c.componentCode.toLowerCase().includes(q) && !c.countryCode.toLowerCase().includes(q) && !c.authorityName.toLowerCase().includes(q)) return false;
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

  const handleEdit = (c: StatutoryComponent) => {
    setForm({
      componentCode: c.componentCode,
      componentName: c.componentName,
      countryCode: c.countryCode,
      authorityName: c.authorityName,
      authorityCode: c.authorityCode || '',
      partyType: c.partyType,
      calculationBasis: c.calculationBasis,
      ratePercentage: c.ratePercentage != null ? String(c.ratePercentage) : '',
      wageCeiling: c.wageCeiling != null ? String(c.wageCeiling) : '',
      maxContributionAmt: c.maxContributionAmt != null ? String(c.maxContributionAmt) : '',
      minContributionAmt: c.minContributionAmt != null ? String(c.minContributionAmt) : '',
      remittanceFrequency: c.remittanceFrequency,
      remittanceDueDay: c.remittanceDueDay != null ? String(c.remittanceDueDay) : '',
      filingFrequency: c.filingFrequency || '',
      filingFormat: c.filingFormat || '',
      penaltyRatePct: c.penaltyRatePct != null ? String(c.penaltyRatePct) : '',
      isChallanRequired: c.isChallanRequired,
      challanFormat: c.challanFormat || '',
      effectiveFrom: c.effectiveFrom ? new Date(c.effectiveFrom).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      effectiveTo: c.effectiveTo ? new Date(c.effectiveTo).toISOString().split('T')[0] : '',
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

  const handleView = async (c: StatutoryComponent) => {
    setViewLoading(true);
    setViewingComponent(null);
    try {
      const res = await fetch(`/api/payroll/statutory/${c.id}?${scopeQuery}` , { headers: getAuthHeaders() });
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
    if (!form.componentCode.trim()) { toast.error('Component code is required'); return; }
    if (!form.componentName.trim()) { toast.error('Component name is required'); return; }
    if (!form.authorityName.trim()) { toast.error('Authority name is required'); return; }

    setSubmitting(true);
    try {
      const payload = {
        ...form,
        componentCode: form.componentCode.toUpperCase().replace(/\s+/g, '_'),
        authorityCode: form.authorityCode || null,
        ratePercentage: form.ratePercentage ? parseFloat(form.ratePercentage) : null,
        wageCeiling: form.wageCeiling ? parseFloat(form.wageCeiling) : null,
        maxContributionAmt: form.maxContributionAmt ? parseFloat(form.maxContributionAmt) : null,
        minContributionAmt: form.minContributionAmt ? parseFloat(form.minContributionAmt) : null,
        remittanceDueDay: form.remittanceDueDay ? parseInt(form.remittanceDueDay) : null,
        filingFrequency: form.filingFrequency || null,
        filingFormat: form.filingFormat || null,
        penaltyRatePct: form.penaltyRatePct ? parseFloat(form.penaltyRatePct) : null,
        challanFormat: form.challanFormat || null,
        effectiveTo: form.effectiveTo || null,
      };

      if (editingId) {
        const res = await fetch(`/api/payroll/statutory/${editingId}?${scopeQuery}` , {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify(payload),
        });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed to update'); }
        toast.success('Statutory component updated successfully');
      } else {
        const res = await fetch(`/api/payroll/statutory?${scopeQuery}` , {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify(payload),
        });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed to create'); }
        toast.success('Statutory component created successfully');
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
      const res = await fetch(`/api/payroll/statutory/${id}?${scopeQuery}` , { method: 'DELETE', headers: getAuthHeaders() });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed to delete'); }
      toast.success('Statutory component deleted successfully');
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
  const formatPartyType = (t: string) => t.replace(/_/g, ' ');
  const formatBasis = (b: string) => b.replace(/_/g, ' ');
  const formatFrequency = (f: string) => f ? f.replace(/_/g, ' ') : '—';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-thb-text-primary flex items-center gap-2">
            <FiShield className="w-6 h-6 text-emerald-500" />
            Statutory Components
          </h1>
          <p className="text-thb-text-secondary mt-1">Manage statutory compliance components across countries</p>
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
            <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
              <FiShield className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-xs font-medium text-thb-text-secondary">Total Statutory</p>
              <p className="text-xl font-bold text-thb-text-primary">{totalComponents}</p>
            </div>
          </div>
        </div>
        <div className="thb-card thb-card-hover p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
              <FiUsers className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <p className="text-xs font-medium text-thb-text-secondary">Employee Contributions</p>
              <p className="text-xl font-bold text-thb-text-primary">{employeeContributions}</p>
            </div>
          </div>
        </div>
        <div className="thb-card thb-card-hover p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
              <FiDatabase className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <p className="text-xs font-medium text-thb-text-secondary">Employer Contributions</p>
              <p className="text-xl font-bold text-thb-text-primary">{employerContributions}</p>
            </div>
          </div>
        </div>
        <div className="thb-card thb-card-hover p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center">
              <FiGlobe className="w-5 h-5 text-teal-500" />
            </div>
            <div>
              <p className="text-xs font-medium text-thb-text-secondary">Countries Covered</p>
              <p className="text-xl font-bold text-thb-text-primary">{countriesCovered}</p>
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
              placeholder="Search by code, name, country, or authority..."
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
            value={partyTypeFilter}
            onChange={(e) => setPartyTypeFilter(e.target.value)}
            className="px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 min-w-[150px]"
          >
            <option value="">All Party Types</option>
            {PARTY_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
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
                    <h2 className="text-lg font-semibold text-thb-text-primary">{viewingComponent.componentName}</h2>
                    <p className="text-sm text-thb-text-secondary mt-0.5">
                      {viewingComponent.componentCode} &middot; {viewingComponent.countryCode}
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
                  <DetailItem label="Code" value={viewingComponent.componentCode} />
                  <DetailItem label="Name" value={viewingComponent.componentName} />
                  <DetailItem label="Country" value={viewingComponent.countryCode} />
                  <DetailItem label="Party Type" value={formatPartyType(viewingComponent.partyType)} badge={getPartyTypeBadge(viewingComponent.partyType)} />
                  <DetailItem label="Authority" value={viewingComponent.authorityName} />
                  <DetailItem label="Authority Code" value={viewingComponent.authorityCode} />
                  <DetailItem label="Calculation Basis" value={formatBasis(viewingComponent.calculationBasis)} badge={getBasisBadge(viewingComponent.calculationBasis)} />
                  <DetailItem label="Rate %" value={viewingComponent.ratePercentage != null ? `${viewingComponent.ratePercentage}%` : null} />
                  <DetailItem label="Wage Ceiling" value={viewingComponent.wageCeiling} />
                  <DetailItem label="Max Contribution" value={viewingComponent.maxContributionAmt} />
                  <DetailItem label="Min Contribution" value={viewingComponent.minContributionAmt} />
                  <DetailItem label="Remittance Frequency" value={formatFrequency(viewingComponent.remittanceFrequency)} />
                  <DetailItem label="Remittance Due Day" value={viewingComponent.remittanceDueDay != null ? `${viewingComponent.remittanceDueDay} of month` : null} />
                  <DetailItem label="Filing Frequency" value={formatFrequency(viewingComponent.filingFrequency || '')} />
                  <DetailItem label="Filing Format" value={viewingComponent.filingFormat} />
                  <DetailItem label="Penalty Rate %" value={viewingComponent.penaltyRatePct != null ? `${viewingComponent.penaltyRatePct}%` : null} />
                  <DetailItem label="Challan Required" value={viewingComponent.isChallanRequired} badge={viewingComponent.isChallanRequired ? 'thb-badge thb-badge-success' : 'thb-badge thb-badge-error'} />
                  <DetailItem label="Challan Format" value={viewingComponent.challanFormat} />
                  <DetailItem label="Effective From" value={viewingComponent.effectiveFrom ? new Date(viewingComponent.effectiveFrom).toLocaleDateString() : null} />
                  <DetailItem label="Effective To" value={viewingComponent.effectiveTo ? new Date(viewingComponent.effectiveTo).toLocaleDateString() : null} />
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
                {editingId ? 'Edit Statutory Component' : 'Create Statutory Component'}
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
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Component Code *</label>
                  <input
                    required
                    value={form.componentCode}
                    onChange={(e) => setForm({ ...form, componentCode: e.target.value.toUpperCase().replace(/\s+/g, '_') })}
                    className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                    placeholder="e.g. EPF_EE, SS_ER"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Component Name *</label>
                  <input
                    required
                    value={form.componentName}
                    onChange={(e) => setForm({ ...form, componentName: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                    placeholder="e.g. Employees Provident Fund (Employee)"
                  />
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
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Authority Name *</label>
                  <input
                    required
                    value={form.authorityName}
                    onChange={(e) => setForm({ ...form, authorityName: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                    placeholder="e.g. EPFO, IRS, HMRC"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Authority Code</label>
                  <input
                    value={form.authorityCode}
                    onChange={(e) => setForm({ ...form, authorityCode: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                    placeholder="e.g. EPFO, SSA"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Party Type</label>
                  <select
                    value={form.partyType}
                    onChange={(e) => setForm({ ...form, partyType: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                  >
                    {PARTY_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Calculation & Contribution */}
            <div className="mb-5">
              <h3 className="text-sm font-semibold text-thb-text-primary mb-3">Calculation & Contribution</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Calculation Basis</label>
                  <select
                    value={form.calculationBasis}
                    onChange={(e) => setForm({ ...form, calculationBasis: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                  >
                    {CALCULATION_BASIS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Rate Percentage (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.ratePercentage}
                    onChange={(e) => setForm({ ...form, ratePercentage: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                    placeholder="e.g. 12, 6.2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Wage Ceiling</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.wageCeiling}
                    onChange={(e) => setForm({ ...form, wageCeiling: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                    placeholder="Max basis amount"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Max Contribution Amt</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.maxContributionAmt}
                    onChange={(e) => setForm({ ...form, maxContributionAmt: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                    placeholder="e.g. 1800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Min Contribution Amt</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.minContributionAmt}
                    onChange={(e) => setForm({ ...form, minContributionAmt: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                    placeholder="e.g. 75"
                  />
                </div>
              </div>
            </div>

            {/* Remittance & Filing */}
            <div className="mb-5">
              <h3 className="text-sm font-semibold text-thb-text-primary mb-3">Remittance & Filing</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Remittance Frequency</label>
                  <select
                    value={form.remittanceFrequency}
                    onChange={(e) => setForm({ ...form, remittanceFrequency: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                  >
                    {REMITTANCE_FREQUENCY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Remittance Due Day</label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={form.remittanceDueDay}
                    onChange={(e) => setForm({ ...form, remittanceDueDay: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                    placeholder="Day of month (1-31)"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Filing Frequency</label>
                  <select
                    value={form.filingFrequency}
                    onChange={(e) => setForm({ ...form, filingFrequency: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                  >
                    <option value="">Select...</option>
                    {FILING_FREQUENCY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Filing Format</label>
                  <input
                    value={form.filingFormat}
                    onChange={(e) => setForm({ ...form, filingFormat: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                    placeholder="e.g. ECR, FPS, W-2, IR8A"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Penalty Rate %</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.penaltyRatePct}
                    onChange={(e) => setForm({ ...form, penaltyRatePct: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                    placeholder="e.g. 1.5"
                  />
                </div>
              </div>
            </div>

            {/* Challan & Effective Dates */}
            <div className="mb-5">
              <h3 className="text-sm font-semibold text-thb-text-primary mb-3">Challan & Effective Dates</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 text-sm text-thb-text-secondary cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.isChallanRequired}
                      onChange={(e) => setForm({ ...form, isChallanRequired: e.target.checked })}
                      className="rounded border-thb-border"
                    />
                    <span className="font-medium">Challan Required</span>
                  </label>
                </div>
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Challan Format</label>
                  <input
                    value={form.challanFormat}
                    onChange={(e) => setForm({ ...form, challanFormat: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                    placeholder="e.g. Challan ITNS 1, EPF Challan"
                  />
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
          <FiShield className="w-12 h-12 text-thb-text-muted mx-auto mb-3" />
          <p className="text-thb-text-secondary font-medium">No statutory components found</p>
          <p className="text-sm text-thb-text-muted mt-1">Create your first statutory component to get started</p>
        </div>
      ) : (
        <div className="thb-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-thb-border">
                <tr>
                  {['Code', 'Name', 'Country', 'Party', 'Basis', 'Rate %', 'Ceiling', 'Authority', 'Frequency', 'Actions'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-thb-text-muted uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredComponents.map((c) => (
                  deleteConfirmId === c.id ? (
                    <tr key={c.id} className="bg-red-50">
                      <td colSpan={10} className="px-4 py-3">
                        <div className="flex items-center gap-2 mb-2">
                          <FiAlertTriangle className="w-4 h-4 text-red-500" />
                          <p className="text-sm text-red-700 font-medium">
                            Are you sure you want to delete &quot;{c.componentName}&quot;?
                          </p>
                        </div>
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
                      <td className="px-4 py-3 text-sm font-mono font-medium text-thb-text-primary whitespace-nowrap">{c.componentCode}</td>
                      <td className="px-4 py-3 text-sm text-thb-text-primary max-w-[200px] truncate">{c.componentName}</td>
                      <td className="px-4 py-3 text-sm text-thb-text-secondary whitespace-nowrap">{c.countryCode}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={getPartyTypeBadge(c.partyType)}>{formatPartyType(c.partyType)}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={getBasisBadge(c.calculationBasis)}>{formatBasis(c.calculationBasis)}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-thb-text-primary whitespace-nowrap">
                        {c.ratePercentage != null ? `${c.ratePercentage}%` : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-thb-text-secondary whitespace-nowrap">
                        {c.wageCeiling != null ? c.wageCeiling.toLocaleString() : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-thb-text-secondary whitespace-nowrap">{c.authorityName}</td>
                      <td className="px-4 py-3 text-sm text-thb-text-secondary whitespace-nowrap">{formatFrequency(c.remittanceFrequency)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleView(c)}
                            className="p-1.5 rounded-md text-thb-text-muted hover:text-green-500 hover:bg-green-50 transition-colors"
                            title="View"
                          >
                            <FiEye className="w-4 h-4" />
                          </button>
                          {isAdmin && (
                            <>
                              <button
                                onClick={() => handleEdit(c)}
                                className="p-1.5 rounded-md text-thb-text-muted hover:text-emerald-500 hover:bg-emerald-50 transition-colors"
                                title="Edit"
                              >
                                <FiEdit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setDeleteConfirmId(c.id)}
                                className="p-1.5 rounded-md text-thb-text-muted hover:text-red-500 hover:bg-red-50 transition-colors"
                                title="Delete"
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

      {/* Country-Specific Reference Section */}
      <div className="thb-card overflow-hidden">
        <div className="p-4 border-b border-thb-border bg-slate-50/50">
          <h2 className="text-lg font-semibold text-thb-text-primary flex items-center gap-2">
            <FiGlobe className="w-5 h-5 text-teal-500" />
            Statutory Component Catalog by Country
          </h2>
          <p className="text-sm text-thb-text-secondary mt-1">Reference guide for common statutory components across jurisdictions</p>
        </div>
        <div className="divide-y divide-thb-border">
          {Object.entries(COUNTRY_CATALOG).map(([code, catalog]) => (
            <div key={code}>
              <button
                onClick={() => setExpandedCountry(expandedCountry === code ? null : code)}
                className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                    code === 'IND' ? 'bg-orange-50 text-orange-600' :
                    code === 'USA' ? 'bg-green-50 text-green-600' :
                    code === 'GBR' ? 'bg-red-50 text-red-600' :
                    code === 'SGP' ? 'bg-teal-50 text-teal-600' :
                    'bg-slate-50 text-slate-600'
                  }`}>
                    {code}
                  </div>
                  <div className="text-left">
                    <span className="text-sm font-semibold text-thb-text-primary">{catalog.name}</span>
                    <span className="text-xs text-thb-text-muted ml-2">({catalog.components.length} components)</span>
                  </div>
                </div>
                {expandedCountry === code ? (
                  <FiChevronUp className="w-5 h-5 text-thb-text-muted" />
                ) : (
                  <FiChevronDown className="w-5 h-5 text-thb-text-muted" />
                )}
              </button>
              {expandedCountry === code && (
                <div className="px-4 pb-4">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-thb-border bg-slate-50/50">
                          <th className="text-left px-3 py-2 text-xs font-semibold text-thb-text-secondary uppercase">Code</th>
                          <th className="text-left px-3 py-2 text-xs font-semibold text-thb-text-secondary uppercase">Component</th>
                          <th className="text-left px-3 py-2 text-xs font-semibold text-thb-text-secondary uppercase">Party</th>
                          <th className="text-left px-3 py-2 text-xs font-semibold text-thb-text-secondary uppercase">Rate</th>
                          <th className="text-left px-3 py-2 text-xs font-semibold text-thb-text-secondary uppercase">Authority</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {catalog.components.map((comp) => (
                          <tr key={comp.code} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-3 py-2 text-sm font-mono font-medium text-thb-text-primary">{comp.code}</td>
                            <td className="px-3 py-2 text-sm text-thb-text-primary">{comp.name}</td>
                            <td className="px-3 py-2">
                              <span className={getPartyTypeBadge(comp.party)}>{formatPartyType(comp.party)}</span>
                            </td>
                            <td className="px-3 py-2 text-sm font-medium text-thb-text-primary">{comp.rate}</td>
                            <td className="px-3 py-2 text-sm text-thb-text-secondary">{comp.authority}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
