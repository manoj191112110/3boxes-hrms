'use client';

import Link from 'next/link';
import { FiLayers, FiDatabase, FiShield, FiBarChart2, FiEdit3, FiPercent, FiClipboard, FiDollarSign, FiGrid, FiGlobe, FiArrowRight } from 'react-icons/fi';
import { useCompanyContextStore } from '@/store/companyContextStore';

interface MasterTile {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  route: string;
  description: string;
  gradientBg: string;
  iconColor: string;
  ringColor: string;
  isNew?: boolean;
}

const masters: MasterTile[] = [
  {
    title: 'CTC Templates',
    icon: FiLayers,
    route: '/payroll/ctc-templates',
    description: 'Define and manage Cost to Company salary structures',
    gradientBg: 'bg-green-500/10',
    iconColor: 'text-green-500',
    ringColor: 'ring-green-500/20',
  },
  {
    title: 'CTC Calculator',
    icon: FiPercent,
    route: '/payroll/ctc-calculator',
    description: 'Calculate CTC breakdown - earnings, deductions, and take-home pay',
    gradientBg: 'bg-emerald-500/10',
    iconColor: 'text-emerald-500',
    ringColor: 'ring-emerald-500/20',
  },
  {
    title: 'Component Master',
    icon: FiDatabase,
    route: '/payroll/components',
    description: 'Configure payroll earnings, deductions, and allowances',
    gradientBg: 'bg-teal-500/10',
    iconColor: 'text-teal-500',
    ringColor: 'ring-teal-500/20',
  },
  {
    title: 'Salary Settings',
    icon: FiEdit3,
    route: '/payroll/salary-settings',
    description: 'Configure DA/HRA, PF, ESI, TDS, PT, Gratuity, LWF rates',
    gradientBg: 'bg-rose-500/10',
    iconColor: 'text-rose-500',
    ringColor: 'ring-rose-500/20',
  },
  {
    title: 'Payroll Definitions',
    icon: FiClipboard,
    route: '/payroll/definitions',
    description: 'Configure pay frequency, cut-off dates, and costing segments',
    gradientBg: 'bg-sky-500/10',
    iconColor: 'text-sky-500',
    ringColor: 'ring-sky-500/20',
  },
  {
    title: 'Income Tax',
    icon: FiBarChart2,
    route: '/payroll/income-tax',
    description: 'Income tax calculator and declaration management',
    gradientBg: 'bg-amber-500/10',
    iconColor: 'text-amber-500',
    ringColor: 'ring-amber-500/20',
  },
  {
    title: 'Tax Slabs',
    icon: FiBarChart2,
    route: '/payroll/tax-slabs',
    description: 'Configure progressive income tax slab rates',
    gradientBg: 'bg-amber-500/10',
    iconColor: 'text-amber-500',
    ringColor: 'ring-amber-500/20',
  },
  {
    title: 'Statutory Components',
    icon: FiShield,
    route: '/payroll/statutory',
    description: 'Country-specific tax, PF, ESI, and compliance setup',
    gradientBg: 'bg-emerald-500/10',
    iconColor: 'text-emerald-500',
    ringColor: 'ring-emerald-500/20',
  },
  {
    title: 'Gratuity',
    icon: FiDollarSign,
    route: '/payroll/gratuity',
    description: 'Gratuity calculation and projection as per Act 1972',
    gradientBg: 'bg-teal-500/10',
    iconColor: 'text-teal-500',
    ringColor: 'ring-teal-500/20',
  },
  {
    title: 'Currency & FX',
    icon: FiGlobe,
    route: '/payroll/currency',
    description: 'Multi-currency configuration and exchange rates',
    gradientBg: 'bg-teal-500/10',
    iconColor: 'text-teal-500',
    ringColor: 'ring-teal-500/20',
  },
  {
    title: 'Dimensions',
    icon: FiGrid,
    route: '/payroll/dimensions',
    description: 'Multi-dimensional cost allocation setup',
    gradientBg: 'bg-orange-500/10',
    iconColor: 'text-orange-500',
    ringColor: 'ring-orange-500/20',
  },
  {
    title: 'Payment Methods',
    icon: FiDollarSign,
    route: '/payroll/payment-methods',
    description: 'Employee bank details, split payments, and payment setup',
    gradientBg: 'bg-lime-500/10',
    iconColor: 'text-lime-500',
    ringColor: 'ring-lime-500/20',
  },
];

export default function PayrollMastersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <FiDatabase className="w-6 h-6 text-emerald-500" />
          Payroll Masters
        </h1>
        <p className="text-sm text-slate-500 mt-1">Configure salary structures, statutory components, tax slabs, and payment methods</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {masters.map((m) => {
          const IconComp = m.icon;
          return (
            <Link
              key={m.route}
              href={m.route}
              className="thb-card p-4 hover:shadow-md transition-all group cursor-pointer"
            >
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-lg ${m.gradientBg} ring-1 ${m.ringColor} flex items-center justify-center flex-shrink-0`}>
                  <IconComp className={`w-5 h-5 ${m.iconColor}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-slate-800 group-hover:text-emerald-600 transition-colors">{m.title}</h3>
                    {m.isNew && <span className="text-[9px] font-bold uppercase px-1 py-0.5 rounded bg-teal-100 text-teal-700">New</span>}
                  </div>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2">{m.description}</p>
                </div>
                <FiArrowRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-500 transition-colors flex-shrink-0 mt-1" />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
