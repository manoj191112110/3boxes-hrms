'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  FiPlus, FiX, FiEdit2, FiTrash2, FiList, FiCopy,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

interface OnboardingTaskTemplate {
  id: string;
  tenantId: string;
  name: string;
  task: string;
  category: string;
  dueOffsetDays: number;
  appliesToRole: string | null;
  appliesToDepartment: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const CATEGORY_OPTIONS = [
  { value: 'general', label: 'General' },
  { value: 'it_setup', label: 'IT Setup' },
  { value: 'hr_docs', label: 'HR Documents' },
  { value: 'training', label: 'Training' },
  { value: 'introduction', label: 'Introduction' },
  { value: 'buddy_setup', label: 'Buddy Setup' },
  { value: 'payroll_setup', label: 'Payroll Setup' },
  { value: 'project_allocation', label: 'Project Allocation' },
];

const initialForm = {
  name: '',
  task: '',
  category: 'general',
  dueOffsetDays: 0,
  appliesToRole: '',
  appliesToDepartment: '',
  isActive: true,
};

function getCategoryBadge(category: string) {
  const map: Record<string, string> = {
    general: 'bg-slate-100 text-slate-700',
    it_setup: 'bg-teal-50 text-teal-700',
    hr_docs: 'bg-green-50 text-green-700',
    training: 'bg-amber-50 text-amber-700',
    introduction: 'bg-cyan-50 text-cyan-700',
    buddy_setup: 'bg-emerald-50 text-emerald-700',
    payroll_setup: 'bg-rose-50 text-rose-700',
    project_allocation: 'bg-emerald-50 text-emerald-700',
  };
  return map[category] || 'bg-slate-100 text-slate-700';
}

export default function OnboardingTemplatesPage() {
  const { user } = useAuthStore();
  const [templates, setTemplates] = useState<OnboardingTaskTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [filterCategory, setFilterCategory] = useState('');

  const fetchTemplates = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/onboarding/templates', { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setTemplates(Array.isArray(data) ? data : data.templates || []);
      } else {
        setTemplates([]);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load onboarding templates');
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => fetchTemplates());
  }, [fetchTemplates]);

  const handleAddNew = () => {
    setForm(initialForm);
    setEditingId(null);
    setShowForm(true);
    setTimeout(() => document.getElementById('crud-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  const handleEdit = (t: OnboardingTaskTemplate) => {
    setForm({
      name: t.name || '',
      task: t.task || '',
      category: t.category || 'general',
      dueOffsetDays: t.dueOffsetDays || 0,
      appliesToRole: t.appliesToRole || '',
      appliesToDepartment: t.appliesToDepartment || '',
      isActive: t.isActive !== false,
    });
    setEditingId(t.id);
    setShowForm(true);
    setTimeout(() => document.getElementById('crud-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(initialForm);
  };

  const handleSubmit = async () => {
    if (!form.name || !form.task) {
      toast.error('Name and task are required');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        name: form.name,
        task: form.task,
        category: form.category,
        dueOffsetDays: Number(form.dueOffsetDays) || 0,
        appliesToRole: form.appliesToRole || null,
        appliesToDepartment: form.appliesToDepartment || null,
        isActive: form.isActive,
      };
      if (editingId) {
        const res = await fetch(`/api/onboarding/templates/${editingId}`, {
          method: 'PATCH',
          headers: getAuthHeaders(),
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const d = await res.json();
          throw new Error(d.error || 'Failed');
        }
        toast.success('Template updated');
      } else {
        const res = await fetch('/api/onboarding/templates', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const d = await res.json();
          throw new Error(d.error || 'Failed');
        }
        toast.success('Template created');
      }
      handleCancelForm();
      fetchTemplates();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      setDeleting(true);
      const res = await fetch(`/api/onboarding/templates/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed');
      }
      toast.success('Template deleted');
      setDeleteConfirmId(null);
      fetchTemplates();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setDeleting(false);
    }
  };

  const handleToggleActive = async (t: OnboardingTaskTemplate) => {
    try {
      const res = await fetch(`/api/onboarding/templates/${t.id}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ isActive: !t.isActive }),
      });
      if (!res.ok) throw new Error('Failed');
      toast.success(`Template ${!t.isActive ? 'activated' : 'deactivated'}`);
      fetchTemplates();
    } catch {
      toast.error('Failed to toggle');
    }
  };

  const filtered = templates.filter((t) => !filterCategory || t.category === filterCategory);

  // Stats
  const stats = {
    total: templates.length,
    active: templates.filter((t) => t.isActive).length,
    byCategory: CATEGORY_OPTIONS.map((c) => ({
      ...c,
      count: templates.filter((t) => t.category === c.value).length,
    })).filter((c) => c.count > 0),
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-thb-text-primary flex items-center gap-2">
            <FiList className="w-6 h-6 text-emerald-500" />
            Onboarding Task Templates
          </h1>
          <p className="text-thb-text-secondary mt-1">
            Reusable task templates auto-applied when a preboarding candidate joins
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/onboarding"
            className="px-4 py-2.5 rounded-lg border border-thb-border text-sm font-medium text-thb-text-secondary hover:bg-slate-50 transition-colors"
          >
            Back to Onboarding
          </Link>
          <button
            onClick={handleAddNew}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 font-medium text-sm shadow-sm shadow-emerald-500/25 transition-colors"
          >
            <FiPlus className="w-4 h-4" /> New Template
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="thb-card p-4">
          <p className="text-xs font-medium text-thb-text-secondary">Total Templates</p>
          <p className="text-xl font-bold text-thb-text-primary mt-1">{stats.total}</p>
        </div>
        <div className="thb-card p-4">
          <p className="text-xs font-medium text-thb-text-secondary">Active</p>
          <p className="text-xl font-bold text-emerald-600 mt-1">{stats.active}</p>
        </div>
        <div className="thb-card p-4">
          <p className="text-xs font-medium text-thb-text-secondary">Categories</p>
          <p className="text-xl font-bold text-thb-text-primary mt-1">{stats.byCategory.length}</p>
        </div>
        <div className="thb-card p-4">
          <p className="text-xs font-medium text-thb-text-secondary">Inactive</p>
          <p className="text-xl font-bold text-amber-600 mt-1">{stats.total - stats.active}</p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-thb-text-secondary">Filter:</span>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="px-3 py-2 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
        >
          <option value="">All Categories</option>
          {CATEGORY_OPTIONS.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </div>

      {/* Form */}
      {showForm && (
        <div id="crud-form" className="thb-card border-l-4 border-l-emerald-500">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-thb-text-primary">
                {editingId ? 'Edit Template' : 'Create New Template'}
              </h2>
              <button onClick={handleCancelForm} className="p-2 rounded-lg text-thb-text-muted hover:text-thb-text-primary hover:bg-slate-100 transition-colors"><FiX className="w-5 h-5" /></button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Template Name *</label>
                <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400" placeholder="e.g., IT Setup Day 1" />
              </div>
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Task *</label>
                <input required value={form.task} onChange={(e) => setForm({ ...form, task: e.target.value })} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400" placeholder="e.g., Provision laptop and email account" />
              </div>
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Category</label>
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400">
                  {CATEGORY_OPTIONS.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Due Offset (days from joining)</label>
                <input type="number" value={form.dueOffsetDays} onChange={(e) => setForm({ ...form, dueOffsetDays: parseInt(e.target.value) || 0 })} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400" placeholder="0 (Day 1), 7 (Week 1), -1 (Day before)" />
                <p className="text-[10px] text-thb-text-muted mt-1">Negative = before joining; 0 = Day 1.</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Applies to Role (optional)</label>
                <input value={form.appliesToRole} onChange={(e) => setForm({ ...form, appliesToRole: e.target.value })} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400" placeholder="e.g., engineer, manager" />
              </div>
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Applies to Department ID (optional)</label>
                <input value={form.appliesToDepartment} onChange={(e) => setForm({ ...form, appliesToDepartment: e.target.value })} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400" placeholder="dept-xxx" />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-thb-text-secondary mt-4">
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="rounded border-thb-border" />
              Active (auto-applies when a preboarding candidate joins)
            </label>
            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-thb-border">
              <button onClick={handleCancelForm} className="px-4 py-2.5 rounded-lg border border-thb-border text-sm font-medium text-thb-text-secondary hover:bg-slate-50 transition-colors">Cancel</button>
              <button onClick={handleSubmit} disabled={submitting} className="px-6 py-2.5 rounded-lg bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 disabled:opacity-50 shadow-sm shadow-emerald-500/25 transition-colors">{submitting ? 'Saving...' : editingId ? 'Update' : 'Create'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Templates Table */}
      <div className="thb-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-thb-border bg-slate-50/50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Name</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Task</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Category</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Due</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Active</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-thb-text-muted">Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <FiList className="w-10 h-10 text-thb-text-muted mx-auto mb-3" />
                    <p className="text-thb-text-secondary font-medium">No onboarding templates yet</p>
                    <p className="text-sm text-thb-text-muted mt-1">Templates auto-apply as onboarding tasks when a preboarding candidate joins.</p>
                  </td>
                </tr>
              ) : (
                filtered.map((t) => (
                  <tr key={t.id} className="border-b border-thb-border/50 hover:bg-slate-50/50 transition-colors">
                    {deleteConfirmId === t.id ? (
                      <td colSpan={6} className="px-4 py-3 bg-red-50">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-red-700 font-medium">Delete &quot;{t.name}&quot;?</span>
                          <div className="flex items-center gap-2">
                            <button onClick={() => handleDelete(t.id)} disabled={deleting} className="px-3 py-1.5 bg-red-500 text-white text-xs font-medium rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors">{deleting ? 'Deleting...' : 'Confirm'}</button>
                            <button onClick={() => setDeleteConfirmId(null)} className="px-3 py-1.5 border border-thb-border text-xs font-medium rounded-lg hover:bg-slate-50 transition-colors">Cancel</button>
                          </div>
                        </div>
                      </td>
                    ) : (
                      <>
                        <td className="px-4 py-3 text-sm font-medium text-thb-text-primary">{t.name}</td>
                        <td className="px-4 py-3 text-sm text-thb-text-secondary max-w-[300px] truncate">{t.task}</td>
                        <td className="px-4 py-3"><span className={`text-xs font-medium px-2 py-1 rounded ${getCategoryBadge(t.category)}`}>{t.category}</span></td>
                        <td className="px-4 py-3 text-sm text-thb-text-secondary">
                          {t.dueOffsetDays === 0 ? 'Day 1' : t.dueOffsetDays > 0 ? `+${t.dueOffsetDays}d` : `${t.dueOffsetDays}d`}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => handleToggleActive(t)}
                            className={`text-xs font-medium px-2 py-1 rounded transition-colors ${t.isActive ? 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100' : 'text-slate-500 bg-slate-50 hover:bg-slate-100'}`}
                          >
                            {t.isActive ? 'Active' : 'Inactive'}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => handleEdit(t)} className="p-2 rounded-lg text-thb-text-muted hover:text-green-500 hover:bg-green-50 transition-colors" title="Edit"><FiEdit2 className="w-4 h-4" /></button>
                            <button onClick={() => setDeleteConfirmId(t.id)} className="p-2 rounded-lg text-thb-text-muted hover:text-red-500 hover:bg-red-50 transition-colors" title="Delete"><FiTrash2 className="w-4 h-4" /></button>
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
