'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  FiFileText, FiCheck, FiX, FiPlus, FiEdit2, FiEye, FiRefreshCw,
  FiSearch, FiChevronDown, FiChevronUp, FiInfo, FiAlertTriangle,
  FiArrowRight, FiTrendingUp, FiTrendingDown, FiShield,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import { useCompanyContextStore } from '@/store/companyContextStore';

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

const CURRENCY_SYMBOLS: Record<string, string> = { INR: '₹', USD: '$' };
const fmt = (n: number) => `₹${n.toLocaleString('en-IN')}`;

// ─── Tax Calculation State ───
interface TaxInput {
  annualGrossIncome: number;
  ageGroup: 'BELOW_60' | 'SENIOR' | 'ABOVE_80';
  regime: 'NEW' | 'OLD' | 'BOTH';
  basicSalary: number;
  section80C: number;
  section80D: number;
  section80CCD: number;
  section24b: number;
  hraActual: number;
  hraRentPaid: number;
  hraIsMetro: boolean;
  section80E: number;
  section80G: number;
  section80TTA: number;
  otherDeductions: number;
}

interface TaxResult {
  newRegime: { taxableIncome: number; tax: number; surcharge: number; cess: number; totalTax: number; monthlyTDS: number; standardDeduction: number };
  oldRegime: { taxableIncome: number; tax: number; surcharge: number; cess: number; totalTax: number; monthlyTDS: number; standardDeduction: number; totalDeductions: number; hraExemption: number };
  comparison: { betterRegime: string; savings: number };
  newRegimeSlabs: Array<{ from: number; to: number | null; rate: number; tax: number }>;
}

// ─── Declaration State ───
interface Declaration {
  id: string;
  employeeId: string;
  employee?: { firstName: string; lastName: string; employeeId: string };
  financialYear: string;
  regimeType: string;
  section80C_Total: number;
  section80D_Total: number;
  totalDeductions: number;
  taxableIncome: number;
  estimatedTax: number;
  status: string;
  submittedAt: string | null;
  reviewComments: string | null;
  createdAt: string;
}

const defaultTaxInput: TaxInput = {
  annualGrossIncome: 0, ageGroup: 'BELOW_60', regime: 'BOTH', basicSalary: 0,
  section80C: 0, section80D: 0, section80CCD: 0, section24b: 0,
  hraActual: 0, hraRentPaid: 0, hraIsMetro: false,
  section80E: 0, section80G: 0, section80TTA: 0, otherDeductions: 0,
};

type TabType = 'calculator' | 'declarations';

export default function IncomeTaxPage() {
  const { user } = useAuthStore();
  const effectiveCompanyId = useCompanyContextStore(s => s.effectiveCompanyId);
  const isAdmin = user?.role === 'super_admin' || user?.role === 'tenant_admin' || user?.role === 'admin';

  const [activeTab, setActiveTab] = useState<TabType>('calculator');
  const [taxInput, setTaxInput] = useState<TaxInput>(defaultTaxInput);
  const [taxResult, setTaxResult] = useState<TaxResult | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [showOldRegimeDetails, setShowOldRegimeDetails] = useState(false);

  // Declarations
  const [declarations, setDeclarations] = useState<Declaration[]>([]);
  const [loadingDecs, setLoadingDecs] = useState(false);
  const [showDecForm, setShowDecForm] = useState(false);
  const [editingDecId, setEditingDecId] = useState<string | null>(null);
  const [viewingDec, setViewingDec] = useState<Declaration | null>(null);
  const [decForm, setDecForm] = useState({
    financialYear: '2024-25', regimeType: 'NEW', employeeId: '',
    section80C_PPF: 0, section80C_ELSS: 0, section80C_LIC: 0, section80C_HomeLoanPrincipal: 0, section80C_Other: 0,
    section80D_Self: 0, section80D_Parents: 0, section80CCD_NPS: 0, section24b_HomeLoanInterest: 0,
    hra_ActualHRA: 0, hra_RentPaid: 0, hra_IsMetro: false, basicSalary: 0,
    section80E_EducationLoan: 0, section80G_Donations: 0, section80TTA_SavingsInterest: 0, otherDeductions: 0,
  });
  const [submittingDec, setSubmittingDec] = useState(false);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [employees, setEmployees] = useState<Array<{ id: string; employeeId: string; firstName: string; lastName: string; email: string; department?: { name: string } | null }>>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false);

  // ─── Fetch Employees for HR/Admin dropdown ───
  const fetchEmployees = useCallback(async (search: string = '') => {
    if (!isAdmin) return;
    try {
      setLoadingEmployees(true);
      const params = new URLSearchParams({ limit: '20' });
      if (search) params.set('search', search);
      const res = await fetch(`/api/employees?${scopeQuery}${params}` , { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setEmployees(data.employees || []);
      }
    } catch { /* silently */ }
    finally { setLoadingEmployees(false); }
  }, [isAdmin]);
  const cid = effectiveCompanyId();
  const scopeQuery = cid ? `companyId=${cid}&` : '';


  useEffect(() => {
    if (isAdmin && showDecForm) {
      queueMicrotask(() => fetchEmployees(employeeSearch));
    }
  }, [isAdmin, showDecForm, employeeSearch, fetchEmployees]);

  // ─── Tax Calculator ───
  const calculateTax = useCallback(async () => {
    if (!taxInput.annualGrossIncome || taxInput.annualGrossIncome <= 0) {
      toast.error('Please enter annual gross income');
      return;
    }
    setCalculating(true);
    try {
      const res = await fetch(`/api/payroll/income-tax?${scopeQuery}` , {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(taxInput),
      });
      if (res.ok) {
        const data = await res.json();
        setTaxResult(data.data);
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to calculate tax');
      }
    } catch {
      toast.error('Failed to calculate tax');
    } finally {
      setCalculating(false);
    }
  }, [taxInput]);

  // ─── Fetch Declarations ───
  const fetchDeclarations = useCallback(async () => {
    try {
      setLoadingDecs(true);
      const res = await fetch(`/api/payroll/income-tax-declarations?${scopeQuery}` , { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setDeclarations(Array.isArray(data.data) ? data.data : []);
      }
    } catch {
      toast.error('Failed to load declarations');
    } finally {
      setLoadingDecs(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'declarations') queueMicrotask(() => fetchDeclarations());
  }, [activeTab, fetchDeclarations]);

  // ─── Declaration CRUD ───
  const handleCreateDeclaration = async () => {
    setSubmittingDec(true);
    try {
      const payload = { ...decForm, status: 'DRAFT' };
      const res = await fetch(`/api/payroll/income-tax-declarations?${scopeQuery}` , {
        method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(payload),
      });
      if (res.ok) {
        toast.success('Declaration created');
        setShowDecForm(false);
        fetchDeclarations();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed');
      }
    } catch { toast.error('Failed'); }
    finally { setSubmittingDec(false); }
  };

  const handleUpdateStatus = async (id: string, status: string, comments?: string) => {
    try {
      const res = await fetch(`/api/payroll/income-tax-declarations/${id}?${scopeQuery}` , {
        method: 'PUT', headers: getAuthHeaders(),
        body: JSON.stringify({ status, reviewComments: comments || '' }),
      });
      if (res.ok) {
        toast.success(`Declaration ${status.toLowerCase()}`);
        fetchDeclarations();
        setViewingDec(null);
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed');
      }
    } catch { toast.error('Failed'); }
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, string> = {
      DRAFT: 'bg-slate-100 text-slate-700',
      SUBMITTED: 'bg-green-100 text-green-700',
      APPROVED: 'bg-emerald-100 text-emerald-700',
      REJECTED: 'bg-red-100 text-red-700',
    };
    return map[status] || 'bg-slate-100 text-slate-700';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-thb-text-primary flex items-center gap-2">
          <FiFileText className="w-6 h-6 text-amber-500" />
          Income Tax
        </h1>
        <p className="text-thb-text-secondary mt-1">Income tax calculator and declaration management</p>
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg w-fit">
        {([
          { key: 'calculator', label: 'Tax Calculator', icon: FiTrendingUp },
          { key: 'declarations', label: 'Tax Declarations', icon: FiFileText },
        ] as { key: TabType; label: string; icon: React.ComponentType<{ className?: string }> }[]).map(tab => {
          const IconComp = tab.icon;
          return (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${
                activeTab === tab.key ? 'bg-white text-green-600 shadow-sm' : 'text-thb-text-secondary hover:text-thb-text-primary'}`}>
              <IconComp className="w-4 h-4" />{tab.label}
            </button>
          );
        })}
      </div>

      {/* ═══════ TAX CALCULATOR ═══════ */}
      {activeTab === 'calculator' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Input Panel */}
          <div className="lg:col-span-1 space-y-4">
            <div className="thb-card border-l-4 border-l-amber-500 p-5 space-y-4">
              <h3 className="text-sm font-semibold text-thb-text-primary">Tax Calculation Inputs</h3>

              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Annual Gross Income (₹)</label>
                <input type="number" value={taxInput.annualGrossIncome || ''} onChange={e => setTaxInput({ ...taxInput, annualGrossIncome: Number(e.target.value) })}
                  placeholder="e.g. 1200000" className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20" />
              </div>

              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Age Group</label>
                <select value={taxInput.ageGroup} onChange={e => setTaxInput({ ...taxInput, ageGroup: e.target.value as TaxInput['ageGroup'] })}
                  className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20">
                  <option value="BELOW_60">Below 60 years</option>
                  <option value="SENIOR">60-80 years (Senior Citizen)</option>
                  <option value="ABOVE_80">Above 80 years (Super Senior)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Compare Regime</label>
                <select value={taxInput.regime} onChange={e => setTaxInput({ ...taxInput, regime: e.target.value as TaxInput['regime'] })}
                  className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20">
                  <option value="BOTH">Both (Compare)</option>
                  <option value="NEW">New Regime Only</option>
                  <option value="OLD">Old Regime Only</option>
                </select>
              </div>

              <button onClick={() => setShowOldRegimeDetails(!showOldRegimeDetails)}
                className="flex items-center gap-2 text-xs font-medium text-green-600 hover:text-green-700">
                {showOldRegimeDetails ? <FiChevronUp /> : <FiChevronDown />}Old Regime Deductions
              </button>

              {showOldRegimeDetails && (
                <div className="space-y-3 p-3 bg-slate-50 rounded-lg">
                  <div>
                    <label className="block text-xs text-thb-text-secondary mb-1">Basic Salary (Annual) ₹</label>
                    <input type="number" value={taxInput.basicSalary || ''} onChange={e => setTaxInput({ ...taxInput, basicSalary: Number(e.target.value) })}
                      className="w-full px-3 py-2 rounded-lg border border-thb-border text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs text-thb-text-secondary mb-1">Section 80C (max ₹1.5L)</label>
                    <input type="number" value={taxInput.section80C || ''} onChange={e => setTaxInput({ ...taxInput, section80C: Number(e.target.value) })}
                      className="w-full px-3 py-2 rounded-lg border border-thb-border text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs text-thb-text-secondary mb-1">Section 80D (Medical Insurance)</label>
                    <input type="number" value={taxInput.section80D || ''} onChange={e => setTaxInput({ ...taxInput, section80D: Number(e.target.value) })}
                      className="w-full px-3 py-2 rounded-lg border border-thb-border text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs text-thb-text-secondary mb-1">Section 80CCD(1B) - NPS (max ₹50K)</label>
                    <input type="number" value={taxInput.section80CCD || ''} onChange={e => setTaxInput({ ...taxInput, section80CCD: Number(e.target.value) })}
                      className="w-full px-3 py-2 rounded-lg border border-thb-border text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs text-thb-text-secondary mb-1">Section 24(b) - Home Loan Interest (max ₹2L)</label>
                    <input type="number" value={taxInput.section24b || ''} onChange={e => setTaxInput({ ...taxInput, section24b: Number(e.target.value) })}
                      className="w-full px-3 py-2 rounded-lg border border-thb-border text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs text-thb-text-secondary mb-1">HRA - Actual HRA Received</label>
                    <input type="number" value={taxInput.hraActual || ''} onChange={e => setTaxInput({ ...taxInput, hraActual: Number(e.target.value) })}
                      className="w-full px-3 py-2 rounded-lg border border-thb-border text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs text-thb-text-secondary mb-1">HRA - Rent Paid</label>
                    <input type="number" value={taxInput.hraRentPaid || ''} onChange={e => setTaxInput({ ...taxInput, hraRentPaid: Number(e.target.value) })}
                      className="w-full px-3 py-2 rounded-lg border border-thb-border text-sm" />
                  </div>
                  <label className="flex items-center gap-2 text-xs text-thb-text-secondary">
                    <input type="checkbox" checked={taxInput.hraIsMetro} onChange={e => setTaxInput({ ...taxInput, hraIsMetro: e.target.checked })} className="rounded" />
                    Metro City (50% of Basic vs 40%)
                  </label>
                  <div>
                    <label className="block text-xs text-thb-text-secondary mb-1">Section 80E - Education Loan</label>
                    <input type="number" value={taxInput.section80E || ''} onChange={e => setTaxInput({ ...taxInput, section80E: Number(e.target.value) })}
                      className="w-full px-3 py-2 rounded-lg border border-thb-border text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs text-thb-text-secondary mb-1">Section 80G - Donations</label>
                    <input type="number" value={taxInput.section80G || ''} onChange={e => setTaxInput({ ...taxInput, section80G: Number(e.target.value) })}
                      className="w-full px-3 py-2 rounded-lg border border-thb-border text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs text-thb-text-secondary mb-1">Section 80TTA - Savings Interest (max ₹10K)</label>
                    <input type="number" value={taxInput.section80TTA || ''} onChange={e => setTaxInput({ ...taxInput, section80TTA: Number(e.target.value) })}
                      className="w-full px-3 py-2 rounded-lg border border-thb-border text-sm" />
                  </div>
                </div>
              )}

              <button onClick={calculateTax} disabled={calculating}
                className="w-full px-6 py-3 rounded-lg bg-gradient-to-r from-amber-500 to-orange-600 text-white text-sm font-semibold hover:from-amber-600 hover:to-orange-700 disabled:opacity-50 shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2">
                {calculating ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : <FiTrendingUp className="w-4 h-4" />}
                Calculate Tax
              </button>
            </div>
          </div>

          {/* Results Panel */}
          <div className="lg:col-span-2 space-y-4">
            {taxResult ? (
              <>
                {/* Comparison Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className={`thb-card p-5 border-t-4 ${taxResult.comparison.betterRegime === 'NEW' ? 'border-t-emerald-500' : 'border-t-slate-300'}`}>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-thb-text-primary">New Regime</h3>
                      {taxResult.comparison.betterRegime === 'NEW' && (
                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">BETTER</span>
                      )}
                    </div>
                    <p className="text-xs text-thb-text-secondary">Standard Deduction: {fmt(taxResult.newRegime.standardDeduction)}</p>
                    <p className="text-xs text-thb-text-secondary">Taxable Income: {fmt(taxResult.newRegime.taxableIncome)}</p>
                    <p className="text-xs text-thb-text-secondary">Tax: {fmt(taxResult.newRegime.tax)}</p>
                    <p className="text-xs text-thb-text-secondary">Surcharge: {fmt(taxResult.newRegime.surcharge)}</p>
                    <p className="text-xs text-thb-text-secondary">Cess (4%): {fmt(taxResult.newRegime.cess)}</p>
                    <div className="mt-2 pt-2 border-t border-thb-border">
                      <p className="text-lg font-bold text-thb-text-primary">{fmt(taxResult.newRegime.totalTax)}</p>
                      <p className="text-xs text-thb-text-muted">Monthly TDS: {fmt(taxResult.newRegime.monthlyTDS)}</p>
                    </div>
                  </div>
                  <div className={`thb-card p-5 border-t-4 ${taxResult.comparison.betterRegime === 'OLD' ? 'border-t-emerald-500' : 'border-t-slate-300'}`}>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-thb-text-primary">Old Regime</h3>
                      {taxResult.comparison.betterRegime === 'OLD' && (
                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">BETTER</span>
                      )}
                    </div>
                    <p className="text-xs text-thb-text-secondary">Total Deductions: {fmt(taxResult.oldRegime.totalDeductions)}</p>
                    <p className="text-xs text-thb-text-secondary">HRA Exemption: {fmt(taxResult.oldRegime.hraExemption)}</p>
                    <p className="text-xs text-thb-text-secondary">Taxable Income: {fmt(taxResult.oldRegime.taxableIncome)}</p>
                    <p className="text-xs text-thb-text-secondary">Tax: {fmt(taxResult.oldRegime.tax)}</p>
                    <p className="text-xs text-thb-text-secondary">Surcharge: {fmt(taxResult.oldRegime.surcharge)}</p>
                    <p className="text-xs text-thb-text-secondary">Cess (4%): {fmt(taxResult.oldRegime.cess)}</p>
                    <div className="mt-2 pt-2 border-t border-thb-border">
                      <p className="text-lg font-bold text-thb-text-primary">{fmt(taxResult.oldRegime.totalTax)}</p>
                      <p className="text-xs text-thb-text-muted">Monthly TDS: {fmt(taxResult.oldRegime.monthlyTDS)}</p>
                    </div>
                  </div>
                </div>

                {/* Savings Info */}
                {taxResult.comparison.savings > 0 && (
                  <div className="thb-card p-4 bg-emerald-50 border-l-4 border-l-emerald-500">
                    <div className="flex items-center gap-3">
                      <FiTrendingUp className="w-5 h-5 text-emerald-600" />
                      <div>
                        <p className="text-sm font-semibold text-emerald-700">
                          {taxResult.comparison.betterRegime} Regime saves you {fmt(taxResult.comparison.savings)}/year
                        </p>
                        <p className="text-xs text-emerald-600">
                          That&apos;s {fmt(Math.round(taxResult.comparison.savings / 12))}/month in savings
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* New Regime Slab Table */}
                {taxResult.newRegimeSlabs && (
                  <div className="thb-card overflow-hidden">
                    <div className="px-5 py-3 border-b border-thb-border bg-slate-50">
                      <h3 className="text-sm font-semibold text-thb-text-primary">New Regime Tax Slabs (FY 2024-25)</h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-thb-border bg-slate-50">
                            <th className="text-left px-4 py-2 text-xs font-semibold text-thb-text-secondary">Income Range</th>
                            <th className="text-center px-4 py-2 text-xs font-semibold text-thb-text-secondary">Rate</th>
                            <th className="text-right px-4 py-2 text-xs font-semibold text-thb-text-secondary">Tax</th>
                          </tr>
                        </thead>
                        <tbody>
                          {taxResult.newRegimeSlabs.map((slab, i) => (
                            <tr key={i} className="border-b border-thb-border/50 hover:bg-slate-50/50">
                              <td className="px-4 py-2 text-sm text-thb-text-primary">
                                {slab.to ? `${fmt(slab.from)} - ${fmt(slab.to)}` : `Above ${fmt(slab.from)}`}
                              </td>
                              <td className="px-4 py-2 text-sm text-center text-thb-text-secondary">{slab.rate}%</td>
                              <td className="px-4 py-2 text-sm text-right font-medium text-thb-text-primary">{fmt(slab.tax)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="thb-card p-16 text-center">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center mx-auto mb-4">
                  <FiFileText className="w-10 h-10 text-amber-500" />
                </div>
                <h3 className="text-lg font-semibold text-thb-text-primary mb-2">Income Tax Calculator</h3>
                <p className="text-sm text-thb-text-secondary max-w-md mx-auto">
                  Enter your annual gross income to calculate and compare income tax under Old and New regimes.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════ TAX DECLARATIONS ═══════ */}
      {activeTab === 'declarations' && (
        <div className="space-y-4">
          {/* Actions */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button onClick={fetchDeclarations} className="p-2.5 rounded-lg border border-thb-border text-thb-text-secondary hover:bg-slate-50">
                <FiRefreshCw className="w-4 h-4" />
              </button>
              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-thb-text-muted" />
                <input type="text" placeholder="Search declarations..." className="pl-9 pr-3 py-2.5 rounded-lg border border-thb-border text-sm w-64" />
              </div>
            </div>
            <button onClick={() => { setShowDecForm(true); setEditingDecId(null); }}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-green-500 text-white rounded-lg hover:bg-green-600 font-medium text-sm">
              <FiPlus className="w-4 h-4" /> New Declaration
            </button>
          </div>

          {/* Declaration Form */}
          {showDecForm && (
            <div className="thb-card border-l-4 border-l-green-500 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-thb-text-primary">Create Tax Declaration</h2>
                <button onClick={() => setShowDecForm(false)} className="p-2 rounded-lg text-thb-text-muted hover:text-thb-text-primary hover:bg-slate-100">
                  <FiX className="w-5 h-5" />
                </button>
              </div>

              {isAdmin && (
                <div className="mb-4 relative">
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Employee (HR filing on behalf)</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={employeeSearch || (decForm.employeeId ? employees.find(e => e.id === decForm.employeeId)?.employeeId || decForm.employeeId : '')}
                      onChange={e => {
                        setEmployeeSearch(e.target.value);
                        setDecForm({ ...decForm, employeeId: '' });
                        setShowEmployeeDropdown(true);
                      }}
                      onFocus={() => setShowEmployeeDropdown(true)}
                      placeholder="Search employee by name, ID, or email..."
                      className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20"
                    />
                    {decForm.employeeId && employees.find(e => e.id === decForm.employeeId) && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                        <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                          {employees.find(e => e.id === decForm.employeeId)?.firstName} {employees.find(e => e.id === decForm.employeeId)?.lastName}
                        </span>
                        <button
                          onClick={() => { setDecForm({ ...decForm, employeeId: '' }); setEmployeeSearch(''); }}
                          className="text-thb-text-muted hover:text-red-500"
                        >
                          <FiX className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                  {showEmployeeDropdown && !decForm.employeeId && (
                    <div className="absolute z-50 w-full mt-1 max-h-48 overflow-y-auto bg-white border border-thb-border rounded-lg shadow-lg">
                      {loadingEmployees ? (
                        <div className="px-3 py-2 text-xs text-thb-text-muted">Loading...</div>
                      ) : employees.length === 0 ? (
                        <div className="px-3 py-2 text-xs text-thb-text-muted">No employees found</div>
                      ) : (
                        employees.map(emp => (
                          <button
                            key={emp.id}
                            onClick={() => {
                              setDecForm({ ...decForm, employeeId: emp.id });
                              setEmployeeSearch('');
                              setShowEmployeeDropdown(false);
                            }}
                            className="w-full px-3 py-2 text-left hover:bg-green-50 flex items-center gap-2 transition-colors"
                          >
                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-green-500 to-teal-600 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                              {emp.firstName[0]}{emp.lastName[0]}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-thb-text-primary truncate">{emp.firstName} {emp.lastName}</p>
                              <p className="text-[10px] text-thb-text-muted truncate">{emp.employeeId} · {emp.email} · {emp.department?.name || '—'}</p>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Financial Year</label>
                  <select value={decForm.financialYear} onChange={e => setDecForm({ ...decForm, financialYear: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm">
                    <option value="2024-25">FY 2024-25</option>
                    <option value="2025-26">FY 2025-26</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Tax Regime</label>
                  <select value={decForm.regimeType} onChange={e => setDecForm({ ...decForm, regimeType: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm">
                    <option value="NEW">New Regime</option>
                    <option value="OLD">Old Regime</option>
                  </select>
                </div>
              </div>

              <h3 className="text-sm font-semibold text-thb-text-primary mt-6 mb-3">Section 80C Investments (max ₹1,50,000)</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  { key: 'section80C_PPF', label: 'PPF' },
                  { key: 'section80C_ELSS', label: 'ELSS' },
                  { key: 'section80C_LIC', label: 'LIC Premium' },
                  { key: 'section80C_HomeLoanPrincipal', label: 'Home Loan Principal' },
                  { key: 'section80C_Other', label: 'Other 80C' },
                ].map(f => (
                  <div key={f.key}>
                    <label className="block text-xs font-medium text-thb-text-secondary mb-1">{f.label} ₹</label>
                    <input type="number" value={decForm[f.key as keyof typeof decForm] || ''}
                      onChange={e => setDecForm({ ...decForm, [f.key]: Number(e.target.value) })}
                      className="w-full px-3 py-2 rounded-lg border border-thb-border text-sm" />
                  </div>
                ))}
              </div>

              <h3 className="text-sm font-semibold text-thb-text-primary mt-6 mb-3">Other Deductions</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  { key: 'section80D_Self', label: '80D - Medical Insurance (Self)' },
                  { key: 'section80D_Parents', label: '80D - Medical Insurance (Parents)' },
                  { key: 'section80CCD_NPS', label: '80CCD(1B) - NPS (max ₹50K)' },
                  { key: 'section24b_HomeLoanInterest', label: '24(b) - Home Loan Interest (max ₹2L)' },
                  { key: 'hra_ActualHRA', label: 'HRA - Actual HRA Received' },
                  { key: 'hra_RentPaid', label: 'HRA - Rent Paid' },
                  { key: 'section80E_EducationLoan', label: '80E - Education Loan' },
                  { key: 'section80G_Donations', label: '80G - Donations' },
                  { key: 'section80TTA_SavingsInterest', label: '80TTA - Savings Interest' },
                ].map(f => (
                  <div key={f.key}>
                    <label className="block text-xs font-medium text-thb-text-secondary mb-1">{f.label} ₹</label>
                    <input type="number" value={decForm[f.key as keyof typeof decForm] || ''}
                      onChange={e => setDecForm({ ...decForm, [f.key]: Number(e.target.value) })}
                      className="w-full px-3 py-2 rounded-lg border border-thb-border text-sm" />
                  </div>
                ))}
                <div>
                  <label className="flex items-center gap-2 text-xs text-thb-text-secondary mt-5">
                    <input type="checkbox" checked={decForm.hra_IsMetro} onChange={e => setDecForm({ ...decForm, hra_IsMetro: e.target.checked })} className="rounded" />
                    Metro City
                  </label>
                </div>
              </div>

              <div className="flex items-center gap-3 mt-6">
                <button onClick={handleCreateDeclaration} disabled={submittingDec}
                  className="px-4 py-2.5 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 disabled:opacity-50">
                  {submittingDec ? 'Saving...' : 'Save as Draft'}
                </button>
                <button onClick={() => setShowDecForm(false)}
                  className="px-4 py-2.5 border border-thb-border rounded-lg text-sm font-medium text-thb-text-secondary hover:bg-slate-50">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* View Panel */}
          {viewingDec && (
            <div className="thb-card border-l-4 border-l-emerald-500 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-thb-text-primary">Declaration Details</h2>
                <button onClick={() => setViewingDec(null)} className="p-2 rounded-lg text-thb-text-muted hover:bg-slate-100">
                  <FiX className="w-5 h-5" />
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                <div><p className="text-xs text-thb-text-secondary">Employee</p><p className="text-sm font-medium">{viewingDec.employee?.firstName} {viewingDec.employee?.lastName}</p></div>
                <div><p className="text-xs text-thb-text-secondary">Financial Year</p><p className="text-sm font-medium">{viewingDec.financialYear}</p></div>
                <div><p className="text-xs text-thb-text-secondary">Regime</p><p className="text-sm font-medium">{viewingDec.regimeType}</p></div>
                <div><p className="text-xs text-thb-text-secondary">Status</p><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getStatusBadge(viewingDec.status)}`}>{viewingDec.status}</span></div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div><p className="text-xs text-thb-text-secondary">Section 80C Total</p><p className="text-sm font-medium">{fmt(viewingDec.section80C_Total)}</p></div>
                <div><p className="text-xs text-thb-text-secondary">Section 80D Total</p><p className="text-sm font-medium">{fmt(viewingDec.section80D_Total)}</p></div>
                <div><p className="text-xs text-thb-text-secondary">Total Deductions</p><p className="text-sm font-medium">{fmt(viewingDec.totalDeductions)}</p></div>
                <div><p className="text-xs text-thb-text-secondary">Taxable Income</p><p className="text-sm font-medium">{fmt(viewingDec.taxableIncome)}</p></div>
                <div><p className="text-xs text-thb-text-secondary">Estimated Tax</p><p className="text-sm font-bold text-red-600">{fmt(viewingDec.estimatedTax)}</p></div>
              </div>
              {viewingDec.reviewComments && (
                <div className="mt-4 p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-thb-text-secondary">Review Comments</p>
                  <p className="text-sm text-thb-text-primary">{viewingDec.reviewComments}</p>
                </div>
              )}
              {isAdmin && viewingDec.status === 'SUBMITTED' && (
                <div className="flex items-center gap-3 mt-4">
                  <button onClick={() => handleUpdateStatus(viewingDec.id, 'APPROVED')}
                    className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600 flex items-center gap-1">
                    <FiCheck className="w-4 h-4" /> Approve
                  </button>
                  <button onClick={() => { const c = prompt('Rejection reason:'); if (c) handleUpdateStatus(viewingDec.id, 'REJECTED', c); }}
                    className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 flex items-center gap-1">
                    <FiX className="w-4 h-4" /> Reject
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Declarations Table */}
          <div className="thb-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-thb-border bg-slate-50">
                    <th className="text-left px-4 py-2 text-xs font-semibold text-thb-text-secondary">Employee</th>
                    <th className="text-left px-4 py-2 text-xs font-semibold text-thb-text-secondary">FY</th>
                    <th className="text-left px-4 py-2 text-xs font-semibold text-thb-text-secondary">Regime</th>
                    <th className="text-right px-4 py-2 text-xs font-semibold text-thb-text-secondary">Deductions</th>
                    <th className="text-right px-4 py-2 text-xs font-semibold text-thb-text-secondary">Est. Tax</th>
                    <th className="text-center px-4 py-2 text-xs font-semibold text-thb-text-secondary">Status</th>
                    <th className="text-center px-4 py-2 text-xs font-semibold text-thb-text-secondary">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingDecs ? (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-thb-text-muted">Loading...</td></tr>
                  ) : declarations.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-thb-text-muted">No declarations found. Create one to get started.</td></tr>
                  ) : (
                    declarations.map(dec => (
                      <tr key={dec.id} className="border-b border-thb-border/50 hover:bg-slate-50/50">
                        <td className="px-4 py-2 text-sm font-medium text-thb-text-primary">
                          {dec.employee ? `${dec.employee.firstName} ${dec.employee.lastName}` : dec.employeeId}
                        </td>
                        <td className="px-4 py-2 text-sm text-thb-text-secondary">{dec.financialYear}</td>
                        <td className="px-4 py-2 text-sm text-thb-text-secondary">{dec.regimeType}</td>
                        <td className="px-4 py-2 text-sm text-right">{fmt(dec.totalDeductions)}</td>
                        <td className="px-4 py-2 text-sm text-right font-medium text-red-600">{fmt(dec.estimatedTax)}</td>
                        <td className="px-4 py-2 text-center"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getStatusBadge(dec.status)}`}>{dec.status}</span></td>
                        <td className="px-4 py-2 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={() => setViewingDec(dec)} className="p-1.5 rounded-md text-thb-text-muted hover:text-green-600 hover:bg-green-50">
                              <FiEye className="w-3.5 h-3.5" />
                            </button>
                            {(dec.status === 'DRAFT' || dec.status === 'REJECTED') && (
                              <button onClick={() => handleUpdateStatus(dec.id, 'SUBMITTED')}
                                className="p-1.5 rounded-md text-thb-text-muted hover:text-emerald-600 hover:bg-emerald-50" title="Submit">
                                <FiArrowRight className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
