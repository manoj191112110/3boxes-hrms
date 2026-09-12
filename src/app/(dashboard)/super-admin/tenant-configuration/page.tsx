'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  FiSettings, FiRefreshCw, FiCheck, FiX, FiEdit2,
  FiGlobe, FiDollarSign, FiClock, FiShield,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import { isClientLiveMode } from '@/lib/site-mode';
import { isTenantHiddenClient, PLATFORM_PLACEHOLDER_NAME } from '@/lib/tenant-filter';

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

interface TenantConfig {
  id: string;
  tenantId: string;
  tenantName?: string;
  tenantSlug?: string;
  autoProvisionPayroll: boolean;
  autoProvisionCompliance: boolean;
  autoProvisionTaxSlabs: boolean;
  defaultPayrollFrequency: string;
  defaultCurrency: string;
  defaultLanguage: string;
  defaultTimezone: string;
  defaultCountry: string;
  dataResidencyRequired: boolean;
  dataRegion: string;
  maxApiCallsPerDay: number;
  maxStorageBytes: number;
  enableAuditLog: boolean;
  enableDataExport: boolean;
  retentionDays: number;
  createdAt: string;
  updatedAt: string;
}

interface Tenant {
  id: string;
  name: string;
  slug: string;
  currency: string;
  country: string | null;
  timezone: string;
  language: string;
  status: string;
}

export default function TenantConfigurationPage() {
  const { user } = useAuthStore();
  const isLive = isClientLiveMode();

  const [configs, setConfigs] = useState<TenantConfig[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<TenantConfig>>({});

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const headers = getAuthHeaders();
      // Fetch tenants first (for names and live/demo filtering)
      const tenantsRes = await fetch('/api/tenants?limit=100', { headers });
      let tenantList: Tenant[] = [];
      if (tenantsRes.ok) {
        const data = await tenantsRes.json();
        tenantList = data.tenants || [];
        // ALWAYS filter out hidden tenants — never show Marq AI Tech or demo
        tenantList = tenantList.filter((t: Tenant) =>
          !isTenantHiddenClient(t.slug) && !(t.name || '').includes(PLATFORM_PLACEHOLDER_NAME)
        );
        setTenants(tenantList);
      }

      // Fetch tenant configurations for each tenant
      const configPromises = tenantList.map(async (tenant) => {
        try {
          const res = await fetch(`/api/tenant-configuration?tenantId=${tenant.id}`, { headers });
          if (res.ok) {
            const data = await res.json();
            const config = data.configuration || data;
            return { ...config, tenantName: tenant.name, tenantSlug: tenant.slug } as TenantConfig;
          }
          return null;
        } catch { return null; }
      });
      const configResults = await Promise.all(configPromises);
      setConfigs(configResults.filter(Boolean) as TenantConfig[]);
    } catch (err) {
      console.error('Failed to fetch tenant configurations:', err);
      toast.error('Failed to load tenant configurations');
    } finally {
      setLoading(false);
    }
  }, [isLive]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleEdit = (config: TenantConfig) => {
    setEditingId(config.id);
    setEditForm({ ...config });
  };

  const handleSave = async () => {
    if (!editingId || !editForm.tenantId) return;
    try {
      const res = await fetch(`/api/tenant-configuration?tenantId=${editForm.tenantId}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify(editForm),
      });
      if (!res.ok) { const d = await res.json(); toast.error(d.error || 'Update failed'); return; }
      toast.success('Configuration updated');
      setEditingId(null);
      setEditForm({});
      fetchData();
    } catch { toast.error('Update failed'); }
  };

  const inputCls = 'w-full px-3 py-2 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400';
  const cbCls = 'rounded border-slate-300 text-green-600 focus:ring-green-500';

  return (
    <div className="space-y-6">
      {/* Hero Banner */}
      <div className="thb-card p-6 bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-500 border-0">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <FiSettings className="w-7 h-7" /> Tenant Configuration
            </h1>
            <p className="text-indigo-100 mt-1 text-sm">
              {isLive ? 'Live tenant configurations' : 'Manage configuration settings for all tenants'}
            </p>
          </div>
          <button onClick={fetchData} disabled={loading} className="inline-flex items-center gap-2 px-4 py-2.5 bg-white/20 backdrop-blur text-white rounded-lg font-medium text-sm hover:bg-white/30 transition-colors disabled:opacity-50">
            <FiRefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Tenants', value: tenants.length, icon: <FiGlobe className="w-5 h-5" />, bg: 'bg-indigo-50 text-indigo-500' },
          { label: 'Configured', value: configs.length, icon: <FiCheck className="w-5 h-5" />, bg: 'bg-emerald-50 text-emerald-500' },
          { label: 'INR Currency', value: configs.filter(c => c.defaultCurrency === 'INR').length, icon: <FiDollarSign className="w-5 h-5" />, bg: 'bg-teal-50 text-teal-500' },
          { label: 'Audit Enabled', value: configs.filter(c => c.enableAuditLog).length, icon: <FiShield className="w-5 h-5" />, bg: 'bg-amber-50 text-amber-500' },
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

      {/* Configuration List */}
      {loading ? (
        <div className="thb-card p-8 text-center text-thb-text-muted">
          <FiRefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
          <p className="text-sm">Loading tenant configurations...</p>
        </div>
      ) : configs.length === 0 ? (
        <div className="thb-card p-8 text-center text-thb-text-muted">
          <FiSettings className="w-8 h-8 mx-auto mb-2" />
          <p className="text-sm">No tenant configurations found</p>
          <p className="text-xs mt-1">Tenant configurations are created automatically when tenants are set up.</p>
        </div>
      ) : (
        <div className="thb-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-thb-text-muted border-b border-thb-border bg-slate-50">
                  <th className="px-4 py-3 font-medium">Tenant</th>
                  <th className="px-4 py-3 font-medium">Currency</th>
                  <th className="px-4 py-3 font-medium">Country</th>
                  <th className="px-4 py-3 font-medium">Language</th>
                  <th className="px-4 py-3 font-medium">Timezone</th>
                  <th className="px-4 py-3 font-medium">Auto-Provision</th>
                  <th className="px-4 py-3 font-medium">Audit Log</th>
                  <th className="px-4 py-3 font-medium">Data Residency</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {configs.map((config) => (
                  <tr key={config.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3 font-medium text-thb-text-primary">
                      {config.tenantName || config.tenantSlug || config.tenantId}
                    </td>
                    <td className="px-4 py-3">
                      <span className="thb-badge thb-badge-info">{config.defaultCurrency || 'INR'}</span>
                    </td>
                    <td className="px-4 py-3 text-thb-text-secondary">{config.defaultCountry || '—'}</td>
                    <td className="px-4 py-3 text-thb-text-secondary">{config.defaultLanguage || 'en'}</td>
                    <td className="px-4 py-3 text-thb-text-secondary text-xs">{config.defaultTimezone || 'UTC'}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {config.autoProvisionPayroll && <span className="text-[9px] px-1 py-0.5 bg-emerald-50 text-emerald-700 rounded">Payroll</span>}
                        {config.autoProvisionCompliance && <span className="text-[9px] px-1 py-0.5 bg-emerald-50 text-emerald-700 rounded">Compliance</span>}
                        {config.autoProvisionTaxSlabs && <span className="text-[9px] px-1 py-0.5 bg-emerald-50 text-emerald-700 rounded">Tax</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {config.enableAuditLog ? <FiCheck className="w-4 h-4 text-emerald-500" /> : <FiX className="w-4 h-4 text-slate-300" />}
                    </td>
                    <td className="px-4 py-3">
                      {config.dataResidencyRequired ? <span className="thb-badge thb-badge-warning">{config.dataRegion}</span> : <span className="text-thb-text-muted">Off</span>}
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => handleEdit(config)} className="inline-flex items-center gap-1 text-green-500 hover:text-green-700 text-xs font-medium">
                        <FiEdit2 className="w-3.5 h-3.5" /> Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full mx-4 p-6 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-thb-text-primary">Edit Configuration</h3>
              <button onClick={() => { setEditingId(null); setEditForm({}); }} className="p-1.5 text-thb-text-muted hover:text-thb-text-primary rounded-lg"><FiX className="w-4 h-4" /></button>
            </div>
            <div className="space-y-4">
              <div><label className="block text-xs font-medium text-thb-text-secondary mb-1">Default Currency</label><select className={inputCls} value={editForm.defaultCurrency || 'INR'} onChange={(e) => setEditForm(p => ({ ...p, defaultCurrency: e.target.value }))}>{isLive ? <option value="INR">INR</option> : <><option value="INR">INR</option><option value="USD">USD</option><option value="EUR">EUR</option><option value="GBP">GBP</option></>}</select></div>
              <div><label className="block text-xs font-medium text-thb-text-secondary mb-1">Default Country</label><input className={inputCls} value={editForm.defaultCountry || ''} onChange={(e) => setEditForm(p => ({ ...p, defaultCountry: e.target.value }))} /></div>
              <div><label className="block text-xs font-medium text-thb-text-secondary mb-1">Default Language</label><input className={inputCls} value={editForm.defaultLanguage || ''} onChange={(e) => setEditForm(p => ({ ...p, defaultLanguage: e.target.value }))} /></div>
              <div><label className="block text-xs font-medium text-thb-text-secondary mb-1">Default Timezone</label><input className={inputCls} value={editForm.defaultTimezone || ''} onChange={(e) => setEditForm(p => ({ ...p, defaultTimezone: e.target.value }))} /></div>
              <div><label className="block text-xs font-medium text-thb-text-secondary mb-1">Payroll Frequency</label><select className={inputCls} value={editForm.defaultPayrollFrequency || 'MONTHLY'} onChange={(e) => setEditForm(p => ({ ...p, defaultPayrollFrequency: e.target.value }))}><option value="MONTHLY">Monthly</option><option value="SEMI_MONTHLY">Semi-Monthly</option><option value="BI_WEEKLY">Bi-Weekly</option><option value="WEEKLY">Weekly</option></select></div>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex items-center gap-2 text-sm text-thb-text-secondary"><input type="checkbox" checked={editForm.autoProvisionPayroll || false} onChange={(e) => setEditForm(p => ({ ...p, autoProvisionPayroll: e.target.checked }))} className={cbCls} /> Auto Payroll</label>
                <label className="flex items-center gap-2 text-sm text-thb-text-secondary"><input type="checkbox" checked={editForm.autoProvisionCompliance || false} onChange={(e) => setEditForm(p => ({ ...p, autoProvisionCompliance: e.target.checked }))} className={cbCls} /> Auto Compliance</label>
                <label className="flex items-center gap-2 text-sm text-thb-text-secondary"><input type="checkbox" checked={editForm.autoProvisionTaxSlabs || false} onChange={(e) => setEditForm(p => ({ ...p, autoProvisionTaxSlabs: e.target.checked }))} className={cbCls} /> Auto Tax Slabs</label>
                <label className="flex items-center gap-2 text-sm text-thb-text-secondary"><input type="checkbox" checked={editForm.enableAuditLog || false} onChange={(e) => setEditForm(p => ({ ...p, enableAuditLog: e.target.checked }))} className={cbCls} /> Audit Log</label>
                <label className="flex items-center gap-2 text-sm text-thb-text-secondary"><input type="checkbox" checked={editForm.enableDataExport || false} onChange={(e) => setEditForm(p => ({ ...p, enableDataExport: e.target.checked }))} className={cbCls} /> Data Export</label>
                <label className="flex items-center gap-2 text-sm text-thb-text-secondary"><input type="checkbox" checked={editForm.dataResidencyRequired || false} onChange={(e) => setEditForm(p => ({ ...p, dataResidencyRequired: e.target.checked }))} className={cbCls} /> Data Residency</label>
              </div>
              <div><label className="block text-xs font-medium text-thb-text-secondary mb-1">Retention Days</label><input type="number" className={inputCls} value={editForm.retentionDays || 365} onChange={(e) => setEditForm(p => ({ ...p, retentionDays: Number(e.target.value) }))} /></div>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => { setEditingId(null); setEditForm({}); }} className="px-4 py-2 text-sm font-medium text-thb-text-secondary hover:text-thb-text-primary rounded-lg">Cancel</button>
                <button onClick={handleSave} className="inline-flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg font-medium text-sm hover:bg-green-600"><FiCheck className="w-4 h-4" /> Save</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
