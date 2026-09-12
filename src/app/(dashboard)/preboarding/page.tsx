'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import {
  FiUserPlus,
  FiCheckCircle,
  FiFileText,
  FiShield,
  FiClock,
  FiPlus,
  FiX,
  FiEdit2,
  FiTrash2,
  FiSearch,
  FiFilter,
  FiChevronRight,
  FiGrid,
  FiBarChart2,
} from 'react-icons/fi';
import ModuleDashboardShell, { DashboardTabConfig } from '@/components/ModuleDashboardShell';
import toast from 'react-hot-toast';
import { isClientDemoMode } from '@/lib/site-mode';
import { useAuthStore } from '@/store/authStore';
import ModuleTips from '@/components/ModuleTips';
import ModuleWorkflow from '@/components/ModuleWorkflow';

/* ── Types ── */
interface PreboardingCandidate {
  id: string;
  name: string;
  email: string;
  position: string;
  stage: string;
  startDate: string;
  documents: DocumentItem[];
  bgv: BGVRecord | null;
  hrVerified: boolean;
}

interface DocumentItem {
  type: string;
  status: 'pending' | 'uploaded' | 'verified' | 'rejected';
}

interface BGVRecord {
  vendor: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  submittedDate: string | null;
  completedDate: string | null;
  notes: string;
}

/* ── Constants ── */
const STAGES = [
  'Offer Accepted',
  'Document Collection',
  'Background Verification',
  'Pre-boarding Kit',
  'IT Setup',
  'Orientation Scheduled',
  'Day 1 Ready',
];

const DOC_TYPES = [
  'ID Proof',
  'Address Proof',
  'Education Certs',
  'Previous Employment',
  'Medical',
  'Bank Details',
];

/* ── Helpers ── */
function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

function formatDate(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function getStageBadge(stage: string) {
  const idx = STAGES.indexOf(stage);
  const colors = [
    'bg-slate-50 text-slate-700 thb-badge',
    'bg-green-50 text-green-700 thb-badge',
    'bg-amber-50 text-amber-700 thb-badge',
    'bg-teal-50 text-teal-700 thb-badge',
    'bg-cyan-50 text-cyan-700 thb-badge',
    'bg-emerald-50 text-emerald-700 thb-badge',
    'thb-badge thb-badge-success',
  ];
  return { className: colors[idx] || 'thb-badge thb-badge-info', label: stage };
}

function getDocStatusBadge(status: string) {
  const map: Record<string, string> = {
    pending: 'thb-badge thb-badge-warning',
    uploaded: 'bg-green-50 text-green-700 thb-badge',
    verified: 'thb-badge thb-badge-success',
    rejected: 'thb-badge thb-badge-error',
  };
  const labels: Record<string, string> = {
    pending: 'Pending', uploaded: 'Uploaded', verified: 'Verified', rejected: 'Rejected',
  };
  return { className: map[status] || 'thb-badge thb-badge-info', label: labels[status] || status };
}

function getBGVStatusBadge(status: string) {
  const map: Record<string, string> = {
    pending: 'thb-badge thb-badge-warning',
    in_progress: 'bg-cyan-50 text-cyan-700 thb-badge',
    completed: 'thb-badge thb-badge-success',
    failed: 'thb-badge thb-badge-error',
  };
  const labels: Record<string, string> = {
    pending: 'Pending', in_progress: 'In Progress', completed: 'Completed', failed: 'Failed',
  };
  return { className: map[status] || 'thb-badge thb-badge-info', label: labels[status] || status };
}

/* ── Demo Data ── */
const preboardingTips = [
  { title: 'Send Welcome Kits', description: 'Prepare and send digital welcome kits with company info, culture handbook, and team introductions before Day 1.' },
  { title: 'Collect Documents Early', description: 'Request all required documents (ID, address proof, education certs) as soon as the offer is accepted.' },
  { title: 'IT Setup Preparation', description: 'Provision email accounts, laptop, software licenses, and access credentials before the employee starts.' },
  { title: 'Assign Onboarding Buddy', description: 'Pair new hires with experienced team members to help them navigate the company culture and processes.' },
  { title: 'Set Expectations', description: 'Share the first-week schedule, role expectations, and performance goals to give new hires a clear start.' },
];

const preboardingWorkflowSteps = [
  { step: 1, title: 'Send Offer Acceptance', description: 'Confirm the offer and collect signed acceptance letter' },
  { step: 2, title: 'Collect Pre-joining Documents', description: 'Gather ID proofs, certificates, and bank details' },
  { step: 3, title: 'Setup IT Access', description: 'Provision email, laptop, and system credentials' },
  { step: 4, title: 'Assign Onboarding Buddy', description: 'Pair with an experienced team member for guidance' },
  { step: 5, title: 'Send Welcome Kit', description: 'Share company handbook, culture guide, and team info' },
  { step: 6, title: 'Schedule Day 1', description: 'Plan orientation sessions and introduction meetings' },
  { step: 7, title: 'Confirm Joining', description: 'Verify all tasks complete and candidate is Day 1 ready' },
];

/* ── Demo Data ── */
const demoCandidates: PreboardingCandidate[] = isClientDemoMode() ? [
  { id: '1', name: 'Aarav Sharma', email: 'aarav@demo.com', position: 'Senior Developer', stage: 'Day 1 Ready', startDate: '2026-03-10', documents: DOC_TYPES.map(t => ({ type: t, status: 'verified' as const })), bgv: { vendor: 'Sterling', status: 'completed', submittedDate: '2026-02-20', completedDate: '2026-03-01', notes: 'Clear' }, hrVerified: true },
  { id: '2', name: 'Priya Patel', email: 'priya@demo.com', position: 'UX Designer', stage: 'Background Verification', startDate: '2026-03-15', documents: DOC_TYPES.map((t, i) => ({ type: t, status: (i < 4 ? 'verified' : 'pending') as 'verified' | 'pending' })), bgv: { vendor: 'First Advantage', status: 'in_progress', submittedDate: '2026-03-01', completedDate: null, notes: 'Awaiting employment verification' }, hrVerified: false },
  { id: '3', name: 'Rahul Verma', email: 'rahul@demo.com', position: 'Product Manager', stage: 'Document Collection', startDate: '2026-03-20', documents: DOC_TYPES.map((t, i) => ({ type: t, status: (i < 2 ? 'uploaded' : 'pending') as 'uploaded' | 'pending' })), bgv: null, hrVerified: false },
  { id: '4', name: 'Sneha Reddy', email: 'sneha@demo.com', position: 'Data Analyst', stage: 'IT Setup', startDate: '2026-03-12', documents: DOC_TYPES.map(t => ({ type: t, status: 'verified' as const })), bgv: { vendor: 'Sterling', status: 'completed', submittedDate: '2026-02-25', completedDate: '2026-03-05', notes: 'Clear' }, hrVerified: true },
  { id: '5', name: 'Vikram Singh', email: 'vikram@demo.com', position: 'DevOps Engineer', stage: 'Offer Accepted', startDate: '2026-04-01', documents: DOC_TYPES.map(t => ({ type: t, status: 'pending' as const })), bgv: null, hrVerified: false },
  { id: '6', name: 'Meera Joshi', email: 'meera@demo.com', position: 'HR Executive', stage: 'Orientation Scheduled', startDate: '2026-03-08', documents: DOC_TYPES.map(t => ({ type: t, status: 'verified' as const })), bgv: { vendor: 'HireRight', status: 'completed', submittedDate: '2026-02-15', completedDate: '2026-02-28', notes: 'Clear' }, hrVerified: true },
] : [];

const initialForm = {
  name: '',
  email: '',
  position: '',
  stage: 'Offer Accepted',
  startDate: '',
};

/* ── Placeholder Tabs ── */

const preboardingTabs: DashboardTabConfig[] = [
  { label: 'Overview', key: 'overview', icon: <FiGrid className="w-4 h-4" /> },
  { label: 'Reports', key: 'reports', icon: <FiFileText className="w-4 h-4" />, isNew: true },
];

function PreboardingReportsPlaceholder() {
  return (
    <div className="flex flex-col items-center py-8">
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg mb-4">
        <FiFileText className="w-7 h-7 text-white" />
      </div>
      <h3 className="text-lg font-bold text-thb-text-primary mb-1">Reports & Analytics</h3>
      <p className="text-sm text-thb-text-secondary text-center max-w-md mb-4">
        BGV status reports, document tracking, and onboarding-readiness analytics
      </p>
      <a href="/preboarding/reports" className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors">
        <FiBarChart2 className="w-4 h-4" /> Go to Reports
      </a>
    </div>
  );
}

function PreboardingPageContent() {
  return (
    <ModuleDashboardShell
      moduleKey="preboarding"
      moduleLabel="Preboarding"
      moduleIcon={<FiFileText className="w-5 h-5 text-white" />}
      gradientColor="from-lime-500 to-green-600"
      tabs={preboardingTabs}
      overviewContent={<PreboardingContent />}
      children={{
        reports: <PreboardingReportsPlaceholder />,
      }}
    />
  );
}

export default function PreboardingPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-20"><div className="animate-spin w-8 h-8 border-2 border-lime-500 border-t-transparent rounded-full" /></div>}>
      <PreboardingPageContent />
    </Suspense>
  );
}

/* ── Component ── */
function PreboardingContent() {
  const { user } = useAuthStore();
  const isAdmin = ['super_admin', 'tenant_admin', 'admin'].includes(user?.role || '');

  const [candidates, setCandidates] = useState<PreboardingCandidate[]>(demoCandidates);
  const [usingLiveData, setUsingLiveData] = useState(false);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStage, setFilterStage] = useState('');
  const [activeTab, setActiveTab] = useState<'pipeline' | 'documents' | 'bgv'>('pipeline');

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  /* Fetch data — LIVE preboarding records from the conversion cascade;
     demo examples are only shown when no real records exist yet */
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/preboarding?limit=100', { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        const live = (data.candidates || []) as Array<Record<string, unknown>>;
        if (live.length > 0) {
          const statusToStage: Record<string, string> = {
            offer_accepted: 'Offer Accepted',
            document_collection: 'Document Collection',
            bgv: 'Background Verification',
            provisioning: 'IT Setup',
            asset_request: 'IT Setup',
            joined: 'Day 1 Ready',
            cancelled: 'Cancelled',
          };
          const docTypes = ['offer_letter', 'id_proof', 'tax_forms', 'direct_deposit', 'employment_agreement', 'emergency_contact'];
          const mapped: PreboardingCandidate[] = live.map((c) => {
            const status = String(c.status || 'offer_accepted');
            const bgvStatus = String(c.backgroundCheckStatus || 'pending');
            let docs: DocumentItem[] = [];
            try {
              const parsed = typeof c.documentsUploaded === 'string' && (c.documentsUploaded as string).startsWith('[')
                ? JSON.parse(c.documentsUploaded as string)
                : null;
              if (Array.isArray(parsed)) docs = parsed;
            } catch { /* ignore */ }
            if (!docs.length) {
              docs = docTypes.map((t) => ({ type: t, status: 'pending' as const }));
            }
            return {
              id: String(c.id),
              name: String(c.candidateName || 'Unknown'),
              email: String(c.candidateEmail || ''),
              position: String(c.jobTitle || 'New Hire'),
              stage: statusToStage[status] || 'Offer Accepted',
              startDate: c.joiningDate ? String(c.joiningDate).slice(0, 10) : '',
              documents: docs,
              bgv: {
                vendor: 'Sterling',
                status: (bgvStatus === 'cleared' ? 'completed' : bgvStatus === 'failed' ? 'failed' : bgvStatus === 'pending' ? 'pending' : 'in_progress') as BGVRecord['status'],
                submittedDate: null,
                completedDate: bgvStatus === 'cleared' || bgvStatus === 'failed' ? new Date().toISOString().slice(0, 10) : null,
                notes: String(c.backgroundCheckNotes || ''),
              },
              hrVerified: Boolean(c.hrVerified),
            };
          });
          setCandidates(mapped);
          setUsingLiveData(true);
          return;
        }
      }
      setUsingLiveData(false);
      setCandidates(demoCandidates);
    } catch {
      setUsingLiveData(false);
      // Use demo data on error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { queueMicrotask(() => fetchData()); }, [fetchData]);

  /* Stats */
  const totalCandidates = candidates.length;
  const inProgress = candidates.filter(c => !['Day 1 Ready', 'Offer Accepted'].includes(c.stage)).length;
  const pendingBGV = candidates.filter(c => c.bgv && ['pending', 'in_progress'].includes(c.bgv.status)).length;
  const readyDay1 = candidates.filter(c => c.stage === 'Day 1 Ready').length;

  /* Filtered */
  const filtered = candidates.filter(c => {
    const matchSearch = !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.position.toLowerCase().includes(search.toLowerCase()) || c.email.toLowerCase().includes(search.toLowerCase());
    const matchStage = !filterStage || c.stage === filterStage;
    return matchSearch && matchStage;
  });

  /* Pipeline counts per stage */
  const stageCounts = STAGES.map(stage => ({
    stage,
    count: candidates.filter(c => c.stage === stage).length,
  }));

  /* Form handlers */
  const handleShowAddForm = () => {
    setForm(initialForm);
    setEditingId(null);
    setShowForm(true);
    setTimeout(() => document.getElementById('crud-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  const handleShowEditForm = (c: PreboardingCandidate) => {
    setForm({ name: c.name, email: c.email, position: c.position, stage: c.stage, startDate: c.startDate });
    setEditingId(c.id);
    setShowForm(true);
    setTimeout(() => document.getElementById('crud-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  const handleCancelForm = () => { setShowForm(false); setEditingId(null); setForm(initialForm); };

  const handleSubmit = async () => {
    if (!form.name || !form.email || !form.position) {
      toast.error('Please fill in required fields: Name, Email, Position');
      return;
    }
    try {
      setSubmitting(true);
      if (editingId) {
        setCandidates(prev => prev.map(c => c.id === editingId ? { ...c, name: form.name, email: form.email, position: form.position, stage: form.stage, startDate: form.startDate || c.startDate } : c));
        toast.success('Candidate updated successfully');
      } else {
        const newCandidate: PreboardingCandidate = {
          id: Date.now().toString(),
          name: form.name, email: form.email, position: form.position, stage: form.stage,
          startDate: form.startDate || new Date().toISOString().split('T')[0],
          documents: DOC_TYPES.map(t => ({ type: t, status: 'pending' as const })),
          bgv: null, hrVerified: false,
        };
        setCandidates(prev => [newCandidate, ...prev]);
        toast.success('Candidate added successfully');
      }
      handleCancelForm();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Operation failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (id: string) => {
    setCandidates(prev => prev.filter(c => c.id !== id));
    toast.success('Candidate removed');
    setDeleteConfirmId(null);
    setDeleting(false);
  };

  const handleAdvanceStage = (id: string) => {
    setCandidates(prev => prev.map(c => {
      if (c.id !== id) return c;
      const currentIdx = STAGES.indexOf(c.stage);
      if (currentIdx < STAGES.length - 1) {
        return { ...c, stage: STAGES[currentIdx + 1] };
      }
      return c;
    }));
    toast.success('Stage advanced');
  };

  const toggleHRVerify = (id: string) => {
    setCandidates(prev => prev.map(c => c.id === id ? { ...c, hrVerified: !c.hrVerified } : c));
    toast.success('HR verification toggled');
  };

  const tabs = [
    { key: 'pipeline' as const, label: 'Pipeline', icon: FiUserPlus },
    { key: 'documents' as const, label: 'Documents', icon: FiFileText },
    { key: 'bgv' as const, label: 'BGV Tracking', icon: FiShield },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-thb-text-primary flex items-center gap-2">
            <FiUserPlus className="w-6 h-6 text-emerald-500" />
            Preboarding
          </h1>
          <p className="text-thb-text-secondary mt-1">Manage pre-boarding workflow for incoming employees</p>
          <p className={`text-[11px] mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${usingLiveData ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
            {usingLiveData ? '● Live data — candidates converted from recruitment appear here' : '● Sample data — convert a hired candidate in Recruitment to see live records'}
          </p>
        </div>
        {isAdmin && (
          <button onClick={handleShowAddForm} className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 font-medium text-sm shadow-sm shadow-emerald-500/25 transition-colors">
            <FiPlus className="w-4 h-4" />
            Add Candidate
          </button>
        )}
      </div>

      {/* Module Tips & Workflow */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ModuleTips moduleKey="preboarding" title="Preboarding Tips" tips={preboardingTips} userRole={user?.role} />
        <ModuleWorkflow moduleKey="preboarding" title="How to Manage Pre-boarding" steps={preboardingWorkflowSteps} accentColor="emerald" userRole={user?.role} />
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="thb-card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-50"><FiUserPlus className="w-4 h-4 text-emerald-600" /></div>
            <div>
              <p className="text-xs font-medium text-thb-text-secondary">Total Candidates</p>
              <p className="text-xl font-bold text-thb-text-primary">{totalCandidates}</p>
            </div>
          </div>
        </div>
        <div className="thb-card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-50"><FiClock className="w-4 h-4 text-cyan-600" /></div>
            <div>
              <p className="text-xs font-medium text-thb-text-secondary">In Progress</p>
              <p className="text-xl font-bold text-thb-text-primary">{inProgress}</p>
            </div>
          </div>
        </div>
        <div className="thb-card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-50"><FiShield className="w-4 h-4 text-amber-600" /></div>
            <div>
              <p className="text-xs font-medium text-thb-text-secondary">Pending BGV</p>
              <p className="text-xl font-bold text-amber-600">{pendingBGV}</p>
            </div>
          </div>
        </div>
        <div className="thb-card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-50"><FiCheckCircle className="w-4 h-4 text-emerald-600" /></div>
            <div>
              <p className="text-xs font-medium text-thb-text-secondary">Ready for Day 1</p>
              <p className="text-xl font-bold text-emerald-600">{readyDay1}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Stage Pipeline Bar */}
      <div className="thb-card p-4">
        <h3 className="text-sm font-semibold text-thb-text-secondary mb-3">7-Stage Workflow Pipeline</h3>
        <div className="flex items-center gap-1 overflow-x-auto pb-2">
          {stageCounts.map((s, i) => (
            <div key={s.stage} className="flex items-center">
              <div className={`flex flex-col items-center min-w-[100px] px-3 py-2 rounded-lg ${i <= STAGES.indexOf(filtered[0]?.stage || '') ? 'bg-emerald-50 border border-emerald-200' : 'bg-slate-50 border border-slate-200'}`}>
                <span className="text-[10px] text-thb-text-muted text-center leading-tight">{s.stage}</span>
                <span className="text-sm font-bold text-thb-text-primary mt-1">{s.count}</span>
              </div>
              {i < STAGES.length - 1 && <FiChevronRight className="w-4 h-4 text-thb-text-muted flex-shrink-0 mx-0.5" />}
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-thb-border">
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.key ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-thb-text-secondary hover:text-thb-text-primary'}`}>
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-thb-text-muted" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search candidates..." className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400" />
        </div>
        <div className="flex items-center gap-2">
          <FiFilter className="w-4 h-4 text-thb-text-muted" />
          <select value={filterStage} onChange={e => setFilterStage(e.target.value)} className="px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400">
            <option value="">All Stages</option>
            {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* Embedded CRUD Form */}
      {showForm && (
        <div id="crud-form" className="thb-card border-l-4 border-l-emerald-500 animate-slide-in-down">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-thb-text-primary">{editingId ? 'Edit Candidate' : 'Add New Candidate'}</h2>
              <button onClick={handleCancelForm} className="p-2 rounded-lg text-thb-text-muted hover:text-thb-text-primary hover:bg-slate-100 transition-colors"><FiX className="w-5 h-5" /></button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Full Name <span className="text-red-500 font-bold">*</span></label>
                <input type="text" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g., John Doe" className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Email <span className="text-red-500 font-bold">*</span></label>
                <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="john@company.com" className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Position <span className="text-red-500 font-bold">*</span></label>
                <input type="text" value={form.position} onChange={e => setForm(p => ({ ...p, position: e.target.value }))} placeholder="e.g., Senior Developer" className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Stage</label>
                <select value={form.stage} onChange={e => setForm(p => ({ ...p, stage: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400">
                  {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Start Date</label>
                <input type="date" value={form.startDate} onChange={e => setForm(p => ({ ...p, startDate: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400" />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-thb-border">
              <button onClick={handleCancelForm} className="px-4 py-2.5 rounded-lg border border-thb-border text-sm font-medium text-thb-text-secondary hover:bg-slate-50 transition-colors">Cancel</button>
              <button onClick={handleSubmit} disabled={submitting} className="px-6 py-2.5 rounded-lg bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 disabled:opacity-50 shadow-sm shadow-emerald-500/25 transition-colors">{submitting ? 'Saving...' : editingId ? 'Update' : 'Add Candidate'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Tab Content: Pipeline */}
      {activeTab === 'pipeline' && (
        <div className="thb-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-thb-border bg-slate-50/50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Candidate</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Position</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Stage</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Start Date</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">HR Verified</th>
                  {isAdmin && <th className="text-right px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i} className="border-b border-thb-border/50 animate-pulse">
                      <td className="px-4 py-3"><div className="h-3 w-28 bg-slate-200 rounded" /></td>
                      <td className="px-4 py-3"><div className="h-3 w-24 bg-slate-200 rounded" /></td>
                      <td className="px-4 py-3"><div className="h-5 w-28 bg-slate-200 rounded-full" /></td>
                      <td className="px-4 py-3"><div className="h-3 w-20 bg-slate-200 rounded" /></td>
                      <td className="px-4 py-3"><div className="h-3 w-12 bg-slate-200 rounded" /></td>
                      {isAdmin && <td className="px-4 py-3"><div className="h-3 w-20 bg-slate-200 rounded ml-auto" /></td>}
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={isAdmin ? 6 : 5} className="px-4 py-12 text-center">
                      <FiUserPlus className="w-10 h-10 text-thb-text-muted mx-auto mb-3" />
                      <p className="text-thb-text-secondary font-medium">No candidates found</p>
                      <p className="text-sm text-thb-text-muted mt-1">Add candidates to start the pre-boarding process</p>
                    </td>
                  </tr>
                ) : (
                  filtered.map(c => {
                    const stageBadge = getStageBadge(c.stage);
                    return (
                      <tr key={c.id} className="border-b border-thb-border/50 hover:bg-slate-50/50 transition-colors">
                        {deleteConfirmId === c.id ? (
                          <td colSpan={isAdmin ? 6 : 5} className="px-4 py-3 bg-red-50">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-red-700 font-medium">Remove &quot;{c.name}&quot; from pre-boarding?</span>
                              <div className="flex items-center gap-2">
                                <button onClick={() => handleDelete(c.id)} disabled={deleting} className="px-3 py-1.5 bg-red-500 text-white text-xs font-medium rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors">{deleting ? 'Removing...' : 'Confirm'}</button>
                                <button onClick={() => setDeleteConfirmId(null)} className="px-3 py-1.5 border border-thb-border text-xs font-medium rounded-lg hover:bg-slate-50 transition-colors">Cancel</button>
                              </div>
                            </div>
                          </td>
                        ) : (
                          <>
                            <td className="px-4 py-3">
                              <p className="text-sm font-medium text-thb-text-primary">{c.name}</p>
                              <p className="text-xs text-thb-text-muted">{c.email}</p>
                            </td>
                            <td className="px-4 py-3 text-sm text-thb-text-secondary">{c.position}</td>
                            <td className="px-4 py-3"><span className={stageBadge.className}>{stageBadge.label}</span></td>
                            <td className="px-4 py-3 text-sm text-thb-text-secondary">{formatDate(c.startDate)}</td>
                            <td className="px-4 py-3">
                              <button onClick={() => toggleHRVerify(c.id)} className={`text-xs font-medium px-2 py-1 rounded-lg transition-colors ${c.hrVerified ? 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100' : 'text-slate-500 bg-slate-50 hover:bg-slate-100'}`}>
                                {c.hrVerified ? 'Verified' : 'Pending'}
                              </button>
                            </td>
                            {isAdmin && (
                              <td className="px-4 py-3">
                                <div className="flex items-center justify-end gap-1">
                                  {c.stage !== 'Day 1 Ready' && (
                                    <button onClick={() => handleAdvanceStage(c.id)} className="p-2 rounded-lg text-thb-text-muted hover:text-emerald-500 hover:bg-emerald-50 transition-colors" title="Advance Stage">
                                      <FiChevronRight className="w-4 h-4" />
                                    </button>
                                  )}
                                  <button onClick={() => handleShowEditForm(c)} className="p-2 rounded-lg text-thb-text-muted hover:text-green-500 hover:bg-green-50 transition-colors" title="Edit"><FiEdit2 className="w-4 h-4" /></button>
                                  <button onClick={() => setDeleteConfirmId(c.id)} className="p-2 rounded-lg text-thb-text-muted hover:text-red-500 hover:bg-red-50 transition-colors" title="Delete"><FiTrash2 className="w-4 h-4" /></button>
                                </div>
                              </td>
                            )}
                          </>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab Content: Documents */}
      {activeTab === 'documents' && (
        <div className="space-y-4">
          {filtered.length === 0 ? (
            <div className="thb-card p-12 text-center">
              <FiFileText className="w-10 h-10 text-thb-text-muted mx-auto mb-3" />
              <p className="text-thb-text-secondary font-medium">No document records found</p>
            </div>
          ) : (
            filtered.map(c => (
              <div key={c.id} className="thb-card p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm font-semibold text-thb-text-primary">{c.name}</p>
                    <p className="text-xs text-thb-text-muted">{c.position}</p>
                  </div>
                  <span className={getStageBadge(c.stage).className}>{c.stage}</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                  {c.documents.map((doc, i) => {
                    const db = getDocStatusBadge(doc.status);
                    return (
                      <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-thb-border">
                        <FiFileText className="w-3.5 h-3.5 text-thb-text-muted flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-[10px] font-medium text-thb-text-secondary truncate">{doc.type}</p>
                          <span className={`text-[9px] ${db.className}`}>{db.label}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab Content: BGV Tracking */}
      {activeTab === 'bgv' && (
        <div className="thb-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-thb-border bg-slate-50/50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Candidate</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Vendor</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">BGV Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Submitted</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Completed</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Notes</th>
                </tr>
              </thead>
              <tbody>
                {filtered.filter(c => c.bgv).length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center">
                      <FiShield className="w-10 h-10 text-thb-text-muted mx-auto mb-3" />
                      <p className="text-thb-text-secondary font-medium">No BGV records found</p>
                      <p className="text-sm text-thb-text-muted mt-1">BGV tracking begins at the Background Verification stage</p>
                    </td>
                  </tr>
                ) : (
                  filtered.filter(c => c.bgv).map(c => {
                    const bgvBadge = getBGVStatusBadge(c.bgv!.status);
                    return (
                      <tr key={c.id} className="border-b border-thb-border/50 hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-3">
                          <p className="text-sm font-medium text-thb-text-primary">{c.name}</p>
                          <p className="text-xs text-thb-text-muted">{c.position}</p>
                        </td>
                        <td className="px-4 py-3 text-sm text-thb-text-secondary">{c.bgv!.vendor}</td>
                        <td className="px-4 py-3"><span className={bgvBadge.className}>{bgvBadge.label}</span></td>
                        <td className="px-4 py-3 text-sm text-thb-text-secondary">{formatDate(c.bgv!.submittedDate)}</td>
                        <td className="px-4 py-3 text-sm text-thb-text-secondary">{formatDate(c.bgv!.completedDate)}</td>
                        <td className="px-4 py-3 text-sm text-thb-text-secondary truncate max-w-[200px]">{c.bgv!.notes || '—'}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
