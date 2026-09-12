'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  FiArrowLeft, FiExternalLink, FiRefreshCw, FiFilter,
  FiBriefcase, FiCheckSquare, FiSquare, FiXCircle, FiZap,
  FiAlertCircle, FiCheckCircle, FiClock, FiSearch,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';

/* ── Helpers ── */
function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

function formatDate(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function getPostingStatusBadge(status: string) {
  const map: Record<string, { className: string; label: string; icon: React.ReactNode }> = {
    pending: { className: 'bg-amber-50 text-amber-700 thb-badge', label: 'Pending', icon: <FiClock className="w-3 h-3" /> },
    posted: { className: 'thb-badge thb-badge-success', label: 'Posted', icon: <FiCheckCircle className="w-3 h-3" /> },
    closed: { className: 'thb-badge thb-badge-info', label: 'Closed', icon: <FiXCircle className="w-3 h-3" /> },
    failed: { className: 'thb-badge thb-badge-error', label: 'Failed', icon: <FiAlertCircle className="w-3 h-3" /> },
    expired: { className: 'thb-badge thb-badge-warning', label: 'Expired', icon: <FiClock className="w-3 h-3" /> },
  };
  return map[status] || { className: 'thb-badge thb-badge-info', label: status, icon: null };
}

const BOARD_LABELS: Record<string, string> = {
  linkedin: 'LinkedIn',
  indeed: 'Indeed',
  glassdoor: 'Glassdoor',
  stepstone: 'StepStone',
  naukri: 'Naukri',
  internal_careers: 'Internal Careers',
};

const BOARD_COLORS: Record<string, string> = {
  linkedin: '#0a66c2',
  indeed: '#2164f3',
  glassdoor: '#0caa41',
  stepstone: '#7a1fa2',
  naukri: '#ff7555',
  internal_careers: '#6366f1',
};

interface BoardPosting {
  id: string;
  jobPostingId: string;
  board: string;
  externalJobId?: string | null;
  status: string;
  externalUrl?: string | null;
  errorMessage?: string | null;
  postedAt?: string | null;
  closedAt?: string | null;
  createdAt: string;
  jobPosting?: { id: string; title: string; status: string; department?: { id: string; name: string } | null } | null;
}

export default function JobBoardsAdminPage() {
  const { user } = useAuthStore();
  const isAdmin = ['super_admin', 'tenant_admin', 'admin'].includes(user?.role || '');

  const [postings, setPostings] = useState<BoardPosting[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [filterBoard, setFilterBoard] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [bulkClosing, setBulkClosing] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const fetchPostings = useCallback(async (silent = false) => {
    try {
      if (silent) setRefreshing(true); else setLoading(true);
      const params = new URLSearchParams();
      if (filterBoard) params.set('board', filterBoard);
      if (filterStatus) params.set('status', filterStatus);
      const res = await fetch(`/api/job-board-postings?${params.toString()}`, { headers: getAuthHeaders() });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Failed to load postings');
      }
      const data = await res.json();
      setPostings(Array.isArray(data.postings) ? data.postings : []);
      setSelected({});
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to load postings');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filterBoard, filterStatus]);

  useEffect(() => { queueMicrotask(() => fetchPostings()); }, [fetchPostings]);

  /* Filter by search term (client-side, on jobPosting.title) */
  const filtered = useMemo(() => {
    if (!search) return postings;
    const s = search.toLowerCase();
    return postings.filter((p) => {
      const title = p.jobPosting?.title || '';
      return title.toLowerCase().includes(s) || p.board.toLowerCase().includes(s) || (p.externalJobId || '').toLowerCase().includes(s);
    });
  }, [postings, search]);

  /* Stats */
  const stats = useMemo(() => ({
    total: postings.length,
    posted: postings.filter((p) => p.status === 'posted').length,
    pending: postings.filter((p) => p.status === 'pending').length,
    closed: postings.filter((p) => p.status === 'closed').length,
    failed: postings.filter((p) => p.status === 'failed').length,
  }), [postings]);

  /* Bulk close */
  const selectedIds = Object.keys(selected).filter((id) => selected[id]);
  const selectedOpenCount = selectedIds.filter((id) => {
    const p = postings.find((x) => x.id === id);
    return p && (p.status === 'posted' || p.status === 'pending');
  }).length;

  const handleBulkClose = async () => {
    if (selectedIds.length === 0) {
      toast.error('Select at least one posting to close');
      return;
    }
    if (!confirm(`Close ${selectedOpenCount} of ${selectedIds.length} selected posting(s)? (Only posted/pending will be closed.)`)) return;
    try {
      setBulkClosing(true);
      const results = await Promise.allSettled(
        selectedIds.map((id) =>
          fetch(`/api/job-board-postings/${id}`, { method: 'DELETE', headers: getAuthHeaders() })
        )
      );
      const okCount = results.filter((r) => r.status === 'fulfilled' && r.value.ok).length;
      toast.success(`Closed ${okCount} posting(s)`);
      fetchPostings(true);
    } finally {
      setBulkClosing(false);
    }
  };

  /* Trigger sync (auto-close board postings for filled jobs) */
  const handleSync = async () => {
    try {
      setSyncing(true);
      const res = await fetch('/api/job-board-postings/sync', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Sync failed');
      }
      const data = await res.json();
      const msg = `Sync complete. Scanned ${data.scanned ?? 0}, closed ${data.closed ?? 0}, errors ${data.errors ?? 0}.`;
      toast.success(msg);
      fetchPostings(true);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  /* Single close */
  const handleClose = async (id: string) => {
    try {
      const res = await fetch(`/api/job-board-postings/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Failed to close');
      }
      toast.success('Posting closed');
      fetchPostings(true);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to close');
    }
  };

  const allSelected = filtered.length > 0 && filtered.every((p) => selected[p.id]);

  const toggleAll = () => {
    if (allSelected) {
      setSelected({});
    } else {
      const next: Record<string, boolean> = {};
      filtered.forEach((p) => { next[p.id] = true; });
      setSelected(next);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Link href="/recruitment" className="inline-flex items-center gap-2 text-sm text-thb-text-secondary hover:text-thb-text-primary mb-2">
            <FiArrowLeft className="w-4 h-4" /> Back to Recruitment
          </Link>
          <h1 className="text-2xl font-bold text-thb-text-primary flex items-center gap-2">
            <FiExternalLink className="w-6 h-6 text-teal-500" />
            Job Board Multi-Posting
          </h1>
          <p className="text-thb-text-secondary mt-1">
            Manage all external job board postings across all jobs
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="inline-flex items-center gap-2 px-3 py-2 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 disabled:opacity-50 transition-colors"
            title="Auto-close board postings for filled jobs (REQ-SRC-03)"
          >
            <FiZap className={`w-4 h-4 ${syncing ? 'animate-pulse' : ''}`} />
            {syncing ? 'Syncing...' : 'Sync & Auto-Close'}
          </button>
          <button
            onClick={() => fetchPostings(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-3 py-2 border border-thb-border text-thb-text-secondary rounded-lg text-sm font-medium hover:bg-slate-50 disabled:opacity-50 transition-colors"
          >
            <FiRefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Total', value: stats.total, color: 'text-thb-text-primary', bg: 'bg-slate-100' },
          { label: 'Posted', value: stats.posted, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Pending', value: stats.pending, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Closed', value: stats.closed, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Failed', value: stats.failed, color: 'text-red-600', bg: 'bg-red-50' },
        ].map((s) => (
          <div key={s.label} className={`thb-card p-3 ${s.bg}`}>
            <p className="text-xs font-medium text-thb-text-secondary uppercase tracking-wider">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color} mt-0.5`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="thb-card p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <div className="relative">
              <FiSearch className="w-4 h-4 text-thb-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by job title, board, or external ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400"
              />
            </div>
          </div>
          <div className="flex gap-3">
            <select
              value={filterBoard}
              onChange={(e) => setFilterBoard(e.target.value)}
              className="px-3 py-2 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20"
            >
              <option value="">All Boards</option>
              {Object.entries(BOARD_LABELS).map(([id, label]) => (
                <option key={id} value={id}>{label}</option>
              ))}
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20"
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="posted">Posted</option>
              <option value="closed">Closed</option>
              <option value="failed">Failed</option>
              <option value="expired">Expired</option>
            </select>
          </div>
        </div>
      </div>

      {/* Bulk action bar */}
      {selectedIds.length > 0 && (
        <div className="thb-card p-3 flex items-center justify-between bg-teal-50 border-teal-200">
          <p className="text-sm text-thb-text-primary font-medium">
            {selectedIds.length} selected ({selectedOpenCount} closeable)
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelected({})}
              className="px-3 py-1.5 border border-thb-border text-xs font-medium rounded-lg hover:bg-white transition-colors"
            >
              Clear
            </button>
            <button
              onClick={handleBulkClose}
              disabled={bulkClosing || selectedOpenCount === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-500 text-white text-xs font-medium rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors"
            >
              {bulkClosing ? <FiRefreshCw className="w-3 h-3 animate-spin" /> : <FiXCircle className="w-3 h-3" />}
              Close Selected ({selectedOpenCount})
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="thb-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-thb-border bg-slate-50/50">
                <th className="text-left px-4 py-3 w-10">
                  <button
                    onClick={toggleAll}
                    className="text-thb-text-muted hover:text-thb-text-primary"
                    title={allSelected ? 'Deselect all' : 'Select all'}
                  >
                    {allSelected ? <FiCheckSquare className="w-4 h-4" /> : <FiSquare className="w-4 h-4" />}
                  </button>
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Job</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Board</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">External ID</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Posted</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Closed</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-thb-border/50 animate-pulse">
                    {Array.from({ length: 8 }).map((__, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-3 w-16 bg-slate-200 rounded" /></td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <FiExternalLink className="w-10 h-10 text-thb-text-muted mx-auto mb-2" />
                    <p className="text-sm text-thb-text-secondary font-medium">No board postings found</p>
                    <p className="text-xs text-thb-text-muted mt-1">
                      Post a job to external boards from a job detail page.
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((p) => {
                  const sb = getPostingStatusBadge(p.status);
                  const boardLabel = BOARD_LABELS[p.board] || p.board;
                  const boardColor = BOARD_COLORS[p.board] || '#94a3b8';
                  const isCloseable = p.status === 'posted' || p.status === 'pending';
                  return (
                    <tr key={p.id} className={`border-b border-thb-border/50 hover:bg-slate-50/50 ${selected[p.id] ? 'bg-teal-50/40' : ''}`}>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setSelected((prev) => ({ ...prev, [p.id]: !prev[p.id] }))}
                          className="text-thb-text-muted hover:text-teal-500"
                        >
                          {selected[p.id] ? <FiCheckSquare className="w-4 h-4 text-teal-500" /> : <FiSquare className="w-4 h-4" />}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        {p.jobPosting ? (
                          <div>
                            <Link
                              href={`/recruitment/${p.jobPostingId}`}
                              className="text-sm font-medium text-thb-text-primary hover:text-teal-600"
                            >
                              {p.jobPosting.title}
                            </Link>
                            <p className="text-xs text-thb-text-muted">
                              {p.jobPosting.department?.name || 'No dept'} · {p.jobPosting.status}
                            </p>
                          </div>
                        ) : (
                          <Link href={`/recruitment/${p.jobPostingId}`} className="text-sm text-thb-text-secondary hover:text-teal-600">
                            View job {p.jobPostingId.substring(0, 8)}...
                          </Link>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ background: boardColor }} />
                          <span className="text-sm font-medium text-thb-text-primary">{boardLabel}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3"><span className={sb.className}>{sb.icon}{sb.label}</span></td>
                      <td className="px-4 py-3 text-xs text-thb-text-muted">
                        {p.externalJobId ? (
                          <span className="font-mono">{p.externalJobId}</span>
                        ) : '—'}
                        {p.errorMessage && (
                          <p className="text-red-600 mt-0.5 max-w-xs truncate" title={p.errorMessage}>{p.errorMessage}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-thb-text-secondary">{formatDate(p.postedAt)}</td>
                      <td className="px-4 py-3 text-sm text-thb-text-secondary">{formatDate(p.closedAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          {p.externalUrl && p.status === 'posted' && (
                            <a
                              href={p.externalUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 rounded text-thb-text-muted hover:text-green-500 hover:bg-green-50 transition-colors"
                              title="Open external URL"
                            >
                              <FiExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                          {isAdmin && isCloseable && (
                            <button
                              onClick={() => handleClose(p.id)}
                              className="px-2.5 py-1 border border-red-200 text-red-600 text-xs font-medium rounded hover:bg-red-50 transition-colors"
                            >
                              Close
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-thb-text-muted text-center">
        Click "Sync & Auto-Close" to scan all open board postings and auto-close any whose job is now filled (REQ-SRC-03).
      </p>
    </div>
  );
}
