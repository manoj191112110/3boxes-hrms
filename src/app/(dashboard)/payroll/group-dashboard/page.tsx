'use client';

// REQ-7.2 — Group Payroll Dashboard (Tenant Admin)
// -----------------------------------------------
// Consolidated view of the entire Parent Company group's payroll liability,
// normalized to the Tenant's base currency.

import { useEffect, useState, useCallback } from 'react';
import {
  FiRefreshCw, FiDollarSign, FiAlertTriangle, FiLock, FiActivity,
  FiGlobe, FiTrendingUp, FiCheckCircle, FiGrid,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useCompanyContextStore } from '@/store/companyContextStore';

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

interface GroupData {
  tenant: { id: string; name: string; baseCurrency: string };
  period: string | null;
  perCompany: Array<{
    companyId: string;
    companyName: string;
    country: string | null;
    sourceCurrency: string;
    groupName: string;
    payrollRun: {
      id: string; runType: string; runStatus: string; currencyCode: string;
      totalEmployees: number; totalGrossPay: number; totalDeductions: number;
      totalNetPay: number; totalEmployerContrib: number; payDate: string;
    } | null;
    normalized: {
      gross: number; net: number; employerContrib: number;
      currency: string; fxRate: number | null; fxRateMissing: boolean;
    } | null;
  }>;
  groupTotal: { gross: number; net: number; employerContrib: number; currency: string };
  pendingApprovals: number;
  openLockRequests: number;
  openAnomalies: number;
  companyCount: number;
  runsExecuted: number;
  runsMissing: number;
}

interface FilingData {
  period: string;
  perCompany: Array<{
    companyId: string; companyName: string; country: string | null;
    groupName: string;
    obligations: Array<{
      obligationId: string; name: string; countryCode: string; authorityName: string;
      filingType: string; frequency: string; dueDateRule: string; graceDays: number | null;
      filingStatus: string; submittedDate: string | null; acknowledgementRef: string | null;
      filingId: string | null; trafficLight: 'GREEN' | 'AMBER' | 'RED'; daysUntilDue: number | null;
    }>;
    summary: { green: number; amber: number; red: number; total: number };
  }>;
  groupSummary: {
    totalCompanies: number; companiesWithFilings: number;
    companiesRed: number; companiesAmber: number; companiesGreen: number;
    totalGreen: number; totalAmber: number; totalRed: number;
  };
}

export default function GroupPayrollDashboardPage() {
  const [data, setData] = useState<GroupData | null>(null);
  const [filing, setFiling] = useState<FilingData | null>(null);
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState('');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (period) p.set('period', period);
      const [groupRes, filingRes] = await Promise.all([
        fetch(`/api/payroll/group-dashboard?${p.toString()}`, { headers: getAuthHeaders() }),
        fetch(`/api/payroll/statutory-filing-oversight?${p.toString()}`, { headers: getAuthHeaders() }),
      ]);
      if (groupRes.ok) {
        const j = await groupRes.json();
        setData(j.data);
      }
      if (filingRes.ok) {
        const j = await filingRes.json();
        setFiling(j.data);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load group dashboard');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const fmt = (amt: number, cur: string) => {
    try { return new Intl.NumberFormat('en-US', { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(amt); }
    catch { return `${cur} ${amt.toFixed(0)}`; }
  };

  const trafficLight = (t: string) => ({
    GREEN: { bg: 'bg-emerald-100 text-emerald-700 border-emerald-200', label: 'On Track' },
    AMBER: { bg: 'bg-amber-100 text-amber-700 border-amber-200', label: 'At Risk' },
    RED: { bg: 'bg-red-100 text-red-700 border-red-200', label: 'Overdue' },
  } as Record<string, { bg: string; label: string }>)[t] || { bg: 'bg-slate-100 text-slate-700 border-slate-200', label: t };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-thb-text-primary flex items-center gap-2">
            <FiGlobe className="w-6 h-6 text-green-500" />
            Group Payroll Dashboard
          </h1>
          <p className="text-thb-text-secondary mt-1">Consolidated payroll liability across all sub-companies (normalized to base currency)</p>
        </div>
        <div className="flex items-center gap-2">
          <input type="text" value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="2026-06 (blank = latest)" className="px-3 py-2 text-sm border border-thb-border rounded-lg bg-white text-thb-text-primary w-44" />
          <button onClick={fetchAll} className="p-2.5 rounded-lg border border-thb-border text-thb-text-secondary hover:bg-slate-50 transition-colors">
            <FiRefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {data ? (
        <>
          {/* Group total + alerts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="thb-card p-5 bg-gradient-to-br from-green-500 to-teal-500 text-white lg:col-span-1">
              <div className="flex items-center gap-2 mb-2 opacity-90">
                <FiTrendingUp className="w-4 h-4" />
                <p className="text-xs font-medium uppercase tracking-wide">Group Total Net Pay · {data.period || 'No runs yet'}</p>
              </div>
              <p className="text-3xl font-bold">{fmt(data.groupTotal.net, data.groupTotal.currency)}</p>
              <div className="grid grid-cols-2 gap-3 mt-4 text-xs">
                <div><p className="opacity-70">Gross</p><p className="font-semibold text-lg">{fmt(data.groupTotal.gross, data.groupTotal.currency)}</p></div>
                <div><p className="opacity-70">Employer Contrib</p><p className="font-semibold text-lg">{fmt(data.groupTotal.employerContrib, data.groupTotal.currency)}</p></div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 lg:col-span-2">
              <AlertCard icon={<FiCheckCircle className="w-5 h-5" />} label="Companies" value={data.companyCount} color="blue" />
              <AlertCard icon={<FiActivity className="w-5 h-5" />} label="Runs Executed" value={data.runsExecuted} color="emerald" />
              <AlertCard icon={<FiAlertTriangle className="w-5 h-5" />} label="Pending Approvals" value={data.pendingApprovals} color="amber" />
              <AlertCard icon={<FiLock className="w-5 h-5" />} label="Open Lock Requests" value={data.openLockRequests} color="violet" />
              <AlertCard icon={<FiAlertTriangle className="w-5 h-5" />} label="Open Anomalies" value={data.openAnomalies} color="red" />
              <AlertCard icon={<FiActivity className="w-5 h-5" />} label="Missing Runs" value={data.runsMissing} color="slate" />
            </div>
          </div>

          {/* Per-company table */}
          <div className="thb-card overflow-hidden">
            <div className="px-4 py-3 border-b border-thb-border flex items-center justify-between">
              <h3 className="text-sm font-semibold text-thb-text-primary">Per-Company Breakdown</h3>
              <span className="text-xs text-thb-text-secondary">Base currency: {data.tenant.baseCurrency}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr className="text-left text-xs text-thb-text-secondary uppercase tracking-wide">
                    <th className="px-4 py-2">Company</th>
                    <th className="px-4 py-2">Country</th>
                    <th className="px-4 py-2">Currency</th>
                    <th className="px-4 py-2">Run Status</th>
                    <th className="px-4 py-2 text-right">Employees</th>
                    <th className="px-4 py-2 text-right">Net Pay (Source)</th>
                    <th className="px-4 py-2 text-right">FX Rate</th>
                    <th className="px-4 py-2 text-right">Net Pay (Base)</th>
                  </tr>
                </thead>
                <tbody>
                  {data.perCompany.map((co) => (
                    <tr key={co.companyId} className="border-t border-thb-border hover:bg-slate-50/50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-thb-text-primary">{co.companyName}</p>
                        <p className="text-xs text-slate-400">{co.groupName}</p>
                      </td>
                      <td className="px-4 py-3 text-thb-text-secondary">{co.country || '—'}</td>
                      <td className="px-4 py-3 text-thb-text-secondary">{co.sourceCurrency}</td>
                      <td className="px-4 py-3">
                        {co.payrollRun ? (
                          <span className={`px-2 py-0.5 text-xs font-semibold rounded ${co.payrollRun.runStatus === 'CLOSED' ? 'bg-emerald-100 text-emerald-700' : co.payrollRun.runStatus === 'DISBURSED' || co.payrollRun.runStatus === 'APPROVED' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                            {co.payrollRun.runStatus}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 text-xs font-semibold rounded bg-slate-100 text-slate-500">No run</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-thb-text-secondary">{co.payrollRun?.totalEmployees ?? '—'}</td>
                      <td className="px-4 py-3 text-right text-thb-text-secondary">
                        {co.payrollRun ? fmt(co.payrollRun.totalNetPay, co.payrollRun.currencyCode) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-slate-500">
                        {co.normalized?.fxRate ? co.normalized.fxRate.toFixed(4) : co.sourceCurrency === data.tenant.baseCurrency ? '1.0000' : '—'}
                        {co.normalized?.fxRateMissing && <span className="ml-1 text-red-600" title="No FX rate found — using 1:1">⚠</span>}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-thb-text-primary">
                        {co.normalized ? fmt(co.normalized.net, co.normalized.currency) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-thb-border bg-slate-50 font-semibold">
                    <td colSpan={7} className="px-4 py-3 text-right text-thb-text-secondary">Group Total (in {data.tenant.baseCurrency}):</td>
                    <td className="px-4 py-3 text-right text-thb-text-primary">{fmt(data.groupTotal.net, data.groupTotal.currency)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      ) : loading ? (
        <div className="thb-card p-12 text-center text-thb-text-secondary">Loading…</div>
      ) : (
        <div className="thb-card p-12 text-center text-thb-text-secondary">
          <FiGrid className="w-10 h-10 mx-auto mb-3 text-slate-300" />
          <p className="font-medium text-thb-text-primary">No group payroll data</p>
          <p className="text-sm mt-1">Select a tenant or company from the switcher to view group payroll data.</p>
        </div>
      )}

      {/* Statutory Filing Oversight (Red/Amber/Green) */}
      {filing && (
        <div className="thb-card overflow-hidden">
          <div className="px-4 py-3 border-b border-thb-border flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-sm font-semibold text-thb-text-primary flex items-center gap-2">
              <FiActivity className="w-4 h-4 text-amber-500" />
              Statutory Filing Oversight — {filing.period}
            </h3>
            <div className="flex items-center gap-3 text-xs">
              <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-emerald-500"></span> {filing.groupSummary.totalGreen} Green</span>
              <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-amber-500"></span> {filing.groupSummary.totalAmber} Amber</span>
              <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-500"></span> {filing.groupSummary.totalRed} Red</span>
            </div>
          </div>
          <div className="divide-y divide-thb-border">
            {filing.perCompany.length === 0 ? (
              <div className="p-8 text-center text-sm text-thb-text-secondary">No statutory filings tracked for this period.</div>
            ) : filing.perCompany.map((co) => (
              <div key={co.companyId} className="p-4">
                <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                  <div>
                    <p className="text-sm font-semibold text-thb-text-primary">{co.companyName}</p>
                    <p className="text-xs text-slate-400">{co.country} · {co.groupName}</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-700">{co.summary.green} Green</span>
                    <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-700">{co.summary.amber} Amber</span>
                    {co.summary.red > 0 && <span className="px-2 py-0.5 rounded bg-red-100 text-red-700">{co.summary.red} Red</span>}
                  </div>
                </div>
                <div className="space-y-1.5">
                  {co.obligations.map((ob) => {
                    const tl = trafficLight(ob.trafficLight);
                    return (
                      <div key={ob.obligationId} className="flex items-center justify-between gap-2 text-xs py-1">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className={`px-2 py-0.5 text-xs font-semibold rounded border ${tl.bg}`}>{ob.trafficLight}</span>
                          <span className="text-thb-text-primary font-medium truncate">{ob.name}</span>
                          <span className="text-slate-400">{ob.authorityName} · {ob.countryCode}</span>
                        </div>
                        <div className="text-right text-slate-500 flex-shrink-0">
                          {ob.filingStatus === 'ACKNOWLEDGED' && ob.acknowledgementRef ? (
                            <span className="text-emerald-600">Ack: {ob.acknowledgementRef.substring(0, 12)}</span>
                          ) : ob.submittedDate ? (
                            <span>Submitted {new Date(ob.submittedDate).toLocaleDateString()}</span>
                          ) : ob.daysUntilDue !== null ? (
                            <span className={ob.daysUntilDue < 0 ? 'text-red-600 font-medium' : ob.daysUntilDue <= 7 ? 'text-amber-600 font-medium' : ''}>
                              {ob.daysUntilDue < 0 ? `${Math.abs(ob.daysUntilDue)}d overdue` : `Due in ${ob.daysUntilDue}d`}
                            </span>
                          ) : (
                            <span>—</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AlertCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  const colorMap: Record<string, string> = {
    blue: 'bg-green-50 text-green-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    violet: 'bg-teal-50 text-teal-700',
    red: 'bg-red-50 text-red-700',
    slate: 'bg-slate-50 text-slate-700',
  };
  return (
    <div className={`thb-card p-4 ${colorMap[color] || colorMap.slate}`}>
      <div className="flex items-center gap-2 mb-1 opacity-70">{icon}<p className="text-xs font-medium">{label}</p></div>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}
