'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  FiBookOpen,
  FiPlus,
  FiX,
  FiEdit2,
  FiTrash2,
  FiSearch,
  FiFilter,
  FiUsers,
  FiMapPin,
  FiCalendar,
  FiPlay,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import ModuleTips from '@/components/ModuleTips';
import ModuleWorkflow from '@/components/ModuleWorkflow';
import { useCompanyContextStore } from '@/store/companyContextStore';

/* ── Types ── */
interface Training {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  trainer: string | null;
  startDate: string;
  endDate: string | null;
  location: string | null;
  mode: string;
  status: string;
  maxParticipants: number | null;
  cost: number | null;
  enrollments: { id: string; employeeId: string; status: string; employee?: { firstName: string; lastName: string } }[];
  _count?: { enrollments: number };
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
    upcoming: 'bg-green-50 text-green-700 thb-badge',
    ongoing: 'thb-badge thb-badge-warning',
    completed: 'thb-badge thb-badge-success',
    cancelled: 'thb-badge thb-badge-error',
  };
  const labels: Record<string, string> = {
    upcoming: 'Upcoming',
    ongoing: 'Ongoing',
    completed: 'Completed',
    cancelled: 'Cancelled',
  };
  return { className: map[status] || 'thb-badge thb-badge-info', label: labels[status] || status };
}

function getModeBadge(mode: string) {
  const map: Record<string, string> = {
    online: 'bg-teal-50 text-teal-700 thb-badge',
    offline: 'bg-rose-50 text-rose-700 thb-badge',
    hybrid: 'bg-amber-50 text-amber-700 thb-badge',
  };
  const labels: Record<string, string> = {
    online: 'Online',
    offline: 'Offline',
    hybrid: 'Hybrid',
  };
  return { className: map[mode] || 'thb-badge thb-badge-info', label: labels[mode] || mode };
}

function getCategoryBadge(category: string) {
  const map: Record<string, string> = {
    technical: 'bg-green-50 text-green-700 thb-badge',
    soft_skills: 'bg-emerald-50 text-emerald-700 thb-badge',
    compliance: 'bg-rose-50 text-rose-700 thb-badge',
    leadership: 'bg-amber-50 text-amber-700 thb-badge',
    onboarding: 'bg-teal-50 text-teal-700 thb-badge',
  };
  const labels: Record<string, string> = {
    technical: 'Technical',
    soft_skills: 'Soft Skills',
    compliance: 'Compliance',
    leadership: 'Leadership',
    onboarding: 'Onboarding',
  };
  return { className: map[category] || 'thb-badge thb-badge-info', label: labels[category] || category };
}

const trainingTips = [
  { title: 'Categorize Trainings', description: 'Use categories like Technical, Soft Skills, Compliance, and Leadership to organize training programs' },
  { title: 'Set Capacity Limits', description: 'Define max participants to avoid over-enrollment and ensure quality training delivery' },
  { title: 'Choose the Right Mode', description: 'Select Online, Offline, or Hybrid mode based on the training content and audience location' },
  { title: 'Enroll Proactively', description: 'Enroll employees in upcoming trainings early so they can plan their schedules accordingly' },
  { title: 'Track Completion', description: 'Monitor training status from Upcoming to Completed to ensure all programs are delivered on time' },
];

const trainingWorkflowSteps = [
  { step: 1, title: 'Plan Training', description: 'Define the training title, category, and learning objectives', route: '/training' },
  { step: 2, title: 'Set Schedule', description: 'Choose start and end dates, and select the delivery mode' },
  { step: 3, title: 'Assign Trainer', description: 'Designate a trainer or instructor for the program' },
  { step: 4, title: 'Set Capacity', description: 'Define maximum participants if the training has limited seats' },
  { step: 5, title: 'Enroll Employees', description: 'Enroll participants into the training program', route: '/training' },
  { step: 6, title: 'Deliver Training', description: 'Conduct the training sessions as scheduled' },
  { step: 7, title: 'Mark Completed', description: 'Update the training status to Completed after all sessions finish' },
];

const initialForm = {
  title: '',
  description: '',
  category: 'technical',
  trainer: '',
  startDate: '',
  endDate: '',
  mode: 'online',
  status: 'upcoming',
  maxParticipants: '',
};

/* ── Component ── */
export default function TrainingPage() {
  const { user } = useAuthStore();
  const effectiveCompanyId = useCompanyContextStore(s => s.effectiveCompanyId);
  const isAdmin = ['super_admin', 'tenant_admin', 'admin'].includes(user?.role || '');

  const [trainings, setTrainings] = useState<Training[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterMode, setFilterMode] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [enrollTrainingId, setEnrollTrainingId] = useState<string | null>(null);
  const [enrollEmpId, setEnrollEmpId] = useState('');
  const [enrolling, setEnrolling] = useState(false);

  /* Fetch data */
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const headers = getAuthHeaders();
      const params = new URLSearchParams();
      params.set('limit', '100');
      if (filterCategory) params.set('category', filterCategory);
      if (filterStatus) params.set('status', filterStatus);

      const [trainRes, empRes] = await Promise.allSettled([
        fetch(`/api/training?${scopeQuery}${params.toString()}` , { headers }),
        fetch(`/api/employees?${scopeQuery}limit=500`, { headers }),
      ]);

      if (trainRes.status === 'fulfilled' && trainRes.value.ok) {
        const data = await trainRes.value.json();
        setTrainings(data.trainings || []);
      }

      if (empRes.status === 'fulfilled' && empRes.value.ok) {
        const data = await empRes.value.json();
        setEmployees(data.employees || []);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load training data');
    } finally {
      setLoading(false);
    }
  }, [filterCategory, filterStatus]);
  const cid = effectiveCompanyId();
  const scopeQuery = cid ? `companyId=${cid}&` : '';


  useEffect(() => { queueMicrotask(() => fetchData()); }, [fetchData]);

  /* Filtered trainings (client-side search) */
  const filteredTrainings = trainings.filter(t => {
    const matchSearch = !search ||
      t.title.toLowerCase().includes(search.toLowerCase()) ||
      t.category?.toLowerCase().includes(search.toLowerCase()) ||
      t.trainer?.toLowerCase().includes(search.toLowerCase()) ||
      t.status.toLowerCase().includes(search.toLowerCase());
    const matchMode = !filterMode || t.mode === filterMode;
    return matchSearch && matchMode;
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
  const handleShowEditForm = (training: Training) => {
    setForm({
      title: training.title,
      description: training.description || '',
      category: training.category || 'technical',
      trainer: training.trainer || '',
      startDate: training.startDate ? new Date(training.startDate).toISOString().split('T')[0] : '',
      endDate: training.endDate ? new Date(training.endDate).toISOString().split('T')[0] : '',
      mode: training.mode,
      status: training.status,
      maxParticipants: training.maxParticipants?.toString() || '',
    });
    setEditingId(training.id);
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
    if (!form.title || !form.startDate) {
      toast.error('Please fill in required fields: Title, Start Date');
      return;
    }

    try {
      setSubmitting(true);
      const headers = getAuthHeaders();

      const payload = {
        title: form.title,
        description: form.description || null,
        category: form.category,
        trainer: form.trainer || null,
        startDate: form.startDate,
        endDate: form.endDate || null,
        mode: form.mode,
        status: form.status,
        maxParticipants: form.maxParticipants ? parseInt(form.maxParticipants) : null,
      };

      if (editingId) {
        const res = await fetch(`/api/training/${editingId}?${scopeQuery}` , {
          method: 'PUT',
          headers,
          body: JSON.stringify(payload),
        });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed'); }
        toast.success('Training updated successfully');
      } else {
        const res = await fetch(`/api/training?${scopeQuery}` , {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
        });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed'); }
        toast.success('Training created successfully');
      }

      handleCancelForm();
      fetchData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Operation failed');
    } finally {
      setSubmitting(false);
    }
  };

  /* Delete Training */
  const handleDelete = async (id: string) => {
    try {
      setDeleting(true);
      const res = await fetch(`/api/training/${id}?${scopeQuery}` , {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed'); }
      toast.success('Training deleted successfully');
      setDeleteConfirmId(null);
      fetchData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete training');
    } finally {
      setDeleting(false);
    }
  };

  /* Enroll Employee */
  const handleEnroll = async () => {
    if (!enrollTrainingId || !enrollEmpId) { toast.error('Select an employee'); return; }
    try {
      setEnrolling(true);
      const res = await fetch(`/api/training/${enrollTrainingId}?${scopeQuery}` , {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ action: 'enroll', employeeId: enrollEmpId }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed'); }
      toast.success('Employee enrolled successfully');
      setEnrollTrainingId(null);
      setEnrollEmpId('');
      fetchData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to enroll');
    } finally {
      setEnrolling(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-thb-text-primary flex items-center gap-2">
            <FiBookOpen className="w-6 h-6 text-teal-500" />
            Training
          </h1>
          <p className="text-thb-text-secondary mt-1">Manage training programs and enrollments</p>
        </div>
        {isAdmin && (
          <button onClick={handleShowAddForm} className="inline-flex items-center gap-2 px-4 py-2.5 bg-green-500 text-white rounded-lg hover:bg-green-600 font-medium text-sm shadow-sm shadow-green-500/25 transition-colors">
            <FiPlus className="w-4 h-4" />
            Add Training
          </button>
        )}
      </div>

      {/* Module Tips */}
      <ModuleTips
        moduleKey="training"
        title="Training Tips"
        tips={trainingTips}
        userRole={user?.role}
      />

      {/* Module Workflow */}
      <ModuleWorkflow
        moduleKey="training"
        title="How to Set Up Training Programs"
        subtitle="Follow this workflow to create and deliver effective training"
        steps={trainingWorkflowSteps}
        accentColor="violet"
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
            placeholder="Search trainings, categories, trainers..."
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
          />
        </div>
        <div className="flex items-center gap-2">
          <FiFilter className="w-4 h-4 text-thb-text-muted" />
          <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400">
            <option value="">All Categories</option>
            <option value="technical">Technical</option>
            <option value="soft_skills">Soft Skills</option>
            <option value="compliance">Compliance</option>
            <option value="leadership">Leadership</option>
            <option value="onboarding">Onboarding</option>
          </select>
          <select value={filterMode} onChange={e => setFilterMode(e.target.value)} className="px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400">
            <option value="">All Modes</option>
            <option value="online">Online</option>
            <option value="offline">Offline</option>
            <option value="hybrid">Hybrid</option>
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400">
            <option value="">All Status</option>
            <option value="upcoming">Upcoming</option>
            <option value="ongoing">Ongoing</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Embedded CRUD Form */}
      {showForm && (
        <div id="crud-form" className="thb-card border-l-4 border-l-green-500 animate-slide-in-down">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-thb-text-primary">
                {editingId ? 'Edit Training' : 'Add Training'}
              </h2>
              <button onClick={handleCancelForm} className="p-2 rounded-lg text-thb-text-muted hover:text-thb-text-primary hover:bg-slate-100 transition-colors">
                <FiX className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Title *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                  placeholder="Training title"
                  className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Category *</label>
                <select
                  value={form.category}
                  onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                >
                  <option value="technical">Technical</option>
                  <option value="soft_skills">Soft Skills</option>
                  <option value="compliance">Compliance</option>
                  <option value="leadership">Leadership</option>
                  <option value="onboarding">Onboarding</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Trainer</label>
                <input
                  type="text"
                  value={form.trainer}
                  onChange={e => setForm(p => ({ ...p, trainer: e.target.value }))}
                  placeholder="Trainer name"
                  className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Start Date *</label>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={e => setForm(p => ({ ...p, startDate: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">End Date</label>
                <input
                  type="date"
                  value={form.endDate}
                  onChange={e => setForm(p => ({ ...p, endDate: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Mode *</label>
                <select
                  value={form.mode}
                  onChange={e => setForm(p => ({ ...p, mode: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                >
                  <option value="online">Online</option>
                  <option value="offline">Offline</option>
                  <option value="hybrid">Hybrid</option>
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
                    <option value="upcoming">Upcoming</option>
                    <option value="ongoing">Ongoing</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Max Participants</label>
                <input
                  type="number"
                  value={form.maxParticipants}
                  onChange={e => setForm(p => ({ ...p, maxParticipants: e.target.value }))}
                  placeholder="Leave empty for unlimited"
                  className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                />
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Description</label>
                <textarea
                  rows={2}
                  value={form.description}
                  onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="Training description..."
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

      {/* Enroll Employee Inline */}
      {enrollTrainingId && (
        <div className="thb-card border-l-4 border-l-teal-500 animate-slide-in-down">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-thb-text-primary">Enroll Employee</h2>
              <button onClick={() => { setEnrollTrainingId(null); setEnrollEmpId(''); }} className="p-2 rounded-lg text-thb-text-muted hover:text-thb-text-primary hover:bg-slate-100 transition-colors">
                <FiX className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Select Employee</label>
                <select
                  value={enrollEmpId}
                  onChange={e => setEnrollEmpId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                >
                  <option value="">Select Employee</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.firstName} {emp.lastName} ({emp.employeeId})
                    </option>
                  ))}
                </select>
              </div>
              <button onClick={handleEnroll} disabled={enrolling || !enrollEmpId} className="px-6 py-2.5 rounded-lg bg-teal-500 text-white text-sm font-medium hover:bg-teal-600 disabled:opacity-50 shadow-sm shadow-teal-500/25 transition-colors">
                {enrolling ? 'Enrolling...' : 'Enroll'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Training Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="thb-card p-6 animate-pulse">
              <div className="h-4 w-32 bg-slate-200 rounded mb-3" />
              <div className="h-3 w-20 bg-slate-200 rounded mb-2" />
              <div className="h-3 w-24 bg-slate-200 rounded mb-4" />
              <div className="flex gap-2"><div className="h-5 w-16 bg-slate-200 rounded-full" /><div className="h-5 w-16 bg-slate-200 rounded-full" /></div>
            </div>
          ))
        ) : filteredTrainings.length === 0 ? (
          <div className="sm:col-span-2 lg:col-span-3 text-center py-12 thb-card">
            <FiBookOpen className="w-10 h-10 text-thb-text-muted mx-auto mb-3" />
            <p className="text-thb-text-secondary font-medium">No training programs found</p>
            <p className="text-sm text-thb-text-muted mt-1">Create training programs to upskill your workforce</p>
          </div>
        ) : (
          filteredTrainings.map(t => {
            const statusBadge = getStatusBadge(t.status);
            const modeBadge = getModeBadge(t.mode);
            const categoryBadge = getCategoryBadge(t.category || '');
            const enrolledCount = t.enrollments?.length || t._count?.enrollments || 0;
            const isDeleteConfirm = deleteConfirmId === t.id;

            return (
              <div key={t.id} className={`thb-card thb-card-hover overflow-hidden ${isDeleteConfirm ? 'ring-2 ring-red-300' : ''}`}>
                {isDeleteConfirm ? (
                  <div className="p-6 bg-red-50">
                    <p className="text-sm text-red-700 font-medium mb-3">Are you sure you want to delete &quot;{t.title}&quot;?</p>
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleDelete(t.id)} disabled={deleting} className="px-3 py-1.5 bg-red-500 text-white text-xs font-medium rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors">
                        {deleting ? 'Deleting...' : 'Confirm'}
                      </button>
                      <button onClick={() => setDeleteConfirmId(null)} className="px-3 py-1.5 border border-thb-border text-xs font-medium rounded-lg hover:bg-slate-50 transition-colors">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="p-5">
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="text-sm font-semibold text-thb-text-primary line-clamp-2">{t.title}</h3>
                        <span className={statusBadge.className}>{statusBadge.label}</span>
                      </div>
                      {t.description && <p className="text-xs text-thb-text-secondary mb-3 line-clamp-2">{t.description}</p>}
                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        <span className={categoryBadge.className}>{categoryBadge.label}</span>
                        <span className={modeBadge.className}>{modeBadge.label}</span>
                      </div>
                      <div className="space-y-1.5 mb-3">
                        {t.trainer && (
                          <div className="flex items-center gap-2 text-xs text-thb-text-secondary">
                            <FiUsers className="w-3 h-3 flex-shrink-0" />
                            <span>{t.trainer}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2 text-xs text-thb-text-secondary">
                          <FiCalendar className="w-3 h-3 flex-shrink-0" />
                          <span>{formatDate(t.startDate)} — {formatDate(t.endDate)}</span>
                        </div>
                        {t.location && (
                          <div className="flex items-center gap-2 text-xs text-thb-text-secondary">
                            <FiMapPin className="w-3 h-3 flex-shrink-0" />
                            <span>{t.location}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between px-5 py-3 border-t border-thb-border/50 bg-slate-50/50">
                      <div className="flex items-center gap-1 text-xs text-thb-text-muted">
                        <FiUsers className="w-3.5 h-3.5" />
                        <span>{enrolledCount}{t.maxParticipants ? `/${t.maxParticipants}` : ''} enrolled</span>
                      </div>
                      {isAdmin && (
                        <div className="flex items-center gap-1">
                          {t.status !== 'completed' && t.status !== 'cancelled' && (
                            <button onClick={() => { setEnrollTrainingId(t.id); setEnrollEmpId(''); }} className="p-1.5 rounded-lg text-thb-text-muted hover:text-teal-500 hover:bg-teal-50 transition-colors" title="Enroll">
                              <FiPlay className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button onClick={() => handleShowEditForm(t)} className="p-1.5 rounded-lg text-thb-text-muted hover:text-green-500 hover:bg-green-50 transition-colors" title="Edit">
                            <FiEdit2 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => setDeleteConfirmId(t.id)} className="p-1.5 rounded-lg text-thb-text-muted hover:text-red-500 hover:bg-red-50 transition-colors" title="Delete">
                            <FiTrash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
