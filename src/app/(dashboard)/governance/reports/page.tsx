'use client';

import { useState, useEffect } from 'react';
import { FiDownload, FiShield, FiBarChart2, FiFileText, FiAlertCircle, FiGrid, FiGitBranch } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';

type ReportType = 'compliance-audit' | 'workflow-analytics' | 'policy-adherence';

const reportTabs: { key: ReportType; label: string; icon: React.ReactNode; desc: string }[] = [
  { key: 'compliance-audit', label: 'Compliance Audit', icon: <FiShield className="w-5 h-5" />, desc: 'Audit trail and compliance' },
  { key: 'workflow-analytics', label: 'Workflow Analytics', icon: <FiBarChart2 className="w-5 h-5" />, desc: 'Workflow performance metrics' },
  { key: 'policy-adherence', label: 'Policy Adherence', icon: <FiFileText className="w-5 h-5" />, desc: 'Policy compliance tracking' },
];

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

/* ── Report data types ── */
interface WorkflowStats {
  totalDefinitions: number;
  activeDefinitions: number;
  totalInstances: number;
  byStatus: { status: string; count: number }[];
  recentExecutions: {
    id: string;
    workflowName: string;
    module: string;
    entityType: string;
    status: string;
    currentStep: number;
    createdAt: string;
    updatedAt: string;
  }[];
}

interface PolicyMetrics {
  total: number;
  active: number;
  byCategory: { category: string; count: number }[];
  byStatus: { status: string; count: number }[];
}

interface AuditSummary {
  totalLast30Days: number;
  byModule: { module: string; count: number }[];
  byAction: { action: string; count: number }[];
}

interface NotificationStats {
  totalLast30Days: number;
  unreadLast30Days: number;
  byCategory: { category: string; count: number }[];
  byType: { type: string; count: number }[];
}

interface ReportData {
  workflowStats?: WorkflowStats;
  policyMetrics?: PolicyMetrics;
  auditSummary?: AuditSummary;
  notificationStats?: NotificationStats;
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'approved': return 'bg-emerald-50 text-emerald-700';
    case 'pending': return 'bg-amber-50 text-amber-700';
    case 'rejected': return 'bg-red-50 text-red-700';
    case 'cancelled': return 'bg-slate-100 text-slate-600';
    default: return 'bg-green-50 text-green-700';
  }
}

export default function GovernanceReportsPage() {
  const { token } = useAuthStore();
  const [activeReport, setActiveReport] = useState<ReportType>('compliance-audit');
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    async function fetchReportData() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/governance/reports?type=${activeReport}`, { headers: getAuthHeaders() });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `Failed to fetch report data (${res.status})`);
        }
        const data = await res.json();
        setReportData(data);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to load report data';
        setError(msg);
        toast.error(msg);
      } finally {
        setLoading(false);
      }
    }

    if (token) {
      fetchReportData();
    }
  }, [token, activeReport]);

  const handleExport = () => {
    if (!reportData) return;
    setExporting(true);
    try {
      const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `governance-${activeReport}-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Report exported successfully');
    } catch {
      toast.error('Export failed');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-thb-text-primary">Governance Reports</h1>
          <p className="text-sm text-thb-text-secondary mt-1">Generate and export governance analytics</p>
        </div>
        <button
          onClick={handleExport}
          disabled={exporting || !reportData}
          className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
        >
          <FiDownload className="w-4 h-4" /> {exporting ? 'Exporting...' : 'Export Report'}
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {reportTabs.map(r => (
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

      {/* Loading */}
      {loading && (
        <div className="thb-card p-8 text-center">
          <FiGrid className="w-8 h-8 animate-pulse text-green-400 mx-auto" />
          <p className="text-sm text-thb-text-muted mt-3">Loading report data...</p>
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="thb-card p-8 text-center">
          <FiAlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
          <p className="text-sm text-red-600 font-medium">{error}</p>
        </div>
      )}

      {/* Report Content */}
      {!loading && !error && reportData && (
        <>
          {/* Compliance Audit Report */}
          {activeReport === 'compliance-audit' && (
            <div className="space-y-4">
              {reportData.policyMetrics && (
                <div className="thb-card overflow-hidden">
                  <div className="px-5 py-4 border-b border-thb-border">
                    <h2 className="font-semibold text-thb-text-primary">Policy Compliance</h2>
                  </div>
                  <div className="p-5">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                      <div className="text-center p-3 bg-slate-50 rounded-lg">
                        <p className="text-2xl font-bold text-thb-text-primary">{reportData.policyMetrics.total}</p>
                        <p className="text-xs text-thb-text-muted">Total Policies</p>
                      </div>
                      <div className="text-center p-3 bg-emerald-50 rounded-lg">
                        <p className="text-2xl font-bold text-emerald-600">{reportData.policyMetrics.active}</p>
                        <p className="text-xs text-thb-text-muted">Active</p>
                      </div>
                    </div>
                    {reportData.policyMetrics.byCategory.length > 0 && (
                      <div className="mt-4">
                        <p className="text-sm font-medium text-thb-text-primary mb-2">By Category</p>
                        <div className="flex flex-wrap gap-2">
                          {reportData.policyMetrics.byCategory.map(c => (
                            <span key={c.category} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 rounded-full text-xs font-medium text-thb-text-primary">
                              {c.category} <span className="text-thb-text-muted">({c.count})</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {reportData.policyMetrics.byStatus.length > 0 && (
                      <div className="mt-4">
                        <p className="text-sm font-medium text-thb-text-primary mb-2">By Status</p>
                        <div className="flex flex-wrap gap-2">
                          {reportData.policyMetrics.byStatus.map(s => (
                            <span key={s.status} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 rounded-full text-xs font-medium text-thb-text-primary">
                              {s.status} <span className="text-thb-text-muted">({s.count})</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {reportData.auditSummary && (
                <div className="thb-card overflow-hidden">
                  <div className="px-5 py-4 border-b border-thb-border">
                    <h2 className="font-semibold text-thb-text-primary">Audit Summary (Last 30 Days)</h2>
                  </div>
                  <div className="p-5">
                    <div className="text-center p-3 bg-slate-50 rounded-lg mb-4 inline-block">
                      <p className="text-2xl font-bold text-thb-text-primary">{reportData.auditSummary.totalLast30Days}</p>
                      <p className="text-xs text-thb-text-muted">Audit Events</p>
                    </div>
                    {reportData.auditSummary.byModule.length > 0 && (
                      <div className="mt-4">
                        <p className="text-sm font-medium text-thb-text-primary mb-2">Top Modules</p>
                        <div className="space-y-2">
                          {reportData.auditSummary.byModule.map(m => (
                            <div key={m.module} className="flex items-center gap-3">
                              <span className="text-xs text-thb-text-primary w-24 truncate">{m.module}</span>
                              <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full bg-green-500 rounded-full" style={{ width: `${Math.min(100, (m.count / (reportData.auditSummary?.totalLast30Days || 1)) * 100)}%` }} />
                              </div>
                              <span className="text-xs text-thb-text-muted w-8 text-right">{m.count}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {!reportData.policyMetrics && !reportData.auditSummary && (
                <div className="thb-card p-8 text-center">
                  <FiShield className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-sm text-thb-text-muted">No compliance audit data available</p>
                </div>
              )}
            </div>
          )}

          {/* Workflow Analytics Report */}
          {activeReport === 'workflow-analytics' && reportData.workflowStats && (
            <div className="space-y-4">
              <div className="thb-card overflow-hidden">
                <div className="px-5 py-4 border-b border-thb-border">
                  <h2 className="font-semibold text-thb-text-primary">Workflow Execution Stats</h2>
                </div>
                <div className="p-5">
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="text-center p-3 bg-slate-50 rounded-lg">
                      <p className="text-2xl font-bold text-thb-text-primary">{reportData.workflowStats.totalDefinitions}</p>
                      <p className="text-xs text-thb-text-muted">Definitions</p>
                    </div>
                    <div className="text-center p-3 bg-green-50 rounded-lg">
                      <p className="text-2xl font-bold text-green-600">{reportData.workflowStats.activeDefinitions}</p>
                      <p className="text-xs text-thb-text-muted">Active</p>
                    </div>
                    <div className="text-center p-3 bg-emerald-50 rounded-lg">
                      <p className="text-2xl font-bold text-emerald-600">{reportData.workflowStats.totalInstances}</p>
                      <p className="text-xs text-thb-text-muted">Instances</p>
                    </div>
                  </div>

                  {reportData.workflowStats.byStatus.length > 0 && (
                    <div className="mt-4">
                      <p className="text-sm font-medium text-thb-text-primary mb-2">By Status</p>
                      <div className="flex flex-wrap gap-2">
                        {reportData.workflowStats.byStatus.map(s => (
                          <span key={s.status} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${getStatusBadge(s.status)}`}>
                            {s.status} ({s.count})
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {reportData.workflowStats.recentExecutions.length > 0 && (
                <div className="thb-card overflow-hidden">
                  <div className="px-5 py-4 border-b border-thb-border">
                    <h2 className="font-semibold text-thb-text-primary">Recent Executions</h2>
                  </div>
                  <div className="divide-y divide-thb-border max-h-64 overflow-y-auto">
                    {reportData.workflowStats.recentExecutions.map(ex => (
                      <div key={ex.id} className="flex items-center gap-3 px-5 py-3">
                        <FiGitBranch className="w-4 h-4 text-green-500 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-thb-text-primary truncate">{ex.workflowName}</p>
                          <p className="text-xs text-thb-text-muted">{ex.module} · {ex.entityType}</p>
                        </div>
                        <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${getStatusBadge(ex.status)}`}>
                          {ex.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeReport === 'workflow-analytics' && !reportData.workflowStats && (
            <div className="thb-card p-8 text-center">
              <FiBarChart2 className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-thb-text-muted">No workflow analytics data available</p>
            </div>
          )}

          {/* Policy Adherence Report */}
          {activeReport === 'policy-adherence' && (
            <div className="space-y-4">
              {reportData.policyMetrics && (
                <div className="thb-card overflow-hidden">
                  <div className="px-5 py-4 border-b border-thb-border">
                    <h2 className="font-semibold text-thb-text-primary">Policy Adherence</h2>
                  </div>
                  <div className="p-5">
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="text-center p-3 bg-slate-50 rounded-lg">
                        <p className="text-2xl font-bold text-thb-text-primary">{reportData.policyMetrics.total}</p>
                        <p className="text-xs text-thb-text-muted">Total Policies</p>
                      </div>
                      <div className="text-center p-3 bg-emerald-50 rounded-lg">
                        <p className="text-2xl font-bold text-emerald-600">{reportData.policyMetrics.active}</p>
                        <p className="text-xs text-thb-text-muted">Active Policies</p>
                      </div>
                    </div>
                    {reportData.policyMetrics.byCategory.length > 0 && (
                      <div className="space-y-3 mt-4">
                        <p className="text-sm font-medium text-thb-text-primary mb-2">Adherence by Category</p>
                        {reportData.policyMetrics.byCategory.map(c => {
                          const pct = reportData.policyMetrics!.total > 0 ? Math.round((c.count / reportData.policyMetrics!.total) * 100) : 0;
                          return (
                            <div key={c.category}>
                              <div className="flex justify-between mb-1">
                                <span className="text-xs text-thb-text-primary">{c.category}</span>
                                <span className="text-xs text-thb-text-muted">{c.count} ({pct}%)</span>
                              </div>
                              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full bg-green-500 rounded-full" style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {reportData.notificationStats && (
                <div className="thb-card overflow-hidden">
                  <div className="px-5 py-4 border-b border-thb-border">
                    <h2 className="font-semibold text-thb-text-primary">Notification Delivery (30d)</h2>
                  </div>
                  <div className="p-5">
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="text-center p-3 bg-slate-50 rounded-lg">
                        <p className="text-2xl font-bold text-thb-text-primary">{reportData.notificationStats.totalLast30Days}</p>
                        <p className="text-xs text-thb-text-muted">Total</p>
                      </div>
                      <div className="text-center p-3 bg-amber-50 rounded-lg">
                        <p className="text-2xl font-bold text-amber-600">{reportData.notificationStats.unreadLast30Days}</p>
                        <p className="text-xs text-thb-text-muted">Unread</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {!reportData.policyMetrics && !reportData.notificationStats && (
                <div className="thb-card p-8 text-center">
                  <FiFileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-sm text-thb-text-muted">No policy adherence data available</p>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* No data state */}
      {!loading && !error && !reportData && (
        <div className="thb-card p-8 text-center">
          <FiBarChart2 className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-thb-text-muted">No report data available</p>
        </div>
      )}
    </div>
  );
}
