'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  FiPlus, FiX, FiUsers, FiCalendar, FiList, FiGrid,
  FiEye, FiEdit2, FiTrash2, FiBriefcase,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import ModuleTips from '@/components/ModuleTips';
import ModuleWorkflow from '@/components/ModuleWorkflow';
import { useCompanyContextStore } from '@/store/companyContextStore';

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
    draft: 'thb-badge bg-slate-100 text-slate-600',
    active: 'thb-badge thb-badge-success',
    on_hold: 'thb-badge thb-badge-warning',
    completed: 'thb-badge thb-badge-info',
    cancelled: 'thb-badge thb-badge-error',
  };
  return map[status] || 'thb-badge thb-badge-info';
}

function formatStatus(status: string) {
  const map: Record<string, string> = {
    draft: 'Draft',
    active: 'Active',
    on_hold: 'On Hold',
    completed: 'Completed',
    cancelled: 'Cancelled',
  };
  return map[status] || status.replace('_', ' ');
}

function formatProjectType(type: string) {
  const map: Record<string, string> = {
    internal: 'Internal',
    client: 'Client',
    r_and_d: 'R&D',
    support: 'Support',
  };
  return map[type] || type;
}

function formatBillingType(type: string) {
  const map: Record<string, string> = {
    fixed: 'Fixed',
    time_and_material: 'T&M',
    retainer: 'Retainer',
    non_billable: 'Non-Billable',
    hourly: 'Hourly',
    daily: 'Daily',
  };
  return map[type] || type.replace('_', ' ');
}

/* ── Types ── */
interface Project {
  id: string;
  name: string;
  code: string | null;
  projectType: string;
  billingType: string;
  budgetAmount: number;
  estimatedHours: number;
  currency: string;
  status: string;
  progress: number;
  startDate: string;
  endDate: string | null;
  description: string | null;
  companyId: string;
  clientId?: string | null;
  departmentId?: string | null;
  client?: { name: string; code?: string } | null;
  department?: { name: string; code?: string } | null;
  company?: { name: string } | null;
  tasks?: ProjectTask[];
  allocations?: ProjectAllocation[];
  milestones?: ProjectMilestone[];
}

interface ProjectTask {
  id: string;
  name: string;
  status: string;
  priority: string;
  estimatedHours: number;
  actualHours: number;
}

interface ProjectAllocation {
  id: string;
  role: string | null;
  allocationPct: number;
  status: string;
  employee: { firstName: string; lastName: string };
}

interface ProjectMilestone {
  id: string;
  name: string;
  plannedDate: string;
  completionPct: number;
  approvalStatus: string;
}

const initialForm = {
  name: '',
  code: '',
  companyId: '',
  clientId: '',
  departmentId: '',
  projectType: 'internal',
  billingType: 'non_billable',
  currency: 'INR',
  budgetAmount: 0,
  estimatedHours: 0,
  startDate: '',
  endDate: '',
  description: '',
};

const taskBoardColumns = [
  { key: 'todo', label: 'To Do', color: 'border-slate-300' },
  { key: 'in_progress', label: 'In Progress', color: 'border-amber-400' },
  { key: 'review', label: 'Review', color: 'border-green-400' },
  { key: 'done', label: 'Done', color: 'border-emerald-400' },
];

/* ── Module Tips & Workflow Data ── */
const projectTips = [
  { title: 'Define Clear Phases', description: 'Break projects into distinct phases (planning, execution, monitoring, closure) to track progress effectively and identify bottlenecks early.' },
  { title: 'Smart Resource Allocation', description: 'Allocate team members based on availability and skills. Monitor allocation percentages to avoid overcommitment and burnout.' },
  { title: 'Track Milestones Relentlessly', description: 'Set measurable milestones with planned dates and completion percentages. Milestones keep teams aligned and stakeholders informed.' },
  { title: 'Integrate with Timesheets', description: 'Link project tasks to timesheet entries to track actual hours vs estimated hours and ensure accurate billing.' },
  { title: 'Proactive Risk Management', description: 'Identify risks early and maintain a risk register. Regularly review and update risk mitigation strategies throughout the project lifecycle.' },
];

const projectWorkflowSteps = [
  { step: 1, title: 'Create Project', description: 'Define project name, type, billing, and timeline' },
  { step: 2, title: 'Define Milestones', description: 'Set key milestones with planned dates and deliverables' },
  { step: 3, title: 'Allocate Team', description: 'Assign team members with roles and allocation percentages' },
  { step: 4, title: 'Track via Timesheets', description: 'Monitor progress through linked timesheet entries' },
  { step: 5, title: 'Review Milestones', description: 'Assess milestone completion and adjust timelines' },
  { step: 6, title: 'Complete Deliverables', description: 'Finalize all project deliverables and documentation' },
  { step: 7, title: 'Close Project', description: 'Mark project as completed and archive records' },
];

/* ── Component ── */
export default function ProjectsPage() {
  const { user } = useAuthStore();
  const effectiveCompanyId = useCompanyContextStore(s => s.effectiveCompanyId);
  const isAdmin = ['super_admin', 'tenant_admin', 'admin'].includes(user?.role || '');

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  // Inline form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);

  // Delete confirmation state
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // View-only panel state
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [viewingProject, setViewingProject] = useState<Project | null>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [detailTab, setDetailTab] = useState<'tasks' | 'team' | 'milestones' | 'billing'>('tasks');

  // Task addition inside view panel
  const [newTask, setNewTask] = useState({ name: '', priority: 'medium', estimatedHours: 0 });

  /* ── Fetch projects ── */
  const fetchProjects = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/projects?${scopeQuery}limit=100`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setProjects(data.projects || (Array.isArray(data) ? data : []));
      }
    } catch {
      toast.error('Failed to load projects');
    } finally {
      setLoading(false);
    }
  }, []);
  const cid = effectiveCompanyId();
  const scopeQuery = cid ? `companyId=${cid}&` : '';


  useEffect(() => {
    queueMicrotask(() => fetchProjects());
  }, [fetchProjects]);

  /* ── View project detail ── */
  const handleView = async (p: Project) => {
    setViewingId(p.id);
    setViewLoading(true);
    setViewingProject(p);
    setDetailTab('tasks');
    setTimeout(() => document.getElementById('view-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    try {
      const res = await fetch(`/api/projects/${p.id}?${scopeQuery}` , { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setViewingProject(data.project || data);
      }
    } catch {
      // Keep the initial project data
    } finally {
      setViewLoading(false);
    }
  };

  /* ── Add new project ── */
  const handleAddNew = () => {
    setForm(initialForm);
    setEditingId(null);
    setShowForm(true);
    setTimeout(() => document.getElementById('crud-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  /* ── Edit project ── */
  const handleEdit = (p: Project) => {
    setForm({
      name: p.name,
      code: p.code || '',
      companyId: p.companyId || '',
      clientId: p.clientId || '',
      departmentId: p.departmentId || '',
      projectType: p.projectType,
      billingType: p.billingType,
      currency: p.currency || 'INR',
      budgetAmount: p.budgetAmount,
      estimatedHours: p.estimatedHours,
      startDate: p.startDate ? new Date(p.startDate).toISOString().split('T')[0] : '',
      endDate: p.endDate ? new Date(p.endDate).toISOString().split('T')[0] : '',
      description: p.description || '',
    });
    setEditingId(p.id);
    setShowForm(true);
    setViewingId(null);
    setViewingProject(null);
    setTimeout(() => document.getElementById('crud-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  /* ── Cancel form ── */
  const handleCancelForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(initialForm);
  };

  /* ── Submit form (create or update) ── */
  const handleSubmit = async () => {
    if (!form.name) {
      toast.error('Name is required');
      return;
    }
    if (!editingId && !form.companyId) {
      toast.error('Company is required');
      return;
    }
    if (!form.startDate) {
      toast.error('Start date is required');
      return;
    }

    try {
      setSubmitting(true);
      const body: Record<string, unknown> = {
        name: form.name,
        code: form.code || null,
        projectType: form.projectType,
        billingType: form.billingType,
        currency: form.currency,
        budgetAmount: form.budgetAmount,
        estimatedHours: form.estimatedHours,
        startDate: form.startDate,
        endDate: form.endDate || null,
        description: form.description || null,
      };

      if (form.clientId) body.clientId = form.clientId;
      if (form.departmentId) body.departmentId = form.departmentId;

      if (editingId) {
        // PATCH for editing
        const res = await fetch(`/api/projects/${editingId}?${scopeQuery}` , {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const d = await res.json();
          throw new Error(d.error || 'Failed to update');
        }
        toast.success('Project updated successfully');
      } else {
        // POST for creating
        body.companyId = form.companyId;
        const res = await fetch(`/api/projects?${scopeQuery}` , {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const d = await res.json();
          throw new Error(d.error || 'Failed to create');
        }
        toast.success('Project created successfully');
      }

      handleCancelForm();
      fetchProjects();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save project');
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Delete project ── */
  const handleDelete = async (id: string) => {
    try {
      setDeleting(true);
      const res = await fetch(`/api/projects/${id}?${scopeQuery}` , {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to delete');
      }
      toast.success('Project deleted successfully');
      setDeleteConfirmId(null);
      if (viewingId === id) {
        setViewingId(null);
        setViewingProject(null);
      }
      fetchProjects();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete project');
    } finally {
      setDeleting(false);
    }
  };

  /* ── Add task inside view panel ── */
  const handleAddTask = async () => {
    if (!newTask.name || !viewingProject) return;
    try {
      const res = await fetch(`/api/projects/${viewingProject.id}/tasks?${scopeQuery}` , {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(newTask),
      });
      if (!res.ok) throw new Error('Failed');
      toast.success('Task added');
      setNewTask({ name: '', priority: 'medium', estimatedHours: 0 });
      // Refresh the viewing project
      const fresh = await fetch(`/api/projects/${viewingProject.id}?${scopeQuery}` , { headers: getAuthHeaders() });
      if (fresh.ok) {
        const data = await fresh.json();
        setViewingProject(data.project || data);
      }
      fetchProjects();
    } catch {
      toast.error('Failed to add task');
    }
  };

  /* ── Stats ── */
  const activeCount = projects.filter(p => p.status === 'active').length;
  const completedCount = projects.filter(p => p.status === 'completed').length;
  const totalBudget = projects.reduce((s, p) => s + (p.budgetAmount || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-thb-text-primary flex items-center gap-2">
            <FiBriefcase className="w-6 h-6 text-teal-500" />
            Projects
          </h1>
          <p className="text-thb-text-secondary mt-1">Manage projects, tasks, and team allocations</p>
        </div>
        <button
          onClick={handleAddNew}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-green-500 text-white rounded-lg hover:bg-green-600 font-medium text-sm shadow-sm shadow-green-500/25 transition-colors"
        >
          <FiPlus className="w-4 h-4" />
          Create Project
        </button>
      </div>

      <ModuleTips moduleKey="projects" title="Project Tips" tips={projectTips} userRole={user?.role} />
      <ModuleWorkflow moduleKey="projects" title="How to Manage Projects" subtitle="Follow this workflow to deliver projects on time" steps={projectWorkflowSteps} accentColor="blue" userRole={user?.role} />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="thb-card p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
              <FiGrid className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-xs font-medium text-thb-text-secondary">Active Projects</p>
              <p className="text-xl font-bold text-thb-text-primary">{activeCount}</p>
            </div>
          </div>
        </div>
        <div className="thb-card p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
              <FiList className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <p className="text-xs font-medium text-thb-text-secondary">Completed</p>
              <p className="text-xl font-bold text-thb-text-primary">{completedCount}</p>
            </div>
          </div>
        </div>
        <div className="thb-card p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center">
              <FiBriefcase className="w-5 h-5 text-teal-500" />
            </div>
            <div>
              <p className="text-xs font-medium text-thb-text-secondary">Total Budget</p>
              <p className="text-xl font-bold text-thb-text-primary">${totalBudget.toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* View-only Panel */}
      {viewingId && (() => {
        const item = viewingProject || projects.find(p => p.id === viewingId);
        if (!item) return null;
        return (
          <div id="view-panel" className="thb-card border-l-4 border-l-emerald-500">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-semibold text-thb-text-primary">Project Details</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-thb-text-muted">{item.code || 'No code'}</span>
                    <span className={getStatusBadge(item.status)}>{formatStatus(item.status)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { handleEdit(item); }}
                    className="px-3 py-1.5 rounded-lg bg-green-500 text-white text-xs font-medium hover:bg-green-600 transition-colors flex items-center gap-1"
                  >
                    <FiEdit2 className="w-3.5 h-3.5" />
                    Edit
                  </button>
                  <button
                    onClick={() => { setViewingId(null); setViewingProject(null); }}
                    className="p-2 rounded-lg text-thb-text-muted hover:text-thb-text-primary hover:bg-slate-100 transition-colors"
                  >
                    <FiX className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Read-only fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                <div>
                  <span className="text-xs font-medium text-thb-text-secondary">Name</span>
                  <p className="text-sm font-medium text-thb-text-primary mt-0.5">{item.name}</p>
                </div>
                <div>
                  <span className="text-xs font-medium text-thb-text-secondary">Code</span>
                  <p className="text-sm font-medium text-thb-text-primary mt-0.5">{item.code || '—'}</p>
                </div>
                <div>
                  <span className="text-xs font-medium text-thb-text-secondary">Project Type</span>
                  <p className="text-sm font-medium text-thb-text-primary mt-0.5">{formatProjectType(item.projectType)}</p>
                </div>
                <div>
                  <span className="text-xs font-medium text-thb-text-secondary">Billing Type</span>
                  <p className="text-sm font-medium text-thb-text-primary mt-0.5">{formatBillingType(item.billingType)}</p>
                </div>
                <div>
                  <span className="text-xs font-medium text-thb-text-secondary">Client</span>
                  <p className="text-sm font-medium text-thb-text-primary mt-0.5">{item.client?.name || '—'}</p>
                </div>
                <div>
                  <span className="text-xs font-medium text-thb-text-secondary">Department</span>
                  <p className="text-sm font-medium text-thb-text-primary mt-0.5">{item.department?.name || '—'}</p>
                </div>
                <div>
                  <span className="text-xs font-medium text-thb-text-secondary">Start Date</span>
                  <p className="text-sm font-medium text-thb-text-primary mt-0.5">{formatDate(item.startDate)}</p>
                </div>
                <div>
                  <span className="text-xs font-medium text-thb-text-secondary">End Date</span>
                  <p className="text-sm font-medium text-thb-text-primary mt-0.5">{formatDate(item.endDate)}</p>
                </div>
                <div>
                  <span className="text-xs font-medium text-thb-text-secondary">Progress</span>
                  <div className="mt-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-thb-text-muted">{item.progress}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${item.progress}%` }} />
                    </div>
                  </div>
                </div>
              </div>

              {item.description && (
                <div className="mb-6">
                  <span className="text-xs font-medium text-thb-text-secondary">Description</span>
                  <p className="text-sm text-thb-text-primary mt-0.5 whitespace-pre-wrap">{item.description}</p>
                </div>
              )}

              {/* Tabs for tasks, team, milestones, billing */}
              <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit mb-4">
                {(['tasks', 'team', 'milestones', 'billing'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setDetailTab(tab)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-colors ${detailTab === tab ? 'bg-white shadow-sm text-thb-text-primary' : 'text-thb-text-secondary hover:text-thb-text-primary'}`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {viewLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <>
                  {/* Tasks Tab */}
                  {detailTab === 'tasks' && (
                    <div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                        {taskBoardColumns.map((col) => {
                          const colTasks = (item.tasks || []).filter((t) => t.status === col.key);
                          return (
                            <div key={col.key} className={`border-t-2 ${col.color} rounded-lg`}>
                              <div className="px-3 py-2 bg-slate-50 rounded-t-lg">
                                <h4 className="text-xs font-semibold text-thb-text-secondary">{col.label} ({colTasks.length})</h4>
                              </div>
                              <div className="p-2 space-y-2 min-h-[80px] max-h-64 overflow-y-auto">
                                {colTasks.length === 0 ? (
                                  <p className="text-xs text-thb-text-muted text-center py-4">No tasks</p>
                                ) : (
                                  colTasks.map((t) => (
                                    <div key={t.id} className="p-2 bg-white border border-thb-border rounded-lg text-xs">
                                      <p className="font-medium text-thb-text-primary">{t.name}</p>
                                      <p className="text-thb-text-muted mt-1">{t.estimatedHours}h est.</p>
                                    </div>
                                  ))
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {/* Add task inline */}
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          value={newTask.name}
                          onChange={(e) => setNewTask({ ...newTask, name: e.target.value })}
                          placeholder="New task name..."
                          className="flex-1 px-3 py-2 border border-thb-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                        />
                        <select
                          value={newTask.priority}
                          onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}
                          className="px-3 py-2 border border-thb-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                        >
                          <option value="low">Low</option>
                          <option value="medium">Medium</option>
                          <option value="high">High</option>
                        </select>
                        <button
                          onClick={handleAddTask}
                          className="px-4 py-2 bg-green-500 text-white rounded-lg text-sm hover:bg-green-600 transition-colors flex items-center gap-1"
                        >
                          <FiPlus className="w-4 h-4" />
                          Add Task
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Team Tab */}
                  {detailTab === 'team' && (
                    <div className="space-y-2">
                      {(item.allocations || []).length === 0 ? (
                        <p className="text-sm text-thb-text-muted text-center py-8">No team members allocated</p>
                      ) : (
                        (item.allocations || []).map((a) => (
                          <div key={a.id} className="flex items-center justify-between p-3 border border-thb-border rounded-lg">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center text-xs font-semibold text-teal-700">
                                {a.employee.firstName[0]}{a.employee.lastName[0]}
                              </div>
                              <div>
                                <p className="text-sm font-medium text-thb-text-primary">{a.employee.firstName} {a.employee.lastName}</p>
                                <p className="text-xs text-thb-text-muted">{a.role || 'Team Member'}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-thb-text-secondary">{a.allocationPct}%</span>
                              <span className={a.status === 'active' ? 'thb-badge thb-badge-success' : 'thb-badge bg-slate-100 text-slate-600'}>
                                {a.status}
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* Milestones Tab */}
                  {detailTab === 'milestones' && (
                    <div className="space-y-2">
                      {(item.milestones || []).length === 0 ? (
                        <p className="text-sm text-thb-text-muted text-center py-8">No milestones defined</p>
                      ) : (
                        (item.milestones || []).map((m) => (
                          <div key={m.id} className="flex items-center justify-between p-3 border border-thb-border rounded-lg">
                            <div>
                              <p className="text-sm font-medium text-thb-text-primary">{m.name}</p>
                              <p className="text-xs text-thb-text-muted">Due: {formatDate(m.plannedDate)}</p>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="w-24 h-2 bg-slate-100 rounded-full">
                                <div className="h-full bg-green-500 rounded-full" style={{ width: `${m.completionPct}%` }} />
                              </div>
                              <span className="text-xs text-thb-text-secondary">{m.completionPct}%</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* Billing Tab */}
                  {detailTab === 'billing' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="p-4 bg-slate-50 rounded-lg">
                        <p className="text-xs font-medium text-thb-text-secondary">Budget</p>
                        <p className="text-xl font-bold text-thb-text-primary">${item.budgetAmount?.toLocaleString() || 0}</p>
                      </div>
                      <div className="p-4 bg-slate-50 rounded-lg">
                        <p className="text-xs font-medium text-thb-text-secondary">Billing Type</p>
                        <p className="text-xl font-bold text-thb-text-primary">{formatBillingType(item.billingType)}</p>
                      </div>
                      <div className="p-4 bg-slate-50 rounded-lg">
                        <p className="text-xs font-medium text-thb-text-secondary">Est. Hours</p>
                        <p className="text-xl font-bold text-thb-text-primary">{item.estimatedHours || 0}h</p>
                      </div>
                      <div className="p-4 bg-slate-50 rounded-lg">
                        <p className="text-xs font-medium text-thb-text-secondary">Currency</p>
                        <p className="text-xl font-bold text-thb-text-primary">{item.currency || 'INR'}</p>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        );
      })()}

      {/* Embedded Form */}
      {showForm && (
        <div id="crud-form" className="thb-card border-l-4 border-l-green-500">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-thb-text-primary">
                {editingId ? 'Edit Project' : 'Create Project'}
              </h2>
              <button
                onClick={handleCancelForm}
                className="p-2 rounded-lg text-thb-text-muted hover:text-thb-text-primary hover:bg-slate-100 transition-colors"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Name <span className="text-red-500 font-bold">*</span></label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                  placeholder="Project name"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Code</label>
                <input
                  type="text"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                  placeholder="PRJ-001"
                />
              </div>
              {!editingId && (
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Company <span className="text-red-500 font-bold">*</span></label>
                  <input
                    type="text"
                    value={form.companyId}
                    onChange={(e) => setForm({ ...form, companyId: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                    placeholder="Company ID"
                  />
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Project Type</label>
                <select
                  value={form.projectType}
                  onChange={(e) => setForm({ ...form, projectType: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                >
                  <option value="internal">Internal</option>
                  <option value="client">Client</option>
                  <option value="r_and_d">R&D</option>
                  <option value="support">Support</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Billing Type</label>
                <select
                  value={form.billingType}
                  onChange={(e) => setForm({ ...form, billingType: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                >
                  <option value="fixed">Fixed</option>
                  <option value="time_and_material">T&M</option>
                  <option value="retainer">Retainer</option>
                  <option value="non_billable">Non-Billable</option>
                  <option value="hourly">Hourly</option>
                  <option value="daily">Daily</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Currency</label>
                <select
                  value={form.currency}
                  onChange={(e) => setForm({ ...form, currency: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                >
                  <option value="INR">INR</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Budget Amount</label>
                <input
                  type="number"
                  value={form.budgetAmount}
                  onChange={(e) => setForm({ ...form, budgetAmount: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Est. Hours</label>
                <input
                  type="number"
                  value={form.estimatedHours}
                  onChange={(e) => setForm({ ...form, estimatedHours: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Start Date <span className="text-red-500 font-bold">*</span></label>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">End Date</label>
                <input
                  type="date"
                  value={form.endDate}
                  onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                />
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Description</label>
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 resize-none"
                  placeholder="Project description..."
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-thb-border">
              <button
                onClick={handleCancelForm}
                className="px-4 py-2.5 rounded-lg border border-thb-border text-sm font-medium text-thb-text-secondary hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="px-6 py-2.5 rounded-lg bg-green-500 text-white text-sm font-medium hover:bg-green-600 disabled:opacity-50 shadow-sm shadow-green-500/25 transition-colors"
              >
                {submitting ? 'Saving...' : editingId ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Project Cards Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="thb-card p-5 animate-pulse">
              <div className="h-4 w-3/4 bg-slate-200 rounded mb-3" />
              <div className="h-3 w-1/2 bg-slate-100 rounded mb-2" />
              <div className="h-2 bg-slate-50 rounded-full" />
            </div>
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="thb-card p-12 text-center">
          <FiList className="w-12 h-12 text-thb-text-muted mx-auto mb-3" />
          <p className="text-thb-text-secondary font-medium">No projects found</p>
          <p className="text-sm text-thb-text-muted mt-1">Create your first project to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p) => (
            <div key={p.id} className="thb-card overflow-hidden">
              {deleteConfirmId === p.id ? (
                <div className="p-5 bg-red-50">
                  <p className="text-sm text-red-700 font-medium mb-3">
                    Are you sure you want to delete &quot;{p.name}&quot;?
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDelete(p.id)}
                      disabled={deleting}
                      className="px-3 py-1.5 bg-red-500 text-white text-xs font-medium rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors"
                    >
                      {deleting ? 'Deleting...' : 'Confirm'}
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(null)}
                      className="px-3 py-1.5 border border-thb-border text-xs font-medium rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-thb-text-primary">{p.name}</h3>
                      <p className="text-xs text-thb-text-muted mt-0.5">{p.code || 'No code'}</p>
                    </div>
                    <span className={getStatusBadge(p.status)}>{formatStatus(p.status)}</span>
                  </div>

                  <div className="space-y-2 text-sm text-thb-text-secondary">
                    {p.client && (
                      <div className="flex items-center gap-2">
                        <FiGrid className="w-3.5 h-3.5 text-thb-text-muted" />
                        Client: {p.client.name}
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <FiUsers className="w-3.5 h-3.5 text-thb-text-muted" />
                      {formatProjectType(p.projectType)} · {formatBillingType(p.billingType)}
                    </div>
                    <div className="flex items-center gap-2">
                      <FiCalendar className="w-3.5 h-3.5 text-thb-text-muted" />
                      {formatDate(p.startDate)}
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-thb-border/50">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-thb-text-muted">Progress</span>
                      <span className="text-xs font-medium text-thb-text-primary">{p.progress}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${p.progress}%` }} />
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="mt-3 pt-3 border-t border-thb-border flex items-center justify-between">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleView(p);
                      }}
                      className="text-xs font-medium text-green-500 hover:text-green-600 flex items-center gap-1 transition-colors"
                    >
                      <FiEye className="w-3.5 h-3.5" />
                      View
                    </button>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEdit(p);
                        }}
                        className="p-1.5 rounded-lg text-thb-text-muted hover:text-green-500 hover:bg-green-50 transition-colors"
                        title="Edit"
                      >
                        <FiEdit2 className="w-3.5 h-3.5" />
                      </button>
                      {isAdmin && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteConfirmId(p.id);
                          }}
                          className="p-1.5 rounded-lg text-thb-text-muted hover:text-red-500 hover:bg-red-50 transition-colors"
                          title="Delete"
                        >
                          <FiTrash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
