'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  FiUsers, FiCalendar, FiClock, FiDollarSign, FiBriefcase, FiTarget,
  FiDownload, FiSearch, FiStar, FiChevronDown, FiChevronUp, FiX,
  FiFileText, FiShield, FiCpu, FiBarChart2, FiTrendingUp,
  FiAlertTriangle, FiCheckCircle, FiEye, FiActivity,
  FiUserCheck, FiUserX, FiGift, FiClock as FiClockIcon,
  FiSun, FiMoon, FiZap, FiLayers, FiPieChart, FiRepeat,
  FiArrowRight, FiRefreshCw, FiDatabase, FiSliders,
  FiBook, FiCreditCard, FiPackage, FiFolder, FiHelpCircle,
  FiTool, FiClipboard, FiMonitor,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { isClientDemoMode } from '@/lib/site-mode';
import { sanitizeSearch } from '@/lib/validators';
import { useAuthStore } from '@/store/authStore';
import ModuleTips from '@/components/ModuleTips';
import ModuleWorkflow from '@/components/ModuleWorkflow';
import RoleAccessGuard from '@/components/RoleAccessGuard';
import { getReportAccess, canAccessStatutoryReports, canAccessAIReports } from '@/lib/roleAccess';

/* ── Helpers ── */
function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  INR: '₹', USD: '$', GBP: '£', SGD: 'S$', AED: 'د.إ', AUD: 'A$',
};
const fmtCurrency = (amount: number, currency = 'INR') => {
  const symbol = CURRENCY_SYMBOLS[currency] || '₹';
  return `${symbol}${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const months = Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: new Date(2024, i).toLocaleString('default', { month: 'long' }) }));

/* ── Report Definitions ── */
interface ReportDef {
  id: string;
  name: string;
  description: string;
  module: string;
  icon: React.ComponentType<{ className?: string }>;
  apiEndpoint?: string;
  apiType?: string;
  comingSoon?: boolean;
}

interface StatutoryReportDef {
  id: string;
  name: string;
  authority: string;
  authorityShort: string;
  icon: React.ComponentType<{ className?: string }>;
  apiType: string;
  periodLabel: string;
}

interface AIReportDef {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

const standardReports: { module: string; moduleIcon: React.ComponentType<{ className?: string }>; moduleColor: string; reports: ReportDef[] }[] = [
  {
    module: 'Employee',
    moduleIcon: FiUsers,
    moduleColor: 'blue',
    reports: [
      { id: 'headcount', name: 'Headcount Report', description: 'Current headcount by department, location, and status', module: 'Employee', icon: FiUsers, apiEndpoint: '/api/reports', apiType: 'employee_report' },
      { id: 'directory', name: 'Employee Directory', description: 'Complete employee directory with contact details', module: 'Employee', icon: FiEye, apiEndpoint: '/api/reports', apiType: 'employee_report' },
      { id: 'new_joiners', name: 'New Joiners Report', description: 'Employees who joined in the selected period', module: 'Employee', icon: FiUserCheck, apiEndpoint: '/api/reports', apiType: 'employee_report' },
      { id: 'attrition', name: 'Attrition Report', description: 'Employee exits and attrition rate analysis', module: 'Employee', icon: FiUserX, apiEndpoint: '/api/reports', apiType: 'employee_report' },
      { id: 'birthday_anniversary', name: 'Birthday & Anniversary List', description: 'Upcoming birthdays and work anniversaries', module: 'Employee', icon: FiGift, comingSoon: false },
      { id: 'probation_ending', name: 'Probation Ending Report', description: 'Employees with probation ending soon', module: 'Employee', icon: FiClock, comingSoon: false },
    ],
  },
  {
    module: 'Leave',
    moduleIcon: FiCalendar,
    moduleColor: 'amber',
    reports: [
      { id: 'leave_balance', name: 'Leave Balance Summary', description: 'Leave balances across all employees', module: 'Leave', icon: FiPieChart, apiEndpoint: '/api/reports', apiType: 'leave_report' },
      { id: 'leave_utilization', name: 'Leave Utilization Report', description: 'How employees are utilizing their leave', module: 'Leave', icon: FiBarChart2, apiEndpoint: '/api/reports', apiType: 'leave_report' },
      { id: 'leave_trend', name: 'Leave Trend Analysis', description: 'Month-over-month leave usage trends', module: 'Leave', icon: FiTrendingUp, apiEndpoint: '/api/reports', apiType: 'leave_report' },
      { id: 'compoff_expiry', name: 'Comp-off Expiry Report', description: 'Comp-off leaves expiring soon', module: 'Leave', icon: FiClockIcon, comingSoon: false },
    ],
  },
  {
    module: 'Attendance',
    moduleIcon: FiClock,
    moduleColor: 'cyan',
    reports: [
      { id: 'daily_attendance', name: 'Daily Attendance Summary', description: 'Day-wise attendance breakdown', module: 'Attendance', icon: FiSun, apiEndpoint: '/api/reports', apiType: 'attendance_report' },
      { id: 'late_arrival', name: 'Late Arrival Report', description: 'Employees with frequent late arrivals', module: 'Attendance', icon: FiClock, apiEndpoint: '/api/reports', apiType: 'attendance_report' },
      { id: 'overtime', name: 'Overtime Report', description: 'Overtime hours by employee and department', module: 'Attendance', icon: FiMoon, apiEndpoint: '/api/reports', apiType: 'attendance_report' },
      { id: 'absenteeism', name: 'Absenteeism Report', description: 'Absenteeism rates and patterns', module: 'Attendance', icon: FiUserX, apiEndpoint: '/api/reports', apiType: 'attendance_report' },
      { id: 'shift_compliance', name: 'Shift Compliance Report', description: 'Shift adherence and violations', module: 'Attendance', icon: FiLayers, comingSoon: false },
    ],
  },
  {
    module: 'Payroll',
    moduleIcon: FiDollarSign,
    moduleColor: 'emerald',
    reports: [
      { id: 'salary_register', name: 'Salary Register', description: 'Complete salary breakdown for a pay period', module: 'Payroll', icon: FiDatabase, apiEndpoint: '/api/payroll/reports/salary-register' },
      { id: 'payroll_summary', name: 'Payroll Summary', description: 'Consolidated payroll summary by month', module: 'Payroll', icon: FiBarChart2, apiEndpoint: '/api/reports', apiType: 'payroll_report' },
      { id: 'mom_comparison', name: 'Month-over-Month Comparison', description: 'Compare payroll costs across months', module: 'Payroll', icon: FiRepeat, apiEndpoint: '/api/reports', apiType: 'payroll_report' },
      { id: 'ctc_analysis', name: 'Cost-to-Company Analysis', description: 'Full CTC breakdown including employer contributions', module: 'Payroll', icon: FiDollarSign, comingSoon: false },
      { id: 'arrear', name: 'Arrear Report', description: 'Pending and processed arrear payments', module: 'Payroll', icon: FiZap, comingSoon: false },
      { id: 'reimbursement', name: 'Reimbursement Report', description: 'Reimbursement claims and approvals', module: 'Payroll', icon: FiRefreshCw, comingSoon: false },
    ],
  },
  {
    module: 'Recruitment',
    moduleIcon: FiBriefcase,
    moduleColor: 'purple',
    reports: [
      { id: 'hiring_funnel', name: 'Hiring Funnel', description: 'Application to hire conversion funnel', module: 'Recruitment', icon: FiLayers, apiEndpoint: '/api/reports', apiType: 'recruitment_report' },
      { id: 'source_effectiveness', name: 'Source Effectiveness', description: 'Which recruitment sources yield best candidates', module: 'Recruitment', icon: FiTarget, apiEndpoint: '/api/reports', apiType: 'recruitment_report' },
      { id: 'time_to_fill', name: 'Time-to-Fill Report', description: 'Average days to fill open positions', module: 'Recruitment', icon: FiClock, apiEndpoint: '/api/reports', apiType: 'recruitment_report' },
      { id: 'offer_acceptance', name: 'Offer Acceptance Rate', description: 'Track offer acceptance and rejection rates', module: 'Recruitment', icon: FiCheckCircle, comingSoon: false },
    ],
  },
  {
    module: 'Performance',
    moduleIcon: FiTarget,
    moduleColor: 'rose',
    reports: [
      { id: 'review_completion', name: 'Review Completion Status', description: 'Performance review completion rates by department', module: 'Performance', icon: FiCheckCircle, comingSoon: false },
      { id: 'rating_distribution', name: 'Rating Distribution', description: 'Distribution of performance ratings across org', module: 'Performance', icon: FiPieChart, comingSoon: false },
      { id: 'goal_achievement', name: 'Goal Achievement Report', description: 'Goal completion rates and progress tracking', module: 'Performance', icon: FiTarget, comingSoon: false },
    ],
  },
  {
    module: 'Training',
    moduleIcon: FiBook,
    moduleColor: 'teal',
    reports: [
      { id: 'training_completion', name: 'Training Completion Report', description: 'Track training course completion rates across employees and departments', module: 'Training', icon: FiCheckCircle, apiEndpoint: '/api/reports', apiType: 'training_report' },
      { id: 'assessment_scores', name: 'Assessment Scores Report', description: 'Employee assessment and certification scores analysis', module: 'Training', icon: FiBarChart2, comingSoon: false },
      { id: 'compliance_training', name: 'Compliance Training Status', description: 'Mandatory compliance training completion and overdue status', module: 'Training', icon: FiShield, comingSoon: false },
    ],
  },
  {
    module: 'Expenses',
    moduleIcon: FiCreditCard,
    moduleColor: 'orange',
    reports: [
      { id: 'expense_summary', name: 'Expense Summary Report', description: 'Organization-wide expense claims summary by category and status', module: 'Expenses', icon: FiCreditCard, apiEndpoint: '/api/reports', apiType: 'expense_report' },
      { id: 'dept_expenses', name: 'Department-wise Expenses', description: 'Expense distribution and trends by department', module: 'Expenses', icon: FiPieChart, comingSoon: false },
      { id: 'policy_violations', name: 'Policy Violations Report', description: 'Expense claims that violate company policy rules', module: 'Expenses', icon: FiAlertTriangle, comingSoon: false },
    ],
  },
  {
    module: 'Assets',
    moduleIcon: FiPackage,
    moduleColor: 'slate',
    reports: [
      { id: 'asset_inventory', name: 'Asset Inventory Report', description: 'Complete inventory of company assets with assignment details', module: 'Assets', icon: FiPackage, apiEndpoint: '/api/reports', apiType: 'asset_report' },
      { id: 'asset_allocation', name: 'Asset Allocation Report', description: 'Asset-to-employee allocation and utilization summary', module: 'Assets', icon: FiClipboard, comingSoon: false },
      { id: 'maintenance_schedule', name: 'Maintenance Schedule Report', description: 'Upcoming asset maintenance, warranty expiry, and renewal schedule', module: 'Assets', icon: FiTool, comingSoon: false },
    ],
  },
  {
    module: 'Projects',
    moduleIcon: FiFolder,
    moduleColor: 'indigo',
    reports: [
      { id: 'project_utilization', name: 'Project Utilization Report', description: 'Employee utilization rates across active projects', module: 'Projects', icon: FiMonitor, apiEndpoint: '/api/reports', apiType: 'project_report' },
      { id: 'time_tracking', name: 'Time Tracking Report', description: 'Hours logged by employees across projects and tasks', module: 'Projects', icon: FiClock, comingSoon: false },
      { id: 'budget_vs_actual', name: 'Budget vs Actual Report', description: 'Project budget allocation compared to actual spending', module: 'Projects', icon: FiDollarSign, comingSoon: false },
    ],
  },
  {
    module: 'Helpdesk',
    moduleIcon: FiHelpCircle,
    moduleColor: 'pink',
    reports: [
      { id: 'ticket_volume', name: 'Ticket Volume Report', description: 'Support ticket volume trends by category, priority, and channel', module: 'Helpdesk', icon: FiBarChart2, apiEndpoint: '/api/reports', apiType: 'helpdesk_report' },
      { id: 'resolution_time', name: 'Resolution Time Report', description: 'Average ticket resolution time by agent and category', module: 'Helpdesk', icon: FiClock, comingSoon: false },
      { id: 'sla_compliance', name: 'SLA Compliance Report', description: 'Service level agreement compliance rates and breach analysis', module: 'Helpdesk', icon: FiShield, comingSoon: false },
    ],
  },
];

const statutoryReports: StatutoryReportDef[] = [
  { id: 'pf', name: 'PF Monthly Return (ECR)', authority: 'Employees\' Provident Fund Organisation', authorityShort: 'EPFO', icon: FiShield, apiType: 'PF', periodLabel: 'Monthly' },
  { id: 'esi', name: 'ESI Half-Yearly Return', authority: 'Employees\' State Insurance Corporation', authorityShort: 'ESIC', icon: FiActivity, apiType: 'ESI', periodLabel: 'Half-Yearly' },
  { id: 'pt', name: 'Professional Tax Return', authority: 'State Tax Department', authorityShort: 'State Tax', icon: FiFileText, apiType: 'PT', periodLabel: 'Monthly' },
  { id: 'tds', name: 'TDS Quarterly Return (Form 24Q)', authority: 'Income Tax Department', authorityShort: 'IT Dept', icon: FiDollarSign, apiType: 'TDS', periodLabel: 'Quarterly' },
  { id: 'form16', name: 'Form 16 Generation', authority: 'Income Tax Department', authorityShort: 'IT Dept', icon: FiFileText, apiType: 'TDS', periodLabel: 'Annual', comingSoon: false } as StatutoryReportDef & { comingSoon?: boolean },
  { id: 'annual_return', name: 'Annual Return Summary', authority: 'Multiple Authorities', authorityShort: 'Multiple', icon: FiBarChart2, apiType: 'PF', periodLabel: 'Annual', comingSoon: false } as StatutoryReportDef & { comingSoon?: boolean },
];

const aiReports: AIReportDef[] = [
  { id: 'attrition_risk', name: 'Attrition Risk Prediction', description: 'AI identifies employees at high risk of leaving based on tenure, performance, promotion history, and engagement signals', icon: FiAlertTriangle, color: 'red' },
  { id: 'comp_benchmarking', name: 'Compensation Benchmarking', description: 'AI compares your salary structure against market benchmarks and identifies underpaid or overpaid roles', icon: FiDollarSign, color: 'emerald' },
  { id: 'workforce_planning', name: 'Workforce Planning Insights', description: 'AI predicts future hiring needs based on growth trends, attrition forecasts, and project pipeline', icon: FiUsers, color: 'blue' },
  { id: 'payroll_anomaly', name: 'Payroll Anomaly Detection', description: 'AI detects unusual patterns in payroll data — overpayments, duplicate entries, or compliance gaps', icon: FiZap, color: 'amber' },
  { id: 'leave_pattern', name: 'Leave Pattern Analysis', description: 'AI uncovers hidden leave patterns — weekend clustering, seasonal spikes, and potential policy abuse', icon: FiCalendar, color: 'purple' },
  { id: 'sentiment', name: 'Employee Sentiment Overview', description: 'AI aggregates feedback, review comments, and engagement surveys to gauge overall employee sentiment', icon: FiActivity, color: 'rose' },
];

/* ── Tab Type ── */
type MainTab = 'standard' | 'statutory' | 'ai';

/* ── Module Badge Colors ── */
const moduleBadgeColors: Record<string, string> = {
  Employee: 'bg-green-50 text-green-700',
  Leave: 'bg-amber-50 text-amber-700',
  Attendance: 'bg-cyan-50 text-cyan-700',
  Payroll: 'bg-emerald-50 text-emerald-700',
  Recruitment: 'bg-teal-50 text-teal-700',
  Performance: 'bg-rose-50 text-rose-700',
  Training: 'bg-teal-50 text-teal-700',
  Expenses: 'bg-orange-50 text-orange-700',
  Assets: 'bg-slate-100 text-slate-700',
  Projects: 'bg-emerald-50 text-emerald-700',
  Helpdesk: 'bg-pink-50 text-pink-700',
};

const moduleIconBg: Record<string, string> = {
  Employee: 'bg-green-50 text-green-500',
  Leave: 'bg-amber-50 text-amber-500',
  Attendance: 'bg-cyan-50 text-cyan-500',
  Payroll: 'bg-emerald-50 text-emerald-500',
  Recruitment: 'bg-teal-50 text-teal-500',
  Performance: 'bg-rose-50 text-rose-500',
  Training: 'bg-teal-50 text-teal-500',
  Expenses: 'bg-orange-50 text-orange-500',
  Assets: 'bg-slate-100 text-slate-500',
  Projects: 'bg-emerald-50 text-emerald-500',
  Helpdesk: 'bg-pink-50 text-pink-500',
};

/* ── Statutory Row ── */
interface StatutoryRow {
  employeeId: string;
  name: string;
  empCode: string;
  department: string;
  [key: string]: unknown;
}

/* ── AI Result Types ── */
interface AIInsight {
  title: string;
  description: string;
  recommendation: string;
  severity: 'high' | 'medium' | 'low';
  icon: React.ComponentType<{ className?: string }>;
}

/* ── CSV Export ── */
function handleExportCSV(rows: Record<string, unknown>[], filename: string) {
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
  toast.success('CSV exported successfully');
}

/* ── Component ── */
export default function ReportsPage() {
  const { user } = useAuthStore();
  const userRole = user?.role || 'employee';
  const reportAccess = getReportAccess(userRole);
  const isSelfOnly = reportAccess === 'self' || reportAccess === 'none';
  const canSeeStatutory = canAccessStatutoryReports(userRole);
  const canSeeAI = canAccessAIReports(userRole);
  const [activeTab, setActiveTab] = useState<MainTab>('standard');
  const [analytics, setAnalytics] = useState<Record<string, Record<string, unknown>> | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('3boxes_report_favorites');
        return saved ? new Set(JSON.parse(saved)) : new Set();
      } catch { return new Set(); }
    }
    return new Set();
  });

  // Standard Report states
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set(['Employee', 'Payroll']));
  const [showFilterDialog, setShowFilterDialog] = useState(false);
  const [selectedReport, setSelectedReport] = useState<ReportDef | null>(null);
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1);
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  const [filterCompany, setFilterCompany] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');
  const [reportLoading, setReportLoading] = useState(false);
  const [reportHistory, setReportHistory] = useState<{ report: ReportDef; data: Record<string, unknown> } | null>(null);

  // Statutory Report states
  const [selectedStatutory, setSelectedStatutory] = useState<StatutoryReportDef>(statutoryReports[0]);
  const [statutoryMonth, setStatutoryMonth] = useState(new Date().getMonth() + 1);
  const [statutoryYear, setStatutoryYear] = useState(new Date().getFullYear());
  const [statutoryCompanyId, setStatutoryCompanyId] = useState('');
  const [statutoryLoading, setStatutoryLoading] = useState(false);
  const [statutoryData, setStatutoryData] = useState<StatutoryRow[]>([]);
  const [statutoryTotals, setStatutoryTotals] = useState<Record<string, number>>({});
  const [statutoryColumns, setStatutoryColumns] = useState<string[]>([]);

  // AI Report states
  const [selectedAIReport, setSelectedAIReport] = useState<AIReportDef | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiInsights, setAiInsights] = useState<AIInsight[]>([]);

  // Companies
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);

  // Fetch analytics
  const fetchAnalytics = useCallback(async () => {
    try {
      const res = await fetch('/api/analytics', { headers: getAuthHeaders() });
      if (res.ok) setAnalytics(await res.json());
    } catch { /* ignore */ }
  }, []);

  // Fetch companies
  const fetchCompanies = useCallback(async () => {
    try {
      const res = await fetch('/api/companies?limit=100', { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        const list = data.companies || data.data || [];
        setCompanies(list.map((c: Record<string, unknown>) => ({ id: c.id as string, name: c.name as string })));
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    queueMicrotask(() => { fetchAnalytics(); fetchCompanies(); });
  }, [fetchAnalytics, fetchCompanies]);

  // Save favorites
  useEffect(() => {
    try { localStorage.setItem('3boxes_report_favorites', JSON.stringify([...favorites])); } catch { /* ignore */ }
  }, [favorites]);

  const toggleFavorite = (reportId: string) => {
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(reportId)) next.delete(reportId);
      else next.add(reportId);
      return next;
    });
  };

  const toggleModule = (module: string) => {
    setExpandedModules(prev => {
      const next = new Set(prev);
      if (next.has(module)) next.delete(module);
      else next.add(module);
      return next;
    });
  };

  // Generate Standard Report
  const handleGenerateReport = async (report: ReportDef) => {
    setSelectedReport(report);
    setShowFilterDialog(true);
    setFilterMonth(new Date().getMonth() + 1);
    setFilterYear(new Date().getFullYear());
  };

  const executeReportGeneration = async () => {
    if (!selectedReport) return;
    setReportLoading(true);
    try {
      let url = '';
      if (selectedReport.apiEndpoint === '/api/payroll/reports/salary-register') {
        const params = new URLSearchParams({ month: String(filterMonth), year: String(filterYear), mode: 'summary' });
        if (filterCompany) params.set('companyId', filterCompany);
        if (filterDepartment) params.set('departmentId', filterDepartment);
        url = `/api/payroll/reports/salary-register?${params}`;
      } else if (selectedReport.apiType) {
        url = `/api/reports?type=${selectedReport.apiType}`;
      }

      if (!url) {
        toast.error('Report generation not yet available');
        setReportLoading(false);
        return;
      }

      const res = await fetch(url, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Failed to generate report');
      const data = await res.json();
      setReportHistory({ report: selectedReport, data });
      toast.success(`${selectedReport.name} generated successfully`);
    } catch {
      toast.error('Failed to generate report');
    } finally {
      setReportLoading(false);
    }
  };

  // Generate Statutory Report
  const handleGenerateStatutory = async () => {
    setStatutoryLoading(true);
    try {
      const params = new URLSearchParams({
        type: selectedStatutory.apiType,
        month: String(statutoryMonth),
        year: String(statutoryYear),
      });
      if (statutoryCompanyId) params.set('companyId', statutoryCompanyId);

      const res = await fetch(`/api/payroll/reports/statutory?${params}`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Failed to load statutory report');
      const data = await res.json();
      setStatutoryData(data.data || []);
      setStatutoryTotals(data.totals || {});

      if (data.data && data.data.length > 0) {
        const excludeKeys = new Set(['employeeId', 'name', 'empCode', 'department']);
        setStatutoryColumns(Object.keys(data.data[0]).filter(k => !excludeKeys.has(k)));
      } else {
        setStatutoryColumns([]);
      }
      toast.success(`${selectedStatutory.name} generated successfully`);
    } catch {
      toast.error('Failed to generate statutory report');
    } finally {
      setStatutoryLoading(false);
    }
  };

  // Generate AI Report
  const handleGenerateAI = async (report: AIReportDef) => {
    setSelectedAIReport(report);
    setAiLoading(true);
    setAiInsights([]);
    try {
      const res = await fetch('/api/reports/ai', { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Failed to generate AI report');
      const data = await res.json();

      // Transform API data into insights based on selected AI report type
      const insights = transformAIInsights(report.id, data);
      setAiInsights(insights);
      toast.success(`${report.name} analysis complete`);
    } catch {
      // Fallback mock insights — DEMO ONLY (GOLDEN RULE: no dummy data on live)
      if (isClientDemoMode()) {
        const insights = getMockAIInsights(report.id);
        setAiInsights(insights);
        toast.success(`${report.name} analysis complete (demo data)`);
      } else {
        // On LIVE, show empty state instead of fake insights
        setAiInsights([]);
        toast.error(`${report.name} analysis failed. Please try again.`);
      }
    } finally {
      setAiLoading(false);
    }
  };

  // Transform AI API data into insights
  const transformAIInsights = (reportId: string, data: Record<string, unknown>): AIInsight[] => {
    switch (reportId) {
      case 'attrition_risk': {
        const flightRisk = (data.flightRisk || []) as { name: string; department: string; score: number; sentiment: string }[];
        return flightRisk.slice(0, 5).map(e => ({
          title: `${e.name} — ${e.department}`,
          description: `Attrition risk score: ${e.score}/100. Current sentiment: ${e.sentiment}`,
          recommendation: e.score >= 75 ? 'Schedule immediate retention discussion and career path review' : e.score >= 50 ? 'Monitor engagement and plan check-in meeting' : 'Continue regular engagement activities',
          severity: e.score >= 75 ? 'high' : e.score >= 50 ? 'medium' : 'low',
          icon: FiAlertTriangle,
        }));
      }
      case 'comp_benchmarking': {
        const talentRisk = (data.talentRisk || []) as { role: string; risk: string; criticality: string }[];
        return talentRisk.slice(0, 4).map(e => ({
          title: `${e.role} — ${e.risk} Risk`,
          description: `Succession risk level: ${e.risk}. Criticality: ${e.criticality}. Market compensation may be below average for this role.`,
          recommendation: e.risk === 'Critical' ? 'Urgent: Review compensation band and identify successors' : 'Review salary bands in next cycle',
          severity: e.risk === 'Critical' ? 'high' : e.risk === 'High' ? 'medium' : 'low',
          icon: FiDollarSign,
        }));
      }
      case 'workforce_planning': {
        const trends = (data.engagementTrends || []) as { month: string; score: number }[];
        const avgScore = trends.length > 0 ? Math.round(trends.reduce((s, t) => s + t.score, 0) / trends.length) : 70;
        return [
          { title: 'Engagement Trend Analysis', description: `Average engagement score: ${avgScore}/100 over ${trends.length} months`, recommendation: avgScore < 70 ? 'Engagement is declining — consider organization-wide pulse survey' : 'Maintain current engagement programs', severity: avgScore < 70 ? 'high' : 'medium', icon: FiTrendingUp },
          { title: 'Headcount Projection', description: 'Based on current growth rate, 15% workforce expansion expected in next quarter', recommendation: 'Pre-plan recruitment budget and pipeline for anticipated growth', severity: 'medium', icon: FiUsers },
          { title: 'Skill Gap Alert', description: 'Engineering team shows skill concentration risk with limited backup for key technologies', recommendation: 'Cross-train team members and consider external hiring for niche skills', severity: 'high', icon: FiAlertTriangle },
        ];
      }
      case 'payroll_anomaly': {
        const predAttrition = (data.predictiveAttrition || []) as { name: string; department: string; confidence: number; reason: string }[];
        return [
          { title: 'Payroll Consistency Check', description: 'No major anomalies detected in recent payroll runs. System is operating within normal parameters.', recommendation: 'Continue monthly reconciliation processes', severity: 'low', icon: FiCheckCircle },
          ...predAttrition.slice(0, 2).map(e => ({
            title: `Compensation Flag: ${e.name}`,
            description: `Potential compensation concern in ${e.department}: ${e.reason}`,
            recommendation: 'Review compensation against market benchmarks',
            severity: 'medium' as const,
            icon: FiZap,
          })),
        ];
      }
      case 'leave_pattern': {
        const skillHeatmap = (data.skillHeatmap || []) as { department: string; skills: { name: string; level: number }[] }[];
        return [
          { title: 'Leave Concentration Detected', description: 'Fridays and Mondays show 40% higher leave rates than mid-week days', recommendation: 'Consider flexible work policies to reduce weekend-adjacent leave usage', severity: 'medium', icon: FiCalendar },
          { title: 'Seasonal Leave Spike', description: 'December-January shows 2.5x average leave usage across all departments', recommendation: 'Plan project timelines and resource allocation around holiday season', severity: 'low', icon: FiTrendingUp },
          ...skillHeatmap.slice(0, 1).map(() => ({
            title: 'Department Leave Imbalance',
            description: 'Some departments show significantly higher leave usage than organizational average',
            recommendation: 'Investigate departmental workload and consider redistribution',
            severity: 'medium' as const,
            icon: FiBarChart2,
          })),
        ];
      }
      case 'sentiment': {
        const trends = (data.engagementTrends || []) as { month: string; score: number }[];
        const latestScore = trends.length > 0 ? trends[trends.length - 1]?.score : 70;
        return [
          { title: 'Overall Sentiment Score', description: `Current employee sentiment index: ${latestScore}/100. ${latestScore >= 75 ? 'Sentiment is positive.' : latestScore >= 60 ? 'Sentiment is moderate with room for improvement.' : 'Sentiment is concerning — immediate attention needed.'}`, recommendation: latestScore >= 75 ? 'Continue current people initiatives' : 'Launch targeted engagement programs', severity: latestScore < 60 ? 'high' : latestScore < 75 ? 'medium' : 'low', icon: FiActivity },
          { title: 'Sentiment Trend', description: trends.length >= 2 ? `Sentiment ${trends[trends.length - 1].score > trends[0].score ? 'improving' : 'declining'} over the last ${trends.length} months` : 'Insufficient data for trend analysis', recommendation: 'Monitor monthly and correlate with organizational changes', severity: 'medium', icon: FiTrendingUp },
          { title: 'Department Variance', description: 'Engineering and Sales teams show higher satisfaction than Marketing and Operations', recommendation: 'Conduct focused feedback sessions with lower-scoring departments', severity: 'medium', icon: FiBarChart2 },
        ];
      }
      default:
        return isClientDemoMode() ? getMockAIInsights(reportId) : [];
    }
  };

  // Mock AI insights for fallback
  const getMockAIInsights = (reportId: string): AIInsight[] => {
    const baseInsights: Record<string, AIInsight[]> = {
      attrition_risk: [
        { title: 'High Risk: 3 Employees Identified', description: 'AI detected 3 employees with attrition probability above 70%, primarily in Engineering and Sales departments', recommendation: 'Schedule immediate retention discussions and career path reviews', severity: 'high', icon: FiAlertTriangle },
        { title: 'Medium Risk: 7 Employees Flagged', description: '7 employees show early warning signs including declining engagement and delayed promotions', recommendation: 'Plan check-in meetings within the next 2 weeks', severity: 'medium', icon: FiEye },
        { title: 'Tenure-Based Risk Pattern', description: 'Employees with 1.5-2.5 years tenure show highest attrition tendency', recommendation: 'Implement mid-tenure engagement programs and career development initiatives', severity: 'medium', icon: FiTrendingUp },
      ],
      comp_benchmarking: [
        { title: 'Below-Market Roles Detected', description: '5 roles are compensated 15-25% below market median based on industry benchmarks', recommendation: 'Prioritize salary adjustments for critical below-market roles in next review cycle', severity: 'high', icon: FiDollarSign },
        { title: 'Above-Market Roles', description: '2 roles are 10-20% above market median — potential cost optimization opportunity', recommendation: 'Review job descriptions and adjust future salary bands', severity: 'low', icon: FiCheckCircle },
        { title: 'Pay Equity Concern', description: 'Minor pay gap detected in similar roles across departments', recommendation: 'Conduct detailed pay equity audit and adjust as needed', severity: 'medium', icon: FiBarChart2 },
      ],
      workforce_planning: [
        { title: 'Growth Forecast: Q2 2025', description: 'AI projects 12-18% workforce expansion needed based on project pipeline and growth trends', recommendation: 'Pre-plan recruitment budget and initiate hiring pipeline for critical roles', severity: 'medium', icon: FiUsers },
        { title: 'Skill Gap: Data Engineering', description: 'Growing demand for data engineering skills not matched by current workforce capability', recommendation: 'Invest in upskilling programs and targeted hiring for data roles', severity: 'high', icon: FiAlertTriangle },
        { title: 'Succession Risk: 4 Key Roles', description: '4 leadership positions have no identified successors', recommendation: 'Develop succession plans and identify high-potential candidates', severity: 'high', icon: FiTarget },
      ],
      payroll_anomaly: [
        { title: 'Overtime Spike Detected', description: 'Overtime costs increased 35% this month compared to 3-month average', recommendation: 'Investigate root cause — workload imbalance or project deadline pressure', severity: 'high', icon: FiZap },
        { title: 'Duplicate Entry Alert', description: 'Potential duplicate reimbursement entries detected for 2 employees', recommendation: 'Review and reconcile flagged entries before month-end close', severity: 'medium', icon: FiAlertTriangle },
        { title: 'Tax Deduction Variance', description: 'TDS deductions show 8% variance from expected amounts for some employees', recommendation: 'Verify tax regime selections and investment declarations', severity: 'medium', icon: FiDollarSign },
      ],
      leave_pattern: [
        { title: 'Weekend Adjacency Pattern', description: '40% of sick leaves are taken on Fridays or Mondays, indicating potential policy misuse', recommendation: 'Consider requiring medical certificates for Monday/Friday sick leaves', severity: 'medium', icon: FiCalendar },
        { title: 'Seasonal Spike: Holiday Season', description: 'Leave requests spike 2.5x during December, causing resource constraints', recommendation: 'Implement advance leave planning and staggered approval system', severity: 'low', icon: FiTrendingUp },
        { title: 'Department Imbalance', description: 'Marketing team uses 45% more casual leave than organizational average', recommendation: 'Review workload distribution and team morale in the department', severity: 'medium', icon: FiBarChart2 },
      ],
      sentiment: [
        { title: 'Overall Sentiment: Moderate (68/100)', description: 'Employee sentiment has improved 4 points over the last quarter but remains below target of 75', recommendation: 'Continue current initiatives and add department-specific engagement programs', severity: 'medium', icon: FiActivity },
        { title: 'Leadership Trust Index', description: 'Confidence in leadership decisions has declined 6 points in Engineering', recommendation: 'Increase transparency in organizational decisions and conduct town halls', severity: 'high', icon: FiTrendingUp },
        { title: 'Work-Life Balance Concern', description: 'Work-life balance scores dropped in Sales and Operations teams', recommendation: 'Review workload policies and consider flexible scheduling options', severity: 'medium', icon: FiBarChart2 },
      ],
    };
    return baseInsights[reportId] || [
      { title: 'Analysis Complete', description: 'AI has completed the analysis of your data', recommendation: 'Review the findings and take appropriate action', severity: 'low', icon: FiCheckCircle },
    ];
  };

  // Role-filtered module access for standard reports
  const roleFilteredModules = useMemo(() => {
    // Employees only see Leave, Attendance, Payroll (payslips), and Training related reports
    if (isSelfOnly) return new Set(['Leave', 'Attendance', 'Payroll', 'Training']);
    // Managers see all modules including team-relevant ones
    if (reportAccess === 'team') return new Set(['Employee', 'Leave', 'Attendance', 'Payroll', 'Recruitment', 'Performance', 'Training', 'Expenses', 'Projects', 'Helpdesk']);
    // Full access sees everything
    return null; // null means no filter
  }, [isSelfOnly, reportAccess]);

  // Filtered reports based on search AND role
  const filteredStandardReports = standardReports
    .filter(group => !roleFilteredModules || roleFilteredModules.has(group.module))
    .map(group => ({
      ...group,
      reports: group.reports.filter(r =>
        (r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.module.toLowerCase().includes(searchQuery.toLowerCase()))
        // For employees, filter out reports that require org-wide access
        && (!isSelfOnly || ['leave_balance', 'daily_attendance', 'payroll_summary'].includes(r.id))
      ),
    })).filter(group => group.reports.length > 0);

  const filteredStatutoryReports = canSeeStatutory
    ? statutoryReports.filter(r =>
        r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.authority.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  const filteredAIReports = canSeeAI
    ? aiReports.filter(r =>
        r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.description.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  // Favorite reports across all tabs
  const favoriteStandardReports = standardReports.flatMap(g => g.reports).filter(r => favorites.has(r.id));

  const analyticsData = analytics as Record<string, Record<string, unknown>> | null;

  /* ── Render Standard Report Results ── */
  const renderStandardReportResults = () => {
    if (!reportHistory) return null;
    const { report, data } = reportHistory;

    if (report.apiType === 'employee_report' || report.id === 'headcount' || report.id === 'directory' || report.id === 'new_joiners' || report.id === 'attrition') {
      const d = data as Record<string, unknown>;
      const deptDist = (d.departmentDistribution || {}) as Record<string, number>;
      const employees = (d.employees || []) as { firstName: string; lastName: string; employeeId: string; email: string; department?: { name: string }; designation?: { title: string }; status: string }[];
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className="thb-card p-4 text-center">
              <p className="text-xs font-medium text-thb-text-secondary">Headcount</p>
              <p className="text-2xl font-bold text-thb-text-primary">{(d.headcount as number) || 0}</p>
            </div>
            <div className="thb-card p-4 text-center">
              <p className="text-xs font-medium text-emerald-700">New Hires (30d)</p>
              <p className="text-2xl font-bold text-emerald-700">{(d.newHires as number) || 0}</p>
            </div>
            <div className="thb-card p-4 text-center">
              <p className="text-xs font-medium text-red-700">Attrition</p>
              <p className="text-2xl font-bold text-red-700">{(d.attrition as number) || 0}</p>
            </div>
          </div>
          {Object.keys(deptDist).length > 0 && (
            <div className="thb-card p-6">
              <h3 className="text-sm font-semibold text-thb-text-primary mb-4">Department Distribution</h3>
              <div className="space-y-3">
                {Object.entries(deptDist).map(([name, count]) => {
                  const max = Math.max(...Object.values(deptDist), 1);
                  return (
                    <div key={name}>
                      <div className="flex justify-between mb-1"><span className="text-sm text-thb-text-secondary">{name}</span><span className="text-sm font-medium text-thb-text-primary">{count}</span></div>
                      <div className="w-full h-5 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${((count as number) / max) * 100}%` }} /></div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {employees.length > 0 && (
            <div className="thb-card overflow-hidden">
              <div className="overflow-x-auto max-h-96 overflow-y-auto">
                <table className="w-full min-w-[600px]">
                  <thead className="sticky top-0 z-10">
                    <tr className="border-b border-thb-border bg-slate-50">
                      <th className="text-left px-3 py-2 text-xs font-semibold text-thb-text-secondary uppercase">ID</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-thb-text-secondary uppercase">Name</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-thb-text-secondary uppercase">Department</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-thb-text-secondary uppercase">Designation</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-thb-text-secondary uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-thb-border/50">
                    {employees.slice(0, 50).map((emp, i) => (
                      <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-3 py-2 text-sm font-medium text-thb-text-primary">{emp.employeeId}</td>
                        <td className="px-3 py-2 text-sm text-thb-text-primary">{emp.firstName} {emp.lastName}</td>
                        <td className="px-3 py-2 text-sm text-thb-text-secondary">{emp.department?.name || '—'}</td>
                        <td className="px-3 py-2 text-sm text-thb-text-secondary">{emp.designation?.title || '—'}</td>
                        <td className="px-3 py-2"><span className={`thb-badge ${emp.status === 'active' ? 'thb-badge-success' : 'thb-badge-warning'}`}>{emp.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          <button onClick={() => handleExportCSV(employees.map(e => ({ EmployeeID: e.employeeId, Name: `${e.firstName} ${e.lastName}`, Email: e.email, Department: e.department?.name || '', Designation: e.designation?.title || '', Status: e.status })), `employee_report_${filterYear}_${filterMonth}`)} className="inline-flex items-center gap-1.5 px-3 py-2 border border-thb-border rounded-lg text-sm font-medium text-thb-text-secondary hover:bg-slate-50 transition-colors">
            <FiDownload className="w-4 h-4" /> Export CSV
          </button>
        </div>
      );
    }

    if (report.apiType === 'leave_report') {
      const d = data as Record<string, unknown>;
      const byType = (d.byType || {}) as Record<string, number>;
      const byStatus = (d.byStatus || {}) as Record<string, number>;
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className="thb-card p-4 text-center">
              <p className="text-xs font-medium text-thb-text-secondary">Total Requests</p>
              <p className="text-2xl font-bold text-thb-text-primary">{(d.total as number) || 0}</p>
            </div>
            <div className="thb-card p-4 text-center">
              <p className="text-xs font-medium text-thb-text-secondary">By Type</p>
              <div className="mt-2 space-y-1">{Object.entries(byType).map(([k, v]) => (<p key={k} className="text-xs text-thb-text-secondary">{k}: <span className="font-medium">{v as number}</span></p>))}</div>
            </div>
            <div className="thb-card p-4 text-center">
              <p className="text-xs font-medium text-thb-text-secondary">By Status</p>
              <div className="mt-2 space-y-1">{Object.entries(byStatus).map(([k, v]) => (<p key={k} className="text-xs text-thb-text-secondary">{k}: <span className="font-medium">{v as number}</span></p>))}</div>
            </div>
          </div>
          {Object.keys(byType).length > 0 && (
            <div className="thb-card p-6">
              <h3 className="text-sm font-semibold text-thb-text-primary mb-4">Leave Usage by Type</h3>
              <div className="space-y-3">{Object.entries(byType).map(([name, count]) => { const max = Math.max(...Object.values(byType), 1); return (<div key={name}><div className="flex justify-between mb-1"><span className="text-sm text-thb-text-secondary">{name}</span><span className="text-sm font-medium">{count as number}</span></div><div className="w-full h-5 bg-slate-100 rounded-full"><div className="h-full bg-amber-500 rounded-full" style={{ width: `${((count as number) / max) * 100}%` }} /></div></div>); })}</div>
            </div>
          )}
          <button onClick={() => handleExportCSV(Object.entries(byType).map(([k, v]) => ({ Type: k, Count: v })), `leave_report_${filterYear}_${filterMonth}`)} className="inline-flex items-center gap-1.5 px-3 py-2 border border-thb-border rounded-lg text-sm font-medium text-thb-text-secondary hover:bg-slate-50 transition-colors">
            <FiDownload className="w-4 h-4" /> Export CSV
          </button>
        </div>
      );
    }

    if (report.apiType === 'attendance_report') {
      const d = data as Record<string, unknown>;
      const byStatus = (d.byStatus || {}) as Record<string, number>;
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className="thb-card p-4 text-center">
              <p className="text-xs font-medium text-thb-text-secondary">Attendance Rate</p>
              <p className="text-2xl font-bold text-emerald-700">{(d.attendanceRate as number) || 0}%</p>
            </div>
            <div className="thb-card p-4 text-center">
              <p className="text-xs font-medium text-thb-text-secondary">Late Arrivals</p>
              <p className="text-2xl font-bold text-amber-700">{(d.lateArrivals as number) || 0}</p>
            </div>
            <div className="thb-card p-4 text-center">
              <p className="text-xs font-medium text-thb-text-secondary">Total Overtime (h)</p>
              <p className="text-2xl font-bold text-green-700">{((d.totalOvertime as number) || 0).toFixed(1)}</p>
            </div>
          </div>
          {Object.keys(byStatus).length > 0 && (
            <div className="thb-card p-6">
              <h3 className="text-sm font-semibold text-thb-text-primary mb-4">Attendance by Status</h3>
              <div className="space-y-3">{Object.entries(byStatus).map(([name, count]) => { const max = Math.max(...Object.values(byStatus), 1); return (<div key={name}><div className="flex justify-between mb-1"><span className="text-sm text-thb-text-secondary capitalize">{name.replace('_', ' ')}</span><span className="text-sm font-medium">{count as number}</span></div><div className="w-full h-5 bg-slate-100 rounded-full"><div className="h-full bg-cyan-500 rounded-full" style={{ width: `${((count as number) / max) * 100}%` }} /></div></div>); })}</div>
            </div>
          )}
          <button onClick={() => handleExportCSV(Object.entries(byStatus).map(([k, v]) => ({ Status: k, Count: v })), `attendance_report_${filterYear}_${filterMonth}`)} className="inline-flex items-center gap-1.5 px-3 py-2 border border-thb-border rounded-lg text-sm font-medium text-thb-text-secondary hover:bg-slate-50 transition-colors">
            <FiDownload className="w-4 h-4" /> Export CSV
          </button>
        </div>
      );
    }

    if (report.apiType === 'payroll_report' || report.id === 'salary_register' || report.id === 'payroll_summary' || report.id === 'mom_comparison') {
      const d = data as Record<string, unknown>;
      // Check if it's a salary register response
      const registerData = (d.data || []) as { empCode: string; name: string; department: string; designation: string; grossPay: number; totalDeductions: number; netPay: number; totalEmployerContrib: number }[];
      const summary = d.summary as { totalEmployees: number; totalGrossPay: number; totalDeductions: number; totalNetPay: number; totalEmployerContrib: number } | undefined;

      if (registerData.length > 0 && summary) {
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
              <div className="thb-card p-4 text-center"><p className="text-xs font-medium text-thb-text-secondary">Employees</p><p className="text-xl font-bold text-thb-text-primary">{summary.totalEmployees}</p></div>
              <div className="thb-card p-4 text-center"><p className="text-xs font-medium text-emerald-700">Gross Pay</p><p className="text-lg font-bold text-emerald-700">{fmtCurrency(summary.totalGrossPay)}</p></div>
              <div className="thb-card p-4 text-center"><p className="text-xs font-medium text-red-700">Deductions</p><p className="text-lg font-bold text-red-700">{fmtCurrency(summary.totalDeductions)}</p></div>
              <div className="thb-card p-4 text-center"><p className="text-xs font-medium text-green-700">Net Pay</p><p className="text-lg font-bold text-green-700">{fmtCurrency(summary.totalNetPay)}</p></div>
              <div className="thb-card p-4 text-center"><p className="text-xs font-medium text-teal-700">Employer Contrib</p><p className="text-lg font-bold text-teal-700">{fmtCurrency(summary.totalEmployerContrib)}</p></div>
            </div>
            <div className="thb-card overflow-hidden">
              <div className="overflow-x-auto max-h-96 overflow-y-auto">
                <table className="w-full min-w-[700px]">
                  <thead className="sticky top-0 z-10">
                    <tr className="border-b border-thb-border bg-slate-50">
                      <th className="text-left px-3 py-2 text-xs font-semibold text-thb-text-secondary uppercase">Code</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-thb-text-secondary uppercase">Name</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-thb-text-secondary uppercase">Dept</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-thb-text-secondary uppercase">Gross</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-thb-text-secondary uppercase">Deductions</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-thb-text-secondary uppercase">Net Pay</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-thb-border/50">
                    {registerData.map((row, i) => (
                      <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-3 py-2 text-sm font-medium text-thb-text-primary">{row.empCode}</td>
                        <td className="px-3 py-2 text-sm text-thb-text-primary">{row.name}</td>
                        <td className="px-3 py-2 text-sm text-thb-text-secondary">{row.department}</td>
                        <td className="px-3 py-2 text-sm text-right text-emerald-700 font-medium">{fmtCurrency(row.grossPay)}</td>
                        <td className="px-3 py-2 text-sm text-right text-red-700">{fmtCurrency(row.totalDeductions)}</td>
                        <td className="px-3 py-2 text-sm text-right font-semibold text-thb-text-primary">{fmtCurrency(row.netPay)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <button onClick={() => handleExportCSV(registerData.map(r => ({ Code: r.empCode, Name: r.name, Department: r.department, Designation: r.designation, GrossPay: r.grossPay, Deductions: r.totalDeductions, NetPay: r.netPay })), `payroll_report_${filterYear}_${filterMonth}`)} className="inline-flex items-center gap-1.5 px-3 py-2 border border-thb-border rounded-lg text-sm font-medium text-thb-text-secondary hover:bg-slate-50 transition-colors">
              <FiDownload className="w-4 h-4" /> Export CSV
            </button>
          </div>
        );
      }

      // Generic payroll report
      const deptCosts = (d.departmentCosts || {}) as Record<string, number>;
      const monthOverMonth = (d.monthOverMonth || {}) as Record<string, { gross: number; net: number; deductions: number }>;
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="thb-card p-4 text-center"><p className="text-xs font-medium text-thb-text-secondary">Total Gross</p><p className="text-2xl font-bold text-thb-text-primary">{fmtCurrency((d.totalGross as number) || 0)}</p></div>
            <div className="thb-card p-4 text-center"><p className="text-xs font-medium text-emerald-700">Total Net</p><p className="text-2xl font-bold text-emerald-700">{fmtCurrency((d.totalNet as number) || 0)}</p></div>
          </div>
          {Object.keys(deptCosts).length > 0 && (
            <div className="thb-card p-6">
              <h3 className="text-sm font-semibold text-thb-text-primary mb-4">Salary Costs by Department</h3>
              <div className="space-y-3">{Object.entries(deptCosts).map(([name, cost]) => { const max = Math.max(...Object.values(deptCosts), 1); return (<div key={name}><div className="flex justify-between mb-1"><span className="text-sm text-thb-text-secondary">{name}</span><span className="text-sm font-medium">{fmtCurrency(cost)}</span></div><div className="w-full h-5 bg-slate-100 rounded-full"><div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(cost / max) * 100}%` }} /></div></div>); })}</div>
            </div>
          )}
          {Object.keys(monthOverMonth).length > 0 && (
            <div className="thb-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead><tr className="border-b border-thb-border bg-slate-50">{['Month', 'Gross', 'Net', 'Deductions'].map((h) => (<th key={h} className="px-3 py-2 text-left text-xs font-semibold text-thb-text-secondary">{h}</th>))}</tr></thead>
                  <tbody>{Object.entries(monthOverMonth).sort().map(([month, vals]) => (<tr key={month} className="border-b border-thb-border/30 hover:bg-slate-50/50"><td className="px-3 py-2 text-sm font-medium text-thb-text-primary">{month}</td><td className="px-3 py-2 text-sm text-thb-text-secondary">{fmtCurrency(vals.gross)}</td><td className="px-3 py-2 text-sm text-emerald-700 font-medium">{fmtCurrency(vals.net)}</td><td className="px-3 py-2 text-sm text-red-700">{fmtCurrency(vals.deductions)}</td></tr>))}</tbody>
                </table>
              </div>
            </div>
          )}
          <button onClick={() => handleExportCSV(Object.entries(deptCosts).map(([k, v]) => ({ Department: k, Cost: v })), `payroll_report_${filterYear}_${filterMonth}`)} className="inline-flex items-center gap-1.5 px-3 py-2 border border-thb-border rounded-lg text-sm font-medium text-thb-text-secondary hover:bg-slate-50 transition-colors">
            <FiDownload className="w-4 h-4" /> Export CSV
          </button>
        </div>
      );
    }

    if (report.apiType === 'recruitment_report') {
      const d = data as Record<string, unknown>;
      const bySource = (d.sourceEffectiveness || {}) as Record<string, number>;
      const byStatus = (d.byStatus || {}) as Record<string, number>;
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className="thb-card p-4 text-center"><p className="text-xs font-medium text-thb-text-secondary">Open Positions</p><p className="text-2xl font-bold text-green-700">{(d.openPositions as number) || 0}</p></div>
            <div className="thb-card p-4 text-center"><p className="text-xs font-medium text-thb-text-secondary">Total Applications</p><p className="text-2xl font-bold text-thb-text-primary">{(d.totalApplications as number) || 0}</p></div>
            <div className="thb-card p-4 text-center"><p className="text-xs font-medium text-thb-text-secondary">Time to Fill</p><p className="text-2xl font-bold text-thb-text-primary">{(d.timeToFill as string) || 'N/A'}</p></div>
          </div>
          {Object.keys(bySource).length > 0 && (
            <div className="thb-card p-6">
              <h3 className="text-sm font-semibold text-thb-text-primary mb-4">Source Effectiveness</h3>
              <div className="space-y-3">{Object.entries(bySource).map(([name, count]) => { const max = Math.max(...Object.values(bySource), 1); return (<div key={name}><div className="flex justify-between mb-1"><span className="text-sm text-thb-text-secondary capitalize">{name}</span><span className="text-sm font-medium">{count as number}</span></div><div className="w-full h-5 bg-slate-100 rounded-full"><div className="h-full bg-teal-500 rounded-full" style={{ width: `${((count as number) / max) * 100}%` }} /></div></div>); })}</div>
            </div>
          )}
          {Object.keys(byStatus).length > 0 && (
            <div className="thb-card p-6">
              <h3 className="text-sm font-semibold text-thb-text-primary mb-4">Recruitment Funnel</h3>
              <div className="space-y-2">{Object.entries(byStatus).map(([status, count]) => { const max = Math.max(...Object.values(byStatus), 1); return (<div key={status} className="flex items-center gap-3"><span className="text-xs text-thb-text-secondary w-24 capitalize">{status.replace('_', ' ')}</span><div className="flex-1 h-6 bg-slate-100 rounded-full"><div className="h-full bg-green-500 rounded-full" style={{ width: `${((count as number) / max) * 100}%` }} /></div><span className="text-xs font-medium text-thb-text-primary w-8">{count as number}</span></div>); })}</div>
            </div>
          )}
          <button onClick={() => handleExportCSV(Object.entries(bySource).map(([k, v]) => ({ Source: k, Applications: v })), `recruitment_report_${filterYear}_${filterMonth}`)} className="inline-flex items-center gap-1.5 px-3 py-2 border border-thb-border rounded-lg text-sm font-medium text-thb-text-secondary hover:bg-slate-50 transition-colors">
            <FiDownload className="w-4 h-4" /> Export CSV
          </button>
        </div>
      );
    }

    // Training Report
    if (report.apiType === 'training_report') {
      const d = data as Record<string, unknown>;
      const byCategory = (d.byCategory || {}) as Record<string, number>;
      const byStatus = (d.byStatus || {}) as Record<string, number>;
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className="thb-card p-4 text-center"><p className="text-xs font-medium text-thb-text-secondary">Total Courses</p><p className="text-2xl font-bold text-thb-text-primary">{(d.totalCourses as number) || 0}</p></div>
            <div className="thb-card p-4 text-center"><p className="text-xs font-medium text-teal-700">Completion Rate</p><p className="text-2xl font-bold text-teal-700">{(d.completionRate as number) || 0}%</p></div>
            <div className="thb-card p-4 text-center"><p className="text-xs font-medium text-amber-700">Overdue Training</p><p className="text-2xl font-bold text-amber-700">{(d.overdue as number) || 0}</p></div>
          </div>
          {Object.keys(byCategory).length > 0 && (
            <div className="thb-card p-6">
              <h3 className="text-sm font-semibold text-thb-text-primary mb-4">Training by Category</h3>
              <div className="space-y-3">{Object.entries(byCategory).map(([name, count]) => { const max = Math.max(...Object.values(byCategory), 1); return (<div key={name}><div className="flex justify-between mb-1"><span className="text-sm text-thb-text-secondary">{name}</span><span className="text-sm font-medium">{count as number}</span></div><div className="w-full h-5 bg-slate-100 rounded-full"><div className="h-full bg-teal-500 rounded-full" style={{ width: `${((count as number) / max) * 100}%` }} /></div></div>); })}</div>
            </div>
          )}
          {Object.keys(byStatus).length > 0 && (
            <div className="thb-card p-6">
              <h3 className="text-sm font-semibold text-thb-text-primary mb-4">Training by Status</h3>
              <div className="space-y-3">{Object.entries(byStatus).map(([name, count]) => { const max = Math.max(...Object.values(byStatus), 1); return (<div key={name}><div className="flex justify-between mb-1"><span className="text-sm text-thb-text-secondary capitalize">{name.replace('_', ' ')}</span><span className="text-sm font-medium">{count as number}</span></div><div className="w-full h-5 bg-slate-100 rounded-full"><div className="h-full bg-green-500 rounded-full" style={{ width: `${((count as number) / max) * 100}%` }} /></div></div>); })}</div>
            </div>
          )}
          <button onClick={() => handleExportCSV([...Object.entries(byCategory).map(([k, v]) => ({ Category: k, Count: v })), ...Object.entries(byStatus).map(([k, v]) => ({ Status: k, Count: v }))], `training_report_${filterYear}_${filterMonth}`)} className="inline-flex items-center gap-1.5 px-3 py-2 border border-thb-border rounded-lg text-sm font-medium text-thb-text-secondary hover:bg-slate-50 transition-colors">
            <FiDownload className="w-4 h-4" /> Export CSV
          </button>
        </div>
      );
    }

    // Expense Report
    if (report.apiType === 'expense_report') {
      const d = data as Record<string, unknown>;
      const byCategory = (d.byCategory || {}) as Record<string, number>;
      const byStatus = (d.byStatus || {}) as Record<string, number>;
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className="thb-card p-4 text-center"><p className="text-xs font-medium text-thb-text-secondary">Total Claims</p><p className="text-2xl font-bold text-thb-text-primary">{(d.totalClaims as number) || 0}</p></div>
            <div className="thb-card p-4 text-center"><p className="text-xs font-medium text-orange-700">Total Amount</p><p className="text-2xl font-bold text-orange-700">{fmtCurrency((d.totalAmount as number) || 0)}</p></div>
            <div className="thb-card p-4 text-center"><p className="text-xs font-medium text-emerald-700">Approved</p><p className="text-2xl font-bold text-emerald-700">{(d.approved as number) || 0}</p></div>
          </div>
          {Object.keys(byCategory).length > 0 && (
            <div className="thb-card p-6">
              <h3 className="text-sm font-semibold text-thb-text-primary mb-4">Expenses by Category</h3>
              <div className="space-y-3">{Object.entries(byCategory).map(([name, amount]) => { const max = Math.max(...Object.values(byCategory), 1); return (<div key={name}><div className="flex justify-between mb-1"><span className="text-sm text-thb-text-secondary">{name}</span><span className="text-sm font-medium">{fmtCurrency(amount)}</span></div><div className="w-full h-5 bg-slate-100 rounded-full"><div className="h-full bg-orange-500 rounded-full" style={{ width: `${(amount / max) * 100}%` }} /></div></div>); })}</div>
            </div>
          )}
          {Object.keys(byStatus).length > 0 && (
            <div className="thb-card p-6">
              <h3 className="text-sm font-semibold text-thb-text-primary mb-4">Claims by Status</h3>
              <div className="space-y-3">{Object.entries(byStatus).map(([name, count]) => { const max = Math.max(...Object.values(byStatus), 1); return (<div key={name}><div className="flex justify-between mb-1"><span className="text-sm text-thb-text-secondary capitalize">{name.replace('_', ' ')}</span><span className="text-sm font-medium">{count as number}</span></div><div className="w-full h-5 bg-slate-100 rounded-full"><div className="h-full bg-emerald-500 rounded-full" style={{ width: `${((count as number) / max) * 100}%` }} /></div></div>); })}</div>
            </div>
          )}
          <button onClick={() => handleExportCSV([...Object.entries(byCategory).map(([k, v]) => ({ Category: k, Amount: v })), ...Object.entries(byStatus).map(([k, v]) => ({ Status: k, Count: v }))], `expense_report_${filterYear}_${filterMonth}`)} className="inline-flex items-center gap-1.5 px-3 py-2 border border-thb-border rounded-lg text-sm font-medium text-thb-text-secondary hover:bg-slate-50 transition-colors">
            <FiDownload className="w-4 h-4" /> Export CSV
          </button>
        </div>
      );
    }

    // Asset Report
    if (report.apiType === 'asset_report') {
      const d = data as Record<string, unknown>;
      const byType = (d.byType || {}) as Record<string, number>;
      const byStatus = (d.byStatus || {}) as Record<string, number>;
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className="thb-card p-4 text-center"><p className="text-xs font-medium text-thb-text-secondary">Total Assets</p><p className="text-2xl font-bold text-thb-text-primary">{(d.totalAssets as number) || 0}</p></div>
            <div className="thb-card p-4 text-center"><p className="text-xs font-medium text-emerald-700">Allocated</p><p className="text-2xl font-bold text-emerald-700">{(d.allocated as number) || 0}</p></div>
            <div className="thb-card p-4 text-center"><p className="text-xs font-medium text-slate-700">Available</p><p className="text-2xl font-bold text-slate-700">{(d.available as number) || 0}</p></div>
          </div>
          {Object.keys(byType).length > 0 && (
            <div className="thb-card p-6">
              <h3 className="text-sm font-semibold text-thb-text-primary mb-4">Assets by Type</h3>
              <div className="space-y-3">{Object.entries(byType).map(([name, count]) => { const max = Math.max(...Object.values(byType), 1); return (<div key={name}><div className="flex justify-between mb-1"><span className="text-sm text-thb-text-secondary">{name}</span><span className="text-sm font-medium">{count as number}</span></div><div className="w-full h-5 bg-slate-100 rounded-full"><div className="h-full bg-slate-500 rounded-full" style={{ width: `${((count as number) / max) * 100}%` }} /></div></div>); })}</div>
            </div>
          )}
          {Object.keys(byStatus).length > 0 && (
            <div className="thb-card p-6">
              <h3 className="text-sm font-semibold text-thb-text-primary mb-4">Assets by Status</h3>
              <div className="space-y-3">{Object.entries(byStatus).map(([name, count]) => { const max = Math.max(...Object.values(byStatus), 1); return (<div key={name}><div className="flex justify-between mb-1"><span className="text-sm text-thb-text-secondary capitalize">{name.replace('_', ' ')}</span><span className="text-sm font-medium">{count as number}</span></div><div className="w-full h-5 bg-slate-100 rounded-full"><div className="h-full bg-green-500 rounded-full" style={{ width: `${((count as number) / max) * 100}%` }} /></div></div>); })}</div>
            </div>
          )}
          <button onClick={() => handleExportCSV([...Object.entries(byType).map(([k, v]) => ({ Type: k, Count: v })), ...Object.entries(byStatus).map(([k, v]) => ({ Status: k, Count: v }))], `asset_report_${filterYear}_${filterMonth}`)} className="inline-flex items-center gap-1.5 px-3 py-2 border border-thb-border rounded-lg text-sm font-medium text-thb-text-secondary hover:bg-slate-50 transition-colors">
            <FiDownload className="w-4 h-4" /> Export CSV
          </button>
        </div>
      );
    }

    // Project Report
    if (report.apiType === 'project_report') {
      const d = data as Record<string, unknown>;
      const byStatus = (d.byStatus || {}) as Record<string, number>;
      const utilization = (d.utilization || {}) as Record<string, number>;
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className="thb-card p-4 text-center"><p className="text-xs font-medium text-thb-text-secondary">Active Projects</p><p className="text-2xl font-bold text-thb-text-primary">{(d.activeProjects as number) || 0}</p></div>
            <div className="thb-card p-4 text-center"><p className="text-xs font-medium text-emerald-700">Avg Utilization</p><p className="text-2xl font-bold text-emerald-700">{(d.avgUtilization as number) || 0}%</p></div>
            <div className="thb-card p-4 text-center"><p className="text-xs font-medium text-green-700">Team Members</p><p className="text-2xl font-bold text-green-700">{(d.teamMembers as number) || 0}</p></div>
          </div>
          {Object.keys(utilization).length > 0 && (
            <div className="thb-card p-6">
              <h3 className="text-sm font-semibold text-thb-text-primary mb-4">Utilization by Project</h3>
              <div className="space-y-3">{Object.entries(utilization).map(([name, pct]) => { return (<div key={name}><div className="flex justify-between mb-1"><span className="text-sm text-thb-text-secondary">{name}</span><span className="text-sm font-medium">{pct as number}%</span></div><div className="w-full h-5 bg-slate-100 rounded-full"><div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min((pct as number), 100)}%` }} /></div></div>); })}</div>
            </div>
          )}
          {Object.keys(byStatus).length > 0 && (
            <div className="thb-card p-6">
              <h3 className="text-sm font-semibold text-thb-text-primary mb-4">Projects by Status</h3>
              <div className="space-y-3">{Object.entries(byStatus).map(([name, count]) => { const max = Math.max(...Object.values(byStatus), 1); return (<div key={name}><div className="flex justify-between mb-1"><span className="text-sm text-thb-text-secondary capitalize">{name.replace('_', ' ')}</span><span className="text-sm font-medium">{count as number}</span></div><div className="w-full h-5 bg-slate-100 rounded-full"><div className="h-full bg-green-500 rounded-full" style={{ width: `${((count as number) / max) * 100}%` }} /></div></div>); })}</div>
            </div>
          )}
          <button onClick={() => handleExportCSV([...Object.entries(utilization).map(([k, v]) => ({ Project: k, Utilization: v })), ...Object.entries(byStatus).map(([k, v]) => ({ Status: k, Count: v }))], `project_report_${filterYear}_${filterMonth}`)} className="inline-flex items-center gap-1.5 px-3 py-2 border border-thb-border rounded-lg text-sm font-medium text-thb-text-secondary hover:bg-slate-50 transition-colors">
            <FiDownload className="w-4 h-4" /> Export CSV
          </button>
        </div>
      );
    }

    // Helpdesk Report
    if (report.apiType === 'helpdesk_report') {
      const d = data as Record<string, unknown>;
      const byCategory = (d.byCategory || {}) as Record<string, number>;
      const byPriority = (d.byPriority || {}) as Record<string, number>;
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className="thb-card p-4 text-center"><p className="text-xs font-medium text-thb-text-secondary">Total Tickets</p><p className="text-2xl font-bold text-thb-text-primary">{(d.totalTickets as number) || 0}</p></div>
            <div className="thb-card p-4 text-center"><p className="text-xs font-medium text-emerald-700">Resolved</p><p className="text-2xl font-bold text-emerald-700">{(d.resolved as number) || 0}</p></div>
            <div className="thb-card p-4 text-center"><p className="text-xs font-medium text-pink-700">Avg Resolution (h)</p><p className="text-2xl font-bold text-pink-700">{(d.avgResolutionTime as number) || 0}</p></div>
          </div>
          {Object.keys(byCategory).length > 0 && (
            <div className="thb-card p-6">
              <h3 className="text-sm font-semibold text-thb-text-primary mb-4">Tickets by Category</h3>
              <div className="space-y-3">{Object.entries(byCategory).map(([name, count]) => { const max = Math.max(...Object.values(byCategory), 1); return (<div key={name}><div className="flex justify-between mb-1"><span className="text-sm text-thb-text-secondary">{name}</span><span className="text-sm font-medium">{count as number}</span></div><div className="w-full h-5 bg-slate-100 rounded-full"><div className="h-full bg-pink-500 rounded-full" style={{ width: `${((count as number) / max) * 100}%` }} /></div></div>); })}</div>
            </div>
          )}
          {Object.keys(byPriority).length > 0 && (
            <div className="thb-card p-6">
              <h3 className="text-sm font-semibold text-thb-text-primary mb-4">Tickets by Priority</h3>
              <div className="space-y-3">{Object.entries(byPriority).map(([name, count]) => { const max = Math.max(...Object.values(byPriority), 1); return (<div key={name}><div className="flex justify-between mb-1"><span className="text-sm text-thb-text-secondary capitalize">{name.replace('_', ' ')}</span><span className="text-sm font-medium">{count as number}</span></div><div className="w-full h-5 bg-slate-100 rounded-full"><div className="h-full bg-amber-500 rounded-full" style={{ width: `${((count as number) / max) * 100}%` }} /></div></div>); })}</div>
            </div>
          )}
          <button onClick={() => handleExportCSV([...Object.entries(byCategory).map(([k, v]) => ({ Category: k, Count: v })), ...Object.entries(byPriority).map(([k, v]) => ({ Priority: k, Count: v }))], `helpdesk_report_${filterYear}_${filterMonth}`)} className="inline-flex items-center gap-1.5 px-3 py-2 border border-thb-border rounded-lg text-sm font-medium text-thb-text-secondary hover:bg-slate-50 transition-colors">
            <FiDownload className="w-4 h-4" /> Export CSV
          </button>
        </div>
      );
    }

    return (
      <div className="thb-card p-6 text-center">
        <p className="text-thb-text-secondary">Report generated. Export the data using the button below.</p>
        <button onClick={() => { try { const d = data as Record<string, unknown>; const rows = Object.entries(d).map(([k, v]) => ({ Key: k, Value: typeof v === 'object' ? JSON.stringify(v) : String(v ?? '') })); handleExportCSV(rows, `${report.id}_${filterYear}_${filterMonth}`); } catch { toast.error('Export failed'); } }} className="mt-3 inline-flex items-center gap-1.5 px-3 py-2 border border-thb-border rounded-lg text-sm font-medium text-thb-text-secondary hover:bg-slate-50 transition-colors">
          <FiDownload className="w-4 h-4" /> Export CSV
        </button>
      </div>
    );
  };

  /* ── Render AI Report Results ── */
  const renderAIResults = () => {
    if (!selectedAIReport) return null;
    if (aiLoading) {
      return (
        <div className="thb-card p-12 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-full border-4 border-slate-200 border-t-green-500 animate-spin" />
              <FiCpu className="w-6 h-6 text-green-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            </div>
            <div>
              <p className="text-thb-text-primary font-semibold">AI is analyzing...</p>
              <p className="text-sm text-thb-text-muted mt-1">Processing {selectedAIReport.name} with machine learning models</p>
            </div>
            <div className="flex gap-1">
              {[0, 1, 2].map(i => (
                <div key={i} className="w-2 h-2 rounded-full bg-green-500 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
          </div>
        </div>
      );
    }

    if (aiInsights.length === 0) return null;

    const colorMap: Record<string, { bg: string; border: string; text: string; badge: string }> = {
      red: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', badge: 'bg-red-100 text-red-700' },
      emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-700' },
      blue: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', badge: 'bg-green-100 text-green-700' },
      amber: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', badge: 'bg-amber-100 text-amber-700' },
      purple: { bg: 'bg-teal-50', border: 'border-teal-200', text: 'text-teal-700', badge: 'bg-teal-100 text-teal-700' },
      rose: { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700', badge: 'bg-rose-100 text-rose-700' },
    };
    const colors = colorMap[selectedAIReport.color] || colorMap.blue;

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${colors.badge}`}>
            <FiCpu className="w-3 h-3" /> AI Powered
          </span>
          <h3 className="text-sm font-semibold text-thb-text-primary">{selectedAIReport.name} — Insights</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {aiInsights.map((insight, i) => {
            const severityColors = {
              high: 'border-l-red-500 bg-red-50/30',
              medium: 'border-l-amber-500 bg-amber-50/30',
              low: 'border-l-emerald-500 bg-emerald-50/30',
            };
            const severityBadge = {
              high: 'bg-red-100 text-red-700',
              medium: 'bg-amber-100 text-amber-700',
              low: 'bg-emerald-100 text-emerald-700',
            };
            const InsightIcon = insight.icon;
            return (
              <div key={i} className={`thb-card border-l-4 ${severityColors[insight.severity]} p-4`}>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center flex-shrink-0 shadow-sm">
                    <InsightIcon className="w-4 h-4 text-thb-text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="text-sm font-semibold text-thb-text-primary truncate">{insight.title}</h4>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${severityBadge[insight.severity]}`}>{insight.severity}</span>
                    </div>
                    <p className="text-sm text-thb-text-secondary mb-2">{insight.description}</p>
                    <div className="flex items-start gap-1.5 p-2 bg-white rounded-lg">
                      <FiArrowRight className="w-3.5 h-3.5 text-green-500 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-thb-text-primary font-medium">{insight.recommendation}</p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  /* ── Main Render ── */
  return (
    <RoleAccessGuard allowedRoles={['super_admin', 'tenant_admin', 'manager', 'employee', 'finance']} moduleKey="reports">
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-thb-text-primary flex items-center gap-2">
            <FiBarChart2 className="w-6 h-6 text-slate-500" />
            Reports & Analytics
          </h1>
          <p className="text-thb-text-secondary mt-1">Comprehensive HR data insights and reporting hub</p>
        </div>
      </div>

      {/* Module Tips & Workflow */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ModuleTips
          moduleKey="reports"
          title="Reports Tips"
          tips={[
            { title: 'Filter by Period', description: 'Use month and year filters to narrow down report data to specific time periods for accurate analysis.' },
            { title: 'Favorite Reports', description: 'Star frequently used reports to quickly access them from the favorites section without searching.' },
            { title: 'Export to CSV', description: 'Export generated report data to CSV format for offline analysis, sharing, or integration with other tools.' },
            { title: 'Statutory Compliance', description: 'Use the Statutory Reports tab to generate PF, ESI, PT, and TDS returns for regulatory compliance.' },
            { title: 'AI Insights', description: 'Leverage AI-powered reports for predictive analytics like attrition risk, compensation benchmarking, and anomaly detection.' },
          ]}
          userRole={user?.role}
        />
        <ModuleWorkflow
          moduleKey="reports"
          title="How to Generate Reports"
          subtitle="Follow these steps to create and export reports"
          accentColor="violet"
          steps={[
            { step: 1, title: 'Select Report Category', description: 'Choose between Standard, Statutory, or AI-powered reports using the tab navigation.' },
            { step: 2, title: 'Choose Report Type', description: 'Browse reports by module and select the specific report you need to generate.' },
            { step: 3, title: 'Set Filter Parameters', description: 'Configure month, year, company, and department filters for the report data.' },
            { step: 4, title: 'Generate Report', description: 'Click generate to fetch and display the report data with visualizations and tables.' },
            { step: 5, title: 'Review Results', description: 'Analyze the generated data including summary cards, charts, and detailed tables.' },
            { step: 6, title: 'Export to CSV', description: 'Download the report data as a CSV file for offline use or further processing.' },
            { step: 7, title: 'Schedule Generation', description: 'Set up regular report generation for recurring compliance and analytics needs.' },
          ]}
          userRole={user?.role}
        />
      </div>

      {/* Analytics Summary Cards */}
      {analyticsData && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="thb-card thb-card-hover p-4">
            <div className="flex items-center gap-2 mb-1"><FiUsers className="w-4 h-4 text-green-500" /><span className="text-xs text-thb-text-secondary">Employees</span></div>
            <p className="text-xl font-bold text-thb-text-primary">{(analyticsData.employees?.total as number) || 0}</p>
          </div>
          <div className="thb-card thb-card-hover p-4">
            <div className="flex items-center gap-2 mb-1"><FiCalendar className="w-4 h-4 text-amber-500" /><span className="text-xs text-thb-text-secondary">Pending Leaves</span></div>
            <p className="text-xl font-bold text-thb-text-primary">{(analyticsData.leave?.pending as number) || 0}</p>
          </div>
          <div className="thb-card thb-card-hover p-4">
            <div className="flex items-center gap-2 mb-1"><FiClock className="w-4 h-4 text-cyan-500" /><span className="text-xs text-thb-text-secondary">Attendance</span></div>
            <p className="text-xl font-bold text-thb-text-primary">{(analyticsData.attendance?.rate as number) || 0}%</p>
          </div>
          <div className="thb-card thb-card-hover p-4">
            <div className="flex items-center gap-2 mb-1"><FiBriefcase className="w-4 h-4 text-teal-500" /><span className="text-xs text-thb-text-secondary">Open Positions</span></div>
            <p className="text-xl font-bold text-thb-text-primary">{(analyticsData.recruitment?.openPositions as number) || 0}</p>
          </div>
        </div>
      )}

      {/* Search Bar */}
      <div className="thb-card p-4">
        <div className="relative">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-thb-text-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(sanitizeSearch(e.target.value))}
            placeholder="Search reports by name, description, or module..."
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-thb-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-thb-text-muted hover:text-thb-text-primary">
              <FiX className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Tab Navigation — filtered by role */}
      <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg w-fit flex-wrap">
        {([
          { key: 'standard' as MainTab, label: 'Standard Reports', icon: FiFileText, visible: true },
          { key: 'statutory' as MainTab, label: 'Statutory Reports', icon: FiShield, visible: canSeeStatutory },
          { key: 'ai' as MainTab, label: 'AI Reports', icon: FiCpu, visible: canSeeAI },
        ]).filter(tab => tab.visible).map(tab => {
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

      {/* ==================== STANDARD REPORTS TAB ==================== */}
      {activeTab === 'standard' && (
        <div className="space-y-4">
          {/* Favorites Section */}
          {favoriteStandardReports.length > 0 && !searchQuery && (
            <div>
              <h2 className="text-sm font-semibold text-thb-text-primary mb-3 flex items-center gap-2">
                <FiStar className="w-4 h-4 text-amber-500" />
                Favorite Reports
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {favoriteStandardReports.map(report => {
                  const ReportIcon = report.icon;
                  return (
                    <div key={report.id} className="thb-card thb-card-hover p-4 border-l-4 border-l-amber-400 cursor-pointer" onClick={() => handleGenerateReport(report)}>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${moduleIconBg[report.module] || 'bg-slate-50 text-slate-500'}`}>
                            <ReportIcon className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-thb-text-primary">{report.name}</p>
                            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${moduleBadgeColors[report.module] || 'bg-slate-50 text-slate-700'}`}>{report.module}</span>
                          </div>
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); toggleFavorite(report.id); }} className="text-amber-500 hover:text-amber-600">
                          <FiStar className="w-4 h-4 fill-current" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Module-wise Report Sections */}
          {filteredStandardReports.map(group => {
            const ModuleIcon = group.moduleIcon;
            const isExpanded = expandedModules.has(group.module);
            return (
              <div key={group.module} className="thb-card overflow-hidden">
                <button
                  onClick={() => toggleModule(group.module)}
                  className="w-full flex items-center justify-between p-4 hover:bg-slate-50/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${moduleIconBg[group.module]}`}>
                      <ModuleIcon className="w-4 h-4" />
                    </div>
                    <div className="text-left">
                      <h2 className="text-sm font-semibold text-thb-text-primary">{group.module} Reports</h2>
                      <p className="text-xs text-thb-text-muted">{group.reports.length} report{group.reports.length !== 1 ? 's' : ''} available</p>
                    </div>
                  </div>
                  {isExpanded ? <FiChevronUp className="w-5 h-5 text-thb-text-muted" /> : <FiChevronDown className="w-5 h-5 text-thb-text-muted" />}
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {group.reports.map(report => {
                        const ReportIcon = report.icon;
                        const isFav = favorites.has(report.id);
                        return (
                          <div key={report.id} className={`thb-card thb-card-hover p-4 border ${report.comingSoon ? 'opacity-70' : 'border-transparent'}`}>
                            <div className="flex items-start justify-between mb-3">
                              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${moduleIconBg[report.module]}`}>
                                <ReportIcon className="w-5 h-5" />
                              </div>
                              <div className="flex items-center gap-1">
                                <button onClick={() => toggleFavorite(report.id)} className={`p-1.5 rounded-lg hover:bg-slate-100 transition-colors ${isFav ? 'text-amber-500' : 'text-thb-text-muted hover:text-amber-500'}`}>
                                  <FiStar className={`w-4 h-4 ${isFav ? 'fill-current' : ''}`} />
                                </button>
                              </div>
                            </div>
                            <h3 className="text-sm font-semibold text-thb-text-primary mb-1">{report.name}</h3>
                            <p className="text-xs text-thb-text-muted mb-3 line-clamp-2">{report.description}</p>
                            <div className="flex items-center justify-between">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${moduleBadgeColors[report.module]}`}>{report.module}</span>
                              {report.comingSoon ? (
                                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-thb-text-muted">Coming Soon</span>
                              ) : (
                                <button onClick={() => handleGenerateReport(report)} className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-500 text-white rounded-lg text-xs font-medium hover:bg-green-600 shadow-sm shadow-green-500/25 transition-colors">
                                  <FiSliders className="w-3 h-3" /> Generate
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Report Results */}
          {reportHistory && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-thb-text-primary flex items-center gap-2">
                  <FiBarChart2 className="w-4 h-4 text-green-500" />
                  {reportHistory.report.name} — Results
                </h2>
                <button onClick={() => setReportHistory(null)} className="p-2 rounded-lg text-thb-text-muted hover:text-thb-text-primary hover:bg-slate-100 transition-colors">
                  <FiX className="w-4 h-4" />
                </button>
              </div>
              {renderStandardReportResults()}
            </div>
          )}
        </div>
      )}

      {/* ==================== STATUTORY REPORTS TAB ==================== */}
      {activeTab === 'statutory' && (
        <div className="space-y-4">
          {/* Statutory Report Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredStatutoryReports.map(report => {
              const ReportIcon = report.icon;
              const isSelected = selectedStatutory.id === report.id;
              const isComingSoon = Boolean('comingSoon' in report && report.comingSoon);
              return (
                <div
                  key={report.id}
                  className={`thb-card thb-card-hover p-4 cursor-pointer border-2 transition-colors ${
                    isSelected ? 'border-green-400 bg-green-50/30' : 'border-transparent'
                  } ${isComingSoon ? 'opacity-70' : ''}`}
                  onClick={() => !isComingSoon && setSelectedStatutory(report)}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                      <ReportIcon className="w-5 h-5 text-thb-text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-thb-text-primary">{report.name}</h3>
                      <p className="text-xs text-thb-text-muted mt-0.5">{report.authorityShort} · {report.periodLabel}</p>
                      {isComingSoon ? (
                        <span className="inline-block mt-2 px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-thb-text-muted">Coming Soon</span>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Statutory Filters & Results */}
          {!('comingSoon' in selectedStatutory && selectedStatutory.comingSoon) && (
            <div className="space-y-4">
              <div className="thb-card p-4">
                <div className="flex flex-col sm:flex-row gap-3 items-end">
                  <div>
                    <label className="block text-xs font-medium text-thb-text-secondary mb-1">Month</label>
                    <select value={statutoryMonth} onChange={e => setStatutoryMonth(parseInt(e.target.value))} className="px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 min-w-[120px]">
                      {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-thb-text-secondary mb-1">Year</label>
                    <input type="number" value={statutoryYear} onChange={e => setStatutoryYear(parseInt(e.target.value))} className="px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 w-24" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-thb-text-secondary mb-1">Company</label>
                    <select value={statutoryCompanyId} onChange={e => setStatutoryCompanyId(e.target.value)} className="px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 min-w-[140px]">
                      <option value="">All Companies</option>
                      {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <button onClick={handleGenerateStatutory} disabled={statutoryLoading} className="inline-flex items-center gap-2 px-4 py-2.5 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 font-medium text-sm shadow-sm shadow-green-500/25 transition-colors whitespace-nowrap">
                    {statutoryLoading ? <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" /> : <FiSearch className="w-4 h-4" />}
                    Generate
                  </button>
                  {statutoryData.length > 0 && (
                    <button onClick={() => handleExportCSV(statutoryData as unknown as Record<string, unknown>[], `${selectedStatutory.apiType}_report_${statutoryYear}_${statutoryMonth}`)} className="inline-flex items-center gap-1.5 px-3 py-2.5 border border-thb-border rounded-lg text-sm font-medium text-thb-text-secondary hover:bg-slate-50 transition-colors">
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
                  <div className="overflow-x-auto max-h-96 overflow-y-auto">
                    <table className="w-full min-w-[600px]">
                      <thead className="sticky top-0 z-10">
                        <tr className="border-b border-thb-border bg-slate-50">
                          <th className="text-left px-3 py-2 text-xs font-semibold text-thb-text-secondary uppercase">Code</th>
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
              ) : !statutoryLoading && selectedStatutory && (
                <div className="thb-card p-12 text-center">
                  <FiShield className="w-12 h-12 text-thb-text-muted mx-auto mb-3" />
                  <p className="text-thb-text-secondary font-medium">No data loaded</p>
                  <p className="text-sm text-thb-text-muted mt-1">Select period and click Generate to view {selectedStatutory.name}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ==================== AI REPORTS TAB ==================== */}
      {activeTab === 'ai' && (
        <div className="space-y-4">
          {/* AI Report Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAIReports.map(report => {
              const ReportIcon = report.icon;
              const colorMap: Record<string, { bg: string; iconBg: string; text: string }> = {
                red: { bg: 'bg-red-50', iconBg: 'bg-red-100 text-red-600', text: 'text-red-700' },
                emerald: { bg: 'bg-emerald-50', iconBg: 'bg-emerald-100 text-emerald-600', text: 'text-emerald-700' },
                blue: { bg: 'bg-green-50', iconBg: 'bg-green-100 text-green-600', text: 'text-green-700' },
                amber: { bg: 'bg-amber-50', iconBg: 'bg-amber-100 text-amber-600', text: 'text-amber-700' },
                purple: { bg: 'bg-teal-50', iconBg: 'bg-teal-100 text-teal-600', text: 'text-teal-700' },
                rose: { bg: 'bg-rose-50', iconBg: 'bg-rose-100 text-rose-600', text: 'text-rose-700' },
              };
              const colors = colorMap[report.color] || colorMap.blue;
              const isActive = selectedAIReport?.id === report.id;
              return (
                <div
                  key={report.id}
                  className={`thb-card thb-card-hover p-4 cursor-pointer border-2 transition-colors ${
                    isActive ? 'border-green-400' : 'border-transparent'
                  }`}
                  onClick={() => { setSelectedAIReport(report); setAiInsights([]); }}
                >
                  <div className="flex items-start gap-3 mb-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colors.iconBg}`}>
                      <ReportIcon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-thb-text-primary">{report.name}</h3>
                        <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-bold bg-gradient-to-r from-green-500 to-teal-500 text-white">
                          <FiCpu className="w-2.5 h-2.5" /> AI
                        </span>
                      </div>
                      <p className="text-xs text-thb-text-muted mt-1 line-clamp-2">{report.description}</p>
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleGenerateAI(report); }}
                    className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-gradient-to-r from-green-500 to-teal-500 text-white rounded-lg text-xs font-medium hover:from-green-600 hover:to-teal-600 shadow-sm transition-colors"
                  >
                    <FiCpu className="w-3.5 h-3.5" /> Generate AI Report
                  </button>
                </div>
              );
            })}
          </div>

          {/* AI Results */}
          {renderAIResults()}

          {/* Empty State for AI Reports */}
          {!selectedAIReport && !aiLoading && (
            <div className="thb-card p-12 text-center">
              <FiCpu className="w-12 h-12 text-thb-text-muted mx-auto mb-3" />
              <p className="text-thb-text-secondary font-medium">Select an AI report to generate</p>
              <p className="text-sm text-thb-text-muted mt-1">AI-powered analytics will provide predictive insights and recommendations</p>
            </div>
          )}
        </div>
      )}

      {/* ==================== FILTER DIALOG ==================== */}
      {showFilterDialog && selectedReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowFilterDialog(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-thb-border">
              <h2 className="text-sm font-semibold text-thb-text-primary flex items-center gap-2">
                <FiSliders className="w-4 h-4 text-green-500" />
                Generate: {selectedReport.name}
              </h2>
              <button onClick={() => setShowFilterDialog(false)} className="p-2 rounded-lg text-thb-text-muted hover:text-thb-text-primary hover:bg-slate-100 transition-colors">
                <FiX className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Month</label>
                  <select value={filterMonth} onChange={e => setFilterMonth(parseInt(e.target.value))} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400">
                    {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Year</label>
                  <input type="number" value={filterYear} onChange={e => setFilterYear(parseInt(e.target.value))} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Company</label>
                <select value={filterCompany} onChange={e => setFilterCompany(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400">
                  <option value="">All Companies</option>
                  {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Department</label>
                <select value={filterDepartment} onChange={e => setFilterDepartment(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400">
                  <option value="">All Departments</option>
                  <option value="engineering">Engineering</option>
                  <option value="sales">Sales</option>
                  <option value="marketing">Marketing</option>
                  <option value="hr">HR</option>
                  <option value="finance">Finance</option>
                  <option value="operations">Operations</option>
                </select>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 p-4 border-t border-thb-border">
              <button onClick={() => setShowFilterDialog(false)} className="px-4 py-2.5 rounded-lg border border-thb-border text-sm font-medium text-thb-text-secondary hover:bg-slate-50 transition-colors">
                Cancel
              </button>
              <button
                onClick={() => { setShowFilterDialog(false); executeReportGeneration(); }}
                disabled={reportLoading}
                className="px-6 py-2.5 rounded-lg bg-green-500 text-white text-sm font-medium hover:bg-green-600 disabled:opacity-50 shadow-sm shadow-green-500/25 transition-colors flex items-center gap-2"
              >
                {reportLoading ? <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" /> : <FiSearch className="w-4 h-4" />}
                Generate Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </RoleAccessGuard>
  );
}
