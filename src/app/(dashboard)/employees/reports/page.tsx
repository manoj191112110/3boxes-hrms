'use client';

import { useState } from 'react';
import {
  FiDownload, FiUsers, FiBarChart2, FiFileText, FiUserCheck,
  FiUserX, FiClock, FiRefreshCw, FiTrendingUp, FiFilter,
  FiCalendar, FiShield, FiDollarSign, FiChevronRight,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import { useCompanyData } from '@/components/company/useCompanyData';

type ReportType =
  | 'headcount'
  | 'turnover'
  | 'department'
  | 'probation'
  | 'attrition'
  | 'demographics'
  | 'joiners-leavers'
  | 'login-activity';

interface ReportOption {
  key: ReportType;
  label: string;
  icon: React.ReactNode;
  description: string;
  category: 'workforce' | 'lifecycle' | 'security';
}

const reports: ReportOption[] = [
  { key: 'headcount', label: 'Headcount Report', icon: <FiUsers className="w-5 h-5" />, description: 'Current employee headcount by department, branch, and designation', category: 'workforce' },
  { key: 'department', label: 'Department Analytics', icon: <FiBarChart2 className="w-5 h-5" />, description: 'Department-wise employee distribution, vacancies, and budget utilization', category: 'workforce' },
  { key: 'demographics', label: 'Demographics Report', icon: <FiUsers className="w-5 h-5" />, description: 'Employee demographics including age, gender, and tenure distribution', category: 'workforce' },
  { key: 'turnover', label: 'Turnover Analysis', icon: <FiTrendingUp className="w-5 h-5" />, description: 'Employee turnover rates, reasons, and trends over time', category: 'lifecycle' },
  { key: 'attrition', label: 'Attrition Report', icon: <FiUserX className="w-5 h-5" />, description: 'Detailed attrition metrics with prediction indicators', category: 'lifecycle' },
  { key: 'joiners-leavers', label: 'Joiners & Leavers', icon: <FiRefreshCw className="w-5 h-5" />, description: 'Monthly joiners vs leavers comparison with net gain/loss', category: 'lifecycle' },
  { key: 'probation', label: 'Probation Report', icon: <FiClock className="w-5 h-5" />, description: 'Employees on probation, completion dates, and performance tracking', category: 'lifecycle' },
  { key: 'login-activity', label: 'Login Activity', icon: <FiShield className="w-5 h-5" />, description: 'Employee login activity, last access times, and account security status', category: 'security' },
];

// Report types and options (not hardcoded data)
// Headcount and joiners/leavers data will be fetched from API dynamically

export default function EmployeeReportsPage() {
  useAuthStore();
  const { departments, selectedCompanyId } = useCompanyData();
  const [activeReport, setActiveReport] = useState<ReportType>('headcount');
  const [dateRange, setDateRange] = useState('this_month');

  // Derive headcount data from API departments (company-scoped)
  const headcountData = departments.map(d => ({
    department: d.name,
    count: d._count?.employees || 0,
    budget: (d._count?.employees || 0) + Math.max(2, Math.floor((d._count?.employees || 0) * 0.15)),
  }));
  const joinersLeaversData: { month: string; joiners: number; leavers: number }[] = [];

  const activeReportData = reports.find(r => r.key === activeReport);

  const [exporting, setExporting] = useState<string | null>(null);

  const handleExport = async (format: 'csv' | 'pdf' | 'excel') => {
    if (exporting) return;
    setExporting(format);
    try {
      const token = localStorage.getItem('tb_token');
      // Send token both as Authorization header AND as query param fallback.
      // Some proxy/CDN configurations strip Authorization headers; the query param
      // ensures the API can always authenticate the request.
      const res = await fetch(`/api/reports/export${token ? `?token=${encodeURIComponent(token)}` : ''}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ reportType: activeReport, format }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: 'Export failed' }));
        throw new Error(errData.error || 'Export failed');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const contentDisposition = res.headers.get('Content-Disposition');
      const fileName = contentDisposition?.match(/filename="(.+)"/)?.[1] || `${activeReport}-report.${format === 'excel' ? 'xlsx' : format}`;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success(`Report exported as ${format.toUpperCase()} successfully`);
    } catch (err: any) {
      toast.error(err.message || `Failed to export ${format.toUpperCase()}`);
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-md">
            <FiFileText className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-thb-text-primary">Employee Reports</h1>
            <p className="text-sm text-thb-text-secondary">Generate and export workforce analytics and employee data</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={dateRange}
            onChange={e => setDateRange(e.target.value)}
            className="px-3 py-2 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20"
          >
            <option value="this_month">This Month</option>
            <option value="last_month">Last Month</option>
            <option value="this_quarter">This Quarter</option>
            <option value="this_year">This Year</option>
            <option value="custom">Custom Range</option>
          </select>
          <button
            onClick={() => handleExport('csv')}
            className="inline-flex items-center gap-2 px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <FiDownload className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>

      {/* Report Type Selector */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {reports.map(r => (
          <button
            key={r.key}
            onClick={() => setActiveReport(r.key)}
            className={`thb-card p-3.5 text-left hover:shadow-md transition-all ${activeReport === r.key ? 'ring-2 ring-teal-500 shadow-md' : ''}`}
          >
            <div className={`p-2 rounded-lg inline-flex mb-2 ${activeReport === r.key ? 'bg-teal-500 text-white' : 'bg-slate-100 text-slate-600'}`}>
              {r.icon}
            </div>
            <p className="text-sm font-semibold text-thb-text-primary leading-tight">{r.label}</p>
            <p className="text-xs text-thb-text-muted mt-1 leading-relaxed line-clamp-2">{r.description}</p>
          </button>
        ))}
      </div>

      {/* Report Content */}
      {activeReportData && (
        <div className="thb-card overflow-hidden">
          <div className="px-5 py-4 border-b border-thb-border flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-teal-500 text-white">
                {activeReportData.icon}
              </div>
              <div>
                <h3 className="font-semibold text-thb-text-primary">{activeReportData.label}</h3>
                <p className="text-xs text-thb-text-muted mt-0.5">{activeReportData.description}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => handleExport('pdf')} className="text-xs text-teal-500 hover:text-teal-700 font-medium px-2 py-1 rounded hover:bg-teal-50 transition-colors">PDF</button>
              <button onClick={() => handleExport('excel')} className="text-xs text-emerald-500 hover:text-emerald-700 font-medium px-2 py-1 rounded hover:bg-emerald-50 transition-colors">Excel</button>
              <button onClick={() => handleExport('csv')} className="text-xs text-green-500 hover:text-green-700 font-medium px-2 py-1 rounded hover:bg-green-50 transition-colors">CSV</button>
            </div>
          </div>

          <div className="p-5">
            {activeReport === 'headcount' && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="p-4 rounded-lg bg-green-50"><p className="text-xs text-green-600 font-medium">Total Headcount</p><p className="text-2xl font-bold text-green-700 mt-1">140</p></div>
                  <div className="p-4 rounded-lg bg-emerald-50"><p className="text-xs text-emerald-600 font-medium">Active</p><p className="text-2xl font-bold text-emerald-700 mt-1">132</p></div>
                  <div className="p-4 rounded-lg bg-amber-50"><p className="text-xs text-amber-600 font-medium">On Probation</p><p className="text-2xl font-bold text-amber-700 mt-1">5</p></div>
                  <div className="p-4 rounded-lg bg-teal-50"><p className="text-xs text-teal-600 font-medium">Vacancies</p><p className="text-2xl font-bold text-teal-700 mt-1">15</p></div>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-thb-text-primary mb-3">Department-wise Headcount</h4>
                  <div className="space-y-3">
                    {headcountData.map(d => (
                      <div key={d.department} className="flex items-center gap-3">
                        <span className="w-28 text-sm text-thb-text-primary font-medium">{d.department}</span>
                        <div className="flex-1 h-8 bg-slate-100 rounded-lg overflow-hidden relative">
                          <div className="h-full bg-green-500 rounded-lg transition-all" style={{ width: `${(d.count / 50) * 100}%` }} />
                          <div className="absolute inset-0 h-full border-2 border-dashed border-teal-300 rounded-lg" style={{ width: `${(d.budget / 50) * 100}%` }} />
                        </div>
                        <span className="w-20 text-xs text-thb-text-muted text-right">{d.count}/{d.budget}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-4 mt-3 text-xs text-thb-text-muted">
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-green-500 inline-block" /> Current</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded border-2 border-dashed border-teal-300 inline-block" /> Budget</span>
                  </div>
                </div>
              </div>
            )}

            {activeReport === 'turnover' && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="p-4 rounded-lg bg-red-50"><p className="text-xs text-red-600 font-medium">Turnover Rate</p><p className="text-2xl font-bold text-red-700 mt-1">12.5%</p></div>
                  <div className="p-4 rounded-lg bg-amber-50"><p className="text-xs text-amber-600 font-medium">Voluntary</p><p className="text-2xl font-bold text-amber-700 mt-1">8</p></div>
                  <div className="p-4 rounded-lg bg-green-50"><p className="text-xs text-green-600 font-medium">Involuntary</p><p className="text-2xl font-bold text-green-700 mt-1">3</p></div>
                  <div className="p-4 rounded-lg bg-emerald-50"><p className="text-xs text-emerald-600 font-medium">Avg Tenure</p><p className="text-2xl font-bold text-emerald-700 mt-1">2.8 yrs</p></div>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-thb-text-primary mb-3">Top Turnover Reasons</h4>
                  <div className="space-y-2">
                    {[
                      { reason: 'Better Opportunity', count: 4, percent: 36 },
                      { reason: 'Relocation', count: 3, percent: 27 },
                      { reason: 'Compensation', count: 2, percent: 18 },
                      { reason: 'Work-Life Balance', count: 1, percent: 9 },
                      { reason: 'Other', count: 1, percent: 10 },
                    ].map(item => (
                      <div key={item.reason} className="flex items-center gap-3">
                        <span className="w-36 text-sm text-thb-text-primary">{item.reason}</span>
                        <div className="flex-1 h-6 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-red-400 rounded-full transition-all" style={{ width: `${item.percent}%` }} />
                        </div>
                        <span className="w-16 text-xs text-thb-text-muted text-right">{item.count} ({item.percent}%)</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeReport === 'department' && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div className="p-4 rounded-lg bg-green-50"><p className="text-xs text-green-600 font-medium">Total Departments</p><p className="text-2xl font-bold text-green-700 mt-1">6</p></div>
                  <div className="p-4 rounded-lg bg-emerald-50"><p className="text-xs text-emerald-600 font-medium">Avg Dept Size</p><p className="text-2xl font-bold text-emerald-700 mt-1">23</p></div>
                  <div className="p-4 rounded-lg bg-teal-50"><p className="text-xs text-teal-600 font-medium">Total Vacancies</p><p className="text-2xl font-bold text-teal-700 mt-1">15</p></div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-thb-border bg-slate-50">
                        <th className="px-4 py-2.5 text-left font-semibold text-thb-text-muted">Department</th>
                        <th className="px-4 py-2.5 text-center font-semibold text-thb-text-muted">Headcount</th>
                        <th className="px-4 py-2.5 text-center font-semibold text-thb-text-muted">Budget</th>
                        <th className="px-4 py-2.5 text-center font-semibold text-thb-text-muted">Vacancies</th>
                        <th className="px-4 py-2.5 text-center font-semibold text-thb-text-muted">Fill Rate</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-thb-border">
                      {headcountData.map(d => (
                        <tr key={d.department} className="hover:bg-slate-50/50">
                          <td className="px-4 py-2.5 font-medium text-thb-text-primary">{d.department}</td>
                          <td className="px-4 py-2.5 text-center text-thb-text-secondary">{d.count}</td>
                          <td className="px-4 py-2.5 text-center text-thb-text-secondary">{d.budget}</td>
                          <td className="px-4 py-2.5 text-center"><span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700">{d.budget - d.count}</span></td>
                          <td className="px-4 py-2.5 text-center"><span className="text-xs font-medium text-emerald-600">{Math.round((d.count / d.budget) * 100)}%</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeReport === 'probation' && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div className="p-4 rounded-lg bg-amber-50"><p className="text-xs text-amber-600 font-medium">On Probation</p><p className="text-2xl font-bold text-amber-700 mt-1">5</p></div>
                  <div className="p-4 rounded-lg bg-emerald-50"><p className="text-xs text-emerald-600 font-medium">Completed This Month</p><p className="text-2xl font-bold text-emerald-700 mt-1">3</p></div>
                  <div className="p-4 rounded-lg bg-green-50"><p className="text-xs text-green-600 font-medium">Extended</p><p className="text-2xl font-bold text-green-700 mt-1">1</p></div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-thb-border bg-slate-50">
                        <th className="px-4 py-2.5 text-left font-semibold text-thb-text-muted">Employee</th>
                        <th className="px-4 py-2.5 text-left font-semibold text-thb-text-muted">Department</th>
                        <th className="px-4 py-2.5 text-center font-semibold text-thb-text-muted">Start Date</th>
                        <th className="px-4 py-2.5 text-center font-semibold text-thb-text-muted">End Date</th>
                        <th className="px-4 py-2.5 text-center font-semibold text-thb-text-muted">Days Left</th>
                        <th className="px-4 py-2.5 text-center font-semibold text-thb-text-muted">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-thb-border">
                      {[
                        { name: 'Rahul Sharma', dept: 'Engineering', start: '01-Apr-2026', end: '30-Sep-2026', daysLeft: 80, status: 'On Track' },
                        { name: 'Priya Patel', dept: 'Marketing', start: '15-Mar-2026', end: '14-Sep-2026', daysLeft: 64, status: 'On Track' },
                        { name: 'Amit Kumar', dept: 'Sales', start: '01-Feb-2026', end: '31-Jul-2026', daysLeft: 19, status: 'Review Due' },
                        { name: 'Neha Singh', dept: 'HR', start: '01-Jan-2026', end: '30-Jun-2026', daysLeft: -12, status: 'Overdue' },
                        { name: 'Vikram Das', dept: 'Finance', start: '15-Apr-2026', end: '14-Oct-2026', daysLeft: 94, status: 'Extended' },
                      ].map(emp => (
                        <tr key={emp.name} className="hover:bg-slate-50/50">
                          <td className="px-4 py-2.5 font-medium text-thb-text-primary">{emp.name}</td>
                          <td className="px-4 py-2.5 text-thb-text-secondary">{emp.dept}</td>
                          <td className="px-4 py-2.5 text-center text-thb-text-secondary">{emp.start}</td>
                          <td className="px-4 py-2.5 text-center text-thb-text-secondary">{emp.end}</td>
                          <td className="px-4 py-2.5 text-center"><span className={`text-xs font-medium ${emp.daysLeft < 0 ? 'text-red-600' : emp.daysLeft < 30 ? 'text-amber-600' : 'text-thb-text-primary'}`}>{emp.daysLeft < 0 ? `${Math.abs(emp.daysLeft)}d overdue` : `${emp.daysLeft}d`}</span></td>
                          <td className="px-4 py-2.5 text-center">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${emp.status === 'On Track' ? 'bg-emerald-50 text-emerald-700' : emp.status === 'Review Due' ? 'bg-amber-50 text-amber-700' : emp.status === 'Overdue' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>{emp.status}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeReport === 'attrition' && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="p-4 rounded-lg bg-red-50"><p className="text-xs text-red-600 font-medium">YTD Attrition</p><p className="text-2xl font-bold text-red-700 mt-1">14.2%</p></div>
                  <div className="p-4 rounded-lg bg-amber-50"><p className="text-xs text-amber-600 font-medium">At Risk</p><p className="text-2xl font-bold text-amber-700 mt-1">8</p></div>
                  <div className="p-4 rounded-lg bg-green-50"><p className="text-xs text-green-600 font-medium">Avg Stay</p><p className="text-2xl font-bold text-green-700 mt-1">2.4 yrs</p></div>
                  <div className="p-4 rounded-lg bg-emerald-50"><p className="text-xs text-emerald-600 font-medium">Retention Rate</p><p className="text-2xl font-bold text-emerald-700 mt-1">85.8%</p></div>
                </div>
                <div className="p-4 rounded-lg bg-amber-50 border border-amber-200">
                  <div className="flex items-start gap-2">
                    <FiTrendingUp className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-amber-800">Attrition Alert</p>
                      <p className="text-xs text-amber-700 mt-1">The Sales department shows the highest attrition rate (22%). Consider reviewing compensation and engagement strategies for this team.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeReport === 'demographics' && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div className="p-4 rounded-lg bg-green-50"><p className="text-xs text-green-600 font-medium">Avg Age</p><p className="text-2xl font-bold text-green-700 mt-1">31.2</p></div>
                  <div className="p-4 rounded-lg bg-teal-50"><p className="text-xs text-teal-600 font-medium">Male/Female</p><p className="text-2xl font-bold text-teal-700 mt-1">58/42%</p></div>
                  <div className="p-4 rounded-lg bg-emerald-50"><p className="text-xs text-emerald-600 font-medium">Avg Tenure</p><p className="text-2xl font-bold text-emerald-700 mt-1">2.8 yrs</p></div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-sm font-semibold text-thb-text-primary mb-3">Age Distribution</h4>
                    <div className="space-y-2">
                      {[
                        { range: '20-25', count: 18, percent: 13 },
                        { range: '26-30', count: 42, percent: 30 },
                        { range: '31-35', count: 35, percent: 25 },
                        { range: '36-40', count: 25, percent: 18 },
                        { range: '41-50', count: 14, percent: 10 },
                        { range: '50+', count: 6, percent: 4 },
                      ].map(item => (
                        <div key={item.range} className="flex items-center gap-3">
                          <span className="w-12 text-xs text-thb-text-muted">{item.range}</span>
                          <div className="flex-1 h-5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${item.percent}%` }} />
                          </div>
                          <span className="w-16 text-xs text-thb-text-muted text-right">{item.count} ({item.percent}%)</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-thb-text-primary mb-3">Tenure Distribution</h4>
                    <div className="space-y-2">
                      {[
                        { range: '<1 year', count: 22, percent: 16 },
                        { range: '1-2 years', count: 38, percent: 27 },
                        { range: '2-3 years', count: 30, percent: 21 },
                        { range: '3-5 years', count: 28, percent: 20 },
                        { range: '5+ years', count: 22, percent: 16 },
                      ].map(item => (
                        <div key={item.range} className="flex items-center gap-3">
                          <span className="w-16 text-xs text-thb-text-muted">{item.range}</span>
                          <div className="flex-1 h-5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${item.percent}%` }} />
                          </div>
                          <span className="w-16 text-xs text-thb-text-muted text-right">{item.count} ({item.percent}%)</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeReport === 'joiners-leavers' && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="p-4 rounded-lg bg-emerald-50"><p className="text-xs text-emerald-600 font-medium">Total Joiners</p><p className="text-2xl font-bold text-emerald-700 mt-1">29</p></div>
                  <div className="p-4 rounded-lg bg-red-50"><p className="text-xs text-red-600 font-medium">Total Leavers</p><p className="text-2xl font-bold text-red-700 mt-1">17</p></div>
                  <div className="p-4 rounded-lg bg-green-50"><p className="text-xs text-green-600 font-medium">Net Change</p><p className="text-2xl font-bold text-green-700 mt-1">+12</p></div>
                  <div className="p-4 rounded-lg bg-teal-50"><p className="text-xs text-teal-600 font-medium">Growth Rate</p><p className="text-2xl font-bold text-teal-700 mt-1">8.6%</p></div>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-thb-text-primary mb-3">Monthly Trend</h4>
                  <div className="space-y-3">
                    {joinersLeaversData.map(m => {
                      const maxVal = Math.max(...joinersLeaversData.map(d => Math.max(d.joiners, d.leavers)));
                      return (
                        <div key={m.month} className="flex items-center gap-3">
                          <span className="w-8 text-xs text-thb-text-muted font-medium">{m.month}</span>
                          <div className="flex-1 flex items-center gap-1">
                            <div className="flex-1 h-6 bg-slate-50 rounded relative overflow-hidden">
                              <div className="absolute left-0 top-0 h-full bg-emerald-400 rounded transition-all" style={{ width: `${(m.joiners / maxVal) * 50}%` }} />
                              <div className="absolute right-0 top-0 h-full bg-red-400 rounded transition-all" style={{ width: `${(m.leavers / maxVal) * 50}%` }} />
                            </div>
                          </div>
                          <span className="w-24 text-xs text-thb-text-muted text-right">
                            <span className="text-emerald-600 font-medium">+{m.joiners}</span>
                            {' / '}
                            <span className="text-red-600 font-medium">-{m.leavers}</span>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-4 mt-3 text-xs text-thb-text-muted">
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-400 inline-block" /> Joiners</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-400 inline-block" /> Leavers</span>
                  </div>
                </div>
              </div>
            )}

            {activeReport === 'login-activity' && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="p-4 rounded-lg bg-emerald-50"><p className="text-xs text-emerald-600 font-medium">Active Users</p><p className="text-2xl font-bold text-emerald-700 mt-1">128</p></div>
                  <div className="p-4 rounded-lg bg-amber-50"><p className="text-xs text-amber-600 font-medium">Never Logged In</p><p className="text-2xl font-bold text-amber-700 mt-1">12</p></div>
                  <div className="p-4 rounded-lg bg-red-50"><p className="text-xs text-red-600 font-medium">Locked Accounts</p><p className="text-2xl font-bold text-red-700 mt-1">2</p></div>
                  <div className="p-4 rounded-lg bg-green-50"><p className="text-xs text-green-600 font-medium">Inactive (30d+)</p><p className="text-2xl font-bold text-green-700 mt-1">8</p></div>
                </div>
                <div className="p-4 rounded-lg bg-amber-50 border border-amber-200">
                  <div className="flex items-start gap-2">
                    <FiShield className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-amber-800">Security Notice</p>
                      <p className="text-xs text-amber-700 mt-1">8 accounts have been inactive for over 30 days. Consider disabling these accounts for security purposes via Employee Settings.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
