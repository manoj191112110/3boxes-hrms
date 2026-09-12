'use client';

import { useEffect, useState, useCallback, Fragment, useMemo } from 'react';
import Link from 'next/link';
import {
  FiBriefcase,
  FiPlus,
  FiUsers,
  FiMapPin,
  FiCalendar,
  FiX,
  FiStar,
  FiChevronDown,
  FiChevronUp,
  FiEdit2,
  FiTrash2,
  FiFileText,
  FiRefreshCw,
  FiUpload,
  FiActivity,
  FiMail,
  FiPhone,
  FiAward,
  FiBriefcase as FiWork,
  FiShield,
  FiLock,
  FiBarChart2,
  FiExternalLink,
  FiSearch,
  FiFilter,
  FiEye,
  FiCheckCircle,
  FiTarget,
  FiSend,
  FiGrid,
  FiList,
  FiUserCheck,
  FiXCircle,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { validateEmail, validatePhone, phoneInputFilter } from '@/lib/validators';
import { useAuthStore } from '@/store/authStore';
import ModuleTips from '@/components/ModuleTips';
import ModuleWorkflow from '@/components/ModuleWorkflow';
import ModuleIntro from '@/components/ModuleIntro';
import { useCompanyContextStore } from '@/store/companyContextStore';
import {
  maskCandidateFields,
  buildPiiMaskTooltip,
  PiiPolicyEntry,
} from '@/lib/pii-mask';

/* ── Recruitment Tips ── */
const recruitmentTips = [
  {
    title: 'Create Requisitions First',
    description: 'Create job requisitions first, then post them to the Job Portal',
  },
  {
    title: 'Use AI Interview',
    description: 'Use AI Interview to automatically screen candidates with customizable question sets',
  },
  {
    title: 'Track the Hiring Funnel',
    description: 'Track candidates through the hiring funnel: Applied → Screened → Interviewed → Offered → Hired',
  },
  {
    title: 'Source Effectiveness Report',
    description: 'The Source Effectiveness report helps identify which job boards yield the best candidates',
  },
  {
    title: 'Offer Letter Templates',
    description: 'Set up offer letter templates to speed up the hiring process',
  },
];

/* ── Recruitment Workflow Steps ── */
const recruitmentWorkflowSteps = [
  { step: 1, title: 'Create Job Requisition', description: 'Define the role, department, and hiring requirements' },
  { step: 2, title: 'Post Job Opening', description: 'Publish the job listing to attract candidates' },
  { step: 3, title: 'Receive Applications', description: 'Candidates apply through the portal or external sources' },
  { step: 4, title: 'Screen Candidates', description: 'Review applications and shortlist qualified candidates' },
  { step: 5, title: 'Schedule Interviews', description: 'Set up interview rounds with the hiring team' },
  { step: 6, title: 'Make Offer', description: 'Extend an offer letter to the selected candidate' },
  { step: 7, title: 'Hire Candidate', description: 'Candidate accepts and is onboarded into the system' },
  { step: 8, title: 'Update Employee Records', description: 'Create the employee profile from the hired candidate data' },
];

/* ── Types ── */
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
  _count?: { applications: number };
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
  jobPosting?: { id: string; title: string };
  jobPostingId: string;
}

interface ParsedResume {
  name: string;
  email: string;
  phone: string;
  location?: string;
  summary?: string;
  skills: string[];
  education: { institution: string; degree: string; year?: string }[];
  experience: { company: string; role: string; duration: string; description?: string }[];
  certifications: string[];
  languages: string[];
}

interface ResumeParseRow {
  id: string;
  language: string | null;
  parsedData: string;
  confidence: number;
  sourceFormat: string;
  parseError: string | null;
  createdAt: string;
}

interface SentimentRow {
  id: string;
  sentiment: 'positive' | 'neutral' | 'negative' | 'mixed';
  engagementScore: number;
  dropoffRisk: number;
  rationale: string | null;
  source: string;
  createdAt: string;
}

interface Department { id: string; name: string }

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
  };
  const labels: Record<string, string> = { applied: 'Applied', screening: 'Screening', interview: 'Interview', offered: 'Offered', hired: 'Hired', rejected: 'Rejected' };
  return { className: map[status] || 'thb-badge thb-badge-info', label: labels[status] || status };
}

function getSentimentBadge(s: SentimentRow | null | undefined) {
  if (!s) return { className: 'bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full text-[10px] font-semibold', label: 'No sentiment', title: 'No sentiment analysis run yet' };
  const map: Record<string, string> = {
    positive: 'bg-emerald-100 text-emerald-700',
    neutral: 'bg-slate-100 text-slate-600',
    negative: 'bg-red-100 text-red-700',
    mixed: 'bg-amber-100 text-amber-700',
  };
  const label = `${s.sentiment} · ${s.engagementScore}/100`;
  return {
    className: `${map[s.sentiment] || map.neutral} px-2 py-0.5 rounded-full text-[10px] font-semibold`,
    label,
    title: s.rationale || `Engagement ${s.engagementScore}, dropoff risk ${s.dropoffRisk}`,
  };
}

function formatTimestamp(sec: number | null | undefined) {
  if (sec === null || sec === undefined) return '—';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _formatTimestamp = formatTimestamp;

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

function getAvatarGradient(name: string) {
  const gradients = [
    'from-rose-400 to-rose-600',
    'from-emerald-400 to-emerald-600',
    'from-amber-400 to-amber-600',
    'from-sky-400 to-sky-600',
    'from-teal-400 to-teal-600',
    'from-pink-400 to-pink-600',
    'from-teal-400 to-teal-600',
    'from-orange-400 to-orange-600',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return gradients[Math.abs(hash) % gradients.length];
}

/* ── Sample / Demo Data removed — data comes from API only ── */

const initialJobForm = {
  title: '',
  departmentId: '',
  position: '',
  location: '',
  type: 'full-time',
  experience: '',
  salary: '',
  description: '',
  requirements: '',
  vacancies: '1',
  closingDate: '',
};

const initialAppForm = {
  jobPostingId: '',
  candidateName: '',
  candidateEmail: '',
  candidatePhone: '',
  expectedSalary: '',
  source: 'website',
};

/* ── Component ── */
export default function RecruitmentPage() {
  const { user } = useAuthStore();
  const isAdmin = ['super_admin', 'tenant_admin', 'admin'].includes(user?.role || '');
  const scopeQuery = useCompanyContextStore(s => s.scopeQuery);
  const selectedTenantId = useCompanyContextStore(s => s.selectedTenantId);

  const [activeTab, setActiveTab] = useState<'jobs' | 'candidates' | 'analytics'>('jobs');
  const [jobPostings, setJobPostings] = useState<JobPosting[]>([]);
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [departments, setDepartments] = useState<Department[]>([]);

  // Filters
  const [jobSearch, setJobSearch] = useState('');
  const [jobTypeFilter, setJobTypeFilter] = useState('');
  const [jobStatusFilter, setJobStatusFilter] = useState('');
  const [jobDeptFilter, setJobDeptFilter] = useState('');
  const [candidateSearch, setCandidateSearch] = useState('');
  const [candidateStatusFilter, setCandidateStatusFilter] = useState('');
  const [candidateViewMode, setCandidateViewMode] = useState<'list' | 'grid'>('list');

  // Job form state
  const [showJobForm, setShowJobForm] = useState(false);
  const [editingJobId, setEditingJobId] = useState<string | null>(null);
  const [jobForm, setJobForm] = useState(initialJobForm);
  const [submittingJob, setSubmittingJob] = useState(false);

  // Application form state
  const [showAppForm, setShowAppForm] = useState(false);
  const [appForm, setAppForm] = useState(initialAppForm);
  const [submittingApp, setSubmittingApp] = useState(false);

  // Application edit state (inline status change)
  const [editingAppId, setEditingAppId] = useState<string | null>(null);
  const [editAppStatus, setEditAppStatus] = useState('');

  // Delete confirmation
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [expandedJob, setExpandedJob] = useState<string | null>(null);

  /* ─── Job Search Matrix (talent-acquisition candidate shortlisting) ─── */
  const [searchFilters, setSearchFilters] = useState({
    skills: '',
    minExperienceYears: '',
    maxExperienceYears: '',
    minSalary: '',
    maxSalary: '',
    status: '',
    jobPostingId: '',
    q: '',
  });
  const [searchResults, setSearchResults] = useState<{
    candidates: Record<string, unknown>[];
    summary: { totalMatches: number; avgExperienceYears: number; avgExpectedSalaryLpa: number | null; uniqueSkills: string[] };
    filters: Record<string, unknown>;
  } | null>(null);
  const [searching, setSearching] = useState(false);

  const runCandidateSearch = useCallback(async () => {
    setSearching(true);
    try {
      const params = new URLSearchParams();
      if (searchFilters.skills) params.set('skills', searchFilters.skills);
      if (searchFilters.minExperienceYears) params.set('minExperienceYears', searchFilters.minExperienceYears);
      if (searchFilters.maxExperienceYears) params.set('maxExperienceYears', searchFilters.maxExperienceYears);
      if (searchFilters.minSalary) params.set('minSalary', searchFilters.minSalary);
      if (searchFilters.maxSalary) params.set('maxSalary', searchFilters.maxSalary);
      if (searchFilters.status) params.set('status', searchFilters.status);
      if (searchFilters.jobPostingId) params.set('jobPostingId', searchFilters.jobPostingId);
      if (searchFilters.q) params.set('q', searchFilters.q);
      params.set('limit', '100');
      const r = await fetch(`/api/recruitment/candidate-search?${params.toString()}`, { headers: getAuthHeaders() });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Search failed');
      setSearchResults(d);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Search failed');
      setSearchResults(null);
    } finally {
      setSearching(false);
    }
  }, [searchFilters]);

  /* ─── WAVE2-A: PII masking policies (REQ-SEC-REC-03) ─── */
  const [piiPolicies, setPiiPolicies] = useState<PiiPolicyEntry[]>([]);

  const isRecruiterOrAdmin = ['super_admin', 'tenant_admin', 'recruiter', 'recruiter_admin'].includes(user?.role || '');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch('/api/ats/pii-policy', { headers: getAuthHeaders() });
        if (!r.ok) {
          if (!cancelled) setPiiPolicies([]);
          return;
        }
        const d = await r.json();
        if (!cancelled) setPiiPolicies(d.policies || []);
      } catch {
        if (!cancelled) setPiiPolicies([]);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const maskedApplications = useMemo(() => {
    const source = applications;
    if (!source || source.length === 0) return [];
    return source.map(a =>
      maskCandidateFields(
        a as unknown as Record<string, unknown>,
        user?.role,
        piiPolicies,
      ) as unknown as JobApplication & { __piiMaskedFields?: string[] }
    );
  }, [applications, loading, piiPolicies, user?.role]);

  /* ─── WAVE2-C: Resume parser + sentiment state ─── */
  const [expandedAppId, setExpandedAppId] = useState<string | null>(null);
  const [parseByApp, setParseByApp] = useState<Record<string, { parse: ResumeParseRow | null; parsed: ParsedResume | null; loading: boolean }>>({});
  const [sentimentByApp, setSentimentByApp] = useState<Record<string, SentimentRow | null>>({});
  const [parsingAppId, setParsingAppId] = useState<string | null>(null);
  const [runningSentimentAppId, setRunningSentimentAppId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const headers = getAuthHeaders();
      const sq = scopeQuery();
      const [jobsRes] = await Promise.allSettled([
        fetch(`/api/recruitment?limit=50${sq ? `&${sq}` : ''}`, { headers }),
      ]);

      if (jobsRes.status === 'fulfilled' && jobsRes.value.ok) {
        const data = await jobsRes.value.json();
        setJobPostings(data.jobPostings || []);
        const deptMap = new Map<string, Department>();
        (data.jobPostings || []).forEach((j: JobPosting) => {
          if (j.department) deptMap.set(j.department.id, j.department);
        });
        setDepartments(Array.from(deptMap.values()));

        const allApps: JobApplication[] = [];
        (data.jobPostings || []).forEach((j: JobPosting) => {
          if (j.applications) {
            j.applications.forEach(a => allApps.push({ ...a, jobPosting: { id: j.id, title: j.title } }));
          }
        });
        setApplications(allApps);

        Promise.all(
          allApps.slice(0, 30).map(async (a) => {
            try {
              const r = await fetch(`/api/ats/sentiment?jobApplicationId=${a.id}`, { headers });
              if (!r.ok) return [a.id, null] as const;
              const d = await r.json();
              return [a.id, d.sentiment || null] as const;
            } catch {
              return [a.id, null] as const;
            }
          }),
        ).then((entries) => {
          const map: Record<string, SentimentRow | null> = {};
          entries.forEach(([id, s]) => { map[id] = s; });
          setSentimentByApp(map);
        }).catch(() => { /* ignore */ });
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load recruitment data');
    } finally {
      setLoading(false);
    }
  }, [scopeQuery, selectedTenantId]);

  useEffect(() => { queueMicrotask(() => fetchData()); }, [fetchData]);

  /* Also fetch departments from employees API */
  useEffect(() => {
    queueMicrotask(async () => {
      try {
        const sq = scopeQuery();
        const deptRes = await fetch(`/api/employees?limit=500${sq ? `&${sq}` : ''}`, { headers: getAuthHeaders() });
        if (deptRes.ok) {
          const data = await deptRes.json();
          const deptMap = new Map<string, Department>();
          (data.employees || []).forEach((e: { department?: { id: string; name: string } }) => {
            if (e.department) deptMap.set(e.department.id, e.department);
          });
          if (deptMap.size > 0) setDepartments(Array.from(deptMap.values()));
        }
      } catch { /* ignore */ }
    });
  }, [scopeQuery, selectedTenantId]);

  /* Open Job Form - Add */
  const handleOpenAddJobForm = () => {
    setEditingJobId(null);
    setJobForm(initialJobForm);
    setShowJobForm(true);
    setShowAppForm(false);
    setDeleteConfirmId(null);
    setTimeout(() => document.getElementById('crud-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  /* Open Job Form - Edit */
  const handleOpenEditJobForm = (job: JobPosting) => {
    setEditingJobId(job.id);
    setJobForm({
      title: job.title,
      departmentId: job.department?.id || '',
      position: job.position,
      location: job.location || '',
      type: job.type,
      experience: job.experience || '',
      salary: job.salary || '',
      description: job.description,
      requirements: job.requirements || '',
      vacancies: String(job.vacancies),
      closingDate: job.closingDate ? job.closingDate.split('T')[0] : '',
    });
    setShowJobForm(true);
    setShowAppForm(false);
    setDeleteConfirmId(null);
    setTimeout(() => document.getElementById('crud-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  const handleCancelJobForm = () => {
    setShowJobForm(false);
    setEditingJobId(null);
    setJobForm(initialJobForm);
  };

  /* Create / Update Job Posting */
  const handleSaveJob = async () => {
    if (!jobForm.title || !jobForm.departmentId || !jobForm.description) {
      toast.error('Please fill in required fields: title, department, description');
      return;
    }
    try {
      setSubmittingJob(true);
      const payload = { ...jobForm, vacancies: parseInt(jobForm.vacancies) || 1 };

      if (editingJobId) {
        const res = await fetch(`/api/recruitment/${editingJobId}`, {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify(payload),
        });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed'); }
        toast.success('Job posting updated successfully');
      } else {
        const res = await fetch('/api/recruitment', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify(payload),
        });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed'); }
        toast.success('Job posting created successfully');
      }
      handleCancelJobForm();
      fetchData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save job posting');
    } finally {
      setSubmittingJob(false);
    }
  };

  /* Delete Job Posting */
  const handleDeleteJob = async (id: string) => {
    try {
      setDeleting(true);
      const res = await fetch(`/api/recruitment/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed'); }
      toast.success('Job posting deleted successfully');
      setDeleteConfirmId(null);
      fetchData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete job posting');
    } finally {
      setDeleting(false);
    }
  };

  /* Open Application Form */
  const handleOpenApplyForm = (jobId: string) => {
    setAppForm(prev => ({ ...prev, jobPostingId: jobId }));
    setShowAppForm(true);
    setShowJobForm(false);
    setDeleteConfirmId(null);
    setTimeout(() => document.getElementById('crud-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  const handleCancelAppForm = () => {
    setShowAppForm(false);
    setAppForm(initialAppForm);
  };

  /* Submit Application */
  const handleSubmitApp = async () => {
    if (!appForm.candidateName || !appForm.candidateEmail || !appForm.jobPostingId) {
      toast.error('Please fill in required fields');
      return;
    }
    { const r = validateEmail(appForm.candidateEmail); if (!r.valid) { toast.error(r.error); return } }
    if (appForm.candidatePhone) { const r = validatePhone(appForm.candidatePhone); if (!r.valid) { toast.error(r.error); return } }
    try {
      setSubmittingApp(true);
      await fetch('/api/recruitment', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ action: 'apply', ...appForm }),
      });
      toast.success('Application submitted successfully');
      handleCancelAppForm();
      fetchData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to submit application');
    } finally {
      setSubmittingApp(false);
    }
  };

  /* Update Application Status (inline) */
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
      fetchData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update status');
    }
  };

  /* ─────────────────────────────────────────────────────────── */
  /* WAVE2-C: Parsed resume + sentiment actions                  */
  /* ─────────────────────────────────────────────────────────── */

  const fetchParsedResume = useCallback(async (appId: string) => {
    setParseByApp(prev => ({ ...prev, [appId]: { parse: prev[appId]?.parse ?? null, parsed: prev[appId]?.parsed ?? null, loading: true } }));
    try {
      const r = await fetch(`/api/ats/parse-resume?jobApplicationId=${appId}`, { headers: getAuthHeaders() });
      const d = r.ok ? await r.json() : { parse: null, parsedData: null };
      let parsed: ParsedResume | null = null;
      if (d.parsedData && typeof d.parsedData === 'string') {
        try { parsed = JSON.parse(d.parsedData); } catch { parsed = null; }
      } else if (d.parsedData && typeof d.parsedData === 'object') {
        parsed = d.parsedData as ParsedResume;
      }
      setParseByApp(prev => ({ ...prev, [appId]: { parse: d.parse || null, parsed, loading: false } }));
    } catch {
      setParseByApp(prev => ({ ...prev, [appId]: { parse: null, parsed: null, loading: false } }));
    }
  }, []);

  const handleToggleAppExpand = (appId: string) => {
    const next = expandedAppId === appId ? null : appId;
    setExpandedAppId(next);
    if (next && !parseByApp[appId]) {
      fetchParsedResume(appId);
    }
  };

  const handleUploadResume = async (appId: string, file: File) => {
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      if (!dataUrl) { toast.error('Failed to read file'); return; }
      try {
        setParsingAppId(appId);
        const r = await fetch('/api/ats/parse-resume', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ jobApplicationId: appId, resumeDataUrl: dataUrl }),
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d?.error || 'Parse failed');
        toast.success(`Resume parsed (confidence ${Math.round((d.confidence || 0) * 100)}%, ${d.language || 'en'})`);
        await fetchParsedResume(appId);
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Failed to parse resume');
      } finally {
        setParsingAppId(null);
      }
    };
    reader.onerror = () => toast.error('Failed to read file');
    reader.readAsDataURL(file);
  };

  const handleReparse = async (appId: string) => {
    const existing = parseByApp[appId]?.parse;
    if (!existing) {
      toast.error('No prior parse — upload a resume first');
      return;
    }
    const input = document.getElementById(`resume-upload-${appId}`) as HTMLInputElement | null;
    if (input) {
      input.click();
      return;
    }
  };

  const handleRunSentiment = async (appId: string) => {
    try {
      setRunningSentimentAppId(appId);
      const r = await fetch('/api/ats/sentiment', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ jobApplicationId: appId, source: 'chat_screening' }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || 'Sentiment failed');
      setSentimentByApp(prev => ({ ...prev, [appId]: d }));
      toast.success(`Sentiment: ${d.sentiment} (engagement ${d.engagementScore}/100)`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to compute sentiment');
    } finally {
      setRunningSentimentAppId(null);
    }
  };

  /* ─── Computed Stats ─── */
  const displayJobs = useMemo(() => {
    return jobPostings;
  }, [jobPostings]);

  const displayApplications = useMemo(() => {
    return applications;
  }, [applications]);

  const openPositions = displayJobs.filter(j => j.status === 'open').length;
  const totalApplications = displayApplications.length;
  const interviewsScheduled = displayApplications.filter(a => a.status === 'interview').length;
  const offersPending = displayApplications.filter(a => a.status === 'offered').length;
  const shortlisted = displayApplications.filter(a => a.status === 'screening').length;
  const hired = displayApplications.filter(a => a.status === 'hired').length;

  /* ─── Filtered Data ─── */
  const filteredJobs = useMemo(() => {
    return displayJobs.filter(job => {
      if (jobSearch && !job.title.toLowerCase().includes(jobSearch.toLowerCase()) && !job.position.toLowerCase().includes(jobSearch.toLowerCase())) return false;
      if (jobTypeFilter && job.type !== jobTypeFilter) return false;
      if (jobStatusFilter && job.status !== jobStatusFilter) return false;
      if (jobDeptFilter && job.department?.id !== jobDeptFilter) return false;
      return true;
    });
  }, [displayJobs, jobSearch, jobTypeFilter, jobStatusFilter, jobDeptFilter]);

  const filteredCandidates = useMemo(() => {
    return maskedApplications.filter(app => {
      if (candidateSearch) {
        const s = candidateSearch.toLowerCase();
        if (!app.candidateName.toLowerCase().includes(s) && !app.candidateEmail.toLowerCase().includes(s) && !(app.jobPosting?.title || '').toLowerCase().includes(s)) return false;
      }
      if (candidateStatusFilter && app.status !== candidateStatusFilter) return false;
      return true;
    });
  }, [maskedApplications, candidateSearch, candidateStatusFilter]);

  /* ─── Stats Cards ─── */
  const statsCards = [
    { label: 'Open Positions', value: openPositions, icon: FiBriefcase, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
    { label: 'Total Applications', value: totalApplications, icon: FiUsers, color: 'text-sky-600', bg: 'bg-sky-50', border: 'border-sky-200' },
    { label: 'Interviews Scheduled', value: interviewsScheduled, icon: FiCalendar, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
    { label: 'Offers Pending', value: offersPending, icon: FiTarget, color: 'text-teal-600', bg: 'bg-teal-50', border: 'border-teal-200' },
  ];

  const candidateStatsCards = [
    { label: 'Total Candidates', value: totalApplications, icon: FiUsers, color: 'text-sky-600', bg: 'bg-sky-50', border: 'border-sky-200' },
    { label: 'Shortlisted', value: shortlisted, icon: FiFilter, color: 'text-teal-600', bg: 'bg-teal-50', border: 'border-teal-200' },
    { label: 'Interviewed', value: interviewsScheduled, icon: FiCalendar, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
    { label: 'Hired', value: hired, icon: FiCheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-thb-text-primary flex items-center gap-2">
            <FiBriefcase className="w-6 h-6 text-teal-500" />
            Recruitment
          </h1>
          <p className="text-thb-text-secondary mt-1">Manage job postings and applications</p>
          {/* REQ-SEC-REC-03 PII masked indicator */}
          {!isRecruiterOrAdmin ? (
            <span className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-semibold ring-1 ring-emerald-200" title="PII is masked for your role per REQ-SEC-REC-03.">
              <FiShield className="w-3 h-3" /> PII masked for hiring panel
            </span>
          ) : (
            <Link href="/recruitment/pii-policy" className="inline-flex items-center gap-1.5 mt-2 text-[11px] font-semibold text-teal-600 hover:text-teal-700">
              <FiLock className="w-3 h-3" /> Configure PII masking policy
            </Link>
          )}
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <Link
              href="/recruitment/analytics"
              className="inline-flex items-center gap-2 px-3 py-2.5 border border-teal-200 text-teal-700 rounded-lg hover:bg-teal-50 font-medium text-sm transition-colors"
              title="Recruitment Analytics: Cost per Hire, Time to Fill, source effectiveness"
            >
              <FiBarChart2 className="w-4 h-4" />
              <span className="hidden sm:inline">Analytics</span>
            </Link>
            <Link
              href="/recruitment/job-boards"
              className="inline-flex items-center gap-2 px-3 py-2.5 border border-sky-200 text-sky-700 rounded-lg hover:bg-sky-50 font-medium text-sm transition-colors"
              title="Manage all external job board postings"
            >
              <FiExternalLink className="w-4 h-4" />
              <span className="hidden sm:inline">Job Boards</span>
            </Link>
            <button onClick={handleOpenAddJobForm} className="inline-flex items-center gap-2 px-4 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-medium text-sm shadow-sm shadow-teal-500/25 transition-colors">
              <FiPlus className="w-4 h-4" />
              Create Job
            </button>
          </div>
        )}
      </div>

      {/* Module Intro */}
      <ModuleIntro
        title="Recruitment & ATS"
        subtitle="Requisitions → Job postings → Applications → Interviews → Offers → Onboarding"
        srsRef="REQ-ATS-01..12 · REQ-SEC-REC-01..03"
        icon={<FiBriefcase className="w-4 h-4" />}
        accent="violet"
        quickStats={
          <>
            <span><b className="text-slate-700">{displayJobs.length}</b> jobs</span>
            <span><b className="text-teal-600">{displayJobs.reduce((n, j) => n + (j._count?.applications || 0), 0)}</b> applications</span>
          </>
        }
      >
        <p>
          The Recruitment module is a full Applicant Tracking System (ATS) covering the end-to-end hiring
          funnel — from raising a job requisition with department / hiring manager approval, posting the
          job internally and externally, receiving applications, screening, scheduling interviews (manual
          and AI-proctored), rolling out offers, and converting accepted candidates into employees.
        </p>
        <p>
          PII is masked for hiring panel members per REQ-SEC-REC-03 by default; only authorized recruiters
          and HR admins see full candidate contact details. All candidate activity — applications, interview
          feedback, sentiment scores, AI interview sessions, and offer history — is consolidated into a
          single candidate timeline that recruiters can audit at any time.
        </p>
        <p>
          The Candidate Portal (separate login) lets external candidates self-serve: dashboard with their
          application status, upcoming interviews, resume insights, skill matrix, AI suggestions, and
          recommended learning courses for skills they&apos;re missing for the jobs they applied to.
        </p>
      </ModuleIntro>

      {/* Module Tips */}
      <ModuleTips
        moduleKey="recruitment"
        title="Recruitment Tips"
        tips={recruitmentTips}
        userRole={user?.role}
      />

      <ModuleWorkflow
        moduleKey="recruitment"
        title="How to Hire Through Recruitment"
        subtitle="Follow this workflow to manage the full hiring process"
        steps={recruitmentWorkflowSteps}
        accentColor="violet"
        userRole={user?.role}
      />

      {/* Embedded Job Posting Form (Add/Edit) */}
      {showJobForm && (
        <div id="crud-form" className="thb-card border-l-4 border-l-teal-500 transition-all duration-300 ease-in-out">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-thb-text-primary">
                {editingJobId ? 'Edit Job Posting' : 'Post New Job'}
              </h2>
              <button onClick={handleCancelJobForm} className="p-2 rounded-lg text-thb-text-muted hover:text-thb-text-primary hover:bg-slate-100 transition-colors">
                <FiX className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Job Title <span className="text-red-500 font-bold">*</span></label>
                  <input type="text" value={jobForm.title} onChange={e => setJobForm(p => ({ ...p, title: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Department <span className="text-red-500 font-bold">*</span></label>
                  <select value={jobForm.departmentId} onChange={e => setJobForm(p => ({ ...p, departmentId: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400">
                    <option value="">Select Department</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Position</label>
                  <input type="text" value={jobForm.position} onChange={e => setJobForm(p => ({ ...p, position: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Location</label>
                  <input type="text" value={jobForm.location} onChange={e => setJobForm(p => ({ ...p, location: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Type</label>
                  <select value={jobForm.type} onChange={e => setJobForm(p => ({ ...p, type: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400">
                    <option value="full-time">Full-time</option>
                    <option value="part-time">Part-time</option>
                    <option value="contract">Contract</option>
                    <option value="internship">Internship</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Experience</label>
                  <input type="text" value={jobForm.experience} onChange={e => setJobForm(p => ({ ...p, experience: e.target.value }))} placeholder="e.g., 3-5 years" className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Salary Range</label>
                  <input type="text" value={jobForm.salary} onChange={e => setJobForm(p => ({ ...p, salary: e.target.value }))} placeholder="e.g., $80K - $120K" className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Vacancies</label>
                  <input type="number" min="1" value={jobForm.vacancies} onChange={e => setJobForm(p => ({ ...p, vacancies: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Closing Date</label>
                  <input type="date" value={jobForm.closingDate} onChange={e => setJobForm(p => ({ ...p, closingDate: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Description <span className="text-red-500 font-bold">*</span></label>
                <textarea rows={4} value={jobForm.description} onChange={e => setJobForm(p => ({ ...p, description: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 resize-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Requirements</label>
                <textarea rows={3} value={jobForm.requirements} onChange={e => setJobForm(p => ({ ...p, requirements: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 resize-none" />
              </div>
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-thb-border">
                <button onClick={handleCancelJobForm} className="px-4 py-2.5 rounded-lg border border-thb-border text-sm font-medium text-thb-text-secondary hover:bg-slate-50 transition-colors">Cancel</button>
                <button onClick={handleSaveJob} disabled={submittingJob} className="px-6 py-2.5 rounded-lg bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 disabled:opacity-50 shadow-sm shadow-teal-500/25 transition-colors">
                  {submittingJob ? 'Saving...' : editingJobId ? 'Update Job' : 'Post Job'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Embedded Application Form */}
      {showAppForm && (
        <div id="crud-form" className="thb-card border-l-4 border-l-sky-500 transition-all duration-300 ease-in-out">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-thb-text-primary">Submit Application</h2>
              <button onClick={handleCancelAppForm} className="p-2 rounded-lg text-thb-text-muted hover:text-thb-text-primary hover:bg-slate-100 transition-colors">
                <FiX className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              {appForm.jobPostingId && (
                <div className="p-3 rounded-lg bg-sky-50 border border-sky-100">
                  <p className="text-sm text-sky-700 font-medium">
                    <FiBriefcase className="w-4 h-4 inline mr-1" />
                    Applying for: {displayJobs.find(j => j.id === appForm.jobPostingId)?.title || 'Selected Job'}
                  </p>
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Job Posting <span className="text-red-500 font-bold">*</span></label>
                <select value={appForm.jobPostingId} onChange={e => setAppForm(p => ({ ...p, jobPostingId: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400">
                  <option value="">Select Job</option>
                  {displayJobs.filter(j => j.status === 'open').map(j => <option key={j.id} value={j.id}>{j.title}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Candidate Name <span className="text-red-500 font-bold">*</span></label>
                  <input type="text" value={appForm.candidateName} onChange={e => setAppForm(p => ({ ...p, candidateName: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Email <span className="text-red-500 font-bold">*</span></label>
                  <input type="email" placeholder="e.g., name@domain.com" value={appForm.candidateEmail} onChange={e => setAppForm(p => ({ ...p, candidateEmail: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Phone</label>
                  <input type="tel" placeholder="10-digit Indian mobile" value={appForm.candidatePhone} onChange={e => setAppForm(p => ({ ...p, candidatePhone: phoneInputFilter(e.target.value) }))} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Expected Salary</label>
                  <input type="text" value={appForm.expectedSalary} onChange={e => setAppForm(p => ({ ...p, expectedSalary: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Source</label>
                <select value={appForm.source} onChange={e => setAppForm(p => ({ ...p, source: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400">
                  <option value="website">Website</option>
                  <option value="referral">Referral</option>
                  <option value="linkedin">LinkedIn</option>
                  <option value="indeed">Indeed</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-thb-border">
                <button onClick={handleCancelAppForm} className="px-4 py-2.5 rounded-lg border border-thb-border text-sm font-medium text-thb-text-secondary hover:bg-slate-50 transition-colors">Cancel</button>
                <button onClick={handleSubmitApp} disabled={submittingApp} className="px-6 py-2.5 rounded-lg bg-sky-600 text-white text-sm font-medium hover:bg-sky-700 disabled:opacity-50 shadow-sm shadow-sky-500/25 transition-colors">
                  {submittingApp ? 'Submitting...' : 'Submit Application'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {(activeTab === 'jobs' ? statsCards : activeTab === 'candidates' ? candidateStatsCards : statsCards).map((card) => (
          <div key={card.label} className="thb-card p-5 border border-thb-border hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-thb-text-muted uppercase tracking-wider">{card.label}</p>
                <p className={`text-2xl font-bold mt-1 ${card.color}`}>{card.value}</p>
              </div>
              <div className={`p-3 rounded-xl ${card.bg} border ${card.border}`}>
                <card.icon className={`w-5 h-5 ${card.color}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Tab Navigation */}
      <div className="thb-card p-1.5">
        <div className="flex gap-1">
          {[
            { key: 'jobs' as const, label: 'Jobs', icon: FiBriefcase },
            { key: 'candidates' as const, label: 'Candidates', icon: FiUsers },
            { key: 'analytics' as const, label: 'Analytics', icon: FiBarChart2 },
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
            </button>
          ))}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* JOBS TAB                                                    */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {activeTab === 'jobs' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="thb-card p-4">
            <div className="flex flex-col lg:flex-row lg:items-center gap-3">
              <div className="relative flex-1 min-w-0">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-thb-text-muted" />
                <input
                  type="text"
                  placeholder="Search jobs by title or position..."
                  value={jobSearch}
                  onChange={e => setJobSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={jobTypeFilter}
                  onChange={e => setJobTypeFilter(e.target.value)}
                  className="px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 bg-white min-w-[130px]"
                >
                  <option value="">All Types</option>
                  <option value="full-time">Full-time</option>
                  <option value="part-time">Part-time</option>
                  <option value="contract">Contract</option>
                  <option value="internship">Internship</option>
                </select>
                <select
                  value={jobStatusFilter}
                  onChange={e => setJobStatusFilter(e.target.value)}
                  className="px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 bg-white min-w-[130px]"
                >
                  <option value="">All Status</option>
                  <option value="open">Open</option>
                  <option value="closed">Closed</option>
                  <option value="on_hold">On Hold</option>
                  <option value="filled">Filled</option>
                </select>
                <select
                  value={jobDeptFilter}
                  onChange={e => setJobDeptFilter(e.target.value)}
                  className="px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 bg-white min-w-[150px]"
                >
                  <option value="">All Departments</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                {(jobSearch || jobTypeFilter || jobStatusFilter || jobDeptFilter) && (
                  <button
                    onClick={() => { setJobSearch(''); setJobTypeFilter(''); setJobStatusFilter(''); setJobDeptFilter(''); }}
                    className="px-3 py-2.5 rounded-lg border border-thb-border text-xs font-medium text-thb-text-secondary hover:bg-slate-50 transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Jobs Table */}
          <div className="thb-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-thb-border bg-slate-50/80">
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Job Title</th>
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Job Type</th>
                    <th className="text-center px-5 py-3.5 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Vacancies</th>
                    <th className="text-center px-5 py-3.5 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Applications</th>
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Posted Date</th>
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Status</th>
                    <th className="text-right px-5 py-3.5 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <tr key={i} className="border-b border-thb-border/50 animate-pulse">
                        <td className="px-5 py-4"><div className="h-4 w-40 bg-slate-200 rounded" /></td>
                        <td className="px-5 py-4"><div className="h-5 w-16 bg-slate-200 rounded-full" /></td>
                        <td className="px-5 py-4"><div className="h-4 w-8 bg-slate-200 rounded mx-auto" /></td>
                        <td className="px-5 py-4"><div className="h-4 w-8 bg-slate-200 rounded mx-auto" /></td>
                        <td className="px-5 py-4"><div className="h-4 w-24 bg-slate-200 rounded" /></td>
                        <td className="px-5 py-4"><div className="h-5 w-14 bg-slate-200 rounded-full" /></td>
                        <td className="px-5 py-4"><div className="h-4 w-20 bg-slate-200 rounded ml-auto" /></td>
                      </tr>
                    ))
                  ) : filteredJobs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-16 text-center">
                        <FiBriefcase className="w-12 h-12 text-thb-text-muted mx-auto mb-3" />
                        <p className="text-thb-text-secondary font-medium">{displayJobs.length === 0 ? 'No job postings yet' : 'No jobs match your filters'}</p>
                        <p className="text-sm text-thb-text-muted mt-1">{displayJobs.length === 0 ? 'Create your first job posting to start hiring' : 'Try adjusting your search or filter criteria'}</p>
                      </td>
                    </tr>
                  ) : (
                    filteredJobs.map(job => {
                      const badge = getJobStatusBadge(job.status);
                      const typeBadge = getJobTypeBadge(job.type);
                      const isDeleting = deleteConfirmId === job.id;
                      const isExpanded = expandedJob === job.id;
                      return (
                        <Fragment key={job.id}>
                          {isDeleting ? (
                            <tr className="bg-red-50/80">
                              <td colSpan={7} className="px-5 py-4">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
                                      <FiTrash2 className="w-4 h-4 text-red-500" />
                                    </div>
                                    <span className="text-sm text-red-700 font-medium">Delete &quot;{job.title}&quot;? This action cannot be undone.</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <button onClick={() => handleDeleteJob(job.id)} disabled={deleting} className="px-3 py-1.5 bg-red-500 text-white text-xs font-medium rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors">
                                      {deleting ? 'Deleting...' : 'Confirm Delete'}
                                    </button>
                                    <button onClick={() => setDeleteConfirmId(null)} className="px-3 py-1.5 border border-thb-border text-xs font-medium rounded-lg hover:bg-slate-50 transition-colors">
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          ) : (
                            <>
                              <tr className={`border-b border-thb-border/50 hover:bg-slate-50/50 transition-colors ${isExpanded ? 'bg-teal-50/30' : ''}`}>
                                <td className="px-5 py-4">
                                  <div className="min-w-0">
                                    <p className="text-sm font-semibold text-thb-text-primary">{job.title}</p>
                                    <div className="flex items-center gap-2 mt-1">
                                      {job.department && (
                                        <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                                          <FiUsers className="w-2.5 h-2.5" />{job.department.name}
                                        </span>
                                      )}
                                      {job.location && (
                                        <span className="text-[11px] text-thb-text-muted flex items-center gap-0.5">
                                          <FiMapPin className="w-2.5 h-2.5" />{job.location}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </td>
                                <td className="px-5 py-4">
                                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${typeBadge.className}`}>
                                    {typeBadge.label}
                                  </span>
                                </td>
                                <td className="px-5 py-4 text-center">
                                  <span className="text-sm font-semibold text-thb-text-primary">{job.vacancies}</span>
                                </td>
                                <td className="px-5 py-4 text-center">
                                  <span className="text-sm font-semibold text-teal-600">{job._count?.applications || job.applications?.length || 0}</span>
                                </td>
                                <td className="px-5 py-4">
                                  <span className="text-sm text-thb-text-secondary">{formatDate(job.postedDate)}</span>
                                </td>
                                <td className="px-5 py-4">
                                  <span className={badge.className}>{badge.label}</span>
                                </td>
                                <td className="px-5 py-4">
                                  <div className="flex items-center justify-end gap-1">
                                    <Link
                                      href={`/recruitment/${job.id}`}
                                      className="p-2 rounded-lg text-thb-text-muted hover:text-teal-600 hover:bg-teal-50 transition-colors"
                                      title="View Detail"
                                    >
                                      <FiEye className="w-4 h-4" />
                                    </Link>
                                    <button onClick={() => handleOpenApplyForm(job.id)} className="p-2 rounded-lg text-thb-text-muted hover:text-sky-600 hover:bg-sky-50 transition-colors" title="Apply">
                                      <FiSend className="w-4 h-4" />
                                    </button>
                                    {isAdmin && (
                                      <>
                                        <button onClick={() => handleOpenEditJobForm(job)} className="p-2 rounded-lg text-thb-text-muted hover:text-amber-600 hover:bg-amber-50 transition-colors" title="Edit">
                                          <FiEdit2 className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => setDeleteConfirmId(job.id)} className="p-2 rounded-lg text-thb-text-muted hover:text-red-600 hover:bg-red-50 transition-colors" title="Delete">
                                          <FiTrash2 className="w-4 h-4" />
                                        </button>
                                      </>
                                    )}
                                    <button onClick={() => setExpandedJob(isExpanded ? null : job.id)} className={`p-2 rounded-lg transition-colors ${isExpanded ? 'text-teal-600 bg-teal-50' : 'text-thb-text-muted hover:bg-slate-100'}`}>
                                      {isExpanded ? <FiChevronUp className="w-4 h-4" /> : <FiChevronDown className="w-4 h-4" />}
                                    </button>
                                  </div>
                                </td>
                              </tr>
                              {/* Expanded Content */}
                              {isExpanded && (
                                <tr className="bg-slate-50/50">
                                  <td colSpan={7} className="px-5 py-5">
                                    <div className="space-y-4">
                                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                        <div>
                                          <h4 className="text-sm font-semibold text-thb-text-primary mb-2">Description</h4>
                                          <p className="text-sm text-thb-text-secondary whitespace-pre-wrap">{job.description}</p>
                                        </div>
                                        <div className="space-y-3">
                                          {job.requirements && (
                                            <div>
                                              <h4 className="text-sm font-semibold text-thb-text-primary mb-2">Requirements</h4>
                                              <p className="text-sm text-thb-text-secondary whitespace-pre-wrap">{job.requirements}</p>
                                            </div>
                                          )}
                                          {(job.experience || job.salary) && (
                                            <div className="flex gap-4">
                                              {job.experience && <span className="text-sm text-thb-text-secondary">Experience: <strong>{job.experience}</strong></span>}
                                              {job.salary && <span className="text-sm text-thb-text-secondary">Salary: <strong>{job.salary}</strong></span>}
                                            </div>
                                          )}
                                          {job.closingDate && (
                                            <span className="text-sm text-thb-text-secondary flex items-center gap-1">
                                              <FiCalendar className="w-3.5 h-3.5" />Closes {formatDate(job.closingDate)}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                      {/* Applications for this job */}
                                      {job.applications && job.applications.length > 0 && (
                                        <div>
                                          <div className="flex items-center justify-between mb-2">
                                            <h4 className="text-sm font-semibold text-thb-text-primary">Applications ({job.applications.length})</h4>
                                            {!isRecruiterOrAdmin && (
                                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-semibold ring-1 ring-emerald-200" title="PII is masked for your role per REQ-SEC-REC-03.">
                                                <FiShield className="w-2.5 h-2.5" /> PII masked
                                              </span>
                                            )}
                                          </div>
                                          <div className="space-y-2 max-h-64 overflow-y-auto">
                                            {job.applications.map(rawApp => {
                                              const app = maskCandidateFields(
                                                rawApp as unknown as Record<string, unknown>,
                                                user?.role,
                                                piiPolicies,
                                              ) as unknown as JobApplication & { __piiMaskedFields?: string[] };
                                              const appBadge = getAppStatusBadge(app.status);
                                              const isEditing = editingAppId === app.id;
                                              const maskedFields = app.__piiMaskedFields || [];
                                              return (
                                                <div key={app.id} className={`flex items-center justify-between p-3 bg-white rounded-lg border transition-colors ${isEditing ? 'border-teal-300 bg-teal-50/50' : 'border-thb-border'}`}>
                                                  <div className="min-w-0">
                                                    <div className="flex items-center gap-1.5">
                                                      <p className="text-sm font-medium text-thb-text-primary">{app.candidateName}</p>
                                                      {maskedFields.length > 0 && (
                                                        <span
                                                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-semibold ring-1 ring-emerald-200"
                                                          title={buildPiiMaskTooltip(maskedFields)}
                                                        >
                                                          <FiShield className="w-2.5 h-2.5" /> PII masked
                                                        </span>
                                                      )}
                                                    </div>
                                                    <p className="text-xs text-thb-text-muted">{app.candidateEmail} · Applied {formatDate(app.appliedDate)}</p>
                                                  </div>
                                                  {isEditing ? (
                                                    <div className="flex items-center gap-2">
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
                                                      <button onClick={() => handleSaveAppStatus(app.id)} className="px-2.5 py-1 bg-teal-600 text-white text-xs font-medium rounded hover:bg-teal-700 transition-colors">
                                                        Save
                                                      </button>
                                                      <button onClick={handleCancelAppEdit} className="px-2.5 py-1 border border-thb-border text-xs font-medium rounded hover:bg-slate-50 transition-colors">
                                                        Cancel
                                                      </button>
                                                    </div>
                                                  ) : (
                                                    <div className="flex items-center gap-2">
                                                      <span className={appBadge.className}>{appBadge.label}</span>
                                                      {isAdmin && (
                                                        <button onClick={() => handleOpenAppEdit(app)} className="p-1 rounded text-thb-text-muted hover:text-amber-500 hover:bg-amber-50 transition-colors" title="Edit Status">
                                                          <FiEdit2 className="w-3.5 h-3.5" />
                                                        </button>
                                                      )}
                                                    </div>
                                                  )}
                                                </div>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </>
                          )}
                        </Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* CANDIDATES TAB                                              */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {activeTab === 'candidates' && (
        <div className="space-y-4">
          {/* Candidate Filter Bar */}
          <div className="thb-card p-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="relative flex-1 min-w-0">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-thb-text-muted" />
                <input
                  type="text"
                  placeholder="Search candidates by name, email, or role..."
                  value={candidateSearch}
                  onChange={e => setCandidateSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400"
                />
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={candidateStatusFilter}
                  onChange={e => setCandidateStatusFilter(e.target.value)}
                  className="px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 bg-white min-w-[140px]"
                >
                  <option value="">All Status</option>
                  <option value="applied">Applied</option>
                  <option value="screening">Screening</option>
                  <option value="interview">Interview</option>
                  <option value="offered">Offered</option>
                  <option value="hired">Hired</option>
                  <option value="rejected">Rejected</option>
                </select>
                {candidateStatusFilter && (
                  <button
                    onClick={() => { setCandidateSearch(''); setCandidateStatusFilter(''); }}
                    className="px-3 py-2.5 rounded-lg border border-thb-border text-xs font-medium text-thb-text-secondary hover:bg-slate-50 transition-colors"
                  >
                    Clear
                  </button>
                )}
                {/* View Toggle */}
                <div className="flex items-center gap-1 ml-1 border-l border-thb-border pl-2">
                  <button
                    onClick={() => setCandidateViewMode('list')}
                    className={`p-2 rounded-lg transition-colors ${candidateViewMode === 'list' ? 'bg-teal-500 text-white shadow-sm' : 'bg-white text-thb-text-secondary hover:bg-slate-50 border border-thb-border'}`}
                    title="List View"
                  >
                    <FiList className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setCandidateViewMode('grid')}
                    className={`p-2 rounded-lg transition-colors ${candidateViewMode === 'grid' ? 'bg-teal-500 text-white shadow-sm' : 'bg-white text-thb-text-secondary hover:bg-slate-50 border border-thb-border'}`}
                    title="Grid View"
                  >
                    <FiGrid className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Candidates Table / Grid */}
          {candidateViewMode === 'list' ? (
          <div className="thb-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-thb-border bg-slate-50/80">
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Cand ID</th>
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Candidate</th>
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Applied Role</th>
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Applied Date</th>
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Sentiment</th>
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Status</th>
                    <th className="text-right px-5 py-3.5 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} className="border-b border-thb-border/50 animate-pulse">
                        <td className="px-5 py-3"><div className="h-3 w-16 bg-slate-200 rounded" /></td>
                        <td className="px-5 py-3"><div className="h-3 w-32 bg-slate-200 rounded" /></td>
                        <td className="px-5 py-3"><div className="h-3 w-28 bg-slate-200 rounded" /></td>
                        <td className="px-5 py-3"><div className="h-3 w-20 bg-slate-200 rounded" /></td>
                        <td className="px-5 py-3"><div className="h-5 w-20 bg-slate-200 rounded-full" /></td>
                        <td className="px-5 py-3"><div className="h-5 w-16 bg-slate-200 rounded-full" /></td>
                        <td className="px-5 py-3"><div className="h-3 w-12 bg-slate-200 rounded ml-auto" /></td>
                      </tr>
                    ))
                  ) : filteredCandidates.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-16 text-center">
                        <FiUsers className="w-12 h-12 text-thb-text-muted mx-auto mb-3" />
                        <p className="text-thb-text-secondary font-medium">No candidates found</p>
                        <p className="text-sm text-thb-text-muted mt-1">{displayApplications.length === 0 ? 'Applications will appear here once candidates apply' : 'Try adjusting your search or filter'}</p>
                      </td>
                    </tr>
                  ) : (
                    filteredCandidates.map(app => {
                      const badge = getAppStatusBadge(app.status);
                      const isEditing = editingAppId === app.id;
                      const isAppExpanded = expandedAppId === app.id;
                      const sentiment = sentimentByApp[app.id];
                      const parseState = parseByApp[app.id];
                      const sentimentBadge = getSentimentBadge(sentiment);
                      const maskedFields = app.__piiMaskedFields || [];
                      const piiTooltip = buildPiiMaskTooltip(maskedFields);
                      const initials = getInitials(app.candidateName);
                      const avatarColor = getAvatarColor(app.candidateName);
                      const candId = `CAN-${app.id.slice(0, 6).toUpperCase()}`;
                      return (
                        <Fragment key={app.id}>
                          <tr className={`border-b border-thb-border/50 transition-colors ${isEditing ? 'bg-teal-50/50' : 'hover:bg-slate-50/50'}`}>
                            <td className="px-5 py-3">
                              <span className="text-xs font-mono text-thb-text-muted">{candId}</span>
                            </td>
                            <td className="px-5 py-3">
                              <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${avatarColor}`}>
                                  {initials}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <p className="text-sm font-medium text-thb-text-primary truncate">{app.candidateName}</p>
                                    {maskedFields.length > 0 && (
                                      <span
                                        className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[9px] font-semibold ring-1 ring-emerald-200 flex-shrink-0"
                                        title={piiTooltip}
                                      >
                                        <FiShield className="w-2 h-2" />
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-thb-text-muted truncate">{app.candidateEmail}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-5 py-3 text-sm text-thb-text-secondary truncate max-w-[200px]">{app.jobPosting?.title || '—'}</td>
                            <td className="px-5 py-3 text-sm text-thb-text-secondary">{formatDate(app.appliedDate)}</td>
                            <td className="px-5 py-3">
                              <div className="flex items-center gap-1">
                                <span className={sentimentBadge.className} title={sentimentBadge.title}>{sentimentBadge.label}</span>
                                {isAdmin && (
                                  <button
                                    onClick={() => handleRunSentiment(app.id)}
                                    disabled={runningSentimentAppId === app.id}
                                    className="p-1 rounded text-thb-text-muted hover:text-teal-600 hover:bg-teal-50 transition-colors disabled:opacity-50"
                                    title="Run sentiment analysis"
                                  >
                                    {runningSentimentAppId === app.id ? <FiRefreshCw className="w-3 h-3 animate-spin" /> : <FiActivity className="w-3 h-3" />}
                                  </button>
                                )}
                              </div>
                            </td>
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
                                <span className={badge.className}>{badge.label}</span>
                              )}
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
                                  <button onClick={() => handleToggleAppExpand(app.id)} className={`p-2 rounded-lg border transition-colors ${isAppExpanded ? 'bg-teal-50 text-teal-600 border-teal-200' : 'text-thb-text-secondary border-thb-border hover:bg-slate-50'}`} title="View parsed resume">
                                    {isAppExpanded ? <FiChevronUp className="w-4 h-4" /> : <FiChevronDown className="w-4 h-4" />}
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                          {isAppExpanded && (
                            <tr className="bg-slate-50/40">
                              <td colSpan={7} className="px-6 py-5">
                                <ParsedResumePanel
                                  appId={app.id}
                                  state={parseState}
                                  parsing={parsingAppId === app.id}
                                  onUpload={handleUploadResume}
                                  onReparse={handleReparse}
                                />
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
          ) : (
          /* ── Candidate Grid View ── */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredCandidates.length === 0 ? (
              <div className="col-span-full text-center py-16">
                <div className="flex flex-col items-center">
                  <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
                    <FiUsers className="w-8 h-8 text-thb-text-muted" />
                  </div>
                  <p className="text-thb-text-secondary font-medium">No candidates found</p>
                  <p className="text-sm text-thb-text-muted mt-1">Try adjusting your search or filters</p>
                </div>
              </div>
            ) : (
              filteredCandidates.map(app => {
                const badge = getAppStatusBadge(app.status);
                const initials = getInitials(app.candidateName);
                const avatarGradient = getAvatarGradient(app.candidateName);
                const rating = app.rating ?? 0;
                const isDemo = app.id.startsWith('demo-');
                return (
                  <div key={app.id} className="thb-card overflow-hidden group transition-all duration-200 hover:shadow-lg">
                    {/* Card Header with Avatar */}
                    <div className="p-5 pb-3">
                      <div className="flex items-start gap-3.5">
                        <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${avatarGradient} flex items-center justify-center text-white text-sm font-bold flex-shrink-0 shadow-sm`}>
                          {initials}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-semibold text-thb-text-primary text-sm truncate">{app.candidateName}</h3>
                          <p className="text-xs text-thb-text-secondary truncate mt-0.5">{app.jobPosting?.title || '—'}</p>
                        </div>
                      </div>
                    </div>

                    {/* Card Details */}
                    <div className="px-5 pb-3 space-y-2">
                      {/* Rating Stars */}
                      <div className="flex items-center gap-1">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <FiStar key={i} className={`w-3.5 h-3.5 ${i < rating ? 'text-amber-400 fill-amber-400' : 'text-slate-200'}`} />
                        ))}
                        {rating === 0 && <span className="text-[10px] text-thb-text-muted ml-1">Not rated</span>}
                      </div>
                      {/* Email */}
                      <div className="flex items-center gap-2 text-xs text-thb-text-secondary">
                        <FiMail className="w-3.5 h-3.5 text-thb-text-muted flex-shrink-0" />
                        <span className="truncate">{app.candidateEmail}</span>
                      </div>
                      {/* Salary */}
                      {app.expectedSalary && (
                        <div className="flex items-center gap-2 text-xs text-thb-text-secondary">
                          <FiAward className="w-3.5 h-3.5 text-thb-text-muted flex-shrink-0" />
                          <span>{app.expectedSalary}</span>
                        </div>
                      )}
                      {/* Applied Date */}
                      <div className="flex items-center gap-2 text-xs text-thb-text-secondary">
                        <FiCalendar className="w-3.5 h-3.5 text-thb-text-muted flex-shrink-0" />
                        <span>{formatDate(app.appliedDate)}</span>
                      </div>
                    </div>

                    {/* Card Footer */}
                    <div className="px-5 py-3 border-t border-thb-border bg-slate-50/50 flex items-center justify-between">
                      <span className={badge.className}>{badge.label}</span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => { if (!isDemo) handleToggleAppExpand(app.id); }}
                          className="p-1.5 rounded-lg text-thb-text-muted hover:text-teal-600 hover:bg-teal-50 transition-colors"
                          title="View"
                        >
                          <FiEye className="w-3.5 h-3.5" />
                        </button>
                        {isAdmin && !isDemo && (
                          <>
                            <button
                              onClick={() => { handleOpenAppEdit(app); setCandidateViewMode('list'); }}
                              className="p-1.5 rounded-lg text-thb-text-muted hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                              title="Shortlist"
                            >
                              <FiUserCheck className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => { setEditAppStatus('rejected'); setEditingAppId(app.id); handleSaveAppStatus(app.id); }}
                              className="p-1.5 rounded-lg text-thb-text-muted hover:text-red-600 hover:bg-red-50 transition-colors"
                              title="Reject"
                            >
                              <FiXCircle className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* ANALYTICS TAB (Candidate Search / Job Search Matrix)        */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {activeTab === 'analytics' && (
        <div className="space-y-4">
          {/* Filter panel */}
          <div className="thb-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <FiUsers className="w-4 h-4 text-teal-600" />
              <h3 className="text-sm font-semibold text-thb-text-primary">Candidate Shortlist Filters</h3>
              <span className="text-[11px] text-thb-text-muted ml-2">
                Filter candidates across all applications by skill, experience, salary, and more
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="text-[11px] font-medium text-thb-text-secondary uppercase tracking-wider">Skills (comma-separated)</label>
                <input
                  type="text"
                  value={searchFilters.skills}
                  onChange={(e) => setSearchFilters({ ...searchFilters, skills: e.target.value })}
                  placeholder="react, nodejs, aws"
                  className="mt-1 w-full px-3 py-2 border border-thb-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
                <p className="text-[10px] text-thb-text-muted mt-0.5">Candidate must have ALL listed skills</p>
              </div>

              <div>
                <label className="text-[11px] font-medium text-thb-text-secondary uppercase tracking-wider">Experience (years)</label>
                <div className="mt-1 flex gap-1.5">
                  <input
                    type="number"
                    min="0"
                    value={searchFilters.minExperienceYears}
                    onChange={(e) => setSearchFilters({ ...searchFilters, minExperienceYears: e.target.value })}
                    placeholder="Min"
                    className="w-full px-2 py-2 border border-thb-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                  <input
                    type="number"
                    min="0"
                    value={searchFilters.maxExperienceYears}
                    onChange={(e) => setSearchFilters({ ...searchFilters, maxExperienceYears: e.target.value })}
                    placeholder="Max"
                    className="w-full px-2 py-2 border border-thb-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-medium text-thb-text-secondary uppercase tracking-wider">Expected Salary (LPA)</label>
                <div className="mt-1 flex gap-1.5">
                  <input
                    type="number"
                    min="0"
                    value={searchFilters.minSalary}
                    onChange={(e) => setSearchFilters({ ...searchFilters, minSalary: e.target.value })}
                    placeholder="Min"
                    className="w-full px-2 py-2 border border-thb-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                  <input
                    type="number"
                    min="0"
                    value={searchFilters.maxSalary}
                    onChange={(e) => setSearchFilters({ ...searchFilters, maxSalary: e.target.value })}
                    placeholder="Max"
                    className="w-full px-2 py-2 border border-thb-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-medium text-thb-text-secondary uppercase tracking-wider">Status</label>
                <select
                  value={searchFilters.status}
                  onChange={(e) => setSearchFilters({ ...searchFilters, status: e.target.value })}
                  className="mt-1 w-full px-3 py-2 border border-thb-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                >
                  <option value="">All (excl. rejected)</option>
                  <option value="applied">Applied</option>
                  <option value="screening">Screening</option>
                  <option value="interview">Interview</option>
                  <option value="offered">Offered</option>
                  <option value="hired">Hired</option>
                  <option value="talent_pool">Talent Pool</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-medium text-thb-text-secondary uppercase tracking-wider">Job Posting</label>
                <select
                  value={searchFilters.jobPostingId}
                  onChange={(e) => setSearchFilters({ ...searchFilters, jobPostingId: e.target.value })}
                  className="mt-1 w-full px-3 py-2 border border-thb-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                >
                  <option value="">All jobs</option>
                  {displayJobs.map(j => (
                    <option key={j.id} value={j.id}>{j.title}</option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="text-[11px] font-medium text-thb-text-secondary uppercase tracking-wider">Search name / email / skill</label>
                <input
                  type="text"
                  value={searchFilters.q}
                  onChange={(e) => setSearchFilters({ ...searchFilters, q: e.target.value })}
                  placeholder="e.g. alice@example.com or python"
                  className="mt-1 w-full px-3 py-2 border border-thb-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  onKeyDown={(e) => { if (e.key === 'Enter') runCandidateSearch(); }}
                />
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2">
              <button
                onClick={runCandidateSearch}
                disabled={searching}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 text-white text-sm font-medium transition-colors"
              >
                {searching ? (
                  <><div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Searching…</>
                ) : (
                  <><FiBarChart2 className="w-3.5 h-3.5" /> Search Candidates</>
                )}
              </button>
              <button
                onClick={() => {
                  setSearchFilters({ skills: '', minExperienceYears: '', maxExperienceYears: '', minSalary: '', maxSalary: '', status: '', jobPostingId: '', q: '' });
                  setSearchResults(null);
                }}
                className="px-3 py-2 rounded-lg border border-thb-border text-xs font-medium text-thb-text-secondary hover:bg-slate-50 transition-colors"
              >
                Clear filters
              </button>
            </div>
          </div>

          {/* Results */}
          {searchResults && (
            <>
              {/* Summary stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="thb-card p-3">
                  <p className="text-[10px] uppercase tracking-wider text-thb-text-muted font-medium">Total Matches</p>
                  <p className="text-2xl font-bold text-teal-600 mt-0.5">{searchResults.summary.totalMatches}</p>
                </div>
                <div className="thb-card p-3">
                  <p className="text-[10px] uppercase tracking-wider text-thb-text-muted font-medium">Avg Experience</p>
                  <p className="text-2xl font-bold text-thb-text-primary mt-0.5">
                    {searchResults.summary.avgExperienceYears}<span className="text-xs font-medium ml-1 text-thb-text-muted">yrs</span>
                  </p>
                </div>
                <div className="thb-card p-3">
                  <p className="text-[10px] uppercase tracking-wider text-thb-text-muted font-medium">Avg Expected Salary</p>
                  <p className="text-2xl font-bold text-thb-text-primary mt-0.5">
                    {searchResults.summary.avgExpectedSalaryLpa !== null ? (
                      <>{searchResults.summary.avgExpectedSalaryLpa}<span className="text-xs font-medium ml-1 text-thb-text-muted">LPA</span></>
                    ) : '—'}
                  </p>
                </div>
                <div className="thb-card p-3">
                  <p className="text-[10px] uppercase tracking-wider text-thb-text-muted font-medium">Unique Skills Found</p>
                  <p className="text-2xl font-bold text-thb-text-primary mt-0.5">{searchResults.summary.uniqueSkills.length}</p>
                </div>
              </div>

              {/* Unique skills cloud */}
              {searchResults.summary.uniqueSkills.length > 0 && (
                <div className="thb-card p-3">
                  <p className="text-[11px] font-semibold text-thb-text-secondary uppercase tracking-wider mb-2">Skills found in matching candidates (click to filter)</p>
                  <div className="flex flex-wrap gap-1.5">
                    {searchResults.summary.uniqueSkills.slice(0, 40).map(s => (
                      <button
                        key={s}
                        onClick={() => {
                          const current = searchFilters.skills.split(',').map(x => x.trim()).filter(Boolean);
                          if (!current.includes(s)) {
                            setSearchFilters({ ...searchFilters, skills: [...current, s].join(', ') });
                          }
                        }}
                        className="text-[10px] px-2 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-200 hover:bg-teal-100 transition-colors"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Candidate cards */}
              {searchResults.candidates.length === 0 ? (
                <div className="thb-card text-center py-12">
                  <FiUsers className="w-12 h-12 text-thb-text-muted mx-auto mb-3" />
                  <p className="text-thb-text-secondary font-medium">No candidates match your filters</p>
                  <p className="text-sm text-thb-text-muted mt-1">Try widening the experience / salary range or removing some skills</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {searchResults.candidates.map((c: Record<string, unknown>, idx: number) => {
                    const cAny = c as Record<string, unknown>;
                    const masked = !isRecruiterOrAdmin ? maskCandidateFields({
                      candidateName: cAny.candidateName as string,
                      candidateEmail: cAny.candidateEmail as string,
                      candidatePhone: cAny.candidatePhone as string | null,
                    }, user?.role, piiPolicies) : null;
                    const displayName = (masked?.candidateName ?? cAny.candidateName) as string;
                    const displayEmail = (masked?.candidateEmail ?? cAny.candidateEmail) as string;
                    const displayPhone = (masked?.candidatePhone ?? cAny.candidatePhone) as string | null;
                    const cSkills = (cAny.skills || []) as string[];
                    const cApplications = (cAny.applications || []) as Record<string, unknown>[];
                    const totalExpYears = cAny.totalExperienceYears as number;
                    const expSalaryLpa = cAny.expectedSalaryLpa as number | null;
                    const latestStatus = cAny.latestStatus as string;
                    const matchScore = cAny.matchScore as number | null;
                    return (
                      <div key={displayEmail} className="thb-card p-4 hover:shadow-md transition-shadow">
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[10px] font-mono text-thb-text-muted">#{idx + 1}</span>
                              <h4 className="text-sm font-semibold text-thb-text-primary">{displayName}</h4>
                              <span className={`text-[10px] px-2 py-0.5 rounded border ${getAppStatusBadge(latestStatus).className}`}>
                                {latestStatus}
                              </span>
                              {matchScore !== null && (
                                <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                                  matchScore >= 75 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                                  matchScore >= 50 ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                                  'bg-rose-50 text-rose-700 border border-rose-200'
                                }`}>
                                  ★ Match: {Math.round(matchScore)}%
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-thb-text-secondary">
                              <span className="flex items-center gap-1"><FiMail className="w-3 h-3" />{displayEmail}</span>
                              {displayPhone && <span className="flex items-center gap-1"><FiPhone className="w-3 h-3" />{displayPhone}</span>}
                              <span className="flex items-center gap-1"><FiBriefcase className="w-3 h-3" />{totalExpYears > 0 ? `${totalExpYears.toFixed(1)} yrs exp` : 'Exp unknown'}</span>
                              {expSalaryLpa !== null && (
                                <span className="flex items-center gap-1"><FiStar className="w-3 h-3" />₹{expSalaryLpa} LPA</span>
                              )}
                            </div>
                            {cSkills.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {cSkills.slice(0, 15).map((s: string, i: number) => (
                                  <span key={`${s}-${i}`} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                                    {s}
                                  </span>
                                ))}
                                {cSkills.length > 15 && (
                                  <span className="text-[10px] px-1.5 py-0.5 text-slate-500">+{cSkills.length - 15} more</span>
                                )}
                              </div>
                            )}
                            {cApplications.length > 0 && (
                              <div className="mt-2 text-[11px] text-thb-text-muted">
                                <span className="font-medium">Applied to:</span>{' '}
                                {cApplications.slice(0, 3).map((a: Record<string, unknown>, i: number) => (
                                  <span key={a.id as string}>
                                    {i > 0 && ' · '}
                                    <span className="text-thb-text-secondary">{a.jobTitle as string}</span>
                                    {a.company && <span className="text-thb-text-muted"> ({a.company as string})</span>}
                                  </span>
                                ))}
                                {cApplications.length > 3 && <span className="text-thb-text-muted"> +{cApplications.length - 3} more</span>}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* Parsed Resume expandable panel                                              */
/* ─────────────────────────────────────────────────────────────────────────── */

function ParsedResumePanel({
  appId,
  state,
  parsing,
  onUpload,
  onReparse,
}: {
  appId: string;
  state: { parse: ResumeParseRow | null; parsed: ParsedResume | null; loading: boolean } | undefined;
  parsing: boolean;
  onUpload: (appId: string, file: File) => void;
  onReparse: (appId: string) => void;
}) {
  const parse = state?.parse || null;
  const parsed = state?.parsed || null;
  const loading = state?.loading || parsing;

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2">
          <FiFileText className="w-5 h-5 text-teal-500" />
          <h4 className="text-sm font-semibold text-thb-text-primary">Parsed Resume</h4>
          {parse && (
            <div className="flex items-center gap-2 ml-2">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 uppercase">{parse.language || '—'}</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${parse.confidence >= 0.8 ? 'bg-emerald-100 text-emerald-700' : parse.confidence >= 0.5 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                {Math.round(parse.confidence * 100)}% conf
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-50 text-sky-700 uppercase">{parse.sourceFormat}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <input
            id={`resume-upload-${appId}`}
            type="file"
            accept=".pdf,.docx,.doc,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,text/plain"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onUpload(appId, f);
              e.target.value = '';
            }}
          />
          <label
            htmlFor={`resume-upload-${appId}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 text-white text-xs font-medium rounded-lg hover:bg-teal-700 cursor-pointer transition-colors"
          >
            <FiUpload className="w-3.5 h-3.5" />
            Upload &amp; Parse
          </label>
          {parse && (
            <button
              onClick={() => onReparse(appId)}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-thb-border text-xs font-medium rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors"
            >
              {loading ? <FiRefreshCw className="w-3.5 h-3.5 animate-spin" /> : <FiRefreshCw className="w-3.5 h-3.5" />}
              Re-parse
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-thb-text-muted py-6">
          <FiRefreshCw className="w-4 h-4 animate-spin" />
          Parsing resume…
        </div>
      ) : !parse ? (
        <div className="py-6 text-center">
          <FiFileText className="w-8 h-8 text-thb-text-muted mx-auto mb-2" />
          <p className="text-sm text-thb-text-secondary font-medium">No parsed resume yet</p>
          <p className="text-xs text-thb-text-muted mt-1">Upload a PDF, DOCX, DOC, or TXT resume to extract structured data via ZAI.</p>
        </div>
      ) : parse.parseError && !parsed ? (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200">
          <p className="text-sm font-semibold text-red-700">Parse failed</p>
          <p className="text-xs text-red-600 mt-1">{parse.parseError}</p>
        </div>
      ) : !parsed ? (
        <div className="p-4 rounded-lg bg-amber-50 border border-amber-200">
          <p className="text-sm text-amber-700">Resume was parsed but structured data is unavailable.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Top-level identity */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-white border border-thb-border">
              <p className="text-xs font-semibold text-thb-text-muted uppercase mb-1">Name</p>
              <p className="text-sm font-medium text-thb-text-primary">{parsed.name || '—'}</p>
            </div>
            <div className="p-3 rounded-lg bg-white border border-thb-border">
              <p className="text-xs font-semibold text-thb-text-muted uppercase mb-1">Contact</p>
              <div className="text-sm text-thb-text-secondary space-y-0.5">
                {parsed.email && <p className="flex items-center gap-1.5"><FiMail className="w-3 h-3" /> {parsed.email}</p>}
                {parsed.phone && <p className="flex items-center gap-1.5"><FiPhone className="w-3 h-3" /> {parsed.phone}</p>}
                {parsed.location && <p className="flex items-center gap-1.5"><FiMapPin className="w-3 h-3" /> {parsed.location}</p>}
              </div>
            </div>
          </div>

          {/* Summary */}
          {parsed.summary && (
            <div className="p-3 rounded-lg bg-white border border-thb-border">
              <p className="text-xs font-semibold text-thb-text-muted uppercase mb-1">Summary</p>
              <p className="text-sm text-thb-text-secondary">{parsed.summary}</p>
            </div>
          )}

          {/* Skills */}
          {parsed.skills && parsed.skills.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-thb-text-muted uppercase mb-2">Skills ({parsed.skills.length})</p>
              <div className="flex flex-wrap gap-1.5">
                {parsed.skills.map((s, i) => (
                  <span key={`${s}-${i}`} className="px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 text-xs font-medium border border-sky-100">{s}</span>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Experience */}
            <div>
              <p className="text-xs font-semibold text-thb-text-muted uppercase mb-2 flex items-center gap-1.5"><FiWork className="w-3 h-3" /> Experience ({(parsed.experience || []).length})</p>
              <div className="space-y-2">
                {(parsed.experience || []).map((x, i) => (
                  <div key={i} className="p-3 rounded-lg bg-white border border-thb-border">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-thb-text-primary">{x.role || '—'} · {x.company || '—'}</p>
                      <span className="text-[10px] text-thb-text-muted">{x.duration || ''}</span>
                    </div>
                    {x.description && <p className="text-xs text-thb-text-secondary mt-1">{x.description}</p>}
                  </div>
                ))}
                {(parsed.experience || []).length === 0 && <p className="text-xs text-thb-text-muted">No experience extracted.</p>}
              </div>
            </div>

            {/* Education */}
            <div>
              <p className="text-xs font-semibold text-thb-text-muted uppercase mb-2 flex items-center gap-1.5"><FiAward className="w-3 h-3" /> Education ({(parsed.education || []).length})</p>
              <div className="space-y-2">
                {(parsed.education || []).map((e, i) => (
                  <div key={i} className="p-3 rounded-lg bg-white border border-thb-border">
                    <p className="text-sm font-medium text-thb-text-primary">{e.degree || '—'}</p>
                    <p className="text-xs text-thb-text-secondary">{e.institution || '—'}{e.year ? ` · ${e.year}` : ''}</p>
                  </div>
                ))}
                {(parsed.education || []).length === 0 && <p className="text-xs text-thb-text-muted">No education extracted.</p>}
              </div>
            </div>
          </div>

          {/* Certifications + Languages */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <p className="text-xs font-semibold text-thb-text-muted uppercase mb-2">Certifications ({(parsed.certifications || []).length})</p>
              {(parsed.certifications || []).length > 0 ? (
                <ul className="text-sm text-thb-text-secondary list-disc list-inside space-y-0.5">
                  {parsed.certifications.map((c, i) => <li key={i}>{c}</li>)}
                </ul>
              ) : <p className="text-xs text-thb-text-muted">None extracted.</p>}
            </div>
            <div>
              <p className="text-xs font-semibold text-thb-text-muted uppercase mb-2">Languages ({(parsed.languages || []).length})</p>
              {(parsed.languages || []).length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {parsed.languages.map((l, i) => <span key={i} className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-medium uppercase">{l}</span>)}
                </div>
              ) : <p className="text-xs text-thb-text-muted">None extracted.</p>}
            </div>
          </div>

          {/* Parse error (non-fatal) */}
          {parse.parseError && (
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-700">
              <strong>Note:</strong> {parse.parseError}
            </div>
          )}

          {/* Raw text preview */}
          <details className="group">
            <summary className="cursor-pointer text-xs font-semibold text-thb-text-muted hover:text-thb-text-primary flex items-center gap-1">
              <FiFileText className="w-3 h-3" /> Show raw extracted text
            </summary>
            <pre className="mt-2 p-3 rounded-lg bg-slate-50 border border-thb-border text-xs text-thb-text-secondary whitespace-pre-wrap max-h-48 overflow-y-auto">
              Raw resume text is stored on the server (ResumeParse.rawText). Open this record via /api/ats/parse-resume/{`{id}`} to view it.
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}
