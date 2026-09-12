'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  FiPlus, FiX, FiCheck, FiFileText, FiEye, FiEdit2, FiTrash2, FiLink,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import ConvertCandidateButton from '@/components/hrms/ConvertCandidateButton';
import ModuleTips from '@/components/ModuleTips';
import ModuleWorkflow from '@/components/ModuleWorkflow';

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

interface Offer {
  id: string; candidateName: string; candidateEmail: string; position: string; department: string | null; offeredSalary: number; offeredCurrency: string; joiningDate: string; probationPeriod: number; status: string; createdAt: string; accessToken?: string | null;
}

const offersTips = [
  { title: 'Offer Letter Templates', description: 'Use pre-defined templates to ensure consistency and compliance across all offer letters sent to candidates.' },
  { title: 'Salary Negotiation', description: 'Track negotiation rounds and maintain a record of revised offers to stay within approved budget limits.' },
  { title: 'Probation Terms', description: 'Clearly define probation duration, review criteria, and confirmation process in the offer letter.' },
  { title: 'Compliance Checks', description: 'Verify background verification, document collection, and statutory requirements before sending the offer.' },
  { title: 'Acceptance Tracking', description: 'Monitor offer acceptance status and set up automated reminders for pending responses.' },
];

const offersWorkflowSteps = [
  { step: 1, title: 'Select Candidate', description: 'Choose a candidate from the shortlist' },
  { step: 2, title: 'Prepare Offer Letter', description: 'Draft the offer using a template' },
  { step: 3, title: 'Define Compensation', description: 'Set salary, benefits, and bonuses' },
  { step: 4, title: 'Set Terms & Conditions', description: 'Configure probation and notice period' },
  { step: 5, title: 'Send Offer', description: 'Dispatch the offer letter to candidate' },
  { step: 6, title: 'Track Acceptance', description: 'Monitor candidate response status' },
  { step: 7, title: 'Initiate Onboarding', description: 'Start the onboarding process on acceptance' },
];

const initialForm = {
  candidateName: '', candidateEmail: '', position: '', department: '', offeredSalary: 0, offeredCurrency: 'INR', joiningDate: '', probationPeriod: 90,
};

function getStatusBadge(status: string) {
  const map: Record<string, string> = {
    draft: 'thb-badge thb-badge-primary',
    pending_approval: 'thb-badge thb-badge-warning',
    approved: 'thb-badge thb-badge-info',
    sent: 'thb-badge thb-badge-purple',
    accepted: 'thb-badge thb-badge-success',
    rejected: 'thb-badge thb-badge-error',
    withdrawn: 'thb-badge thb-badge-error',
  };
  return map[status] || 'thb-badge thb-badge-info';
}

function formatStatus(status: string) {
  return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

export default function OffersPage() {
  const { user } = useAuthStore();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [form, setForm] = useState(initialForm);

  const fetchOffers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/offers?limit=100', { headers: getAuthHeaders() });
      if (res.ok) { const data = await res.json(); setOffers(Array.isArray(data) ? data : data.offers || []); }
    } catch { toast.error('Failed to load offers'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { queueMicrotask(() => fetchOffers()); }, [fetchOffers]);

  const handleAddNew = () => {
    setForm(initialForm);
    setEditingId(null);
    setShowForm(true);
    setViewingId(null);
    setTimeout(() => document.getElementById('crud-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  const handleEdit = (item: Offer) => {
    setForm({
      candidateName: item.candidateName || '',
      candidateEmail: item.candidateEmail || '',
      position: item.position || '',
      department: item.department || '',
      offeredSalary: item.offeredSalary || 0,
      offeredCurrency: item.offeredCurrency || 'USD',
      joiningDate: item.joiningDate ? new Date(item.joiningDate).toISOString().split('T')[0] : '',
      probationPeriod: item.probationPeriod || 90,
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
    if (!form.candidateName || !form.position) { toast.error('Name and position are required'); return; }
    setSubmitting(true);
    try {
      if (editingId) {
        const res = await fetch(`/api/offers/${editingId}`, { method: 'PATCH', headers: getAuthHeaders(), body: JSON.stringify(form) });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed'); }
        toast.success('Offer updated');
      } else {
        const res = await fetch('/api/offers', { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify({ ...form, candidateId: `candidate-${Date.now()}` }) });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed'); }
        toast.success('Offer created');
      }
      handleCancelForm();
      fetchOffers();
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Failed'); }
    finally { setSubmitting(false); }
  };

  const handleDelete = async (id: string) => {
    try {
      setDeleting(true);
      const res = await fetch(`/api/offers/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed'); }
      toast.success('Offer deleted');
      setDeleteConfirmId(null);
      if (viewingId === id) setViewingId(null);
      fetchOffers();
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Failed to delete'); }
    finally { setDeleting(false); }
  };

  const handleStatusChange = async (id: string, status: string) => {
    try {
      const res = await fetch(`/api/offers/${id}`, { method: 'PATCH', headers: getAuthHeaders(), body: JSON.stringify({ status }) });
      if (!res.ok) throw new Error('Failed');
      toast.success(`Offer ${status.replace('_', ' ')}`);
      fetchOffers();
    } catch { toast.error('Action failed'); }
  };

  const nextStatus = (current: string) => {
    if (current === 'draft') return 'pending_approval';
    if (current === 'pending_approval') return 'approved';
    if (current === 'approved') return 'sent';
    return '';
  };

  const colCount = 7;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-thb-text-primary">Offer Management</h1>
          <p className="text-thb-text-secondary mt-1">Create and manage job offers</p>
        </div>
        <button onClick={handleAddNew} className="inline-flex items-center gap-2 px-4 py-2.5 bg-green-500 text-white rounded-lg hover:bg-green-600 font-medium text-sm shadow-sm shadow-green-500/25 transition-colors">
          <FiPlus className="w-4 h-4" /> Create Offer
        </button>
      </div>

      <ModuleTips moduleKey="offers" title="Offer Management Tips" tips={offersTips} userRole={user?.role} />
      <ModuleWorkflow moduleKey="offers" title="How to Process Job Offers" subtitle="Follow this workflow to manage the offer lifecycle" steps={offersWorkflowSteps} accentColor="amber" userRole={user?.role} />

      {/* View Panel */}
      {viewingId && (() => {
        const item = offers.find(i => i.id === viewingId);
        if (!item) return null;
        return (
          <div id="view-panel" className="thb-card border-l-4 border-l-emerald-500">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-thb-text-primary">Offer Details</h2>
                <div className="flex items-center gap-2">
                  <button onClick={() => handleEdit(item)} className="px-3 py-1.5 rounded-lg bg-green-500 text-white text-xs font-medium hover:bg-green-600 transition-colors flex items-center gap-1"><FiEdit2 className="w-3.5 h-3.5" />Edit</button>
                  <button onClick={() => setViewingId(null)} className="p-2 rounded-lg text-thb-text-muted hover:text-thb-text-primary hover:bg-slate-100 transition-colors"><FiX className="w-5 h-5" /></button>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div><span className="text-xs font-medium text-thb-text-secondary">Candidate Name</span><p className="text-sm font-medium text-thb-text-primary mt-0.5">{item.candidateName || '—'}</p></div>
                <div><span className="text-xs font-medium text-thb-text-secondary">Candidate Email</span><p className="text-sm font-medium text-thb-text-primary mt-0.5">{item.candidateEmail || '—'}</p></div>
                <div><span className="text-xs font-medium text-thb-text-secondary">Position</span><p className="text-sm font-medium text-thb-text-primary mt-0.5">{item.position || '—'}</p></div>
                <div><span className="text-xs font-medium text-thb-text-secondary">Department</span><p className="text-sm font-medium text-thb-text-primary mt-0.5">{item.department || '—'}</p></div>
                <div><span className="text-xs font-medium text-thb-text-secondary">Offered Salary</span><p className="text-sm font-medium text-thb-text-primary mt-0.5">{item.offeredCurrency} {item.offeredSalary?.toLocaleString()}</p></div>
                <div><span className="text-xs font-medium text-thb-text-secondary">Joining Date</span><p className="text-sm font-medium text-thb-text-primary mt-0.5">{item.joiningDate ? new Date(item.joiningDate).toLocaleDateString() : '—'}</p></div>
                <div><span className="text-xs font-medium text-thb-text-secondary">Probation Period</span><p className="text-sm font-medium text-thb-text-primary mt-0.5">{item.probationPeriod} days</p></div>
                <div><span className="text-xs font-medium text-thb-text-secondary">Status</span><p className="mt-0.5"><span className={getStatusBadge(item.status)}>{formatStatus(item.status)}</span></p></div>
                <div><span className="text-xs font-medium text-thb-text-secondary">Created</span><p className="text-sm font-medium text-thb-text-primary mt-0.5">{new Date(item.createdAt).toLocaleDateString()}</p></div>
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
                {editingId ? 'Edit Offer' : 'Create New Offer'}
              </h2>
              <button onClick={handleCancelForm} className="p-2 rounded-lg text-thb-text-muted hover:text-thb-text-primary hover:bg-slate-100 transition-colors"><FiX className="w-5 h-5" /></button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Candidate Name <span className="text-red-500 font-bold">*</span></label>
                <input required value={form.candidateName} onChange={(e) => setForm({ ...form, candidateName: e.target.value })} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" placeholder="Full name" />
              </div>
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Candidate Email</label>
                <input type="email" value={form.candidateEmail} onChange={(e) => setForm({ ...form, candidateEmail: e.target.value })} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" placeholder="email@example.com" />
              </div>
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Position <span className="text-red-500 font-bold">*</span></label>
                <input required value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" placeholder="Job title" />
              </div>
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Department</label>
                <input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" placeholder="Department" />
              </div>
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Salary <span className="text-red-500 font-bold">*</span></label>
                <input type="number" required value={form.offeredSalary} onChange={(e) => setForm({ ...form, offeredSalary: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" placeholder="0" />
              </div>
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Currency</label>
                <select value={form.offeredCurrency} onChange={(e) => setForm({ ...form, offeredCurrency: e.target.value })} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400">
                  <option value="INR">INR</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Joining Date <span className="text-red-500 font-bold">*</span></label>
                <input type="date" required value={form.joiningDate} onChange={(e) => setForm({ ...form, joiningDate: e.target.value })} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Probation (days)</label>
                <input type="number" value={form.probationPeriod} onChange={(e) => setForm({ ...form, probationPeriod: parseInt(e.target.value) || 90 })} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" />
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
                <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Candidate</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Position</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Salary</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Joining Date</th>
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
              ) : offers.length === 0 ? (
                <tr>
                  <td colSpan={colCount} className="px-4 py-12 text-center">
                    <FiFileText className="w-10 h-10 text-thb-text-muted mx-auto mb-3" />
                    <p className="text-thb-text-secondary font-medium">No offers found</p>
                    <p className="text-sm text-thb-text-muted mt-1">Create your first offer to get started</p>
                  </td>
                </tr>
              ) : (
                offers.map((o) => (
                  <tr key={o.id} className="border-b border-thb-border/50 hover:bg-slate-50/50 transition-colors">
                    {deleteConfirmId === o.id ? (
                      <td colSpan={colCount} className="px-4 py-3 bg-red-50">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-red-700 font-medium">Are you sure you want to delete this offer?</span>
                          <div className="flex items-center gap-2">
                            <button onClick={() => handleDelete(o.id)} disabled={deleting} className="px-3 py-1.5 bg-red-500 text-white text-xs font-medium rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors">{deleting ? 'Deleting...' : 'Confirm'}</button>
                            <button onClick={() => setDeleteConfirmId(null)} className="px-3 py-1.5 border border-thb-border text-xs font-medium rounded-lg hover:bg-slate-50 transition-colors">Cancel</button>
                          </div>
                        </div>
                      </td>
                    ) : (
                      <>
                        <td className="px-4 py-3">
                          <div><p className="text-sm font-medium text-thb-text-primary">{o.candidateName}</p><p className="text-xs text-thb-text-muted">{o.candidateEmail}</p></div>
                        </td>
                        <td className="px-4 py-3 text-sm text-thb-text-primary">{o.position}</td>
                        <td className="px-4 py-3 text-sm font-medium text-thb-text-primary">{o.offeredCurrency} {o.offeredSalary?.toLocaleString()}</td>
                        <td className="px-4 py-3 text-sm text-thb-text-secondary">{o.joiningDate ? new Date(o.joiningDate).toLocaleDateString() : '—'}</td>
                        <td className="px-4 py-3"><span className={getStatusBadge(o.status)}>{formatStatus(o.status)}</span></td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            {nextStatus(o.status) && (
                              <button onClick={() => handleStatusChange(o.id, nextStatus(o.status))} className="px-2 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 rounded hover:bg-emerald-100 flex items-center gap-1"><FiCheck className="w-3 h-3" />Advance</button>
                            )}
                            {(o.status === 'sent' || o.status === 'approved') && (
                              <>
                                <button onClick={() => handleStatusChange(o.id, 'accepted')} className="px-2 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 rounded hover:bg-emerald-100">Accept</button>
                                <button onClick={() => handleStatusChange(o.id, 'rejected')} className="px-2 py-1 text-xs font-medium text-red-700 bg-red-50 rounded hover:bg-red-100">Reject</button>
                              </>
                            )}
                            {o.accessToken && ['sent', 'approved', 'accepted'].includes(o.status) && (
                              <button
                                onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/offer/${o.accessToken}`).then(() => toast.success('Candidate link copied — share it with the candidate')).catch(() => toast.error('Copy failed')); }}
                                className="px-2 py-1 text-xs font-medium text-sky-700 bg-sky-50 rounded hover:bg-sky-100 flex items-center gap-1"
                                title="Copy the secure candidate acceptance link"
                              >
                                <FiLink className="w-3 h-3" /> Link
                              </button>
                            )}
                            {o.status === 'accepted' && (
                              <ConvertCandidateButton
                                offerId={o.id}
                                defaultJoiningDate={o.joiningDate}
                                defaultProbationDays={o.probationPeriod}
                                className="px-2 py-1 text-xs font-medium text-white bg-teal-600 rounded hover:bg-teal-700 inline-flex items-center gap-1"
                                label="Convert"
                              />
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => { setViewingId(o.id); setTimeout(() => document.getElementById('view-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100); }} className="p-2 rounded-lg text-thb-text-muted hover:text-emerald-500 hover:bg-emerald-50 transition-colors" title="View"><FiEye className="w-4 h-4" /></button>
                            <button onClick={() => handleEdit(o)} className="p-2 rounded-lg text-thb-text-muted hover:text-green-500 hover:bg-green-50 transition-colors" title="Edit"><FiEdit2 className="w-4 h-4" /></button>
                            <button onClick={() => setDeleteConfirmId(o.id)} className="p-2 rounded-lg text-thb-text-muted hover:text-red-500 hover:bg-red-50 transition-colors" title="Delete"><FiTrash2 className="w-4 h-4" /></button>
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
