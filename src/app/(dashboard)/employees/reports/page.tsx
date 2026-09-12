'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  FiDownload, FiUsers, FiBarChart2, FiFileText, FiUserCheck,
  FiUserX, FiClock, FiRefreshCw, FiTrendingUp, FiFilter,
  FiCalendar, FiShield, FiDollarSign, FiChevronRight,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import { useCompanyContextStore } from '@/store/companyContextStore';

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

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

export default function EmployeeReportsPage() {
  const { user } = useAuthStore();
  const scopeQuery = useCompanyContextStore(s => s.scopeQuery);
  const selectedCompanyId = useCompanyContextStore(s => s.selectedCompanyId);
  const [activeReport, setActiveReport] = useState<ReportType>('headcount');
  const [dateRange, setDateRange] = useState('this_month');
  const [reportData, setReportData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);

  // Fetch report data from API
  const fetchReportData = useCallback(async () => {
    setLoading(true);
    try {
      const sq = scopeQuery();
      const res = await fetch(`/api/reports?type=employee_report&${sq || ''}`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        // Map API response to the format the UI expects
        const employees = data.employees || [];
        const deptMap = data.departmentDistribution || {};
        const deptRows = Object.entries(deptMap).map(([name, count]) => ({ department: name, count: count as number }));

        setReportData({
          stats: {
            total: data.headcount || employees.length || 0,
            active: data.headcount || employees.length || 0,
            newHires: data.newHires || 0,
            attrition: data.attrition || 0,
            departments: Object.keys(deptMap).length,
          },
          rows: activeReport === 'headcount' ? deptRows :
                activeReport === 'department' ? deptRows :
                employees.map((e: any) => ({
                  employeeId: e.employeeId,
                  name: `${e.firstName} ${e.lastName}`,
                  email: e.email,
                  department: e.department?.name || '—',
                  designation: e.designation?.title || '—',
                  dateOfJoining: e.dateOfJoining ? new Date(e.dateOfJoining).toLocaleDateString() : '—',
                  status: e.status || 'active',
                })),
        });
      } else {
        setReportData(null);
      }
    } catch {
      setReportData(null);
    } finally {
      setLoading(false);
    }
  }, [activeReport, scopeQuery]);

  useEffect(() => { fetchReportData(); }, [fetchReportData]);

  const handleExport = async (format: 'csv' | 'excel' | 'pdf') => {
    try {
      const sq = scopeQuery();
      const res = await fetch('/api/reports/export', {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportType: activeReport, format, dateRange, companyId: selectedCompanyId }),
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${activeReport}-report.${format === 'excel' ? 'xlsx' : format}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Report exported as ${format.toUpperCase()}`);
    } catch {
      toast.error('Failed to export report');
    }
  };

  const activeReportData = reports.find(r => r.key === activeReport);

  // Derive stats from real API data
  const data = reportData as any;
  const stats = data?.stats || {};
  const rows = data?.rows || [];
  const totalEmployees = stats.total || rows.length || 0;
  const activeEmployees = stats.active || 0;
  const probationEmployees = stats.probation || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-thb-text-primary flex items-center gap-2">
            <FiFileText className="w-6 h-6 text-green-500" />
            Employee Reports
          </h1>
          <p className="text-sm text-thb-text-secondary mt-1">Real-time workforce analytics and reporting</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={dateRange} onChange={e => setDateRange(e.target.value)} className="px-3 py-2 rounded-lg border border-thb-border text-sm">
            <option value="this_month">This Month</option>
            <option value="last_month">Last Month</option>
            <option value="this_quarter">This Quarter</option>
            <option value="this_year">This Year</option>
            <option value="all_time">All Time</option>
          </select>
          <div className="flex gap-1">
            <button onClick={() => handleExport('csv')} className="px-3 py-2 text-xs font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200">CSV</button>
            <button onClick={() => handleExport('excel')} className="px-3 py-2 text-xs font-medium text-green-600 bg-green-50 rounded-lg hover:bg-green-100">Excel</button>
            <button onClick={() => handleExport('pdf')} className="px-3 py-2 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100">PDF</button>
          </div>
        </div>
      </div>

      {/* Report Type Selector */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {reports.map(r => (
          <button
            key={r.key}
            onClick={() => setActiveReport(r.key)}
            className={`p-4 rounded-xl border text-left transition-all ${activeReport === r.key ? 'border-green-500 bg-green-50' : 'border-thb-border hover:border-green-300 hover:bg-slate-50'}`}
          >
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-2 ${activeReport === r.key ? 'bg-green-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
              {r.icon}
            </div>
            <p className="text-sm font-semibold text-thb-text-primary">{r.label}</p>
            <p className="text-xs text-thb-text-secondary mt-0.5 line-clamp-2">{r.description}</p>
          </button>
        ))}
      </div>

      {/* Report Content */}
      <div className="thb-card p-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <FiRefreshCw className="w-6 h-6 text-green-500 animate-spin" />
            <span className="ml-2 text-sm text-thb-text-secondary">Loading report data...</span>
          </div>
        ) : !reportData || totalEmployees === 0 ? (
          <div className="text-center py-12">
            <FiUsers className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">No data available</p>
            <p className="text-xs text-slate-400 mt-1">Report data will appear here when employees are added</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-lg font-semibold text-thb-text-primary">{activeReportData?.label}</h2>
              <span className="text-xs text-thb-text-secondary">({dateRange.replace('_', ' ')})</span>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <p className="text-xs text-thb-text-secondary">Total</p>
                <p className="text-xl font-bold text-thb-text-primary">{totalEmployees}</p>
              </div>
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                <p className="text-xs text-emerald-600">Active</p>
                <p className="text-xl font-bold text-emerald-700">{activeEmployees}</p>
              </div>
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
                <p className="text-xs text-amber-600">On Probation</p>
                <p className="text-xl font-bold text-amber-700">{probationEmployees}</p>
              </div>
              <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
                <p className="text-xs text-blue-600">Departments</p>
                <p className="text-xl font-bold text-blue-700">{stats.departments || 0}</p>
              </div>
            </div>

            {/* Data Table */}
            {rows.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      {Object.keys(rows[0]).slice(0, 6).map(key => (
                        <th key={key} className="text-left px-4 py-2 font-semibold text-slate-600 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.slice(0, 20).map((row: any, i: number) => (
                      <tr key={i} className="hover:bg-slate-50">
                        {Object.values(row).slice(0, 6).map((val: any, j: number) => (
                          <td key={j} className="px-4 py-2 text-slate-700">{typeof val === 'object' ? JSON.stringify(val) : String(val || '—')}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {rows.length > 20 && <p className="text-xs text-thb-text-secondary mt-2 text-center">Showing 20 of {rows.length} rows. Export for full data.</p>}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
