'use client';

import { useMemo, useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  FiGrid, FiSearch, FiArrowRight, FiChevronRight,
  FiLayers, FiSettings, FiFileText, FiDatabase,
  FiBarChart2, FiCpu,
} from 'react-icons/fi';
import { useAuthStore } from '@/store/authStore';
import { useCompanyContextStore } from '@/store/companyContextStore';
import { canRoleAccessModule, isModuleEnabledForTenant, LEGACY_ROLE_MAP } from '@/lib/roleAccess';
import { sanitizeSearch } from '@/lib/validators';
import { navSections, MODULE_GROUPS } from '@/lib/navData';
import type { NavSection, ModuleGroup, DashboardTab } from '@/lib/navData';
import { useTenantModuleStore } from '@/store/tenantModuleStore';

export default function ModulesPage() {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuthStore();
  const userRole = user?.role || 'admin';
  const tenantSlug = useCompanyContextStore(s => s.tenant?.slug) || '';
  const tenantId = useCompanyContextStore(s => s.tenant?.id) || '';
  const fetchModules = useTenantModuleStore(s => s.fetchModules);
  const enabledModules = useTenantModuleStore(s => s.enabledModules);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch tenant module flags on mount
  useEffect(() => {
    if (tenantId && tenantSlug) {
      fetchModules(tenantId, tenantSlug);
    }
  }, [tenantId, tenantSlug, fetchModules]);

  // Filter sections based on role AND tenant module whitelist
  // Per-item role filtering: must pass BOTH module-level AND per-item role checks.
  // Also handles legacy roles via LEGACY_ROLE_MAP (e.g., 'company_hr_admin' → 'admin').
  const effectiveRoles = useMemo(() => {
    const migrated = LEGACY_ROLE_MAP[userRole] || userRole;
    return Array.from(new Set([userRole, migrated])).filter(Boolean);
  }, [userRole]);

  const filteredGroups = useMemo(() => {
    return MODULE_GROUPS.map(group => ({
      ...group,
      sections: group.sections
        .filter(section => isModuleEnabledForTenant(tenantSlug, section.key))
        .map(section => ({
          ...section,
          items: section.items.filter(item => {
            // 1. Module-level check
            if (item.moduleKey && !canRoleAccessModule(userRole, item.moduleKey)) {
              return false;
            }
            // 2. Per-item role check
            if (item.roles) {
              const hasRole = effectiveRoles.some(r => item.roles!.includes(r));
              if (!hasRole) return false;
            }
            // 3. No moduleKey and no roles → admin-only for safety
            if (!item.moduleKey && !item.roles) {
              return effectiveRoles.some(r => ['super_admin', 'tenant_admin', 'admin'].includes(r));
            }
            return true;
          }),
        }))
        .filter(section => section.items.length > 0),
    })).filter(group => group.sections.length > 0);
  }, [userRole, tenantSlug, effectiveRoles, enabledModules]);

  // Filter by search
  const searchFilteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return filteredGroups;
    const q = searchQuery.toLowerCase();
    return filteredGroups.map(group => ({
      ...group,
      sections: group.sections
        .map(section => ({
          ...section,
          items: section.items.filter(item =>
            item.label.toLowerCase().includes(q) || section.label.toLowerCase().includes(q)
          ),
        }))
        .filter(section => section.items.length > 0),
    })).filter(group => group.sections.length > 0);
  }, [filteredGroups, searchQuery]);

  const totalModules = searchFilteredGroups.reduce((acc, g) => acc + g.sections.length, 0);

  // Click handler: navigate to the dashboard and let the layout auto-detect sidebar
  const handleModuleClick = (section: NavSection) => {
    // Navigate to the first item (dashboard) href
    const dashboardHref = section.items[0]?.href;
    if (dashboardHref) {
      router.push(dashboardHref);
    }
  };

  const handleSubItemClick = (href: string) => {
    router.push(href);
  };

  // Get the tab icon for dashboard tabs
  const getTabIcon = (key: string) => {
    switch (key) {
      case 'overview': return <FiGrid className="w-3 h-3" />;
      case 'masters': return <FiDatabase className="w-3 h-3" />;
      case 'settings': return <FiSettings className="w-3 h-3" />;
      case 'reports': return <FiFileText className="w-3 h-3" />;
      case 'ai-insights': return <FiCpu className="w-3 h-3" />;
      default: return <FiLayers className="w-3 h-3" />;
    }
  };

  return (
    <div className="min-h-screen">
      {/* Page Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-thb-text-primary tracking-tight">Modules</h1>
            <p className="text-sm text-thb-text-secondary mt-1">
              {totalModules} modules &middot; Click to explore
            </p>
          </div>
        </div>
        {/* Search Bar */}
        <div className="relative max-w-sm">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(sanitizeSearch(e.target.value))}
            placeholder="Search modules..."
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-green-200 bg-green-50/30 text-sm text-thb-text-primary placeholder:text-green-400/60 focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-400 focus:bg-white transition-all"
          />
        </div>
      </div>

      {/* Module Groups */}
      <div className="space-y-8">
        {searchFilteredGroups.map((group) => {
          const GroupIcon = group.groupIcon;
          return (
            <div key={group.groupLabel}>
              {/* Group Header */}
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center">
                  <GroupIcon className="w-3.5 h-3.5 text-slate-500" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-thb-text-primary leading-tight">{group.groupLabel}</h2>
                  <p className="text-[10px] text-thb-text-secondary">{group.groupDescription}</p>
                </div>
              </div>

              {/* Module Cards Grid - Compact Layout */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
                {group.sections.map((section) => {
                  const SectionIcon = section.sectionIcon;
                  const gradientColor = section.sectionColor || 'from-green-500 to-emerald-600';
                  const tabCount = section.dashboardTabs?.length || 0;
                  const itemCount = section.items.length;

                  return (
                    <div
                      key={section.key}
                      onClick={() => handleModuleClick(section)}
                      className="group relative rounded-xl border border-slate-200 hover:border-green-300 bg-white hover:bg-gradient-to-b hover:from-white hover:to-green-50/30 transition-all duration-200 cursor-pointer hover:shadow-lg hover:shadow-green-500/8 overflow-hidden"
                    >
                      {/* Card Content */}
                      <div className="p-3">
                        {/* Icon */}
                        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradientColor} flex items-center justify-center shadow-md mb-2 group-hover:scale-105 transition-transform`}>
                          <SectionIcon className="w-5 h-5 text-white" />
                        </div>

                        {/* Module Name */}
                        <h3 className="text-xs font-bold text-thb-text-primary truncate leading-tight">{section.label}</h3>
                        <p className="text-[10px] text-thb-text-secondary mt-0.5 leading-tight line-clamp-2">{section.description}</p>

                        {/* Stats Row */}
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-[9px] font-semibold text-green-500 bg-green-50 px-1.5 py-0.5 rounded">
                            {itemCount} {itemCount === 1 ? 'section' : 'sections'}
                          </span>
                          {tabCount > 0 && (
                            <span className="text-[9px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                              {tabCount} tabs
                            </span>
                          )}
                        </div>

                        {/* Dashboard Tabs Preview */}
                        {section.dashboardTabs && section.dashboardTabs.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {section.dashboardTabs.map((tab) => (
                              <span
                                key={tab.key}
                                className="inline-flex items-center gap-0.5 text-[8px] font-medium text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded group-hover:text-green-500 group-hover:bg-green-50/50 transition-colors"
                              >
                                {getTabIcon(tab.key)}
                                {tab.label}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Hover Arrow */}
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <FiArrowRight className="w-3.5 h-3.5 text-green-400" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {searchFilteredGroups.length === 0 && searchQuery && (
        <div className="text-center py-16">
          <FiSearch className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-thb-text-primary mb-1">No modules found</h3>
          <p className="text-sm text-thb-text-secondary">No modules match &ldquo;{searchQuery}&rdquo;. Try a different search term.</p>
        </div>
      )}
    </div>
  );
}
