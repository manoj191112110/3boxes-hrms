'use client';

import { useAuthStore } from '@/store/authStore';
import { useCallback, useEffect, useState } from 'react';
import { FiDollarSign, FiPlus, FiEdit2, FiTrash2, FiEye, FiX, FiSearch, FiRefreshCw, FiTrendingUp, FiRepeat } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useCompanyContextStore } from '@/store/companyContextStore';

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

// --- Types ---
interface CurrencyConfig {
  id: string;
  legalEntityId: string;
  baseCurrency: string;
  payrollCurrency: string;
  reportingCurrency: string | null;
  exchangeRateSource: string;
  rateType: string;
  autoFetchEnabled: boolean;
  fetchFrequency: string | null;
  roundingPrecision: number;
  roundingRule: string;
  gainLossAccount: string | null;
  companyId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ExchangeRateRecord {
  id: string;
  fromCurrency: string;
  toCurrency: string;
  exchangeRate: number;
  rateDate: string;
  rateType: string;
  source: string;
  inverseRate: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// --- Constants ---
const CURRENCY_OPTIONS = [
  { value: 'INR', label: 'INR - Indian Rupee' },
  { value: 'USD', label: 'USD - US Dollar' },
  { value: 'GBP', label: 'GBP - British Pound' },
  { value: 'SGD', label: 'SGD - Singapore Dollar' },
  { value: 'AED', label: 'AED - UAE Dirham' },
  { value: 'AUD', label: 'AUD - Australian Dollar' },
  { value: 'EUR', label: 'EUR - Euro' },
  { value: 'CAD', label: 'CAD - Canadian Dollar' },
  { value: 'JPY', label: 'JPY - Japanese Yen' },
  { value: 'CNY', label: 'CNY - Chinese Yuan' },
];

const RATE_SOURCE_OPTIONS = [
  { value: 'CENTRAL_BANK', label: 'Central Bank' },
  { value: 'REUTERS', label: 'Reuters' },
  { value: 'BLOOMBERG', label: 'Bloomberg' },
  { value: 'MANUAL', label: 'Manual Entry' },
  { value: 'CUSTOM_API', label: 'Custom API' },
];

const RATE_TYPE_OPTIONS = [
  { value: 'SPOT', label: 'Spot Rate' },
  { value: 'MONTHLY_AVERAGE', label: 'Monthly Average' },
  { value: 'QUARTERLY_AVERAGE', label: 'Quarterly Average' },
  { value: 'CUSTOM', label: 'Custom' },
  { value: 'CONTRACTUAL', label: 'Contractual' },
];

const ROUNDING_RULE_OPTIONS = [
  { value: 'NEAREST', label: 'Nearest' },
  { value: 'UP', label: 'Round Up' },
  { value: 'DOWN', label: 'Round Down' },
  { value: 'BANKERS', label: 'Bankers Rounding' },
];

const FETCH_FREQUENCY_OPTIONS = [
  { value: 'DAILY', label: 'Daily' },
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'ON_DEMAND', label: 'On Demand' },
];

// --- Badge Helpers ---
function getSourceBadge(source: string) {
  const map: Record<string, string> = {
    CENTRAL_BANK: 'thb-badge thb-badge-info',
    REUTERS: 'thb-badge thb-badge-success',
    BLOOMBERG: 'thb-badge thb-badge-purple',
    MANUAL: 'thb-badge thb-badge-warning',
    CUSTOM_API: 'thb-badge thb-badge-info',
  };
  return map[source] || 'thb-badge thb-badge-info';
}

function getRateTypeBadge(type: string) {
  const map: Record<string, string> = {
    SPOT: 'thb-badge thb-badge-success',
    MONTHLY_AVERAGE: 'thb-badge thb-badge-info',
    QUARTERLY_AVERAGE: 'thb-badge thb-badge-info',
    CUSTOM: 'thb-badge thb-badge-warning',
    CONTRACTUAL: 'thb-badge thb-badge-purple',
  };
  return map[type] || 'thb-badge thb-badge-info';
}

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

// --- Empty Forms ---
const emptyConfigForm = {
  legalEntityId: '',
  baseCurrency: 'INR',
  payrollCurrency: 'INR',
  reportingCurrency: '',
  exchangeRateSource: 'MANUAL',
  rateType: 'SPOT',
  autoFetchEnabled: false,
  fetchFrequency: '',
  roundingPrecision: '2',
  roundingRule: 'NEAREST',
  gainLossAccount: '',
};

const emptyRateForm = {
  fromCurrency: 'INR',
  toCurrency: 'USD',
  exchangeRate: '',
  rateDate: '',
  rateType: 'SPOT',
  source: 'Manual Entry',
};

export default function CurrencyFXPage() {
  const { user } = useAuthStore();
  const effectiveCompanyId = useCompanyContextStore(s => s.effectiveCompanyId);
  const isAdmin = user?.role === 'super_admin' || user?.role === 'tenant_admin' || user?.role === 'admin';

  const [currencyConfigs, setCurrencyConfigs] = useState<CurrencyConfig[]>([]);
  const [exchangeRates, setExchangeRates] = useState<ExchangeRateRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'configs' | 'rates'>('configs');

  // Config form
  const [showConfigForm, setShowConfigForm] = useState(false);
  const [editingConfigId, setEditingConfigId] = useState<string | null>(null);
  const [configForm, setConfigForm] = useState({ ...emptyConfigForm });
  const [submitting, setSubmitting] = useState(false);

  // Rate form
  const [showRateForm, setShowRateForm] = useState(false);
  const [editingRateId, setEditingRateId] = useState<string | null>(null);
  const [rateForm, setRateForm] = useState({ ...emptyRateForm });
  const [submittingRate, setSubmittingRate] = useState(false);

  // View/Delete
  const [viewingConfig, setViewingConfig] = useState<CurrencyConfig | null>(null);
  const [viewingRate, setViewingRate] = useState<ExchangeRateRecord | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteType, setDeleteType] = useState<'config' | 'rate'>('config');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');

  // --- Data Fetching ---
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [currRes, rateRes] = await Promise.all([
        fetch(`/api/payroll/currency?${scopeQuery}` , { headers: getAuthHeaders() }),
        fetch(`/api/payroll/exchange-rates?${scopeQuery}` , { headers: getAuthHeaders() }),
      ]);

      if (currRes.ok) {
        const data = await currRes.json();
        setCurrencyConfigs(data.data?.currencyConfigs || []);
      }
      if (rateRes.ok) {
        const data = await rateRes.json();
        setExchangeRates(data.data || []);
      }
    } catch {
      toast.error('Failed to load currency data');
    } finally {
      setLoading(false);
    }
  }, []);
  const cid = effectiveCompanyId();
  const scopeQuery = cid ? `companyId=${cid}&` : '';


  useEffect(() => { queueMicrotask(() => fetchData()); }, [fetchData]);

  // --- Stats ---
  const totalConfigs = currencyConfigs.length;
  const totalRates = exchangeRates.length;
  const activeRates = exchangeRates.filter(r => r.isActive).length;
  const currencyPairs = new Set(exchangeRates.map(r => `${r.fromCurrency}-${r.toCurrency}`)).size;

  // --- Filtered ---
  const filteredConfigs = currencyConfigs.filter(c => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return c.baseCurrency.toLowerCase().includes(q) || c.payrollCurrency.toLowerCase().includes(q) || c.exchangeRateSource.toLowerCase().includes(q);
  });

  const filteredRates = exchangeRates.filter(r => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return r.fromCurrency.toLowerCase().includes(q) || r.toCurrency.toLowerCase().includes(q) || r.source.toLowerCase().includes(q);
  });

  // --- Config Handlers ---
  const handleAddConfig = () => {
    setConfigForm({ ...emptyConfigForm });
    setEditingConfigId(null);
    setShowConfigForm(true);
    setViewingConfig(null);
    setTimeout(() => document.getElementById('config-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  const handleEditConfig = (c: CurrencyConfig) => {
    setConfigForm({
      legalEntityId: c.legalEntityId,
      baseCurrency: c.baseCurrency,
      payrollCurrency: c.payrollCurrency,
      reportingCurrency: c.reportingCurrency || '',
      exchangeRateSource: c.exchangeRateSource,
      rateType: c.rateType,
      autoFetchEnabled: c.autoFetchEnabled,
      fetchFrequency: c.fetchFrequency || '',
      roundingPrecision: String(c.roundingPrecision),
      roundingRule: c.roundingRule,
      gainLossAccount: c.gainLossAccount || '',
    });
    setEditingConfigId(c.id);
    setShowConfigForm(true);
    setViewingConfig(null);
    setTimeout(() => document.getElementById('config-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  const handleSubmitConfig = async () => {
    if (!configForm.legalEntityId.trim()) { toast.error('Legal Entity ID is required'); return; }
    setSubmitting(true);
    try {
      const payload = {
        ...configForm,
        reportingCurrency: configForm.reportingCurrency || null,
        fetchFrequency: configForm.fetchFrequency || null,
        gainLossAccount: configForm.gainLossAccount || null,
        roundingPrecision: parseInt(configForm.roundingPrecision) || 2,
      };
      if (editingConfigId) {
        const res = await fetch(`/api/payroll/currency/${editingConfigId}?${scopeQuery}` , {
          method: 'PUT', headers: getAuthHeaders(), body: JSON.stringify(payload),
        });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed to update'); }
        toast.success('Currency config updated');
      } else {
        const res = await fetch(`/api/payroll/currency?${scopeQuery}` , {
          method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(payload),
        });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed to create'); }
        toast.success('Currency config created');
      }
      setShowConfigForm(false);
      setEditingConfigId(null);
      fetchData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setSubmitting(false);
    }
  };

  // --- Rate Handlers ---
  const handleAddRate = () => {
    setRateForm({ ...emptyRateForm });
    setEditingRateId(null);
    setShowRateForm(true);
    setViewingRate(null);
    setTimeout(() => document.getElementById('rate-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  const handleEditRate = (r: ExchangeRateRecord) => {
    setRateForm({
      fromCurrency: r.fromCurrency,
      toCurrency: r.toCurrency,
      exchangeRate: String(r.exchangeRate),
      rateDate: r.rateDate ? new Date(r.rateDate).toISOString().split('T')[0] : '',
      rateType: r.rateType,
      source: r.source,
    });
    setEditingRateId(r.id);
    setShowRateForm(true);
    setViewingRate(null);
    setTimeout(() => document.getElementById('rate-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  const handleSubmitRate = async () => {
    if (!rateForm.exchangeRate) { toast.error('Exchange rate is required'); return; }
    if (!rateForm.rateDate) { toast.error('Rate date is required'); return; }
    setSubmittingRate(true);
    try {
      const payload = {
        fromCurrency: rateForm.fromCurrency,
        toCurrency: rateForm.toCurrency,
        exchangeRate: parseFloat(rateForm.exchangeRate),
        rateDate: new Date(rateForm.rateDate).toISOString(),
        rateType: rateForm.rateType,
        source: rateForm.source,
        inverseRate: 1 / parseFloat(rateForm.exchangeRate),
        isActive: true,
      };
      if (editingRateId) {
        const res = await fetch(`/api/payroll/exchange-rates/${editingRateId}?${scopeQuery}` , {
          method: 'PUT', headers: getAuthHeaders(), body: JSON.stringify(payload),
        });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed to update'); }
        toast.success('Exchange rate updated');
      } else {
        const res = await fetch(`/api/payroll/exchange-rates?${scopeQuery}` , {
          method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(payload),
        });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed to create'); }
        toast.success('Exchange rate created');
      }
      setShowRateForm(false);
      setEditingRateId(null);
      fetchData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setSubmittingRate(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      const endpoint = deleteType === 'config' ? `/api/payroll/currency/${id}` : `/api/payroll/exchange-rates/${id}`;
      const res = await fetch(endpoint, { method: 'DELETE', headers: getAuthHeaders() });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed to delete'); }
      toast.success('Deleted successfully');
      setDeleteConfirmId(null);
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-thb-text-primary flex items-center gap-2">
            <FiDollarSign className="w-6 h-6 text-teal-500" />
            Currency & FX Rates
          </h1>
          <p className="text-thb-text-secondary mt-1">Configure multi-currency processing and exchange rates</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => fetchData()} className="p-2.5 rounded-lg border border-thb-border text-thb-text-secondary hover:bg-slate-50 transition-colors" title="Refresh">
            <FiRefreshCw className="w-4 h-4" />
          </button>
          {isAdmin && (
            <>
              <button onClick={handleAddRate} className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 font-medium text-sm shadow-sm shadow-emerald-500/25 transition-colors">
                <FiTrendingUp className="w-4 h-4" /> Add Rate
              </button>
              <button onClick={handleAddConfig} className="inline-flex items-center gap-2 px-4 py-2.5 bg-green-500 text-white rounded-lg hover:bg-green-600 font-medium text-sm shadow-sm shadow-green-500/25 transition-colors">
                <FiPlus className="w-4 h-4" /> Add Config
              </button>
            </>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="thb-card thb-card-hover p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center"><FiDollarSign className="w-5 h-5 text-green-500" /></div>
            <div>
              <p className="text-xs font-medium text-thb-text-secondary">Currency Configs</p>
              <p className="text-xl font-bold text-thb-text-primary">{totalConfigs}</p>
            </div>
          </div>
        </div>
        <div className="thb-card thb-card-hover p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center"><FiTrendingUp className="w-5 h-5 text-emerald-500" /></div>
            <div>
              <p className="text-xs font-medium text-thb-text-secondary">Exchange Rates</p>
              <p className="text-xl font-bold text-thb-text-primary">{totalRates}</p>
            </div>
          </div>
        </div>
        <div className="thb-card thb-card-hover p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center"><FiRepeat className="w-5 h-5 text-amber-500" /></div>
            <div>
              <p className="text-xs font-medium text-thb-text-secondary">Currency Pairs</p>
              <p className="text-xl font-bold text-thb-text-primary">{currencyPairs}</p>
            </div>
          </div>
        </div>
        <div className="thb-card thb-card-hover p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center"><FiTrendingUp className="w-5 h-5 text-teal-500" /></div>
            <div>
              <p className="text-xs font-medium text-thb-text-secondary">Active Rates</p>
              <p className="text-xl font-bold text-thb-text-primary">{activeRates}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('configs')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'configs' ? 'bg-white text-green-600 shadow-sm' : 'text-thb-text-secondary hover:text-thb-text-primary'}`}
        >
          Currency Configurations
        </button>
        <button
          onClick={() => setActiveTab('rates')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'rates' ? 'bg-white text-green-600 shadow-sm' : 'text-thb-text-secondary hover:text-thb-text-primary'}`}
        >
          Exchange Rates
        </button>
      </div>

      {/* Search */}
      <div className="thb-card p-4">
        <div className="relative">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-thb-text-muted" />
          <input
            type="text"
            placeholder={`Search by ${activeTab === 'configs' ? 'base/payroll currency, source' : 'currency pair, source'}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
          />
        </div>
      </div>

      {/* View Panel - Config */}
      {viewingConfig && (
        <div id="view-panel" className="thb-card border-l-4 border-l-teal-500">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold text-thb-text-primary">Currency Configuration</h2>
                <p className="text-sm text-thb-text-secondary mt-0.5">{viewingConfig.baseCurrency} → {viewingConfig.payrollCurrency}</p>
              </div>
              <div className="flex items-center gap-2">
                {isAdmin && <button onClick={() => handleEditConfig(viewingConfig)} className="px-3 py-1.5 rounded-lg bg-green-500 text-white text-xs font-medium hover:bg-green-600 transition-colors flex items-center gap-1"><FiEdit2 className="w-3.5 h-3.5" /> Edit</button>}
                <button onClick={() => setViewingConfig(null)} className="p-2 rounded-lg text-thb-text-muted hover:text-thb-text-primary hover:bg-slate-100 transition-colors"><FiX className="w-5 h-5" /></button>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <DetailItem label="Base Currency" value={viewingConfig.baseCurrency} />
              <DetailItem label="Payroll Currency" value={viewingConfig.payrollCurrency} />
              <DetailItem label="Reporting Currency" value={viewingConfig.reportingCurrency} />
              <DetailItem label="Rate Source" value={formatStr(viewingConfig.exchangeRateSource)} badge={getSourceBadge(viewingConfig.exchangeRateSource)} />
              <DetailItem label="Rate Type" value={formatStr(viewingConfig.rateType)} badge={getRateTypeBadge(viewingConfig.rateType)} />
              <DetailItem label="Auto Fetch" value={viewingConfig.autoFetchEnabled} />
              <DetailItem label="Fetch Frequency" value={viewingConfig.fetchFrequency ? formatStr(viewingConfig.fetchFrequency) : null} />
              <DetailItem label="Rounding Precision" value={viewingConfig.roundingPrecision} />
              <DetailItem label="Rounding Rule" value={formatStr(viewingConfig.roundingRule)} />
              <DetailItem label="Gain/Loss Account" value={viewingConfig.gainLossAccount} />
              <DetailItem label="Legal Entity" value={viewingConfig.legalEntityId} />
            </div>
          </div>
        </div>
      )}

      {/* View Panel - Rate */}
      {viewingRate && (
        <div className="thb-card border-l-4 border-l-emerald-500">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold text-thb-text-primary">Exchange Rate</h2>
                <p className="text-sm text-thb-text-secondary mt-0.5">1 {viewingRate.fromCurrency} = {viewingRate.exchangeRate} {viewingRate.toCurrency}</p>
              </div>
              <div className="flex items-center gap-2">
                {isAdmin && <button onClick={() => handleEditRate(viewingRate)} className="px-3 py-1.5 rounded-lg bg-green-500 text-white text-xs font-medium hover:bg-green-600 transition-colors flex items-center gap-1"><FiEdit2 className="w-3.5 h-3.5" /> Edit</button>}
                <button onClick={() => setViewingRate(null)} className="p-2 rounded-lg text-thb-text-muted hover:text-thb-text-primary hover:bg-slate-100 transition-colors"><FiX className="w-5 h-5" /></button>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <DetailItem label="From Currency" value={viewingRate.fromCurrency} />
              <DetailItem label="To Currency" value={viewingRate.toCurrency} />
              <DetailItem label="Exchange Rate" value={viewingRate.exchangeRate} />
              <DetailItem label="Inverse Rate" value={viewingRate.inverseRate} />
              <DetailItem label="Rate Date" value={viewingRate.rateDate ? new Date(viewingRate.rateDate).toLocaleDateString() : null} />
              <DetailItem label="Rate Type" value={formatStr(viewingRate.rateType)} badge={getRateTypeBadge(viewingRate.rateType)} />
              <DetailItem label="Source" value={viewingRate.source} />
              <DetailItem label="Active" value={viewingRate.isActive} badge={viewingRate.isActive ? 'thb-badge thb-badge-success' : 'thb-badge thb-badge-error'} />
            </div>
          </div>
        </div>
      )}

      {/* Config Form */}
      {showConfigForm && (
        <div id="config-form" className="thb-card border-l-4 border-l-green-500">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-thb-text-primary">{editingConfigId ? 'Edit Currency Config' : 'Create Currency Config'}</h2>
              <button onClick={() => { setShowConfigForm(false); setEditingConfigId(null); }} className="p-2 rounded-lg text-thb-text-muted hover:text-thb-text-primary hover:bg-slate-100 transition-colors"><FiX className="w-5 h-5" /></button>
            </div>
            <div className="mb-5">
              <h3 className="text-sm font-semibold text-thb-text-primary mb-3">Entity & Currency</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Legal Entity ID <span className="text-red-500 font-bold">*</span></label>
                  <input value={configForm.legalEntityId} onChange={(e) => setConfigForm({ ...configForm, legalEntityId: e.target.value })} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" placeholder="e.g. LE-001" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Base Currency <span className="text-red-500 font-bold">*</span></label>
                  <select value={configForm.baseCurrency} onChange={(e) => setConfigForm({ ...configForm, baseCurrency: e.target.value })} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400">
                    {CURRENCY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Payroll Currency <span className="text-red-500 font-bold">*</span></label>
                  <select value={configForm.payrollCurrency} onChange={(e) => setConfigForm({ ...configForm, payrollCurrency: e.target.value })} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400">
                    {CURRENCY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Reporting Currency</label>
                  <select value={configForm.reportingCurrency} onChange={(e) => setConfigForm({ ...configForm, reportingCurrency: e.target.value })} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400">
                    <option value="">Same as Base</option>
                    {CURRENCY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="mb-5">
              <h3 className="text-sm font-semibold text-thb-text-primary mb-3">Rate Configuration</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Rate Source</label>
                  <select value={configForm.exchangeRateSource} onChange={(e) => setConfigForm({ ...configForm, exchangeRateSource: e.target.value })} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400">
                    {RATE_SOURCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Rate Type</label>
                  <select value={configForm.rateType} onChange={(e) => setConfigForm({ ...configForm, rateType: e.target.value })} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400">
                    {RATE_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Rounding Rule</label>
                  <select value={configForm.roundingRule} onChange={(e) => setConfigForm({ ...configForm, roundingRule: e.target.value })} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400">
                    {ROUNDING_RULE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Rounding Precision</label>
                  <input type="number" value={configForm.roundingPrecision} onChange={(e) => setConfigForm({ ...configForm, roundingPrecision: e.target.value })} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" />
                </div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 text-sm text-thb-text-secondary cursor-pointer">
                    <input type="checkbox" checked={configForm.autoFetchEnabled} onChange={(e) => setConfigForm({ ...configForm, autoFetchEnabled: e.target.checked })} className="rounded border-thb-border" />
                    <span className="font-medium">Auto Fetch Rates</span>
                  </label>
                </div>
                {configForm.autoFetchEnabled && (
                  <div>
                    <label className="block text-xs font-medium text-thb-text-secondary mb-1">Fetch Frequency</label>
                    <select value={configForm.fetchFrequency} onChange={(e) => setConfigForm({ ...configForm, fetchFrequency: e.target.value })} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400">
                      <option value="">Select</option>
                      {FETCH_FREQUENCY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                )}
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Gain/Loss GL Account</label>
                  <input value={configForm.gainLossAccount} onChange={(e) => setConfigForm({ ...configForm, gainLossAccount: e.target.value })} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" placeholder="e.g. GL-EXCH-001" />
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-thb-border">
              <button onClick={() => { setShowConfigForm(false); setEditingConfigId(null); }} className="px-4 py-2.5 rounded-lg border border-thb-border text-sm font-medium text-thb-text-secondary hover:bg-slate-50 transition-colors">Cancel</button>
              <button onClick={handleSubmitConfig} disabled={submitting} className="px-6 py-2.5 rounded-lg bg-green-500 text-white text-sm font-medium hover:bg-green-600 disabled:opacity-50 shadow-sm shadow-green-500/25 transition-colors">
                {submitting ? 'Saving...' : editingConfigId ? 'Update Config' : 'Create Config'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rate Form */}
      {showRateForm && (
        <div id="rate-form" className="thb-card border-l-4 border-l-emerald-500">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-thb-text-primary">{editingRateId ? 'Edit Exchange Rate' : 'Add Exchange Rate'}</h2>
              <button onClick={() => { setShowRateForm(false); setEditingRateId(null); }} className="p-2 rounded-lg text-thb-text-muted hover:text-thb-text-primary hover:bg-slate-100 transition-colors"><FiX className="w-5 h-5" /></button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">From Currency <span className="text-red-500 font-bold">*</span></label>
                <select value={rateForm.fromCurrency} onChange={(e) => setRateForm({ ...rateForm, fromCurrency: e.target.value })} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400">
                  {CURRENCY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">To Currency <span className="text-red-500 font-bold">*</span></label>
                <select value={rateForm.toCurrency} onChange={(e) => setRateForm({ ...rateForm, toCurrency: e.target.value })} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400">
                  {CURRENCY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Exchange Rate <span className="text-red-500 font-bold">*</span></label>
                <input type="number" step="0.000001" value={rateForm.exchangeRate} onChange={(e) => setRateForm({ ...rateForm, exchangeRate: e.target.value })} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" placeholder="e.g. 83.45" />
              </div>
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Rate Date <span className="text-red-500 font-bold">*</span></label>
                <input type="date" value={rateForm.rateDate} onChange={(e) => setRateForm({ ...rateForm, rateDate: e.target.value })} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Rate Type</label>
                <select value={rateForm.rateType} onChange={(e) => setRateForm({ ...rateForm, rateType: e.target.value })} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400">
                  {RATE_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Source</label>
                <input value={rateForm.source} onChange={(e) => setRateForm({ ...rateForm, source: e.target.value })} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" placeholder="e.g. RBI, ECB, Manual Entry" />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-thb-border">
              <button onClick={() => { setShowRateForm(false); setEditingRateId(null); }} className="px-4 py-2.5 rounded-lg border border-thb-border text-sm font-medium text-thb-text-secondary hover:bg-slate-50 transition-colors">Cancel</button>
              <button onClick={handleSubmitRate} disabled={submittingRate} className="px-6 py-2.5 rounded-lg bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 disabled:opacity-50 shadow-sm shadow-emerald-500/25 transition-colors">
                {submittingRate ? 'Saving...' : editingRateId ? 'Update Rate' : 'Add Rate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Data Table */}
      {loading ? (
        <div className="thb-card overflow-hidden">
          <div className="p-5 space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-12 bg-slate-100 rounded animate-pulse" />)}</div>
        </div>
      ) : activeTab === 'configs' ? (
        filteredConfigs.length === 0 ? (
          <div className="thb-card p-12 text-center">
            <FiDollarSign className="w-12 h-12 text-thb-text-muted mx-auto mb-3" />
            <p className="text-thb-text-secondary font-medium">No currency configurations found</p>
            <p className="text-sm text-thb-text-muted mt-1">Create your first currency configuration to get started</p>
          </div>
        ) : (
          <div className="thb-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-thb-border">
                  <tr>
                    {['Base', 'Payroll', 'Reporting', 'Rate Source', 'Rate Type', 'Auto Fetch', 'Rounding', 'Actions'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-thb-text-muted uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredConfigs.map(c => (
                    deleteConfirmId === c.id && deleteType === 'config' ? (
                      <tr key={c.id} className="bg-red-50">
                        <td colSpan={8} className="px-4 py-3">
                          <p className="text-sm text-red-700 font-medium mb-2">Delete this currency configuration?</p>
                          <div className="flex items-center gap-2">
                            <button onClick={() => handleDelete(c.id)} disabled={deleting} className="px-3 py-1.5 bg-red-500 text-white text-xs font-medium rounded-lg hover:bg-red-600 disabled:opacity-50">{deleting ? 'Deleting...' : 'Confirm'}</button>
                            <button onClick={() => setDeleteConfirmId(null)} className="px-3 py-1.5 border border-thb-border text-xs font-medium rounded-lg hover:bg-slate-50">Cancel</button>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-3 text-sm font-medium text-thb-text-primary">{c.baseCurrency}</td>
                        <td className="px-4 py-3 text-sm text-thb-text-secondary">{c.payrollCurrency}</td>
                        <td className="px-4 py-3 text-sm text-thb-text-secondary">{c.reportingCurrency || '—'}</td>
                        <td className="px-4 py-3"><span className={getSourceBadge(c.exchangeRateSource)}>{formatStr(c.exchangeRateSource)}</span></td>
                        <td className="px-4 py-3"><span className={getRateTypeBadge(c.rateType)}>{formatStr(c.rateType)}</span></td>
                        <td className="px-4 py-3 text-sm">{c.autoFetchEnabled ? <span className="thb-badge thb-badge-success">Yes</span> : <span className="thb-badge thb-badge-error">No</span>}</td>
                        <td className="px-4 py-3 text-sm text-thb-text-secondary">{formatStr(c.roundingRule)} ({c.roundingPrecision}dp)</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button onClick={() => { setViewingConfig(c); setViewingRate(null); }} className="p-1.5 rounded-lg text-thb-text-muted hover:text-green-500 hover:bg-green-50 transition-colors" title="View"><FiEye className="w-4 h-4" /></button>
                            {isAdmin && <button onClick={() => handleEditConfig(c)} className="p-1.5 rounded-lg text-thb-text-muted hover:text-amber-500 hover:bg-amber-50 transition-colors" title="Edit"><FiEdit2 className="w-4 h-4" /></button>}
                            {isAdmin && <button onClick={() => { setDeleteConfirmId(c.id); setDeleteType('config'); }} className="p-1.5 rounded-lg text-thb-text-muted hover:text-red-500 hover:bg-red-50 transition-colors" title="Delete"><FiTrash2 className="w-4 h-4" /></button>}
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
      ) : filteredRates.length === 0 ? (
        <div className="thb-card p-12 text-center">
          <FiTrendingUp className="w-12 h-12 text-thb-text-muted mx-auto mb-3" />
          <p className="text-thb-text-secondary font-medium">No exchange rates found</p>
          <p className="text-sm text-thb-text-muted mt-1">Add your first exchange rate to get started</p>
        </div>
      ) : (
        <div className="thb-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-thb-border">
                <tr>
                  {['From', 'To', 'Rate', 'Date', 'Type', 'Source', 'Active', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-thb-text-muted uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRates.map(r => (
                  deleteConfirmId === r.id && deleteType === 'rate' ? (
                    <tr key={r.id} className="bg-red-50">
                      <td colSpan={8} className="px-4 py-3">
                        <p className="text-sm text-red-700 font-medium mb-2">Delete this exchange rate?</p>
                        <div className="flex items-center gap-2">
                          <button onClick={() => handleDelete(r.id)} disabled={deleting} className="px-3 py-1.5 bg-red-500 text-white text-xs font-medium rounded-lg hover:bg-red-600 disabled:opacity-50">{deleting ? 'Deleting...' : 'Confirm'}</button>
                          <button onClick={() => setDeleteConfirmId(null)} className="px-3 py-1.5 border border-thb-border text-xs font-medium rounded-lg hover:bg-slate-50">Cancel</button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3 text-sm font-medium text-thb-text-primary">{r.fromCurrency}</td>
                      <td className="px-4 py-3 text-sm text-thb-text-secondary">{r.toCurrency}</td>
                      <td className="px-4 py-3 text-sm font-medium text-thb-text-primary">{r.exchangeRate}</td>
                      <td className="px-4 py-3 text-sm text-thb-text-secondary">{r.rateDate ? new Date(r.rateDate).toLocaleDateString() : '—'}</td>
                      <td className="px-4 py-3"><span className={getRateTypeBadge(r.rateType)}>{formatStr(r.rateType)}</span></td>
                      <td className="px-4 py-3 text-sm text-thb-text-secondary">{r.source}</td>
                      <td className="px-4 py-3">{r.isActive ? <span className="thb-badge thb-badge-success">Active</span> : <span className="thb-badge thb-badge-error">Inactive</span>}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => { setViewingRate(r); setViewingConfig(null); }} className="p-1.5 rounded-lg text-thb-text-muted hover:text-green-500 hover:bg-green-50 transition-colors" title="View"><FiEye className="w-4 h-4" /></button>
                          {isAdmin && <button onClick={() => handleEditRate(r)} className="p-1.5 rounded-lg text-thb-text-muted hover:text-amber-500 hover:bg-amber-50 transition-colors" title="Edit"><FiEdit2 className="w-4 h-4" /></button>}
                          {isAdmin && <button onClick={() => { setDeleteConfirmId(r.id); setDeleteType('rate'); }} className="p-1.5 rounded-lg text-thb-text-muted hover:text-red-500 hover:bg-red-50 transition-colors" title="Delete"><FiTrash2 className="w-4 h-4" /></button>}
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
