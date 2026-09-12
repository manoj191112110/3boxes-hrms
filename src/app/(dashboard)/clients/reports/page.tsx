'use client';

import { useState } from 'react';
import { FiDownload, FiGlobe, FiBarChart2, FiTrendingUp } from 'react-icons/fi';
import toast from 'react-hot-toast';

type ReportType = 'client-summary' | 'sow-status' | 'revenue-by-client' | 'vendor-compliance';

const reports: { key: ReportType; label: string; icon: React.ReactNode; desc: string }[] = [
  { key: 'client-summary', label: 'Client Summary', icon: <FiGlobe className="w-5 h-5" />, desc: 'Overview of all clients' },
  { key: 'sow-status', label: 'SOW Status', icon: <FiBarChart2 className="w-5 h-5" />, desc: 'Statement of work tracking' },
  { key: 'revenue-by-client', label: 'Revenue by Client', icon: <FiTrendingUp className="w-5 h-5" />, desc: 'Client-wise revenue breakdown' },
  { key: 'vendor-compliance', label: 'Vendor Compliance', icon: <FiGlobe className="w-5 h-5" />, desc: 'Vendor compliance status' },
];

const placeholderContent: Record<Exclude<ReportType, 'client-summary'>, { icon: React.ReactNode; title: string; desc: string }> = {
  'sow-status': { icon: <FiBarChart2 className="w-12 h-12 text-slate-300" />, title: 'SOW Status', desc: 'This report will show statement of work status and progress tracking.' },
  'revenue-by-client': { icon: <FiTrendingUp className="w-12 h-12 text-slate-300" />, title: 'Revenue by Client', desc: 'This report will show client-wise revenue breakdown and trends.' },
  'vendor-compliance': { icon: <FiGlobe className="w-12 h-12 text-slate-300" />, title: 'Vendor Compliance', desc: 'This report will show vendor compliance status and audit results.' },
};

export default function ClientsReportsPage() {
  const [activeReport, setActiveReport] = useState<ReportType>('client-summary');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-thb-text-primary">Client Reports</h1>
          <p className="text-sm text-thb-text-secondary mt-1">Generate and export client-related reports</p>
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

      {activeReport === 'client-summary' && (
        <div className="thb-card p-8 text-center">
          <FiGlobe className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-thb-text-primary">Client Summary</h3>
          <p className="text-sm text-thb-text-muted mt-2">This report will show an overview of all clients, their status, and key metrics.</p>
        </div>
      )}

      {activeReport !== 'client-summary' && (
        <div className="thb-card p-8 text-center">
          <div className="flex justify-center mb-3">{placeholderContent[activeReport].icon}</div>
          <h3 className="text-lg font-semibold text-thb-text-primary">{placeholderContent[activeReport].title}</h3>
          <p className="text-sm text-thb-text-muted mt-2">{placeholderContent[activeReport].desc}</p>
        </div>
      )}
    </div>
  );
}
