'use client';

import { useEffect, useState, useCallback } from 'react';
import { FiShield, FiPlus, FiRefreshCw, FiCheckCircle, FiXCircle, FiUserCheck, FiUserX } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import { useCompanyContextStore } from '@/store/companyContextStore';
import ModuleTips from '@/components/ModuleTips';

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

interface Gatepass {
  id: string;
  type: string;
  reason: string;
  requestedAt: string;
  actualOutTime: string | null;
  actualInTime: string | null;
  visitorName: string | null;
  visitorCompany: string | null;
  visitorPhone: string | null;
  projectId: string | null;
  managerStatus: string;
  securityStatus: string;
  status: string;
  employee?: { id: string; firstName: string; lastName: string; employeeId: string };
}

export default function GatepassPage() {
  const { user } = useAuthStore();
  const scopeQuery = useCompanyContextStore(s => s.scopeQuery);
  const selectedTenantId = useCompanyContextStore(s => s.selectedTenantId);
  const isAdmin = ['super_admin', 'tenant_admin', 'admin'].includes(user?.role || '');

  const [items, setItems] = useState<Gatepass[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    type: 'early_departure',
    reason: '',
    requestedAt: new Date().toISOString().slice(0, 16),
    visitorName: '',
    visitorCompany: '',
    visitorPhone: '',
  });

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const sq = scopeQuery();
      const r = await fetch(`/api/attendance/gatepass?limit=100${sq ? `&${sq}` : ''}`, { headers: getAuthHeaders() });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed');
      setItems(d.gatepasses || []);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [scopeQuery, selectedTenantId]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const handleSubmit = async () => {
    if (!form.type || !form.reason) {
      toast.error('Type and reason are required');
      return;
    }
    if ((form.type === 'visitor' || form.type === 'contractor') && !form.visitorName) {
      toast.error('Visitor name is required for visitor/contractor gatepasses');
      return;
    }
    setSubmitting(true);
    try {
      const r = await fetch('/api/attendance/gatepass', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          type: form.type,
          reason: form.reason,
          requestedAt: new Date(form.requestedAt).toISOString(),
          visitorName: form.visitorName || null,
          visitorCompany: form.visitorCompany || null,
          visitorPhone: form.visitorPhone || null,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed');
      toast.success('Gatepass requested');
      setShowForm(false);
      setForm({ type: 'early_departure', reason: '', requestedAt: new Date().toISOString().slice(0, 16), visitorName: '', visitorCompany: '', visitorPhone: '' });
      fetchItems();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTierAction = async (id: string, tier: 'manager' | 'security', action: 'approved' | 'rejected') => {
    try {
      const r = await fetch(`/api/attendance/gatepass/${id}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ tier, action }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed');
      toast.success(`${tier} ${action}`);
      fetchItems();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  };

  const fmtDateTime = (d: string | null) => d ? new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <FiShield className="w-6 h-6 text-rose-500" />
            Gatepass Management
          </h1>
          <p className="text-sm text-slate-500 mt-1">Physical movement control · Two-tier approval: Manager + Security</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="3boxes-btn-primary flex items-center gap-2">
          <FiPlus className="w-4 h-4" /> Request Gatepass
        </button>
      </div>

      <ModuleTips moduleKey="attendance-gatepass">
        <p><strong>REQ-GATE-01/02:</strong> A gatepass is a physical security token distinct from permission. Early-departure / late-arrival gatepasses require both Manager approval (for time loss) AND Security approval (for physical gate opening). Visitor/contractor gatepasses log entry/exit times against specific projects for compliance.</p>
      </ModuleTips>

      {showForm && (
        <div className="thb-card p-6 border-l-4 border-l-rose-500">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-800">New Gatepass Request</h2>
            <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-700">✕</button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Type *</label>
              <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className="3boxes-input w-full">
                <option value="early_departure">Early Departure</option>
                <option value="late_arrival">Late Arrival</option>
                <option value="visitor">Visitor</option>
                <option value="contractor">Contractor</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Requested At *</label>
              <input type="datetime-local" value={form.requestedAt} onChange={e => setForm({ ...form, requestedAt: e.target.value })} className="3boxes-input w-full" />
            </div>
          </div>
          {(form.type === 'visitor' || form.type === 'contractor') && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Visitor Name *</label>
                <input type="text" value={form.visitorName} onChange={e => setForm({ ...form, visitorName: e.target.value })} className="3boxes-input w-full" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Company</label>
                <input type="text" value={form.visitorCompany} onChange={e => setForm({ ...form, visitorCompany: e.target.value })} className="3boxes-input w-full" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Phone</label>
                <input type="text" value={form.visitorPhone} onChange={e => setForm({ ...form, visitorPhone: e.target.value })} className="3boxes-input w-full" />
              </div>
            </div>
          )}
          <div className="mt-4">
            <label className="block text-xs font-medium text-slate-600 mb-1">Reason *</label>
            <textarea rows={2} value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} className="3boxes-input w-full" placeholder="Reason for gatepass" />
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
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Type</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Employee / Visitor</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Requested</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Out</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">In</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Reason</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Manager</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Security</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Status</th>
                {isAdmin && <th className="text-right px-4 py-3 font-semibold text-slate-700">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={isAdmin ? 10 : 9} className="text-center py-8 text-slate-400">Loading...</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={isAdmin ? 10 : 9} className="text-center py-12 text-slate-500">No gatepass requests yet</td></tr>
              ) : items.map(r => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-700 capitalize">{r.type.replace('_', ' ')}</td>
                  <td className="px-4 py-3 text-slate-700">
                    {r.visitorName ? (
                      <div>
                        <p className="font-medium">{r.visitorName}</p>
                        {r.visitorCompany && <p className="text-xs text-slate-500">{r.visitorCompany}</p>}
                      </div>
                    ) : r.employee ? `${r.employee.firstName} ${r.employee.lastName}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{fmtDateTime(r.requestedAt)}</td>
                  <td className="px-4 py-3 text-slate-700">{fmtDateTime(r.actualOutTime)}</td>
                  <td className="px-4 py-3 text-slate-700">{fmtDateTime(r.actualInTime)}</td>
                  <td className="px-4 py-3 text-slate-600 max-w-xs truncate">{r.reason}</td>
                  <td className="px-4 py-3">
                    <span className={`thb-badge ${
                      r.managerStatus === 'approved' ? 'thb-badge-success' :
                      r.managerStatus === 'rejected' ? 'thb-badge-error' : 'thb-badge-warning'
                    }`}>{r.managerStatus}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`thb-badge ${
                      r.securityStatus === 'approved' ? 'thb-badge-success' :
                      r.securityStatus === 'rejected' ? 'thb-badge-error' : 'thb-badge-warning'
                    }`}>{r.securityStatus}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`thb-badge ${
                      r.status === 'approved' || r.status === 'completed' ? 'thb-badge-success' :
                      r.status === 'rejected' ? 'thb-badge-error' : 'thb-badge-warning'
                    }`}>{r.status}</span>
                  </td>
                  {isAdmin && (
                    <td className="px-4 py-3 text-right">
                      {r.managerStatus === 'pending' && (
                        <button onClick={() => handleTierAction(r.id, 'manager', 'approved')} className="p-1 text-slate-500 hover:text-emerald-600 mr-1" title="Manager approve">
                          <FiUserCheck className="w-4 h-4" />
                        </button>
                      )}
                      {r.securityStatus === 'pending' && r.managerStatus === 'approved' && (
                        <button onClick={() => handleTierAction(r.id, 'security', 'approved')} className="p-1 text-slate-500 hover:text-emerald-600" title="Security approve">
                          <FiShield className="w-4 h-4" />
                        </button>
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
