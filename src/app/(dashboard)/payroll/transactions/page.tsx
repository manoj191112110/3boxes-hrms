'use client';

import Link from 'next/link';
import { FiEdit3, FiPlayCircle, FiActivity, FiDollarSign, FiTruck, FiLock, FiCheckSquare, FiFile, FiGlobe, FiUserCheck, FiCpu, FiArrowRight } from 'react-icons/fi';
import { useCompanyContextStore } from '@/store/companyContextStore';

interface TransactionTile {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  route: string;
  description: string;
  gradientBg: string;
  iconColor: string;
  ringColor: string;
  isNew?: boolean;
}

const transactions: TransactionTile[] = [
  {
    title: 'Payroll Inputs',
    icon: FiEdit3,
    route: '/payroll/inputs',
    description: 'Manage attendance, leave, OT, and variable pay inputs',
    gradientBg: 'bg-rose-500/10',
    iconColor: 'text-rose-500',
    ringColor: 'ring-rose-500/20',
  },
  {
    title: 'Pre-Payroll Validation',
    icon: FiCheckSquare,
    route: '/payroll/validations',
    description: 'Validate employee data before processing payroll',
    gradientBg: 'bg-emerald-500/10',
    iconColor: 'text-emerald-500',
    ringColor: 'ring-emerald-500/20',
  },
  {
    title: 'Payroll Processing',
    icon: FiPlayCircle,
    route: '/payroll/processing',
    description: 'Run payroll cycles, review, and approve',
    gradientBg: 'bg-cyan-500/10',
    iconColor: 'text-cyan-500',
    ringColor: 'ring-cyan-500/20',
  },
  {
    title: 'Overtime',
    icon: FiActivity,
    route: '/payroll/overtime',
    description: 'Track overtime hours, approvals, and payments',
    gradientBg: 'bg-fuchsia-500/10',
    iconColor: 'text-fuchsia-500',
    ringColor: 'ring-fuchsia-500/20',
  },
  {
    title: 'Loans',
    icon: FiDollarSign,
    route: '/payroll/loans',
    description: 'Manage employee loans, EMI tracking, and recovery',
    gradientBg: 'bg-yellow-500/10',
    iconColor: 'text-yellow-500',
    ringColor: 'ring-yellow-500/20',
  },
  {
    title: 'F&F Settlement',
    icon: FiTruck,
    route: '/payroll/fnf',
    description: 'Full and Final settlement for exiting employees',
    gradientBg: 'bg-red-500/10',
    iconColor: 'text-red-500',
    ringColor: 'ring-red-500/20',
  },
  {
    title: 'Payroll Holds',
    icon: FiLock,
    route: '/payroll/holds',
    description: 'Hold or suspend employee payroll processing',
    gradientBg: 'bg-gray-500/10',
    iconColor: 'text-gray-500',
    ringColor: 'ring-gray-500/20',
  },
  {
    title: 'Bank File Generation',
    icon: FiFile,
    route: '/payroll/bank-files',
    description: 'Generate NACH/NEFT/RTGS bank payment files',
    gradientBg: 'bg-green-500/10',
    iconColor: 'text-green-500',
    ringColor: 'ring-green-500/20',
  },
  {
    title: 'Payslips',
    icon: FiFile,
    route: '/payroll/payslips',
    description: 'Generate, view, and print employee payslips',
    gradientBg: 'bg-pink-500/10',
    iconColor: 'text-pink-500',
    ringColor: 'ring-pink-500/20',
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
  },
];

export default function PayrollTransactionsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <FiEdit3 className="w-6 h-6 text-green-500" />
          Payroll Transactions
        </h1>
        <p className="text-sm text-slate-500 mt-1">Process payroll runs, manage inputs, approvals, and employee payments</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {transactions.map((t) => {
          const IconComp = t.icon;
          return (
            <Link
              key={t.route}
              href={t.route}
              className="thb-card p-4 hover:shadow-md transition-all group cursor-pointer"
            >
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-lg ${t.gradientBg} ring-1 ${t.ringColor} flex items-center justify-center flex-shrink-0`}>
                  <IconComp className={`w-5 h-5 ${t.iconColor}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-slate-800 group-hover:text-green-600 transition-colors">{t.title}</h3>
                    {t.isNew && <span className="text-[9px] font-bold uppercase px-1 py-0.5 rounded bg-teal-100 text-teal-700">New</span>}
                  </div>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2">{t.description}</p>
                </div>
                <FiArrowRight className="w-4 h-4 text-slate-300 group-hover:text-green-500 transition-colors flex-shrink-0 mt-1" />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
