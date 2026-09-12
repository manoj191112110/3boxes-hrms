'use client';

import { useState, useEffect, useCallback } from 'react';
import { FiDownload, FiCalendar, FiBarChart2, FiClock, FiRefreshCw, FiFileText } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useCompanyContextStore } from '@/store/companyContextStore';

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

export default function LeaveReportsPage() {
  const scopeQuery = useCompanyContextStore(s => s.scopeQuery);
  const selectedCompanyId = useCompanyContextStore(s => s.selectedCompanyId);
  const [activeTab, setActiveTab] = useState<'summary' | 'department' | 'absenteeism'>('summary');
  const [leaveData, setLeaveData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLeaveData = useCallback(async () => {
    setLoading(true);
    try {
      const sq = scopeQuery();
      const res = await fetch(`/api/leave/balance?${sq || ''}&limit=500`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setLeaveData(data.balances || data.data || []);
      } else {
        setLeaveData([]);
      }
    } catch {
      setLeaveData([]);
    } finally {
      setLoading(false);
    }
  }, [scopeQuery]);

  useEffect(() => { fetchLeaveData(); }, [fetchLeaveData]);

  const handleExport = async (format: 'csv' | 'excel' | 'pdf') => {
    try {
      const sq = scopeQuery();
      const res = await fetch('/api/reports/export', {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportType: 'leave', format, companyId: selectedCompanyId }),
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `leave-report.${format === 'excel' ? 'xlsx' : format}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Report exported as ${format.toUpperCase()}`);
    } catch {
      toast.error('Failed to export report');
    }
  };

  // Calculate summary from real data
  const leaveTypeMap = new Map<string, { allocated: number; used: number; pending: number }>();
  leaveData.forEach((b: any) => {
    const typeName = b.leaveType?.name || b.leaveTypeName || 'Unknown';
    const allocated = b.allocated || b.totalDays || 0;
    const used = b.used || b.usedDays || 0;
    const pending = b.pending || 0;
    const existing = leaveTypeMap.get(typeName) || { allocated: 0, used: 0, pending: 0 };
    existing.allocated += allocated;
    existing.used += used;
    existing.pending += pending;
    leaveTypeMap.set(typeName, existing);
  });

  const summaryData = Array.from(leaveTypeMap.entries()).map(([type, vals]) => ({
    leaveType: type,
    allocated: vals.allocated,
    used: vals.used,
    pending: vals.pending,
    available: vals.allocated - vals.used - vals.pending,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-thb-text-primary flex items-center gap-2">
            <FiFileText className="w-6 h-6 text-teal-500" />
            Leave Reports
          </h1>
          <p className="text-sm text-thb-text-secondary mt-1">Real-time leave balance and usage analytics</p>
        </div>
        <div className="flex gap-1">
          <button onClick={() => handleExport('csv')} className="px-3 py-2 text-xs font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200">CSV</button>
          <button onClick={() => handleExport('excel')} className="px-3 py-2 text-xs font-medium text-green-600 bg-green-50 rounded-lg hover:bg-green-100">Excel</button>
          <button onClick={() => handleExport('pdf')} className="px-3 py-2 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100">PDF</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {[
          { key: 'summary' as const, label: 'Leave Summary', icon: <FiBarChart2 className="w-4 h-4" /> },
          { key: 'department' as const, label: 'Department-wise', icon: <FiCalendar className="w-4 h-4" /> },
          { key: 'absenteeism' as const, label: 'Absenteeism', icon: <FiClock className="w-4 h-4" /> },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === tab.key ? 'bg-teal-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Report Content */}
      <div className="thb-card p-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <FiRefreshCw className="w-6 h-6 text-teal-500 animate-spin" />
            <span className="ml-2 text-sm text-thb-text-secondary">Loading leave data...</span>
          </div>
        ) : summaryData.length === 0 ? (
          <div className="text-center py-12">
            <FiCalendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">No leave data available</p>
            <p className="text-xs text-slate-400 mt-1">Leave balance data will appear here when employees have leave allocations</p>
          </div>
        ) : (
          <div className="space-y-4">
            {activeTab === 'summary' && (
              <>
                <h2 className="text-lg font-semibold text-thb-text-primary">Leave Balance Summary</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="text-left px-4 py-2 font-semibold text-slate-600">Leave Type</th>
                        <th className="text-center px-4 py-2 font-semibold text-slate-600">Allocated</th>
                        <th className="text-center px-4 py-2 font-semibold text-slate-600">Used</th>
                        <th className="text-center px-4 py-2 font-semibold text-slate-600">Pending</th>
                        <th className="text-center px-4 py-2 font-semibold text-slate-600">Available</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {summaryData.map((row, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="px-4 py-2 font-medium text-slate-700">{row.leaveType}</td>
                          <td className="px-4 py-2 text-center text-slate-600">{row.allocated}</td>
                          <td className="px-4 py-2 text-center text-amber-600">{row.used}</td>
                          <td className="px-4 py-2 text-center text-blue-600">{row.pending}</td>
                          <td className="px-4 py-2 text-center text-emerald-600 font-medium">{row.available}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                      <tr>
                        <td className="px-4 py-2 font-bold text-slate-700">Total</td>
                        <td className="px-4 py-2 text-center font-bold text-slate-700">{summaryData.reduce((s, r) => s + r.allocated, 0)}</td>
                        <td className="px-4 py-2 text-center font-bold text-amber-700">{summaryData.reduce((s, r) => s + r.used, 0)}</td>
                        <td className="px-4 py-2 text-center font-bold text-blue-700">{summaryData.reduce((s, r) => s + r.pending, 0)}</td>
                        <td className="px-4 py-2 text-center font-bold text-emerald-700">{summaryData.reduce((s, r) => s + r.available, 0)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </>
            )}
            {activeTab === 'department' && (
              <div className="text-center py-8">
                <p className="text-sm text-thb-text-secondary">Department-wise leave report will appear here.</p>
                <p className="text-xs text-thb-text-muted mt-1">This report shows leave usage broken down by department.</p>
              </div>
            )}
            {activeTab === 'absenteeism' && (
              <div className="text-center py-8">
                <p className="text-sm text-thb-text-secondary">Absenteeism report will appear here.</p>
                <p className="text-xs text-thb-text-muted mt-1">This report shows absenteeism trends and patterns.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
