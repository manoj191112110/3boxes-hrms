'use client';

import { useEffect, useState, useCallback } from 'react';
import { FiRefreshCw, FiPlus, FiTrash2, FiCalendar, FiUsers } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import ModuleTips from '@/components/ModuleTips';

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

interface Shift { id: string; name: string; startTime: string; endTime: string }
interface Roster {
  id: string;
  name: string;
  description: string | null;
  pattern: string[];
  rotationUnit: string;
  startDate: string;
  isActive: boolean;
  assignments: Array<{
    id: string;
    currentOffset: number;
    startDate: string;
    employee: { id: string; firstName: string; lastName: string; employeeId: string };
  }>;
}

export default function RostersPage() {
  const { user } = useAuthStore();
  const isAdmin = ['super_admin', 'tenant_admin', 'admin'].includes(user?.role || '');

  const [rosters, setRosters] = useState<Roster[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    name: '',
    description: '',
    pattern: [] as string[],
    rotationUnit: 'week',
    startDate: new Date().toISOString().split('T')[0],
  });

  const fetchRosters = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/rosters?limit=100', { headers: getAuthHeaders() });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed');
      setRosters(d.rosters || []);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchShifts = useCallback(async () => {
    try {
      const r = await fetch('/api/shifts', { headers: getAuthHeaders() });
      const d = await r.json();
      // d may be array or { shifts: [] }
      setShifts(Array.isArray(d) ? d : (d.shifts || []));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchRosters(); if (isAdmin) fetchShifts(); }, [fetchRosters, fetchShifts, isAdmin]);

  const handleSubmit = async () => {
    if (!form.name || form.pattern.length === 0) {
      toast.error('Name and at least one shift in pattern are required');
      return;
    }
    setSubmitting(true);
    try {
      const r = await fetch('/api/rosters', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(form),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed');
      toast.success('Roster created');
      setShowForm(false);
      setForm({ name: '', description: '', pattern: [], rotationUnit: 'week', startDate: new Date().toISOString().split('T')[0] });
      fetchRosters();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this roster? Assigned employees will be unassigned.')) return;
    try {
      const r = await fetch(`/api/rosters/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
      if (!r.ok) throw new Error('Failed');
      toast.success('Roster deleted');
      fetchRosters();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  };

  const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

  const shiftName = (id: string) => shifts.find(s => s.id === id)?.name || 'Unknown shift';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <FiRefreshCw className="w-6 h-6 text-cyan-500" />
            Rotational Rosters
          </h1>
          <p className="text-sm text-slate-500 mt-1">Configure auto-rotating shifts for manufacturing or support teams</p>
        </div>
        {isAdmin && (
          <button onClick={() => setShowForm(!showForm)} className="3boxes-btn-primary flex items-center gap-2">
            <FiPlus className="w-4 h-4" /> New Roster
          </button>
        )}
      </div>

      <ModuleTips moduleKey="settings-rosters">
        <p><strong>REQ-CFG-02:</strong> Create rosters with an ordered pattern of shifts (e.g. Week 1: Morning, Week 2: Night). The system auto-rotates employees through the pattern every rotation unit (day or week). Assign employees to a roster from the employee profile.</p>
      </ModuleTips>

      {showForm && isAdmin && (
        <div className="thb-card p-6 border-l-4 border-l-cyan-500">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-800">New Rotational Roster</h2>
            <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-700">✕</button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Name *</label>
              <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="3boxes-input w-full" placeholder="e.g. Support Team A — Weekly Rotation" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Start Date *</label>
              <input type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} className="3boxes-input w-full" />
            </div>
          </div>
          <div className="mt-4">
            <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
            <textarea rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="3boxes-input w-full" />
          </div>
          <div className="mt-4">
            <label className="block text-xs font-medium text-slate-600 mb-1">Rotation Unit</label>
            <select value={form.rotationUnit} onChange={e => setForm({ ...form, rotationUnit: e.target.value })} className="3boxes-input w-full">
              <option value="week">Weekly (rotate every week)</option>
              <option value="day">Daily (rotate every day)</option>
            </select>
          </div>
          <div className="mt-4">
            <label className="block text-xs font-medium text-slate-600 mb-1">Pattern (ordered list of shifts)</label>
            <p className="text-xs text-slate-500 mb-2">Add shifts in the order employees should rotate through them. e.g. Morning → Morning → Night → Morning → Morning → Night for a 3-week rotation.</p>
            {shifts.length === 0 ? (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">No shifts configured. Create shifts in Settings → Shifts first.</p>
            ) : (
              <div className="space-y-2">
                {form.pattern.map((shiftId, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-500 w-6">{idx + 1}.</span>
                    <select value={shiftId} onChange={e => {
                      const next = [...form.pattern];
                      next[idx] = e.target.value;
                      setForm({ ...form, pattern: next });
                    }} className="3boxes-input flex-1">
                      {shifts.map(s => <option key={s.id} value={s.id}>{s.name} ({s.startTime} - {s.endTime})</option>)}
                    </select>
                    <button onClick={() => setForm({ ...form, pattern: form.pattern.filter((_, i) => i !== idx) })} className="p-1 text-red-500 hover:text-red-700">
                      <FiTrash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                <button onClick={() => setForm({ ...form, pattern: [...form.pattern, shifts[0]?.id || ''] })} className="text-xs text-cyan-600 hover:text-cyan-700 flex items-center gap-1">
                  <FiPlus className="w-3 h-3" /> Add Shift to Pattern
                </button>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => setShowForm(false)} className="3boxes-btn-secondary">Cancel</button>
            <button onClick={handleSubmit} disabled={submitting} className="3boxes-btn-primary flex items-center gap-2">
              {submitting ? <FiRefreshCw className="w-4 h-4 animate-spin" /> : <FiPlus className="w-4 h-4" />}
              Create Roster
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-slate-400">Loading...</div>
      ) : rosters.length === 0 ? (
        <div className="thb-card p-12 text-center">
          <FiCalendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">No rotational rosters configured.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {rosters.map(r => (
            <div key={r.id} className="thb-card p-5">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-800">{r.name}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{r.description || 'No description'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${r.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                    {r.isActive ? 'Active' : 'Inactive'}
                  </span>
                  {isAdmin && (
                    <button onClick={() => handleDelete(r.id)} className="p-1 text-slate-400 hover:text-red-600" title="Delete">
                      <FiTrash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
              <div className="mt-3 space-y-1 text-xs text-slate-600">
                <p><FiCalendar className="w-3 h-3 inline mr-1" /> Starts: {fmtDate(r.startDate)} · Rotates: {r.rotationUnit === 'week' ? 'weekly' : 'daily'}</p>
                <p className="mt-2">
                  <strong>Pattern:</strong>{' '}
                  {Array.isArray(r.pattern) && r.pattern.length > 0 ? (
                    <span className="inline-flex flex-wrap gap-1 mt-1">
                      {r.pattern.map((sid, i) => (
                        <span key={i} className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px]">
                          {i + 1}. {shiftName(sid)}
                        </span>
                      ))}
                    </span>
                  ) : <span className="text-slate-400">No pattern</span>}
                </p>
                <p className="mt-2">
                  <FiUsers className="w-3 h-3 inline mr-1" />
                  <strong>Assigned:</strong> {r.assignments?.length || 0} employee(s)
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
