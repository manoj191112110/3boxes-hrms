'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  FiWifi, FiServer, FiShield, FiRadio, FiSearch,
  FiPlus, FiX, FiEdit2, FiMapPin, FiClock, FiActivity,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { isClientDemoMode } from '@/lib/site-mode';
import { useAuthStore } from '@/store/authStore';

/* ================================================================
   Network Management – 3Boxes HRMS IT Admin
   ================================================================ */

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

type NetType = 'router' | 'switch' | 'firewall' | 'access_point';
type NetStatus = 'online' | 'offline' | 'warning';

interface NetworkDevice {
  id: string;
  name: string;
  type: NetType;
  ip: string;
  status: NetStatus;
  location: string;
  uptime: string;
}

const TYPE_ICON: Record<NetType, React.ReactNode> = {
  router: <FiWifi className="w-5 h-5" />,
  switch: <FiServer className="w-5 h-5" />,
  firewall: <FiShield className="w-5 h-5" />,
  access_point: <FiRadio className="w-5 h-5" />,
};

const TYPE_LABEL: Record<NetType, string> = {
  router: 'Router', switch: 'Switch', firewall: 'Firewall', access_point: 'Access Point',
};

const STATUS_CFG: Record<NetStatus, { bg: string; text: string; dot: string; ring: string }> = {
  online:  { bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500', ring: 'ring-emerald-400' },
  offline: { bg: 'bg-red-100', text: 'text-red-700', dot: 'bg-red-500', ring: 'ring-red-400' },
  warning: { bg: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-500', ring: 'ring-amber-400' },
};

const EMPTY_FORM: Omit<NetworkDevice, 'id'> = {
  name: '', type: 'router', ip: '', status: 'online', location: '', uptime: '0d 0h',
};

function getDemoNetworkDevices(): NetworkDevice[] {
  if (!isClientDemoMode()) return [];
  return [
    { id: '1', name: 'Core Router R1', type: 'router', ip: '10.0.0.1', status: 'online', location: 'Server Room A', uptime: '142d 7h' },
    { id: '2', name: 'Core Router R2', type: 'router', ip: '10.0.0.2', status: 'online', location: 'Server Room B', uptime: '142d 7h' },
    { id: '3', name: 'Distribution Switch SW-1', type: 'switch', ip: '10.0.1.1', status: 'online', location: 'Floor 1 MDF', uptime: '89d 3h' },
    { id: '4', name: 'Distribution Switch SW-2', type: 'switch', ip: '10.0.2.1', status: 'warning', location: 'Floor 2 MDF', uptime: '5d 12h' },
    { id: '5', name: 'Edge Firewall FW-01', type: 'firewall', ip: '10.0.0.254', status: 'online', location: 'Server Room A', uptime: '200d 0h' },
    { id: '6', name: 'Internal Firewall FW-02', type: 'firewall', ip: '10.0.0.253', status: 'online', location: 'Server Room B', uptime: '200d 0h' },
    { id: '7', name: 'WiFi AP - Lobby', type: 'access_point', ip: '10.0.10.1', status: 'online', location: 'Main Lobby', uptime: '45d 18h' },
    { id: '8', name: 'WiFi AP - Floor 3 East', type: 'access_point', ip: '10.0.10.5', status: 'offline', location: 'Floor 3 East Wing', uptime: '0d 0h' },
    { id: '9', name: 'Access Switch SW-3F', type: 'switch', ip: '10.0.3.1', status: 'online', location: 'Floor 3 IDF', uptime: '67d 9h' },
    { id: '10', name: 'WiFi AP - Cafeteria', type: 'access_point', ip: '10.0.10.8', status: 'warning', location: 'Cafeteria', uptime: '2d 4h' },
  ];
}

export default function NetworkManagementPage() {
  useAuthStore();
  const [devices, setDevices] = useState<NetworkDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<NetworkDevice | null>(null);
  const [form, setForm] = useState<Omit<NetworkDevice, 'id'>>(EMPTY_FORM);

  const fetchDevices = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/assets?type=network', { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) { setDevices(data); setLoading(false); return; }
      }
    } catch { /* fallback */ }
    setDevices(getDemoNetworkDevices());
    setLoading(false);
  }, []);

  useEffect(() => { queueMicrotask(() => fetchDevices()); }, [fetchDevices]);

  const filtered = devices.filter(d => {
    const q = search.toLowerCase();
    return d.name.toLowerCase().includes(q) || d.ip.includes(q) || d.location.toLowerCase().includes(q);
  });

  const onlineCount = devices.filter(d => d.status === 'online').length;
  const offlineCount = devices.filter(d => d.status === 'offline').length;
  const warningCount = devices.filter(d => d.status === 'warning').length;

  function openAdd() { setEditing(null); setForm(EMPTY_FORM); setShowForm(true); }
  function openEdit(d: NetworkDevice) { setEditing(d); setForm({ name: d.name, type: d.type, ip: d.ip, status: d.status, location: d.location, uptime: d.uptime }); setShowForm(true); }
  function closeForm() { setShowForm(false); setEditing(null); }

  function handleSave() {
    if (!form.name || !form.ip) { toast.error('Name and IP are required'); return; }
    if (editing) {
      setDevices(prev => prev.map(d => d.id === editing.id ? { ...d, ...form } : d));
      toast.success('Network device updated');
    } else {
      setDevices(prev => [...prev, { id: `nd-${Date.now()}`, ...form }]);
      toast.success('Network device added');
    }
    closeForm();
  }

  function handleDelete(id: string) {
    setDevices(prev => prev.filter(d => d.id !== id));
    toast.success('Network device removed');
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-thb-text-primary">Network Management</h1>
          <p className="text-sm text-thb-text-secondary mt-1">Monitor and manage network infrastructure devices</p>
        </div>
        <button onClick={openAdd} className="inline-flex items-center gap-2 px-4 py-2 bg-thb-primary text-white rounded-lg text-sm font-medium hover:opacity-90 transition">
          <FiPlus className="w-4 h-4" /> Add Device
        </button>
      </div>

      {/* Topology Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="thb-card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-50 text-thb-primary"><FiWifi /></div>
            <div><p className="text-2xl font-bold text-thb-text-primary">{devices.length}</p><p className="text-xs text-thb-text-muted">Total Devices</p></div>
          </div>
        </div>
        <div className="thb-card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600"><FiActivity /></div>
            <div><p className="text-2xl font-bold text-emerald-600">{onlineCount}</p><p className="text-xs text-thb-text-muted">Online</p></div>
          </div>
        </div>
        <div className="thb-card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-50 text-amber-600"><FiActivity /></div>
            <div><p className="text-2xl font-bold text-amber-600">{warningCount}</p><p className="text-xs text-thb-text-muted">Warning</p></div>
          </div>
        </div>
        <div className="thb-card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-50 text-red-600"><FiActivity /></div>
            <div><p className="text-2xl font-bold text-red-600">{offlineCount}</p><p className="text-xs text-thb-text-muted">Offline</p></div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="thb-card p-4">
        <div className="relative">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-thb-text-muted w-4 h-4" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, IP, or location..." className="w-full pl-9 pr-3 py-2 border border-thb-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-thb-primary/20" />
        </div>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div className="thb-card p-4 md:p-6 border-l-4 border-l-thb-primary animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-thb-text-primary">{editing ? 'Edit Network Device' : 'Add Network Device'}</h3>
            <button onClick={closeForm} className="p-1 hover:bg-slate-100 rounded"><FiX className="w-4 h-4 text-thb-text-muted" /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-medium text-thb-text-secondary mb-1 block">Device Name <span className="text-red-500 font-bold">*</span></label>
              <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="w-full px-3 py-2 border border-thb-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-thb-primary/20" />
            </div>
            <div>
              <label className="text-xs font-medium text-thb-text-secondary mb-1 block">Type</label>
              <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value as NetType }))} className="w-full px-3 py-2 border border-thb-border rounded-lg text-sm focus:outline-none">
                <option value="router">Router</option><option value="switch">Switch</option><option value="firewall">Firewall</option><option value="access_point">Access Point</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-thb-text-secondary mb-1 block">IP Address <span className="text-red-500 font-bold">*</span></label>
              <input value={form.ip} onChange={e => setForm(p => ({ ...p, ip: e.target.value }))} placeholder="10.0.0.1" className="w-full px-3 py-2 border border-thb-border rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-thb-primary/20" />
            </div>
            <div>
              <label className="text-xs font-medium text-thb-text-secondary mb-1 block">Status</label>
              <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value as NetStatus }))} className="w-full px-3 py-2 border border-thb-border rounded-lg text-sm focus:outline-none">
                <option value="online">Online</option><option value="offline">Offline</option><option value="warning">Warning</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-thb-text-secondary mb-1 block">Location</label>
              <input value={form.location} onChange={e => setForm(p => ({ ...p, location: e.target.value }))} placeholder="e.g. Server Room A" className="w-full px-3 py-2 border border-thb-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-thb-primary/20" />
            </div>
            <div>
              <label className="text-xs font-medium text-thb-text-secondary mb-1 block">Uptime</label>
              <input value={form.uptime} onChange={e => setForm(p => ({ ...p, uptime: e.target.value }))} placeholder="e.g. 45d 3h" className="w-full px-3 py-2 border border-thb-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-thb-primary/20" />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={handleSave} className="px-4 py-2 bg-thb-primary text-white rounded-lg text-sm font-medium hover:opacity-90">{editing ? 'Update' : 'Add'} Device</button>
            <button onClick={closeForm} className="px-4 py-2 border border-thb-border rounded-lg text-sm text-thb-text-secondary hover:bg-slate-50">Cancel</button>
          </div>
        </div>
      )}

      {/* Network Device List */}
      {loading ? (
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="thb-card p-5 animate-pulse"><div className="h-4 bg-slate-200 rounded w-1/3 mb-2" /><div className="h-3 bg-slate-200 rounded w-1/4" /></div>)}</div>
      ) : (
        <div className="space-y-3">
          {filtered.map(d => {
            const sc = STATUS_CFG[d.status];
            return (
              <div key={d.id} className="thb-card thb-card-hover p-4 md:p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-4">
                    <div className="relative p-3 rounded-lg bg-slate-50 text-thb-text-secondary">
                      {TYPE_ICON[d.type]}
                      <span className={`absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full ring-2 ring-white ${sc.dot}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-sm text-thb-text-primary">{d.name}</h4>
                        <span className={`thb-badge ${sc.bg} ${sc.text}`}>{d.status.charAt(0).toUpperCase() + d.status.slice(1)}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-thb-text-secondary">
                        <span className="flex items-center gap-1"><FiServer className="w-3 h-3" />{TYPE_LABEL[d.type]}</span>
                        <span className="font-mono">{d.ip}</span>
                        <span className="flex items-center gap-1"><FiMapPin className="w-3 h-3" />{d.location}</span>
                        <span className="flex items-center gap-1"><FiClock className="w-3 h-3" />{d.uptime}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(d)} className="p-1.5 hover:bg-slate-100 rounded text-thb-text-muted hover:text-thb-primary"><FiEdit2 className="w-3.5 h-3.5" /></button>
                    <button onClick={() => handleDelete(d.id)} className="p-1.5 hover:bg-red-50 rounded text-thb-text-muted hover:text-red-500"><FiX className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && <div className="text-center py-12 text-thb-text-muted">No network devices found.</div>}
        </div>
      )}
    </div>
  );
}
