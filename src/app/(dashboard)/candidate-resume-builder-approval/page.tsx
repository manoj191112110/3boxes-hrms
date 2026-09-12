'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  FiShield, FiCheck, FiX, FiSearch, FiRefreshCw, FiZap, FiMail,
  FiCheckCircle, FiClock, FiAward, FiAlertCircle, FiArrowLeft,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';

interface CandidateRow {
  id: string;
  email: string;
  name: string;
  approved: boolean;
  approvedAt: string | null;
  approvedBy: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  oauthProvider: string | null;
  applicationCount: number;
}

type Filter = 'all' | 'approved' | 'pending';

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function CandidateResumeBuilderApprovalPage() {
  const { user } = useAuthStore();
  const [candidates, setCandidates] = useState<CandidateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null); // email of candidate being toggled

  const fetchCandidates = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter !== 'all') params.set('status', filter);
      if (search) params.set('search', search);
      const token = useAuthStore.getState().token;
      const r = await fetch(`/api/admin/candidate-resume-builder-approval?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed to load');
      setCandidates(d.candidates || []);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [filter, search]);

  useEffect(() => { fetchCandidates(); }, [fetchCandidates]);

  const handleApprove = async (email: string, name: string) => {
    setActionLoading(email);
    try {
      const token = useAuthStore.getState().token;
      const r = await fetch('/api/admin/candidate-resume-builder-approval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ candidateEmail: email, action: 'approve' }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed to approve');
      toast.success(`Approved AI Resume Builder for ${name}`);
      fetchCandidates();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to approve');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRevoke = async (email: string, name: string) => {
    if (!confirm(`Revoke AI Resume Builder access for ${name}? They will no longer be able to use the feature in their candidate portal.`)) return;
    setActionLoading(email);
    try {
      const token = useAuthStore.getState().token;
      const r = await fetch('/api/admin/candidate-resume-builder-approval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ candidateEmail: email, action: 'revoke' }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed to revoke');
      toast.success(`Revoked AI Resume Builder for ${name}`);
      fetchCandidates();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to revoke');
    } finally {
      setActionLoading(null);
    }
  };

  // Gate the entire page to super admins
  if (user && user.role !== 'super_admin') {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-6 text-center">
          <FiShield className="w-10 h-10 text-rose-500 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-rose-800">Super Admin Access Required</h2>
          <p className="text-sm text-rose-700 mt-2">Only Super Admins can manage AI Resume Builder approvals.</p>
          <Link href="/home" className="inline-flex items-center gap-1 text-sm text-rose-700 hover:underline mt-3">
            <FiArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const approvedCount = candidates.filter(c => c.approved).length;
  const pendingCount = candidates.length - approvedCount;

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-teal-500 to-emerald-600 text-white flex items-center justify-center">
              <FiZap className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold text-slate-900">AI Resume Builder Approvals</h1>
          </div>
          <p className="text-xs text-slate-500">
            Gate the AI Resume Builder feature in the candidate portal. Only candidates you approve will be able to use it.
          </p>
        </div>
        <button
          onClick={fetchCandidates}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-all"
        >
          <FiRefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Total Candidates</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{candidates.length}</p>
            </div>
            <FiMail className="w-5 h-5 text-slate-400" />
          </div>
        </div>
        <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-emerald-700 font-semibold">Approved</p>
              <p className="text-2xl font-bold text-emerald-900 mt-1">{approvedCount}</p>
            </div>
            <FiCheckCircle className="w-5 h-5 text-emerald-500" />
          </div>
        </div>
        <div className="bg-amber-50 rounded-xl border border-amber-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-amber-700 font-semibold">Pending</p>
              <p className="text-2xl font-bold text-amber-900 mt-1">{pendingCount}</p>
            </div>
            <FiClock className="w-5 h-5 text-amber-500" />
          </div>
        </div>
      </div>

      {/* Filters + Search */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="flex gap-1 p-1 bg-slate-100 rounded-lg">
          {(['all', 'pending', 'approved'] as Filter[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                filter === f ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {f === 'all' ? 'All' : f === 'approved' ? 'Approved' : 'Pending'}
            </button>
          ))}
        </div>
        <div className="flex-1 relative">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email..."
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400"
          />
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <div className="w-8 h-8 border-2 border-teal-200 border-t-teal-600 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-500">Loading candidates…</p>
        </div>
      ) : candidates.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <FiMail className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500">No candidates found.</p>
          <p className="text-xs text-slate-400 mt-1">Candidates who register on the portal will appear here.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider">Candidate</th>
                  <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider">Applications</th>
                  <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider">Last Login</th>
                  <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider">Status</th>
                  <th className="text-right px-4 py-3 font-semibold text-xs uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {candidates.map(c => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                          c.approved ? 'bg-emerald-500' : 'bg-slate-400'
                        }`}>
                          {c.name?.charAt(0)?.toUpperCase() || c.email.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-800 truncate">{c.name || '(no name)'}</p>
                          <p className="text-xs text-slate-500 truncate">{c.email}</p>
                          {c.oauthProvider && (
                            <p className="text-[10px] text-slate-400">via {c.oauthProvider}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      {c.applicationCount > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 text-xs font-semibold">
                          <FiAward className="w-3 h-3" /> {c.applicationCount}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">No applications</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {fmtDate(c.lastLoginAt)}
                    </td>
                    <td className="px-4 py-3">
                      {c.approved ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-semibold border border-emerald-200">
                          <FiCheckCircle className="w-3 h-3" /> Approved
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-50 text-amber-700 text-[11px] font-semibold border border-amber-200">
                          <FiClock className="w-3 h-3" /> Pending
                        </span>
                      )}
                      {c.approved && c.approvedBy && (
                        <p className="text-[10px] text-slate-400 mt-1">by {c.approvedBy}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {c.approved ? (
                        <button
                          onClick={() => handleRevoke(c.email, c.name)}
                          disabled={actionLoading === c.email}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-all disabled:opacity-50"
                        >
                          {actionLoading === c.email ? <FiRefreshCw className="w-3 h-3 animate-spin" /> : <FiX className="w-3 h-3" />}
                          Revoke
                        </button>
                      ) : (
                        <button
                          onClick={() => handleApprove(c.email, c.name)}
                          disabled={actionLoading === c.email}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition-all disabled:opacity-50"
                        >
                          {actionLoading === c.email ? <FiRefreshCw className="w-3 h-3 animate-spin" /> : <FiCheck className="w-3 h-3" />}
                          Approve
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Help box */}
      <div className="mt-6 bg-sky-50 border border-sky-200 rounded-xl p-4 flex items-start gap-3">
        <FiAlertCircle className="w-5 h-5 text-sky-600 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-sky-800 leading-relaxed">
          <p className="font-semibold mb-1">How this works</p>
          <p>
            Candidates sign up on the candidate portal and upload their resume. They cannot access the AI Resume Builder
            until you approve them here. Once approved, they will see the &quot;AI Resume Builder&quot; button on each
            application in their dashboard. Revoke access at any time to disable the feature for that candidate.
          </p>
        </div>
      </div>
    </div>
  );
}
