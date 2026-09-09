'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  FiGlobe, FiPlus, FiEdit2, FiX, FiCheck, FiShield,
  FiAlertCircle, FiCopy, FiExternalLink, FiRefreshCw,
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
interface Domain {
  id: string;
  domainName: string;
  tenant: string;
  status: 'active' | 'pending' | 'failed';
  sslStatus: 'active' | 'pending' | 'expired' | 'none';
  verifiedDate: string | null;
  createdAt: string;
  dnsType: string;
  dnsValue: string;
}

interface TenantRecord {
  id: string;
  name: string;
  slug: string;
  domain?: string | null;
  domainVerified?: boolean;
  createdAt: string;
}

const statusBadge: Record<string, string> = {
  active: 'thb-badge thb-badge-success',
  pending: 'thb-badge thb-badge-warning',
  failed: 'thb-badge thb-badge-error',
};

const sslBadge: Record<string, string> = {
  active: 'thb-badge thb-badge-success',
  pending: 'thb-badge thb-badge-warning',
  expired: 'thb-badge thb-badge-error',
  none: 'thb-badge thb-badge-info',
};

const sslIconColor: Record<string, string> = {
  active: 'text-emerald-500',
  pending: 'text-amber-500',
  expired: 'text-red-500',
  none: 'text-slate-400',
};

export default function DomainPage() {
  const { user } = useAuthStore();
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showDnsPanel, setShowDnsPanel] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTenantId, setEditTenantId] = useState<string | null>(null);
  const [form, setForm] = useState({
    domainName: '', tenant: '', status: 'pending' as Domain['status'],
    dnsType: 'CNAME', dnsValue: 'cname.3boxes.app',
  });

  const fetchDomains = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/tenants?limit=100', { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Failed to fetch tenants');
      const data = await res.json();
      const tenants: TenantRecord[] = data.tenants || data || [];

      // ALWAYS filter out hidden tenants (platform placeholder, demo) — never show Marq AI Tech
      const filtered = tenants.filter((t: TenantRecord) =>
        !isTenantHiddenClient(t.slug) && !(t.name || '').includes(PLATFORM_PLACEHOLDER_NAME)
      );

      const mapped: Domain[] = filtered.map((t: TenantRecord) => ({
        id: t.id,
        domainName: t.domain || 'No custom domain',
        tenant: t.name,
        status: t.domain ? (t.domainVerified ? 'active' : 'pending') : 'failed',
        sslStatus: t.domain ? (t.domainVerified ? 'active' : 'pending') : 'none',
        verifiedDate: t.domainVerified ? t.createdAt : null,
        createdAt: t.createdAt ? new Date(t.createdAt).toISOString().slice(0, 10) : '',
        dnsType: 'CNAME',
        dnsValue: 'cname.3boxes.app',
      }));
      setDomains(mapped);
    } catch (err) {
      toast.error('Failed to load domains');
      setDomains([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDomains(); }, [fetchDomains]);

  const activeCount = domains.filter((d) => d.status === 'active').length;
  const pendingCount = domains.filter((d) => d.status === 'pending').length;
  const sslActiveCount = domains.filter((d) => d.sslStatus === 'active').length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.domainName || !form.tenant) { toast.error('Domain name and tenant are required'); return; }
    if (editingId && editTenantId) {
      try {
        const res = await fetch(`/api/tenants/${editTenantId}`, {
          method: 'PATCH',
          headers: getAuthHeaders(),
          body: JSON.stringify({ domain: form.domainName }),
        });
        if (!res.ok) throw new Error('Failed to update domain');
        toast.success('Domain updated');
        fetchDomains();
      } catch {
        toast.error('Failed to update domain');
      }
    } else {
      toast.info('Use tenant settings to assign a domain, then verify here');
    }
    setShowForm(false);
    setEditingId(null);
    setEditTenantId(null);
  };

  const handleEdit = (domain: Domain) => {
    setEditingId(domain.id);
    setEditTenantId(domain.id);
    setForm({ domainName: domain.domainName, tenant: domain.tenant, status: domain.status, dnsType: domain.dnsType, dnsValue: domain.dnsValue });
    setShowForm(true);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const inputCls = 'w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400';

  return (
    <div className="space-y-6">
      {/* Hero Banner */}
      <div className="thb-card p-6 bg-gradient-to-r from-teal-600 via-emerald-500 to-green-500 border-0">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3"><FiGlobe className="w-7 h-7" /> Domain Management</h1>
            <p className="text-emerald-100 mt-1 text-sm">Manage custom domains, DNS configuration, and SSL certificates</p>
          </div>
          <div className="flex gap-2">
            <button onClick={fetchDomains} className="inline-flex items-center gap-2 px-4 py-2.5 bg-white/20 backdrop-blur text-white rounded-lg font-medium text-sm hover:bg-white/30 transition-colors">
              <FiRefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
            <button onClick={() => setShowDnsPanel(!showDnsPanel)} className="inline-flex items-center gap-2 px-4 py-2.5 bg-white/20 backdrop-blur text-white rounded-lg font-medium text-sm hover:bg-white/30 transition-colors">
              <FiExternalLink className="w-4 h-4" /> DNS Guide
            </button>
            <button onClick={() => { setShowForm(true); setEditingId(null); setEditTenantId(null); setForm({ domainName: '', tenant: '', status: 'pending', dnsType: 'CNAME', dnsValue: 'cname.3boxes.app' }); }} className="inline-flex items-center gap-2 px-4 py-2.5 bg-white/20 backdrop-blur text-white rounded-lg font-medium text-sm hover:bg-white/30 transition-colors">
              <FiPlus className="w-4 h-4" /> Add Domain
            </button>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="thb-card p-12 text-center">
          <FiRefreshCw className="w-8 h-8 mx-auto mb-3 text-thb-text-muted animate-spin" />
          <p className="text-thb-text-muted">Loading domains…</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && domains.length === 0 && (
        <div className="thb-card p-12 text-center">
          <FiGlobe className="w-12 h-12 mx-auto mb-3 text-thb-text-muted opacity-40" />
          <p className="text-lg font-medium text-thb-text-primary">No domains found</p>
          <p className="text-sm text-thb-text-muted mt-1">No tenants with custom domains exist yet.</p>
        </div>
      )}

      {/* Stat Cards */}
      {!loading && domains.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Domains', value: domains.length, icon: <FiGlobe className="w-5 h-5" />, bg: 'bg-teal-50 text-teal-500' },
            { label: 'Active', value: activeCount, icon: <FiCheck className="w-5 h-5" />, bg: 'bg-emerald-50 text-emerald-500' },
            { label: 'Pending', value: pendingCount, icon: <FiAlertCircle className="w-5 h-5" />, bg: 'bg-amber-50 text-amber-500' },
            { label: 'SSL Active', value: sslActiveCount, icon: <FiShield className="w-5 h-5" />, bg: 'bg-teal-50 text-teal-500' },
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

      {/* DNS Configuration Panel */}
      {showDnsPanel && (
        <div className="thb-card border-l-4 border-l-teal-500 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-thb-text-primary flex items-center gap-2"><FiExternalLink className="w-5 h-5" /> DNS Configuration Guide</h3>
            <button onClick={() => setShowDnsPanel(false)} className="p-1.5 text-thb-text-muted hover:text-thb-text-primary hover:bg-slate-100 rounded-lg"><FiX className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h4 className="font-medium text-thb-text-primary">Option 1: CNAME Record (Recommended)</h4>
              <div className="bg-slate-50 rounded-lg p-4 space-y-2 text-sm">
                <div className="flex items-center justify-between"><span className="text-thb-text-secondary">Type:</span><div className="flex items-center gap-2"><code className="font-mono font-bold text-thb-text-primary">CNAME</code><button onClick={() => copyToClipboard('CNAME')} className="text-green-500 hover:text-green-700"><FiCopy className="w-3.5 h-3.5" /></button></div></div>
                <div className="flex items-center justify-between"><span className="text-thb-text-secondary">Name:</span><div className="flex items-center gap-2"><code className="font-mono font-bold text-thb-text-primary">hr</code><button onClick={() => copyToClipboard('hr')} className="text-green-500 hover:text-green-700"><FiCopy className="w-3.5 h-3.5" /></button></div></div>
                <div className="flex items-center justify-between"><span className="text-thb-text-secondary">Value:</span><div className="flex items-center gap-2"><code className="font-mono font-bold text-thb-text-primary">cname.3boxes.app</code><button onClick={() => copyToClipboard('cname.3boxes.app')} className="text-green-500 hover:text-green-700"><FiCopy className="w-3.5 h-3.5" /></button></div></div>
              </div>
            </div>
            <div className="space-y-4">
              <h4 className="font-medium text-thb-text-primary">Option 2: A Record</h4>
              <div className="bg-slate-50 rounded-lg p-4 space-y-2 text-sm">
                <div className="flex items-center justify-between"><span className="text-thb-text-secondary">Type:</span><div className="flex items-center gap-2"><code className="font-mono font-bold text-thb-text-primary">A</code><button onClick={() => copyToClipboard('A')} className="text-green-500 hover:text-green-700"><FiCopy className="w-3.5 h-3.5" /></button></div></div>
                <div className="flex items-center justify-between"><span className="text-thb-text-secondary">Name:</span><div className="flex items-center gap-2"><code className="font-mono font-bold text-thb-text-primary">hr</code><button onClick={() => copyToClipboard('hr')} className="text-green-500 hover:text-green-700"><FiCopy className="w-3.5 h-3.5" /></button></div></div>
                <div className="flex items-center justify-between"><span className="text-thb-text-secondary">Value:</span><div className="flex items-center gap-2"><code className="font-mono font-bold text-thb-text-primary">34.120.45.89</code><button onClick={() => copyToClipboard('34.120.45.89')} className="text-green-500 hover:text-green-700"><FiCopy className="w-3.5 h-3.5" /></button></div></div>
              </div>
            </div>
          </div>
          <div className="mt-4 p-3 bg-amber-50 rounded-lg flex items-start gap-2">
            <FiAlertCircle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-amber-800">DNS changes can take up to 48 hours to propagate. SSL certificates are automatically provisioned after domain verification.</p>
          </div>
        </div>
      )}

      {/* Add/Edit Form */}
      {showForm && (
        <div className="thb-card border-l-4 border-l-teal-500 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-thb-text-primary">{editingId ? 'Edit Domain' : 'Add Domain'}</h3>
            <button onClick={() => { setShowForm(false); setEditingId(null); setEditTenantId(null); }} className="p-1.5 text-thb-text-muted hover:text-thb-text-primary hover:bg-slate-100 rounded-lg"><FiX className="w-4 h-4" /></button>
          </div>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="block text-xs font-medium text-thb-text-secondary mb-1">Domain Name</label><input className={inputCls} value={form.domainName} onChange={(e) => setForm((p) => ({ ...p, domainName: e.target.value }))} placeholder="hr.yourcompany.com" /></div>
            <div><label className="block text-xs font-medium text-thb-text-secondary mb-1">Tenant</label><input className={inputCls} value={form.tenant} onChange={(e) => setForm((p) => ({ ...p, tenant: e.target.value }))} placeholder="Company Name" /></div>
            <div><label className="block text-xs font-medium text-thb-text-secondary mb-1">DNS Type</label><select className={inputCls} value={form.dnsType} onChange={(e) => setForm((p) => ({ ...p, dnsType: e.target.value }))}><option>CNAME</option><option>A</option></select></div>
            <div><label className="block text-xs font-medium text-thb-text-secondary mb-1">DNS Value</label><input className={inputCls} value={form.dnsValue} onChange={(e) => setForm((p) => ({ ...p, dnsValue: e.target.value }))} /></div>
            <div><label className="block text-xs font-medium text-thb-text-secondary mb-1">Status</label><select className={inputCls} value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as Domain['status'] }))}><option value="pending">Pending</option><option value="active">Active</option><option value="failed">Failed</option></select></div>
            <div className="flex items-end"><button type="submit" className="inline-flex items-center gap-2 px-4 py-2.5 bg-green-500 text-white rounded-lg font-medium text-sm hover:bg-green-600 transition-colors"><FiCheck className="w-4 h-4" />{editingId ? 'Update' : 'Add Domain'}</button></div>
          </form>
        </div>
      )}

      {/* Domain List */}
      {!loading && domains.length > 0 && (
        <div className="thb-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-thb-text-muted border-b border-thb-border bg-slate-50">
                <th className="px-4 py-3 font-medium">Domain</th>
                <th className="px-4 py-3 font-medium">Tenant</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">SSL</th>
                <th className="px-4 py-3 font-medium">DNS Type</th>
                <th className="px-4 py-3 font-medium">Verified Date</th>
                <th className="px-4 py-3 font-medium">Action</th>
              </tr></thead>
              <tbody>
                {domains.map((domain) => (
                  <tr key={domain.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3 font-medium text-thb-text-primary flex items-center gap-2"><FiGlobe className="w-3.5 h-3.5 text-thb-text-muted" /> {domain.domainName}</td>
                    <td className="px-4 py-3 text-thb-text-secondary">{domain.tenant}</td>
                    <td className="px-4 py-3"><span className={statusBadge[domain.status]}>{domain.status}</span></td>
                    <td className="px-4 py-3"><span className="flex items-center gap-1.5"><FiShield className={`w-3.5 h-3.5 ${sslIconColor[domain.sslStatus]}`} /><span className={sslBadge[domain.sslStatus]}>{domain.sslStatus}</span></span></td>
                    <td className="px-4 py-3 text-thb-text-secondary font-mono text-xs">{domain.dnsType}</td>
                    <td className="px-4 py-3 text-thb-text-secondary">{domain.verifiedDate || '—'}</td>
                    <td className="px-4 py-3"><button onClick={() => handleEdit(domain)} className="inline-flex items-center gap-1 text-green-500 hover:text-green-700 text-xs font-medium"><FiEdit2 className="w-3.5 h-3.5" /> Edit</button></td>
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
