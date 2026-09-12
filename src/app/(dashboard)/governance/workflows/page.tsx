'use client';

import { useState, useEffect } from 'react';
import { FiGitBranch, FiAlertCircle, FiSettings, FiCheckCircle, FiClock } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';

interface WorkflowDef {
  id: string;
  name: string;
  module: string;
  description?: string | null;
  isActive: boolean;
  version: number;
  _count?: { instances: number };
  createdAt: string;
}

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

function getModuleBadge(module: string) {
  const colors: Record<string, string> = {
    leave: 'bg-green-50 text-green-700',
    attendance: 'bg-emerald-50 text-emerald-700',
    payroll: 'bg-teal-50 text-teal-700',
    recruitment: 'bg-amber-50 text-amber-700',
    timesheet: 'bg-slate-100 text-slate-700',
  };
  return colors[module] || 'bg-slate-100 text-slate-600';
}

export default function GovernanceWorkflowsPage() {
  const { token } = useAuthStore();
  const [workflows, setWorkflows] = useState<WorkflowDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchWorkflows() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch('/api/workflows', { headers: getAuthHeaders() });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `Failed to fetch workflows (${res.status})`);
        }
        const data = await res.json();
        setWorkflows(data.workflows || []);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to load workflows';
        setError(msg);
        toast.error(msg);
      } finally {
        setLoading(false);
      }
    }

    if (token) fetchWorkflows();
  }, [token]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-green-50">
          <FiGitBranch className="w-5 h-5 text-green-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-thb-text-primary">Workflow Definitions</h1>
          <p className="text-sm text-thb-text-secondary">Governance · Manage workflow definitions and approval chains</p>
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
      {!loading && !error && (
        <>
          {workflows.length === 0 ? (
            <div className="thb-card p-8 text-center">
              <FiGitBranch className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-thb-text-muted">No workflow definitions found</p>
              <p className="text-xs text-thb-text-muted mt-1">Create workflows from the Workflows module</p>
            </div>
          ) : (
            <div className="thb-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider border-b border-thb-border bg-slate-50/50">Workflow</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider border-b border-thb-border bg-slate-50/50">Module</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider border-b border-thb-border bg-slate-50/50">Version</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider border-b border-thb-border bg-slate-50/50">Instances</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider border-b border-thb-border bg-slate-50/50">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {workflows.map((wf) => (
                      <tr key={wf.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-3 text-sm font-medium text-thb-text-primary border-b border-thb-border/50">
                          <div>
                            <p>{wf.name}</p>
                            {wf.description && <p className="text-xs text-thb-text-muted mt-0.5 truncate max-w-xs">{wf.description}</p>}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm border-b border-thb-border/50">
                          <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${getModuleBadge(wf.module)}`}>
                            {wf.module}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-thb-text-secondary border-b border-thb-border/50">v{wf.version}</td>
                        <td className="px-4 py-3 text-sm text-thb-text-secondary border-b border-thb-border/50">{wf._count?.instances ?? 0}</td>
                        <td className="px-4 py-3 text-sm border-b border-thb-border/50">
                          {wf.isActive ? (
                            <span className="inline-flex items-center gap-1 text-emerald-600"><FiCheckCircle className="w-3.5 h-3.5" /> Active</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-slate-400"><FiClock className="w-3.5 h-3.5" /> Inactive</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
