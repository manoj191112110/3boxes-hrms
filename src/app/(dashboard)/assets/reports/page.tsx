'use client';

import { useState } from 'react';
import { FiDownload, FiPackage, FiTrendingUp, FiBarChart2 } from 'react-icons/fi';
import toast from 'react-hot-toast';

type ReportType = 'asset-summary' | 'depreciation' | 'allocation' | 'maintenance-log';

const reports: { key: ReportType; label: string; icon: React.ReactNode; desc: string }[] = [
  { key: 'asset-summary', label: 'Asset Summary', icon: <FiPackage className="w-5 h-5" />, desc: 'Category-wise asset overview' },
  { key: 'depreciation', label: 'Depreciation Report', icon: <FiTrendingUp className="w-5 h-5" />, desc: 'Asset depreciation schedule' },
  { key: 'allocation', label: 'Allocation Report', icon: <FiBarChart2 className="w-5 h-5" />, desc: 'Asset allocation by department' },
  { key: 'maintenance-log', label: 'Maintenance Log', icon: <FiPackage className="w-5 h-5" />, desc: 'Maintenance history tracker' },
];

const assetData = [
  { category: 'Laptops', count: 45, totalValue: 3375000, bookValue: 2150000 },
  { category: 'Desktops', count: 30, totalValue: 1200000, bookValue: 680000 },
  { category: 'Monitors', count: 75, totalValue: 1125000, bookValue: 750000 },
  { category: 'Printers', count: 12, totalValue: 360000, bookValue: 180000 },
  { category: 'Networking Equipment', count: 25, totalValue: 625000, bookValue: 375000 },
  { category: 'Servers', count: 8, totalValue: 3200000, bookValue: 1920000 },
];

export default function AssetsReportsPage() {
  const [activeReport, setActiveReport] = useState<ReportType>('asset-summary');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-thb-text-primary">Asset Reports</h1>
          <p className="text-sm text-thb-text-secondary mt-1">Generate and export asset-related reports</p>
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

      {activeReport === 'asset-summary' && (
        <div className="thb-card overflow-hidden">
          <div className="p-4 border-b border-slate-200">
            <h3 className="text-lg font-bold text-thb-text-primary">Asset Summary Report</h3>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left py-3 px-4 font-semibold text-thb-text-secondary">Category</th>
                <th className="text-right py-3 px-4 font-semibold text-thb-text-secondary">Count</th>
                <th className="text-right py-3 px-4 font-semibold text-thb-text-secondary">Total Value</th>
                <th className="text-right py-3 px-4 font-semibold text-thb-text-secondary">Book Value</th>
              </tr>
            </thead>
            <tbody>
              {assetData.map(a => (
                <tr key={a.category} className="border-b border-slate-50 hover:bg-slate-50/50">
                  <td className="py-2.5 px-4 font-medium text-thb-text-primary">{a.category}</td>
                  <td className="py-2.5 px-4 text-right text-thb-text-secondary">{a.count}</td>
                  <td className="py-2.5 px-4 text-right font-medium">₹{a.totalValue.toLocaleString('en-IN')}</td>
                  <td className="py-2.5 px-4 text-right font-medium">₹{a.bookValue.toLocaleString('en-IN')}</td>
                </tr>
              ))}
              <tr className="bg-green-50 font-bold">
                <td className="py-3 px-4 text-green-700">Total</td>
                <td className="py-3 px-4 text-right text-green-700">{assetData.reduce((s, a) => s + a.count, 0)}</td>
                <td className="py-3 px-4 text-right text-green-700">₹{assetData.reduce((s, a) => s + a.totalValue, 0).toLocaleString('en-IN')}</td>
                <td className="py-3 px-4 text-right text-green-700">₹{assetData.reduce((s, a) => s + a.bookValue, 0).toLocaleString('en-IN')}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {activeReport === 'depreciation' && (
        <div className="thb-card p-8 text-center">
          <FiTrendingUp className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-thb-text-primary">Depreciation Report</h3>
          <p className="text-sm text-thb-text-muted mt-2">This report will show asset depreciation schedules and calculations.</p>
        </div>
      )}

      {activeReport === 'allocation' && (
        <div className="thb-card p-8 text-center">
          <FiBarChart2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-thb-text-primary">Allocation Report</h3>
          <p className="text-sm text-thb-text-muted mt-2">This report will show asset allocation across departments and teams.</p>
        </div>
      )}

      {activeReport === 'maintenance-log' && (
        <div className="thb-card p-8 text-center">
          <FiPackage className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-thb-text-primary">Maintenance Log</h3>
          <p className="text-sm text-thb-text-muted mt-2">This report will show maintenance history and upcoming schedules.</p>
        </div>
      )}
    </div>
  );
}
