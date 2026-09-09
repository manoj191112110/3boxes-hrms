'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  FiLayers, FiPlus, FiEdit2, FiTrash2, FiX, FiCheck, FiRefreshCw,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import { useCompanyContextStore } from '@/store/companyContextStore';

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

/* ── Data ── */
interface LeaveTypeItem {
  id: string;
  name: string;
  code: string;
  annualQuota: string;
  carryForward: boolean;
  isPaid: boolean;
}

/* ── Add Dialog ── */
function AddLeaveTypeDialog({ open, onClose, onAdd }: { open: boolean; onClose: () => void; onAdd: (lt: LeaveTypeItem) => void }) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [quota, setQuota] = useState('');
  const [carryFwd, setCarryFwd] = useState(false);
  const [paid, setPaid] = useState(true);

  if (!open) return null;

  const handleSubmit = () => {
    if (!name || !code) {
      toast.error('Name and code are required');
      return;
    }
    onAdd({ id: Date.now().toString(), name, code: code.toUpperCase(), annualQuota: quota || 'Unlimited', carryForward: carryFwd, isPaid: paid });
    setName(''); setCode(''); setQuota(''); setCarryFwd(false); setPaid(true);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-thb-border">
          <h3 className="font-semibold text-thb-text-primary">Add Leave Type</h3>
          <button onClick={onClose} className="text-thb-text-muted hover:text-thb-text-primary"><FiX className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-thb-text-primary mb-1">Leave Type Name</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Casual Leave" className="w-full px-3 py-2 border border-thb-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-thb-text-primary mb-1">Code</label>
            <input value={code} onChange={e => setCode(e.target.value)} placeholder="e.g. CL" className="w-full px-3 py-2 border border-thb-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-thb-text-primary mb-1">Annual Quota</label>
            <input value={quota} onChange={e => setQuota(e.target.value)} placeholder="Number or leave blank for Unlimited" className="w-full px-3 py-2 border border-thb-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500" />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-thb-text-primary">Carry Forward</span>
            <button onClick={() => setCarryFwd(!carryFwd)} className={carryFwd ? 'text-green-600' : 'text-slate-400'}>
              {carryFwd ? <FiCheck className="w-5 h-5" /> : <FiX className="w-5 h-5" />}
            </button>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-thb-text-primary">Paid</span>
            <button onClick={() => setPaid(!paid)} className={paid ? 'text-green-600' : 'text-slate-400'}>
              {paid ? <FiCheck className="w-5 h-5" /> : <FiX className="w-5 h-5" />}
            </button>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-thb-border">
          <button onClick={onClose} className="px-4 py-2 text-sm text-thb-text-secondary hover:text-thb-text-primary transition-colors">Cancel</button>
          <button onClick={handleSubmit} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors">Add Leave Type</button>
        </div>
      </div>
    </div>
  );
}

export default function LeaveTypesPage() {
  const { user } = useAuthStore();
  const scopeQuery = useCompanyContextStore(s => s.scopeQuery);
  const selectedTenantId = useCompanyContextStore(s => s.selectedTenantId);
  const isAdmin = user?.role === 'super_admin' || user?.role === 'tenant_admin' || user?.role === 'admin';
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  const fetchLeaveTypes = useCallback(async () => {
    setLoading(true);
    try {
      const sq = scopeQuery();
      const r = await fetch(`/api/leave-types${sq ? `?${sq}` : ''}`, { headers: getAuthHeaders() });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed to load leave types');
      const list = Array.isArray(d) ? d : (d.leaveTypes || []);
      // Map API fields to local interface
      const mapped = list.map((lt: Record<string, unknown>) => ({
        id: String(lt.id),
        name: String(lt.name || ''),
        code: String(lt.code || ''),
        annualQuota: lt.annualQuota != null ? String(lt.annualQuota) : 'Unlimited',
        carryForward: Boolean(lt.carryForward),
        isPaid: lt.isPaid !== false,
      }));
      setLeaveTypes(mapped);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load leave types');
    } finally {
      setLoading(false);
    }
  }, [scopeQuery, selectedTenantId]);

  useEffect(() => { fetchLeaveTypes(); }, [fetchLeaveTypes]);

  const handleAdd = (lt: LeaveTypeItem) => {
    setLeaveTypes(prev => [...prev, lt]);
    toast.success('Leave type added');
  };

  const handleDelete = (id: string) => {
    setLeaveTypes(prev => prev.filter(lt => lt.id !== id));
    toast.success('Leave type deleted');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-green-50">
            <FiLayers className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-thb-text-primary">Leave Types</h1>
            <p className="text-sm text-thb-text-secondary">Manage leave categories and their configurations</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchLeaveTypes} className="inline-flex items-center gap-2 px-3 py-2.5 text-slate-600 hover:text-slate-800 rounded-lg text-sm transition-colors" title="Refresh">
            <FiRefreshCw className="w-4 h-4" />
          </button>
          {isAdmin && (
            <button
              onClick={() => setShowAdd(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
            >
              <FiPlus className="w-4 h-4" />
              Add Leave Type
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="thb-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-thb-border bg-slate-50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Leave Type</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Code</th>
                <th className="text-center px-5 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Annual Quota</th>
                <th className="text-center px-5 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Carry Forward</th>
                <th className="text-center px-5 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Paid</th>
                {isAdmin && <th className="text-center px-5 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={isAdmin ? 6 : 5} className="text-center py-8 text-slate-400">Loading...</td></tr>
              ) : leaveTypes.length === 0 ? (
                <tr><td colSpan={isAdmin ? 6 : 5} className="text-center py-12 text-slate-500">No leave types configured yet.</td></tr>
              ) : leaveTypes.map((lt) => (
                <tr key={lt.id} className="border-b border-thb-border last:border-b-0 hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3 text-sm text-thb-text-primary font-medium">{lt.name}</td>
                  <td className="px-5 py-3">
                    <span className="inline-flex px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs font-mono font-medium">{lt.code}</span>
                  </td>
                  <td className="px-5 py-3 text-sm text-thb-text-primary text-center">{lt.annualQuota}</td>
                  <td className="px-5 py-3 text-center">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${lt.carryForward ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      {lt.carryForward ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-center">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${lt.isPaid ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                      {lt.isPaid ? 'Paid' : 'Unpaid'}
                    </span>
                  </td>
                  {isAdmin && (
                    <td className="px-5 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button className="p-1.5 text-thb-text-muted hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors">
                          <FiEdit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(lt.id)} className="p-1.5 text-thb-text-muted hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                          <FiTrash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Dialog */}
      <AddLeaveTypeDialog open={showAdd} onClose={() => setShowAdd(false)} onAdd={handleAdd} />
    </div>
  );
}
