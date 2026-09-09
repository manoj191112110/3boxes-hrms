'use client';

import { useState, useEffect } from 'react';
import {
  FiClock, FiSearch, FiPlus, FiX, FiPhone, FiMail,
  FiUsers, FiCheckSquare, FiFileText, FiCalendar, FiFilter,
  FiChevronDown, FiCheck, FiCircle,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { isClientDemoMode } from '@/lib/site-mode';
import { useAuthStore } from '@/store/authStore';
import { useAutoSeedDemo } from '@/hooks/useAutoSeedDemo';

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

interface Activity {
  id: number;
  type: string;
  title: string;
  description: string;
  contact: string;
  deal: string;
  date: string;
  time: string;
  duration: string;
  status: string;
  outcome: string;
  createdBy: string;
}

const DEMO_ACTIVITIES: Activity[] = isClientDemoMode() ? [
  { id: 1, type: 'call', title: 'Discovery call with Rajesh Kumar', description: 'Discussed SaaS platform requirements and pricing expectations.', contact: 'Rajesh Kumar', deal: 'Enterprise SaaS Platform', date: '2025-07-01', time: '10:30 AM', duration: '32 min', status: 'completed', outcome: 'Positive — scheduling follow-up demo', createdBy: 'Arjun Mehta' },
  { id: 2, type: 'email', title: 'Revised proposal sent to DataCore', description: 'Sent updated proposal with revised pricing tiers.', contact: 'Sneha Iyer', deal: 'Cloud Migration Project', date: '2025-07-01', time: '2:15 PM', duration: '', status: 'completed', outcome: 'Awaiting response', createdBy: 'Sneha Iyer' },
  { id: 3, type: 'meeting', title: 'Product demo for GreenLeaf Corp.', description: 'Conducted live product demo for manufacturing use cases.', contact: 'Vikram Patel', deal: 'Digital Transformation', date: '2025-06-30', time: '11:00 AM', duration: '1 hr', status: 'completed', outcome: 'Very engaged — moving to negotiation', createdBy: 'Vikram Patel' },
  { id: 4, type: 'task', title: 'Prepare competitive analysis for MegaSoft', description: 'Research competitor pricing and feature comparisons.', contact: 'Priya Sharma', deal: 'Analytics Platform', date: '2025-07-02', time: '', duration: '', status: 'pending', outcome: '', createdBy: 'Priya Sharma' },
  { id: 5, type: 'note', title: 'Key requirements noted from BuildRight call', description: 'They need custom reporting module and API integrations.', contact: 'Amit Desai', deal: 'CRM Implementation', date: '2025-06-29', time: '', duration: '', status: 'completed', outcome: '', createdBy: 'Arjun Mehta' },
  { id: 7, type: 'meeting', title: 'Quarterly business review with BuildRight', description: 'Q2 performance review and Q3 planning session.', contact: 'Amit Desai', deal: 'CRM Implementation', date: '2025-07-03', time: '2:00 PM', duration: '1.5 hr', status: 'scheduled', outcome: '', createdBy: 'Arjun Mehta' },
] : [];

const ACTIVITY_TYPES = [
  { key: 'call', label: 'Call', icon: FiPhone, color: 'text-green-500', bg: 'bg-green-50', border: 'border-green-200' },
  { key: 'email', label: 'Email', icon: FiMail, color: 'text-emerald-500', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  { key: 'meeting', label: 'Meeting', icon: FiUsers, color: 'text-teal-500', bg: 'bg-teal-50', border: 'border-teal-200' },
  { key: 'task', label: 'Task', icon: FiCheckSquare, color: 'text-amber-500', bg: 'bg-amber-50', border: 'border-amber-200' },
  { key: 'note', label: 'Note', icon: FiFileText, color: 'text-slate-500', bg: 'bg-slate-50', border: 'border-slate-200' },
];

const STATUS_ICONS: Record<string, typeof FiCheck> = {
  completed: FiCheck, pending: FiCircle, scheduled: FiClock,
};

const STATUS_BADGES: Record<string, string> = {
  completed: 'thb-badge thb-badge-success', pending: 'thb-badge thb-badge-warning', scheduled: 'thb-badge thb-badge-info',
};

const emptyForm = { type: 'call', title: '', description: '', contact: '', deal: '', date: '', time: '', duration: '' };

export default function CRMActivitiesPage() {
  useAuthStore();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showForm, setShowForm] = useState(false);
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
        if (typeFilter !== 'all') params.set('type', typeFilter);
        const res = await fetch(`/api/crm/activities?${params.toString()}`, { headers: getAuthHeaders() });
        if (!res.ok) throw new Error('Failed to fetch');
        const data = await res.json();
        if (!cancelled) setActivities(data.activities?.length ? data.activities : DEMO_ACTIVITIES);
      } catch {
        if (!cancelled) setActivities(DEMO_ACTIVITIES);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [search, typeFilter, refreshKey]);

  const handleSave = async () => {
    if (!form.title || !form.date) {
      toast.error('Title and date are required');
      return;
    }
    try {
      const res = await fetch('/api/crm/activities', { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(form) });
      if (!res.ok) throw new Error('Failed to create');
      toast.success('Activity created successfully');
      setShowForm(false); setForm(emptyForm); setRefreshKey(k => k + 1);
    } catch { toast.error('Failed to save activity'); }
  };

  const getTypeConfig = (type: string) => ACTIVITY_TYPES.find(t => t.key === type) || ACTIVITY_TYPES[4];

  const filtered = activities.filter(a => {
    if (typeFilter !== 'all' && a.type !== typeFilter) return false;
    if (dateFrom && a.date < dateFrom) return false;
    if (dateTo && a.date > dateTo) return false;
    if (search) {
      const q = search.toLowerCase();
      return a.title.toLowerCase().includes(q) || a.contact.toLowerCase().includes(q) || a.description.toLowerCase().includes(q);
    }
    return true;
  });

  // Group by date
  const grouped = filtered.reduce((acc, a) => {
    const key = a.date;
    if (!acc[key]) acc[key] = [];
    acc[key].push(a);
    return acc;
  }, {} as Record<string, Activity[]>);

  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  const callCount = activities.filter(a => a.type === 'call').length;
  const emailCount = activities.filter(a => a.type === 'email').length;
  const meetingCount = activities.filter(a => a.type === 'meeting').length;
  const taskCount = activities.filter(a => a.type === 'task').length;
  const completedCount = activities.filter(a => a.status === 'completed').length;

  const formatDate = (d: string) => {
    try { return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' }); } catch { return d; }
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="rounded-xl p-6 text-white" style={{ background: 'linear-gradient(135deg, #F59E0B 0%, #EF4444 100%)' }}>
        <div className="flex items-center gap-3 mb-2">
          <FiClock className="w-6 h-6" />
          <h1 className="text-2xl font-bold">CRM Activities</h1>
        </div>
        <p className="text-white/80 text-sm">Track all your calls, emails, meetings, tasks, and notes</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Calls', value: callCount, icon: FiPhone, color: 'text-green-500' },
          { label: 'Emails', value: emailCount, icon: FiMail, color: 'text-emerald-500' },
          { label: 'Meetings', value: meetingCount, icon: FiUsers, color: 'text-teal-500' },
          { label: 'Tasks', value: taskCount, icon: FiCheckSquare, color: 'text-amber-500' },
          { label: 'Completed', value: completedCount, icon: FiCheck, color: 'text-green-500' },
        ].map((s, i) => (
          <div key={i} className="thb-card p-4 flex items-center gap-3">
            <s.icon className={`w-6 h-6 ${s.color}`} />
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
              <input type="text" placeholder="Search activities..." value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-9 pr-3 py-2 text-sm border border-thb-border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-white" />
            </div>
            <button onClick={() => setShowFilters(!showFilters)} className="flex items-center gap-1 px-3 py-2 text-sm border border-thb-border rounded-lg hover:bg-gray-50">
              <FiFilter className="w-4 h-4" /> <FiChevronDown className="w-3 h-3" />
            </button>
          </div>
          <button onClick={() => { setForm(emptyForm); setShowForm(true); }} className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 text-sm font-medium">
            <FiPlus className="w-4 h-4" /> Log Activity
          </button>
        </div>
        {showFilters && (
          <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-thb-border">
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="px-3 py-1.5 text-sm border border-thb-border rounded-lg bg-white">
              <option value="all">All Types</option>
              {ACTIVITY_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} placeholder="From" className="px-3 py-1.5 text-sm border border-thb-border rounded-lg bg-white" />
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} placeholder="To" className="px-3 py-1.5 text-sm border border-thb-border rounded-lg bg-white" />
            {(dateFrom || dateTo) && (
              <button onClick={() => { setDateFrom(''); setDateTo(''); }} className="px-2 py-1 text-xs text-red-500 hover:underline">Clear dates</button>
            )}
          </div>
        )}
      </div>

      {/* Add Form */}
      {showForm && (
        <div className="thb-card p-4 border-l-4 border-l-amber-500">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-thb-text-primary">Log New Activity</h3>
            <button onClick={() => setShowForm(false)} className="text-thb-text-muted hover:text-thb-text-primary"><FiX className="w-5 h-5" /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className="px-3 py-2 text-sm border border-thb-border rounded-lg bg-white">
              {ACTIVITY_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
            <input type="text" placeholder="Subject *" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="px-3 py-2 text-sm border border-thb-border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 md:col-span-2" />
            <textarea placeholder="Description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="px-3 py-2 text-sm border border-thb-border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 md:col-span-3" rows={2} />
            <input type="text" placeholder="Contact" value={form.contact} onChange={e => setForm({ ...form, contact: e.target.value })} className="px-3 py-2 text-sm border border-thb-border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
            <input type="text" placeholder="Deal" value={form.deal} onChange={e => setForm({ ...form, deal: e.target.value })} className="px-3 py-2 text-sm border border-thb-border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
            <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="px-3 py-2 text-sm border border-thb-border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
            <input type="text" placeholder="Time (e.g. 10:30 AM)" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} className="px-3 py-2 text-sm border border-thb-border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
            <input type="text" placeholder="Duration (e.g. 30 min)" value={form.duration} onChange={e => setForm({ ...form, duration: e.target.value })} className="px-3 py-2 text-sm border border-thb-border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={handleSave} className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 text-sm font-medium">Save</button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 border border-thb-border rounded-lg hover:bg-gray-50 text-sm">Cancel</button>
          </div>
        </div>
      )}

      {/* Timeline */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => <div key={i} className="thb-card p-4 animate-pulse"><div className="h-4 bg-gray-200 rounded w-3/4 mb-2" /><div className="h-3 bg-gray-100 rounded w-1/2" /></div>)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="thb-card p-8 text-center">
          <FiClock className="w-12 h-12 text-thb-text-muted mx-auto mb-3" />
          <p className="text-thb-text-secondary">No activities found</p>
        </div>
      ) : (
        <div className="space-y-6 max-h-[600px] overflow-y-auto">
          {sortedDates.map(date => (
            <div key={date}>
              <div className="flex items-center gap-2 mb-3">
                <FiCalendar className="w-4 h-4 text-thb-text-muted" />
                <h3 className="text-sm font-semibold text-thb-text-primary">{formatDate(date)}</h3>
                <div className="flex-1 h-px bg-thb-border" />
              </div>
              <div className="space-y-3 ml-2 md:ml-4">
                {grouped[date].map(a => {
                  const cfg = getTypeConfig(a.type);
                  const StatusIcon = STATUS_ICONS[a.status] || FiCircle;
                  return (
                    <div key={a.id} className={`thb-card p-4 border-l-4 ${cfg.border} relative`}>
                      <div className="flex items-start gap-3">
                        <div className={`w-9 h-9 rounded-full ${cfg.bg} flex items-center justify-center shrink-0`}>
                          <cfg.icon className={`w-4 h-4 ${cfg.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-medium text-sm text-thb-text-primary">{a.title}</h4>
                            <span className={STATUS_BADGES[a.status] || 'thb-badge thb-badge-info'}>
                              <StatusIcon className="w-3 h-3 inline mr-1" />{a.status}
                            </span>
                          </div>
                          <p className="text-xs text-thb-text-secondary mt-1 line-clamp-2">{a.description}</p>
                          <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-thb-text-muted">
                            {a.contact && <span>👤 {a.contact}</span>}
                            {a.deal && <span>💼 {a.deal}</span>}
                            {a.time && <span>🕐 {a.time}</span>}
                            {a.duration && <span>⏱ {a.duration}</span>}
                          </div>
                          {a.outcome && (
                            <div className="mt-2 px-2 py-1 bg-green-50 border border-green-200 rounded text-xs text-green-700">
                              ✓ {a.outcome}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
