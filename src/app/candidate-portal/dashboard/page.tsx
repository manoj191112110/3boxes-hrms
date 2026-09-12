'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  FiBriefcase, FiCheckCircle, FiClock, FiXCircle, FiAward, FiTrendingUp,
  FiCalendar, FiTarget, FiZap, FiBookOpen, FiAlertCircle, FiActivity,
  FiArrowRight, FiStar, FiMapPin, FiRefreshCw, FiLogOut, FiBarChart2,
  FiUpload, FiArrowLeft, FiExternalLink, FiGrid, FiSearch, FiGlobe,
} from 'react-icons/fi';
import toast from 'react-hot-toast';

interface DashboardData {
  profile: { name: string; email: string };
  stats: {
    applied: number; shortlisted: number; interviewing: number;
    offered: number; hired: number; rejected: number; talentPool: number; total: number;
  };
  pendingOffer?: { accessToken: string; position: string; joiningDate?: string; offerStatus: string } | null;
  applications: Array<{
    id: string; jobTitle: string; position: string; department?: string;
    location?: string; type: string; status: string; appliedDate: string;
    rating?: number; interviewDate?: string; expectedSalary?: string;
    matchScore?: number | null;
    optimizationVersion?: number | null;
    aiFeedback?: { text: string; publishedAt: string } | null;
  }>;
  interviews: {
    upcoming: any[]; attended: any[]; missed: any[];
  };
  aiInterviews: {
    total: number; completed: number; missed: number;
    recent: any[];
  };
  resumeInsights: any[];
  sentiments: any[];
  skillMatrix: Array<{ skill: string; frequency: number }>;
  aiSuggestions: Array<{
    type: string; severity: string; message: string;
    jobTitle?: string; interviewType?: string; interviewDate?: string;
  }>;
  learningSuggestions: Array<{ title: string; provider: string; url: string; level: string }>;
  // Candidate Portal addendum sections
  talentPool: Array<{
    id: string; companyName: string; companyLogo?: string | null;
    placedAt: string; notes?: string | null; message: string;
  }>;
  savedJobs: Array<{
    id: string; jobPostingId: string; matchScore?: number | null;
    savedAt: string; lastViewedAt?: string | null;
    job: any;
  }>;
  jobAlerts: Array<{
    id: string; matchScore: number; createdAt: string; job: any;
  }>;
}

interface MatchingJob {
  id: string;
  title: string;
  position: string;
  location: string | null;
  type: string;
  experience: string | null;
  salary: string | null;
  company: string;
  matchScore: number;
  matchedSkills: string[];
}

interface ExternalBoard {
  board: string;
  url: string;
  description: string;
}

interface MatchingJobsData {
  candidateSkills: string[];
  candidateLocation: string | null;
  internal: MatchingJob[];
  external: ExternalBoard[];
}

const STATUS_COLORS: Record<string, string> = {
  applied: 'bg-sky-50 text-sky-700 border-sky-200',
  screening: 'bg-teal-50 text-teal-700 border-teal-200',
  interview: 'bg-amber-50 text-amber-700 border-amber-200',
  offered: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  hired: 'bg-green-50 text-green-700 border-green-200',
  rejected: 'bg-rose-50 text-rose-700 border-rose-200',
  talent_pool: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

// REQ-CAND-07: Visual status tracker — Applied → AI Screening → Interview → Offer
const STATUS_STEPS = ['applied', 'screening', 'interview', 'offered', 'hired'];

function StatusTracker({ status }: { status: string }) {
  // For talent_pool / rejected, show a special pill instead of the stepper
  if (status === 'talent_pool') {
    return <span className="text-xs px-2 py-1 rounded border bg-emerald-50 text-emerald-700 border-emerald-200">💼 Talent Pool</span>;
  }
  if (status === 'rejected') {
    return <span className="text-xs px-2 py-1 rounded border bg-rose-50 text-rose-700 border-rose-200">✗ Not Selected</span>;
  }

  const currentIdx = STATUS_STEPS.indexOf(status);
  if (currentIdx === -1) {
    return <span className={`text-xs px-2 py-1 rounded border ${STATUS_COLORS[status] || 'bg-gray-50 text-gray-700 border-gray-200'}`}>{status}</span>;
  }

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {STATUS_STEPS.map((step, idx) => {
        const isDone = idx <= currentIdx;
        const isCurrent = idx === currentIdx;
        const label = step.charAt(0).toUpperCase() + step.slice(1);
        return (
          <div key={step} className="flex items-center">
            <div className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium ${
              isCurrent ? 'bg-green-600 text-white' :
              isDone ? 'bg-green-100 text-green-700' :
              'bg-gray-100 text-gray-400'
            }`}>
              {isDone && !isCurrent && <span>✓</span>}
              {label}
            </div>
            {idx < STATUS_STEPS.length - 1 && <div className={`w-3 h-px ${idx < currentIdx ? 'bg-green-400' : 'bg-gray-300'}`}></div>}
          </div>
        );
      })}
    </div>
  );
}

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_candidate_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtDateTime(d: string) {
  return new Date(d).toLocaleString('en-US', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function CandidateDashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [matchingJobs, setMatchingJobs] = useState<MatchingJobsData | null>(null);
  const [matchingJobsLoading, setMatchingJobsLoading] = useState(false);
  const [reuploadingAppId, setReuploadingAppId] = useState<string | null>(null);
  const resumeInputRef = useRef<HTMLInputElement | null>(null);
  // Auto-apply state: track which jobs are being auto-applied
  const [autoApplyingJobIds, setAutoApplyingJobIds] = useState<Set<string>>(new Set());
  // Scraped external jobs from job portals
  const [scrapedJobs, setScrapedJobs] = useState<Array<{
    id: string;
    title: string;
    company: string;
    location: string;
    source: string;
    url: string;
    matchScore: number;
    postedDate: string;
    description: string;
  }>>([]);
  const [scrapedJobsLoading, setScrapedJobsLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/candidate-portal/dashboard', { headers: getAuthHeaders() });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed');
      setData(d);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load');
      // If unauthorized, send back to login
      if (e instanceof Error && /token|unauthorized|invalid/i.test(e.message)) {
        router.push('/candidate-portal/login');
      }
    } finally {
      setLoading(false);
    }
  }, [router]);

  const fetchMatchingJobs = useCallback(async () => {
    setMatchingJobsLoading(true);
    try {
      const r = await fetch('/api/candidate-portal/matching-jobs', { headers: getAuthHeaders() });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed');
      setMatchingJobs(d);
    } catch {
      // Silent — matching jobs is a "nice to have" side section
    } finally {
      setMatchingJobsLoading(false);
    }
  }, []);

  // ─── Fetch scraped external jobs ───
  const fetchScrapedJobs = useCallback(async () => {
    setScrapedJobsLoading(true);
    try {
      const r = await fetch('/api/candidate-portal/matching-jobs?scrape=true', { headers: getAuthHeaders() });
      const d = await r.json();
      if (r.ok && d.scrapedJobs) {
        setScrapedJobs(d.scrapedJobs);
      }
    } catch {
      // Silent — scraped jobs is a "nice to have"
    } finally {
      setScrapedJobsLoading(false);
    }
  }, []);

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('tb_candidate_token') : null;
    if (!token) {
      router.push('/candidate-portal/login');
      return;
    }
    fetchData();
    // Load matching jobs + scraped jobs in parallel
    fetchMatchingJobs();
    fetchScrapedJobs();
  }, [fetchData, fetchMatchingJobs, fetchScrapedJobs, router]);

  // ─── Auto-apply handler ───
  // When candidate clicks "Apply now" on a matching job, auto-apply
  // using their stored resume and profile instead of redirecting to /careers
  const handleAutoApply = async (job: MatchingJob) => {
    if (autoApplyingJobIds.has(job.id)) return;

    setAutoApplyingJobIds(prev => new Set(prev).add(job.id));
    try {
      // Get the candidate's profile and resume
      const profileRes = await fetch('/api/candidate-portal/dashboard', { headers: getAuthHeaders() });
      const profileData = await profileRes.json();

      const candidateEmail = typeof window !== 'undefined' ? localStorage.getItem('tb_candidate_email') : null;
      if (!candidateEmail) {
        toast.error('Please login again to apply');
        return;
      }

      // Auto-apply using the candidate's stored resume
      const applyRes = await fetch('/api/public/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobPostingId: job.id,
          candidateName: profileData.profile?.name || '',
          candidateEmail: candidateEmail,
          candidatePhone: '',
          resumeDataUrl: '', // Will use stored resume
          source: 'candidate_portal_auto',
        }),
      });

      const applyData = await applyRes.json();

      if (applyRes.ok) {
        toast.success(`Applied to "${job.title}" at ${job.company}!`);
        // Refresh dashboard to show new application
        fetchData();
      } else if (applyRes.status === 409) {
        toast.error(`You've already applied to this position`);
      } else {
        throw new Error(applyData.error || 'Failed to apply');
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to apply');
    } finally {
      setAutoApplyingJobIds(prev => {
        const next = new Set(prev);
        next.delete(job.id);
        return next;
      });
    }
  };

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('tb_candidate_token');
      localStorage.removeItem('tb_candidate_email');
    }
    router.push('/candidate-portal/login');
  };

  // ─── Resume re-upload ─────────────────────────────────────────────────
  // Triggered by the "Re-upload resume" button on each application row.
  // Opens the file picker, reads the file as a data URL, and POSTs it to
  // /api/candidate-portal/resume/re-upload. On success we refresh both the
  // dashboard data (so insights/skill matrix update) and the matching-jobs
  // data (so internal/external recommendations pick up the new skills).
  const handleReUploadClick = (appId: string) => {
    setReuploadingAppId(appId);
    if (resumeInputRef.current) {
      resumeInputRef.current.dataset.appId = appId;
      resumeInputRef.current.click();
    }
  };

  const handleResumeFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const appId = resumeInputRef.current?.dataset.appId;
    // Reset input value so the same file can be re-selected later
    if (e.target) e.target.value = '';
    if (!file || !appId) {
      setReuploadingAppId(null);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Resume must be under 5 MB');
      setReuploadingAppId(null);
      return;
    }
    const allowed = ['.pdf', '.doc', '.docx', '.rtf', '.txt'];
    if (!allowed.some((ext) => file.name.toLowerCase().endsWith(ext))) {
      toast.error('Resume must be a PDF, DOC, DOCX, RTF, or TXT file');
      setReuploadingAppId(null);
      return;
    }
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
      });
      const r = await fetch('/api/candidate-portal/resume/re-upload', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          jobApplicationId: appId,
          resumeDataUrl: dataUrl,
          resumeFileName: file.name,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed');
      toast.success(d.message || 'Resume updated');
      // Refresh dashboard + matching jobs in parallel
      fetchData();
      fetchMatchingJobs();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to upload resume');
    } finally {
      setReuploadingAppId(null);
    }
  };

  if (loading || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-10 h-10 border-3 border-teal-200 border-t-teal-600 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-500">Loading your dashboard…</p>
        </div>
      </div>
    );
  }

  const { profile, stats, applications, interviews, aiInterviews, resumeInsights, sentiments, skillMatrix, aiSuggestions, learningSuggestions, talentPool, savedJobs, jobAlerts } = data;

  // Compute interview progress chart data (attended by score)
  const interviewProgress = interviews.attended
    .filter(i => i.score != null || i.aiScore != null)
    .map(i => ({
      label: i.jobTitle.slice(0, 20),
      score: i.score ?? i.aiScore ?? 0,
      type: i.type,
    }))
    .slice(0, 10);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Hidden file input for resume re-upload (one shared input for all apps) */}
      <input
        ref={resumeInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.rtf,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/rtf,text/plain"
        className="hidden"
        onChange={handleResumeFileChange}
      />
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/careers"
              className="hidden sm:inline-flex items-center gap-1 text-xs text-slate-500 hover:text-teal-700 px-2 py-1 rounded-lg hover:bg-teal-50 transition-colors"
              title="Back to careers page"
            >
              <FiArrowLeft className="w-3.5 h-3.5" /> Careers
            </Link>
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-teal-500 to-sky-500 text-white flex items-center justify-center">
              <FiBriefcase className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-800">Candidate Portal</h1>
              <p className="text-[11px] text-slate-500">Welcome, {profile.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/candidate-portal/resume-builder"
              className="hidden md:inline-flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 px-2.5 py-1.5 rounded-lg hover:bg-emerald-50 transition-colors"
              title="AI Resume Builder"
            >
              <FiZap className="w-3.5 h-3.5" /> Resume Builder
            </Link>
            <Link
              href="/careers"
              className="hidden md:inline-flex items-center gap-1 text-xs text-teal-600 hover:text-teal-700 px-2.5 py-1.5 rounded-lg hover:bg-teal-50 transition-colors"
              title="Browse open positions"
            >
              <FiSearch className="w-3.5 h-3.5" /> Browse Jobs
            </Link>
            <Link
              href="/login"
              className="hidden md:inline-flex items-center gap-1 text-xs text-slate-500 hover:text-sky-700 px-2.5 py-1.5 rounded-lg hover:bg-sky-50 transition-colors"
              title="HR / Admin login"
            >
              <FiGrid className="w-3.5 h-3.5" /> HRMS
            </Link>
            <a href="/candidate-portal/settings" className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg" title="Settings & Privacy">
              <FiActivity className="w-4 h-4" />
            </a>
            <button onClick={fetchData} className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg" title="Refresh">
              <FiRefreshCw className="w-4 h-4" />
            </button>
            <button onClick={handleLogout} className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-rose-600 px-2 py-1.5 rounded-lg hover:bg-rose-50">
              <FiLogOut className="w-3.5 h-3.5" /> Logout
            </button>
          </div>
        </div>
      </header>
      {data?.pendingOffer && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
          <a href={`/offer/${data.pendingOffer.accessToken}`} className="block rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50 px-5 py-4 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="text-sm font-bold text-emerald-800">🎉 You have an offer for the {data.pendingOffer.position} position!</p>
                <p className="text-xs text-emerald-700 mt-0.5">Review the details and accept securely online{data.pendingOffer.joiningDate ? ` — proposed joining: ${new Date(data.pendingOffer.joiningDate).toLocaleDateString()}` : ''}.</p>
              </div>
              <span className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold">View &amp; Respond →</span>
            </div>
          </a>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Stats Grid */}
        <section>
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-3">Application Overview</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3">
            <StatCard label="Applied" value={stats.applied} icon={<FiBriefcase className="w-5 h-5" />} color="sky" />
            <StatCard label="Shortlisted" value={stats.shortlisted} icon={<FiStar className="w-5 h-5" />} color="violet" />
            <StatCard label="Interviewing" value={stats.interviewing} icon={<FiClock className="w-5 h-5" />} color="amber" />
            <StatCard label="Offered" value={stats.offered} icon={<FiAward className="w-5 h-5" />} color="emerald" />
            <StatCard label="Hired" value={stats.hired} icon={<FiCheckCircle className="w-5 h-5" />} color="green" />
            <StatCard label="Talent Pool" value={stats.talentPool} icon={<FiTarget className="w-5 h-5" />} color="indigo" />
            <StatCard label="Rejected" value={stats.rejected} icon={<FiXCircle className="w-5 h-5" />} color="rose" />
          </div>
        </section>

        {/* Interview Stats */}
        <section>
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-3">Interview Activity</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Upcoming" value={interviews.upcoming.length} icon={<FiCalendar className="w-5 h-5" />} color="sky" />
            <StatCard label="Attended" value={interviews.attended.length} icon={<FiCheckCircle className="w-5 h-5" />} color="emerald" />
            <StatCard label="Missed (Manual)" value={interviews.missed.length} icon={<FiXCircle className="w-5 h-5" />} color="rose" />
            <StatCard label="AI Interviews Done" value={aiInterviews.completed} icon={<FiZap className="w-5 h-5" />} color="violet" />
          </div>
          {aiInterviews.missed > 0 && (
            <p className="text-xs text-amber-700 mt-2 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg">
              ⚠ {aiInterviews.missed} AI interview(s) expired or were disqualified. Check your spam folder for invitations.
            </p>
          )}
        </section>

        {/* AI Suggestions */}
        {aiSuggestions.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-2">
              <FiZap className="w-4 h-4 text-teal-500" /> AI Suggestions
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {aiSuggestions.map((s, i) => (
                <div key={i} className={`rounded-lg border p-3 text-sm ${
                  s.severity === 'warning' ? 'bg-amber-50 border-amber-200' :
                  s.severity === 'error' ? 'bg-rose-50 border-rose-200' :
                  'bg-sky-50 border-sky-200'
                }`}>
                  <div className="flex items-start gap-2">
                    <FiAlertCircle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                      s.severity === 'warning' ? 'text-amber-600' :
                      s.severity === 'error' ? 'text-rose-600' : 'text-sky-600'
                    }`} />
                    <div className="flex-1">
                      {s.jobTitle && <p className="font-semibold text-slate-800 text-xs mb-0.5">{s.jobTitle}</p>}
                      <p className="text-slate-700 text-xs leading-relaxed">{s.message}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Two-column: Applications + Interviews */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Applications List */}
          <section className="lg:col-span-2">
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-2">
              <FiBriefcase className="w-4 h-4 text-slate-500" /> Your Applications
            </h2>
            <div className="space-y-2">
              {applications.length === 0 ? (
                <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
                  <FiBriefcase className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-slate-500">You haven't applied to any jobs yet.</p>
                  <Link href="/recruitment" className="inline-flex items-center gap-1 text-xs text-teal-600 hover:text-teal-700 mt-2">
                    Browse open positions <FiArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              ) : (
                applications.map(app => (
                  <div key={app.id} className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-sm font-semibold text-slate-800">{app.jobTitle}</h3>
                        <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-500">
                          <span>{app.position}</span>
                          {app.department && <span>• {app.department}</span>}
                          {app.location && (
                            <span className="flex items-center gap-0.5">
                              <FiMapPin className="w-3 h-3" /> {app.location}
                            </span>
                          )}
                          <span>• Applied {fmtDate(app.appliedDate)}</span>
                        </div>
                      </div>
                      {/* REQ-AI-RES-03: per-application match score */}
                      {app.matchScore != null && (
                        <div className="text-center ml-3">
                          <div className="text-[10px] uppercase tracking-wider text-slate-400">Match</div>
                          <div className={`text-lg font-bold ${app.matchScore >= 70 ? 'text-green-600' : app.matchScore >= 40 ? 'text-amber-600' : 'text-rose-600'}`}>{app.matchScore}%</div>
                        </div>
                      )}
                    </div>
                    {/* REQ-CAND-07: visual status tracker (Applied → Screening → Interview → Offer) */}
                    <div className="mt-3">
                      <StatusTracker status={app.status} />
                    </div>
                    {/* REQ-STAT-05: published AI feedback */}
                    {app.aiFeedback && (
                      <div className="mt-3 bg-green-50 border border-green-200 rounded-lg p-3">
                        <div className="text-[10px] font-bold uppercase text-green-700 mb-1">💬 Feedback from the hiring team</div>
                        <div className="text-xs text-slate-700 whitespace-pre-wrap">{app.aiFeedback.text}</div>
                        <div className="text-[10px] text-slate-400 mt-1">{fmtDate(app.aiFeedback.publishedAt)}</div>
                      </div>
                    )}
                    {/* Action row: re-upload resume + optimize resume (REQ-AI-RES-09) */}
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5">
                      <button
                        onClick={() => handleReUploadClick(app.id)}
                        disabled={reuploadingAppId === app.id}
                        className="inline-flex items-center gap-1 text-xs text-sky-600 hover:text-sky-700 disabled:text-slate-400 disabled:cursor-wait"
                        title="Replace the resume on file for this application"
                      >
                        <FiUpload className="w-3 h-3" />
                        {reuploadingAppId === app.id ? 'Uploading…' : 'Re-upload resume'}
                      </button>
                      {!['hired', 'rejected'].includes(app.status) && app.matchScore == null && (
                        <Link href={`/candidate-portal/resume-optimizer?applicationId=${app.id}`} className="inline-flex items-center gap-1 text-xs text-teal-600 hover:text-teal-700">
                          <FiZap className="w-3 h-3" /> Optimize Resume with AI
                        </Link>
                      )}
                      {app.matchScore != null && (
                        <Link href={`/candidate-portal/resume-optimizer?applicationId=${app.id}`} className="inline-flex items-center gap-1 text-xs text-teal-600 hover:text-teal-700">
                          <FiZap className="w-3 h-3" /> Re-optimize Resume (v{app.optimizationVersion || 1})
                        </Link>
                      )}
                    </div>
                    {app.expectedSalary && (
                      <p className="text-[11px] text-slate-500 mt-2">Expected: {app.expectedSalary}</p>
                    )}
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Talent Pool Section (REQ-STAT-01, REQ-STAT-02) */}
          {talentPool && talentPool.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                <FiTarget className="w-4 h-4 text-slate-500" /> Talent Pool Status
              </h2>
              <div className="space-y-2">
                {talentPool.map(tp => (
                  <div key={tp.id} className="bg-gradient-to-r from-emerald-50 to-green-50 rounded-xl border border-emerald-200 p-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-xs font-semibold text-slate-800">{tp.companyName}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">Added on {fmtDate(tp.placedAt)}</div>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">💼 In Talent Pool</span>
                    </div>
                    <p className="text-xs text-slate-600 mt-2 italic">{tp.message}</p>
                    {tp.notes && <p className="text-[11px] text-slate-500 mt-1">Notes: {tp.notes}</p>}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Saved Jobs Section (REQ-CAND-07) */}
          {savedJobs && savedJobs.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                <FiStar className="w-4 h-4 text-slate-500" /> Saved Jobs
              </h2>
              <div className="space-y-2">
                {savedJobs.map(s => (
                  <div key={s.id} className="bg-white rounded-xl border border-slate-200 p-3 flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold text-slate-800">{s.job?.title}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {s.job?.department?.company?.name} • {s.job?.location || 'Remote'}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {s.matchScore != null && (
                        <div className="text-center">
                          <div className="text-[9px] uppercase text-slate-400">Match</div>
                          <div className={`text-sm font-bold ${s.matchScore >= 70 ? 'text-green-600' : 'text-amber-600'}`}>{s.matchScore}%</div>
                        </div>
                      )}
                      <Link href={`/careers`} className="text-xs text-teal-600 hover:underline">View</Link>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Job Alerts Section (REQ-STAT-03) */}
          {jobAlerts && jobAlerts.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                <FiZap className="w-4 h-4 text-amber-500" /> New Job Alerts
              </h2>
              <div className="space-y-2">
                {jobAlerts.map(ja => (
                  <div key={ja.id} className="bg-white rounded-xl border border-amber-200 p-3 flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold text-slate-800">{ja.job?.title}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {ja.job?.department?.company?.name} • {ja.job?.location || 'Remote'}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-[9px] uppercase text-slate-400">Match</div>
                      <div className="text-sm font-bold text-green-600">{ja.matchScore}%</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Upcoming Interviews Sidebar */}
          <section>
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-2">
              <FiCalendar className="w-4 h-4 text-slate-500" /> Upcoming Interviews
            </h2>
            <div className="space-y-2">
              {interviews.upcoming.length === 0 ? (
                <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
                  <FiCalendar className="w-8 h-8 text-slate-300 mx-auto mb-1" />
                  <p className="text-xs text-slate-500">No upcoming interviews</p>
                </div>
              ) : (
                interviews.upcoming.map(iv => (
                  <div key={iv.id} className="bg-white rounded-xl border border-amber-200 p-3">
                    <p className="text-xs font-semibold text-slate-800">{iv.jobTitle}</p>
                    <p className="text-[10px] text-slate-500 uppercase mt-0.5">{iv.type} Interview</p>
                    <p className="text-[11px] text-slate-700 mt-1">{fmtDateTime(iv.date)}</p>
                    {iv.meetingUrl && (
                      <a href={iv.meetingUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] text-teal-600 hover:text-teal-700 mt-1">
                        Join meeting <FiArrowRight className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        {/* Interview Progress Chart */}
        {interviewProgress.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-2">
              <FiBarChart2 className="w-4 h-4 text-slate-500" /> Interview Performance
            </h2>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="space-y-2">
                {interviewProgress.map((p, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-32 text-xs text-slate-700 truncate">{p.label}</div>
                    <div className="flex-1 bg-slate-100 rounded-full h-6 relative overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          p.score >= 80 ? 'bg-emerald-500' :
                          p.score >= 60 ? 'bg-amber-500' : 'bg-rose-500'
                        }`}
                        style={{ width: `${Math.min(100, p.score)}%` }}
                      />
                      <span className="absolute inset-0 flex items-center justify-end pr-2 text-[10px] font-semibold text-slate-700">
                        {p.score} · {p.type}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Resume Insights + Skill Matrix */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section>
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-2">
              <FiActivity className="w-4 h-4 text-slate-500" /> Resume Insights
            </h2>
            <div className="space-y-2">
              {resumeInsights.length === 0 ? (
                <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
                  <p className="text-xs text-slate-500">No resume parsed yet.</p>
                </div>
              ) : (
                resumeInsights.map((ri: any, i) => (
                  <div key={i} className="bg-white rounded-xl border border-slate-200 p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-slate-800">{ri.jobTitle}</p>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                        ri.confidence > 0.8 ? 'bg-emerald-50 text-emerald-700' :
                        ri.confidence > 0.5 ? 'bg-amber-50 text-amber-700' :
                        'bg-rose-50 text-rose-700'
                      }`}>
                        {(ri.confidence * 100).toFixed(0)}% confidence
                      </span>
                    </div>
                    <div className="mt-2 text-[11px] text-slate-600 space-y-0.5">
                      {ri.parsed?.name && <p><strong>Name:</strong> {ri.parsed.name}</p>}
                      {ri.parsed?.email && <p><strong>Email:</strong> {ri.parsed.email}</p>}
                      {ri.language && <p><strong>Detected language:</strong> {ri.language}</p>}
                      {ri.parsed?.skills && Array.isArray(ri.parsed.skills) && ri.parsed.skills.length > 0 && (
                        <div>
                          <strong>Detected skills:</strong>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {ri.parsed.skills.slice(0, 8).map((s: string, j: number) => (
                              <span key={j} className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">{s}</span>
                            ))}
                            {ri.parsed.skills.length > 8 && (
                              <span className="text-[10px] text-slate-500">+{ri.parsed.skills.length - 8} more</span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                    {ri.parseError && (
                      <p className="text-[10px] text-rose-600 mt-1">⚠ Parse error: {ri.parseError}</p>
                    )}
                  </div>
                ))
              )}
            </div>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-2">
              <FiTarget className="w-4 h-4 text-slate-500" /> Skill Matrix
            </h2>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              {skillMatrix.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-4">No skills detected yet. Upload a resume to see your skill matrix.</p>
              ) : (
                <div className="space-y-1.5">
                  {skillMatrix.slice(0, 12).map((s, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="w-24 text-[11px] text-slate-700 capitalize truncate">{s.skill.replace(/-/g, ' ')}</div>
                      <div className="flex-1 bg-slate-100 rounded-full h-3">
                        <div
                          className="h-full bg-gradient-to-r from-teal-500 to-sky-500 rounded-full"
                          style={{ width: `${Math.min(100, s.frequency * 25)}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-slate-500 w-8 text-right">{s.frequency}x</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Sentiment */}
            {sentiments.length > 0 && (
              <div className="mt-4">
                <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">Sentiment & Engagement</h3>
                <div className="space-y-2">
                  {sentiments.map((s, i) => (
                    <div key={i} className="bg-white rounded-xl border border-slate-200 p-3">
                      <p className="text-xs font-semibold text-slate-800">{s.jobTitle}</p>
                      <div className="grid grid-cols-3 gap-2 mt-2 text-center">
                        <div>
                          <p className="text-[9px] uppercase text-slate-500">Sentiment</p>
                          <p className={`text-xs font-semibold ${
                            s.sentiment === 'positive' ? 'text-emerald-600' :
                            s.sentiment === 'negative' ? 'text-rose-600' : 'text-slate-600'
                          }`}>{s.sentiment}</p>
                        </div>
                        <div>
                          <p className="text-[9px] uppercase text-slate-500">Engagement</p>
                          <p className="text-xs font-semibold text-slate-800">{s.engagementScore}/100</p>
                        </div>
                        <div>
                          <p className="text-[9px] uppercase text-slate-500">Drop-off Risk</p>
                          <p className={`text-xs font-semibold ${s.dropoffRisk > 70 ? 'text-rose-600' : s.dropoffRisk > 40 ? 'text-amber-600' : 'text-emerald-600'}`}>{s.dropoffRisk}/100</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>

        {/* ─── Matching Jobs: internal portal + external job boards ─── */}
        <section>
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-2">
            <FiSearch className="w-4 h-4 text-slate-500" /> Matching Jobs
            <span className="text-[10px] font-normal text-slate-500">— based on the skills detected on your resume</span>
          </h2>

          {/* Detected skills row — gives the candidate transparency about
              what's driving the matches. */}
          {matchingJobs && matchingJobs.candidateSkills.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-3 mb-3">
              <p className="text-[11px] uppercase tracking-wider text-slate-500 mb-1.5">Your top skills</p>
              <div className="flex flex-wrap gap-1.5">
                {matchingJobs.candidateSkills.map((s, i) => (
                  <span key={i} className="text-[11px] bg-teal-50 text-teal-700 border border-teal-200 px-2 py-0.5 rounded-full capitalize">{s}</span>
                ))}
              </div>
              {matchingJobs.candidateLocation && (
                <p className="text-[10px] text-slate-500 mt-2">📍 Detected location: <span className="font-medium">{matchingJobs.candidateLocation}</span></p>
              )}
            </div>
          )}

          {/* Internal matching jobs */}
          <div className="mb-4">
            <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <FiBriefcase className="w-3.5 h-3.5 text-teal-500" /> From our portal
            </h3>
            {matchingJobsLoading ? (
              <div className="bg-white rounded-xl border border-slate-200 p-4 text-center text-xs text-slate-400">
                <div className="w-5 h-5 border-2 border-teal-200 border-t-teal-600 rounded-full animate-spin mx-auto mb-1.5" />
                Finding matching jobs…
              </div>
            ) : matchingJobs && matchingJobs.internal.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {matchingJobs.internal.map((job) => (
                  <div key={job.id} className="bg-white rounded-xl border border-slate-200 p-3 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">{job.title}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">{job.company} · {job.position}</p>
                        <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-500">
                          {job.location && <span className="flex items-center gap-0.5"><FiMapPin className="w-3 h-3" />{job.location}</span>}
                          <span className="capitalize">· {job.type}</span>
                          {job.experience && <span>· {job.experience}</span>}
                        </div>
                      </div>
                      <div className="text-center flex-shrink-0">
                        <div className="text-[9px] uppercase text-slate-400">Match</div>
                        <div className={`text-base font-bold ${job.matchScore >= 60 ? 'text-emerald-600' : 'text-amber-600'}`}>{job.matchScore}%</div>
                      </div>
                    </div>
                    {job.matchedSkills.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {job.matchedSkills.slice(0, 5).map((s, i) => (
                          <span key={i} className="text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded capitalize">{s}</span>
                        ))}
                      </div>
                    )}
                    <button
                      onClick={() => handleAutoApply(job)}
                      disabled={autoApplyingJobIds.has(job.id)}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-white bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 disabled:opacity-60 px-3 py-1.5 rounded-lg mt-2.5 transition-all"
                    >
                      {autoApplyingJobIds.has(job.id) ? (
                        <>
                          <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Applying...
                        </>
                      ) : (
                        <>
                          <FiZap className="w-3 h-3" /> Auto-Apply
                        </>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 p-4 text-center text-xs text-slate-500">
                {matchingJobs && matchingJobs.candidateSkills.length === 0
                  ? 'Upload a resume to see matching jobs from our portal.'
                  : 'No new matching jobs from our portal right now. Check the external boards below.'}
              </div>
            )}
          </div>

          {/* Scraped External Jobs */}
          {scrapedJobs.length > 0 && (
            <div className="mb-4">
              <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <FiGlobe className="w-3.5 h-3.5 text-sky-500" /> AI-Found External Jobs
                <span className="text-[10px] font-normal text-slate-500">— matching your skills from major job boards</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {scrapedJobs.slice(0, 6).map((extJob) => (
                  <div key={extJob.id} className="bg-white rounded-xl border border-sky-200 p-3 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">{extJob.title}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">{extJob.company}</p>
                        <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-500">
                          {extJob.location && <span className="flex items-center gap-0.5"><FiMapPin className="w-3 h-3" />{extJob.location}</span>}
                          <span>· via {extJob.source}</span>
                        </div>
                      </div>
                      <div className="text-center flex-shrink-0">
                        <div className="text-[9px] uppercase text-slate-400">Match</div>
                        <div className={`text-base font-bold ${extJob.matchScore >= 60 ? 'text-emerald-600' : 'text-amber-600'}`}>{extJob.matchScore}%</div>
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-600 mt-2 line-clamp-2">{extJob.description}</p>
                    <a
                      href={extJob.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-sky-600 hover:text-sky-700 font-semibold mt-2.5"
                    >
                      View & Apply <FiExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-slate-400 mt-2">
                AI scanned LinkedIn, Naukri, Indeed & Glassdoor for jobs matching your skills.
              </p>
            </div>
          )}

          {/* External job-board deep links */}
          {matchingJobs && matchingJobs.external.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <FiExternalLink className="w-3.5 h-3.5 text-sky-500" /> From other job portals
                <span className="text-[10px] font-normal text-slate-500">— pre-filled searches on major job boards</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {matchingJobs.external.map((board) => (
                  <a
                    key={board.board}
                    href={board.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-white rounded-xl border border-slate-200 p-3 hover:border-sky-300 hover:shadow-md transition-all flex items-start justify-between gap-2"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800">{board.board}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">{board.description}</p>
                    </div>
                    <FiExternalLink className="w-3.5 h-3.5 text-sky-500 flex-shrink-0 mt-0.5" />
                  </a>
                ))}
              </div>
              <p className="text-[10px] text-slate-400 mt-2">
                Note: we don't scrape or proxy listings — these links open directly on each job board's site with your top skills pre-filled as the search query.
              </p>
            </div>
          )}
        </section>

        {/* Learning Suggestions */}
        {learningSuggestions.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-2">
              <FiBookOpen className="w-4 h-4 text-slate-500" /> Recommended Learning
              <span className="text-[10px] font-normal text-slate-500">— based on missing skills for jobs you applied to</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {learningSuggestions.map((course, i) => (
                <a key={i} href={course.url} target="_blank" rel="noopener noreferrer" className="bg-white rounded-xl border border-slate-200 p-3 hover:border-teal-300 hover:shadow-md transition-all">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-slate-800">{course.title}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">{course.provider} · {course.level}</p>
                    </div>
                    <FiTrendingUp className="w-3.5 h-3.5 text-teal-500 flex-shrink-0" />
                  </div>
                </a>
              ))}
            </div>
          </section>
        )}

        {/* Attended Interviews */}
        {interviews.attended.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-2">
              <FiCheckCircle className="w-4 h-4 text-slate-500" /> Attended Interviews
            </h2>
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">Job</th>
                    <th className="text-left px-3 py-2 font-medium">Type</th>
                    <th className="text-left px-3 py-2 font-medium">Date</th>
                    <th className="text-left px-3 py-2 font-medium">Score</th>
                    <th className="text-left px-3 py-2 font-medium">AI Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {interviews.attended.map(iv => (
                    <tr key={iv.id} className="hover:bg-slate-50">
                      <td className="px-3 py-2 text-slate-800">{iv.jobTitle}</td>
                      <td className="px-3 py-2 text-slate-600 uppercase text-[10px]">{iv.type}</td>
                      <td className="px-3 py-2 text-slate-600">{fmtDate(iv.date)}</td>
                      <td className="px-3 py-2">
                        {iv.score != null ? (
                          <span className={`font-semibold ${iv.score >= 80 ? 'text-emerald-600' : iv.score >= 60 ? 'text-amber-600' : 'text-rose-600'}`}>{iv.score}</span>
                        ) : '—'}
                      </td>
                      <td className="px-3 py-2">
                        {iv.aiScore != null ? (
                          <span className={`font-semibold ${iv.aiScore >= 80 ? 'text-emerald-600' : iv.aiScore >= 60 ? 'text-amber-600' : 'text-rose-600'}`}>{iv.aiScore}</span>
                        ) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Footer */}
        <footer className="pt-4 pb-2 text-center">
          <p className="text-[11px] text-slate-400">
            Candidate Portal · Powered by 3Boxes HRMS · <Link href="/recruitment/pii-policy" className="underline">Privacy Policy</Link>
          </p>
        </footer>
      </main>
    </div>
  );
}

function StatCard({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color: string }) {
  const colorMap: Record<string, string> = {
    sky: 'bg-sky-50 text-sky-700 border-sky-200',
    violet: 'bg-teal-50 text-teal-700 border-teal-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    green: 'bg-green-50 text-green-700 border-green-200',
    rose: 'bg-rose-50 text-rose-700 border-rose-200',
  };
  return (
    <div className={`rounded-xl border p-3 ${colorMap[color] || colorMap.sky}`}>
      <div className="flex items-center justify-between">
        <span className="text-2xl font-bold">{value}</span>
        <span className="opacity-70">{icon}</span>
      </div>
      <p className="text-[10px] uppercase tracking-wider opacity-80 mt-1 font-medium">{label}</p>
    </div>
  );
}
