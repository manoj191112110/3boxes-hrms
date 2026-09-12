'use client';

import { useState } from 'react';
import { FiDownload, FiBarChart2, FiUserPlus, FiBriefcase, FiActivity } from 'react-icons/fi';
import toast from 'react-hot-toast';

type ReportType = 'pipeline-funnel' | 'lead-sources' | 'deal-win-rate' | 'activity-summary';

const reports: { key: ReportType; label: string; icon: React.ReactNode; desc: string }[] = [
  { key: 'pipeline-funnel', label: 'Pipeline Funnel', icon: <FiBarChart2 className="w-5 h-5" />, desc: 'Deal pipeline conversion funnel' },
  { key: 'lead-sources', label: 'Lead Sources', icon: <FiUserPlus className="w-5 h-5" />, desc: 'Lead source analysis' },
  { key: 'deal-win-rate', label: 'Deal Win Rate', icon: <FiBriefcase className="w-5 h-5" />, desc: 'Win/loss ratio analysis' },
  { key: 'activity-summary', label: 'Activity Summary', icon: <FiActivity className="w-5 h-5" />, desc: 'CRM activity overview' },
];

const funnelData = [
  { stage: 'Leads', count: 250, color: 'bg-green-400' },
  { stage: 'Qualified', count: 180, color: 'bg-green-500' },
  { stage: 'Proposal', count: 85, color: 'bg-green-600' },
  { stage: 'Negotiation', count: 45, color: 'bg-green-700' },
  { stage: 'Won', count: 28, color: 'bg-emerald-500' },
];

const maxCount = 250;

export default function CrmReportsPage() {
  const [activeReport, setActiveReport] = useState<ReportType>('pipeline-funnel');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-thb-text-primary">CRM Reports</h1>
          <p className="text-sm text-thb-text-secondary mt-1">Generate and export CRM analytics</p>
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

      {activeReport === 'pipeline-funnel' && (
        <div className="thb-card p-5">
          <h3 className="text-lg font-bold text-thb-text-primary mb-6">Pipeline Funnel</h3>
          <div className="space-y-3">
            {funnelData.map(item => {
              const widthPct = (item.count / maxCount) * 100;
              return (
                <div key={item.stage} className="flex items-center gap-4">
                  <div className="w-28 flex-shrink-0">
                    <p className="text-sm font-semibold text-thb-text-primary">{item.stage}</p>
                  </div>
                  <div className="flex-1 bg-slate-100 rounded-full h-8 relative overflow-hidden">
                    <div
                      className={`${item.color} h-full rounded-full transition-all flex items-center justify-end pr-3`}
                      style={{ width: `${widthPct}%` }}
                    >
                      <span className="text-xs text-white font-bold">{item.count}</span>
                    </div>
                  </div>
                  <div className="w-16 text-right">
                    <span className="text-sm font-medium text-thb-text-secondary">
                      {Math.round((item.count / maxCount) * 100)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 pt-4 border-t border-slate-100">
            <p className="text-sm text-thb-text-muted">
              Overall conversion rate: <span className="font-bold text-emerald-600">{Math.round((28 / 250) * 100)}%</span> (Leads → Won)
            </p>
          </div>
        </div>
      )}

      {activeReport === 'lead-sources' && (
        <div className="thb-card p-8 text-center">
          <FiUserPlus className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-thb-text-primary">Lead Sources</h3>
          <p className="text-sm text-thb-text-muted mt-2">This report will show lead source analysis and attribution breakdown.</p>
        </div>
      )}

      {activeReport === 'deal-win-rate' && (
        <div className="thb-card p-8 text-center">
          <FiBriefcase className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-thb-text-primary">Deal Win Rate</h3>
          <p className="text-sm text-thb-text-muted mt-2">This report will show win/loss ratio analysis and deal outcome trends.</p>
        </div>
      )}

      {activeReport === 'activity-summary' && (
        <div className="thb-card p-8 text-center">
          <FiActivity className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-thb-text-primary">Activity Summary</h3>
          <p className="text-sm text-thb-text-muted mt-2">This report will show CRM activity overview including calls, emails, and meetings.</p>
        </div>
      )}
    </div>
  );
}
