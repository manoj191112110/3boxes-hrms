'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import {
  FiPlus, FiX, FiSearch, FiGlobe, FiMail,
  FiMapPin, FiBriefcase, FiEye, FiEdit2, FiTrash2,
  FiPhone, FiDollarSign, FiCalendar,
  FiGrid, FiFileText, FiBarChart2,
} from 'react-icons/fi';
import ModuleDashboardShell, { DashboardTabConfig } from '@/components/ModuleDashboardShell';
import toast from 'react-hot-toast';
import { validateEmail, validatePhone, phoneInputFilter } from '@/lib/validators';
import { useAuthStore } from '@/store/authStore';
import ModuleTips from '@/components/ModuleTips';
import ModuleWorkflow from '@/components/ModuleWorkflow';
import SeedEcosystemButton from '@/components/SeedEcosystemButton';
import { useAutoSeedDemo } from '@/hooks/useAutoSeedDemo';

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

function getStatusBadge(status: string) {
  const map: Record<string, string> = {
    active: 'thb-badge thb-badge-success',
    inactive: 'thb-badge bg-slate-100 text-slate-600',
    pending: 'thb-badge thb-badge-warning',
  };
  return map[status] || 'thb-badge thb-badge-info';
}

const emptyForm = {
  name: '', code: '', industry: '', contactName: '', contactEmail: '', contactPhone: '', address: '', city: '', state: '', country: '', zipCode: '', billingCurrency: 'INR', paymentTerms: 'net_30',
};

interface Client {
  id: string; name: string; code: string | null; industry: string | null; contactName: string | null; contactEmail: string | null; contactPhone: string | null; address: string | null; city: string | null; state: string | null; country: string | null; zipCode: string | null; billingCurrency: string; paymentTerms: string; status: string;
  projects?: { id: string }[];
  _count?: { projects: number };
}

/* ── Placeholder Tabs ── */

const externalTabs: DashboardTabConfig[] = [
  { label: 'Overview', key: 'overview', icon: <FiGrid className="w-4 h-4" /> },
  { label: 'Reports', key: 'reports', icon: <FiFileText className="w-4 h-4" />, isNew: true },
];

function ExternalReportsPlaceholder() {
  return (
    <div className="flex flex-col items-center py-8">
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg mb-4">
        <FiFileText className="w-7 h-7 text-white" />
      </div>
      <h3 className="text-lg font-bold text-thb-text-primary mb-1">Reports & Analytics</h3>
      <p className="text-sm text-thb-text-secondary text-center max-w-md mb-4">
        Client engagement reports, billing summaries, and relationship analytics
      </p>
      <a href="/clients/reports" className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors">
        <FiBarChart2 className="w-4 h-4" /> Go to Reports
      </a>
    </div>
  );
}

function ClientsPageContent() {
  return (
    <ModuleDashboardShell
      moduleKey="external"
      moduleLabel="External Relations"
      moduleIcon={<FiGlobe className="w-5 h-5 text-white" />}
      gradientColor="from-teal-500 to-teal-600"
      tabs={externalTabs}
      overviewContent={<ClientsContent />}
      children={{
        reports: <ExternalReportsPlaceholder />,
      }}
    />
  );
}

export default function ClientsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-20"><div className="animate-spin w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full" /></div>}>
      <ClientsPageContent />
    </Suspense>
  );
}

/* ── Module Tips & Workflow Data ── */
const clientTips = [
  { title: 'Streamline Client Onboarding', description: 'Create a consistent onboarding process with standardized forms, required documents, and welcome kits to ensure no steps are missed.' },
  { title: 'Centralize Contact Management', description: 'Maintain a complete contact directory with roles, emails, and phone numbers. Link contacts to projects for quick access.' },
  { title: 'Link Projects to Clients', description: 'Associate every project with its client to track engagement history, billing, and deliverables in one place.' },
  { title: 'Setup Billing Early', description: 'Configure billing currency, payment terms, and invoicing preferences during onboarding to avoid payment delays.' },
  { title: 'Maintain Communication Logs', description: 'Record all client interactions including meetings, emails, and calls to maintain context and improve service quality.' },
];

const clientWorkflowSteps = [
  { step: 1, title: 'Add Client', description: 'Register client with name, industry, and contact details' },
  { step: 2, title: 'Add Contacts', description: 'Create key contact records with roles and communication info' },
  { step: 3, title: 'Link Projects', description: 'Associate existing or new projects with the client' },
  { step: 4, title: 'Setup Billing', description: 'Configure currency, payment terms, and invoicing' },
  { step: 5, title: 'Track Communications', description: 'Log meetings, calls, and email interactions' },
  { step: 6, title: 'Review Performance', description: 'Assess engagement health and client satisfaction' },
  { step: 7, title: 'Renew or Close', description: 'Renew engagement terms or formally close the relationship' },
];

function ClientsContent() {
  const { user } = useAuthStore();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [form, setForm] = useState({ ...emptyForm });

  const fetchClients = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/clients', { headers: getAuthHeaders() });
      if (res.ok) { const data = await res.json(); setClients(Array.isArray(data) ? data : data.clients || []); }
    } catch { toast.error('Failed to load clients'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchClients(); }, [fetchClients]);

  // Auto-seed client demo data on first load, then re-fetch
  const { seeded: clientsSeeded } = useAutoSeedDemo('clients', () => { fetchClients(); });
  useEffect(() => {
    if (clientsSeeded) fetchClients();
  }, [clientsSeeded, fetchClients]);

  const handleAddNew = () => {
    setEditingId(null);
    setForm({ ...emptyForm });
    setViewingId(null);
    setShowForm(true);
    setTimeout(() => document.getElementById('crud-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  const handleEdit = (client: Client) => {
    setEditingId(client.id);
    setForm({
      name: client.name || '',
      code: client.code || '',
      industry: client.industry || '',
      contactName: client.contactName || '',
      contactEmail: client.contactEmail || '',
      contactPhone: client.contactPhone || '',
      address: client.address || '',
      city: client.city || '',
      state: client.state || '',
      country: client.country || '',
      zipCode: client.zipCode || '',
      billingCurrency: client.billingCurrency || 'INR',
      paymentTerms: client.paymentTerms || 'net_30',
    });
    setViewingId(null);
    setShowForm(true);
    setTimeout(() => document.getElementById('crud-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm({ ...emptyForm });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) { toast.error('Name is required'); return; }
    if (form.contactEmail) { const r = validateEmail(form.contactEmail); if (!r.valid) { toast.error(r.error); return } }
    if (form.contactPhone) { const r = validatePhone(form.contactPhone); if (!r.valid) { toast.error(r.error); return } }
    setSubmitting(true);
    try {
      if (editingId) {
        const res = await fetch(`/api/clients/${editingId}`, { method: 'PUT', headers: getAuthHeaders(), body: JSON.stringify(form) });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed'); }
        toast.success('Client updated');
      } else {
        const res = await fetch('/api/clients', { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(form) });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed'); }
        toast.success('Client added');
      }
      handleCancelForm();
      fetchClients();
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Failed'); }
    finally { setSubmitting(false); }
  };

  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/clients/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed'); }
      toast.success('Client deactivated');
      setDeleteConfirmId(null);
      if (viewingId === id) setViewingId(null);
      fetchClients();
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Failed'); }
    finally { setDeleting(false); }
  };

  const filtered = clients.filter((c) => c.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div><h1 className="text-2xl font-bold text-thb-text-primary">Clients</h1><p className="text-thb-text-secondary mt-1">Manage client relationships and details</p></div>
        <div className="flex flex-wrap items-center gap-3">
          <SeedEcosystemButton module="clients" label="Seed Sample Clients" compact />
          <button onClick={handleAddNew} className="inline-flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium text-sm"><FiPlus className="w-4 h-4" /> Add Client</button>
        </div>
      </div>

      <ModuleTips moduleKey="clients" title="Client Tips" tips={clientTips} userRole={user?.role} />
      <ModuleWorkflow moduleKey="clients" title="How to Manage Client Relationships" subtitle="Follow this workflow to build strong client partnerships" steps={clientWorkflowSteps} accentColor="violet" userRole={user?.role} />

      <div className="relative max-w-sm">
        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-thb-text-muted" />
        <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search clients..." className="w-full pl-9 pr-4 py-2.5 border border-thb-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500" />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{Array.from({ length: 6 }).map((_, i) => (<div key={i} className="thb-card p-5 animate-pulse"><div className="h-5 w-3/4 bg-slate-200 rounded mb-3" /><div className="h-3 w-1/2 bg-slate-100 rounded" /></div>))}</div>
      ) : filtered.length === 0 ? (
        <div className="thb-card p-12 text-center"><FiBriefcase className="w-12 h-12 text-thb-text-muted mx-auto mb-3" /><p className="text-thb-text-secondary">No clients found</p></div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((c) => (
            <div key={c.id} className="thb-card overflow-hidden">
              {deleteConfirmId === c.id ? (
                <div className="p-5 bg-red-50">
                  <p className="text-sm text-red-700 font-medium mb-3">Are you sure you want to delete &quot;{c.name}&quot;?</p>
                  <div className="flex items-center gap-2">
                    <button onClick={() => handleDelete(c.id)} disabled={deleting} className="px-3 py-1.5 bg-red-500 text-white text-xs font-medium rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors">{deleting ? 'Deleting...' : 'Confirm'}</button>
                    <button onClick={() => setDeleteConfirmId(null)} className="px-3 py-1.5 border border-thb-border text-xs font-medium rounded-lg hover:bg-slate-50 transition-colors">Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-teal-400 to-cyan-500 flex items-center justify-center text-white font-bold text-sm">{c.name[0]}</div>
                    <span className={getStatusBadge(c.status)}>{c.status}</span>
                  </div>
                  <h3 className="font-semibold text-thb-text-primary">{c.name}</h3>
                  <p className="text-xs text-thb-text-muted mt-0.5">{c.code || 'No code'}</p>
                  <div className="mt-3 space-y-1.5 text-sm text-thb-text-secondary">
                    {c.industry && <div className="flex items-center gap-2"><FiGlobe className="w-3.5 h-3.5 text-thb-text-muted" />{c.industry}</div>}
                    {c.contactName && <div className="flex items-center gap-2"><FiMail className="w-3.5 h-3.5 text-thb-text-muted" />{c.contactName}</div>}
                    {c.country && <div className="flex items-center gap-2"><FiMapPin className="w-3.5 h-3.5 text-thb-text-muted" />{c.country}</div>}
                  </div>
                  <div className="mt-3 pt-3 border-t border-thb-border flex items-center justify-between">
                    <button onClick={() => { setViewingId(c.id); setShowForm(false); setTimeout(() => document.getElementById('view-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100); }} className="text-xs font-medium text-emerald-500 hover:text-emerald-600 flex items-center gap-1"><FiEye className="w-3.5 h-3.5" />View</button>
                    <div className="flex items-center gap-1">
                      <button onClick={() => handleEdit(c)} className="p-1.5 rounded-lg text-thb-text-muted hover:text-green-500 hover:bg-green-50 transition-colors" title="Edit"><FiEdit2 className="w-3.5 h-3.5" /></button>
                      <button onClick={() => setDeleteConfirmId(c.id)} className="p-1.5 rounded-lg text-thb-text-muted hover:text-red-500 hover:bg-red-50 transition-colors" title="Delete"><FiTrash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* View-Only Panel */}
      {viewingId && (() => {
        const client = clients.find(c => c.id === viewingId);
        if (!client) return null;
        return (
          <div id="view-panel" className="thb-card border-l-4 border-l-emerald-500">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-thb-text-primary">Client Details</h2>
                <div className="flex items-center gap-2">
                  <button onClick={() => handleEdit(client)} className="px-3 py-1.5 rounded-lg bg-green-500 text-white text-xs font-medium hover:bg-green-600 transition-colors flex items-center gap-1"><FiEdit2 className="w-3.5 h-3.5" />Edit</button>
                  <button onClick={() => setViewingId(null)} className="p-2 rounded-lg text-thb-text-muted hover:text-thb-text-primary hover:bg-slate-100 transition-colors"><FiX className="w-5 h-5" /></button>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div><span className="text-xs font-medium text-thb-text-secondary">Name</span><p className="text-sm font-medium text-thb-text-primary mt-0.5">{client.name}</p></div>
                <div><span className="text-xs font-medium text-thb-text-secondary">Code</span><p className="text-sm font-medium text-thb-text-primary mt-0.5">{client.code || '—'}</p></div>
                <div><span className="text-xs font-medium text-thb-text-secondary">Industry</span><p className="text-sm font-medium text-thb-text-primary mt-0.5">{client.industry || '—'}</p></div>
                <div><span className="text-xs font-medium text-thb-text-secondary">Status</span><p className="mt-0.5"><span className={getStatusBadge(client.status)}>{client.status}</span></p></div>
                <div><span className="text-xs font-medium text-thb-text-secondary">Projects</span><p className="text-sm font-medium text-thb-text-primary mt-0.5">{client._count?.projects ?? client.projects?.length ?? 0}</p></div>
                <div className="border-t border-thb-border sm:border-t-0 pt-4 sm:pt-0"><span className="text-xs font-medium text-thb-text-secondary">Contact Name</span><p className="text-sm font-medium text-thb-text-primary mt-0.5 flex items-center gap-1.5"><FiMail className="w-3.5 h-3.5 text-thb-text-muted" />{client.contactName || '—'}</p></div>
                <div><span className="text-xs font-medium text-thb-text-secondary">Contact Email</span><p className="text-sm font-medium text-thb-text-primary mt-0.5 flex items-center gap-1.5"><FiMail className="w-3.5 h-3.5 text-thb-text-muted" />{client.contactEmail || '—'}</p></div>
                <div><span className="text-xs font-medium text-thb-text-secondary">Contact Phone</span><p className="text-sm font-medium text-thb-text-primary mt-0.5 flex items-center gap-1.5"><FiPhone className="w-3.5 h-3.5 text-thb-text-muted" />{client.contactPhone || '—'}</p></div>
                <div><span className="text-xs font-medium text-thb-text-secondary">Address</span><p className="text-sm font-medium text-thb-text-primary mt-0.5 flex items-center gap-1.5"><FiMapPin className="w-3.5 h-3.5 text-thb-text-muted shrink-0" />{[client.address, client.city, client.state, client.zipCode].filter(Boolean).join(', ') || '—'}</p></div>
                <div><span className="text-xs font-medium text-thb-text-secondary">Country</span><p className="text-sm font-medium text-thb-text-primary mt-0.5 flex items-center gap-1.5"><FiGlobe className="w-3.5 h-3.5 text-thb-text-muted" />{client.country || '—'}</p></div>
                <div><span className="text-xs font-medium text-thb-text-secondary">Billing Currency</span><p className="text-sm font-medium text-thb-text-primary mt-0.5 flex items-center gap-1.5"><FiDollarSign className="w-3.5 h-3.5 text-thb-text-muted" />{client.billingCurrency || '—'}</p></div>
                <div><span className="text-xs font-medium text-thb-text-secondary">Payment Terms</span><p className="text-sm font-medium text-thb-text-primary mt-0.5 flex items-center gap-1.5"><FiCalendar className="w-3.5 h-3.5 text-thb-text-muted" />{client.paymentTerms ? client.paymentTerms.replace('net_', 'Net ').replace('_', ' ') : '—'}</p></div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* CRUD Form */}
      {showForm && (
        <div id="crud-form" className="thb-card border-l-4 border-l-green-500">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-thb-text-primary">
                {editingId ? 'Edit Client' : 'Add New Client'}
              </h2>
              <button onClick={handleCancelForm} className="p-2 rounded-lg text-thb-text-muted hover:text-thb-text-primary hover:bg-slate-100 transition-colors"><FiX className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-thb-text-secondary mb-1">Name <span className="text-red-500 font-bold">*</span></label><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 border border-thb-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500" /></div>
                <div><label className="block text-sm font-medium text-thb-text-secondary mb-1">Code</label><input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className="w-full px-3 py-2 border border-thb-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500" /></div>
              </div>
              <div><label className="block text-sm font-medium text-thb-text-secondary mb-1">Industry</label><input value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} className="w-full px-3 py-2 border border-thb-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500" /></div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div><label className="block text-sm font-medium text-thb-text-secondary mb-1">Contact Name</label><input value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} className="w-full px-3 py-2 border border-thb-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500" /></div>
                <div><label className="block text-sm font-medium text-thb-text-secondary mb-1">Email</label><input type="email" placeholder="e.g., name@domain.com" value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} className="w-full px-3 py-2 border border-thb-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500" /></div>
                <div><label className="block text-sm font-medium text-thb-text-secondary mb-1">Phone</label><input type="tel" placeholder="10-digit Indian mobile" value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: phoneInputFilter(e.target.value) })} className="w-full px-3 py-2 border border-thb-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500" /></div>
              </div>
              <div><label className="block text-sm font-medium text-thb-text-secondary mb-1">Address</label><input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="w-full px-3 py-2 border border-thb-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500" /></div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div><label className="block text-sm font-medium text-thb-text-secondary mb-1">City</label><input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="w-full px-3 py-2 border border-thb-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500" /></div>
                <div><label className="block text-sm font-medium text-thb-text-secondary mb-1">State</label><input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} className="w-full px-3 py-2 border border-thb-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500" /></div>
                <div><label className="block text-sm font-medium text-thb-text-secondary mb-1">Country</label><input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} className="w-full px-3 py-2 border border-thb-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500" /></div>
                <div><label className="block text-sm font-medium text-thb-text-secondary mb-1">ZIP</label><input value={form.zipCode} onChange={(e) => setForm({ ...form, zipCode: e.target.value })} className="w-full px-3 py-2 border border-thb-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500" /></div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-thb-text-secondary mb-1">Currency</label><select value={form.billingCurrency} onChange={(e) => setForm({ ...form, billingCurrency: e.target.value })} className="w-full px-3 py-2 border border-thb-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500"><option value="INR">INR</option><option value="USD">USD</option><option value="EUR">EUR</option><option value="GBP">GBP</option></select></div>
                <div><label className="block text-sm font-medium text-thb-text-secondary mb-1">Payment Terms</label><select value={form.paymentTerms} onChange={(e) => setForm({ ...form, paymentTerms: e.target.value })} className="w-full px-3 py-2 border border-thb-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500"><option value="net_15">Net 15</option><option value="net_30">Net 30</option><option value="net_45">Net 45</option><option value="net_60">Net 60</option><option value="immediate">Immediate</option></select></div>
              </div>
              <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-thb-border">
                <button type="button" onClick={handleCancelForm} className="px-4 py-2.5 rounded-lg border border-thb-border text-sm font-medium text-thb-text-secondary hover:bg-slate-50 transition-colors">Cancel</button>
                <button type="submit" disabled={submitting} className="px-6 py-2.5 rounded-lg bg-green-500 text-white text-sm font-medium hover:bg-green-600 disabled:opacity-50 shadow-sm shadow-green-500/25 transition-colors">{submitting ? 'Saving...' : editingId ? 'Update' : 'Add Client'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
