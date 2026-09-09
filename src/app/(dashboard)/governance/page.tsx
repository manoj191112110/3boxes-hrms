'use client';

import { useState, useEffect } from 'react';
import {
  FiGrid, FiGitBranch, FiShield, FiClock, FiBarChart2, FiCheckCircle, FiAlertCircle, FiArrowRight,
} from 'react-icons/fi';
import { useAuthStore } from '@/store/authStore';
import toast from 'react-hot-toast';

/* ── Types ── */
interface KpiData {
  activeWorkflows: number;
  policyDocuments: number;
  pendingApprovals: number;
  complianceScore: number;
}

interface WorkflowActivityItem {
  id: string;
  title: string;
  status: string;
  time: string;
  module: string;
}

interface ComplianceItem {
  label: string;
  percent: number;
}

interface DashboardData {
  kpis: KpiData;
  workflowActivity: WorkflowActivityItem[];
  complianceItems: ComplianceItem[];
  metrics?: {
    auditLogsLast30Days: number;
    notificationsLast30Days: number;
    totalWorkflowInstances: number;
    completedWorkflowInstances: number;
  };
}

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

function formatRelativeTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString();
  } catch {
    return isoString;
  }
}

function getWorkflowBadge(status: string) {
  switch (status) {
    case 'Completed': return 'bg-emerald-50 text-emerald-700';
    case 'In Progress': return 'bg-green-50 text-green-700';
    case 'Pending': return 'bg-amber-50 text-amber-700';
    case 'Rejected': return 'bg-red-50 text-red-700';
    default: return 'bg-slate-100 text-slate-600';
  }
}

function getWorkflowIcon(status: string) {
  switch (status) {
    case 'Completed': return <FiCheckCircle className="w-4 h-4 text-emerald-500" />;
    case 'In Progress': return <FiArrowRight className="w-4 h-4 text-green-500" />;
    case 'Pending': return <FiClock className="w-4 h-4 text-amber-500" />;
    case 'Rejected': return <FiAlertCircle className="w-4 h-4 text-red-500" />;
    default: return <FiAlertCircle className="w-4 h-4 text-slate-400" />;
  }
}

function getComplianceColor(percent: number) {
  if (percent >= 90) return 'bg-green-500';
  if (percent >= 75) return 'bg-emerald-500';
  if (percent >= 60) return 'bg-teal-500';
  if (percent >= 40) return 'bg-amber-500';
  return 'bg-red-500';
}

export default function GovernancePage() {
  const { token } = useAuthStore();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDashboard() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch('/api/governance/dashboard', { headers: getAuthHeaders() });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `Failed to fetch dashboard data (${res.status})`);
        }
        const dashboardData = await res.json();
        setData(dashboardData);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to load governance dashboard';
        setError(msg);
        toast.error(msg);
      } finally {
        setLoading(false);
      }
    }

    if (token) {
      fetchDashboard();
    }
  }, [token]);

  /* ── KPI cards derived from API data ── */
  const kpiCards = data
    ? [
        { label: 'Active Workflows', value: String(data.kpis.activeWorkflows), icon: FiGitBranch, color: 'bg-green-50 text-green-600', accent: 'bg-green-500' },
        { label: 'Policy Documents', value: String(data.kpis.policyDocuments), icon: FiShield, color: 'bg-emerald-50 text-emerald-600', accent: 'bg-emerald-500' },
        { label: 'Pending Approvals', value: String(data.kpis.pendingApprovals), icon: FiClock, color: 'bg-amber-50 text-amber-600', accent: 'bg-amber-500' },
        { label: 'Compliance Score', value: `${data.kpis.complianceScore}%`, icon: FiBarChart2, color: 'bg-teal-50 text-teal-600', accent: 'bg-teal-500' },
      ]
    : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-green-50">
          <FiGrid className="w-5 h-5 text-green-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-thb-text-primary">Governance Dashboard</h1>
          <p className="text-sm text-thb-text-secondary">Track workflows, compliance, and policy management</p>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="flex flex-col items-center gap-3">
            <FiGrid className="w-8 h-8 animate-pulse text-green-400" />
            <p className="text-sm text-thb-text-muted">Loading governance data...</p>
          </div>
        </div>
      )}

      {/* Error State */}
      {!loading && error && (
        <div className="thb-card p-8 text-center">
          <FiAlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
          <p className="text-sm text-red-600 font-medium">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-3 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium"
          >
            Retry
          </button>
        </div>
      )}

      {/* Data Loaded */}
      {!loading && !error && data && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {kpiCards.map((kpi) => {
              const Icon = kpi.icon;
              return (
                <div key={kpi.label} className="thb-card p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${kpi.color}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className={`w-1 h-8 rounded-full ${kpi.accent}`} />
                  </div>
                  <p className="text-2xl font-bold text-thb-text-primary">{kpi.value}</p>
                  <p className="text-xs text-thb-text-muted mt-1">{kpi.label}</p>
                </div>
              );
            })}
          </div>

          {/* Bottom Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Workflow Activity */}
            <div className="thb-card overflow-hidden">
              <div className="px-5 py-4 border-b border-thb-border">
                <h2 className="font-semibold text-thb-text-primary">Recent Workflow Activity</h2>
                <p className="text-xs text-thb-text-muted mt-0.5">Latest governance workflow updates</p>
              </div>
              {data.workflowActivity.length === 0 ? (
                <div className="px-5 py-10 text-center">
                  <FiGitBranch className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-thb-text-muted">No workflow activity yet</p>
                </div>
              ) : (
                <div className="divide-y divide-thb-border max-h-96 overflow-y-auto">
                  {data.workflowActivity.map((wf) => (
                    <div key={wf.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 transition-colors">
                      {getWorkflowIcon(wf.status)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-thb-text-primary font-medium truncate">{wf.title}</p>
                        <p className="text-xs text-thb-text-muted mt-0.5">{formatRelativeTime(wf.time)}</p>
                      </div>
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap ${getWorkflowBadge(wf.status)}`}>
                        {wf.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Compliance Overview */}
            <div className="thb-card overflow-hidden">
              <div className="px-5 py-4 border-b border-thb-border">
                <h2 className="font-semibold text-thb-text-primary">Compliance Overview</h2>
                <p className="text-xs text-thb-text-muted mt-0.5">Current compliance status across frameworks</p>
              </div>
              {data.complianceItems.length === 0 ? (
                <div className="p-5 py-10 text-center">
                  <FiShield className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-thb-text-muted">No compliance data available</p>
                  <p className="text-xs text-thb-text-muted mt-1">Add active policies to see compliance metrics</p>
                </div>
              ) : (
                <div className="p-5 space-y-5">
                  {data.complianceItems.map((item) => (
                    <div key={item.label}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-medium text-thb-text-primary">{item.label}</span>
                        <span className="text-sm font-bold text-thb-text-primary">{item.percent}%</span>
                      </div>
                      <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${getComplianceColor(item.percent)} transition-all duration-700`}
                          style={{ width: `${item.percent}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Additional Metrics */}
          {data.metrics && (
            <div className="thb-card p-5">
              <h2 className="font-semibold text-thb-text-primary mb-3">Additional Metrics</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="text-center">
                  <p className="text-xl font-bold text-thb-text-primary">{data.metrics.auditLogsLast30Days}</p>
                  <p className="text-xs text-thb-text-muted mt-1">Audit Logs (30d)</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold text-thb-text-primary">{data.metrics.notificationsLast30Days}</p>
                  <p className="text-xs text-thb-text-muted mt-1">Notifications (30d)</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold text-thb-text-primary">{data.metrics.totalWorkflowInstances}</p>
                  <p className="text-xs text-thb-text-muted mt-1">Total Instances</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold text-thb-text-primary">{data.metrics.completedWorkflowInstances}</p>
                  <p className="text-xs text-thb-text-muted mt-1">Completed Instances</p>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Empty state when no data and no error (e.g. no token) */}
      {!loading && !error && !data && (
        <div className="thb-card p-8 text-center">
          <FiGrid className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-thb-text-muted">No governance data available</p>
        </div>
      )}
    </div>
  );
}
