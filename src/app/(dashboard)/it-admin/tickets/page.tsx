'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  FiPlus, FiX, FiSearch, FiUser,
  FiClock, FiAlertTriangle, FiCheckCircle, FiCircle,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import { isClientDemoMode } from '@/lib/site-mode';

/* ================================================================
   IT Support Tickets – 3Boxes HRMS IT Admin
   ================================================================ */

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

type TicketCategory = 'hardware' | 'software' | 'network' | 'access';
type TicketPriority = 'low' | 'medium' | 'high' | 'critical';
type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

interface Ticket {
  id: string;
  subject: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  requester: string;
  assignee: string;
  createdDate: string;
}

const PRIORITY_CFG: Record<TicketPriority, { bg: string; text: string; border: string }> = {
  low:      { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-l-emerald-400' },
  medium:   { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-l-amber-400' },
  high:     { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-l-orange-400' },
  critical: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-l-red-500' },
};

const STATUS_CFG: Record<TicketStatus, { bg: string; text: string; icon: React.ReactNode }> = {
  open:        { bg: 'bg-green-100', text: 'text-green-700', icon: <FiCircle className="w-3 h-3" /> },
  in_progress: { bg: 'bg-amber-100', text: 'text-amber-700', icon: <FiClock className="w-3 h-3" /> },
  resolved:    { bg: 'bg-emerald-100', text: 'text-emerald-700', icon: <FiCheckCircle className="w-3 h-3" /> },
  closed:      { bg: 'bg-slate-100', text: 'text-slate-600', icon: <FiX className="w-3 h-3" /> },
};

const CATEGORY_LABEL: Record<TicketCategory, string> = {
  hardware: 'Hardware', software: 'Software', network: 'Network', access: 'Access',
};

const KANBAN_COLUMNS: { key: TicketStatus; label: string; color: string }[] = [
  { key: 'open', label: 'Open', color: 'bg-green-500' },
  { key: 'in_progress', label: 'In Progress', color: 'bg-amber-500' },
  { key: 'resolved', label: 'Resolved', color: 'bg-emerald-500' },
  { key: 'closed', label: 'Closed', color: 'bg-slate-400' },
];

const EMPTY_FORM: Omit<Ticket, 'id'> = {
  subject: '', category: 'software', priority: 'medium',
  status: 'open', requester: '', assignee: '',
  createdDate: new Date().toISOString().slice(0, 10),
};

function getDemoTickets(): Ticket[] {
  if (!isClientDemoMode()) return [];
  return [
    { id: 'TKT-1024', subject: 'VPN connection dropping intermittently for remote team', category: 'network', priority: 'critical', status: 'in_progress', requester: 'Rahul Verma', assignee: 'Raj K.', createdDate: new Date(Date.now() - 7200000).toISOString().slice(0, 10) },
    { id: 'TKT-1025', subject: 'Email server latency affecting all BLR office users', category: 'network', priority: 'high', status: 'open', requester: 'Sneha Iyer', assignee: 'Anita S.', createdDate: new Date(Date.now() - 14400000).toISOString().slice(0, 10) },
    { id: 'TKT-1026', subject: 'New hire laptop provisioning — Dev team (3 devices)', category: 'hardware', priority: 'medium', status: 'in_progress', requester: 'Arun Kumar', assignee: 'Vikram P.', createdDate: new Date(Date.now() - 21600000).toISOString().slice(0, 10) },
    { id: 'TKT-1027', subject: 'SAP access request for Finance new joiner', category: 'access', priority: 'low', status: 'open', requester: 'Priya Sharma', assignee: 'Meera D.', createdDate: new Date(Date.now() - 86400000).toISOString().slice(0, 10) },
    { id: 'TKT-1028', subject: 'Printer queue stuck on Floor 3 — HP LaserJet Pro', category: 'hardware', priority: 'medium', status: 'open', requester: 'Dev Team', assignee: 'Suresh M.', createdDate: new Date(Date.now() - 86400000).toISOString().slice(0, 10) },
    { id: 'TKT-1029', subject: 'Adobe Creative Cloud license expired for Design team', category: 'software', priority: 'high', status: 'resolved', requester: 'Design Lead', assignee: 'Raj K.', createdDate: new Date(Date.now() - 172800000).toISOString().slice(0, 10) },
    { id: 'TKT-1030', subject: 'Outlook not syncing on mobile devices', category: 'software', priority: 'medium', status: 'resolved', requester: 'Sales Team', assignee: 'Anita S.', createdDate: new Date(Date.now() - 259200000).toISOString().slice(0, 10) },
    { id: 'TKT-1031', subject: 'WiFi dead zone in Cafeteria area', category: 'network', priority: 'low', status: 'closed', requester: 'Office Admin', assignee: 'Vikram P.', createdDate: new Date(Date.now() - 345600000).toISOString().slice(0, 10) },
  ];
}

export default function ITTicketsPage() {
  useAuthStore();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Omit<Ticket, 'id'>>(EMPTY_FORM);

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/tickets', { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) { setTickets(data); setLoading(false); return; }
      }
    } catch { /* fallback */ }
    setTickets(getDemoTickets());
    setLoading(false);
  }, []);

  useEffect(() => { queueMicrotask(() => fetchTickets()); }, [fetchTickets]);

  const filtered = tickets.filter(t => {
    const q = search.toLowerCase();
    return t.subject.toLowerCase().includes(q) || t.requester.toLowerCase().includes(q) || t.assignee.toLowerCase().includes(q) || t.id.toLowerCase().includes(q);
  });

  const statCards = [
    { label: 'Open', value: tickets.filter(t => t.status === 'open').length, icon: <FiCircle className="w-5 h-5" />, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'In Progress', value: tickets.filter(t => t.status === 'in_progress').length, icon: <FiClock className="w-5 h-5" />, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Resolved', value: tickets.filter(t => t.status === 'resolved').length, icon: <FiCheckCircle className="w-5 h-5" />, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Critical', value: tickets.filter(t => t.priority === 'critical').length, icon: <FiAlertTriangle className="w-5 h-5" />, color: 'text-red-600', bg: 'bg-red-50' },
  ];

  function openAdd() { setForm(EMPTY_FORM); setShowForm(true); }
  function closeForm() { setShowForm(false); }

  function handleSave() {
    if (!form.subject || !form.requester) { toast.error('Subject and Requester are required'); return; }
    const newTicket: Ticket = { id: `TKT-${1000 + tickets.length + 1}`, ...form };
    setTickets(prev => [newTicket, ...prev]);
    toast.success('Ticket created');
    closeForm();
  }

  function moveTicket(id: string, newStatus: TicketStatus) {
    setTickets(prev => prev.map(t => t.id === id ? { ...t, status: newStatus } : t));
    toast.success(`Ticket moved to ${newStatus.replace('_', ' ')}`);
  }

  function deleteTicket(id: string) {
    setTickets(prev => prev.filter(t => t.id !== id));
    toast.success('Ticket deleted');
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-thb-text-primary">IT Support Tickets</h1>
          <p className="text-sm text-thb-text-secondary mt-1">Track and manage IT support requests</p>
        </div>
        <button onClick={openAdd} className="inline-flex items-center gap-2 px-4 py-2 bg-thb-primary text-white rounded-lg text-sm font-medium hover:opacity-90 transition">
          <FiPlus className="w-4 h-4" /> New Ticket
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {statCards.map(s => (
          <div key={s.label} className="thb-card p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${s.bg} ${s.color}`}>{s.icon}</div>
              <div><p className="text-2xl font-bold text-thb-text-primary">{s.value}</p><p className="text-xs text-thb-text-muted">{s.label}</p></div>
            </div>
          </div>
        ))}
      </div>

      {/* Search & View Toggle */}
      <div className="thb-card p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-thb-text-muted w-4 h-4" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tickets, requesters, assignees..." className="w-full pl-9 pr-3 py-2 border border-thb-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-thb-primary/20" />
          </div>
          <div className="flex gap-1 bg-slate-100 rounded-lg p-0.5">
            <button onClick={() => setViewMode('kanban')} className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${viewMode === 'kanban' ? 'bg-white text-thb-text-primary shadow-sm' : 'text-thb-text-muted'}`}>Kanban</button>
            <button onClick={() => setViewMode('list')} className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${viewMode === 'list' ? 'bg-white text-thb-text-primary shadow-sm' : 'text-thb-text-muted'}`}>List</button>
          </div>
        </div>
      </div>

      {/* Add Ticket Form */}
      {showForm && (
        <div className="thb-card p-4 md:p-6 border-l-4 border-l-thb-primary animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-thb-text-primary">New Ticket</h3>
            <button onClick={closeForm} className="p-1 hover:bg-slate-100 rounded"><FiX className="w-4 h-4 text-thb-text-muted" /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <div className="sm:col-span-2 md:col-span-3"><label className="text-xs font-medium text-thb-text-secondary mb-1 block">Subject *</label><input value={form.subject} onChange={e => setForm(p => ({ ...p, subject: e.target.value }))} className="w-full px-3 py-2 border border-thb-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-thb-primary/20" /></div>
            <div><label className="text-xs font-medium text-thb-text-secondary mb-1 block">Category</label><select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value as TicketCategory }))} className="w-full px-3 py-2 border border-thb-border rounded-lg text-sm focus:outline-none"><option value="hardware">Hardware</option><option value="software">Software</option><option value="network">Network</option><option value="access">Access</option></select></div>
            <div><label className="text-xs font-medium text-thb-text-secondary mb-1 block">Priority</label><select value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value as TicketPriority }))} className="w-full px-3 py-2 border border-thb-border rounded-lg text-sm focus:outline-none"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select></div>
            <div><label className="text-xs font-medium text-thb-text-secondary mb-1 block">Requester *</label><input value={form.requester} onChange={e => setForm(p => ({ ...p, requester: e.target.value }))} className="w-full px-3 py-2 border border-thb-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-thb-primary/20" /></div>
            <div><label className="text-xs font-medium text-thb-text-secondary mb-1 block">Assignee</label><input value={form.assignee} onChange={e => setForm(p => ({ ...p, assignee: e.target.value }))} className="w-full px-3 py-2 border border-thb-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-thb-primary/20" /></div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={handleSave} className="px-4 py-2 bg-thb-primary text-white rounded-lg text-sm font-medium hover:opacity-90">Create Ticket</button>
            <button onClick={closeForm} className="px-4 py-2 border border-thb-border rounded-lg text-sm text-thb-text-secondary hover:bg-slate-50">Cancel</button>
          </div>
        </div>
      )}

      {/* Kanban View */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="thb-card p-4 animate-pulse"><div className="h-4 bg-slate-200 rounded w-1/2 mb-3" /><div className="space-y-2">{Array.from({ length: 2 }).map((_, j) => <div key={j} className="h-20 bg-slate-100 rounded" />)}</div></div>)}</div>
      ) : viewMode === 'kanban' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {KANBAN_COLUMNS.map(col => {
            const colTickets = filtered.filter(t => t.status === col.key);
            return (
              <div key={col.key} className="space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <div className={`w-2 h-2 rounded-full ${col.color}`} />
                  <h3 className="text-sm font-semibold text-thb-text-primary">{col.label}</h3>
                  <span className="text-xs text-thb-text-muted">({colTickets.length})</span>
                </div>
                <div className="space-y-2 max-h-[calc(100vh-380px)] overflow-y-auto">
                  {colTickets.map(t => {
                    const pc = PRIORITY_CFG[t.priority];
                    return (
                      <div key={t.id} className={`thb-card border-l-4 ${pc.border} p-3 thb-card-hover`}>
                        <div className="flex items-start justify-between mb-1">
                          <span className="text-[10px] font-mono text-thb-text-muted">{t.id}</span>
                          <button onClick={() => deleteTicket(t.id)} className="p-0.5 hover:bg-red-50 rounded"><FiX className="w-3 h-3 text-thb-text-muted hover:text-red-500" /></button>
                        </div>
                        <h4 className="text-xs font-medium text-thb-text-primary mb-2 line-clamp-2">{t.subject}</h4>
                        <div className="flex flex-wrap gap-1 mb-2">
                          <span className={`thb-badge ${pc.bg} ${pc.text}`}>{t.priority}</span>
                          <span className="thb-badge bg-slate-100 text-slate-600">{CATEGORY_LABEL[t.category]}</span>
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-thb-text-muted">
                          <span className="flex items-center gap-1"><FiUser className="w-3 h-3" />{t.assignee || 'Unassigned'}</span>
                          <span>{t.createdDate}</span>
                        </div>
                        {/* Quick move buttons */}
                        <div className="flex gap-1 mt-2 pt-2 border-t border-thb-border">
                          {KANBAN_COLUMNS.filter(c => c.key !== t.status).slice(0, 3).map(c => (
                            <button key={c.key} onClick={() => moveTicket(t.id, c.key)} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-50 text-thb-text-muted hover:bg-slate-100 hover:text-thb-text-primary transition">
                              → {c.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  {colTickets.length === 0 && <div className="text-xs text-thb-text-muted text-center py-6">No tickets</div>}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* List View */
        <div className="space-y-2">
          {filtered.map(t => {
            const pc = PRIORITY_CFG[t.priority];
            const sc = STATUS_CFG[t.status];
            return (
              <div key={t.id} className="thb-card thb-card-hover p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className={`w-1 h-10 rounded-full ${pc.border.replace('border-l-', 'bg-')}`} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono text-thb-text-muted">{t.id}</span>
                      <h4 className="text-sm font-medium text-thb-text-primary truncate">{t.subject}</h4>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-1.5 text-xs text-thb-text-secondary">
                      <span className="flex items-center gap-1"><FiUser className="w-3 h-3" />{t.requester}</span>
                      <span>→ {t.assignee || 'Unassigned'}</span>
                      <span className="flex items-center gap-1"><FiClock className="w-3 h-3" />{t.createdDate}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`thb-badge ${pc.bg} ${pc.text}`}>{t.priority}</span>
                  <span className={`thb-badge flex items-center gap-1 ${sc.bg} ${sc.text}`}>{sc.icon}{t.status.replace('_', ' ')}</span>
                  <span className="thb-badge bg-slate-100 text-slate-600">{CATEGORY_LABEL[t.category]}</span>
                  <button onClick={() => deleteTicket(t.id)} className="p-1 hover:bg-red-50 rounded"><FiX className="w-3.5 h-3.5 text-thb-text-muted hover:text-red-500" /></button>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && <div className="text-center py-12 text-thb-text-muted">No tickets found.</div>}
        </div>
      )}
    </div>
  );
}
