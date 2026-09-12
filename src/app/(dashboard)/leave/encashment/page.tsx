'use client';

import { useEffect, useState, useCallback } from 'react';
import { FiDollarSign, FiPlus, FiRefreshCw, FiCheckCircle, FiXCircle, FiInfo } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import { useCompanyContextStore } from '@/store/companyContextStore';
import ModuleTips from '@/components/ModuleTips';

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

interface EncashmentRequest {
  id: string;
  days: number;
  basis: string;
  ratePerDay: number;
  amount: number;
  taxImplications: { note?: string; tdsRate?: number } | null;
  status: string;
  createdAt: string;
  leaveType: { id: string; name: string; code: string };
  employee?: { id: string; firstName: string; lastName: string; employeeId: string };
}

interface LeaveTypeWithEncashment {
  id: string;
  name: string;
  code: string;
  encashmentAllowed: boolean;
  encashmentBasis: string;
  maxEncashmentDays: number;
}

export default function LeaveEncashmentPage() {
  const { user } = useAuthStore();
  const scopeQuery = useCompanyContextStore(s => s.scopeQuery);
  const selectedTenantId = useCompanyContextStore(s => s.selectedTenantId);
  const isAdmin = ['super_admin', 'tenant_admin', 'admin'].includes(user?.role || '');

  const [items, setItems] = useState<EncashmentRequest[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeWithEncashment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({ leaveTypeId: '', days: 1 });

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const sq = scopeQuery();
      const r = await fetch(`/api/leave/encashment?limit=100${sq ? `&${sq}` : ''}`, { headers: getAuthHeaders() });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed');
      setItems(d.encashmentRequests || []);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [scopeQuery, selectedTenantId]);

  const fetchLeaveTypes = useCallback(async () => {
    try {
      const sq = scopeQuery();
      const r = await fetch(`/api/leave-types${sq ? `?${sq}` : ''}`, { headers: getAuthHeaders() });
      const d = await r.json();
      // d may be an array or { leaveTypes: [] }
      const list = Array.isArray(d) ? d : (d.leaveTypes || []);
      setLeaveTypes(list);
    } catch { /* ignore */ }
  }, [scopeQuery, selectedTenantId]);

  useEffect(() => { fetchItems(); fetchLeaveTypes(); }, [fetchItems, fetchLeaveTypes]);

  const handleSubmit = async () => {
    if (!form.leaveTypeId || !form.days || form.days <= 0) {
      toast.error('Select a leave type and enter valid days');
      return;
    }
    setSubmitting(true);
    try {
      const r = await fetch('/api/leave/encashment', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(form),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed');
      toast.success('Encashment request submitted');
      setShowForm(false);
      setForm({ leaveTypeId: '', days: 1 });
      fetchItems();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAction = async (id: string, status: 'approved' | 'rejected') => {
    try {
      const r = await fetch(`/api/leave/encashment/${id}`, {
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
  const fmtINR = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

  const eligibleTypes = leaveTypes.filter(lt => lt.encashmentAllowed);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <FiDollarSign className="w-6 h-6 text-emerald-500" />
            Leave Encashment
          </h1>
          <p className="text-sm text-slate-500 mt-1">Convert unused leave to payout · auto-computed from salary basis · country-specific tax</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="3boxes-btn-primary flex items-center gap-2">
          <FiPlus className="w-4 h-4" /> Request Encashment
        </button>
      </div>

      <ModuleTips moduleKey="leave-encashment">
        <p><strong>REQ-LVE-07:</strong> Encash unused leave balances for payout. The amount is auto-computed based on the leave type&apos;s basis (Basic, Gross, or Monthly Salary) and your salary. Country-specific tax implications (e.g. TDS in India) are applied. Encashed days are deducted from your leave balance on approval.</p>
      </ModuleTips>

      {showForm && (
        <div className="thb-card p-6 border-l-4 border-l-emerald-500">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-800">New Encashment Request</h2>
            <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-700">✕</button>
          </div>
          {eligibleTypes.length === 0 ? (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
              <FiInfo className="w-4 h-4 inline mr-1" />
              No leave types are currently eligible for encashment. Ask HR to enable encashment on a leave type in Settings.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Leave Type <span className="text-red-500 font-bold">*</span></label>
                  <select value={form.leaveTypeId} onChange={e => setForm({ ...form, leaveTypeId: e.target.value })} className="3boxes-input w-full">
                    <option value="">Select leave type...</option>
                    {eligibleTypes.map(lt => (
                      <option key={lt.id} value={lt.id}>
                        {lt.name} ({lt.code}) — basis: {lt.encashmentBasis}, max: {lt.maxEncashmentDays}d
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Days <span className="text-red-500 font-bold">*</span></label>
                  <input type="number" min="0.5" step="0.5" value={form.days} onChange={e => setForm({ ...form, days: Number(e.target.value) })} className="3boxes-input w-full" />
                </div>
              </div>
              <div className="mt-4 p-3 bg-green-50 border border-green-100 rounded-lg">
                <p className="text-xs text-green-700">
                  <FiInfo className="w-3.5 h-3.5 inline mr-1" />
                  The amount will be auto-computed based on your salary and the leave type&apos;s basis. The system will verify you have sufficient balance before submission.
                </p>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button onClick={() => setShowForm(false)} className="3boxes-btn-secondary">Cancel</button>
                <button onClick={handleSubmit} disabled={submitting} className="3boxes-btn-primary flex items-center gap-2">
                  {submitting ? <FiRefreshCw className="w-4 h-4 animate-spin" /> : <FiPlus className="w-4 h-4" />}
                  Submit Request
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <div className="thb-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {isAdmin && <th className="text-left px-4 py-3 font-semibold text-slate-700">Employee</th>}
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Leave Type</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Days</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Basis</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Rate/Day</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Amount</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Tax</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Status</th>
                {isAdmin && <th className="text-right px-4 py-3 font-semibold text-slate-700">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={isAdmin ? 9 : 8} className="text-center py-8 text-slate-400">Loading...</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={isAdmin ? 9 : 8} className="text-center py-12 text-slate-500">
                  <FiDollarSign className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  No encashment requests yet.
                </td></tr>
              ) : items.map(r => (
                <tr key={r.id} className="hover:bg-slate-50">
                  {isAdmin && <td className="px-4 py-3 text-slate-700">{r.employee ? `${r.employee.firstName} ${r.employee.lastName}` : '—'}</td>}
                  <td className="px-4 py-3 text-slate-700">{r.leaveType?.name || '—'}</td>
                  <td className="px-4 py-3 text-slate-700">{r.days}</td>
                  <td className="px-4 py-3 text-slate-700 capitalize">{r.basis}</td>
                  <td className="px-4 py-3 text-slate-700">{fmtINR(r.ratePerDay)}</td>
                  <td className="px-4 py-3 text-slate-700 font-semibold">{fmtINR(r.amount)}</td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    {r.taxImplications?.tdsRate ? `TDS ${Math.round((r.taxImplications.tdsRate || 0) * 100)}%` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`thb-badge ${
                      r.status === 'approved' || r.status === 'processed' ? 'thb-badge-success' :
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
