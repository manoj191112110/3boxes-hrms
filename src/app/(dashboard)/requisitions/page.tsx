'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  FiPlus, FiX, FiCheck, FiXCircle, FiAlertCircle, FiEye, FiEdit2, FiTrash2,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import ModuleTips from '@/components/ModuleTips';
import ModuleWorkflow from '@/components/ModuleWorkflow';

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

interface Requisition {
  id: string; requisitionId: string; positionType: string; numberOfOpenings: number; employmentType: string; priority: string; approvalStatus: string; status: string; skillsRequired: string | null; experienceRequired: string | null; qualification: string | null; salaryBudget: string | null; expectedJoiningDate: string | null; companyId?: string;
  department?: { name: string } | null; designation?: { title: string } | null;
}

const requisitionsTips = [
  { title: 'Job Requisition Approval', description: 'All requisitions follow a multi-level approval workflow: Manager → HR → Budget approval before posting.' },
  { title: 'Budget Alignment', description: 'Ensure salary budgets in requisitions align with approved departmental budgets and grade-level ranges.' },
  { title: 'Timeline Planning', description: 'Set realistic expected joining dates accounting for notice periods and the interview pipeline duration.' },
  { title: 'Priority Levels', description: 'Use priority levels (Low, Medium, High, Critical) to signal urgency and influence recruitment timelines.' },
  { title: 'Hiring Manager Coordination', description: 'Keep hiring managers informed at each approval stage to avoid delays in the recruitment process.' },
];

const requisitionsWorkflowSteps = [
  { step: 1, title: 'Submit Requisition', description: 'Raise a hiring request with role details' },
  { step: 2, title: 'Manager Approval', description: 'Reporting manager reviews and approves' },
  { step: 3, title: 'HR Review', description: 'HR team validates the request' },
  { step: 4, title: 'Budget Approval', description: 'Finance approves the budget allocation' },
  { step: 5, title: 'Create Job Posting', description: 'Publish the approved position' },
  { step: 6, title: 'Track Applications', description: 'Monitor incoming applications' },
  { step: 7, title: 'Close Requisition', description: 'Mark as filled once position is staffed' },
];

const initialForm = {
  departmentId: '', designationId: '', positionType: 'new', numberOfOpenings: 1, employmentType: 'full-time', skillsRequired: '', experienceRequired: '', qualification: '', salaryBudget: '', priority: 'medium', expectedJoiningDate: '',
};

function getApprovalBadge(status: string) {
  const map: Record<string, string> = {
    pending: 'thb-badge thb-badge-warning',
    manager_approved: 'thb-badge thb-badge-info',
    hr_approved: 'thb-badge thb-badge-purple',
    budget_approved: 'thb-badge thb-badge-success',
    rejected: 'thb-badge thb-badge-error',
  };
  return map[status] || 'thb-badge thb-badge-info';
}

function getPriorityBadge(priority: string) {
  const map: Record<string, string> = {
    low: 'thb-badge thb-badge-info',
    medium: 'thb-badge thb-badge-warning',
    high: 'thb-badge thb-badge-error',
    critical: 'thb-badge thb-badge-error',
  };
  return map[priority] || 'thb-badge thb-badge-info';
}

function getStatusBadge(status: string) {
  const map: Record<string, string> = {
    open: 'thb-badge thb-badge-info',
    approved: 'thb-badge thb-badge-success',
    cancelled: 'thb-badge thb-badge-error',
    closed: 'thb-badge thb-badge-primary',
  };
  return map[status] || 'thb-badge thb-badge-info';
}

export default function RequisitionsPage() {
  const { user } = useAuthStore();
  const companyId = user?.tenantId || '';

  const [requisitions, setRequisitions] = useState<Requisition[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [form, setForm] = useState(initialForm);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/requisitions?limit=100', { headers: getAuthHeaders() });
      if (res.ok) { const data = await res.json(); setRequisitions(Array.isArray(data) ? data : data.requisitions || []); }
    } catch { toast.error('Failed to load requisitions'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { queueMicrotask(() => fetchData()); }, [fetchData]);

  const handleAddNew = () => {
    setForm(initialForm);
    setEditingId(null);
    setShowForm(true);
    setViewingId(null);
    setTimeout(() => document.getElementById('crud-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  const handleEdit = (item: Requisition) => {
    setForm({
      departmentId: item.department?.name || '',
      designationId: item.designation?.title || '',
      positionType: item.positionType || 'new',
      numberOfOpenings: item.numberOfOpenings || 1,
      employmentType: item.employmentType || 'full-time',
      skillsRequired: item.skillsRequired || '',
      experienceRequired: item.experienceRequired || '',
      qualification: item.qualification || '',
      salaryBudget: item.salaryBudget || '',
      priority: item.priority || 'medium',
      expectedJoiningDate: item.expectedJoiningDate ? new Date(item.expectedJoiningDate).toISOString().split('T')[0] : '',
    });
    setEditingId(item.id);
    setShowForm(true);
    setViewingId(null);
    setTimeout(() => document.getElementById('crud-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(initialForm);
  };

  const handleSubmit = async () => {
    if (!form.departmentId) { toast.error('Department is required'); return; }
    setSubmitting(true);
    try {
      if (editingId) {
        const res = await fetch(`/api/requisitions/${editingId}`, { method: 'PATCH', headers: getAuthHeaders(), body: JSON.stringify(form) });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed'); }
        toast.success('Requisition updated');
      } else {
        const res = await fetch('/api/requisitions', { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify({ ...form, companyId }) });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed'); }
        toast.success('Requisition raised');
      }
      handleCancelForm();
      fetchData();
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Failed'); }
    finally { setSubmitting(false); }
  };

  const handleDelete = async (id: string) => {
    try {
      setDeleting(true);
      const res = await fetch(`/api/requisitions/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed'); }
      toast.success('Requisition deleted');
      setDeleteConfirmId(null);
      if (viewingId === id) setViewingId(null);
      fetchData();
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Failed to delete'); }
    finally { setDeleting(false); }
  };

  const handleApproval = async (id: string, action: string) => {
    try {
      const res = await fetch(`/api/requisitions/${id}`, { method: 'PATCH', headers: getAuthHeaders(), body: JSON.stringify({ approvalStatus: action }) });
      if (!res.ok) throw new Error('Failed');
      toast.success(`Requisition ${action.replace('_', ' ')}`);
      fetchData();
    } catch { toast.error('Action failed'); }
  };

  const nextApprovalStep = (current: string) => {
    if (current === 'pending') return 'manager_approved';
    if (current === 'manager_approved') return 'hr_approved';
    if (current === 'hr_approved') return 'budget_approved';
    return '';
  };

  const colCount = 10;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-thb-text-primary">Manpower Requisitions</h1>
          <p className="text-thb-text-secondary mt-1">Raise and approve hiring requests</p>
        </div>
        <button onClick={handleAddNew} className="inline-flex items-center gap-2 px-4 py-2.5 bg-green-500 text-white rounded-lg hover:bg-green-600 font-medium text-sm shadow-sm shadow-green-500/25 transition-colors">
          <FiPlus className="w-4 h-4" /> Raise Requisition
        </button>
      </div>

      <ModuleTips moduleKey="requisitions" title="Requisition Tips" tips={requisitionsTips} userRole={user?.role} />
      <ModuleWorkflow moduleKey="requisitions" title="How to Process Job Requisitions" subtitle="Follow this workflow to manage hiring requests" steps={requisitionsWorkflowSteps} accentColor="violet" userRole={user?.role} />

      {/* View Panel */}
      {viewingId && (() => {
        const item = requisitions.find(i => i.id === viewingId);
        if (!item) return null;
        return (
          <div id="view-panel" className="thb-card border-l-4 border-l-emerald-500">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-thb-text-primary">Requisition Details</h2>
                <div className="flex items-center gap-2">
                  <button onClick={() => handleEdit(item)} className="px-3 py-1.5 rounded-lg bg-green-500 text-white text-xs font-medium hover:bg-green-600 transition-colors flex items-center gap-1"><FiEdit2 className="w-3.5 h-3.5" />Edit</button>
                  <button onClick={() => setViewingId(null)} className="p-2 rounded-lg text-thb-text-muted hover:text-thb-text-primary hover:bg-slate-100 transition-colors"><FiX className="w-5 h-5" /></button>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div><span className="text-xs font-medium text-thb-text-secondary">Req ID</span><p className="text-sm font-medium text-thb-text-primary mt-0.5">{item.requisitionId || '—'}</p></div>
                <div><span className="text-xs font-medium text-thb-text-secondary">Department</span><p className="text-sm font-medium text-thb-text-primary mt-0.5">{item.department?.name || '—'}</p></div>
                <div><span className="text-xs font-medium text-thb-text-secondary">Designation</span><p className="text-sm font-medium text-thb-text-primary mt-0.5">{item.designation?.title || '—'}</p></div>
                <div><span className="text-xs font-medium text-thb-text-secondary">Position Type</span><p className="text-sm font-medium text-thb-text-primary mt-0.5 capitalize">{item.positionType || '—'}</p></div>
                <div><span className="text-xs font-medium text-thb-text-secondary">Number of Openings</span><p className="text-sm font-medium text-thb-text-primary mt-0.5">{item.numberOfOpenings}</p></div>
                <div><span className="text-xs font-medium text-thb-text-secondary">Employment Type</span><p className="text-sm font-medium text-thb-text-primary mt-0.5 capitalize">{item.employmentType}</p></div>
                <div><span className="text-xs font-medium text-thb-text-secondary">Priority</span><p className="mt-0.5"><span className={getPriorityBadge(item.priority)}>{item.priority}</span></p></div>
                <div><span className="text-xs font-medium text-thb-text-secondary">Approval Status</span><p className="mt-0.5"><span className={getApprovalBadge(item.approvalStatus)}>{item.approvalStatus.replace('_', ' ')}</span></p></div>
                <div><span className="text-xs font-medium text-thb-text-secondary">Status</span><p className="mt-0.5"><span className={getStatusBadge(item.status)}>{item.status}</span></p></div>
                <div><span className="text-xs font-medium text-thb-text-secondary">Skills Required</span><p className="text-sm font-medium text-thb-text-primary mt-0.5">{item.skillsRequired || '—'}</p></div>
                <div><span className="text-xs font-medium text-thb-text-secondary">Experience Required</span><p className="text-sm font-medium text-thb-text-primary mt-0.5">{item.experienceRequired || '—'}</p></div>
                <div><span className="text-xs font-medium text-thb-text-secondary">Qualification</span><p className="text-sm font-medium text-thb-text-primary mt-0.5">{item.qualification || '—'}</p></div>
                <div><span className="text-xs font-medium text-thb-text-secondary">Salary Budget</span><p className="text-sm font-medium text-thb-text-primary mt-0.5">{item.salaryBudget || '—'}</p></div>
                <div><span className="text-xs font-medium text-thb-text-secondary">Expected Joining Date</span><p className="text-sm font-medium text-thb-text-primary mt-0.5">{item.expectedJoiningDate ? new Date(item.expectedJoiningDate).toLocaleDateString() : '—'}</p></div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Embedded Form */}
      {showForm && (
        <div id="crud-form" className="thb-card border-l-4 border-l-green-500">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-thb-text-primary">
                {editingId ? 'Edit Requisition' : 'Raise New Requisition'}
              </h2>
              <button onClick={handleCancelForm} className="p-2 rounded-lg text-thb-text-muted hover:text-thb-text-primary hover:bg-slate-100 transition-colors"><FiX className="w-5 h-5" /></button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Department *</label>
                <input required value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })} placeholder="Department ID" className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Designation</label>
                <input value={form.designationId} onChange={(e) => setForm({ ...form, designationId: e.target.value })} placeholder="Designation ID" className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Position Type</label>
                <select value={form.positionType} onChange={(e) => setForm({ ...form, positionType: e.target.value })} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400">
                  <option value="new">New</option>
                  <option value="replacement">Replacement</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Openings</label>
                <input type="number" min={1} value={form.numberOfOpenings} onChange={(e) => setForm({ ...form, numberOfOpenings: parseInt(e.target.value) || 1 })} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Employment</label>
                <select value={form.employmentType} onChange={(e) => setForm({ ...form, employmentType: e.target.value })} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400">
                  <option value="full-time">Full-time</option>
                  <option value="part-time">Part-time</option>
                  <option value="contract">Contract</option>
                  <option value="internship">Internship</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Priority</label>
                <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400">
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Skills Required</label>
                <input value={form.skillsRequired} onChange={(e) => setForm({ ...form, skillsRequired: e.target.value })} placeholder="e.g. React, Node.js, Python" className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Experience</label>
                <input value={form.experienceRequired} onChange={(e) => setForm({ ...form, experienceRequired: e.target.value })} placeholder="e.g. 3-5 years" className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Qualification</label>
                <input value={form.qualification} onChange={(e) => setForm({ ...form, qualification: e.target.value })} placeholder="e.g. B.Tech" className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Salary Budget</label>
                <input value={form.salaryBudget} onChange={(e) => setForm({ ...form, salaryBudget: e.target.value })} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Expected Joining</label>
                <input type="date" value={form.expectedJoiningDate} onChange={(e) => setForm({ ...form, expectedJoiningDate: e.target.value })} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-thb-border">
              <button onClick={handleCancelForm} className="px-4 py-2.5 rounded-lg border border-thb-border text-sm font-medium text-thb-text-secondary hover:bg-slate-50 transition-colors">Cancel</button>
              <button onClick={handleSubmit} disabled={submitting} className="px-6 py-2.5 rounded-lg bg-green-500 text-white text-sm font-medium hover:bg-green-600 disabled:opacity-50 shadow-sm shadow-green-500/25 transition-colors">{submitting ? 'Saving...' : editingId ? 'Update' : 'Create'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="thb-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-thb-border bg-slate-50/50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Req ID</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Department</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Designation</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Openings</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Type</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Priority</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Approval Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Workflow</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="border-b border-thb-border/50 animate-pulse">
                    {Array.from({ length: colCount }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 w-20 bg-slate-200 rounded" /></td>
                    ))}
                  </tr>
                ))
              ) : requisitions.length === 0 ? (
                <tr>
                  <td colSpan={colCount} className="px-4 py-12 text-center">
                    <FiAlertCircle className="w-10 h-10 text-thb-text-muted mx-auto mb-3" />
                    <p className="text-thb-text-secondary font-medium">No requisitions found</p>
                    <p className="text-sm text-thb-text-muted mt-1">Raise your first requisition to get started</p>
                  </td>
                </tr>
              ) : (
                requisitions.map((r) => (
                  <tr key={r.id} className="border-b border-thb-border/50 hover:bg-slate-50/50 transition-colors">
                    {deleteConfirmId === r.id ? (
                      <td colSpan={colCount} className="px-4 py-3 bg-red-50">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-red-700 font-medium">Are you sure you want to delete this requisition?</span>
                          <div className="flex items-center gap-2">
                            <button onClick={() => handleDelete(r.id)} disabled={deleting} className="px-3 py-1.5 bg-red-500 text-white text-xs font-medium rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors">{deleting ? 'Deleting...' : 'Confirm'}</button>
                            <button onClick={() => setDeleteConfirmId(null)} className="px-3 py-1.5 border border-thb-border text-xs font-medium rounded-lg hover:bg-slate-50 transition-colors">Cancel</button>
                          </div>
                        </div>
                      </td>
                    ) : (
                      <>
                        <td className="px-4 py-3 text-sm font-mono text-thb-text-secondary">{r.requisitionId?.slice(0, 8) || '—'}</td>
                        <td className="px-4 py-3 text-sm text-thb-text-primary">{r.department?.name || '—'}</td>
                        <td className="px-4 py-3 text-sm text-thb-text-primary">{r.designation?.title || '—'}</td>
                        <td className="px-4 py-3 text-sm text-thb-text-primary">{r.numberOfOpenings}</td>
                        <td className="px-4 py-3"><span className="thb-badge thb-badge-primary">{r.employmentType}</span></td>
                        <td className="px-4 py-3"><span className={getPriorityBadge(r.priority)}>{r.priority}</span></td>
                        <td className="px-4 py-3"><span className={getApprovalBadge(r.approvalStatus)}>{r.approvalStatus.replace('_', ' ')}</span></td>
                        <td className="px-4 py-3"><span className={getStatusBadge(r.status)}>{r.status}</span></td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            {r.approvalStatus !== 'budget_approved' && r.approvalStatus !== 'rejected' && (
                              <button onClick={() => handleApproval(r.id, nextApprovalStep(r.approvalStatus))} className="px-2 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 rounded hover:bg-emerald-100 flex items-center gap-1"><FiCheck className="w-3 h-3" />Approve</button>
                            )}
                            {r.approvalStatus !== 'rejected' && r.approvalStatus !== 'budget_approved' && (
                              <button onClick={() => handleApproval(r.id, 'rejected')} className="px-2 py-1 text-xs font-medium text-red-700 bg-red-50 rounded hover:bg-red-100 flex items-center gap-1"><FiXCircle className="w-3 h-3" />Reject</button>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => { setViewingId(r.id); setTimeout(() => document.getElementById('view-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100); }} className="p-2 rounded-lg text-thb-text-muted hover:text-emerald-500 hover:bg-emerald-50 transition-colors" title="View"><FiEye className="w-4 h-4" /></button>
                            <button onClick={() => handleEdit(r)} className="p-2 rounded-lg text-thb-text-muted hover:text-green-500 hover:bg-green-50 transition-colors" title="Edit"><FiEdit2 className="w-4 h-4" /></button>
                            <button onClick={() => setDeleteConfirmId(r.id)} className="p-2 rounded-lg text-thb-text-muted hover:text-red-500 hover:bg-red-50 transition-colors" title="Delete"><FiTrash2 className="w-4 h-4" /></button>
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
