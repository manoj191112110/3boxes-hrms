'use client';

import { useState, useMemo, Suspense } from 'react';
import {
  FiDollarSign, FiTrendingUp, FiTrendingDown, FiFileText, FiAlertCircle,
  FiPlus, FiDownload, FiRefreshCw, FiSearch, FiFilter, FiChevronRight,
  FiBookOpen, FiCreditCard, FiBarChart2, FiCheck, FiX, FiCalendar,
  FiArrowUp, FiArrowDown, FiEye, FiEdit2, FiTrash2, FiGrid, FiSettings,
} from 'react-icons/fi';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import toast from 'react-hot-toast';
import ModuleDashboardShell, { DashboardTabConfig } from '@/components/ModuleDashboardShell';
import { useAuthStore } from '@/store/authStore';
import { isClientDemoMode } from '@/lib/site-mode';

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

// ── Demo Data (LIVE shows empty — GOLDEN RULE: no dummy data on live) ──
const revenueExpenseData = isClientDemoMode() ? [
  { month: 'Jan', revenue: 185000, expenses: 142000 },
  { month: 'Feb', revenue: 198000, expenses: 138000 },
  { month: 'Mar', revenue: 210000, expenses: 155000 },
  { month: 'Apr', revenue: 225000, expenses: 148000 },
  { month: 'May', revenue: 240000, expenses: 162000 },
  { month: 'Jun', revenue: 235000, expenses: 158000 },
  { month: 'Jul', revenue: 260000, expenses: 170000 },
  { month: 'Aug', revenue: 255000, expenses: 165000 },
  { month: 'Sep', revenue: 270000, expenses: 172000 },
  { month: 'Oct', revenue: 285000, expenses: 180000 },
  { month: 'Nov', revenue: 290000, expenses: 175000 },
  { month: 'Dec', revenue: 310000, expenses: 185000 },
] : [];

const accountBalanceData = isClientDemoMode() ? [
  { name: 'Assets', value: 1250000, color: '#3b82f6' },
  { name: 'Liabilities', value: 450000, color: '#ef4444' },
  { name: 'Equity', value: 380000, color: '#8b5cf6' },
  { name: 'Revenue', value: 850000, color: '#10b981' },
  { name: 'Expenses', value: 620000, color: '#f59e0b' },
] : [];

const budgetVsActualData = isClientDemoMode() ? [
  { category: 'Salaries', budget: 500000, actual: 485000 },
  { category: 'Operations', budget: 200000, actual: 215000 },
  { category: 'Marketing', budget: 150000, actual: 132000 },
  { category: 'IT', budget: 120000, actual: 118000 },
  { category: 'Travel', budget: 80000, actual: 92000 },
  { category: 'Utilities', budget: 60000, actual: 58000 },
] : [];

const recentTransactions = isClientDemoMode() ? [
  { id: 'TXN001', date: '2026-06-30', account: 'Cash', description: 'Client Payment - ABC Corp', debit: 75000, credit: 0, status: 'posted' },
  { id: 'TXN002', date: '2026-06-30', account: 'Revenue', description: 'Service Revenue - Q2', debit: 0, credit: 75000, status: 'posted' },
  { id: 'TXN003', date: '2026-06-29', account: 'Bank', description: 'Salary Disbursement', debit: 0, credit: 450000, status: 'posted' },
  { id: 'TXN004', date: '2026-06-29', account: 'Salaries Expense', description: 'June Payroll', debit: 450000, credit: 0, status: 'posted' },
  { id: 'TXN005', date: '2026-06-28', account: 'Office Supplies', description: 'Stationery Purchase', debit: 3500, credit: 0, status: 'draft' },
  { id: 'TXN006', date: '2026-06-28', account: 'Cash', description: 'Petty Cash Reimbursement', debit: 0, credit: 3500, status: 'draft' },
  { id: 'TXN007', date: '2026-06-27', account: 'Rent Expense', description: 'Office Rent - July', debit: 85000, credit: 0, status: 'posted' },
  { id: 'TXN008', date: '2026-06-27', account: 'Bank', description: 'Rent Payment', debit: 0, credit: 85000, status: 'posted' },
] : [];

const chartOfAccounts = isClientDemoMode() ? [
  { code: '1000', name: 'Cash', type: 'Asset', balance: 245000, status: 'active' },
  { code: '1100', name: 'Bank - HDFC', type: 'Asset', balance: 890000, status: 'active' },
  { code: '1200', name: 'Accounts Receivable', type: 'Asset', balance: 345000, status: 'active' },
  { code: '1300', name: 'Inventory', type: 'Asset', balance: 125000, status: 'active' },
  { code: '1500', name: 'Fixed Assets', type: 'Asset', balance: 650000, status: 'active' },
  { code: '2000', name: 'Accounts Payable', type: 'Liability', balance: 280000, status: 'active' },
  { code: '2100', name: 'Accrued Expenses', type: 'Liability', balance: 95000, status: 'active' },
  { code: '2200', name: 'Tax Payable', type: 'Liability', balance: 75000, status: 'active' },
  { code: '3000', name: 'Owner Equity', type: 'Equity', balance: 500000, status: 'active' },
  { code: '3100', name: 'Retained Earnings', type: 'Equity', balance: 380000, status: 'active' },
  { code: '4000', name: 'Service Revenue', type: 'Revenue', balance: 850000, status: 'active' },
  { code: '4100', name: 'Product Revenue', type: 'Revenue', balance: 320000, status: 'active' },
  { code: '5000', name: 'Salaries Expense', type: 'Expense', balance: 450000, status: 'active' },
  { code: '5100', name: 'Rent Expense', type: 'Expense', balance: 85000, status: 'active' },
  { code: '5200', name: 'Utilities Expense', type: 'Expense', balance: 58000, status: 'active' },
] : [];

const journalEntries = isClientDemoMode() ? [
  { id: 'JE001', date: '2026-06-30', description: 'Client Payment Received', debitTotal: 75000, creditTotal: 75000, status: 'posted' },
  { id: 'JE002', date: '2026-06-29', description: 'Payroll Disbursement', debitTotal: 450000, creditTotal: 450000, status: 'posted' },
  { id: 'JE003', date: '2026-06-28', description: 'Office Supplies Purchase', debitTotal: 3500, creditTotal: 3500, status: 'draft' },
  { id: 'JE004', date: '2026-06-27', description: 'Rent Payment', debitTotal: 85000, creditTotal: 85000, status: 'posted' },
  { id: 'JE005', date: '2026-06-26', description: 'Equipment Depreciation', debitTotal: 12000, creditTotal: 12000, status: 'posted' },
  { id: 'JE006', date: '2026-06-25', description: 'Tax Provision', debitTotal: 45000, creditTotal: 45000, status: 'draft' },
] : [];

const ledgerEntries = isClientDemoMode() ? [
  { date: '2026-06-30', particulars: 'Client Payment - ABC Corp', debit: 75000, credit: 0, balance: 245000 },
  { date: '2026-06-29', particulars: 'Salary Disbursement', debit: 0, credit: 450000, balance: 170000 },
  { date: '2026-06-28', particulars: 'Petty Cash Reimbursement', debit: 0, credit: 3500, balance: 620000 },
  { date: '2026-06-27', particulars: 'Rent Payment', debit: 0, credit: 85000, balance: 623500 },
  { date: '2026-06-26', particulars: 'Transfer from Bank', debit: 500000, credit: 0, balance: 708500 },
] : [];

type TabKey = 'overview' | 'chart-of-accounts' | 'journal-entries' | 'general-ledger' | 'financial-statements';

const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: 'overview', label: 'Overview', icon: <FiBarChart2 className="w-4 h-4" /> },
  { key: 'chart-of-accounts', label: 'Chart of Accounts', icon: <FiBookOpen className="w-4 h-4" /> },
  { key: 'journal-entries', label: 'Journal Entries', icon: <FiFileText className="w-4 h-4" /> },
  { key: 'general-ledger', label: 'General Ledger', icon: <FiCreditCard className="w-4 h-4" /> },
  { key: 'financial-statements', label: 'Financial Statements', icon: <FiTrendingUp className="w-4 h-4" /> },
];

/* ── ModuleDashboardShell Tabs ── */
const accountsShellTabs: DashboardTabConfig[] = [
  { label: 'Overview', key: 'overview', icon: <FiGrid className="w-4 h-4" /> },
  { label: 'Reports', key: 'reports', icon: <FiFileText className="w-4 h-4" />, isNew: true },
  { label: 'Settings', key: 'settings', icon: <FiSettings className="w-4 h-4" />, isNew: true },
];

function AccountsReportsPlaceholder() {
  return (
    <div className="flex flex-col items-center py-8">
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg mb-4">
        <FiFileText className="w-7 h-7 text-white" />
      </div>
      <h3 className="text-lg font-bold text-thb-text-primary mb-1">Reports & Analytics</h3>
      <p className="text-sm text-thb-text-secondary text-center max-w-md mb-4">
        Financial statements, trial balance, and custom accounting reports
      </p>
      <a href="/accounts/reports" className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors">
        <FiBarChart2 className="w-4 h-4" /> Go to Reports
      </a>
    </div>
  );
}

function AccountsSettingsPlaceholder() {
  return (
    <div className="flex flex-col items-center py-8">
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-slate-500 to-slate-700 flex items-center justify-center shadow-lg mb-4">
        <FiSettings className="w-7 h-7 text-white" />
      </div>
      <h3 className="text-lg font-bold text-thb-text-primary mb-1">Settings & Configuration</h3>
      <p className="text-sm text-thb-text-secondary text-center max-w-md mb-4">
        Configure fiscal year, currency, tax settings, and automation preferences
      </p>
      <a href="/accounts/settings" className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors">
        <FiSettings className="w-4 h-4" /> Go to Settings
      </a>
    </div>
  );
}

function getStatusBadge(status: string) {
  const map: Record<string, string> = {
    posted: 'thb-badge thb-badge-success',
    draft: 'thb-badge thb-badge-warning',
    void: 'thb-badge thb-badge-error',
    active: 'thb-badge thb-badge-success',
    inactive: 'thb-badge thb-badge-info',
  };
  return map[status] || 'thb-badge thb-badge-info';
}

function getTypeColor(type: string) {
  const map: Record<string, string> = {
    Asset: 'bg-green-100 text-green-700',
    Liability: 'bg-red-100 text-red-700',
    Equity: 'bg-teal-100 text-teal-700',
    Revenue: 'bg-emerald-100 text-emerald-700',
    Expense: 'bg-amber-100 text-amber-700',
  };
  return map[type] || 'bg-slate-100 text-slate-700';
}

export default function AccountsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-20"><div className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full" /></div>}>
      <AccountsPageContent />
    </Suspense>
  );
}

function AccountsPageContent() {
  return (
    <ModuleDashboardShell
      moduleKey="accounts"
      moduleLabel="Accounts & Finance"
      moduleIcon={<FiCreditCard className="w-5 h-5 text-white" />}
      gradientColor="from-emerald-500 to-green-600"
      tabs={accountsShellTabs}
      overviewContent={<AccountsContent />}
      children={{
        reports: <AccountsReportsPlaceholder />,
        settings: <AccountsSettingsPlaceholder />,
      }}
    />
  );
}

function AccountsContent() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [showAddAccountModal, setShowAddAccountModal] = useState(false);
  const [showAddJournalModal, setShowAddJournalModal] = useState(false);
  const [selectedLedgerAccount, setSelectedLedgerAccount] = useState('1000 - Cash');

  const filteredAccounts = useMemo(() => {
    return chartOfAccounts.filter(a => {
      const matchSearch = a.name.toLowerCase().includes(searchTerm.toLowerCase()) || a.code.includes(searchTerm);
      const matchType = filterType === 'all' || a.type === filterType;
      return matchSearch && matchType;
    });
  }, [searchTerm, filterType]);

  const filteredJournalEntries = useMemo(() => {
    return journalEntries.filter(je => je.description.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [searchTerm]);

  const lastEntry = revenueExpenseData[revenueExpenseData.length - 1];
  const netProfit = lastEntry ? lastEntry.revenue - lastEntry.expenses : 0;

  return (
    <div className="space-y-6">
      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {(isClientDemoMode() ? [
          { label: 'Total Revenue', value: '₹31.0L', icon: <FiTrendingUp className="w-5 h-5" />, color: 'text-emerald-600', bg: 'bg-emerald-50', trend: '+8.2%' },
          { label: 'Total Expenses', value: '₹18.5L', icon: <FiTrendingDown className="w-5 h-5" />, color: 'text-red-600', bg: 'bg-red-50', trend: '+3.1%' },
          { label: 'Net Profit', value: `₹${(netProfit / 100000).toFixed(1)}L`, icon: <FiDollarSign className="w-5 h-5" />, color: 'text-green-600', bg: 'bg-green-50', trend: '+12.5%' },
          { label: 'Pending Invoices', value: '12', icon: <FiFileText className="w-5 h-5" />, color: 'text-amber-600', bg: 'bg-amber-50', trend: '-2' },
          { label: 'Overdue Amount', value: '₹4.2L', icon: <FiAlertCircle className="w-5 h-5" />, color: 'text-red-600', bg: 'bg-red-50', trend: '+1' },
          { label: 'Cash Balance', value: '₹11.4L', icon: <FiCreditCard className="w-5 h-5" />, color: 'text-teal-600', bg: 'bg-teal-50', trend: '+5.3%' },
        ] : []).map((stat) => (
          <div key={stat.label} className="thb-card p-4">
            <div className="flex items-center justify-between mb-2">
              <div className={`p-2 rounded-lg ${stat.bg} ${stat.color}`}>{stat.icon}</div>
              <span className={`text-xs font-medium ${stat.color}`}>{stat.trend}</span>
            </div>
            <p className="text-xl font-bold text-thb-text-primary">{stat.value}</p>
            <p className="text-xs text-thb-text-secondary mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'New Journal Entry', icon: <FiPlus className="w-5 h-5" />, onClick: () => setShowAddJournalModal(true), gradient: 'from-green-500 to-emerald-600' },
          { label: 'Record Payment', icon: <FiCreditCard className="w-5 h-5" />, onClick: () => window.location.href = '/accounts/bills', gradient: 'from-emerald-500 to-teal-600' },
          { label: 'Bank Reconciliation', icon: <FiRefreshCw className="w-5 h-5" />, onClick: () => window.location.href = '/accounts/bank-reconciliation', gradient: 'from-amber-500 to-orange-600' },
          { label: 'Generate Report', icon: <FiBarChart2 className="w-5 h-5" />, onClick: () => window.location.href = '/accounts/reports', gradient: 'from-teal-500 to-pink-600' },
        ].map((action) => (
          <button key={action.label} onClick={action.onClick} className={`thb-card p-4 flex items-center gap-3 hover:shadow-md transition-all text-left group`}>
            <div className={`p-2.5 rounded-xl bg-gradient-to-br ${action.gradient} text-white shadow-sm`}>{action.icon}</div>
            <div>
              <p className="text-sm font-semibold text-thb-text-primary group-hover:text-green-600 transition-colors">{action.label}</p>
              <p className="text-xs text-thb-text-secondary">Click to proceed</p>
            </div>
            <FiChevronRight className="w-4 h-4 text-thb-text-muted ml-auto group-hover:text-green-500 transition-colors" />
          </button>
        ))}
      </div>

      {/* Internal Tab Navigation */}
      <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1 overflow-x-auto">
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all duration-200 ${activeTab === tab.key ? 'bg-white text-thb-text-primary shadow-sm' : 'text-thb-text-secondary hover:text-thb-text-primary hover:bg-white/50'}`}>
            <span className={activeTab === tab.key ? 'text-emerald-500' : 'text-thb-text-secondary'}>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Revenue vs Expenses */}
            <div className="thb-card p-5">
              <h3 className="text-sm font-semibold text-thb-text-primary mb-4">Revenue vs Expenses</h3>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={revenueExpenseData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                  <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" tickFormatter={(v: number) => `₹${v / 100000}L`} />
                  <Tooltip formatter={(value: number) => [`₹${value.toLocaleString()}`, '']} />
                  <Legend />
                  <Area type="monotone" dataKey="revenue" stroke="#10b981" fill="#10b981" fillOpacity={0.1} name="Revenue" />
                  <Area type="monotone" dataKey="expenses" stroke="#ef4444" fill="#ef4444" fillOpacity={0.1} name="Expenses" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            {/* Account Balances PieChart */}
            <div className="thb-card p-5">
              <h3 className="text-sm font-semibold text-thb-text-primary mb-4">Account Balances Distribution</h3>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={accountBalanceData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value" label={({ name, percent }: { name: string; percent: number }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {accountBalanceData.map((entry, index) => <Cell key={index} fill={entry.color} />)}
                  </Pie>
                  <Tooltip formatter={(value: number) => [`₹${value.toLocaleString()}`, '']} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Budget vs Actual */}
            <div className="thb-card p-5">
              <h3 className="text-sm font-semibold text-thb-text-primary mb-4">Budget vs Actual</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={budgetVsActualData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis type="number" tick={{ fontSize: 11 }} stroke="#94a3b8" tickFormatter={(v: number) => `₹${v / 1000}K`} />
                  <YAxis type="category" dataKey="category" tick={{ fontSize: 11 }} stroke="#94a3b8" width={80} />
                  <Tooltip formatter={(value: number) => [`₹${value.toLocaleString()}`, '']} />
                  <Legend />
                  <Bar dataKey="budget" fill="#3b82f6" name="Budget" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="actual" fill="#10b981" name="Actual" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            {/* Recent Transactions */}
            <div className="thb-card p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-thb-text-primary">Recent Transactions</h3>
                <button onClick={() => setActiveTab('journal-entries')} className="text-xs text-green-600 hover:underline">View All</button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="text-left py-2 px-2 font-semibold text-thb-text-secondary">Date</th>
                      <th className="text-left py-2 px-2 font-semibold text-thb-text-secondary">Account</th>
                      <th className="text-left py-2 px-2 font-semibold text-thb-text-secondary">Description</th>
                      <th className="text-right py-2 px-2 font-semibold text-thb-text-secondary">Debit</th>
                      <th className="text-right py-2 px-2 font-semibold text-thb-text-secondary">Credit</th>
                      <th className="text-center py-2 px-2 font-semibold text-thb-text-secondary">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentTransactions.slice(0, 6).map(txn => (
                      <tr key={txn.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                        <td className="py-2 px-2 text-thb-text-secondary">{txn.date}</td>
                        <td className="py-2 px-2 font-medium text-thb-text-primary">{txn.account}</td>
                        <td className="py-2 px-2 text-thb-text-secondary truncate max-w-[150px]">{txn.description}</td>
                        <td className="py-2 px-2 text-right font-medium text-emerald-600">{txn.debit > 0 ? `₹${txn.debit.toLocaleString()}` : '—'}</td>
                        <td className="py-2 px-2 text-right font-medium text-red-600">{txn.credit > 0 ? `₹${txn.credit.toLocaleString()}` : '—'}</td>
                        <td className="py-2 px-2 text-center"><span className={getStatusBadge(txn.status)}>{txn.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'chart-of-accounts' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-xs">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input type="text" placeholder="Search accounts..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" />
            </div>
            <select value={filterType} onChange={e => setFilterType(e.target.value)} className="px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20">
              <option value="all">All Types</option>
              <option value="Asset">Assets</option>
              <option value="Liability">Liabilities</option>
              <option value="Equity">Equity</option>
              <option value="Revenue">Revenue</option>
              <option value="Expense">Expenses</option>
            </select>
            <button onClick={() => setShowAddAccountModal(true)} className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors">
              <FiPlus className="w-4 h-4" /> Add Account
            </button>
          </div>
          <div className="thb-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left py-3 px-4 font-semibold text-thb-text-secondary">Code</th>
                  <th className="text-left py-3 px-4 font-semibold text-thb-text-secondary">Account Name</th>
                  <th className="text-left py-3 px-4 font-semibold text-thb-text-secondary">Type</th>
                  <th className="text-right py-3 px-4 font-semibold text-thb-text-secondary">Balance</th>
                  <th className="text-center py-3 px-4 font-semibold text-thb-text-secondary">Status</th>
                  <th className="text-center py-3 px-4 font-semibold text-thb-text-secondary">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAccounts.map(account => (
                  <tr key={account.code} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-4 font-mono text-thb-text-primary font-medium">{account.code}</td>
                    <td className="py-3 px-4 text-thb-text-primary">{account.name}</td>
                    <td className="py-3 px-4"><span className={`px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(account.type)}`}>{account.type}</span></td>
                    <td className="py-3 px-4 text-right font-medium text-thb-text-primary">₹{account.balance.toLocaleString()}</td>
                    <td className="py-3 px-4 text-center"><span className={getStatusBadge(account.status)}>{account.status}</span></td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button className="p-1.5 rounded-lg text-slate-400 hover:text-green-500 hover:bg-green-50 transition-colors"><FiEye className="w-3.5 h-3.5" /></button>
                        <button className="p-1.5 rounded-lg text-slate-400 hover:text-amber-500 hover:bg-amber-50 transition-colors"><FiEdit2 className="w-3.5 h-3.5" /></button>
                        <button className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"><FiTrash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'journal-entries' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-xs">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input type="text" placeholder="Search entries..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" />
            </div>
            <button onClick={() => setShowAddJournalModal(true)} className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors ml-auto">
              <FiPlus className="w-4 h-4" /> New Entry
            </button>
          </div>
          <div className="thb-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left py-3 px-4 font-semibold text-thb-text-secondary">Entry #</th>
                  <th className="text-left py-3 px-4 font-semibold text-thb-text-secondary">Date</th>
                  <th className="text-left py-3 px-4 font-semibold text-thb-text-secondary">Description</th>
                  <th className="text-right py-3 px-4 font-semibold text-thb-text-secondary">Debit Total</th>
                  <th className="text-right py-3 px-4 font-semibold text-thb-text-secondary">Credit Total</th>
                  <th className="text-center py-3 px-4 font-semibold text-thb-text-secondary">Status</th>
                  <th className="text-center py-3 px-4 font-semibold text-thb-text-secondary">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredJournalEntries.map(je => (
                  <tr key={je.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-4 font-mono text-green-600 font-medium">{je.id}</td>
                    <td className="py-3 px-4 text-thb-text-secondary">{je.date}</td>
                    <td className="py-3 px-4 text-thb-text-primary">{je.description}</td>
                    <td className="py-3 px-4 text-right font-medium text-emerald-600">₹{je.debitTotal.toLocaleString()}</td>
                    <td className="py-3 px-4 text-right font-medium text-red-600">₹{je.creditTotal.toLocaleString()}</td>
                    <td className="py-3 px-4 text-center"><span className={getStatusBadge(je.status)}>{je.status}</span></td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button className="p-1.5 rounded-lg text-slate-400 hover:text-green-500 hover:bg-green-50 transition-colors"><FiEye className="w-3.5 h-3.5" /></button>
                        {je.status === 'draft' && (
                          <>
                            <button onClick={() => toast.success('Entry posted')} className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 transition-colors"><FiCheck className="w-3.5 h-3.5" /></button>
                            <button className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"><FiX className="w-3.5 h-3.5" /></button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'general-ledger' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <select value={selectedLedgerAccount} onChange={e => setSelectedLedgerAccount(e.target.value)} className="px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 min-w-[200px]">
              {chartOfAccounts.map(a => <option key={a.code} value={`${a.code} - ${a.name}`}>{a.code} - {a.name}</option>)}
            </select>
            <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg text-sm font-medium transition-colors text-thb-text-primary ml-auto">
              <FiDownload className="w-4 h-4" /> Export
            </button>
          </div>
          <div className="thb-card overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
              <h3 className="font-semibold text-thb-text-primary">{selectedLedgerAccount}</h3>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left py-3 px-4 font-semibold text-thb-text-secondary">Date</th>
                  <th className="text-left py-3 px-4 font-semibold text-thb-text-secondary">Particulars</th>
                  <th className="text-right py-3 px-4 font-semibold text-thb-text-secondary">Debit</th>
                  <th className="text-right py-3 px-4 font-semibold text-thb-text-secondary">Credit</th>
                  <th className="text-right py-3 px-4 font-semibold text-thb-text-secondary">Balance</th>
                </tr>
              </thead>
              <tbody>
                {ledgerEntries.map((entry, i) => (
                  <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-4 text-thb-text-secondary">{entry.date}</td>
                    <td className="py-3 px-4 text-thb-text-primary">{entry.particulars}</td>
                    <td className="py-3 px-4 text-right font-medium text-emerald-600">{entry.debit > 0 ? `₹${entry.debit.toLocaleString()}` : '—'}</td>
                    <td className="py-3 px-4 text-right font-medium text-red-600">{entry.credit > 0 ? `₹${entry.credit.toLocaleString()}` : '—'}</td>
                    <td className="py-3 px-4 text-right font-bold text-thb-text-primary">₹{entry.balance.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'financial-statements' && (
        <div className="space-y-6">
          {/* Balance Sheet */}
          <div className="thb-card p-5">
            <h3 className="text-lg font-bold text-thb-text-primary mb-4 flex items-center gap-2">
              <FiBookOpen className="w-5 h-5 text-green-500" /> Balance Sheet
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="text-sm font-bold text-emerald-600 mb-3 border-b border-emerald-100 pb-2">Assets</h4>
                {[
                  { name: 'Cash & Bank', amount: 1135000 },
                  { name: 'Accounts Receivable', amount: 345000 },
                  { name: 'Inventory', amount: 125000 },
                  { name: 'Fixed Assets', amount: 650000 },
                ].map(item => (
                  <div key={item.name} className="flex justify-between py-1.5 text-sm">
                    <span className="text-thb-text-secondary">{item.name}</span>
                    <span className="font-medium text-thb-text-primary">₹{item.amount.toLocaleString()}</span>
                  </div>
                ))}
                <div className="flex justify-between py-2 text-sm font-bold border-t border-emerald-200 mt-2">
                  <span className="text-emerald-700">Total Assets</span>
                  <span className="text-emerald-700">₹22,55,000</span>
                </div>
              </div>
              <div>
                <h4 className="text-sm font-bold text-red-600 mb-3 border-b border-red-100 pb-2">Liabilities & Equity</h4>
                {[
                  { name: 'Accounts Payable', amount: 280000 },
                  { name: 'Accrued Expenses', amount: 95000 },
                  { name: 'Tax Payable', amount: 75000 },
                  { name: 'Owner Equity', amount: 500000 },
                  { name: 'Retained Earnings', amount: 1305000 },
                ].map(item => (
                  <div key={item.name} className="flex justify-between py-1.5 text-sm">
                    <span className="text-thb-text-secondary">{item.name}</span>
                    <span className="font-medium text-thb-text-primary">₹{item.amount.toLocaleString()}</span>
                  </div>
                ))}
                <div className="flex justify-between py-2 text-sm font-bold border-t border-red-200 mt-2">
                  <span className="text-red-700">Total Liabilities & Equity</span>
                  <span className="text-red-700">₹22,55,000</span>
                </div>
              </div>
            </div>
          </div>
          {/* Income Statement */}
          <div className="thb-card p-5">
            <h3 className="text-lg font-bold text-thb-text-primary mb-4 flex items-center gap-2">
              <FiTrendingUp className="w-5 h-5 text-emerald-500" /> Income Statement (P&L)
            </h3>
            <div className="max-w-md">
              <h4 className="text-sm font-bold text-emerald-600 mb-3 border-b border-emerald-100 pb-2">Revenue</h4>
              {[
                { name: 'Service Revenue', amount: 850000 },
                { name: 'Product Revenue', amount: 320000 },
              ].map(item => (
                <div key={item.name} className="flex justify-between py-1.5 text-sm">
                  <span className="text-thb-text-secondary">{item.name}</span>
                  <span className="font-medium text-thb-text-primary">₹{item.amount.toLocaleString()}</span>
                </div>
              ))}
              <div className="flex justify-between py-2 text-sm font-bold border-t border-emerald-200 mt-2">
                <span className="text-emerald-700">Total Revenue</span>
                <span className="text-emerald-700">₹11,70,000</span>
              </div>
              <h4 className="text-sm font-bold text-red-600 mb-3 border-b border-red-100 pb-2 mt-4">Expenses</h4>
              {[
                { name: 'Salaries', amount: 450000 },
                { name: 'Rent', amount: 85000 },
                { name: 'Utilities', amount: 58000 },
                { name: 'Marketing', amount: 132000 },
                { name: 'Other', amount: 60000 },
              ].map(item => (
                <div key={item.name} className="flex justify-between py-1.5 text-sm">
                  <span className="text-thb-text-secondary">{item.name}</span>
                  <span className="font-medium text-thb-text-primary">₹{item.amount.toLocaleString()}</span>
                </div>
              ))}
              <div className="flex justify-between py-2 text-sm font-bold border-t border-red-200 mt-2">
                <span className="text-red-700">Total Expenses</span>
                <span className="text-red-700">₹7,85,000</span>
              </div>
              <div className="flex justify-between py-3 text-base font-bold border-t-2 border-green-300 mt-4 bg-green-50 -mx-2 px-2 rounded-lg">
                <span className="text-green-700">Net Income</span>
                <span className="text-green-700">₹3,85,000</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Account Modal */}
      {showAddAccountModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowAddAccountModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h3 className="text-lg font-bold text-thb-text-primary">Add Account</h3>
              <button onClick={() => setShowAddAccountModal(false)} className="p-2 rounded-lg hover:bg-slate-100 transition-colors"><FiX className="w-5 h-5 text-slate-400" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-thb-text-secondary mb-1">Account Code</label>
                <input type="text" placeholder="e.g., 1600" className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" />
              </div>
              <div>
                <label className="block text-sm font-medium text-thb-text-secondary mb-1">Account Name</label>
                <input type="text" placeholder="e.g., Petty Cash" className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" />
              </div>
              <div>
                <label className="block text-sm font-medium text-thb-text-secondary mb-1">Account Type</label>
                <select className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20">
                  <option value="Asset">Asset</option>
                  <option value="Liability">Liability</option>
                  <option value="Equity">Equity</option>
                  <option value="Revenue">Revenue</option>
                  <option value="Expense">Expense</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-thb-text-secondary mb-1">Opening Balance</label>
                <input type="number" placeholder="0" className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" />
              </div>
            </div>
            <div className="flex gap-3 p-5 border-t border-slate-100">
              <button onClick={() => setShowAddAccountModal(false)} className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium text-thb-text-primary hover:bg-slate-50 transition-colors">Cancel</button>
              <button onClick={() => { setShowAddAccountModal(false); toast.success('Account created successfully'); }} className="flex-1 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors">Create Account</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Journal Entry Modal */}
      {showAddJournalModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowAddJournalModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h3 className="text-lg font-bold text-thb-text-primary">New Journal Entry</h3>
              <button onClick={() => setShowAddJournalModal(false)} className="p-2 rounded-lg hover:bg-slate-100 transition-colors"><FiX className="w-5 h-5 text-slate-400" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-thb-text-secondary mb-1">Date</label>
                  <input type="date" className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-thb-text-secondary mb-1">Reference</label>
                  <input type="text" placeholder="Auto-generated" className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-thb-text-secondary mb-1">Description</label>
                <input type="text" placeholder="Entry description" className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20" />
              </div>
              <div>
                <label className="block text-sm font-medium text-thb-text-secondary mb-2">Line Items</label>
                <div className="space-y-2">
                  {[
                    { account: '', debit: '', credit: '' },
                    { account: '', debit: '', credit: '' },
                  ].map((line, i) => (
                    <div key={i} className="grid grid-cols-3 gap-2">
                      <select className="px-2 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-green-500/20">
                        <option value="">Select Account</option>
                        {chartOfAccounts.map(a => <option key={a.code} value={a.code}>{a.code} - {a.name}</option>)}
                      </select>
                      <input type="number" placeholder="Debit" className="px-2 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-green-500/20" />
                      <input type="number" placeholder="Credit" className="px-2 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-green-500/20" />
                    </div>
                  ))}
                </div>
                <button className="mt-2 flex items-center gap-1 text-xs text-green-600 hover:text-green-700 font-medium">
                  <FiPlus className="w-3 h-3" /> Add Line
                </button>
              </div>
            </div>
            <div className="flex gap-3 p-5 border-t border-slate-100">
              <button onClick={() => setShowAddJournalModal(false)} className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium text-thb-text-primary hover:bg-slate-50 transition-colors">Cancel</button>
              <button onClick={() => { setShowAddJournalModal(false); toast.success('Journal entry saved as draft'); }} className="flex-1 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium transition-colors">Save as Draft</button>
              <button onClick={() => { setShowAddJournalModal(false); toast.success('Journal entry posted'); }} className="flex-1 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors">Post Entry</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
