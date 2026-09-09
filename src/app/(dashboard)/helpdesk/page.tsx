'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import {
  FiPlus, FiX, FiMessageSquare, FiUser, FiClock,
  FiCheck, FiAlertCircle, FiArrowRight, FiSend,
  FiEye, FiEdit2, FiTrash2,
  FiGrid, FiFileText, FiHelpCircle, FiBarChart2,
} from 'react-icons/fi';
import ModuleDashboardShell, { DashboardTabConfig } from '@/components/ModuleDashboardShell';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import { useCompanyContextStore } from '@/store/companyContextStore';

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

// Category can be a string (e.g. "hr") or an object from the API ({ id, name, type, slaHours })
interface TicketCategory {
  id?: string;
  name?: string;
  type?: string;
  slaHours?: number;
}

interface Ticket {
  id: string;
  ticketId: string;
  subject: string;
  description: string;
  priority: string;
  status: string;
  requesterName: string;
  requesterType: string;
  category: string | TicketCategory | null;
  assignedAgentName: string | null;
  createdAt: string;
  comments: TicketComment[];
}

interface TicketComment { id: string; authorName: string; content: string; isInternal: boolean; createdAt: string; }

// Helper: extract a display string from the category field (which can be string or object)
function getCategoryLabel(cat: string | TicketCategory | null | undefined): string {
  if (!cat) return '';
  if (typeof cat === 'string') return cat;
  if (typeof cat === 'object' && cat !== null) {
    return cat.name || cat.type || '';
  }
  return '';
}

const priorityConfig: Record<string, { bg: string; text: string }> = {
  low: { bg: 'bg-green-100', text: 'text-green-700' },
  medium: { bg: 'bg-amber-100', text: 'text-amber-700' },
  high: { bg: 'bg-orange-100', text: 'text-orange-700' },
  critical: { bg: 'bg-red-100', text: 'text-red-700' },
};

const statusConfig: Record<string, { bg: string; text: string }> = {
  open: { bg: 'bg-green-100', text: 'text-green-700' },
  in_progress: { bg: 'bg-amber-100', text: 'text-amber-700' },
  resolved: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  closed: { bg: 'bg-slate-100', text: 'text-slate-600' },
};

const helpdeskTips = [
  { title: 'Categorize Tickets', description: 'Use ticket categories to organize and prioritize support requests efficiently' },
  { title: 'Track SLAs', description: 'Monitor service level agreements to ensure timely resolution of support tickets' },
  { title: 'Set Priority Levels', description: 'Assign appropriate priority levels to ensure critical issues are addressed first' },
  { title: 'Use Knowledge Base', description: 'Reference the knowledge base for common solutions before escalating tickets' },
  { title: 'Escalation Path', description: 'Follow the escalation path for unresolved tickets to get timely management attention' },
];

const helpdeskWorkflowSteps = [
  { step: 1, title: 'Submit Ticket', description: 'Employee submits a support request with details', route: '/helpdesk' },
  { step: 2, title: 'Categorize & Prioritize', description: 'Assign category and priority level to the ticket' },
  { step: 3, title: 'Assign Agent', description: 'Route the ticket to the appropriate support agent' },
  { step: 4, title: 'Investigate & Diagnose', description: 'Agent investigates the issue and identifies root cause' },
  { step: 5, title: 'Implement Solution', description: 'Apply the fix or provide the resolution' },
  { step: 6, title: 'Communicate Resolution', description: 'Inform the requester about the solution applied' },
  { step: 7, title: 'Close Ticket', description: 'Mark the ticket as resolved and close it' },
  { step: 8, title: 'Collect Feedback', description: 'Gather feedback from the requester on the support experience' },
];

/* ── Placeholder Tabs ── */

const supportTabs: DashboardTabConfig[] = [
  { label: 'Overview', key: 'overview', icon: <FiGrid className="w-4 h-4" /> },
  { label: 'Reports', key: 'reports', icon: <FiFileText className="w-4 h-4" />, isNew: true },
];

function SupportReportsPlaceholder() {
  return (
    <div className="flex flex-col items-center py-8">
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg mb-4">
        <FiFileText className="w-7 h-7 text-white" />
      </div>
      <h3 className="text-lg font-bold text-thb-text-primary mb-1">Reports & Analytics</h3>
      <p className="text-sm text-thb-text-secondary text-center max-w-md mb-4">
        Ticket analytics, SLA compliance, agent performance, and resolution reports
      </p>
      <a href="/helpdesk/reports" className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors">
        <FiBarChart2 className="w-4 h-4" /> Go to Reports
      </a>
    </div>
  );
}

function HelpdeskPageContent() {
  return (
    <ModuleDashboardShell
      moduleKey="support"
      moduleLabel="Support & AI"
      moduleIcon={<FiHelpCircle className="w-5 h-5 text-white" />}
      gradientColor="from-yellow-500 to-orange-600"
      tabs={supportTabs}
      overviewContent={<HelpdeskContent />}
      children={{
        reports: <SupportReportsPlaceholder />,
      }}
    />
  );
}

export default function HelpdeskPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-20"><div className="animate-spin w-8 h-8 border-2 border-yellow-500 border-t-transparent rounded-full" /></div>}>
      <HelpdeskPageContent />
    </Suspense>
  );
}

const initialForm = { subject: '', description: '', category: 'hr', priority: 'medium', requesterType: 'employee' };

function HelpdeskContent() {
  const { user } = useAuthStore();
  const effectiveCompanyId = useCompanyContextStore(s => s.effectiveCompanyId);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'my' | 'all'>('my');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [viewingTicket, setViewingTicket] = useState<Ticket | null>(null);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(initialForm);

  const fetchTickets = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/tickets?${scopeQuery}` , { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        const ticketList = Array.isArray(data) ? data : (data.tickets || []);
        // Sanitize tickets to prevent render errors
        const safeTickets = ticketList.map((t: Record<string, unknown>) => ({
          id: t.id || '',
          ticketId: t.ticketId || '',
          subject: t.subject || 'No Subject',
          description: t.description || '',
          priority: t.priority || 'medium',
          status: t.status || 'open',
          requesterName: t.requesterName || 'Unknown',
          requesterType: t.requesterType || 'employee',
          category: t.category || null,
          assignedAgentName: t.assignedAgentName || null,
          createdAt: t.createdAt || new Date().toISOString(),
          comments: Array.isArray(t.comments) ? t.comments : [],
        }));
        setTickets(safeTickets);
      } else {
        const errData = await res.json().catch(() => ({}));
        console.error('Tickets API error:', res.status, errData);
        setError('Failed to load tickets. Please try again.');
      }
    } catch (err) {
      console.error('Fetch tickets error:', err);
      setError('Network error. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, []);
  const cid = effectiveCompanyId();
  const scopeQuery = cid ? `companyId=${cid}&` : '';


  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  const fetchViewingTicket = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/tickets/${id}?${scopeQuery}` , { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        const ticket = data.ticket || data;
        // Sanitize to prevent render errors
        setViewingTicket({
          ...ticket,
          id: ticket.id || '',
          ticketId: ticket.ticketId || '',
          subject: ticket.subject || 'No Subject',
          description: ticket.description || '',
          priority: ticket.priority || 'medium',
          status: ticket.status || 'open',
          requesterName: ticket.requesterName || 'Unknown',
          requesterType: ticket.requesterType || 'employee',
          category: ticket.category || null,
          assignedAgentName: ticket.assignedAgentName || null,
          createdAt: ticket.createdAt || new Date().toISOString(),
          comments: Array.isArray(ticket.comments) ? ticket.comments : [],
        });
      }
    } catch { toast.error('Failed to load ticket details'); }
  }, []);

  const handleView = useCallback(async (id: string) => {
    setViewingTicket(null);
    setViewingId(id);
    setShowForm(false);
    await fetchViewingTicket(id);
    setTimeout(() => document.getElementById('view-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  }, [fetchViewingTicket]);

  const handleAddNew = () => {
    setForm(initialForm);
    setEditingId(null);
    setShowForm(true);
    setViewingId(null);
    setTimeout(() => document.getElementById('crud-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  const handleEdit = (ticket: Ticket) => {
    setForm({
      subject: ticket.subject || '',
      description: ticket.description || '',
      category: getCategoryLabel(ticket.category) || 'hr',
      priority: ticket.priority || 'medium',
      requesterType: ticket.requesterType || 'employee',
    });
    setEditingId(ticket.id);
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
    if (!form.subject || !form.description) { toast.error('Subject and description are required'); return; }
    setSubmitting(true);
    try {
      if (editingId) {
        const res = await fetch(`/api/tickets/${editingId}?${scopeQuery}` , {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify({ subject: form.subject, description: form.description, priority: form.priority }),
        });
        if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Failed to update'); }
        toast.success('Ticket updated successfully');
      } else {
        const res = await fetch(`/api/tickets?${scopeQuery}` , {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            subject: form.subject,
            description: form.description,
            priority: form.priority,
            requesterType: form.requesterType,
            requesterId: user?.id,
            requesterName: user?.name,
          }),
        });
        if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Failed to create'); }
        toast.success('Ticket created successfully');
      }
      handleCancelForm();
      fetchTickets();
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Failed'); }
    finally { setSubmitting(false); }
  };

  const handleDelete = async (id: string) => {
    try {
      setDeleting(true);
      const res = await fetch(`/api/tickets/${id}?${scopeQuery}` , { method: 'DELETE', headers: getAuthHeaders() });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Failed'); }
      toast.success('Ticket deleted successfully');
      setDeleteConfirmId(null);
      if (viewingId === id) setViewingId(null);
      fetchTickets();
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Failed to delete'); }
    finally { setDeleting(false); }
  };

  const handleAddComment = async () => {
    if (!comment.trim() || !viewingId) return;
    try {
      const res = await fetch(`/api/tickets/${viewingId}/comments?${scopeQuery}` , {
        method: 'POST', headers: getAuthHeaders(),
        body: JSON.stringify({ authorId: user?.id, authorName: user?.name, content: comment }),
      });
      if (!res.ok) throw new Error('Failed');
      setComment('');
      fetchViewingTicket(viewingId);
    } catch { toast.error('Failed to add comment'); }
  };

  const handleTicketAction = async (action: string) => {
    if (!viewingId) return;
    try {
      const res = await fetch(`/api/tickets/${viewingId}?${scopeQuery}` , {
        method: 'PATCH', headers: getAuthHeaders(),
        body: JSON.stringify({ status: action }),
      });
      if (!res.ok) throw new Error('Failed');
      toast.success(`Ticket ${action.replace('_', ' ')}`);
      fetchTickets();
      fetchViewingTicket(viewingId);
    } catch { toast.error('Action failed'); }
  };

  // Safely compare requester: use requesterId if available, fall back to name match
  const isAdmin = user?.role === 'super_admin' || user?.role === 'tenant_admin' || user?.role === 'admin';
  const myTickets = tickets.filter((t) => {
    const ticketAny = t as Record<string, unknown>;
    if (ticketAny.requesterId && user?.id) return ticketAny.requesterId === user.id;
    return t.requesterName === user?.name;
  });
  const displayTickets = (activeTab === 'my' && !isAdmin) ? myTickets : tickets;

  // Safely get status display text
  const getStatusText = (status: string | null | undefined): string => {
    if (!status) return 'unknown';
    return String(status).replace('_', ' ');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-thb-text-primary">Helpdesk</h1>
          <p className="text-thb-text-secondary mt-1">Manage support tickets and requests</p>
        </div>
        <button onClick={handleAddNew} className="inline-flex items-center gap-2 px-4 py-2.5 bg-green-500 text-white rounded-lg hover:bg-green-600 font-medium text-sm shadow-sm shadow-green-500/25 transition-colors">
          <FiPlus className="w-4 h-4" /> Create Ticket
        </button>
      </div>

      {/* Error State */}
      {error && (
        <div className="thb-card p-6 text-center border-l-4 border-l-red-400">
          <FiAlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
          <p className="text-thb-text-secondary mb-3">{error}</p>
          <button onClick={fetchTickets} className="px-4 py-2 bg-green-500 text-white rounded-lg text-sm hover:bg-green-600 transition-colors">
            Retry
          </button>
        </div>
      )}

      <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit">
        {(['my', 'all'] as const).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-2 rounded-md text-sm font-medium capitalize transition-colors ${activeTab === tab ? 'bg-white shadow-sm text-thb-text-primary' : 'text-thb-text-muted hover:text-thb-text-primary'}`}>
            {tab === 'my' ? 'My Tickets' : 'All Tickets'}
          </button>
        ))}
      </div>

      {/* View Panel */}
      {viewingId && viewingTicket && (
        <div id="view-panel" className="thb-card border-l-4 border-l-emerald-500">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold text-thb-text-primary">{viewingTicket.subject}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${priorityConfig[viewingTicket.priority]?.bg || 'bg-slate-100'} ${priorityConfig[viewingTicket.priority]?.text || 'text-slate-600'}`}>{viewingTicket.priority || 'medium'}</span>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusConfig[viewingTicket.status]?.bg || 'bg-slate-100'} ${statusConfig[viewingTicket.status]?.text || 'text-slate-600'}`}>{getStatusText(viewingTicket.status)}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => handleEdit(viewingTicket)} className="px-3 py-1.5 rounded-lg bg-green-500 text-white text-xs font-medium hover:bg-green-600 transition-colors flex items-center gap-1"><FiEdit2 className="w-3.5 h-3.5" />Edit</button>
                <button onClick={() => setViewingId(null)} className="p-2 rounded-lg text-thb-text-muted hover:text-thb-text-primary hover:bg-slate-100 transition-colors"><FiX className="w-5 h-5" /></button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              <div>
                <span className="text-xs font-medium text-thb-text-secondary">Ticket ID</span>
                <p className="text-sm font-medium text-thb-text-primary mt-0.5 font-mono">{viewingTicket.ticketId?.slice(0, 8) || '—'}</p>
              </div>
              <div>
                <span className="text-xs font-medium text-thb-text-secondary">Requester</span>
                <p className="text-sm font-medium text-thb-text-primary mt-0.5 flex items-center gap-1"><FiUser className="w-3.5 h-3.5" />{viewingTicket.requesterName || 'Unknown'}</p>
              </div>
              <div>
                <span className="text-xs font-medium text-thb-text-secondary">Requester Type</span>
                <p className="text-sm font-medium text-thb-text-primary mt-0.5 capitalize">{viewingTicket.requesterType || 'employee'}</p>
              </div>
              <div>
                <span className="text-xs font-medium text-thb-text-secondary">Assigned Agent</span>
                <p className="text-sm font-medium text-thb-text-primary mt-0.5">{viewingTicket.assignedAgentName || 'Unassigned'}</p>
              </div>
              <div>
                <span className="text-xs font-medium text-thb-text-secondary">Category</span>
                <p className="text-sm font-medium text-thb-text-primary mt-0.5 capitalize">{getCategoryLabel(viewingTicket.category) || '—'}</p>
              </div>
              <div>
                <span className="text-xs font-medium text-thb-text-secondary">Created</span>
                <p className="text-sm font-medium text-thb-text-primary mt-0.5 flex items-center gap-1"><FiClock className="w-3.5 h-3.5" />{viewingTicket.createdAt ? new Date(viewingTicket.createdAt).toLocaleString() : '—'}</p>
              </div>
            </div>

            <div className="mb-6">
              <span className="text-xs font-medium text-thb-text-secondary">Description</span>
              <p className="text-sm text-thb-text-primary mt-0.5 bg-slate-50 p-4 rounded-lg whitespace-pre-wrap">{viewingTicket.description || 'No description'}</p>
            </div>

            {/* Status Actions */}
            <div className="flex gap-2 flex-wrap mb-6">
              {viewingTicket.status === 'open' && (
                <button onClick={() => handleTicketAction('in_progress')} className="px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 rounded-lg hover:bg-amber-100 flex items-center gap-1 transition-colors"><FiArrowRight className="w-3.5 h-3.5" /> In Progress</button>
              )}
              {viewingTicket.status === 'in_progress' && (
                <button onClick={() => handleTicketAction('resolved')} className="px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100 flex items-center gap-1 transition-colors"><FiCheck className="w-3.5 h-3.5" /> Resolve</button>
              )}
              {viewingTicket.status === 'resolved' && (
                <button onClick={() => handleTicketAction('closed')} className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-50 rounded-lg hover:bg-slate-100 flex items-center gap-1 transition-colors"><FiCheck className="w-3.5 h-3.5" /> Close</button>
              )}
            </div>

            {/* Comments */}
            <div className="border-t border-thb-border pt-4">
              <h3 className="text-sm font-semibold text-thb-text-primary mb-3 flex items-center gap-2"><FiMessageSquare className="w-4 h-4" /> Comments ({viewingTicket.comments?.length || 0})</h3>
              <div className="space-y-3 max-h-60 overflow-y-auto mb-3">
                {(viewingTicket.comments || []).map((c) => (
                  <div key={c.id} className={`p-3 rounded-lg ${c.isInternal ? 'bg-amber-50 border border-amber-100' : 'bg-slate-50'}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-thb-text-primary">{c.authorName || 'Anonymous'}{c.isInternal && ' (Internal)'}</span>
                      <span className="text-xs text-thb-text-muted">{c.createdAt ? new Date(c.createdAt).toLocaleString() : ''}</span>
                    </div>
                    <p className="text-sm text-thb-text-secondary">{c.content}</p>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input value={comment} onChange={(e) => setComment(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddComment()} placeholder="Add a comment..." className="flex-1 px-3 py-2.5 border border-thb-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" />
                <button onClick={handleAddComment} className="px-4 py-2.5 bg-green-500 text-white rounded-lg hover:bg-green-600 text-sm transition-colors"><FiSend className="w-4 h-4" /></button>
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
                {editingId ? 'Edit Ticket' : 'Create Ticket'}
              </h2>
              <button onClick={handleCancelForm} className="p-2 rounded-lg text-thb-text-muted hover:text-thb-text-primary hover:bg-slate-100 transition-colors"><FiX className="w-5 h-5" /></button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Subject *</label>
                <input type="text" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" placeholder="Ticket subject" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Description *</label>
                <textarea rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 resize-none" placeholder="Describe the issue..." />
              </div>
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Category</label>
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400">
                  <option value="hr">HR</option>
                  <option value="it">IT</option>
                  <option value="payroll">Payroll</option>
                  <option value="admin">Admin</option>
                  <option value="general">General</option>
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
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Requester Type</label>
                <select value={form.requesterType} onChange={(e) => setForm({ ...form, requesterType: e.target.value })} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400">
                  <option value="employee">Employee</option>
                  <option value="client">Client</option>
                  <option value="vendor">Vendor</option>
                </select>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-thb-border">
              <button onClick={handleCancelForm} className="px-4 py-2.5 rounded-lg border border-thb-border text-sm font-medium text-thb-text-secondary hover:bg-slate-50 transition-colors">Cancel</button>
              <button onClick={handleSubmit} disabled={submitting} className="px-6 py-2.5 rounded-lg bg-green-500 text-white text-sm font-medium hover:bg-green-600 disabled:opacity-50 shadow-sm shadow-green-500/25 transition-colors">{submitting ? 'Saving...' : editingId ? 'Update' : 'Create'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Tickets Table */}
      {loading ? (
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => (<div key={i} className="thb-card p-5 animate-pulse"><div className="h-4 w-3/4 bg-slate-200 rounded mb-2" /><div className="h-3 w-1/2 bg-slate-100 rounded" /></div>))}</div>
      ) : displayTickets.length === 0 ? (
        <div className="thb-card p-12 text-center">
          <FiAlertCircle className="w-12 h-12 text-thb-text-muted mx-auto mb-3" />
          <p className="text-thb-text-secondary">
            {activeTab === 'my' ? 'You haven\'t created any tickets yet' : 'No tickets found'}
          </p>
          <button onClick={handleAddNew} className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 transition-colors">
            <FiPlus className="w-4 h-4" /> Create Your First Ticket
          </button>
        </div>
      ) : (
        <div className="thb-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50/50 border-b border-thb-border">
                <tr>
                  {['ID', 'Subject', 'Category', 'Priority', 'Status', 'Assigned Agent', 'Created', 'Actions'].map((h) => (
                    <th key={h} className={`px-4 py-3 text-left text-xs font-semibold text-thb-text-secondary uppercase tracking-wider ${h === 'Actions' ? 'text-right' : ''}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-thb-border/50">
                {displayTickets.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                    {deleteConfirmId === t.id ? (
                      <td colSpan={8} className="px-4 py-3 bg-red-50">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-red-700 font-medium">Are you sure you want to delete this ticket?</span>
                          <div className="flex items-center gap-2">
                            <button onClick={() => handleDelete(t.id)} disabled={deleting} className="px-3 py-1.5 bg-red-500 text-white text-xs font-medium rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors">{deleting ? 'Deleting...' : 'Confirm'}</button>
                            <button onClick={() => setDeleteConfirmId(null)} className="px-3 py-1.5 border border-thb-border text-xs font-medium rounded-lg hover:bg-slate-50 transition-colors">Cancel</button>
                          </div>
                        </div>
                      </td>
                    ) : (
                      <>
                        <td className="px-4 py-3 text-sm font-mono text-thb-text-secondary">{t.ticketId?.slice(0, 8) || '—'}</td>
                        <td className="px-4 py-3 text-sm font-medium text-thb-text-primary max-w-[200px] truncate">{t.subject}</td>
                        <td className="px-4 py-3 text-sm text-thb-text-secondary capitalize">{getCategoryLabel(t.category) || t.requesterType || '—'}</td>
                        <td className="px-4 py-3"><span className={`px-2.5 py-1 rounded-full text-xs font-medium ${priorityConfig[t.priority]?.bg || 'bg-slate-100'} ${priorityConfig[t.priority]?.text || 'text-slate-600'}`}>{t.priority || 'medium'}</span></td>
                        <td className="px-4 py-3"><span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusConfig[t.status]?.bg || 'bg-slate-100'} ${statusConfig[t.status]?.text || 'text-slate-600'}`}>{getStatusText(t.status)}</span></td>
                        <td className="px-4 py-3 text-sm text-thb-text-secondary">{t.assignedAgentName || 'Unassigned'}</td>
                        <td className="px-4 py-3 text-sm text-thb-text-muted">{t.createdAt ? new Date(t.createdAt).toLocaleDateString() : '—'}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => handleView(t.id)} className="p-2 rounded-lg text-thb-text-muted hover:text-emerald-500 hover:bg-emerald-50 transition-colors" title="View"><FiEye className="w-4 h-4" /></button>
                            <button onClick={() => handleEdit(t)} className="p-2 rounded-lg text-thb-text-muted hover:text-green-500 hover:bg-green-50 transition-colors" title="Edit"><FiEdit2 className="w-4 h-4" /></button>
                            <button onClick={() => setDeleteConfirmId(t.id)} className="p-2 rounded-lg text-thb-text-muted hover:text-red-500 hover:bg-red-50 transition-colors" title="Delete"><FiTrash2 className="w-4 h-4" /></button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
