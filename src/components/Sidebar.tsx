'use client';

import { useMemo, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  FiLogOut,
  FiChevronLeft,
  FiChevronRight,
} from 'react-icons/fi';
import { useAuthStore } from '@/store/authStore';
import { useCompanyContextStore, isHiddenTenant } from '@/store/companyContextStore';
import { canRoleAccessModule, isModuleEnabledForTenant, LEGACY_ROLE_MAP } from '@/lib/roleAccess';
import { navSections, PINNED_ITEMS, PICKER_ROUTES } from '@/lib/navData';
import type { NavItem, NavSection } from '@/lib/navData';
import { useTenantModuleStore } from '@/store/tenantModuleStore';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  isMobileMenu?: boolean;
  currentModuleKey: string | null;
  onModuleSelect: (key: string | null) => void;
}

export default function Sidebar({ collapsed, onToggle, isMobileMenu = false, currentModuleKey, onModuleSelect }: SidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const userRole = user?.role || 'admin';
  const tenantSlug = useCompanyContextStore(s => s.tenant?.slug) || '';
  const tenantId = useCompanyContextStore(s => s.tenant?.id) || '';
  const contextTenant = useCompanyContextStore(s => s.tenant);
  const { fetchModules } = useTenantModuleStore();

  // ─── GOLDEN RULE: Use companyContextStore's tenant (filtered) for branding ───
  // NEVER use user.tenant from authStore directly — it may contain hidden tenant
  // data (e.g., "Marq AI Tech Pvt Ltd"). The companyContextStore is always filtered.
  // NUCLEAR: Also hardcode-check slug and name — works even during SSR.
  const _HARDCODED_HIDDEN_SLUGS = ['3boxes-hrms-demo', '3boxeshrms'];
  const _HARDCODED_HIDDEN_NAME = 'Marq AI Tech Pvt Ltd';
  const _isHardcodedHidden = (t: { slug?: string; name?: string } | null) =>
    !t ? false :
    _HARDCODED_HIDDEN_SLUGS.includes(t.slug || '') ||
    (t.name || '').includes(_HARDCODED_HIDDEN_NAME);
  const safeTenant = (contextTenant && contextTenant.slug && !_isHardcodedHidden(contextTenant) && !isHiddenTenant(contextTenant.slug))
    ? contextTenant
    : null;
  const safeTenantLogo = safeTenant?.logo || null;
  const safeTenantName = user?.role === 'super_admin'
    ? '3Boxes'
    : (safeTenant?.name || '3Boxes');

  // Fetch tenant module flags on mount (populates roleAccess DB overrides)
  useEffect(() => {
    if (tenantId && tenantSlug) {
      fetchModules(tenantId, tenantSlug);
    }
  }, [tenantId, tenantSlug, fetchModules]);

  // Filter sections based on user role AND tenant module whitelist
  // Per-item role filtering:
  //   - If item.roles is set, the user's role must be in the list
  //   - If item.moduleKey is set, the role must pass canRoleAccessModule
  //   - Both checks must pass for the item to be visible
  //
  // IMPORTANT: Also check the LEGACY_ROLE_MAP migration target. A user with
  // role 'company_hr_admin' (legacy) maps to 'admin', so they should see
  // items tagged with roles: ['admin', ...].
  const effectiveRoles = useMemo(() => {
    const migrated = LEGACY_ROLE_MAP[userRole] || userRole;
    // Unique list: [original role, migrated role] (deduped)
    return Array.from(new Set([userRole, migrated])).filter(Boolean);
  }, [userRole]);

  const filteredSections = useMemo(() => {
    return navSections
      .filter((section) => isModuleEnabledForTenant(tenantSlug, section.key))
      .map((section) => ({
        ...section,
        items: section.items.filter(
          (item) => {
            // 1. Module-level check (sidebar visibility for the whole module)
            if (item.moduleKey && !canRoleAccessModule(userRole, item.moduleKey)) {
              return false;
            }
            // 2. Per-item role check (granular — e.g., 'employee' can see 'Apply Leave'
            //    but not 'Leave Policy & Settings' even though both are moduleKey='leave')
            if (item.roles) {
              // Check if ANY of the user's effective roles (original + migrated) is in item.roles
              const hasRole = effectiveRoles.some(r => item.roles!.includes(r));
              if (!hasRole) return false;
            }
            // 3. No moduleKey and no roles → default to admin-only for safety
            if (!item.moduleKey && !item.roles) {
              return effectiveRoles.some(r => ['super_admin', 'tenant_admin', 'admin'].includes(r));
            }
            return true;
          }
        ),
      }))
      .filter((section) => section.items.length > 0);
  }, [userRole, tenantSlug, effectiveRoles]);

  // Filter pinned items based on role (same logic as above)
  const visiblePinnedItems = useMemo(() => {
    return PINNED_ITEMS.filter((item) => {
      if (item.moduleKey && !canRoleAccessModule(userRole, item.moduleKey)) return false;
      if (item.roles) {
        const hasRole = effectiveRoles.some(r => item.roles!.includes(r));
        if (!hasRole) return false;
      }
      if (!item.moduleKey && !item.roles) {
        return effectiveRoles.some(r => ['super_admin', 'tenant_admin', 'admin'].includes(r));
      }
      return true;
    });
  }, [userRole, effectiveRoles]);

  // Find the current section
  const currentSection = currentModuleKey
    ? filteredSections.find((s) => s.key === currentModuleKey)
    : null;

  // Auto-detect active item (exact match preferred over prefix match)
  const isItemActive = (href: string) => {
    if (href.startsWith('#')) return false; // dividers are never active
    return pathname === href || pathname?.startsWith(href + '/');
  };

  // Check if an item is the BEST match (exact match wins over prefix match)
  const isBestMatch = (href: string, items: import('@/lib/navData').NavItem[]) => {
    if (href.startsWith('#')) return false;
    // Exact match always wins
    if (pathname === href) return true;
    // For prefix matches, only active if no other item is an exact match
    if (!pathname?.startsWith(href + '/')) return false;
    const hasExactMatch = items.some(item => !item.isDivider && !item.href.startsWith('#') && pathname === item.href);
    return !hasExactMatch;
  };

  const handleLogout = async () => {
    await logout();
    window.location.href = '/login';
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <aside
      className={`${isMobileMenu ? 'w-full' : 'fixed left-0 top-0 h-full'} bg-thb-sidebar-bg flex flex-col transition-all duration-300 ease-in-out z-40 ${
        isMobileMenu ? '' : collapsed ? 'w-[68px]' : 'w-[260px]'
      }`}
    >
      {/* Brand Header */}
      {!isMobileMenu && (
        <div className={`flex items-center h-14 px-4 border-b border-white/[0.06] ${collapsed ? 'justify-center' : 'gap-3'}`}>
          {safeTenantLogo ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={safeTenantLogo} alt={safeTenantName} className="flex-shrink-0 w-10 h-10 rounded-xl object-contain bg-white p-2 shadow-lg ring-1 ring-white/10" />
          ) : (
            <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 via-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-green-500/20 ring-1 ring-white/10">
              <svg viewBox="0 0 35 11" className="w-5 h-4" fill="none">
                <rect x="0" y="0" width="9" height="9" rx="2" fill="white" opacity="0.9"/>
                <rect x="13" y="0" width="9" height="9" rx="2" fill="white" opacity="0.9"/>
                <rect x="26" y="0" width="9" height="9" rx="2" fill="white" opacity="0.9"/>
              </svg>
            </div>
          )}
          {!collapsed && (
            <div className="overflow-hidden">
              <h1 className="text-base font-bold text-white tracking-tight whitespace-nowrap">
                {safeTenantName} <span className="text-[10px] font-semibold text-green-400 tracking-wider">{user?.role === 'super_admin' ? 'Platform' : 'HRMS'}</span>
              </h1>
              <p className="text-[9px] text-thb-sidebar-text leading-none -mt-0.5">{user?.role === 'super_admin' ? 'Super Admin · Platform Control' : 'People · Process · Technology'}</p>
            </div>
          )}
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 sidebar-scroll">
        {/* Pinned items: Home + Dashboard + Modules (always visible) */}
        <ul className="space-y-0.5 mb-2">
          {visiblePinnedItems.map((item) => {
            const isActive = isItemActive(item.href);
            return (
              <li key={`${item.href}-${item.label}`}>
                <Link
                  href={item.href}
                  onClick={() => {
                    onModuleSelect(null);
                    if (isMobileMenu) onToggle();
                  }}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 relative ${
                    isActive
                      ? 'bg-green-500/15 text-green-400'
                      : 'text-thb-sidebar-text hover:bg-thb-sidebar-hover hover:text-slate-200'
                  } ${collapsed ? 'justify-center' : ''}`}
                  title={collapsed ? item.label : undefined}
                >
                  {isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-green-500 rounded-r-full" />
                  )}
                  <span className={`flex-shrink-0 ${isActive ? 'text-green-400' : 'text-thb-sidebar-text hover:text-slate-200'} transition-colors`}>
                    {item.icon}
                  </span>
                  {!collapsed && <span className="flex-1 whitespace-nowrap overflow-hidden">{item.label}</span>}
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="mx-3 my-2 border-t border-white/[0.06]" />

        {/* Selected Module Submenu */}
        {!collapsed && currentSection ? (
          <div className="min-w-0">
            {/* Section header with back button */}
            <div className="px-3 py-2 mb-1">
              <div className="flex items-center gap-2">
                {(() => {
                  const SectionIcon = currentSection.sectionIcon;
                  return <SectionIcon className="w-4 h-4 text-green-400" />;
                })()}
                <span className="text-[10px] font-bold uppercase tracking-widest text-thb-sidebar-text/80 flex-1">
                  {currentSection.label}
                </span>
                <button
                  onClick={() => onModuleSelect(null)}
                  className="p-1 rounded text-thb-sidebar-text/50 hover:text-slate-200 hover:bg-thb-sidebar-hover transition-colors"
                  title="Back to module list"
                >
                  <FiChevronLeft className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            {/* Section items */}
            <ul className="space-y-0.5">
              {currentSection.items.map((item, idx) => {
                // Divider items render as sub-section headers
                if (item.isDivider) {
                  return (
                    <li key={`divider-${idx}`} className="mt-3 mb-1 px-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-thb-sidebar-text/40">{item.icon}</span>
                        <span className="text-[9px] font-bold uppercase tracking-widest text-thb-sidebar-text/50">
                          {item.label}
                        </span>
                      </div>
                      <div className="mt-1 border-t border-white/[0.06]" />
                    </li>
                  );
                }

                const isActive = isBestMatch(item.href, currentSection.items);
                return (
                  <li key={`${item.href}-${item.label}`}>
                    <Link
                      href={item.href}
                      onClick={() => { if (isMobileMenu) onToggle(); }}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 group relative ${
                        isActive
                          ? 'bg-green-500/15 text-green-400'
                          : 'text-thb-sidebar-text hover:bg-thb-sidebar-hover hover:text-slate-200'
                      }`}
                      title={item.label}
                    >
                      {isActive && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 bg-green-500 rounded-r-full" />
                      )}
                      <span className={`flex-shrink-0 ${isActive ? 'text-green-400' : 'text-thb-sidebar-text group-hover:text-slate-200'} transition-colors`}>
                        {item.icon}
                      </span>
                      <span className="flex-1 whitespace-nowrap overflow-hidden">{item.label}</span>
                      {item.isNew && (
                        <span className="flex-shrink-0 text-[8px] font-bold uppercase tracking-wider px-1 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                          NEW
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : !collapsed ? (
          /* No module selected — show instruction */
          <div className="px-3 py-8 text-center">
            <div className="w-12 h-12 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mx-auto mb-3">
              <FiChevronRight className="w-5 h-5 text-thb-sidebar-text/30" />
            </div>
            <p className="text-[11px] text-thb-sidebar-text/50 font-medium mb-1">Select a Module</p>
            <p className="text-[9px] text-thb-sidebar-text/30 leading-relaxed">
              Click on Modules above or go to the Modules page to pick a section
            </p>
          </div>
        ) : null}

        {/* When collapsed, show just the active section icon */}
        {collapsed && currentSection && (
          <div className="flex flex-col items-center py-2">
            {(() => {
              const SectionIcon = currentSection.sectionIcon;
              return (
                <button
                  onClick={() => onModuleSelect(null)}
                  className="p-2 rounded-lg bg-green-500/15 text-green-400 ring-1 ring-green-500/20 hover:bg-green-500/25 transition-colors"
                  title={currentSection.label}
                >
                  <SectionIcon className="w-5 h-5" />
                </button>
              );
            })()}
          </div>
        )}
      </nav>

      {/* Bottom Section: User Info + Collapse Toggle */}
      {!isMobileMenu && (
      <div className="border-t border-white/[0.06]">
        {/* User Info */}
        <div className={`flex items-center p-3 ${collapsed ? 'justify-center' : 'gap-3'}`}>
          {user?.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.avatar}
              alt={user.name}
              className="w-8 h-8 rounded-full object-cover ring-2 ring-white/10 flex-shrink-0"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-teal-600 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 ring-2 ring-white/10">
              {user?.name ? getInitials(user.name) : '??'}
            </div>
          )}
          {!collapsed && user && (
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-white truncate">{user.name}</p>
              <p className="text-[10px] text-thb-sidebar-text truncate capitalize">{user.role?.replace('_', ' ')}</p>
            </div>
          )}
          {!collapsed && (
            <button
              onClick={handleLogout}
              className="p-1.5 rounded-lg text-thb-sidebar-text hover:text-red-400 hover:bg-red-500/10 transition-colors"
              title="Logout"
            >
              <FiLogOut className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Collapse Toggle */}
        <button
          onClick={onToggle}
          className="w-full flex items-center justify-center py-2 text-thb-sidebar-text hover:text-slate-300 hover:bg-white/[0.03] transition-colors"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <FiChevronRight className="w-4 h-4" />
          ) : (
            <FiChevronLeft className="w-4 h-4" />
          )}
        </button>

        {/* Proud Product Branding */}
        {!collapsed && (
          <div className="px-3 pb-2 pt-1 text-center">
            <div className="flex items-center justify-center gap-1.5 opacity-40 hover:opacity-70 transition-opacity">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/logo-3boxes-hrms.png" alt="3Boxes HRMS" className="w-4 h-4 rounded object-contain" />
              <span className="text-[9px] text-thb-sidebar-text whitespace-nowrap">Powered by 3Boxes HRMS</span>
            </div>
          </div>
        )}
      </div>
      )}
    </aside>
  );
}
