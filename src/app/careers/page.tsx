'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams, useParams } from 'next/navigation';
import {
  FiSearch, FiMapPin, FiBriefcase, FiClock, FiArrowRight,
  FiUsers, FiTrendingUp, FiCheckCircle, FiX, FiUpload,
  FiMail, FiPhone, FiUser, FiDollarSign, FiFileText,
  FiHeart, FiShare2, FiChevronRight, FiExternalLink,
  FiGrid, FiZap, FiAward, FiTarget, FiLayers,
  FiShield, FiCpu, FiUnlock, FiAlertCircle,
} from 'react-icons/fi';
import toast from 'react-hot-toast';

/* ──────────────────────────────────────────────────────────────────── */
/* REQ-SEC-REC-02 — AI Transparency disclaimer (shared string)         */
/* ──────────────────────────────────────────────────────────────────── */
const AI_TRANSPARENCY_TEXT =
  'You are interacting with an AI system. Your responses and video are being analyzed algorithmically to assess fit. A human recruiter will review this data.';

/* Consent purposes (exact strings — see WAVE2-A spec) */
const CONSENT_PURPOSES = {
  resume_processing: 'Resume processing',
  background_check: 'Background check',
  ai_evaluation: 'AI evaluation',
  video_recording: 'Video recording',
} as const;

/* ──────────────────────────────────────────────────────────────────── */
/* Types                                                                */
/* ──────────────────────────────────────────────────────────────────── */
interface PublicJob {
  id: string;
  title: string;
  position: string;
  location?: string | null;
  type: string;
  experience?: string | null;
  salary?: string | null;
  description: string;
  requirements?: string | null;
  vacancies: number;
  postedDate: string;
  closingDate?: string | null;
  applicants: number;
  department: { id: string; name: string } | null;
  company: {
    id: string; name: string; code: string | null;
    city?: string | null; country?: string | null;
  } | null;
  tenant: { id: string; name: string; slug: string } | null;
  group: { id: string; name: string } | null;
}

interface ApplyFormState {
  candidateName: string;
  candidateEmail: string;
  candidatePhone: string;
  coverLetter: string;
  expectedSalary: string;
  resumeDataUrl: string;
  resumeFileName: string;
  source: string;
  // REQ-SRC-05 — referral token captured from ?ref= URL param. Pass-through
  // to /api/public/apply which attributes the application to the matching
  // Referral row and flips its status pending → applied.
  referralToken: string;
  // REQ-SEC-REC-04 — consent checkboxes (all 4 required for submit)
  consentResume: boolean;
  consentBackground: boolean;
  consentAiEvaluation: boolean;
  consentVideo: boolean;
  // REQ-SEC-REC-02 — AI Transparency acknowledgment
  aiTransparencyAck: boolean;
}

const EMPTY_FORM: ApplyFormState = {
  candidateName: '',
  candidateEmail: '',
  candidatePhone: '',
  coverLetter: '',
  expectedSalary: '',
  resumeDataUrl: '',
  resumeFileName: '',
  source: 'website',
  referralToken: '',
  consentResume: false,
  consentBackground: false,
  consentAiEvaluation: false,
  consentVideo: false,
  aiTransparencyAck: false,
};

interface ExistingConsent {
  id: string;
  purpose: string;
  grantedAt: string;
  withdrawnAt: string | null;
  tenantId: string;
}

const JOB_TYPE_LABELS: Record<string, string> = {
  'full-time': 'Full Time',
  'part-time': 'Part Time',
  contract: 'Contract',
  internship: 'Internship',
};

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const days = Math.floor(diffMs / 86400000);
  if (days < 1) return 'Today';
  if (days < 2) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} week${Math.floor(days / 7) > 1 ? 's' : ''} ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* ──────────────────────────────────────────────────────────────────── */
/* Page                                                                 */
/* ──────────────────────────────────────────────────────────────────── */
export default function CareersPage() {
  const router = useRouter();
  const params = useParams<{ tenantSlug?: string }>();
  // tenantSlug from /careers/[tenantSlug]/... — undefined on the main /careers page
  const tenantSlug = params?.tenantSlug;
  const [jobs, setJobs] = useState<PublicJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [companyFilter, setCompanyFilter] = useState('');
  const [showApply, setShowApply] = useState(false);
  const [applyJob, setApplyJob] = useState<PublicJob | null>(null);
  const [form, setForm] = useState<ApplyFormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  // Post-apply success state — shows a CTA to the candidate portal
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);

  // REQ-CAND-05: Track the currently-logged-in candidate's email (from
  // candidate-portal JWT in localStorage). When the user opens the apply form,
  // we pre-fill email with this — and warn them if they change it (because
  // that creates a NEW candidate record, not connected to their existing
  // candidate-portal login).
  const [loggedInCandidateEmail, setLoggedInCandidateEmail] = useState<string | null>(null);
  // Resume parsing state — when candidate uploads a resume we kick off a
  // server-side parse via /api/public/parse-resume and auto-fill the form
  // fields from the result.
  const [parsingResume, setParsingResume] = useState(false);
  const [parseConfidence, setParseConfidence] = useState<number | null>(null);
  const [parsedSkills, setParsedSkills] = useState<string[]>([]);

  // REQ-SEC-REC-04 — withdraw-consent modal state
  const [showWithdraw, setShowWithdraw] = useState(false);

  /* ── REQ-SRC-05 — referral token capture ──
   * When a candidate opens /careers?ref=<token>&jobId=<jobId> (typically
   * redirected there by /api/referrals/track/[token]), we capture both
   * params so we can:
   *   1. Show a "You were referred by a Marq AI Tech Pvt Ltd employee!" banner
   *   2. Pre-fill the referral token into the apply form (survives modal
   *      open/close because we read it from this state on every openApply)
   *   3. Visually highlight the specific job card the referrer pointed to
   *   4. Pass it to /api/public/apply so the referral gets attributed
   */
  const [referralToken, setReferralToken] = useState<string | null>(null);
  const [referralJobId, setReferralJobId] = useState<string | null>(null);

  useEffect(() => {
    // queueMicrotask defers the setState calls out of the synchronous
    // effect body to avoid the react-hooks/set-state-in-effect lint rule
    // (cascading renders). Same pattern used in /recruitment/page.tsx.
    queueMicrotask(() => {
      if (typeof window === 'undefined') return;
      try {
        const url = new URL(window.location.href);
        const ref = url.searchParams.get('ref');
        const jobId = url.searchParams.get('jobId');
        if (ref && typeof ref === 'string' && ref.trim()) {
          setReferralToken(ref.trim());
        }
        if (jobId && typeof jobId === 'string' && jobId.trim()) {
          setReferralJobId(jobId.trim());
        }
        // Detect candidate-portal login — if the user is already logged in
        // as a candidate, we pre-fill their email so they don't accidentally
        // create a separate candidate record by typing a different email.
        const candidateToken = localStorage.getItem('tb_candidate_token');
        const candidateEmail = localStorage.getItem('tb_candidate_email');
        if (candidateToken && candidateEmail) {
          setLoggedInCandidateEmail(candidateEmail);
        }
      } catch {
        // window.location access can throw in non-browser envs — safe to ignore.
      }
    });
  }, []);

  /* ── Role-based scoping state ──
   * The job portal is public, but if a logged-in user opens it we honor
   * their role:
   *   - super_admin  → see ALL jobs across every tenant
   *   - tenant_admin → see ONLY their own tenant's jobs
   *   - other roles  → see ONLY their own tenant's jobs (same as tenant_admin)
   *   - not logged in → see ALL jobs (default public behavior)
   *
   * The URL path /careers/[tenantSlug] always wins — it forces the filter
   * to that tenant regardless of who's viewing. This lets each tenant
   * company embed `/careers/<their-slug>` on their own website.
   */
  const [scopeInfo, setScopeInfo] = useState<{
    checked: boolean;
    userRole: string | null;
    userTenantSlug: string | null;
    userTenantName: string | null;
    effectiveTenantSlug: string | null; // what we actually filter by
  }>({
    checked: false,
    userRole: null,
    userTenantSlug: null,
    userTenantName: null,
    effectiveTenantSlug: null,
  });

  // Determine the effective tenant slug to filter by:
  //   1. If the URL has /careers/[tenantSlug], use that (highest priority — tenant embeds)
  //   2. If a logged-in user is tenant_admin / non-super-admin, use their tenant slug
  //   3. If a logged-in user is super_admin, no filter (see all jobs)
  //   4. If not logged in, no filter (see all jobs)
  //   5. If on a tenant subdomain (detected via x-tenant-slug header from middleware),
  //      use that — this lets tenants embed the careers portal on their own subdomain
  useEffect(() => {
    let cancelled = false;
    async function detectScope() {
      // Case 1: URL path wins
      if (tenantSlug) {
        setScopeInfo({
          checked: true,
          userRole: null,
          userTenantSlug: null,
          userTenantName: null,
          effectiveTenantSlug: tenantSlug,
        });
        return;
      }

      // Case 5: Try hostname-based detection via the middleware-set header.
      // We do a fetch to a no-op endpoint and read the response header to
      // learn what subdomain the middleware detected. (We can't read
      // request headers directly from a client component.)
      let subdomainTenantSlug: string | null = null;
      try {
        // A lightweight probe — same origin, just to read response headers.
        const probe = await fetch('/api/public/jobs?limit=1', { method: 'GET' });
        // The middleware sets x-tenant-slug on every response too — but browsers
        // strip most custom headers. As a fallback, we expose tenant slug via a
        // custom response header that is in the CORS safe-list.
        subdomainTenantSlug = probe.headers.get('x-tenant-slug') || null;
      } catch {
        subdomainTenantSlug = null;
      }

      // Case 2-4: Check if user is logged in
      const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
      if (!token) {
        setScopeInfo({
          checked: true,
          userRole: null,
          userTenantSlug: null,
          userTenantName: null,
          effectiveTenantSlug: subdomainTenantSlug,
        });
        return;
      }

      try {
        const res = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          // Token invalid — treat as not logged in (still honor subdomain)
          setScopeInfo({
            checked: true,
            userRole: null,
            userTenantSlug: null,
            userTenantName: null,
            effectiveTenantSlug: subdomainTenantSlug,
          });
          return;
        }
        const user = await res.json();
        const role = (user.role || '').toLowerCase();
        const tSlug = user.tenant?.slug || null;
        const tName = user.tenant?.name || null;
        // super_admin: no filter (all jobs). Everyone else: filter to own tenant.
        // Subdomain detection is overridden by an authenticated user's own tenant
        // (so a logged-in tenant_admin visiting another tenant's subdomain still
        // sees only their own tenant's jobs).
        let effective: string | null;
        if (role === 'super_admin') {
          effective = null;
        } else if (tSlug) {
          effective = tSlug;
        } else {
          effective = subdomainTenantSlug;
        }
        if (!cancelled) {
          setScopeInfo({
            checked: true,
            userRole: role,
            userTenantSlug: tSlug,
            userTenantName: tName,
            effectiveTenantSlug: effective,
          });
        }
      } catch {
        setScopeInfo({
          checked: true,
          userRole: null,
          userTenantSlug: null,
          userTenantName: null,
          effectiveTenantSlug: subdomainTenantSlug,
        });
      }
    }
    detectScope();
    return () => { cancelled = true; };
  }, [tenantSlug]);

  /* ── Fetch jobs ── */
  const fetchJobs = useCallback(async () => {
    // Wait until scope detection has completed so we know whether to filter by tenant
    if (!scopeInfo.checked) return;
    setLoading(true);
    try {
      const p = new URLSearchParams();
      // Apply the effective tenant slug (from URL or logged-in user's tenant)
      if (scopeInfo.effectiveTenantSlug) p.set('tenantSlug', scopeInfo.effectiveTenantSlug);
      if (search) p.set('search', search);
      if (typeFilter) p.set('type', typeFilter);
      if (locationFilter) p.set('location', locationFilter);
      p.set('limit', '50');
      const res = await fetch(`/api/public/jobs?${p.toString()}`);
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      setJobs(data.jobs || []);
    } catch {
      setJobs([]);
    } finally {
      setLoading(false);
    }
  }, [scopeInfo.checked, scopeInfo.effectiveTenantSlug, search, typeFilter, locationFilter]);

  useEffect(() => {
    const t = setTimeout(() => fetchJobs(), 250); // debounce
    return () => clearTimeout(t);
  }, [fetchJobs]);

  /* ── Derived: unique companies + locations for filter dropdowns ── */
  const companies = useMemo(() => {
    const m = new Map<string, string>();
    jobs.forEach((j) => { if (j.company) m.set(j.company.id, j.company.name); });
    return Array.from(m.entries()).map(([id, name]) => ({ id, name }));
  }, [jobs]);

  const locations = useMemo(() => {
    const s = new Set<string>();
    jobs.forEach((j) => { if (j.location) s.add(j.location); });
    return Array.from(s).sort();
  }, [jobs]);

  const filteredJobs = useMemo(() => {
    return jobs.filter((j) => {
      if (companyFilter && j.company?.id !== companyFilter) return false;
      return true;
    });
  }, [jobs, companyFilter]);

  /* ── Apply modal handlers ── */
  const openApply = (job: PublicJob) => {
    setApplyJob(job);
    // REQ-SRC-05: pre-fill the referral token from URL ?ref= param so the
    // apply API can attribute the application to the matching Referral.
    // REQ-CAND-05: Also pre-fill the candidate email from the candidate-portal
    // session if the user is already logged in — prevents accidentally
    // creating a duplicate candidate record under a different email.
    setForm({
      ...EMPTY_FORM,
      referralToken: referralToken || '',
      candidateEmail: loggedInCandidateEmail || '',
    });
    setParseConfidence(null);
    setParsedSkills([]);
    setShowApply(true);
  };
  const closeApply = () => {
    setShowApply(false);
    setApplyJob(null);
    setForm({
      ...EMPTY_FORM,
      referralToken: referralToken || '',
      candidateEmail: loggedInCandidateEmail || '',
    });
    setParseConfidence(null);
    setParsedSkills([]);
  };

  /**
   * Resume upload handler — uploads the file, kicks off a server-side parse,
   * and auto-fills the form fields (name / email / phone) from the parsed
   * resume. The candidate can then verify / edit before submitting.
   *
   * This is the "resume upload first, then auto-fill" flow requested by the
   * user: candidate uploads resume → form is pre-populated → candidate
   * reviews and submits. Much less typing, fewer typos in email addresses
   * (which was causing the duplicate-candidate-record bug).
   */
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Resume must be under 5 MB');
      return;
    }
    try {
      const dataUrl = await fileToDataUrl(file);
      setForm((f) => ({ ...f, resumeDataUrl: dataUrl, resumeFileName: file.name }));
      toast.success(`Loaded: ${file.name}`);

      // Kick off the parse — don't block the form, just auto-fill when ready.
      setParsingResume(true);
      try {
        const parseRes = await fetch('/api/public/parse-resume', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ resumeDataUrl: dataUrl }),
        });
        if (parseRes.ok) {
          const parseData = await parseRes.json();
          if (parseData.parsed) {
            const p = parseData.parsed;
            setForm((f) => ({
              ...f,
              // Only auto-fill fields that are empty — don't overwrite what
              // the candidate has already typed (e.g. if they corrected their
              // email after a prior parse).
              candidateName: f.candidateName || p.name || '',
              candidateEmail: f.candidateEmail || p.email || '',
              candidatePhone: f.candidatePhone || p.phone || '',
            }));
            setParseConfidence(typeof parseData.confidence === 'number' ? parseData.confidence : null);
            setParsedSkills(Array.isArray(p.skills) ? p.skills : []);
            if (parseData.parseError) {
              toast(`Resume parsed with warnings: ${parseData.parseError}`, { icon: '⚠️' });
            } else if (p.name || p.email) {
              toast.success('Auto-filled your details from the resume — please verify');
            }
          }
        }
      } catch (parseErr) {
        // Non-fatal — candidate can still fill the form manually.
        console.warn('[careers] resume parse failed:', parseErr);
        toast('Could not auto-fill from resume — please enter details manually', { icon: '⚠️' });
      } finally {
        setParsingResume(false);
      }
    } catch {
      toast.error('Failed to read file');
    }
  };

  /**
   * Logout helper — clears the candidate-portal session so the user can
   * apply as a different candidate without their old session leaking into
   * the new application.
   *
   * IMPORTANT: We only clear the auth tokens, NOT the form fields. If the
   * user typed a new email in the apply form, we keep it so they can
   * immediately submit as that new candidate. (Previously this function
   * cleared candidateEmail, which forced the user to re-type it —
   * confusing UX that caused the "both candidates show in old record" bug.)
   */
  const handleLogoutCandidate = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('tb_candidate_token');
      localStorage.removeItem('tb_candidate_email');
    }
    setLoggedInCandidateEmail(null);
    toast.success('Signed out of candidate portal — you can now apply as a new candidate.');
  };

  const handleSubmitApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!applyJob) return;
    if (!form.candidateName.trim() || !form.candidateEmail.trim()) {
      toast.error('Name and email are required');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.candidateEmail)) {
      toast.error('Please enter a valid email');
      return;
    }
    if (!form.resumeDataUrl) {
      toast.error('Please attach your resume');
      return;
    }
    // REQ-SEC-REC-04 — require the 4 consent checkboxes + AI transparency ack
    if (!form.consentResume || !form.consentBackground || !form.consentAiEvaluation || !form.consentVideo) {
      toast.error('Please review and check all 4 consent boxes to continue');
      return;
    }
    if (!form.aiTransparencyAck) {
      toast.error('Please acknowledge the AI Transparency notice to continue');
      return;
    }
    setSubmitting(true);
    try {
      // Step 1: Record consents BEFORE the apply call (REQ-SEC-REC-04).
      // Each checked purpose becomes a separate CandidateConsent row keyed by
      // (candidateEmail, tenantId, purpose). The API is idempotent — if a
      // prior active consent exists, the POST is a no-op.
      const tenantId = applyJob.tenant?.id;
      const consentPurposes: string[] = [];
      if (form.consentResume) consentPurposes.push('resume_processing');
      if (form.consentBackground) consentPurposes.push('background_check');
      if (form.consentAiEvaluation) consentPurposes.push('ai_evaluation');
      if (form.consentVideo) consentPurposes.push('video_recording');

      if (tenantId) {
        // Fire all consent POSTs in parallel — failures are logged but do not
        // block the application itself (the candidate has clicked through,
        // so we honor their intent). The /api/ats/consent route captures IP
        // + User-Agent on the server.
        await Promise.allSettled(
          consentPurposes.map(purpose =>
            fetch('/api/ats/consent', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                candidateEmail: form.candidateEmail.trim(),
                tenantId,
                purpose,
                source: 'careers_portal',
              }),
            })
          )
        );
      } else {
        console.warn('[careers] applyJob.tenant.id missing — skipping consent POST');
      }

      // Step 2: Submit the application itself (carries the referral token
      // for REQ-SRC-05 attribution).
      const res = await fetch('/api/public/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobPostingId: applyJob.id,
          candidateName: form.candidateName,
          candidateEmail: form.candidateEmail,
          candidatePhone: form.candidatePhone,
          coverLetter: form.coverLetter,
          expectedSalary: form.expectedSalary,
          resumeDataUrl: form.resumeDataUrl,
          resumeFileName: form.resumeFileName,
          source: form.source,
          // REQ-SRC-05: ensure the referral token (if any) makes it to the
          // server so the application can be attributed to a Referral row.
          referralToken: form.referralToken || referralToken || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409) {
          // Already-applied is still a "success" from the candidate's POV —
          // they have an application on file. Show the post-apply success
          // modal so they get the CTA to set up their candidate portal
          // (they likely never completed that step on their first apply).
          toast.success(data.error || "You've already applied — we'll be in touch!");
          setSubmittedEmail(form.candidateEmail.trim());
          closeApply();
          return;
        }
        throw new Error(data.error || 'Failed to submit');
      }
      // REQ-SRC-05: surface a small extra toast if the referral was
      // attributed so the candidate knows their connection will get credit.
      if (data.referralAttributed) {
        toast.success('Your referral has been recorded — your connection will get credit!');
      }
      toast.success(data.message || 'Application submitted successfully!');
      // Show the post-apply success modal with a CTA to the candidate portal.
      setSubmittedEmail(form.candidateEmail);
      closeApply();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to submit';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Stats for hero ── */
  const totalOpen = jobs.length;
  const totalCompanies = companies.length;
  const totalApplicants = jobs.reduce((s, j) => s + (j.applicants || 0), 0);

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* ───────────── Top Navigation ───────────── */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 via-teal-500 to-teal-600 flex items-center justify-center shadow-md shadow-emerald-500/30">
              <FiBriefcase className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-extrabold text-base leading-tight">3Boxes HRMS</p>
              <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Career Portal</p>
            </div>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <a href="#openings" className="hover:text-emerald-600 transition-colors">Openings</a>
            <a href="#companies" className="hover:text-emerald-600 transition-colors">Companies</a>
            <a href="#why" className="hover:text-emerald-600 transition-colors">Why Join Us</a>
          </nav>
          <div className="flex items-center gap-2">
            {loggedInCandidateEmail ? (
              <div className="hidden sm:flex items-center gap-2 px-4 py-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-sm font-bold">
                  {loggedInCandidateEmail.charAt(0).toUpperCase()}
                </div>
                <div className="text-sm">
                  <div className="font-semibold text-slate-900">{loggedInCandidateEmail}</div>
                  <Link href="/candidate-portal/dashboard" className="text-xs text-emerald-600 hover:text-emerald-700">
                    Go to Dashboard →
                  </Link>
                </div>
              </div>
            ) : (
              <Link
                href="/candidate-portal/login"
                className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-slate-700 hover:text-emerald-600 transition-colors"
              >
                Sign In <FiExternalLink className="w-3.5 h-3.5" />
              </Link>
            )}
            <a
              href="#openings"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-emerald-500 to-teal-500 hover:shadow-lg hover:shadow-emerald-500/30 transition-all"
            >
              Browse Jobs <FiArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </header>

      {/* ───────────── Hero ───────────── */}
      <section className="relative overflow-hidden">
        {/* Decorative background */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute -top-32 -left-32 w-96 h-96 bg-emerald-200/40 rounded-full blur-3xl" />
          <div className="absolute -top-40 right-0 w-[28rem] h-[28rem] bg-teal-200/40 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-1/3 w-96 h-96 bg-teal-200/30 rounded-full blur-3xl" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-16 sm:pt-24 pb-12">
          <div className="text-center max-w-3xl mx-auto">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold ring-1 ring-emerald-200 mb-5">
              <FiZap className="w-3.5 h-3.5" /> {totalOpen} open positions across {totalCompanies} companies
            </span>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.05] mb-5">
              Find the work <br />
              <span className="bg-gradient-to-r from-emerald-600 via-teal-600 to-teal-600 bg-clip-text text-transparent">
                that moves you.
              </span>
            </h1>
            <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto mb-8">
              {scopeInfo.effectiveTenantSlug
                ? `Browse open roles at ${scopeInfo.userTenantName || 'this company'}, upload your resume, and apply in seconds. No account required — your application goes straight to the hiring team.`
                : `Browse open roles across all our group companies, upload your resume once, and apply in seconds. No account required — your application goes straight to the hiring team.`}
            </p>

            {/* Scope badge — shows whether the viewer is seeing all jobs or just one tenant's jobs */}
            {scopeInfo.checked && (
              <div className="mb-6">
                {scopeInfo.effectiveTenantSlug ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-50 text-teal-700 text-[11px] font-semibold ring-1 ring-teal-200">
                    <FiLayers className="w-3 h-3" />
                    {scopeInfo.userRole
                      ? `Scoped to your tenant: ${scopeInfo.userTenantName || scopeInfo.effectiveTenantSlug}`
                      : `Scoped to tenant: ${scopeInfo.effectiveTenantSlug}`}
                  </span>
                ) : scopeInfo.userRole === 'super_admin' ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-semibold ring-1 ring-emerald-200">
                    <FiUsers className="w-3 h-3" /> Super Admin view — showing ALL tenants&apos; openings
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-50 text-slate-600 text-[11px] font-semibold ring-1 ring-slate-200">
                    <FiGrid className="w-3 h-3" /> Showing openings across all companies
                  </span>
                )}
              </div>
            )}

            {/* REQ-SRC-05 — Referral banner
                Shown when the visitor arrived via an employee's trackable
                referral link (?ref=<token>). Lets them know their
                application will be attributed to the referring employee. */}
            {referralToken && (
              <div className="mb-6 max-w-2xl mx-auto">
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-teal-50 to-emerald-50 ring-1 ring-teal-200 text-left">
                  <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center text-white flex-shrink-0">
                    <FiHeart className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-teal-900">
                      You were referred by a Marq AI Tech Pvt Ltd employee!
                    </p>
                    <p className="text-xs text-teal-700 mt-0.5">
                      Your application will be attributed to the person who shared this link.
                      {referralJobId && jobs.find((j) => j.id === referralJobId) && (
                        <> Scroll down to the <b>“{jobs.find((j) => j.id === referralJobId)?.title}”</b> role and hit Apply.</>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Search bar */}
            <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/60 ring-1 ring-slate-200 p-2 max-w-2xl mx-auto flex flex-col sm:flex-row gap-2">
              <div className="flex-1 flex items-center gap-2 px-3">
                <FiSearch className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Job title, keyword, or company"
                  className="w-full py-2.5 text-sm outline-none placeholder:text-slate-400"
                />
              </div>
              <div className="flex items-center gap-2 px-3 sm:border-l border-slate-200">
                <FiMapPin className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <input
                  value={locationFilter}
                  onChange={(e) => setLocationFilter(e.target.value)}
                  placeholder="Location"
                  className="w-full sm:w-32 py-2.5 text-sm outline-none placeholder:text-slate-400"
                />
              </div>
              <button
                onClick={() => fetchJobs()}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-emerald-500 to-teal-500 hover:shadow-lg hover:shadow-emerald-500/30 transition-all"
              >
                Search <FiArrowRight className="w-4 h-4" />
              </button>
            </div>

            {/* Quick stats */}
            <div className="grid grid-cols-3 gap-4 max-w-md mx-auto mt-10">
              <div className="text-center">
                <p className="text-2xl sm:text-3xl font-extrabold text-emerald-600">{totalOpen}</p>
                <p className="text-[11px] text-slate-500 font-medium uppercase tracking-wider">Open Roles</p>
              </div>
              <div className="text-center">
                <p className="text-2xl sm:text-3xl font-extrabold text-teal-600">{totalCompanies}</p>
                <p className="text-[11px] text-slate-500 font-medium uppercase tracking-wider">Companies</p>
              </div>
              <div className="text-center">
                <p className="text-2xl sm:text-3xl font-extrabold text-teal-600">{totalApplicants}</p>
                <p className="text-[11px] text-slate-500 font-medium uppercase tracking-wider">Applicants</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ───────────── Job Filters ───────────── */}
      <section id="openings" className="border-t border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
            <div>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Open Positions</h2>
              <p className="text-sm text-slate-500 mt-1">
                Showing <b>{filteredJobs.length}</b> {filteredJobs.length === 1 ? 'role' : 'roles'}
                {companyFilter && <span> filtered by <b>{companies.find((c) => c.id === companyFilter)?.name}</b></span>}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-200 text-sm font-medium bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
              >
                <option value="">All types</option>
                {Object.entries(JOB_TYPE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
              <select
                value={companyFilter}
                onChange={(e) => setCompanyFilter(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-200 text-sm font-medium bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
              >
                <option value="">All companies</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Job grid */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-white border border-slate-200 rounded-2xl p-6 animate-pulse">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 bg-slate-200 rounded-xl" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 w-20 bg-slate-200 rounded" />
                      <div className="h-4 w-32 bg-slate-100 rounded" />
                    </div>
                  </div>
                  <div className="h-4 w-3/4 bg-slate-100 rounded mb-2" />
                  <div className="h-3 w-full bg-slate-50 rounded mb-1" />
                  <div className="h-3 w-5/6 bg-slate-50 rounded" />
                  <div className="flex gap-2 mt-4">
                    <div className="h-6 w-16 bg-slate-100 rounded-full" />
                    <div className="h-6 w-20 bg-slate-100 rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredJobs.length === 0 ? (
            <div className="text-center py-20 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              <FiBriefcase className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <p className="text-lg font-semibold text-slate-700">No open positions match your search</p>
              <p className="text-sm text-slate-500 mt-1">Try clearing filters or check back soon — new roles open weekly.</p>
              <button
                onClick={() => { setSearch(''); setTypeFilter(''); setLocationFilter(''); setCompanyFilter(''); }}
                className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-emerald-600 hover:bg-emerald-50"
              >
                <FiX className="w-3.5 h-3.5" /> Clear all filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredJobs.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  onApply={() => openApply(job)}
                  isReferred={referralJobId === job.id}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ───────────── Companies section ───────────── */}
      {companies.length > 0 && (
        <section id="companies" className="bg-slate-50 border-t border-slate-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-14">
            <div className="text-center max-w-2xl mx-auto mb-8">
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Hiring Companies</h2>
              <p className="text-sm text-slate-500 mt-1.5">
                Roles across our family of companies — pick the team that fits you best.
              </p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {companies.map((c) => {
                const count = jobs.filter((j) => j.company?.id === c.id).length;
                return (
                  <button
                    key={c.id}
                    onClick={() => setCompanyFilter(c.id)}
                    className="text-left bg-white border border-slate-200 rounded-2xl p-5 hover:border-emerald-300 hover:shadow-md transition-all"
                  >
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold mb-3">
                      {c.name.charAt(0).toUpperCase()}
                    </div>
                    <p className="font-semibold text-slate-900 truncate">{c.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{count} open {count === 1 ? 'role' : 'roles'}</p>
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ───────────── Why Join Us ───────────── */}
      <section id="why" className="bg-white border-t border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-50 text-teal-700 text-xs font-semibold ring-1 ring-teal-200 mb-4">
              <FiAward className="w-3.5 h-3.5" /> Why candidates choose us
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">More than just a job</h2>
            <p className="text-sm text-slate-500 mt-2">
              From day one, you&apos;ll join a culture built on growth, ownership, and impact.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { icon: FiTrendingUp, title: 'Fast Growth', desc: 'Clear career paths and promotion cycles — most team leads were promoted from within.', color: 'from-emerald-500 to-teal-600' },
              { icon: FiUsers, title: 'Mentorship', desc: 'Every new hire is paired with a senior mentor for their first 90 days.', color: 'from-emerald-500 to-teal-600' },
              { icon: FiTarget, title: 'Real Impact', desc: 'Work on production systems from week one — no busy work, no make-work projects.', color: 'from-amber-500 to-orange-600' },
              { icon: FiHeart, title: 'Wellness First', desc: 'Flexible hours, remote-friendly, comprehensive health coverage, and generous PTO.', color: 'from-pink-500 to-rose-600' },
            ].map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.title} className="bg-gradient-to-br from-slate-50 to-white border border-slate-200 rounded-2xl p-5 hover:shadow-md transition-all">
                  <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${f.color} flex items-center justify-center text-white mb-3`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <p className="font-bold text-slate-900">{f.title}</p>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ───────────── Footer ───────────── */}
      <footer className="bg-slate-900 text-slate-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                  <FiBriefcase className="w-4 h-4 text-white" />
                </div>
                <p className="font-extrabold text-white">3Boxes HRMS</p>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                A unified talent platform connecting candidates with opportunities across
                our group companies. Apply once — get considered across all open roles.
              </p>
            </div>
            <div>
              <p className="font-semibold text-white text-sm mb-3">For Candidates</p>
              <ul className="space-y-2 text-xs">
                <li><a href="#openings" className="hover:text-white transition-colors">Browse Openings</a></li>
                <li><a href="#companies" className="hover:text-white transition-colors">Hiring Companies</a></li>
                <li><a href="#why" className="hover:text-white transition-colors">Why Join Us</a></li>
                <li><Link href="/candidate-portal/login" className="hover:text-white transition-colors">Sign In to Portal</Link></li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-white text-sm mb-3">For Employers</p>
              <ul className="space-y-2 text-xs">
                <li><Link href="/login" className="hover:text-white transition-colors">Post a Job</Link></li>
                <li><Link href="/login" className="hover:text-white transition-colors">Review Applications</Link></li>
                <li><Link href="/login" className="hover:text-white transition-colors">Schedule Interviews</Link></li>
                <li><Link href="/login" className="hover:text-white transition-colors">Tenant Admin Console</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-slate-800 mt-8 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-slate-500">© {new Date().getFullYear()} 3Boxes HRMS — Career Portal. All rights reserved.</p>
            <p className="text-xs text-slate-500">Powered by 3Boxes HRMS</p>
          </div>
        </div>
      </footer>

      {/* ───────────── REQ-PORT-04 — schema.org JobPosting JSON-LD ─────────────
          One <script type="application/ld+json"> per visible job posting.
          This is what Google's "Google for Jobs" crawler reads to index
          the role in its job search vertical. Critical fields:
            - title, description, hiringOrganization.name
            - jobLocation.address.addressLocality
            - employmentType (FULL_TIME / PART_TIME / CONTRACTOR / TEMPORARY / INTERN)
            - datePosted, validThrough
            - baseSalary (optional but improves CTR)

          We render these as raw <script> tags with dangerouslySetInnerHTML.
          React 18+ renders them to the DOM (does not execute them — which
          is fine because JSON-LD is data, not executable JS). Googlebot's
          renderer picks them up after hydration.

          We rebuild the JSON-LD set whenever `jobs` changes (filter, search,
          tenant scoping) so the indexed set always matches the visible UI.
          Defensive: skip jobs missing required fields (title or description)
          to avoid emitting invalid markup that would be flagged by Google's
          Rich Results validator. */}
      <JobPostingJsonLd jobs={filteredJobs} />

      {/* ───────────── Apply Modal ───────────── */}
      {showApply && applyJob && (
        <ApplyModal
          job={applyJob}
          form={form}
          setForm={setForm}
          onClose={closeApply}
          onSubmit={handleSubmitApply}
          onFileChange={handleFileChange}
          submitting={submitting}
          onWithdraw={() => setShowWithdraw(true)}
          parsingResume={parsingResume}
          parseConfidence={parseConfidence}
          parsedSkills={parsedSkills}
          loggedInCandidateEmail={loggedInCandidateEmail}
          onLogoutCandidate={handleLogoutCandidate}
        />
      )}

      {/* ───────────── Post-Apply Success Modal (REQ-CAND-05 onboarding) ───────────── */}
      {submittedEmail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 text-center">
            <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center">
              <FiCheckCircle className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-xl font-bold text-slate-800 mb-1">Application submitted!</h2>
            <p className="text-sm text-slate-500 mb-4">
              We've received your application. Create a candidate portal account to track its
              status, see interview feedback, and optimize your resume with AI.
            </p>
            <div className="bg-teal-50 border border-teal-200 rounded-lg p-3 mb-4">
              <p className="text-xs text-teal-700 font-medium mb-1">Your email</p>
              <p className="text-sm font-mono text-teal-900 break-all">{submittedEmail}</p>
            </div>
            <a
              href={`/candidate-portal/login?email=${encodeURIComponent(submittedEmail)}`}
              className="block w-full px-4 py-2.5 bg-gradient-to-r from-teal-600 to-sky-600 hover:from-teal-700 hover:to-sky-700 text-white rounded-lg text-sm font-medium mb-2"
            >
              Set up my candidate portal →
            </a>
            <button
              onClick={() => setSubmittedEmail(null)}
              className="w-full text-xs text-slate-500 hover:text-slate-700 py-1"
            >
              Maybe later
            </button>
          </div>
        </div>
      )}

      {/* ───────────── Withdraw Consent Modal (REQ-SEC-REC-04) ───────────── */}
      {showWithdraw && (
        <WithdrawConsentModal
          defaultEmail={form.candidateEmail}
          defaultTenantId={applyJob?.tenant?.id || null}
          onClose={() => setShowWithdraw(false)}
        />
      )}

      {/* ───────────── Floating "withdraw consent" link (always reachable) ───────────── */}
      {!showApply && !showWithdraw && (
        <button
          onClick={() => setShowWithdraw(true)}
          className="fixed bottom-4 right-4 z-30 inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-white border border-slate-200 shadow-md text-[11px] font-semibold text-slate-600 hover:text-rose-600 hover:border-rose-200 transition-colors"
          title="Withdraw any previously granted consent"
        >
          <FiUnlock className="w-3.5 h-3.5" />
          Withdraw my consent
        </button>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────── */
/* Job Card                                                             */
/* ──────────────────────────────────────────────────────────────────── */
function JobCard({ job, onApply, isReferred }: { job: PublicJob; onApply: () => void; isReferred?: boolean }) {
  return (
    <div
      className={`group bg-white border rounded-2xl p-5 hover:shadow-lg hover:shadow-slate-200/50 transition-all flex flex-col relative ${
        isReferred
          ? 'border-teal-400 ring-2 ring-teal-200 shadow-md shadow-teal-200/40'
          : 'border-slate-200 hover:border-emerald-300'
      }`}
    >
      {/* REQ-SRC-05 — "Referred for you" badge when the visitor arrived via a referral link to this specific job */}
      {isReferred && (
        <div className="absolute -top-2.5 left-4 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-teal-600 text-white text-[10px] font-bold uppercase tracking-wider shadow-sm">
          <FiHeart className="w-2.5 h-2.5" /> Referred for you
        </div>
      )}
      <div className="flex items-start gap-3 mb-3">
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold text-base flex-shrink-0">
          {job.company?.name?.charAt(0) || 'J'}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-slate-500 truncate">
            {job.company?.name || 'Confidential'}
            {job.tenant && <span className="text-slate-400"> · {job.tenant.name}</span>}
          </p>
          <p className="font-bold text-slate-900 truncate group-hover:text-emerald-600 transition-colors">
            {job.title}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        {job.type && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[11px] font-semibold ring-1 ring-emerald-100">
            <FiClock className="w-3 h-3" /> {JOB_TYPE_LABELS[job.type] || job.type}
          </span>
        )}
        {job.location && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-50 text-slate-600 text-[11px] font-semibold ring-1 ring-slate-100">
            <FiMapPin className="w-3 h-3" /> {job.location}
          </span>
        )}
        {job.experience && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[11px] font-semibold ring-1 ring-emerald-100">
            <FiBriefcase className="w-3 h-3" /> {job.experience}
          </span>
        )}
      </div>

      <p className="text-xs text-slate-600 leading-relaxed line-clamp-2 mb-4 flex-1">
        {job.description.replace(/<[^>]+>/g, '').slice(0, 180)}
        {job.description.length > 180 && '…'}
      </p>

      <div className="flex items-center justify-between pt-3 border-t border-slate-100">
        <div className="text-[11px] text-slate-500 flex items-center gap-3">
          <span className="flex items-center gap-1"><FiClock className="w-3 h-3" /> {formatRelativeTime(job.postedDate)}</span>
          {job.applicants > 0 && (
            <span className="flex items-center gap-1"><FiUsers className="w-3 h-3" /> {job.applicants} applied</span>
          )}
        </div>
        <button
          onClick={onApply}
          className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-white transition-all ${
            isReferred
              ? 'bg-gradient-to-r from-teal-500 to-teal-600 hover:shadow-md hover:shadow-teal-500/30'
              : 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:shadow-md hover:shadow-emerald-500/30'
          }`}
        >
          Apply <FiArrowRight className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────── */
/* Apply Modal                                                          */
/* ──────────────────────────────────────────────────────────────────── */
function ApplyModal({
  job,
  form,
  setForm,
  onClose,
  onSubmit,
  onFileChange,
  submitting,
  onWithdraw,
  parsingResume,
  parseConfidence,
  parsedSkills,
  loggedInCandidateEmail,
  onLogoutCandidate,
}: {
  job: PublicJob;
  form: ApplyFormState;
  setForm: React.Dispatch<React.SetStateAction<ApplyFormState>>;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  submitting: boolean;
  onWithdraw: () => void;
  parsingResume: boolean;
  parseConfidence: number | null;
  parsedSkills: string[];
  loggedInCandidateEmail: string | null;
  onLogoutCandidate: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-0 sm:p-4" onClick={onClose}>
      <div
        className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-2xl max-h-[92vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-emerald-50 to-teal-50 border-b border-slate-100 flex items-start justify-between">
          <div>
            <p className="text-[11px] text-emerald-700 font-semibold uppercase tracking-wider">Apply for</p>
            <h3 className="font-bold text-slate-900">{job.title}</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {job.company?.name}{job.location && ` · ${job.location}`}{job.type && ` · ${JOB_TYPE_LABELS[job.type] || job.type}`}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/60 text-slate-500 hover:text-slate-900">
            <FiX className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={onSubmit} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* REQ-CAND-05: Logged-in candidate banner — warns the user when
              they're applying under an existing candidate-portal session. */}
          {loggedInCandidateEmail && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 px-3 py-2.5 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-[11px] text-emerald-800 min-w-0">
                <FiCheckCircle className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">
                  Signed in as <strong className="font-semibold">{loggedInCandidateEmail}</strong> — applying under this account.
                </span>
              </div>
              <button
                type="button"
                onClick={onLogoutCandidate}
                className="text-[10px] font-semibold text-emerald-700 hover:text-emerald-900 hover:underline whitespace-nowrap"
              >
                Use a different email →
              </button>
            </div>
          )}

          {/* Resume upload FIRST — once uploaded we parse it server-side and
              auto-fill the name/email/phone fields below. */}
          <Field label="Resume *" icon={<FiUpload className="w-3.5 h-3.5" />}>
            <label className="flex items-center gap-3 px-3 py-3 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:border-emerald-300 hover:bg-emerald-50/40 transition-all">
              <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
                <FiUpload className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-700">
                  {form.resumeFileName || 'Click to upload your resume'}
                </p>
                <p className="text-[10px] text-slate-500">PDF, DOC, DOCX, RTF or TXT — max 5 MB</p>
              </div>
              <input
                type="file"
                accept=".pdf,.doc,.docx,.rtf,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/rtf,text/plain"
                onChange={onFileChange}
                className="hidden"
              />
            </label>
            {parsingResume && (
              <div className="flex items-center gap-2 mt-2 text-xs text-emerald-700 font-medium">
                <div className="w-3 h-3 border-2 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
                Parsing your resume & auto-filling details…
              </div>
            )}
            {form.resumeFileName && !parsingResume && (
              <div className="flex items-center gap-1.5 mt-1.5 text-xs text-emerald-700 font-medium">
                <FiCheckCircle className="w-3.5 h-3.5" /> {form.resumeFileName} ready
                {parseConfidence !== null && (
                  <span className="text-slate-500 font-normal ml-1">
                    · parsed with {Math.round(parseConfidence * 100)}% confidence
                  </span>
                )}
              </div>
            )}
            {parsedSkills.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {parsedSkills.slice(0, 12).map((s, i) => (
                  <span key={`${s}-${i}`} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                    {s}
                  </span>
                ))}
                {parsedSkills.length > 12 && (
                  <span className="text-[10px] px-1.5 py-0.5 text-slate-500">+{parsedSkills.length - 12} more</span>
                )}
              </div>
            )}
          </Field>

          {/* Auto-filled candidate details — appear AFTER resume upload,
              but the candidate can still edit them. We surface a small hint
              when they've been auto-filled so the candidate knows to verify. */}
          <div className={`grid grid-cols-1 sm:grid-cols-2 gap-3 ${parsingResume ? 'opacity-60' : ''}`}>
            <Field label="Full Name *" icon={<FiUser className="w-3.5 h-3.5" />}>
              <input
                value={form.candidateName}
                onChange={(e) => setForm({ ...form, candidateName: e.target.value })}
                required
                placeholder="Jane Doe"
                className="form-input"
              />
            </Field>
            <Field label="Email *" icon={<FiMail className="w-3.5 h-3.5" />}>
              <input
                type="email"
                value={form.candidateEmail}
                onChange={(e) => setForm({ ...form, candidateEmail: e.target.value })}
                required
                placeholder="jane@example.com"
                className="form-input"
              />
              {/* Email-mismatch warning — when the candidate is logged in but
                  types a DIFFERENT email in the apply form, we warn them that
                  this will create a separate candidate record. They can either
                  fix the email or sign out to apply as a new person. */}
              {loggedInCandidateEmail &&
                form.candidateEmail.trim() &&
                form.candidateEmail.trim().toLowerCase() !== loggedInCandidateEmail.toLowerCase() &&
                /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.candidateEmail.trim()) && (
                <div className="mt-1.5 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-2 flex items-start gap-2">
                  <FiAlertCircle className="w-3.5 h-3.5 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 text-[11px] text-amber-800 leading-relaxed">
                    <strong>Heads up:</strong> You&apos;re signed in as <strong>{loggedInCandidateEmail}</strong> but applying with <strong>{form.candidateEmail.trim()}</strong>.
                    This application will be saved under the new email and won&apos;t appear in your current portal dashboard.
                    <button
                      type="button"
                      onClick={onLogoutCandidate}
                      className="ml-1 text-amber-900 font-semibold underline hover:text-amber-950"
                    >
                      Sign out &amp; apply as {form.candidateEmail.trim()}
                    </button>
                  </div>
                </div>
              )}
            </Field>
            <Field label="Phone" icon={<FiPhone className="w-3.5 h-3.5" />}>
              <input
                value={form.candidatePhone}
                onChange={(e) => setForm({ ...form, candidatePhone: e.target.value })}
                placeholder="+91 98765 43210"
                className="form-input"
              />
            </Field>
            <Field label="Expected Salary" icon={<FiDollarSign className="w-3.5 h-3.5" />}>
              <input
                value={form.expectedSalary}
                onChange={(e) => setForm({ ...form, expectedSalary: e.target.value })}
                placeholder="₹12 LPA"
                className="form-input"
              />
            </Field>
          </div>

          <Field label="Cover Letter" icon={<FiFileText className="w-3.5 h-3.5" />}>
            <textarea
              value={form.coverLetter}
              onChange={(e) => setForm({ ...form, coverLetter: e.target.value })}
              rows={3}
              placeholder="Tell us why you're a great fit for this role…"
              className="form-input resize-none"
            />
          </Field>

          {/* REQ-SEC-REC-04 — Consent checkboxes (4 required) */}
          <div className="rounded-xl border border-slate-200 p-3 space-y-2.5">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-700 uppercase tracking-wider">
              <FiShield className="w-3.5 h-3.5 text-emerald-500" />
              Your Consents <span className="text-rose-500 normal-case font-normal lowercase">(all 4 required)</span>
            </div>
            <ConsentCheckbox
              checked={form.consentResume}
              onChange={(v) => setForm({ ...form, consentResume: v })}
              label={CONSENT_PURPOSES.resume_processing}
              description="I consent to my resume being parsed and stored to evaluate my fit for this role."
            />
            <ConsentCheckbox
              checked={form.consentBackground}
              onChange={(v) => setForm({ ...form, consentBackground: v })}
              label={CONSENT_PURPOSES.background_check}
              description="I consent to a background / reference check should I advance to the offer stage."
            />
            <ConsentCheckbox
              checked={form.consentAiEvaluation}
              onChange={(v) => setForm({ ...form, consentAiEvaluation: v })}
              label={CONSENT_PURPOSES.ai_evaluation}
              description="I consent to my chat / interview responses being analyzed by an AI evaluation system."
            />
            <ConsentCheckbox
              checked={form.consentVideo}
              onChange={(v) => setForm({ ...form, consentVideo: v })}
              label={CONSENT_PURPOSES.video_recording}
              description="I consent to video recording of my interview responses for review by the hiring team."
            />
          </div>

          {/* REQ-SEC-REC-02 — AI Transparency disclaimer */}
          <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 space-y-2.5">
            <div className="flex items-start gap-2">
              <FiCpu className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-[11px] font-semibold text-amber-800 uppercase tracking-wider">AI Transparency Notice</p>
                <p className="text-xs text-amber-900 mt-1 leading-relaxed">{AI_TRANSPARENCY_TEXT}</p>
              </div>
            </div>
            <ConsentCheckbox
              checked={form.aiTransparencyAck}
              onChange={(v) => setForm({ ...form, aiTransparencyAck: v })}
              label="I have read and understand the AI Transparency notice"
              description="Acknowledges EU AI Act Article 13 disclosure obligations."
              accent="amber"
            />
          </div>

          <div className="px-3 py-2.5 rounded-lg bg-slate-50 text-[11px] text-slate-600 flex items-start gap-2">
            <FiCheckCircle className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />
            <p>
              By submitting, you consent to {job.company?.name || 'the hiring team'} reviewing your
              application and contacting you about this role. Your data is stored securely and never shared externally.
              You may withdraw any consent at any time — see the "Withdraw my consent" link below.
            </p>
          </div>

          {/* Withdraw consent link — REQ-SEC-REC-04 right-to-withdraw */}
          <div className="flex items-center justify-end pt-1">
            <button
              type="button"
              onClick={() => {
                onClose();
                onWithdraw();
              }}
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 hover:text-rose-600 transition-colors"
            >
              <FiUnlock className="w-3.5 h-3.5" />
              I withdraw my consent
            </button>
          </div>
        </form>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200"
          >
            Cancel
          </button>
          <button
            onClick={onSubmit}
            disabled={submitting}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold text-white bg-gradient-to-r from-emerald-500 to-teal-500 hover:shadow-lg hover:shadow-emerald-500/30 disabled:opacity-60 transition-all"
          >
            {submitting ? 'Submitting…' : <>Submit Application <FiArrowRight className="w-4 h-4" /></>}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  icon,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider flex items-center gap-1 mb-1">
        {icon}{label}
      </span>
      {children}
    </label>
  );
}

/* ──────────────────────────────────────────────────────────────────── */
/* Consent Checkbox                                                      */
/* ──────────────────────────────────────────────────────────────────── */
function ConsentCheckbox({
  checked,
  onChange,
  label,
  description,
  accent = 'indigo',
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
  accent?: 'indigo' | 'amber';
}) {
  const accentClass =
    accent === 'amber'
      ? 'border-amber-300 text-amber-600 focus:ring-amber-500'
      : 'border-slate-300 text-emerald-600 focus:ring-emerald-500';
  return (
    <label className="flex items-start gap-2.5 cursor-pointer group">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className={`mt-0.5 w-4 h-4 rounded ${accentClass} focus:ring-2 focus:ring-offset-0`}
      />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-slate-800 group-hover:text-slate-900">{label}</p>
        {description && <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{description}</p>}
      </div>
    </label>
  );
}

/* ──────────────────────────────────────────────────────────────────── */
/* Withdraw Consent Modal (REQ-SEC-REC-04 right-to-withdraw)            */
/* ──────────────────────────────────────────────────────────────────── */
function WithdrawConsentModal({
  defaultEmail,
  defaultTenantId,
  onClose,
}: {
  defaultEmail: string;
  defaultTenantId: string | null;
  onClose: () => void;
}) {
  const [email, setEmail] = useState(defaultEmail || '');
  const [tenantId, setTenantId] = useState<string>(defaultTenantId || '');
  const [consents, setConsents] = useState<ExistingConsent[]>([]);
  const [loading, setLoading] = useState(false);
  const [withdrawing, setWithdrawing] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const fetchConsents = async () => {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('Enter a valid email first');
      return;
    }
    setLoading(true);
    setSearched(true);
    try {
      const params = new URLSearchParams({ candidateEmail: email, includeWithdrawn: 'true' });
      if (tenantId) params.set('tenantId', tenantId);
      const res = await fetch(`/api/ats/consent?${params.toString()}`);
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Failed to load consents');
      }
      const data = await res.json();
      setConsents(data.consents || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load consents');
      setConsents([]);
    } finally {
      setLoading(false);
    }
  };

  const withdrawOne = async (c: ExistingConsent) => {
    setWithdrawing(c.id);
    try {
      const res = await fetch(`/api/ats/consent/${c.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Failed to withdraw consent');
      }
      toast.success(`Consent for ${c.purpose} withdrawn`);
      // Update local state so the UI flips immediately
      setConsents(prev => (prev || []).map(x => x.id === c.id ? { ...x, withdrawnAt: new Date().toISOString() } : x));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to withdraw consent');
    } finally {
      setWithdrawing(null);
    }
  };

  const withdrawAll = async () => {
    const active = (consents || []).filter(c => !c.withdrawnAt);
    if (active.length === 0) {
      toast.success('No active consents to withdraw');
      return;
    }
    setWithdrawing('all');
    try {
      await Promise.allSettled(
        active.map(c =>
          fetch(`/api/ats/consent/${c.id}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
          })
        )
      );
      toast.success(`Withdrew ${active.length} consent${active.length > 1 ? 's' : ''}`);
      setConsents(prev => (prev || []).map(x => ({ ...x, withdrawnAt: x.withdrawnAt || new Date().toISOString() })));
    } finally {
      setWithdrawing(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-0 sm:p-4" onClick={onClose}>
      <div
        className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-2xl max-h-[92vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-rose-50 to-orange-50 border-b border-slate-100 flex items-start justify-between">
          <div>
            <p className="text-[11px] text-rose-700 font-semibold uppercase tracking-wider flex items-center gap-1.5">
              <FiUnlock className="w-3.5 h-3.5" /> REQ-SEC-REC-04 — Right to Withdraw
            </p>
            <h3 className="font-bold text-slate-900 mt-0.5">Withdraw my consent</h3>
            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
              You may withdraw any previously granted consent at any time. Withdrawing consent
              does not automatically delete your application — please contact the hiring team to
              request data deletion (Right to be Forgotten).
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/60 text-slate-500 hover:text-slate-900">
            <FiX className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Your Email *">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jane@example.com"
                className="form-input"
              />
            </Field>
            <Field label="Tenant ID (optional)">
              <input
                value={tenantId}
                onChange={(e) => setTenantId(e.target.value)}
                placeholder="auto-detect from job"
                className="form-input"
              />
            </Field>
          </div>
          <button
            onClick={fetchConsents}
            disabled={loading}
            className="w-full py-2.5 rounded-lg text-sm font-bold text-white bg-gradient-to-r from-rose-500 to-orange-500 hover:shadow-lg hover:shadow-rose-500/30 disabled:opacity-60 transition-all inline-flex items-center justify-center gap-2"
          >
            {loading ? 'Loading...' : <>Find my consents <FiArrowRight className="w-4 h-4" /></>}
          </button>

          {searched && !loading && (
            consents.length === 0 ? (
              <div className="text-center py-6 text-sm text-slate-500">
                <FiShield className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                No consent records found for this email
                {tenantId ? ' in this tenant.' : ' across all tenants.'}
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    {consents.length} consent record{consents.length === 1 ? '' : 's'} found
                  </p>
                  {consents.some(c => !c.withdrawnAt) && (
                    <button
                      onClick={withdrawAll}
                      disabled={withdrawing === 'all'}
                      className="text-[11px] font-semibold text-rose-600 hover:text-rose-700 disabled:opacity-50"
                    >
                      {withdrawing === 'all' ? 'Withdrawing...' : 'Withdraw all active'}
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                  {consents.map((c) => {
                    const isActive = !c.withdrawnAt;
                    return (
                      <div
                        key={c.id}
                        className={`p-3 rounded-lg border flex items-center justify-between ${
                          isActive ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-200 bg-slate-50/50'
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 capitalize">
                            {c.purpose.replace(/_/g, ' ')}
                          </p>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Granted {new Date(c.grantedAt).toLocaleString()}
                            {c.withdrawnAt && ` · Withdrawn ${new Date(c.withdrawnAt).toLocaleString()}`}
                          </p>
                        </div>
                        {isActive && (
                          <button
                            onClick={() => withdrawOne(c)}
                            disabled={withdrawing === c.id || withdrawing === 'all'}
                            className="px-3 py-1.5 rounded-md text-xs font-semibold text-white bg-rose-500 hover:bg-rose-600 disabled:opacity-50 transition-colors flex-shrink-0"
                          >
                            {withdrawing === c.id ? 'Withdrawing...' : 'Withdraw'}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────── */
/* REQ-PORT-04 — schema.org JobPosting JSON-LD generator                 */
/* ──────────────────────────────────────────────────────────────────── */
/**
 * Renders one `<script type="application/ld+json">` tag per job posting,
 * emitting the standard schema.org JobPosting graph so Google's "Google
 * for Jobs" crawler can index the role and surface it in job search.
 *
 * Hardening rules (from the P0 .length crash post-mortem):
 *   - Defensive: every field access uses optional chaining / `|| ''`
 *   - Skip jobs missing required schema fields (title or description)
 *     rather than emitting invalid markup that would fail Google's
 *     Rich Results validator.
 *   - The `jobs` array is normalized with `|| []` at the top.
 *
 * Field mapping notes:
 *   - hiringOrganization.name = the tenant / company brand
 *   - hiringOrganization.sameAs = canonical brand URL (uses tenant slug
 *     if available, else the app origin)
 *   - employmentType: schema.org expects FULL_TIME / PART_TIME /
 *     CONTRACTOR / TEMPORARY / INTERN — our JobPosting.type uses
 *     'full-time' / 'part-time' / 'contract' / 'internship' (kebab-case)
 *   - baseSalary is only emitted when `salary` parses to a finite number
 *   - validThrough is only emitted when `closingDate` is present
 */
function JobPostingJsonLd({ jobs }: { jobs: PublicJob[] }) {
  // Defensive: never trust that jobs is an array — the P0 crash taught us
  // to always default to [] when reading from API-derived state.
  const list: PublicJob[] = Array.isArray(jobs) ? jobs : [];

  // Filter out any rows missing required schema.org fields. We'd rather
  // emit fewer valid scripts than ship invalid ones Google flags.
  const valid = list.filter((j) => j && j.title && j.description);

  if (valid.length === 0) return null;

  const appUrl = typeof window !== 'undefined' ? window.location.origin : 'https://3boxeshrms.com';

  return (
    <>
      {valid.map((job) => {
        // Map our kebab-case type strings to schema.org enum values.
        // Anything unrecognized → 'FULL_TIME' (safe default — unknown
        // employment types would be rejected by Google's validator).
        const employmentTypeMap: Record<string, string> = {
          'full-time': 'FULL_TIME',
          'part-time': 'PART_TIME',
          contract: 'CONTRACTOR',
          contractor: 'CONTRACTOR',
          temporary: 'TEMPORARY',
          internship: 'INTERN',
          intern: 'INTERN',
        };
        const employmentType = employmentTypeMap[job.type] || 'FULL_TIME';

        // Parse salary — our JobPosting.salary is a free-text string
        // (e.g. "₹12 LPA" or "$120,000"). We try to extract the first
        // numeric value as a conservative estimate. If unparseable, we
        // skip baseSalary entirely (Google prefers absent over malformed).
        let baseSalary: Record<string, unknown> | undefined;
        if (job.salary) {
          // Strip everything that isn't a digit, comma, period, or space.
          const cleaned = String(job.salary).replace(/[^0-9.,]/g, '').trim();
          // Take the first comma-or-dot-delimited number.
          const match = cleaned.match(/[\d.,]+/);
          if (match) {
            // Remove thousands separators (commas) and parse.
            const numStr = match[0].replace(/,/g, '');
            const num = parseFloat(numStr);
            if (Number.isFinite(num) && num > 0) {
              // Heuristic: salaries under 1000 are likely in "LPA" form
              // (e.g. "12 LPA" → 12,00,000 INR). Multiply by 100000.
              // Anything ≥ 1000 is treated as an absolute annual number.
              const annualValue = num < 1000 ? num * 100000 : num;
              baseSalary = {
                '@type': 'MonetaryAmount',
                currency: 'INR',
                value: {
                  '@type': 'QuantitativeValue',
                  value: annualValue,
                  unitText: 'YEAR',
                },
              };
            }
          }
        }

        // Determine the organization name + sameAs URL. Prefer tenant
        // info (most accurate), fall back to company, then "Marq AI Tech Pvt Ltd".
        const orgName =
          job.tenant?.name ||
          job.company?.name ||
          'Marq AI Tech Pvt Ltd';
        const orgSameAs =
          job.tenant?.slug
            ? `${appUrl}/careers/${job.tenant.slug}`
            : 'https://3boxeshrms.com';

        const jsonLd = {
          '@context': 'https://schema.org/',
          '@type': 'JobPosting',
          title: job.title,
          description: String(job.description).replace(/<[^>]+>/g, '').slice(0, 5000),
          hiringOrganization: {
            '@type': 'Organization',
            name: orgName,
            sameAs: orgSameAs,
          },
          jobLocation: {
            '@type': 'Place',
            address: {
              '@type': 'PostalAddress',
              addressLocality: job.location || 'Remote',
              addressCountry: job.company?.country || 'IN',
            },
          },
          employmentType,
          datePosted: job.postedDate
            ? new Date(job.postedDate).toISOString()
            : new Date().toISOString(),
          // validThrough is only emitted if closingDate is set — Google
          // will use the absence of validThrough to mean "indefinitely open".
          ...(job.closingDate
            ? { validThrough: new Date(job.closingDate).toISOString() }
            : {}),
          ...(baseSalary ? { baseSalary } : {}),
          // Direct link to the job on the careers page (anchor not implemented
          // per-job, so we link to the openings section).
          url: `${appUrl}/careers#openings`,
          // Bonus fields Google uses for filtering / display:
          directApply: true,
          // experienceRequirements is free-text — Google accepts the same
          // string we show to humans.
          ...(job.experience ? { experienceRequirements: job.experience } : {}),
          // Industry / department as additional context.
          ...(job.department?.name ? { industry: job.department.name } : {}),
        };

        return (
          <script
            key={`jsonld-job-${job.id}`}
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
          />
        );
      })}
    </>
  );
}
