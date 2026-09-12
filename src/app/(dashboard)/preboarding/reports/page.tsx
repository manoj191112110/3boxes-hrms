'use client';

import { useState, useEffect } from 'react';
import {
  FiUserPlus, FiBarChart2, FiFileText, FiCalendar,
  FiClock, FiCheckCircle, FiAlertCircle, FiShield, FiMonitor,
} from 'react-icons/fi';
import { useAuthStore } from '@/store/authStore';

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

/* ── Report Types ── */
const reportTypes = [
  { key: 'summary', label: 'Preboarding Summary', icon: FiUserPlus, color: 'bg-green-50 text-green-600' },
  { key: 'documents', label: 'Document Status', icon: FiFileText, color: 'bg-emerald-50 text-emerald-600' },
  { key: 'pipeline', label: 'Joining Pipeline', icon: FiCalendar, color: 'bg-amber-50 text-amber-600' },
];

export default function PreboardingReportsPage() {
  useAuthStore();
  const [activeReport, setActiveReport] = useState('summary');
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState<any>(null);

  const fetchReport = async (type: string) => {
    setLoading(true);
    setReportData(null);
    try {
      const r = await fetch(`/api/preboarding-reports?type=${type}`, { headers: getAuthHeaders() });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed to load report');
      setReportData(d.data);
    } catch {
      setReportData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchReport(activeReport); }, [activeReport]);

  const activeLabel = reportTypes.find(r => r.key === activeReport)?.label || '';

  const renderSummary = () => {
    if (!reportData) return null;
    const { total, byStatus, completionRate, avgOnboardingDays, bgvByStatus, hrVerifiedCount, accountProvisionedCount } = reportData;

    return (
      <div className="space-y-4">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="thb-card p-4">
            <p className="text-xs text-thb-text-muted mb-1">Total Candidates</p>
            <p className="text-2xl font-bold text-thb-text-primary">{total}</p>
          </div>
          <div className="thb-card p-4">
            <p className="text-xs text-thb-text-muted mb-1">Completion Rate</p>
            <p className="text-2xl font-bold text-green-600">{completionRate}%</p>
          </div>
          <div className="thb-card p-4">
            <p className="text-xs text-thb-text-muted mb-1">Avg Onboarding Days</p>
            <p className="text-2xl font-bold text-thb-text-primary">{avgOnboardingDays}</p>
          </div>
          <div className="thb-card p-4">
            <p className="text-xs text-thb-text-muted mb-1">HR Verified</p>
            <p className="text-2xl font-bold text-thb-text-primary">{hrVerifiedCount}</p>
          </div>
        </div>

        {/* By Status */}
        {Object.keys(byStatus).length > 0 && (
          <div className="thb-card overflow-hidden">
            <div className="px-5 py-4 border-b border-thb-border bg-slate-50">
              <h3 className="font-semibold text-thb-text-primary">Candidates by Status</h3>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left py-3 px-4 font-semibold text-thb-text-secondary">Status</th>
                  <th className="text-right py-3 px-4 font-semibold text-thb-text-secondary">Count</th>
                  <th className="text-right py-3 px-4 font-semibold text-thb-text-secondary">% of Total</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(byStatus).map(([status, count]: [string, any]) => (
                  <tr key={status} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="py-2.5 px-4 font-medium text-thb-text-primary capitalize">{status.replace(/_/g, ' ')}</td>
                    <td className="py-2.5 px-4 text-right text-thb-text-primary">{count}</td>
                    <td className="py-2.5 px-4 text-right text-thb-text-muted">{total > 0 ? Math.round((count / total) * 100) : 0}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* BGV Stats */}
        {bgvByStatus && Object.keys(bgvByStatus).length > 0 && (
          <div className="thb-card overflow-hidden">
            <div className="px-5 py-4 border-b border-thb-border bg-slate-50">
              <h3 className="font-semibold text-thb-text-primary">Background Verification</h3>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4">
              {Object.entries(bgvByStatus).map(([status, count]: [string, any]) => (
                <div key={status} className="text-center p-3 rounded-lg bg-slate-50">
                  <p className="text-lg font-bold text-thb-text-primary">{count}</p>
                  <p className="text-xs text-thb-text-muted capitalize">{status.replace(/_/g, ' ')}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderDocuments = () => {
    if (!reportData) return null;
    const { summary, items } = reportData;

    return (
      <div className="space-y-4">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div className="thb-card p-4">
            <p className="text-xs text-thb-text-muted mb-1">BGV Cleared</p>
            <p className="text-2xl font-bold text-green-600">{summary.bgvCleared}</p>
          </div>
          <div className="thb-card p-4">
            <p className="text-xs text-thb-text-muted mb-1">BGV Pending</p>
            <p className="text-2xl font-bold text-amber-600">{summary.bgvPending + summary.bgvInProgress}</p>
          </div>
          <div className="thb-card p-4">
            <p className="text-xs text-thb-text-muted mb-1">HR Verified</p>
            <p className="text-2xl font-bold text-green-600">{summary.hrVerified}</p>
          </div>
        </div>

        {/* Detail Table */}
        {items && items.length > 0 ? (
          <div className="thb-card overflow-hidden">
            <div className="px-5 py-4 border-b border-thb-border bg-slate-50">
              <h3 className="font-semibold text-thb-text-primary">Candidate Document Status</h3>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left py-3 px-4 font-semibold text-thb-text-secondary">Stage</th>
                  <th className="text-center py-3 px-4 font-semibold text-thb-text-secondary">BGV</th>
                  <th className="text-center py-3 px-4 font-semibold text-thb-text-secondary">HR Verified</th>
                  <th className="text-center py-3 px-4 font-semibold text-thb-text-secondary">Account</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item: any) => (
                  <tr key={item.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="py-2.5 px-4 font-medium text-thb-text-primary capitalize">{item.status?.replace(/_/g, ' ')}</td>
                    <td className="py-2.5 px-4 text-center">
                      {item.backgroundCheckStatus === 'cleared' ? <FiCheckCircle className="w-4 h-4 text-green-500 inline" /> :
                       item.backgroundCheckStatus === 'failed' ? <FiAlertCircle className="w-4 h-4 text-red-500 inline" /> :
                       <FiClock className="w-4 h-4 text-amber-500 inline" />}
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      {item.hrVerified ? <FiCheckCircle className="w-4 h-4 text-green-500 inline" /> : <FiCircle className="w-4 h-4 text-slate-300 inline" />}
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      {item.accountProvisioned ? <FiMonitor className="w-4 h-4 text-green-500 inline" /> : <FiMonitor className="w-4 h-4 text-slate-300 inline" />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="thb-card p-8 text-center">
            <FiFileText className="w-12 h-12 text-thb-text-muted mx-auto mb-3" />
            <p className="text-sm text-thb-text-muted">No candidate document data available</p>
          </div>
        )}
      </div>
    );
  };

  const renderPipeline = () => {
    if (!reportData) return null;
    const { monthly, upcomingJoinings30d } = reportData;

    return (
      <div className="space-y-4">
        {/* Upcoming Joinings */}
        <div className="thb-card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-amber-50">
              <FiCalendar className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-thb-text-muted">Upcoming Joinings (30 days)</p>
              <p className="text-2xl font-bold text-thb-text-primary">{upcomingJoinings30d}</p>
            </div>
          </div>
        </div>

        {/* Monthly Trend */}
        {Object.keys(monthly).length > 0 ? (
          <div className="thb-card overflow-hidden">
            <div className="px-5 py-4 border-b border-thb-border bg-slate-50">
              <h3 className="font-semibold text-thb-text-primary">Monthly Joining Pipeline</h3>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left py-3 px-4 font-semibold text-thb-text-secondary">Month</th>
                  <th className="text-right py-3 px-4 font-semibold text-thb-text-secondary">Joined</th>
                  <th className="text-right py-3 px-4 font-semibold text-thb-text-secondary">Expected</th>
                  <th className="text-right py-3 px-4 font-semibold text-thb-text-secondary">Cancelled</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(monthly).map(([month, data]: [string, any]) => (
                  <tr key={month} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="py-2.5 px-4 font-medium text-thb-text-primary">{month}</td>
                    <td className="py-2.5 px-4 text-right text-green-600 font-medium">{data.joined}</td>
                    <td className="py-2.5 px-4 text-right text-amber-600 font-medium">{data.expected}</td>
                    <td className="py-2.5 px-4 text-right text-red-500 font-medium">{data.cancelled}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="thb-card p-8 text-center">
            <FiCalendar className="w-12 h-12 text-thb-text-muted mx-auto mb-3" />
            <p className="text-sm text-thb-text-muted">No pipeline data available</p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-green-50">
          <FiBarChart2 className="w-5 h-5 text-green-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-thb-text-primary">Preboarding Reports</h1>
          <p className="text-sm text-thb-text-secondary">Track pre-joining progress and document readiness</p>
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

      {/* Report Content */}
      {loading ? (
        <div className="thb-card p-8">
          <div className="space-y-3 animate-pulse">
            <div className="h-6 bg-slate-200 rounded w-40" />
            <div className="grid grid-cols-4 gap-3">
              {[1, 2, 3, 4].map(i => <div key={i} className="h-20 bg-slate-100 rounded" />)}
            </div>
            <div className="h-40 bg-slate-100 rounded" />
          </div>
        </div>
      ) : !reportData ? (
        <div className="thb-card p-8 text-center">
          <FiUserPlus className="w-12 h-12 text-thb-text-muted mx-auto mb-3" />
          <h3 className="text-thb-text-primary font-semibold mb-1">{activeLabel}</h3>
          <p className="text-sm text-thb-text-muted">No data available. Add preboarding candidates to see reports.</p>
        </div>
      ) : (
        <>
          {activeReport === 'summary' && renderSummary()}
          {activeReport === 'documents' && renderDocuments()}
          {activeReport === 'pipeline' && renderPipeline()}
        </>
      )}
    </div>
  );
}
