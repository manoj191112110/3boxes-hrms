'use client';

import { useState, useCallback } from 'react';
import {
  FiGift, FiInfo, FiCheck, FiAlertCircle, FiTrendingUp,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useCompanyContextStore } from '@/store/companyContextStore';

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

const fmt = (n: number) => `₹${n.toLocaleString('en-IN')}`;

interface GratuityResult {
  inputs: { basicSalary: number; da: number; lastDrawnSalary: number; yearsOfService: number; monthsOfService: number; totalYears: number; isCoveredByAct: boolean };
  calculation: { formula: string; denominator: number; gratuityAmount: number; maxGratuity: number; cappedGratuity: number; isCapped: boolean };
  monthlyProvision: { rate: string; monthlyAmount: number; annualAmount: number; pctOfBasic: string };
  taxImplication: { sectionCode: string; taxExemption: number; taxableAmount: number };
  eligibility: { isEligible: boolean; yearsToEligibility: number; minimumServiceRequired: number; note: string };
  projection: Array<{ year: number; gratuityAmount: number; monthlyProvision: number; cumulativeProvision: number }>;
}

export default function GratuityPage() {
  const [basicSalary, setBasicSalary] = useState<string>('');
  const [da, setDa] = useState<string>('');
  const [yearsOfService, setYearsOfService] = useState<string>('');
  const [monthsOfService, setMonthsOfService] = useState<string>('0');
  const [isCoveredByAct, setIsCoveredByAct] = useState(true);
  const [result, setResult] = useState<GratuityResult | null>(null);
  const [calculating, setCalculating] = useState(false);

  const calculateGratuity = useCallback(async () => {
    const basic = parseFloat(basicSalary.replace(/,/g, ''));
    const years = parseInt(yearsOfService);
    if (!basic || basic <= 0) { toast.error('Please enter basic salary'); return; }
    if (!years || years <= 0) { toast.error('Please enter years of service'); return; }

    setCalculating(true);
    try {
      const res = await fetch('/api/payroll/gratuity', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          basicSalary: basic,
          da: parseFloat(da.replace(/,/g, '')) || 0,
          yearsOfService: years,
          monthsOfService: parseInt(monthsOfService) || 0,
          isCoveredByAct,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setResult(data.data);
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to calculate gratuity');
      }
    } catch {
      toast.error('Failed to calculate gratuity');
    } finally {
      setCalculating(false);
    }
  }, [basicSalary, da, yearsOfService, monthsOfService, isCoveredByAct]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-thb-text-primary flex items-center gap-2">
          <FiGift className="w-6 h-6 text-teal-500" />
          Gratuity Calculator
        </h1>
        <p className="text-thb-text-secondary mt-1">Calculate gratuity as per Payment of Gratuity Act, 1972</p>
      </div>

      {/* Info Banner */}
      <div className="thb-card border-l-4 border-l-teal-500 bg-gradient-to-r from-teal-50/50 to-white">
        <div className="p-5">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-teal-100 flex items-center justify-center flex-shrink-0">
              <FiInfo className="w-4 h-4 text-teal-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-thb-text-primary">About Gratuity</h3>
              <p className="text-xs text-thb-text-secondary mt-1 leading-relaxed">
                Gratuity is a lump sum benefit paid by an employer to an employee upon leaving the job, retirement, or death.
                Under the Payment of Gratuity Act 1972, employees with 5+ years of continuous service are eligible.
                Maximum gratuity is capped at ₹20,00,000. It is tax-exempt up to ₹20 lakhs under Section 10(10).
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Input Panel */}
        <div className="lg:col-span-1 space-y-4">
          <div className="thb-card border-l-4 border-l-teal-500 p-5 space-y-4">
            <h3 className="text-sm font-semibold text-thb-text-primary">Enter Details</h3>

            <div>
              <label className="block text-xs font-medium text-thb-text-secondary mb-1">Last Drawn Basic Salary (Monthly) ₹</label>
              <input type="text" value={basicSalary} onChange={e => setBasicSalary(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="e.g. 50000" className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20" />
            </div>

            <div>
              <label className="block text-xs font-medium text-thb-text-secondary mb-1">Dearness Allowance (Monthly) ₹</label>
              <input type="text" value={da} onChange={e => setDa(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="Optional" className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Years of Service</label>
                <input type="number" value={yearsOfService} onChange={e => setYearsOfService(e.target.value)}
                  placeholder="e.g. 10" className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20" />
              </div>
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Months</label>
                <input type="number" min="0" max="11" value={monthsOfService} onChange={e => setMonthsOfService(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-thb-text-secondary mb-1">Company Type</label>
              <select value={isCoveredByAct ? 'yes' : 'no'} onChange={e => setIsCoveredByAct(e.target.value === 'yes')}
                className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20">
                <option value="yes">Covered under Payment of Gratuity Act 1972</option>
                <option value="no">Not covered under the Act</option>
              </select>
              <p className="text-[10px] text-thb-text-muted mt-1">
                {isCoveredByAct ? 'Formula: (15 × Salary × Years) / 26' : 'Formula: (15 × Salary × Years) / 30'}
              </p>
            </div>

            <button onClick={calculateGratuity} disabled={calculating}
              className="w-full px-6 py-3 rounded-lg bg-gradient-to-r from-teal-500 to-cyan-600 text-white text-sm font-semibold hover:from-teal-600 hover:to-cyan-700 disabled:opacity-50 shadow-lg shadow-teal-500/25 flex items-center justify-center gap-2">
              {calculating ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : <FiGift className="w-4 h-4" />}
              Calculate Gratuity
            </button>
          </div>
        </div>

        {/* Results Panel */}
        <div className="lg:col-span-2 space-y-4">
          {result ? (
            <>
              {/* Eligibility Alert */}
              <div className={`thb-card p-4 ${result.eligibility.isEligible ? 'bg-emerald-50 border-l-4 border-l-emerald-500' : 'bg-amber-50 border-l-4 border-l-amber-500'}`}>
                <div className="flex items-center gap-3">
                  {result.eligibility.isEligible ? (
                    <FiCheck className="w-5 h-5 text-emerald-600" />
                  ) : (
                    <FiAlertCircle className="w-5 h-5 text-amber-600" />
                  )}
                  <div>
                    <p className={`text-sm font-semibold ${result.eligibility.isEligible ? 'text-emerald-700' : 'text-amber-700'}`}>
                      {result.eligibility.isEligible ? 'Eligible for Gratuity' : 'Not Yet Eligible'}
                    </p>
                    <p className={`text-xs ${result.eligibility.isEligible ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {result.eligibility.note}
                    </p>
                  </div>
                </div>
              </div>

              {/* Key Results */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="thb-card p-5 border-t-4 border-t-teal-500">
                  <p className="text-xs font-medium text-thb-text-secondary">Gratuity Amount</p>
                  <p className="text-2xl font-bold text-teal-600 mt-1">{fmt(result.calculation.cappedGratuity)}</p>
                  {result.calculation.isCapped && <p className="text-[10px] text-amber-600 mt-0.5">Capped at max ₹20L</p>}
                </div>
                <div className="thb-card p-5 border-t-4 border-t-green-500">
                  <p className="text-xs font-medium text-thb-text-secondary">Monthly Provision</p>
                  <p className="text-2xl font-bold text-green-600 mt-1">{fmt(result.monthlyProvision.monthlyAmount)}</p>
                  <p className="text-[10px] text-thb-text-muted mt-0.5">{result.monthlyProvision.rate} of Basic (CTC)</p>
                </div>
                <div className="thb-card p-5 border-t-4 border-t-emerald-500">
                  <p className="text-xs font-medium text-thb-text-secondary">Tax Exemption</p>
                  <p className="text-2xl font-bold text-emerald-600 mt-1">{fmt(result.taxImplication.taxExemption)}</p>
                  <p className="text-[10px] text-thb-text-muted mt-0.5">{result.taxImplication.sectionCode}</p>
                </div>
              </div>

              {/* Calculation Details */}
              <div className="thb-card p-5">
                <h3 className="text-sm font-semibold text-thb-text-primary mb-3">Calculation Details</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm"><span className="text-thb-text-secondary">Basic Salary</span><span className="font-medium">{fmt(result.inputs.basicSalary)}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-thb-text-secondary">DA</span><span className="font-medium">{fmt(result.inputs.da)}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-thb-text-secondary">Last Drawn Salary</span><span className="font-medium">{fmt(result.inputs.lastDrawnSalary)}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-thb-text-secondary">Total Service</span><span className="font-medium">{result.inputs.totalYears} years</span></div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm"><span className="text-thb-text-secondary">Formula</span><span className="font-medium text-xs">{result.calculation.formula}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-thb-text-secondary">Calculated Amount</span><span className="font-medium">{fmt(result.calculation.gratuityAmount)}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-thb-text-secondary">Maximum Limit</span><span className="font-medium">{fmt(result.calculation.maxGratuity)}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-thb-text-secondary">Taxable Gratuity</span><span className="font-medium text-red-600">{fmt(result.taxImplication.taxableAmount)}</span></div>
                  </div>
                </div>
              </div>

              {/* Projection Table */}
              <div className="thb-card overflow-hidden">
                <div className="px-5 py-3 border-b border-thb-border bg-slate-50">
                  <h3 className="text-sm font-semibold text-thb-text-primary flex items-center gap-2">
                    <FiTrendingUp className="w-4 h-4 text-teal-500" />
                    Gratuity Accumulation Projection
                  </h3>
                </div>
                <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
                  <table className="w-full">
                    <thead className="sticky top-0 z-10">
                      <tr className="border-b border-thb-border bg-slate-50">
                        <th className="text-left px-4 py-2 text-xs font-semibold text-thb-text-secondary">Year</th>
                        <th className="text-right px-4 py-2 text-xs font-semibold text-thb-text-secondary">Gratuity Amount</th>
                        <th className="text-right px-4 py-2 text-xs font-semibold text-thb-text-secondary">Monthly Provision</th>
                        <th className="text-right px-4 py-2 text-xs font-semibold text-thb-text-secondary">Cumulative Provision</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.projection.map(p => (
                        <tr key={p.year} className="border-b border-thb-border/50 hover:bg-slate-50/50">
                          <td className="px-4 py-2 text-sm font-medium text-thb-text-primary">Year {p.year}</td>
                          <td className="px-4 py-2 text-sm text-right text-teal-600 font-medium">{fmt(p.gratuityAmount)}</td>
                          <td className="px-4 py-2 text-sm text-right text-thb-text-secondary">{fmt(p.monthlyProvision)}</td>
                          <td className="px-4 py-2 text-sm text-right text-thb-text-secondary">{fmt(p.cumulativeProvision)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="thb-card p-16 text-center">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-teal-100 to-cyan-100 flex items-center justify-center mx-auto mb-4">
                <FiGift className="w-10 h-10 text-teal-500" />
              </div>
              <h3 className="text-lg font-semibold text-thb-text-primary mb-2">Gratuity Calculator</h3>
              <p className="text-sm text-thb-text-secondary max-w-md mx-auto">
                Enter your basic salary and years of service to calculate your gratuity amount as per the Payment of Gratuity Act, 1972.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
