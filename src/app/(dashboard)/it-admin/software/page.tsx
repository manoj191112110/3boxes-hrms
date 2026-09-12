'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  FiPackage, FiSearch, FiPlus, FiX, FiEdit2,
  FiAlertTriangle, FiCalendar, FiBriefcase,
} from 'react-icons/fi';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import toast from 'react-hot-toast';
import { isClientDemoMode } from '@/lib/site-mode';
import { useAuthStore } from '@/store/authStore';

/* ================================================================
   Software License Management – 3Boxes HRMS IT Admin
   ================================================================ */

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

type LicenseType = 'perpetual' | 'subscription';
type SwStatus = 'active' | 'expired' | 'expiring';

interface Software {
  id: string;
  name: string;
  vendor: string;
  licenseType: LicenseType;
  seats: number;
  usedSeats: number;
  expiryDate: string;
  status: SwStatus;
}

const STATUS_CFG: Record<SwStatus, { bg: string; text: string }> = {
  active:   { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  expired:  { bg: 'bg-red-100', text: 'text-red-700' },
  expiring: { bg: 'bg-amber-100', text: 'text-amber-700' },
};

const LICENSE_COLORS: Record<LicenseType, string> = {
  perpetual: '#3B82F6',
  subscription: '#8B5CF6',
};

const EMPTY_FORM: Omit<Software, 'id'> = {
  name: '', vendor: '', licenseType: 'subscription',
  seats: 10, usedSeats: 0, expiryDate: '', status: 'active',
};

function getDemoSoftware(): Software[] {
  if (!isClientDemoMode()) return [];
  const now = new Date();
  return [
    { id: '1', name: 'Microsoft 365 Business', vendor: 'Microsoft', licenseType: 'subscription', seats: 250, usedSeats: 218, expiryDate: new Date(now.getFullYear(), now.getMonth() + 6, 15).toISOString().slice(0, 10), status: 'active' },
    { id: '2', name: 'Adobe Creative Cloud', vendor: 'Adobe', licenseType: 'subscription', seats: 50, usedSeats: 47, expiryDate: new Date(now.getFullYear(), now.getMonth() + 1, 20).toISOString().slice(0, 10), status: 'expiring' },
    { id: '3', name: 'Slack Business+', vendor: 'Salesforce', licenseType: 'subscription', seats: 200, usedSeats: 185, expiryDate: new Date(now.getFullYear(), now.getMonth() + 9, 1).toISOString().slice(0, 10), status: 'active' },
    { id: '4', name: 'JetBrains All Products', vendor: 'JetBrains', licenseType: 'subscription', seats: 30, usedSeats: 28, expiryDate: new Date(now.getFullYear(), now.getMonth() + 2, 5).toISOString().slice(0, 10), status: 'expiring' },
    { id: '5', name: 'AutoCAD 2024', vendor: 'Autodesk', licenseType: 'perpetual', seats: 10, usedSeats: 10, expiryDate: '2099-12-31', status: 'active' },
    { id: '6', name: 'Zoom Business', vendor: 'Zoom', licenseType: 'subscription', seats: 100, usedSeats: 72, expiryDate: new Date(now.getFullYear(), now.getMonth() + 11, 30).toISOString().slice(0, 10), status: 'active' },
    { id: '7', name: 'SAP ERP License', vendor: 'SAP', licenseType: 'perpetual', seats: 20, usedSeats: 20, expiryDate: '2099-12-31', status: 'active' },
    { id: '8', name: 'Norton Security', vendor: 'NortonLifeLock', licenseType: 'subscription', seats: 300, usedSeats: 256, expiryDate: new Date(now.getFullYear() - 1, now.getMonth(), 1).toISOString().slice(0, 10), status: 'expired' },
  ];
}

function getExpiringSoon(software: Software[]) {
  const now = new Date();
  const thirtyDays = 30 * 24 * 60 * 60 * 1000;
  return software.filter(s => {
    if (s.status === 'expired') return false;
    const exp = new Date(s.expiryDate).getTime();
    return exp - now.getTime() < thirtyDays && exp > now.getTime();
  });
}

export default function SoftwareLicensePage() {
  useAuthStore();
  const [software, setSoftware] = useState<Software[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Software | null>(null);
  const [form, setForm] = useState<Omit<Software, 'id'>>(EMPTY_FORM);

  const fetchSoftware = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/assets?type=software', { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) { setSoftware(data); setLoading(false); return; }
      }
    } catch { /* fallback */ }
    setSoftware(getDemoSoftware());
    setLoading(false);
  }, []);

  useEffect(() => { queueMicrotask(() => fetchSoftware()); }, [fetchSoftware]);

  const filtered = software.filter(s => {
    const q = search.toLowerCase();
    return s.name.toLowerCase().includes(q) || s.vendor.toLowerCase().includes(q);
  });

  const expiringSoon = getExpiringSoon(software);
  const totalSeats = software.reduce((a, s) => a + s.seats, 0);
  const totalUsed = software.reduce((a, s) => a + s.usedSeats, 0);
  const activeCount = software.filter(s => s.status === 'active').length;
  const expiredCount = software.filter(s => s.status === 'expired').length;

  const pieData = [
    { name: 'Perpetual', value: software.filter(s => s.licenseType === 'perpetual').length },
    { name: 'Subscription', value: software.filter(s => s.licenseType === 'subscription').length },
  ];

  function openAdd() { setEditing(null); setForm(EMPTY_FORM); setShowForm(true); }
  function openEdit(s: Software) { setEditing(s); setForm({ name: s.name, vendor: s.vendor, licenseType: s.licenseType, seats: s.seats, usedSeats: s.usedSeats, expiryDate: s.expiryDate, status: s.status }); setShowForm(true); }
  function closeForm() { setShowForm(false); setEditing(null); }

  function handleSave() {
    if (!form.name || !form.vendor) { toast.error('Name and Vendor are required'); return; }
    if (editing) {
      setSoftware(prev => prev.map(s => s.id === editing.id ? { ...s, ...form } : s));
      toast.success('Software updated');
    } else {
      setSoftware(prev => [...prev, { id: `sw-${Date.now()}`, ...form }]);
      toast.success('Software added');
    }
    closeForm();
  }

  function handleDelete(id: string) {
    setSoftware(prev => prev.filter(s => s.id !== id));
    toast.success('Software removed');
  }

  function UtilizationBar({ used, total }: { used: number; total: number }) {
    const pct = total > 0 ? Math.round((used / total) * 100) : 0;
    const color = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-emerald-500';
    return (
      <div className="w-full">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-thb-text-muted">{used}/{total} seats</span>
          <span className={`font-medium ${pct >= 90 ? 'text-red-600' : 'text-thb-text-secondary'}`}>{pct}%</span>
        </div>
        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-thb-text-primary">Software Licenses</h1>
          <p className="text-sm text-thb-text-secondary mt-1">Manage software licenses, usage, and renewals</p>
        </div>
        <button onClick={openAdd} className="inline-flex items-center gap-2 px-4 py-2 bg-thb-primary text-white rounded-lg text-sm font-medium hover:opacity-90 transition">
          <FiPlus className="w-4 h-4" /> Add Software
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="thb-card p-4"><div className="flex items-center gap-3"><div className="p-2 rounded-lg bg-green-50 text-thb-primary"><FiPackage /></div><div><p className="text-2xl font-bold text-thb-text-primary">{software.length}</p><p className="text-xs text-thb-text-muted">Total Software</p></div></div></div>
        <div className="thb-card p-4"><div className="flex items-center gap-3"><div className="p-2 rounded-lg bg-emerald-50 text-emerald-600"><FiBriefcase /></div><div><p className="text-2xl font-bold text-emerald-600">{activeCount}</p><p className="text-xs text-thb-text-muted">Active</p></div></div></div>
        <div className="thb-card p-4"><div className="flex items-center gap-3"><div className="p-2 rounded-lg bg-red-50 text-red-600"><FiAlertTriangle /></div><div><p className="text-2xl font-bold text-red-600">{expiredCount}</p><p className="text-xs text-thb-text-muted">Expired</p></div></div></div>
        <div className="thb-card p-4"><div className="flex items-center gap-3"><div className="p-2 rounded-lg bg-teal-50 text-teal-600"><FiPackage /></div><div><p className="text-2xl font-bold text-thb-text-primary">{totalSeats > 0 ? Math.round((totalUsed / totalSeats) * 100) : 0}%</p><p className="text-xs text-thb-text-muted">Seat Utilization</p></div></div></div>
      </div>

      {/* Expiry Alerts */}
      {expiringSoon.length > 0 && (
        <div className="thb-card p-4 border-l-4 border-l-amber-400">
          <div className="flex items-center gap-2 mb-2"><FiAlertTriangle className="w-4 h-4 text-amber-500" /><h3 className="font-semibold text-sm text-thb-text-primary">Expiring Soon ({expiringSoon.length})</h3></div>
          <div className="flex flex-wrap gap-2">
            {expiringSoon.map(s => (
              <span key={s.id} className="thb-badge bg-amber-100 text-amber-700 flex items-center gap-1">
                <FiCalendar className="w-3 h-3" />{s.name} — {s.expiryDate}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* License Type Pie Chart */}
        <div className="thb-card p-4 md:p-6">
          <h3 className="font-semibold text-thb-text-primary mb-3">License Distribution</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                  {pieData.map((entry, i) => <Cell key={i} fill={LICENSE_COLORS[entry.name.toLowerCase() as LicenseType]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Software List */}
        <div className="lg:col-span-2">
          {/* Search */}
          <div className="thb-card p-4 mb-4">
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-thb-text-muted w-4 h-4" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search software or vendor..." className="w-full pl-9 pr-3 py-2 border border-thb-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-thb-primary/20" />
            </div>
          </div>

          {/* Inline Form */}
          {showForm && (
            <div className="thb-card p-4 md:p-6 border-l-4 border-l-thb-primary mb-4 animate-fade-in">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-thb-text-primary">{editing ? 'Edit Software' : 'Add Software'}</h3>
                <button onClick={closeForm} className="p-1 hover:bg-slate-100 rounded"><FiX className="w-4 h-4 text-thb-text-muted" /></button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                <div><label className="text-xs font-medium text-thb-text-secondary mb-1 block">Name <span className="text-red-500 font-bold">*</span></label><input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="w-full px-3 py-2 border border-thb-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-thb-primary/20" /></div>
                <div><label className="text-xs font-medium text-thb-text-secondary mb-1 block">Vendor <span className="text-red-500 font-bold">*</span></label><input value={form.vendor} onChange={e => setForm(p => ({ ...p, vendor: e.target.value }))} className="w-full px-3 py-2 border border-thb-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-thb-primary/20" /></div>
                <div><label className="text-xs font-medium text-thb-text-secondary mb-1 block">License Type</label><select value={form.licenseType} onChange={e => setForm(p => ({ ...p, licenseType: e.target.value as LicenseType }))} className="w-full px-3 py-2 border border-thb-border rounded-lg text-sm focus:outline-none"><option value="perpetual">Perpetual</option><option value="subscription">Subscription</option></select></div>
                <div><label className="text-xs font-medium text-thb-text-secondary mb-1 block">Total Seats</label><input type="number" value={form.seats} onChange={e => setForm(p => ({ ...p, seats: +e.target.value }))} className="w-full px-3 py-2 border border-thb-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-thb-primary/20" /></div>
                <div><label className="text-xs font-medium text-thb-text-secondary mb-1 block">Used Seats</label><input type="number" value={form.usedSeats} onChange={e => setForm(p => ({ ...p, usedSeats: +e.target.value }))} className="w-full px-3 py-2 border border-thb-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-thb-primary/20" /></div>
                <div><label className="text-xs font-medium text-thb-text-secondary mb-1 block">Expiry Date</label><input type="date" value={form.expiryDate} onChange={e => setForm(p => ({ ...p, expiryDate: e.target.value }))} className="w-full px-3 py-2 border border-thb-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-thb-primary/20" /></div>
              </div>
              <div className="flex gap-2 mt-4">
                <button onClick={handleSave} className="px-4 py-2 bg-thb-primary text-white rounded-lg text-sm font-medium hover:opacity-90">{editing ? 'Update' : 'Add'}</button>
                <button onClick={closeForm} className="px-4 py-2 border border-thb-border rounded-lg text-sm text-thb-text-secondary hover:bg-slate-50">Cancel</button>
              </div>
            </div>
          )}

          {/* List */}
          {loading ? (
            <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="thb-card p-5 animate-pulse"><div className="h-4 bg-slate-200 rounded w-1/3 mb-2" /><div className="h-3 bg-slate-200 rounded w-1/2" /></div>)}</div>
          ) : (
            <div className="space-y-3">
              {filtered.map(s => {
                const sc = STATUS_CFG[s.status];
                return (
                  <div key={s.id} className="thb-card thb-card-hover p-4 md:p-5">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-semibold text-sm text-thb-text-primary">{s.name}</h4>
                          <span className={`thb-badge ${sc.bg} ${sc.text}`}>{s.status.charAt(0).toUpperCase() + s.status.slice(1)}</span>
                          <span className="thb-badge bg-slate-100 text-slate-600">{s.licenseType === 'perpetual' ? 'Perpetual' : 'Subscription'}</span>
                        </div>
                        <p className="text-xs text-thb-text-muted mb-3">{s.vendor}</p>
                        <div className="max-w-xs"><UtilizationBar used={s.usedSeats} total={s.seats} /></div>
                        {s.expiryDate && s.expiryDate !== '2099-12-31' && (
                          <p className="text-xs text-thb-text-muted mt-2 flex items-center gap-1"><FiCalendar className="w-3 h-3" />Expires: {s.expiryDate}</p>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => openEdit(s)} className="p-1.5 hover:bg-slate-100 rounded text-thb-text-muted hover:text-thb-primary"><FiEdit2 className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleDelete(s.id)} className="p-1.5 hover:bg-red-50 rounded text-thb-text-muted hover:text-red-500"><FiX className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                  </div>
                );
              })}
              {filtered.length === 0 && <div className="text-center py-12 text-thb-text-muted">No software found.</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
