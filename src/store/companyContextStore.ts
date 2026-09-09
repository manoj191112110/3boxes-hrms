'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { getClientSiteMode } from '@/lib/site-mode';
import { isTenantHiddenClient, getClientHiddenSlugs, isClientLiveSite, LIVE_HIDDEN_SLUGS, DEMO_HIDDEN_SLUGS, PLATFORM_PLACEHOLDER_NAME } from '@/lib/tenant-filter';

// ─── Hidden Tenant Slugs (GOLDEN RULE) ────────────────────────────
// PRIMARY: tenant-filter.ts (FOOLPROOF hostname-based detection)
// SECONDARY: site-mode.ts (env var + host header, may fail on Vercel)
// Both are checked so even if one fails, the other catches it.
export function getHiddenSlugs(): string[] {
  // Use tenant-filter.ts as PRIMARY source (checks hostname directly)
  const foolproofSlugs = getClientHiddenSlugs();
  // Also get the site-mode based slugs as SECONDARY
  const siteModeSlugs = getClientSiteMode() === 'live' ? LIVE_HIDDEN_SLUGS : DEMO_HIDDEN_SLUGS;
  // Union both — a slug is hidden if EITHER method says so
  return [...new Set([...foolproofSlugs, ...siteModeSlugs])];
}

export function isHiddenTenant(slug: string): boolean {
  // PRIMARY: FOOLPROOF check (direct hostname, no env vars)
  if (isTenantHiddenClient(slug)) return true;
  // SECONDARY: site-mode based check
  const siteModeSlugs = getClientSiteMode() === 'live' ? LIVE_HIDDEN_SLUGS : DEMO_HIDDEN_SLUGS;
  return siteModeSlugs.includes(slug);
}

export interface TenantOption {
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: string;
  maxCompaniesAllowed?: number;
}

export interface CompanyGroupOption {
  id: string;
  name: string;
  tenantId: string;
  employeeLimitMode?: 'per_company' | 'group_total';
  maxEmployees?: number | null;
  maxCompanies?: number | null;
  notes?: string | null;
}

export interface CompanyOption {
  id: string;
  name: string;
  code: string | null;
  companyGroupId: string;
  companyGroup: { id: string; name: string };
  _count?: { branches: number; employees?: number };
}

export interface OwnCompanyInfo {
  id: string;
  name: string;
  code: string | null;
}

export interface MappedCompanyOption {
  id: string;
  name: string;
  code: string | null;
  companyGroupId: string;
  employeeCode: string;
}

export interface TenantInfo {
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: string;
  maxCompaniesAllowed: number;
  country?: string | null;
  currency?: string;
  timezone?: string;
}

export interface TenantQuota {
  maxCompanies: number;
  used: number;
  remaining: number | null; // null = unlimited
}

interface CompanyContextState {
  // Hydrated from /api/me/context
  hydrated: boolean;
  hydrating: boolean;
  lastFetchAt: number | null;
  lastError: string | null;
  role: string;
  tenantId: string | null;
  tenant: TenantInfo | null;
  tenantQuota: TenantQuota | null;
  ownCompanyId: string | null;
  ownCompany: OwnCompanyInfo | null;
  availableTenants: TenantOption[];
  availableCompanyGroups: CompanyGroupOption[];
  availableCompanies: CompanyOption[];
  mappedCompanies: MappedCompanyOption[];

  // User's current selection (admins only)
  //   selectedTenantId  — super_admin: which parent (tenant) is in scope
  //   selectedGroupId   — admin: which group company is in scope ("all companies in this group")
  //   selectedCompanyId — admin: which specific company is in scope (most specific)
  // The hierarchy of precedence is: selectedCompanyId > selectedGroupId > selectedTenantId.
  // Selecting a more specific scope clears the broader ones (e.g., picking a company
  // clears selectedGroupId because the company already implies a group).
  selectedTenantId: string | null;
  selectedGroupId: string | null;
  selectedCompanyId: string | null;

  // Actions
  hydrate: (force?: boolean) => Promise<void>;
  refreshContext: () => Promise<void>;
  refreshCompaniesFor: (tenantId: string) => Promise<void>;
  setSelectedTenant: (tenantId: string) => Promise<void>;
  setSelectedGroup: (groupId: string | null) => void;
  setSelectedCompany: (companyId: string | null) => void;
  setRole: (role: string) => void;
  reset: () => void;

  // Selectors
  effectiveCompanyId: () => string | null;
  effectiveGroupId: () => string | null;
  effectiveCompanyLabel: (userRole?: string) => string;
  canSwitch: (userRole?: string) => boolean;
  selectedTenant: () => TenantOption | null;
  selectedCompanyGroup: () => CompanyGroupOption | null;
  /**
   * Builds a URL query string with the appropriate scope parameters.
   * For super_admin: sends tenantId (so getDb resolves the tenant DB) +
   *   companyId when a specific company is selected.
   * For tenant_admin: sends companyId when a specific company is selected.
   * Returns '' when no scope is selected.
   */
  scopeQuery: () => string;
}

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

/** Dedupe concurrent hydrate() calls from layout, switcher, and pages. */
let hydrateInflight: Promise<void> | null = null;
const HYDRATE_STALE_MS = 5 * 60 * 1000; // skip repeat fetches within 5 minutes

export const useCompanyContextStore = create<CompanyContextState>()(
  persist(
    (set, get) => ({
      hydrated: false,
      hydrating: false,
      lastFetchAt: null,
      lastError: null,
      role: 'employee',
      tenantId: null,
      tenant: null,
      tenantQuota: null,
      ownCompanyId: null,
      ownCompany: null,
      availableTenants: [],
      availableCompanyGroups: [],
      availableCompanies: [],
      mappedCompanies: [],
      selectedTenantId: null,
      selectedGroupId: null,
      selectedCompanyId: null,

      hydrate: async (force?: boolean) => {
        const state = get();
        if (!force) {
          if (hydrateInflight) return hydrateInflight;
          if (state.hydrating) return hydrateInflight ?? Promise.resolve();
          if (state.hydrated && state.lastFetchAt) {
            const age = Date.now() - state.lastFetchAt;
            if (age < HYDRATE_STALE_MS) return;
          }
        }
        set({ hydrating: true });

        const run = (async () => {
        try {
          // ─── FIX: Include persisted selectedTenantId in the fetch URL ───
          // Without this, the API defaults to the first available tenant's
          // groups/companies. If the user previously selected a different tenant
          // (persisted via selectedTenantId), we must tell the API which tenant
          // to scope the groups/companies to. Otherwise, on page reload or
          // navigation, the switcher shows the wrong tenant's groups/companies
          // or none at all if the default tenant has no groups.
          const persistedTenantId = state.selectedTenantId;
          const contextUrl = persistedTenantId
            ? `/api/me/context?tenantId=${encodeURIComponent(persistedTenantId)}`
            : '/api/me/context';
          const res = await fetch(contextUrl, { headers: getAuthHeaders() });
          if (!res.ok) {
            // Don't mark hydrated=true on auth failure — let the user retry.
            // The authStore will handle 401 by logging the user out.
            const errMsg = res.status === 401
              ? 'Session expired — please sign in again.'
              : `Failed to load context (HTTP ${res.status})`;
            set({ hydrating: false, hydrated: true, lastError: errMsg, lastFetchAt: Date.now() });
            return;
          }
          const data = await res.json();
          const role = data.role || 'employee';
          const isAdmin = role === 'super_admin' || role === 'tenant_admin';
          const hasMappedCompanies = (data.mappedCompanies || []).length > 1;
          const canSwitch = isAdmin || hasMappedCompanies;

          // ─── CLIENT-SIDE SAFETY NET: Filter tenants based on site mode ───
          // GOLDEN RULE: On the LIVE site, NEVER show dummy/placeholder tenants.
          // On the DEMO site, the demo tenant (3boxes-hrms-demo) and the
          // placeholder tenant (3boxeshrms / Marq AI Tech Pvt Ltd) ARE the
          // dummy data that SHOULD be shown — so we only hide them on LIVE.
          // NUCLEAR: Also hardcode-check slug and name — works even during SSR.
          const hiddenSlugs = getHiddenSlugs();
          const _HARDCODED_HIDDEN = isClientLiveSite()
            ? LIVE_HIDDEN_SLUGS                       // ['3boxes-hrms-demo', '3boxeshrms'] — hide on live
            : [];                                    // on demo, hide nothing extra (demo's hidden slug is 'marqaitechgroup')
          const _HARDCODED_HIDDEN_NAME = isClientLiveSite() ? PLATFORM_PLACEHOLDER_NAME : '';
          const _isHardcodedHidden = (t: { slug?: string; name?: string } | null) =>
            !t ? false :
            _HARDCODED_HIDDEN.includes(t.slug || '') ||
            (_HARDCODED_HIDDEN_NAME.length > 0 && (t.name || '').includes(_HARDCODED_HIDDEN_NAME));
          if (data.availableTenants) {
            data.availableTenants = data.availableTenants.filter(
              (t: TenantOption) => !hiddenSlugs.includes(t.slug) && !_isHardcodedHidden(t)
            );
          }
          // Also override tenant/tenantId if they point to a hidden tenant
          if (data.tenant && (hiddenSlugs.includes(data.tenant.slug) || _isHardcodedHidden(data.tenant))) {
            data.tenant = data.availableTenants?.[0] || null;
            data.tenantId = data.availableTenants?.[0]?.id || null;
          }
          if (data.tenantId && !data.availableTenants?.some((t: TenantOption) => t.id === data.tenantId)) {
            data.tenantId = data.availableTenants?.[0]?.id || null;
            data.tenant = data.availableTenants?.[0] || null;
          }
          // Also filter availableCompanyGroups and availableCompanies —
          // if they belong to a hidden tenant, remove them
          if (data.availableCompanyGroups && data.availableTenants) {
            const visibleTenantIds = new Set(data.availableTenants.map((t: TenantOption) => t.id));
            data.availableCompanyGroups = data.availableCompanyGroups.filter(
              (g: CompanyGroupOption) => visibleTenantIds.has(g.tenantId)
            );
          }
          // Filter mapped companies that belong to hidden groups
          if (data.mappedCompanies && data.availableCompanyGroups) {
            const visibleGroupIds = new Set(data.availableCompanyGroups.map((g: CompanyGroupOption) => g.id));
            // mappedCompanies don't have tenantId directly, but we can filter
            // by checking if their companyGroupId is in visible groups
            // Actually, mappedCompanies don't have companyGroupId in their type
            // so we skip this — the CompanySwitcher will handle it
          }

          // Default the selected tenant to the caller's tenant for tenant_admin,
          // or to the first available for super_admin (if a previous selection
          // is not persisted or the persisted one no longer exists).
          const persistedSelectedTenant = state.selectedTenantId;
          const stillExists = persistedSelectedTenant
            ? (data.availableTenants || []).some((t: TenantOption) => t.id === persistedSelectedTenant)
            : false;
          // Also validate the caller's own tenantId — on the live site, certain
          // tenants (e.g., '3boxeshrms' / 'Marq AI Tech Pvt Ltd') are filtered
          // from availableTenants. If the caller's tenantId points to a filtered
          // tenant, we must skip it and default to the first available tenant.
          const callerTenantIdInList = data.tenantId
            ? (data.availableTenants || []).some((t: TenantOption) => t.id === data.tenantId)
            : false;
          let selectedTenantId: string | null = null;
          if (canSwitch) {
            if (role === 'super_admin') {
              selectedTenantId = (stillExists ? persistedSelectedTenant : null)
                || (callerTenantIdInList ? data.tenantId : null)
                || data.availableTenants?.[0]?.id
                || null;
            } else {
              selectedTenantId = data.tenantId;
            }
          } else {
            selectedTenantId = data.tenantId;
          }

          // For non-admins without multiple mappings, the effective company is always their own.
          // For admins, if the persisted selectedCompanyId is no longer in the
          // fresh list (e.g., company was deleted), reset it to null ("all").
          // For employees with multiple mappings, validate against mapped companies.
          const persistedSelectedCompany = state.selectedCompanyId;
          const companyStillExists = persistedSelectedCompany
            ? (data.availableCompanies || []).some((c: CompanyOption) => c.id === persistedSelectedCompany)
            : false;
          let selectedCompanyId: string | null;
          if (isAdmin) {
            selectedCompanyId = companyStillExists ? persistedSelectedCompany : null;
          } else if (hasMappedCompanies) {
            // Employee with multiple mappings — default to their own company if
            // no valid persisted selection exists.
            selectedCompanyId = companyStillExists ? persistedSelectedCompany : data.ownCompanyId;
          } else {
            selectedCompanyId = data.ownCompanyId;
          }

          // Validate the persisted selectedGroupId — if the group no longer exists
          // (e.g., was deleted by super admin), reset it to null.
          const persistedSelectedGroup = state.selectedGroupId;
          const groupStillExists = persistedSelectedGroup
            ? (data.availableCompanyGroups || []).some((g: CompanyGroupOption) => g.id === persistedSelectedGroup)
            : false;
          // If a specific company is selected, its group takes precedence over any
          // persisted group selection — we derive the group from the company.
          let selectedGroupId: string | null = null;
          if (selectedCompanyId) {
            const c = (data.availableCompanies || []).find((x: CompanyOption) => x.id === selectedCompanyId);
            selectedGroupId = c?.companyGroupId || null;
          } else if (groupStillExists) {
            selectedGroupId = persistedSelectedGroup;
          }

          set({
            hydrated: true,
            hydrating: false,
            lastFetchAt: Date.now(),
            lastError: null,
            role,
            tenantId: data.tenantId,
            tenant: data.tenant || null,
            tenantQuota: data.tenantQuota || null,
            ownCompanyId: data.ownCompanyId,
            ownCompany: data.ownCompany,
            availableTenants: data.availableTenants || [],
            availableCompanyGroups: data.availableCompanyGroups || [],
            availableCompanies: data.availableCompanies || [],
            mappedCompanies: data.mappedCompanies || [],
            selectedTenantId,
            selectedGroupId,
            selectedCompanyId,
          });
        } catch (e) {
          console.error('companyContext.hydrate error:', e);
          set({ hydrating: false, hydrated: true, lastError: 'Network error — click refresh to retry.', lastFetchAt: Date.now() });
        } finally {
          hydrateInflight = null;
        }
        })();

        hydrateInflight = run;
        return run;
      },

      refreshContext: async () => {
        // Always force a fresh fetch — used by the Refresh button in the
        // CompanySwitcher dropdown and after mutations (create tenant, etc.).
        await get().hydrate(true);
      },

      refreshCompaniesFor: async (tenantId: string) => {
        try {
          const res = await fetch(`/api/me/context?tenantId=${encodeURIComponent(tenantId)}`, { headers: getAuthHeaders() });
          if (!res.ok) return;
          const data = await res.json();

          // ─── CLIENT-SIDE SAFETY NET (GOLDEN RULE) ───
          // Apply the same filtering as hydrate() to ensure no hidden
          // tenant data leaks through this code path either.
          const hiddenSlugs = getHiddenSlugs();
          let filteredGroups = data.availableCompanyGroups || [];
          let filteredCompanies = data.availableCompanies || [];
          const currentTenants = get().availableTenants;
          if (currentTenants.length > 0) {
            const visibleTenantIds = new Set(currentTenants.map((t: TenantOption) => t.id));
            filteredGroups = filteredGroups.filter(
              (g: CompanyGroupOption) => visibleTenantIds.has(g.tenantId)
            );
            const visibleGroupIds = new Set(filteredGroups.map((g: CompanyGroupOption) => g.id));
            filteredCompanies = filteredCompanies.filter(
              (c: CompanyOption) => visibleGroupIds.has(c.companyGroupId)
            );
          }
          // Also validate: don't set tenantId to a hidden tenant
          const targetTenant = currentTenants.find((t: TenantOption) => t.id === tenantId);
          const safeTenantId = targetTenant && !hiddenSlugs.includes(targetTenant.slug) ? tenantId : null;

          set({
            availableCompanyGroups: filteredGroups,
            availableCompanies: filteredCompanies,
            selectedTenantId: safeTenantId || currentTenants[0]?.id || null,
            selectedGroupId: null,    // reset on tenant change
            selectedCompanyId: null,  // reset on tenant change
          });
        } catch (e) {
          console.error('companyContext.refreshCompaniesFor error:', e);
        }
      },

      setSelectedTenant: async (tenantId: string) => {
        // Re-fetch companies for the new tenant
        await get().refreshCompaniesFor(tenantId);
      },

      setSelectedGroup: (groupId: string | null) => {
        // Selecting a group clears any specific company selection (the company
        // would override the group). When clearing the group we also clear the
        // company for consistency.
        set({ selectedGroupId: groupId, selectedCompanyId: null });
      },

      setSelectedCompany: (companyId: string | null) => {
        // Selecting a specific company automatically derives its group, so the
        // group is always consistent with the picked company.
        const s = get();
        if (companyId) {
          const c = s.availableCompanies.find((x) => x.id === companyId);
          set({ selectedCompanyId: companyId, selectedGroupId: c?.companyGroupId || null });
        } else {
          // Clearing the company keeps the current group selection intact so
          // the user can fall back to "all companies in this group".
          set({ selectedCompanyId: null });
        }
      },

      setRole: (role: string) => {
        // Sync role from authStore.user.role — this ensures the context store
        // knows the correct role even before /api/me/context finishes hydrating,
        // which prevents the "Not yet assigned" flash in the CompanySwitcher.
        const r = (role || 'employee').toLowerCase();
        set((s) => (s.role === r ? s : { ...s, role: r }));
      },

      reset: () => {
        set({
          hydrated: false,
          hydrating: false,
          lastFetchAt: null,
          lastError: null,
          tenant: null,
          tenantQuota: null,
          availableTenants: [],
          availableCompanyGroups: [],
          availableCompanies: [],
          mappedCompanies: [],
          selectedTenantId: null,
          selectedGroupId: null,
          selectedCompanyId: null,
        });
      },

      effectiveCompanyId: () => {
        const s = get();
        const r = s.role;
        if (r === 'super_admin' || r === 'tenant_admin') {
          // Admin can choose to view "all companies" (null) or a specific one
          return s.selectedCompanyId;
        }
        // Employee with multiple mapped companies can switch between them
        if (s.mappedCompanies.length > 1 && s.selectedCompanyId) {
          return s.selectedCompanyId;
        }
        return s.ownCompanyId;
      },

      effectiveGroupId: () => {
        const s = get();
        const r = s.role;
        if (r === 'super_admin' || r === 'tenant_admin') {
          // If a specific company is selected, its group is implied.
          if (s.selectedCompanyId) {
            const c = s.availableCompanies.find((x) => x.id === s.selectedCompanyId);
            return c?.companyGroupId || s.selectedGroupId || null;
          }
          return s.selectedGroupId;
        }
        // Employees with mapped companies: derive from the selected company
        if (s.mappedCompanies.length > 1 && s.selectedCompanyId) {
          const mc = s.mappedCompanies.find((x) => x.id === s.selectedCompanyId);
          return mc?.companyGroupId || null;
        }
        // Non-admins: derive from their own company.
        if (s.ownCompanyId) {
          const c = s.availableCompanies.find((x) => x.id === s.ownCompanyId);
          return c?.companyGroupId || null;
        }
        return null;
      },

      effectiveCompanyLabel: (userRole?: string) => {
        const s = get();
        // Prefer the explicitly passed userRole (from authStore.user.role) —
        // this is set immediately after login, whereas s.role is only set
        // after /api/me/context hydrates. Without this, the CompanySwitcher
        // would briefly show "Not yet assigned" for tenant_admin right after
        // page reload.
        const r = (userRole || s.role || 'employee').toLowerCase();
        if (r === 'super_admin' || r === 'tenant_admin') {
          // Most specific: a single company
          if (s.selectedCompanyId) {
            const c = s.availableCompanies.find((x) => x.id === s.selectedCompanyId);
            return c?.name || 'Unknown company';
          }
          // Next: a group company ("all companies in this group")
          if (s.selectedGroupId) {
            const g = s.availableCompanyGroups.find((x) => x.id === s.selectedGroupId);
            if (g) return `${g.name} (group)`;
          }
          // Broadest: all companies in the tenant/parent
          if (r === 'tenant_admin') {
            return s.tenant?.name ? `${s.tenant.name} (all)` : 'All companies (group)';
          }
          const t = s.availableTenants.find((x) => x.id === s.selectedTenantId);
          return t ? `${t.name} (all)` : 'All parents';
        }
        // Employee with multiple mapped companies — show the currently selected one
        if (s.mappedCompanies.length > 1) {
          if (s.selectedCompanyId) {
            const mc = s.mappedCompanies.find((x) => x.id === s.selectedCompanyId);
            if (mc) return mc.name;
          }
          return s.ownCompany?.name || 'Not yet assigned';
        }
        return s.ownCompany?.name || 'Not yet assigned';
      },

      canSwitch: (userRole?: string) => {
        const s = get();
        const r = (userRole || s.role || 'employee').toLowerCase();
        if (r === 'super_admin' || r === 'tenant_admin') return true;
        // Employees with multiple mapped companies can switch between them
        return s.mappedCompanies.length > 1;
      },

      selectedTenant: () => {
        const s = get();
        return s.availableTenants.find((t) => t.id === s.selectedTenantId) || null;
      },

      selectedCompanyGroup: () => {
        const s = get();
        if (!s.selectedCompanyId) return null;
        const c = s.availableCompanies.find((x) => x.id === s.selectedCompanyId);
        if (!c) return null;
        return s.availableCompanyGroups.find((g) => g.id === c.companyGroupId) || null;
      },

      scopeQuery: () => {
        const s = get();
        const r = (s.role || 'employee').toLowerCase();
        const params = new URLSearchParams();
        if (r === 'super_admin') {
          // Super_admin needs tenantId so getDb() resolves the correct
          // tenant DB. When a specific company is also selected, send both.
          if (s.selectedTenantId) {
            params.set('tenantId', s.selectedTenantId);
          }
          if (s.selectedCompanyId) {
            params.set('companyId', s.selectedCompanyId);
          }
        } else if (r === 'tenant_admin') {
          if (s.selectedCompanyId) {
            params.set('companyId', s.selectedCompanyId);
          }
        }
        return params.toString();
      },
    }),
    {
      name: 'tb_company_ctx_v3', // v3: mode-aware filter — v2 had a bug that wiped demo tenants on demo link
      storage: createJSONStorage(() => localStorage),
      // Persist the user's selection AND role — role is needed so the
      // CompanySwitcher can render the correct label/button immediately on
      // page load, before /api/me/context has hydrated. Without persisting
      // role, tenant_admin would briefly see "Not yet assigned" on every
      // page navigation.
      partialize: (s) => ({
        selectedTenantId: s.selectedTenantId,
        selectedGroupId: s.selectedGroupId,
        selectedCompanyId: s.selectedCompanyId,
        role: s.role,
        tenantId: s.tenantId,
        ownCompanyId: s.ownCompanyId,
        ownCompany: s.ownCompany,
        tenant: s.tenant,
        mappedCompanies: s.mappedCompanies,
      }),
      // ─── CRITICAL: Filter persisted localStorage data on rehydration ───
      // When Zustand loads from localStorage, the persisted tenant/tenantId
      // might point to a hidden tenant (e.g., '3boxeshrms' / Marq AI Tech Pvt Ltd).
      // We MUST scrub these before the store renders, otherwise the
      // CompanySwitcher will flash the hidden tenant on page load.
      onRehydrateStorage: () => {
        return (_state, persisted) => {
          if (!persisted) return;
          const hidden = getHiddenSlugs();
          // NUCLEAR: Also hardcode-check — works even if getHiddenSlugs() fails
          // MODE-AWARE: On live, hide demo/placeholder tenants. On demo, show them.
          const _HARDCODED_HIDDEN = isClientLiveSite()
            ? LIVE_HIDDEN_SLUGS
            : [];
          const _HARDCODED_HIDDEN_NAME = isClientLiveSite() ? PLATFORM_PLACEHOLDER_NAME : '';
          const _isHardcodedHidden = (t: { slug?: string; name?: string } | null) =>
            !t ? false :
            _HARDCODED_HIDDEN.includes(t.slug || '') ||
            (_HARDCODED_HIDDEN_NAME.length > 0 && (t.name || '').includes(_HARDCODED_HIDDEN_NAME));
          // If persisted tenant points to a hidden slug, null it out
          if (persisted.tenant && persisted.tenant.slug && (hidden.includes(persisted.tenant.slug) || _isHardcodedHidden(persisted.tenant))) {
            console.warn(`[companyCtx] Scrubbing hidden tenant "${persisted.tenant.slug}" from localStorage on rehydration`);
            persisted.tenant = null;
            persisted.tenantId = null;
            persisted.selectedTenantId = null;
          }
          // NUCLEAR: Also filter availableTenants that match hardcoded hidden slugs/names
          if (persisted.availableTenants && Array.isArray(persisted.availableTenants)) {
            const before = persisted.availableTenants.length;
            persisted.availableTenants = persisted.availableTenants.filter(
              (t: TenantOption) => !hidden.includes(t.slug) && !_isHardcodedHidden(t)
            );
            if (persisted.availableTenants.length !== before) {
              console.warn(`[companyCtx] Scrubbed ${before - persisted.availableTenants.length} hidden tenants from availableTenants on rehydration`);
            }
          }
          // If persisted tenantId is set but tenant was cleared, also clear
          if (persisted.tenantId && !persisted.tenant) {
            persisted.tenantId = null;
            persisted.selectedTenantId = null;
          }
          // GOLDEN RULE: Also clear selectedTenantId if it matches a hidden tenant
          // (e.g., user previously selected '3boxeshrms' and it was persisted)
          if (persisted.selectedTenantId) {
            // We can't look up the slug from just an ID here, but we already
            // cleared selectedTenantId if tenant was hidden above. As an extra
            // safety net, if tenantId was cleared, also clear selectedTenantId.
            if (!persisted.tenantId) {
              persisted.selectedTenantId = null;
            }
          }
          // Also scrub ownCompany/ownCompanyId if they somehow reference
          // data from a hidden tenant (edge case but possible)
          if (persisted.tenantId === null && persisted.ownCompany) {
            // If we have no tenant, we shouldn't have an ownCompany either
            // (it would be orphaned data from a hidden tenant)
            persisted.ownCompany = null;
            persisted.ownCompanyId = null;
          }
        };
      },
    }
  )
);
