'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import Link from 'next/link';
import {
  FiUserPlus,
  FiPlus,
  FiX,
  FiEdit2,
  FiTrash2,
  FiSearch,
  FiFilter,
  FiCheck,
  FiUserCheck,
  FiLink,
  FiGrid, FiFileText, FiSettings, FiBarChart2,
} from 'react-icons/fi';
import ModuleDashboardShell, { DashboardTabConfig } from '@/components/ModuleDashboardShell';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import ModuleTips from '@/components/ModuleTips';
import ModuleWorkflow from '@/components/ModuleWorkflow';

/* ── Types ── */
interface OnboardingTask {
  id: string;
  task: string;
  category: string;
  status: string;
  dueDate: string | null;
  completedDate: string | null;
  notes: string | null;
  employeeId: string;
  assignedBy: string | null;
  // ─── REQ-ONB-08/09: cascade wiring ───
  preboardingCandidateId?: string | null;
  templateId?: string | null;
  buddyEmployeeId?: string | null;
  employee?: {
    id: string;
    firstName: string;
    lastName: string;
    employeeId: string;
    avatar?: string | null;
  };
}

interface OnboardingTaskTemplate {
  id: string;
  name: string;
  category: string;
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
    pending: 'thb-badge thb-badge-warning',
    in_progress: 'bg-cyan-50 text-cyan-700 thb-badge',
    completed: 'thb-badge thb-badge-success',
    skipped: 'bg-slate-100 text-slate-600 thb-badge',
  };
  const labels: Record<string, string> = {
    pending: 'Pending',
    in_progress: 'In Progress',
    completed: 'Completed',
    skipped: 'Skipped',
  };
  return { className: map[status] || 'thb-badge thb-badge-info', label: labels[status] || status };
}

function getCategoryBadge(category: string) {
  const map: Record<string, string> = {
    general: 'bg-slate-50 text-slate-700 thb-badge',
    documentation: 'bg-green-50 text-green-700 thb-badge',
    it_setup: 'bg-teal-50 text-teal-700 thb-badge',
    training: 'bg-amber-50 text-amber-700 thb-badge',
    compliance: 'bg-rose-50 text-rose-700 thb-badge',
  };
  const labels: Record<string, string> = {
    general: 'General',
    documentation: 'Documentation',
    it_setup: 'IT Setup',
    training: 'Training',
    compliance: 'Compliance',
  };
  return { className: map[category] || 'thb-badge thb-badge-info', label: labels[category] || category };
}

const onboardingTips = [
  { title: 'Create Task Templates', description: 'Set up onboarding task templates for common roles to speed up new hire setup' },
  { title: 'Assign by Category', description: 'Categorize tasks as General, Documentation, IT Setup, Training, or Compliance for organized tracking' },
  { title: 'Set Due Dates', description: 'Always set due dates for onboarding tasks to ensure timely completion' },
  { title: 'Complete All Before Active', description: 'Ensure all onboarding tasks are completed before moving the employee to Active status' },
  { title: 'Use Notes for Context', description: 'Add notes to tasks to provide instructions or context for the assignee' },
];

const onboardingWorkflowSteps = [
  { step: 1, title: 'Create Employee', description: 'Add the new employee to the system with basic details', route: '/employees' },
  { step: 2, title: 'Setup Onboarding Tasks', description: 'Create onboarding tasks assigned to the new employee', route: '/onboarding' },
  { step: 3, title: 'Complete Documentation', description: 'Complete all documentation-related onboarding tasks' },
  { step: 4, title: 'Complete IT Setup', description: 'Set up email, workstation, and system access' },
  { step: 5, title: 'Complete Training', description: 'Finish all mandatory training tasks' },
  { step: 6, title: 'Complete Compliance', description: 'Verify all compliance and policy acknowledgements' },
  { step: 7, title: 'Mark All Complete', description: 'Ensure all tasks are marked as completed' },
  { step: 8, title: 'Activate Employee', description: 'Move employee status to Active after all tasks are done', route: '/employees' },
];

const initialForm = {
  employeeId: '',
  task: '',
  category: 'general',
  dueDate: '',
  notes: '',
  status: 'pending',
  priority: 'medium',
  kra: '',
  trainingModule: '',
  mentorEmployeeId: '',
};

/* ── Placeholder Tabs ── */

const onboardingTabs: DashboardTabConfig[] = [
  { label: 'Overview', key: 'overview', icon: <FiGrid className="w-4 h-4" /> },
  { label: 'Reports', key: 'reports', icon: <FiFileText className="w-4 h-4" />, isNew: true },
  { label: 'Settings', key: 'settings', icon: <FiSettings className="w-4 h-4" />, isNew: true },
];

function OnboardingReportsPlaceholder() {
  return (
    <div className="flex flex-col items-center py-8">
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg mb-4">
        <FiFileText className="w-7 h-7 text-white" />
      </div>
      <h3 className="text-lg font-bold text-thb-text-primary mb-1">Reports & Analytics</h3>
      <p className="text-sm text-thb-text-secondary text-center max-w-md mb-4">
        Onboarding progress reports, completion rates, and analytics
      </p>
      <a href="/onboarding/reports" className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors">
        <FiBarChart2 className="w-4 h-4" /> Go to Reports
      </a>
    </div>
  );
}

function OnboardingSettingsPlaceholder() {
  return (
    <div className="flex flex-col items-center py-8">
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-slate-500 to-slate-700 flex items-center justify-center shadow-lg mb-4">
        <FiSettings className="w-7 h-7 text-white" />
      </div>
      <h3 className="text-lg font-bold text-thb-text-primary mb-1">Settings & Configuration</h3>
      <p className="text-sm text-thb-text-secondary text-center max-w-md mb-4">
        Configure onboarding templates, task checklists, and buddy assignments
      </p>
      <a href="/onboarding/settings" className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors">
        <FiSettings className="w-4 h-4" /> Go to Settings
      </a>
    </div>
  );
}

function OnboardingPageContent() {
  return (
    <ModuleDashboardShell
      moduleKey="onboarding"
      moduleLabel="Onboarding"
      moduleIcon={<FiUserPlus className="w-5 h-5 text-white" />}
      gradientColor="from-emerald-500 to-teal-600"
      tabs={onboardingTabs}
      overviewContent={<OnboardingContent />}
      children={{
        reports: <OnboardingReportsPlaceholder />,
        settings: <OnboardingSettingsPlaceholder />,
      }}
    />
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-20"><div className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full" /></div>}>
      <OnboardingPageContent />
    </Suspense>
  );
}

/* ── Component ── */
function OnboardingContent() {
  const { user } = useAuthStore();
  const isAdmin = ['super_admin', 'tenant_admin', 'admin'].includes(user?.role || '');

  const [tasks, setTasks] = useState<OnboardingTask[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [completingId, setCompletingId] = useState<string | null>(null);
  const [templates, setTemplates] = useState<OnboardingTaskTemplate[]>([]);

  /* Fetch data */
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const headers = getAuthHeaders();

      const [tasksRes, empRes, tplRes] = await Promise.allSettled([
        fetch('/api/onboarding?limit=100', { headers }),
        fetch('/api/employees?limit=500', { headers }),
        fetch('/api/onboarding/templates?isActive=true', { headers }),
      ]);

      if (tasksRes.status === 'fulfilled' && tasksRes.value.ok) {
        const data = await tasksRes.value.json();
        setTasks(Array.isArray(data?.tasks) ? data.tasks : []);
      } else {
        setTasks([]);
      }

      if (empRes.status === 'fulfilled' && empRes.value.ok) {
        const data = await empRes.value.json();
        setEmployees(Array.isArray(data?.employees) ? data.employees : []);
      } else {
        setEmployees([]);
      }

      if (tplRes.status === 'fulfilled' && tplRes.value.ok) {
        const data = await tplRes.value.json();
        setTemplates(Array.isArray(data?.templates) ? data.templates : []);
      } else {
        setTemplates([]);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load onboarding data');
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { queueMicrotask(() => fetchData()); }, [fetchData]);

  /* Onboarding progress dashboard (per-employee completion) */
  const [progress, setProgress] = useState<{ summary: { newHires: number; avgCompletion: number; overdueTasks: number; fullyComplete: number }; rows: Array<{ employeeId: string; name: string; code: string; total: number; completed: number; overdue: number; completionPct: number; nextDue: { task: string; dueDate: string | null } | null }> }>({ summary: { newHires: 0, avgCompletion: 0, overdueTasks: 0, fullyComplete: 0 }, rows: [] });
  const fetchProgress = useCallback(async () => {
    try {
      const res = await fetch('/api/onboarding/progress', { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setProgress({ summary: data.summary, rows: data.rows || [] });
      }
    } catch { /* non-critical */ }
  }, []);
  useEffect(() => { queueMicrotask(() => fetchProgress()); }, [fetchProgress]);

  /* Filtered tasks */
  const filteredTasks = tasks.filter(t => {
    const matchSearch = !search ||
      t.task.toLowerCase().includes(search.toLowerCase()) ||
      t.employee?.firstName?.toLowerCase().includes(search.toLowerCase()) ||
      t.employee?.lastName?.toLowerCase().includes(search.toLowerCase()) ||
      t.category.toLowerCase().includes(search.toLowerCase());
    const matchCategory = !filterCategory || t.category === filterCategory;
    const matchStatus = !filterStatus || t.status === filterStatus;
    return matchSearch && matchCategory && matchStatus;
  });

  /* Summary stats */
  const totalTasks = tasks.length;
  const pendingCount = tasks.filter(t => t.status === 'pending').length;
  const inProgressCount = tasks.filter(t => t.status === 'in_progress').length;
  const completedCount = tasks.filter(t => t.status === 'completed').length;

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
  const handleShowEditForm = (task: OnboardingTask) => {
    setForm({
      employeeId: task.employeeId,
      task: task.task,
      category: task.category,
      dueDate: task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '',
      notes: task.notes || '',
      status: task.status,
      priority: (task as unknown as Record<string, unknown>).priority as string || 'medium',
      kra: (task as unknown as Record<string, unknown>).kra as string || '',
      trainingModule: (task as unknown as Record<string, unknown>).trainingModule as string || '',
      mentorEmployeeId: (task as unknown as Record<string, unknown>).mentorEmployeeId as string || '',
    });
    setEditingId(task.id);
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
    if (!form.task || !form.category) {
      toast.error('Please fill in required fields: Task, Category');
      return;
    }
    if (!editingId && !form.employeeId) {
      toast.error('Please select an employee');
      return;
    }

    try {
      setSubmitting(true);
      const headers = getAuthHeaders();

      if (editingId) {
        const res = await fetch(`/api/onboarding/${editingId}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({
            task: form.task,
            category: form.category,
            status: form.status,
            dueDate: form.dueDate || null,
            notes: form.notes || null,
            priority: form.priority,
            kra: form.kra || null,
            trainingModule: form.trainingModule || null,
            mentorEmployeeId: form.mentorEmployeeId || null,
          }),
        });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed'); }
        toast.success('Task updated successfully');
      } else {
        const res = await fetch('/api/onboarding', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            employeeId: form.employeeId,
            task: form.task,
            category: form.category,
            dueDate: form.dueDate || null,
            notes: form.notes || null,
            assignedBy: user?.name,
            priority: form.priority,
            kra: form.kra || null,
            trainingModule: form.trainingModule || null,
            mentorEmployeeId: form.mentorEmployeeId || null,
          }),
        });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed'); }
        toast.success('Task created successfully');
      }

      handleCancelForm();
      fetchData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Operation failed');
    } finally {
      setSubmitting(false);
    }
  };

  /* Delete Task */
  const handleDelete = async (id: string) => {
    try {
      setDeleting(true);
      const res = await fetch(`/api/onboarding/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed'); }
      toast.success('Task deleted successfully');
      setDeleteConfirmId(null);
      fetchData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete task');
    } finally {
      setDeleting(false);
    }
  };

  /* Mark Complete */
  const handleMarkComplete = async (id: string) => {
    try {
      setCompletingId(id);
      const res = await fetch(`/api/onboarding/${id}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ status: 'completed' }),
      });
      if (!res.ok) throw new Error('Failed');
      toast.success('Task marked as completed');
      fetchData();
    } catch {
      toast.error('Failed to complete task');
    } finally {
      setCompletingId(null);
    }
  };

  const colCount = 7;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-thb-text-primary flex items-center gap-2">
            <FiUserPlus className="w-6 h-6 text-emerald-500" />
            Onboarding
          </h1>
          <p className="text-thb-text-secondary mt-1">Manage onboarding tasks for new employees</p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <Link href="/onboarding/templates" className="px-4 py-2.5 rounded-lg border border-thb-border text-sm font-medium text-thb-text-secondary hover:bg-slate-50 transition-colors">
              Templates
            </Link>
            <button onClick={handleShowAddForm} className="inline-flex items-center gap-2 px-4 py-2.5 bg-green-500 text-white rounded-lg hover:bg-green-600 font-medium text-sm shadow-sm shadow-green-500/25 transition-colors">
              <FiPlus className="w-4 h-4" />
              Add Task
            </button>
          </div>
        )}
      </div>

      {/* Module Tips */}
      <ModuleTips
        moduleKey="onboarding"
        title="Onboarding Tips"
        tips={onboardingTips}
        userRole={user?.role}
      />

      {/* Module Workflow */}
      <ModuleWorkflow
        moduleKey="onboarding"
        title="How to Onboard a New Employee"
        subtitle="Follow this workflow to set up a new hire for success"
        steps={onboardingWorkflowSteps}
        accentColor="emerald"
        userRole={user?.role}
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="thb-card p-4">
          <p className="text-xs font-medium text-thb-text-secondary">Total Tasks</p>
          <p className="text-xl font-bold text-thb-text-primary mt-1">{totalTasks}</p>
        </div>
        <div className="thb-card p-4">
          <p className="text-xs font-medium text-thb-text-secondary">Pending</p>
          <p className="text-xl font-bold text-amber-600 mt-1">{pendingCount}</p>
        </div>
        <div className="thb-card p-4">
          <p className="text-xs font-medium text-thb-text-secondary">In Progress</p>
          <p className="text-xl font-bold text-cyan-600 mt-1">{inProgressCount}</p>
        </div>
        <div className="thb-card p-4">
          <p className="text-xs font-medium text-thb-text-secondary">Completed</p>
          <p className="text-xl font-bold text-emerald-600 mt-1">{completedCount}</p>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-thb-text-muted" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search tasks, employees..."
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
          />
        </div>
        <div className="flex items-center gap-2">
          <FiFilter className="w-4 h-4 text-thb-text-muted" />
          <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400">
            <option value="">All Categories</option>
            <option value="general">General</option>
            <option value="documentation">Documentation</option>
            <option value="it_setup">IT Setup</option>
            <option value="training">Training</option>
            <option value="compliance">Compliance</option>
            <option value="hr_docs">HR Docs</option>
            <option value="introduction">Introduction</option>
            <option value="buddy_setup">Buddy Setup</option>
            <option value="payroll_setup">Payroll Setup</option>
            <option value="project_allocation">Project Allocation</option>
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400">
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="skipped">Skipped</option>
          </select>
        </div>
      </div>

      {/* Embedded CRUD Form */}
      {showForm && (
        <div id="crud-form" className="thb-card border-l-4 border-l-green-500 animate-slide-in-down">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-thb-text-primary">
                {editingId ? 'Edit Task' : 'Add New Task'}
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
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Task <span className="text-red-500 font-bold">*</span></label>
                <input
                  type="text"
                  value={form.task}
                  onChange={e => setForm(p => ({ ...p, task: e.target.value }))}
                  placeholder="e.g., Complete IT orientation"
                  className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Category <span className="text-red-500 font-bold">*</span></label>
                <select
                  value={form.category}
                  onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                >
                  <option value="general">General</option>
                  <option value="documentation">Documentation</option>
                  <option value="it_setup">IT Setup</option>
                  <option value="training">Training</option>
                  <option value="compliance">Compliance</option>
                  <option value="hr_docs">HR Docs</option>
                  <option value="introduction">Introduction</option>
                  <option value="buddy_setup">Buddy Setup</option>
                  <option value="payroll_setup">Payroll Setup</option>
                  <option value="project_allocation">Project Allocation</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Due Date</label>
                <input
                  type="date"
                  value={form.dueDate}
                  onChange={e => setForm(p => ({ ...p, dueDate: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                />
              </div>
              {editingId && (
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Status</label>
                  <select
                    value={form.status}
                    onChange={e => setForm(p => ({ ...p, status: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                  >
                    <option value="pending">Pending</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="skipped">Skipped</option>
                  </select>
                </div>
              )}
              <div className={editingId ? '' : 'sm:col-span-2'}>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Notes</label>
                <input
                  type="text"
                  value={form.notes}
                  onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                  placeholder="Optional notes..."
                  className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                />
              </div>
              {/* ── Role Alignment ── */}
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Priority</label>
                <select
                  value={form.priority}
                  onChange={e => setForm(p => ({ ...p, priority: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm bg-white"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Training Module</label>
                <input
                  type="text"
                  value={form.trainingModule}
                  onChange={e => setForm(p => ({ ...p, trainingModule: e.target.value }))}
                  placeholder="e.g. Security Basics 101"
                  className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">KRA (Key Responsibility Area)</label>
                <input
                  type="text"
                  value={form.kra}
                  onChange={e => setForm(p => ({ ...p, kra: e.target.value }))}
                  placeholder="e.g. Own the release pipeline"
                  className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Mentor / Check-in Owner</label>
                <select
                  value={form.mentorEmployeeId}
                  onChange={e => setForm(p => ({ ...p, mentorEmployeeId: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm bg-white"
                >
                  <option value="">None</option>
                  {(employees as Array<Record<string, unknown>>).map(emp => (
                    <option key={String(emp.id)} value={String(emp.id)}>{String(emp.firstName || '')} {String(emp.lastName || '')}{emp.employeeId ? ` (${String(emp.employeeId)})` : ''}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-thb-border">
              <button onClick={handleCancelForm} className="px-4 py-2.5 rounded-lg border border-thb-border text-sm font-medium text-thb-text-secondary hover:bg-slate-50 transition-colors">Cancel</button>
              <button onClick={handleSubmit} disabled={submitting} className="px-6 py-2.5 rounded-lg bg-green-500 text-white text-sm font-medium hover:bg-green-600 disabled:opacity-50 shadow-sm shadow-green-500/25 transition-colors">
                {submitting ? 'Saving...' : editingId ? 'Update' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Onboarding Progress Dashboard */}
      {progress.rows.length > 0 && (
        <div className="thb-card p-5">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
            <div>
              <h3 className="text-sm font-semibold text-thb-text-primary flex items-center gap-2"><FiBarChart2 className="w-4 h-4 text-emerald-500" /> Onboarding Progress</h3>
              <p className="text-xs text-thb-text-muted mt-0.5">Real-time completion for every new hire — {progress.summary.avgCompletion}% average, {progress.summary.overdueTasks} overdue task(s)</p>
            </div>
            <span className="text-[10px] px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 font-medium">{progress.summary.fullyComplete}/{progress.summary.newHires} fully onboarded</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {progress.rows.slice(0, 8).map((r) => (
              <div key={r.employeeId} className="rounded-lg border border-thb-border p-3">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <p className="text-xs font-semibold text-thb-text-primary truncate">{r.name} <span className="text-thb-text-muted font-normal">· {r.code}</span></p>
                  <span className={`text-xs font-bold ${r.completionPct === 100 ? 'text-emerald-600' : r.completionPct >= 50 ? 'text-amber-600' : 'text-slate-500'}`}>{r.completionPct}%</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div className={`h-full rounded-full ${r.completionPct === 100 ? 'bg-emerald-500' : r.completionPct >= 50 ? 'bg-amber-400' : 'bg-teal-400'}`} style={{ width: `${r.completionPct}%` }} />
                </div>
                <p className="text-[10px] text-thb-text-muted mt-1.5">
                  {r.completed}/{r.total} done{r.overdue ? ` · ${r.overdue} overdue` : ''}{r.nextDue ? ` · next: ${r.nextDue.task.slice(0, 40)}${r.nextDue.task.length > 40 ? '…' : ''}` : ''}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tasks Table */}
      <div className="thb-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-thb-border bg-slate-50/50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Employee</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Task</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Category</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Due Date</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Notes</th>
                {isAdmin && (
                  <th className="text-right px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Actions</th>
                )}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-thb-border/50 animate-pulse">
                    <td className="px-4 py-3"><div className="h-3 w-24 bg-slate-200 rounded" /></td>
                    <td className="px-4 py-3"><div className="h-3 w-32 bg-slate-200 rounded" /></td>
                    <td className="px-4 py-3"><div className="h-5 w-16 bg-slate-200 rounded-full" /></td>
                    <td className="px-4 py-3"><div className="h-3 w-20 bg-slate-200 rounded" /></td>
                    <td className="px-4 py-3"><div className="h-5 w-16 bg-slate-200 rounded-full" /></td>
                    <td className="px-4 py-3"><div className="h-3 w-20 bg-slate-200 rounded" /></td>
                    {isAdmin && <td className="px-4 py-3"><div className="h-3 w-16 bg-slate-200 rounded ml-auto" /></td>}
                  </tr>
                ))
              ) : filteredTasks.length === 0 ? (
                <tr>
                  <td colSpan={colCount} className="px-4 py-12 text-center">
                    <FiUserPlus className="w-10 h-10 text-thb-text-muted mx-auto mb-3" />
                    <p className="text-thb-text-secondary font-medium">No onboarding tasks found</p>
                    <p className="text-sm text-thb-text-muted mt-1">Create tasks to track new employee onboarding</p>
                  </td>
                </tr>
              ) : (
                filteredTasks.map(t => {
                  const statusBadge = getStatusBadge(t.status);
                  const categoryBadge = getCategoryBadge(t.category);
                  return (
                    <tr key={t.id} className="border-b border-thb-border/50 hover:bg-slate-50/50 transition-colors">
                      {deleteConfirmId === t.id ? (
                        <td colSpan={colCount} className="px-4 py-3 bg-red-50">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-red-700 font-medium">Are you sure you want to delete &quot;{t.task}&quot;?</span>
                            <div className="flex items-center gap-2">
                              <button onClick={() => handleDelete(t.id)} disabled={deleting} className="px-3 py-1.5 bg-red-500 text-white text-xs font-medium rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors">
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
                              {t.employee ? `${t.employee.firstName} ${t.employee.lastName}` : '—'}
                            </p>
                            {t.employee && <p className="text-xs text-thb-text-muted">{t.employee.employeeId}</p>}
                            {t.buddyEmployeeId && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded mt-1">
                                <FiUserCheck className="w-2.5 h-2.5" />
                                Buddy: {t.buddyEmployeeId.slice(0, 8)}...
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-thb-text-primary">
                            {t.task}
                            {t.templateId && (() => {
                              const tplName = templates.find((tpl) => tpl.id === t.templateId)?.name;
                              return (
                                <span
                                  className="ml-2 inline-flex items-center gap-0.5 text-[9px] font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded"
                                  title={`Generated from template ${t.templateId}`}
                                >
                                  <FiLink className="w-2.5 h-2.5" />
                                  {tplName ? `from: ${tplName}` : 'template'}
                                </span>
                              );
                            })()}
                            {t.preboardingCandidateId && (
                              <p className="text-[10px] text-thb-text-muted mt-0.5" title="Originating preboarding candidate">
                                preboarding: {t.preboardingCandidateId.slice(0, 8)}...
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3"><span className={categoryBadge.className}>{categoryBadge.label}</span></td>
                          <td className="px-4 py-3 text-sm text-thb-text-secondary">{formatDate(t.dueDate)}</td>
                          <td className="px-4 py-3"><span className={statusBadge.className}>{statusBadge.label}</span></td>
                          <td className="px-4 py-3 text-sm text-thb-text-secondary truncate max-w-[150px]">{t.notes || '—'}</td>
                          {isAdmin && (
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-end gap-1">
                                {t.status !== 'completed' && (
                                  <button onClick={() => handleMarkComplete(t.id)} disabled={completingId === t.id} className="p-2 rounded-lg text-thb-text-muted hover:text-emerald-500 hover:bg-emerald-50 transition-colors" title="Mark Complete">
                                    <FiCheck className="w-4 h-4" />
                                  </button>
                                )}
                                <button onClick={() => handleShowEditForm(t)} className="p-2 rounded-lg text-thb-text-muted hover:text-green-500 hover:bg-green-50 transition-colors" title="Edit">
                                  <FiEdit2 className="w-4 h-4" />
                                </button>
                                <button onClick={() => setDeleteConfirmId(t.id)} className="p-2 rounded-lg text-thb-text-muted hover:text-red-500 hover:bg-red-50 transition-colors" title="Delete">
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
