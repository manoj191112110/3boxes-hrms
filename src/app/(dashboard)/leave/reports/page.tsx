'use client';

import { useState } from 'react';
import {
  FiCalendar, FiUsers, FiBarChart2, FiDownload,
} from 'react-icons/fi';
import { useAuthStore } from '@/store/authStore';

/* ── Report types ── */
const reportTypes = [
  { key: 'summary', label: 'Leave Summary', icon: FiCalendar, color: 'bg-green-50 text-green-600' },
  { key: 'department', label: 'Department-wise', icon: FiUsers, color: 'bg-emerald-50 text-emerald-600' },
  { key: 'absenteeism', label: 'Absenteeism', icon: FiBarChart2, color: 'bg-amber-50 text-amber-600' },
  { key: 'encashment', label: 'Encashment Report', icon: FiDownload, color: 'bg-teal-50 text-teal-600' },
];

/* ── Summary Data ── */
const summaryData = [
  { type: 'Casual Leave', allocated: 12, used: 4, pending: 1, available: 7 },
  { type: 'Sick Leave', allocated: 10, used: 2, pending: 0, available: 8 },
  { type: 'Earned Leave', allocated: 15, used: 5, pending: 2, available: 8 },
  { type: 'Maternity Leave', allocated: 182, used: 0, pending: 0, available: 182 },
  { type: 'Comp Off', allocated: 3, used: 1, pending: 0, available: 2 },
  { type: 'Loss of Pay', allocated: 0, used: 0, pending: 0, available: 0 },
];

export default function LeaveReportsPage() {
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
          <h1 className="text-xl font-bold text-thb-text-primary">Leave Reports</h1>
          <p className="text-sm text-thb-text-secondary">Analyze leave usage across the organization</p>
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
      {activeReport === 'summary' && (
        <div className="thb-card overflow-hidden">
          <div className="px-5 py-4 border-b border-thb-border">
            <h2 className="font-semibold text-thb-text-primary">Leave Summary</h2>
            <p className="text-xs text-thb-text-muted mt-0.5">Overview of leave allocation and usage</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-thb-border bg-slate-50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Leave Type</th>
                  <th className="text-center px-5 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Allocated</th>
                  <th className="text-center px-5 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Used</th>
                  <th className="text-center px-5 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Pending</th>
                  <th className="text-center px-5 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Available</th>
                </tr>
              </thead>
              <tbody>
                {summaryData.map((row, idx) => (
                  <tr key={idx} className="border-b border-thb-border last:border-b-0 hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3 text-sm text-thb-text-primary font-medium">{row.type}</td>
                    <td className="px-5 py-3 text-sm text-thb-text-primary text-center">{row.allocated || '—'}</td>
                    <td className="px-5 py-3 text-sm text-thb-text-primary text-center">{row.used}</td>
                    <td className="px-5 py-3 text-sm text-center">
                      <span className={row.pending > 0 ? 'text-amber-600 font-medium' : 'text-thb-text-muted'}>{row.pending}</span>
                    </td>
                    <td className="px-5 py-3 text-sm text-thb-text-primary text-center font-medium">{row.available || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeReport === 'department' && (
        <div className="thb-card p-8 text-center">
          <FiUsers className="w-12 h-12 text-thb-text-muted mx-auto mb-3" />
          <h3 className="text-thb-text-primary font-semibold mb-1">Department-wise Report</h3>
          <p className="text-sm text-thb-text-muted">Leave usage breakdown by department will appear here</p>
        </div>
      )}

      {activeReport === 'absenteeism' && (
        <div className="thb-card p-8 text-center">
          <FiBarChart2 className="w-12 h-12 text-thb-text-muted mx-auto mb-3" />
          <h3 className="text-thb-text-primary font-semibold mb-1">Absenteeism Report</h3>
          <p className="text-sm text-thb-text-muted">Absenteeism trends and patterns will appear here</p>
        </div>
      )}

      {activeReport === 'encashment' && (
        <div className="thb-card p-8 text-center">
          <FiDownload className="w-12 h-12 text-thb-text-muted mx-auto mb-3" />
          <h3 className="text-thb-text-primary font-semibold mb-1">Encashment Report</h3>
          <p className="text-sm text-thb-text-muted">Leave encashment details will appear here</p>
        </div>
      )}
    </div>
  );
}
