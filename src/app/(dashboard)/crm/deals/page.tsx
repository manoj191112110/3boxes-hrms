'use client';

import { useState, useEffect } from 'react';
import {
  FiDollarSign, FiSearch, FiPlus, FiEdit2, FiTrash2, FiX, FiTrendingUp,
  FiBriefcase, FiTarget, FiCalendar,
} from 'react-icons/fi';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import toast from 'react-hot-toast';
import { isClientDemoMode } from '@/lib/site-mode';
import { useAuthStore } from '@/store/authStore';
import { useAutoSeedDemo } from '@/hooks/useAutoSeedDemo';

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

interface Deal {
  id: number;
  name: string;
  contact: string;
  company: string;
  value: number;
  stage: string;
  probability: number;
  closeDate: string;
  owner: string;
  description?: string;
}

const DEMO_DEALS: Deal[] = isClientDemoMode() ? [
  { id: 1, name: 'Enterprise SaaS Platform', contact: 'Rajesh Kumar', company: 'TechVista Solutions', value: 4200000, stage: 'Negotiation', probability: 85, closeDate: '2025-07-15', owner: 'Arjun Mehta' },
  { id: 2, name: 'Cloud Migration Project', contact: 'Sneha Iyer', company: 'DataCore Inc.', value: 2800000, stage: 'Proposal', probability: 60, closeDate: '2025-08-01', owner: 'Sneha Iyer' },
  { id: 3, name: 'Digital Transformation', contact: 'Vikram Patel', company: 'GreenLeaf Corp.', value: 3500000, stage: 'Negotiation', probability: 75, closeDate: '2025-07-20', owner: 'Vikram Patel' },
  { id: 4, name: 'Analytics Platform', contact: 'Priya Sharma', company: 'MegaSoft Ltd.', value: 1900000, stage: 'Qualification', probability: 40, closeDate: '2025-09-10', owner: 'Priya Sharma' },
  { id: 5, name: 'CRM Implementation', contact: 'Amit Desai', company: 'BuildRight Inc.', value: 1200000, stage: 'Proposal', probability: 55, closeDate: '2025-08-15', owner: 'Arjun Mehta' },
  { id: 8, name: 'Data Warehouse', contact: 'Nisha Patel', company: 'InfoBase Analytics', value: 3100000, stage: 'Closed Won', probability: 100, closeDate: '2025-06-20', owner: 'Arjun Mehta' },
  { id: 9, name: 'Security Audit', contact: 'Kiran Joshi', company: 'SafeNet', value: 680000, stage: 'Closed Lost', probability: 0, closeDate: '2025-06-10', owner: 'Sneha Iyer' },
] : [];

const STAGES = ['Qualification', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost'];
const STAGE_COLORS: Record<string, string> = {
  Qualification: 'border-l-sky-500', Proposal: 'border-l-amber-500', Negotiation: 'border-l-orange-500',
  'Closed Won': 'border-l-emerald-500', 'Closed Lost': 'border-l-red-500',
};
const STAGE_BADGES: Record<string, string> = {
  Qualification: 'thb-badge thb-badge-info', Proposal: 'thb-badge thb-badge-warning',
  Negotiation: 'thb-badge thb-badge-purple', 'Closed Won': 'thb-badge thb-badge-success', 'Closed Lost': 'thb-badge thb-badge-error',
};

const emptyForm = { name: '', contact: '', company: '', value: '', stage: 'Qualification', probability: '20', closeDate: '', description: '' };

export default function CRMDealsPage() {
  useAuthStore();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('All');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [viewMode, setViewMode] = useState<'pipeline' | 'list'>('pipeline');
  const [refreshKey, setRefreshKey] = useState(0);

  useAutoSeedDemo('clients' as 'marketplace' | 'wellness' | 'collaboration' | 'clients' | 'vendors' | 'all', () => setRefreshKey(k => k + 1));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        if (search) params.set('search', search);
        if (stageFilter !== 'All') params.set('stage', stageFilter);
        const res = await fetch(`/api/crm/deals?${params.toString()}`, { headers: getAuthHeaders() });
        if (!res.ok) throw new Error('Failed to fetch');
        const data = await res.json();
        if (!cancelled) setDeals(data.deals?.length ? data.deals : DEMO_DEALS);
      } catch {
        if (!cancelled) setDeals(DEMO_DEALS);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [search, stageFilter, refreshKey]);

  const handleSave = async () => {
    if (!form.name || !form.value) { toast.error('Deal name and value are required'); return; }
    try {
      if (editingId) {
        const res = await fetch(`/api/crm/deals/${editingId}`, { method: 'PUT', headers: getAuthHeaders(), body: JSON.stringify({ ...form, value: Number(form.value), probability: Number(form.probability) }) });
        if (!res.ok) throw new Error('Failed to update');
        toast.success('Deal updated successfully');
      } else {
        const res = await fetch('/api/crm/deals', { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(form) });
        if (!res.ok) throw new Error('Failed to create');
        toast.success('Deal created successfully');
      }
      setShowForm(false); setEditingId(null); setForm(emptyForm); setRefreshKey(k => k + 1);
    } catch { toast.error('Failed to save deal'); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this deal?')) return;
    try {
      const res = await fetch(`/api/crm/deals/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Failed to delete');
      toast.success('Deal deleted'); setRefreshKey(k => k + 1);
    } catch { toast.error('Failed to delete deal'); }
  };

  const startEdit = (d: Deal) => {
    setForm({ name: d.name, contact: d.contact, company: d.company, value: String(d.value), stage: d.stage, probability: String(d.probability), closeDate: d.closeDate, description: d.description || '' });
    setEditingId(d.id); setShowForm(true);
  };

  const active = deals.filter(d => !['Closed Won', 'Closed Lost'].includes(d.stage));
  const won = deals.filter(d => d.stage === 'Closed Won');
  const lost = deals.filter(d => d.stage === 'Closed Lost');
  const totalPipeline = active.reduce((s, d) => s + d.value, 0);
  const weightedPipeline = active.reduce((s, d) => s + (d.value * d.probability / 100), 0);
  const winRate = (won.length + lost.length) > 0 ? ((won.length / (won.length + lost.length)) * 100).toFixed(0) : '0';

  const chartData = STAGES.map(stage => ({
    stage,
    value: deals.filter(d => d.stage === stage).reduce((s, d) => s + d.value, 0) / 100000,
  }));

  const filtered = deals.filter(d => {
    if (stageFilter !== 'All' && d.stage !== stageFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return d.name.toLowerCase().includes(q) || d.company.toLowerCase().includes(q) || d.contact.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="rounded-xl p-6 text-white" style={{ background: 'linear-gradient(135deg, #10B981 0%, #3B82F6 100%)' }}>
        <div className="flex items-center gap-3 mb-2">
          <FiDollarSign className="w-6 h-6" />
          <h1 className="text-2xl font-bold">CRM Deals Pipeline</h1>
        </div>
        <p className="text-white/80 text-sm">Track your deals across the sales pipeline stages</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Pipeline', value: `₹${(totalPipeline / 100000).toFixed(1)}L`, icon: FiDollarSign, color: 'text-green-500' },
          { label: 'Weighted Value', value: `₹${(weightedPipeline / 100000).toFixed(1)}L`, icon: FiTrendingUp, color: 'text-emerald-500' },
          { label: 'Active Deals', value: active.length, icon: FiBriefcase, color: 'text-amber-500' },
          { label: 'Win Rate', value: `${winRate}%`, icon: FiTarget, color: 'text-teal-500' },
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

      {/* Chart */}
      <div className="thb-card p-4">
        <h3 className="font-semibold text-thb-text-primary mb-3">Deal Value by Stage (₹ Lakhs)</h3>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="stage" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => [`₹${v}L`, 'Value']} />
              <Bar dataKey="value" fill="#3B82F6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Search & Actions */}
      <div className="thb-card p-4">
        <div className="flex flex-col md:flex-row gap-3 items-start md:items-center justify-between">
          <div className="flex flex-1 gap-2 w-full md:w-auto">
            <div className="relative flex-1">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-thb-text-muted w-4 h-4" />
              <input type="text" placeholder="Search deals..." value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-9 pr-3 py-2 text-sm border border-thb-border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-white" />
            </div>
            <select value={stageFilter} onChange={e => setStageFilter(e.target.value)} className="px-3 py-2 text-sm border border-thb-border rounded-lg bg-white">
              <option value="All">All Stages</option>
              {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <div className="flex border border-thb-border rounded-lg overflow-hidden">
              <button onClick={() => setViewMode('pipeline')} className={`px-3 py-1.5 text-xs font-medium ${viewMode === 'pipeline' ? 'bg-green-500 text-white' : 'bg-white text-thb-text-secondary hover:bg-gray-50'}`}>Pipeline</button>
              <button onClick={() => setViewMode('list')} className={`px-3 py-1.5 text-xs font-medium ${viewMode === 'list' ? 'bg-green-500 text-white' : 'bg-white text-thb-text-secondary hover:bg-gray-50'}`}>List</button>
            </div>
            <button onClick={() => { setForm(emptyForm); setEditingId(null); setShowForm(true); }} className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 text-sm font-medium">
              <FiPlus className="w-4 h-4" /> Add Deal
            </button>
          </div>
        </div>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div className="thb-card p-4 border-l-4 border-l-emerald-500">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-thb-text-primary">{editingId ? 'Edit Deal' : 'Add New Deal'}</h3>
            <button onClick={() => { setShowForm(false); setEditingId(null); }} className="text-thb-text-muted hover:text-thb-text-primary"><FiX className="w-5 h-5" /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input type="text" placeholder="Deal Name *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="px-3 py-2 text-sm border border-thb-border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
            <input type="number" placeholder="Value (₹) *" value={form.value} onChange={e => setForm({ ...form, value: e.target.value })} className="px-3 py-2 text-sm border border-thb-border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
            <input type="text" placeholder="Contact" value={form.contact} onChange={e => setForm({ ...form, contact: e.target.value })} className="px-3 py-2 text-sm border border-thb-border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
            <input type="text" placeholder="Company" value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} className="px-3 py-2 text-sm border border-thb-border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
            <select value={form.stage} onChange={e => setForm({ ...form, stage: e.target.value })} className="px-3 py-2 text-sm border border-thb-border rounded-lg bg-white">
              {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <input type="number" placeholder="Probability %" min="0" max="100" value={form.probability} onChange={e => setForm({ ...form, probability: e.target.value })} className="px-3 py-2 text-sm border border-thb-border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
            <input type="date" value={form.closeDate} onChange={e => setForm({ ...form, closeDate: e.target.value })} className="px-3 py-2 text-sm border border-thb-border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
            <textarea placeholder="Description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="px-3 py-2 text-sm border border-thb-border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 md:col-span-2" rows={1} />
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={handleSave} className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 text-sm font-medium">Save</button>
            <button onClick={() => { setShowForm(false); setEditingId(null); }} className="px-4 py-2 border border-thb-border rounded-lg hover:bg-gray-50 text-sm">Cancel</button>
          </div>
        </div>
      )}

      {/* Pipeline View */}
      {viewMode === 'pipeline' ? (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 max-h-[500px] overflow-x-auto">
          {STAGES.map(stage => {
            const stageDeals = filtered.filter(d => d.stage === stage);
            return (
              <div key={stage} className="flex flex-col">
                <div className="flex items-center justify-between mb-2 px-1">
                  <h4 className="text-xs font-semibold text-thb-text-secondary uppercase tracking-wide">{stage}</h4>
                  <span className="thb-badge thb-badge-info text-[10px]">{stageDeals.length}</span>
                </div>
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {stageDeals.map(d => (
                    <div key={d.id} className={`thb-card p-3 border-l-4 ${STAGE_COLORS[d.stage]}`}>
                      <h5 className="font-medium text-sm text-thb-text-primary truncate">{d.name}</h5>
                      <p className="text-xs text-thb-text-muted mt-0.5">{d.company}</p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-sm font-bold text-thb-text-primary">₹{(d.value / 100000).toFixed(1)}L</span>
                        <span className={STAGE_BADGES[d.stage]}>{d.probability}%</span>
                      </div>
                      <div className="flex items-center gap-1 mt-1 text-[10px] text-thb-text-muted">
                        <FiCalendar className="w-3 h-3" /> {d.closeDate}
                      </div>
                      <div className="flex gap-1 mt-2 pt-2 border-t border-thb-border">
                        <button onClick={() => startEdit(d)} className="p-1 rounded hover:bg-green-50 text-green-500"><FiEdit2 className="w-3 h-3" /></button>
                        <button onClick={() => handleDelete(d.id)} className="p-1 rounded hover:bg-red-50 text-red-500"><FiTrash2 className="w-3 h-3" /></button>
                      </div>
                    </div>
                  ))}
                  {stageDeals.length === 0 && <p className="text-xs text-thb-text-muted text-center py-4">No deals</p>}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* List View */
        <div className="thb-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-thb-border bg-gray-50">
                  <th className="text-left p-3 text-thb-text-secondary font-medium">Deal</th>
                  <th className="text-left p-3 text-thb-text-secondary font-medium">Company</th>
                  <th className="text-left p-3 text-thb-text-secondary font-medium">Value</th>
                  <th className="text-left p-3 text-thb-text-secondary font-medium">Stage</th>
                  <th className="text-left p-3 text-thb-text-secondary font-medium">Probability</th>
                  <th className="text-left p-3 text-thb-text-secondary font-medium">Close Date</th>
                  <th className="text-left p-3 text-thb-text-secondary font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(d => (
                  <tr key={d.id} className="border-b border-thb-border hover:bg-gray-50">
                    <td className="p-3 font-medium text-thb-text-primary">{d.name}</td>
                    <td className="p-3 text-thb-text-secondary">{d.company}</td>
                    <td className="p-3 font-semibold text-thb-text-primary">₹{(d.value / 100000).toFixed(1)}L</td>
                    <td className="p-3"><span className={STAGE_BADGES[d.stage]}>{d.stage}</span></td>
                    <td className="p-3 text-thb-text-primary">{d.probability}%</td>
                    <td className="p-3 text-thb-text-secondary">{d.closeDate}</td>
                    <td className="p-3">
                      <div className="flex gap-1">
                        <button onClick={() => startEdit(d)} className="p-1 rounded hover:bg-green-50 text-green-500"><FiEdit2 className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleDelete(d.id)} className="p-1 rounded hover:bg-red-50 text-red-500"><FiTrash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
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
