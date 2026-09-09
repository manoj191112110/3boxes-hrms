'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  FiAlertCircle,
  FiPlus,
  FiX,
  FiEdit2,
  FiTrash2,
  FiSearch,
  FiFilter,
  FiShield,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import ModuleTips from '@/components/ModuleTips';
import ModuleWorkflow from '@/components/ModuleWorkflow';

/* ── Types ── */
interface Grievance {
  id: string;
  employeeId: string;
  type: string;
  subject: string;
  description: string;
  priority: string;
  status: string;
  assignedTo: string | null;
  resolution: string | null;
  resolvedDate?: string | null;
  createdAt: string;
  employee?: { id: string; firstName: string; lastName: string; employeeId: string; avatar?: string | null };
}

interface Employee {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
}

/* ── Helpers ── */
function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

function getStatusBadge(status: string) {
  const map: Record<string, string> = {
    submitted: 'thb-badge thb-badge-warning',
    open: 'thb-badge thb-badge-warning',
    investigating: 'thb-badge thb-badge-info',
    in_progress: 'thb-badge thb-badge-info',
    resolved: 'thb-badge thb-badge-success',
    closed: 'bg-slate-100 text-slate-600 thb-badge',
    escalated: 'thb-badge thb-badge-error',
  };
  return map[status] || 'thb-badge thb-badge-info';
}

function getPriorityBadge(priority: string) {
  const map: Record<string, string> = {
    low: 'thb-badge thb-badge-success',
    medium: 'thb-badge thb-badge-warning',
    high: 'bg-orange-50 text-orange-700 thb-badge',
    critical: 'thb-badge thb-badge-error',
  };
  return map[priority] || 'thb-badge thb-badge-info';
}

function getTypeBadge(type: string) {
  const map: Record<string, string> = {
    harassment: 'thb-badge thb-badge-error',
    discrimination: 'thb-badge thb-badge-purple',
    workplace: 'thb-badge thb-badge-warning',
    compensation: 'thb-badge thb-badge-info',
    policy: 'thb-badge thb-badge-primary',
    other: 'thb-badge thb-badge-primary',
  };
  return map[type] || 'thb-badge thb-badge-info';
}

const initialForm = {
  employeeId: '',
  type: 'other',
  subject: '',
  description: '',
  priority: 'medium',
  status: 'submitted',
  resolution: '',
  assignedTo: '',
};

/* ── Tips & Workflow ── */
const grievancesTips = [
  { title: 'Confidentiality', description: 'Maintain strict confidentiality of the complainant and investigation details to protect all parties involved.' },
  { title: 'Fair Investigation', description: 'Ensure unbiased and thorough investigation by qualified personnel with no conflict of interest.' },
  { title: 'Escalation Matrix', description: 'Follow the defined escalation matrix for timely resolution, especially for critical and high-priority grievances.' },
  { title: 'Documentation', description: 'Document every step of the process including complaints, investigations, findings, and resolutions for audit trail.' },
  { title: 'Resolution Timeline', description: 'Adhere to defined SLAs for grievance resolution. Delays can erode trust and escalate issues further.' },
];

const grievancesWorkflowSteps = [
  { step: 1, title: 'File Grievance', description: 'Employee submits a formal grievance with details and supporting evidence' },
  { step: 2, title: 'Acknowledge Receipt', description: 'HR acknowledges the grievance and assigns a tracking reference number' },
  { step: 3, title: 'Assign Investigator', description: 'Designate an impartial investigator or committee to examine the case' },
  { step: 4, title: 'Conduct Investigation', description: 'Gather facts, interview parties involved, and review evidence thoroughly' },
  { step: 5, title: 'Document Findings', description: 'Record investigation outcomes, conclusions, and recommended actions' },
  { step: 6, title: 'Propose Resolution', description: 'Present resolution options to stakeholders for approval and action' },
  { step: 7, title: 'Implement Resolution', description: 'Execute the approved resolution and communicate it to all relevant parties' },
  { step: 8, title: 'Follow-up & Close', description: 'Verify resolution effectiveness and formally close the grievance record' },
];

/* ── Component ── */
export default function GrievancesPage() {
  const { user } = useAuthStore();
  const isAdmin = ['super_admin', 'tenant_admin', 'admin'].includes(user?.role || '');

  const [grievances, setGrievances] = useState<Grievance[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  /* Fetch data */
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const headers = getAuthHeaders();

      const params = new URLSearchParams({ limit: '100' });
      if (filterStatus) params.set('status', filterStatus);
      if (filterPriority) params.set('priority', filterPriority);
      const res = await fetch(`/api/grievances?${params.toString()}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setGrievances(data.grievances || []);
      }

      if (employees.length === 0) {
        const empRes = await fetch('/api/employees?limit=500', { headers });
        if (empRes.ok) {
          const empData = await empRes.json();
          setEmployees(empData.employees || []);
        }
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load grievances');
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterPriority, employees.length]);

  useEffect(() => { queueMicrotask(() => fetchData()); }, [fetchData]);

  /* Filter grievances */
  const filteredGrievances = grievances.filter(g => {
    const matchSearch = !search ||
      g.subject.toLowerCase().includes(search.toLowerCase()) ||
      g.description.toLowerCase().includes(search.toLowerCase()) ||
      (g.employee ? `${g.employee.firstName} ${g.employee.lastName}`.toLowerCase().includes(search.toLowerCase()) : false);
    const matchType = !filterType || g.type === filterType;
    return matchSearch && matchType;
  });

  /* Summary stats */
  const openCount = grievances.filter(g => ['submitted', 'open'].includes(g.status)).length;
  const investigatingCount = grievances.filter(g => ['investigating', 'in_progress'].includes(g.status)).length;
  const resolvedCount = grievances.filter(g => g.status === 'resolved').length;
  const criticalCount = grievances.filter(g => g.priority === 'critical').length;

  /* Form handlers */
  const handleShowForm = () => {
    setForm({ ...initialForm, employeeId: employees.find(e => e.email === user?.email)?.id || '' });
    setEditingId(null);
    setShowForm(true);
    setTimeout(() => {
      document.getElementById('crud-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const handleEdit = (g: Grievance) => {
    setForm({
      employeeId: g.employeeId,
      type: g.type,
      subject: g.subject,
      description: g.description,
      priority: g.priority,
      status: g.status,
      resolution: g.resolution || '',
      assignedTo: g.assignedTo || '',
    });
    setEditingId(g.id);
    setShowForm(true);
    setTimeout(() => {
      document.getElementById('crud-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(initialForm);
  };

  const handleSubmit = async () => {
    if (!form.type || !form.subject || !form.description || !form.priority) {
      toast.error('Please fill in all required fields');
      return;
    }
    try {
      setSubmitting(true);
      const payload = {
        employeeId: form.employeeId || employees.find(e => e.email === user?.email)?.id,
        type: form.type,
        subject: form.subject,
        description: form.description,
        priority: form.priority,
        status: form.status,
        resolution: form.resolution || null,
        assignedTo: form.assignedTo || null,
      };

      if (!payload.employeeId) {
        toast.error('Employee record not found');
        return;
      }

      let res;
      if (editingId) {
        res = await fetch(`/api/grievances/${editingId}`, {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch('/api/grievances', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed');
      }

      toast.success(editingId ? 'Grievance updated successfully' : 'Grievance filed successfully');
      handleCancelForm();
      fetchData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save grievance');
    } finally {
      setSubmitting(false);
    }
  };

  /* Delete */
  const handleDelete = async (id: string) => {
    try {
      setDeleting(true);
      const res = await fetch(`/api/grievances/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed');
      }
      toast.success('Grievance deleted successfully');
      setDeleteConfirmId(null);
      fetchData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete grievance');
    } finally {
      setDeleting(false);
    }
  };

  /* Update status */
  const handleStatusUpdate = async (id: string, status: string, extra?: Record<string, unknown>) => {
    try {
      const res = await fetch(`/api/grievances/${id}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ status, ...extra }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed');
      }
      toast.success(`Grievance status updated to ${status.replace('_', ' ')}`);
      fetchData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update status');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-thb-text-primary flex items-center gap-2">
            <FiAlertCircle className="w-6 h-6 text-red-500" />
            Grievances
          </h1>
          <p className="text-thb-text-secondary mt-1">Manage employee grievances and complaints</p>
        </div>
        <button onClick={handleShowForm} className="inline-flex items-center gap-2 px-4 py-2.5 bg-green-500 text-white rounded-lg hover:bg-green-600 font-medium text-sm shadow-sm shadow-green-500/25 transition-colors">
          <FiPlus className="w-4 h-4" />
          File Grievance
        </button>
      </div>

      {/* Module Tips & Workflow */}
      <ModuleTips moduleKey="grievances" title="Grievance Handling Tips" tips={grievancesTips} userRole={user?.role} />
      <ModuleWorkflow moduleKey="grievances" title="How to Handle Employee Grievances" subtitle="Follow this workflow for fair and timely resolution" steps={grievancesWorkflowSteps} accentColor="rose" userRole={user?.role} />

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="thb-card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-100">
              <FiAlertCircle className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-thb-text-muted">Open</p>
              <p className="text-xl font-bold text-amber-600">{openCount}</p>
            </div>
          </div>
        </div>
        <div className="thb-card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-green-50 border border-green-100">
              <FiShield className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-thb-text-muted">Investigating</p>
              <p className="text-xl font-bold text-green-600">{investigatingCount}</p>
            </div>
          </div>
        </div>
        <div className="thb-card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-100">
              <FiAlertCircle className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-thb-text-muted">Resolved</p>
              <p className="text-xl font-bold text-emerald-600">{resolvedCount}</p>
            </div>
          </div>
        </div>
        <div className="thb-card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-red-50 border border-red-100">
              <FiAlertCircle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-thb-text-muted">Critical</p>
              <p className="text-xl font-bold text-red-700">{criticalCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Embedded Form */}
      {showForm && (
        <div id="crud-form" className="thb-card border-l-4 border-l-green-500">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-thb-text-primary">
                {editingId ? 'Edit Grievance' : 'File Grievance'}
              </h2>
              <button onClick={handleCancelForm} className="p-2 rounded-lg text-thb-text-muted hover:text-thb-text-primary hover:bg-slate-100">
                <FiX className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {isAdmin && (
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Employee</label>
                  <select value={form.employeeId} onChange={e => setForm(p => ({ ...p, employeeId: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400">
                    <option value="">Select Employee</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName} ({emp.employeeId})</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Type *</label>
                <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400">
                  <option value="harassment">Harassment</option>
                  <option value="discrimination">Discrimination</option>
                  <option value="workplace">Workplace</option>
                  <option value="compensation">Compensation</option>
                  <option value="policy">Policy</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Priority *</label>
                <select value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400">
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Subject *</label>
                <input type="text" value={form.subject} onChange={e => setForm(p => ({ ...p, subject: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" placeholder="Brief subject of the grievance" />
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Description *</label>
                <textarea rows={3} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 resize-none" placeholder="Describe the grievance in detail..." />
              </div>
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Status</label>
                <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400">
                  <option value="submitted">Submitted</option>
                  <option value="investigating">Investigating</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                  <option value="escalated">Escalated</option>
                </select>
              </div>
              {isAdmin && (
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Assign To</label>
                  <select value={form.assignedTo} onChange={e => setForm(p => ({ ...p, assignedTo: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400">
                    <option value="">Unassigned</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName}</option>
                    ))}
                  </select>
                </div>
              )}
              {editingId && isAdmin && (
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Resolution</label>
                  <input type="text" value={form.resolution} onChange={e => setForm(p => ({ ...p, resolution: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" placeholder="Resolution details" />
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-thb-border">
              <button onClick={handleCancelForm} className="px-4 py-2.5 rounded-lg border border-thb-border text-sm font-medium text-thb-text-secondary hover:bg-slate-50">Cancel</button>
              <button onClick={handleSubmit} disabled={submitting} className="px-6 py-2.5 rounded-lg bg-green-500 text-white text-sm font-medium hover:bg-green-600 disabled:opacity-50 shadow-sm shadow-green-500/25">
                {submitting ? 'Saving...' : editingId ? 'Update' : 'File Grievance'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filters and Search */}
      <div className="thb-card p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-thb-text-muted" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
              placeholder="Search grievances..."
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <div className="relative">
              <FiFilter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-thb-text-muted" />
              <select value={filterType} onChange={e => setFilterType(e.target.value)} className="pl-9 pr-8 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 appearance-none bg-white">
                <option value="">All Types</option>
                <option value="harassment">Harassment</option>
                <option value="discrimination">Discrimination</option>
                <option value="workplace">Workplace</option>
                <option value="compensation">Compensation</option>
                <option value="policy">Policy</option>
                <option value="other">Other</option>
              </select>
            </div>
            <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)} className="px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 appearance-none bg-white">
              <option value="">All Priority</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 appearance-none bg-white">
              <option value="">All Status</option>
              <option value="submitted">Submitted</option>
              <option value="open">Open</option>
              <option value="investigating">Investigating</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
              <option value="escalated">Escalated</option>
            </select>
          </div>
        </div>
      </div>

      {/* Grievances Table */}
      <div className="thb-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-thb-border bg-slate-50/50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Type</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Subject</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Employee</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Priority</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Status</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-thb-border/50 animate-pulse">
                    <td className="px-4 py-3"><div className="h-5 w-20 bg-slate-200 rounded-full" /></td>
                    <td className="px-4 py-3"><div className="h-3 w-32 bg-slate-200 rounded" /></td>
                    <td className="px-4 py-3"><div className="h-3 w-24 bg-slate-200 rounded" /></td>
                    <td className="px-4 py-3"><div className="h-5 w-16 bg-slate-200 rounded-full" /></td>
                    <td className="px-4 py-3"><div className="h-5 w-16 bg-slate-200 rounded-full" /></td>
                    <td className="px-4 py-3"><div className="h-3 w-16 bg-slate-200 rounded ml-auto" /></td>
                  </tr>
                ))
              ) : filteredGrievances.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <FiAlertCircle className="w-10 h-10 text-thb-text-muted mx-auto mb-3" />
                    <p className="text-thb-text-secondary font-medium">No grievances found</p>
                    <p className="text-sm text-thb-text-muted mt-1">Click &quot;File Grievance&quot; to submit a new complaint</p>
                  </td>
                </tr>
              ) : (
                filteredGrievances.map(g => (
                  <tr key={g.id} className="border-b border-thb-border/50 hover:bg-slate-50/50 transition-colors">
                    {deleteConfirmId === g.id ? (
                      <td colSpan={6} className="px-4 py-3 bg-red-50">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-red-700 font-medium">Are you sure you want to delete this grievance?</span>
                          <div className="flex items-center gap-2">
                            <button onClick={() => handleDelete(g.id)} disabled={deleting} className="px-3 py-1.5 bg-red-500 text-white text-xs font-medium rounded-lg hover:bg-red-600 disabled:opacity-50">{deleting ? 'Deleting...' : 'Confirm'}</button>
                            <button onClick={() => setDeleteConfirmId(null)} className="px-3 py-1.5 border border-thb-border text-xs font-medium rounded-lg hover:bg-slate-50">Cancel</button>
                          </div>
                        </div>
                      </td>
                    ) : (
                      <>
                        <td className="px-4 py-3"><span className={getTypeBadge(g.type)}>{g.type}</span></td>
                        <td className="px-4 py-3 text-sm font-medium text-thb-text-primary truncate max-w-[200px]">{g.subject}</td>
                        <td className="px-4 py-3 text-sm text-thb-text-secondary">{g.employee ? `${g.employee.firstName} ${g.employee.lastName}` : '—'}</td>
                        <td className="px-4 py-3"><span className={getPriorityBadge(g.priority)}>{g.priority}</span></td>
                        <td className="px-4 py-3"><span className={getStatusBadge(g.status)}>{g.status.replace('_', ' ')}</span></td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            {isAdmin && ['submitted', 'open'].includes(g.status) && (
                              <button onClick={() => handleStatusUpdate(g.id, 'investigating')} className="p-2 rounded-lg text-thb-text-muted hover:text-green-500 hover:bg-green-50 transition-colors" title="Start Investigation">
                                <FiShield className="w-4 h-4" />
                              </button>
                            )}
                            <button onClick={() => handleEdit(g)} className="p-2 rounded-lg text-thb-text-muted hover:text-green-500 hover:bg-green-50 transition-colors" title="Edit">
                              <FiEdit2 className="w-4 h-4" />
                            </button>
                            <button onClick={() => setDeleteConfirmId(g.id)} className="p-2 rounded-lg text-thb-text-muted hover:text-red-500 hover:bg-red-50 transition-colors" title="Delete">
                              <FiTrash2 className="w-4 h-4" />
                            </button>
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
