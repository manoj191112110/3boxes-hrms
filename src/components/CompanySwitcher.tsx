'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  FiChevronDown, FiHome, FiGrid, FiCheck, FiSearch,
  FiBriefcase, FiLayers, FiInfo, FiUsers, FiShield,
  FiRefreshCw, FiAlertCircle,
} from 'react-icons/fi';
import { useAuthStore } from '@/store/authStore';
import { useCompanyContextStore, isHiddenTenant } from '@/store/companyContextStore';
import { isTenantHiddenClient, isClientLiveSite, LIVE_HIDDEN_SLUGS, PLATFORM_PLACEHOLDER_NAME } from '@/lib/tenant-filter';

/**
 * CompanySwitcher
 *
 * - Super admin: cascading dropdown — Tenant → Company (with "All companies in tenant" option)
 * - Tenant admin: dropdown of companies under their tenant (with "All companies (group)" option)
 * - Other roles: static badge showing their configured company name
 *
 * For super admin view, every company item ALSO shows the parent tenant name in
 * small text so it's always clear under which tenant a given company was created.
 *
 * The component auto-hydrates from /api/me/context on first mount. The selection
 * is persisted via the companyContextStore, so navigating between pages keeps
 * the same context.
 *
 * ROBUSTNESS: If the initial /api/me/context call fails or returns an empty
 * list (e.g., user just created their first tenant and the dropdown hasn't
 * refreshed), the dropdown auto-retries when opened AND exposes a manual
 * Refresh button so the user can always pull fresh data.
 */
export default function CompanySwitcher() {
  const { user } = useAuthStore();
  const {
    hydrated, hydrate, refreshContext,
    role, ownCompany, ownCompanyId, tenant, tenantQuota,
    availableTenants, availableCompanies, availableCompanyGroups,
    selectedTenantId, selectedGroupId, selectedCompanyId,
    setSelectedTenant, setSelectedGroup, setSelectedCompany, setRole,
    effectiveCompanyLabel,
    hydrating, lastError, lastFetchAt,
    mappedCompanies,
  } = useCompanyContextStore();

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  // ─── GOLDEN RULE: ULTIMATE DEFENSIVE FILTER — NEVER render hidden tenants ───
  // This is the FINAL backstop. It uses THREE independent checks:
  //   1. HARDCODED slug/name check — MODE-AWARE: only hide demo/placeholder on LIVE
  //   2. tenant-filter.ts (isTenantHiddenClient) — checks window.location.hostname DIRECTLY
  //   3. isHiddenTenant from store — combines hostname + site-mode detection
  // On the DEMO link, the demo tenant (3boxes-hrms-demo) and the placeholder
  // tenant (3boxeshrms / Marq AI Tech Pvt Ltd) ARE the dummy data that SHOULD
  // be shown in the switcher — so we only apply the hardcoded filter on LIVE.
  const _HARDCODED_HIDDEN_SLUGS = isClientLiveSite() ? LIVE_HIDDEN_SLUGS : [];
  const _HARDCODED_HIDDEN_NAME = isClientLiveSite() ? PLATFORM_PLACEHOLDER_NAME : '';
  const _isHardcodedHidden = (t: { slug?: string; name?: string } | null) =>
    !t ? false :
    _HARDCODED_HIDDEN_SLUGS.includes(t.slug || '') ||
    (_HARDCODED_HIDDEN_NAME.length > 0 && (t.name || '').includes(_HARDCODED_HIDDEN_NAME));
  const safeAvailableTenants = availableTenants.filter(t =>
    !_isHardcodedHidden(t) && !isTenantHiddenClient(t.slug) && !isHiddenTenant(t.slug)
  );
  const safeTenant = tenant && !_isHardcodedHidden(tenant) && !isTenantHiddenClient(tenant.slug) && !isHiddenTenant(tenant.slug) ? tenant : null;

  // ─── GOLDEN RULE: Defensive filter — NEVER render companies/groups from hidden tenants ───
  // If availableCompanyGroups or availableCompanies belong to a hidden tenant
  // (e.g., leaked by /api/me/context before the fix), scrub them at render time.
  // This is a belt-and-suspenders approach: the API should already filter them
  // out, but we enforce the golden rule client-side too.
  const visibleTenantIds = new Set(safeAvailableTenants.map(t => t.id));
  const safeAvailableCompanyGroups = availableCompanyGroups.filter(g => visibleTenantIds.has(g.tenantId));
  const safeGroupIds = new Set(safeAvailableCompanyGroups.map(g => g.id));
  const safeAvailableCompanies = availableCompanies.filter(c => safeGroupIds.has(c.companyGroupId));

  /**
   * SRS REQ-SA-10 / REQ-SEC-06: log every context swap to the audit trail.
   * Best-effort — never blocks the UI on a logging failure. We read the
   * CURRENT selection from the store via getState() so the "from" context is
   * always accurate, even inside stale closures.
   */
  const logSwap = useCallback((to: {
    toTenantId?: string | null;
    toTenantName?: string | null;
    toCompanyId?: string | null;
    toCompanyName?: string | null;
  }) => {
    if (typeof window === 'undefined') return;
    const token = localStorage.getItem('tb_token');
    if (!token) return;
    const state = useCompanyContextStore.getState();
    fetch('/api/audit/context-swap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        fromTenantId: state.selectedTenantId || null,
        fromCompanyId: state.selectedCompanyId || null,
        toTenantId: to.toTenantId ?? null,
        toTenantName: to.toTenantName ?? null,
        toCompanyId: to.toCompanyId ?? null,
        toCompanyName: to.toCompanyName ?? null,
      }),
    }).catch(() => { /* best-effort */ });
  }, []);

  // Keep the context store's `role` in sync with the authStore's `user.role`.
  // This is critical: without it, when a tenant_admin logs in and lands on the
  // dashboard, the context store's `role` is still 'employee' (default) until
  // /api/me/context finishes hydrating. During that brief window the switcher
  // button label resolves to "Not yet assigned" instead of "All companies (group)".
  // Syncing here means the label is correct from the very first render.
  useEffect(() => {
    if (user?.role) {
      setRole(user.role);
    }
  }, [user?.role, setRole]);

  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrated, hydrate]);

  // Re-hydrate when tab becomes visible — throttled to avoid hammering me/context
  useEffect(() => {
    function onVisibilityChange() {
      if (document.visibilityState !== 'visible' || !hydrated) return;
      const age = lastFetchAt ? Date.now() - lastFetchAt : Infinity;
      if (age > 5 * 60 * 1000) hydrate(true);
    }
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [hydrated, hydrate, lastFetchAt]);

  // AUTO-RETRY WHEN OPENING DROPDOWN: If the user opens the dropdown and the
  // expected data is missing (e.g., the initial fetch failed silently, or they
  // just created their first tenant/group/company on another tab), we kick off
  // a forced refresh. This fixes the "dropdown is empty but Tenants tab shows
  // data" symptom — the most common cause is a stale `hydrated=true` flag from
  // an earlier failed fetch.
  useEffect(() => {
    if (!open) return;
    const userRole = (user?.role || role || 'employee').toLowerCase();
    if (userRole === 'super_admin' && safeAvailableTenants.length === 0 && !hydrating) {
      refreshContext();
    } else if (userRole === 'tenant_admin' && safeAvailableCompanies.length === 0 && !hydrating) {
      // Only auto-refresh if we also have no groups — otherwise the tenant
      // legitimately has groups but no companies yet, and auto-refresh would
      // cause an unnecessary flicker every time they open the dropdown.
      if (safeAvailableCompanyGroups.length === 0) {
        refreshContext();
      }
    } else if (!['super_admin', 'tenant_admin'].includes(userRole) && mappedCompanies.length === 0 && !hydrating) {
      // Employee with mapped companies: auto-refresh if no mappings loaded yet
      refreshContext();
    }
  }, [open, user?.role, role, safeAvailableTenants.length, safeAvailableCompanies.length, safeAvailableCompanyGroups.length, mappedCompanies.length, hydrating, refreshContext]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Use the authStore's user.role as the source of truth — it's set
  // immediately after login, whereas the context store's `role` may lag
  // behind by one render cycle. This prevents the "Not yet assigned" flash.
  const userRole = (user?.role || role || 'employee').toLowerCase();
  const isSuperAdmin = userRole === 'super_admin';
  const isTenantAdmin = userRole === 'tenant_admin';
  const isAdmin = isSuperAdmin || isTenantAdmin;
  const hasMappedCompanies = mappedCompanies.length > 1;
  const allowSwitch = isAdmin || hasMappedCompanies;

  // The tenant that's currently in scope (for super_admin: the selected one;
  // for tenant_admin: their own tenant)
  const scopedTenant = isSuperAdmin
    ? safeAvailableTenants.find((t) => t.id === selectedTenantId) || null
    : safeTenant;

  // For admins: group companies by companyGroup for nicer UX.
  // IMPORTANT: We also include groups from safeAvailableCompanyGroups that have
  // NO companies yet. Previously, empty groups were invisible in the dropdown,
  // which confused users who created a group but couldn't see it or select it.
  //
  // BUG FIX: Use `companyGroupId` (the raw foreign key) as the primary
  // grouping key, falling back to `companyGroup?.id` (the Prisma relation).
  // Previously we used `companyGroup?.id` which could be null if the relation
  // wasn't loaded, causing companies to appear under "Ungrouped" instead of
  // their correct group. The foreign key `companyGroupId` is always present
  // (it's a required field on Company), so it's the reliable source of truth.
  // GOLDEN RULE: Use safeAvailableCompanyGroups and safeAvailableCompanies
  // so we never group/render companies from hidden tenants.
  const groupedCompanies = safeAvailableCompanyGroups.reduce<Record<string, { groupName: string; items: typeof safeAvailableCompanies }>>((acc, g) => {
    acc[g.id] = { groupName: g.name, items: [] };
    return acc;
  }, {});
  // Now add each company to its group using the FK as the primary key
  for (const c of safeAvailableCompanies) {
    // Prefer the raw foreign key (always present), fall back to the relation
    const gid = c.companyGroupId || c.companyGroup?.id || 'ungrouped';
    // Resolve the group name from safeAvailableCompanyGroups (authoritative),
    // then fall back to the relation, then to 'Ungrouped'
    const gname = safeAvailableCompanyGroups.find(g => g.id === gid)?.name || c.companyGroup?.name || 'Ungrouped';
    if (!groupedCompanies[gid]) groupedCompanies[gid] = { groupName: gname, items: [] };
    groupedCompanies[gid].items.push(c);
  }

  const filteredGroups = Object.entries(groupedCompanies).filter(([_, g]) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      g.groupName.toLowerCase().includes(q) ||
      g.items.some((c) => c.name.toLowerCase().includes(q) || (c.code || '').toLowerCase().includes(q))
    );
  });

  // ---------- non-admin with no mapped companies: static badge ----------
  if (!allowSwitch) {
    const label = ownCompany?.name || 'Not yet assigned';
    const tenantName = safeTenant?.name;
    return (
      <div
        className="flex flex-col px-3 py-1 rounded-lg bg-slate-100 border border-slate-200 text-[11px] font-semibold text-slate-700 max-w-[180px] sm:max-w-[240px]"
        title={`Tenant: ${tenantName || '—'} · Company: ${label}`}
      >
        <span className="text-[9px] uppercase tracking-wider text-slate-400 flex items-center gap-1">
          <FiHome className="w-2.5 h-2.5" /> {tenantName || 'No tenant'}
        </span>
        <span className="truncate flex items-center gap-1">
          <FiBriefcase className="w-3 h-3 text-slate-500 flex-shrink-0" /> {label}
        </span>
      </div>
    );
  }

  // ---------- employee with multiple mapped companies: dropdown ----------
  if (!isAdmin && hasMappedCompanies) {
    const currentCompanyId = selectedCompanyId || ownCompanyId;
    const currentCompany = mappedCompanies.find((mc) => mc.id === currentCompanyId) || ownCompany;
    const label = currentCompany?.name || 'Not yet assigned';
    const tenantName = safeTenant?.name;
    // Filter mapped companies by search
    const filteredMapped = search
      ? mappedCompanies.filter((mc) =>
          mc.name.toLowerCase().includes(search.toLowerCase()) ||
          (mc.code || '').toLowerCase().includes(search.toLowerCase()) ||
          mc.employeeCode.toLowerCase().includes(search.toLowerCase())
        )
      : mappedCompanies;

    return (
      <div className="relative" ref={ref}>
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/30 transition-colors text-xs font-semibold text-slate-700 max-w-[180px] sm:max-w-[260px]"
          title="Switch company context"
        >
          <FiBriefcase className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
          <span className="truncate">{label}</span>
          <FiChevronDown className={`w-3 h-3 text-slate-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>

        {open && (
          <div className="absolute right-0 top-full mt-2 w-[300px] sm:w-[380px] bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 bg-gradient-to-r from-emerald-50 to-teal-50 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-emerald-900 uppercase tracking-wider flex items-center gap-2">
                    <FiBriefcase className="w-3.5 h-3.5" /> My Companies
                  </p>
                  <p className="text-[11px] text-emerald-700/70 mt-0.5">
                    Switch between your assigned companies
                  </p>
                </div>
                <button
                  onClick={() => refreshContext()}
                  disabled={hydrating}
                  title="Refresh company list"
                  className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600 hover:text-emerald-800 hover:bg-emerald-100/60 px-2 py-1 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                >
                  <FiRefreshCw className={`w-3 h-3 ${hydrating ? 'animate-spin' : ''}`} />
                  {hydrating ? 'Loading' : 'Refresh'}
                </button>
              </div>
            </div>

            {/* Tenant info */}
            {tenantName && (
              <div className="px-4 py-2 border-b border-slate-100 bg-slate-50/50">
                <span className="text-[9px] uppercase tracking-wider text-slate-400 flex items-center gap-1">
                  <FiHome className="w-2.5 h-2.5" /> {tenantName}
                </span>
              </div>
            )}

            {/* Error banner */}
            {lastError && mappedCompanies.length === 0 && (
              <div className="px-4 py-3 border-b border-red-100 bg-red-50/80 flex items-start gap-2">
                <FiAlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-semibold text-red-700">{lastError}</p>
                  <button
                    onClick={() => refreshContext()}
                    disabled={hydrating}
                    className="text-[10px] font-bold text-red-700 hover:text-red-900 underline mt-1 disabled:opacity-50"
                  >
                    {hydrating ? 'Retrying…' : 'Retry now'}
                  </button>
                </div>
              </div>
            )}

            {/* Search */}
            <div className="px-4 py-3 border-b border-slate-100">
              <div className="relative">
                <FiSearch className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search company..."
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-emerald-300"
                />
              </div>
            </div>

            {/* Mapped company list */}
            <div className="max-h-[280px] overflow-y-auto">
              {filteredMapped.length === 0 ? (
                <div className="px-4 py-6 text-center text-slate-400">
                  <FiInfo className="w-8 h-8 mx-auto mb-2" />
                  <p className="text-sm">
                    {mappedCompanies.length === 0
                      ? 'No companies assigned yet'
                      : 'No matches for your search'}
                  </p>
                </div>
              ) : (
                filteredMapped.map((mc) => {
                  const isSelected = currentCompanyId === mc.id;
                  return (
                    <button
                      key={mc.id}
                      onClick={() => {
                        logSwap({ toCompanyId: mc.id, toCompanyName: mc.name });
                        setSelectedCompany(mc.id);
                        setOpen(false);
                        setSearch('');
                      }}
                      className={`w-full text-left px-4 py-2.5 hover:bg-slate-50 transition-colors flex items-center justify-between border-b border-slate-100 last:border-b-0 ${
                        isSelected ? 'bg-emerald-50/40' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={`w-7 h-7 rounded-md flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
                          isSelected
                            ? 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white'
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          {mc.name?.[0]?.toUpperCase() || 'C'}
                        </div>
                        <div className="min-w-0">
                          <p className={`text-sm font-medium truncate ${isSelected ? 'text-emerald-900' : 'text-slate-900'}`}>
                            {mc.name}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {mc.code ? `${mc.code} · ` : ''}Emp code: {mc.employeeCode}
                          </p>
                        </div>
                      </div>
                      {isSelected && <FiCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />}
                    </button>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-2 bg-slate-50/80 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
              <span>
                {mappedCompanies.length} compan{mappedCompanies.length === 1 ? 'y' : 'ies'} assigned to you
              </span>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/30 transition-colors text-xs font-semibold text-slate-700 max-w-[180px] sm:max-w-[260px]"
        title="Switch company context"
      >
        <FiLayers className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
        <span className="truncate">{effectiveCompanyLabel(user?.role)}</span>
        <FiChevronDown className={`w-3 h-3 text-slate-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-[340px] sm:w-[460px] bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 bg-gradient-to-r from-emerald-50 to-teal-50 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-emerald-900 uppercase tracking-wider flex items-center gap-2">
                  <FiGrid className="w-3.5 h-3.5" /> Company Switcher
                </p>
                <p className="text-[11px] text-emerald-700/70 mt-0.5">
                  {isSuperAdmin
                    ? 'Parent (tenant) → Group company → Company'
                    : 'Pick a company in your group'}
                </p>
              </div>
              <button
                onClick={() => refreshContext()}
                disabled={hydrating}
                title="Refresh tenant & company list"
                className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600 hover:text-emerald-800 hover:bg-emerald-100/60 px-2 py-1 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
              >
                <FiRefreshCw className={`w-3 h-3 ${hydrating ? 'animate-spin' : ''}`} />
                {hydrating ? 'Loading' : 'Refresh'}
              </button>
            </div>
          </div>

          {/* ERROR BANNER — shown when /api/me/context failed and we have
              no data. The user can click Retry to force-refresh. */}
          {lastError && safeAvailableTenants.length === 0 && safeAvailableCompanies.length === 0 && (
            <div className="px-4 py-3 border-b border-red-100 bg-red-50/80 flex items-start gap-2">
              <FiAlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold text-red-700">{lastError}</p>
                <button
                  onClick={() => refreshContext()}
                  disabled={hydrating}
                  className="text-[10px] font-bold text-red-700 hover:text-red-900 underline mt-1 disabled:opacity-50"
                >
                  {hydrating ? 'Retrying…' : 'Retry now'}
                </button>
              </div>
            </div>
          )}

          {/* LOADING BANNER — shown during the very first hydrate (before any
              data has been seen). Subsequent refreshes show the spinner in the
              header button instead, so the existing list stays visible. */}
          {hydrating && safeAvailableTenants.length === 0 && safeAvailableCompanies.length === 0 && !lastError && (
            <div className="px-4 py-6 flex items-center justify-center gap-2 text-slate-500">
              <FiRefreshCw className="w-4 h-4 animate-spin" />
              <span className="text-xs">Loading tenants & companies…</span>
            </div>
          )}

          {/* TENANT INFO BANNER (tenant_admin only) — clearly shows which
              parent company (= tenant) the dropdown is scoped to. The
              hierarchy is: ONE parent company (= your tenant) → many group
              companies → many companies. The tenant_admin can pick any
              company under any group, but cannot switch parent companies. */}
          {isTenantAdmin && safeTenant && (
            <div className="px-4 py-3 border-b border-slate-100 bg-gradient-to-r from-emerald-50/70 to-teal-50/40">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-md bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0">
                  {safeTenant.name?.[0]?.toUpperCase() || 'T'}
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Parent company (tenant)</p>
                  <p className="text-xs font-bold text-slate-900 truncate">{safeTenant.name}</p>
                  <p className="text-[10px] text-slate-500 truncate">
                    {safeTenant.slug} · {safeAvailableCompanyGroups.length} group{safeAvailableCompanyGroups.length === 1 ? '' : 's'} · {safeAvailableCompanies.length} compan{safeAvailableCompanies.length === 1 ? 'y' : 'ies'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TENANTS LIST (super_admin only) — labeled "Parent companies" so
              it's obvious these are the top of the hierarchy. Each tenant IS
              a parent company (1:1 by name). Clicking one scopes the company
              list to that tenant's groups/companies. */}
          {isSuperAdmin && (
            <div className="px-4 py-3 border-b border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                  <FiHome className="w-3 h-3" /> Parent companies ({safeAvailableTenants.length})
                </label>
                <span className="text-[10px] text-slate-400">
                  {selectedTenantId ? 'Click to switch' : 'Select a parent'}
                </span>
              </div>
              {safeAvailableTenants.length === 0 ? (
                <div className="py-3">
                  {hydrating ? (
                    <p className="text-xs text-slate-400 italic flex items-center gap-1.5">
                      <FiRefreshCw className="w-3 h-3 animate-spin" /> Loading parent companies…
                    </p>
                  ) : lastError ? (
                    <p className="text-xs text-red-500 italic">{lastError}</p>
                  ) : (
                    <>
                      <p className="text-xs text-slate-400 italic">No parent companies loaded yet.</p>
                      <button
                        onClick={() => refreshContext()}
                        className="text-[10px] font-semibold text-emerald-600 hover:text-emerald-800 mt-1 flex items-center gap-1"
                      >
                        <FiRefreshCw className="w-2.5 h-2.5" /> Click to load
                      </button>
                    </>
                  )}
                </div>
              ) : (
                <div className="max-h-[140px] overflow-y-auto space-y-1 pr-1">
                  {safeAvailableTenants.map((t) => {
                    const isSelected = selectedTenantId === t.id;
                    return (
                      <button
                        key={t.id}
                        onClick={() => {
                          logSwap({ toTenantId: t.id, toTenantName: t.name });
                          setSelectedTenant(t.id);
                        }}
                        className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-left transition-colors border ${
                          isSelected
                            ? 'bg-emerald-50 border-emerald-200'
                            : 'bg-white border-slate-100 hover:bg-slate-50 hover:border-slate-200'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className={`w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
                            isSelected
                              ? 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white'
                              : 'bg-slate-100 text-slate-600'
                          }`}>
                            {t.name?.[0]?.toUpperCase() || 'T'}
                          </div>
                          <div className="min-w-0">
                            <p className={`text-xs font-semibold truncate ${isSelected ? 'text-emerald-900' : 'text-slate-800'}`}>
                              {t.name}
                            </p>
                            <p className="text-[10px] text-slate-500 truncate">
                              {t.slug}{t.maxCompaniesAllowed ? ` · cap: ${t.maxCompaniesAllowed} cos` : ''}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-full uppercase font-semibold ${
                            t.status === 'active'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-amber-50 text-amber-700'
                          }`}>
                            {t.status}
                          </span>
                          {isSelected && <FiCheck className="w-3.5 h-3.5 text-emerald-600" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Tenant quota banner for tenant_admin */}
          {isTenantAdmin && tenantQuota && (
            <div className="px-4 py-2 border-b border-slate-100 bg-amber-50/60 flex items-center gap-2">
              <FiShield className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
              <p className="text-[11px] text-amber-800 font-medium">
                {tenantQuota.maxCompanies > 0
                  ? <>Company quota: <b>{tenantQuota.used}</b> of <b>{tenantQuota.maxCompanies}</b> used · {tenantQuota.remaining} remaining</>
                  : <>Company quota: <b>{tenantQuota.used}</b> created · unlimited allowed</>
                }
              </p>
            </div>
          )}

          {/* Search + company list */}
          <div className="px-4 py-3 border-b border-slate-100">
            <div className="relative">
              <FiSearch className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search company..."
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-emerald-300"
              />
            </div>
          </div>

          <div className="max-h-[280px] overflow-y-auto">
            {/* "All companies" option — clears both group and company selection
                so the user sees everything in the current tenant/parent scope. */}
            <button
              onClick={() => {
                logSwap({ toTenantId: selectedTenantId, toTenantName: scopedTenant?.name, toCompanyId: null, toCompanyName: null });
                setSelectedGroup(null);
                setSelectedCompany(null);
                setOpen(false);
                setSearch('');
              }}
              className={`w-full text-left px-4 py-2.5 hover:bg-slate-50 transition-colors flex items-center justify-between border-b border-slate-100 ${
                selectedCompanyId === null && selectedGroupId === null ? 'bg-emerald-50/40' : ''
              }`}
            >
              <div className="flex items-center gap-2">
                <FiLayers className="w-4 h-4 text-emerald-500" />
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {isSuperAdmin ? 'All companies in parent' : 'All companies (group)'}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {safeAvailableCompanies.length} companies · {safeAvailableCompanyGroups.length} groups
                    {scopedTenant ? ` · ${scopedTenant.name}` : ''}
                  </p>
                </div>
              </div>
              {selectedCompanyId === null && selectedGroupId === null && <FiCheck className="w-4 h-4 text-emerald-600" />}
            </button>

            {/* Grouped company list */}
            {filteredGroups.length === 0 ? (
              <div className="px-4 py-6 text-center text-slate-400">
                <FiInfo className="w-8 h-8 mx-auto mb-2" />
                <p className="text-sm">
                  {safeAvailableCompanyGroups.length === 0
                    ? isSuperAdmin
                      ? 'No group companies created under this parent yet'
                      : 'No group companies exist under your parent yet'
                    : 'No matches for your search'}
                </p>
                {safeAvailableCompanyGroups.length === 0 && (
                  <a
                    href={isSuperAdmin ? '/super-admin' : '/tenant-admin/companies'}
                    onClick={() => setOpen(false)}
                    className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 hover:text-emerald-700"
                  >
                    <FiBriefcase className="w-3 h-3" />
                    {isSuperAdmin ? 'Create group in Super Admin →' : 'Contact your super admin →'}
                  </a>
                )}
              </div>
            ) : (
              filteredGroups.map(([gid, g]) => {
                // Find the underlying CompanyGroupOption to show its employee barrier
                const groupMeta = availableCompanyGroups.find((x) => x.id === gid);
                const isGroupSelected = selectedGroupId === gid && selectedCompanyId === null;
                return (
                  <div key={gid} className="border-b border-slate-100 last:border-b-0">
                    {/* Group header — CLICKABLE. Clicking selects the group as
                        the scope ("all companies in this group"), which lets
                        the user view data aggregated across every company in
                        the group without having to pick one. */}
                    <button
                      onClick={() => {
                        logSwap({ toTenantId: selectedTenantId, toTenantName: scopedTenant?.name, toCompanyId: null, toCompanyName: g.groupName });
                        setSelectedGroup(gid);
                        setOpen(false);
                        setSearch('');
                      }}
                      className={`w-full px-4 py-1.5 flex items-center justify-between transition-colors ${
                        isGroupSelected
                          ? 'bg-teal-50/80 hover:bg-teal-100/80'
                          : 'bg-slate-50/60 hover:bg-slate-100/80'
                      }`}
                      title={`View all companies in the "${g.groupName}" group`}
                    >
                      <p className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${
                        isGroupSelected ? 'text-teal-700' : 'text-slate-500'
                      }`}>
                        <FiLayers className="w-3 h-3" /> {g.groupName}
                        <span className="ml-1 normal-case font-medium text-[9px] text-slate-400">
                          ({g.items.length} compan{g.items.length === 1 ? 'y' : 'ies'})
                        </span>
                      </p>
                      <div className="flex items-center gap-1.5">
                        {groupMeta && groupMeta.maxEmployees !== null && groupMeta.maxEmployees !== undefined && groupMeta.maxEmployees > 0 && (
                          <span className="text-[9px] font-semibold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                            <FiUsers className="w-2.5 h-2.5 inline -mt-0.5 mr-0.5" />
                            {groupMeta.employeeLimitMode === 'per_company' ? 'per-co' : 'group'} cap: {groupMeta.maxEmployees}
                          </span>
                        )}
                        {isGroupSelected && <FiCheck className="w-3.5 h-3.5 text-teal-600" />}
                      </div>
                    </button>
                    {g.items.length === 0 ? (
                      <div className="pl-8 pr-4 py-2 text-[11px] text-slate-400 italic">
                        No companies inducted yet — <a
                          href={isSuperAdmin ? '/super-admin' : '/tenant-admin/companies'}
                          onClick={() => setOpen(false)}
                          className="text-emerald-600 hover:text-emerald-700 font-semibold not-italic"
                        >
                          add one →
                        </a>
                      </div>
                    ) : g.items.map((c) => {
                      const empCount = c._count?.employees || 0;
                      const isCompanySelected = selectedCompanyId === c.id;
                      return (
                        <button
                          key={c.id}
                          onClick={() => {
                            logSwap({ toTenantId: selectedTenantId, toTenantName: scopedTenant?.name, toCompanyId: c.id, toCompanyName: c.name });
                            setSelectedCompany(c.id);
                            setOpen(false);
                            setSearch('');
                          }}
                          className={`w-full text-left pl-8 pr-4 py-2.5 hover:bg-slate-50 transition-colors flex items-center justify-between ${
                            isCompanySelected ? 'bg-emerald-50/40' : ''
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <FiBriefcase className="w-4 h-4 text-slate-400 flex-shrink-0" />
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-slate-900 truncate">{c.name}</p>
                              <p className="text-[11px] text-slate-500">
                                {c.code ? `${c.code} · ` : ''}
                                {c._count?.branches || 0} branches · {empCount} emp
                                {/* Super admin: show parent (tenant) name on each company */}
                                {isSuperAdmin && scopedTenant && (
                                  <span className="text-emerald-500"> · parent: {scopedTenant.name}</span>
                                )}
                              </p>
                            </div>
                          </div>
                          {isCompanySelected && <FiCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 bg-slate-50/80 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
            <span>
              {isSuperAdmin
                ? `${safeAvailableTenants.length} parent${safeAvailableTenants.length === 1 ? '' : 's'} · ${safeAvailableCompanyGroups.length} group${safeAvailableCompanyGroups.length === 1 ? '' : 's'} · ${safeAvailableCompanies.length} compan${safeAvailableCompanies.length === 1 ? 'y' : 'ies'}`
                : `${safeAvailableCompanyGroups.length} group${safeAvailableCompanyGroups.length === 1 ? '' : 's'} · ${safeAvailableCompanies.length} compan${safeAvailableCompanies.length === 1 ? 'y' : 'ies'}`}
            </span>
            {isSuperAdmin && (
              <a
                href="/super-admin"
                className="text-emerald-600 hover:text-emerald-700 font-medium"
                onClick={() => setOpen(false)}
              >
                Manage parents & groups →
              </a>
            )}
            {isTenantAdmin && (
              <a
                href="/tenant-admin"
                className="text-emerald-600 hover:text-emerald-700 font-medium"
                onClick={() => setOpen(false)}
              >
                Manage group companies →
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
