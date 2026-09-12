'use client';

import { useState, useEffect } from 'react';
import {
  FiBarChart2, FiAlertCircle, FiSettings, FiGitBranch, FiShield, FiFileText, FiBell,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';

/* ── Types ── */
interface WorkflowStats {
  totalDefinitions: number;
  activeDefinitions: number;
  totalInstances: number;
  byStatus: { status: string; count: number }[];
}

interface PolicyMetrics {
  total: number;
  active: number;
  byCategory: { category: string; count: number }[];
}

interface AuditSummary {
  totalLast30Days: number;
  byModule: { module: string; count: number }[];
}

interface NotificationStats {
  totalLast30Days: number;
  unreadLast30Days: number;
}

interface AnalyticsData {
  workflowStats?: WorkflowStats;
  policyMetrics?: PolicyMetrics;
  auditSummary?: AuditSummary;
  notificationStats?: NotificationStats;
}

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

export default function GovernanceReportsAnalyticsPage() {
  const { token } = useAuthStore();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch('/api/governance/reports?type=all', { headers: getAuthHeaders() });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `Failed to fetch analytics (${res.status})`);
        }
        const result = await res.json();
        setData(result);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to load analytics';
        setError(msg);
        toast.error(msg);
      } finally {
        setLoading(false);
      }
    }

    if (token) fetchData();
  }, [token]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-green-50">
          <FiBarChart2 className="w-5 h-5 text-green-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-thb-text-primary">Reports & Analytics</h1>
          <p className="text-sm text-thb-text-secondary">Governance · Combined analytics across workflows, policies, and audit</p>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <FiSettings className="w-8 h-8 animate-spin text-green-400" />
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="thb-card p-8 text-center">
          <FiAlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
          <p className="text-sm text-red-600 font-medium">{error}</p>
        </div>
      )}

      {/* Data */}
      {!loading && !error && data && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="thb-card p-5">
              <div className="flex items-center gap-2 mb-2">
                <FiGitBranch className="w-4 h-4 text-green-500" />
                <span className="text-xs text-thb-text-muted">Active Workflows</span>
              </div>
              <p className="text-2xl font-bold text-thb-text-primary">{data.workflowStats?.activeDefinitions ?? 0}</p>
            </div>
            <div className="thb-card p-5">
              <div className="flex items-center gap-2 mb-2">
                <FiShield className="w-4 h-4 text-emerald-500" />
                <span className="text-xs text-thb-text-muted">Active Policies</span>
              </div>
              <p className="text-2xl font-bold text-thb-text-primary">{data.policyMetrics?.active ?? 0}</p>
            </div>
            <div className="thb-card p-5">
              <div className="flex items-center gap-2 mb-2">
                <FiFileText className="w-4 h-4 text-teal-500" />
                <span className="text-xs text-thb-text-muted">Audit Events (30d)</span>
              </div>
              <p className="text-2xl font-bold text-thb-text-primary">{data.auditSummary?.totalLast30Days ?? 0}</p>
            </div>
            <div className="thb-card p-5">
              <div className="flex items-center gap-2 mb-2">
                <FiBell className="w-4 h-4 text-amber-500" />
                <span className="text-xs text-thb-text-muted">Notifications (30d)</span>
              </div>
              <p className="text-2xl font-bold text-thb-text-primary">{data.notificationStats?.totalLast30Days ?? 0}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Workflow Instances by Status */}
            {data.workflowStats && data.workflowStats.byStatus.length > 0 && (
              <div className="thb-card overflow-hidden">
                <div className="px-5 py-4 border-b border-thb-border">
                  <h2 className="font-semibold text-thb-text-primary">Workflow Instances by Status</h2>
                </div>
                <div className="p-5 space-y-3">
                  {data.workflowStats.byStatus.map(s => {
                    const total = data.workflowStats!.totalInstances || 1;
                    const pct = Math.round((s.count / total) * 100);
                    return (
                      <div key={s.status}>
                        <div className="flex justify-between mb-1">
                          <span className="text-sm text-thb-text-primary capitalize">{s.status}</span>
                          <span className="text-sm font-medium text-thb-text-primary">{s.count} ({pct}%)</span>
                        </div>
                        <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Policy by Category */}
            {data.policyMetrics && data.policyMetrics.byCategory.length > 0 && (
              <div className="thb-card overflow-hidden">
                <div className="px-5 py-4 border-b border-thb-border">
                  <h2 className="font-semibold text-thb-text-primary">Policies by Category</h2>
                </div>
                <div className="p-5 space-y-3">
                  {data.policyMetrics.byCategory.map(c => {
                    const total = data.policyMetrics!.total || 1;
                    const pct = Math.round((c.count / total) * 100);
                    return (
                      <div key={c.category}>
                        <div className="flex justify-between mb-1">
                          <span className="text-sm text-thb-text-primary capitalize">{c.category.replace(/_/g, ' ')}</span>
                          <span className="text-sm font-medium text-thb-text-primary">{c.count} ({pct}%)</span>
                        </div>
                        <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Audit Top Modules */}
            {data.auditSummary && data.auditSummary.byModule.length > 0 && (
              <div className="thb-card overflow-hidden">
                <div className="px-5 py-4 border-b border-thb-border">
                  <h2 className="font-semibold text-thb-text-primary">Audit — Top Modules</h2>
                </div>
                <div className="p-5 space-y-2">
                  {data.auditSummary.byModule.map(m => {
                    const total = data.auditSummary!.totalLast30Days || 1;
                    const pct = Math.round((m.count / total) * 100);
                    return (
                      <div key={m.module} className="flex items-center gap-3">
                        <span className="text-xs text-thb-text-primary w-24 truncate">{m.module}</span>
                        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-teal-500 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-thb-text-muted w-8 text-right">{m.count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Notification Stats */}
            {data.notificationStats && (
              <div className="thb-card overflow-hidden">
                <div className="px-5 py-4 border-b border-thb-border">
                  <h2 className="font-semibold text-thb-text-primary">Notification Delivery (30d)</h2>
                </div>
                <div className="p-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-4 bg-slate-50 rounded-lg">
                      <p className="text-2xl font-bold text-thb-text-primary">{data.notificationStats.totalLast30Days}</p>
                      <p className="text-xs text-thb-text-muted mt-1">Total</p>
                    </div>
                    <div className="text-center p-4 bg-amber-50 rounded-lg">
                      <p className="text-2xl font-bold text-amber-600">{data.notificationStats.unreadLast30Days}</p>
                      <p className="text-xs text-thb-text-muted mt-1">Unread</p>
                    </div>
                  </div>
                  {data.notificationStats.totalLast30Days > 0 && (
                    <div className="mt-4">
                      <div className="flex justify-between mb-1">
                        <span className="text-xs text-thb-text-muted">Read rate</span>
                        <span className="text-xs font-medium text-thb-text-primary">
                          {Math.round(((data.notificationStats.totalLast30Days - data.notificationStats.unreadLast30Days) / data.notificationStats.totalLast30Days) * 100)}%
                        </span>
                      </div>
                      <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-green-500 rounded-full"
                          style={{ width: `${((data.notificationStats.totalLast30Days - data.notificationStats.unreadLast30Days) / data.notificationStats.totalLast30Days) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Empty when no analytics data at all */}
          {!data.workflowStats?.byStatus.length && !data.policyMetrics?.byCategory.length && !data.auditSummary?.byModule.length && !data.notificationStats && (
            <div className="thb-card p-8 text-center">
              <FiBarChart2 className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-thb-text-muted">No analytics data available yet</p>
              <p className="text-xs text-thb-text-muted mt-1">Data will appear as workflows, policies, and audit events are created</p>
            </div>
          )}
        </>
      )}

      {!loading && !error && !data && (
        <div className="thb-card p-8 text-center">
          <FiBarChart2 className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-thb-text-muted">No analytics data available</p>
        </div>
      )}
    </div>
  );
}
