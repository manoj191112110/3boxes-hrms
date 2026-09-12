import { create } from 'zustand';
import type { UserRole, ModuleKey, CompanyInfo } from '@/lib/types';

interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  companyId: string | null;
  avatar: string | null;
  employeeId?: string;
  employeeName?: string;
  companyName?: string;
  companyCode?: string;
  companyCurrency?: string;
}

interface AppState {
  // Auth
  isAuthenticated: boolean;
  isLoading: boolean;
  authError: string | null;
  user: AuthUser | null;
  userRole: UserRole;
  userName: string;
  userEmail: string;
  userAvatar: string;
  
  // Company context
  currentCompany: CompanyInfo | null;
  companies: CompanyInfo[];
  
  // Navigation
  activeModule: ModuleKey;
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;
  
  // Theme
  darkMode: boolean;
  
  // Notifications
  notificationCount: number;
  
  // Actions
  login: (email: string, password: string) => Promise<void>;
  demoLogin: (role: UserRole, name: string, email: string) => void;
  logout: () => void;
  setActiveModule: (module: ModuleKey) => void;
  setSidebarOpen: (open: boolean) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setCurrentCompany: (company: CompanyInfo) => void;
  toggleDarkMode: () => void;
  setNotificationCount: (count: number) => void;
  setCompanies: (companies: CompanyInfo[]) => void;
}

// No demo/dummy companies on the live platform.
// Company data is always sourced from the authenticated user's context
// via /api/me/context (see companyContextStore.ts).
// The old DEMO_COMPANIES fallback has been removed per the live/demo separation rule.
const EMPTY_COMPANIES: CompanyInfo[] = [];

export const useAppStore = create<AppState>((set, get) => ({
  isAuthenticated: false,
  isLoading: false,
  authError: null,
  user: null,
  userRole: 'employee',
  userName: '',
  userEmail: '',
  userAvatar: '',

  currentCompany: null,
  companies: EMPTY_COMPANIES,
  
  activeModule: 'dashboard',
  sidebarOpen: true,
  sidebarCollapsed: false,
  
  darkMode: false,
  notificationCount: 0,
  
  login: async (email: string, password: string) => {
    set({ isLoading: true, authError: null });
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        set({ isLoading: false, authError: data.error || 'Login failed' });
        return;
      }
      
      const apiUser = data.user;
      const apiEmployee = apiUser.employee;
      const apiCompany = apiUser.company;

      const user: AuthUser = {
        id: apiUser.id,
        email: apiUser.email,
        name: apiUser.name,
        role: apiUser.role as UserRole,
        companyId: apiUser.companyId,
        avatar: apiUser.avatar,
        employeeId: apiEmployee?.employeeId,
        employeeName: apiEmployee ? `${apiEmployee.firstName} ${apiEmployee.lastName}` : apiUser.name,
        companyName: apiCompany?.name,
        companyCode: apiCompany?.code,
        companyCurrency: apiCompany?.currency,
      };
      
      // Use company from API data, or null if not available.
      // No demo/dummy fallback on the live platform — company is always
      // sourced from the authenticated user's context.
      const company = apiCompany ? {
        id: apiCompany.id,
        name: apiCompany.name,
        code: apiCompany.code || '',
        industry: apiCompany.industry || '',
        logo: apiCompany.logo || null,
        country: apiCompany.country || '',
        currency: apiCompany.currency || 'INR',
        employeeCount: 0,
        isActive: true,
      } : null;
      
      set({
        isAuthenticated: true,
        isLoading: false,
        authError: null,
        user,
        userRole: user.role,
        userName: user.employeeName || user.name,
        userEmail: user.email,
        currentCompany: company,
        activeModule: 'dashboard',
      });
    } catch {
      set({ isLoading: false, authError: 'Network error. Please try again.' });
    }
  },
  
  demoLogin: (role, name, email) => {
    const user: AuthUser = {
      id: 'demo',
      email,
      name,
      role,
      companyId: null,
      avatar: null,
    };
    set({
      isAuthenticated: true,
      isLoading: false,
      authError: null,
      user,
      userRole: role,
      userName: name,
      userEmail: email,
      activeModule: 'dashboard',
    });
  },
  
  logout: () => set({
    isAuthenticated: false,
    isLoading: false,
    authError: null,
    user: null,
    userRole: 'employee',
    userName: '',
    userEmail: '',
    activeModule: 'dashboard',
  }),
  
  setActiveModule: (module) => set({ activeModule: module }),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  setCurrentCompany: (company) => set({ currentCompany: company }),
  toggleDarkMode: () => set((s) => ({ darkMode: !s.darkMode })),
  setNotificationCount: (count) => set({ notificationCount: count }),
  setCompanies: (companies) => set({ companies }),
}));
