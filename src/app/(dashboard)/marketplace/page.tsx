'use client';
import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { FiShoppingBag, FiGrid, FiFileText, FiBarChart2 } from 'react-icons/fi';
import ModuleDashboardShell, { DashboardTabConfig } from '@/components/ModuleDashboardShell';
import SeedEcosystemButton from '@/components/SeedEcosystemButton';
import { useAutoSeedDemo } from '@/hooks/useAutoSeedDemo';

const marketplaceTabs: DashboardTabConfig[] = [
  { label: 'Overview', key: 'overview', icon: <FiGrid className="w-4 h-4" /> },
  { label: 'Reports', key: 'reports', icon: <FiFileText className="w-4 h-4" />, isNew: true },
];

function MarketplaceReportsPlaceholder() {
  return (
    <div className="flex flex-col items-center py-8">
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg mb-4">
        <FiFileText className="w-7 h-7 text-white" />
      </div>
      <h3 className="text-lg font-bold text-thb-text-primary mb-1">Reports & Analytics</h3>
      <p className="text-sm text-thb-text-secondary text-center max-w-md mb-4">
        Wallet usage analytics, spending reports, and wellness program metrics
      </p>
      <a href="/marketplace/insights" className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors">
        <FiBarChart2 className="w-4 h-4" /> Go to Reports
      </a>
    </div>
  );
}

function MarketplacePageContent() {
  return (
    <ModuleDashboardShell
      moduleKey="marketplace"
      moduleLabel="Marketplace & Wellness"
      moduleIcon={<FiShoppingBag className="w-5 h-5 text-white" />}
      gradientColor="from-rose-500 to-pink-600"
      tabs={marketplaceTabs}
      overviewContent={<MarketplaceContent />}
      children={{
        reports: <MarketplaceReportsPlaceholder />,
      }}
    />
  );
}

export default function MarketplaceHub() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-20"><div className="animate-spin w-8 h-8 border-2 border-rose-500 border-t-transparent rounded-full" /></div>}>
      <MarketplacePageContent />
    </Suspense>
  );
}

function MarketplaceContent() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Silently trigger demo-data seed on first load so the Vercel deployment
  // always shows marketplace content without an admin having to click.
  const { seeded } = useAutoSeedDemo('marketplace');

  const tiles = [
    { href: '/marketplace/wallet', title: 'My Wallet', desc: 'Multi-bucket wallet · Co-pay · Tax-exempt categories', icon: '👛', color: 'from-teal-500 to-pink-500' },
    { href: '/marketplace/catalog', title: 'Corporate Catalog', desc: 'Sodexo · Xoxoday · Amazon Business · Corporate rates', icon: '🛍️', color: 'from-green-500 to-cyan-500' },
    { href: '/marketplace/insurance', title: 'Insurance Top-Up', desc: 'Group + voluntary · AI claims assistant · Payroll deduction', icon: '🛡️', color: 'from-green-500 to-emerald-500' },
    { href: '/marketplace/ewa', title: 'Earned Wage Access', desc: 'Real-time earned-to-date · Wagestream/EarnIn API · 70% cap', icon: '💸', color: 'from-yellow-500 to-orange-500' },
    { href: '/marketplace/loans', title: 'Loan Marketplace', desc: 'Pre-approved offers · e-sign consent · Garnishment', icon: '🏦', color: 'from-emerald-500 to-green-500' },
    { href: '/marketplace/gifting', title: 'Gifting & Rewards', desc: 'Milestone automation · P2P kudos · Wallet redemption', icon: '🎁', color: 'from-red-500 to-pink-500' },
    { href: '/marketplace/insights', title: 'AI Insights (Admin)', desc: 'Financial stress · Fraud patterns · Wallet audit trail', icon: '🧠', color: 'from-gray-700 to-gray-900' },
  ];
  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Marketplace & Financial Wellness</h1>
          <p className="text-sm text-gray-600 mt-1">Corporate Super-App · Multi-currency · Multi-tenant · AI-curated</p>
        </div>
        {mounted && <SeedEcosystemButton module="marketplace" label="Seed Marketplace Data" />}
      </div>
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
        <b>Admins:</b> Use the <b>Seed Marketplace Data</b> button above to populate sample providers, products, wallets, transactions, orders, fraud flags & budget allocations. To also seed wellness/insurance data, visit the <Link href="/marketplace/insurance" className="underline">Insurance Top-Up</Link> page.
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tiles.map(t => (
          <Link key={t.href} href={t.href} className="block group">
            <div className={`bg-gradient-to-br ${t.color} text-white rounded-lg p-5 shadow-lg group-hover:shadow-2xl transition-shadow`}>
              <div className="text-3xl mb-2">{t.icon}</div>
              <h3 className="text-lg font-bold">{t.title}</h3>
              <p className="text-xs opacity-90 mt-1">{t.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
