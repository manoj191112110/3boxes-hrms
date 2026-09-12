'use client';

import { useAuthStore } from '@/store/authStore';
import { useCompanyContextStore } from '@/store/companyContextStore';
import { useCallback, useEffect, useState } from 'react';
import { FiCalendar, FiPlus, FiEdit2, FiTrash2, FiEye, FiX, FiSearch, FiRefreshCw, FiCheck, FiCreditCard } from 'react-icons/fi';
import toast from 'react-hot-toast';

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

// --- Types ---
interface PayrollDefinition {
  id: string;
  name: string;
  companyId: string;
  payFrequency: string;
  processingCutOff: number;
  paymentDay: number;
  currencyCode: string;
  countryCode: string;
  allowDirectDeposit: boolean;
  allowCheque: boolean;
  allowCash: boolean;
  costingSegments: string | null;
  status: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  createdAt: string;
  updatedAt: string;
}

// --- Badge Helpers ---
function getFrequencyBadge(freq: string) {
  const map: Record<string, string> = {
    DAILY: 'thb-badge thb-badge-info',
    WEEKLY: 'thb-badge thb-badge-info',
    BI_WEEKLY: 'thb-badge thb-badge-info',
    SEMI_MONTHLY: 'thb-badge thb-badge-warning',
    MONTHLY: 'thb-badge thb-badge-success',
    QUARTERLY: 'thb-badge thb-badge-warning',
    SEMI_ANNUALLY: 'thb-badge thb-badge-purple',
    ANNUALLY: 'thb-badge thb-badge-error',
  };
  return map[freq] || 'thb-badge thb-badge-info';
}

function getStatusBadge(status: string) {
  return status === 'active' ? 'thb-badge thb-badge-success' : 'thb-badge thb-badge-error';
}

// --- Constants ---
const COUNTRY_OPTIONS = [
  { value: 'IN', label: 'India (IN)' },
  { value: 'US', label: 'United States (US)' },
  { value: 'GB', label: 'United Kingdom (GB)' },
  { value: 'SG', label: 'Singapore (SG)' },
  { value: 'AE', label: 'UAE (AE)' },
  { value: 'AU', label: 'Australia (AU)' },
];

const CURRENCY_OPTIONS = [
  { value: 'INR', label: 'INR (₹)' },
  { value: 'USD', label: 'USD ($)' },
  { value: 'GBP', label: 'GBP (£)' },
  { value: 'SGD', label: 'SGD (S$)' },
  { value: 'AED', label: 'AED (د.إ)' },
  { value: 'AUD', label: 'AUD (A$)' },
];

const PAY_FREQUENCY_OPTIONS = [
  { value: 'DAILY', label: 'Daily' },
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'BI_WEEKLY', label: 'Bi-Weekly' },
  { value: 'SEMI_MONTHLY', label: 'Semi-Monthly' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'QUARTERLY', label: 'Quarterly' },
  { value: 'SEMI_ANNUALLY', label: 'Semi-Annually' },
  { value: 'ANNUALLY', label: 'Annually' },
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
  name: '',
  companyId: '',
  payFrequency: 'MONTHLY',
  processingCutOff: 25,
  paymentDay: 1,
  currencyCode: 'INR',
  countryCode: 'IN',
  allowDirectDeposit: true,
  allowCheque: false,
  allowCash: false,
  costingSegments: '',
  status: 'active',
  effectiveFrom: '',
  effectiveTo: '',
};

export default function PayrollDefinitionsPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'super_admin' || user?.role === 'tenant_admin' || user?.role === 'admin';
  const effectiveCompanyId = useCompanyContextStore(s => s.effectiveCompanyId());
  const scopeQuery = useCompanyContextStore(s => s.scopeQuery);
  const selectedTenantId = useCompanyContextStore(s => s.selectedTenantId);
  const availableCompanies = useCompanyContextStore(s => s.availableCompanies);

  const [definitions, setDefinitions] = useState<PayrollDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [viewingDefinition, setViewingDefinition] = useState<PayrollDefinition | null>(null);
  const [viewLoading, setViewLoading] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [countryFilter, setCountryFilter] = useState('');
  const [frequencyFilter, setFrequencyFilter] = useState('');

  // Form state
  const [form, setForm] = useState({ ...emptyForm });

  // --- Data Fetching ---
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (countryFilter) params.set('countryCode', countryFilter);
      if (frequencyFilter) params.set('payFrequency', frequencyFilter);
      const sq = scopeQuery();
      const qs = params.toString();
      const url = `/api/payroll/definitions${qs ? `?${qs}${sq ? `&${sq}` : ''}` : (sq ? `?${sq}` : '')}`;
      const res = await fetch(url, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setDefinitions(Array.isArray(data) ? data : data.data || []);
      }
    } catch {
      toast.error('Failed to load payroll definitions');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, countryFilter, frequencyFilter, effectiveCompanyId, scopeQuery, selectedTenantId]);

  useEffect(() => { queueMicrotask(() => fetchData()); }, [fetchData]);

  // --- Computed Stats ---
  const totalDefinitions = definitions.length;
  const activeCount = definitions.filter(d => d.status === 'active').length;
  const monthlyCount = definitions.filter(d => d.payFrequency === 'MONTHLY').length;
  const depositEnabledCount = definitions.filter(d => d.allowDirectDeposit).length;

  // --- Filtered List ---
  const filteredDefinitions = definitions.filter(d => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!d.name.toLowerCase().includes(q) && !d.countryCode.toLowerCase().includes(q) && !d.currencyCode.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  // --- Handlers ---
  const handleAddNew = () => {
    setForm({ ...emptyForm, companyId: effectiveCompanyId || '' });
    setEditingId(null);
    setShowForm(true);
    setViewingDefinition(null);
    setTimeout(() => document.getElementById('crud-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  const handleEdit = (d: PayrollDefinition) => {
    setForm({
      name: d.name,
      companyId: d.companyId,
      payFrequency: d.payFrequency,
      processingCutOff: d.processingCutOff,
      paymentDay: d.paymentDay,
      currencyCode: d.currencyCode,
      countryCode: d.countryCode,
      allowDirectDeposit: d.allowDirectDeposit,
      allowCheque: d.allowCheque,
      allowCash: d.allowCash,
      costingSegments: d.costingSegments || '',
      status: d.status,
      effectiveFrom: d.effectiveFrom ? new Date(d.effectiveFrom).toISOString().split('T')[0] : '',
      effectiveTo: d.effectiveTo ? new Date(d.effectiveTo).toISOString().split('T')[0] : '',
    });
    setEditingId(d.id);
    setShowForm(true);
    setViewingDefinition(null);
    setTimeout(() => document.getElementById('crud-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm({ ...emptyForm });
  };

  const handleView = async (d: PayrollDefinition) => {
    setViewLoading(true);
    setViewingDefinition(null);
    try {
      const res = await fetch(`/api/payroll/definitions/${d.id}`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setViewingDefinition(data.data || data);
      } else {
        setViewingDefinition(d);
      }
    } catch {
      setViewingDefinition(d);
    } finally {
      setViewLoading(false);
      setShowForm(false);
      setTimeout(() => document.getElementById('view-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    }
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) { toast.error('Definition name is required'); return; }
    if (!form.companyId.trim() && !effectiveCompanyId) { toast.error('Company ID is required'); return; }

    setSubmitting(true);
    try {
      const payload = {
        ...form,
        companyId: form.companyId || effectiveCompanyId || '',
        processingCutOff: Number(form.processingCutOff),
        paymentDay: Number(form.paymentDay),
        costingSegments: form.costingSegments || null,
        effectiveFrom: form.effectiveFrom ? new Date(form.effectiveFrom).toISOString() : new Date().toISOString(),
        effectiveTo: form.effectiveTo ? new Date(form.effectiveTo).toISOString() : null,
      };

      if (editingId) {
        const res = await fetch(`/api/payroll/definitions/${editingId}`, {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify(payload),
        });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed to update'); }
        toast.success('Payroll definition updated successfully');
      } else {
        const res = await fetch('/api/payroll/definitions', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify(payload),
        });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed to create'); }
        toast.success('Payroll definition created successfully');
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
      const res = await fetch(`/api/payroll/definitions/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed to delete'); }
      toast.success('Payroll definition deactivated successfully');
      setDeleteConfirmId(null);
      if (viewingDefinition?.id === id) { setViewingDefinition(null); }
      fetchData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setDeleting(false);
    }
  };

  // --- Format Helpers ---
  const formatFrequency = (f: string) => f.replace(/_/g, ' ');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-thb-text-primary flex items-center gap-2">
            <FiCalendar className="w-6 h-6 text-green-500" />
            Payroll Definitions
          </h1>
          <p className="text-thb-text-secondary mt-1">Configure payroll frequencies, cut-off dates, and payment methods</p>
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
              <FiPlus className="w-4 h-4" /> Add Definition
            </button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="thb-card thb-card-hover p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
              <FiCalendar className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <p className="text-xs font-medium text-thb-text-secondary">Total Definitions</p>
              <p className="text-xl font-bold text-thb-text-primary">{totalDefinitions}</p>
            </div>
          </div>
        </div>
        <div className="thb-card thb-card-hover p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
              <FiCheck className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-xs font-medium text-thb-text-secondary">Active</p>
              <p className="text-xl font-bold text-thb-text-primary">{activeCount}</p>
            </div>
          </div>
        </div>
        <div className="thb-card thb-card-hover p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
              <FiCalendar className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <p className="text-xs font-medium text-thb-text-secondary">Monthly</p>
              <p className="text-xl font-bold text-thb-text-primary">{monthlyCount}</p>
            </div>
          </div>
        </div>
        <div className="thb-card thb-card-hover p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center">
              <FiCreditCard className="w-5 h-5 text-teal-500" />
            </div>
            <div>
              <p className="text-xs font-medium text-thb-text-secondary">Direct Deposit</p>
              <p className="text-xl font-bold text-thb-text-primary">{depositEnabledCount}</p>
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
              placeholder="Search by name, country, or currency..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 min-w-[130px]"
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <select
            value={countryFilter}
            onChange={(e) => setCountryFilter(e.target.value)}
            className="px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 min-w-[150px]"
          >
            <option value="">All Countries</option>
            {COUNTRY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select
            value={frequencyFilter}
            onChange={(e) => setFrequencyFilter(e.target.value)}
            className="px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 min-w-[150px]"
          >
            <option value="">All Frequencies</option>
            {PAY_FREQUENCY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      {/* View Panel */}
      {viewingDefinition && (
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
                    <h2 className="text-lg font-semibold text-thb-text-primary">{viewingDefinition.name}</h2>
                    <p className="text-sm text-thb-text-secondary mt-0.5">
                      {viewingDefinition.countryCode} &middot; {viewingDefinition.currencyCode}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {isAdmin && (
                      <button
                        onClick={() => handleEdit(viewingDefinition)}
                        className="px-3 py-1.5 rounded-lg bg-green-500 text-white text-xs font-medium hover:bg-green-600 transition-colors flex items-center gap-1"
                      >
                        <FiEdit2 className="w-3.5 h-3.5" /> Edit
                      </button>
                    )}
                    <button
                      onClick={() => setViewingDefinition(null)}
                      className="p-2 rounded-lg text-thb-text-muted hover:text-thb-text-primary hover:bg-slate-100 transition-colors"
                    >
                      <FiX className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <DetailItem label="Name" value={viewingDefinition.name} />
                  <DetailItem label="Pay Frequency" value={formatFrequency(viewingDefinition.payFrequency)} badge={getFrequencyBadge(viewingDefinition.payFrequency)} />
                  <DetailItem label="Processing Cut-Off" value={`Day ${viewingDefinition.processingCutOff}`} />
                  <DetailItem label="Payment Day" value={`Day ${viewingDefinition.paymentDay}`} />
                  <DetailItem label="Currency" value={viewingDefinition.currencyCode} />
                  <DetailItem label="Country" value={viewingDefinition.countryCode} />
                  <DetailItem label="Direct Deposit" value={viewingDefinition.allowDirectDeposit} />
                  <DetailItem label="Cheque" value={viewingDefinition.allowCheque} />
                  <DetailItem label="Cash" value={viewingDefinition.allowCash} />
                  <DetailItem label="Costing Segments" value={viewingDefinition.costingSegments} />
                  <DetailItem label="Status" value={viewingDefinition.status} badge={getStatusBadge(viewingDefinition.status)} />
                  <DetailItem label="Effective From" value={viewingDefinition.effectiveFrom ? new Date(viewingDefinition.effectiveFrom).toLocaleDateString() : null} />
                  <DetailItem label="Effective To" value={viewingDefinition.effectiveTo ? new Date(viewingDefinition.effectiveTo).toLocaleDateString() : null} />
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
                {editingId ? 'Edit Payroll Definition' : 'Create Payroll Definition'}
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
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Name <span className="text-red-500 font-bold">*</span></label>
                  <input
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                    placeholder="e.g. India Monthly Payroll"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Company <span className="text-red-500 font-bold">*</span></label>
                  <select
                    required
                    value={form.companyId}
                    onChange={(e) => setForm({ ...form, companyId: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                  >
                    <option value="">Select Company</option>
                    {availableCompanies.map(c => (
                      <option key={c.id} value={c.id}>{c.name}{c.code ? ` (${c.code})` : ''}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Pay Frequency</label>
                  <select
                    value={form.payFrequency}
                    onChange={(e) => setForm({ ...form, payFrequency: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                  >
                    {PAY_FREQUENCY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Processing Cut-Off Day</label>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={form.processingCutOff}
                    onChange={(e) => setForm({ ...form, processingCutOff: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                    placeholder="e.g. 25"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Payment Day</label>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={form.paymentDay}
                    onChange={(e) => setForm({ ...form, paymentDay: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                    placeholder="e.g. 1"
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
              </div>
            </div>

            {/* Currency & Payment Methods */}
            <div className="mb-5">
              <h3 className="text-sm font-semibold text-thb-text-primary mb-3">Currency &amp; Payment Methods</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Currency</label>
                  <select
                    value={form.currencyCode}
                    onChange={(e) => setForm({ ...form, currencyCode: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                  >
                    {CURRENCY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 text-sm text-thb-text-secondary cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.allowDirectDeposit}
                      onChange={(e) => setForm({ ...form, allowDirectDeposit: e.target.checked })}
                      className="rounded border-thb-border"
                    />
                    <span className="font-medium">Direct Deposit</span>
                  </label>
                </div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 text-sm text-thb-text-secondary cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.allowCheque}
                      onChange={(e) => setForm({ ...form, allowCheque: e.target.checked })}
                      className="rounded border-thb-border"
                    />
                    <span className="font-medium">Cheque</span>
                  </label>
                </div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 text-sm text-thb-text-secondary cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.allowCash}
                      onChange={(e) => setForm({ ...form, allowCash: e.target.checked })}
                      className="rounded border-thb-border"
                    />
                    <span className="font-medium">Cash</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Costing & Effective Dates */}
            <div className="mb-5">
              <h3 className="text-sm font-semibold text-thb-text-primary mb-3">Costing &amp; Effective Dates</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Costing Segments (JSON)</label>
                  <input
                    value={form.costingSegments}
                    onChange={(e) => setForm({ ...form, costingSegments: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                    placeholder='e.g. ["department","cost_center"]'
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
                {submitting ? 'Saving...' : editingId ? 'Update Definition' : 'Create Definition'}
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
      ) : filteredDefinitions.length === 0 ? (
        <div className="thb-card p-12 text-center">
          <FiCalendar className="w-12 h-12 text-thb-text-muted mx-auto mb-3" />
          <p className="text-thb-text-secondary font-medium">No payroll definitions found</p>
          <p className="text-sm text-thb-text-muted mt-1">Create your first payroll definition to get started</p>
        </div>
      ) : (
        <div className="thb-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-thb-border">
                <tr>
                  {['Name', 'Frequency', 'Cut-Off', 'Pay Day', 'Currency', 'Country', 'Payment Methods', 'Status', 'Actions'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-thb-text-muted uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredDefinitions.map((d) => (
                  deleteConfirmId === d.id ? (
                    <tr key={d.id} className="bg-red-50">
                      <td colSpan={9} className="px-4 py-3">
                        <p className="text-sm text-red-700 font-medium mb-2">
                          Are you sure you want to deactivate &quot;{d.name}&quot;?
                        </p>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleDelete(d.id)}
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
                    <tr key={d.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-thb-text-primary">{d.name}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={getFrequencyBadge(d.payFrequency)}>{formatFrequency(d.payFrequency)}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-thb-text-secondary">Day {d.processingCutOff}</td>
                      <td className="px-4 py-3 text-sm text-thb-text-secondary">Day {d.paymentDay}</td>
                      <td className="px-4 py-3 text-sm text-thb-text-secondary">{d.currencyCode}</td>
                      <td className="px-4 py-3 text-sm text-thb-text-secondary">{d.countryCode}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 flex-wrap">
                          {d.allowDirectDeposit && <span className="thb-badge thb-badge-info text-[10px]">Deposit</span>}
                          {d.allowCheque && <span className="thb-badge thb-badge-warning text-[10px]">Cheque</span>}
                          {d.allowCash && <span className="thb-badge thb-badge-success text-[10px]">Cash</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={getStatusBadge(d.status)}>{d.status}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleView(d)}
                            className="p-1.5 rounded-md text-thb-text-muted hover:text-green-500 hover:bg-green-50 transition-colors"
                            title="View"
                          >
                            <FiEye className="w-4 h-4" />
                          </button>
                          {isAdmin && (
                            <>
                              <button
                                onClick={() => handleEdit(d)}
                                className="p-1.5 rounded-md text-thb-text-muted hover:text-amber-500 hover:bg-amber-50 transition-colors"
                                title="Edit"
                              >
                                <FiEdit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setDeleteConfirmId(d.id)}
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
    </div>
  );
}
