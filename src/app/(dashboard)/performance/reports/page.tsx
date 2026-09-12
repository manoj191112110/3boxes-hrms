'use client';

import { useState } from 'react';
import { FiDownload, FiTrendingUp, FiBarChart2, FiTarget } from 'react-icons/fi';
import toast from 'react-hot-toast';

type ReportType = 'appraisal-summary' | 'rating-distribution' | 'goal-completion' | 'feedback-analytics';

const reports: { key: ReportType; label: string; icon: React.ReactNode; desc: string }[] = [
  { key: 'appraisal-summary', label: 'Appraisal Summary', icon: <FiTrendingUp className="w-5 h-5" />, desc: 'Appraisal cycle overview' },
  { key: 'rating-distribution', label: 'Rating Distribution', icon: <FiBarChart2 className="w-5 h-5" />, desc: 'Rating spread across teams' },
  { key: 'goal-completion', label: 'Goal Completion', icon: <FiTarget className="w-5 h-5" />, desc: 'Goal achievement rates' },
  { key: 'feedback-analytics', label: 'Feedback Analytics', icon: <FiBarChart2 className="w-5 h-5" />, desc: '360° feedback insights' },
];

const ratingData = [
  { rating: '5 — Exceptional', count: 12, pct: 8, color: 'bg-emerald-500' },
  { rating: '4 — Exceeds Expectations', count: 45, pct: 30, color: 'bg-green-500' },
  { rating: '3 — Meets Expectations', count: 68, pct: 45, color: 'bg-amber-500' },
  { rating: '2 — Needs Improvement', count: 20, pct: 13, color: 'bg-orange-500' },
  { rating: '1 — Unsatisfactory', count: 5, pct: 4, color: 'bg-red-500' },
];

const maxPct = 45;

export default function PerformanceReportsPage() {
  const [activeReport, setActiveReport] = useState<ReportType>('rating-distribution');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-thb-text-primary">Performance Reports</h1>
          <p className="text-sm text-thb-text-secondary mt-1">Generate and export performance analytics</p>
        </div>
        <button
          onClick={() => toast.success('Report exported successfully')}
          className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium"
        >
          <FiDownload className="w-4 h-4" /> Export Report
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {reports.map(r => (
          <button
            key={r.key}
            onClick={() => setActiveReport(r.key)}
            className={`thb-card p-4 text-left hover:shadow-md transition-all ${activeReport === r.key ? 'ring-2 ring-green-500 shadow-md' : ''}`}
          >
            <div className={`p-2 rounded-lg inline-flex ${activeReport === r.key ? 'bg-green-500 text-white' : 'bg-slate-100 text-slate-600'} mb-2`}>{r.icon}</div>
            <p className="text-sm font-semibold text-thb-text-primary">{r.label}</p>
            <p className="text-xs text-thb-text-muted mt-0.5">{r.desc}</p>
          </button>
        ))}
      </div>

      {activeReport === 'appraisal-summary' && (
        <div className="thb-card p-8 text-center">
          <FiTrendingUp className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-thb-text-primary">Appraisal Summary</h3>
          <p className="text-sm text-thb-text-muted mt-2">This report will show appraisal cycle overview and completion status.</p>
        </div>
      )}

      {activeReport === 'rating-distribution' && (
        <div className="thb-card p-5">
          <h3 className="text-lg font-bold text-thb-text-primary mb-6">Rating Distribution</h3>
          <div className="space-y-3">
            {ratingData.map(item => {
              const widthPct = (item.pct / maxPct) * 100;
              return (
                <div key={item.rating} className="flex items-center gap-4">
                  <div className="w-44 flex-shrink-0">
                    <p className="text-sm font-medium text-thb-text-primary">{item.rating}</p>
                  </div>
                  <div className="flex-1 bg-slate-100 rounded-full h-7 relative overflow-hidden">
                    <div
                      className={`${item.color} h-full rounded-full transition-all flex items-center justify-end pr-3`}
                      style={{ width: `${widthPct}%` }}
                    >
                      <span className="text-xs text-white font-bold">{item.pct}%</span>
                    </div>
                  </div>
                  <div className="w-16 text-right">
                    <span className="text-sm font-medium text-thb-text-secondary">{item.count}</span>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 pt-4 border-t border-slate-100">
            <p className="text-sm text-thb-text-muted">
              Total employees rated: <span className="font-bold text-thb-text-primary">{ratingData.reduce((s, r) => s + r.count, 0)}</span>
            </p>
          </div>
        </div>
      )}

      {activeReport === 'goal-completion' && (
        <div className="thb-card p-8 text-center">
          <FiTarget className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-thb-text-primary">Goal Completion</h3>
          <p className="text-sm text-thb-text-muted mt-2">This report will show goal achievement rates and OKR progress.</p>
        </div>
      )}

      {activeReport === 'feedback-analytics' && (
        <div className="thb-card p-8 text-center">
          <FiBarChart2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-thb-text-primary">Feedback Analytics</h3>
          <p className="text-sm text-thb-text-muted mt-2">This report will show 360° feedback insights and sentiment analysis.</p>
        </div>
      )}
    </div>
  );
}
