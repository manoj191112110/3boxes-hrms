'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  FiGrid, FiRefreshCw, FiShield, FiCheck, FiInfo, FiChevronLeft, FiLock,
  FiUsers, FiBriefcase, FiUserPlus, FiClock, FiCalendar,
  FiDollarSign, FiTrendingUp, FiFolder, FiPackage,
  FiGlobe, FiHelpCircle, FiMessageCircle, FiBookOpen,
  FiSettings, FiServer, FiWatch, FiTarget,
  FiShoppingBag, FiTruck, FiLayers, FiCreditCard,
  FiPlayCircle, FiHeart, FiBook, FiMonitor, FiShoppingCart,
  FiBarChart2, FiAlertCircle, FiMapPin, FiActivity, FiDatabase,
  FiUserCheck, FiSearch, FiToggleLeft, FiToggleRight,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import { useCompanyContextStore } from '@/store/companyContextStore';
import { useTenantModuleStore } from '@/store/tenantModuleStore';
import SrsBanner from '@/components/SrsBanner';

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

interface ModuleEntry {
  id: string;
  key: string;
  label: string;
  description: string;
  enabled: boolean;
  source: string;
  group: string;
  updatedAt: string;
}

interface TenantOption {
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: string;
}

// Module icon mapping
function getModuleIcon(key: string) {
  const iconMap: Record<string, React.ReactNode> = {
    'super-admin': <FiShield className="w-4 h-4" />,
    'tenant': <FiServer className="w-4 h-4" />,
    'company': <FiBriefcase className="w-4 h-4" />,
    'employee': <FiUsers className="w-4 h-4" />,
    'leave': <FiCalendar className="w-4 h-4" />,
    'attendance': <FiClock className="w-4 h-4" />,
    'payroll': <FiDollarSign className="w-4 h-4" />,
    'recruitment': <FiUserPlus className="w-4 h-4" />,
    'onboarding': <FiPlayCircle className="w-4 h-4" />,
    'preboarding': <FiUserCheck className="w-4 h-4" />,
    'appraisal': <FiTrendingUp className="w-4 h-4" />,
    'project': <FiFolder className="w-4 h-4" />,
    'travel-expense': <FiTruck className="w-4 h-4" />,
    'assets': <FiMonitor className="w-4 h-4" />,
    'accounts': <FiCreditCard className="w-4 h-4" />,
    'crm': <FiShoppingCart className="w-4 h-4" />,
    'external': <FiGlobe className="w-4 h-4" />,
    'marketplace': <FiShoppingBag className="w-4 h-4" />,
    'support': <FiHelpCircle className="w-4 h-4" />,
    'collaboration': <FiMessageCircle className="w-4 h-4" />,
    'knowledge': <FiBook className="w-4 h-4" />,
    'governance': <FiSettings className="w-4 h-4" />,
  };
  return iconMap[key] || <FiGrid className="w-4 h-4" />;
}

// Module color mapping
function getModuleColor(key: string) {
  const colorMap: Record<string, string> = {
    'super-admin': 'from-red-500 to-rose-600',
    'tenant': 'from-orange-500 to-amber-600',
    'company': 'from-emerald-500 to-green-600',
    'employee': 'from-green-500 to-emerald-600',
    'leave': 'from-teal-500 to-cyan-600',
    'attendance': 'from-cyan-500 to-sky-600',
    'payroll': 'from-green-500 to-emerald-600',
    'recruitment': 'from-teal-500 to-teal-600',
    'onboarding': 'from-emerald-500 to-teal-600',
    'preboarding': 'from-lime-500 to-green-600',
    'appraisal': 'from-amber-500 to-yellow-600',
    'project': 'from-fuchsia-500 to-pink-600',
    'travel-expense': 'from-orange-500 to-red-600',
    'assets': 'from-slate-500 to-gray-600',
    'accounts': 'from-emerald-500 to-green-600',
    'crm': 'from-pink-500 to-rose-600',
    'external': 'from-teal-500 to-teal-600',
    'marketplace': 'from-rose-500 to-pink-600',
    'support': 'from-yellow-500 to-orange-600',
    'collaboration': 'from-teal-500 to-emerald-600',
    'knowledge': 'from-green-500 to-cyan-600',
    'governance': 'from-gray-500 to-slate-600',
  };
  return colorMap[key] || 'from-slate-400 to-slate-500';
}

export default function TenantModulesPage() {
  const { user } = useAuthStore();
  const { availableTenants, selectedTenantId, setSelectedTenant, hydrate, hydrated } = useCompanyContextStore();
  const { toggleModule } = useTenantModuleStore();

  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [activeTenantId, setActiveTenantId] = useState<string>('');
  const [activeTenantSlug, setActiveTenantSlug] = useState<string>('');
  const [modules, setModules] = useState<ModuleEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Hydrate context store
  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrated, hydrate]);

  // Mirror availableTenants into local state
  useEffect(() => {
    if (availableTenants && availableTenants.length > 0) {
      setTenants(availableTenants as unknown as TenantOption[]);
      if (!activeTenantId) {
        const defaultId = selectedTenantId || (availableTenants[0] as { id: string }).id;
        setActiveTenantId(defaultId);
      }
    }
  }, [availableTenants, selectedTenantId, activeTenantId]);

  const fetchModules = useCallback(async (tenantId: string) => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/super-admin/tenant-modules?tenantId=${encodeURIComponent(tenantId)}`, {
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load modules');
      setModules(data.modules || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load tenant modules');
      setModules([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTenantId) {
      fetchModules(activeTenantId);
      // Find tenant slug for the active tenant
      const t = tenants.find((t) => t.id === activeTenantId);
      if (t) setActiveTenantSlug(t.slug);
    }
  }, [activeTenantId, fetchModules, tenants]);

  const handleToggle = async (module: ModuleEntry, nextEnabled: boolean) => {
    setSavingKey(module.key);
    // Optimistic UI update
    toggleModule(activeTenantSlug, module.key, nextEnabled);
    setModules((prev) => prev.map((m) => (m.key === module.key ? { ...m, enabled: nextEnabled } : m)));
    try {
      const res = await fetch('/api/super-admin/tenant-modules', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          tenantId: activeTenantId,
          moduleKey: module.key,
          enabled: nextEnabled,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update module');
      toast.success(`${module.label} ${nextEnabled ? 'enabled' : 'disabled'} for ${tenants.find((t) => t.id === activeTenantId)?.name || 'tenant'}`);
    } catch (err) {
      // Revert optimistic update
      toggleModule(activeTenantSlug, module.key, !nextEnabled);
      setModules((prev) => prev.map((m) => (m.key === module.key ? { ...m, enabled: !nextEnabled } : m)));
      toast.error(err instanceof Error ? err.message : 'Failed to update module');
    } finally {
      setSavingKey(null);
    }
  };

  const handleEnableAll = async () => {
    const disabled = modules.filter((m) => !m.enabled);
    if (disabled.length === 0) return;
    setSavingKey('__all__');
    try {
      for (const m of disabled) {
        await fetch('/api/super-admin/tenant-modules', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ tenantId: activeTenantId, moduleKey: m.key, enabled: true }),
        });
        toggleModule(activeTenantSlug, m.key, true);
      }
      setModules((prev) => prev.map((m) => ({ ...m, enabled: true })));
      toast.success(`All ${disabled.length} modules enabled`);
    } catch (err) {
      toast.error('Failed to enable some modules');
    } finally {
      setSavingKey(null);
    }
  };

  const handleDisableAll = async () => {
    const enabled = modules.filter((m) => m.enabled && m.key !== 'super-admin' && m.key !== 'tenant');
    if (enabled.length === 0) return;
    setSavingKey('__all__');
    try {
      for (const m of enabled) {
        await fetch('/api/super-admin/tenant-modules', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ tenantId: activeTenantId, moduleKey: m.key, enabled: false }),
        });
        toggleModule(activeTenantSlug, m.key, false);
      }
      setModules((prev) => prev.map((m) => ({
        ...m,
        enabled: m.key === 'super-admin' || m.key === 'tenant' ? m.enabled : false,
      })));
      toast.success(`${enabled.length} modules disabled (core modules kept enabled)`);
    } catch (err) {
      toast.error('Failed to disable some modules');
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
          <p className="text-sm text-slate-500 mt-1">Module management is restricted to the platform owner.</p>
          <Link href="/home" className="mt-4 inline-block text-sm font-semibold text-green-600 hover:text-green-700">
            &larr; Back to Home
          </Link>
        </div>
      </div>
    );
  }

  // Group modules by group
  const groupedModules = modules.reduce<Record<string, ModuleEntry[]>>((acc, m) => {
    const g = m.group || 'Other';
    if (!acc[g]) acc[g] = [];
    acc[g].push(m);
    return acc;
  }, {});

  // Search filtering
  const filteredGroups = searchQuery.trim()
    ? Object.fromEntries(
        Object.entries(groupedModules).map(([group, mods]) => [
          group,
          mods.filter((m) =>
            m.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
            m.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
            m.description.toLowerCase().includes(searchQuery.toLowerCase())
          ),
        ]).filter(([, mods]) => mods.length > 0)
      )
    : groupedModules;

  const enabledCount = modules.filter((m) => m.enabled).length;
  const totalCount = modules.length;

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
              <FiGrid className="w-6 h-6 text-indigo-500" />
              Module Management
            </h1>
            <p className="text-sm text-thb-text-secondary mt-0.5">
              Enable / disable HRMS modules per parent company. Changes take effect immediately.
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
              className="px-3 py-2 rounded-lg border border-thb-border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 cursor-pointer max-w-[260px]"
            >
              <option value="">Select a parent company...</option>
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.slug})
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={() => activeTenantId && fetchModules(activeTenantId)}
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
            Choose a parent company above to view and manage its module visibility.
          </p>
        </div>
      )}

      {/* Module list */}
      {activeTenantId && (
        <>
          {/* Stats bar */}
          <div className="thb-card p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-800">
                {tenants.find((t) => t.id === activeTenantId)?.name || 'Modules'}
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {enabledCount} of {totalCount} modules enabled
              </p>
              {/* Progress bar */}
              <div className="mt-2 w-48 h-2 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 rounded-full transition-all duration-300"
                  style={{ width: `${totalCount > 0 ? (enabledCount / totalCount) * 100 : 0}%` }}
                />
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Search */}
              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search modules..."
                  className="pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 w-48"
                />
              </div>
              <button
                onClick={handleEnableAll}
                disabled={savingKey !== null || loading}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-emerald-500 text-white hover:bg-emerald-600 transition-colors disabled:opacity-50"
              >
                <FiToggleRight className="w-3.5 h-3.5" /> Enable All
              </button>
              <button
                onClick={handleDisableAll}
                disabled={savingKey !== null || loading}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-slate-200 text-slate-700 hover:bg-slate-300 transition-colors disabled:opacity-50"
              >
                <FiToggleLeft className="w-3.5 h-3.5" /> Disable All
              </button>
            </div>
          </div>

          {/* Module groups */}
          {loading ? (
            <div className="thb-card p-8 text-center text-slate-500 text-sm">Loading modules...</div>
          ) : Object.keys(filteredGroups).length === 0 ? (
            <div className="thb-card p-8 text-center">
              <FiInfo className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500">
                {searchQuery ? 'No modules match your search.' : 'No modules found. Try refreshing.'}
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(filteredGroups).sort(([a], [b]) => a.localeCompare(b)).map(([group, groupModules]) => (
                <div key={group}>
                  {/* Group header */}
                  <div className="flex items-center gap-2 mb-3">
                    <h2 className="text-sm font-bold text-thb-text-primary">{group}</h2>
                    <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                      {groupModules.filter((m) => m.enabled).length}/{groupModules.length} enabled
                    </span>
                  </div>

                  {/* Module cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {groupModules.map((m) => {
                      const gradient = getModuleColor(m.key);
                      const isCore = m.key === 'super-admin' || m.key === 'tenant';
                      return (
                        <div
                          key={m.key}
                          className={`rounded-xl border transition-all duration-200 overflow-hidden ${
                            m.enabled
                              ? 'border-slate-200 bg-white hover:border-indigo-200 hover:shadow-md'
                              : 'border-slate-200 bg-slate-50/50 opacity-70 hover:opacity-90'
                          }`}
                        >
                          <div className="p-3 flex items-start gap-3">
                            {/* Icon */}
                            <div className={`flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-md ${!m.enabled ? 'grayscale opacity-50' : ''}`}>
                              <span className="text-white">{getModuleIcon(m.key)}</span>
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <h3 className="text-xs font-bold text-thb-text-primary truncate">{m.label}</h3>
                                {isCore && (
                                  <span className="text-[8px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                                    Core
                                  </span>
                                )}
                                {m.source === 'override' && (
                                  <span className="text-[8px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                                    Override
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-thb-text-secondary mt-0.5 leading-tight line-clamp-2">{m.description}</p>
                              <p className="text-[9px] text-slate-400 mt-1">
                                Updated: {new Date(m.updatedAt).toLocaleDateString()}
                              </p>
                            </div>

                            {/* Toggle */}
                            <button
                              onClick={() => handleToggle(m, !m.enabled)}
                              disabled={savingKey !== null || (isCore && m.enabled)}
                              className={`flex-shrink-0 relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 disabled:opacity-50 ${
                                m.enabled ? 'bg-emerald-500' : 'bg-slate-300'
                              }`}
                              role="switch"
                              aria-checked={m.enabled}
                              title={
                                isCore && m.enabled
                                  ? 'Core modules cannot be disabled'
                                  : m.enabled
                                    ? 'Click to disable'
                                    : 'Click to enable'
                              }
                            >
                              <span
                                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-200 ${
                                  m.enabled ? 'translate-x-5' : 'translate-x-0.5'
                                }`}
                              />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Footer note */}
      <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-4 flex items-start gap-3">
        <FiInfo className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" />
        <div className="text-[12px] text-indigo-900 leading-relaxed">
          <b>How module management works:</b> When a module is <b>disabled</b>, it is hidden from the sidebar and Modules page for that tenant.
          Users in that tenant will not see or be able to access the disabled module until a super admin re-enables it.
          Core modules (Super Admin, Tenant Management) cannot be disabled. Changes are recorded in the{' '}
          <Link href="/super-admin/audit-logs" className="font-semibold underline">audit log</Link>.
        </div>
      </div>
    </div>
  );
}
