'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  FiPlus, FiX, FiCheck, FiXCircle, FiGitBranch,
  FiPlay, FiEye, FiEdit2, FiTrash2, FiArrowRight,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import ModuleTips from '@/components/ModuleTips';
import ModuleWorkflow from '@/components/ModuleWorkflow';

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

interface WorkflowStep {
  stepNumber: number;
  approverRole: string;
  isRequired: boolean;
}

interface WorkflowDefinition {
  id: string; name: string; module: string; description: string | null; steps: string; isActive: boolean; version: number;
  instances?: WorkflowInstance[];
}

interface WorkflowInstance {
  id: string; entityType: string; entityId: string; currentStep: number; status: string;
  workflowDefinition?: { name: string };
  approvals?: WorkflowApproval[];
}

interface WorkflowApproval {
  id: string; stepNumber: number; approverName: string; approverRole: string; action: string | null; comments: string | null; actedAt: string | null;
}

const moduleBadge: Record<string, string> = {
  leave: 'bg-amber-100 text-amber-700', attendance: 'bg-green-100 text-green-700', payroll: 'bg-emerald-100 text-emerald-700', recruitment: 'bg-teal-100 text-teal-700', timesheet: 'bg-cyan-100 text-cyan-700',
};

const moduleLabel: Record<string, string> = {
  leave: 'Leave', attendance: 'Attendance', payroll: 'Payroll', recruitment: 'Recruitment', timesheet: 'Timesheet',
};

const initialForm = { name: '', module: 'leave', description: '', steps: '[{"stepNumber":1,"approverRole":"manager","isRequired":true},{"stepNumber":2,"approverRole":"hr_admin","isRequired":true}]' };

/* ── Module Tips & Workflow Data ── */
const workflowTips = [
  { title: 'Design Approval Hierarchies', description: 'Structure multi-level approval chains with role-based approvers. Define who approves what and in what order to prevent bottlenecks.' },
  { title: 'Leverage Automation Rules', description: 'Set up automation to trigger workflows on events like leave applications or timesheet submissions to reduce manual intervention.' },
  { title: 'Define Trigger Conditions', description: 'Specify clear conditions that initiate workflows, such as amount thresholds, request types, or department-specific rules.' },
  { title: 'Configure Escalation Paths', description: 'Set timeout-based escalations so stuck approvals automatically move to backup approvers or escalate to higher authority.' },
  { title: 'Maintain Audit Trails', description: 'Every approval, rejection, and escalation is logged. Use audit trails for compliance, disputes, and process improvement.' },
];

const workflowWorkflowSteps = [
  { step: 1, title: 'Define Workflow', description: 'Name your workflow and select the target module' },
  { step: 2, title: 'Set Triggers', description: 'Configure conditions that automatically start the workflow' },
  { step: 3, title: 'Add Approval Steps', description: 'Define approval stages with roles and required/optional flags' },
  { step: 4, title: 'Configure Escalation', description: 'Set timeout rules and escalation paths for stuck approvals' },
  { step: 5, title: 'Test Workflow', description: 'Simulate the workflow with test data before going live' },
  { step: 6, title: 'Activate', description: 'Enable the workflow for real-world use' },
  { step: 7, title: 'Monitor & Optimize', description: 'Track performance metrics and refine steps as needed' },
];

export default function WorkflowsPage() {
  const { user } = useAuthStore();
  const [definitions, setDefinitions] = useState<WorkflowDefinition[]>([]);
  const [instances, setInstances] = useState<WorkflowInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [viewingWorkflow, setViewingWorkflow] = useState<WorkflowDefinition | null>(null);
  const [activeTab, setActiveTab] = useState<'definitions' | 'instances'>('definitions');
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(initialForm);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const headers = getAuthHeaders();
      const [defRes, instRes] = await Promise.allSettled([
        fetch('/api/workflows', { headers }),
        fetch('/api/workflows/instances', { headers }),
      ]);
      if (defRes.status === 'fulfilled' && defRes.value.ok) { const data = await defRes.value.json(); setDefinitions(Array.isArray(data) ? data : data.workflows || []); }
      if (instRes.status === 'fulfilled' && instRes.value.ok) { const data = await instRes.value.json(); setInstances(Array.isArray(data) ? data : data.instances || []); }
    } catch { toast.error('Failed to load workflows'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { queueMicrotask(() => fetchData()); }, [fetchData]);

  const fetchViewingWorkflow = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/workflows/${id}`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setViewingWorkflow(data.workflow || data);
      }
    } catch { toast.error('Failed to load workflow details'); }
  }, []);

  const handleView = useCallback(async (id: string) => {
    setViewingWorkflow(null);
    setViewingId(id);
    setShowForm(false);
    await fetchViewingWorkflow(id);
    setTimeout(() => document.getElementById('view-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  }, [fetchViewingWorkflow]);

  const handleAddNew = () => {
    setForm(initialForm);
    setEditingId(null);
    setShowForm(true);
    setViewingId(null);
    setTimeout(() => document.getElementById('crud-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  const handleEdit = (wf: WorkflowDefinition) => {
    setForm({
      name: wf.name,
      module: wf.module,
      description: wf.description || '',
      steps: wf.steps,
    });
    setEditingId(wf.id);
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
    if (!form.name) { toast.error('Name is required'); return; }
    setSubmitting(true);
    try {
      if (editingId) {
        const res = await fetch(`/api/workflows/${editingId}`, {
          method: 'PATCH',
          headers: getAuthHeaders(),
          body: JSON.stringify({ name: form.name, module: form.module, description: form.description, steps: form.steps }),
        });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed'); }
        toast.success('Workflow updated');
      } else {
        const res = await fetch('/api/workflows', { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(form) });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed'); }
        toast.success('Workflow created');
      }
      handleCancelForm();
      fetchData();
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Failed'); }
    finally { setSubmitting(false); }
  };

  const handleDelete = async (id: string) => {
    try {
      setDeleting(true);
      const res = await fetch(`/api/workflows/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed'); }
      toast.success('Workflow deleted');
      setDeleteConfirmId(null);
      if (viewingId === id) setViewingId(null);
      fetchData();
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Failed to delete'); }
    finally { setDeleting(false); }
  };

  const handleApproval = async (instanceId: string, approvalId: string, action: string) => {
    try {
      const res = await fetch(`/api/workflows/instances/${instanceId}`, { method: 'PATCH', headers: getAuthHeaders(), body: JSON.stringify({ approvalId, action }) });
      if (!res.ok) throw new Error('Failed');
      toast.success(`Workflow step ${action}`);
      fetchData();
    } catch { toast.error('Action failed'); }
  };

  const getStepCount = (stepsStr: string) => {
    try { return JSON.parse(stepsStr).length; } catch { return 0; }
  };

  const parseSteps = (stepsStr: string): WorkflowStep[] => {
    try { return JSON.parse(stepsStr); } catch { return []; }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-thb-text-primary">Workflow Builder</h1>
          <p className="text-thb-text-secondary mt-1">Design and manage approval workflows</p>
        </div>
        <button onClick={handleAddNew} className="inline-flex items-center gap-2 px-4 py-2.5 bg-green-500 text-white rounded-lg hover:bg-green-600 font-medium text-sm shadow-sm shadow-green-500/25 transition-colors"><FiPlus className="w-4 h-4" /> Create Workflow</button>
      </div>

      <ModuleTips moduleKey="workflows" title="Workflow Tips" tips={workflowTips} userRole={user?.role} />
      <ModuleWorkflow moduleKey="workflows" title="How to Create Approval Workflows" subtitle="Follow this workflow to build effective approval processes" steps={workflowWorkflowSteps} accentColor="rose" userRole={user?.role} />

      <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit">
        {(['definitions', 'instances'] as const).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-2 rounded-md text-sm font-medium capitalize transition-colors ${activeTab === tab ? 'bg-white shadow-sm text-thb-text-primary' : 'text-thb-text-muted hover:text-thb-text-primary'}`}>{tab}</button>
        ))}
      </div>

      {activeTab === 'definitions' && (
        <>
          {/* View Panel */}
          {viewingId && viewingWorkflow && (
            <div id="view-panel" className="thb-card border-l-4 border-l-emerald-500">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center text-white"><FiGitBranch className="w-5 h-5" /></div>
                    <div>
                      <h2 className="text-lg font-semibold text-thb-text-primary">{viewingWorkflow.name}</h2>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${moduleBadge[viewingWorkflow.module] || 'bg-slate-100 text-slate-600'}`}>{moduleLabel[viewingWorkflow.module] || viewingWorkflow.module}</span>
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${viewingWorkflow.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{viewingWorkflow.isActive ? 'Active' : 'Inactive'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => handleEdit(viewingWorkflow)} className="px-3 py-1.5 rounded-lg bg-green-500 text-white text-xs font-medium hover:bg-green-600 transition-colors flex items-center gap-1"><FiEdit2 className="w-3.5 h-3.5" />Edit</button>
                    <button onClick={() => setViewingId(null)} className="p-2 rounded-lg text-thb-text-muted hover:text-thb-text-primary hover:bg-slate-100 transition-colors"><FiX className="w-5 h-5" /></button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                  <div>
                    <span className="text-xs font-medium text-thb-text-secondary">Module</span>
                    <p className="text-sm font-medium text-thb-text-primary mt-0.5">{moduleLabel[viewingWorkflow.module] || viewingWorkflow.module}</p>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-thb-text-secondary">Version</span>
                    <p className="text-sm font-medium text-thb-text-primary mt-0.5">v{viewingWorkflow.version}</p>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-thb-text-secondary">Total Steps</span>
                    <p className="text-sm font-medium text-thb-text-primary mt-0.5">{getStepCount(viewingWorkflow.steps)}</p>
                  </div>
                </div>

                {viewingWorkflow.description && (
                  <div className="mb-6">
                    <span className="text-xs font-medium text-thb-text-secondary">Description</span>
                    <p className="text-sm text-thb-text-primary mt-0.5">{viewingWorkflow.description}</p>
                  </div>
                )}

                {/* Steps Pipeline */}
                <div>
                  <span className="text-xs font-medium text-thb-text-secondary mb-3 block">Approval Pipeline</span>
                  <div className="flex items-center gap-0 overflow-x-auto pb-2">
                    {parseSteps(viewingWorkflow.steps).map((step, idx) => (
                      <div key={idx} className="flex items-center">
                        <div className="flex flex-col items-center min-w-[120px]">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center text-white text-sm font-bold shadow-sm">
                            {step.stepNumber}
                          </div>
                          <p className="text-xs font-medium text-thb-text-primary mt-2 capitalize text-center">{step.approverRole?.replace('_', ' ')}</p>
                          <p className="text-xs text-thb-text-muted">{step.isRequired ? 'Required' : 'Optional'}</p>
                        </div>
                        {idx < parseSteps(viewingWorkflow.steps).length - 1 && (
                          <FiArrowRight className="w-5 h-5 text-thb-text-muted mx-2 flex-shrink-0" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Inline Form */}
          {showForm && (
            <div id="crud-form" className="thb-card border-l-4 border-l-green-500">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-semibold text-thb-text-primary">
                    {editingId ? 'Edit Workflow' : 'Create Workflow'}
                  </h2>
                  <button onClick={handleCancelForm} className="p-2 rounded-lg text-thb-text-muted hover:text-thb-text-primary hover:bg-slate-100 transition-colors"><FiX className="w-5 h-5" /></button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-thb-text-secondary mb-1">Name *</label>
                    <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" placeholder="Workflow name" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-thb-text-secondary mb-1">Module</label>
                    <select value={form.module} onChange={(e) => setForm({ ...form, module: e.target.value })} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400">
                      <option value="leave">Leave</option>
                      <option value="attendance">Attendance</option>
                      <option value="payroll">Payroll</option>
                      <option value="recruitment">Recruitment</option>
                      <option value="timesheet">Timesheet</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-thb-text-secondary mb-1">Description</label>
                    <textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 resize-none" placeholder="Workflow description..." />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-thb-text-secondary mb-1">Steps (JSON Array)</label>
                    <textarea rows={6} value={form.steps} onChange={(e) => setForm({ ...form, steps: e.target.value })} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 resize-none" />
                    <p className="text-xs text-thb-text-muted mt-1">Each step: {`{"stepNumber":1,"approverRole":"manager","isRequired":true}`}</p>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-thb-border">
                  <button onClick={handleCancelForm} className="px-4 py-2.5 rounded-lg border border-thb-border text-sm font-medium text-thb-text-secondary hover:bg-slate-50 transition-colors">Cancel</button>
                  <button onClick={handleSubmit} disabled={submitting} className="px-6 py-2.5 rounded-lg bg-green-500 text-white text-sm font-medium hover:bg-green-600 disabled:opacity-50 shadow-sm shadow-green-500/25 transition-colors">{submitting ? 'Saving...' : editingId ? 'Update' : 'Create'}</button>
                </div>
              </div>
            </div>
          )}

          {/* Definitions List */}
          {loading ? (
            <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => (<div key={i} className="thb-card p-5 animate-pulse"><div className="h-5 w-3/4 bg-slate-200 rounded mb-2" /><div className="h-3 w-1/2 bg-slate-100 rounded" /></div>))}</div>
          ) : definitions.length === 0 ? (
            <div className="thb-card p-12 text-center"><FiGitBranch className="w-12 h-12 text-thb-text-muted mx-auto mb-3" /><p className="text-thb-text-secondary">No workflows defined</p></div>
          ) : (
            <div className="space-y-3">
              {definitions.map((wf) => (
                deleteConfirmId === wf.id ? (
                  <div key={wf.id} className="thb-card p-5 bg-red-50">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-red-700 font-medium">Are you sure you want to delete &quot;{wf.name}&quot;?</span>
                      <div className="flex items-center gap-2">
                        <button onClick={() => handleDelete(wf.id)} disabled={deleting} className="px-3 py-1.5 bg-red-500 text-white text-xs font-medium rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors">{deleting ? 'Deleting...' : 'Confirm'}</button>
                        <button onClick={() => setDeleteConfirmId(null)} className="px-3 py-1.5 border border-thb-border text-xs font-medium rounded-lg hover:bg-slate-50 transition-colors">Cancel</button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div key={wf.id} className="thb-card p-5 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center text-white"><FiGitBranch className="w-5 h-5" /></div>
                        <div>
                          <h3 className="font-semibold text-thb-text-primary">{wf.name}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${moduleBadge[wf.module] || 'bg-slate-100 text-slate-600'}`}>{moduleLabel[wf.module] || wf.module}</span>
                            <span className="text-xs text-thb-text-muted">{getStepCount(wf.steps)} steps</span>
                            <span className="text-xs text-thb-text-muted">v{wf.version}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${wf.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{wf.isActive ? 'Active' : 'Inactive'}</span>
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleView(wf.id)} className="p-2 rounded-lg text-thb-text-muted hover:text-emerald-500 hover:bg-emerald-50 transition-colors" title="View"><FiEye className="w-4 h-4" /></button>
                          <button onClick={() => handleEdit(wf)} className="p-2 rounded-lg text-thb-text-muted hover:text-green-500 hover:bg-green-50 transition-colors" title="Edit"><FiEdit2 className="w-4 h-4" /></button>
                          <button onClick={() => setDeleteConfirmId(wf.id)} className="p-2 rounded-lg text-thb-text-muted hover:text-red-500 hover:bg-red-50 transition-colors" title="Delete"><FiTrash2 className="w-4 h-4" /></button>
                        </div>
                      </div>
                    </div>
                    {wf.description && <p className="text-sm text-thb-text-muted mt-2 ml-14">{wf.description}</p>}
                  </div>
                )
              ))}
            </div>
          )}
        </>
      )}

      {activeTab === 'instances' && (
        loading ? (
          <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => (<div key={i} className="thb-card p-5 animate-pulse"><div className="h-5 w-3/4 bg-slate-200 rounded" /></div>))}</div>
        ) : instances.length === 0 ? (
          <div className="thb-card p-12 text-center"><FiPlay className="w-12 h-12 text-thb-text-muted mx-auto mb-3" /><p className="text-thb-text-secondary">No workflow instances</p></div>
        ) : (
          <div className="space-y-3">
            {instances.map((inst) => (
              <div key={inst.id} className="thb-card p-5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-semibold text-thb-text-primary">{inst.workflowDefinition?.name || 'Unknown'}</h3>
                    <p className="text-xs text-thb-text-secondary">{inst.entityType} · {inst.entityId.slice(0, 8)}</p>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${inst.status === 'pending' ? 'bg-amber-100 text-amber-700' : inst.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{inst.status}</span>
                </div>
                <div className="flex items-center gap-2">
                  {(inst.approvals || []).map((a) => (
                    <div key={a.id} className="flex items-center gap-1">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${a.action === 'approved' ? 'bg-emerald-100 text-emerald-700' : a.action === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`}>
                        {a.action === 'approved' ? '✓' : a.action === 'rejected' ? '✗' : a.stepNumber}
                      </div>
                      <div className="text-xs">
                        <p className="font-medium text-thb-text-primary">{a.approverName || a.approverRole}</p>
                        {!a.action && (
                          <div className="flex gap-1 mt-0.5">
                            <button onClick={() => handleApproval(inst.id, a.id, 'approved')} className="px-1.5 py-0.5 text-xs text-emerald-700 bg-emerald-50 rounded hover:bg-emerald-100 transition-colors"><FiCheck className="w-3 h-3" /></button>
                            <button onClick={() => handleApproval(inst.id, a.id, 'rejected')} className="px-1.5 py-0.5 text-xs text-red-700 bg-red-50 rounded hover:bg-red-100 transition-colors"><FiXCircle className="w-3 h-3" /></button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
