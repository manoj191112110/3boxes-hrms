'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  FiLock, FiRefreshCw, FiSearch, FiChevronLeft, FiFilter, FiActivity, FiInfo, FiShield,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import SrsBanner from '@/components/SrsBanner';

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

interface AuditLog {
  id: string;
  userId: string | null;
  action: string;
  module: string;
  details: string | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
  user?: { id: string; name: string; email: string } | null;
}

interface Pagination { page: number; limit: number; total: number; totalPages: number; }

const ACTION_LABELS: Record<string, string> = {
  CONTEXT_SWAP: 'Context Swap',
  LOGIN: 'Login',
  LOGOUT: 'Logout',
  CREATE_TENANT: 'Create Tenant',
  UPDATE_TENANT: 'Update Tenant',
  DELETE_TENANT: 'Delete Tenant',
  FEATURE_FLAG_UPDATE: 'Feature Flag Update',
};

function actionBadgeClass(action: string): string {
  if (action === 'CONTEXT_SWAP') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (action === 'CREATE_TENANT') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (action === 'DELETE_TENANT') return 'bg-rose-50 text-rose-700 border-rose-200';
  if (action === 'UPDATE_TENANT') return 'bg-amber-50 text-amber-700 border-amber-200';
  if (action === 'FEATURE_FLAG_UPDATE') return 'bg-teal-50 text-teal-700 border-teal-200';
  if (action === 'LOGIN' || action === 'LOGOUT') return 'bg-slate-50 text-slate-700 border-slate-200';
  return 'bg-slate-50 text-slate-700 border-slate-200';
}

export default function AuditLogsPage() {
  const { user } = useAuthStore();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 30, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(false);

  // Filters
  const [actionFilter, setActionFilter] = useState<string>('');
  const [moduleFilter, setModuleFilter] = useState<string>('');
  const [search, setSearch] = useState<string>('');

  const fetchLogs = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(pagination.limit));
      if (actionFilter) params.set('action', actionFilter);
      if (moduleFilter) params.set('module', moduleFilter);
      const res = await fetch(`/api/super-admin/audit-logs?${params.toString()}`, { headers: getAuthHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load audit logs');
      setLogs(data.logs || []);
      setPagination(data.pagination || { page, limit: pagination.limit, total: 0, totalPages: 0 });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load audit logs');
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [actionFilter, moduleFilter, pagination.limit]);

  useEffect(() => {
    if (user?.role === 'super_admin') fetchLogs(1);
  }, [user?.role, fetchLogs]);

  if (user?.role !== 'super_admin') {
    return (
      <div className="p-6">
        <div className="thb-card p-8 text-center">
          <FiLock className="w-10 h-10 text-rose-500 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-slate-800">Super Admins Only</h2>
          <p className="text-sm text-slate-500 mt-1">Audit logs are visible only to the platform owner.</p>
          <Link href="/home" className="mt-4 inline-block text-sm font-semibold text-green-600 hover:text-green-700">
            ← Back to Home
          </Link>
        </div>
      </div>
    );
  }

  const filteredLogs = search
    ? logs.filter((l) =>
        (l.details || '').toLowerCase().includes(search.toLowerCase()) ||
        (l.user?.email || '').toLowerCase().includes(search.toLowerCase()) ||
        (l.user?.name || '').toLowerCase().includes(search.toLowerCase())
      )
    : logs;

  return (
    <div className="space-y-6">
      <SrsBanner role="super_admin" />

      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/super-admin"
            className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors"
            title="Back to Super Admin Console"
          >
            <FiChevronLeft className="w-4 h-4 text-slate-600" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-thb-text-primary flex items-center gap-2">
              <FiActivity className="w-6 h-6 text-amber-500" />
              Audit Logs
            </h1>
            <p className="text-sm text-thb-text-secondary mt-0.5">
              <span className="font-mono text-[11px] bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded">REQ-SA-10 · REQ-SEC-06</span>
              {' '}Immutable record of every context swap, tenant lifecycle event, and permission change.
            </p>
          </div>
        </div>
        <button
          onClick={() => fetchLogs(pagination.page)}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3 py-2 border border-thb-border rounded-lg text-sm font-medium text-thb-text-secondary hover:bg-slate-50 transition-colors disabled:opacity-50"
        >
          <FiRefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="thb-card p-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5">
          <FiFilter className="w-4 h-4 text-slate-500" />
          <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Filter:</span>
        </div>
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400"
        >
          <option value="">All actions</option>
          {Object.entries(ACTION_LABELS).map(([val, label]) => (
            <option key={val} value={val}>{label}</option>
          ))}
        </select>
        <select
          value={moduleFilter}
          onChange={(e) => setModuleFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400"
        >
          <option value="">All modules</option>
          <option value="context_swap">context_swap</option>
          <option value="auth">auth</option>
          <option value="tenants">tenants</option>
          <option value="feature_flags">feature_flags</option>
          <option value="rbac">rbac</option>
        </select>
        <div className="relative flex-1 min-w-[200px]">
          <FiSearch className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by user email, name, or details…"
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400"
          />
        </div>
        <span className="text-[11px] text-slate-500">
          Showing {filteredLogs.length} of {pagination.total} total
        </span>
      </div>

      {/* Logs table */}
      <div className="thb-card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500 text-sm">Loading audit logs…</div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-10 text-center">
            <FiInfo className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-500">No audit logs match your filters.</p>
            <p className="text-[11px] text-slate-400 mt-1">
              Try clearing the filters, or trigger a context swap from the header dropdown to generate a new entry.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50/80 border-b border-slate-200">
                <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-2.5">When</th>
                  <th className="px-4 py-2.5">Action</th>
                  <th className="px-4 py-2.5">User</th>
                  <th className="px-4 py-2.5">Details</th>
                  <th className="px-4 py-2.5">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLogs.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50/40 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap text-[12px] text-slate-600">
                      {new Date(l.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${actionBadgeClass(l.action)}`}>
                        {l.action === 'CONTEXT_SWAP' && <FiShield className="w-2.5 h-2.5" />}
                        {ACTION_LABELS[l.action] || l.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {l.user ? (
                        <div>
                          <p className="text-[12px] font-medium text-slate-800">{l.user.name}</p>
                          <p className="text-[11px] text-slate-500">{l.user.email}</p>
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">system</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[12px] text-slate-700 max-w-[420px]">
                      <p className="line-clamp-2">{l.details || <span className="italic text-slate-400">—</span>}</p>
                      {l.userAgent && (
                        <p className="text-[10px] text-slate-400 mt-0.5 truncate" title={l.userAgent}>{l.userAgent}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-[11px] text-slate-500 font-mono">
                      {l.ip || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/40 flex items-center justify-between text-xs">
            <p className="text-slate-500">
              Page {pagination.page} of {pagination.totalPages} · {pagination.total} total logs
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => fetchLogs(pagination.page - 1)}
                disabled={pagination.page <= 1 || loading}
                className="px-3 py-1.5 rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ← Prev
              </button>
              <button
                onClick={() => fetchLogs(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages || loading}
                className="px-3 py-1.5 rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer note */}
      <div className="rounded-xl border border-amber-100 bg-amber-50/40 p-4 flex items-start gap-3">
        <FiInfo className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="text-[12px] text-amber-900 leading-relaxed">
          <b>Immutability:</b> Audit log entries are append-only and never edited or deleted (SRS REQ-SEC-06). The
          <code className="font-mono text-[10px] bg-amber-100 px-1 py-0.5 rounded mx-1">CONTEXT_SWAP</code> action
          (REQ-SA-10) is recorded every time a super admin swaps contexts via the header dropdown, capturing the from→to
          transition so any unauthorized snooping can be detected post-hoc.
        </div>
      </div>
    </div>
  );
}
