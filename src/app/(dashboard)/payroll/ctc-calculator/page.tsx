'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  FiPercent, FiDollarSign, FiTrendingDown, FiTrendingUp,
  FiArrowRight, FiInfo, FiCheck,
  FiShield, FiFileText, FiUsers, FiAlertCircle,
  FiSearch, FiSave, FiChevronDown,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import { useCompanyContextStore } from '@/store/companyContextStore';

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

// ─── Types ───
interface ComponentBreakdown {
  name: string;
  annual: number;
  monthly: number;
  pctOfCTC?: string;
  pctOfGross?: string;
  category?: string;
}

interface CTCCalculationResult {
  country?: string;
  countryCode: string;
  currency: string;
  ctcAnnual: number;
  ctcMonthly: number;
  earnings: Record<string, { annual: number; monthly: number; pctOfCTC: string }> | ComponentBreakdown[];
  grossSalary: { annual: number; monthly: number };
  employerContributions: Record<string, { annual: number; monthly: number; pctOfCTC: string }> | ComponentBreakdown[];
  deductions: Record<string, { annual: number; monthly: number; pctOfGross?: string; pctOfCTC?: string; taxableIncome?: number }> | ComponentBreakdown[];
  totalDeductions: { annual: number; monthly: number };
  netTakeHome: { annual: number; monthly: number };
}

interface Template {
  id: string;
  name: string;
  countryCode: string;
  currencyCode: string;
  ctcType: string;
  basePayPct: number | null;
  isDefault: boolean;
  componentMappings: Array<{
    id: string;
    componentName: string;
    componentCategory: string;
    allocationMethod: string;
    allocationValue: number;
  }>;
}

// ─── Country Options ───
const COUNTRY_OPTIONS = [
  { value: 'IND', label: 'India (INR)', currency: 'INR', flag: '🇮🇳' },
  { value: 'USA', label: 'United States (USD)', currency: 'USD', flag: '🇺🇸' },
  { value: 'GBR', label: 'United Kingdom (GBP)', currency: 'GBP', flag: '🇬🇧' },
  { value: 'SGP', label: 'Singapore (SGD)', currency: 'SGD', flag: '🇸🇬' },
  { value: 'UAE', label: 'UAE (AED)', currency: 'AED', flag: '🇦🇪' },
  { value: 'AUS', label: 'Australia (AUD)', currency: 'AUD', flag: '🇦🇺' },
];

const CURRENCY_SYMBOLS: Record<string, string> = {
  INR: '₹', USD: '$', GBP: '£', SGD: 'S$', AED: 'AED', AUD: 'A$',
};

// ─── Quick CTC Presets ───
const CTC_PRESETS_IND = [
  { label: '3 LPA', value: 300000 },
  { label: '5 LPA', value: 500000 },
  { label: '8 LPA', value: 800000 },
  { label: '10 LPA', value: 1000000 },
  { label: '15 LPA', value: 1500000 },
  { label: '20 LPA', value: 2000000 },
  { label: '25 LPA', value: 2500000 },
  { label: '30 LPA', value: 3000000 },
  { label: '50 LPA', value: 5000000 },
  { label: '1 Cr', value: 10000000 },
];

const CTC_PRESETS_USA = [
  { label: '$50K', value: 50000 },
  { label: '$75K', value: 75000 },
  { label: '$100K', value: 100000 },
  { label: '$125K', value: 125000 },
  { label: '$150K', value: 150000 },
  { label: '$200K', value: 200000 },
  { label: '$250K', value: 250000 },
  { label: '$300K', value: 300000 },
];

// ─── Format helpers ───
function formatCurrency(amount: number, currency: string): string {
  const symbol = CURRENCY_SYMBOLS[currency] || currency;
  if (currency === 'INR') {
    // Indian numbering format
    if (amount >= 10000000) return `${symbol}${(amount / 10000000).toFixed(2)} Cr`;
    if (amount >= 100000) return `${symbol}${(amount / 100000).toFixed(2)} L`;
    return `${symbol}${amount.toLocaleString('en-IN')}`;
  }
  return `${symbol}${amount.toLocaleString('en-US')}`;
}

function formatNumber(amount: number, currency: string): string {
  if (currency === 'INR') {
    return amount.toLocaleString('en-IN');
  }
  return amount.toLocaleString('en-US');
}

// ─── Normalization helpers ───
function normalizeComponents(
  data: Record<string, { annual: number; monthly: number; pctOfCTC?: string; pctOfGross?: string }> | ComponentBreakdown[] | undefined,
  labelMap?: Record<string, string>
): ComponentBreakdown[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  return Object.entries(data).map(([key, val]) => ({
    name: labelMap?.[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase()),
    annual: val.annual,
    monthly: val.monthly,
    pctOfCTC: val.pctOfCTC,
    pctOfGross: val.pctOfGross,
  }));
}

const IND_EARNING_LABELS: Record<string, string> = {
  basic: 'Basic Salary',
  hra: 'House Rent Allowance (HRA)',
  specialAllowance: 'Special Allowance',
  lta: 'Leave Travel Allowance (LTA)',
  variablePay: 'Performance Bonus / Variable Pay',
  medicalAllowance: 'Medical Allowance',
  conveyanceAllowance: 'Conveyance Allowance',
  baseSalary: 'Base Salary',
  annualBonus: 'Annual Bonus',
  stockOptions: 'Stock Options / RSUs',
};

const IND_EMPLOYER_LABELS: Record<string, string> = {
  employerPF: 'Employer PF Contribution',
  employerESI: 'Employer ESI Contribution',
  gratuity: 'Gratuity',
  healthInsurance: 'Health Insurance (Employer)',
  retirement401k: '401(k) Employer Match',
  otherBenefits: 'Other Benefits',
};

const IND_DEDUCTION_LABELS: Record<string, string> = {
  employeePF: 'Employee PF Contribution',
  employeeESI: 'Employee ESI Contribution',
  professionalTax: 'Professional Tax',
  incomeTax: 'Income Tax (TDS)',
  federalTax: 'Federal Income Tax',
  stateTax: 'State Income Tax',
  socialSecurity: 'Social Security (FICA)',
  medicare: 'Medicare',
  healthInsurance: 'Health Insurance (Employee)',
  retirement401k: '401(k) Employee Contribution',
};

// ─── Main Component ───
export default function CTCCalculatorPage() {
  const { user } = useAuthStore();
  const effectiveCompanyId = useCompanyContextStore(s => s.effectiveCompanyId);
  const isAdmin = user?.role === 'super_admin' || user?.role === 'tenant_admin' || user?.role === 'admin';

  // Input state
  const [ctcAmount, setCtcAmount] = useState<string>('');
  const [countryCode, setCountryCode] = useState('IND');
  const [ctcType, setCtcType] = useState<'ANNUAL' | 'MONTHLY'>('ANNUAL');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [useCustomTemplate, setUseCustomTemplate] = useState(false);
  const [includePF, setIncludePF] = useState(true);
  const [includeESI, setIncludeESI] = useState(true);

  // Result state
  const [result, setResult] = useState<CTCCalculationResult | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState<'earnings' | 'employer' | 'deductions' | null>('earnings');

  // Apply to employees state
  const [applyMode, setApplyMode] = useState<'single' | 'bulk'>('single');
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [bulkFilter, setBulkFilter] = useState<'department' | 'designation' | 'branch' | 'grade'>('department');
  const [bulkFilterValue, setBulkFilterValue] = useState('');
  const [filterOptions, setFilterOptions] = useState<any[]>([]);
  const [applying, setApplying] = useState(false);
  const [showApplySection, setShowApplySection] = useState(false);

  // Templates
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  // Currency
  const currency = COUNTRY_OPTIONS.find(c => c.value === countryCode)?.currency || 'INR';

  // Presets
  const presets = countryCode === 'USA' ? CTC_PRESETS_USA : CTC_PRESETS_IND;

  // Fetch templates
  const fetchTemplates = useCallback(async () => {
    try {
      setLoadingTemplates(true);
      const res = await fetch(`/api/payroll/ctc-calculator?${scopeQuery}` , { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setTemplates(Array.isArray(data.data) ? data.data : []);
      }
    } catch {
      // silently fail
    } finally {
      setLoadingTemplates(false);
    }
  }, []);
  const cid = effectiveCompanyId();
  const scopeQuery = cid ? `companyId=${cid}&` : '';


  useEffect(() => {
    queueMicrotask(() => fetchTemplates());
  }, [fetchTemplates]);

  // Calculate CTC breakdown
  const calculateCTC = useCallback(async () => {
    const amount = parseFloat(ctcAmount.replace(/,/g, ''));
    if (!amount || amount <= 0) {
      toast.error('Please enter a valid CTC amount');
      return;
    }

    setCalculating(true);
    try {
      const payload: Record<string, unknown> = {
        ctcAmount: amount,
        countryCode,
        ctcType,
      };

      if (useCustomTemplate && selectedTemplateId) {
        payload.templateId = selectedTemplateId;
      }

      if (countryCode === 'IND') {
        payload.includePF = includePF;
        payload.includeESI = includeESI;
      }

      const res = await fetch(`/api/payroll/ctc-calculator?${scopeQuery}` , {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        setResult(data.data);
        setShowBreakdown('earnings');
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to calculate CTC breakdown');
      }
    } catch {
      toast.error('Failed to calculate CTC breakdown');
    } finally {
      setCalculating(false);
    }
  }, [ctcAmount, countryCode, ctcType, useCustomTemplate, selectedTemplateId, includePF, includeESI]);

  // Auto-calculate on Enter key
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') calculateCTC();
  };

  // ─── Search employees for single apply ───
  const searchEmployees = useCallback(async (query: string) => {
    if (!query || query.length < 2) { setSearchResults([]); return; }
    try {
      const sq = scopeQuery();
      const res = await fetch(`/api/employees?limit=20&search=${encodeURIComponent(query)}${sq ? `&${sq}` : ''}`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.employees || []);
      }
    } catch { /* ignore */ }
  }, [scopeQuery]);

  // ─── Fetch filter options for bulk apply ───
  const fetchFilterOptions = useCallback(async (filterType: string) => {
    try {
      const sq = scopeQuery();
      let url = '';
      if (filterType === 'department') url = `/api/departments?limit=100${sq ? `&${sq}` : ''}`;
      else if (filterType === 'designation') url = `/api/designations?limit=100${sq ? `&${sq}` : ''}`;
      else if (filterType === 'branch') url = `/api/branches?limit=100${sq ? `&${sq}` : ''}`;
      else { setFilterOptions([]); return; }
      const res = await fetch(url, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setFilterOptions(data.data || data.departments || data.designations || data.branches || []);
      }
    } catch { /* ignore */ }
  }, [scopeQuery]);

  // ─── Fetch employees by bulk filter ───
  const fetchBulkEmployees = useCallback(async () => {
    if (!bulkFilterValue) { setSearchResults([]); return; }
    try {
      const sq = scopeQuery();
      const param = bulkFilter === 'department' ? 'departmentId' : bulkFilter === 'designation' ? 'designationId' : 'branchId';
      const res = await fetch(`/api/employees?limit=500&${param}=${bulkFilterValue}${sq ? `&${sq}` : ''}`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.employees || []);
        setSelectedEmployeeIds((data.employees || []).map((e: any) => e.id));
      }
    } catch { /* ignore */ }
  }, [bulkFilter, bulkFilterValue, scopeQuery]);

  // ─── Apply CTC structure to selected employees ───
  const handleApplyToEmployees = async () => {
    if (selectedEmployeeIds.length === 0) {
      toast.error('Please select at least one employee');
      return;
    }
    if (!result) {
      toast.error('Please calculate CTC first');
      return;
    }
    setApplying(true);
    try {
      const sq = scopeQuery();
      let successCount = 0;
      let failCount = 0;

      // Get monthly values from the result
      const earningsArr = normalizeComponents(result.earnings as Record<string, { annual: number; monthly: number; pctOfCTC: string }>, IND_EARNING_LABELS);
      const deductionsArr = normalizeComponents(result.deductions as Record<string, { annual: number; monthly: number; pctOfCTC: string }>, IND_DEDUCTION_LABELS);

      const getMonthly = (arr: ComponentBreakdown[], name: string) => {
        const item = arr.find(e => e.name.toLowerCase().includes(name.toLowerCase()));
        return item ? item.monthly : 0;
      };

      for (const empId of selectedEmployeeIds) {
        try {
          const res = await fetch('/api/payroll/salary-settings', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({
              employeeId: empId,
              ctcAnnual: result.ctcAnnual,
              ctcMonthly: result.ctcMonthly,
              basicSalary: getMonthly(earningsArr, 'basic'),
              hra: getMonthly(earningsArr, 'hra'),
              specialAllowance: getMonthly(earningsArr, 'special'),
              conveyanceAllowance: getMonthly(earningsArr, 'conveyance'),
              medicalAllowance: getMonthly(earningsArr, 'medical'),
              pfDeduction: getMonthly(deductionsArr, 'pf'),
              professionalTax: getMonthly(deductionsArr, 'professional'),
              tdsDeduction: getMonthly(deductionsArr, 'tds'),
              grossSalary: result.grossSalary.monthly,
              netSalary: result.netTakeHome.monthly,
              currency: result.currency,
            }),
          });
          if (res.ok) successCount++;
          else failCount++;
        } catch {
          failCount++;
        }
      }

      if (successCount > 0) {
        toast.success(`Salary structure applied to ${successCount} employee(s)${failCount > 0 ? ` (${failCount} failed)` : ''}`);
        setShowApplySection(false);
        setSelectedEmployeeIds([]);
        setSearchResults([]);
      } else {
        toast.error('Failed to apply salary structure to any employee');
      }
    } catch (e) {
      toast.error('Failed to apply salary structure');
    } finally {
      setApplying(false);
    }
  };

  // Normalized result components
  const normalizedEarnings = useMemo(() => {
    if (!result) return [];
    return normalizeComponents(result.earnings as Record<string, { annual: number; monthly: number; pctOfCTC: string }>, IND_EARNING_LABELS);
  }, [result]);

  const normalizedEmployerContribs = useMemo(() => {
    if (!result) return [];
    return normalizeComponents(result.employerContributions as Record<string, { annual: number; monthly: number; pctOfCTC: string }>, IND_EMPLOYER_LABELS);
  }, [result]);

  const normalizedDeductions = useMemo(() => {
    if (!result) return [];
    return normalizeComponents(result.deductions as Record<string, { annual: number; monthly: number; pctOfGross: string }>, IND_DEDUCTION_LABELS);
  }, [result]);

  // LPA display helper for India
  const formatCTCDisplay = (amount: number) => {
    if (countryCode === 'IND') {
      if (amount >= 10000000) return `${(amount / 10000000).toFixed(2)} Cr`;
      if (amount >= 100000) return `${(amount / 100000).toFixed(2)} LPA`;
    }
    return formatCurrency(amount, currency);
  };

  // Progress bar percentage for visualization
  const maxBarPct = 50; // Basic is typically 40%, so 50% is a good max

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-thb-text-primary flex items-center gap-2">
            <FiPercent className="w-6 h-6 text-green-500" />
            CTC Calculator
          </h1>
          <p className="text-thb-text-secondary mt-1">
            Enter a CTC amount to automatically get the salary breakdown for an employee
          </p>
        </div>
      </div>

      {/* How It Works Banner */}
      <div className="thb-card border-l-4 border-l-green-500 bg-gradient-to-r from-green-50/50 to-white">
        <div className="p-5">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
              <FiInfo className="w-4 h-4 text-green-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-thb-text-primary">How CTC Breakdown Works</h3>
              <p className="text-xs text-thb-text-secondary mt-1 leading-relaxed">
                CTC (Cost to Company) includes your gross salary plus employer contributions. Gross salary comprises take-home pay plus
                employee-side deductions. Employer contributions like PF and gratuity are set aside by the company but not received
                directly in your monthly paycheck. Your actual in-hand salary = Gross Salary minus Employee PF, Professional Tax,
                and Income Tax (TDS).
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ─── Input Panel ─── */}
        <div className="lg:col-span-1 space-y-4">
          {/* CTC Input Card */}
          <div className="thb-card border-l-4 border-l-emerald-500">
            <div className="p-5">
              <h3 className="text-sm font-semibold text-thb-text-primary mb-4 flex items-center gap-2">
                <FiDollarSign className="w-4 h-4 text-emerald-500" />
                Enter CTC Details
              </h3>

              {/* Country Selection */}
              <div className="mb-4">
                <label className="block text-xs font-medium text-thb-text-secondary mb-1.5">Country</label>
                <select
                  value={countryCode}
                  onChange={(e) => {
                    setCountryCode(e.target.value);
                    setResult(null);
                  }}
                  className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                >
                  {COUNTRY_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.flag} {o.label}</option>
                  ))}
                </select>
              </div>

              {/* CTC Type */}
              <div className="mb-4">
                <label className="block text-xs font-medium text-thb-text-secondary mb-1.5">CTC Type</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setCtcType('ANNUAL'); setResult(null); }}
                    className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                      ctcType === 'ANNUAL'
                        ? 'bg-green-500 text-white shadow-sm'
                        : 'bg-slate-100 text-thb-text-secondary hover:bg-slate-200'
                    }`}
                  >
                    Annual CTC
                  </button>
                  <button
                    onClick={() => { setCtcType('MONTHLY'); setResult(null); }}
                    className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                      ctcType === 'MONTHLY'
                        ? 'bg-green-500 text-white shadow-sm'
                        : 'bg-slate-100 text-thb-text-secondary hover:bg-slate-200'
                    }`}
                  >
                    Monthly CTC
                  </button>
                </div>
              </div>

              {/* CTC Amount Input */}
              <div className="mb-4">
                <label className="block text-xs font-medium text-thb-text-secondary mb-1.5">
                  {ctcType === 'ANNUAL' ? 'Annual CTC Amount' : 'Monthly CTC Amount'}
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-thb-text-muted">
                    {CURRENCY_SYMBOLS[currency] || currency}
                  </span>
                  <input
                    type="text"
                    value={ctcAmount}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9]/g, '');
                      setCtcAmount(val ? parseInt(val).toLocaleString('en-IN') : '');
                      setResult(null);
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder={countryCode === 'IND' ? 'e.g. 10,00,000' : 'e.g. 100,000'}
                    className="w-full pl-10 pr-3 py-3 rounded-lg border border-thb-border text-lg font-bold focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                  />
                </div>
              </div>

              {/* Quick Presets */}
              <div className="mb-4">
                <label className="block text-xs font-medium text-thb-text-secondary mb-1.5">Quick Select</label>
                <div className="flex flex-wrap gap-1.5">
                  {presets.map(p => (
                    <button
                      key={p.label}
                      onClick={() => {
                        setCtcAmount(p.value.toLocaleString('en-IN'));
                        setResult(null);
                      }}
                      className="px-2.5 py-1 rounded-md bg-slate-100 text-xs font-medium text-thb-text-secondary hover:bg-green-50 hover:text-green-600 transition-colors"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* PF/ESI Checkboxes */}
              {countryCode === 'IND' && (
                <div className="mb-4 space-y-2">
                  <label className="flex items-center gap-2 text-xs font-medium text-thb-text-secondary cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={includePF}
                      onChange={(e) => { setIncludePF(e.target.checked); setResult(null); }}
                      className="rounded border-thb-border accent-green-500"
                    />
                    Include Provident Fund (PF)
                    <span className="relative group">
                      <FiInfo className="w-3.5 h-3.5 text-thb-text-muted cursor-help" />
                      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 text-[10px] text-white bg-slate-800 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                        Provident Fund - 12% of basic salary each from employer and employee
                      </span>
                    </span>
                  </label>
                  <label className="flex items-center gap-2 text-xs font-medium text-thb-text-secondary cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={includeESI}
                      onChange={(e) => { setIncludeESI(e.target.checked); setResult(null); }}
                      className="rounded border-thb-border accent-green-500"
                    />
                    Include Employee State Insurance (ESI)
                    <span className="relative group">
                      <FiInfo className="w-3.5 h-3.5 text-thb-text-muted cursor-help" />
                      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 text-[10px] text-white bg-slate-800 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                        Employee State Insurance - Applicable for gross salary up to ₹21,000/month
                      </span>
                    </span>
                  </label>
                </div>
              )}

              {/* Template Selection */}
              <div className="mb-4">
                <label className="flex items-center gap-2 text-xs font-medium text-thb-text-secondary mb-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useCustomTemplate}
                    onChange={(e) => setUseCustomTemplate(e.target.checked)}
                    className="rounded border-thb-border"
                  />
                  Use CTC Template
                </label>
                {useCustomTemplate && (
                  <select
                    value={selectedTemplateId}
                    onChange={(e) => setSelectedTemplateId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 mt-1"
                  >
                    <option value="">Standard Breakdown (Default)</option>
                    {loadingTemplates ? (
                      <option disabled>Loading templates...</option>
                    ) : (
                      templates.map(t => (
                        <option key={t.id} value={t.id}>
                          {t.name} ({t.countryCode} - {t.ctcType})
                          {t.isDefault ? ' ★' : ''}
                        </option>
                      ))
                    )}
                  </select>
                )}
              </div>

              {/* Calculate Button */}
              <button
                onClick={calculateCTC}
                disabled={calculating || !ctcAmount}
                className="w-full px-6 py-3 rounded-lg bg-gradient-to-r from-green-500 to-emerald-600 text-white text-sm font-semibold hover:from-green-600 hover:to-emerald-700 disabled:opacity-50 shadow-lg shadow-green-500/25 transition-all flex items-center justify-center gap-2"
              >
                {calculating ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    Calculating...
                  </>
                ) : (
                  <>
                    <FiPercent className="w-4 h-4" />
                    Calculate Breakdown
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Summary Sidebar (shown when result exists) */}
          {result && (
            <div className="thb-card border-l-4 border-l-teal-500">
              <div className="p-5">
                <h3 className="text-sm font-semibold text-thb-text-primary mb-3 flex items-center gap-2">
                  <FiTrendingUp className="w-4 h-4 text-teal-500" />
                  Quick Summary
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-thb-text-secondary">Annual CTC</span>
                    <span className="text-sm font-bold text-thb-text-primary">{formatCurrency(result.ctcAnnual, currency)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-thb-text-secondary">Gross Salary</span>
                    <span className="text-sm font-semibold text-green-600">{formatCurrency(result.grossSalary.annual, currency)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-thb-text-secondary">Total Deductions</span>
                    <span className="text-sm font-semibold text-red-500">- {formatCurrency(result.totalDeductions.annual, currency)}</span>
                  </div>
                  <div className="h-px bg-thb-border" />
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-thb-text-primary">Monthly In-Hand</span>
                    <span className="text-lg font-bold text-emerald-600">{formatCurrency(result.netTakeHome.monthly, currency)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-thb-text-primary">Annual In-Hand</span>
                    <span className="text-sm font-bold text-emerald-600">{formatCurrency(result.netTakeHome.annual, currency)}</span>
                  </div>
                </div>

                {/* Ratio Visualization */}
                <div className="mt-4 pt-3 border-t border-thb-border">
                  <p className="text-[10px] font-medium text-thb-text-muted uppercase tracking-wider mb-2">CTC Composition</p>
                  <div className="flex h-4 rounded-full overflow-hidden">
                    <div
                      className="bg-green-500 transition-all"
                      style={{ width: `${(result.grossSalary.annual / result.ctcAnnual * 100)}%` }}
                      title={`Gross: ${formatCurrency(result.grossSalary.annual, currency)}`}
                    />
                    <div
                      className="bg-teal-500 transition-all"
                      style={{ width: `${((result.ctcAnnual - result.grossSalary.annual) / result.ctcAnnual * 100)}%` }}
                      title={`Employer Contributions: ${formatCurrency(result.ctcAnnual - result.grossSalary.annual, currency)}`}
                    />
                  </div>
                  <div className="flex items-center gap-4 mt-2">
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                      <span className="text-[10px] text-thb-text-muted">Gross ({((result.grossSalary.annual / result.ctcAnnual) * 100).toFixed(0)}%)</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full bg-teal-500" />
                      <span className="text-[10px] text-thb-text-muted">Employer ({(((result.ctcAnnual - result.grossSalary.annual) / result.ctcAnnual) * 100).toFixed(0)}%)</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ─── Result Panel ─── */}
        <div className="lg:col-span-2 space-y-4">
          {!result ? (
            /* Empty State */
            <div className="thb-card p-16 text-center">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-green-100 to-emerald-100 flex items-center justify-center mx-auto mb-4">
                <FiPercent className="w-10 h-10 text-green-500" />
              </div>
              <h3 className="text-lg font-semibold text-thb-text-primary mb-2">CTC Calculator</h3>
              <p className="text-sm text-thb-text-secondary max-w-md mx-auto leading-relaxed">
                Enter a CTC amount and click Calculate to see the complete salary breakdown including
                earnings, employer contributions, deductions, and monthly take-home pay.
              </p>
              <div className="mt-6 flex items-center justify-center gap-6">
                <div className="text-center">
                  <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center mx-auto mb-1">
                    <FiTrendingUp className="w-5 h-5 text-green-500" />
                  </div>
                  <p className="text-[10px] text-thb-text-muted">Earnings</p>
                </div>
                <FiArrowRight className="w-4 h-4 text-thb-text-muted" />
                <div className="text-center">
                  <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center mx-auto mb-1">
                    <FiShield className="w-5 h-5 text-teal-500" />
                  </div>
                  <p className="text-[10px] text-thb-text-muted">Employer PF & Gratuity</p>
                </div>
                <FiArrowRight className="w-4 h-4 text-thb-text-muted" />
                <div className="text-center">
                  <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center mx-auto mb-1">
                    <FiTrendingDown className="w-5 h-5 text-red-500" />
                  </div>
                  <p className="text-[10px] text-thb-text-muted">Deductions</p>
                </div>
                <FiArrowRight className="w-4 h-4 text-thb-text-muted" />
                <div className="text-center">
                  <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center mx-auto mb-1">
                    <FiDollarSign className="w-5 h-5 text-emerald-500" />
                  </div>
                  <p className="text-[10px] text-thb-text-muted">Take-Home</p>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* ─── Top Cards: CTC → Gross → In-Hand ─── */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="thb-card p-5 border-t-4 border-t-emerald-500">
                  <p className="text-xs font-medium text-thb-text-secondary mb-1">Annual CTC</p>
                  <p className="text-xl font-bold text-emerald-600">{formatCurrency(result.ctcAnnual, currency)}</p>
                  <p className="text-xs text-thb-text-muted mt-0.5">Monthly: {formatCurrency(result.ctcMonthly, currency)}</p>
                </div>
                <div className="thb-card p-5 border-t-4 border-t-green-500">
                  <p className="text-xs font-medium text-thb-text-secondary mb-1">Gross Salary</p>
                  <p className="text-xl font-bold text-green-600">{formatCurrency(result.grossSalary.annual, currency)}</p>
                  <p className="text-xs text-thb-text-muted mt-0.5">Monthly: {formatCurrency(result.grossSalary.monthly, currency)}</p>
                </div>
                <div className="thb-card p-5 border-t-4 border-t-emerald-500">
                  <p className="text-xs font-medium text-thb-text-secondary mb-1">Monthly In-Hand</p>
                  <p className="text-xl font-bold text-emerald-600">{formatCurrency(result.netTakeHome.monthly, currency)}</p>
                  <p className="text-xs text-thb-text-muted mt-0.5">Annual: {formatCurrency(result.netTakeHome.annual, currency)}</p>
                </div>
              </div>

              {/* ─── Detailed Breakdown Tabs ─── */}
              <div className="thb-card overflow-hidden">
                {/* Tab Headers */}
                <div className="flex border-b border-thb-border bg-slate-50/50">
                  <button
                    onClick={() => setShowBreakdown('earnings')}
                    className={`flex-1 px-4 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                      showBreakdown === 'earnings'
                        ? 'text-green-600 border-b-2 border-b-green-500 bg-white'
                        : 'text-thb-text-secondary hover:text-thb-text-primary'
                    }`}
                  >
                    <FiTrendingUp className="w-4 h-4" />
                    Earnings
                    <span className="text-xs px-1.5 py-0.5 rounded-full bg-green-100 text-green-600">
                      {normalizedEarnings.length}
                    </span>
                  </button>
                  <button
                    onClick={() => setShowBreakdown('employer')}
                    className={`flex-1 px-4 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                      showBreakdown === 'employer'
                        ? 'text-teal-600 border-b-2 border-b-teal-500 bg-white'
                        : 'text-thb-text-secondary hover:text-thb-text-primary'
                    }`}
                  >
                    <FiShield className="w-4 h-4" />
                    Employer Contributions
                    <span className="text-xs px-1.5 py-0.5 rounded-full bg-teal-100 text-teal-600">
                      {normalizedEmployerContribs.length}
                    </span>
                  </button>
                  <button
                    onClick={() => setShowBreakdown('deductions')}
                    className={`flex-1 px-4 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                      showBreakdown === 'deductions'
                        ? 'text-red-600 border-b-2 border-b-red-500 bg-white'
                        : 'text-thb-text-secondary hover:text-thb-text-primary'
                    }`}
                  >
                    <FiTrendingDown className="w-4 h-4" />
                    Deductions
                    <span className="text-xs px-1.5 py-0.5 rounded-full bg-red-100 text-red-600">
                      {normalizedDeductions.length}
                    </span>
                  </button>
                </div>

                <div className="p-5">
                  {/* ─── Earnings Breakdown ─── */}
                  {showBreakdown === 'earnings' && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-medium text-thb-text-secondary">
                          Gross Salary = Sum of all earnings = {formatCurrency(result.grossSalary.annual, currency)}/year
                        </p>
                      </div>
                      {normalizedEarnings.map((comp) => {
                        const pct = comp.pctOfCTC ? parseFloat(comp.pctOfCTC) : 0;
                        return (
                          <div key={comp.name} className="group">
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-thb-text-primary">{comp.name}</span>
                                {comp.pctOfCTC && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-50 text-green-600 font-medium">
                                    {comp.pctOfCTC}% of CTC
                                  </span>
                                )}
                              </div>
                              <div className="text-right">
                                <span className="text-sm font-semibold text-thb-text-primary">
                                  {formatCurrency(comp.annual, currency)}
                                </span>
                                <span className="text-xs text-thb-text-muted ml-2">
                                  /mo: {formatCurrency(comp.monthly, currency)}
                                </span>
                              </div>
                            </div>
                            <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-green-400 to-green-500 transition-all duration-500"
                                style={{ width: `${Math.min(100, (pct / maxBarPct) * 100)}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}

                      {/* Gross Total */}
                      <div className="mt-4 pt-3 border-t border-thb-border flex items-center justify-between">
                        <span className="text-sm font-semibold text-green-600">Total Gross Salary</span>
                        <div className="text-right">
                          <span className="text-base font-bold text-green-600">
                            {formatCurrency(result.grossSalary.annual, currency)}
                          </span>
                          <span className="text-xs text-thb-text-muted ml-2">
                            /mo: {formatCurrency(result.grossSalary.monthly, currency)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ─── Employer Contributions ─── */}
                  {showBreakdown === 'employer' && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 mb-2">
                        <FiInfo className="w-4 h-4 text-teal-400" />
                        <p className="text-xs text-thb-text-secondary">
                          These amounts are set aside by the company and are part of CTC, but not received directly in your monthly paycheck
                        </p>
                      </div>
                      {normalizedEmployerContribs.map((comp) => {
                        const pct = comp.pctOfCTC ? parseFloat(comp.pctOfCTC) : 0;
                        return (
                          <div key={comp.name} className="group">
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-thb-text-primary">{comp.name}</span>
                                {comp.pctOfCTC && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-teal-50 text-teal-600 font-medium">
                                    {comp.pctOfCTC}% of CTC
                                  </span>
                                )}
                              </div>
                              <div className="text-right">
                                <span className="text-sm font-semibold text-thb-text-primary">
                                  {formatCurrency(comp.annual, currency)}
                                </span>
                                <span className="text-xs text-thb-text-muted ml-2">
                                  /mo: {formatCurrency(comp.monthly, currency)}
                                </span>
                              </div>
                            </div>
                            <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-teal-400 to-teal-500 transition-all duration-500"
                                style={{ width: `${Math.min(100, (pct / 20) * 100)}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}

                      {/* Employer Total */}
                      <div className="mt-4 pt-3 border-t border-thb-border flex items-center justify-between">
                        <span className="text-sm font-semibold text-teal-600">Total Employer Contributions</span>
                        <div className="text-right">
                          <span className="text-base font-bold text-teal-600">
                            {formatCurrency(result.ctcAnnual - result.grossSalary.annual, currency)}
                          </span>
                          <span className="text-xs text-thb-text-muted ml-2">
                            /mo: {formatCurrency(Math.round((result.ctcAnnual - result.grossSalary.annual) / 12), currency)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ─── Deductions Breakdown ─── */}
                  {showBreakdown === 'deductions' && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 mb-2">
                        <FiAlertCircle className="w-4 h-4 text-red-400" />
                        <p className="text-xs text-thb-text-secondary">
                          These are subtracted from Gross Salary to arrive at your take-home pay
                        </p>
                      </div>
                      {normalizedDeductions.map((comp) => {
                        const pct = comp.pctOfGross ? parseFloat(comp.pctOfGross) : 0;
                        return (
                          <div key={comp.name} className="group">
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-thb-text-primary">{comp.name}</span>
                                {comp.pctOfGross && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-50 text-red-600 font-medium">
                                    {comp.pctOfGross}% of Gross
                                  </span>
                                )}
                              </div>
                              <div className="text-right">
                                <span className="text-sm font-semibold text-red-500">
                                  - {formatCurrency(comp.annual, currency)}
                                </span>
                                <span className="text-xs text-thb-text-muted ml-2">
                                  /mo: {formatCurrency(comp.monthly, currency)}
                                </span>
                              </div>
                            </div>
                            <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-red-400 to-red-500 transition-all duration-500"
                                style={{ width: `${Math.min(100, (pct / 30) * 100)}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}

                      {/* Deductions Total */}
                      <div className="mt-4 pt-3 border-t border-thb-border flex items-center justify-between">
                        <span className="text-sm font-semibold text-red-600">Total Deductions</span>
                        <div className="text-right">
                          <span className="text-base font-bold text-red-500">
                            - {formatCurrency(result.totalDeductions.annual, currency)}
                          </span>
                          <span className="text-xs text-thb-text-muted ml-2">
                            /mo: {formatCurrency(result.totalDeductions.monthly, currency)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* ─── Complete Salary Structure Table ─── */}
              <div className="thb-card overflow-hidden">
                <div className="px-5 py-4 border-b border-thb-border bg-slate-50/50">
                  <h3 className="text-sm font-semibold text-thb-text-primary flex items-center gap-2">
                    <FiFileText className="w-4 h-4 text-green-500" />
                    Complete Salary Structure
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-slate-50 border-b border-thb-border">
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-thb-text-muted uppercase">Component</th>
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-thb-text-muted uppercase">Category</th>
                        <th className="text-right px-4 py-2.5 text-xs font-semibold text-thb-text-muted uppercase">Annual</th>
                        <th className="text-right px-4 py-2.5 text-xs font-semibold text-thb-text-muted uppercase">Monthly</th>
                        <th className="text-right px-4 py-2.5 text-xs font-semibold text-thb-text-muted uppercase">% of CTC</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-thb-border/50">
                      {/* Earnings Section */}
                      <tr className="bg-green-50/30">
                        <td colSpan={5} className="px-4 py-2 text-xs font-bold text-green-600 uppercase tracking-wider">
                          Earnings (Gross Salary Components)
                        </td>
                      </tr>
                      {normalizedEarnings.map((comp) => (
                        <tr key={comp.name} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-4 py-2.5 text-sm font-medium text-thb-text-primary">{comp.name}</td>
                          <td className="px-4 py-2.5">
                            <span className="thb-badge thb-badge-success text-[10px]">Earning</span>
                          </td>
                          <td className="px-4 py-2.5 text-sm text-right font-medium text-thb-text-primary">{formatNumber(comp.annual, currency)}</td>
                          <td className="px-4 py-2.5 text-sm text-right text-thb-text-secondary">{formatNumber(comp.monthly, currency)}</td>
                          <td className="px-4 py-2.5 text-sm text-right text-thb-text-secondary">{comp.pctOfCTC || '—'}%</td>
                        </tr>
                      ))}
                      <tr className="bg-green-50/50 font-semibold">
                        <td className="px-4 py-2.5 text-sm text-green-700" colSpan={2}>Gross Salary</td>
                        <td className="px-4 py-2.5 text-sm text-right text-green-700">{formatNumber(result.grossSalary.annual, currency)}</td>
                        <td className="px-4 py-2.5 text-sm text-right text-green-700">{formatNumber(result.grossSalary.monthly, currency)}</td>
                        <td className="px-4 py-2.5 text-sm text-right text-green-700">{((result.grossSalary.annual / result.ctcAnnual) * 100).toFixed(1)}%</td>
                      </tr>

                      {/* Employer Contributions */}
                      <tr className="bg-teal-50/30">
                        <td colSpan={5} className="px-4 py-2 text-xs font-bold text-teal-600 uppercase tracking-wider">
                          Employer Contributions (Part of CTC, Not in Hand)
                        </td>
                      </tr>
                      {normalizedEmployerContribs.map((comp) => (
                        <tr key={comp.name} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-4 py-2.5 text-sm font-medium text-thb-text-primary">{comp.name}</td>
                          <td className="px-4 py-2.5">
                            <span className="thb-badge thb-badge-info text-[10px]">Employer</span>
                          </td>
                          <td className="px-4 py-2.5 text-sm text-right font-medium text-thb-text-primary">{formatNumber(comp.annual, currency)}</td>
                          <td className="px-4 py-2.5 text-sm text-right text-thb-text-secondary">{formatNumber(comp.monthly, currency)}</td>
                          <td className="px-4 py-2.5 text-sm text-right text-thb-text-secondary">{comp.pctOfCTC || '—'}%</td>
                        </tr>
                      ))}

                      {/* Deductions */}
                      <tr className="bg-red-50/30">
                        <td colSpan={5} className="px-4 py-2 text-xs font-bold text-red-600 uppercase tracking-wider">
                          Employee Deductions (Subtracted from Gross)
                        </td>
                      </tr>
                      {normalizedDeductions.map((comp) => (
                        <tr key={comp.name} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-4 py-2.5 text-sm font-medium text-thb-text-primary">{comp.name}</td>
                          <td className="px-4 py-2.5">
                            <span className="thb-badge thb-badge-error text-[10px]">Deduction</span>
                          </td>
                          <td className="px-4 py-2.5 text-sm text-right font-medium text-red-500">- {formatNumber(comp.annual, currency)}</td>
                          <td className="px-4 py-2.5 text-sm text-right text-red-400">- {formatNumber(comp.monthly, currency)}</td>
                          <td className="px-4 py-2.5 text-sm text-right text-thb-text-secondary">{comp.pctOfGross || comp.pctOfCTC || '—'}%</td>
                        </tr>
                      ))}
                      <tr className="bg-red-50/50 font-semibold">
                        <td className="px-4 py-2.5 text-sm text-red-700" colSpan={2}>Total Deductions</td>
                        <td className="px-4 py-2.5 text-sm text-right text-red-700">- {formatNumber(result.totalDeductions.annual, currency)}</td>
                        <td className="px-4 py-2.5 text-sm text-right text-red-700">- {formatNumber(result.totalDeductions.monthly, currency)}</td>
                        <td className="px-4 py-2.5 text-sm text-right text-red-700">{((result.totalDeductions.annual / result.grossSalary.annual) * 100).toFixed(1)}%</td>
                      </tr>

                      {/* Net Take-Home */}
                      <tr className="bg-emerald-50/30">
                        <td colSpan={5} className="px-4 py-2 text-xs font-bold text-emerald-600 uppercase tracking-wider">
                          Net Take-Home Salary
                        </td>
                      </tr>
                      <tr className="bg-emerald-50/50 font-bold">
                        <td className="px-4 py-3 text-base text-emerald-700" colSpan={2}>In-Hand Salary</td>
                        <td className="px-4 py-3 text-base text-right text-emerald-700">{formatNumber(result.netTakeHome.annual, currency)}</td>
                        <td className="px-4 py-3 text-base text-right text-emerald-700">{formatNumber(result.netTakeHome.monthly, currency)}</td>
                        <td className="px-4 py-3 text-base text-right text-emerald-700">{((result.netTakeHome.annual / result.ctcAnnual) * 100).toFixed(1)}%</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ─── CTC Flow Diagram ─── */}
              <div className="thb-card overflow-hidden">
                <div className="px-5 py-4 border-b border-thb-border bg-slate-50/50">
                  <h3 className="text-sm font-semibold text-thb-text-primary flex items-center gap-2">
                    <FiPercent className="w-4 h-4 text-emerald-500" />
                    CTC to In-Hand Flow
                  </h3>
                </div>
                <div className="p-5">
                  {/* Visual Flow */}
                  <div className="flex flex-col items-center gap-3">
                    {/* CTC Box */}
                    <div className="w-full max-w-md p-4 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-center text-white shadow-lg">
                      <p className="text-xs font-medium opacity-80">Cost to Company (CTC)</p>
                      <p className="text-2xl font-bold mt-1">{formatCurrency(result.ctcAnnual, currency)}/yr</p>
                    </div>
                    <FiArrowRight className="w-5 h-5 text-thb-text-muted rotate-90" />

                    {/* Split: Gross + Employer */}
                    <div className="w-full grid grid-cols-2 gap-3 max-w-md">
                      <div className="p-3 rounded-xl bg-green-50 border border-green-200 text-center">
                        <p className="text-[10px] font-medium text-green-600 uppercase">Gross Salary</p>
                        <p className="text-sm font-bold text-green-700 mt-1">{formatCurrency(result.grossSalary.annual, currency)}</p>
                        <p className="text-[10px] text-green-500">Your salary before deductions</p>
                      </div>
                      <div className="p-3 rounded-xl bg-teal-50 border border-teal-200 text-center">
                        <p className="text-[10px] font-medium text-teal-600 uppercase">Employer Contributions</p>
                        <p className="text-sm font-bold text-teal-700 mt-1">{formatCurrency(result.ctcAnnual - result.grossSalary.annual, currency)}</p>
                        <p className="text-[10px] text-teal-500">PF, Gratuity (not in hand)</p>
                      </div>
                    </div>
                    <FiArrowRight className="w-5 h-5 text-thb-text-muted rotate-90" />

                    {/* Deductions */}
                    <div className="w-full max-w-md p-3 rounded-xl bg-red-50 border border-red-200 text-center">
                      <p className="text-[10px] font-medium text-red-600 uppercase">Employee Deductions</p>
                      <p className="text-lg font-bold text-red-600 mt-1">- {formatCurrency(result.totalDeductions.annual, currency)}</p>
                      <div className="flex items-center justify-center gap-3 mt-1">
                        {normalizedDeductions.map((d) => (
                          <span key={d.name} className="text-[10px] text-red-500">
                            {d.name}: {formatCurrency(d.annual, currency)}
                          </span>
                        )).reduce<React.ReactNode[]>((acc, el, i) => {
                          if (i > 0) acc.push(<span key={`sep-${i}`} className="text-red-300">|</span>);
                          acc.push(el);
                          return acc;
                        }, [])}
                      </div>
                    </div>
                    <FiArrowRight className="w-5 h-5 text-thb-text-muted rotate-90" />

                    {/* In-Hand */}
                    <div className="w-full max-w-md p-4 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-center text-white shadow-lg">
                      <p className="text-xs font-medium opacity-80">Monthly In-Hand Salary</p>
                      <p className="text-2xl font-bold mt-1">{formatCurrency(result.netTakeHome.monthly, currency)}/mo</p>
                      <p className="text-xs opacity-80 mt-1">Annual: {formatCurrency(result.netTakeHome.annual, currency)}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* ─── Apply to Employee Section ─── */}
              {isAdmin && result && (
                <div className="thb-card border-l-4 border-l-amber-500">
                  <div className="p-5">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-thb-text-primary flex items-center gap-2">
                        <FiUsers className="w-4 h-4 text-amber-500" />
                        Apply CTC Structure to Employee(s)
                      </h3>
                      <button
                        onClick={() => setShowApplySection(!showApplySection)}
                        className="text-xs text-amber-600 hover:text-amber-700 font-medium"
                      >
                        {showApplySection ? 'Cancel' : 'Apply Now'}
                      </button>
                    </div>

                    {showApplySection ? (
                      <div className="space-y-4">
                        {/* Mode toggle */}
                        <div className="flex gap-2">
                          <button
                            onClick={() => { setApplyMode('single'); setSearchResults([]); setSelectedEmployeeIds([]); }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium ${applyMode === 'single' ? 'bg-amber-500 text-white' : 'bg-slate-100 text-thb-text-secondary'}`}
                          >
                            Single Employee
                          </button>
                          <button
                            onClick={() => { setApplyMode('bulk'); setSearchResults([]); setSelectedEmployeeIds([]); }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium ${applyMode === 'bulk' ? 'bg-amber-500 text-white' : 'bg-slate-100 text-thb-text-secondary'}`}
                          >
                            Bulk by Department/Designation/Branch
                          </button>
                        </div>

                        {applyMode === 'single' ? (
                          /* Single employee search */
                          <div>
                            <div className="relative">
                              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-thb-text-muted" />
                              <input
                                type="text"
                                value={employeeSearch}
                                onChange={e => { setEmployeeSearch(e.target.value); searchEmployees(e.target.value); }}
                                placeholder="Search by name, email, or employee ID..."
                                className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                              />
                            </div>
                            {searchResults.length > 0 && (
                              <div className="mt-2 max-h-60 overflow-y-auto border border-thb-border rounded-lg">
                                {searchResults.map(emp => (
                                  <label key={emp.id} className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 cursor-pointer border-b border-slate-50 last:border-0">
                                    <input
                                      type="checkbox"
                                      checked={selectedEmployeeIds.includes(emp.id)}
                                      onChange={() => {
                                        setSelectedEmployeeIds(prev =>
                                          prev.includes(emp.id) ? prev.filter(id => id !== emp.id) : [...prev, emp.id]
                                        );
                                      }}
                                      className="w-4 h-4 rounded"
                                    />
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium text-thb-text-primary truncate">{emp.firstName} {emp.lastName}</p>
                                      <p className="text-xs text-thb-text-muted">{emp.email} · {emp.employeeId}</p>
                                    </div>
                                    <span className="text-xs text-thb-text-muted">{emp.department?.name || 'N/A'}</span>
                                  </label>
                                ))}
                              </div>
                            )}
                          </div>
                        ) : (
                          /* Bulk filter */
                          <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Filter By</label>
                                <select
                                  value={bulkFilter}
                                  onChange={e => { setBulkFilter(e.target.value as any); setBulkFilterValue(''); setFilterOptions([]); setSearchResults([]); fetchFilterOptions(e.target.value); }}
                                  className="w-full px-3 py-2 rounded-lg border border-thb-border text-sm bg-white"
                                >
                                  <option value="department">Department</option>
                                  <option value="designation">Designation</option>
                                  <option value="branch">Branch</option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Select {bulkFilter}</label>
                                <select
                                  value={bulkFilterValue}
                                  onChange={e => { setBulkFilterValue(e.target.value); }}
                                  className="w-full px-3 py-2 rounded-lg border border-thb-border text-sm bg-white"
                                >
                                  <option value="">— Select —</option>
                                  {filterOptions.map((opt: any) => (
                                    <option key={opt.id} value={opt.id}>{opt.name || opt.title}</option>
                                  ))}
                                </select>
                              </div>
                            </div>
                            {bulkFilterValue && (
                              <button
                                onClick={fetchBulkEmployees}
                                className="px-3 py-1.5 rounded-lg bg-slate-100 text-thb-text-secondary text-xs font-medium hover:bg-slate-200"
                              >
                                Fetch Employees
                              </button>
                            )}
                            {searchResults.length > 0 && (
                              <div className="text-xs text-thb-text-muted">
                                {searchResults.length} employees found · {selectedEmployeeIds.length} selected
                              </div>
                            )}
                          </div>
                        )}

                        {/* Selected employees list */}
                        {selectedEmployeeIds.length > 0 && (
                          <div className="bg-amber-50 rounded-lg p-3">
                            <p className="text-xs font-medium text-amber-800 mb-2">{selectedEmployeeIds.length} employee(s) selected</p>
                            <div className="flex flex-wrap gap-1.5">
                              {selectedEmployeeIds.slice(0, 5).map(id => {
                                const emp = searchResults.find(e => e.id === id);
                                return <span key={id} className="text-xs bg-white px-2 py-0.5 rounded border border-amber-200">{emp ? `${emp.firstName} ${emp.lastName}` : id.slice(0, 8)}</span>;
                              })}
                              {selectedEmployeeIds.length > 5 && <span className="text-xs text-amber-600">+{selectedEmployeeIds.length - 5} more</span>}
                            </div>
                          </div>
                        )}

                        {/* Apply button */}
                        <div className="flex gap-2">
                          <button
                            onClick={handleApplyToEmployees}
                            disabled={applying || selectedEmployeeIds.length === 0}
                            className="px-4 py-2.5 rounded-lg bg-amber-500 text-white text-sm font-medium hover:bg-amber-600 disabled:opacity-50 transition-colors flex items-center gap-2"
                          >
                            {applying ? <><FiSave className="w-4 h-4 animate-spin" /> Applying...</> : <><FiCheck className="w-4 h-4" /> Apply Structure to {selectedEmployeeIds.length} Employee(s)</>}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-thb-text-secondary">
                        Apply this CTC breakdown ({formatCurrency(result.ctcAnnual, currency)}/yr) to one or multiple employees.
                        The salary components will be saved as each employee's payroll configuration.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
