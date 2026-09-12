'use client';

import { useState, useMemo } from 'react';
import {
  FiZap, FiPlus, FiX, FiCalendar, FiTarget, FiClock,
  FiPlay, FiCheckCircle, FiEdit2, FiTrendingUp,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { isClientDemoMode } from '@/lib/site-mode';
import { useAuthStore } from '@/store/authStore';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

/* ── Helpers ── */
function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getSprintStatusBadge(status: string) {
  const map: Record<string, string> = {
    planning: 'thb-badge bg-slate-100 text-slate-600',
    active: 'thb-badge thb-badge-success',
    completed: 'thb-badge thb-badge-info',
  };
  return map[status] || 'thb-badge thb-badge-info';
}

/* ── Types ── */
interface Sprint {
  id: string; name: string; startDate: string; endDate: string;
  status: 'planning' | 'active' | 'completed'; goal: string;
  taskCount: number; completedTasks: number; totalPoints: number; completedPoints: number;
}

const SPRINT_STATUSES = ['planning', 'active', 'completed'];

/* ── Demo Data ── */
const DEMO_SPRINTS: Sprint[] = isClientDemoMode() ? [
  { id: 's1', name: 'Sprint 12', startDate: '2026-03-02', endDate: '2026-03-15', status: 'active', goal: 'Complete user dashboard and reporting module', taskCount: 14, completedTasks: 8, totalPoints: 42, completedPoints: 28 },
  { id: 's2', name: 'Sprint 11', startDate: '2026-02-16', endDate: '2026-03-01', status: 'completed', goal: 'API integration and performance optimization', taskCount: 12, completedTasks: 12, totalPoints: 36, completedPoints: 36 },
  { id: 's3', name: 'Sprint 13', startDate: '2026-03-16', endDate: '2026-03-29', status: 'planning', goal: 'Mobile app beta release and bug fixes', taskCount: 10, completedTasks: 0, totalPoints: 30, completedPoints: 0 },
  { id: 's4', name: 'Sprint 10', startDate: '2026-02-02', endDate: '2026-02-15', status: 'completed', goal: 'Authentication overhaul and security audit', taskCount: 11, completedTasks: 10, totalPoints: 33, completedPoints: 30 },
] : [];

const BURNDOWN_DATA = isClientDemoMode() ? [
  { day: 'Day 1', ideal: 42, actual: 42 },
  { day: 'Day 2', ideal: 39, actual: 40 },
  { day: 'Day 3', ideal: 36, actual: 37 },
  { day: 'Day 4', ideal: 33, actual: 34 },
  { day: 'Day 5', ideal: 30, actual: 30 },
  { day: 'Day 6', ideal: 27, actual: 29 },
  { day: 'Day 7', ideal: 24, actual: 26 },
  { day: 'Day 8', ideal: 21, actual: 22 },
  { day: 'Day 9', ideal: 18, actual: 18 },
  { day: 'Day 10', ideal: 15, actual: 14 },
] : [];

const defaultForm = { name: '', startDate: '', endDate: '', status: 'planning' as const, goal: '' };

export default function SprintsPage() {
  const { user } = useAuthStore();
  const [sprints, setSprints] = useState<Sprint[]>(DEMO_SPRINTS);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Sprint | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);
  const [selectedSprint, setSelectedSprint] = useState<string>('s1');

  const activeSprint = useMemo(() => sprints.find(s => s.id === selectedSprint) || sprints.find(s => s.status === 'active') || sprints[0], [sprints, selectedSprint]);

  const stats = useMemo(() => ({
    total: sprints.length,
    active: sprints.filter(s => s.status === 'active').length,
    completed: sprints.filter(s => s.status === 'completed').length,
    totalTasks: sprints.reduce((a, s) => a + s.taskCount, 0),
  }), [sprints]);

  async function handleSave() {
    if (!form.name.trim()) { toast.error('Sprint name is required'); return; }
    try {
      setSaving(true);
      if (editing) {
        setSprints(prev => prev.map(s => s.id === editing.id
          ? { ...s, name: form.name, startDate: form.startDate || s.startDate, endDate: form.endDate || s.endDate, status: form.status, goal: form.goal }
          : s));
        toast.success('Sprint updated');
      } else {
        const newSprint: Sprint = {
          id: `s${Date.now()}`, name: form.name,
          startDate: form.startDate || new Date().toISOString().slice(0, 10),
          endDate: form.endDate || new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
          status: form.status, goal: form.goal, taskCount: 0, completedTasks: 0, totalPoints: 0, completedPoints: 0,
        };
        setSprints(prev => [...prev, newSprint]);
        toast.success('Sprint created');
      }
      setShowForm(false); setEditing(null); setForm(defaultForm);
    } catch { toast.error('Failed to save sprint'); }
    finally { setSaving(false); }
  }

  function openEdit(s: Sprint) {
    setEditing(s);
    setForm({ name: s.name, startDate: s.startDate, endDate: s.endDate, status: s.status, goal: s.goal });
    setShowForm(true);
  }

  function getStatusIcon(status: string) {
    switch (status) {
      case 'planning': return <FiClock className="w-4 h-4 text-slate-500" />;
      case 'active': return <FiPlay className="w-4 h-4 text-emerald-500" />;
      case 'completed': return <FiCheckCircle className="w-4 h-4 text-green-500" />;
      default: return null;
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-thb-text-primary">Sprints</h1>
          <p className="text-sm text-thb-text-secondary mt-1">Manage sprints and track velocity</p>
        </div>
        <button onClick={() => { setEditing(null); setForm(defaultForm); setShowForm(true); }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-thb-primary text-white rounded-lg text-sm font-medium hover:opacity-90">
          <FiPlus className="w-4 h-4" /> New Sprint
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Sprints', value: stats.total, icon: FiZap, color: 'text-thb-primary bg-thb-primary/10' },
          { label: 'Active', value: stats.active, icon: FiPlay, color: 'text-emerald-600 bg-emerald-50' },
          { label: 'Completed', value: stats.completed, icon: FiCheckCircle, color: 'text-green-600 bg-green-50' },
          { label: 'Total Tasks', value: stats.totalTasks, icon: FiTarget, color: 'text-amber-600 bg-amber-50' },
        ].map(stat => (
          <div key={stat.label} className="thb-card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-thb-text-muted font-medium">{stat.label}</p>
                <p className="text-2xl font-bold text-thb-text-primary mt-1">{stat.value}</p>
              </div>
              <div className={`p-2 rounded-lg ${stat.color}`}>
                <stat.icon className="w-5 h-5" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Burndown Chart */}
      {activeSprint && activeSprint.status === 'active' && (
        <div className="thb-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-thb-text-primary">{activeSprint.name} — Burndown</h3>
              <p className="text-xs text-thb-text-muted mt-0.5">
                {formatDate(activeSprint.startDate)} – {formatDate(activeSprint.endDate)} · {activeSprint.completedTasks}/{activeSprint.taskCount} tasks
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs text-thb-text-secondary">
              <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-slate-400 inline-block" /> Ideal</span>
              <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-thb-primary inline-block" /> Actual</span>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={BURNDOWN_DATA}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="#94A3B8" />
                <YAxis tick={{ fontSize: 11 }} stroke="#94A3B8" />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E2E8F0' }} />
                <Area type="monotone" dataKey="ideal" stroke="#94A3B8" fill="#F1F5F9" strokeWidth={2} strokeDasharray="5 5" />
                <Area type="monotone" dataKey="actual" stroke="#3B82F6" fill="#DBEAFE" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Sprint List */}
      <div className="space-y-3">
        <h3 className="font-semibold text-thb-text-primary">All Sprints</h3>
        {sprints.map(sprint => (
          <div key={sprint.id} className="thb-card p-4 thb-card-hover">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                {getStatusIcon(sprint.status)}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-thb-text-primary">{sprint.name}</h4>
                    <span className={getSprintStatusBadge(sprint.status)}>{sprint.status}</span>
                  </div>
                  <p className="text-xs text-thb-text-muted mt-0.5">{sprint.goal}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-thb-text-secondary">
                    <span className="flex items-center gap-1"><FiCalendar className="w-3 h-3" />{formatDate(sprint.startDate)} – {formatDate(sprint.endDate)}</span>
                    <span className="flex items-center gap-1"><FiTarget className="w-3 h-3" />{sprint.taskCount} tasks</span>
                    <span className="flex items-center gap-1"><FiTrendingUp className="w-3 h-3" />{sprint.completedPoints}/{sprint.totalPoints} pts</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 sm:ml-4">
                {/* Progress bar */}
                <div className="w-24">
                  <div className="w-full bg-slate-100 rounded-full h-2">
                    <div className="bg-thb-primary rounded-full h-2 transition-all"
                      style={{ width: `${sprint.taskCount ? Math.round((sprint.completedTasks / sprint.taskCount) * 100) : 0}%` }} />
                  </div>
                  <p className="text-xs text-thb-text-muted mt-1 text-right">
                    {sprint.taskCount ? Math.round((sprint.completedTasks / sprint.taskCount) * 100) : 0}%
                  </p>
                </div>
                <button onClick={() => openEdit(sprint)} className="p-1.5 rounded hover:bg-slate-100 text-thb-text-secondary">
                  <FiEdit2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowForm(false)}>
          <div className="thb-card w-full max-w-md mx-4 p-6 space-y-4 animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-thb-text-primary">{editing ? 'Edit Sprint' : 'New Sprint'}</h2>
              <button onClick={() => setShowForm(false)} className="p-1 rounded hover:bg-slate-100">
                <FiX className="w-5 h-5 text-thb-text-secondary" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-thb-text-secondary">Sprint Name <span className="text-red-500 font-bold">*</span></label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-thb-border rounded-lg text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-thb-text-secondary">Start Date</label>
                  <input type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-thb-border rounded-lg text-sm" />
                </div>
                <div>
                  <label className="text-xs font-medium text-thb-text-secondary">End Date</label>
                  <input type="date" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-thb-border rounded-lg text-sm" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-thb-text-secondary">Status</label>
                <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as 'planning' | 'active' | 'completed' })}
                  className="w-full mt-1 px-3 py-2 border border-thb-border rounded-lg text-sm">
                  {SPRINT_STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-thb-text-secondary">Goal</label>
                <textarea value={form.goal} onChange={e => setForm({ ...form, goal: e.target.value })} rows={2}
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
