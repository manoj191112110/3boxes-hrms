'use client';

import { create } from 'zustand';
import { isClientLiveMode, getClientSiteMode } from '@/lib/site-mode';
import { isTenantHiddenClient, LIVE_HIDDEN_SLUGS, DEMO_HIDDEN_SLUGS } from '@/lib/tenant-filter';
import { getClientTenantSlug } from '@/lib/tenant-client';

// ─── Hidden Tenant Slugs (GOLDEN RULE) ────────────────────────────
// PRIMARY: tenant-filter.ts (FOOLPROOF hostname-based detection)
// SECONDARY: site-mode.ts (env var + host header, may fail on Vercel)
function getAuthHiddenSlugs(): string[] {
  if (typeof window === 'undefined') return [];
  // PRIMARY: FOOLPROOF hostname check
  const foolproofSlugs = isTenantHiddenClient('3boxeshrms') // dummy check to see if client is live
    ? LIVE_HIDDEN_SLUGS
    : (isClientLiveMode() ? LIVE_HIDDEN_SLUGS : DEMO_HIDDEN_SLUGS);
  // Union with site-mode based slugs
  const siteModeSlugs = isClientLiveMode() ? LIVE_HIDDEN_SLUGS : DEMO_HIDDEN_SLUGS;
  return [...new Set([...foolproofSlugs, ...siteModeSlugs])];
}

function isAuthHiddenTenant(slug: string): boolean {
  if (typeof window === 'undefined') return false;
  // PRIMARY: FOOLPROOF check (direct hostname, no env vars)
  if (isTenantHiddenClient(slug)) return true;
  // SECONDARY: site-mode based check
  return (isClientLiveMode() ? LIVE_HIDDEN_SLUGS : DEMO_HIDDEN_SLUGS).includes(slug);
}

/**
 * Scrub hidden tenant data from a user object.
 * In LIVE mode, if the user's tenant slug is in the hidden list,
 * we null out tenantId and tenant so that no component ever renders
 * "Marq AI Tech Pvt Ltd" or "3Boxes HRMS Demo" on the live site.
 * For super_admin, we set tenantId to null entirely since they
 * aren't scoped to any single tenant.
 * For other users, we null it out (which may redirect them to login).
 */
function scrubHiddenTenant<T extends { tenantId?: string; tenant?: { slug?: string } | null }>(user: T): T {
  if (!user) return user;
  const hiddenSlugs = getAuthHiddenSlugs();
  if (hiddenSlugs.length === 0) return user;
  if (user.tenant?.slug && hiddenSlugs.includes(user.tenant.slug)) {
    return { ...user, tenantId: undefined, tenant: null };
  }
  return user;
}

interface TenantInfo {
  id: string;
  name: string;
  slug: string;
  plan: string;
  currency: string;
  timezone: string;
  logo?: string | null;
  status?: string;
}

interface CompanyInfo {
  id: string;
  name: string;
  code: string;
  logo?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
}

interface EmployeeInfo {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  department?: string | null;
  designation?: string | null;
  branch?: string | null;
  status?: string;
  salary?: number | null;
  company?: CompanyInfo | null;
  companyId?: string | null;
  companyLogo?: string | null;
  companyName?: string | null;
}

interface UserInfo {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar?: string | null;
  tenantId?: string;
  tenant?: TenantInfo;
  company?: CompanyInfo | null;
  // Populated by /api/auth/me — required by marketplace pages (wallet, ewa, etc.)
  // that need the logged-in user's employeeId to fetch per-employee data.
  employee?: EmployeeInfo | null;
}

// Permissions: { moduleKey: { action: boolean } }
type ModulePermissions = Record<string, boolean>;
type UserPermissions = Record<string, ModulePermissions>;

interface AuthState {
  user: UserInfo | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  permissions: UserPermissions;
  permissionsLoaded: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  fetchUser: () => Promise<void>;
  setToken: (token: string) => void;
  fetchPermissions: () => Promise<void>;
  hasPermission: (moduleKey: string, action: string) => boolean;
  canAccessModule: (moduleKey: string) => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,
  permissions: {},
  permissionsLoaded: false,

  login: async (email: string, password: string): Promise<boolean> => {
    try {
      set({ isLoading: true });
      const tenantSlug = getClientTenantSlug();
      const loginUrl = tenantSlug
        ? `/api/auth/login?tenant=${encodeURIComponent(tenantSlug)}`
        : '/api/auth/login';
      const res = await fetch(loginUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Login failed');
      }

      const { token, user: rawUser } = data;

      // ─── GOLDEN RULE: Scrub hidden tenant from authStore ───
      // On the LIVE site, we NEVER store hidden tenant data (e.g., "Marq AI Tech Pvt Ltd")
      // in authStore. This prevents Sidebar, WelcomeGreeting, and any other component
      // that reads user.tenant from displaying the hidden tenant name.
      const user = scrubHiddenTenant(rawUser);

      if (typeof window !== 'undefined') {
        localStorage.setItem('tb_token', token);
      }

      set({
        token,
        user,
        isAuthenticated: true,
        isLoading: false,
      });

      // Fetch permissions after login
      get().fetchPermissions();

      // Also fetch the full user profile (incl. employee info) so that
      // pages like /marketplace/wallet can read user.employee.employeeId
      // immediately after login instead of waiting for a page reload.
      // Login response itself doesn't include employee data; /api/auth/me does.
      get().fetchUser();

      return true;
    } catch (error: unknown) {
      set({ isLoading: false });
      throw error;
    }
  },

  logout: async () => {
    try {
      const { token } = get();
      if (token) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('tb_token');
        localStorage.removeItem('tb_company_ctx');
        localStorage.removeItem('tb_company_ctx_v2');
      }
      set({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        permissions: {},
        permissionsLoaded: false,
      });
      // Clear tenant module cache on logout
      try {
        const { useTenantModuleStore } = require('@/store/tenantModuleStore');
        useTenantModuleStore.getState().clear();
      } catch (_e) { /* non-critical */ }
    }
  },

  fetchUser: async () => {
    try {
      const { token } = get();
      if (!token) {
        set({ isLoading: false });
        return;
      }

      const res = await fetch('/api/auth/me', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('tb_token');
        }
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          isLoading: false,
        });
        return;
      }

      const rawUser = await res.json();

      // ─── GOLDEN RULE: Scrub hidden tenant from authStore ───
      // On the LIVE site, we NEVER store hidden tenant data (e.g., "Marq AI Tech Pvt Ltd")
      // in authStore. This prevents Sidebar, WelcomeGreeting, and any other component
      // that reads user.tenant from displaying the hidden tenant name.
      const user = scrubHiddenTenant(rawUser);

      // ─── Tenant status guard ───
      // If the user's tenant is suspended, inactive, or pending_approval,
      // force logout and show an error. Super admins are exempt (they
      // control tenant status, not subject to it).
      if (user.role !== 'super_admin' && user.tenant?.status) {
        const blockedStatuses = ['suspended', 'inactive', 'pending_approval'];
        if (blockedStatuses.includes(user.tenant.status)) {
          // Force logout — clear token and auth state
          if (typeof window !== 'undefined') {
            localStorage.removeItem('tb_token');
            localStorage.removeItem('tb_company_ctx');
        localStorage.removeItem('tb_company_ctx_v2');
          }
          set({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
          });
          // Show a user-friendly message
          const statusMessages: Record<string, string> = {
            suspended: 'Your tenant has been suspended by the super admin. Please contact support to reactivate your account.',
            inactive: 'Your tenant account is inactive. Please contact the super admin.',
            pending_approval: 'Your tenant is pending approval. You cannot access the platform until the super admin approves your account.',
          };
          throw new Error(statusMessages[user.tenant.status] || `Your tenant status is "${user.tenant.status}". Access denied.`);
        }
      }

      set({
        user,
        isAuthenticated: true,
        isLoading: false,
      });

      // Fetch permissions after user is loaded
      get().fetchPermissions();
    } catch (error) {
      console.error('Fetch user error:', error);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('tb_token');
      }
      set({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
      });
    }
  },

  setToken: (token: string) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('tb_token', token);
    }
    set({ token });
  },

  fetchPermissions: async () => {
    try {
      const { token, user } = get();
      if (!token || !user) return;

      // Super admin always has all permissions
      if (user.role === 'super_admin') {
        set({ permissionsLoaded: true });
        return;
      }

      const res = await fetch('/api/rbac/my-permissions', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        const data = await res.json();
        set({
          permissions: data.permissions || {},
          permissionsLoaded: true,
        });
      } else {
        // If RBAC not seeded yet, fall back to role-based defaults
        set({ permissionsLoaded: true });
      }
    } catch (error) {
      console.error('Fetch permissions error:', error);
      set({ permissionsLoaded: true });
    }
  },

  hasPermission: (moduleKey: string, action: string): boolean => {
    const { user, permissions } = get();

    // Super admin always has all permissions
    if (user?.role === 'super_admin') return true;

    // Check RBAC permissions
    const modulePerms = permissions[moduleKey];
    if (modulePerms && modulePerms[action] === true) {
      return true;
    }

    return false;
  },

  canAccessModule: (moduleKey: string): boolean => {
    const { user, permissions } = get();

    // Super admin always has access
    if (user?.role === 'super_admin') return true;

    // Check if user has any permission for this module (at minimum 'view')
    const modulePerms = permissions[moduleKey];
    if (modulePerms && (modulePerms.view === true || modulePerms.read === true)) {
      return true;
    }

    // Fallback: if permissions haven't been loaded yet, allow access
    // (backward compatibility before RBAC is seeded)
    return false;
  },
}));

// Initialize auth state from localStorage on client
if (typeof window !== 'undefined') {
  const token = localStorage.getItem('tb_token');
  if (token) {
    useAuthStore.setState({ token, isLoading: true });
    useAuthStore.getState().fetchUser();
  } else {
    useAuthStore.setState({ isLoading: false });
  }
}
