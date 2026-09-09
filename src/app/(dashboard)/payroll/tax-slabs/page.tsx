'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  FiPlus, FiX, FiTrash2, FiEye, FiEdit2,
  FiPercent, FiSearch, FiGlobe, FiCalendar,
  FiCheckCircle, FiList, FiRefreshCw,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import { useCompanyContextStore } from '@/store/companyContextStore';

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

// --- Types ---
interface RateLine {
  id?: string;
  sequence: number;
  incomeFrom: number;
  incomeTo: number | null;
  ratePercentage: number;
  fixedAmount: number | null;
  surchargeRate: number | null;
  cessRate: number | null;
}

interface TaxSlabTable {
  id: string;
  name: string;
  countryCode: string;
  taxYear: string;
  filingStatus: string | null;
  regimeType: string | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  companyId: string | null;
  rateLines: RateLine[];
  createdAt: string;
  updatedAt: string;
}

// --- Badge Helpers ---
function getFilingStatusBadge(status: string) {
  const map: Record<string, string> = {
    SINGLE: 'thb-badge thb-badge-info',
    MARRIED_JOINT: 'thb-badge thb-badge-success',
    MARRIED_SEPARATE: 'thb-badge thb-badge-warning',
    HEAD_OF_HOUSEHOLD: 'thb-badge thb-badge-purple',
    SENIOR_CITIZEN: 'thb-badge thb-badge-error',
  };
  return map[status] || 'thb-badge thb-badge-info';
}

function getRegimeBadge(regime: string) {
  const map: Record<string, string> = {
    OLD: 'thb-badge thb-badge-warning',
    NEW: 'thb-badge thb-badge-success',
    STANDARD: 'thb-badge thb-badge-info',
  };
  return map[regime] || 'thb-badge thb-badge-info';
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

const CURRENCY_SYMBOLS: Record<string, string> = {
  IND: '₹', USA: '$', GBR: '£', SGP: 'S$', UAE: 'د.إ', AUS: 'A$',
};

const FILING_STATUS_OPTIONS = [
  { value: 'SINGLE', label: 'Single' },
  { value: 'MARRIED_JOINT', label: 'Married Filing Jointly' },
  { value: 'MARRIED_SEPARATE', label: 'Married Filing Separately' },
  { value: 'HEAD_OF_HOUSEHOLD', label: 'Head of Household' },
  { value: 'SENIOR_CITIZEN', label: 'Senior Citizen' },
];

const REGIME_TYPE_OPTIONS = [
  { value: 'OLD', label: 'Old Regime' },
  { value: 'NEW', label: 'New Regime' },
  { value: 'STANDARD', label: 'Standard' },
];

const emptyRateLine: RateLine = {
  sequence: 1,
  incomeFrom: 0,
  incomeTo: null,
  ratePercentage: 0,
  fixedAmount: null,
  surchargeRate: null,
  cessRate: null,
};

const emptyForm = {
  name: '',
  countryCode: 'IND',
  taxYear: '',
  filingStatus: 'SINGLE',
  regimeType: 'STANDARD',
  effectiveFrom: new Date().toISOString().split('T')[0],
  effectiveTo: '',
};

// --- Detail Item ---
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

export default function TaxSlabsPage() {
  const { user } = useAuthStore();
  const effectiveCompanyId = useCompanyContextStore(s => s.effectiveCompanyId);
  const isAdmin = user?.role === 'super_admin' || user?.role === 'tenant_admin' || user?.role === 'admin';

  const [slabs, setSlabs] = useState<TaxSlabTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [viewingSlab, setViewingSlab] = useState<TaxSlabTable | null>(null);
  const [viewLoading, setViewLoading] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [countryFilter, setCountryFilter] = useState('');
  const [taxYearFilter, setTaxYearFilter] = useState('');

  // Form state
  const [form, setForm] = useState({ ...emptyForm });
  const [rateLines, setRateLines] = useState<RateLine[]>([{ ...emptyRateLine }]);

  // --- Data Fetching ---
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (countryFilter) params.set('countryCode', countryFilter);
      if (taxYearFilter) params.set('taxYear', taxYearFilter);
      const qs = params.toString();
      const url = `/api/payroll/tax-slabs${qs ? `?${qs}` : ''}`;
      const res = await fetch(url, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setSlabs(Array.isArray(data) ? data : data.data || []);
      }
    } catch {
      toast.error('Failed to load tax slabs');
    } finally {
      setLoading(false);
    }
  }, [countryFilter, taxYearFilter]);
  const cid = effectiveCompanyId();
  const scopeQuery = cid ? `companyId=${cid}&` : '';


  useEffect(() => { queueMicrotask(() => fetchData()); }, [fetchData]);

  // --- Computed Stats ---
  const totalSlabs = slabs.length;
  const uniqueCountries = new Set(slabs.map(s => s.countryCode)).size;
  const uniqueTaxYears = new Set(slabs.map(s => s.taxYear)).size;
  const activeSlabs = slabs.filter(s => {
    const now = new Date();
    const from = s.effectiveFrom ? new Date(s.effectiveFrom) : null;
    const to = s.effectiveTo ? new Date(s.effectiveTo) : null;
    return from && from <= now && (!to || to >= now);
  }).length;

  // --- Filtered List ---
  const filteredSlabs = slabs.filter(s => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (
        !s.name.toLowerCase().includes(q) &&
        !s.countryCode.toLowerCase().includes(q) &&
        !s.taxYear.toLowerCase().includes(q) &&
        !(s.filingStatus || '').toLowerCase().includes(q) &&
        !(s.regimeType || '').toLowerCase().includes(q)
      ) return false;
    }
    return true;
  });

  // --- Currency formatting ---
  const formatCurrency = (amount: number | null, countryCode: string) => {
    if (amount == null) return '—';
    const symbol = CURRENCY_SYMBOLS[countryCode] || '$';
    return `${symbol}${amount.toLocaleString()}`;
  };

  // --- Handlers ---
  const handleAddNew = () => {
    setForm({ ...emptyForm });
    setRateLines([{ ...emptyRateLine }]);
    setEditingId(null);
    setShowForm(true);
    setViewingSlab(null);
    setTimeout(() => document.getElementById('crud-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  const handleEdit = (s: TaxSlabTable) => {
    setForm({
      name: s.name,
      countryCode: s.countryCode,
      taxYear: s.taxYear,
      filingStatus: s.filingStatus || 'SINGLE',
      regimeType: s.regimeType || 'STANDARD',
      effectiveFrom: s.effectiveFrom ? new Date(s.effectiveFrom).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      effectiveTo: s.effectiveTo ? new Date(s.effectiveTo).toISOString().split('T')[0] : '',
    });
    setRateLines(
      s.rateLines && s.rateLines.length > 0
        ? s.rateLines.map(rl => ({ ...rl }))
        : [{ ...emptyRateLine }]
    );
    setEditingId(s.id);
    setShowForm(true);
    setViewingSlab(null);
    setTimeout(() => document.getElementById('crud-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm({ ...emptyForm });
    setRateLines([{ ...emptyRateLine }]);
  };

  const handleView = async (s: TaxSlabTable) => {
    setViewLoading(true);
    setViewingSlab(null);
    try {
      const res = await fetch(`/api/payroll/tax-slabs/${s.id}?${scopeQuery}` , { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setViewingSlab(data.data || data);
      } else {
        setViewingSlab(s);
      }
    } catch {
      setViewingSlab(s);
    } finally {
      setViewLoading(false);
      setShowForm(false);
      setTimeout(() => document.getElementById('view-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    }
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) { toast.error('Slab table name is required'); return; }
    if (!form.taxYear.trim()) { toast.error('Tax year is required'); return; }

    const validRateLines = rateLines.filter(rl => rl.incomeFrom >= 0 && rl.ratePercentage > 0);
    if (validRateLines.length === 0) {
      toast.error('At least one rate line with valid income and rate is required');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        ...form,
        filingStatus: form.filingStatus || null,
        regimeType: form.regimeType || null,
        effectiveTo: form.effectiveTo || null,
        rateLines: validRateLines.map((rl, idx) => ({
          sequence: idx + 1,
          incomeFrom: Number(rl.incomeFrom) || 0,
          incomeTo: rl.incomeTo != null && rl.incomeTo > 0 ? Number(rl.incomeTo) : null,
          ratePercentage: Number(rl.ratePercentage) || 0,
          fixedAmount: rl.fixedAmount != null && rl.fixedAmount > 0 ? Number(rl.fixedAmount) : null,
          surchargeRate: rl.surchargeRate != null && rl.surchargeRate > 0 ? Number(rl.surchargeRate) : null,
          cessRate: rl.cessRate != null && rl.cessRate > 0 ? Number(rl.cessRate) : null,
        })),
      };

      if (editingId) {
        const res = await fetch(`/api/payroll/tax-slabs/${editingId}?${scopeQuery}` , {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify(payload),
        });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed to update'); }
        toast.success('Tax slab table updated successfully');
      } else {
        const res = await fetch(`/api/payroll/tax-slabs?${scopeQuery}` , {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify(payload),
        });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed to create'); }
        toast.success('Tax slab table created successfully');
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
      const res = await fetch(`/api/payroll/tax-slabs/${id}?${scopeQuery}` , { method: 'DELETE', headers: getAuthHeaders() });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed to delete'); }
      toast.success('Tax slab table deleted successfully');
      setDeleteConfirmId(null);
      if (viewingSlab?.id === id) { setViewingSlab(null); }
      fetchData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setDeleting(false);
    }
  };

  // --- Rate Line Helpers ---
  const addRateLine = () => {
    setRateLines([...rateLines, {
      ...emptyRateLine,
      sequence: rateLines.length + 1,
      incomeFrom: rateLines.length > 0 ? (rateLines[rateLines.length - 1].incomeTo ?? 0) : 0,
    }]);
  };

  const removeRateLine = (index: number) => {
    if (rateLines.length <= 1) {
      toast.error('At least one rate line is required');
      return;
    }
    setRateLines(rateLines.filter((_, i) => i !== index));
  };

  const updateRateLine = (index: number, field: keyof RateLine, value: string | number | null) => {
    const updated = [...rateLines];
    updated[index] = { ...updated[index], [field]: value };
    setRateLines(updated);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-thb-text-primary flex items-center gap-2">
            <FiPercent className="w-6 h-6 text-emerald-500" />
            Tax Slabs
          </h1>
          <p className="text-thb-text-secondary mt-1">Manage tax slab tables with rate lines across countries and regimes</p>
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
              <FiPlus className="w-4 h-4" /> Add Tax Slab
            </button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="thb-card thb-card-hover p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
              <FiList className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-xs font-medium text-thb-text-secondary">Total Slab Tables</p>
              <p className="text-xl font-bold text-thb-text-primary">{totalSlabs}</p>
            </div>
          </div>
        </div>
        <div className="thb-card thb-card-hover p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
              <FiGlobe className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <p className="text-xs font-medium text-thb-text-secondary">Countries</p>
              <p className="text-xl font-bold text-thb-text-primary">{uniqueCountries}</p>
            </div>
          </div>
        </div>
        <div className="thb-card thb-card-hover p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
              <FiCalendar className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <p className="text-xs font-medium text-thb-text-secondary">Tax Years</p>
              <p className="text-xl font-bold text-thb-text-primary">{uniqueTaxYears}</p>
            </div>
          </div>
        </div>
        <div className="thb-card thb-card-hover p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center">
              <FiCheckCircle className="w-5 h-5 text-teal-500" />
            </div>
            <div>
              <p className="text-xs font-medium text-thb-text-secondary">Active Tables</p>
              <p className="text-xl font-bold text-thb-text-primary">{activeSlabs}</p>
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
              placeholder="Search by name, country, tax year, filing status..."
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
            value={taxYearFilter}
            onChange={(e) => setTaxYearFilter(e.target.value)}
            className="px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 min-w-[140px]"
          >
            <option value="">All Tax Years</option>
            {[...new Set(slabs.map(s => s.taxYear))].sort().map(yr => (
              <option key={yr} value={yr}>{yr}</option>
            ))}
          </select>
        </div>
      </div>

      {/* View Panel */}
      {viewingSlab && (
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
                    <h2 className="text-lg font-semibold text-thb-text-primary">{viewingSlab.name}</h2>
                    <p className="text-sm text-thb-text-secondary mt-0.5">
                      {viewingSlab.countryCode} &middot; {viewingSlab.taxYear}
                      {viewingSlab.filingStatus ? ` · ${viewingSlab.filingStatus.replace(/_/g, ' ')}` : ''}
                      {viewingSlab.regimeType ? ` · ${viewingSlab.regimeType} Regime` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {isAdmin && (
                      <button
                        onClick={() => handleEdit(viewingSlab)}
                        className="px-3 py-1.5 rounded-lg bg-green-500 text-white text-xs font-medium hover:bg-green-600 transition-colors flex items-center gap-1"
                      >
                        <FiEdit2 className="w-3.5 h-3.5" /> Edit
                      </button>
                    )}
                    <button
                      onClick={() => setViewingSlab(null)}
                      className="p-2 rounded-lg text-thb-text-muted hover:text-thb-text-primary hover:bg-slate-100 transition-colors"
                    >
                      <FiX className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  <DetailItem label="Country" value={viewingSlab.countryCode} />
                  <DetailItem label="Tax Year" value={viewingSlab.taxYear} />
                  <DetailItem label="Filing Status" value={viewingSlab.filingStatus ? viewingSlab.filingStatus.replace(/_/g, ' ') : null} badge={viewingSlab.filingStatus ? getFilingStatusBadge(viewingSlab.filingStatus) : undefined} />
                  <DetailItem label="Regime Type" value={viewingSlab.regimeType} badge={viewingSlab.regimeType ? getRegimeBadge(viewingSlab.regimeType) : undefined} />
                  <DetailItem label="Effective From" value={viewingSlab.effectiveFrom ? new Date(viewingSlab.effectiveFrom).toLocaleDateString() : null} />
                  <DetailItem label="Effective To" value={viewingSlab.effectiveTo ? new Date(viewingSlab.effectiveTo).toLocaleDateString() : null} />
                  <DetailItem label="Rate Lines" value={`${(viewingSlab.rateLines || []).length} lines`} />
                  <DetailItem label="Created" value={viewingSlab.createdAt ? new Date(viewingSlab.createdAt).toLocaleDateString() : null} />
                </div>

                {/* Rate Lines View Table */}
                <div>
                  <h3 className="text-sm font-semibold text-thb-text-primary mb-3">
                    Rate Lines ({(viewingSlab.rateLines || []).length})
                  </h3>
                  {(viewingSlab.rateLines || []).length === 0 ? (
                    <p className="text-sm text-thb-text-secondary text-center py-6">No rate lines defined</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-thb-border bg-slate-50/50">
                            <th className="text-left px-3 py-2 text-xs font-semibold text-thb-text-secondary uppercase">#</th>
                            <th className="text-left px-3 py-2 text-xs font-semibold text-thb-text-secondary uppercase">Income From</th>
                            <th className="text-left px-3 py-2 text-xs font-semibold text-thb-text-secondary uppercase">Income To</th>
                            <th className="text-left px-3 py-2 text-xs font-semibold text-thb-text-secondary uppercase">Rate %</th>
                            <th className="text-left px-3 py-2 text-xs font-semibold text-thb-text-secondary uppercase">Fixed Amt</th>
                            <th className="text-left px-3 py-2 text-xs font-semibold text-thb-text-secondary uppercase">Surcharge %</th>
                            <th className="text-left px-3 py-2 text-xs font-semibold text-thb-text-secondary uppercase">Cess %</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-thb-border/50">
                          {(viewingSlab.rateLines || []).map((rl, i) => (
                            <tr key={rl.id || i} className="hover:bg-slate-50/50 transition-colors">
                              <td className="px-3 py-2 text-sm text-thb-text-secondary">{rl.sequence || i + 1}</td>
                              <td className="px-3 py-2 text-sm font-medium text-thb-text-primary">{formatCurrency(rl.incomeFrom, viewingSlab.countryCode)}</td>
                              <td className="px-3 py-2 text-sm font-medium text-thb-text-primary">
                                {rl.incomeTo != null ? formatCurrency(rl.incomeTo, viewingSlab.countryCode) : <span className="text-thb-text-muted">No limit</span>}
                              </td>
                              <td className="px-3 py-2"><span className="thb-badge thb-badge-success">{rl.ratePercentage}%</span></td>
                              <td className="px-3 py-2 text-sm text-thb-text-secondary">{rl.fixedAmount != null ? formatCurrency(rl.fixedAmount, viewingSlab.countryCode) : '—'}</td>
                              <td className="px-3 py-2 text-sm text-thb-text-secondary">{rl.surchargeRate != null ? `${rl.surchargeRate}%` : '—'}</td>
                              <td className="px-3 py-2 text-sm text-thb-text-secondary">{rl.cessRate != null ? `${rl.cessRate}%` : '—'}</td>
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
                {editingId ? 'Edit Tax Slab Table' : 'Create Tax Slab Table'}
              </h2>
              <button
                onClick={handleCancelForm}
                className="p-2 rounded-lg text-thb-text-muted hover:text-thb-text-primary hover:bg-slate-100 transition-colors"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>

            {/* Slab Table Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Slab Table Name *</label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                  placeholder="e.g. India New Regime FY 2024-25"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Country Code</label>
                <select
                  value={form.countryCode}
                  onChange={(e) => setForm({ ...form, countryCode: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                >
                  {COUNTRY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Tax Year *</label>
                <input
                  required
                  value={form.taxYear}
                  onChange={(e) => setForm({ ...form, taxYear: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                  placeholder="e.g. 2024-25 or 2024"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Filing Status</label>
                <select
                  value={form.filingStatus}
                  onChange={(e) => setForm({ ...form, filingStatus: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                >
                  {FILING_STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Regime Type</label>
                <select
                  value={form.regimeType}
                  onChange={(e) => setForm({ ...form, regimeType: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                >
                  {REGIME_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
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
            </div>

            {/* Rate Lines Sub-section */}
            <div className="mt-6 pt-4 border-t border-thb-border">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-thb-text-primary">Rate Lines</h3>
                <button
                  type="button"
                  onClick={addRateLine}
                  className="text-xs font-medium text-green-500 hover:text-green-600 flex items-center gap-1"
                >
                  <FiPlus className="w-3.5 h-3.5" /> Add Rate Line
                </button>
              </div>

              {/* Rate Lines Table */}
              <div className="overflow-x-auto max-h-96 overflow-y-auto">
                <table className="w-full min-w-[700px]">
                  <thead className="sticky top-0 z-10">
                    <tr className="border-b border-thb-border bg-slate-50">
                      <th className="text-left px-2 py-2 text-xs font-semibold text-thb-text-secondary uppercase w-8">#</th>
                      <th className="text-left px-2 py-2 text-xs font-semibold text-thb-text-secondary uppercase">Income From *</th>
                      <th className="text-left px-2 py-2 text-xs font-semibold text-thb-text-secondary uppercase">Income To</th>
                      <th className="text-left px-2 py-2 text-xs font-semibold text-thb-text-secondary uppercase">Rate % *</th>
                      <th className="text-left px-2 py-2 text-xs font-semibold text-thb-text-secondary uppercase">Fixed Amt</th>
                      <th className="text-left px-2 py-2 text-xs font-semibold text-thb-text-secondary uppercase">Surcharge %</th>
                      <th className="text-left px-2 py-2 text-xs font-semibold text-thb-text-secondary uppercase">Cess %</th>
                      <th className="text-left px-2 py-2 text-xs font-semibold text-thb-text-secondary uppercase w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-thb-border/50">
                    {rateLines.map((rl, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-2 py-2">
                          <span className="text-xs font-semibold text-thb-text-muted">{idx + 1}</span>
                        </td>
                        <td className="px-2 py-2">
                          <div className="relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-thb-text-muted">{CURRENCY_SYMBOLS[form.countryCode] || '$'}</span>
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              value={rl.incomeFrom}
                              onChange={(e) => updateRateLine(idx, 'incomeFrom', parseFloat(e.target.value) || 0)}
                              className="w-full pl-6 pr-2 py-1.5 border border-thb-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-green-500/20 bg-white"
                              placeholder="0"
                            />
                          </div>
                        </td>
                        <td className="px-2 py-2">
                          <div className="relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-thb-text-muted">{CURRENCY_SYMBOLS[form.countryCode] || '$'}</span>
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              value={rl.incomeTo ?? ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                updateRateLine(idx, 'incomeTo', val === '' ? null : parseFloat(val) || null);
                              }}
                              className="w-full pl-6 pr-2 py-1.5 border border-thb-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-green-500/20 bg-white"
                              placeholder="No limit"
                            />
                          </div>
                        </td>
                        <td className="px-2 py-2">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            step="0.01"
                            value={rl.ratePercentage}
                            onChange={(e) => updateRateLine(idx, 'ratePercentage', parseFloat(e.target.value) || 0)}
                            className="w-full px-2 py-1.5 border border-thb-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-green-500/20 bg-white"
                            placeholder="0"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={rl.fixedAmount ?? ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              updateRateLine(idx, 'fixedAmount', val === '' ? null : parseFloat(val) || null);
                            }}
                            className="w-full px-2 py-1.5 border border-thb-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-green-500/20 bg-white"
                            placeholder="—"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            step="0.01"
                            value={rl.surchargeRate ?? ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              updateRateLine(idx, 'surchargeRate', val === '' ? null : parseFloat(val) || null);
                            }}
                            className="w-full px-2 py-1.5 border border-thb-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-green-500/20 bg-white"
                            placeholder="—"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            step="0.01"
                            value={rl.cessRate ?? ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              updateRateLine(idx, 'cessRate', val === '' ? null : parseFloat(val) || null);
                            }}
                            className="w-full px-2 py-1.5 border border-thb-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-green-500/20 bg-white"
                            placeholder="—"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <button
                            type="button"
                            onClick={() => removeRateLine(idx)}
                            className="p-1 text-red-400 hover:text-red-600 transition-colors"
                            title="Remove rate line"
                          >
                            <FiX className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
                {submitting ? 'Saving...' : editingId ? 'Update Tax Slab' : 'Create Tax Slab'}
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
      ) : filteredSlabs.length === 0 ? (
        <div className="thb-card p-12 text-center">
          <FiPercent className="w-12 h-12 text-thb-text-muted mx-auto mb-3" />
          <p className="text-thb-text-secondary font-medium">No tax slabs found</p>
          <p className="text-sm text-thb-text-muted mt-1">Create your first tax slab table to get started</p>
        </div>
      ) : (
        <div className="thb-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-thb-border">
                <tr>
                  {['Name', 'Country', 'Tax Year', 'Filing Status', 'Regime', 'Effective From', 'Rate Lines', 'Actions'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-thb-text-muted uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSlabs.map((s) => (
                  deleteConfirmId === s.id ? (
                    <tr key={s.id} className="bg-red-50">
                      <td colSpan={8} className="px-4 py-3">
                        <p className="text-sm text-red-700 font-medium mb-2">
                          Are you sure you want to delete &quot;{s.name}&quot;?
                        </p>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleDelete(s.id)}
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
                    <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-thb-text-primary">{s.name}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="thb-badge thb-badge-info">{s.countryCode}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-thb-text-secondary">{s.taxYear}</td>
                      <td className="px-4 py-3">
                        {s.filingStatus ? (
                          <span className={getFilingStatusBadge(s.filingStatus)}>{s.filingStatus.replace(/_/g, ' ')}</span>
                        ) : (
                          <span className="text-sm text-thb-text-muted">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {s.regimeType ? (
                          <span className={getRegimeBadge(s.regimeType)}>{s.regimeType}</span>
                        ) : (
                          <span className="text-sm text-thb-text-muted">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-thb-text-secondary">
                        {s.effectiveFrom ? new Date(s.effectiveFrom).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className="thb-badge thb-badge-purple">{(s.rateLines || []).length} lines</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleView(s)}
                            className="p-1.5 rounded-lg text-thb-text-muted hover:text-green-500 hover:bg-green-50 transition-colors"
                            title="View"
                          >
                            <FiEye className="w-4 h-4" />
                          </button>
                          {isAdmin && (
                            <button
                              onClick={() => handleEdit(s)}
                              className="p-1.5 rounded-lg text-thb-text-muted hover:text-emerald-500 hover:bg-emerald-50 transition-colors"
                              title="Edit"
                            >
                              <FiEdit2 className="w-4 h-4" />
                            </button>
                          )}
                          {isAdmin && (
                            <button
                              onClick={() => setDeleteConfirmId(s.id)}
                              className="p-1.5 rounded-lg text-thb-text-muted hover:text-red-500 hover:bg-red-50 transition-colors"
                              title="Delete"
                            >
                              <FiTrash2 className="w-4 h-4" />
                            </button>
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
