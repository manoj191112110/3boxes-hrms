'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  FiWatch,
  FiPlus,
  FiX,
  FiEdit2,
  FiTrash2,
  FiSearch,
  FiFilter,
  FiClock,
  FiCheckCircle,
  FiXCircle,
  FiFileText,
  FiCalendar,
  FiLock,
  FiUnlock,
  FiDollarSign,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import ModuleTips from '@/components/ModuleTips';
import ModuleWorkflow from '@/components/ModuleWorkflow';

/* ── Types ── */
interface Timesheet {
  id: string;
  employeeId: string;
  date: string;
  projectId: string | null;
  project: { id: string; name: string; code: string | null } | null;
  projectTaskId: string | null;
  projectTask: { id: string; name: string } | null;
  // Legacy free-text fields (kept for backward compat)
  projectText?: string | null;
  taskText?: string | null;
  hours: number;
  description: string | null;
  status: string;
  approvedBy?: string | null;
  approvedAt?: string | null;
  // REQ-SEC-12 lock
  locked?: boolean;
  lockedBy?: string | null;
  lockedAt?: string | null;
  lockReason?: string | null;
  // Invoiced state
  invoiced?: boolean;
  invoiceId?: string | null;
  employee?: { id: string; firstName: string; lastName: string; employeeId: string; avatar?: string | null };
}

interface Employee {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface Project {
  id: string;
  name: string;
  code: string | null;
  clientId: string | null;
  companyId: string;
  status: string;
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
    draft: 'bg-slate-100 text-slate-600 thb-badge',
    submitted: 'thb-badge thb-badge-warning',
    approved: 'thb-badge thb-badge-success',
    rejected: 'thb-badge thb-badge-error',
    locked: 'bg-teal-100 text-teal-700 thb-badge',
  };
  return map[status] || 'thb-badge thb-badge-info';
}

const initialForm = {
  employeeId: '',
  date: '',
  projectId: '',
  task: '',
  hours: '',
  description: '',
  status: 'draft',
};

/* ── Module Tips & Workflow Data ── */
const timesheetTips = [
  { title: 'Log Hours Daily', description: 'Record your work hours at the end of each day rather than batching weekly. Daily logging improves accuracy and reduces missed entries.' },
  { title: 'Allocate to Projects', description: 'Always assign hours to specific projects and tasks. Unallocated hours create billing gaps and inaccurate project cost tracking.' },
  { title: 'Follow Approval Workflow', description: 'Submit timesheets on time and track their approval status. Address rejections promptly to avoid payroll delays.' },
  { title: 'Track Overtime Carefully', description: 'Monitor overtime hours against organizational policies. Flag excessive overtime early to prevent burnout and compliance issues.' },
  { title: 'Billing Integration', description: 'Approved timesheet entries automatically feed into billing calculations. Ensure entries are complete and approved before billing cycles.' },
];

const timesheetWorkflowSteps = [
  { step: 1, title: 'Log Daily Hours', description: 'Record work hours with project and task details' },
  { step: 2, title: 'Assign to Projects', description: 'Allocate time entries to specific projects and tasks' },
  { step: 3, title: 'Submit for Approval', description: 'Submit completed timesheet entries for manager review' },
  { step: 4, title: 'Manager Review', description: 'Managers review and verify submitted time entries' },
  { step: 5, title: 'Approve or Reject', description: 'Accept valid entries or reject with feedback for correction' },
  { step: 6, title: 'Process for Billing', description: 'Approved hours feed into client billing and payroll' },
  { step: 7, title: 'Archive', description: 'Finalized timesheets are archived for reporting and audit' },
];

/* ── Component ── */
export default function TimesheetsPage() {
  const { user } = useAuthStore();
  const isAdmin = ['super_admin', 'tenant_admin', 'admin'].includes(user?.role || '');

  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterProject, setFilterProject] = useState('');

  /* Fetch data */
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const headers = getAuthHeaders();

      const params = new URLSearchParams({ limit: '100' });
      if (filterStatus) params.set('status', filterStatus);
      const res = await fetch(`/api/timesheets?${params.toString()}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setTimesheets(data.timesheets || []);
      }

      if (employees.length === 0) {
        const empRes = await fetch('/api/employees?limit=500', { headers });
        if (empRes.ok) {
          const empData = await empRes.json();
          setEmployees(empData.employees || []);
        }
      }

      if (projects.length === 0) {
        const projRes = await fetch('/api/projects?limit=200', { headers });
        if (projRes.ok) {
          const projData = await projRes.json();
          setProjects(projData.projects || []);
        }
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load timesheets');
    } finally {
      setLoading(false);
    }
  }, [filterStatus, employees.length, projects.length]);

  useEffect(() => { queueMicrotask(() => fetchData()); }, [fetchData]);

  /* Get unique projects for filter (use project.name from FK lookup, fall back to projectText) */
  const uniqueProjects = [...new Set(timesheets.map(t => t.project?.name || t.projectText).filter(Boolean))] as string[];

  /* Filter timesheets */
  const filteredTimesheets = timesheets.filter(ts => {
    const projectName = ts.project?.name || ts.projectText || '';
    const taskName = ts.projectTask?.name || ts.taskText || '';
    const matchSearch = !search ||
      projectName.toLowerCase().includes(search.toLowerCase()) ||
      taskName.toLowerCase().includes(search.toLowerCase()) ||
      ts.description?.toLowerCase().includes(search.toLowerCase()) ||
      (ts.employee ? `${ts.employee.firstName} ${ts.employee.lastName}`.toLowerCase().includes(search.toLowerCase()) : false);
    const matchProject = !filterProject || projectName === filterProject;
    return matchSearch && matchProject;
  });

  /* Weekly summary */
  const getWeeklySummary = () => {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    const weekTimesheets = timesheets.filter(ts => {
      const d = new Date(ts.date);
      return d >= startOfWeek && d <= endOfWeek;
    });

    const totalHours = weekTimesheets.reduce((sum, ts) => sum + ts.hours, 0);
    const totalEntries = weekTimesheets.length;
    const approvedCount = weekTimesheets.filter(ts => ts.status === 'approved').length;
    const pendingCount = weekTimesheets.filter(ts => ['draft', 'submitted'].includes(ts.status)).length;

    return { totalHours, totalEntries, approvedCount, pendingCount };
  };

  const weeklySummary = getWeeklySummary();

  /* Form handlers */
  const handleShowForm = () => {
    setForm({ ...initialForm, employeeId: employees.find(e => e.email === user?.email)?.id || '' });
    setEditingId(null);
    setShowForm(true);
    setTimeout(() => {
      document.getElementById('crud-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const handleEdit = (ts: Timesheet) => {
    setForm({
      employeeId: ts.employeeId,
      date: ts.date ? new Date(ts.date).toISOString().split('T')[0] : '',
      projectId: ts.projectId || (ts.project ? ts.project.id : ''),
      task: ts.projectTask?.name || ts.taskText || '',
      hours: ts.hours?.toString() || '',
      description: ts.description || '',
      status: ts.status,
    });
    setEditingId(ts.id);
    setShowForm(true);
    setTimeout(() => {
      document.getElementById('crud-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(initialForm);
  };

  const handleSubmit = async () => {
    if (!form.date || !form.projectId || !form.task || !form.hours) {
      toast.error('Please fill in all required fields (project is now a dropdown — pick one)');
      return;
    }
    try {
      setSubmitting(true);
      const payload: Record<string, unknown> = {
        employeeId: form.employeeId || employees.find(e => e.email === user?.email)?.id,
        date: form.date,
        projectId: form.projectId,
        task: form.task, // free-text task name (legacy column)
        hours: parseFloat(form.hours),
        description: form.description,
        status: form.status,
      };

      if (!payload.employeeId) {
        toast.error('Employee record not found');
        return;
      }

      let res;
      if (editingId) {
        res = await fetch(`/api/timesheets/${editingId}`, {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch('/api/timesheets', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed');
      }

      toast.success(editingId ? 'Timesheet updated successfully' : 'Time logged successfully');
      handleCancelForm();
      fetchData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save timesheet');
    } finally {
      setSubmitting(false);
    }
  };

  /* Delete */
  const handleDelete = async (id: string) => {
    try {
      setDeleting(true);
      const res = await fetch(`/api/timesheets/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed');
      }
      toast.success('Timesheet deleted successfully');
      setDeleteConfirmId(null);
      fetchData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete timesheet');
    } finally {
      setDeleting(false);
    }
  };

  /* Approve / Reject */
  const handleStatusChange = async (id: string, status: string) => {
    try {
      const res = await fetch(`/api/timesheets/${id}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed');
      }
      toast.success(`Timesheet ${status === 'approved' ? 'approved' : 'rejected'} successfully`);
      fetchData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Action failed');
    }
  };

  /* Lock / Unlock (REQ-SEC-12) */
  const handleLockToggle = async (ts: Timesheet) => {
    const newLocked = !ts.locked;
    const reason = newLocked ? prompt('Lock reason (optional):') || '' : '';
    try {
      const res = await fetch(`/api/timesheets/${ts.id}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ locked: newLocked, lockReason: newLocked ? reason : undefined }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed');
      }
      toast.success(newLocked ? 'Timesheet locked' : 'Timesheet unlocked');
      fetchData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Action failed');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-thb-text-primary flex items-center gap-2">
            <FiWatch className="w-6 h-6 text-cyan-500" />
            Timesheets
          </h1>
          <p className="text-thb-text-secondary mt-1">Track and manage employee work hours</p>
        </div>
        <button onClick={handleShowForm} className="inline-flex items-center gap-2 px-4 py-2.5 bg-green-500 text-white rounded-lg hover:bg-green-600 font-medium text-sm shadow-sm shadow-green-500/25 transition-colors">
          <FiPlus className="w-4 h-4" />
          Log Time
        </button>
      </div>

      <ModuleTips moduleKey="timesheets" title="Timesheet Tips" tips={timesheetTips} userRole={user?.role} />
      <ModuleWorkflow moduleKey="timesheets" title="How to Process Timesheets" subtitle="Follow this workflow to ensure accurate time tracking and billing" steps={timesheetWorkflowSteps} accentColor="cyan" userRole={user?.role} />

      {/* Weekly Summary Card */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="thb-card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-cyan-50 border border-cyan-100">
              <FiClock className="w-5 h-5 text-cyan-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-thb-text-muted">Total Hours</p>
              <p className="text-xl font-bold text-thb-text-primary">{weeklySummary.totalHours.toFixed(1)}h</p>
            </div>
          </div>
        </div>
        <div className="thb-card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-green-50 border border-green-100">
              <FiFileText className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-thb-text-muted">This Week</p>
              <p className="text-xl font-bold text-thb-text-primary">{weeklySummary.totalEntries}</p>
            </div>
          </div>
        </div>
        <div className="thb-card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-100">
              <FiCheckCircle className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-thb-text-muted">Approved</p>
              <p className="text-xl font-bold text-thb-text-primary">{weeklySummary.approvedCount}</p>
            </div>
          </div>
        </div>
        <div className="thb-card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-100">
              <FiClock className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-thb-text-muted">Pending</p>
              <p className="text-xl font-bold text-thb-text-primary">{weeklySummary.pendingCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Embedded Form */}
      {showForm && (
        <div id="crud-form" className="thb-card border-l-4 border-l-green-500">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-thb-text-primary">
                {editingId ? 'Edit Timesheet' : 'Log Time'}
              </h2>
              <button onClick={handleCancelForm} className="p-2 rounded-lg text-thb-text-muted hover:text-thb-text-primary hover:bg-slate-100">
                <FiX className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {isAdmin && (
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Employee</label>
                  <select value={form.employeeId} onChange={e => setForm(p => ({ ...p, employeeId: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400">
                    <option value="">Select Employee</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName} ({emp.employeeId})</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Date <span className="text-red-500 font-bold">*</span></label>
                <input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Project <span className="text-red-500 font-bold">*</span></label>
                <select value={form.projectId} onChange={e => setForm(p => ({ ...p, projectId: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400">
                  <option value="">Select Project</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.name}{p.code ? ` (${p.code})` : ''}</option>
                  ))}
                </select>
                {projects.length === 0 && (
                  <p className="text-xs text-amber-600 mt-1">No projects found. Create one under Projects first.</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Task <span className="text-red-500 font-bold">*</span></label>
                <input type="text" value={form.task} onChange={e => setForm(p => ({ ...p, task: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" placeholder="Task description" />
              </div>
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Hours <span className="text-red-500 font-bold">*</span></label>
                <input type="number" step="0.5" min="0" max="24" value={form.hours} onChange={e => setForm(p => ({ ...p, hours: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" placeholder="0.0" />
              </div>
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Status</label>
                <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400">
                  <option value="draft">Draft</option>
                  <option value="submitted">Submitted</option>
                  {isAdmin && <option value="approved">Approved</option>}
                  {isAdmin && <option value="rejected">Rejected</option>}
                </select>
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Description</label>
                <textarea rows={2} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 resize-none" placeholder="Additional notes..." />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-thb-border">
              <button onClick={handleCancelForm} className="px-4 py-2.5 rounded-lg border border-thb-border text-sm font-medium text-thb-text-secondary hover:bg-slate-50">Cancel</button>
              <button onClick={handleSubmit} disabled={submitting} className="px-6 py-2.5 rounded-lg bg-green-500 text-white text-sm font-medium hover:bg-green-600 disabled:opacity-50 shadow-sm shadow-green-500/25">
                {submitting ? 'Saving...' : editingId ? 'Update' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filters and Search */}
      <div className="thb-card p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-thb-text-muted" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
              placeholder="Search timesheets..."
            />
          </div>
          <div className="flex gap-2">
            <div className="relative">
              <FiFilter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-thb-text-muted" />
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="pl-9 pr-8 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 appearance-none bg-white">
                <option value="">All Status</option>
                <option value="draft">Draft</option>
                <option value="submitted">Submitted</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
            <select value={filterProject} onChange={e => setFilterProject(e.target.value)} className="px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 appearance-none bg-white">
              <option value="">All Projects</option>
              {uniqueProjects.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Timesheets Table */}
      <div className="thb-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-thb-border bg-slate-50/50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Date</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Employee</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Project</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Task</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Hours</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Status</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-thb-border/50 animate-pulse">
                    <td className="px-4 py-3"><div className="h-3 w-20 bg-slate-200 rounded" /></td>
                    <td className="px-4 py-3"><div className="h-3 w-24 bg-slate-200 rounded" /></td>
                    <td className="px-4 py-3"><div className="h-3 w-20 bg-slate-200 rounded" /></td>
                    <td className="px-4 py-3"><div className="h-3 w-24 bg-slate-200 rounded" /></td>
                    <td className="px-4 py-3"><div className="h-3 w-8 bg-slate-200 rounded" /></td>
                    <td className="px-4 py-3"><div className="h-5 w-16 bg-slate-200 rounded-full" /></td>
                    <td className="px-4 py-3"><div className="h-3 w-16 bg-slate-200 rounded ml-auto" /></td>
                  </tr>
                ))
              ) : filteredTimesheets.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <FiWatch className="w-10 h-10 text-thb-text-muted mx-auto mb-3" />
                    <p className="text-thb-text-secondary font-medium">No timesheets found</p>
                    <p className="text-sm text-thb-text-muted mt-1">Click &quot;Log Time&quot; to add your first entry</p>
                  </td>
                </tr>
              ) : (
                filteredTimesheets.map(ts => (
                  <tr key={ts.id} className="border-b border-thb-border/50 hover:bg-slate-50/50 transition-colors">
                    {deleteConfirmId === ts.id ? (
                      <td colSpan={7} className="px-4 py-3 bg-red-50">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-red-700 font-medium">Are you sure you want to delete this timesheet entry?</span>
                          <div className="flex items-center gap-2">
                            <button onClick={() => handleDelete(ts.id)} disabled={deleting} className="px-3 py-1.5 bg-red-500 text-white text-xs font-medium rounded-lg hover:bg-red-600 disabled:opacity-50">{deleting ? 'Deleting...' : 'Confirm'}</button>
                            <button onClick={() => setDeleteConfirmId(null)} className="px-3 py-1.5 border border-thb-border text-xs font-medium rounded-lg hover:bg-slate-50">Cancel</button>
                          </div>
                        </div>
                      </td>
                    ) : (
                      <>
                        <td className="px-4 py-3 text-sm font-medium text-thb-text-primary">
                          <div className="flex items-center gap-1.5"><FiCalendar className="w-3.5 h-3.5 text-thb-text-muted" />{formatDate(ts.date)}</div>
                        </td>
                        <td className="px-4 py-3 text-sm text-thb-text-secondary">
                          {ts.employee ? `${ts.employee.firstName} ${ts.employee.lastName}` : '—'}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-thb-text-primary">
                          {ts.project?.name || ts.projectText || '—'}
                          {ts.locked && (
                            <span className="ml-1 inline-flex items-center gap-0.5 text-[10px] text-teal-700 bg-teal-100 px-1.5 py-0.5 rounded-full" title={`Locked${ts.lockReason ? ': ' + ts.lockReason : ''}`}>
                              <FiLock className="w-2.5 h-2.5" /> Locked
                            </span>
                          )}
                          {ts.invoiced && (
                            <span className="ml-1 inline-flex items-center gap-0.5 text-[10px] text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-full" title={`Invoiced${ts.invoiceId ? ' under invoice ' + ts.invoiceId : ''}`}>
                              <FiDollarSign className="w-2.5 h-2.5" /> Invoiced
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-thb-text-secondary truncate max-w-[200px]">{ts.projectTask?.name || ts.taskText || '—'}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-thb-text-primary">{ts.hours}h</td>
                        <td className="px-4 py-3"><span className={getStatusBadge(ts.status)}>{ts.status}</span></td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            {isAdmin && ts.status === 'submitted' && !ts.locked && (
                              <>
                                <button onClick={() => handleStatusChange(ts.id, 'approved')} className="p-2 rounded-lg text-thb-text-muted hover:text-emerald-500 hover:bg-emerald-50 transition-colors" title="Approve">
                                  <FiCheckCircle className="w-4 h-4" />
                                </button>
                                <button onClick={() => handleStatusChange(ts.id, 'rejected')} className="p-2 rounded-lg text-thb-text-muted hover:text-red-500 hover:bg-red-50 transition-colors" title="Reject">
                                  <FiXCircle className="w-4 h-4" />
                                </button>
                              </>
                            )}
                            {isAdmin && !ts.invoiced && (
                              <button onClick={() => handleLockToggle(ts)} className={`p-2 rounded-lg transition-colors ${ts.locked ? 'text-teal-600 hover:bg-teal-50' : 'text-thb-text-muted hover:text-teal-500 hover:bg-teal-50'}`} title={ts.locked ? 'Unlock (super_admin only)' : 'Lock'}>
                                {ts.locked ? <FiUnlock className="w-4 h-4" /> : <FiLock className="w-4 h-4" />}
                              </button>
                            )}
                            {!ts.locked && !ts.invoiced && (
                              <>
                                <button onClick={() => handleEdit(ts)} className="p-2 rounded-lg text-thb-text-muted hover:text-green-500 hover:bg-green-50 transition-colors" title="Edit">
                                  <FiEdit2 className="w-4 h-4" />
                                </button>
                                <button onClick={() => setDeleteConfirmId(ts.id)} className="p-2 rounded-lg text-thb-text-muted hover:text-red-500 hover:bg-red-50 transition-colors" title="Delete">
                                  <FiTrash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
