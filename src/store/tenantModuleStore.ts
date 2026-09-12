/**
 * Tenant Module Store — Caches per-tenant module visibility flags.
 *
 * On login, the app fetches which modules are enabled for the current tenant
 * from the /api/super-admin/tenant-modules API. The Sidebar and Modules page
 * use this store to decide which nav sections to show.
 *
 * Falls back to the hardcoded TENANT_MODULE_WHITELIST in roleAccess.ts
 * if the API hasn't been called yet or fails.
 */
import { create } from 'zustand';
import { setDbModuleOverrides } from '@/lib/roleAccess';

interface TenantModuleState {
  /** Map of tenantSlug → Set of enabled module keys */
  enabledModules: Record<string, Set<string>>;
  /** Whether we've fetched modules for a given tenant slug */
  fetched: Record<string, boolean>;
  /** Loading state */
  loading: boolean;

  /** Fetch enabled modules for a tenant from the API */
  fetchModules: (tenantId: string, tenantSlug: string) => Promise<void>;
  /** Check if a module is enabled for a tenant (sync, from cache) */
  isModuleEnabled: (tenantSlug: string, moduleKey: string) => boolean | null;
  /** Get all enabled module keys for a tenant */
  getEnabledKeys: (tenantSlug: string) => Set<string> | null;
  /** Optimistically toggle a module (for instant UI feedback) */
  toggleModule: (tenantSlug: string, moduleKey: string, enabled: boolean) => void;
  /** Clear cache (e.g. on logout) */
  clear: () => void;
}

export const useTenantModuleStore = create<TenantModuleState>((set, get) => ({
  enabledModules: {},
  fetched: {},
  loading: false,

  fetchModules: async (tenantId: string, tenantSlug: string) => {
    if (get().fetched[tenantSlug]) return; // Already fetched
    set({ loading: true });
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      // Use the public endpoint (works for any authenticated user)
      const res = await fetch(`/api/tenant-modules?tenantId=${encodeURIComponent(tenantId)}`, { headers });
      if (!res.ok) {
        console.warn('[tenantModuleStore] Failed to fetch modules:', res.status);
        set({ loading: false });
        return;
      }
      const data = await res.json();
      const enabledKeys = new Set<string>(
        (data.modules || [])
          .filter((m: { enabled: boolean; key: string }) => m.enabled)
          .map((m: { key: string }) => m.key)
      );
      set((state) => {
        const newEnabledModules = { ...state.enabledModules, [tenantSlug]: enabledKeys };
        // Sync with roleAccess.ts so isModuleEnabledForTenant() uses DB data
        setDbModuleOverrides(newEnabledModules);
        return {
          enabledModules: newEnabledModules,
          fetched: { ...state.fetched, [tenantSlug]: true },
          loading: false,
        };
      });
    } catch (err) {
      console.error('[tenantModuleStore] fetchModules error:', err);
      set({ loading: false });
    }
  },

  isModuleEnabled: (tenantSlug: string, moduleKey: string) => {
    const enabled = get().enabledModules[tenantSlug];
    if (!enabled) return null; // Not fetched yet — caller should use fallback
    return enabled.has(moduleKey);
  },

  getEnabledKeys: (tenantSlug: string) => {
    return get().enabledModules[tenantSlug] || null;
  },

  toggleModule: (tenantSlug: string, moduleKey: string, enabled: boolean) => {
    set((state) => {
      const current = state.enabledModules[tenantSlug] || new Set<string>();
      const next = new Set(current);
      if (enabled) next.add(moduleKey);
      else next.delete(moduleKey);
      const newEnabledModules = { ...state.enabledModules, [tenantSlug]: next };
      // Sync with roleAccess.ts so isModuleEnabledForTenant() uses DB data
      setDbModuleOverrides(newEnabledModules);
      return {
        enabledModules: newEnabledModules,
      };
    });
  },

  clear: () => {
    setDbModuleOverrides({});
    set({ enabledModules: {}, fetched: {}, loading: false });
  },
}));
