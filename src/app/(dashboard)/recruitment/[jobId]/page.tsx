'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  FiArrowLeft, FiBriefcase, FiUsers, FiMapPin, FiClock,
  FiCalendar, FiExternalLink,
  FiRefreshCw, FiStar, FiMail, FiPhone, FiXCircle, FiCheckCircle,
  FiAlertCircle, FiSend, FiEdit2, FiDollarSign, FiTarget,
  FiTrendingUp,
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

function getJobStatusBadge(status: string) {
  const map: Record<string, string> = {
    open: 'thb-badge thb-badge-success',
    closed: 'thb-badge thb-badge-error',
    on_hold: 'thb-badge thb-badge-warning',
    filled: 'thb-badge thb-badge-info',
  };
  const labels: Record<string, string> = { open: 'Open', closed: 'Closed', on_hold: 'On Hold', filled: 'Filled' };
  return { className: map[status] || 'thb-badge thb-badge-info', label: labels[status] || status };
}

function getAppStatusBadge(status: string) {
  const map: Record<string, string> = {
    applied: 'thb-badge thb-badge-info',
    screening: 'bg-teal-50 text-teal-700 thb-badge',
    interview: 'bg-amber-50 text-amber-700 thb-badge',
    offered: 'thb-badge thb-badge-success',
    hired: 'bg-emerald-50 text-emerald-700 thb-badge',
    rejected: 'thb-badge thb-badge-error',
    talent_pool: 'bg-emerald-50 text-emerald-700 thb-badge',
  };
  const labels: Record<string, string> = {
    applied: 'Applied', screening: 'Screening', interview: 'Interview',
    offered: 'Offered', hired: 'Hired', rejected: 'Rejected', talent_pool: 'Talent Pool',
  };
  return { className: map[status] || 'thb-badge thb-badge-info', label: labels[status] || status };
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

function getJobTypeBadge(type: string) {
  const map: Record<string, { className: string; label: string }> = {
    'full-time': { className: 'bg-emerald-50 text-emerald-700 border border-emerald-200', label: 'Full-time' },
    'part-time': { className: 'bg-sky-50 text-sky-700 border border-sky-200', label: 'Part-time' },
    'contract': { className: 'bg-amber-50 text-amber-700 border border-amber-200', label: 'Contract' },
    'internship': { className: 'bg-teal-50 text-teal-700 border border-teal-200', label: 'Internship' },
  };
  return map[type] || { className: 'bg-slate-50 text-slate-700 border border-slate-200', label: type };
}

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function getAvatarColor(name: string) {
  const colors = [
    'bg-rose-100 text-rose-700',
    'bg-emerald-100 text-emerald-700',
    'bg-amber-100 text-amber-700',
    'bg-sky-100 text-sky-700',
    'bg-teal-100 text-teal-700',
    'bg-pink-100 text-pink-700',
    'bg-teal-100 text-teal-700',
    'bg-orange-100 text-orange-700',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

const AVAILABLE_BOARDS = [
  { id: 'linkedin', label: 'LinkedIn', color: '#0a66c2' },
  { id: 'indeed', label: 'Indeed', color: '#2164f3' },
  { id: 'glassdoor', label: 'Glassdoor', color: '#0caa41' },
  { id: 'stepstone', label: 'StepStone', color: '#7a1fa2' },
  { id: 'naukri', label: 'Naukri', color: '#ff7555' },
];

interface JobPosting {
  id: string;
  title: string;
  position: string;
  location?: string | null;
  type: string;
  experience?: string | null;
  salary?: string | null;
  description: string;
  requirements?: string | null;
  status: string;
  postedDate: string;
  closingDate?: string | null;
  vacancies: number;
  department?: { id: string; name: string } | null;
  applications?: JobApplication[];
}

interface JobApplication {
  id: string;
  candidateName: string;
  candidateEmail: string;
  candidatePhone?: string | null;
  source: string;
  status: string;
  appliedDate: string;
  rating?: number | null;
  expectedSalary?: string | null;
  notes?: string | null;
}

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
}

export default function JobDetailPage() {
  const params = useParams<{ jobId: string }>();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _router = useRouter();
  const { user } = useAuthStore();
  const isAdmin = ['super_admin', 'tenant_admin', 'admin'].includes(user?.role || '');

  const [jobPosting, setJobPosting] = useState<JobPosting | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'applicants' | 'pipeline' | 'details'>('applicants');

  const [boardPostings, setBoardPostings] = useState<BoardPosting[]>([]);
  const [boardSelection, setBoardSelection] = useState<Record<string, boolean>>({});
  const [posting, setPosting] = useState(false);
  const [closingAll, setClosingAll] = useState(false);

  // Application edit state
  const [editingAppId, setEditingAppId] = useState<string | null>(null);
  const [editAppStatus, setEditAppStatus] = useState('');

  const jobId = params?.jobId || '';

  const fetchJob = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/recruitment/${jobId}`, { headers: getAuthHeaders() });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Failed to load job');
      }
      const data = await res.json();
      setJobPosting(data.jobPosting || null);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to load job');
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  const fetchBoardPostings = useCallback(async () => {
    try {
      const res = await fetch(`/api/job-board-postings?jobPostingId=${jobId}`, { headers: getAuthHeaders() });
      if (!res.ok) return;
      const data = await res.json();
      setBoardPostings(Array.isArray(data.postings) ? data.postings : []);
    } catch {
      // best-effort
    }
  }, [jobId]);

  useEffect(() => {
    if (jobId) {
      queueMicrotask(() => fetchJob());
      queueMicrotask(() => fetchBoardPostings());
    }
  }, [jobId, fetchJob, fetchBoardPostings]);

  /* Funnel counts for this job */
  const funnelCounts = {
    applied: 0, screening: 0, interview: 0, offered: 0, hired: 0,
  };
  (jobPosting?.applications || []).forEach((a) => {
    const s = a.status as keyof typeof funnelCounts;
    if (s in funnelCounts) funnelCounts[s] += 1;
  });

  /* Multi-post to selected boards */
  const handleMultiPost = async () => {
    const selectedBoards = AVAILABLE_BOARDS.filter((b) => boardSelection[b.id]);
    if (selectedBoards.length === 0) {
      toast.error('Please select at least one board');
      return;
    }
    try {
      setPosting(true);
      const results = await Promise.allSettled(
        selectedBoards.map((b) =>
          fetch('/api/job-board-postings', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ jobPostingId: jobId, board: b.id }),
          })
        )
      );
      let okCount = 0;
      let failCount = 0;
      results.forEach((r, i) => {
        if (r.status === 'fulfilled' && r.value.ok) {
          okCount++;
        } else {
          failCount++;
          if (r.status === 'fulfilled') {
            r.value.json().then((d: { error?: string; message?: string }) => {
              if (d?.error || d?.message) {
                toast.error(`${selectedBoards[i].label}: ${d.error || d.message}`);
              }
            }).catch(() => {});
          }
        }
      });
      if (okCount > 0) toast.success(`Posted to ${okCount} board(s)${failCount > 0 ? ` (${failCount} failed)` : ''}`);
      else if (failCount > 0) toast.error(`All ${failCount} posting(s) failed`);
      setBoardSelection({});
      fetchBoardPostings();
    } finally {
      setPosting(false);
    }
  };

  /* Close all open board postings */
  const handleCloseAll = async () => {
    const openPostings = boardPostings.filter((p) => p.status === 'posted' || p.status === 'pending');
    if (openPostings.length === 0) {
      toast('No open board postings to close', { icon: 'ℹ️' });
      return;
    }
    try {
      setClosingAll(true);
      const results = await Promise.allSettled(
        openPostings.map((p) =>
          fetch(`/api/job-board-postings/${p.id}`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
          })
        )
      );
      const okCount = results.filter((r) => r.status === 'fulfilled' && r.value.ok).length;
      toast.success(`Closed ${okCount} of ${openPostings.length} posting(s)`);
      fetchBoardPostings();
    } finally {
      setClosingAll(false);
    }
  };

  /* Mark job as filled */
  const handleMarkFilled = async () => {
    if (!jobPosting) return;
    if (!confirm(`Mark "${jobPosting.title}" as filled? All open board postings will be auto-closed.`)) return;
    try {
      const res = await fetch(`/api/recruitment/${jobId}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ status: 'filled' }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Failed to update status');
      }
      const data = await res.json();
      const closed = data.autoClosedBoardPostings ?? 0;
      toast.success(`Job marked as filled${closed > 0 ? ` (auto-closed ${closed} board posting(s))` : ''}`);
      fetchJob();
      fetchBoardPostings();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to mark filled');
    }
  };

  /* Application status edit */
  const handleOpenAppEdit = (app: JobApplication) => {
    setEditingAppId(app.id);
    setEditAppStatus(app.status);
  };

  const handleCancelAppEdit = () => {
    setEditingAppId(null);
    setEditAppStatus('');
  };

  const handleSaveAppStatus = async (appId: string) => {
    try {
      const res = await fetch(`/api/recruitment/${appId}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ status: editAppStatus }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed'); }
      toast.success('Application status updated');
      handleCancelAppEdit();
      fetchJob();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update status');
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-7 w-72 bg-slate-200 rounded animate-pulse" />
        <div className="thb-card p-6 animate-pulse">
          <div className="h-5 w-48 bg-slate-200 rounded mb-3" />
          <div className="h-3 w-32 bg-slate-200 rounded mb-4" />
        </div>
      </div>
    );
  }

  if (!jobPosting) {
    return (
      <div className="space-y-6">
        <Link href="/recruitment" className="inline-flex items-center gap-2 text-sm text-thb-text-secondary hover:text-thb-text-primary">
          <FiArrowLeft className="w-4 h-4" /> Back to Recruitment
        </Link>
        <div className="thb-card p-12 text-center">
          <FiBriefcase className="w-12 h-12 text-thb-text-muted mx-auto mb-3" />
          <p className="text-thb-text-secondary font-medium">Job posting not found</p>
        </div>
      </div>
    );
  }

  const badge = getJobStatusBadge(jobPosting.status);
  const typeBadge = getJobTypeBadge(jobPosting.type);
  const openPostings = boardPostings.filter((p) => p.status === 'posted' || p.status === 'pending');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Link href="/recruitment" className="inline-flex items-center gap-2 text-sm text-thb-text-secondary hover:text-thb-text-primary mb-2">
            <FiArrowLeft className="w-4 h-4" /> Back to Recruitment
          </Link>
          <h1 className="text-2xl font-bold text-thb-text-primary flex items-center gap-2">
            <FiBriefcase className="w-6 h-6 text-teal-500" />
            {jobPosting.title}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/recruitment/analytics"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-thb-border text-sm font-medium text-thb-text-secondary hover:bg-slate-50 transition-colors"
          >
            Analytics
          </Link>
          {isAdmin && jobPosting.status !== 'filled' && (
            <button
              onClick={handleMarkFilled}
              className="inline-flex items-center gap-2 px-3 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600 transition-colors"
            >
              <FiCheckCircle className="w-4 h-4" /> Mark as Filled
            </button>
          )}
        </div>
      </div>

      {/* ─── Job Header Card ─── */}
      <div className="thb-card overflow-hidden">
        <div className="bg-gradient-to-r from-teal-600 to-teal-500 px-6 py-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-xl font-bold text-white">{jobPosting.title}</h2>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-white/20 text-white backdrop-blur-sm border border-white/30">
                  {badge.label}
                </span>
              </div>
              <p className="text-teal-100 text-sm mt-1">{jobPosting.position || jobPosting.title}</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {jobPosting.status === 'open' && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/15 text-white text-xs font-medium backdrop-blur-sm border border-white/20">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Accepting Applications
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="space-y-1">
              <p className="text-[10px] font-semibold text-thb-text-muted uppercase tracking-wider">Department</p>
              <div className="flex items-center gap-1.5">
                <FiUsers className="w-3.5 h-3.5 text-teal-500" />
                <span className="text-sm font-medium text-thb-text-primary">{jobPosting.department?.name || '—'}</span>
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-semibold text-thb-text-muted uppercase tracking-wider">Job Type</p>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${typeBadge.className}`}>
                {typeBadge.label}
              </span>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-semibold text-thb-text-muted uppercase tracking-wider">Location</p>
              <div className="flex items-center gap-1.5">
                <FiMapPin className="w-3.5 h-3.5 text-teal-500" />
                <span className="text-sm font-medium text-thb-text-primary">{jobPosting.location || '—'}</span>
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-semibold text-thb-text-muted uppercase tracking-wider">Salary Range</p>
              <div className="flex items-center gap-1.5">
                <FiDollarSign className="w-3.5 h-3.5 text-teal-500" />
                <span className="text-sm font-medium text-thb-text-primary">{jobPosting.salary || '—'}</span>
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-semibold text-thb-text-muted uppercase tracking-wider">Vacancies</p>
              <div className="flex items-center gap-1.5">
                <FiTarget className="w-3.5 h-3.5 text-teal-500" />
                <span className="text-sm font-medium text-thb-text-primary">{jobPosting.vacancies}</span>
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-semibold text-thb-text-muted uppercase tracking-wider">Posted</p>
              <div className="flex items-center gap-1.5">
                <FiCalendar className="w-3.5 h-3.5 text-teal-500" />
                <span className="text-sm font-medium text-thb-text-primary">{formatDate(jobPosting.postedDate)}</span>
              </div>
            </div>
          </div>
          {jobPosting.closingDate && (
            <div className="mt-3 pt-3 border-t border-thb-border">
              <span className="text-xs text-thb-text-muted flex items-center gap-1">
                <FiClock className="w-3 h-3" /> Closing Date: <strong className="text-thb-text-secondary">{formatDate(jobPosting.closingDate)}</strong>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ─── Stats Row ─── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Applied', value: funnelCounts.applied, color: 'text-sky-600', bg: 'bg-sky-50', border: 'border-sky-200' },
          { label: 'Screening', value: funnelCounts.screening, color: 'text-teal-600', bg: 'bg-teal-50', border: 'border-teal-200' },
          { label: 'Interview', value: funnelCounts.interview, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
          { label: 'Offered', value: funnelCounts.offered, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
          { label: 'Hired', value: funnelCounts.hired, color: 'text-teal-600', bg: 'bg-teal-50', border: 'border-teal-200' },
        ].map((s) => (
          <div key={s.label} className={`thb-card p-4 border ${s.border}`}>
            <p className="text-[10px] font-semibold text-thb-text-muted uppercase tracking-wider">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color} mt-0.5`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* ─── Tab Navigation ─── */}
      <div className="thb-card p-1.5">
        <div className="flex gap-1">
          {[
            { key: 'applicants' as const, label: 'Applicants', icon: FiUsers, count: Array.isArray(jobPosting.applications) ? jobPosting.applications.length : 0 },
            { key: 'pipeline' as const, label: 'Pipeline', icon: FiTrendingUp },
            { key: 'details' as const, label: 'Job Details', icon: FiBriefcase },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                activeTab === tab.key
                  ? 'bg-teal-600 text-white shadow-sm shadow-teal-500/25'
                  : 'text-thb-text-secondary hover:bg-slate-100 hover:text-thb-text-primary'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  activeTab === tab.key ? 'bg-white/20 text-white' : 'bg-slate-100 text-thb-text-muted'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* APPLICANTS TAB                                              */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {activeTab === 'applicants' && (
        <div className="thb-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-thb-border bg-slate-50/80">
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Candidate</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Source</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Status</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Applied</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Salary</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Rating</th>
                  <th className="text-right px-5 py-3.5 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(Array.isArray(jobPosting.applications) ? jobPosting.applications : []).length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-16 text-center">
                      <FiUsers className="w-12 h-12 text-thb-text-muted mx-auto mb-3" />
                      <p className="text-thb-text-secondary font-medium">No applications yet</p>
                      <p className="text-sm text-thb-text-muted mt-1">Applications will appear here once candidates apply</p>
                    </td>
                  </tr>
                ) : (
                  (jobPosting.applications || []).slice().sort((a, b) => new Date(b.appliedDate).getTime() - new Date(a.appliedDate).getTime()).map((app) => {
                    const appBadge = getAppStatusBadge(app.status);
                    const isEditing = editingAppId === app.id;
                    const initials = getInitials(app.candidateName);
                    const avatarColor = getAvatarColor(app.candidateName);
                    return (
                      <tr key={app.id} className={`border-b border-thb-border/50 transition-colors ${isEditing ? 'bg-teal-50/50' : 'hover:bg-slate-50/50'}`}>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${avatarColor}`}>
                              {initials}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-thb-text-primary">{app.candidateName}</p>
                              <p className="text-xs text-thb-text-muted flex items-center gap-1">
                                <FiMail className="w-3 h-3" />{app.candidateEmail}
                              </p>
                              {app.candidatePhone && (
                                <p className="text-xs text-thb-text-muted flex items-center gap-1 mt-0.5">
                                  <FiPhone className="w-3 h-3" />{app.candidatePhone}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-sm text-thb-text-secondary capitalize">{app.source}</td>
                        <td className="px-5 py-3">
                          {isEditing ? (
                            <select
                              value={editAppStatus}
                              onChange={e => setEditAppStatus(e.target.value)}
                              className="px-2 py-1 rounded border border-thb-border text-xs focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                            >
                              <option value="applied">Applied</option>
                              <option value="screening">Screening</option>
                              <option value="interview">Interview</option>
                              <option value="offered">Offered</option>
                              <option value="hired">Hired</option>
                              <option value="rejected">Rejected</option>
                            </select>
                          ) : (
                            <span className={appBadge.className}>{appBadge.label}</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-sm text-thb-text-secondary">{formatDate(app.appliedDate)}</td>
                        <td className="px-5 py-3 text-sm text-thb-text-secondary">{app.expectedSalary || '—'}</td>
                        <td className="px-5 py-3">
                          {app.rating ? (
                            <span className="flex items-center gap-1 text-amber-500">
                              <FiStar className="w-3.5 h-3.5 fill-amber-500" />
                              <span className="text-sm font-medium">{app.rating}</span>
                            </span>
                          ) : '—'}
                        </td>
                        <td className="px-5 py-3">
                          {isEditing ? (
                            <div className="flex items-center justify-end gap-1">
                              <button onClick={() => handleSaveAppStatus(app.id)} className="px-2.5 py-1 bg-teal-600 text-white text-xs font-medium rounded hover:bg-teal-700 transition-colors">
                                Save
                              </button>
                              <button onClick={handleCancelAppEdit} className="px-2.5 py-1 border border-thb-border text-xs font-medium rounded hover:bg-slate-50 transition-colors">
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-end gap-1">
                              {isAdmin && (
                                <button onClick={() => handleOpenAppEdit(app)} className="p-2 rounded-lg text-thb-text-muted hover:text-amber-600 hover:bg-amber-50 transition-colors" title="Edit Status">
                                  <FiEdit2 className="w-4 h-4" />
                                </button>
                              )}
                              {app.status !== 'talent_pool' && app.status !== 'rejected' && app.status !== 'hired' && (
                                <button
                                  onClick={async () => {
                                    if (!confirm(`Move ${app.candidateName} to talent pool? They'll receive a positive message.`)) return;
                                    try {
                                      const r = await fetch('/api/recruitment/talent-pool', {
                                        method: 'POST',
                                        headers: getAuthHeaders(),
                                        body: JSON.stringify({ applicationId: app.id }),
                                      });
                                      const d = await r.json();
                                      if (!r.ok) throw new Error(d.error || 'Failed');
                                      toast.success('Moved to talent pool');
                                      fetchJob();
                                    } catch (e: unknown) {
                                      toast.error(e instanceof Error ? e.message : 'Failed');
                                    }
                                  }}
                                  className="p-2 rounded-lg text-thb-text-muted hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                                  title="Move to Talent Pool (REQ-STAT-01)"
                                >
                                  <FiUsers className="w-4 h-4" />
                                </button>
                              )}
                              {app.status !== 'rejected' && app.status !== 'hired' && (
                                <>
                                  <button
                                    onClick={async () => {
                                      try {
                                        const r = await fetch('/api/recruitment/ai-feedback', {
                                          method: 'POST',
                                          headers: getAuthHeaders(),
                                          body: JSON.stringify({ applicationId: app.id, action: 'draft' }),
                                        });
                                        const d = await r.json();
                                        if (!r.ok) throw new Error(d.error || 'Failed');
                                        const draft = d.feedback?.aiDraft || '';
                                        const edited = prompt('Review and edit the AI feedback before publishing:', draft);
                                        if (edited === null) return;
                                        const r2 = await fetch('/api/recruitment/ai-feedback', {
                                          method: 'POST',
                                          headers: getAuthHeaders(),
                                          body: JSON.stringify({ applicationId: app.id, action: 'approve', hrEditedVersion: edited }),
                                        });
                                        if (!r2.ok) throw new Error('Approve failed');
                                        if (confirm('Publish this feedback to the candidate now?')) {
                                          const r3 = await fetch('/api/recruitment/ai-feedback', {
                                            method: 'POST',
                                            headers: getAuthHeaders(),
                                            body: JSON.stringify({ applicationId: app.id, action: 'publish' }),
                                          });
                                          if (!r3.ok) throw new Error('Publish failed');
                                          toast.success('AI feedback published to candidate');
                                        } else {
                                          toast.success('Feedback saved as approved (not published yet)');
                                        }
                                        fetchJob();
                                      } catch (e: unknown) {
                                        toast.error(e instanceof Error ? e.message : 'Failed');
                                      }
                                    }}
                                    className="p-2 rounded-lg text-thb-text-muted hover:text-sky-600 hover:bg-sky-50 transition-colors"
                                    title="AI Feedback (REQ-STAT-05/06)"
                                  >
                                    <FiSend className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={async () => {
                                      if (!confirm(`Reject ${app.candidateName} without AI feedback?`)) return;
                                      try {
                                        const r = await fetch('/api/recruitment/ai-feedback', {
                                          method: 'POST',
                                          headers: getAuthHeaders(),
                                          body: JSON.stringify({ applicationId: app.id, action: 'reject' }),
                                        });
                                        const d = await r.json();
                                        if (!r.ok) throw new Error(d.error || 'Failed');
                                        toast.success('Application rejected');
                                        fetchJob();
                                      } catch (e: unknown) {
                                        toast.error(e instanceof Error ? e.message : 'Failed');
                                      }
                                    }}
                                    className="p-2 rounded-lg text-thb-text-muted hover:text-red-600 hover:bg-red-50 transition-colors"
                                    title="Reject (REQ-STAT-04)"
                                  >
                                    <FiXCircle className="w-4 h-4" />
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* PIPELINE TAB (Funnel + Multi-Post)                          */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {activeTab === 'pipeline' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Funnel */}
          <div className="thb-card p-5">
            <h2 className="text-base font-semibold text-thb-text-primary mb-4">Hiring Funnel</h2>
            <div className="space-y-2">
              {[
                { key: 'applied', label: 'Applied', color: 'bg-sky-500' },
                { key: 'screening', label: 'Screening', color: 'bg-teal-500' },
                { key: 'interview', label: 'Interview', color: 'bg-amber-500' },
                { key: 'offered', label: 'Offered', color: 'bg-emerald-500' },
                { key: 'hired', label: 'Hired', color: 'bg-teal-500' },
              ].map((stage, i) => {
                const value = (funnelCounts as Record<string, number>)[stage.key] || 0;
                const maxValue = funnelCounts.applied || 1;
                const pct = Math.max(2, Math.round((value / maxValue) * 100));
                const prevValue = i === 0 ? value : ((funnelCounts as Record<string, number>)[(['applied','screening','interview','offered','hired'] as string[])[i-1]]) || 0;
                const conv = prevValue > 0 ? Math.round((value / prevValue) * 100) : 0;
                return (
                  <div key={stage.key}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-thb-text-secondary font-medium">{stage.label}</span>
                      <span className="text-thb-text-primary font-semibold">
                        {value} {i > 0 && value > 0 && <span className="text-thb-text-muted ml-1">({conv}%)</span>}
                      </span>
                    </div>
                    <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                      <div className={`h-full ${stage.color} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Multi-post panel */}
          <div className="thb-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-thb-text-primary">Multi-Post to Job Boards</h2>
              <button
                onClick={fetchBoardPostings}
                className="p-1.5 rounded-lg text-thb-text-muted hover:text-thb-text-primary hover:bg-slate-100 transition-colors"
                title="Refresh"
              >
                <FiRefreshCw className="w-4 h-4" />
              </button>
            </div>

            {/* Existing postings list */}
            {boardPostings.length > 0 && (
              <div className="space-y-2 mb-4">
                {boardPostings.map((p) => {
                  const sb = getPostingStatusBadge(p.status);
                  const boardMeta = AVAILABLE_BOARDS.find((b) => b.id === p.board) || { label: p.board, color: '#94a3b8' };
                  return (
                    <div key={p.id} className="flex items-center justify-between p-3 rounded-lg border border-thb-border bg-slate-50/50">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: boardMeta.color }} />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-thb-text-primary">{boardMeta.label}</p>
                          <p className="text-xs text-thb-text-muted">
                            {p.externalJobId ? `ID: ${p.externalJobId}` : 'No external ID'}
                            {p.errorMessage && <span className="text-red-600 ml-1">— {p.errorMessage}</span>}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={sb.className}>{sb.icon}{sb.label}</span>
                        {p.externalUrl && (p.status === 'posted') && (
                          <a
                            href={p.externalUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded text-thb-text-muted hover:text-sky-500 hover:bg-sky-50 transition-colors"
                            title="Open external URL"
                          >
                            <FiExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Board selection */}
            {isAdmin && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                  {AVAILABLE_BOARDS.map((b) => {
                    const alreadyPosted = boardPostings.some((p) => p.board === b.id);
                    const checked = !!boardSelection[b.id];
                    return (
                      <label
                        key={b.id}
                        className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                          alreadyPosted
                            ? 'border-slate-200 bg-slate-50 opacity-60 cursor-not-allowed'
                            : checked
                            ? 'border-teal-300 bg-teal-50'
                            : 'border-thb-border hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          disabled={alreadyPosted}
                          checked={checked}
                          onChange={(e) => setBoardSelection((prev) => ({ ...prev, [b.id]: e.target.checked }))}
                          className="w-4 h-4 rounded border-thb-border text-teal-500 focus:ring-teal-500"
                        />
                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: b.color }} />
                        <span className="text-sm font-medium text-thb-text-primary">{b.label}</span>
                        {alreadyPosted && <span className="text-xs text-thb-text-muted ml-auto">Already posted</span>}
                      </label>
                    );
                  })}
                </div>

                {/* Post + Close buttons */}
                <div className="flex flex-col sm:flex-row gap-2 pt-3 border-t border-thb-border">
                  <button
                    onClick={handleMultiPost}
                    disabled={posting || Object.values(boardSelection).every((v) => !v)}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50 transition-colors"
                  >
                    {posting ? <><FiRefreshCw className="w-4 h-4 animate-spin" /> Posting...</> : <><FiSend className="w-4 h-4" /> Post to Selected Boards</>}
                  </button>
                  {openPostings.length > 0 && (
                    <button
                      onClick={handleCloseAll}
                      disabled={closingAll}
                      className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 border border-red-200 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 disabled:opacity-50 transition-colors"
                    >
                      {closingAll ? <><FiRefreshCw className="w-4 h-4 animate-spin" /> Closing...</> : <><FiXCircle className="w-4 h-4" /> Close All Board Postings ({openPostings.length})</>}
                    </button>
                  )}
                </div>
                {jobPosting.status === 'filled' && (
                  <p className="text-xs text-emerald-600 mt-2">
                    Job is filled. Any open board postings should already have been auto-closed. Use &quot;Close All&quot; to force-close remaining ones.
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* JOB DETAILS TAB                                             */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {activeTab === 'details' && (
        <div className="space-y-6">
          {/* Description */}
          <div className="thb-card p-6">
            <h2 className="text-base font-semibold text-thb-text-primary mb-4 flex items-center gap-2">
              <FiBriefcase className="w-4 h-4 text-teal-500" />
              Job Description
            </h2>
            <div className="prose prose-sm max-w-none">
              <p className="text-sm text-thb-text-secondary whitespace-pre-wrap leading-relaxed">{jobPosting.description}</p>
            </div>
          </div>

          {/* Requirements */}
          {jobPosting.requirements && (
            <div className="thb-card p-6">
              <h2 className="text-base font-semibold text-thb-text-primary mb-4 flex items-center gap-2">
                <FiTarget className="w-4 h-4 text-teal-500" />
                Requirements
              </h2>
              <p className="text-sm text-thb-text-secondary whitespace-pre-wrap leading-relaxed">{jobPosting.requirements}</p>
            </div>
          )}

          {/* Job Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Experience */}
            {jobPosting.experience && (
              <div className="thb-card p-5">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200">
                    <FiClock className="w-4 h-4 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-thb-text-muted uppercase tracking-wider">Experience Required</p>
                    <p className="text-sm font-medium text-thb-text-primary mt-0.5">{jobPosting.experience}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Salary */}
            {jobPosting.salary && (
              <div className="thb-card p-5">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200">
                    <FiDollarSign className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-thb-text-muted uppercase tracking-wider">Salary Range</p>
                    <p className="text-sm font-medium text-thb-text-primary mt-0.5">{jobPosting.salary}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Department */}
            {jobPosting.department && (
              <div className="thb-card p-5">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-teal-50 border border-teal-200">
                    <FiUsers className="w-4 h-4 text-teal-600" />
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-thb-text-muted uppercase tracking-wider">Department</p>
                    <p className="text-sm font-medium text-thb-text-primary mt-0.5">{jobPosting.department.name}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Vacancies */}
            <div className="thb-card p-5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-sky-50 border border-sky-200">
                  <FiTarget className="w-4 h-4 text-sky-600" />
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-thb-text-muted uppercase tracking-wider">Vacancies</p>
                  <p className="text-sm font-medium text-thb-text-primary mt-0.5">{jobPosting.vacancies} position{jobPosting.vacancies > 1 ? 's' : ''}</p>
                </div>
              </div>
            </div>

            {/* Job Type */}
            <div className="thb-card p-5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-teal-50 border border-teal-200">
                  <FiClock className="w-4 h-4 text-teal-600" />
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-thb-text-muted uppercase tracking-wider">Job Type</p>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold mt-0.5 ${typeBadge.className}`}>
                    {typeBadge.label}
                  </span>
                </div>
              </div>
            </div>

            {/* Location */}
            <div className="thb-card p-5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200">
                  <FiMapPin className="w-4 h-4 text-rose-600" />
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-thb-text-muted uppercase tracking-wider">Location</p>
                  <p className="text-sm font-medium text-thb-text-primary mt-0.5">{jobPosting.location || 'Remote'}</p>
                </div>
              </div>
            </div>

            {/* Posted Date */}
            <div className="thb-card p-5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-teal-50 border border-teal-200">
                  <FiCalendar className="w-4 h-4 text-teal-600" />
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-thb-text-muted uppercase tracking-wider">Posted Date</p>
                  <p className="text-sm font-medium text-thb-text-primary mt-0.5">{formatDate(jobPosting.postedDate)}</p>
                </div>
              </div>
            </div>

            {/* Status */}
            <div className="thb-card p-5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                  <FiCheckCircle className="w-4 h-4 text-slate-600" />
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-thb-text-muted uppercase tracking-wider">Status</p>
                  <span className={badge.className}>{badge.label}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
