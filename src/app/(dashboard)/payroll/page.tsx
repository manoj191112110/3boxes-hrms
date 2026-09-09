'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  FiLayers,
  FiDatabase,
  FiShield,
  FiBarChart2,
  FiEdit3,
  FiPlayCircle,
  FiDollarSign,
  FiGrid,
  FiCalendar,
  FiBook,
  FiFileText,
  FiFile,
  FiUsers,
  FiClock,
  FiAlertCircle,
  FiArrowRight,
  FiCreditCard,
  FiTruck,
  FiActivity,
  FiClipboard,
  FiLock,
  FiCheckSquare,
  FiCheck,
  FiChevronDown,
  FiChevronUp,
  FiInfo,
  FiPercent,
  FiGlobe,
  FiUserCheck,
  FiCpu,
  FiRefreshCw,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import ModuleTips from '@/components/ModuleTips';
import ModuleIntro from '@/components/ModuleIntro';
import { useCompanyContextStore } from '@/store/companyContextStore';
import { isClientDemoMode } from '@/lib/site-mode';

/* ── Helpers ── */
function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

/* ── Sub-module tile configuration ── */
interface SubModuleTile {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  route: string;
  description: string;
  gradientBg: string;
  iconColor: string;
  ringColor: string;
  isNew?: boolean;
  category?: 'masters' | 'transactions' | 'reports';
}

const subModules: SubModuleTile[] = [
  // ─── Payroll Masters ───
  {
    title: 'CTC Templates',
    icon: FiLayers,
    route: '/payroll/ctc-templates',
    description: 'Define and manage Cost to Company salary structures',
    gradientBg: 'bg-green-500/10',
    iconColor: 'text-green-500',
    ringColor: 'ring-green-500/20',
    category: 'masters',
  },
  {
    title: 'CTC Calculator',
    icon: FiPercent,
    route: '/payroll/ctc-calculator',
    description: 'Calculate CTC breakdown - earnings, deductions, and take-home pay',
    gradientBg: 'bg-emerald-500/10',
    iconColor: 'text-emerald-500',
    ringColor: 'ring-emerald-500/20',
    category: 'masters',
  },
  {
    title: 'Income Tax',
    icon: FiFileText,
    route: '/payroll/income-tax',
    description: 'Income tax calculator and declaration management',
    gradientBg: 'bg-amber-500/10',
    iconColor: 'text-amber-500',
    ringColor: 'ring-amber-500/20',
    category: 'masters',
  },
  {
    title: 'Gratuity',
    icon: FiTruck,
    route: '/payroll/gratuity',
    description: 'Gratuity calculation and projection as per Act 1972',
    gradientBg: 'bg-teal-500/10',
    iconColor: 'text-teal-500',
    ringColor: 'ring-teal-500/20',
    category: 'masters',
  },
  {
    title: 'Component Master',
    icon: FiDatabase,
    route: '/payroll/components',
    description: 'Configure payroll earnings, deductions, and allowances',
    gradientBg: 'bg-teal-500/10',
    iconColor: 'text-teal-500',
    ringColor: 'ring-teal-500/20',
    category: 'masters',
  },
  {
    title: 'Statutory Components',
    icon: FiShield,
    route: '/payroll/statutory',
    description: 'Country-specific tax, PF, ESI, and compliance setup',
    gradientBg: 'bg-emerald-500/10',
    iconColor: 'text-emerald-500',
    ringColor: 'ring-emerald-500/20',
    category: 'masters',
  },
  {
    title: 'Tax Slabs',
    icon: FiBarChart2,
    route: '/payroll/tax-slabs',
    description: 'Configure progressive income tax slab rates',
    gradientBg: 'bg-amber-500/10',
    iconColor: 'text-amber-500',
    ringColor: 'ring-amber-500/20',
    category: 'masters',
  },
  {
    title: 'Currency & FX',
    icon: FiDollarSign,
    route: '/payroll/currency',
    description: 'Multi-currency configuration and exchange rates',
    gradientBg: 'bg-teal-500/10',
    iconColor: 'text-teal-500',
    ringColor: 'ring-teal-500/20',
    category: 'masters',
  },
  {
    title: 'Dimensions',
    icon: FiGrid,
    route: '/payroll/dimensions',
    description: 'Multi-dimensional cost allocation setup',
    gradientBg: 'bg-orange-500/10',
    iconColor: 'text-orange-500',
    ringColor: 'ring-orange-500/20',
    category: 'masters',
  },
  {
    title: 'Payroll Definitions',
    icon: FiClipboard,
    route: '/payroll/definitions',
    description: 'Configure pay frequency, cut-off dates, and costing segments',
    gradientBg: 'bg-sky-500/10',
    iconColor: 'text-sky-500',
    ringColor: 'ring-sky-500/20',
    category: 'masters',
  },
  {
    title: 'Salary Settings',
    icon: FiEdit3,
    route: '/payroll/salary-settings',
    description: 'Configure DA/HRA, PF, ESI, TDS, PT, Gratuity, LWF rates',
    gradientBg: 'bg-rose-500/10',
    iconColor: 'text-rose-500',
    ringColor: 'ring-rose-500/20',
    category: 'masters',
  },
  // ─── Payroll Transactions ───
  {
    title: 'Payroll Inputs',
    icon: FiEdit3,
    route: '/payroll/inputs',
    description: 'Manage attendance, leave, OT, and variable pay inputs',
    gradientBg: 'bg-rose-500/10',
    iconColor: 'text-rose-500',
    ringColor: 'ring-rose-500/20',
    category: 'transactions',
  },
  {
    title: 'Pre-Payroll Validation',
    icon: FiCheckSquare,
    route: '/payroll/validations',
    description: 'Validate employee data before processing payroll',
    gradientBg: 'bg-emerald-500/10',
    iconColor: 'text-emerald-500',
    ringColor: 'ring-emerald-500/20',
    category: 'transactions',
  },
  {
    title: 'Payroll Processing',
    icon: FiPlayCircle,
    route: '/payroll/processing',
    description: 'Run payroll cycles, review, and approve',
    gradientBg: 'bg-cyan-500/10',
    iconColor: 'text-cyan-500',
    ringColor: 'ring-cyan-500/20',
    category: 'transactions',
  },
  {
    title: 'Payroll Approvals',
    icon: FiUserCheck,
    route: '/payroll/approvals',
    description: 'Approval workflow with Segregation of Duties enforcement',
    gradientBg: 'bg-emerald-500/10',
    iconColor: 'text-emerald-500',
    ringColor: 'ring-emerald-500/20',
    isNew: true,
    category: 'transactions',
  },
  {
    title: 'Payment Methods',
    icon: FiCreditCard,
    route: '/payroll/payment-methods',
    description: 'Employee bank details, split payments, and payment setup',
    gradientBg: 'bg-lime-500/10',
    iconColor: 'text-lime-500',
    ringColor: 'ring-lime-500/20',
    category: 'transactions',
  },
  {
    title: 'Payslips',
    icon: FiFileText,
    route: '/payroll/payslips',
    description: 'Generate, view, and print employee payslips',
    gradientBg: 'bg-pink-500/10',
    iconColor: 'text-pink-500',
    ringColor: 'ring-pink-500/20',
    category: 'transactions',
  },
  {
    title: 'Bank File Generation',
    icon: FiFile,
    route: '/payroll/bank-files',
    description: 'Generate NACH/NEFT/RTGS bank payment files',
    gradientBg: 'bg-green-500/10',
    iconColor: 'text-green-500',
    ringColor: 'ring-green-500/20',
    category: 'transactions',
  },
  {
    title: 'Loans',
    icon: FiDollarSign,
    route: '/payroll/loans',
    description: 'Manage employee loans, EMI tracking, and recovery',
    gradientBg: 'bg-yellow-500/10',
    iconColor: 'text-yellow-500',
    ringColor: 'ring-yellow-500/20',
    category: 'transactions',
  },
  {
    title: 'Overtime',
    icon: FiActivity,
    route: '/payroll/overtime',
    description: 'Track overtime hours, approvals, and payments',
    gradientBg: 'bg-fuchsia-500/10',
    iconColor: 'text-fuchsia-500',
    ringColor: 'ring-fuchsia-500/20',
    category: 'transactions',
  },
  {
    title: 'F&F Settlement',
    icon: FiTruck,
    route: '/payroll/fnf',
    description: 'Full and Final settlement for exiting employees',
    gradientBg: 'bg-red-500/10',
    iconColor: 'text-red-500',
    ringColor: 'ring-red-500/20',
    category: 'transactions',
  },
  {
    title: 'Payroll Holds',
    icon: FiLock,
    route: '/payroll/holds',
    description: 'Hold or suspend employee payroll processing',
    gradientBg: 'bg-gray-500/10',
    iconColor: 'text-gray-500',
    ringColor: 'ring-gray-500/20',
    category: 'transactions',
  },
  {
    title: 'Cross-Border Secondment',
    icon: FiGlobe,
    route: '/payroll/secondment',
    description: 'Manage employees seconded across countries with split pay & SS coverage',
    gradientBg: 'bg-teal-500/10',
    iconColor: 'text-teal-500',
    ringColor: 'ring-teal-500/20',
    isNew: true,
    category: 'transactions',
  },
  // ─── Payroll Reports ───
  {
    title: 'Reports & Dashboard',
    icon: FiFileText,
    route: '/payroll/reports',
    description: 'Salary register, statutory reports, and payroll analytics',
    gradientBg: 'bg-slate-500/10',
    iconColor: 'text-slate-500',
    ringColor: 'ring-slate-500/20',
    category: 'reports',
  },
  {
    title: 'Compliance',
    icon: FiCalendar,
    route: '/payroll/compliance',
    description: 'Statutory filing calendar and obligation tracking',
    gradientBg: 'bg-teal-500/10',
    iconColor: 'text-teal-500',
    ringColor: 'ring-teal-500/20',
    category: 'reports',
  },
  {
    title: 'GL Mapping',
    icon: FiBook,
    route: '/payroll/gl-mapping',
    description: 'Map payroll components to general ledger accounts',
    gradientBg: 'bg-emerald-500/10',
    iconColor: 'text-emerald-500',
    ringColor: 'ring-emerald-500/20',
    category: 'reports',
  },
  {
    title: 'AI Insights',
    icon: FiCpu,
    route: '/payroll/ai-insights',
    description: 'Anomaly detection, compliance alerts, ghost employee detection',
    gradientBg: 'bg-teal-500/10',
    iconColor: 'text-teal-500',
    ringColor: 'ring-teal-500/20',
    isNew: true,
    category: 'reports',
  },
  {
    title: 'Group Dashboard',
    icon: FiGlobe,
    route: '/payroll/group-dashboard',
    description: 'Consolidated group payroll + statutory filing oversight (Red/Amber/Green)',
    gradientBg: 'bg-cyan-500/10',
    iconColor: 'text-cyan-500',
    ringColor: 'ring-cyan-500/20',
    isNew: true,
    category: 'reports',
  },
];

const categoryConfig: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; description: string; gradientFrom: string; gradientTo: string }> = {
  masters: { label: 'Payroll Masters', icon: FiDatabase, description: 'Setup & configure payroll structure, components, and statutory definitions', gradientFrom: 'from-green-600', gradientTo: 'to-emerald-600' },
  transactions: { label: 'Payroll Transactions', icon: FiPlayCircle, description: 'Run payroll cycles, process payments, and manage employee deductions', gradientFrom: 'from-emerald-600', gradientTo: 'to-teal-600' },
  reports: { label: 'Payroll Reports', icon: FiBarChart2, description: 'Analytics, compliance reporting, and payroll insights', gradientFrom: 'from-amber-600', gradientTo: 'to-orange-600' },
};

/* ── Payroll Workflow Steps ── */
interface WorkflowStep {
  step: number;
  title: string;
  description: string;
  route: string;
  statKey: string; // key in workflowData
}

const workflowSteps: WorkflowStep[] = [
  {
    step: 1,
    title: 'Setup Components',
    description: 'Configure earnings, deductions, and allowances in Component Master',
    route: '/payroll/components',
    statKey: 'hasComponents',
  },
  {
    step: 2,
    title: 'Setup Statutory',
    description: 'Configure PF, ESI, PT, TDS in Statutory Components',
    route: '/payroll/statutory',
    statKey: 'hasStatutory',
  },
  {
    step: 3,
    title: 'Create CTC Templates',
    description: 'Define salary structures using CTC Templates',
    route: '/payroll/ctc-templates',
    statKey: 'hasCTCTemplates',
  },
  {
    step: 4,
    title: 'Configure Tax Slabs',
    description: 'Set up progressive tax slab rates',
    route: '/payroll/tax-slabs',
    statKey: 'hasTaxSlabs',
  },
  {
    step: 5,
    title: 'Set Payment Methods',
    description: 'Configure employee bank details and payment preferences',
    route: '/payroll/payment-methods',
    statKey: 'hasPaymentMethods',
  },
  {
    step: 6,
    title: 'Collect Inputs',
    description: 'Gather attendance, leave, OT, and variable pay data',
    route: '/payroll/inputs',
    statKey: 'hasInputs',
  },
  {
    step: 7,
    title: 'Run Validations',
    description: 'Pre-payroll validation to check for data issues',
    route: '/payroll/validations',
    statKey: 'hasValidations',
  },
  {
    step: 8,
    title: 'Process Payroll',
    description: 'Create and run payroll cycle',
    route: '/payroll/processing',
    statKey: 'hasPayrollRuns',
  },
  {
    step: 9,
    title: 'Review & Approve',
    description: 'Review calculations and approve payroll',
    route: '/payroll/processing',
    statKey: 'hasApprovedRuns',
  },
  {
    step: 10,
    title: 'Generate Payslips',
    description: 'Generate employee payslips',
    route: '/payroll/payslips',
    statKey: 'hasPayslips',
  },
  {
    step: 11,
    title: 'File Compliance',
    description: 'Complete statutory filings',
    route: '/payroll/compliance',
    statKey: 'hasCompliance',
  },
  {
    step: 12,
    title: 'Close Period',
    description: 'Close the payroll period',
    route: '/payroll/processing',
    statKey: 'hasClosedRuns',
  },
];

/* ── Stats type ── */
interface SummaryStats {
  totalEmployees: number;
  activeCTCTemplates: number;
  pendingPayrollRuns: number;
  openComplianceItems: number;
}

interface WorkflowData {
  hasComponents: boolean;
  hasStatutory: boolean;
  hasCTCTemplates: boolean;
  hasTaxSlabs: boolean;
  hasPaymentMethods: boolean;
  hasInputs: boolean;
  hasValidations: boolean;
  hasPayrollRuns: boolean;
  hasApprovedRuns: boolean;
  hasPayslips: boolean;
  hasCompliance: boolean;
  hasClosedRuns: boolean;
}

/* ── Payroll Tips ── */
const payrollTips = [
  {
    title: 'Configure Components First',
    description: 'Start by configuring Component Master and Statutory Components before processing payroll',
  },
  {
    title: 'Standardize with CTC Templates',
    description: 'Use CTC Templates to standardize salary structures across your organization',
  },
  {
    title: 'Run Validations Early',
    description: 'Run Pre-Payroll Validations before processing to catch data issues early',
  },
  {
    title: 'Follow the Lifecycle',
    description: 'Payroll runs follow a lifecycle: Open → Input Collection → Processing → Review → Approved → Disbursed → Closed',
  },
  {
    title: 'Verify with Reports',
    description: 'Check the Reports & Dashboard after processing to verify payroll accuracy',
  },
];

/* ── Component ── */
export default function PayrollManagementPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const effectiveCompanyId = useCompanyContextStore(s => s.effectiveCompanyId);

  const [stats, setStats] = useState<SummaryStats>({
    totalEmployees: 0,
    activeCTCTemplates: 0,
    pendingPayrollRuns: 0,
    openComplianceItems: 0,
  });
  const [loadingStats, setLoadingStats] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [workflowData, setWorkflowData] = useState<WorkflowData>({
    hasComponents: false,
    hasStatutory: false,
    hasCTCTemplates: false,
    hasTaxSlabs: false,
    hasPaymentMethods: false,
    hasInputs: false,
    hasValidations: false,
    hasPayrollRuns: false,
    hasApprovedRuns: false,
    hasPayslips: false,
    hasCompliance: false,
    hasClosedRuns: false,
  });
  const [workflowExpanded, setWorkflowExpanded] = useState(true);

  /* Fetch summary stats */
  const fetchStats = useCallback(async () => {
    try {
      setLoadingStats(true);
      const headers = getAuthHeaders();

      const res = await fetch(`/api/payroll/summary?${scopeQuery}` , { headers });

      if (res.ok) {
        const data = await res.json();
        setStats(data.stats || { totalEmployees: 0, activeCTCTemplates: 0, pendingPayrollRuns: 0, openComplianceItems: 0 });
        setWorkflowData(data.workflow || {
          hasComponents: false,
          hasStatutory: false,
          hasCTCTemplates: false,
          hasTaxSlabs: false,
          hasPaymentMethods: false,
          hasInputs: false,
          hasValidations: false,
          hasPayrollRuns: false,
          hasApprovedRuns: false,
          hasPayslips: false,
          hasCompliance: false,
          hasClosedRuns: false,
        });
      } else {
        toast.error('Failed to load payroll summary');
        setStats({ totalEmployees: 0, activeCTCTemplates: 0, pendingPayrollRuns: 0, openComplianceItems: 0 });
        setWorkflowData({
          hasComponents: false,
          hasStatutory: false,
          hasCTCTemplates: false,
          hasTaxSlabs: false,
          hasPaymentMethods: false,
          hasInputs: false,
          hasValidations: false,
          hasPayrollRuns: false,
          hasApprovedRuns: false,
          hasPayslips: false,
          hasCompliance: false,
          hasClosedRuns: false,
        });
      }
    } catch (err) {
      console.error('Payroll summary error:', err);
      toast.error('Failed to load payroll summary');
      setStats({ totalEmployees: 0, activeCTCTemplates: 0, pendingPayrollRuns: 0, openComplianceItems: 0 });
      setWorkflowData({
        hasComponents: false,
        hasStatutory: false,
        hasCTCTemplates: false,
        hasTaxSlabs: false,
        hasPaymentMethods: false,
        hasInputs: false,
        hasValidations: false,
        hasPayrollRuns: false,
        hasApprovedRuns: false,
        hasPayslips: false,
        hasCompliance: false,
        hasClosedRuns: false,
      });
    } finally {
      setLoadingStats(false);
    }
  }, []);
  const cid = effectiveCompanyId();
  const scopeQuery = cid ? `companyId=${cid}&` : '';


  useEffect(() => {
    queueMicrotask(() => fetchStats());
  }, [fetchStats]);

  /* Seed demo data */
  const handleSeedData = async () => {
    try {
      setSeeding(true);
      const res = await fetch('/api/admin/seed-demo-data', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ module: 'payroll' }),
      });
      if (!res.ok) throw new Error('Failed to seed');
      const data = await res.json();
      toast.success(data.message || 'Demo data seeded successfully');
      fetchStats();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to seed data');
    } finally {
      setSeeding(false);
    }
  };

  /* Navigation handler */
  const handleNavigate = useCallback(
    (route: string) => {
      router.push(route);
    },
    [router]
  );

  /* Determine step status: 'complete' | 'current' | 'pending' */
  const getStepStatus = (step: WorkflowStep): 'complete' | 'current' | 'pending' => {
    const isComplete = workflowData[step.statKey as keyof WorkflowData];
    if (isComplete) return 'complete';

    // Find the first incomplete step - that's the "current" one
    const firstIncomplete = workflowSteps.find(s => !workflowData[s.statKey as keyof WorkflowData]);
    if (firstIncomplete && firstIncomplete.step === step.step) return 'current';

    return 'pending';
  };

  const completedCount = workflowSteps.filter(s => workflowData[s.statKey as keyof WorkflowData]).length;

  /* Stats cards configuration */
  const statsCards = [
    {
      label: 'Total Employees',
      value: stats.totalEmployees,
      icon: FiUsers,
      bg: 'bg-green-50',
      iconColor: 'text-green-600',
      ring: 'ring-green-100',
    },
    {
      label: 'Active CTC Templates',
      value: stats.activeCTCTemplates,
      icon: FiLayers,
      bg: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
      ring: 'ring-emerald-100',
    },
    {
      label: 'Pending Payroll Runs',
      value: stats.pendingPayrollRuns,
      icon: FiClock,
      bg: 'bg-amber-50',
      iconColor: 'text-amber-600',
      ring: 'ring-amber-100',
    },
    {
      label: 'Open Compliance Items',
      value: stats.openComplianceItems,
      icon: FiAlertCircle,
      bg: 'bg-rose-50',
      iconColor: 'text-rose-600',
      ring: 'ring-rose-100',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header — concise; the persistent sub-nav (layout.tsx) shows the title bar */}
      <div className="flex items-center justify-between">
        <p className="text-thb-text-secondary text-sm">
          Configure salary structures, process payroll, and manage compliance.
        </p>
        {isClientDemoMode() && (
        <button
          onClick={handleSeedData}
          disabled={seeding}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 disabled:opacity-50 transition-colors"
        >
          {seeding ? <FiRefreshCw className="w-3.5 h-3.5 animate-spin" /> : <FiDatabase className="w-3.5 h-3.5" />}
          {seeding ? 'Seeding...' : 'Seed Sample Data'}
        </button>
        )}
      </div>

      {/* Module Intro — minimized by default with hover preview */}
      <ModuleIntro
        title="Payroll Management"
        subtitle="Multi-country, multi-currency payroll with statutory compliance"
        srsRef="REQ-PAY-01..18"
        icon={<FiDollarSign className="w-4 h-4" />}
        accent="emerald"
      >
        <p>
          The Payroll module handles the entire compensation lifecycle — from defining CTC templates and
          salary components (basic, HRA, allowances, deductions) to running monthly payroll across
          multiple countries, currencies, and statutory regimes (PF, ESI, TDS, Professional Tax in India;
          equivalent filings for other jurisdictions).
        </p>
        <p>
          Payroll runs are locked, approved, and validated before disbursement. The module supports
          bank-file generation, payslip distribution, holds, arrears, loans, overtime, gratuity, FNF
          (full-and-final settlement), and AI-driven anomaly detection (ghost employees, duplicate
          disbursements, off-hours edits). All changes are audit-logged per REQ-SEC-PAY-01.
        </p>
        <p>
          Multi-currency is first-class: every amount is stored with its currency code (INR by default),
          and exchange rates are tracked for cross-border reporting. The compliance center tracks
          upcoming statutory filings and alerts before due dates.
        </p>
      </ModuleIntro>

      {/* Module Tips */}
      <ModuleTips
        moduleKey="payroll"
        title="Payroll Tips"
        tips={payrollTips}
        userRole={user?.role}
      />

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statsCards.map((card) => {
          const IconComp = card.icon;
          return (
            <div key={card.label} className="thb-card thb-card-hover p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-thb-text-secondary">{card.label}</p>
                  {loadingStats ? (
                    <div className="h-8 w-12 bg-slate-200 rounded animate-pulse mt-1" />
                  ) : (
                    <p className="text-2xl font-bold text-thb-text-primary mt-1">{card.value}</p>
                  )}
                </div>
                <div className={`w-10 h-10 rounded-xl ${card.bg} flex items-center justify-center ${card.iconColor} ring-1 ${card.ring}`}>
                  <IconComp className="w-5 h-5" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Payroll Processing Workflow Guide */}
      <div className="thb-card overflow-hidden border border-emerald-100">
        {/* Workflow Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-emerald-50 to-teal-50 border-b border-emerald-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
              <FiInfo className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-thb-text-primary">How to Process Payroll</h3>
              <p className="text-xs text-thb-text-secondary mt-0.5">
                Follow this workflow to process payroll for the first time
              </p>
            </div>
            <span className="text-[10px] font-medium text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full ml-2">
              {completedCount}/{workflowSteps.length} complete
            </span>
          </div>
          <button
            onClick={() => setWorkflowExpanded(!workflowExpanded)}
            className="p-2 rounded-lg text-thb-text-muted hover:text-thb-text-primary hover:bg-white/60 transition-colors"
          >
            {workflowExpanded ? <FiChevronUp className="w-4 h-4" /> : <FiChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {/* Info Banner */}
        {workflowExpanded && completedCount < workflowSteps.length && (
          <div className="mx-5 mt-4 px-4 py-3 rounded-lg bg-green-50 border border-green-100 flex items-center gap-3">
            <FiInfo className="w-4 h-4 text-green-500 flex-shrink-0" />
            <p className="text-xs text-green-700">
              <span className="font-medium">Getting started?</span> Follow this step-by-step workflow to set up and process your first payroll. Each step links to the relevant module.
            </p>
          </div>
        )}

        {/* Workflow Steps */}
        {workflowExpanded && (
          <div className="p-5">
            {/* Desktop: Horizontal scrollable */}
            <div className="hidden md:block">
              <div className="flex items-start gap-0 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-slate-50">
                {workflowSteps.map((step, index) => {
                  const status = getStepStatus(step);
                  return (
                    <div key={step.step} className="flex items-start flex-shrink-0">
                      <button
                        onClick={() => handleNavigate(step.route)}
                        className="flex flex-col items-center text-center w-28 group"
                        title={`Step ${step.step}: ${step.title}`}
                      >
                        {/* Step Circle */}
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-200 group-hover:scale-110 ${
                            status === 'complete'
                              ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/25'
                              : status === 'current'
                              ? 'bg-green-500 text-white shadow-md shadow-green-500/25 ring-4 ring-green-100'
                              : 'bg-slate-100 text-slate-400 group-hover:bg-slate-200'
                          }`}
                        >
                          {status === 'complete' ? (
                            <FiCheck className="w-5 h-5" />
                          ) : (
                            step.step
                          )}
                        </div>
                        {/* Title */}
                        <p
                          className={`text-[11px] font-medium mt-2 leading-tight ${
                            status === 'complete'
                              ? 'text-emerald-600'
                              : status === 'current'
                              ? 'text-green-600'
                              : 'text-slate-400 group-hover:text-slate-500'
                          }`}
                        >
                          {step.title}
                        </p>
                        {/* Description */}
                        <p className="text-[9px] text-slate-400 mt-0.5 leading-tight line-clamp-2">
                          {step.description}
                        </p>
                      </button>
                      {/* Arrow connector */}
                      {index < workflowSteps.length - 1 && (
                        <div className="flex items-center pt-3 px-1">
                          <FiArrowRight className={`w-4 h-4 flex-shrink-0 ${
                            status === 'complete' ? 'text-emerald-400' : 'text-slate-200'
                          }`} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Mobile: Vertical layout */}
            <div className="md:hidden space-y-0">
              {workflowSteps.map((step, index) => {
                const status = getStepStatus(step);
                return (
                  <div key={step.step} className="flex items-start">
                    {/* Timeline connector */}
                    <div className="flex flex-col items-center flex-shrink-0">
                      <button
                        onClick={() => handleNavigate(step.route)}
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-200 ${
                          status === 'complete'
                            ? 'bg-emerald-500 text-white shadow-sm'
                            : status === 'current'
                            ? 'bg-green-500 text-white shadow-sm ring-2 ring-green-100'
                            : 'bg-slate-100 text-slate-400'
                        }`}
                      >
                        {status === 'complete' ? <FiCheck className="w-4 h-4" /> : step.step}
                      </button>
                      {index < workflowSteps.length - 1 && (
                        <div className={`w-0.5 h-8 ${
                          status === 'complete' ? 'bg-emerald-300' : 'bg-slate-200'
                        }`} />
                      )}
                    </div>
                    {/* Step content */}
                    <button
                      onClick={() => handleNavigate(step.route)}
                      className="flex-1 ml-3 pb-3 text-left group"
                    >
                      <div className="flex items-center gap-2">
                        <p
                          className={`text-xs font-semibold ${
                            status === 'complete'
                              ? 'text-emerald-600'
                              : status === 'current'
                              ? 'text-green-600'
                              : 'text-slate-400'
                          }`}
                        >
                          {step.title}
                        </p>
                        {status === 'current' && (
                          <span className="text-[9px] font-medium text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full">
                            Next Step
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-thb-text-muted mt-0.5 leading-relaxed">
                        {step.description}
                      </p>
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 mt-4 pt-3 border-t border-slate-100">
              <div className="flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center">
                  <FiCheck className="w-2.5 h-2.5 text-white" />
                </span>
                <span className="text-[10px] text-thb-text-muted">Complete</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
                  <span className="text-[8px] text-white font-bold">•</span>
                </span>
                <span className="text-[10px] text-thb-text-muted">Current Step</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-slate-100" />
                <span className="text-[10px] text-thb-text-muted">Pending</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Sub-module Tiles — Grouped by Category */}
      <div className="space-y-8">
        {(['masters', 'transactions', 'reports'] as const).map((catKey) => {
          const cat = categoryConfig[catKey];
          const catTiles = subModules.filter(s => s.category === catKey);
          const CatIcon = cat.icon;
          return (
            <div key={catKey}>
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${cat.gradientFrom} ${cat.gradientTo} flex items-center justify-center shadow-sm`}>
                  <CatIcon className="w-4.5 h-4.5 text-white" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-thb-text-primary">{cat.label}</h2>
                  <p className="text-xs text-thb-text-muted">{cat.description}</p>
                </div>
                <span className="ml-auto text-[10px] font-semibold text-thb-text-muted bg-slate-100 px-2 py-0.5 rounded-full">{catTiles.length} modules</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {catTiles.map((tile) => {
                  const IconComp = tile.icon;
                  return (
                    <button
                      key={tile.route}
                      onClick={() => handleNavigate(tile.route)}
                      className="thb-card thb-card-hover p-5 text-left group transition-all duration-200 hover:shadow-md"
                    >
                      <div className="flex items-start gap-4">
                        <div
                          className={`w-12 h-12 rounded-xl ${tile.gradientBg} flex items-center justify-center ${tile.iconColor} ring-1 ${tile.ringColor} flex-shrink-0 transition-transform duration-200 group-hover:scale-110`}
                        >
                          <IconComp className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <h3 className="text-sm font-semibold text-thb-text-primary group-hover:text-green-600 transition-colors inline-flex items-center gap-2">
                              {tile.title}
                              {tile.isNew && <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-teal-100 text-teal-700 uppercase tracking-wide">New</span>}
                            </h3>
                            <FiArrowRight className="w-4 h-4 text-thb-text-muted opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex-shrink-0" />
                          </div>
                          <p className="text-xs text-thb-text-muted mt-1 leading-relaxed">
                            {tile.description}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
