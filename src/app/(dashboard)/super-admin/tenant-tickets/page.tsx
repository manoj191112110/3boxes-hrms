'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  FiHeadphones, FiPlus, FiEdit2, FiX, FiCheck,
  FiAlertTriangle, FiClock, FiUser, FiFilter, FiRefreshCw,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import { isClientLiveMode } from '@/lib/site-mode';
import { isTenantHiddenClient, PLATFORM_PLACEHOLDER_NAME } from '@/lib/tenant-filter';

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

// ─── Types ───────────────────────────────────────────────
interface Ticket {
  id: string;
  subject: string;
  tenant: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  assignee: string;
  createdDate: string;
  description: string;
}

const priorityBadge: Record<string, string> = {
  low: 'thb-badge thb-badge-info',
  medium: 'thb-badge thb-badge-warning',
  high: 'thb-badge thb-badge-error',
  critical: 'thb-badge thb-badge-purple',
};

const statusBadge: Record<string, string> = {
  open: 'thb-badge thb-badge-error',
  in_progress: 'thb-badge thb-badge-warning',
  resolved: 'thb-badge thb-badge-success',
  closed: 'thb-badge thb-badge-info',
};

export default function TenantTicketsPage() {
  const { user } = useAuthStore();
  const liveMode = isClientLiveMode();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [priorityFilter, setPriorityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    subject: '', tenant: '', priority: 'medium' as Ticket['priority'],
    status: 'open' as Ticket['status'], assignee: '', description: '',
  });

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/tickets?limit=100', { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Failed to fetch tickets');
      const data = await res.json();
      const raw = data.tickets || data || [];

      // ALWAYS filter out hidden tenants — never show Marq AI Tech
      // Also exclude orphan tickets (no tenant info) and dummy/placeholder data
      const filtered = raw.filter((t: any) => {
        // Exclude if tenant slug is hidden
        if (t.tenant?.slug && isTenantHiddenClient(t.tenant.slug)) return false;
        // Exclude if tenant name matches placeholder
        if ((t.tenant?.name || '').includes(PLATFORM_PLACEHOLDER_NAME)) return false;
        // Exclude orphan tickets with no tenant info (likely dummy/seed data)
        if (!t.tenant && (!t.tenantName || t.tenantName === 'Unknown')) {
          // Also check requesterName for hidden tenant names
          const requesterName = String(t.requesterName || '');
          if (requesterName.includes(PLATFORM_PLACEHOLDER_NAME)) return false;
          // Exclude obvious dummy subjects
          const subject = String(t.subject || '').toLowerCase();
          if (subject.includes('test ticket') || subject.includes('dummy') || subject.includes('sample')) return false;
        }
        return true;
      });

      const mapped: Ticket[] = filtered.map((t: any) => ({
        id: t.id || `TKT-${Math.random().toString(36).slice(2, 8)}`,
        subject: t.subject || t.title || '',
        tenant: t.tenant?.name || t.tenantName || 'Unknown',
        priority: (t.priority || 'medium') as Ticket['priority'],
        status: (t.status || 'open') as Ticket['status'],
        assignee: t.assignee?.name || t.assignee || 'Unassigned',
        createdDate: t.createdAt ? new Date(t.createdAt).toISOString().slice(0, 10) : '',
        description: t.description || '',
      }));
      setTickets(mapped);
    } catch (err) {
      toast.error('Failed to load tickets');
      setTickets([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  const filtered = useMemo(() => {
    let result = tickets;
    if (priorityFilter) result = result.filter((t) => t.priority === priorityFilter);
    if (statusFilter) result = result.filter((t) => t.status === statusFilter);
    return result;
  }, [tickets, priorityFilter, statusFilter]);

  const openCount = tickets.filter((t) => t.status === 'open').length;
  const inProgressCount = tickets.filter((t) => t.status === 'in_progress').length;
  const resolvedCount = tickets.filter((t) => t.status === 'resolved' || t.status === 'closed').length;
  const avgResolution = '—';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.subject || !form.tenant) { toast.error('Subject and tenant are required'); return; }
    if (editingId) {
      try {
        const res = await fetch(`/api/tickets/${editingId}`, {
          method: 'PATCH',
          headers: getAuthHeaders(),
          body: JSON.stringify(form),
        });
        if (!res.ok) throw new Error('Failed to update ticket');
        toast.success('Ticket updated');
        fetchTickets();
      } catch {
        toast.error('Failed to update ticket');
      }
    } else {
      try {
        const res = await fetch('/api/tickets', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify(form),
        });
        if (!res.ok) throw new Error('Failed to create ticket');
        toast.success('Ticket created');
        fetchTickets();
      } catch {
        toast.error('Failed to create ticket');
      }
    }
    setShowForm(false);
    setEditingId(null);
  };

  const handleEdit = (ticket: Ticket) => {
    setEditingId(ticket.id);
    setForm({ subject: ticket.subject, tenant: ticket.tenant, priority: ticket.priority, status: ticket.status, assignee: ticket.assignee, description: ticket.description });
    setShowForm(true);
  };

  const inputCls = 'w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400';

  return (
    <div className="space-y-6">
      {/* Hero Banner */}
      <div className="thb-card p-6 bg-gradient-to-r from-rose-600 via-pink-500 to-fuchsia-500 border-0">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3"><FiHeadphones className="w-7 h-7" /> Tenant Support Tickets</h1>
            <p className="text-rose-100 mt-1 text-sm">Manage and resolve support requests from all platform tenants</p>
          </div>
          <div className="flex gap-2">
            <button onClick={fetchTickets} className="inline-flex items-center gap-2 px-4 py-2.5 bg-white/20 backdrop-blur text-white rounded-lg font-medium text-sm hover:bg-white/30 transition-colors">
              <FiRefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
            <button onClick={() => { setShowForm(true); setEditingId(null); setForm({ subject: '', tenant: '', priority: 'medium', status: 'open', assignee: '', description: '' }); }} className="inline-flex items-center gap-2 px-4 py-2.5 bg-white/20 backdrop-blur text-white rounded-lg font-medium text-sm hover:bg-white/30 transition-colors">
              <FiPlus className="w-4 h-4" /> New Ticket
            </button>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="thb-card p-12 text-center">
          <FiRefreshCw className="w-8 h-8 mx-auto mb-3 text-thb-text-muted animate-spin" />
          <p className="text-thb-text-muted">Loading tickets…</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && tickets.length === 0 && (
        <div className="thb-card p-12 text-center">
          <FiHeadphones className="w-12 h-12 mx-auto mb-3 text-thb-text-muted opacity-40" />
          <p className="text-lg font-medium text-thb-text-primary">No tickets found</p>
          <p className="text-sm text-thb-text-muted mt-1">No support tickets exist yet.</p>
        </div>
      )}

      {/* Stat Cards */}
      {!loading && tickets.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Open', value: openCount, icon: <FiAlertTriangle className="w-5 h-5" />, bg: 'bg-red-50 text-red-500' },
            { label: 'In Progress', value: inProgressCount, icon: <FiClock className="w-5 h-5" />, bg: 'bg-amber-50 text-amber-500' },
            { label: 'Resolved', value: resolvedCount, icon: <FiCheck className="w-5 h-5" />, bg: 'bg-emerald-50 text-emerald-500' },
            { label: 'Avg Resolution', value: avgResolution, icon: <FiClock className="w-5 h-5" />, bg: 'bg-teal-50 text-teal-500' },
          ].map((card) => (
            <div key={card.label} className="thb-card p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-thb-text-muted">{card.label}</p>
                  <p className="text-2xl font-bold text-thb-text-primary mt-1">{card.value}</p>
                </div>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${card.bg}`}>{card.icon}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      {!loading && tickets.length > 0 && (
        <div className="thb-card p-4 flex flex-wrap items-center gap-3">
          <FiFilter className="w-4 h-4 text-thb-text-muted" />
          <span className="text-sm text-thb-text-secondary">Priority:</span>
          {['', 'low', 'medium', 'high', 'critical'].map((p) => (
            <button key={p} onClick={() => setPriorityFilter(p)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${priorityFilter === p ? 'bg-rose-500 text-white' : 'bg-slate-100 text-thb-text-secondary hover:bg-slate-200'}`}>{p || 'All'}</button>
          ))}
          <span className="text-sm text-thb-text-secondary ml-4">Status:</span>
          {['', 'open', 'in_progress', 'resolved', 'closed'].map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${statusFilter === s ? 'bg-rose-500 text-white' : 'bg-slate-100 text-thb-text-secondary hover:bg-slate-200'}`}>{s ? s.replace('_', ' ') : 'All'}</button>
          ))}
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div className="thb-card border-l-4 border-l-rose-500 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-thb-text-primary">{editingId ? 'Edit Ticket' : 'New Ticket'}</h3>
            <button onClick={() => { setShowForm(false); setEditingId(null); }} className="p-1.5 text-thb-text-muted hover:text-thb-text-primary hover:bg-slate-100 rounded-lg"><FiX className="w-4 h-4" /></button>
          </div>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2"><label className="block text-xs font-medium text-thb-text-secondary mb-1">Subject</label><input className={inputCls} value={form.subject} onChange={(e) => setForm((p) => ({ ...p, subject: e.target.value }))} /></div>
            <div><label className="block text-xs font-medium text-thb-text-secondary mb-1">Tenant</label><input className={inputCls} value={form.tenant} onChange={(e) => setForm((p) => ({ ...p, tenant: e.target.value }))} /></div>
            <div><label className="block text-xs font-medium text-thb-text-secondary mb-1">Priority</label><select className={inputCls} value={form.priority} onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value as Ticket['priority'] }))}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select></div>
            <div><label className="block text-xs font-medium text-thb-text-secondary mb-1">Status</label><select className={inputCls} value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as Ticket['status'] }))}><option value="open">Open</option><option value="in_progress">In Progress</option><option value="resolved">Resolved</option><option value="closed">Closed</option></select></div>
            <div><label className="block text-xs font-medium text-thb-text-secondary mb-1">Assignee</label><input className={inputCls} value={form.assignee} onChange={(e) => setForm((p) => ({ ...p, assignee: e.target.value }))} /></div>
            <div className="sm:col-span-2"><label className="block text-xs font-medium text-thb-text-secondary mb-1">Description</label><textarea className={inputCls} rows={3} value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} /></div>
            <div className="flex items-end gap-2"><button type="submit" className="inline-flex items-center gap-2 px-4 py-2.5 bg-rose-500 text-white rounded-lg font-medium text-sm hover:bg-rose-600 transition-colors"><FiCheck className="w-4 h-4" />{editingId ? 'Update' : 'Create'}</button></div>
          </form>
        </div>
      )}

      {/* Ticket List */}
      {!loading && tickets.length > 0 && (
        <div className="space-y-3">
          {filtered.map((ticket) => (
            <div key={ticket.id} className="thb-card p-4 hover:shadow-md transition-shadow">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-xs text-thb-text-muted">{ticket.id}</span>
                    <span className={priorityBadge[ticket.priority]}>{ticket.priority}</span>
                    <span className={statusBadge[ticket.status]}>{ticket.status.replace('_', ' ')}</span>
                  </div>
                  <h4 className="text-sm font-semibold text-thb-text-primary truncate">{ticket.subject}</h4>
                  <p className="text-xs text-thb-text-muted mt-0.5 line-clamp-1">{ticket.description}</p>
                </div>
                <div className="flex items-center gap-4 text-xs text-thb-text-secondary flex-shrink-0">
                  <div className="flex items-center gap-1"><FiUser className="w-3.5 h-3.5" /> {ticket.tenant}</div>
                  <div className="flex items-center gap-1"><FiClock className="w-3.5 h-3.5" /> {ticket.assignee}</div>
                  <div className="text-thb-text-muted">{ticket.createdDate}</div>
                  <button onClick={() => handleEdit(ticket)} className="inline-flex items-center gap-1 text-green-500 hover:text-green-700 font-medium"><FiEdit2 className="w-3.5 h-3.5" />Edit</button>
                </div>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="thb-card p-8 text-center text-thb-text-muted"><FiAlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-50" /><p>No tickets match the current filters</p></div>
          )}
        </div>
      )}
    </div>
  );
}
