'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import {
  FiTrendingUp,
  FiPlus,
  FiX,
  FiEdit2,
  FiTrash2,
  FiSearch,
  FiFilter,
  FiStar,
  FiGrid, FiFileText, FiSettings, FiBarChart2,
} from 'react-icons/fi';
import ModuleDashboardShell, { DashboardTabConfig } from '@/components/ModuleDashboardShell';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import ModuleTips from '@/components/ModuleTips';
import ModuleWorkflow from '@/components/ModuleWorkflow';
import { useCompanyContextStore } from '@/store/companyContextStore';

/* ── Types ── */
interface PerformanceReview {
  id: string;
  employeeId: string;
  reviewerId: string | null;
  reviewCycle: string;
  reviewPeriod: string | null;
  goalsRating: number;
  skillsRating: number;
  behaviorRating: number;
  overallRating: number;
  comments: string | null;
  status: string;
  reviewDate: string | null;
  employee?: { id: string; firstName: string; lastName: string; employeeId: string; avatar?: string | null };
  reviewer?: { id: string; firstName: string; lastName: string; employeeId: string; avatar?: string | null };
}

interface Employee {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
}

/* ── Helpers ── */
function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

function formatDate(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function getStatusBadge(status: string) {
  const map: Record<string, string> = {
    draft: 'thb-badge thb-badge-warning',
    in_review: 'bg-cyan-50 text-cyan-700 thb-badge',
    completed: 'thb-badge thb-badge-success',
    acknowledged: 'bg-emerald-50 text-emerald-700 thb-badge',
    pending: 'thb-badge thb-badge-warning',
    in_progress: 'thb-badge thb-badge-info',
  };
  const labels: Record<string, string> = {
    draft: 'Draft',
    in_review: 'In Review',
    completed: 'Completed',
    acknowledged: 'Acknowledged',
    pending: 'Pending',
    in_progress: 'In Progress',
  };
  return { className: map[status] || 'thb-badge thb-badge-info', label: labels[status] || status };
}

function renderStars(rating: number, size: string = 'w-3.5 h-3.5') {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(s => (
        <FiStar key={s} className={`${size} ${s <= Math.round(rating) ? 'text-amber-400 fill-amber-400' : 'text-slate-300'}`} />
      ))}
      <span className="text-xs text-thb-text-muted ml-1">{rating > 0 ? rating.toFixed(1) : '—'}</span>
    </div>
  );
}

const performanceTips = [
  { title: 'Set Clear Goals', description: 'Define specific, measurable goals at the start of each review cycle to provide clear expectations' },
  { title: 'Use Multiple Rating Dimensions', description: 'Rate goals, competencies, and behavior separately for a more balanced and fair assessment' },
  { title: 'Schedule Regular Reviews', description: 'Conduct reviews at consistent intervals — quarterly or annually — to maintain accountability' },
  { title: 'Provide Constructive Comments', description: 'Always include comments explaining ratings to help employees understand their feedback' },
  { title: 'Track Review Status', description: 'Monitor reviews from Draft through In Review to Completed and Acknowledged for full transparency' },
];

const performanceWorkflowSteps = [
  { step: 1, title: 'Create Review Cycle', description: 'Define the review cycle name and period for the assessment', route: '/performance' },
  { step: 2, title: 'Select Employee & Reviewer', description: 'Choose the employee being reviewed and assign a reviewer', route: '/performance' },
  { step: 3, title: 'Set Goals Rating', description: 'Evaluate how well the employee met their defined goals' },
  { step: 4, title: 'Rate Competencies', description: 'Assess the employee\'s skills and competencies for their role' },
  { step: 5, title: 'Rate Behavior', description: 'Evaluate workplace behavior, teamwork, and professionalism' },
  { step: 6, title: 'Assign Overall Rating', description: 'Provide an overall performance rating based on all dimensions' },
  { step: 7, title: 'Add Comments', description: 'Write detailed feedback and development recommendations' },
  { step: 8, title: 'Submit & Acknowledge', description: 'Submit the review and have the employee acknowledge it' },
];

const initialForm = {
  employeeId: '',
  reviewerId: '',
  reviewCycle: '',
  reviewPeriod: '',
  goalsRating: 3,
  competenciesRating: 3,
  behaviorRating: 3,
  overallRating: 3,
  comments: '',
  status: 'draft',
};

/* ── Placeholder Tabs ── */

const appraisalTabs: DashboardTabConfig[] = [
  { label: 'Overview', key: 'overview', icon: <FiGrid className="w-4 h-4" /> },
  { label: 'Reports', key: 'reports', icon: <FiFileText className="w-4 h-4" />, isNew: true },
  { label: 'Settings', key: 'settings', icon: <FiSettings className="w-4 h-4" />, isNew: true },
];

function AppraisalReportsPlaceholder() {
  return (
    <div className="flex flex-col items-center py-8">
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg mb-4">
        <FiFileText className="w-7 h-7 text-white" />
      </div>
      <h3 className="text-lg font-bold text-thb-text-primary mb-1">Reports & Analytics</h3>
      <p className="text-sm text-thb-text-secondary text-center max-w-md mb-4">
        Performance review reports, rating distributions, and goal completion analytics
      </p>
      <a href="/performance/reports" className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors">
        <FiBarChart2 className="w-4 h-4" /> Go to Reports
      </a>
    </div>
  );
}

function AppraisalSettingsPlaceholder() {
  return (
    <div className="flex flex-col items-center py-8">
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-slate-500 to-slate-700 flex items-center justify-center shadow-lg mb-4">
        <FiSettings className="w-7 h-7 text-white" />
      </div>
      <h3 className="text-lg font-bold text-thb-text-primary mb-1">Settings & Configuration</h3>
      <p className="text-sm text-thb-text-secondary text-center max-w-md mb-4">
        Configure review cycles, rating scales, competency frameworks, and calibration settings
      </p>
      <a href="/performance/settings" className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors">
        <FiSettings className="w-4 h-4" /> Go to Settings
      </a>
    </div>
  );
}

function PerformancePageContent() {
  return (
    <ModuleDashboardShell
      moduleKey="appraisal"
      moduleLabel="Appraisal & Performance"
      moduleIcon={<FiTrendingUp className="w-5 h-5 text-white" />}
      gradientColor="from-amber-500 to-yellow-600"
      tabs={appraisalTabs}
      overviewContent={<PerformanceContent />}
      children={{
        reports: <AppraisalReportsPlaceholder />,
        settings: <AppraisalSettingsPlaceholder />,
      }}
    />
  );
}

export default function PerformancePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-20"><div className="animate-spin w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full" /></div>}>
      <PerformancePageContent />
    </Suspense>
  );
}

/* ── Component ── */
function PerformanceContent() {
  const { user } = useAuthStore();
  const effectiveCompanyId = useCompanyContextStore(s => s.effectiveCompanyId);
  const isAdmin = ['super_admin', 'tenant_admin', 'admin'].includes(user?.role || '');

  const [reviews, setReviews] = useState<PerformanceReview[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterCycle, setFilterCycle] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  /* Fetch data */
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const headers = getAuthHeaders();
      const params = new URLSearchParams();
      params.set('limit', '100');
      if (filterStatus) params.set('status', filterStatus);

      const [revRes, empRes] = await Promise.allSettled([
        fetch(`/api/performance?${scopeQuery}${params.toString()}` , { headers }),
        fetch(`/api/employees?${scopeQuery}limit=500`, { headers }),
      ]);

      if (revRes.status === 'fulfilled' && revRes.value.ok) {
        const data = await revRes.value.json();
        setReviews(data.reviews || []);
      }

      if (empRes.status === 'fulfilled' && empRes.value.ok) {
        const data = await empRes.value.json();
        setEmployees(data.employees || []);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load performance data');
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);
  const cid = effectiveCompanyId();
  const scopeQuery = cid ? `companyId=${cid}&` : '';


  useEffect(() => { queueMicrotask(() => fetchData()); }, [fetchData]);

  /* Unique cycles for filter */
  const uniqueCycles = Array.from(new Set(reviews.map(r => r.reviewCycle).filter(Boolean)));

  /* Filtered reviews */
  const filteredReviews = reviews.filter(r => {
    const matchSearch = !search ||
      r.employee?.firstName?.toLowerCase().includes(search.toLowerCase()) ||
      r.employee?.lastName?.toLowerCase().includes(search.toLowerCase()) ||
      r.reviewCycle.toLowerCase().includes(search.toLowerCase()) ||
      r.status.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !filterStatus || r.status === filterStatus;
    const matchCycle = !filterCycle || r.reviewCycle === filterCycle;
    return matchSearch && matchStatus && matchCycle;
  });

  /* Show Add Form */
  const handleShowAddForm = () => {
    setForm(initialForm);
    setEditingId(null);
    setShowForm(true);
    setTimeout(() => {
      document.getElementById('crud-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  /* Show Edit Form */
  const handleShowEditForm = (review: PerformanceReview) => {
    setForm({
      employeeId: review.employeeId,
      reviewerId: review.reviewerId || '',
      reviewCycle: review.reviewCycle,
      reviewPeriod: review.reviewPeriod || '',
      goalsRating: review.goalsRating,
      competenciesRating: review.skillsRating,
      behaviorRating: review.behaviorRating,
      overallRating: review.overallRating,
      comments: review.comments || '',
      status: review.status,
    });
    setEditingId(review.id);
    setShowForm(true);
    setTimeout(() => {
      document.getElementById('crud-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  /* Cancel Form */
  const handleCancelForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(initialForm);
  };

  /* Submit Form */
  const handleSubmit = async () => {
    if (!form.employeeId || !form.reviewCycle) {
      toast.error('Please fill in required fields: Employee, Review Cycle');
      return;
    }

    try {
      setSubmitting(true);
      const headers = getAuthHeaders();

      const payload = {
        employeeId: form.employeeId,
        reviewerId: form.reviewerId || null,
        reviewCycle: form.reviewCycle,
        reviewPeriod: form.reviewPeriod || null,
        goalsRating: form.goalsRating,
        skillsRating: form.competenciesRating,
        behaviorRating: form.behaviorRating,
        overallRating: form.overallRating,
        rating: form.overallRating,
        comments: form.comments || null,
        status: form.status,
      };

      if (editingId) {
        const res = await fetch(`/api/performance/${editingId}?${scopeQuery}` , {
          method: 'PUT',
          headers,
          body: JSON.stringify(payload),
        });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed'); }
        toast.success('Review updated successfully');
      } else {
        const res = await fetch(`/api/performance?${scopeQuery}` , {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
        });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed'); }
        toast.success('Review created successfully');
      }

      handleCancelForm();
      fetchData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Operation failed');
    } finally {
      setSubmitting(false);
    }
  };

  /* Delete Review */
  const handleDelete = async (id: string) => {
    try {
      setDeleting(true);
      const res = await fetch(`/api/performance/${id}?${scopeQuery}` , {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed'); }
      toast.success('Review deleted successfully');
      setDeleteConfirmId(null);
      fetchData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete review');
    } finally {
      setDeleting(false);
    }
  };

  const colCount = 7;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-thb-text-primary flex items-center gap-2">
            <FiTrendingUp className="w-6 h-6 text-amber-500" />
            Performance
          </h1>
          <p className="text-thb-text-secondary mt-1">Track performance reviews and ratings</p>
        </div>
        {isAdmin && (
          <button onClick={handleShowAddForm} className="inline-flex items-center gap-2 px-4 py-2.5 bg-green-500 text-white rounded-lg hover:bg-green-600 font-medium text-sm shadow-sm shadow-green-500/25 transition-colors">
            <FiPlus className="w-4 h-4" />
            Create Review
          </button>
        )}
      </div>

      {/* Module Tips */}
      <ModuleTips
        moduleKey="performance"
        title="Performance Tips"
        tips={performanceTips}
        userRole={user?.role}
      />

      {/* Module Workflow */}
      <ModuleWorkflow
        moduleKey="performance"
        title="How to Conduct Performance Reviews"
        subtitle="Follow this workflow to ensure fair and comprehensive evaluations"
        steps={performanceWorkflowSteps}
        accentColor="amber"
        userRole={user?.role}
      />

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-thb-text-muted" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search employees, cycles..."
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
          />
        </div>
        <div className="flex items-center gap-2">
          <FiFilter className="w-4 h-4 text-thb-text-muted" />
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400">
            <option value="">All Status</option>
            <option value="draft">Draft</option>
            <option value="in_review">In Review</option>
            <option value="completed">Completed</option>
            <option value="acknowledged">Acknowledged</option>
          </select>
          <select value={filterCycle} onChange={e => setFilterCycle(e.target.value)} className="px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400">
            <option value="">All Cycles</option>
            {uniqueCycles.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {/* Embedded CRUD Form */}
      {showForm && (
        <div id="crud-form" className="thb-card border-l-4 border-l-green-500 animate-slide-in-down">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-thb-text-primary">
                {editingId ? 'Edit Review' : 'Create Review'}
              </h2>
              <button onClick={handleCancelForm} className="p-2 rounded-lg text-thb-text-muted hover:text-thb-text-primary hover:bg-slate-100 transition-colors">
                <FiX className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Employee {!editingId && '*'}</label>
                <select
                  value={form.employeeId}
                  onChange={e => setForm(p => ({ ...p, employeeId: e.target.value }))}
                  disabled={!!editingId}
                  className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 disabled:bg-slate-50 disabled:text-thb-text-muted"
                >
                  <option value="">Select Employee</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.firstName} {emp.lastName} ({emp.employeeId})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Reviewer</label>
                <select
                  value={form.reviewerId}
                  onChange={e => setForm(p => ({ ...p, reviewerId: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                >
                  <option value="">Select Reviewer</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.firstName} {emp.lastName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Review Cycle <span className="text-red-500 font-bold">*</span></label>
                <input
                  type="text"
                  value={form.reviewCycle}
                  onChange={e => setForm(p => ({ ...p, reviewCycle: e.target.value }))}
                  placeholder="e.g., Q1 2026, Annual 2026"
                  className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Review Period</label>
                <input
                  type="text"
                  value={form.reviewPeriod}
                  onChange={e => setForm(p => ({ ...p, reviewPeriod: e.target.value }))}
                  placeholder="e.g., Jan-Mar 2026"
                  className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Goals Rating (1-5)</label>
                <select
                  value={form.goalsRating}
                  onChange={e => setForm(p => ({ ...p, goalsRating: Number(e.target.value) }))}
                  className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                >
                  {[1, 2, 3, 4, 5].map(v => <option key={v} value={v}>{v} - {v <= 2 ? 'Needs Improvement' : v === 3 ? 'Meets Expectations' : v === 4 ? 'Exceeds' : 'Outstanding'}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Competencies Rating (1-5)</label>
                <select
                  value={form.competenciesRating}
                  onChange={e => setForm(p => ({ ...p, competenciesRating: Number(e.target.value) }))}
                  className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                >
                  {[1, 2, 3, 4, 5].map(v => <option key={v} value={v}>{v} - {v <= 2 ? 'Needs Improvement' : v === 3 ? 'Meets Expectations' : v === 4 ? 'Exceeds' : 'Outstanding'}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Behavior Rating (1-5)</label>
                <select
                  value={form.behaviorRating}
                  onChange={e => setForm(p => ({ ...p, behaviorRating: Number(e.target.value) }))}
                  className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                >
                  {[1, 2, 3, 4, 5].map(v => <option key={v} value={v}>{v} - {v <= 2 ? 'Needs Improvement' : v === 3 ? 'Meets Expectations' : v === 4 ? 'Exceeds' : 'Outstanding'}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Overall Rating (1-5)</label>
                <select
                  value={form.overallRating}
                  onChange={e => setForm(p => ({ ...p, overallRating: Number(e.target.value) }))}
                  className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                >
                  {[1, 2, 3, 4, 5].map(v => <option key={v} value={v}>{v} - {v <= 2 ? 'Needs Improvement' : v === 3 ? 'Meets Expectations' : v === 4 ? 'Exceeds' : 'Outstanding'}</option>)}
                </select>
              </div>
              {editingId && (
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Status</label>
                  <select
                    value={form.status}
                    onChange={e => setForm(p => ({ ...p, status: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                  >
                    <option value="draft">Draft</option>
                    <option value="in_review">In Review</option>
                    <option value="completed">Completed</option>
                    <option value="acknowledged">Acknowledged</option>
                  </select>
                </div>
              )}
              <div className={editingId ? '' : 'sm:col-span-2'}>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Comments</label>
                <textarea
                  rows={2}
                  value={form.comments}
                  onChange={e => setForm(p => ({ ...p, comments: e.target.value }))}
                  placeholder="Review comments..."
                  className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 resize-none"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-thb-border">
              <button onClick={handleCancelForm} className="px-4 py-2.5 rounded-lg border border-thb-border text-sm font-medium text-thb-text-secondary hover:bg-slate-50 transition-colors">Cancel</button>
              <button onClick={handleSubmit} disabled={submitting} className="px-6 py-2.5 rounded-lg bg-green-500 text-white text-sm font-medium hover:bg-green-600 disabled:opacity-50 shadow-sm shadow-green-500/25 transition-colors">
                {submitting ? 'Saving...' : editingId ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reviews Table */}
      <div className="thb-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-thb-border bg-slate-50/50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Employee</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Reviewer</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Cycle</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Overall Rating</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Comments</th>
                {isAdmin && (
                  <th className="text-right px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Actions</th>
                )}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-thb-border/50 animate-pulse">
                    <td className="px-4 py-3"><div className="h-3 w-28 bg-slate-200 rounded" /></td>
                    <td className="px-4 py-3"><div className="h-3 w-24 bg-slate-200 rounded" /></td>
                    <td className="px-4 py-3"><div className="h-3 w-20 bg-slate-200 rounded" /></td>
                    <td className="px-4 py-3"><div className="h-3 w-24 bg-slate-200 rounded" /></td>
                    <td className="px-4 py-3"><div className="h-5 w-16 bg-slate-200 rounded-full" /></td>
                    <td className="px-4 py-3"><div className="h-3 w-32 bg-slate-200 rounded" /></td>
                    {isAdmin && <td className="px-4 py-3"><div className="h-3 w-16 bg-slate-200 rounded ml-auto" /></td>}
                  </tr>
                ))
              ) : filteredReviews.length === 0 ? (
                <tr>
                  <td colSpan={colCount} className="px-4 py-12 text-center">
                    <FiTrendingUp className="w-10 h-10 text-thb-text-muted mx-auto mb-3" />
                    <p className="text-thb-text-secondary font-medium">No performance reviews found</p>
                    <p className="text-sm text-thb-text-muted mt-1">Create reviews to track employee performance</p>
                  </td>
                </tr>
              ) : (
                filteredReviews.map(r => {
                  const statusBadge = getStatusBadge(r.status);
                  return (
                    <tr key={r.id} className="border-b border-thb-border/50 hover:bg-slate-50/50 transition-colors">
                      {deleteConfirmId === r.id ? (
                        <td colSpan={colCount} className="px-4 py-3 bg-red-50">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-red-700 font-medium">Are you sure you want to delete this review for {r.employee?.firstName} {r.employee?.lastName}?</span>
                            <div className="flex items-center gap-2">
                              <button onClick={() => handleDelete(r.id)} disabled={deleting} className="px-3 py-1.5 bg-red-500 text-white text-xs font-medium rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors">
                                {deleting ? 'Deleting...' : 'Confirm'}
                              </button>
                              <button onClick={() => setDeleteConfirmId(null)} className="px-3 py-1.5 border border-thb-border text-xs font-medium rounded-lg hover:bg-slate-50 transition-colors">Cancel</button>
                            </div>
                          </div>
                        </td>
                      ) : (
                        <>
                          <td className="px-4 py-3">
                            <p className="text-sm font-medium text-thb-text-primary">
                              {r.employee ? `${r.employee.firstName} ${r.employee.lastName}` : 'Unknown'}
                            </p>
                            {r.employee && <p className="text-xs text-thb-text-muted">{r.employee.employeeId}</p>}
                          </td>
                          <td className="px-4 py-3 text-sm text-thb-text-secondary">
                            {r.reviewer ? `${r.reviewer.firstName} ${r.reviewer.lastName}` : '—'}
                          </td>
                          <td className="px-4 py-3 text-sm text-thb-text-secondary">{r.reviewCycle}</td>
                          <td className="px-4 py-3">{renderStars(r.overallRating)}</td>
                          <td className="px-4 py-3"><span className={statusBadge.className}>{statusBadge.label}</span></td>
                          <td className="px-4 py-3 text-sm text-thb-text-secondary truncate max-w-[150px]">{r.comments || '—'}</td>
                          {isAdmin && (
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-end gap-1">
                                <button onClick={() => handleShowEditForm(r)} className="p-2 rounded-lg text-thb-text-muted hover:text-green-500 hover:bg-green-50 transition-colors" title="Edit">
                                  <FiEdit2 className="w-4 h-4" />
                                </button>
                                <button onClick={() => setDeleteConfirmId(r.id)} className="p-2 rounded-lg text-thb-text-muted hover:text-red-500 hover:bg-red-50 transition-colors" title="Delete">
                                  <FiTrash2 className="w-4 h-4" />
                                </button>
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
    </div>
  );
}
