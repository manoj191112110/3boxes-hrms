'use client';

import { useState } from 'react';
import { FiDownload, FiBarChart2, FiTrendingUp, FiBookOpen, FiDollarSign } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';

type ReportType = 'balance-sheet' | 'income-statement' | 'cash-flow' | 'trial-balance' | 'aging';

export default function AccountsReportsPage() {
  const { user } = useAuthStore();
  const [activeReport, setActiveReport] = useState<ReportType>('balance-sheet');

  const reports: { key: ReportType; label: string; icon: React.ReactNode; desc: string }[] = [
    { key: 'balance-sheet', label: 'Balance Sheet', icon: <FiBookOpen className="w-5 h-5" />, desc: 'Assets, Liabilities & Equity snapshot' },
    { key: 'income-statement', label: 'Income Statement', icon: <FiTrendingUp className="w-5 h-5" />, desc: 'Revenue, Expenses & Net Income' },
    { key: 'cash-flow', label: 'Cash Flow Statement', icon: <FiDollarSign className="w-5 h-5" />, desc: 'Operating, Investing & Financing activities' },
    { key: 'trial-balance', label: 'Trial Balance', icon: <FiBarChart2 className="w-5 h-5" />, desc: 'Debit & Credit balances summary' },
    { key: 'aging', label: 'Aging Reports', icon: <FiDollarSign className="w-5 h-5" />, desc: 'Receivables & Payables by age' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-thb-text-primary">Financial Reports</h1>
          <p className="text-sm text-thb-text-secondary mt-1">Generate and export financial statements</p>
        </div>
        <button onClick={() => toast.success('Report exported')} className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium">
          <FiDownload className="w-4 h-4" /> Export Report
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {reports.map(r => (
          <button key={r.key} onClick={() => setActiveReport(r.key)} className={`thb-card p-4 text-left hover:shadow-md transition-all ${activeReport === r.key ? 'ring-2 ring-green-500 shadow-md' : ''}`}>
            <div className={`p-2 rounded-lg inline-flex ${activeReport === r.key ? 'bg-green-500 text-white' : 'bg-slate-100 text-slate-600'} mb-2`}>{r.icon}</div>
            <p className="text-sm font-semibold text-thb-text-primary">{r.label}</p>
            <p className="text-xs text-thb-text-muted mt-0.5">{r.desc}</p>
          </button>
        ))}
      </div>

      {activeReport === 'balance-sheet' && (
        <div className="thb-card p-5">
          <h3 className="text-lg font-bold text-thb-text-primary mb-4">Balance Sheet — As of June 30, 2026</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="text-sm font-bold text-emerald-600 mb-3 border-b-2 border-emerald-100 pb-2">Assets</h4>
              {[
                { name: 'Cash & Bank', amount: 1135000 },
                { name: 'Accounts Receivable', amount: 345000 },
                { name: 'Inventory', amount: 125000 },
                { name: 'Prepaid Expenses', amount: 45000 },
                { name: 'Fixed Assets (Net)', amount: 580000 },
              ].map(i => <div key={i.name} className="flex justify-between py-1.5 text-sm"><span className="text-thb-text-secondary pl-4">{i.name}</span><span className="font-medium">₹{i.amount.toLocaleString()}</span></div>)}
              <div className="flex justify-between py-2 text-sm font-bold border-t-2 border-emerald-200 mt-2 text-emerald-700"><span>Total Assets</span><span>₹22,30,000</span></div>
            </div>
            <div>
              <h4 className="text-sm font-bold text-red-600 mb-3 border-b-2 border-red-100 pb-2">Liabilities & Equity</h4>
              {[
                { name: 'Accounts Payable', amount: 280000 },
                { name: 'Accrued Expenses', amount: 95000 },
                { name: 'Tax Payable', amount: 75000 },
                { name: 'Owner Equity', amount: 500000 },
                { name: 'Retained Earnings', amount: 1280000 },
              ].map(i => <div key={i.name} className="flex justify-between py-1.5 text-sm"><span className="text-thb-text-secondary pl-4">{i.name}</span><span className="font-medium">₹{i.amount.toLocaleString()}</span></div>)}
              <div className="flex justify-between py-2 text-sm font-bold border-t-2 border-red-200 mt-2 text-red-700"><span>Total Liabilities & Equity</span><span>₹22,30,000</span></div>
            </div>
          </div>
        </div>
      )}

      {activeReport === 'income-statement' && (
        <div className="thb-card p-5">
          <h3 className="text-lg font-bold text-thb-text-primary mb-4">Income Statement — Jan–Jun 2026</h3>
          <div className="max-w-lg">
            <h4 className="text-sm font-bold text-emerald-600 mb-2 border-b border-emerald-100 pb-1">Revenue</h4>
            {[{ name: 'Service Revenue', amount: 850000 }, { name: 'Product Revenue', amount: 320000 }].map(i => <div key={i.name} className="flex justify-between py-1.5 text-sm pl-4"><span className="text-thb-text-secondary">{i.name}</span><span className="font-medium">₹{i.amount.toLocaleString()}</span></div>)}
            <div className="flex justify-between py-2 text-sm font-bold border-t border-emerald-200 mt-1 text-emerald-700"><span>Total Revenue</span><span>₹11,70,000</span></div>
            <h4 className="text-sm font-bold text-red-600 mb-2 border-b border-red-100 pb-1 mt-4">Expenses</h4>
            {[{ name: 'Salaries', amount: 450000 }, { name: 'Rent', amount: 85000 }, { name: 'Utilities', amount: 58000 }, { name: 'Marketing', amount: 132000 }, { name: 'Other', amount: 60000 }].map(i => <div key={i.name} className="flex justify-between py-1.5 text-sm pl-4"><span className="text-thb-text-secondary">{i.name}</span><span className="font-medium">₹{i.amount.toLocaleString()}</span></div>)}
            <div className="flex justify-between py-2 text-sm font-bold border-t border-red-200 mt-1 text-red-700"><span>Total Expenses</span><span>₹7,85,000</span></div>
            <div className="flex justify-between py-3 text-base font-bold border-t-2 border-green-300 mt-4 bg-green-50 -mx-2 px-3 rounded-lg"><span className="text-green-700">Net Income</span><span className="text-green-700">₹3,85,000</span></div>
          </div>
        </div>
      )}

      {activeReport === 'trial-balance' && (
        <div className="thb-card overflow-hidden">
          <div className="p-4 border-b border-slate-200"><h3 className="text-lg font-bold text-thb-text-primary">Trial Balance — June 30, 2026</h3></div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50"><tr><th className="text-left py-3 px-4 font-semibold text-thb-text-secondary">Account</th><th className="text-right py-3 px-4 font-semibold text-thb-text-secondary">Debit</th><th className="text-right py-3 px-4 font-semibold text-thb-text-secondary">Credit</th></tr></thead>
            <tbody>
              {[{ name: 'Cash', d: 245000, c: 0 }, { name: 'Bank', d: 890000, c: 0 }, { name: 'Accounts Receivable', d: 345000, c: 0 }, { name: 'Accounts Payable', d: 0, c: 280000 }, { name: 'Tax Payable', d: 0, c: 75000 }, { name: 'Owner Equity', d: 0, c: 500000 }, { name: 'Service Revenue', d: 0, c: 850000 }, { name: 'Salaries Expense', d: 450000, c: 0 }, { name: 'Rent Expense', d: 85000, c: 0 }].map(a => (
                <tr key={a.name} className="border-b border-slate-50"><td className="py-2.5 px-4">{a.name}</td><td className="py-2.5 px-4 text-right font-medium">{a.d > 0 ? `₹${a.d.toLocaleString()}` : '—'}</td><td className="py-2.5 px-4 text-right font-medium">{a.c > 0 ? `₹${a.c.toLocaleString()}` : '—'}</td></tr>
              ))}
              <tr className="bg-green-50 font-bold"><td className="py-3 px-4 text-green-700">Total</td><td className="py-3 px-4 text-right text-green-700">₹20,15,000</td><td className="py-3 px-4 text-right text-green-700">₹20,15,000</td></tr>
            </tbody>
          </table>
        </div>
      )}

      {activeReport === 'cash-flow' && (
        <div className="thb-card p-5">
          <h3 className="text-lg font-bold text-thb-text-primary mb-4">Cash Flow Statement — Jan–Jun 2026</h3>
          <div className="max-w-lg space-y-6">
            <div>
              <h4 className="text-sm font-bold text-emerald-600 mb-2">Operating Activities</h4>
              {[{ name: 'Net Income', amount: 385000 }, { name: 'Depreciation', amount: 12000 }, { name: 'Change in Receivables', amount: -45000 }, { name: 'Change in Payables', amount: 35000 }].map(i => <div key={i.name} className="flex justify-between py-1 text-sm pl-4"><span className="text-thb-text-secondary">{i.name}</span><span className={`font-medium ${i.amount >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{i.amount >= 0 ? '+' : ''}₹{Math.abs(i.amount).toLocaleString()}</span></div>)}
              <div className="flex justify-between py-2 text-sm font-bold border-t border-emerald-200 mt-1 text-emerald-700"><span>Net Operating Cash</span><span>+₹3,87,000</span></div>
            </div>
            <div>
              <h4 className="text-sm font-bold text-green-600 mb-2">Investing Activities</h4>
              {[{ name: 'Equipment Purchase', amount: -180000 }, { name: 'Asset Sale', amount: 25000 }].map(i => <div key={i.name} className="flex justify-between py-1 text-sm pl-4"><span className="text-thb-text-secondary">{i.name}</span><span className={`font-medium ${i.amount >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{i.amount >= 0 ? '+' : ''}₹{Math.abs(i.amount).toLocaleString()}</span></div>)}
              <div className="flex justify-between py-2 text-sm font-bold border-t border-green-200 mt-1 text-green-700"><span>Net Investing Cash</span><span>-₹1,55,000</span></div>
            </div>
          </div>
        </div>
      )}

      {activeReport === 'aging' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="thb-card p-5">
            <h3 className="text-sm font-semibold text-thb-text-primary mb-4">Accounts Receivable Aging</h3>
            <table className="w-full text-xs">
              <thead><tr className="border-b border-slate-100"><th className="text-left py-2 px-2 font-semibold text-thb-text-secondary">Age</th><th className="text-right py-2 px-2 font-semibold text-thb-text-secondary">Amount</th><th className="text-right py-2 px-2 font-semibold text-thb-text-secondary">% of Total</th></tr></thead>
              <tbody>
                {[{ age: '0-30 days', amount: 245000, pct: '31%' }, { age: '31-60 days', amount: 180000, pct: '23%' }, { age: '61-90 days', amount: 120000, pct: '15%' }, { age: '90+ days', amount: 245000, pct: '31%' }].map(r => (
                  <tr key={r.age} className="border-b border-slate-50"><td className="py-2 px-2">{r.age}</td><td className="py-2 px-2 text-right font-medium">₹{r.amount.toLocaleString()}</td><td className="py-2 px-2 text-right text-thb-text-muted">{r.pct}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="thb-card p-5">
            <h3 className="text-sm font-semibold text-thb-text-primary mb-4">Accounts Payable Aging</h3>
            <table className="w-full text-xs">
              <thead><tr className="border-b border-slate-100"><th className="text-left py-2 px-2 font-semibold text-thb-text-secondary">Age</th><th className="text-right py-2 px-2 font-semibold text-thb-text-secondary">Amount</th><th className="text-right py-2 px-2 font-semibold text-thb-text-secondary">% of Total</th></tr></thead>
              <tbody>
                {[{ age: '0-30 days', amount: 125000, pct: '45%' }, { age: '31-60 days', amount: 95000, pct: '34%' }, { age: '61-90 days', amount: 35000, pct: '12%' }, { age: '90+ days', amount: 25000, pct: '9%' }].map(r => (
                  <tr key={r.age} className="border-b border-slate-50"><td className="py-2 px-2">{r.age}</td><td className="py-2 px-2 text-right font-medium">₹{r.amount.toLocaleString()}</td><td className="py-2 px-2 text-right text-thb-text-muted">{r.pct}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
