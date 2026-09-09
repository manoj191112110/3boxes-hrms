'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  FiFileText,
  FiPlus,
  FiX,
  FiEdit2,
  FiTrash2,
  FiSearch,
  FiFilter,
  FiEye,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import ModuleTips from '@/components/ModuleTips';
import ModuleWorkflow from '@/components/ModuleWorkflow';
import { useCompanyContextStore } from '@/store/companyContextStore';

/* ── Types ── */
interface Document {
  id: string;
  name: string;
  type: string;
  fileUrl: string | null;
  status: string;
  uploadedAt: string;
  expiryDate: string | null;
  employeeId: string;
  employee?: { id: string; firstName: string; lastName: string; employeeId: string };
  description?: string | null;
}

interface Employee {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
}

/* ── Helpers ── */
function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

function formatDate(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function getStatusBadge(status: string) {
  const map: Record<string, string> = {
    active: 'thb-badge thb-badge-success',
    expired: 'thb-badge thb-badge-error',
    archived: 'bg-slate-100 text-slate-600 thb-badge',
  };
  return map[status] || 'thb-badge thb-badge-info';
}

function formatStatus(status: string) {
  const map: Record<string, string> = {
    active: 'Active',
    expired: 'Expired',
    archived: 'Archived',
  };
  return map[status] || status;
}

function getTypeBadge(type: string) {
  const map: Record<string, string> = {
    offer_letter: 'thb-badge thb-badge-purple',
    id_proof: 'thb-badge thb-badge-info',
    address_proof: 'bg-orange-50 text-orange-700 thb-badge',
    tax_document: 'thb-badge thb-badge-warning',
    contract: 'thb-badge thb-badge-success',
    certificate: 'bg-orange-50 text-orange-700 thb-badge',
    policy: 'thb-badge thb-badge-warning',
    other: 'thb-badge thb-badge-primary',
  };
  return map[type] || 'thb-badge thb-badge-info';
}

function getTypeLabel(type: string) {
  const map: Record<string, string> = {
    offer_letter: 'Offer Letter',
    id_proof: 'ID Proof',
    address_proof: 'Address Proof',
    tax_document: 'Tax Document',
    contract: 'Contract',
    certificate: 'Certificate',
    policy: 'Policy',
    other: 'Other',
  };
  return map[type] || type;
}

const DOC_TYPES = ['offer_letter', 'id_proof', 'address_proof', 'tax_document', 'contract', 'certificate', 'policy', 'other'];
const DOC_STATUSES = ['active', 'expired', 'archived'];

const documentsTips = [
  { title: 'Document Categories', description: 'Organize documents by type such as contracts, ID proofs, and certificates for easy retrieval' },
  { title: 'Access Permissions', description: 'Control who can view, edit, and download sensitive employee documents' },
  { title: 'Version Control', description: 'Track document versions to maintain a history of changes and updates' },
  { title: 'Expiry Tracking', description: 'Monitor document expiry dates and get reminders for renewals' },
  { title: 'Use Templates', description: 'Leverage document templates to standardize formats across the organization' },
];

const documentsWorkflowSteps = [
  { step: 1, title: 'Upload Document', description: 'Upload the document file and enter basic details', route: '/documents' },
  { step: 2, title: 'Categorize Document', description: 'Assign the document type and category' },
  { step: 3, title: 'Set Access Permissions', description: 'Define who can view, edit, or download the document' },
  { step: 4, title: 'Track Expiry Dates', description: 'Set expiry dates for time-sensitive documents' },
  { step: 5, title: 'Renew/Update', description: 'Renew or update documents before they expire' },
  { step: 6, title: 'Archive Old Documents', description: 'Move outdated documents to archive for record keeping' },
];

const initialForm = {
  name: '',
  type: 'offer_letter',
  fileUrl: '',
  status: 'active',
  expiryDate: '',
  employeeId: '',
  description: '',
};

/* ── Component ── */
export default function DocumentsPage() {
  const { user } = useAuthStore();
  const effectiveCompanyId = useCompanyContextStore(s => s.effectiveCompanyId);
  const isAdmin = ['super_admin', 'tenant_admin', 'admin'].includes(user?.role || '');

  const [documents, setDocuments] = useState<Document[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [viewingId, setViewingId] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  /* Fetch data */
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const headers = getAuthHeaders();

      const params = new URLSearchParams({ limit: '100' });
      if (filterType) params.set('type', filterType);
      if (filterStatus) params.set('status', filterStatus);

      const [docRes, empRes] = await Promise.all([
        fetch(`/api/documents?${scopeQuery}${params.toString()}` , { headers }),
        fetch(`/api/employees?${scopeQuery}limit=500`, { headers }),
      ]);

      if (docRes.ok) {
        const data = await docRes.json();
        setDocuments(data.documents || []);
      }

      if (empRes.ok) {
        const data = await empRes.json();
        setEmployees(data.employees || []);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load documents');
    } finally {
      setLoading(false);
    }
  }, [filterType, filterStatus]);
  const cid = effectiveCompanyId();
  const scopeQuery = cid ? `companyId=${cid}&` : '';


  useEffect(() => { queueMicrotask(() => fetchData()); }, [fetchData]);

  /* Filter by search */
  const filteredDocuments = documents.filter(d => {
    if (!search) return true;
    const s = search.toLowerCase();
    return d.name.toLowerCase().includes(s);
  });

  /* View document */
  const viewingDocument = viewingId ? documents.find(d => d.id === viewingId) : null;

  /* Form handlers */
  const handleAddNew = () => {
    setForm(initialForm);
    setEditingId(null);
    setShowForm(true);
    setViewingId(null);
    setTimeout(() => document.getElementById('crud-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  const handleEdit = (doc: Document) => {
    setForm({
      name: doc.name,
      type: doc.type,
      fileUrl: doc.fileUrl || '',
      status: doc.status,
      expiryDate: doc.expiryDate ? new Date(doc.expiryDate).toISOString().split('T')[0] : '',
      employeeId: doc.employeeId || '',
      description: doc.description || '',
    });
    setEditingId(doc.id);
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
    if (!form.name || !form.type) {
      toast.error('Please fill in all required fields (Name, Type)');
      return;
    }
    if (!editingId && !form.employeeId) {
      toast.error('Please select an employee');
      return;
    }
    try {
      setSubmitting(true);
      const body: Record<string, unknown> = {
        name: form.name,
        type: form.type,
        fileUrl: form.fileUrl || null,
        status: form.status,
        expiryDate: form.expiryDate || null,
        description: form.description || null,
      };

      if (editingId) {
        const res = await fetch(`/api/documents/${editingId}?${scopeQuery}` , {
          method: 'PATCH',
          headers: getAuthHeaders(),
          body: JSON.stringify(body),
        });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed to update'); }
        toast.success('Document updated successfully');
      } else {
        const res = await fetch(`/api/documents?${scopeQuery}` , {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ ...body, employeeId: form.employeeId }),
        });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed to create'); }
        toast.success('Document uploaded successfully');
      }

      handleCancelForm();
      fetchData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save document');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      setDeleting(true);
      const res = await fetch(`/api/documents/${id}?${scopeQuery}` , {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed to delete'); }
      toast.success('Document deleted successfully');
      setDeleteConfirmId(null);
      if (viewingId === id) setViewingId(null);
      fetchData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete document');
    } finally {
      setDeleting(false);
    }
  };

  const colCount = isAdmin ? 7 : 6;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-thb-text-primary flex items-center gap-2">
            <FiFileText className="w-6 h-6 text-amber-500" />
            Documents
          </h1>
          <p className="text-thb-text-secondary mt-1">Manage employee documents and records</p>
        </div>
        <button onClick={handleAddNew} className="inline-flex items-center gap-2 px-4 py-2.5 bg-green-500 text-white rounded-lg hover:bg-green-600 font-medium text-sm shadow-sm shadow-green-500/25 transition-colors">
          <FiPlus className="w-4 h-4" />
          Upload Document
        </button>
      </div>

      <ModuleTips moduleKey="documents" title="Documents Tips" tips={documentsTips} userRole={user?.role} />
      <ModuleWorkflow moduleKey="documents" title="How to Manage Employee Documents" subtitle="Follow this workflow to manage documents throughout their lifecycle" steps={documentsWorkflowSteps} accentColor="violet" userRole={user?.role} />

      {/* Filters & Search */}
      <div className="thb-card p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-thb-text-muted" />
            <input
              type="text"
              placeholder="Search by name..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
            />
          </div>
          <div className="flex items-center gap-2">
            <FiFilter className="w-4 h-4 text-thb-text-muted" />
            <select
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
              className="px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
            >
              <option value="">All Types</option>
              {DOC_TYPES.map(t => <option key={t} value={t}>{getTypeLabel(t)}</option>)}
            </select>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
            >
              <option value="">All Statuses</option>
              {DOC_STATUSES.map(s => <option key={s} value={s}>{formatStatus(s)}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* View-Only Panel */}
      {viewingId && viewingDocument && (
        <div id="view-panel" className="thb-card border-l-4 border-l-emerald-500">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-thb-text-primary flex items-center gap-2">
                <FiFileText className="w-5 h-5 text-amber-500" />
                Document Details
              </h2>
              <div className="flex items-center gap-2">
                <button onClick={() => handleEdit(viewingDocument)} className="px-3 py-1.5 rounded-lg bg-green-500 text-white text-xs font-medium hover:bg-green-600 transition-colors flex items-center gap-1"><FiEdit2 className="w-3.5 h-3.5" />Edit</button>
                <button onClick={() => setViewingId(null)} className="p-2 rounded-lg text-thb-text-muted hover:text-thb-text-primary hover:bg-slate-100 transition-colors"><FiX className="w-5 h-5" /></button>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <span className="text-xs font-medium text-thb-text-secondary">Document Name</span>
                <p className="text-sm font-medium text-thb-text-primary mt-0.5">{viewingDocument.name}</p>
              </div>
              <div>
                <span className="text-xs font-medium text-thb-text-secondary">Type</span>
                <p className="mt-0.5"><span className={getTypeBadge(viewingDocument.type)}>{getTypeLabel(viewingDocument.type)}</span></p>
              </div>
              <div>
                <span className="text-xs font-medium text-thb-text-secondary">Employee</span>
                <p className="text-sm font-medium text-thb-text-primary mt-0.5">{viewingDocument.employee ? `${viewingDocument.employee.firstName} ${viewingDocument.employee.lastName}` : '—'}</p>
              </div>
              <div>
                <span className="text-xs font-medium text-thb-text-secondary">Status</span>
                <p className="mt-0.5"><span className={getStatusBadge(viewingDocument.status)}>{formatStatus(viewingDocument.status)}</span></p>
              </div>
              <div>
                <span className="text-xs font-medium text-thb-text-secondary">Expiry Date</span>
                <p className="text-sm font-medium text-thb-text-primary mt-0.5">{formatDate(viewingDocument.expiryDate)}</p>
              </div>
              <div>
                <span className="text-xs font-medium text-thb-text-secondary">Upload Date</span>
                <p className="text-sm font-medium text-thb-text-primary mt-0.5">{formatDate(viewingDocument.uploadedAt)}</p>
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                <span className="text-xs font-medium text-thb-text-secondary">File URL</span>
                <p className="text-sm font-medium text-thb-text-primary mt-0.5 break-all">{viewingDocument.fileUrl || '—'}</p>
              </div>
              {viewingDocument.description && (
                <div className="sm:col-span-2 lg:col-span-3">
                  <span className="text-xs font-medium text-thb-text-secondary">Description</span>
                  <p className="text-sm font-medium text-thb-text-primary mt-0.5">{viewingDocument.description}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Embedded Form */}
      {showForm && (
        <div id="crud-form" className="thb-card border-l-4 border-l-green-500">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-thb-text-primary">
                {editingId ? 'Edit Document' : 'Upload Document'}
              </h2>
              <button onClick={handleCancelForm} className="p-2 rounded-lg text-thb-text-muted hover:text-thb-text-primary hover:bg-slate-100 transition-colors">
                <FiX className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Document Name *</label>
                <input type="text" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" placeholder="Document name" />
              </div>
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Type *</label>
                <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400">
                  {DOC_TYPES.map(t => <option key={t} value={t}>{getTypeLabel(t)}</option>)}
                </select>
              </div>
              {!editingId && (
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Employee *</label>
                  <select value={form.employeeId} onChange={e => setForm(p => ({ ...p, employeeId: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400">
                    <option value="">Select Employee</option>
                    {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">File URL</label>
                <input type="text" value={form.fileUrl} onChange={e => setForm(p => ({ ...p, fileUrl: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" placeholder="https://..." />
              </div>
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Status</label>
                <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400">
                  {DOC_STATUSES.map(s => <option key={s} value={s}>{formatStatus(s)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Expiry Date</label>
                <input type="date" value={form.expiryDate} onChange={e => setForm(p => ({ ...p, expiryDate: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" />
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Description</label>
                <textarea rows={2} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 resize-none" placeholder="Document description..." />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-thb-border">
              <button onClick={handleCancelForm} className="px-4 py-2.5 rounded-lg border border-thb-border text-sm font-medium text-thb-text-secondary hover:bg-slate-50 transition-colors">Cancel</button>
              <button onClick={handleSubmit} disabled={submitting} className="px-6 py-2.5 rounded-lg bg-green-500 text-white text-sm font-medium hover:bg-green-600 disabled:opacity-50 shadow-sm shadow-green-500/25 transition-colors">
                {submitting ? 'Saving...' : editingId ? 'Update' : 'Upload'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Documents Table */}
      <div className="thb-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-thb-border bg-slate-50/50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Name</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Type</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Employee</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Expiry Date</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Uploaded</th>
                {isAdmin && (
                  <th className="text-right px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Actions</th>
                )}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-thb-border/50 animate-pulse">
                    <td className="px-4 py-3"><div className="h-3 w-32 bg-slate-200 rounded" /></td>
                    <td className="px-4 py-3"><div className="h-5 w-20 bg-slate-200 rounded-full" /></td>
                    <td className="px-4 py-3"><div className="h-3 w-24 bg-slate-200 rounded" /></td>
                    <td className="px-4 py-3"><div className="h-5 w-16 bg-slate-200 rounded-full" /></td>
                    <td className="px-4 py-3"><div className="h-3 w-20 bg-slate-200 rounded" /></td>
                    <td className="px-4 py-3"><div className="h-3 w-20 bg-slate-200 rounded" /></td>
                    {isAdmin && <td className="px-4 py-3"><div className="h-3 w-16 bg-slate-200 rounded ml-auto" /></td>}
                  </tr>
                ))
              ) : filteredDocuments.length === 0 ? (
                <tr>
                  <td colSpan={colCount} className="px-4 py-12 text-center">
                    <FiFileText className="w-10 h-10 text-thb-text-muted mx-auto mb-3" />
                    <p className="text-thb-text-secondary font-medium">No documents found</p>
                    <p className="text-sm text-thb-text-muted mt-1">
                      {search || filterType || filterStatus ? 'Try adjusting your filters' : 'Upload your first document to get started'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredDocuments.map(doc => (
                  <tr key={doc.id} className="border-b border-thb-border/50 hover:bg-slate-50/50 transition-colors">
                    {deleteConfirmId === doc.id ? (
                      <td colSpan={colCount} className="px-4 py-3 bg-red-50">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-red-700 font-medium">Are you sure you want to delete &quot;{doc.name}&quot;?</span>
                          <div className="flex items-center gap-2">
                            <button onClick={() => handleDelete(doc.id)} disabled={deleting} className="px-3 py-1.5 bg-red-500 text-white text-xs font-medium rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors">
                              {deleting ? 'Deleting...' : 'Confirm'}
                            </button>
                            <button onClick={() => setDeleteConfirmId(null)} className="px-3 py-1.5 border border-thb-border text-xs font-medium rounded-lg hover:bg-slate-50 transition-colors">
                              Cancel
                            </button>
                          </div>
                        </div>
                      </td>
                    ) : (
                      <>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <FiFileText className="w-4 h-4 text-thb-text-muted flex-shrink-0" />
                            <span className="text-sm font-medium text-thb-text-primary">{doc.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3"><span className={getTypeBadge(doc.type)}>{getTypeLabel(doc.type)}</span></td>
                        <td className="px-4 py-3 text-sm text-thb-text-secondary">
                          {doc.employee ? `${doc.employee.firstName} ${doc.employee.lastName}` : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={getStatusBadge(doc.status)}>{formatStatus(doc.status)}</span>
                        </td>
                        <td className="px-4 py-3 text-sm text-thb-text-secondary">{formatDate(doc.expiryDate)}</td>
                        <td className="px-4 py-3 text-sm text-thb-text-secondary">{formatDate(doc.uploadedAt)}</td>
                        {isAdmin && (
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              <button onClick={() => { setViewingId(doc.id); setShowForm(false); setTimeout(() => document.getElementById('view-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100); }} className="p-2 rounded-lg text-thb-text-muted hover:text-emerald-500 hover:bg-emerald-50 transition-colors" title="View"><FiEye className="w-4 h-4" /></button>
                              <button onClick={() => handleEdit(doc)} className="p-2 rounded-lg text-thb-text-muted hover:text-green-500 hover:bg-green-50 transition-colors" title="Edit">
                                <FiEdit2 className="w-4 h-4" />
                              </button>
                              <button onClick={() => setDeleteConfirmId(doc.id)} className="p-2 rounded-lg text-thb-text-muted hover:text-red-500 hover:bg-red-50 transition-colors" title="Delete">
                                <FiTrash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        )}
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
