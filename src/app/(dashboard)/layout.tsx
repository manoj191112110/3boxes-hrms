'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
// CRITICAL: Install per-tab session token storage shim BEFORE any auth code runs.
// This redirects localStorage['tb_token'] to sessionStorage so that two tabs
// in the same browser don't share/overwrite each other's sessions.
import '@/lib/token-storage';
import { useNotificationStore } from '@/store/notificationStore';
import Sidebar from '@/components/Sidebar';
import { navSections, PICKER_ROUTES } from '@/lib/navData';
import Header from '@/components/Header';
import NotificationPopup from '@/components/NotificationPopup';
import WelcomeGreeting from '@/components/WelcomeGreeting';
import OnboardingWalkthrough from '@/components/OnboardingWalkthrough';
import SafeRender from '@/components/SafeRender';
import { useSessionTimeout } from '@/hooks/useSessionTimeout';
import { canRoleAccessModule, LEGACY_ROLE_MAP } from '@/lib/roleAccess';
import toast from 'react-hot-toast';
import {
  FiUsers, FiBriefcase, FiClock, FiMenu,
  FiCpu, FiGrid, FiBell, FiUser,
  FiCalendar, FiMoreHorizontal,
} from 'react-icons/fi';

// PICKER_ROUTES now imported from navData

// Mobile bottom navigation items
const mobileNavItems = [
  { label: 'Home', href: '/home', icon: FiGrid },
  { label: 'People', href: '/employees', icon: FiUsers },
  { label: 'Recruit', href: '/recruitment', icon: FiBriefcase },
  { label: 'AI Interview', href: '/ai-interview', icon: FiCpu },
  { label: 'More', href: '#more', icon: FiMoreHorizontal },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, isLoading, fetchUser, token, user, logout } = useAuthStore();
  const { fetchNotifications } = useNotificationStore();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showMobileNotif, setShowMobileNotif] = useState(false);
  const [showMobileProfile, setShowMobileProfile] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Module selection state
  const [explicitModuleKey, setExplicitModuleKey] = useState<string | null>(null);
  const userRole = user?.role || 'admin';

  // Filter sections based on user role
  // Per-item role filtering: must pass BOTH module-level AND per-item role checks.
  // Also handles legacy roles via LEGACY_ROLE_MAP (e.g., 'company_hr_admin' → 'admin').
  const effectiveRoles = useMemo(() => {
    const migrated = LEGACY_ROLE_MAP[userRole] || userRole;
    return Array.from(new Set([userRole, migrated])).filter(Boolean);
  }, [userRole]);

  const filteredSections = useMemo(() => {
    return navSections
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => {
          // 1. Module-level check
          if (item.moduleKey && !canRoleAccessModule(userRole, item.moduleKey)) {
            return false;
          }
          // 2. Per-item role check (granular)
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
      .filter((section) => section.items.length > 0);
  }, [userRole, effectiveRoles]);

  // Auto-detect current module from pathname
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

  // Reset explicit selection on navigation
  useEffect(() => {
    setExplicitModuleKey(null);
  }, [pathname]);

  const currentModuleKey = explicitModuleKey ?? autoDetectedModuleKey;

  const handleSidebarModuleSelect = useCallback((key: string | null) => {
    setExplicitModuleKey(key);
  }, []);

  // Check mobile viewport
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) setSidebarCollapsed(true);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Auth check
  useEffect(() => {
    if (!token && !isLoading) { router.push('/login'); return; }
    if (token && !isAuthenticated && isLoading) fetchUser();
  }, [token, isAuthenticated, isLoading, router, fetchUser]);

  // Auto-fix tenant branding on first load
  useEffect(() => {
    if (isAuthenticated) {
      fetch('/api/fix-tenant', { method: 'POST' }).catch(() => {});
      fetch('/api/db-push', { method: 'POST' }).catch(() => {});
    }
  }, [isAuthenticated]);

  // ─── Chunk-loading error auto-recovery ───
  // When Vercel deploys a new build, old browser tabs try to load JavaScript
  // chunks that no longer exist → "Failed to load chunk" error.
  // This handler catches those errors and reloads the page ONCE to fetch
  // the new chunks from the latest build.
  useEffect(() => {
    let hasReloaded = false;
    const handleChunkError = (event: ErrorEvent) => {
      const msg = event.message || '';
      const filename = event.filename || '';
      if (
        (msg.includes('Failed to load chunk') ||
         msg.includes('Loading chunk') ||
         msg.includes('Loading CSS chunk') ||
         msg.includes('Importing a module script failed') ||
         filename.includes('/_next/static/chunks/')) &&
        !hasReloaded
      ) {
        hasReloaded = true;
        console.warn('[Layout] Chunk loading error detected. Reloading page to fetch new chunks...');
        // Force reload from server (not cache)
        window.location.reload();
      }
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = String(event.reason || '');
      if (
        (reason.includes('Failed to load chunk') ||
         reason.includes('Loading chunk') ||
         reason.includes('Importing a module script failed')) &&
        !hasReloaded
      ) {
        hasReloaded = true;
        console.warn('[Layout] Chunk loading promise rejection. Reloading page...');
        window.location.reload();
      }
    };

    window.addEventListener('error', handleChunkError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleChunkError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  // Fetch notifications
  useEffect(() => {
    if (isAuthenticated) {
      const initialTimeout = setTimeout(() => fetchNotifications(), 3000);
      const interval = setInterval(fetchNotifications, 30000);
      return () => { clearTimeout(initialTimeout); clearInterval(interval); };
    }
  }, [isAuthenticated, fetchNotifications]);

  useSessionTimeout();

  useEffect(() => {
    const handleWarning = () => {
      toast('Your session will expire in 5 minutes due to inactivity.', { icon: '⏳', duration: 10000 });
    };
    window.addEventListener('session-warning', handleWarning);
    return () => window.removeEventListener('session-warning', handleWarning);
  }, []);

  const handleSidebarToggle = useCallback(() => {
    if (isMobile) setMobileSidebarOpen((prev) => !prev);
    else setSidebarCollapsed((prev) => !prev);
  }, [isMobile]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-thb-background">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-green-500 via-emerald-500 to-teal-600 mb-4 shadow-lg shadow-green-500/25 animate-pulse-subtle ring-2 ring-green-400/20">
            <svg viewBox="0 0 30 30" className="w-7 h-7" fill="none">
              <path d="M15 2L3 8V16C3 24 8.1 31.2 15 33C21.9 31.2 27 24 27 16V8L15 2Z" fill="rgba(255,255,255,0.2)" stroke="white" strokeWidth="0.5"/>
              <path d="M9 23V11H12.5L20 20V11H23V23H19.5L12 14V23H9Z" fill="white"/>
            </svg>
          </div>
          <p className="text-sm text-thb-text-secondary font-medium">Loading 3Boxes HRMS...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  const getInitials = (name: string) => name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);

  // ========= MOBILE LAYOUT =========
  if (isMobile) {
    return (
      <div className="min-h-screen bg-thb-background flex flex-col">
        <SafeRender><WelcomeGreeting onComplete={() => setShowOnboarding(true)} /></SafeRender>
        <SafeRender>{showOnboarding && <OnboardingWalkthrough />}</SafeRender>
        <Toaster position="top-center" toastOptions={{ duration: 3000, style: { background: '#fff', color: '#0F172A', borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', padding: '10px 14px', fontSize: '13px', maxWidth: '90vw' } }} />
        <NotificationPopup />
        <header className="h-14 bg-white border-b border-slate-200 flex items-center px-3 gap-2 sticky top-0 z-30 shrink-0">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 via-emerald-500 to-teal-600 flex items-center justify-center shadow-sm">
              <svg viewBox="0 0 35 11" className="w-4 h-3" fill="none"><rect x="0" y="0" width="9" height="9" rx="2" fill="white" opacity="0.9"/><rect x="13" y="0" width="9" height="9" rx="2" fill="white" opacity="0.9"/><rect x="26" y="0" width="9" height="9" rx="2" fill="white" opacity="0.9"/></svg>
            </div>
            <span className="text-sm font-extrabold text-slate-800 truncate">3Boxes <span className="text-[9px] font-bold text-green-500 tracking-wider">HRMS</span></span>
          </div>
          <button onClick={() => { setShowMobileNotif(false); setShowMobileProfile(false); setShowMobileMenu(!showMobileMenu); }} className="p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"><FiMenu className="w-5 h-5" /></button>
          <button onClick={() => { setShowMobileMenu(false); setShowMobileProfile(false); setShowMobileNotif(!showMobileNotif); }} className="p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors relative"><FiBell className="w-5 h-5" /></button>
          <button onClick={() => { setShowMobileMenu(false); setShowMobileNotif(false); setShowMobileProfile(!showMobileProfile); }} className="w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-teal-600 flex items-center justify-center text-white text-[10px] font-bold shadow-sm">{user?.name ? getInitials(user.name) : '??'}</button>
        </header>
        {showMobileMenu && (
          <div className="fixed inset-0 z-50" onClick={() => setShowMobileMenu(false)}>
            <div className="absolute inset-0 bg-black/30" />
            <div className="absolute top-14 left-0 right-0 bg-white border-b border-slate-200 shadow-xl max-h-[70vh] overflow-y-auto animate-slide-in-down" onClick={(e) => e.stopPropagation()}>
              <Sidebar collapsed={false} onToggle={() => setShowMobileMenu(false)} isMobileMenu currentModuleKey={currentModuleKey} onModuleSelect={handleSidebarModuleSelect} />
              <div className="p-3 border-t border-slate-100">
                <button onClick={async () => { await logout(); window.location.href = '/login'; }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors text-sm font-medium">Sign Out</button>
              </div>
            </div>
          </div>
        )}
        {showMobileNotif && (
          <div className="fixed inset-0 z-50" onClick={() => setShowMobileNotif(false)}>
            <div className="absolute inset-0 bg-black/30" />
            <div className="absolute top-14 left-0 right-0 bg-white border-b border-slate-200 shadow-xl max-h-[70vh] overflow-y-auto animate-slide-in-down" onClick={(e) => e.stopPropagation()}>
              <div className="p-4 border-b border-slate-100 flex items-center justify-between"><h3 className="font-semibold text-slate-800">Notifications</h3></div>
              <div className="p-6 text-center"><FiBell className="w-8 h-8 text-slate-300 mx-auto mb-2" /><p className="text-sm text-slate-400">No new notifications</p></div>
            </div>
          </div>
        )}
        {showMobileProfile && (
          <div className="fixed inset-0 z-50" onClick={() => setShowMobileProfile(false)}>
            <div className="absolute inset-0 bg-black/30" />
            <div className="absolute top-14 right-0 w-64 bg-white border border-slate-200 shadow-xl rounded-b-xl animate-slide-in-down" onClick={(e) => e.stopPropagation()}>
              <div className="p-4 border-b border-slate-100 text-center">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-500 to-teal-600 flex items-center justify-center text-white text-lg font-bold mx-auto mb-2">{user?.name ? getInitials(user.name) : '??'}</div>
                <p className="text-sm font-semibold text-slate-800">{user?.name}</p>
                <p className="text-[11px] text-slate-400 capitalize">{user?.role?.replace('_', ' ')}</p>
              </div>
              <div className="py-1">
                <button onClick={() => { setShowMobileProfile(false); router.push('/my-profile'); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 transition-colors"><FiUser className="w-4 h-4" /> My Profile</button>
                <div className="border-t border-slate-100 my-1" />
                <button onClick={async () => { await logout(); window.location.href = '/login'; }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors">Sign Out</button>
              </div>
            </div>
          </div>
        )}
        <main className="flex-1 overflow-y-auto p-3 pb-20">{children}</main>
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-30 safe-area-bottom">
          <div className="flex items-center justify-around h-14">
            {mobileNavItems.map((item) => {
              const isActive = item.href === '#more' ? false : pathname === item.href || pathname?.startsWith(item.href + '/');
              const Icon = item.icon;
              return (
                <button key={item.label} onClick={() => { if (item.href === '#more') setShowMobileMenu(true); else router.push(item.href); }} className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors ${isActive ? 'text-green-500' : 'text-slate-400 hover:text-slate-600'}`}>
                  <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5px]' : ''}`} />
                  <span className={`text-[9px] font-semibold tracking-wide ${isActive ? 'text-green-500' : ''}`}>{item.label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      </div>
    );
  }

  // ========= DESKTOP LAYOUT =========
  return (
    <div className="min-h-screen bg-thb-background">
      <SafeRender><WelcomeGreeting onComplete={() => setShowOnboarding(true)} /></SafeRender>
      <SafeRender>{showOnboarding && <OnboardingWalkthrough />}</SafeRender>
      <Toaster position="top-right" toastOptions={{ duration: 4000, style: { background: '#fff', color: '#0F172A', borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', padding: '12px 16px', fontSize: '14px' } }} />
      <NotificationPopup />

      {/* LEFT SIDEBAR */}
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={handleSidebarToggle}
        currentModuleKey={currentModuleKey}
        onModuleSelect={handleSidebarModuleSelect}
      />

      {/* MAIN CONTENT */}
      <div className={`transition-all duration-300 ${sidebarCollapsed ? 'ml-[68px]' : 'ml-[260px]'}`}>
        <Header onSidebarToggle={handleSidebarToggle} />
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
