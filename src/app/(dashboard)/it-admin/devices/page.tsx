'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  FiMonitor, FiCpu, FiSmartphone, FiTablet, FiSearch,
  FiPlus, FiX, FiEdit2, FiTrash2, FiUser, FiCalendar,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import { isClientDemoMode } from '@/lib/site-mode';

/* ================================================================
   Device Management – 3Boxes HRMS IT Admin
   ================================================================ */

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

type DeviceType = 'laptop' | 'desktop' | 'phone' | 'tablet';
type DeviceStatus = 'available' | 'assigned' | 'repair' | 'retired';

interface Device {
  id: string;
  name: string;
  type: DeviceType;
  serialNumber: string;
  assignedTo: string;
  status: DeviceStatus;
  purchaseDate: string;
  warrantyEnd: string;
  os: string;
  ram: string;
  storage: string;
}

const TYPE_ICON: Record<DeviceType, React.ReactNode> = {
  laptop: <FiCpu className="w-5 h-5" />,
  desktop: <FiMonitor className="w-5 h-5" />,
  phone: <FiSmartphone className="w-5 h-5" />,
  tablet: <FiTablet className="w-5 h-5" />,
};

const STATUS_CFG: Record<DeviceStatus, { bg: string; text: string }> = {
  available: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  assigned: { bg: 'bg-green-100', text: 'text-green-700' },
  repair: { bg: 'bg-amber-100', text: 'text-amber-700' },
  retired: { bg: 'bg-slate-100', text: 'text-slate-600' },
};

const EMPTY_DEVICE: Omit<Device, 'id'> = {
  name: '', type: 'laptop', serialNumber: '', assignedTo: '',
  status: 'available', purchaseDate: '', warrantyEnd: '',
  os: '', ram: '8GB', storage: '256GB',
};

function getDemoDevices(): Device[] {
  if (!isClientDemoMode()) return [];
  return [
    { id: '1', name: 'ThinkPad X1 Carbon', type: 'laptop', serialNumber: 'TP-X1C-2024-001', assignedTo: 'Arun Kumar', status: 'assigned', purchaseDate: '2024-01-15', warrantyEnd: '2027-01-15', os: 'Windows 11 Pro', ram: '16GB', storage: '512GB SSD' },
    { id: '2', name: 'MacBook Pro 16"', type: 'laptop', serialNumber: 'MBP-16-2024-045', assignedTo: 'Priya Sharma', status: 'assigned', purchaseDate: '2024-03-10', warrantyEnd: '2027-03-10', os: 'macOS Sonoma', ram: '32GB', storage: '1TB SSD' },
    { id: '3', name: 'Dell OptiPlex 7090', type: 'desktop', serialNumber: 'DL-OP7090-023', assignedTo: '', status: 'available', purchaseDate: '2023-06-20', warrantyEnd: '2026-06-20', os: 'Windows 11 Pro', ram: '16GB', storage: '512GB SSD' },
    { id: '4', name: 'iPhone 15 Pro', type: 'phone', serialNumber: 'IP-15P-MOB-023', assignedTo: 'Rahul Verma', status: 'assigned', purchaseDate: '2024-02-01', warrantyEnd: '2025-02-01', os: 'iOS 17', ram: '8GB', storage: '256GB' },
    { id: '5', name: 'iPad Air M2', type: 'tablet', serialNumber: 'IPD-AIR-M2-007', assignedTo: '', status: 'repair', purchaseDate: '2023-11-10', warrantyEnd: '2025-11-10', os: 'iPadOS 17', ram: '8GB', storage: '128GB' },
    { id: '6', name: 'HP EliteDesk 800', type: 'desktop', serialNumber: 'HP-ED800-018', assignedTo: '', status: 'retired', purchaseDate: '2020-04-15', warrantyEnd: '2023-04-15', os: 'Windows 10 Pro', ram: '8GB', storage: '256GB SSD' },
    { id: '7', name: 'Samsung Galaxy S24', type: 'phone', serialNumber: 'SG-S24-MOB-042', assignedTo: 'Meera Desai', status: 'assigned', purchaseDate: '2024-05-01', warrantyEnd: '2026-05-01', os: 'Android 14', ram: '12GB', storage: '256GB' },
    { id: '8', name: 'Surface Pro 9', type: 'tablet', serialNumber: 'SF-PRO9-TAB-012', assignedTo: 'Vikram Patel', status: 'assigned', purchaseDate: '2024-01-25', warrantyEnd: '2026-01-25', os: 'Windows 11 Pro', ram: '16GB', storage: '512GB SSD' },
  ];
}

export default function DeviceManagementPage() {
  useAuthStore();
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<DeviceType | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<DeviceStatus | 'all'>('all');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Device | null>(null);
  const [form, setForm] = useState<Omit<Device, 'id'>>(EMPTY_DEVICE);

  const fetchDevices = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/assets?type=it', { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) { setDevices(data); setLoading(false); return; }
      }
    } catch { /* fallback */ }
    setDevices(getDemoDevices());
    setLoading(false);
  }, []);

  useEffect(() => { queueMicrotask(() => fetchDevices()); }, [fetchDevices]);

  const filtered = devices.filter(d => {
    const q = search.toLowerCase();
    const matchSearch = d.name.toLowerCase().includes(q) || d.serialNumber.toLowerCase().includes(q) || d.assignedTo.toLowerCase().includes(q);
    const matchType = filterType === 'all' || d.type === filterType;
    const matchStatus = filterStatus === 'all' || d.status === filterStatus;
    return matchSearch && matchType && matchStatus;
  });

  function openAdd() { setEditing(null); setForm(EMPTY_DEVICE); setShowForm(true); }
  function openEdit(d: Device) { setEditing(d); setForm({ name: d.name, type: d.type, serialNumber: d.serialNumber, assignedTo: d.assignedTo, status: d.status, purchaseDate: d.purchaseDate, warrantyEnd: d.warrantyEnd, os: d.os, ram: d.ram, storage: d.storage }); setShowForm(true); }
  function closeForm() { setShowForm(false); setEditing(null); }

  function handleSave() {
    if (!form.name || !form.serialNumber) { toast.error('Name and Serial Number are required'); return; }
    if (editing) {
      setDevices(prev => prev.map(d => d.id === editing.id ? { ...d, ...form } : d));
      toast.success('Device updated successfully');
    } else {
      const newDevice: Device = { id: `d-${Date.now()}`, ...form };
      setDevices(prev => [...prev, newDevice]);
      toast.success('Device added successfully');
    }
    closeForm();
  }

  function handleDelete(id: string) {
    setDevices(prev => prev.filter(d => d.id !== id));
    toast.success('Device removed');
  }

  const statCounts = {
    total: devices.length,
    available: devices.filter(d => d.status === 'available').length,
    assigned: devices.filter(d => d.status === 'assigned').length,
    repair: devices.filter(d => d.status === 'repair').length,
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-thb-text-primary">Device Management</h1>
          <p className="text-sm text-thb-text-secondary mt-1">Track and manage IT devices across the organization</p>
        </div>
        <button onClick={openAdd} className="inline-flex items-center gap-2 px-4 py-2 bg-thb-primary text-white rounded-lg text-sm font-medium hover:opacity-90 transition">
          <FiPlus className="w-4 h-4" /> Add Device
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Devices', value: statCounts.total, icon: <FiMonitor />, color: 'text-thb-primary', bg: 'bg-green-50' },
          { label: 'Available', value: statCounts.available, icon: <FiMonitor />, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Assigned', value: statCounts.assigned, icon: <FiUser />, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'In Repair', value: statCounts.repair, icon: <FiMonitor />, color: 'text-amber-600', bg: 'bg-amber-50' },
        ].map(s => (
          <div key={s.label} className="thb-card p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${s.bg} ${s.color}`}>{s.icon}</div>
              <div>
                <p className="text-2xl font-bold text-thb-text-primary">{s.value}</p>
                <p className="text-xs text-thb-text-muted">{s.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Search & Filter */}
      <div className="thb-card p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-thb-text-muted w-4 h-4" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search devices, serial numbers, assignees..." className="w-full pl-9 pr-3 py-2 border border-thb-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-thb-primary/20" />
          </div>
          <select value={filterType} onChange={e => setFilterType(e.target.value as DeviceType | 'all')} className="px-3 py-2 border border-thb-border rounded-lg text-sm text-thb-text-secondary focus:outline-none">
            <option value="all">All Types</option>
            <option value="laptop">Laptop</option>
            <option value="desktop">Desktop</option>
            <option value="phone">Phone</option>
            <option value="tablet">Tablet</option>
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as DeviceStatus | 'all')} className="px-3 py-2 border border-thb-border rounded-lg text-sm text-thb-text-secondary focus:outline-none">
            <option value="all">All Status</option>
            <option value="available">Available</option>
            <option value="assigned">Assigned</option>
            <option value="repair">Repair</option>
            <option value="retired">Retired</option>
          </select>
        </div>
      </div>

      {/* Inline Add/Edit Form */}
      {showForm && (
        <div className="thb-card p-4 md:p-6 border-l-4 border-l-thb-primary animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-thb-text-primary">{editing ? 'Edit Device' : 'Add New Device'}</h3>
            <button onClick={closeForm} className="p-1 hover:bg-slate-100 rounded"><FiX className="w-4 h-4 text-thb-text-muted" /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-medium text-thb-text-secondary mb-1 block">Device Name <span className="text-red-500 font-bold">*</span></label>
              <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="w-full px-3 py-2 border border-thb-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-thb-primary/20" />
            </div>
            <div>
              <label className="text-xs font-medium text-thb-text-secondary mb-1 block">Type</label>
              <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value as DeviceType }))} className="w-full px-3 py-2 border border-thb-border rounded-lg text-sm focus:outline-none">
                <option value="laptop">Laptop</option><option value="desktop">Desktop</option><option value="phone">Phone</option><option value="tablet">Tablet</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-thb-text-secondary mb-1 block">Serial Number <span className="text-red-500 font-bold">*</span></label>
              <input value={form.serialNumber} onChange={e => setForm(p => ({ ...p, serialNumber: e.target.value }))} className="w-full px-3 py-2 border border-thb-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-thb-primary/20" />
            </div>
            <div>
              <label className="text-xs font-medium text-thb-text-secondary mb-1 block">Assigned To</label>
              <input value={form.assignedTo} onChange={e => setForm(p => ({ ...p, assignedTo: e.target.value }))} placeholder="Employee name" className="w-full px-3 py-2 border border-thb-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-thb-primary/20" />
            </div>
            <div>
              <label className="text-xs font-medium text-thb-text-secondary mb-1 block">Status</label>
              <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value as DeviceStatus }))} className="w-full px-3 py-2 border border-thb-border rounded-lg text-sm focus:outline-none">
                <option value="available">Available</option><option value="assigned">Assigned</option><option value="repair">Repair</option><option value="retired">Retired</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-thb-text-secondary mb-1 block">OS</label>
              <input value={form.os} onChange={e => setForm(p => ({ ...p, os: e.target.value }))} placeholder="e.g. Windows 11" className="w-full px-3 py-2 border border-thb-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-thb-primary/20" />
            </div>
            <div>
              <label className="text-xs font-medium text-thb-text-secondary mb-1 block">RAM</label>
              <input value={form.ram} onChange={e => setForm(p => ({ ...p, ram: e.target.value }))} className="w-full px-3 py-2 border border-thb-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-thb-primary/20" />
            </div>
            <div>
              <label className="text-xs font-medium text-thb-text-secondary mb-1 block">Storage</label>
              <input value={form.storage} onChange={e => setForm(p => ({ ...p, storage: e.target.value }))} className="w-full px-3 py-2 border border-thb-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-thb-primary/20" />
            </div>
            <div>
              <label className="text-xs font-medium text-thb-text-secondary mb-1 block">Purchase Date</label>
              <input type="date" value={form.purchaseDate} onChange={e => setForm(p => ({ ...p, purchaseDate: e.target.value }))} className="w-full px-3 py-2 border border-thb-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-thb-primary/20" />
            </div>
            <div>
              <label className="text-xs font-medium text-thb-text-secondary mb-1 block">Warranty End</label>
              <input type="date" value={form.warrantyEnd} onChange={e => setForm(p => ({ ...p, warrantyEnd: e.target.value }))} className="w-full px-3 py-2 border border-thb-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-thb-primary/20" />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={handleSave} className="px-4 py-2 bg-thb-primary text-white rounded-lg text-sm font-medium hover:opacity-90">{editing ? 'Update' : 'Add'} Device</button>
            <button onClick={closeForm} className="px-4 py-2 border border-thb-border rounded-lg text-sm text-thb-text-secondary hover:bg-slate-50">Cancel</button>
          </div>
        </div>
      )}

      {/* Device Card Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="thb-card p-5 animate-pulse"><div className="h-4 bg-slate-200 rounded w-3/4 mb-3" /><div className="h-3 bg-slate-200 rounded w-1/2 mb-2" /><div className="h-3 bg-slate-200 rounded w-2/3" /></div>)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(d => {
            const sc = STATUS_CFG[d.status];
            return (
              <div key={d.id} className="thb-card thb-card-hover p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-slate-50 text-thb-text-secondary">{TYPE_ICON[d.type]}</div>
                    <div>
                      <h4 className="font-semibold text-sm text-thb-text-primary">{d.name}</h4>
                      <p className="text-xs text-thb-text-muted">{d.type.charAt(0).toUpperCase() + d.type.slice(1)}</p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(d)} className="p-1.5 hover:bg-slate-100 rounded text-thb-text-muted hover:text-thb-primary"><FiEdit2 className="w-3.5 h-3.5" /></button>
                    <button onClick={() => handleDelete(d.id)} className="p-1.5 hover:bg-red-50 rounded text-thb-text-muted hover:text-red-500"><FiTrash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between"><span className="text-thb-text-muted">S/N</span><span className="text-thb-text-secondary font-mono">{d.serialNumber}</span></div>
                  {d.assignedTo && <div className="flex justify-between"><span className="text-thb-text-muted">Assigned</span><span className="text-thb-text-secondary">{d.assignedTo}</span></div>}
                  <div className="flex justify-between"><span className="text-thb-text-muted">OS</span><span className="text-thb-text-secondary">{d.os}</span></div>
                  <div className="flex justify-between"><span className="text-thb-text-muted">RAM / Storage</span><span className="text-thb-text-secondary">{d.ram} / {d.storage}</span></div>
                  {d.warrantyEnd && <div className="flex justify-between items-center"><span className="text-thb-text-muted">Warranty</span><div className="flex items-center gap-1"><FiCalendar className="w-3 h-3 text-thb-text-muted" /><span className="text-thb-text-secondary">{d.warrantyEnd}</span></div></div>}
                </div>
                <div className="mt-3 pt-3 border-t border-thb-border">
                  <span className={`thb-badge ${sc.bg} ${sc.text}`}>{d.status.charAt(0).toUpperCase() + d.status.slice(1)}</span>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="col-span-full text-center py-12 text-thb-text-muted">No devices found matching your filters.</div>
          )}
        </div>
      )}
    </div>
  );
}
