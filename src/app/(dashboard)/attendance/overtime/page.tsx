'use client';

import { useEffect, useState, useCallback } from 'react';
import { FiClock, FiPlus, FiRefreshCw, FiCheckCircle, FiXCircle, FiGift } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import { useCompanyContextStore } from '@/store/companyContextStore';
import ModuleTips from '@/components/ModuleTips';

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

interface OTRequest {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  estimatedHours: number;
  reason: string;
  payoutPreference: string;
  status: string;
  compOffCreditedAt: string | null;
  employee?: { id: string; firstName: string; lastName: string; employeeId: string };
}

export default function OvertimeRequestPage() {
  const { user } = useAuthStore();
  const scopeQuery = useCompanyContextStore(s => s.scopeQuery);
  const selectedTenantId = useCompanyContextStore(s => s.selectedTenantId);
  const isAdmin = ['super_admin', 'tenant_admin', 'admin'].includes(user?.role || '');

  const [items, setItems] = useState<OTRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const today = new Date().toISOString().split('T')[0];
  const [form, setForm] = useState({
    date: today,
    startTime: '',
    endTime: '',
    reason: '',
    payoutPreference: 'payout',
  });

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const sq = scopeQuery();
      const r = await fetch(`/api/attendance/overtime-request?limit=100${sq ? `&${sq}` : ''}`, { headers: getAuthHeaders() });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed');
      setItems(d.overtimeRequests || []);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [scopeQuery, selectedTenantId]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const computedHours = (() => {
    if (!form.startTime || !form.endTime) return 0;
    const s = new Date(`${form.date}T${form.startTime}`);
    const e = new Date(`${form.date}T${form.endTime}`);
    const diff = (e.getTime() - s.getTime()) / (1000 * 60 * 60);
    return diff > 0 ? Math.round(diff * 100) / 100 : 0;
  })();

  const handleSubmit = async () => {
    if (!form.date || !form.startTime || !form.endTime || !form.reason) {
      toast.error('All fields are required');
      return;
    }
    setSubmitting(true);
    try {
      const startTime = new Date(`${form.date}T${form.startTime}`);
      const endTime = new Date(`${form.date}T${form.endTime}`);
      const r = await fetch('/api/attendance/overtime-request', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          date: form.date, startTime, endTime,
          reason: form.reason, payoutPreference: form.payoutPreference,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed');
      toast.success('Overtime request submitted');
      setShowForm(false);
      setForm({ date: today, startTime: '', endTime: '', reason: '', payoutPreference: 'payout' });
      fetchItems();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAction = async (id: string, status: 'approved' | 'rejected') => {
    try {
      const r = await fetch(`/api/attendance/overtime-request/${id}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ status }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed');
      toast.success(`Request ${status}`);
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
            <FiClock className="w-6 h-6 text-teal-500" />
            Overtime Requests
          </h1>
          <p className="text-sm text-slate-500 mt-1">Pre-OT approval workflow · Convert OT to Comp-Off or payout</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="3boxes-btn-primary flex items-center gap-2">
          <FiPlus className="w-4 h-4" /> Request Overtime
        </button>
      </div>

      <ModuleTips moduleKey="attendance-overtime">
        <p><strong>REQ-OT-02/03:</strong> Pre-approve your overtime BEFORE working it so your late check-out does not trigger an alert. Choose <strong>payout</strong> (paid in next payroll run) or <strong>comp-off</strong> (credited as compensatory leave, expires in 90 days).</p>
      </ModuleTips>

      {showForm && (
        <div className="thb-card p-6 border-l-4 border-l-teal-500">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-800">New Overtime Request</h2>
            <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-700">✕</button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Date <span className="text-red-500 font-bold">*</span></label>
              <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="3boxes-input w-full" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Start Time <span className="text-red-500 font-bold">*</span></label>
              <input type="time" value={form.startTime} onChange={e => setForm({ ...form, startTime: e.target.value })} className="3boxes-input w-full" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">End Time <span className="text-red-500 font-bold">*</span></label>
              <input type="time" value={form.endTime} onChange={e => setForm({ ...form, endTime: e.target.value })} className="3boxes-input w-full" />
            </div>
          </div>
          <div className="mt-4">
            <label className="block text-xs font-medium text-slate-600 mb-1">Reason <span className="text-red-500 font-bold">*</span></label>
            <input type="text" value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} className="3boxes-input w-full" placeholder="e.g. Production release support" />
          </div>
          <div className="mt-4">
            <label className="block text-xs font-medium text-slate-600 mb-1">Payout Preference <span className="text-red-500 font-bold">*</span></label>
            <div className="grid grid-cols-2 gap-3">
              <label className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer ${form.payoutPreference === 'payout' ? 'border-teal-500 bg-teal-50' : 'border-slate-200'}`}>
                <input type="radio" checked={form.payoutPreference === 'payout'} onChange={() => setForm({ ...form, payoutPreference: 'payout' })} />
                <div>
                  <p className="text-sm font-medium text-slate-700">Payout</p>
                  <p className="text-xs text-slate-500">Paid in next payroll run</p>
                </div>
              </label>
              <label className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer ${form.payoutPreference === 'comp_off' ? 'border-teal-500 bg-teal-50' : 'border-slate-200'}`}>
                <input type="radio" checked={form.payoutPreference === 'comp_off'} onChange={() => setForm({ ...form, payoutPreference: 'comp_off' })} />
                <div>
                  <p className="text-sm font-medium text-slate-700 flex items-center gap-1"><FiGift className="w-3.5 h-3.5" /> Comp-Off</p>
                  <p className="text-xs text-slate-500">Credited as leave, expires in 90 days</p>
                </div>
              </label>
            </div>
          </div>
          {computedHours > 0 && (
            <div className="mt-4 p-3 bg-green-50 border border-green-100 rounded-lg">
              <p className="text-sm text-green-700 font-medium">Estimated: {computedHours} hours</p>
            </div>
          )}
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
                <th className="text-left px-4 py-3 font-semibold text-slate-700">From</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">To</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Hours</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Reason</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Preference</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Status</th>
                {isAdmin && <th className="text-right px-4 py-3 font-semibold text-slate-700">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={isAdmin ? 9 : 8} className="text-center py-8 text-slate-400">Loading...</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={isAdmin ? 9 : 8} className="text-center py-12 text-slate-500">No overtime requests yet</td></tr>
              ) : items.map(r => (
                <tr key={r.id} className="hover:bg-slate-50">
                  {isAdmin && <td className="px-4 py-3 text-slate-700">{r.employee ? `${r.employee.firstName} ${r.employee.lastName}` : '—'}</td>}
                  <td className="px-4 py-3 text-slate-700">{fmtDate(r.date)}</td>
                  <td className="px-4 py-3 text-slate-700">{fmtTime(r.startTime)}</td>
                  <td className="px-4 py-3 text-slate-700">{fmtTime(r.endTime)}</td>
                  <td className="px-4 py-3 text-slate-700">{r.estimatedHours}h</td>
                  <td className="px-4 py-3 text-slate-600 max-w-xs truncate">{r.reason}</td>
                  <td className="px-4 py-3 text-slate-700 capitalize">
                    {r.payoutPreference.replace('_', '-')}
                    {r.compOffCreditedAt && <span className="ml-1 text-[9px] text-emerald-600">✓ credited</span>}
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
