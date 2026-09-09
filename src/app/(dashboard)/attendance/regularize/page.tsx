'use client';

import { useEffect, useState, useCallback } from 'react';
import { FiClock, FiPlus, FiRefreshCw, FiZap, FiCheckCircle, FiXCircle } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import { useCompanyContextStore } from '@/store/companyContextStore';
import ModuleTips from '@/components/ModuleTips';

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

interface Regularization {
  id: string;
  date: string;
  punchType: string;
  requestedTime: string;
  reason: string;
  status: string;
  isWeekend: boolean;
  isHoliday: boolean;
  aiSuggestedTime: string | null;
  aiConfidence: number | null;
  comments: string | null;
  employee?: { id: string; firstName: string; lastName: string; employeeId: string };
}

export default function RegularizePage() {
  const { user } = useAuthStore();
  const scopeQuery = useCompanyContextStore(s => s.scopeQuery);
  const selectedTenantId = useCompanyContextStore(s => s.selectedTenantId);
  const isAdmin = ['super_admin', 'tenant_admin', 'admin'].includes(user?.role || '');

  const [items, setItems] = useState<Regularization[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    punchType: 'check_in',
    requestedTime: '',
    reason: '',
  });

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const sq = scopeQuery();
      const r = await fetch(`/api/attendance/regularize?limit=100${sq ? `&${sq}` : ''}`, { headers: getAuthHeaders() });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed');
      setItems(d.regularizations || []);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [scopeQuery, selectedTenantId]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const handleSubmit = async () => {
    if (!form.date || !form.requestedTime || !form.reason) {
      toast.error('All fields are required');
      return;
    }
    setSubmitting(true);
    try {
      const dt = new Date(`${form.date}T${form.requestedTime}`);
      const r = await fetch('/api/attendance/regularize', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ date: form.date, punchType: form.punchType, requestedTime: dt, reason: form.reason }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed');
      toast.success('Regularization request submitted');
      setShowForm(false);
      setForm({ date: new Date().toISOString().split('T')[0], punchType: 'check_in', requestedTime: '', reason: '' });
      fetchItems();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAction = async (id: string, action: 'approved' | 'rejected') => {
    if (!confirm(`${action === 'approved' ? 'Approve' : 'Reject'} this regularization?`)) return;
    try {
      const r = await fetch(`/api/attendance/regularize/${id}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ status: action }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed');
      toast.success(`Request ${action}`);
      fetchItems();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  };

  const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  const fmtTime = (d: string) => new Date(d).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <FiClock className="w-6 h-6 text-cyan-500" />
            Attendance Regularization
          </h1>
          <p className="text-sm text-slate-500 mt-1">Submit missed-punch requests · AI-assisted · manager approval</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="3boxes-btn-primary flex items-center gap-2">
          <FiPlus className="w-4 h-4" /> Request Regularization
        </button>
      </div>

      <ModuleTips moduleKey="attendance-regularize">
        <p><strong>REQ-REG-01..03:</strong> Employees can request a forgotten Check-In or Check-Out. The AI suggests the most likely time based on history. Regularizations on weekends/holidays require manager + HR approval.</p>
      </ModuleTips>

      {showForm && (
        <div className="thb-card p-6 border-l-4 border-l-cyan-500">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-800">New Regularization</h2>
            <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-700">✕</button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Date *</label>
              <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="3boxes-input w-full" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Punch Type *</label>
              <select value={form.punchType} onChange={e => setForm({ ...form, punchType: e.target.value })} className="3boxes-input w-full">
                <option value="check_in">Check-In (forgot to clock in)</option>
                <option value="check_out">Check-Out (forgot to clock out)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Actual Time *</label>
              <input type="time" value={form.requestedTime} onChange={e => setForm({ ...form, requestedTime: e.target.value })} className="3boxes-input w-full" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Reason *</label>
              <input type="text" value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} className="3boxes-input w-full" placeholder="e.g. Forgot to punch in after meeting" />
            </div>
          </div>
          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-xs text-amber-700">
              <FiZap className="w-3.5 h-3.5 inline mr-1" />
              <strong>AI Suggestion:</strong> After submission, the system will suggest the most likely time based on your last 30 days of check-in history. You can accept the suggestion or keep your requested time.
            </p>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => setShowForm(false)} className="3boxes-btn-secondary">Cancel</button>
            <button onClick={handleSubmit} disabled={submitting} className="3boxes-btn-primary flex items-center gap-2">
              {submitting ? <FiRefreshCw className="w-4 h-4 animate-spin" /> : <FiPlus className="w-4 h-4" />}
              Submit Request
            </button>
          </div>
        </div>
      )}

      <div className="thb-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {isAdmin && <th className="text-left px-4 py-3 font-semibold text-slate-700">Employee</th>}
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Date</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Punch Type</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Requested</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">AI Suggestion</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Reason</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Flags</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Status</th>
                {isAdmin && <th className="text-right px-4 py-3 font-semibold text-slate-700">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={isAdmin ? 9 : 8} className="text-center py-8 text-slate-400">Loading...</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={isAdmin ? 9 : 8} className="text-center py-12 text-slate-500">No regularization requests yet</td></tr>
              ) : items.map(r => (
                <tr key={r.id} className="hover:bg-slate-50">
                  {isAdmin && <td className="px-4 py-3 text-slate-700">{r.employee ? `${r.employee.firstName} ${r.employee.lastName}` : '—'}</td>}
                  <td className="px-4 py-3 text-slate-700">{fmtDate(r.date)}</td>
                  <td className="px-4 py-3 text-slate-700 capitalize">{r.punchType.replace('_', '-')}</td>
                  <td className="px-4 py-3 text-slate-700">{fmtTime(r.requestedTime)}</td>
                  <td className="px-4 py-3 text-slate-700">
                    {r.aiSuggestedTime ? (
                      <span className="text-green-700 text-xs">
                        {fmtTime(r.aiSuggestedTime)}
                        {r.aiConfidence != null && <span className="text-slate-400 ml-1">({Math.round(r.aiConfidence * 100)}%)</span>}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-600 max-w-xs truncate">{r.reason}</td>
                  <td className="px-4 py-3">
                    {r.isWeekend && <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded mr-1">Weekend</span>}
                    {r.isHoliday && <span className="text-[10px] px-1.5 py-0.5 bg-teal-100 text-teal-700 rounded">Holiday</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`thb-badge ${
                      r.status === 'approved' ? 'thb-badge-success' :
                      r.status === 'rejected' ? 'thb-badge-error' : 'thb-badge-warning'
                    }`}>{r.status}</span>
                  </td>
                  {isAdmin && (
                    <td className="px-4 py-3 text-right">
                      {r.status === 'pending' && (
                        <div className="flex justify-end gap-1">
                          <button onClick={() => handleAction(r.id, 'approved')} className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded" title="Approve">
                            <FiCheckCircle className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleAction(r.id, 'rejected')} className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded" title="Reject">
                            <FiXCircle className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
