'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  FiPlus, FiX, FiClock, FiUser, FiBriefcase,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { isClientDemoMode } from '@/lib/site-mode';
import { useAuthStore } from '@/store/authStore';

/* ── Helpers ── */
function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

function formatDate(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getPriorityBadge(priority: string) {
  const map: Record<string, string> = {
    low: 'thb-badge bg-slate-100 text-slate-600',
    medium: 'thb-badge thb-badge-warning',
    high: 'thb-badge bg-orange-50 text-orange-600',
    critical: 'thb-badge thb-badge-error',
  };
  return map[priority] || 'thb-badge thb-badge-info';
}

/* ── Types ── */
interface Task {
  id: string; name: string; projectId: string; assignedToId?: string | null;
  priority: string; status: string; estimatedHours: number;
  plannedEnd?: string | null; plannedStart?: string | null;
  projectName?: string; assigneeName?: string;
}

interface ProjectOption { id: string; name: string }

const COLUMNS = [
  { key: 'todo', label: 'To Do', color: 'border-slate-400' },
  { key: 'in_progress', label: 'In Progress', color: 'border-thb-primary' },
  { key: 'review', label: 'Review', color: 'border-amber-400' },
  { key: 'done', label: 'Done', color: 'border-emerald-500' },
];

const PRIORITIES = ['low', 'medium', 'high', 'critical'];
const STATUSES = ['todo', 'in_progress', 'review', 'done'];

const defaultTask = {
  name: '', projectId: '', assignedToId: '', priority: 'medium',
  status: 'todo', estimatedHours: 0, plannedEnd: '',
};

/* ── Demo fallback data ── */
const DEMO_TASKS: Task[] = isClientDemoMode() ? [
  { id: 'd1', name: 'Design homepage layout', projectId: 'p1', priority: 'high', status: 'in_progress', estimatedHours: 16, plannedEnd: '2026-03-15', projectName: 'Website Redesign', assigneeName: 'Alice K.' },
  { id: 'd2', name: 'Setup CI/CD pipeline', projectId: 'p1', priority: 'critical', status: 'todo', estimatedHours: 8, plannedEnd: '2026-03-12', projectName: 'Website Redesign', assigneeName: 'Bob M.' },
  { id: 'd3', name: 'API authentication module', projectId: 'p2', priority: 'high', status: 'review', estimatedHours: 24, plannedEnd: '2026-03-10', projectName: 'Mobile App', assigneeName: 'Carol S.' },
  { id: 'd4', name: 'Database schema migration', projectId: 'p2', priority: 'medium', status: 'done', estimatedHours: 12, plannedEnd: '2026-03-05', projectName: 'Mobile App', assigneeName: 'Dave R.' },
  { id: 'd5', name: 'Unit test coverage', projectId: 'p3', priority: 'low', status: 'todo', estimatedHours: 20, plannedEnd: '2026-03-20', projectName: 'Backend API', assigneeName: 'Eve T.' },
  { id: 'd6', name: 'Sprint retrospective notes', projectId: 'p1', priority: 'low', status: 'done', estimatedHours: 2, plannedEnd: '2026-03-08', projectName: 'Website Redesign' },
  { id: 'd7', name: 'Performance optimization', projectId: 'p3', priority: 'medium', status: 'in_progress', estimatedHours: 16, plannedEnd: '2026-03-18', projectName: 'Backend API', assigneeName: 'Frank L.' },
  { id: 'd8', name: 'User acceptance testing', projectId: 'p2', priority: 'high', status: 'todo', estimatedHours: 10, plannedEnd: '2026-03-22', projectName: 'Mobile App', assigneeName: 'Grace P.' },
] : [];

const DEMO_PROJECTS: ProjectOption[] = isClientDemoMode() ? [
  { id: 'p1', name: 'Website Redesign' },
  { id: 'p2', name: 'Mobile App' },
  { id: 'p3', name: 'Backend API' },
] : [];

export default function TasksPage() {
  const { user } = useAuthStore();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [form, setForm] = useState(defaultTask);
  const [saving, setSaving] = useState(false);
  const [selectedProject, setSelectedProject] = useState('');

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    try {
      setLoading(true);
      const res = await fetch('/api/projects?limit=50', { headers: getAuthHeaders() });
      let projectList: ProjectOption[] = DEMO_PROJECTS;
      if (res.ok) {
        const data = await res.json();
        projectList = (data.projects || []).map((p: { id: string; name: string }) => ({ id: p.id, name: p.name }));
        if (projectList.length === 0) projectList = DEMO_PROJECTS;
      }
      setProjects(projectList);

      // Fetch tasks from first project if available
      let allTasks: Task[] = [];
      for (const proj of projectList.slice(0, 3)) {
        try {
          const tRes = await fetch(`/api/projects/${proj.id}/tasks`, { headers: getAuthHeaders() });
          if (tRes.ok) {
            const tData = await tRes.json();
            allTasks = allTasks.concat(
              (tData.tasks || []).map((t: Task) => ({ ...t, projectName: proj.name }))
            );
          }
        } catch { /* continue */ }
      }
      setTasks(allTasks.length > 0 ? allTasks : DEMO_TASKS);
    } catch {
      setProjects(DEMO_PROJECTS);
      setTasks(DEMO_TASKS);
    } finally { setLoading(false); }
  }

  const filteredTasks = useMemo(() => {
    if (!selectedProject) return tasks;
    return tasks.filter(t => t.projectId === selectedProject);
  }, [tasks, selectedProject]);

  const columnTasks = useMemo(() => {
    const map: Record<string, Task[]> = {};
    for (const col of COLUMNS) map[col.key] = [];
    for (const t of filteredTasks) {
      const key = COLUMNS.find(c => c.key === t.status)?.key || 'todo';
      if (!map[key]) map[key] = [];
      map[key].push(t);
    }
    return map;
  }, [filteredTasks]);

  async function handleSave() {
    if (!form.name.trim()) { toast.error('Task name is required'); return; }
    if (!form.projectId) { toast.error('Please select a project'); return; }
    try {
      setSaving(true);
      const body = {
        name: form.name, assignedToId: form.assignedToId || undefined,
        priority: form.priority, status: form.status,
        estimatedHours: form.estimatedHours, plannedEnd: form.plannedEnd || undefined,
      };
      const res = await fetch(`/api/projects/${form.projectId}/tasks`, {
        method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(body),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed'); }
      toast.success('Task created');
      setShowForm(false); setForm(defaultTask);
      fetchData();
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Failed to save task'); }
    finally { setSaving(false); }
  }

  async function handleStatusChange(taskId: string, newStatus: string) {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
    toast.success(`Task moved to ${newStatus.replace('_', ' ')}`);
  }

  function openEdit(t: Task) {
    setEditing(t);
    setForm({
      name: t.name, projectId: t.projectId, assignedToId: t.assignedToId || '',
      priority: t.priority, status: t.status, estimatedHours: t.estimatedHours,
      plannedEnd: t.plannedEnd?.slice(0, 10) || '',
    });
    setShowForm(true);
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-thb-text-primary">Task Board</h1>
          <p className="text-sm text-thb-text-secondary mt-1">Kanban-style task management</p>
        </div>
        <div className="flex items-center gap-3">
          <select value={selectedProject} onChange={e => setSelectedProject(e.target.value)}
            className="px-3 py-2 border border-thb-border rounded-lg text-sm bg-white">
            <option value="">All Projects</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button onClick={() => { setEditing(null); setForm(defaultTask); setShowForm(true); }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-thb-primary text-white rounded-lg text-sm font-medium hover:opacity-90">
            <FiPlus className="w-4 h-4" /> Add Task
          </button>
        </div>
      </div>

      {/* Kanban Board */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="thb-card p-4 animate-pulse space-y-3">
              <div className="h-4 bg-slate-200 rounded w-1/2" />
              <div className="h-20 bg-slate-100 rounded" />
              <div className="h-20 bg-slate-100 rounded" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {COLUMNS.map(col => (
            <div key={col.key} className="flex flex-col">
              <div className={`flex items-center gap-2 mb-3 pb-2 border-b-2 ${col.color}`}>
                <span className="font-semibold text-sm text-thb-text-primary">{col.label}</span>
                <span className="thb-badge bg-slate-100 text-slate-600 text-xs">
                  {columnTasks[col.key]?.length || 0}
                </span>
              </div>
              <div className="space-y-3 min-h-[200px]">
                {(columnTasks[col.key] || []).map(task => (
                  <div key={task.id} className="thb-card p-3 space-y-2 thb-card-hover cursor-pointer"
                    onClick={() => openEdit(task)}>
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-sm font-medium text-thb-text-primary leading-tight">{task.name}</h4>
                      <span className={getPriorityBadge(task.priority)}>{task.priority}</span>
                    </div>
                    {task.projectName && (
                      <div className="flex items-center gap-1 text-xs text-thb-text-muted">
                        <FiBriefcase className="w-3 h-3" />{task.projectName}
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs text-thb-text-secondary">
                        {task.assigneeName && (
                          <span className="flex items-center gap-1"><FiUser className="w-3 h-3" />{task.assigneeName}</span>
                        )}
                        {task.plannedEnd && (
                          <span className="flex items-center gap-1"><FiClock className="w-3 h-3" />{formatDate(task.plannedEnd)}</span>
                        )}
                      </div>
                    </div>
                    <div className="pt-1">
                      <select value={task.status}
                        onChange={e => { e.stopPropagation(); handleStatusChange(task.id, e.target.value); }}
                        onClick={e => e.stopPropagation()}
                        className="w-full text-xs px-2 py-1 border border-thb-border rounded bg-white">
                        {STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>)}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowForm(false)}>
          <div className="thb-card w-full max-w-md mx-4 p-6 space-y-4 animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-thb-text-primary">{editing ? 'Edit Task' : 'New Task'}</h2>
              <button onClick={() => setShowForm(false)} className="p-1 rounded hover:bg-slate-100">
                <FiX className="w-5 h-5 text-thb-text-secondary" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-thb-text-secondary">Task Name *</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-thb-border rounded-lg text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-thb-text-secondary">Project *</label>
                <select value={form.projectId} onChange={e => setForm({ ...form, projectId: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-thb-border rounded-lg text-sm">
                  <option value="">Select project</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-thb-text-secondary">Priority</label>
                  <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-thb-border rounded-lg text-sm">
                    {PRIORITIES.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-thb-text-secondary">Status</label>
                  <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-thb-border rounded-lg text-sm">
                    {STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-thb-text-secondary">Est. Hours</label>
                  <input type="number" value={form.estimatedHours}
                    onChange={e => setForm({ ...form, estimatedHours: Number(e.target.value) })}
                    className="w-full mt-1 px-3 py-2 border border-thb-border rounded-lg text-sm" />
                </div>
                <div>
                  <label className="text-xs font-medium text-thb-text-secondary">Due Date</label>
                  <input type="date" value={form.plannedEnd}
                    onChange={e => setForm({ ...form, plannedEnd: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-thb-border rounded-lg text-sm" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-thb-text-secondary">Assignee ID</label>
                <input value={form.assignedToId} onChange={e => setForm({ ...form, assignedToId: e.target.value })}
                  placeholder="Employee ID (optional)"
                  className="w-full mt-1 px-3 py-2 border border-thb-border rounded-lg text-sm" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowForm(false)}
                className="px-4 py-2 border border-thb-border rounded-lg text-sm text-thb-text-secondary hover:bg-slate-50">Cancel</button>
              <button onClick={handleSave} disabled={saving}
                className="px-4 py-2 bg-thb-primary text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">
                {saving ? 'Saving...' : 'Create Task'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
