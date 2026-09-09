'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  FiBriefcase, FiPlus, FiSearch, FiGrid, FiList,
  FiEdit2, FiTrash2, FiX, FiDollarSign, FiClock,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';

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
    active: 'thb-badge thb-badge-success',
    on_hold: 'thb-badge thb-badge-warning',
    completed: 'thb-badge thb-badge-info',
    cancelled: 'thb-badge thb-badge-error',
    draft: 'thb-badge bg-slate-100 text-slate-600',
  };
  return map[status] || 'thb-badge thb-badge-info';
}

function formatStatus(status: string) {
  const map: Record<string, string> = {
    active: 'Active', on_hold: 'On Hold', completed: 'Completed',
    cancelled: 'Cancelled', draft: 'Draft',
  };
  return map[status] || status.replace('_', ' ');
}

/* ── Types ── */
interface Project {
  id: string; name: string; code?: string; projectType: string; billingType: string;
  status: string; startDate: string; endDate?: string | null; budgetAmount: number;
  progress?: number; description?: string; companyId: string;
  client?: { id: string; name: string } | null;
  _count?: { tasks: number; allocations: number };
}

const STATUSES = ['draft', 'active', 'on_hold', 'completed', 'cancelled'];
const PROJECT_TYPES = ['internal', 'client', 'r_and_d', 'support'];
const BILLING_TYPES = ['billable', 'non_billable', 't_and_m', 'fixed_price'];

const defaultForm = {
  name: '', code: '', projectType: 'internal', billingType: 'non_billable',
  status: 'draft', startDate: '', endDate: '', budgetAmount: 0, description: '',
};

export default function ProjectsPage() {
  const { user } = useAuthStore();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchProjects(); }, []);

  async function fetchProjects() {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (filterStatus) params.set('status', filterStatus);
      if (filterType) params.set('projectType', filterType);
      const res = await fetch(`/api/projects?${params}`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setProjects(data.projects || []);
    } catch { toast.error('Failed to load projects'); }
    finally { setLoading(false); }
  }

  useEffect(() => { fetchProjects(); }, [search, filterStatus, filterType]);

  const filtered = useMemo(() => projects, [projects]);

  async function handleSave() {
    if (!form.name.trim()) { toast.error('Project name is required'); return; }
    try {
      setSaving(true);
      const body = { ...form, companyId: user?.tenantId || 'default' };
      let res: Response;
      if (editing) {
        res = await fetch(`/api/projects/${editing.id}`, {
          method: 'PUT', headers: getAuthHeaders(), body: JSON.stringify(body),
        });
      } else {
        res = await fetch('/api/projects', {
          method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(body),
        });
      }
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Save failed'); }
      toast.success(editing ? 'Project updated' : 'Project created');
      setShowForm(false); setEditing(null); setForm(defaultForm);
      fetchProjects();
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Save failed'); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this project?')) return;
    try {
      const res = await fetch(`/api/projects/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Delete failed');
      toast.success('Project deleted');
      fetchProjects();
    } catch { toast.error('Failed to delete project'); }
  }

  function openEdit(p: Project) {
    setEditing(p);
    setForm({
      name: p.name, code: p.code || '', projectType: p.projectType, billingType: p.billingType,
      status: p.status, startDate: p.startDate?.slice(0, 10) || '',
      endDate: p.endDate?.slice(0, 10) || '', budgetAmount: p.budgetAmount || 0,
      description: p.description || '',
    });
    setShowForm(true);
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-thb-text-primary">Projects</h1>
          <p className="text-sm text-thb-text-secondary mt-1">Manage and track all your projects</p>
        </div>
        <button onClick={() => { setEditing(null); setForm(defaultForm); setShowForm(true); }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-thb-primary text-white rounded-lg text-sm font-medium hover:opacity-90">
          <FiPlus className="w-4 h-4" /> New Project
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-thb-text-muted" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search projects..."
            className="w-full pl-9 pr-3 py-2 border border-thb-border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-thb-primary/20" />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="px-3 py-2 border border-thb-border rounded-lg text-sm bg-white">
          <option value="">All Statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{formatStatus(s)}</option>)}
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)}
          className="px-3 py-2 border border-thb-border rounded-lg text-sm bg-white">
          <option value="">All Types</option>
          {PROJECT_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>)}
        </select>
        <div className="flex border border-thb-border rounded-lg overflow-hidden">
          <button onClick={() => setViewMode('grid')}
            className={`p-2 ${viewMode === 'grid' ? 'bg-thb-primary text-white' : 'bg-white text-thb-text-secondary'}`}>
            <FiGrid className="w-4 h-4" />
          </button>
          <button onClick={() => setViewMode('list')}
            className={`p-2 ${viewMode === 'list' ? 'bg-thb-primary text-white' : 'bg-white text-thb-text-secondary'}`}>
            <FiList className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="thb-card p-5 animate-pulse">
              <div className="h-4 bg-slate-200 rounded w-3/4 mb-3" />
              <div className="h-3 bg-slate-100 rounded w-1/2 mb-2" />
              <div className="h-3 bg-slate-100 rounded w-2/3" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="thb-card p-12 text-center">
          <FiBriefcase className="w-12 h-12 text-thb-text-muted mx-auto mb-3" />
          <p className="text-thb-text-secondary">No projects found. Create your first project!</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(p => (
            <div key={p.id} className="thb-card thb-card-hover p-5 space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-thb-text-primary truncate">{p.name}</h3>
                  {p.code && <p className="text-xs text-thb-text-muted mt-0.5">{p.code}</p>}
                </div>
                <span className={getStatusBadge(p.status)}>{formatStatus(p.status)}</span>
              </div>
              <div className="flex items-center gap-4 text-xs text-thb-text-secondary">
                <span className="flex items-center gap-1"><FiBriefcase className="w-3 h-3" />{p.projectType.replace('_', ' ')}</span>
                <span className="flex items-center gap-1"><FiClock className="w-3 h-3" />{formatDate(p.startDate)}</span>
              </div>
              {(p.budgetAmount > 0) && (
                <div className="flex items-center gap-1 text-xs text-thb-text-secondary">
                  <FiDollarSign className="w-3 h-3" />{p.budgetAmount.toLocaleString()}
                </div>
              )}
              {p.progress !== undefined && p.progress > 0 && (
                <div>
                  <div className="flex justify-between text-xs text-thb-text-muted mb-1">
                    <span>Progress</span><span>{p.progress}%</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5">
                    <div className="bg-thb-primary rounded-full h-1.5 transition-all" style={{ width: `${p.progress}%` }} />
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between pt-2 border-t border-thb-border">
                <span className="text-xs text-thb-text-muted">{p._count?.tasks || 0} tasks</span>
                <div className="flex items-center gap-1">
                  <button onClick={() => openEdit(p)} className="p-1.5 rounded hover:bg-slate-100 text-thb-text-secondary">
                    <FiEdit2 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleDelete(p.id)} className="p-1.5 rounded hover:bg-red-50 text-red-500">
                    <FiTrash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="thb-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-thb-border">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-thb-text-secondary">Project</th>
                  <th className="text-left px-4 py-3 font-medium text-thb-text-secondary">Type</th>
                  <th className="text-left px-4 py-3 font-medium text-thb-text-secondary">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-thb-text-secondary">Start</th>
                  <th className="text-left px-4 py-3 font-medium text-thb-text-secondary">Budget</th>
                  <th className="text-left px-4 py-3 font-medium text-thb-text-secondary">Tasks</th>
                  <th className="text-right px-4 py-3 font-medium text-thb-text-secondary">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={p.id} className="border-b border-thb-border hover:bg-slate-50/50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-thb-text-primary">{p.name}</div>
                      {p.code && <div className="text-xs text-thb-text-muted">{p.code}</div>}
                    </td>
                    <td className="px-4 py-3 text-thb-text-secondary">{p.projectType.replace('_', ' ')}</td>
                    <td className="px-4 py-3"><span className={getStatusBadge(p.status)}>{formatStatus(p.status)}</span></td>
                    <td className="px-4 py-3 text-thb-text-secondary">{formatDate(p.startDate)}</td>
                    <td className="px-4 py-3 text-thb-text-secondary">{p.budgetAmount ? p.budgetAmount.toLocaleString() : '—'}</td>
                    <td className="px-4 py-3 text-thb-text-secondary">{p._count?.tasks || 0}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(p)} className="p-1.5 rounded hover:bg-slate-100 text-thb-text-secondary">
                          <FiEdit2 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDelete(p.id)} className="p-1.5 rounded hover:bg-red-50 text-red-500">
                          <FiTrash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowForm(false)}>
          <div className="thb-card w-full max-w-lg mx-4 p-6 space-y-4 animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-thb-text-primary">{editing ? 'Edit Project' : 'New Project'}</h2>
              <button onClick={() => setShowForm(false)} className="p-1 rounded hover:bg-slate-100">
                <FiX className="w-5 h-5 text-thb-text-secondary" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-xs font-medium text-thb-text-secondary">Name *</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-thb-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-thb-primary/20" />
              </div>
              <div>
                <label className="text-xs font-medium text-thb-text-secondary">Code</label>
                <input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-thb-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-thb-primary/20" />
              </div>
              <div>
                <label className="text-xs font-medium text-thb-text-secondary">Project Type</label>
                <select value={form.projectType} onChange={e => setForm({ ...form, projectType: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-thb-border rounded-lg text-sm">
                  {PROJECT_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-thb-text-secondary">Billing Type</label>
                <select value={form.billingType} onChange={e => setForm({ ...form, billingType: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-thb-border rounded-lg text-sm">
                  {BILLING_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-thb-text-secondary">Status</label>
                <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-thb-border rounded-lg text-sm">
                  {STATUSES.map(s => <option key={s} value={s}>{formatStatus(s)}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-thb-text-secondary">Start Date *</label>
                <input type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-thb-border rounded-lg text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-thb-text-secondary">End Date</label>
                <input type="date" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-thb-border rounded-lg text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-thb-text-secondary">Budget</label>
                <input type="number" value={form.budgetAmount} onChange={e => setForm({ ...form, budgetAmount: Number(e.target.value) })}
                  className="w-full mt-1 px-3 py-2 border border-thb-border rounded-lg text-sm" />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-medium text-thb-text-secondary">Description</label>
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2}
                  className="w-full mt-1 px-3 py-2 border border-thb-border rounded-lg text-sm resize-none" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowForm(false)}
                className="px-4 py-2 border border-thb-border rounded-lg text-sm text-thb-text-secondary hover:bg-slate-50">Cancel</button>
              <button onClick={handleSave} disabled={saving}
                className="px-4 py-2 bg-thb-primary text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">
                {saving ? 'Saving...' : editing ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
