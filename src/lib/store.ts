import { create } from 'zustand'

export type ModuleKey = 'super-admin' | 'dashboard' | 'company-management' | 'employees' | 'recruitment' | 'job-portal' | 'ai-interview' | 'onboarding' | 'attendance' | 'leave' | 'payroll' | 'timesheet' | 'projects' | 'performance' | 'training' | 'exit' | 'clients' | 'vendors' | 'subvendors' | 'helpdesk' | 'ai-chatbot' | 'workflows' | 'audit' | 'analytics' | 'selfservice' | 'profile' | 'settings'

interface HRMSState {
  activeModule: ModuleKey
  activeSubItem: string | null
  sidebarOpen: boolean
  searchQuery: string
  userRole: string
  currentCompanyId: string | null
  homeView: boolean
  selectModule: (key: ModuleKey) => void
  selectModuleWithSubItem: (moduleKey: ModuleKey, subKey: string) => void
  setSidebarOpen: (open: boolean) => void
  setSearchQuery: (query: string) => void
  setUserRole: (role: string) => void
  setCurrentCompanyId: (id: string | null) => void
  goHome: () => void
  setActiveSubItem: (item: string | null) => void
}

export const useHRMSStore = create<HRMSState>((set) => ({
  activeModule: 'dashboard',
  activeSubItem: null,
  sidebarOpen: true,
  searchQuery: '',
  userRole: 'super_admin',
  currentCompanyId: null,
  homeView: false,
  selectModule: (key) => set({ activeModule: key, activeSubItem: null, homeView: false }),
  selectModuleWithSubItem: (moduleKey, subKey) => set({ activeModule: moduleKey, activeSubItem: subKey, homeView: false }),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setUserRole: (role) => set({ userRole: role }),
  setCurrentCompanyId: (id) => set({ currentCompanyId: id }),
  goHome: () => set({ homeView: true }),
  setActiveSubItem: (item) => set({ activeSubItem: item }),
}))

export function getDashboardModule(dashboard: string): ModuleKey {
  switch (dashboard) {
    case 'super_admin': return 'super-admin'
    case 'company_admin': case 'admin': return 'dashboard'
    default: return 'dashboard'
  }
}
