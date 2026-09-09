'use client';

import { useState } from 'react';
import { FiDownload, FiBookOpen, FiBarChart2 } from 'react-icons/fi';
import toast from 'react-hot-toast';

type ReportType = 'document-usage' | 'search-analytics' | 'contributions';

const reports: { key: ReportType; label: string; icon: React.ReactNode; desc: string }[] = [
  { key: 'document-usage', label: 'Document Usage', icon: <FiBookOpen className="w-5 h-5" />, desc: 'Document access and usage stats' },
  { key: 'search-analytics', label: 'Search Analytics', icon: <FiBarChart2 className="w-5 h-5" />, desc: 'Search trends and patterns' },
  { key: 'contributions', label: 'Contributions', icon: <FiBookOpen className="w-5 h-5" />, desc: 'Author contribution metrics' },
];

const placeholderContent: Record<ReportType, { icon: React.ReactNode; title: string; desc: string }> = {
  'document-usage': { icon: <FiBookOpen className="w-12 h-12 text-slate-300" />, title: 'Document Usage', desc: 'This report will show document access patterns, popular documents, and usage statistics.' },
  'search-analytics': { icon: <FiBarChart2 className="w-12 h-12 text-slate-300" />, title: 'Search Analytics', desc: 'This report will show search trends, popular queries, and search success rates.' },
  'contributions': { icon: <FiBookOpen className="w-12 h-12 text-slate-300" />, title: 'Contributions', desc: 'This report will show author contribution metrics and content creation trends.' },
};

export default function DocsReportsPage() {
  const [activeReport, setActiveReport] = useState<ReportType>('document-usage');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-thb-text-primary">Documentation Reports</h1>
          <p className="text-sm text-thb-text-secondary mt-1">Generate and export documentation analytics</p>
        </div>
        <button
          onClick={() => toast.success('Report exported successfully')}
          className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium"
        >
          <FiDownload className="w-4 h-4" /> Export Report
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
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

      <div className="thb-card p-8 text-center">
        <div className="flex justify-center mb-3">{placeholderContent[activeReport].icon}</div>
        <h3 className="text-lg font-semibold text-thb-text-primary">{placeholderContent[activeReport].title}</h3>
        <p className="text-sm text-thb-text-muted mt-2">{placeholderContent[activeReport].desc}</p>
      </div>
    </div>
  );
}
