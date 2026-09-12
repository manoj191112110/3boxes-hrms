'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  FiFileText, FiDownload, FiClock, FiCheckCircle, FiAlertTriangle,
  FiSearch, FiDollarSign, FiTrendingUp, FiUsers,
  FiBarChart2, FiShield, FiDatabase, FiRefreshCw,
  FiPrinter, FiCreditCard, FiFile, FiTrendingUp as FiTrendUp,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useCompanyContextStore } from '@/store/companyContextStore';

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

// --- Types ---
interface SalaryRegisterRow {
  employeeId: string;
  name: string;
  empCode: string;
  department: string;
  designation: string;
  earnings: Record<string, number>;
  deductions: Record<string, number>;
  employerContrib: Record<string, number>;
  grossPay: number;
  totalDeductions: number;
  netPay: number;
  totalEmployerContrib: number;
}

interface StatutoryRow {
  employeeId: string;
  name: string;
  empCode: string;
  department: string;
  [key: string]: unknown;
}

interface DashboardMetrics {
  totalEmployeesProcessed: number;
  totalActiveEmployees: number;
  totalGrossPay: number;
  totalDeductions: number;
  totalNetPay: number;
  totalEmployerContrib: number;
  pendingApprovals: number;
  activeHolds: number;
}

interface MonthlyTrend {
  period: string;
  grossPay: number;
  deductions: number;
  netPay: number;
  employerContrib: number;
  employees: number;
}

interface DepartmentBreakdown {
  departmentId: string;
  departmentName: string;
  headcount: number;
  totalSalary: number;
  avgSalary: number;
}

interface Company {
  id: string;
  name: string;
  code: string | null;
}

// --- Tab Type ---
type ReportTab = 'register' | 'statutory' | 'dashboard' | 'standard';
type StatutoryType = 'PF' | 'ESI' | 'PT' | 'TDS' | 'LWF';

// --- Currency ---
const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', INR: '₹', GBP: '£', SGD: 'S$', AED: 'د.إ', AUD: 'A$',
};
const fmtCurrency = (amount: number, currency = 'INR') => {
  const symbol = CURRENCY_SYMBOLS[currency] || '₹';
  return `${symbol}${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

// --- Mini Chart Component (bar chart) ---
function MiniBarChart({ data, label, color = 'blue' }: { data: { label: string; value: number }[]; label: string; color?: string }) {
  const maxVal = Math.max(...data.map(d => d.value), 1);
  const barColors: Record<string, string> = {
    blue: 'bg-green-400',
    green: 'bg-emerald-400',
    red: 'bg-red-400',
    amber: 'bg-amber-400',
  };
  const barColor = barColors[color] || barColors.blue;

  return (
    <div>
      <h4 className="text-xs font-semibold text-thb-text-secondary mb-2">{label}</h4>
      <div className="flex items-end gap-1 h-24">
        {data.map((d, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div
              className={`w-full rounded-t ${barColor} transition-all`}
              style={{ height: `${Math.max((d.value / maxVal) * 80, 2)}px` }}
              title={`${d.label}: ${fmtCurrency(d.value)}`}
            />
            <span className="text-[9px] text-thb-text-muted truncate w-full text-center">{d.label.slice(5)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PayrollReportsPage() {
  const effectiveCompanyId = useCompanyContextStore(s => s.effectiveCompanyId());
  const scopeQuery = useCompanyContextStore(s => s.scopeQuery);
  const selectedTenantId = useCompanyContextStore(s => s.selectedTenantId);
  const availableCompanies = useCompanyContextStore(s => s.availableCompanies);
  const [activeTab, setActiveTab] = useState<ReportTab>('register');
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(false);

  // Salary Register state
  const [registerMonth, setRegisterMonth] = useState(new Date().getMonth() + 1);
  const [registerYear, setRegisterYear] = useState(new Date().getFullYear());
  const [registerCompanyId, setRegisterCompanyId] = useState('');
  const [registerDepartmentId, setRegisterDepartmentId] = useState('');
  void setRegisterDepartmentId;
  const [registerMode, setRegisterMode] = useState<'summary' | 'detailed'>('summary');
  const [registerData, setRegisterData] = useState<SalaryRegisterRow[]>([]);
  const [registerSummary, setRegisterSummary] = useState({ totalEmployees: 0, totalGrossPay: 0, totalDeductions: 0, totalNetPay: 0, totalEmployerContrib: 0 });

  // Statutory state
  const [statutoryType, setStatutoryType] = useState<StatutoryType>('PF');
  const [statutoryMonth, setStatutoryMonth] = useState(new Date().getMonth() + 1);
  const [statutoryYear, setStatutoryYear] = useState(new Date().getFullYear());
  const [statutoryCompanyId, setStatutoryCompanyId] = useState('');
  const [statutoryData, setStatutoryData] = useState<StatutoryRow[]>([]);
  const [statutoryTotals, setStatutoryTotals] = useState<Record<string, number>>({});
  const [statutoryColumns, setStatutoryColumns] = useState<string[]>([]);

  // Dashboard state
  const [dashboardCompanyId, setDashboardCompanyId] = useState('');

  // Sync company selections with global company switcher on hydration
  useEffect(() => {
    if (effectiveCompanyId) {
      setRegisterCompanyId(prev => prev || effectiveCompanyId);
      setStatutoryCompanyId(prev => prev || effectiveCompanyId);
      setDashboardCompanyId(prev => prev || effectiveCompanyId);
    }
  }, [effectiveCompanyId, scopeQuery, selectedTenantId]);

  const [dashboardMetrics, setDashboardMetrics] = useState<DashboardMetrics | null>(null);
  const [monthlyTrend, setMonthlyTrend] = useState<MonthlyTrend[]>([]);
  const [deptBreakdown, setDeptBreakdown] = useState<DepartmentBreakdown[]>([]);

  // Fetch companies
  const fetchCompanies = useCallback(async () => {
    try {
      const res = await fetch('/api/companies?limit=100', { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        const list = data.companies || data.data || [];
        setCompanies(list.map((c: Record<string, unknown>) => ({
          id: c.id as string,
          name: c.name as string,
          code: (c.code as string) || null,
        })));
      }
    } catch {
      // Silently fail
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => fetchCompanies());
  }, [fetchCompanies]);

  // Load Salary Register
  const loadSalaryRegister = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        month: String(registerMonth),
        year: String(registerYear),
        mode: registerMode,
      });
      const rcid = registerCompanyId || effectiveCompanyId;
      if (rcid) params.set('companyId', rcid);
      if (registerDepartmentId) params.set('departmentId', registerDepartmentId);
      const sq = scopeQuery();

      const res = await fetch(`/api/payroll/reports/salary-register?${params.toString()}${sq ? `&${sq}` : ''}`, { headers: getAuthHeaders() });
      if (!res.ok) {
        let errorMsg = 'Failed to load salary register';
        try { const d = await res.json(); errorMsg = d.error || errorMsg; } catch { /* non-JSON response */ }
        throw new Error(errorMsg);
      }
      const data = await res.json();
      setRegisterData(data.data || []);
      setRegisterSummary(data.summary || { totalEmployees: 0, totalGrossPay: 0, totalDeductions: 0, totalNetPay: 0, totalEmployerContrib: 0 });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to load salary register');
    } finally {
      setLoading(false);
    }
  };

  // Load Statutory Report
  const loadStatutoryReport = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        type: statutoryType,
        month: String(statutoryMonth),
        year: String(statutoryYear),
      });
      const scid = statutoryCompanyId || effectiveCompanyId;
      if (scid) params.set('companyId', scid);
      const sq = scopeQuery();

      const res = await fetch(`/api/payroll/reports/statutory?${params.toString()}${sq ? `&${sq}` : ''}`, { headers: getAuthHeaders() });
      if (!res.ok) {
        let errorMsg = 'Failed to load statutory report';
        try { const d = await res.json(); errorMsg = d.error || errorMsg; } catch { /* non-JSON response */ }
        throw new Error(errorMsg);
      }
      const data = await res.json();
      setStatutoryData(data.data || []);
      setStatutoryTotals(data.totals || {});

      // Derive columns from first row
      if (data.data && data.data.length > 0) {
        const excludeKeys = new Set(['employeeId', 'name', 'empCode', 'department']);
        const cols = Object.keys(data.data[0]).filter(k => !excludeKeys.has(k));
        setStatutoryColumns(cols);
      } else {
        setStatutoryColumns([]);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to load statutory report');
    } finally {
      setLoading(false);
    }
  };

  // Load Dashboard
  const loadDashboard = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      const dcid = dashboardCompanyId || effectiveCompanyId;
      if (dcid) params.set('companyId', dcid);
      const sq = scopeQuery();

      const res = await fetch(`/api/payroll/dashboard?${params.toString()}${sq ? `&${sq}` : ''}`, { headers: getAuthHeaders() });
      if (!res.ok) {
        let errorMsg = 'Failed to load dashboard';
        try { const d = await res.json(); errorMsg = d.error || errorMsg; } catch { /* non-JSON response */ }
        throw new Error(errorMsg);
      }
      const data = await res.json();
      setDashboardMetrics(data.metrics);
      setMonthlyTrend(data.monthlyTrend || []);
      setDeptBreakdown(data.departmentBreakdown || []);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  // Export to CSV
  const handleExportCSV = (rows: Record<string, unknown>[], filename: string) => {
    if (rows.length === 0) {
      toast.error('No data to export');
      return;
    }
    const headers = Object.keys(rows[0]);
    const csvContent = [
      headers.join(','),
      ...rows.map(row => headers.map(h => {
        const val = row[h];
        if (typeof val === 'object' && val !== null) return `"${JSON.stringify(val).replace(/"/g, '""')}"`;
        return `"${String(val ?? '').replace(/"/g, '""')}"`;
      }).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('CSV exported');
  };

  // Month options
  const months = Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: new Date(2024, i).toLocaleString('default', { month: 'long' }) }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-thb-text-primary flex items-center gap-2">
            <FiFileText className="w-6 h-6 text-slate-500" />
            Payroll Reports & Dashboard
          </h1>
          <p className="text-thb-text-secondary mt-1">Salary register, statutory reports, and payroll analytics</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg w-fit flex-wrap">
        {([
          { key: 'register', label: 'Salary Register', icon: FiDatabase },
          { key: 'statutory', label: 'Statutory Reports', icon: FiShield },
          { key: 'standard', label: 'Standard Reports', icon: FiFile },
          { key: 'dashboard', label: 'Payroll Dashboard', icon: FiBarChart2 },
        ] as { key: ReportTab; label: string; icon: React.ComponentType<{ className?: string }> }[]).map(tab => {
          const IconComp = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${
                activeTab === tab.key ? 'bg-white text-green-600 shadow-sm' : 'text-thb-text-secondary hover:text-thb-text-primary'
              }`}
            >
              <IconComp className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ========== SALARY REGISTER ========== */}
      {activeTab === 'register' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="thb-card p-4">
            <div className="flex flex-col sm:flex-row gap-3 items-end">
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Month</label>
                <select
                  value={registerMonth}
                  onChange={(e) => setRegisterMonth(parseInt(e.target.value))}
                  className="px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 min-w-[120px]"
                >
                  {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Year</label>
                <input
                  type="number"
                  value={registerYear}
                  onChange={(e) => setRegisterYear(parseInt(e.target.value))}
                  className="px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 w-24"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Company</label>
                <select
                  value={registerCompanyId}
                  onChange={(e) => setRegisterCompanyId(e.target.value)}
                  className="px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 min-w-[140px]"
                >
                  <option value="">All Companies</option>
                  {(availableCompanies.length > 0 ? availableCompanies : companies).map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Mode</label>
                <select
                  value={registerMode}
                  onChange={(e) => setRegisterMode(e.target.value as 'summary' | 'detailed')}
                  className="px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 min-w-[120px]"
                >
                  <option value="summary">Summary</option>
                  <option value="detailed">Detailed</option>
                </select>
              </div>
              <button
                onClick={loadSalaryRegister}
                disabled={loading}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 font-medium text-sm shadow-sm shadow-green-500/25 transition-colors whitespace-nowrap"
              >
                {loading ? <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" /> : <FiSearch className="w-4 h-4" />}
                Load
              </button>
            </div>
          </div>

          {/* Summary Cards */}
          {registerData.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
              <div className="thb-card p-4 text-center">
                <p className="text-xs font-medium text-thb-text-secondary">Employees</p>
                <p className="text-xl font-bold text-thb-text-primary">{registerSummary.totalEmployees}</p>
              </div>
              <div className="thb-card p-4 text-center">
                <p className="text-xs font-medium text-emerald-700">Gross Pay</p>
                <p className="text-lg font-bold text-emerald-700">{fmtCurrency(registerSummary.totalGrossPay)}</p>
              </div>
              <div className="thb-card p-4 text-center">
                <p className="text-xs font-medium text-red-700">Deductions</p>
                <p className="text-lg font-bold text-red-700">{fmtCurrency(registerSummary.totalDeductions)}</p>
              </div>
              <div className="thb-card p-4 text-center">
                <p className="text-xs font-medium text-green-700">Net Pay</p>
                <p className="text-lg font-bold text-green-700">{fmtCurrency(registerSummary.totalNetPay)}</p>
              </div>
              <div className="thb-card p-4 text-center">
                <p className="text-xs font-medium text-teal-700">Employer Contrib</p>
                <p className="text-lg font-bold text-teal-700">{fmtCurrency(registerSummary.totalEmployerContrib)}</p>
              </div>
            </div>
          )}

          {/* Export */}
          {registerData.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const exportRows = registerData.map(r => ({
                    empCode: r.empCode,
                    name: r.name,
                    department: r.department,
                    designation: r.designation,
                    grossPay: r.grossPay,
                    totalDeductions: r.totalDeductions,
                    netPay: r.netPay,
                    totalEmployerContrib: r.totalEmployerContrib,
                  }));
                  handleExportCSV(exportRows, `salary_register_${registerYear}_${registerMonth}`);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 border border-thb-border rounded-lg text-sm font-medium text-thb-text-secondary hover:bg-slate-50 transition-colors"
              >
                <FiDownload className="w-4 h-4" /> Export CSV
              </button>
            </div>
          )}

          {/* Table */}
          {registerData.length > 0 ? (
            <div className="thb-card overflow-hidden">
              <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                <table className="w-full min-w-[800px]">
                  <thead className="sticky top-0 z-10">
                    <tr className="border-b border-thb-border bg-slate-50">
                      <th className="text-left px-3 py-2 text-xs font-semibold text-thb-text-secondary uppercase">Emp Code</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-thb-text-secondary uppercase">Name</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-thb-text-secondary uppercase">Department</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-thb-text-secondary uppercase">Gross Pay</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-thb-text-secondary uppercase">Deductions</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-thb-text-secondary uppercase">Net Pay</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-thb-text-secondary uppercase">Employer Contrib</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-thb-border/50">
                    {registerData.map((row) => (
                      <tr key={row.employeeId} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-3 py-2 text-sm font-medium text-thb-text-primary">{row.empCode}</td>
                        <td className="px-3 py-2 text-sm text-thb-text-primary">{row.name}</td>
                        <td className="px-3 py-2 text-sm text-thb-text-secondary">{row.department}</td>
                        <td className="px-3 py-2 text-sm text-right text-emerald-700 font-medium">{fmtCurrency(row.grossPay)}</td>
                        <td className="px-3 py-2 text-sm text-right text-red-700">{fmtCurrency(row.totalDeductions)}</td>
                        <td className="px-3 py-2 text-sm text-right font-semibold text-thb-text-primary">{fmtCurrency(row.netPay)}</td>
                        <td className="px-3 py-2 text-sm text-right text-teal-700">{fmtCurrency(row.totalEmployerContrib)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : !loading && (
            <div className="thb-card p-12 text-center">
              <FiDatabase className="w-12 h-12 text-thb-text-muted mx-auto mb-3" />
              <p className="text-thb-text-secondary font-medium">No data loaded</p>
              <p className="text-sm text-thb-text-muted mt-1">Select filters and click Load to view salary register</p>
            </div>
          )}
        </div>
      )}

      {/* ========== STATUTORY REPORTS ========== */}
      {activeTab === 'statutory' && (
        <div className="space-y-4">
          {/* Type Tabs */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg w-fit flex-wrap">
            {(['PF', 'ESI', 'PT', 'TDS', 'LWF'] as StatutoryType[]).map(type => (
              <button
                key={type}
                onClick={() => setStatutoryType(type)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  statutoryType === type ? 'bg-white text-green-600 shadow-sm' : 'text-thb-text-secondary hover:text-thb-text-primary'
                }`}
              >
                {type}
              </button>
            ))}
          </div>

          {/* Filters */}
          <div className="thb-card p-4">
            <div className="flex flex-col sm:flex-row gap-3 items-end">
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Month</label>
                <select
                  value={statutoryMonth}
                  onChange={(e) => setStatutoryMonth(parseInt(e.target.value))}
                  className="px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 min-w-[120px]"
                >
                  {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Year</label>
                <input
                  type="number"
                  value={statutoryYear}
                  onChange={(e) => setStatutoryYear(parseInt(e.target.value))}
                  className="px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 w-24"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Company</label>
                <select
                  value={statutoryCompanyId}
                  onChange={(e) => setStatutoryCompanyId(e.target.value)}
                  className="px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 min-w-[140px]"
                >
                  <option value="">All Companies</option>
                  {(availableCompanies.length > 0 ? availableCompanies : companies).map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={loadStatutoryReport}
                disabled={loading}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 font-medium text-sm shadow-sm shadow-green-500/25 transition-colors whitespace-nowrap"
              >
                {loading ? <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" /> : <FiSearch className="w-4 h-4" />}
                Load
              </button>
              {statutoryData.length > 0 && (
                <button
                  onClick={() => handleExportCSV(statutoryData as unknown as Record<string, unknown>[], `${statutoryType}_report_${statutoryYear}_${statutoryMonth}`)}
                  className="inline-flex items-center gap-1.5 px-3 py-2.5 border border-thb-border rounded-lg text-sm font-medium text-thb-text-secondary hover:bg-slate-50 transition-colors"
                >
                  <FiDownload className="w-4 h-4" /> Export CSV
                </button>
              )}
            </div>
          </div>

          {/* Totals */}
          {Object.keys(statutoryTotals).length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {Object.entries(statutoryTotals).map(([key, value]) => (
                <div key={key} className="thb-card p-4 text-center">
                  <p className="text-xs font-medium text-thb-text-secondary">{key.replace(/([A-Z])/g, ' $1').trim()}</p>
                  <p className="text-lg font-bold text-thb-text-primary">{typeof value === 'number' ? fmtCurrency(value) : String(value)}</p>
                </div>
              ))}
            </div>
          )}

          {/* Table */}
          {statutoryData.length > 0 ? (
            <div className="thb-card overflow-hidden">
              <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                <table className="w-full min-w-[600px]">
                  <thead className="sticky top-0 z-10">
                    <tr className="border-b border-thb-border bg-slate-50">
                      <th className="text-left px-3 py-2 text-xs font-semibold text-thb-text-secondary uppercase">Emp Code</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-thb-text-secondary uppercase">Name</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-thb-text-secondary uppercase">Department</th>
                      {statutoryColumns.map(col => (
                        <th key={col} className="text-right px-3 py-2 text-xs font-semibold text-thb-text-secondary uppercase">{col.replace(/([A-Z])/g, ' $1').trim()}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-thb-border/50">
                    {statutoryData.map((row) => (
                      <tr key={row.employeeId} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-3 py-2 text-sm font-medium text-thb-text-primary">{row.empCode}</td>
                        <td className="px-3 py-2 text-sm text-thb-text-primary">{row.name}</td>
                        <td className="px-3 py-2 text-sm text-thb-text-secondary">{row.department}</td>
                        {statutoryColumns.map(col => (
                          <td key={col} className="px-3 py-2 text-sm text-right text-thb-text-primary">
                            {typeof row[col] === 'number' ? fmtCurrency(row[col] as number) : String(row[col] ?? '—')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : !loading && (
            <div className="thb-card p-12 text-center">
              <FiShield className="w-12 h-12 text-thb-text-muted mx-auto mb-3" />
              <p className="text-thb-text-secondary font-medium">No data loaded</p>
              <p className="text-sm text-thb-text-muted mt-1">Select type and period, then click Load</p>
            </div>
          )}
        </div>
      )}

      {/* ========== STANDARD REPORTS ========== */}
      {activeTab === 'standard' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { title: 'Payslip Summary', icon: FiFileText, desc: 'Month-wise summary of all payslips processed', color: 'blue' },
              { title: 'Bank Payment Report', icon: FiCreditCard, desc: 'Employee bank details and net pay for bank file generation', color: 'emerald' },
              { title: 'Tax Summary Report', icon: FiBarChart2, desc: 'Annual tax summary for all employees', color: 'amber' },
              { title: 'CTC Report', icon: FiDollarSign, desc: 'Employee CTC breakdown and composition', color: 'purple' },
              { title: 'Arrears Report', icon: FiTrendingUp, desc: 'Arrears paid to employees', color: 'rose' },
              { title: 'Reimbursement Report', icon: FiCreditCard, desc: 'Reimbursements processed and pending', color: 'teal' },
            ].map((report) => {
              const colorMap: Record<string, { bg: string; icon: string; ring: string }> = {
                blue: { bg: 'bg-green-500/10', icon: 'text-green-500', ring: 'ring-green-500/20' },
                emerald: { bg: 'bg-emerald-500/10', icon: 'text-emerald-500', ring: 'ring-emerald-500/20' },
                amber: { bg: 'bg-amber-500/10', icon: 'text-amber-500', ring: 'ring-amber-500/20' },
                purple: { bg: 'bg-teal-500/10', icon: 'text-teal-500', ring: 'ring-teal-500/20' },
                rose: { bg: 'bg-rose-500/10', icon: 'text-rose-500', ring: 'ring-rose-500/20' },
                teal: { bg: 'bg-teal-500/10', icon: 'text-teal-500', ring: 'ring-teal-500/20' },
              };
              const c = colorMap[report.color] || colorMap.blue;
              const IconComp = report.icon;
              return (
                <div key={report.title} className="thb-card thb-card-hover p-5 group cursor-pointer">
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-xl ${c.bg} flex items-center justify-center ${c.icon} ring-1 ${c.ring} flex-shrink-0`}>
                      <IconComp className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-thb-text-primary">{report.title}</h3>
                      <p className="text-xs text-thb-text-muted mt-1">{report.desc}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="thb-card p-8 text-center">
            <FiFileText className="w-12 h-12 text-thb-text-muted mx-auto mb-3" />
            <p className="text-thb-text-secondary font-medium">Standard Reports</p>
            <p className="text-sm text-thb-text-muted mt-1">Select a report type above to generate. Each report supports filtering by month/year/company and can be exported to CSV or printed.</p>
          </div>
        </div>
      )}

      {/* ========== PAYROLL DASHBOARD ========== */}
      {activeTab === 'dashboard' && (
        <div className="space-y-4">
          {/* Company Filter */}
          <div className="thb-card p-4">
            <div className="flex flex-col sm:flex-row gap-3 items-end">
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Company</label>
                <select
                  value={dashboardCompanyId}
                  onChange={(e) => setDashboardCompanyId(e.target.value)}
                  className="px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 min-w-[140px]"
                >
                  <option value="">All Companies</option>
                  {(availableCompanies.length > 0 ? availableCompanies : companies).map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={loadDashboard}
                disabled={loading}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 font-medium text-sm shadow-sm shadow-green-500/25 transition-colors whitespace-nowrap"
              >
                {loading ? <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" /> : <FiRefreshCw className="w-4 h-4" />}
                Load Dashboard
              </button>
            </div>
          </div>

          {dashboardMetrics ? (
            <>
              {/* Key Metrics Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="thb-card thb-card-hover p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
                      <FiUsers className="w-5 h-5 text-green-500" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-thb-text-secondary">Employees Processed</p>
                      <p className="text-xl font-bold text-thb-text-primary">{dashboardMetrics.totalEmployeesProcessed}</p>
                    </div>
                  </div>
                </div>
                <div className="thb-card thb-card-hover p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
                      <FiDollarSign className="w-5 h-5 text-emerald-500" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-thb-text-secondary">Total Gross Pay</p>
                      <p className="text-lg font-bold text-emerald-700">{fmtCurrency(dashboardMetrics.totalGrossPay)}</p>
                    </div>
                  </div>
                </div>
                <div className="thb-card thb-card-hover p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center">
                      <FiTrendingUp className="w-5 h-5 text-red-500" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-thb-text-secondary">Total Deductions</p>
                      <p className="text-lg font-bold text-red-700">{fmtCurrency(dashboardMetrics.totalDeductions)}</p>
                    </div>
                  </div>
                </div>
                <div className="thb-card thb-card-hover p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
                      <FiCheckCircle className="w-5 h-5 text-green-500" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-thb-text-secondary">Total Net Pay</p>
                      <p className="text-lg font-bold text-green-700">{fmtCurrency(dashboardMetrics.totalNetPay)}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="thb-card thb-card-hover p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center">
                      <FiShield className="w-5 h-5 text-teal-500" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-thb-text-secondary">Employer Contrib</p>
                      <p className="text-lg font-bold text-teal-700">{fmtCurrency(dashboardMetrics.totalEmployerContrib)}</p>
                    </div>
                  </div>
                </div>
                <div className="thb-card thb-card-hover p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
                      <FiClock className="w-5 h-5 text-amber-500" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-thb-text-secondary">Pending Approvals</p>
                      <p className="text-xl font-bold text-amber-700">{dashboardMetrics.pendingApprovals}</p>
                    </div>
                  </div>
                </div>
                <div className="thb-card thb-card-hover p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-rose-50 flex items-center justify-center">
                      <FiAlertTriangle className="w-5 h-5 text-rose-500" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-thb-text-secondary">Active Holds</p>
                      <p className="text-xl font-bold text-rose-700">{dashboardMetrics.activeHolds}</p>
                    </div>
                  </div>
                </div>
                <div className="thb-card thb-card-hover p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-sky-50 flex items-center justify-center">
                      <FiUsers className="w-5 h-5 text-sky-500" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-thb-text-secondary">Active Employees</p>
                      <p className="text-xl font-bold text-sky-700">{dashboardMetrics.totalActiveEmployees}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Monthly Trend */}
                <div className="thb-card p-6">
                  <h3 className="text-sm font-semibold text-thb-text-primary mb-4">Monthly Payroll Trend (6 months)</h3>
                  {monthlyTrend.length > 0 ? (
                    <MiniBarChart
                      data={monthlyTrend.map(t => ({ label: t.period, value: t.netPay }))}
                      label="Net Pay Trend"
                      color="green"
                    />
                  ) : (
                    <p className="text-sm text-thb-text-muted text-center py-8">No trend data available</p>
                  )}
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-thb-border">
                          <th className="text-left px-2 py-1 text-xs font-medium text-thb-text-secondary">Period</th>
                          <th className="text-right px-2 py-1 text-xs font-medium text-thb-text-secondary">Gross</th>
                          <th className="text-right px-2 py-1 text-xs font-medium text-thb-text-secondary">Deductions</th>
                          <th className="text-right px-2 py-1 text-xs font-medium text-thb-text-secondary">Net</th>
                          <th className="text-right px-2 py-1 text-xs font-medium text-thb-text-secondary">Emp Count</th>
                        </tr>
                      </thead>
                      <tbody>
                        {monthlyTrend.map(t => (
                          <tr key={t.period} className="border-b border-thb-border/30 hover:bg-slate-50/50">
                            <td className="px-2 py-1.5 font-medium text-thb-text-primary">{t.period}</td>
                            <td className="px-2 py-1.5 text-right text-emerald-700">{fmtCurrency(t.grossPay)}</td>
                            <td className="px-2 py-1.5 text-right text-red-700">{fmtCurrency(t.deductions)}</td>
                            <td className="px-2 py-1.5 text-right font-semibold text-thb-text-primary">{fmtCurrency(t.netPay)}</td>
                            <td className="px-2 py-1.5 text-right text-thb-text-secondary">{t.employees}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Department Breakdown */}
                <div className="thb-card p-6">
                  <h3 className="text-sm font-semibold text-thb-text-primary mb-4">Department-wise Salary Breakdown</h3>
                  {deptBreakdown.length > 0 ? (
                    <>
                      <MiniBarChart
                        data={deptBreakdown.slice(0, 8).map(d => ({ label: d.departmentName, value: d.totalSalary }))}
                        label="Total Salary by Department"
                        color="blue"
                      />
                      <div className="mt-4 overflow-x-auto max-h-64 overflow-y-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-thb-border">
                              <th className="text-left px-2 py-1 text-xs font-medium text-thb-text-secondary">Department</th>
                              <th className="text-right px-2 py-1 text-xs font-medium text-thb-text-secondary">Headcount</th>
                              <th className="text-right px-2 py-1 text-xs font-medium text-thb-text-secondary">Total Salary</th>
                              <th className="text-right px-2 py-1 text-xs font-medium text-thb-text-secondary">Avg Salary</th>
                            </tr>
                          </thead>
                          <tbody>
                            {deptBreakdown.map(d => (
                              <tr key={d.departmentId} className="border-b border-thb-border/30 hover:bg-slate-50/50">
                                <td className="px-2 py-1.5 font-medium text-thb-text-primary">{d.departmentName}</td>
                                <td className="px-2 py-1.5 text-right text-thb-text-secondary">{d.headcount}</td>
                                <td className="px-2 py-1.5 text-right font-semibold text-thb-text-primary">{fmtCurrency(d.totalSalary)}</td>
                                <td className="px-2 py-1.5 text-right text-thb-text-secondary">{fmtCurrency(d.avgSalary)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-thb-text-muted text-center py-8">No department data available</p>
                  )}
                </div>
              </div>
            </>
          ) : !loading && (
            <div className="thb-card p-12 text-center">
              <FiBarChart2 className="w-12 h-12 text-thb-text-muted mx-auto mb-3" />
              <p className="text-thb-text-secondary font-medium">Dashboard not loaded</p>
              <p className="text-sm text-thb-text-muted mt-1">Click Load Dashboard to view payroll metrics</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
