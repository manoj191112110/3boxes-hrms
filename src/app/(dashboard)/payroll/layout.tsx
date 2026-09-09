'use client';

/**
 * Payroll Layout — wraps every /payroll/* page with a breadcrumb bar.
 *
 * Navigation is now driven by sidebar sub-sections with dividers:
 *   • Group Dashboard + Payroll Dashboard  (top-level)
 *   • Payroll Masters    (CTC Templates, Component Master, etc.)
 *   • Payroll Transactions (Inputs, Processing, Loans, etc.)
 *   • Payroll Reports
 *
 * The top bar shows:  Payroll > Section > Page  as a breadcrumb trail,
 * with the section links always visible for quick navigation.
 */

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { FiDollarSign, FiChevronRight, FiDatabase, FiEdit3, FiFileText, FiGlobe, FiGrid } from 'react-icons/fi';

/* ── Route-to-section mapping ───────────────────────────────────────── */

interface PageInfo {
  section: 'dashboard' | 'masters' | 'transactions' | 'reports';
  label: string;
}

const routeMap: Record<string, PageInfo> = {
  // Dashboard
  '/payroll':               { section: 'dashboard',    label: 'Payroll Dashboard' },
  '/payroll/group-dashboard': { section: 'dashboard',  label: 'Group Dashboard' },

  // Masters
  '/payroll/ctc-templates':   { section: 'masters',      label: 'CTC Templates' },
  '/payroll/components':      { section: 'masters',      label: 'Component Master' },
  '/payroll/definitions':     { section: 'masters',      label: 'Payroll Definitions' },
  '/payroll/ctc-calculator':  { section: 'masters',      label: 'CTC Calculator' },
  '/payroll/salary-settings': { section: 'masters',      label: 'Salary Settings' },
  '/payroll/income-tax':      { section: 'masters',      label: 'Income Tax' },
  '/payroll/tax-slabs':       { section: 'masters',      label: 'Tax Slabs' },
  '/payroll/statutory':       { section: 'masters',      label: 'Statutory Components' },
  '/payroll/gratuity':        { section: 'masters',      label: 'Gratuity' },
  '/payroll/currency':        { section: 'masters',      label: 'Currency & FX' },
  '/payroll/dimensions':      { section: 'masters',      label: 'Dimensions' },
  '/payroll/payment-methods': { section: 'masters',      label: 'Payment Methods' },

  // Transactions
  '/payroll/inputs':          { section: 'transactions',  label: 'Payroll Inputs' },
  '/payroll/validations':     { section: 'transactions',  label: 'Pre-Payroll Validation' },
  '/payroll/processing':      { section: 'transactions',  label: 'Payroll Processing' },
  '/payroll/overtime':        { section: 'transactions',  label: 'Overtime' },
  '/payroll/loans':           { section: 'transactions',  label: 'Loans' },
  '/payroll/fnf':             { section: 'transactions',  label: 'F&F Settlement' },
  '/payroll/holds':           { section: 'transactions',  label: 'Payroll Holds' },
  '/payroll/bank-files':      { section: 'transactions',  label: 'Bank File Generation' },
  '/payroll/payslips':        { section: 'transactions',  label: 'Payslips' },
  '/payroll/secondment':      { section: 'transactions',  label: 'Cross-Border Secondment' },
  '/payroll/approvals':       { section: 'transactions',  label: 'Payroll Approvals' },
  '/payroll/ai-insights':     { section: 'transactions',  label: 'AI Insights' },

  // Reports
  '/payroll/reports':         { section: 'reports',       label: 'Reports & Dashboard' },
};

const sectionMeta: Record<string, { href: string; label: string; icon: React.ComponentType<{ className?: string }> }> = {
  dashboard:    { href: '/payroll',              label: 'Dashboard',    icon: FiGrid },
  masters:      { href: '/payroll/ctc-templates', label: 'Masters',     icon: FiDatabase },
  transactions: { href: '/payroll/inputs',       label: 'Transactions', icon: FiEdit3 },
  reports:      { href: '/payroll/reports',       label: 'Reports',     icon: FiFileText },
};

/* ── Component ──────────────────────────────────────────────────────── */

function PayrollBreadcrumb() {
  const pathname = usePathname();

  // Resolve current page info
  const pageInfo = routeMap[pathname || ''];

  // Determine active section from path or page info
  const currentSection = pageInfo?.section ??
    (pathname?.startsWith('/payroll/reports') ? 'reports' :
     pathname?.startsWith('/payroll/inputs') || pathname?.startsWith('/payroll/validations') ||
     pathname?.startsWith('/payroll/processing') || pathname?.startsWith('/payroll/overtime') ||
     pathname?.startsWith('/payroll/loans') || pathname?.startsWith('/payroll/fnf') ||
     pathname?.startsWith('/payroll/holds') || pathname?.startsWith('/payroll/bank-files') ||
     pathname?.startsWith('/payroll/payslips') || pathname?.startsWith('/payroll/secondment') ||
     pathname?.startsWith('/payroll/approvals') || pathname?.startsWith('/payroll/ai-insights')
     ? 'transactions' :
     pathname?.startsWith('/payroll/ctc') || pathname?.startsWith('/payroll/components') ||
     pathname?.startsWith('/payroll/definitions') || pathname?.startsWith('/payroll/salary') ||
     pathname?.startsWith('/payroll/income-tax') || pathname?.startsWith('/payroll/tax-slabs') ||
     pathname?.startsWith('/payroll/statutory') || pathname?.startsWith('/payroll/gratuity') ||
     pathname?.startsWith('/payroll/currency') || pathname?.startsWith('/payroll/dimensions') ||
     pathname?.startsWith('/payroll/payment')
     ? 'masters' : 'dashboard');

  const isLanding = pathname === '/payroll';

  return (
    <div className="thb-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-emerald-50/50 to-teal-50/50 border-b border-thb-border">
        {/* Breadcrumb trail */}
        <div className="flex items-center gap-2 text-sm">
          <Link
            href="/payroll"
            className="flex items-center gap-1.5 font-semibold text-thb-text-primary hover:text-emerald-600 transition-colors"
          >
            <FiDollarSign className="w-4 h-4 text-emerald-500" />
            Payroll
          </Link>

          {/* Section level */}
          {pageInfo && pageInfo.section !== 'dashboard' && (
            <>
              <FiChevronRight className="w-3 h-3 text-thb-text-muted" />
              <Link
                href={sectionMeta[pageInfo.section].href}
                className="text-thb-text-secondary hover:text-emerald-600 transition-colors"
              >
                {sectionMeta[pageInfo.section].label}
              </Link>
            </>
          )}

          {/* Page level — for sub-pages */}
          {pageInfo && pageInfo.section !== 'dashboard' && !isLanding && (
            <>
              <FiChevronRight className="w-3 h-3 text-thb-text-muted" />
              <span className="font-medium text-emerald-700">{pageInfo.label}</span>
            </>
          )}

          {/* Dashboard landing */}
          {isLanding && (
            <span className="ml-2 text-xs text-thb-text-muted">Overview</span>
          )}
        </div>

        {/* Section quick-links (always visible) */}
        <div className="flex items-center gap-1">
          {(['dashboard', 'masters', 'transactions', 'reports'] as const).map((key) => {
            const meta = sectionMeta[key];
            const Icon = meta.icon;
            const isActive = currentSection === key;
            const colorMap = {
              dashboard: 'bg-green-100 text-green-700 border border-green-200',
              masters: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
              transactions: 'bg-teal-100 text-teal-700 border border-teal-200',
              reports: 'bg-amber-100 text-amber-700 border border-amber-200',
            };
            return (
              <Link
                key={key}
                href={meta.href}
                className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  isActive
                    ? colorMap[key]
                    : 'text-thb-text-secondary hover:bg-slate-100 hover:text-thb-text-primary'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {meta.label}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ── Layout ─────────────────────────────────────────────────────────── */

export default function PayrollLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <PayrollBreadcrumb />
      {children}
    </div>
  );
}
