'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  FiZap, FiRefreshCw, FiShield, FiCheck, FiInfo, FiChevronLeft, FiLock,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import { useCompanyContextStore } from '@/store/companyContextStore';
import SrsBanner from '@/components/SrsBanner';

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

interface Flag {
  id: string;
  tenantId: string;
  key: string;
  label: string;
  enabled: boolean;
  config?: string | null;
  source: string;
  notes?: string | null;
  updatedAt: string;
}

interface TenantOption {
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: string;
}

export default function FeatureFlagsPage() {
  const { user } = useAuthStore();
  const { availableTenants, selectedTenantId, setSelectedTenant, hydrate, hydrated } = useCompanyContextStore();

  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [activeTenantId, setActiveTenantId] = useState<string>('');
  const [flags, setFlags] = useState<Flag[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  // Hydrate context store (for the tenant list)
  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrated, hydrate]);

  // Mirror availableTenants from context store into local state (with selectedTenantId preference)
  useEffect(() => {
    if (availableTenants && availableTenants.length > 0) {
      setTenants(availableTenants as unknown as TenantOption[]);
      if (!activeTenantId) {
        setActiveTenantId(selectedTenantId || (availableTenants[0] as { id: string }).id);
      }
    }
  }, [availableTenants, selectedTenantId, activeTenantId]);

  const fetchFlags = useCallback(async (tenantId: string) => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/super-admin/feature-flags?tenantId=${encodeURIComponent(tenantId)}`, {
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load flags');
      setFlags(data.flags || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load feature flags');
      setFlags([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTenantId) fetchFlags(activeTenantId);
  }, [activeTenantId, fetchFlags]);

  const handleToggle = async (flag: Flag, nextEnabled: boolean) => {
    setSavingKey(flag.key);
    try {
      const res = await fetch('/api/super-admin/feature-flags', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          tenantId: activeTenantId,
          key: flag.key,
          label: flag.label,
          enabled: nextEnabled,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update flag');
      setFlags((prev) => prev.map((f) => (f.key === flag.key ? { ...f, ...data.flag } : f)));
      toast.success(`${flag.label} ${nextEnabled ? 'enabled' : 'disabled'}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update flag');
    } finally {
      setSavingKey(null);
    }
  };

  if (user?.role !== 'super_admin') {
    return (
      <div className="p-6">
        <div className="thb-card p-8 text-center">
          <FiLock className="w-10 h-10 text-rose-500 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-slate-800">Super Admins Only</h2>
          <p className="text-sm text-slate-500 mt-1">Feature flags are managed by the platform owner.</p>
          <Link href="/home" className="mt-4 inline-block text-sm font-semibold text-green-600 hover:text-green-700">
            ← Back to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SrsBanner role="super_admin" />

      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/super-admin"
            className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors"
            title="Back to Super Admin Console"
          >
            <FiChevronLeft className="w-4 h-4 text-slate-600" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-thb-text-primary flex items-center gap-2">
              <FiZap className="w-6 h-6 text-teal-500" />
              Feature Flags
            </h1>
            <p className="text-sm text-thb-text-secondary mt-0.5">
              <span className="font-mono text-[11px] bg-teal-50 text-teal-700 px-1.5 py-0.5 rounded">REQ-SA-05</span>
              {' '}Enable / disable AI modules, beta features, and plan-gated functionality per parent company.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <label className="text-[11px] font-semibold text-thb-text-muted uppercase tracking-wider">Parent company:</label>
            <select
              value={activeTenantId}
              onChange={(e) => {
                setActiveTenantId(e.target.value);
                setSelectedTenant(e.target.value);
              }}
              className="px-3 py-2 rounded-lg border border-thb-border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 cursor-pointer max-w-[260px]"
            >
              <option value="">Select a parent company…</option>
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.plan})
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={() => activeTenantId && fetchFlags(activeTenantId)}
            disabled={!activeTenantId || loading}
            className="inline-flex items-center gap-2 px-3 py-2 border border-thb-border rounded-lg text-sm font-medium text-thb-text-secondary hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            <FiRefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {/* Empty state when no tenant selected */}
      {!activeTenantId && (
        <div className="thb-card p-10 text-center">
          <FiShield className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-700">Select a parent company</h3>
          <p className="text-sm text-slate-500 mt-1">
            Choose a parent company above to view and manage its feature flags.
          </p>
        </div>
      )}

      {/* Flag list */}
      {activeTenantId && (
        <div className="thb-card overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-800">
                {tenants.find((t) => t.id === activeTenantId)?.name || 'Flags'}
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {flags.length} flag{flags.length === 1 ? '' : 's'} · {flags.filter((f) => f.enabled).length} enabled
              </p>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-teal-700 bg-teal-50 px-2 py-1 rounded">
              SRS REQ-SA-05
            </span>
          </div>

          {loading ? (
            <div className="p-8 text-center text-slate-500 text-sm">Loading flags…</div>
          ) : flags.length === 0 ? (
            <div className="p-8 text-center">
              <FiInfo className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500">No feature flags. Try refreshing.</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {flags.map((f) => (
                <li key={f.id} className="px-5 py-3.5 flex items-start justify-between gap-4 hover:bg-slate-50/40 transition-colors">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-slate-800">{f.label}</p>
                      <code className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">{f.key}</code>
                      {f.source === 'platform_default' ? (
                        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">platform default</span>
                      ) : (
                        <span className="text-[9px] font-bold uppercase tracking-wider text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded">override</span>
                      )}
                    </div>
                    {f.notes && <p className="text-[11px] text-slate-500 mt-1 leading-snug">{f.notes}</p>}
                    <p className="text-[10px] text-slate-400 mt-1">Last updated: {new Date(f.updatedAt).toLocaleString()}</p>
                  </div>
                  <button
                    onClick={() => handleToggle(f, !f.enabled)}
                    disabled={savingKey === f.key}
                    className={`flex-shrink-0 relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 disabled:opacity-50 ${
                      f.enabled ? 'bg-emerald-500' : 'bg-slate-300'
                    }`}
                    role="switch"
                    aria-checked={f.enabled}
                    title={f.enabled ? 'Click to disable' : 'Click to enable'}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-200 ${
                        f.enabled ? 'translate-x-5' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Footer note */}
      <div className="rounded-xl border border-teal-100 bg-teal-50/40 p-4 flex items-start gap-3">
        <FiInfo className="w-4 h-4 text-teal-600 flex-shrink-0 mt-0.5" />
        <div className="text-[12px] text-teal-900 leading-relaxed">
          <b>How feature flags work:</b> When a flag is <b>disabled</b>, the corresponding AI module or feature is hidden from
          the tenant admin UI and the underlying API endpoints return 403. Flags marked <code className="font-mono text-[10px] bg-teal-100 px-1 py-0.5 rounded">platform_default</code> are auto-seeded for
          every tenant; flags you explicitly toggle are marked <code className="font-mono text-[10px] bg-teal-100 px-1 py-0.5 rounded">override</code> and persist across re-seeding. Every change is
          recorded in the <Link href="/super-admin/audit-logs" className="font-semibold underline">audit log</Link>.
        </div>
      </div>
    </div>
  );
}
