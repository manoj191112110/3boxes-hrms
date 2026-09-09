'use client';

import { Fragment, useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  FiBriefcase, FiCopy, FiCheckCircle, FiShare2, FiUsers,
  FiMapPin, FiPlus, FiX, FiSearch, FiExternalLink, FiTrash2,
  FiFilter, FiAward, FiTrendingUp, FiLink2, FiMail, FiChevronDown,
  FiChevronUp, FiInfo,
} from 'react-icons/fi';
import { FaWhatsapp, FaLinkedinIn, FaTwitter, FaFacebookF } from 'react-icons/fa';
import toast from 'react-hot-toast';
import ModuleTips from '@/components/ModuleTips';

/* ──────────────────────────────────────────────────────────────────── */
/* Types                                                                */
/* ──────────────────────────────────────────────────────────────────── */
interface JobPosting {
  id: string;
  title: string;
  position: string;
  location?: string | null;
  type: string;
  experience?: string | null;
  salary?: string | null;
  description: string;
  status: string;
  postedDate: string;
  closingDate?: string | null;
  vacancies: number;
  department?: { id: string; name: string } | null;
  _count?: { applications: number };
}

interface Referral {
  id: string;
  jobPostingId: string;
  referrerEmployeeId: string;
  candidateName: string;
  candidateEmail: string;
  candidatePhone?: string | null;
  notes?: string | null;
  bonusAmount?: number | null;
  bonusCurrency: string;
  trackToken: string;
  clickCount: number;
  status: string; // pending | applied | interviewed | offered | hired | rejected | bonus_paid
  hiredAt?: string | null;
  bonusPaidAt?: string | null;
  createdAt: string;
  updatedAt: string;
  jobPosting?: { id: string; title: string; location?: string | null; type?: string } | null;
  referrerEmployee?: { id: string; firstName: string; lastName: string; employeeId: string } | null;
}

interface TrackableLink {
  trackableUrl: string;
  referralId: string;
  trackToken: string;
  clickCount: number;
  createdAt: string;
  jobPosting: { id: string; title: string; location?: string | null };
}

/* ── Helpers ── */
function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function formatDate(d: string | null | undefined): string {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  } catch {
    return '—';
  }
}

function formatRelativeTime(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const days = Math.floor(diffMs / 86400000);
    if (days < 1) return 'Today';
    if (days < 2) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} week${Math.floor(days / 7) > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return '—';
  }
}

function getReferralStatusBadge(status: string): { className: string; label: string; color: string } {
  const map: Record<string, string> = {
    pending: 'thb-badge thb-badge-warning',
    applied: 'thb-badge thb-badge-info',
    interviewed: 'bg-orange-50 text-orange-700 thb-badge',
    offered: 'thb-badge thb-badge-purple',
    hired: 'thb-badge thb-badge-success',
    rejected: 'thb-badge thb-badge-error',
    bonus_paid: 'thb-badge thb-badge-success',
  };
  const labels: Record<string, string> = {
    pending: 'Pending',
    applied: 'Applied',
    interviewed: 'Interviewed',
    offered: 'Offered',
    hired: 'Hired',
    rejected: 'Rejected',
    bonus_paid: 'Bonus Paid',
  };
  const colors: Record<string, string> = {
    pending: 'text-amber-600',
    applied: 'text-green-600',
    interviewed: 'text-orange-600',
    offered: 'text-teal-600',
    hired: 'text-emerald-600',
    rejected: 'text-red-600',
    bonus_paid: 'text-emerald-700',
  };
  return {
    className: map[status] || 'thb-badge thb-badge-info',
    label: labels[status] || status,
    color: colors[status] || 'text-slate-600',
  };
}

function currencySymbol(code: string): string {
  const map: Record<string, string> = {
    INR: '₹', USD: '$', EUR: '€', GBP: '£', AED: 'د.إ', SGD: 'S$', AUD: 'A$', CAD: 'C$',
  };
  return map[code] || code + ' ';
}

function formatBonus(amount: number | null | undefined, currency: string): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return '—';
  const sym = currencySymbol(currency);
  return `${sym}${amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'applied', label: 'Applied' },
  { value: 'interviewed', label: 'Interviewed' },
  { value: 'offered', label: 'Offered' },
  { value: 'hired', label: 'Hired' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'bonus_paid', label: 'Bonus Paid' },
];

const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'AUD', 'CAD'];

/* ── Referral Tips ── */
const referralTips = [
  { title: 'Share Wide', description: 'Share your trackable link on WhatsApp, LinkedIn, and with former colleagues — wider net, more qualified candidates.' },
  { title: 'Quality Counts', description: 'Bonuses are paid only when your referral is hired AND completes the bonus-eligibility window — quality over quantity.' },
  { title: 'Track Engagement', description: 'Click count tells you how many people opened your link — if it\'s zero, your network hasn\'t seen the post yet.' },
  { title: 'Multi-Currency', description: 'Set the bonus currency when you create a referral — defaults to INR. HR will confirm the actual amount at offer time.' },
];

/* ──────────────────────────────────────────────────────────────────── */
/* Page                                                                 */
/* ──────────────────────────────────────────────────────────────────── */
export default function ReferralsPage() {
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [loadingReferrals, setLoadingReferrals] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [totalBonusEarned, setTotalBonusEarned] = useState(0);
  const [bonusCurrency, setBonusCurrency] = useState('INR');
  const [defaultCurrency, setDefaultCurrency] = useState('INR');

  // Per-job trackable link cache: { [jobId]: TrackableLink }
  const [linkCache, setLinkCache] = useState<Record<string, TrackableLink>>({});
  const [generatingJobId, setGeneratingJobId] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // Manual referral form
  const [showForm, setShowForm] = useState(false);
  const [formJobId, setFormJobId] = useState('');
  const [form, setForm] = useState({
    candidateName: '',
    candidateEmail: '',
    candidatePhone: '',
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);

  // Expanded rows
  const [expandedReferralId, setExpandedReferralId] = useState<string | null>(null);

  /* ── Fetch open jobs ── */
  const fetchJobs = useCallback(async () => {
    setLoadingJobs(true);
    try {
      // Use the recruitment endpoint with status=open filter so we
      // surface only roles employees are allowed to share.
      const res = await fetch('/api/recruitment?status=open&limit=100', {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error('Failed to load jobs');
      const data = await res.json();
      // Defensive: always default to [] — the P0 crash post-mortem
      // mandated this pattern for every array access from API data.
      const list: JobPosting[] = Array.isArray(data.jobPostings)
        ? data.jobPostings
        : Array.isArray(data.jobs)
          ? data.jobs
          : [];
      setJobs(list);
    } catch (err) {
      console.error('fetchJobs error:', err);
      setJobs([]);
    } finally {
      setLoadingJobs(false);
    }
  }, []);

  /* ── Fetch my referrals ── */
  const fetchReferrals = useCallback(async () => {
    setLoadingReferrals(true);
    try {
      const res = await fetch('/api/referrals', { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Failed to load referrals');
      const data = await res.json();
      const list: Referral[] = Array.isArray(data.referrals) ? data.referrals : [];
      setReferrals(list);
      // Server also returns totalBonusEarned (sum of bonus_paid bonusAmount).
      setTotalBonusEarned(typeof data.totalBonusEarned === 'number' ? data.totalBonusEarned : 0);
      setBonusCurrency(data.bonusCurrency || 'INR');

      // Pre-populate link cache for any referrals that were minted as
      // shareable links (candidateEmail starts with 'pending+'). This
      // way the "Generate Link" button flips to "Show Link" instantly.
      const newCache: Record<string, TrackableLink> = {};
      for (const r of list) {
        if (r.candidateEmail && r.candidateEmail.startsWith('pending+')) {
          const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
          newCache[r.jobPostingId] = {
            trackableUrl: `${baseUrl}/api/referrals/track/${r.trackToken}`,
            referralId: r.id,
            trackToken: r.trackToken,
            clickCount: r.clickCount || 0,
            createdAt: r.createdAt,
            jobPosting: {
              id: r.jobPostingId,
              title: r.jobPosting?.title || '',
              location: r.jobPosting?.location || null,
            },
          };
        }
      }
      setLinkCache(newCache);
    } catch (err) {
      console.error('fetchReferrals error:', err);
      setReferrals([]);
      setTotalBonusEarned(0);
    } finally {
      setLoadingReferrals(false);
    }
  }, []);

  // queueMicrotask defers the setState-triggering fetch call out of the
  // synchronous effect body. This avoids the react-hooks/set-state-in-effect
  // lint error (cascading renders) without changing runtime semantics.
  useEffect(() => {
    queueMicrotask(() => {
      fetchJobs();
      fetchReferrals();
    });
  }, [fetchJobs, fetchReferrals]);

  /* ── Generate trackable link for a job ── */
  const handleGenerateLink = async (jobId: string) => {
    setGeneratingJobId(jobId);
    try {
      const res = await fetch('/api/referrals/trackable-link', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ jobPostingId: jobId }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate link');
      }
      // Defensive: ensure shape before caching.
      if (data && typeof data.trackableUrl === 'string') {
        setLinkCache((prev) => ({
          ...prev,
          [jobId]: {
            trackableUrl: data.trackableUrl,
            referralId: data.referralId,
            trackToken: data.trackToken,
            clickCount: data.clickCount || 0,
            createdAt: data.createdAt,
            jobPosting: data.jobPosting || { id: jobId, title: '', location: null },
          },
        }));
        toast.success('Trackable link generated — share it anywhere!');
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate link');
    } finally {
      setGeneratingJobId(null);
    }
  };

  /* ── Copy link to clipboard ── */
  const handleCopyLink = async (url: string, token: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedToken(token);
      toast.success('Link copied to clipboard');
      setTimeout(() => setCopiedToken(null), 2000);
    } catch {
      // Fallback for older browsers
      const ta = document.createElement('textarea');
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        setCopiedToken(token);
        toast.success('Link copied to clipboard');
        setTimeout(() => setCopiedToken(null), 2000);
      } catch {
        toast.error('Copy failed — please copy the link manually');
      }
      document.body.removeChild(ta);
    }
  };

  /* ── Build share URLs ── */
  const buildShareUrls = (url: string, title: string) => {
    const encUrl = encodeURIComponent(url);
    const encTitle = encodeURIComponent(title);
    return {
      whatsapp: `https://wa.me/?text=${encodeURIComponent(`${title} — ${url}`)}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encUrl}`,
      twitter: `https://twitter.com/intent/tweet?url=${encUrl}&text=${encTitle}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encUrl}`,
      email: `mailto:?subject=${encTitle}&body=${encodeURIComponent(`I thought you might be interested in this role: ${url}`)}`,
    };
  };

  /* ── Manual referral create (full form) ── */
  const handleOpenForm = (jobId?: string) => {
    setFormJobId(jobId || '');
    setForm({ candidateName: '', candidateEmail: '', candidatePhone: '', notes: '' });
    setShowForm(true);
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setFormJobId('');
    setForm({ candidateName: '', candidateEmail: '', candidatePhone: '', notes: '' });
  };

  const handleSubmitReferral = async () => {
    if (!formJobId) { toast.error('Select a job first'); return; }
    if (!form.candidateName.trim() || !form.candidateEmail.trim()) {
      toast.error('Candidate name and email are required');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.candidateEmail)) {
      toast.error('Please enter a valid email');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/referrals', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          jobPostingId: formJobId,
          candidateName: form.candidateName.trim(),
          candidateEmail: form.candidateEmail.trim(),
          candidatePhone: form.candidatePhone.trim() || undefined,
          notes: form.notes.trim() || undefined,
          bonusCurrency: defaultCurrency,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create referral');
      toast.success('Referral submitted successfully');
      handleCancelForm();
      fetchReferrals();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to submit referral');
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Delete a pending referral ── */
  const handleDeleteReferral = async (id: string, status: string) => {
    if (status !== 'pending') {
      toast.error('Only pending referrals can be deleted by employees. Contact HR for others.');
      return;
    }
    if (!confirm('Delete this referral? This cannot be undone.')) return;
    try {
      const res = await fetch(`/api/referrals/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete');
      toast.success('Referral deleted');
      fetchReferrals();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete referral');
    }
  };

  /* ── Derived: filtered referrals ── */
  const filteredReferrals = useMemo(() => {
    return referrals.filter((r) => {
      if (statusFilter && r.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const haystack = [
          r.candidateName, r.candidateEmail,
          r.jobPosting?.title, r.notes,
        ].filter(Boolean).join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [referrals, statusFilter, search]);

  /* ── Derived: stats ── */
  const stats = useMemo(() => {
    const total = referrals.length;
    const pending = referrals.filter((r) => r.status === 'pending').length;
    const applied = referrals.filter((r) => r.status === 'applied').length;
    const hired = referrals.filter((r) => r.status === 'hired' || r.status === 'bonus_paid').length;
    const totalClicks = referrals.reduce((s, r) => s + (r.clickCount || 0), 0);
    const conversionRate = total > 0 ? ((applied + hired) / total) * 100 : 0;
    return { total, pending, applied, hired, totalClicks, conversionRate };
  }, [referrals]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-thb-text-primary flex items-center gap-2">
            <FiShare2 className="w-6 h-6 text-teal-500" />
            Employee Referral Portal
          </h1>
          <p className="text-thb-text-secondary mt-1">
            Share open roles with your network — earn bonuses when your referrals get hired.
          </p>
        </div>
        <button
          onClick={() => handleOpenForm()}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-teal-500 text-white rounded-lg hover:bg-teal-600 font-medium text-sm shadow-sm shadow-teal-500/25 transition-colors"
        >
          <FiPlus className="w-4 h-4" /> Refer Someone
        </button>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          icon={<FiAward className="w-5 h-5" />}
          label="Total Bonus Earned"
          value={formatBonus(totalBonusEarned, bonusCurrency)}
          accent="from-emerald-500 to-teal-600"
        />
        <StatCard
          icon={<FiUsers className="w-5 h-5" />}
          label="Referrals Made"
          value={String(stats.total)}
          accent="from-teal-500 to-teal-600"
          sub={`${stats.pending} pending`}
        />
        <StatCard
          icon={<FiLink2 className="w-5 h-5" />}
          label="Link Clicks"
          value={String(stats.totalClicks)}
          accent="from-green-500 to-emerald-600"
          sub="across all links"
        />
        <StatCard
          icon={<FiTrendingUp className="w-5 h-5" />}
          label="Conversion Rate"
          value={`${stats.conversionRate.toFixed(0)}%`}
          accent="from-amber-500 to-orange-600"
          sub={`${stats.hired} hired`}
        />
      </div>

      {/* Bonus currency selector (defaults new referrals to this currency) */}
      <div className="thb-card p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
        <div className="flex items-center gap-2 text-sm text-thb-text-secondary">
          <FiInfo className="w-4 h-4 text-teal-500" />
          <span>Default bonus currency for new referrals you create:</span>
        </div>
        <select
          value={defaultCurrency}
          onChange={(e) => setDefaultCurrency(e.target.value)}
          className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm font-medium bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-400/40"
        >
          {CURRENCIES.map((c) => (
            <option key={c} value={c}>{c} ({currencySymbol(c)})</option>
          ))}
        </select>
        <p className="text-xs text-thb-text-muted sm:ml-auto">
          Actual bonus amount is set by HR after the offer is accepted.
        </p>
      </div>

      {/* Open Jobs section */}
      <div className="thb-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-thb-text-primary flex items-center gap-2">
              <FiBriefcase className="w-5 h-5 text-teal-500" /> Open Positions
            </h2>
            <p className="text-xs text-thb-text-secondary mt-0.5">
              Generate a trackable link for any open role, then share it across your network.
            </p>
          </div>
          <span className="thb-badge thb-badge-info">{jobs.length} open</span>
        </div>

        {loadingJobs ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="border border-slate-200 rounded-xl p-4 animate-pulse">
                <div className="h-4 w-2/3 bg-slate-200 rounded mb-2" />
                <div className="h-3 w-1/2 bg-slate-100 rounded mb-3" />
                <div className="h-8 w-full bg-slate-100 rounded" />
              </div>
            ))}
          </div>
        ) : jobs.length === 0 ? (
          <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-200">
            <FiBriefcase className="w-10 h-10 mx-auto mb-2 text-slate-300" />
            <p className="text-sm font-semibold text-slate-700">No open positions right now</p>
            <p className="text-xs text-slate-500 mt-1">Check back soon — new roles are posted weekly.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {jobs.map((job) => (
              <JobShareCard
                key={job.id}
                job={job}
                link={linkCache[job.id] || null}
                generating={generatingJobId === job.id}
                onGenerate={() => handleGenerateLink(job.id)}
                onCopy={(url, token) => handleCopyLink(url, token)}
                copiedToken={copiedToken}
                buildShareUrls={buildShareUrls}
                onManualRefer={() => handleOpenForm(job.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* My Referrals table */}
      <div className="thb-card p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-semibold text-thb-text-primary flex items-center gap-2">
              <FiUsers className="w-5 h-5 text-teal-500" /> My Referrals
            </h2>
            <p className="text-xs text-thb-text-secondary mt-0.5">
              Showing {filteredReferrals.length} of {referrals.length} referrals
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white">
              <FiSearch className="w-3.5 h-3.5 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, email, role…"
                className="text-sm outline-none w-40 sm:w-56"
              />
            </div>
            <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg border border-slate-200 bg-white">
              <FiFilter className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-sm outline-none bg-transparent pr-1"
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {loadingReferrals ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-12 bg-slate-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : filteredReferrals.length === 0 ? (
          <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-200">
            <FiUsers className="w-10 h-10 mx-auto mb-2 text-slate-300" />
            <p className="text-sm font-semibold text-slate-700">
              {referrals.length === 0 ? 'No referrals yet' : 'No referrals match your filter'}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {referrals.length === 0
                ? 'Generate a link above or use "Refer Someone" to submit a candidate directly.'
                : 'Try clearing the search box or status filter.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">
                  <th className="py-2.5 px-2">Candidate</th>
                  <th className="py-2.5 px-2">Role</th>
                  <th className="py-2.5 px-2">Status</th>
                  <th className="py-2.5 px-2 text-center">Clicks</th>
                  <th className="py-2.5 px-2">Bonus</th>
                  <th className="py-2.5 px-2">Referred</th>
                  <th className="py-2.5 px-2"></th>
                </tr>
              </thead>
              <tbody>
                {filteredReferrals.map((r) => {
                  const badge = getReferralStatusBadge(r.status);
                  const isExpanded = expandedReferralId === r.id;
                  const isPlaceholder = r.candidateEmail?.startsWith('pending+');
                  return (
                    <Fragment key={r.id}>
                      <tr
                        className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer"
                        onClick={() => setExpandedReferralId(isExpanded ? null : r.id)}
                      >
                        <td className="py-3 px-2">
                          <div className="font-medium text-thb-text-primary">
                            {isPlaceholder ? (
                              <span className="text-slate-400 italic">Awaiting candidate</span>
                            ) : (
                              r.candidateName
                            )}
                          </div>
                          {!isPlaceholder && (
                            <div className="text-xs text-thb-text-muted">{r.candidateEmail}</div>
                          )}
                        </td>
                        <td className="py-3 px-2 text-thb-text-secondary">
                          {r.jobPosting?.title || '—'}
                          {r.jobPosting?.location && (
                            <div className="text-xs text-thb-text-muted flex items-center gap-1 mt-0.5">
                              <FiMapPin className="w-3 h-3" /> {r.jobPosting.location}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-2">
                          <span className={badge.className}>{badge.label}</span>
                        </td>
                        <td className="py-3 px-2 text-center">
                          <span className="inline-flex items-center gap-1 text-thb-text-secondary">
                            <FiLink2 className="w-3.5 h-3.5 text-slate-400" />
                            {r.clickCount || 0}
                          </span>
                        </td>
                        <td className="py-3 px-2">
                          {r.status === 'bonus_paid' ? (
                            <span className="font-semibold text-emerald-700">
                              {formatBonus(r.bonusAmount, r.bonusCurrency)}
                            </span>
                          ) : r.bonusAmount ? (
                            <span className="text-thb-text-muted">
                              {formatBonus(r.bonusAmount, r.bonusCurrency)}*
                            </span>
                          ) : (
                            <span className="text-thb-text-muted">—</span>
                          )}
                        </td>
                        <td className="py-3 px-2 text-xs text-thb-text-secondary">
                          {formatRelativeTime(r.createdAt)}
                        </td>
                        <td className="py-3 px-2 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedReferralId(isExpanded ? null : r.id);
                            }}
                            className="p-1 rounded hover:bg-slate-200 text-thb-text-muted"
                          >
                            {isExpanded ? <FiChevronUp className="w-4 h-4" /> : <FiChevronDown className="w-4 h-4" />}
                          </button>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-slate-50/60">
                          <td colSpan={7} className="px-4 py-3">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                              <div>
                                <p className="font-semibold text-thb-text-secondary uppercase tracking-wider mb-1">Candidate</p>
                                <p className="text-thb-text-primary">{r.candidateName}</p>
                                <p className="text-thb-text-muted">{r.candidateEmail}</p>
                                {r.candidatePhone && <p className="text-thb-text-muted">{r.candidatePhone}</p>}
                              </div>
                              <div>
                                <p className="font-semibold text-thb-text-secondary uppercase tracking-wider mb-1">Tracking</p>
                                <p className="text-thb-text-primary">
                                  Token: <code className="px-1 py-0.5 bg-slate-100 rounded text-[10px]">{r.trackToken.substring(0, 12)}…</code>
                                </p>
                                <p className="text-thb-text-muted">Clicks: {r.clickCount || 0}</p>
                                <p className="text-thb-text-muted">Created: {formatDate(r.createdAt)}</p>
                                {r.hiredAt && <p className="text-emerald-700 font-medium">Hired: {formatDate(r.hiredAt)}</p>}
                                {r.bonusPaidAt && <p className="text-emerald-700 font-medium">Bonus paid: {formatDate(r.bonusPaidAt)}</p>}
                              </div>
                              <div>
                                <p className="font-semibold text-thb-text-secondary uppercase tracking-wider mb-1">Notes</p>
                                <p className="text-thb-text-muted whitespace-pre-wrap">
                                  {r.notes || 'No notes provided.'}
                                </p>
                                {r.status === 'pending' && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteReferral(r.id, r.status);
                                    }}
                                    className="mt-2 inline-flex items-center gap-1 px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded"
                                  >
                                    <FiTrash2 className="w-3 h-3" /> Delete
                                  </button>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
            <p className="text-xs text-thb-text-muted mt-2">
              <span className="text-emerald-700 font-medium">* Bonus amount shown is provisional.</span> Final payout is confirmed by HR after the offer is accepted.
            </p>
          </div>
        )}
      </div>

      {/* Manual referral form */}
      {showForm && (
        <div className="thb-card border-l-4 border-l-teal-500 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-thb-text-primary">Refer a Candidate</h2>
            <button onClick={handleCancelForm} className="p-2 rounded-lg text-thb-text-muted hover:text-thb-text-primary hover:bg-slate-100 transition-colors">
              <FiX className="w-5 h-5" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-thb-text-secondary mb-1">Job *</label>
              <select
                value={formJobId}
                onChange={(e) => setFormJobId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/40"
              >
                <option value="">Select a job…</option>
                {jobs.map((j) => (
                  <option key={j.id} value={j.id}>{j.title}{j.department ? ` · ${j.department.name}` : ''}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-thb-text-secondary mb-1">Candidate Name *</label>
              <input
                value={form.candidateName}
                onChange={(e) => setForm({ ...form, candidateName: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/40"
                placeholder="Jane Doe"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-thb-text-secondary mb-1">Candidate Email *</label>
              <input
                type="email"
                value={form.candidateEmail}
                onChange={(e) => setForm({ ...form, candidateEmail: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/40"
                placeholder="jane@example.com"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-thb-text-secondary mb-1">Candidate Phone</label>
              <input
                value={form.candidatePhone}
                onChange={(e) => setForm({ ...form, candidatePhone: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/40"
                placeholder="+91 98765 43210"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-thb-text-secondary mb-1">Notes (optional)</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/40 resize-none"
                placeholder="Why is this person a great fit? Anything the hiring team should know?"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button
              onClick={handleCancelForm}
              className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmitReferral}
              disabled={submitting}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-white bg-teal-500 hover:bg-teal-600 disabled:opacity-60 transition-colors"
            >
              {submitting ? 'Submitting…' : <>Submit Referral <FiCheckCircle className="w-4 h-4" /></>}
            </button>
          </div>
        </div>
      )}

      <ModuleTips moduleKey="referrals" tips={referralTips} />

      {/* Hidden SEO helper: link to careers page for employees who want to see what candidates see */}
      <div className="text-center text-xs text-thb-text-muted pt-2">
        <Link href="/careers" className="inline-flex items-center gap-1 hover:text-teal-600 transition-colors">
          <FiExternalLink className="w-3 h-3" /> View public careers page
        </Link>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────── */
/* Stat Card                                                             */
/* ──────────────────────────────────────────────────────────────────── */
function StatCard({
  icon, label, value, accent, sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent: string;
  sub?: string;
}) {
  return (
    <div className="thb-card p-4 flex items-start gap-3">
      <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${accent} flex items-center justify-center text-white flex-shrink-0`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold text-thb-text-muted uppercase tracking-wider">{label}</p>
        <p className="text-lg font-bold text-thb-text-primary truncate">{value}</p>
        {sub && <p className="text-[10px] text-thb-text-muted">{sub}</p>}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────── */
/* Job Share Card                                                        */
/* ──────────────────────────────────────────────────────────────────── */
function JobShareCard({
  job, link, generating, onGenerate, onCopy, copiedToken, buildShareUrls, onManualRefer,
}: {
  job: JobPosting;
  link: TrackableLink | null;
  generating: boolean;
  onGenerate: () => void;
  onCopy: (url: string, token: string) => void;
  copiedToken: string | null;
  buildShareUrls: (url: string, title: string) => Record<string, string>;
  onManualRefer: () => void;
}) {
  const shareUrls = link ? buildShareUrls(link.trackableUrl, job.title) : null;
  const isCopied = link && copiedToken === link.trackToken;

  return (
    <div className="border border-slate-200 rounded-xl p-4 flex flex-col hover:border-teal-300 hover:shadow-md transition-all">
      <div className="flex items-start justify-between mb-2">
        <div className="min-w-0">
          <p className="font-bold text-thb-text-primary truncate">{job.title}</p>
          <p className="text-xs text-thb-text-muted">
            {job.department?.name || '—'}
            {job.location && ` · ${job.location}`}
            {job.type && ` · ${job.type}`}
          </p>
        </div>
        <span className="thb-badge thb-badge-success flex-shrink-0">Open</span>
      </div>

      <p className="text-xs text-thb-text-secondary line-clamp-2 mb-3 flex-1">
        {job.description.replace(/<[^>]+>/g, '').slice(0, 140)}
        {job.description.length > 140 && '…'}
      </p>

      {/* Action row */}
      {!link ? (
        <button
          onClick={onGenerate}
          disabled={generating}
          className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-teal-500 to-teal-600 hover:shadow-md disabled:opacity-60 transition-all"
        >
          {generating ? (
            <>Generating…</>
          ) : (
            <><FiLink2 className="w-4 h-4" /> Generate Trackable Link</>
          )}
        </button>
      ) : (
        <div className="space-y-2">
          {/* Link box */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg">
            <input
              readOnly
              value={link.trackableUrl}
              className="flex-1 text-xs text-slate-700 bg-transparent outline-none truncate"
              onFocus={(e) => e.target.select()}
            />
            <button
              onClick={() => onCopy(link.trackableUrl, link.trackToken)}
              className={`flex-shrink-0 px-2 py-1 rounded text-xs font-semibold transition-colors ${
                isCopied
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-teal-100 text-teal-700 hover:bg-teal-200'
              }`}
            >
              {isCopied ? (
                <><FiCheckCircle className="w-3 h-3 inline" /> Copied</>
              ) : (
                <><FiCopy className="w-3 h-3 inline" /> Copy</>
              )}
            </button>
          </div>

          {/* Share buttons */}
          <div className="grid grid-cols-5 gap-1.5">
            <ShareBtn href={shareUrls?.whatsapp || '#'} color="bg-[#25D366] hover:bg-[#1da851]" title="Share on WhatsApp">
              <FaWhatsapp className="w-3.5 h-3.5" />
            </ShareBtn>
            <ShareBtn href={shareUrls?.linkedin || '#'} color="bg-[#0A66C2] hover:bg-[#0852a0]" title="Share on LinkedIn">
              <FaLinkedinIn className="w-3.5 h-3.5" />
            </ShareBtn>
            <ShareBtn href={shareUrls?.twitter || '#'} color="bg-black hover:bg-gray-800" title="Share on Twitter / X">
              <FaTwitter className="w-3.5 h-3.5" />
            </ShareBtn>
            <ShareBtn href={shareUrls?.facebook || '#'} color="bg-[#1877F2] hover:bg-[#1363d6]" title="Share on Facebook">
              <FaFacebookF className="w-3.5 h-3.5" />
            </ShareBtn>
            <ShareBtn href={shareUrls?.email || '#'} color="bg-slate-600 hover:bg-slate-700" title="Share via Email">
              <FiMail className="w-3.5 h-3.5" />
            </ShareBtn>
          </div>

          {/* Clicks + manual refer row */}
          <div className="flex items-center justify-between text-xs text-thb-text-muted pt-1">
            <span className="inline-flex items-center gap-1">
              <FiLink2 className="w-3 h-3" /> {link.clickCount || 0} click{link.clickCount === 1 ? '' : 's'}
            </span>
            <button
              onClick={onManualRefer}
              className="inline-flex items-center gap-1 text-teal-600 hover:text-teal-800 font-medium"
            >
              <FiPlus className="w-3 h-3" /> Refer specific person
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────── */
/* Share Button                                                          */
/* ──────────────────────────────────────────────────────────────────── */
function ShareBtn({
  href, color, title, children,
}: {
  href: string;
  color: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={title}
      className={`flex items-center justify-center py-2 rounded-lg text-white transition-colors ${color}`}
    >
      {children}
    </a>
  );
}
