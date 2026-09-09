'use client';

import { useState, useEffect } from 'react';
import {
  FiTarget, FiSearch, FiPlus, FiEdit2, FiTrash2, FiX, FiMail,
  FiPhone, FiFilter, FiTrendingUp, FiChevronDown, FiUser,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { isClientDemoMode } from '@/lib/site-mode';
import { validateEmail, validatePhone, phoneInputFilter } from '@/lib/validators';
import { useAuthStore } from '@/store/authStore';
import { useAutoSeedDemo } from '@/hooks/useAutoSeedDemo';

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

interface Lead {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company: string;
  source: string;
  status: string;
  score: number;
  temperature?: string;
  assignedTo?: string;
  estimatedValue?: number;
  notes?: string;
}

const DEMO_LEADS: Lead[] = isClientDemoMode() ? [
  { id: 1, firstName: 'Arun', lastName: 'Mehta', email: 'arun@zenith.com', phone: '+91 99001 22334', company: 'Zenith Corp.', source: 'Website', status: 'New', score: 82, temperature: 'Hot', assignedTo: 'Arjun Mehta', estimatedValue: 2500000 },
  { id: 2, firstName: 'Deepa', lastName: 'Reddy', email: 'deepa@pinnacle.com', phone: '+91 88112 33445', company: 'Pinnacle Systems', source: 'Referral', status: 'Contacted', score: 71, temperature: 'Hot', assignedTo: 'Vikram Patel', estimatedValue: 1800000 },
  { id: 3, firstName: 'Suresh', lastName: 'Menon', email: 'suresh@apex.com', phone: '+91 77223 44556', company: 'Apex Industries', source: 'Social', status: 'Qualified', score: 65, temperature: 'Warm', assignedTo: 'Priya Sharma', estimatedValue: 3200000 },
  { id: 4, firstName: 'Ritu', lastName: 'Bhat', email: 'ritu@novatech.com', phone: '+91 66334 55667', company: 'NovaTech', source: 'Website', status: 'Contacted', score: 48, temperature: 'Warm', assignedTo: 'Arjun Mehta', estimatedValue: 950000 },
  { id: 5, firstName: 'Kiran', lastName: 'Joshi', email: 'kiran@orion.com', phone: '+91 55445 66778', company: 'Orion Labs', source: 'Other', status: 'Lost', score: 25, temperature: 'Cold', assignedTo: 'Sneha Iyer', estimatedValue: 0 },
  { id: 9, firstName: 'Ravi', lastName: 'Kumar', email: 'ravi@innovate.com', phone: '+91 44556 77889', company: 'Innovate Solutions', source: 'Referral', status: 'Qualified', score: 95, temperature: 'Hot', assignedTo: 'Vikram Patel', estimatedValue: 3500000 },
] : [];

const STATUSES = ['New', 'Contacted', 'Qualified', 'Lost'];
const SOURCES = ['Website', 'Referral', 'Social', 'Other'];

const STATUS_BADGES: Record<string, string> = {
  New: 'thb-badge thb-badge-info', Contacted: 'thb-badge thb-badge-warning',
  Qualified: 'thb-badge thb-badge-success', Lost: 'thb-badge thb-badge-error',
};

const emptyForm = { firstName: '', lastName: '', email: '', phone: '', company: '', source: 'Website', status: 'New', score: '50', notes: '' };

export default function CRMLeadsPage() {
  useAuthStore();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [sourceFilter, setSourceFilter] = useState('All');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [showFilters, setShowFilters] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useAutoSeedDemo('clients' as 'marketplace' | 'wellness' | 'collaboration' | 'clients' | 'vendors' | 'all', () => setRefreshKey(k => k + 1));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        if (search) params.set('search', search);
        if (statusFilter !== 'All') params.set('status', statusFilter);
        if (sourceFilter !== 'All') params.set('source', sourceFilter);
        const res = await fetch(`/api/crm/leads?${params.toString()}`, { headers: getAuthHeaders() });
        if (!res.ok) throw new Error('Failed to fetch');
        const data = await res.json();
        if (!cancelled) setLeads(data.leads?.length ? data.leads : DEMO_LEADS);
      } catch {
        if (!cancelled) setLeads(DEMO_LEADS);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [search, statusFilter, sourceFilter, refreshKey]);

  const handleSave = async () => {
    if (!form.firstName || !form.lastName || !form.email) {
      toast.error('First name, last name, and email are required');
      return;
    }
    { const r = validateEmail(form.email); if (!r.valid) { toast.error(r.error); return } }
    if (form.phone) { const r = validatePhone(form.phone); if (!r.valid) { toast.error(r.error); return } }
    try {
      if (editingId) {
        const res = await fetch(`/api/crm/leads/${editingId}`, { method: 'PUT', headers: getAuthHeaders(), body: JSON.stringify({ ...form, score: Number(form.score) }) });
        if (!res.ok) throw new Error('Failed to update');
        toast.success('Lead updated successfully');
      } else {
        const res = await fetch('/api/crm/leads', { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(form) });
        if (!res.ok) throw new Error('Failed to create');
        toast.success('Lead created successfully');
      }
      setShowForm(false); setEditingId(null); setForm(emptyForm); setRefreshKey(k => k + 1);
    } catch { toast.error('Failed to save lead'); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this lead?')) return;
    try {
      const res = await fetch(`/api/crm/leads/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Failed to delete');
      toast.success('Lead deleted'); setRefreshKey(k => k + 1);
    } catch { toast.error('Failed to delete lead'); }
  };

  const startEdit = (l: Lead) => {
    setForm({ firstName: l.firstName, lastName: l.lastName, email: l.email, phone: l.phone, company: l.company, source: l.source, status: l.status, score: String(l.score), notes: l.notes || '' });
    setEditingId(l.id); setShowForm(true);
  };

  const scoreColor = (score: number) => {
    if (score >= 70) return 'text-emerald-500';
    if (score >= 40) return 'text-amber-500';
    return 'text-red-500';
  };

  const scoreBg = (score: number) => {
    if (score >= 70) return 'bg-emerald-50 border-emerald-200';
    if (score >= 40) return 'bg-amber-50 border-amber-200';
    return 'bg-red-50 border-red-200';
  };

  const scoreRing = (score: number) => {
    if (score >= 70) return 'ring-emerald-500';
    if (score >= 40) return 'ring-amber-500';
    return 'ring-red-500';
  };

  const initials = (l: Lead) => `${l.firstName[0] || ''}${l.lastName[0] || ''}`.toUpperCase();

  const newCount = leads.filter(l => l.status === 'New').length;
  const qualifiedCount = leads.filter(l => l.status === 'Qualified').length;
  const avgScore = leads.length ? Math.round(leads.reduce((s, l) => s + l.score, 0) / leads.length) : 0;

  const filtered = leads.filter(l => {
    if (statusFilter !== 'All' && l.status !== statusFilter) return false;
    if (sourceFilter !== 'All' && l.source !== sourceFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return `${l.firstName} ${l.lastName}`.toLowerCase().includes(q) || l.company.toLowerCase().includes(q) || l.email.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="rounded-xl p-6 text-white" style={{ background: 'linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%)' }}>
        <div className="flex items-center gap-3 mb-2">
          <FiTarget className="w-6 h-6" />
          <h1 className="text-2xl font-bold">CRM Leads</h1>
        </div>
        <p className="text-white/80 text-sm">Track and qualify your sales leads with scoring</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Leads', value: leads.length, icon: FiTarget, color: 'text-teal-500' },
          { label: 'New', value: newCount, icon: FiUser, color: 'text-green-500' },
          { label: 'Qualified', value: qualifiedCount, icon: FiTrendingUp, color: 'text-emerald-500' },
          { label: 'Avg Score', value: avgScore, icon: FiTarget, color: 'text-amber-500' },
        ].map((s, i) => (
          <div key={i} className="thb-card p-4 flex items-center gap-3">
            <s.icon className={`w-8 h-8 ${s.color}`} />
            <div>
              <p className="text-xs text-thb-text-secondary">{s.label}</p>
              <p className="text-lg font-bold text-thb-text-primary">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Search & Actions */}
      <div className="thb-card p-4">
        <div className="flex flex-col md:flex-row gap-3 items-start md:items-center justify-between">
          <div className="flex flex-1 gap-2 w-full md:w-auto">
            <div className="relative flex-1">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-thb-text-muted w-4 h-4" />
              <input type="text" placeholder="Search leads..." value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-9 pr-3 py-2 text-sm border border-thb-border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-white" />
            </div>
            <button onClick={() => setShowFilters(!showFilters)} className="flex items-center gap-1 px-3 py-2 text-sm border border-thb-border rounded-lg hover:bg-gray-50">
              <FiFilter className="w-4 h-4" /> <FiChevronDown className="w-3 h-3" />
            </button>
          </div>
          <button onClick={() => { setForm(emptyForm); setEditingId(null); setShowForm(true); }} className="flex items-center gap-2 px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 text-sm font-medium">
            <FiPlus className="w-4 h-4" /> Add Lead
          </button>
        </div>
        {showFilters && (
          <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-thb-border">
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-1.5 text-sm border border-thb-border rounded-lg bg-white">
              <option value="All">All Status</option>
              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={sourceFilter} onChange={e => setSourceFilter(e.target.value)} className="px-3 py-1.5 text-sm border border-thb-border rounded-lg bg-white">
              <option value="All">All Sources</option>
              {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div className="thb-card p-4 border-l-4 border-l-teal-500">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-thb-text-primary">{editingId ? 'Edit Lead' : 'Add New Lead'}</h3>
            <button onClick={() => { setShowForm(false); setEditingId(null); }} className="text-thb-text-muted hover:text-thb-text-primary"><FiX className="w-5 h-5" /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input type="text" placeholder="First Name *" value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} className="px-3 py-2 text-sm border border-thb-border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
            <input type="text" placeholder="Last Name *" value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} className="px-3 py-2 text-sm border border-thb-border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
            <input type="email" placeholder="Email * (e.g., name@domain.com)" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="px-3 py-2 text-sm border border-thb-border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
            <input type="tel" placeholder="Phone (10-digit Indian mobile)" value={form.phone} onChange={e => setForm({ ...form, phone: phoneInputFilter(e.target.value) })} className="px-3 py-2 text-sm border border-thb-border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
            <input type="text" placeholder="Company" value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} className="px-3 py-2 text-sm border border-thb-border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
            <select value={form.source} onChange={e => setForm({ ...form, source: e.target.value })} className="px-3 py-2 text-sm border border-thb-border rounded-lg bg-white">
              {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className="px-3 py-2 text-sm border border-thb-border rounded-lg bg-white">
              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <input type="number" placeholder="Score (0-100)" min="0" max="100" value={form.score} onChange={e => setForm({ ...form, score: e.target.value })} className="px-3 py-2 text-sm border border-thb-border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
            <textarea placeholder="Notes" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="px-3 py-2 text-sm border border-thb-border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" rows={1} />
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={handleSave} className="px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 text-sm font-medium">Save</button>
            <button onClick={() => { setShowForm(false); setEditingId(null); }} className="px-4 py-2 border border-thb-border rounded-lg hover:bg-gray-50 text-sm">Cancel</button>
          </div>
        </div>
      )}

      {/* Leads Card Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <div key={i} className="thb-card p-4 animate-pulse"><div className="h-4 bg-gray-200 rounded w-3/4 mb-2" /><div className="h-3 bg-gray-100 rounded w-1/2" /></div>)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="thb-card p-8 text-center">
          <FiTarget className="w-12 h-12 text-thb-text-muted mx-auto mb-3" />
          <p className="text-thb-text-secondary">No leads found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[600px] overflow-y-auto">
          {filtered.map(l => (
            <div key={l.id} className={`thb-card thb-card-hover p-4 border-l-4 ${scoreBg(l.score).replace('bg-', 'border-l-').replace('-50', '-500')}`}>
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-full ring-2 ${scoreRing(l.score)} flex items-center justify-center font-bold text-sm shrink-0 ${scoreColor(l.score)} bg-white`}>
                  {initials(l)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-thb-text-primary truncate">{l.firstName} {l.lastName}</h4>
                    <span className={STATUS_BADGES[l.status] || 'thb-badge thb-badge-info'}>{l.status}</span>
                  </div>
                  <p className="text-xs text-thb-text-secondary truncate">{l.company}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-thb-text-muted">
                    <span className="flex items-center gap-1"><FiMail className="w-3 h-3" /> {l.email}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-thb-text-muted">
                    <span className="flex items-center gap-1"><FiPhone className="w-3 h-3" /> {l.phone}</span>
                  </div>
                </div>
              </div>
              {/* Score Bar */}
              <div className="mt-3 pt-3 border-t border-thb-border">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-thb-text-muted">Lead Score</span>
                  <span className={`text-sm font-bold ${scoreColor(l.score)}`}>{l.score}</span>
                </div>
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${l.score >= 70 ? 'bg-emerald-500' : l.score >= 40 ? 'bg-amber-500' : 'bg-red-500'}`}
                    style={{ width: `${l.score}%` }}
                  />
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="thb-badge thb-badge-purple text-[10px]">{l.source}</span>
                  {l.estimatedValue ? <span className="text-xs font-medium text-thb-text-primary">₹{(l.estimatedValue / 100000).toFixed(1)}L</span> : null}
                </div>
              </div>
              {/* Actions */}
              <div className="flex gap-1 mt-3 pt-2 border-t border-thb-border">
                <button onClick={() => startEdit(l)} className="p-1.5 rounded hover:bg-teal-50 text-teal-500" title="Edit"><FiEdit2 className="w-3.5 h-3.5" /></button>
                <button onClick={() => handleDelete(l.id)} className="p-1.5 rounded hover:bg-red-50 text-red-500" title="Delete"><FiTrash2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
