#!/usr/bin/env python3
"""
Replace the body of Sidebar.tsx (from `export default function Sidebar` through
the end of the `<nav>` block) with the new picker/submenu logic.
"""
import re

FILE = '/home/z/my-project/src/components/Sidebar.tsx'

with open(FILE, 'r') as f:
    content = f.read()

# The new body
NEW_BODY = '''export default function Sidebar({ collapsed, onToggle, isMobileMenu = false }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const userRole = user?.role || 'employee';

  // Filter sections based on user role — uses both explicit roles and canRoleAccessModule
  const filteredSections = useMemo(() => {
    return navSections
      .map((section) => ({
        ...section,
        items: section.items.filter(
          (item) => {
            // If moduleKey is provided, use centralized role access check
            if (item.moduleKey) {
              return canRoleAccessModule(userRole, item.moduleKey);
            }
            // Fallback to explicit roles array
            return !item.roles || item.roles.includes(userRole);
          }
        ),
      }))
      .filter((section) => section.items.length > 0);
  }, [userRole]);

  // Filter pinned items based on role too
  const visiblePinnedItems = useMemo(() => {
    return PINNED_ITEMS.filter((item) => {
      if (item.moduleKey) return canRoleAccessModule(userRole, item.moduleKey);
      return !item.roles || item.roles.includes(userRole);
    });
  }, [userRole]);

  // ─── Auto-detect current module from pathname ───
  // On picker routes (/, /home, /dashboard) → null (show picker)
  // On any other route → find the section containing the active item
  const autoDetectedModuleKey = useMemo(() => {
    if (!pathname) return null;
    if (PICKER_ROUTES.includes(pathname)) return null;
    for (const section of filteredSections) {
      for (const item of section.items) {
        if (pathname === item.href || pathname.startsWith(item.href + '/')) {
          return section.key;
        }
      }
    }
    return null;
  }, [pathname, filteredSections]);

  // Track user's explicit selection (overrides auto-detection).
  // When user clicks a module icon → set to that key (sidebar shows submenu, no navigation).
  // When user clicks "Back to Modules" → set to null (sidebar shows picker, no navigation).
  // When user navigates → reset to null so auto-detection takes over.
  const [explicitSelection, setExplicitSelection] = useState<string | null>(null);

  // Reset explicit selection whenever the pathname changes (user navigated)
  useEffect(() => {
    setExplicitSelection(null);
  }, [pathname]);

  // The currently displayed module: explicit selection wins, else auto-detected
  const currentModuleKey = explicitSelection ?? autoDetectedModuleKey;
  const currentSection = currentModuleKey
    ? filteredSections.find((s) => s.key === currentModuleKey)
    : null;

  // Auto-detect the active item within the current section (for highlighting)
  const isItemActive = (href: string) => {
    return pathname === href || pathname?.startsWith(href + '/');
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
      className={`${isMobileMenu ? 'w-full' : 'fixed left-0 top-0 h-full'} bg-nexus-sidebar-bg flex flex-col transition-all duration-300 ease-in-out z-40 ${
        isMobileMenu ? '' : collapsed ? 'w-[68px]' : 'w-[260px]'
      }`}
    >
      {/* Brand Header - hidden in mobile menu mode */}
      {!isMobileMenu && (
        <div className={`flex items-center h-16 px-4 border-b border-white/[0.06] ${collapsed ? 'justify-center' : 'gap-3'}`}>
          <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 via-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-blue-500/20 ring-1 ring-white/10">
            <svg viewBox="0 0 35 11" className="w-5 h-3" fill="none">
              <rect x="0" y="0" width="9" height="9" rx="2" fill="white" opacity="0.9"/>
              <rect x="13" y="0" width="9" height="9" rx="2" fill="white" opacity="0.9"/>
              <rect x="26" y="0" width="9" height="9" rx="2" fill="white" opacity="0.9"/>
            </svg>
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <h1 className="text-lg font-bold text-white tracking-tight whitespace-nowrap">
                3 Boxes <span className="text-[11px] font-semibold text-blue-300 tracking-wider">HRMS</span>
              </h1>
              <p className="text-[10px] text-nexus-sidebar-text leading-none -mt-0.5">People &middot; Process &middot; Technology</p>
            </div>
          )}
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 sidebar-scroll">
        {/* Pinned items: Home + Dashboard (always visible at top) */}
        <ul className="space-y-0.5 mb-2">
          {visiblePinnedItems.map((item) => {
            const isActive = isItemActive(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => {
                    // Clicking a pinned item clears any explicit selection
                    setExplicitSelection(null);
                    if (isMobileMenu) onToggle();
                  }}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 relative ${
                    isActive
                      ? 'bg-blue-500/15 text-blue-400'
                      : 'text-nexus-sidebar-text hover:bg-nexus-sidebar-hover hover:text-slate-200'
                  } ${collapsed ? 'justify-center' : ''}`}
                  title={collapsed ? item.label : undefined}
                >
                  {isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-blue-500 rounded-r-full" />
                  )}
                  <span className={`flex-shrink-0 ${isActive ? 'text-blue-400' : 'text-nexus-sidebar-text hover:text-slate-200'} transition-colors`}>
                    {item.icon}
                  </span>
                  {!collapsed && <span className="flex-1 whitespace-nowrap overflow-hidden">{item.label}</span>}
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="mx-3 my-2 border-t border-white/[0.06]" />

        {/* Module picker OR module submenu */}
        {currentSection ? (
          /* ─── Module Submenu View ─── */
          <div>
            {/* Back button */}
            <button
              onClick={() => setExplicitSelection(null)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-nexus-sidebar-text hover:bg-nexus-sidebar-hover hover:text-slate-200 transition-colors ${
                collapsed ? 'justify-center' : ''
              }`}
              title={collapsed ? 'All Modules' : undefined}
            >
              <FiArrowLeft className="w-4 h-4 flex-shrink-0" />
              {!collapsed && <span>All Modules</span>}
            </button>

            {/* Section header */}
            {!collapsed && (
              <div className="px-3 py-2 mt-1">
                <div className="flex items-center gap-2">
                  {(() => {
                    const SectionIcon = currentSection.sectionIcon;
                    return <SectionIcon className="w-4 h-4 text-blue-400" />;
                  })()}
                  <span className="text-[10px] font-bold uppercase tracking-widest text-nexus-sidebar-text/80">
                    {currentSection.label}
                  </span>
                </div>
              </div>
            )}

            {/* Section items */}
            <ul className="space-y-0.5">
              {currentSection.items.map((item) => {
                const isActive = isItemActive(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => { if (isMobileMenu) onToggle(); }}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group relative ${
                        isActive
                          ? 'bg-blue-500/15 text-blue-400'
                          : 'text-nexus-sidebar-text hover:bg-nexus-sidebar-hover hover:text-slate-200'
                      } ${collapsed ? 'justify-center' : ''}`}
                      title={collapsed ? item.label : undefined}
                    >
                      {isActive && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-blue-500 rounded-r-full" />
                      )}
                      <span className={`flex-shrink-0 ${isActive ? 'text-blue-400' : 'text-nexus-sidebar-text group-hover:text-slate-200'} transition-colors`}>
                        {item.icon}
                      </span>
                      {!collapsed && (
                        <span className="flex-1 whitespace-nowrap overflow-hidden">{item.label}</span>
                      )}
                      {!collapsed && item.isNew && (
                        <span className="flex-shrink-0 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                          NEW
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          /* ─── Module Picker View (icon grid) ─── */
          <div>
            {!collapsed && (
              <div className="px-3 py-2 mb-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-nexus-sidebar-text/60">
                  All Modules
                </span>
              </div>
            )}
            {/* Icon grid — 2 columns when expanded, 1 column when collapsed */}
            <div className={`grid ${collapsed ? 'grid-cols-1 gap-1' : 'grid-cols-2 gap-1.5'} px-1`}>
              {filteredSections.map((section) => {
                const SectionIcon = section.sectionIcon;
                const isAutoActive = autoDetectedModuleKey === section.key;
                return (
                  <button
                    key={section.key}
                    onClick={() => setExplicitSelection(section.key)}
                    className={`flex flex-col items-center gap-1.5 p-2.5 rounded-lg transition-all duration-200 group ${
                      isAutoActive
                        ? 'bg-blue-500/15 text-blue-400 ring-1 ring-blue-500/20'
                        : 'text-nexus-sidebar-text hover:bg-nexus-sidebar-hover hover:text-slate-200'
                    } ${collapsed ? 'px-1' : ''}`}
                    title={collapsed ? section.label : undefined}
                  >
                    <SectionIcon className={`w-5 h-5 flex-shrink-0 ${isAutoActive ? 'text-blue-400' : 'group-hover:text-slate-200'} transition-colors`} />
                    {!collapsed && (
                      <span className="text-[10px] font-medium text-center leading-tight line-clamp-2">
                        {section.label}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </nav>
'''

# Find the start of the component function
start_marker = "export default function Sidebar({ collapsed, onToggle, isMobileMenu = false }: SidebarProps) {"
start_idx = content.find(start_marker)
if start_idx == -1:
    raise SystemExit("Could not find start marker")

# Find the end of the <nav> block (the closing </nav> tag)
# We need to find the </nav> that comes after the start marker
nav_end_marker = "      </nav>"
nav_end_idx = content.find(nav_end_marker, start_idx)
if nav_end_idx == -1:
    raise SystemExit("Could not find </nav> end marker")

# Include the </nav> in the replacement
nav_end_idx += len(nav_end_marker)

# Replace the body
new_content = content[:start_idx] + NEW_BODY + content[nav_end_idx:]

with open(FILE, 'w') as f:
    f.write(new_content)

print(f"Replaced body from char {start_idx} to {nav_end_idx} (length {nav_end_idx - start_idx} → {len(NEW_BODY)})")
