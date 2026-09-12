'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  FiLayers, FiPlus, FiEdit2, FiTrash2, FiX, FiCheck, FiRefreshCw, FiEye,
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
  defaultDays: number;
  carryForward: boolean;
  maxCarryForward: number;
  isPaid: boolean;
  description?: string;
  employmentType: string;
  employeeStatus: string;
  probationRestricted: boolean;
  sandwichRuleEnabled: boolean;
  status: string;
}

const EMPLOYMENT_TYPES = [
  { value: 'all', label: 'All Types' },
  { value: 'full-time', label: 'Full-Time' },
  { value: 'part-time', label: 'Part-Time' },
  { value: 'contract', label: 'Contract' },
  { value: 'internship', label: 'Internship' },
];
const EMPLOYEE_STATUSES = [
  { value: 'all', label: 'All Statuses' },
  { value: 'active', label: 'Active' },
  { value: 'on_leave', label: 'On Leave' },
  { value: 'inactive', label: 'Inactive' },
];

/* ── Add/Edit Dialog ── */
function LeaveTypeDialog({ open, mode, editItem, onClose, onSaved }: {
  open: boolean;
  mode: 'add' | 'edit';
  editItem: LeaveTypeItem | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [quota, setQuota] = useState('');
  const [carryFwd, setCarryFwd] = useState(false);
  const [maxCarry, setMaxCarry] = useState('');
  const [paid, setPaid] = useState(true);
  const [description, setDescription] = useState('');
  const [employmentType, setEmploymentType] = useState('all');
  const [employeeStatus, setEmployeeStatus] = useState('all');
  const [probationRestricted, setProbationRestricted] = useState(false);
  const [sandwichRule, setSandwichRule] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && mode === 'edit' && editItem) {
      setName(editItem.name);
      setCode(editItem.code);
      setQuota(String(editItem.defaultDays || ''));
      setCarryFwd(editItem.carryForward);
      setMaxCarry(String(editItem.maxCarryForward || ''));
      setPaid(editItem.isPaid);
      setDescription(editItem.description || '');
      setEmploymentType(editItem.employmentType || 'all');
      setEmployeeStatus(editItem.employeeStatus || 'all');
      setProbationRestricted(editItem.probationRestricted ?? false);
      setSandwichRule(editItem.sandwichRuleEnabled ?? true);
    } else if (open && mode === 'add') {
      setName(''); setCode(''); setQuota(''); setCarryFwd(false); setMaxCarry('');
      setPaid(true); setDescription(''); setEmploymentType('all'); setEmployeeStatus('all');
      setProbationRestricted(false); setSandwichRule(true);
    }
  }, [open, mode, editItem]);

  if (!open) return null;

  const handleSubmit = async () => {
    if (!name || !code) { toast.error('Name and code are required'); return; }
    setSaving(true);
    try {
      const body = {
        name, code,
        defaultDays: quota ? Number(quota) : 0,
        isPaid: paid,
        carryForward: carryFwd,
        maxCarryForward: maxCarry ? Number(maxCarry) : 0,
        description: description || undefined,
        employmentType, employeeStatus,
        probationRestricted, sandwichRuleEnabled: sandwichRule,
      };
      const url = mode === 'edit' ? `/api/leave-types/${editItem!.id}` : '/api/leave-types';
      const method = mode === 'edit' ? 'PATCH' : 'POST';
      const r = await fetch(url, { method, headers: getAuthHeaders(), body: JSON.stringify(body) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed');
      toast.success(mode === 'edit' ? 'Leave type updated' : 'Leave type created');
      onSaved();
      onClose();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-thb-border sticky top-0 bg-white z-10">
          <h3 className="font-semibold text-thb-text-primary">{mode === 'edit' ? 'Edit' : 'Add'} Leave Type</h3>
          <button onClick={onClose} className="text-thb-text-muted hover:text-thb-text-primary"><FiX className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-thb-text-primary mb-1">Name *</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Casual Leave" className="w-full px-3 py-2 border border-thb-border rounded-lg text-sm focus:ring-2 focus:ring-green-500/20" />
            </div>
            <div>
              <label className="block text-sm font-medium text-thb-text-primary mb-1">Code *</label>
              <input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="CL" maxLength={10} className="w-full px-3 py-2 border border-thb-border rounded-lg text-sm font-mono focus:ring-2 focus:ring-green-500/20" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-thb-text-primary mb-1">Description</label>
            <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Brief description" className="w-full px-3 py-2 border border-thb-border rounded-lg text-sm focus:ring-2 focus:ring-green-500/20" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-thb-text-primary mb-1">Annual Quota (days)</label>
              <input type="number" value={quota} onChange={e => setQuota(e.target.value)} placeholder="0 = unlimited" className="w-full px-3 py-2 border border-thb-border rounded-lg text-sm focus:ring-2 focus:ring-green-500/20" />
            </div>
            <div>
              <label className="block text-sm font-medium text-thb-text-primary mb-1">Max Carry Forward</label>
              <input type="number" value={maxCarry} onChange={e => setMaxCarry(e.target.value)} placeholder="0" disabled={!carryFwd} className="w-full px-3 py-2 border border-thb-border rounded-lg text-sm focus:ring-2 focus:ring-green-500/20 disabled:bg-slate-50" />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={carryFwd} onChange={e => setCarryFwd(e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-green-600" />
              <span className="text-sm text-thb-text-primary">Carry Forward</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={paid} onChange={e => setPaid(e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-green-600" />
              <span className="text-sm text-thb-text-primary">Paid Leave</span>
            </label>
          </div>

          {/* Employee Scope (new — rules mapped to leave types) */}
          <div className="p-3 rounded-lg border border-teal-200 bg-teal-50/30">
            <p className="text-xs font-semibold text-teal-700 uppercase tracking-wide mb-2">Employee Scope & Rules</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Employment Type</label>
                <select value={employmentType} onChange={e => setEmploymentType(e.target.value)} className="w-full px-2.5 py-2 border border-thb-border rounded-lg text-sm bg-white">
                  {EMPLOYMENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Employee Status</label>
                <select value={employeeStatus} onChange={e => setEmployeeStatus(e.target.value)} className="w-full px-2.5 py-2 border border-thb-border rounded-lg text-sm bg-white">
                  {EMPLOYEE_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
            </div>
            <div className="flex items-center gap-4 mt-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={probationRestricted} onChange={e => setProbationRestricted(e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-green-600" />
                <span className="text-xs text-thb-text-primary">Restrict during probation</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={sandwichRule} onChange={e => setSandwichRule(e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-green-600" />
                <span className="text-xs text-thb-text-primary">Sandwich rule</span>
              </label>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-thb-border sticky bottom-0 bg-white">
          <button onClick={onClose} className="px-4 py-2 text-sm text-thb-text-secondary hover:text-thb-text-primary">Cancel</button>
          <button onClick={handleSubmit} disabled={saving} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
            {saving ? 'Saving…' : mode === 'edit' ? 'Update' : 'Add'} Leave Type
          </button>
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
  const [showDialog, setShowDialog] = useState(false);
  const [dialogMode, setDialogMode] = useState<'add' | 'edit'>('add');
  const [editItem, setEditItem] = useState<LeaveTypeItem | null>(null);

  const fetchLeaveTypes = useCallback(async () => {
    setLoading(true);
    try {
      const sq = scopeQuery();
      const r = await fetch(`/api/leave-types${sq ? `?${sq}` : ''}`, { headers: getAuthHeaders() });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed to load leave types');
      const list = Array.isArray(d) ? d : (d.leaveTypes || d.data || []);
      const mapped: LeaveTypeItem[] = list.map((lt: Record<string, unknown>) => ({
        id: String(lt.id),
        name: String(lt.name || ''),
        code: String(lt.code || ''),
        defaultDays: Number(lt.defaultDays || 0),
        carryForward: Boolean(lt.carryForward),
        maxCarryForward: Number(lt.maxCarryForward || 0),
        isPaid: lt.isPaid !== false,
        description: lt.description ? String(lt.description) : undefined,
        employmentType: String(lt.employmentType || 'all'),
        employeeStatus: String(lt.employeeStatus || 'all'),
        probationRestricted: Boolean(lt.probationRestricted ?? false),
        sandwichRuleEnabled: Boolean(lt.sandwichRuleEnabled ?? true),
        status: String(lt.status || 'active'),
      }));
      setLeaveTypes(mapped);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load leave types');
    } finally { setLoading(false); }
  }, [scopeQuery, selectedTenantId]);

  useEffect(() => { fetchLeaveTypes(); }, [fetchLeaveTypes]);

  const handleAdd = () => { setDialogMode('add'); setEditItem(null); setShowDialog(true); };
  const handleEdit = (lt: LeaveTypeItem) => { setDialogMode('edit'); setEditItem(lt); setShowDialog(true); };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete leave type "${name}"? This will deactivate it (historical requests are preserved).`)) return;
    try {
      const r = await fetch(`/api/leave-types/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed');
      toast.success('Leave type deactivated');
      fetchLeaveTypes();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-green-50">
            <FiLayers className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-thb-text-primary">Leave Types</h1>
            <p className="text-sm text-thb-text-secondary">Manage leave categories, quotas, and employee scope rules</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchLeaveTypes} className="inline-flex items-center gap-2 px-3 py-2.5 text-slate-600 hover:text-slate-800 rounded-lg text-sm transition-colors" title="Refresh">
            <FiRefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {isAdmin && (
            <button onClick={handleAdd} className="inline-flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">
              <FiPlus className="w-4 h-4" /> Add Leave Type
            </button>
          )}
        </div>
      </div>

      <div className="thb-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-thb-border bg-slate-50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Leave Type</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Code</th>
                <th className="text-center px-5 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Quota</th>
                <th className="text-center px-5 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Carry Fwd</th>
                <th className="text-center px-5 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Paid</th>
                <th className="text-center px-5 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Scope</th>
                {isAdmin && <th className="text-center px-5 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={isAdmin ? 7 : 6} className="text-center py-8 text-slate-400">Loading...</td></tr>
              ) : leaveTypes.length === 0 ? (
                <tr><td colSpan={isAdmin ? 7 : 6} className="text-center py-12 text-slate-500">No leave types configured yet. Click "Add Leave Type" to create one.</td></tr>
              ) : leaveTypes.map((lt) => (
                <tr key={lt.id} className="border-b border-thb-border last:border-b-0 hover:bg-slate-50">
                  <td className="px-5 py-3">
                    <p className="text-sm font-medium text-thb-text-primary">{lt.name}</p>
                    {lt.description && <p className="text-xs text-slate-400 mt-0.5">{lt.description}</p>}
                  </td>
                  <td className="px-5 py-3">
                    <span className="inline-flex px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs font-mono font-medium">{lt.code}</span>
                  </td>
                  <td className="px-5 py-3 text-sm text-center text-thb-text-primary">{lt.defaultDays || '∞'}</td>
                  <td className="px-5 py-3 text-center">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${lt.carryForward ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      {lt.carryForward ? `Yes (${lt.maxCarryForward})` : 'No'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-center">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${lt.isPaid ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                      {lt.isPaid ? 'Paid' : 'Unpaid'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-center">
                    <div className="flex flex-wrap items-center justify-center gap-1">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-teal-50 text-teal-700 font-medium">
                        {lt.employmentType === 'all' ? 'All types' : lt.employmentType}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-teal-50 text-teal-700 font-medium">
                        {lt.employeeStatus === 'all' ? 'All status' : lt.employeeStatus}
                      </span>
                      {lt.probationRestricted && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 font-medium">No probation</span>}
                      {lt.sandwichRuleEnabled && <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-50 text-violet-700 font-medium">Sandwich</span>}
                    </div>
                  </td>
                  {isAdmin && (
                    <td className="px-5 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => handleEdit(lt)} className="p-1.5 text-thb-text-muted hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors" title="Edit">
                          <FiEdit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(lt.id, lt.name)} className="p-1.5 text-thb-text-muted hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
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

      <LeaveTypeDialog open={showDialog} mode={dialogMode} editItem={editItem} onClose={() => setShowDialog(false)} onSaved={fetchLeaveTypes} />
    </div>
  );
}
