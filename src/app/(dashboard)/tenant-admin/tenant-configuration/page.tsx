'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  FiGlobe, FiDollarSign, FiMessageSquare, FiFileText,
  FiPlus, FiEdit2, FiTrash2, FiX, FiCheck, FiSearch,
  FiRefreshCw, FiSettings, FiShield, FiInfo, FiChevronDown,
  FiChevronRight, FiCopy, FiSave, FiAlertTriangle, FiUsers, FiTrendingUp,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

// ─── Types ───
interface CountryMaster {
  code: string; name: string; currency: string; language: string;
  payrollFrequency: string; taxRegime: string | null; workingHours: number;
  workingDays: number; overtimeMultiplier: number;
  pf: boolean; esi: boolean; gratuity: boolean; socialSecurity: boolean;
  pension: boolean; medicaid: boolean; labourLaw: string;
  terminationNotice: number; probation: number; annualLeave: number;
  dataResidency: boolean; dataRegion: string;
}

interface CurrencyMaster {
  code: string; name: string; symbol: string;
}

interface LanguageMaster {
  code: string; name: string; rtl: boolean;
  ui: boolean; docs: boolean; email: boolean; help: boolean;
}

interface TenantCountryAccess {
  id: string; countryCode: string; countryName: string; isActive: boolean;
  payrollFrequencyDefault: string; payrollCurrencyDefault: string;
  taxRegimeDefault: string | null; workingHoursPerWeek: number;
  workingDaysPerWeek: number; overtimeMultiplier: number;
  pfEnabled: boolean; esiEnabled: boolean; gratuityEnabled: boolean;
  socialSecurityEnabled: boolean; pensionEnabled: boolean; medicaidEnabled: boolean;
  labourLawCode: string | null; terminationNoticePeriod: number;
  probationPeriod: number; annualLeaveEntitlement: number;
  dataResidencyRequired: boolean; dataResidencyRegion: string | null;
  isOverridden: boolean; overrideNotes: string | null;
  accessGrantedAt: string;
}

interface TenantCurrencyAccess {
  id: string; currencyCode: string; currencyName: string; currencySymbol: string;
  isActive: boolean; exchangeRateSource: string; autoFetchEnabled: boolean;
  fetchFrequency: string | null; roundingPrecision: number; roundingRule: string;
  gainLossAccount: string | null; isOverridden: boolean; overrideNotes: string | null;
}

interface TenantLanguageAccess {
  id: string; languageCode: string; languageName: string; isActive: boolean;
  uiTranslated: boolean; documentTemplates: boolean; emailTemplates: boolean;
  helpArticles: boolean; isRTL: boolean; isOverridden: boolean; overrideNotes: string | null;
}

interface TenantPayrollPolicy {
  id: string; countryCode: string; countryName: string | null;
  policyName: string; policyType: string; category: string;
  policyContent: string; source: string; status: string;
  effectiveFrom: string; effectiveTo: string | null;
  version: string; isEditable: boolean; isOverridden: boolean;
  overrideHistory: string | null; notes: string | null;
  createdAt: string; updatedAt: string;
}

interface TenantConfiguration {
  id: string; tenantId: string;
  autoProvisionPayroll: boolean; autoProvisionCompliance: boolean;
  autoProvisionTaxSlabs: boolean; autoProvisionMinWage: boolean;
  activeCountryCount: number; activeCurrencyCount: number;
  activeLanguageCount: number; estimatedMonthlyCost: number;
  estimatedAnnualCost: number; customisationTier: string;
  maxUsers: number; maxCompanies: number; maxEmployees: number;
  notes: string | null;
  countries: TenantCountryAccess[];
  currencies: TenantCurrencyAccess[];
  languages: TenantLanguageAccess[];
  policies: TenantPayrollPolicy[];
}

// ─── Badge helpers ───
const tierBadge: Record<string, string> = {
  standard: 'bg-gray-100 text-gray-700',
  custom: 'bg-green-100 text-green-700',
  full: 'bg-teal-100 text-teal-700',
};

const sourceBadge: Record<string, string> = {
  system_default: 'bg-green-100 text-green-700',
  tenant_override: 'bg-orange-100 text-orange-700',
  custom: 'bg-green-100 text-green-700',
};

const statusBadge: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  inactive: 'bg-gray-100 text-gray-500',
  draft: 'bg-yellow-100 text-yellow-700',
};

const categoryBadge: Record<string, string> = {
  payroll: 'bg-green-100 text-green-700',
  leave: 'bg-green-100 text-green-700',
  compliance: 'bg-red-100 text-red-700',
  benefits: 'bg-teal-100 text-teal-700',
  labour_law: 'bg-orange-100 text-orange-700',
  custom: 'bg-gray-100 text-gray-700',
};

export default function TenantConfigurationPage() {
  const { user } = useAuthStore();
  const isSuperAdmin = user?.role === 'super_admin';
  const isTenantAdmin = user?.role === 'tenant_admin';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<TenantConfiguration | null>(null);
  const [masterData, setMasterData] = useState<{
    countries: CountryMaster[];
    currencies: CurrencyMaster[];
    languages: LanguageMaster[];
  }>({ countries: [], currencies: [], languages: [] });

  const [activeTab, setActiveTab] = useState<'countries' | 'currencies' | 'languages' | 'policies' | 'settings'>('countries');
  const [showAddModal, setShowAddModal] = useState(false);
  const [addType, setAddType] = useState<'country' | 'currency' | 'language' | 'policy'>('country');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Policy editing
  const [editingPolicy, setEditingPolicy] = useState<TenantPayrollPolicy | null>(null);
  const [editPolicyContent, setEditPolicyContent] = useState('');
  const [editPolicyName, setEditPolicyName] = useState('');
  const [editPolicyNotes, setEditPolicyNotes] = useState('');

  // Country editing
  const [editingCountry, setEditingCountry] = useState<TenantCountryAccess | null>(null);

  // New policy form
  const [newPolicy, setNewPolicy] = useState({
    countryCode: '', policyName: '', policyType: 'CUSTOM', category: 'custom',
    policyContent: '{}', notes: '',
  });

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/tenant-configuration', { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Failed to fetch configuration');
      const data = await res.json();
      setConfig(data.configuration);
      setMasterData(data.masterData || { countries: [], currencies: [], languages: [] });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg || 'Failed to load configuration');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  // ─── Computed ───
  const availableCountries = useMemo(() => {
    if (!config) return masterData.countries;
    const activeCodes = new Set(config.countries.map(c => c.countryCode));
    return masterData.countries.filter(c => !activeCodes.has(c.code));
  }, [config, masterData.countries]);

  const availableCurrencies = useMemo(() => {
    if (!config) return masterData.currencies;
    const activeCodes = new Set(config.currencies.map(c => c.currencyCode));
    return masterData.currencies.filter(c => !activeCodes.has(c.code));
  }, [config, masterData.currencies]);

  const availableLanguages = useMemo(() => {
    if (!config) return masterData.languages;
    const activeCodes = new Set(config.languages.map(l => l.languageCode));
    return masterData.languages.filter(l => !activeCodes.has(l.code));
  }, [config, masterData.languages]);

  const filteredAvailable = useMemo(() => {
    if (addType === 'country') return availableCountries.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()) || c.code.toLowerCase().includes(searchTerm.toLowerCase()));
    if (addType === 'currency') return availableCurrencies.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()) || c.code.toLowerCase().includes(searchTerm.toLowerCase()));
    if (addType === 'language') return availableLanguages.filter(l => l.name.toLowerCase().includes(searchTerm.toLowerCase()) || l.code.toLowerCase().includes(searchTerm.toLowerCase()));
    return [];
  }, [addType, availableCountries, availableCurrencies, availableLanguages, searchTerm]);

  const policiesByCountry = useMemo(() => {
    if (!config) return {};
    const grouped: Record<string, TenantPayrollPolicy[]> = {};
    for (const p of config.policies) {
      if (!grouped[p.countryCode]) grouped[p.countryCode] = [];
      grouped[p.countryCode].push(p);
    }
    return grouped;
  }, [config]);

  // ─── Actions ───
  const handleAddItems = async () => {
    if (selectedItems.length === 0) { toast.error('Select at least one item'); return; }
    setSaving(true);
    try {
      let action = '';
      if (addType === 'country') action = 'add_countries';
      if (addType === 'currency') action = 'add_currencies';
      if (addType === 'language') action = 'add_languages';

      const body: Record<string, unknown> = { action };
      if (addType === 'country') body.countryCodes = selectedItems;
      if (addType === 'currency') body.currencyCodes = selectedItems;
      if (addType === 'language') body.languageCodes = selectedItems;

      const res = await fetch('/api/tenant-configuration', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(body),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed'); }
      toast.success(`Added ${selectedItems.length} ${addType}(ies) with auto-provisioned policies`);
      setSelectedItems([]);
      setShowAddModal(false);
      setSearchTerm('');
      fetchConfig();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveAccess = async (id: string, type: 'country' | 'currency' | 'language') => {
    if (!confirm(`Remove this ${type} access? Related policies will be deactivated.`)) return;
    setSaving(true);
    try {
      const res = await fetch('/api/tenant-configuration', {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ action: `remove_${type}`, id }),
      });
      if (!res.ok) throw new Error('Failed');
      toast.success(`${type} access removed`);
      fetchConfig();
    } catch { toast.error('Failed to remove'); }
    finally { setSaving(false); }
  };

  const handleUpdateConfig = async (updates: Record<string, unknown>) => {
    setSaving(true);
    try {
      const res = await fetch('/api/tenant-configuration', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ action: 'update_config', ...updates }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed'); }
      toast.success('Configuration updated');
      fetchConfig();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally { setSaving(false); }
  };

  const handleUpdateCountry = async (id: string, updates: Record<string, unknown>) => {
    setSaving(true);
    try {
      const res = await fetch('/api/tenant-configuration', {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ action: 'update_country', id, ...updates }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed'); }
      toast.success('Country settings updated');
      setEditingCountry(null);
      fetchConfig();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally { setSaving(false); }
  };

  const handleSavePolicy = async () => {
    if (!editingPolicy) return;
    setSaving(true);
    try {
      const res = await fetch('/api/tenant-configuration', {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          action: 'update_policy',
          id: editingPolicy.id,
          policyName: editPolicyName,
          policyContent: editPolicyContent,
          notes: editPolicyNotes,
        }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed'); }
      toast.success('Policy updated');
      setEditingPolicy(null);
      fetchConfig();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally { setSaving(false); }
  };

  const handleCreatePolicy = async () => {
    if (!newPolicy.countryCode || !newPolicy.policyName || !newPolicy.policyContent) {
      toast.error('Fill all required fields');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/tenant-configuration', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ action: 'create_policy', ...newPolicy }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed'); }
      toast.success('Policy created');
      setShowAddModal(false);
      setNewPolicy({ countryCode: '', policyName: '', policyType: 'CUSTOM', category: 'custom', policyContent: '{}', notes: '' });
      fetchConfig();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally { setSaving(false); }
  };

  const handleDeletePolicy = async (policyId: string) => {
    if (!confirm('Delete this policy?')) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/tenant-configuration?policyId=${policyId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error('Failed');
      toast.success('Policy deleted');
      fetchConfig();
    } catch { toast.error('Failed to delete'); }
    finally { setSaving(false); }
  };

  const toggleItem = (code: string) => {
    setSelectedItems(prev => prev.includes(code) ? prev.filter(i => i !== code) : [...prev, code]);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <FiRefreshCw className="animate-spin h-8 w-8 mx-auto text-green-500 mb-3" />
          <p className="text-gray-500">Loading tenant configuration...</p>
        </div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center text-red-500">
          <FiAlertTriangle className="h-8 w-8 mx-auto mb-3" />
          <p>Failed to load configuration. Please try again.</p>
          <button onClick={fetchConfig} className="mt-3 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <FiSettings className="text-green-600" />
            Tenant Configuration
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Configure country access, currencies, languages, and payroll policies for this tenant.
            {isSuperAdmin && ' As super admin, you control which countries, currencies, and languages this tenant can access.'}
            {isTenantAdmin && ' As tenant admin, you can edit policies within your customisation tier.'}
          </p>
        </div>
        <button onClick={fetchConfig} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
          <FiRefreshCw />
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <StatCard icon={<FiGlobe />} label="Countries" value={config.activeCountryCount} color="blue" />
        <StatCard icon={<FiDollarSign />} label="Currencies" value={config.activeCurrencyCount} color="green" />
        <StatCard icon={<FiMessageSquare />} label="Languages" value={config.activeLanguageCount} color="purple" />
        <StatCard icon={<FiFileText />} label="Policies" value={config.policies.filter(p => p.status === 'active').length} color="orange" />
        <StatCard icon={<FiDollarSign />} label="Monthly Cost" value={`$${(config.estimatedMonthlyCost || 0).toLocaleString()}`} color="emerald" />
        <StatCard icon={<FiShield />} label="Tier" value={config.customisationTier.charAt(0).toUpperCase() + config.customisationTier.slice(1)} color="indigo" />
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex space-x-1">
          {[
            { key: 'countries', label: 'Countries', icon: <FiGlobe /> },
            { key: 'currencies', label: 'Currencies', icon: <FiDollarSign /> },
            { key: 'languages', label: 'Languages', icon: <FiMessageSquare /> },
            { key: 'policies', label: 'Payroll Policies', icon: <FiFileText /> },
            ...(isSuperAdmin ? [{ key: 'settings', label: 'Settings', icon: <FiSettings /> }] : []),
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as typeof activeTab)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-green-600 text-green-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* ─── Countries Tab ─── */}
      {activeTab === 'countries' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Country Access ({config.countries.length})
            </h2>
            {isSuperAdmin && (
              <button
                onClick={() => { setAddType('country'); setShowAddModal(true); setSelectedItems([]); setSearchTerm(''); }}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
              >
                <FiPlus /> Add Countries
              </button>
            )}
          </div>

          {config.countries.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-xl">
              <FiGlobe className="h-12 w-12 mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500">No countries configured yet. Add countries to auto-provision payroll policies.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {config.countries.map(country => (
                <div key={country.id} className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{getCountryFlag(country.countryCode)}</span>
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white">{country.countryName}</h3>
                        <span className="text-xs text-gray-500">{country.countryCode} · {country.payrollCurrencyDefault}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {country.isOverridden && <span className="text-xs bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded">Modified</span>}
                      {isSuperAdmin && (
                        <button
                          onClick={() => handleRemoveAccess(country.id, 'country')}
                          className="p-1 text-red-400 hover:text-red-600 rounded hover:bg-red-50"
                          title="Remove country access"
                        >
                          <FiTrash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Country Details Grid */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <DetailItem label="Payroll Freq" value={country.payrollFrequencyDefault} />
                    <DetailItem label="Working Hrs/Week" value={String(country.workingHoursPerWeek)} />
                    <DetailItem label="Tax Regime" value={country.taxRegimeDefault || 'N/A'} />
                    <DetailItem label="OT Multiplier" value={`${country.overtimeMultiplier}x`} />
                    <DetailItem label="Probation" value={`${country.probationPeriod} days`} />
                    <DetailItem label="Notice Period" value={`${country.terminationNoticePeriod} days`} />
                    <DetailItem label="Annual Leave" value={`${country.annualLeaveEntitlement} days`} />
                    <DetailItem label="Data Residency" value={country.dataResidencyRequired ? 'Required' : 'Not Required'} />
                  </div>

                  {/* Compliance Flags */}
                  <div className="flex flex-wrap gap-1 mt-3">
                    {country.pfEnabled && <ComplianceTag label="PF" color="blue" />}
                    {country.esiEnabled && <ComplianceTag label="ESI" color="green" />}
                    {country.gratuityEnabled && <ComplianceTag label="Gratuity" color="purple" />}
                    {country.socialSecurityEnabled && <ComplianceTag label="Social Security" color="orange" />}
                    {country.pensionEnabled && <ComplianceTag label="Pension" color="indigo" />}
                    {country.medicaidEnabled && <ComplianceTag label="Medical Aid" color="red" />}
                  </div>

                  {/* Edit Button */}
                  {(isSuperAdmin || (isTenantAdmin && config.customisationTier !== 'standard')) && (
                    <button
                      onClick={() => setEditingCountry(country)}
                      className="mt-3 flex items-center gap-1 text-xs text-green-600 hover:text-green-800"
                    >
                      <FiEdit2 className="h-3 w-3" /> Edit Configuration
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── Currencies Tab ─── */}
      {activeTab === 'currencies' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Currency Access ({config.currencies.length})
            </h2>
            {isSuperAdmin && (
              <button
                onClick={() => { setAddType('currency'); setShowAddModal(true); setSelectedItems([]); setSearchTerm(''); }}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
              >
                <FiPlus /> Add Currencies
              </button>
            )}
          </div>

          {config.currencies.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-xl">
              <FiDollarSign className="h-12 w-12 mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500">No currencies configured. Add currencies for multi-currency payroll support.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Currency</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Symbol</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Exchange Source</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Auto Fetch</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rounding</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    {isSuperAdmin && <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {config.currencies.map(currency => (
                    <tr key={currency.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900 dark:text-white">{currency.currencyName}</div>
                        <div className="text-xs text-gray-500">{currency.currencyCode}</div>
                      </td>
                      <td className="px-4 py-3 text-lg">{currency.currencySymbol}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{currency.exchangeRateSource}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-1 rounded-full ${currency.autoFetchEnabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {currency.autoFetchEnabled ? 'Enabled' : 'Manual'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        {currency.roundingPrecision}dp · {currency.roundingRule}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-1 rounded-full ${currency.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {currency.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      {isSuperAdmin && (
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => handleRemoveAccess(currency.id, 'currency')} className="p-1 text-red-400 hover:text-red-600 rounded hover:bg-red-50">
                            <FiTrash2 className="h-4 w-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ─── Languages Tab ─── */}
      {activeTab === 'languages' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Language Access ({config.languages.length})
            </h2>
            {isSuperAdmin && (
              <button
                onClick={() => { setAddType('language'); setShowAddModal(true); setSelectedItems([]); setSearchTerm(''); }}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
              >
                <FiPlus /> Add Languages
              </button>
            )}
          </div>

          {config.languages.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-xl">
              <FiMessageSquare className="h-12 w-12 mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500">No languages configured. Add languages for UI localisation and document generation.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {config.languages.map(lang => (
                <div key={lang.id} className="border border-gray-200 dark:border-gray-700 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">{lang.languageName}</h3>
                      <span className="text-xs text-gray-500">{lang.languageCode}{lang.isRTL ? ' · RTL' : ''}</span>
                    </div>
                    {isSuperAdmin && (
                      <button onClick={() => handleRemoveAccess(lang.id, 'language')} className="p-1 text-red-400 hover:text-red-600 rounded hover:bg-red-50">
                        <FiTrash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className={`px-2 py-1 rounded ${lang.uiTranslated ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                      UI
                    </span>
                    <span className={`px-2 py-1 rounded ${lang.documentTemplates ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                      Documents
                    </span>
                    <span className={`px-2 py-1 rounded ${lang.emailTemplates ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                      Emails
                    </span>
                    <span className={`px-2 py-1 rounded ${lang.helpArticles ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                      Help
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── Policies Tab ─── */}
      {activeTab === 'policies' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Payroll Policies ({config.policies.length})
            </h2>
            {(isSuperAdmin || config.customisationTier !== 'standard') && (
              <button
                onClick={() => { setAddType('policy'); setShowAddModal(true); }}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
              >
                <FiPlus /> Create Policy
              </button>
            )}
          </div>

          {config.policies.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-xl">
              <FiFileText className="h-12 w-12 mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500">No policies yet. Add countries to auto-provision default policies, or create custom ones.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(policiesByCountry).map(([countryCode, policies]) => (
                <div key={countryCode} className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                  <div className="bg-gray-50 dark:bg-gray-800 px-4 py-3 flex items-center gap-2">
                    <span className="text-xl">{getCountryFlag(countryCode)}</span>
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {policies[0]?.countryName || countryCode}
                    </h3>
                    <span className="text-xs text-gray-500">({policies.length} policies)</span>
                  </div>
                  <div className="divide-y divide-gray-100 dark:divide-gray-800">
                    {policies.map(policy => (
                      <div key={policy.id} className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-gray-900 dark:text-white text-sm">{policy.policyName}</span>
                              <span className={`text-xs px-1.5 py-0.5 rounded ${categoryBadge[policy.category] || categoryBadge.custom}`}>
                                {policy.category}
                              </span>
                              <span className={`text-xs px-1.5 py-0.5 rounded ${sourceBadge[policy.source] || sourceBadge.custom}`}>
                                {policy.source.replace('_', ' ')}
                              </span>
                              <span className={`text-xs px-1.5 py-0.5 rounded ${statusBadge[policy.status] || statusBadge.draft}`}>
                                {policy.status}
                              </span>
                              {policy.isOverridden && (
                                <span className="text-xs px-1.5 py-0.5 rounded bg-orange-100 text-orange-600">Modified</span>
                              )}
                              <span className="text-xs text-gray-400">v{policy.version}</span>
                            </div>
                            <div className="text-xs text-gray-500">
                              {policy.policyType} · Effective: {new Date(policy.effectiveFrom).toLocaleDateString()}
                              {policy.effectiveTo && ` → ${new Date(policy.effectiveTo).toLocaleDateString()}`}
                            </div>
                            {/* Show preview of policy content */}
                            <PolicyContentPreview content={policy.policyContent} />
                          </div>
                          <div className="flex items-center gap-1 ml-3">
                            {policy.isEditable && (
                              <button
                                onClick={() => {
                                  setEditingPolicy(policy);
                                  setEditPolicyName(policy.policyName);
                                  setEditPolicyContent(policy.policyContent);
                                  setEditPolicyNotes(policy.notes || '');
                                }}
                                className="p-1.5 text-green-500 hover:text-green-700 rounded hover:bg-green-50"
                                title="Edit policy"
                              >
                                <FiEdit2 className="h-4 w-4" />
                              </button>
                            )}
                            {(policy.source !== 'system_default' || isSuperAdmin) && (
                              <button
                                onClick={() => handleDeletePolicy(policy.id)}
                                className="p-1.5 text-red-400 hover:text-red-600 rounded hover:bg-red-50"
                                title="Delete policy"
                              >
                                <FiTrash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── Settings Tab (Super Admin Only) ─── */}
      {activeTab === 'settings' && isSuperAdmin && (
        <div className="space-y-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Configuration Settings</h2>

          {/* Auto-Provisioning */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
            <h3 className="font-medium text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <FiSettings className="text-green-500" /> Auto-Provisioning
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              When a country is added, the system can automatically create default payroll policies, compliance obligations, tax slabs, and minimum wage configurations.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <ToggleSetting
                label="Auto-Provision Payroll Policies"
                description="Create default payroll frequency, leave, overtime, and other policies"
                value={config.autoProvisionPayroll}
                onChange={(v) => handleUpdateConfig({ autoProvisionPayroll: v })}
              />
              <ToggleSetting
                label="Auto-Provision Compliance"
                description="Create statutory compliance entries (PF, ESI, Social Security, etc.)"
                value={config.autoProvisionCompliance}
                onChange={(v) => handleUpdateConfig({ autoProvisionCompliance: v })}
              />
              <ToggleSetting
                label="Auto-Provision Tax Slabs"
                description="Create country-specific tax slab tables"
                value={config.autoProvisionTaxSlabs}
                onChange={(v) => handleUpdateConfig({ autoProvisionTaxSlabs: v })}
              />
              <ToggleSetting
                label="Auto-Provision Minimum Wage"
                description="Create minimum wage configurations for each country"
                value={config.autoProvisionMinWage}
                onChange={(v) => handleUpdateConfig({ autoProvisionMinWage: v })}
              />
            </div>
          </div>

          {/* Customisation Tier */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
            <h3 className="font-medium text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <FiShield className="text-teal-500" /> Customisation Tier
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              Controls how much the tenant admin can override pre-configured policies.
            </p>
            <div className="grid grid-cols-3 gap-4">
              {[
                { value: 'standard', label: 'Standard', desc: 'Cannot modify system defaults. Use as-is.', cost: '$0/mo' },
                { value: 'custom', label: 'Custom', desc: 'Can create new policies and edit non-system ones.', cost: '$50/mo' },
                { value: 'full', label: 'Full', desc: 'Can modify everything including tax slabs and compliance.', cost: '$150/mo' },
              ].map(tier => (
                <button
                  key={tier.value}
                  onClick={() => handleUpdateConfig({ customisationTier: tier.value })}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    config.customisationTier === tier.value
                      ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-gray-900 dark:text-white">{tier.label}</span>
                    <span className="text-xs text-gray-500">{tier.cost}</span>
                  </div>
                  <p className="text-xs text-gray-500">{tier.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Quotas */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
            <h3 className="font-medium text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <FiUsers className="text-green-500" /> Quotas & Limits
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              Set maximum limits for users, companies, and employees. These drive the costing model.
            </p>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Max Users</label>
                <input
                  type="number"
                  value={config.maxUsers}
                  onChange={(e) => handleUpdateConfig({ maxUsers: parseInt(e.target.value) || 50 })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Max Companies</label>
                <input
                  type="number"
                  value={config.maxCompanies}
                  onChange={(e) => handleUpdateConfig({ maxCompanies: parseInt(e.target.value) || 5 })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Max Employees</label>
                <input
                  type="number"
                  value={config.maxEmployees}
                  onChange={(e) => handleUpdateConfig({ maxEmployees: parseInt(e.target.value) || 500 })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* Cost Breakdown */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
            <h3 className="font-medium text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <FiDollarSign className="text-emerald-500" /> Estimated Cost Breakdown
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <CostItem label="Countries" detail={`${config.activeCountryCount} × $50`} amount={config.activeCountryCount * 50} />
              <CostItem label="Extra Currencies" detail={`${Math.max(0, config.activeCurrencyCount - 1)} × $10`} amount={Math.max(0, config.activeCurrencyCount - 1) * 10} />
              <CostItem label="Extra Languages" detail={`${Math.max(0, config.activeLanguageCount - 1)} × $5`} amount={Math.max(0, config.activeLanguageCount - 1) * 5} />
              <CostItem label="Customisation Tier" detail={config.customisationTier} amount={config.customisationTier === 'full' ? 150 : config.customisationTier === 'custom' ? 50 : 0} />
            </div>
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <span className="text-lg font-bold text-gray-900 dark:text-white">Estimated Monthly Cost</span>
                <span className="text-2xl font-bold text-emerald-600">${(config.estimatedMonthlyCost || 0).toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-sm text-gray-500">Estimated Annual Cost</span>
                <span className="text-lg font-semibold text-emerald-500">${(config.estimatedAnnualCost || 0).toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
            <h3 className="font-medium text-gray-900 dark:text-white mb-4">Notes</h3>
            <textarea
              value={config.notes || ''}
              onChange={(e) => handleUpdateConfig({ notes: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white"
              rows={3}
              placeholder="Add notes about this tenant's configuration..."
            />
          </div>
        </div>
      )}

      {/* ─── Add Modal ─── */}
      {showAddModal && addType !== 'policy' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Add {addType === 'country' ? 'Countries' : addType === 'currency' ? 'Currencies' : 'Languages'}
              </h3>
              <button onClick={() => setShowAddModal(false)} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                <FiX />
              </button>
            </div>

            {/* Search */}
            <div className="px-6 py-3 border-b border-gray-100 dark:border-gray-700">
              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
                <input
                  type="text"
                  placeholder={`Search ${addType}ies...`}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white"
                />
              </div>
            </div>

            {/* Select All / None */}
            <div className="px-6 py-2 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <span className="text-sm text-gray-500">{selectedItems.length} selected</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedItems(filteredAvailable.map(i => i.code))}
                  className="text-xs text-green-600 hover:text-green-800"
                >
                  Select All
                </button>
                <button onClick={() => setSelectedItems([])} className="text-xs text-gray-400 hover:text-gray-600">
                  Clear
                </button>
              </div>
            </div>

            {/* Items List */}
            <div className="flex-1 overflow-y-auto px-6 py-3 space-y-1">
              {filteredAvailable.map(item => {
                const isSelected = selectedItems.includes(item.code);
                return (
                  <button
                    key={item.code}
                    onClick={() => toggleItem(item.code)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                      isSelected ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                      isSelected ? 'bg-green-600 border-green-600' : 'border-gray-300 dark:border-gray-600'
                    }`}>
                      {isSelected && <FiCheck className="h-3 w-3 text-white" />}
                    </div>
                    {addType === 'country' && <span className="text-xl">{getCountryFlag(item.code)}</span>}
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 dark:text-white text-sm">{item.name}</div>
                      <div className="text-xs text-gray-500">
                        {item.code}
                        {addType === 'country' && ` · ${(item as CountryMaster).currency} · ${(item as CountryMaster).payrollFrequency}`}
                        {addType === 'currency' && ` · ${(item as CurrencyMaster).symbol}`}
                        {addType === 'language' && (item as LanguageMaster).rtl && ' · RTL'}
                      </div>
                    </div>
                  </button>
                );
              })}
              {filteredAvailable.length === 0 && (
                <div className="text-center py-8 text-gray-400 text-sm">
                  No available {addType}ies to add{searchTerm ? ` matching "${searchTerm}"` : ''}.
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div className="text-sm text-gray-500">
                {selectedItems.length > 0 && addType === 'country' && (
                  <span className="text-green-600">Policies will be auto-provisioned for selected countries</span>
                )}
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowAddModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 rounded-lg hover:bg-gray-100">
                  Cancel
                </button>
                <button
                  onClick={handleAddItems}
                  disabled={selectedItems.length === 0 || saving}
                  className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {saving && <FiRefreshCw className="animate-spin h-4 w-4" />}
                  Add {selectedItems.length} {addType}{selectedItems.length !== 1 ? 's' : ''}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Create Policy Modal ─── */}
      {showAddModal && addType === 'policy' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Create Custom Policy</h3>
              <button onClick={() => setShowAddModal(false)} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                <FiX />
              </button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Country <span className="text-red-500 font-bold">*</span></label>
                <select
                  value={newPolicy.countryCode}
                  onChange={(e) => setNewPolicy({ ...newPolicy, countryCode: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white"
                >
                  <option value="">Select a country...</option>
                  {config.countries.map(c => (
                    <option key={c.countryCode} value={c.countryCode}>{c.countryName} ({c.countryCode})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Policy Name <span className="text-red-500 font-bold">*</span></label>
                <input
                  type="text"
                  value={newPolicy.policyName}
                  onChange={(e) => setNewPolicy({ ...newPolicy, policyName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white"
                  placeholder="e.g. India — Special Leave Policy"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Policy Type</label>
                  <select
                    value={newPolicy.policyType}
                    onChange={(e) => setNewPolicy({ ...newPolicy, policyType: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white"
                  >
                    {['PAYROLL_FREQUENCY', 'TAX_REGIME', 'STATUTORY_COMPLIANCE', 'LEAVE_POLICY', 'OVERTIME_POLICY', 'GRATUITY_POLICY', 'PROBATION_POLICY', 'TERMINATION_POLICY', 'MINIMUM_WAGE', 'WORKING_HOURS', 'SOCIAL_SECURITY', 'PENSION', 'MEDICAL_AID', 'CUSTOM'].map(t => (
                      <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
                  <select
                    value={newPolicy.category}
                    onChange={(e) => setNewPolicy({ ...newPolicy, category: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white"
                  >
                    {['payroll', 'leave', 'compliance', 'benefits', 'labour_law', 'custom'].map(c => (
                      <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Policy Content (JSON) <span className="text-red-500 font-bold">*</span></label>
                <textarea
                  value={newPolicy.policyContent}
                  onChange={(e) => setNewPolicy({ ...newPolicy, policyContent: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-mono dark:bg-gray-700 dark:text-white"
                  rows={8}
                  placeholder='{"key": "value"}'
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
                <textarea
                  value={newPolicy.notes}
                  onChange={(e) => setNewPolicy({ ...newPolicy, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white"
                  rows={2}
                  placeholder="Optional notes..."
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
              <button onClick={() => setShowAddModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 rounded-lg hover:bg-gray-100">
                Cancel
              </button>
              <button
                onClick={handleCreatePolicy}
                disabled={saving}
                className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
              >
                {saving && <FiRefreshCw className="animate-spin h-4 w-4" />}
                Create Policy
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Edit Policy Modal ─── */}
      {editingPolicy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Edit Policy</h3>
              <button onClick={() => setEditingPolicy(null)} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                <FiX />
              </button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div className="text-sm text-gray-500 mb-2">
                <span className="font-medium">Type:</span> {editingPolicy.policyType} ·
                <span className="font-medium"> Country:</span> {editingPolicy.countryName} ·
                <span className="font-medium"> Version:</span> v{editingPolicy.version} ·
                <span className="font-medium"> Source:</span> {editingPolicy.source.replace('_', ' ')}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Policy Name</label>
                <input
                  type="text"
                  value={editPolicyName}
                  onChange={(e) => setEditPolicyName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Policy Content (JSON)</label>
                <textarea
                  value={editPolicyContent}
                  onChange={(e) => setEditPolicyContent(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-mono dark:bg-gray-700 dark:text-white"
                  rows={12}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
                <textarea
                  value={editPolicyNotes}
                  onChange={(e) => setEditPolicyNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white"
                  rows={2}
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
              <button onClick={() => setEditingPolicy(null)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 rounded-lg hover:bg-gray-100">
                Cancel
              </button>
              <button
                onClick={handleSavePolicy}
                disabled={saving}
                className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
              >
                {saving && <FiRefreshCw className="animate-spin h-4 w-4" />}
                <FiSave /> Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Edit Country Modal ─── */}
      {editingCountry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Edit Country Settings — {editingCountry.countryName}
              </h3>
              <button onClick={() => setEditingCountry(null)} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                <FiX />
              </button>
            </div>
            <CountryEditor
              country={editingCountry}
              isSuperAdmin={isSuperAdmin}
              configTier={config.customisationTier}
              onSave={(id, updates) => handleUpdateCountry(id, updates)}
              onCancel={() => setEditingCountry(null)}
              saving={saving}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-Components ───

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number | string; color: string }) {
  const colorMap: Record<string, string> = {
    blue: 'bg-green-50 text-green-700',
    green: 'bg-green-50 text-green-700',
    purple: 'bg-teal-50 text-teal-700',
    orange: 'bg-orange-50 text-orange-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    indigo: 'bg-emerald-50 text-emerald-700',
  };
  return (
    <div className={`p-4 rounded-xl ${colorMap[color] || colorMap.blue}`}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-lg">{icon}</span>
        <span className="text-xs font-medium opacity-70">{label}</span>
      </div>
      <div className="text-xl font-bold">{value}</div>
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-gray-400">{label}</div>
      <div className="font-medium text-gray-900 dark:text-white">{value}</div>
    </div>
  );
}

function ComplianceTag({ label, color }: { label: string; color: string }) {
  const colorMap: Record<string, string> = {
    blue: 'bg-green-100 text-green-700',
    green: 'bg-green-100 text-green-700',
    purple: 'bg-teal-100 text-teal-700',
    orange: 'bg-orange-100 text-orange-700',
    indigo: 'bg-emerald-100 text-emerald-700',
    red: 'bg-red-100 text-red-700',
  };
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded ${colorMap[color] || colorMap.blue}`}>
      {label}
    </span>
  );
}

function ToggleSetting({ label, description, value, onChange }: { label: string; description: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
      <div>
        <div className="text-sm font-medium text-gray-900 dark:text-white">{label}</div>
        <div className="text-xs text-gray-500">{description}</div>
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`relative w-11 h-6 rounded-full transition-colors ${value ? 'bg-green-600' : 'bg-gray-300 dark:bg-gray-600'}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${value ? 'translate-x-5' : 'translate-x-0'}`} />
      </button>
    </div>
  );
}

function CostItem({ label, detail, amount }: { label: string; detail: string; amount: number }) {
  return (
    <div className="text-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-sm font-medium text-gray-900 dark:text-white">${amount}</div>
      <div className="text-xs text-gray-400">{detail}</div>
    </div>
  );
}

function PolicyContentPreview({ content }: { content: string }) {
  try {
    const parsed = JSON.parse(content);
    const keys = Object.keys(parsed);
    const preview = keys.slice(0, 4).map(k => `${k}: ${JSON.stringify(parsed[k])}`).join(' · ');
    return (
      <div className="mt-1 text-xs text-gray-400 font-mono truncate max-w-full">
        {preview}{keys.length > 4 ? ' ...' : ''}
      </div>
    );
  } catch {
    return <div className="mt-1 text-xs text-gray-400 truncate">{content.slice(0, 80)}...</div>;
  }
}

function CountryEditor({ country, isSuperAdmin, configTier, onSave, onCancel, saving }: {
  country: TenantCountryAccess;
  isSuperAdmin: boolean;
  configTier: string;
  onSave: (id: string, updates: Record<string, unknown>) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState({
    payrollFrequencyDefault: country.payrollFrequencyDefault,
    payrollCurrencyDefault: country.payrollCurrencyDefault,
    taxRegimeDefault: country.taxRegimeDefault || '',
    workingHoursPerWeek: country.workingHoursPerWeek,
    workingDaysPerWeek: country.workingDaysPerWeek,
    overtimeMultiplier: country.overtimeMultiplier,
    pfEnabled: country.pfEnabled,
    esiEnabled: country.esiEnabled,
    gratuityEnabled: country.gratuityEnabled,
    socialSecurityEnabled: country.socialSecurityEnabled,
    pensionEnabled: country.pensionEnabled,
    medicaidEnabled: country.medicaidEnabled,
    terminationNoticePeriod: country.terminationNoticePeriod,
    probationPeriod: country.probationPeriod,
    annualLeaveEntitlement: country.annualLeaveEntitlement,
    overrideNotes: country.overrideNotes || '',
  });

  const canEdit = isSuperAdmin || configTier !== 'standard';

  return (
    <div className="px-6 py-4 space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Payroll Frequency</label>
          <select
            value={form.payrollFrequencyDefault}
            onChange={(e) => setForm({ ...form, payrollFrequencyDefault: e.target.value })}
            disabled={!canEdit}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white disabled:opacity-50"
          >
            {['MONTHLY', 'SEMI_MONTHLY', 'BI_WEEKLY', 'WEEKLY', 'DAILY'].map(f => (
              <option key={f} value={f}>{f.replace('_', ' ')}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Default Currency</label>
          <input
            type="text"
            value={form.payrollCurrencyDefault}
            onChange={(e) => setForm({ ...form, payrollCurrencyDefault: e.target.value })}
            disabled={!canEdit}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white disabled:opacity-50"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Tax Regime</label>
          <input
            type="text"
            value={form.taxRegimeDefault}
            onChange={(e) => setForm({ ...form, taxRegimeDefault: e.target.value })}
            disabled={!canEdit}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white disabled:opacity-50"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Working Hours/Week</label>
          <input
            type="number"
            value={form.workingHoursPerWeek}
            onChange={(e) => setForm({ ...form, workingHoursPerWeek: parseInt(e.target.value) })}
            disabled={!canEdit}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white disabled:opacity-50"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Working Days/Week</label>
          <input
            type="number"
            value={form.workingDaysPerWeek}
            onChange={(e) => setForm({ ...form, workingDaysPerWeek: parseInt(e.target.value) })}
            disabled={!canEdit}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white disabled:opacity-50"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">OT Multiplier</label>
          <input
            type="number"
            step="0.5"
            value={form.overtimeMultiplier}
            onChange={(e) => setForm({ ...form, overtimeMultiplier: parseFloat(e.target.value) })}
            disabled={!canEdit}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white disabled:opacity-50"
          />
        </div>
      </div>

      {/* Compliance Toggles */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Compliance & Benefits</h4>
        <div className="grid grid-cols-3 gap-3">
          {[
            { key: 'pfEnabled', label: 'PF' },
            { key: 'esiEnabled', label: 'ESI' },
            { key: 'gratuityEnabled', label: 'Gratuity' },
            { key: 'socialSecurityEnabled', label: 'Social Security' },
            { key: 'pensionEnabled', label: 'Pension' },
            { key: 'medicaidEnabled', label: 'Medical Aid' },
          ].map(item => (
            <label key={item.key} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form[item.key as keyof typeof form] as boolean}
                onChange={(e) => setForm({ ...form, [item.key]: e.target.checked })}
                disabled={!canEdit}
                className="rounded"
              />
              {item.label}
            </label>
          ))}
        </div>
      </div>

      {/* Labour Law */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Probation (days)</label>
          <input
            type="number"
            value={form.probationPeriod}
            onChange={(e) => setForm({ ...form, probationPeriod: parseInt(e.target.value) })}
            disabled={!canEdit}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white disabled:opacity-50"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Notice Period (days)</label>
          <input
            type="number"
            value={form.terminationNoticePeriod}
            onChange={(e) => setForm({ ...form, terminationNoticePeriod: parseInt(e.target.value) })}
            disabled={!canEdit}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white disabled:opacity-50"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Annual Leave (days)</label>
          <input
            type="number"
            value={form.annualLeaveEntitlement}
            onChange={(e) => setForm({ ...form, annualLeaveEntitlement: parseFloat(e.target.value) })}
            disabled={!canEdit}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white disabled:opacity-50"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Override Notes</label>
        <textarea
          value={form.overrideNotes}
          onChange={(e) => setForm({ ...form, overrideNotes: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white"
          rows={2}
          placeholder="Reason for override..."
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button onClick={onCancel} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 rounded-lg hover:bg-gray-100">
          Cancel
        </button>
        <button
          onClick={() => onSave(country.id, form)}
          disabled={saving || !canEdit}
          className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
        >
          {saving && <FiRefreshCw className="animate-spin h-4 w-4" />}
          Save
        </button>
      </div>
    </div>
  );
}

// ─── Helpers ───
function getCountryFlag(code: string): string {
  const flags: Record<string, string> = {
    IN: '🇮🇳', US: '🇺🇸', GB: '🇬🇧', AE: '🇦🇪', SG: '🇸🇬', AU: '🇦🇺', CA: '🇨🇦',
    DE: '🇩🇪', FR: '🇫🇷', SA: '🇸🇦', JP: '🇯🇵', ZA: '🇿🇦', MY: '🇲🇾', PH: '🇵🇭',
    NL: '🇳🇱', IE: '🇮🇪', BD: '🇧🇩', NP: '🇳🇵', LK: '🇱🇰', ID: '🇮🇩',
  };
  return flags[code] || '🌍';
}
