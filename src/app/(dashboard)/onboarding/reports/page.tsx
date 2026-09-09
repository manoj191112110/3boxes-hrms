'use client';

import { useState } from 'react';
import {
  FiUserPlus, FiCheckSquare, FiBarChart2,
} from 'react-icons/fi';
import { useAuthStore } from '@/store/authStore';

/* ── Report Types ── */
const reportTypes = [
  { key: 'summary', label: 'Onboarding Summary', icon: FiUserPlus, color: 'bg-green-50 text-green-600' },
  { key: 'completion', label: 'Task Completion', icon: FiCheckSquare, color: 'bg-emerald-50 text-emerald-600' },
  { key: 'productivity', label: 'Time to Productivity', icon: FiBarChart2, color: 'bg-amber-50 text-amber-600' },
];

export default function OnboardingReportsPage() {
  useAuthStore();
  const [activeReport, setActiveReport] = useState('summary');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-green-50">
          <FiBarChart2 className="w-5 h-5 text-green-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-thb-text-primary">Onboarding Reports</h1>
          <p className="text-sm text-thb-text-secondary">Track onboarding progress and effectiveness</p>
        </div>
      </div>

      {/* Report Type Selector */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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

      {/* Placeholder Content */}
      {activeReport === 'summary' && (
        <div className="thb-card p-8 text-center">
          <FiUserPlus className="w-12 h-12 text-thb-text-muted mx-auto mb-3" />
          <h3 className="text-thb-text-primary font-semibold mb-1">Onboarding Summary</h3>
          <p className="text-sm text-thb-text-muted">Summary of onboarding activities and new hire progress will appear here</p>
        </div>
      )}

      {activeReport === 'completion' && (
        <div className="thb-card p-8 text-center">
          <FiCheckSquare className="w-12 h-12 text-thb-text-muted mx-auto mb-3" />
          <h3 className="text-thb-text-primary font-semibold mb-1">Task Completion</h3>
          <p className="text-sm text-thb-text-muted">Onboarding task completion rates and details will appear here</p>
        </div>
      )}

      {activeReport === 'productivity' && (
        <div className="thb-card p-8 text-center">
          <FiBarChart2 className="w-12 h-12 text-thb-text-muted mx-auto mb-3" />
          <h3 className="text-thb-text-primary font-semibold mb-1">Time to Productivity</h3>
          <p className="text-sm text-thb-text-muted">Time-to-productivity metrics and trends will appear here</p>
        </div>
      )}
    </div>
  );
}
