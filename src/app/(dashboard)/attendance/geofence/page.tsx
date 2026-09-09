'use client';

import { useEffect, useState, useCallback } from 'react';
import { FiMapPin, FiPlus, FiRefreshCw, FiTrash2, FiMap } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import { useCompanyContextStore } from '@/store/companyContextStore';
import ModuleTips from '@/components/ModuleTips';

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

interface Geofence {
  id: string;
  name: string;
  branchId: string | null;
  branch?: { id: string; name: string; city: string | null } | null;
  centerLat: number;
  centerLng: number;
  radiusMeters: number;
  isActive: boolean;
}

interface Branch { id: string; name: string; city: string | null }

export default function GeofencePage() {
  const { user } = useAuthStore();
  const scopeQuery = useCompanyContextStore(s => s.scopeQuery);
  const selectedTenantId = useCompanyContextStore(s => s.selectedTenantId);
  const isAdmin = ['super_admin', 'tenant_admin', 'admin'].includes(user?.role || '');

  const [items, setItems] = useState<Geofence[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    name: '',
    branchId: '',
    centerLat: '',
    centerLng: '',
    radiusMeters: '200',
    isActive: true,
  });

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const sq = scopeQuery();
      const r = await fetch(`/api/attendance/geofence?limit=100${sq ? `&${sq}` : ''}`, { headers: getAuthHeaders() });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed');
      setItems(d.geofences || []);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [scopeQuery, selectedTenantId]);

  const fetchBranches = useCallback(async () => {
    try {
      const sq = scopeQuery();
      const r = await fetch(`/api/branches?limit=100${sq ? `&${sq}` : ''}`, { headers: getAuthHeaders() });
      const d = await r.json();
      setBranches(d.branches || []);
    } catch { /* ignore */ }
  }, [scopeQuery, selectedTenantId]);

  useEffect(() => { fetchItems(); if (isAdmin) fetchBranches(); }, [fetchItems, fetchBranches, isAdmin]);

  const handleSubmit = async () => {
    if (!form.name || !form.centerLat || !form.centerLng) {
      toast.error('Name, center latitude and longitude are required');
      return;
    }
    setSubmitting(true);
    try {
      // Simple circular geofence — polygon is computed from center + radius
      const lat = Number(form.centerLat);
      const lng = Number(form.centerLng);
      const radiusInDeg = Number(form.radiusMeters) / 111000; // approx
      const polygon = {
        type: 'Polygon',
        coordinates: [[
          [lng - radiusInDeg, lat - radiusInDeg],
          [lng + radiusInDeg, lat - radiusInDeg],
          [lng + radiusInDeg, lat + radiusInDeg],
          [lng - radiusInDeg, lat + radiusInDeg],
          [lng - radiusInDeg, lat - radiusInDeg],
        ]],
      };
      const r = await fetch('/api/attendance/geofence', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          name: form.name, branchId: form.branchId || null,
          polygon, centerLat: lat, centerLng: lng,
          radiusMeters: Number(form.radiusMeters) || 200,
          isActive: form.isActive,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed');
      toast.success('Geofence created');
      setShowForm(false);
      setForm({ name: '', branchId: '', centerLat: '', centerLng: '', radiusMeters: '200', isActive: true });
      fetchItems();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this geofence?')) return;
    try {
      const r = await fetch(`/api/attendance/geofence/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
      if (!r.ok) throw new Error('Failed');
      toast.success('Geofence deleted');
      fetchItems();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <FiMapPin className="w-6 h-6 text-cyan-500" />
            Geofence Management
          </h1>
          <p className="text-sm text-slate-500 mt-1">Draw virtual perimeters around office locations for mobile check-in validation</p>
        </div>
        {isAdmin && (
          <button onClick={() => setShowForm(!showForm)} className="3boxes-btn-primary flex items-center gap-2">
            <FiPlus className="w-4 h-4" /> New Geofence
          </button>
        )}
      </div>

      <ModuleTips moduleKey="attendance-geofence">
        <p><strong>REQ-ATT-04:</strong> Tenant Admins draw virtual perimeters around office locations. If an employee checks in outside the geofence, the punch is flagged as <em>Invalid Location</em>. Super Admin enforces a maximum radius (e.g. 500m) globally to prevent database overload.</p>
      </ModuleTips>

      {showForm && isAdmin && (
        <div className="thb-card p-6 border-l-4 border-l-cyan-500">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-800">New Geofence</h2>
            <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-700">✕</button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Name *</label>
              <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="3boxes-input w-full" placeholder="e.g. Bangalore HQ" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Branch</label>
              <select value={form.branchId} onChange={e => setForm({ ...form, branchId: e.target.value })} className="3boxes-input w-full">
                <option value="">None (global)</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}{b.city ? ` — ${b.city}` : ''}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Center Latitude *</label>
              <input type="number" step="0.000001" value={form.centerLat} onChange={e => setForm({ ...form, centerLat: e.target.value })} className="3boxes-input w-full" placeholder="12.9716" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Center Longitude *</label>
              <input type="number" step="0.000001" value={form.centerLng} onChange={e => setForm({ ...form, centerLng: e.target.value })} className="3boxes-input w-full" placeholder="77.5946" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Radius (meters) · max 500</label>
              <input type="number" min="50" max="500" value={form.radiusMeters} onChange={e => setForm({ ...form, radiusMeters: e.target.value })} className="3boxes-input w-full" />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })} />
                Active
              </label>
            </div>
          </div>
          <div className="mt-4 p-3 bg-green-50 border border-green-100 rounded-lg text-xs text-green-700">
            <FiMap className="w-3.5 h-3.5 inline mr-1" />
            Tip: Pick the center point of your office on Google Maps, right-click, and copy the lat/lng coordinates into the fields above.
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => setShowForm(false)} className="3boxes-btn-secondary">Cancel</button>
            <button onClick={handleSubmit} disabled={submitting} className="3boxes-btn-primary flex items-center gap-2">
              {submitting ? <FiRefreshCw className="w-4 h-4 animate-spin" /> : <FiPlus className="w-4 h-4" />}
              Create Geofence
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full text-center py-12 text-slate-400">Loading...</div>
        ) : items.length === 0 ? (
          <div className="col-span-full text-center py-12 text-slate-500">
            <FiMapPin className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            No geofences configured yet.
          </div>
        ) : items.map(g => (
          <div key={g.id} className="thb-card p-5">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-800">{g.name}</h3>
                <p className="text-xs text-slate-500 mt-0.5">{g.branch?.name || 'Global'} {g.branch?.city ? `· ${g.branch.city}` : ''}</p>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full ${g.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                {g.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
            <div className="mt-3 text-xs text-slate-600 space-y-1">
              <p>📍 {g.centerLat.toFixed(5)}, {g.centerLng.toFixed(5)}</p>
              <p>📏 Radius: {g.radiusMeters}m</p>
            </div>
            {isAdmin && (
              <button onClick={() => handleDelete(g.id)} className="mt-3 text-xs text-red-600 hover:text-red-700 flex items-center gap-1">
                <FiTrash2 className="w-3 h-3" /> Delete
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
