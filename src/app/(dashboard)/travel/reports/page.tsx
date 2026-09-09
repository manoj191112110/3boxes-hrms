'use client';

import { useState } from 'react';
import {
  FiMap, FiCreditCard, FiBarChart2,
} from 'react-icons/fi';
import { useAuthStore } from '@/store/authStore';

/* ── Report Types ── */
const reportTypes = [
  { key: 'travel', label: 'Travel Summary', icon: FiMap, color: 'bg-green-50 text-green-600' },
  { key: 'expense', label: 'Expense by Category', icon: FiCreditCard, color: 'bg-emerald-50 text-emerald-600' },
  { key: 'compliance', label: 'Policy Compliance', icon: FiBarChart2, color: 'bg-amber-50 text-amber-600' },
  { key: 'department', label: 'Cost by Department', icon: FiBarChart2, color: 'bg-teal-50 text-teal-600' },
];

/* ── Expense Category Data ── */
const expenseCategories = [
  { label: 'Flights', percent: 40, amount: '₹8,40,000', color: 'bg-green-500' },
  { label: 'Hotels', percent: 25, amount: '₹5,25,000', color: 'bg-emerald-500' },
  { label: 'Misc', percent: 15, amount: '₹3,15,000', color: 'bg-teal-500' },
  { label: 'Meals', percent: 12, amount: '₹2,52,000', color: 'bg-amber-500' },
  { label: 'Transport', percent: 8, amount: '₹1,68,000', color: 'bg-rose-500' },
];

export default function TravelReportsPage() {
  useAuthStore();
  const [activeReport, setActiveReport] = useState('travel');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-green-50">
          <FiBarChart2 className="w-5 h-5 text-green-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-thb-text-primary">Travel & Expense Reports</h1>
          <p className="text-sm text-thb-text-secondary">Analyze travel costs and expense patterns</p>
        </div>
      </div>

      {/* Report Type Selector */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {reportTypes.map((rt) => {
          const Icon = rt.icon;
          const isActive = activeReport === rt.key;
          return (
            <button
              key={rt.key}
              onClick={() => setActiveReport(rt.key)}
              className={`thb-card p-4 flex flex-col items-center gap-2 text-center transition-all hover:shadow-md ${isActive ? 'ring-2 ring-green-500 shadow-md' : ''}`}
            >
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${rt.color}`}>
                <Icon className="w-5 h-5" />
              </div>
              <span className={`text-xs font-medium ${isActive ? 'text-green-600' : 'text-thb-text-secondary'}`}>{rt.label}</span>
            </button>
          );
        })}
      </div>

      {/* Report Content */}
      {activeReport === 'travel' && (
        <div className="thb-card p-8 text-center">
          <FiMap className="w-12 h-12 text-thb-text-muted mx-auto mb-3" />
          <h3 className="text-thb-text-primary font-semibold mb-1">Travel Summary</h3>
          <p className="text-sm text-thb-text-muted">Overview of travel requests, bookings, and costs will appear here</p>
        </div>
      )}

      {activeReport === 'expense' && (
        <div className="thb-card overflow-hidden">
          <div className="px-5 py-4 border-b border-thb-border">
            <h2 className="font-semibold text-thb-text-primary">Expense by Category</h2>
            <p className="text-xs text-thb-text-muted mt-0.5">Breakdown of travel expenses across categories</p>
          </div>
          <div className="p-5 space-y-4">
            {expenseCategories.map((cat) => (
              <div key={cat.label}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-sm ${cat.color}`} />
                    <span className="text-sm font-medium text-thb-text-primary">{cat.label}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-thb-text-secondary">{cat.amount}</span>
                    <span className="text-sm font-bold text-thb-text-primary min-w-[3ch] text-right">{cat.percent}%</span>
                  </div>
                </div>
                <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${cat.color} transition-all duration-700`}
                    style={{ width: `${cat.percent}%` }}
                  />
                </div>
              </div>
            ))}
            <div className="pt-4 border-t border-thb-border">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-thb-text-primary">Total</span>
                <span className="text-sm font-bold text-thb-text-primary">₹21,00,000</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeReport === 'compliance' && (
        <div className="thb-card p-8 text-center">
          <FiBarChart2 className="w-12 h-12 text-thb-text-muted mx-auto mb-3" />
          <h3 className="text-thb-text-primary font-semibold mb-1">Policy Compliance</h3>
          <p className="text-sm text-thb-text-muted">Travel policy compliance rates and violations will appear here</p>
        </div>
      )}

      {activeReport === 'department' && (
        <div className="thb-card p-8 text-center">
          <FiBarChart2 className="w-12 h-12 text-thb-text-muted mx-auto mb-3" />
          <h3 className="text-thb-text-primary font-semibold mb-1">Cost by Department</h3>
          <p className="text-sm text-thb-text-muted">Travel cost breakdown by department will appear here</p>
        </div>
      )}
    </div>
  );
}
