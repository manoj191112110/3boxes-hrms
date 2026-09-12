'use client';

import { useEffect, useState, useCallback } from 'react';
import { FiShuffle, FiPlus, FiTrash2, FiEdit2, FiX } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import ModuleTips from '@/components/ModuleTips';

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

interface RoutingRule {
  id: string;
  name: string;
  requestType: string;
  projectId: string | null;
  alternateManagerId: string | null;
  priority: number;
  isActive: boolean;
}

export default function ApprovalRoutingPage() {
  const { user } = useAuthStore();
  const isAdmin = ['super_admin', 'tenant_admin', 'admin'].includes(user?.role || '');

  const [items, setItems] = useState<RoutingRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: '',
    requestType: 'leave',
    projectId: '',
    alternateManagerId: '',
    priority: 100,
    isActive: true,
  });

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/approval-routing?limit=100', { headers: getAuthHeaders() });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed');
      setItems(d.rules || []);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (isAdmin) fetchItems(); }, [fetchItems, isAdmin]);

  const handleSubmit = async () => {
    if (!form.name) { toast.error('Name is required'); return; }
    setSubmitting(true);
    try {
      const url = editingId ? `/api/approval-routing/${editingId}` : '/api/approval-routing';
      const method = editingId ? 'PATCH' : 'POST';
      const r = await fetch(url, {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify(form),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed');
      toast.success(editingId ? 'Rule updated' : 'Rule created');
      setShowForm(false);
      setEditingId(null);
      setForm({ name: '', requestType: 'leave', projectId: '', alternateManagerId: '', priority: 100, isActive: true });
      fetchItems();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (r: RoutingRule) => {
    setEditingId(r.id);
    setForm({
      name: r.name,
      requestType: r.requestType,
      projectId: r.projectId || '',
      alternateManagerId: r.alternateManagerId || '',
      priority: r.priority,
      isActive: r.isActive,
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this routing rule?')) return;
    try {
      const r = await fetch(`/api/approval-routing/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
      if (!r.ok) throw new Error('Failed');
      toast.success('Rule deleted');
      fetchItems();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  };

  if (!isAdmin) {
    return (
      <div className="text-center py-12">
        <FiShuffle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <p className="text-slate-500">Approval Routing Rules are restricted to HR admins.</p>
      </div>
    );
  }

  const requestTypeLabel = (t: string) => ({
    leave: 'Leave', overtime: 'Overtime', gatepass: 'Gatepass', permission: 'Permission',
  }[t] || t);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <FiShuffle className="w-6 h-6 text-teal-500" />
            Approval Routing Rules
          </h1>
          <p className="text-sm text-slate-500 mt-1">Matrix routing: route requests to alternate managers based on project assignment</p>
        </div>
        <button onClick={() => { setEditingId(null); setForm({ name: '', requestType: 'leave', projectId: '', alternateManagerId: '', priority: 100, isActive: true }); setShowForm(true); }} className="3boxes-btn-primary flex items-center gap-2">
          <FiPlus className="w-4 h-4" /> New Rule
        </button>
      </div>

      <ModuleTips moduleKey="settings-approval-routing">
        <p><strong>REQ-CFG-06:</strong> Matrix Routing — route leave/OT/gatepass/permission requests based on who the employee reports to on that specific day. This handles project-matrix structures where an employee might report to Manager A normally, but to Manager B while assigned to a specific project. Rules are evaluated by priority (lower number = higher priority).</p>
      </ModuleTips>

      {showForm && (
        <div className="thb-card p-6 border-l-4 border-l-teal-500">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-800">{editingId ? 'Edit Rule' : 'New Routing Rule'}</h2>
            <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-700"><FiX /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Name <span className="text-red-500 font-bold">*</span></label>
              <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="3boxes-input w-full" placeholder="e.g. Project X → Manager B" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Request Type <span className="text-red-500 font-bold">*</span></label>
              <select value={form.requestType} onChange={e => setForm({ ...form, requestType: e.target.value })} className="3boxes-input w-full">
                <option value="leave">Leave</option>
                <option value="overtime">Overtime</option>
                <option value="gatepass">Gatepass</option>
                <option value="permission">Permission</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Project ID (optional)</label>
              <input type="text" value={form.projectId} onChange={e => setForm({ ...form, projectId: e.target.value })} className="3boxes-input w-full" placeholder="Project ID — leave empty for catch-all" />
              <p className="text-xs text-slate-500 mt-1">If the employee is allocated to this project on the request date, route to the alternate manager.</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Alternate Manager ID <span className="text-red-500 font-bold">*</span></label>
              <input type="text" value={form.alternateManagerId} onChange={e => setForm({ ...form, alternateManagerId: e.target.value })} className="3boxes-input w-full" placeholder="User ID of alternate manager" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Priority (lower = higher)</label>
              <input type="number" min="1" max="999" value={form.priority} onChange={e => setForm({ ...form, priority: Number(e.target.value) })} className="3boxes-input w-full" />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })} className="w-4 h-4 rounded" />
                Active
              </label>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => setShowForm(false)} className="3boxes-btn-secondary">Cancel</button>
            <button onClick={handleSubmit} disabled={submitting} className="3boxes-btn-primary">
              {editingId ? 'Save Changes' : 'Create Rule'}
            </button>
          </div>
        </div>
      )}

      <div className="thb-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Name</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Request Type</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Project</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Alt. Manager</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Priority</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Status</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={7} className="text-center py-8 text-slate-400">Loading...</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-slate-500">
                  <FiShuffle className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  No routing rules configured. Without rules, all requests go to the primary reporting manager.
                </td></tr>
              ) : items.map(r => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-700 font-medium">{r.name}</td>
                  <td className="px-4 py-3 text-slate-700">{requestTypeLabel(r.requestType)}</td>
                  <td className="px-4 py-3 text-slate-600 text-xs font-mono">{r.projectId || '—'}</td>
                  <td className="px-4 py-3 text-slate-600 text-xs font-mono">{r.alternateManagerId || '—'}</td>
                  <td className="px-4 py-3 text-slate-700">{r.priority}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${r.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      {r.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => handleEdit(r)} className="p-1.5 text-slate-500 hover:text-green-600 hover:bg-green-50 rounded mr-1" title="Edit">
                      <FiEdit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(r.id)} className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded" title="Delete">
                      <FiTrash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
