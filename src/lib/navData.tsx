'use client';

import {
  FiUsers, FiBriefcase, FiUserPlus, FiClock, FiCalendar,
  FiDollarSign, FiTrendingUp, FiFolder, FiPackage,
  FiGlobe, FiHelpCircle, FiMessageCircle, FiBookOpen,
  FiSettings, FiShield, FiServer, FiWatch, FiTarget,
  FiShoppingBag, FiGrid, FiUser, FiFileText, FiEdit3,
  FiTruck, FiRefreshCw, FiMapPin, FiActivity, FiLock,
  FiLayers, FiCreditCard, FiPercent, FiDatabase,
  FiCheckSquare, FiPlayCircle, FiGift, FiCpu,
  FiMap, FiVideo, FiMail, FiStar, FiSearch,
  FiClipboard, FiHeart, FiBook, FiFile, FiUserCheck,
  FiMonitor, FiShoppingCart, FiBarChart2, FiAlertCircle,
  FiHome, FiChevronLeft, FiChevronRight, FiChevronDown,
  FiLogOut, FiBell, FiZap, FiHardDrive, FiGitBranch,
  FiMoreHorizontal, FiArrowRight, FiPieChart, FiAward,
  FiSliders,
} from 'react-icons/fi';

export interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  roles?: string[];
  moduleKey?: string;
  isNew?: boolean;
  badge?: string;
  isDivider?: boolean;  // if true, renders as a sub-section header, not a link
}

export interface DashboardTab {
  label: string;
  key: string;          // tab identifier, used in URL query param ?tab=key
  icon: React.ReactNode;
  isNew?: boolean;
}

export interface NavSection {
  key: string;
  label: string;
  sectionIcon: React.ComponentType<{ className?: string }>;
  sectionColor: string;
  description: string;   // brief description for the Modules page
  items: NavItem[];
  dashboardTabs?: DashboardTab[];  // tabs shown inside the dashboard page
}

export interface ModuleGroup {
  groupLabel: string;
  groupDescription: string;
  groupIcon: React.ComponentType<{ className?: string }>;
  sections: NavSection[];
}

// ─── Color palette for module cards ───
const C: Record<string, string> = {
  tenant:       'from-orange-500 to-amber-600',
  company:      'from-emerald-500 to-green-600',
  employee:     'from-green-500 to-emerald-600',
  leave:        'from-teal-500 to-cyan-600',
  attendance:   'from-cyan-500 to-sky-600',
  payroll:      'from-green-500 to-emerald-600',
  recruitment:  'from-teal-500 to-teal-600',
  onboarding:   'from-emerald-500 to-teal-600',
  preboarding:  'from-lime-500 to-green-600',
  appraisal:    'from-amber-500 to-yellow-600',
  project:      'from-fuchsia-500 to-pink-600',
  travel:       'from-orange-500 to-red-600',
  assets:       'from-slate-500 to-gray-600',
  crm:          'from-pink-500 to-rose-600',
  external:     'from-teal-500 to-teal-600',
  marketplace:  'from-rose-500 to-pink-600',
  support:      'from-yellow-500 to-orange-600',
  collaboration:'from-teal-500 to-emerald-600',
  knowledge:    'from-green-500 to-cyan-600',
  governance:   'from-gray-500 to-slate-600',
  superadmin:   'from-red-500 to-rose-600',
  accounts:     'from-emerald-500 to-green-600',
};

// ══════════════════════════════════════════════════════════════
//  REORGANIZED MODULES — Dashboard sub-sections as tabs
//  Masters / Settings / Reports → dashboardTabs (inside Dashboard)
//  Functional items → sidebar items
// ══════════════════════════════════════════════════════════════

export const navSections: NavSection[] = [

  // ─── 0. SUPER ADMIN (platform-level, super_admin only) ───
  {
    key: 'super-admin',
    label: 'Super Admin',
    sectionIcon: FiShield,
    sectionColor: C.superadmin,
    description: 'Platform management & oversight',
    dashboardTabs: [
      { label: 'Overview', key: 'overview', icon: <FiGrid className="w-4 h-4" /> },
      { label: 'Audit Logs', key: 'audit-logs', icon: <FiLock className="w-4 h-4" />, isNew: true },
      { label: 'Feature Flags', key: 'feature-flags', icon: <FiZap className="w-4 h-4" />, isNew: true },
      { label: 'Module Mgmt', key: 'module-mgmt', icon: <FiGrid className="w-4 h-4" />, isNew: true },
      { label: 'Reports', key: 'reports', icon: <FiFileText className="w-4 h-4" />, isNew: true },
    ],
    items: [
      { label: 'Super Admin Dashboard', href: '/super-admin', icon: <FiGrid className="w-4 h-4" />, roles: ['super_admin'] },
      { label: 'Companies', href: '/super-admin', icon: <FiBriefcase className="w-4 h-4" />, roles: ['super_admin'] },
      { label: 'Subscriptions', href: '/super-admin/subscriptions', icon: <FiCreditCard className="w-4 h-4" />, roles: ['super_admin'], isNew: true },
      { label: 'Packages', href: '/super-admin/packages', icon: <FiPackage className="w-4 h-4" />, roles: ['super_admin'], isNew: true },
      { label: 'Domain Management', href: '/super-admin/domain', icon: <FiGlobe className="w-4 h-4" />, roles: ['super_admin'], isNew: true },
      { label: 'Purchase Transactions', href: '/super-admin/purchase-transactions', icon: <FiDollarSign className="w-4 h-4" />, roles: ['super_admin'], isNew: true },
      { label: 'Tenant Usage Metrics', href: '/super-admin/tenant-usage', icon: <FiBarChart2 className="w-4 h-4" />, roles: ['super_admin'], isNew: true },
      { label: 'Tenant Support Tickets', href: '/super-admin/tenant-tickets', icon: <FiHelpCircle className="w-4 h-4" />, roles: ['super_admin'], isNew: true },
      { label: 'Storage Quotas', href: '/super-admin/storage-quotas', icon: <FiHardDrive className="w-4 h-4" />, roles: ['super_admin'], isNew: true },
      { label: 'SSO Providers', href: '/super-admin/sso-providers', icon: <FiLock className="w-4 h-4" />, roles: ['super_admin'], isNew: true },
      { label: 'Trial Requests', href: '/super-admin/trial-requests', icon: <FiBriefcase className="w-4 h-4" />, roles: ['super_admin'], isNew: true },
      { label: 'RBAC Management', href: '/super-admin/rbac', icon: <FiLock className="w-4 h-4" />, roles: ['super_admin'] },
      { label: 'Module Management', href: '/super-admin/tenant-modules', icon: <FiGrid className="w-4 h-4" />, roles: ['super_admin'], isNew: true },
      { label: 'Tenant Configuration', href: '/super-admin/tenant-configuration', icon: <FiSettings className="w-4 h-4" />, roles: ['super_admin'], isNew: true },
      { label: 'AI Settings', href: '/super-admin/ai-settings', icon: <FiCpu className="w-4 h-4" />, roles: ['super_admin'], isNew: true },
      { label: 'AI Admin Console', href: '/ai-admin', icon: <FiCpu className="w-4 h-4" />, roles: ['super_admin'], isNew: true },
    ],
  },

  // ─── 1. TENANT MODULE ───
  {
    key: 'tenant',
    label: 'Tenant Management',
    sectionIcon: FiServer,
    sectionColor: C.tenant,
    description: 'Tenant & multi-company management',
    dashboardTabs: [
      { label: 'Overview', key: 'overview', icon: <FiGrid className="w-4 h-4" /> },
      { label: 'Reports', key: 'reports', icon: <FiFileText className="w-4 h-4" />, isNew: true },
      { label: 'Settings', key: 'settings', icon: <FiSettings className="w-4 h-4" />, isNew: true },
    ],
    items: [
      { label: 'Tenant Dashboard', href: '/tenant-admin', icon: <FiGrid className="w-4 h-4" />, roles: ['tenant_admin'], isNew: true },
      { label: 'Sub-Companies', href: '/tenant-admin/companies', icon: <FiBriefcase className="w-4 h-4" />, roles: ['tenant_admin'], isNew: true },
      { label: 'Group Companies', href: '/tenant-admin/group-companies', icon: <FiLayers className="w-4 h-4" />, roles: ['tenant_admin'], isNew: true },
      { label: 'Company RBAC', href: '/tenant-admin/rbac', icon: <FiLock className="w-4 h-4" />, roles: ['tenant_admin'], isNew: true },
      { label: 'Profile Configuration', href: '/tenant-admin/profile-config', icon: <FiSettings className="w-4 h-4" />, roles: ['tenant_admin'], isNew: true },
      { label: 'Storage Analytics', href: '/tenant-admin/storage-analytics', icon: <FiPackage className="w-4 h-4" />, roles: ['tenant_admin'], isNew: true },
      { label: 'Communication Governance', href: '/tenant-admin/comm-governance', icon: <FiMessageCircle className="w-4 h-4" />, roles: ['tenant_admin'], isNew: true },
      { label: 'Tenant Configuration', href: '/tenant-admin/tenant-configuration', icon: <FiSettings className="w-4 h-4" />, roles: ['tenant_admin'], isNew: true },
      { label: 'AI Admin Console', href: '/ai-admin', icon: <FiCpu className="w-4 h-4" />, roles: ['tenant_admin'], isNew: true },
    ],
  },

  // ─── 2. COMPANY MODULE ───
  // Masters / Settings / Reports → separate sidebar sub-pages
  {
    key: 'company',
    label: 'Company',
    sectionIcon: FiBriefcase,
    sectionColor: C.company,
    description: 'Company structure & configuration',
    dashboardTabs: [
      { label: 'Overview', key: 'overview', icon: <FiGrid className="w-4 h-4" /> },
      { label: 'Masters', key: 'masters', icon: <FiDatabase className="w-4 h-4" /> },
      { label: 'Settings', key: 'settings', icon: <FiSettings className="w-4 h-4" />, isNew: true },
      { label: 'Reports', key: 'reports', icon: <FiFileText className="w-4 h-4" />, isNew: true },
    ],
    items: [
      { label: 'Company Dashboard', href: '/company', icon: <FiGrid className="w-4 h-4" />, moduleKey: 'company' },

      // ── Company Masters ──
      { label: 'Masters', href: '#masters-divider', icon: <FiDatabase className="w-3.5 h-3.5" />, moduleKey: 'company', isDivider: true },
      { label: 'Companies', href: '/company/companies', icon: <FiHome className="w-4 h-4" />, moduleKey: 'company' },
      { label: 'Branches', href: '/company/branches', icon: <FiMapPin className="w-4 h-4" />, moduleKey: 'company' },
      { label: 'Departments', href: '/company/departments', icon: <FiBriefcase className="w-4 h-4" />, moduleKey: 'company' },
      { label: 'Designations', href: '/company/designations', icon: <FiAward className="w-4 h-4" />, moduleKey: 'company' },
      { label: 'Grades', href: '/company/grades', icon: <FiLayers className="w-4 h-4" />, moduleKey: 'company' },

      // ── Company Reports ──
      { label: 'Reports', href: '#reports-divider', icon: <FiFileText className="w-3.5 h-3.5" />, moduleKey: 'company', isDivider: true },
      { label: 'Company Reports', href: '/company/reports', icon: <FiFileText className="w-4 h-4" />, moduleKey: 'company', isNew: true },
    ],
  },

  // ─── 3. EMPLOYEE MODULE ───
  // Dashboard / Lifecycle / Transactions → sidebar sub-sections
  // Employee role: only My Profile + Resignation (self-service)
  // Manager role: + Team view + Org Chart + Probation review
  {
    key: 'employee',
    label: 'Employee',
    sectionIcon: FiUsers,
    sectionColor: C.employee,
    description: 'Employee lifecycle management',
    dashboardTabs: [
      { label: 'Overview', key: 'overview', icon: <FiGrid className="w-4 h-4" /> },
      { label: 'Analytics', key: 'analytics', icon: <FiBarChart2 className="w-4 h-4" />, isNew: true },
      { label: 'Reports', key: 'reports', icon: <FiFileText className="w-4 h-4" />, isNew: true },
      { label: 'Settings', key: 'settings', icon: <FiSettings className="w-4 h-4" />, isNew: true },
    ],
    items: [
      // Self-service: visible to all roles (employee, manager, admin, etc.)
      { label: 'My Dashboard', href: '/employees/dashboard', icon: <FiGrid className="w-4 h-4" />, moduleKey: 'employees', roles: ['super_admin', 'tenant_admin', 'admin', 'manager', 'employee'], isNew: true },
      { label: 'My Profile', href: '/employees?view=self', icon: <FiUser className="w-4 h-4" />, moduleKey: 'employees', roles: ['employee', 'manager'] },
      { label: 'Employee List', href: '/employees', icon: <FiUsers className="w-4 h-4" />, moduleKey: 'employees', roles: ['super_admin', 'tenant_admin', 'admin', 'manager'] },

      // ── Lifecycle ──
      // Admin-only: full lifecycle actions
      { label: 'Lifecycle', href: '#lifecycle-divider', icon: <FiRefreshCw className="w-3.5 h-3.5" />, moduleKey: 'employees', roles: ['super_admin', 'tenant_admin', 'admin', 'manager', 'employee'], isDivider: true },
      { label: 'Add Employee', href: '/employees/add', icon: <FiUserPlus className="w-4 h-4" />, moduleKey: 'employees', roles: ['super_admin', 'tenant_admin', 'admin'], isNew: true },
      { label: 'Probation', href: '/employees/probation', icon: <FiClock className="w-4 h-4" />, moduleKey: 'employees', roles: ['super_admin', 'tenant_admin', 'admin', 'manager'], isNew: true },
      { label: 'Update Requests', href: '/employees/update-requests', icon: <FiFileText className="w-4 h-4" />, moduleKey: 'employees', roles: ['super_admin', 'tenant_admin', 'admin', 'manager', 'employee'], isNew: true },
      { label: 'Transfer', href: '/employees/transfer', icon: <FiRefreshCw className="w-4 h-4" />, moduleKey: 'employees', roles: ['super_admin', 'tenant_admin', 'admin'], isNew: true },
      // Employee can apply for resignation (self-service)
      { label: 'Apply Resignation', href: '/employees/resignation', icon: <FiFileText className="w-4 h-4" />, moduleKey: 'employees', roles: ['super_admin', 'tenant_admin', 'admin', 'manager', 'employee'], isNew: true },
      { label: 'Termination', href: '/employees/termination', icon: <FiAlertCircle className="w-4 h-4" />, moduleKey: 'employees', roles: ['super_admin', 'tenant_admin', 'admin'], isNew: true },
      { label: 'Rejoin Employee', href: '/employees/rejoin', icon: <FiUserCheck className="w-4 h-4" />, moduleKey: 'employees', roles: ['super_admin', 'tenant_admin', 'admin'], isNew: true },

      // ── Structure ──
      { label: 'Structure', href: '#structure-divider', icon: <FiLayers className="w-3.5 h-3.5" />, moduleKey: 'employees', roles: ['super_admin', 'tenant_admin', 'admin', 'manager'], isDivider: true },
      { label: 'Org Chart', href: '/org-chart', icon: <FiLayers className="w-4 h-4" />, moduleKey: 'employees', roles: ['super_admin', 'tenant_admin', 'admin', 'manager'], isNew: true },

      // ── Settings ──
      { label: 'Settings', href: '#settings-divider', icon: <FiSettings className="w-3.5 h-3.5" />, moduleKey: 'employees', roles: ['super_admin', 'tenant_admin', 'admin'], isDivider: true },
      { label: 'Employee Settings', href: '/employees/settings', icon: <FiSettings className="w-4 h-4" />, moduleKey: 'employees', roles: ['super_admin', 'tenant_admin', 'admin'], isNew: true },
      { label: 'Approval Workflows', href: '/employees/approval-config', icon: <FiCheckSquare className="w-4 h-4" />, moduleKey: 'employees', roles: ['super_admin', 'tenant_admin', 'admin'], isNew: true },

      // ── Reports ──
      { label: 'Reports', href: '#reports-divider', icon: <FiFileText className="w-3.5 h-3.5" />, moduleKey: 'employees', roles: ['super_admin', 'tenant_admin', 'admin', 'manager'], isDivider: true },
      { label: 'Employee Reports', href: '/employees/reports', icon: <FiBarChart2 className="w-4 h-4" />, moduleKey: 'employees', roles: ['super_admin', 'tenant_admin', 'admin', 'manager'], isNew: true },
    ],
  },

  // ─── 4. LEAVE MODULE ───
  // Employee: Apply Leave, My Leave Balance, View Leave Applications (self-service)
  // Manager: + Approve Leave, Team Leave Reports
  {
    key: 'leave',
    label: 'Leave',
    sectionIcon: FiCalendar,
    sectionColor: C.leave,
    description: 'Leave management & tracking',
    dashboardTabs: [
      { label: 'Overview', key: 'overview', icon: <FiGrid className="w-4 h-4" /> },
      { label: 'Policy Config', key: 'settings', icon: <FiSettings className="w-4 h-4" /> },
      { label: 'Reports', key: 'reports', icon: <FiFileText className="w-4 h-4" />, isNew: true },
    ],
    items: [
      // Self-service: employee can apply for leave and view their own balance/applications
      { label: 'Leave Dashboard', href: '/leave', icon: <FiGrid className="w-4 h-4" />, moduleKey: 'leave', roles: ['super_admin', 'tenant_admin', 'admin', 'manager', 'employee'], isNew: true },
      { label: 'Apply Leave', href: '/leave/apply', icon: <FiCalendar className="w-4 h-4" />, moduleKey: 'leave', roles: ['super_admin', 'tenant_admin', 'admin', 'manager', 'employee'], isNew: true },
      // HR-only: Apply leave on behalf of employees
      { label: 'Apply Leave by HR', href: '/leave/apply-by-hr', icon: <FiUserPlus className="w-4 h-4" />, moduleKey: 'leave', roles: ['super_admin', 'tenant_admin', 'admin'], isNew: true },
      { label: 'Leave Encashment', href: '/leave/encashment', icon: <FiDollarSign className="w-4 h-4" />, moduleKey: 'leave', roles: ['super_admin', 'tenant_admin', 'admin', 'manager', 'employee'] },

      // ── Leave Balance ──
      { label: 'Leave Balance', href: '#balance-divider', icon: <FiBarChart2 className="w-3.5 h-3.5" />, moduleKey: 'leave', roles: ['super_admin', 'tenant_admin', 'admin', 'manager', 'employee'], isDivider: true },
      { label: 'My Leave Balance', href: '/leave/balance', icon: <FiPieChart className="w-4 h-4" />, moduleKey: 'leave', roles: ['super_admin', 'tenant_admin', 'admin', 'manager', 'employee'], isNew: true },

      // ── Settings (admin-only) ──
      { label: 'Settings', href: '#settings-divider', icon: <FiSettings className="w-3.5 h-3.5" />, moduleKey: 'leave', roles: ['super_admin', 'tenant_admin', 'admin'], isDivider: true },
      { label: 'Leave Policy & Settings', href: '/leave/leave-policy', icon: <FiFileText className="w-4 h-4" />, moduleKey: 'leave', roles: ['super_admin', 'tenant_admin', 'admin'] },
      { label: 'Policy Rules', href: '/leave/leave-policy?tab=rules', icon: <FiSliders className="w-4 h-4" />, moduleKey: 'leave', roles: ['super_admin', 'tenant_admin', 'admin'], isNew: true },
      { label: 'Leave Type Mapping', href: '/leave/leave-policy?tab=mapping', icon: <FiLayers className="w-4 h-4" />, moduleKey: 'leave', roles: ['super_admin', 'tenant_admin', 'admin'], isNew: true },
      { label: 'Leave Types', href: '/leave/types', icon: <FiLayers className="w-4 h-4" />, moduleKey: 'leave', roles: ['super_admin', 'tenant_admin', 'admin'] },

      // ── Reports ──
      { label: 'Reports', href: '#reports-divider', icon: <FiFileText className="w-3.5 h-3.5" />, moduleKey: 'leave', roles: ['super_admin', 'tenant_admin', 'admin', 'manager'], isDivider: true },
      { label: 'Leave Reports', href: '/leave/reports', icon: <FiFileText className="w-4 h-4" />, moduleKey: 'leave', roles: ['super_admin', 'tenant_admin', 'admin', 'manager'], isNew: true },
    ],
  },

  // ─── 5. ATTENDANCE MODULE ───
  // Employee: Apply Regularization, Apply WFH, Hourly Permission, Gatepass, Overtime, Comp-Off (self-service)
  // Manager: + Team view, Shifts, Holidays
  {
    key: 'attendance',
    label: 'Attendance',
    sectionIcon: FiClock,
    sectionColor: C.attendance,
    description: 'Attendance, time tracking & compliance',
    dashboardTabs: [
      { label: 'Overview', key: 'overview', icon: <FiGrid className="w-4 h-4" /> },
      { label: 'Settings', key: 'settings', icon: <FiSettings className="w-4 h-4" /> },
      { label: 'Reports', key: 'reports', icon: <FiFileText className="w-4 h-4" />, isNew: true },
    ],
    items: [
      // Self-service dashboard: visible to all
      { label: 'Attendance Dashboard', href: '/attendance', icon: <FiGrid className="w-4 h-4" />, moduleKey: 'attendance', roles: ['super_admin', 'tenant_admin', 'admin', 'manager', 'employee'], isNew: true },

      // ── Requests (self-service) ──
      { label: 'Requests', href: '#requests-divider', icon: <FiClock className="w-3.5 h-3.5" />, moduleKey: 'attendance', roles: ['super_admin', 'tenant_admin', 'admin', 'manager', 'employee'], isDivider: true },
      // HR-only: Apply attendance on behalf
      { label: 'Apply Attendance by HR', href: '/attendance/apply-by-hr', icon: <FiUserPlus className="w-4 h-4" />, moduleKey: 'attendance', roles: ['super_admin', 'tenant_admin', 'admin'], isNew: true },
      // Employee self-service: regularize attendance, WFH, permissions, gatepass, overtime
      { label: 'Apply Regularization', href: '/attendance/regularize', icon: <FiRefreshCw className="w-4 h-4" />, moduleKey: 'attendance', roles: ['super_admin', 'tenant_admin', 'admin', 'manager', 'employee'] },
      { label: 'Apply WFH', href: '/attendance/wfh', icon: <FiHome className="w-4 h-4" />, moduleKey: 'attendance', roles: ['super_admin', 'tenant_admin', 'admin', 'manager', 'employee'], isNew: true },
      { label: 'Hourly Permission', href: '/attendance/permission', icon: <FiClock className="w-4 h-4" />, moduleKey: 'attendance', roles: ['super_admin', 'tenant_admin', 'admin', 'manager', 'employee'] },
      { label: 'Gatepass', href: '/attendance/gatepass', icon: <FiShield className="w-4 h-4" />, moduleKey: 'attendance', roles: ['super_admin', 'tenant_admin', 'admin', 'manager', 'employee'] },
      { label: 'Overtime Requests', href: '/attendance/overtime', icon: <FiClock className="w-4 h-4" />, moduleKey: 'attendance', roles: ['super_admin', 'tenant_admin', 'admin', 'manager', 'employee'] },
      { label: 'Comp-Off Balance', href: '/attendance/comp-off', icon: <FiGift className="w-4 h-4" />, moduleKey: 'attendance', roles: ['super_admin', 'tenant_admin', 'admin', 'manager', 'employee'] },

      // ── Masters (admin/manager only) ──
      { label: 'Masters', href: '#masters-divider', icon: <FiDatabase className="w-3.5 h-3.5" />, moduleKey: 'attendance', roles: ['super_admin', 'tenant_admin', 'admin', 'manager'], isDivider: true },
      { label: 'Shifts', href: '/attendance/shifts', icon: <FiWatch className="w-4 h-4" />, moduleKey: 'attendance', roles: ['super_admin', 'tenant_admin', 'admin', 'manager'] },
      { label: 'Holiday Master', href: '/attendance/holidays', icon: <FiCalendar className="w-4 h-4" />, moduleKey: 'attendance', roles: ['super_admin', 'tenant_admin', 'admin', 'manager'] },

      // ── Configuration (admin only) ──
      { label: 'Configuration', href: '#config-divider', icon: <FiSettings className="w-3.5 h-3.5" />, moduleKey: 'attendance', roles: ['super_admin', 'tenant_admin', 'admin'], isDivider: true },
      { label: 'Geofences', href: '/attendance/geofence', icon: <FiMapPin className="w-4 h-4" />, moduleKey: 'attendance', roles: ['super_admin', 'tenant_admin', 'admin'] },
      { label: 'Biometric Devices', href: '/attendance/biometric', icon: <FiMonitor className="w-4 h-4" />, moduleKey: 'attendance', roles: ['super_admin', 'tenant_admin', 'admin'] },
      { label: 'Muster Roll', href: '/attendance/muster-roll', icon: <FiFileText className="w-4 h-4" />, moduleKey: 'attendance', roles: ['super_admin', 'tenant_admin', 'admin'], isNew: true },

      // ── Settings (admin only) ──
      { label: 'Settings', href: '#settings-divider', icon: <FiSettings className="w-3.5 h-3.5" />, moduleKey: 'attendance', roles: ['super_admin', 'tenant_admin', 'admin'], isDivider: true },
      { label: 'Attendance Policy & Settings', href: '/attendance/settings', icon: <FiFileText className="w-4 h-4" />, moduleKey: 'attendance', roles: ['super_admin', 'tenant_admin', 'admin'] },
      { label: 'Policy Rules', href: '/attendance/settings?tab=rules', icon: <FiSliders className="w-4 h-4" />, moduleKey: 'attendance', roles: ['super_admin', 'tenant_admin', 'admin'], isNew: true },

      // ── Reports (admin/manager only) ──
      { label: 'Reports', href: '#reports-divider', icon: <FiFileText className="w-3.5 h-3.5" />, moduleKey: 'attendance', roles: ['super_admin', 'tenant_admin', 'admin', 'manager'], isDivider: true },
      { label: 'Burnout Analytics', href: '/attendance/burnout', icon: <FiActivity className="w-4 h-4" />, moduleKey: 'attendance', roles: ['super_admin', 'tenant_admin', 'admin', 'manager'] },
      { label: 'Audit Trail', href: '/attendance/audit-log', icon: <FiLock className="w-4 h-4" />, moduleKey: 'attendance', roles: ['super_admin', 'tenant_admin', 'admin'] },
      { label: 'Attendance Reports', href: '/attendance/reports', icon: <FiFileText className="w-4 h-4" />, moduleKey: 'attendance', roles: ['super_admin', 'tenant_admin', 'admin', 'manager'], isNew: true },
    ],
  },

  // ─── 6. PAYROLL MODULE ───
  // Employee: Payslips (self-service), Tax Declaration
  // Manager: + Team Payslip view, Approvals
  {
    key: 'payroll',
    label: 'Payroll',
    sectionIcon: FiDollarSign,
    sectionColor: C.payroll,
    description: 'Compensation, compliance & processing',
    dashboardTabs: [
      { label: 'Overview', key: 'overview', icon: <FiGrid className="w-4 h-4" /> },
      { label: 'Reports', key: 'reports', icon: <FiFileText className="w-4 h-4" />, isNew: true },
      { label: 'Settings', key: 'settings', icon: <FiSettings className="w-4 h-4" />, isNew: true },
    ],
    items: [
      // Employee: My Payslips only (self-service)
      { label: 'My Payslips', href: '/payroll/payslips', icon: <FiFileText className="w-4 h-4" />, moduleKey: 'payroll', roles: ['super_admin', 'tenant_admin', 'admin', 'manager', 'employee'] },

      // Admin/Manager: Group dashboard
      { label: 'Group Dashboard', href: '/payroll/group-dashboard', icon: <FiGlobe className="w-4 h-4" />, moduleKey: 'payroll', roles: ['super_admin', 'tenant_admin', 'admin'], isNew: true },
      { label: 'Payroll Dashboard', href: '/payroll', icon: <FiGrid className="w-4 h-4" />, moduleKey: 'payroll', roles: ['super_admin', 'tenant_admin', 'admin'], isNew: true },

      // ── Payroll Masters (admin only) ──
      { label: 'Payroll Masters', href: '#masters-divider', icon: <FiDatabase className="w-3.5 h-3.5" />, moduleKey: 'payroll', roles: ['super_admin', 'tenant_admin', 'admin'], isDivider: true },
      { label: 'Salary Type Master', href: '/payroll/definitions', icon: <FiDatabase className="w-4 h-4" />, moduleKey: 'payroll', roles: ['super_admin', 'tenant_admin', 'admin'] },
      { label: 'Paycode Master', href: '/payroll/components', icon: <FiDatabase className="w-4 h-4" />, moduleKey: 'payroll', roles: ['super_admin', 'tenant_admin', 'admin'] },
      { label: 'Salary Structure Master', href: '/payroll/ctc-templates', icon: <FiLayers className="w-4 h-4" />, moduleKey: 'payroll', roles: ['super_admin', 'tenant_admin', 'admin'] },
      { label: 'Cost Center Master', href: '/payroll/dimensions', icon: <FiGrid className="w-4 h-4" />, moduleKey: 'payroll', roles: ['super_admin', 'tenant_admin', 'admin'] },
      { label: 'CTC Calculator', href: '/payroll/ctc-calculator', icon: <FiPercent className="w-4 h-4" />, moduleKey: 'payroll', roles: ['super_admin', 'tenant_admin', 'admin'] },
      { label: 'Statutory Components', href: '/payroll/statutory', icon: <FiShield className="w-4 h-4" />, moduleKey: 'payroll', roles: ['super_admin', 'tenant_admin', 'admin'] },
      { label: 'Income Tax Slabs', href: '/payroll/tax-slabs', icon: <FiBarChart2 className="w-4 h-4" />, moduleKey: 'payroll', roles: ['super_admin', 'tenant_admin', 'admin'] },
      { label: 'Gratuity', href: '/payroll/gratuity', icon: <FiDollarSign className="w-4 h-4" />, moduleKey: 'payroll', roles: ['super_admin', 'tenant_admin', 'admin'] },
      { label: 'Currency & FX', href: '/payroll/currency', icon: <FiGlobe className="w-4 h-4" />, moduleKey: 'payroll', roles: ['super_admin', 'tenant_admin', 'admin'] },

      // ── Payroll Transactions ──
      { label: 'Payroll Transactions', href: '#transactions-divider', icon: <FiEdit3 className="w-3.5 h-3.5" />, moduleKey: 'payroll', roles: ['super_admin', 'tenant_admin', 'admin', 'manager'], isDivider: true },
      { label: 'Employee Salary Type', href: '/payroll/salary-settings', icon: <FiEdit3 className="w-4 h-4" />, moduleKey: 'payroll', roles: ['super_admin', 'tenant_admin', 'admin'] },
      { label: 'Adhoc Transaction', href: '/payroll/inputs', icon: <FiEdit3 className="w-4 h-4" />, moduleKey: 'payroll', roles: ['super_admin', 'tenant_admin', 'admin', 'manager'] },
      { label: 'Advance Request', href: '/payroll/loans', icon: <FiDollarSign className="w-4 h-4" />, moduleKey: 'payroll', roles: ['super_admin', 'tenant_admin', 'admin', 'manager', 'employee'] },
      { label: 'Salary Arrears', href: '/payroll/holds', icon: <FiLock className="w-4 h-4" />, moduleKey: 'payroll', roles: ['super_admin', 'tenant_admin', 'admin'] },
      { label: 'Payroll Readiness', href: '/payroll/validations', icon: <FiCheckSquare className="w-4 h-4" />, moduleKey: 'payroll', roles: ['super_admin', 'tenant_admin', 'admin'] },
      { label: 'Payroll Processing', href: '/payroll/processing', icon: <FiPlayCircle className="w-4 h-4" />, moduleKey: 'payroll', roles: ['super_admin', 'tenant_admin', 'admin'] },
      { label: 'Payroll Authorization', href: '/payroll/approvals', icon: <FiUserCheck className="w-4 h-4" />, moduleKey: 'payroll', roles: ['super_admin', 'tenant_admin', 'admin', 'manager'] },
      { label: 'Overtime', href: '/payroll/overtime', icon: <FiActivity className="w-4 h-4" />, moduleKey: 'payroll', roles: ['super_admin', 'tenant_admin', 'admin', 'manager'] },
      { label: 'F&F Settlement', href: '/payroll/fnf', icon: <FiTruck className="w-4 h-4" />, moduleKey: 'payroll', roles: ['super_admin', 'tenant_admin', 'admin'] },
      { label: 'Bank File Generation', href: '/payroll/bank-files', icon: <FiFile className="w-4 h-4" />, moduleKey: 'payroll', roles: ['super_admin', 'tenant_admin', 'admin'] },
      { label: 'Cross-Border Secondment', href: '/payroll/secondment', icon: <FiGlobe className="w-4 h-4" />, moduleKey: 'payroll', roles: ['super_admin', 'tenant_admin', 'admin'], isNew: true },
      { label: 'AI Insights', href: '/payroll/ai-insights', icon: <FiCpu className="w-4 h-4" />, moduleKey: 'payroll', roles: ['super_admin', 'tenant_admin', 'admin'], isNew: true },

      // ── Reports (admin/manager only) ──
      { label: 'Payroll Reports', href: '#reports-divider', icon: <FiFileText className="w-3.5 h-3.5" />, moduleKey: 'payroll', roles: ['super_admin', 'tenant_admin', 'admin', 'manager'], isDivider: true },
      { label: 'Reports & Dashboard', href: '/payroll/reports', icon: <FiFileText className="w-4 h-4" />, moduleKey: 'payroll', roles: ['super_admin', 'tenant_admin', 'admin', 'manager'] },
    ],
  },

  // ─── 7. RECRUITMENT MODULE ───
  // Reports / Settings → dashboardTabs
  {
    key: 'recruitment',
    label: 'Recruitment',
    sectionIcon: FiUserPlus,
    sectionColor: C.recruitment,
    description: 'Talent acquisition & hiring pipeline',
    dashboardTabs: [
      { label: 'Overview', key: 'overview', icon: <FiGrid className="w-4 h-4" /> },
      { label: 'Reports', key: 'reports', icon: <FiFileText className="w-4 h-4" />, isNew: true },
      { label: 'Settings', key: 'settings', icon: <FiSettings className="w-4 h-4" />, isNew: true },
    ],
    items: [
      { label: 'Recruitment Dashboard', href: '/dashboards/recruitment', icon: <FiGrid className="w-4 h-4" />, moduleKey: 'recruitment', isNew: true },

      // ── Pipeline ──
      { label: 'Pipeline', href: '#pipeline-divider', icon: <FiBriefcase className="w-3.5 h-3.5" />, moduleKey: 'recruitment', isDivider: true },
      { label: 'Requisitions', href: '/requisitions', icon: <FiClipboard className="w-4 h-4" />, moduleKey: 'recruitment' },
      { label: 'Job Portal', href: '/job-portal', icon: <FiSearch className="w-4 h-4" />, moduleKey: 'recruitment' },
      { label: 'AI Interview', href: '/ai-interview', icon: <FiCpu className="w-4 h-4" />, moduleKey: 'recruitment' },
      { label: 'Referrals', href: '/referrals', icon: <FiUsers className="w-4 h-4" />, moduleKey: 'recruitment', isNew: true },
      { label: 'Offers', href: '/offers', icon: <FiStar className="w-4 h-4" />, moduleKey: 'recruitment' },

      // ── Analytics ──
      { label: 'Analytics', href: '#analytics-divider', icon: <FiBarChart2 className="w-3.5 h-3.5" />, moduleKey: 'recruitment', isDivider: true },
      { label: 'Candidate Flow', href: '/analytics/candidate-flow', icon: <FiBarChart2 className="w-4 h-4" />, moduleKey: 'recruitment', isNew: true },

      // ── Settings ──
      { label: 'Settings', href: '#settings-divider', icon: <FiSettings className="w-3.5 h-3.5" />, moduleKey: 'recruitment', isDivider: true },
      { label: 'Recruitment Settings', href: '/recruitment/settings', icon: <FiSettings className="w-4 h-4" />, moduleKey: 'recruitment', isNew: true },

      // ── Reports ──
      { label: 'Reports', href: '#reports-divider', icon: <FiFileText className="w-3.5 h-3.5" />, moduleKey: 'recruitment', isDivider: true },
      { label: 'Recruitment Reports', href: '/recruitment/reports', icon: <FiFileText className="w-4 h-4" />, moduleKey: 'recruitment', isNew: true },
    ],
  },

  // ─── 8. ONBOARDING MODULE ───
  // Reports / Settings → dashboardTabs
  {
    key: 'onboarding',
    label: 'Onboarding',
    sectionIcon: FiUserPlus,
    sectionColor: C.onboarding,
    description: 'New hire onboarding & induction',
    dashboardTabs: [
      { label: 'Overview', key: 'overview', icon: <FiGrid className="w-4 h-4" /> },
      { label: 'Reports', key: 'reports', icon: <FiFileText className="w-4 h-4" />, isNew: true },
      { label: 'Settings', key: 'settings', icon: <FiSettings className="w-4 h-4" />, isNew: true },
    ],
    items: [
      { label: 'Onboarding Dashboard', href: '/onboarding', icon: <FiGrid className="w-4 h-4" />, moduleKey: 'onboarding', isNew: true },

      // ── Tasks ──
      { label: 'Tasks', href: '#tasks-divider', icon: <FiCheckSquare className="w-3.5 h-3.5" />, moduleKey: 'onboarding', isDivider: true },
      { label: 'Onboarding Tasks', href: '/onboarding/tasks', icon: <FiCheckSquare className="w-4 h-4" />, moduleKey: 'onboarding', isNew: true },
      { label: 'Onboarding Templates', href: '/onboarding/templates', icon: <FiLayers className="w-4 h-4" />, moduleKey: 'onboarding', isNew: true },

      // ── Settings ──
      { label: 'Settings', href: '#settings-divider', icon: <FiSettings className="w-3.5 h-3.5" />, moduleKey: 'onboarding', isDivider: true },
      { label: 'Onboarding Settings', href: '/onboarding/settings', icon: <FiSettings className="w-4 h-4" />, moduleKey: 'onboarding', isNew: true },

      // ── Reports ──
      { label: 'Reports', href: '#reports-divider', icon: <FiFileText className="w-3.5 h-3.5" />, moduleKey: 'onboarding', isDivider: true },
      { label: 'Onboarding Reports', href: '/onboarding/reports', icon: <FiFileText className="w-4 h-4" />, moduleKey: 'onboarding', isNew: true },
    ],
  },

  // ─── 9. PREBOARDING MODULE ───
  // Reports → dashboardTabs
  {
    key: 'preboarding',
    label: 'Preboarding',
    sectionIcon: FiFileText,
    sectionColor: C.preboarding,
    description: 'Pre-hire preparation & documentation',
    dashboardTabs: [
      { label: 'Overview', key: 'overview', icon: <FiGrid className="w-4 h-4" /> },
      { label: 'Reports', key: 'reports', icon: <FiFileText className="w-4 h-4" />, isNew: true },
    ],
    items: [
      { label: 'Preboarding Dashboard', href: '/preboarding', icon: <FiGrid className="w-4 h-4" />, moduleKey: 'onboarding', isNew: true },
      { label: 'Preboarding Tasks', href: '/preboarding/tasks', icon: <FiCheckSquare className="w-4 h-4" />, moduleKey: 'onboarding', isNew: true },

      // ── Settings ──
      { label: 'Settings', href: '#settings-divider', icon: <FiSettings className="w-3.5 h-3.5" />, moduleKey: 'onboarding', isDivider: true },
      { label: 'Preboarding Settings', href: '/preboarding/settings', icon: <FiSettings className="w-4 h-4" />, moduleKey: 'onboarding', isNew: true },

      // ── Reports ──
      { label: 'Reports', href: '#reports-divider', icon: <FiFileText className="w-3.5 h-3.5" />, moduleKey: 'onboarding', isDivider: true },
      { label: 'Preboarding Reports', href: '/preboarding/reports', icon: <FiFileText className="w-4 h-4" />, moduleKey: 'onboarding', isNew: true },
    ],
  },

  // ─── 10. APPRAISAL / PERFORMANCE MODULE ───
  // Reports / Settings → dashboardTabs
  {
    key: 'appraisal',
    label: 'Appraisal & Performance',
    sectionIcon: FiTrendingUp,
    sectionColor: C.appraisal,
    description: 'Performance reviews & growth tracking',
    dashboardTabs: [
      { label: 'Overview', key: 'overview', icon: <FiGrid className="w-4 h-4" /> },
      { label: 'Reports', key: 'reports', icon: <FiFileText className="w-4 h-4" />, isNew: true },
      { label: 'Settings', key: 'settings', icon: <FiSettings className="w-4 h-4" />, isNew: true },
    ],
    items: [
      { label: 'Appraisal Dashboard', href: '/performance', icon: <FiGrid className="w-4 h-4" />, moduleKey: 'performance', isNew: true },

      // ── Performance ──
      { label: 'Performance', href: '#performance-divider', icon: <FiTrendingUp className="w-3.5 h-3.5" />, moduleKey: 'performance', isDivider: true },
      { label: 'Performance Reviews', href: '/performance/reviews', icon: <FiTrendingUp className="w-4 h-4" />, moduleKey: 'performance', isNew: true },
      { label: '360 Feedback', href: '/performance/feedback', icon: <FiMessageCircle className="w-4 h-4" />, moduleKey: 'performance', isNew: true },
      { label: 'OKR Cascade', href: '/okrs', icon: <FiTarget className="w-4 h-4" />, moduleKey: 'performance', isNew: true },

      // ── Growth ──
      { label: 'Growth', href: '#growth-divider', icon: <FiAward className="w-3.5 h-3.5" />, moduleKey: 'performance', isDivider: true },
      { label: 'Training', href: '/training', icon: <FiBookOpen className="w-4 h-4" />, moduleKey: 'training' },
      { label: 'Engagement', href: '/engagement', icon: <FiHeart className="w-4 h-4" />, moduleKey: 'engagement', isNew: true },
      { label: 'Succession Planning', href: '/succession', icon: <FiTarget className="w-4 h-4" />, roles: ['super_admin', 'tenant_admin', 'admin'], isNew: true },

      // ── Settings ──
      { label: 'Settings', href: '#settings-divider', icon: <FiSettings className="w-3.5 h-3.5" />, moduleKey: 'performance', isDivider: true },
      { label: 'Performance Settings', href: '/performance/settings', icon: <FiSettings className="w-4 h-4" />, moduleKey: 'performance', isNew: true },

      // ── Reports ──
      { label: 'Reports', href: '#reports-divider', icon: <FiFileText className="w-3.5 h-3.5" />, moduleKey: 'performance', isDivider: true },
      { label: 'Performance Reports', href: '/performance/reports', icon: <FiFileText className="w-4 h-4" />, moduleKey: 'performance', isNew: true },
    ],
  },

  // ─── 11. PROJECT MANAGEMENT MODULE (includes Timesheet) ───
  // Reports / Settings → dashboardTabs
  {
    key: 'project',
    label: 'Project Management',
    sectionIcon: FiFolder,
    sectionColor: C.project,
    description: 'Projects, tasks & time tracking',
    dashboardTabs: [
      { label: 'Overview', key: 'overview', icon: <FiGrid className="w-4 h-4" /> },
      { label: 'Reports', key: 'reports', icon: <FiFileText className="w-4 h-4" />, isNew: true },
      { label: 'Settings', key: 'settings', icon: <FiSettings className="w-4 h-4" />, isNew: true },
    ],
    items: [
      { label: 'PM Dashboard', href: '/project-management', icon: <FiGrid className="w-4 h-4" />, moduleKey: 'projects', isNew: true },

      // ── Management ──
      { label: 'Management', href: '#mgmt-divider', icon: <FiFolder className="w-3.5 h-3.5" />, moduleKey: 'projects', isDivider: true },
      { label: 'Projects', href: '/projects', icon: <FiFolder className="w-4 h-4" />, moduleKey: 'projects' },
      { label: 'Timesheets', href: '/timesheets', icon: <FiWatch className="w-4 h-4" />, moduleKey: 'attendance' },
      { label: 'Utilization', href: '/projects/utilization', icon: <FiTrendingUp className="w-4 h-4" />, isNew: true },

      // ── Settings ──
      { label: 'Settings', href: '#settings-divider', icon: <FiSettings className="w-3.5 h-3.5" />, moduleKey: 'projects', isDivider: true },
      { label: 'Project Settings', href: '/project-management/settings', icon: <FiSettings className="w-4 h-4" />, moduleKey: 'projects', isNew: true },

      // ── Reports ──
      { label: 'Reports', href: '#reports-divider', icon: <FiFileText className="w-3.5 h-3.5" />, moduleKey: 'projects', isDivider: true },
      { label: 'Project Reports', href: '/project-management/reports', icon: <FiFileText className="w-4 h-4" />, moduleKey: 'projects', isNew: true },
    ],
  },

  // ─── 12. TRAVEL & EXPENSE MANAGEMENT ───
  // Reports / Settings → dashboardTabs
  {
    key: 'travel-expense',
    label: 'Travel & Expense',
    sectionIcon: FiMap,
    sectionColor: C.travel,
    description: 'Travel requests & expense claims',
    dashboardTabs: [
      { label: 'Overview', key: 'overview', icon: <FiGrid className="w-4 h-4" /> },
      { label: 'Reports', key: 'reports', icon: <FiFileText className="w-4 h-4" />, isNew: true },
      { label: 'Settings', key: 'settings', icon: <FiSettings className="w-4 h-4" />, isNew: true },
    ],
    items: [
      { label: 'Travel & Expense Dashboard', href: '/travel', icon: <FiGrid className="w-4 h-4" />, moduleKey: 'travel', isNew: true },

      // ── Travel ──
      { label: 'Travel', href: '#travel-divider', icon: <FiMap className="w-3.5 h-3.5" />, moduleKey: 'travel', isDivider: true },
      { label: 'Travel Requests', href: '/travel/requests', icon: <FiMap className="w-4 h-4" />, moduleKey: 'travel', isNew: true },

      // ── Expense ──
      { label: 'Expense', href: '#expense-divider', icon: <FiCreditCard className="w-3.5 h-3.5" />, moduleKey: 'expenses', isDivider: true },
      { label: 'Expense Claims', href: '/expenses', icon: <FiCreditCard className="w-4 h-4" />, moduleKey: 'expenses' },

      // ── Settings ──
      { label: 'Settings', href: '#settings-divider', icon: <FiSettings className="w-3.5 h-3.5" />, moduleKey: 'travel', isDivider: true },
      { label: 'Travel Policy', href: '/travel/travel-policy', icon: <FiFileText className="w-4 h-4" />, moduleKey: 'travel' },
      { label: 'Travel & Expense Settings', href: '/travel/settings', icon: <FiSettings className="w-4 h-4" />, moduleKey: 'travel', isNew: true },

      // ── Reports ──
      { label: 'Reports', href: '#reports-divider', icon: <FiFileText className="w-3.5 h-3.5" />, moduleKey: 'travel', isDivider: true },
      { label: 'Travel & Expense Reports', href: '/travel/reports', icon: <FiFileText className="w-4 h-4" />, moduleKey: 'travel', isNew: true },
    ],
  },

  // ─── 13. ASSETS & IT MODULE ───
  // Reports / Settings → dashboardTabs
  {
    key: 'assets',
    label: 'Assets & IT',
    sectionIcon: FiPackage,
    sectionColor: C.assets,
    description: 'Asset management & IT administration',
    dashboardTabs: [
      { label: 'Overview', key: 'overview', icon: <FiGrid className="w-4 h-4" /> },
      { label: 'Reports', key: 'reports', icon: <FiFileText className="w-4 h-4" />, isNew: true },
      { label: 'Settings', key: 'settings', icon: <FiSettings className="w-4 h-4" />, isNew: true },
    ],
    items: [
      { label: 'Asset Dashboard', href: '/assets', icon: <FiGrid className="w-4 h-4" />, moduleKey: 'assets', isNew: true },

      // ── Assets ──
      { label: 'Assets', href: '#assets-divider', icon: <FiPackage className="w-3.5 h-3.5" />, moduleKey: 'assets', isDivider: true },
      { label: 'Assets', href: '/assets/list', icon: <FiPackage className="w-4 h-4" />, moduleKey: 'assets' },

      // ── IT Admin ──
      { label: 'IT Admin', href: '#itadmin-divider', icon: <FiMonitor className="w-3.5 h-3.5" />, moduleKey: 'it_admin_module', isDivider: true },
      { label: 'IT Admin Console', href: '/it-admin', icon: <FiMonitor className="w-4 h-4" />, moduleKey: 'it_admin_module', isNew: true },
      { label: 'Devices', href: '/it-admin/devices', icon: <FiMonitor className="w-4 h-4" />, moduleKey: 'it_admin_module', isNew: true },
      { label: 'Network', href: '/it-admin/network', icon: <FiGlobe className="w-4 h-4" />, moduleKey: 'it_admin_module', isNew: true },
      { label: 'Security', href: '/it-admin/security', icon: <FiShield className="w-4 h-4" />, moduleKey: 'it_admin_module', isNew: true },
      { label: 'Software', href: '/it-admin/software', icon: <FiPackage className="w-4 h-4" />, moduleKey: 'it_admin_module', isNew: true },
      { label: 'IT Tickets', href: '/it-admin/tickets', icon: <FiHelpCircle className="w-4 h-4" />, moduleKey: 'it_admin_module', isNew: true },

      // ── Settings ──
      { label: 'Settings', href: '#settings-divider', icon: <FiSettings className="w-3.5 h-3.5" />, moduleKey: 'assets', isDivider: true },
      { label: 'Asset Settings', href: '/assets/settings', icon: <FiSettings className="w-4 h-4" />, moduleKey: 'assets', isNew: true },

      // ── Reports ──
      { label: 'Reports', href: '#reports-divider', icon: <FiFileText className="w-3.5 h-3.5" />, moduleKey: 'assets', isDivider: true },
      { label: 'Asset Reports', href: '/assets/reports', icon: <FiFileText className="w-4 h-4" />, moduleKey: 'assets', isNew: true },
    ],
  },

  // ─── 14a. ACCOUNTS & FINANCE MODULE ───
  {
    key: 'accounts',
    label: 'Accounts & Finance',
    sectionIcon: FiCreditCard,
    sectionColor: C.accounts,
    description: 'Accounting, invoicing & financial operations',
    dashboardTabs: [
      { label: 'Overview', key: 'overview', icon: <FiGrid className="w-4 h-4" /> },
      { label: 'Reports', key: 'reports', icon: <FiFileText className="w-4 h-4" />, isNew: true },
    ],
    items: [
      { label: 'Accounts Dashboard', href: '/accounts', icon: <FiGrid className="w-4 h-4" />, isNew: true },

      // ── Accounting ──
      { label: 'Accounting', href: '#accounting-divider', icon: <FiLayers className="w-3.5 h-3.5" />, isDivider: true },
      { label: 'Chart of Accounts', href: '/accounts/chart-of-accounts', icon: <FiLayers className="w-4 h-4" />, isNew: true },
      { label: 'Journal Entries', href: '/accounts/journal-entries', icon: <FiEdit3 className="w-4 h-4" />, isNew: true },

      // ── Payables & Receivables ──
      { label: 'Payables & Receivables', href: '#payables-divider', icon: <FiDollarSign className="w-3.5 h-3.5" />, isDivider: true },
      { label: 'Invoices', href: '/accounts/invoices', icon: <FiFileText className="w-4 h-4" />, isNew: true },
      { label: 'Bills', href: '/accounts/bills', icon: <FiDollarSign className="w-4 h-4" />, isNew: true },

      // ── Banking ──
      { label: 'Banking', href: '#banking-divider', icon: <FiCreditCard className="w-3.5 h-3.5" />, isDivider: true },
      { label: 'Bank Reconciliation', href: '/accounts/bank-reconciliation', icon: <FiCreditCard className="w-4 h-4" />, isNew: true },

      // ── Settings ──
      { label: 'Settings', href: '#settings-divider', icon: <FiSettings className="w-3.5 h-3.5" />, isDivider: true },
      { label: 'Accounts Settings', href: '/accounts/settings', icon: <FiSettings className="w-4 h-4" />, isNew: true },

      // ── Reports ──
      { label: 'Reports', href: '#reports-divider', icon: <FiFileText className="w-3.5 h-3.5" />, isDivider: true },
      { label: 'Financial Reports', href: '/accounts/reports', icon: <FiFileText className="w-4 h-4" />, isNew: true },
    ],
  },

  // ─── 14. CRM & SALES MODULE ───
  // Reports / Settings → dashboardTabs
  {
    key: 'crm',
    label: 'CRM & Sales',
    sectionIcon: FiTarget,
    sectionColor: C.crm,
    description: 'Customer relationships & sales pipeline',
    dashboardTabs: [
      { label: 'Overview', key: 'overview', icon: <FiGrid className="w-4 h-4" /> },
      { label: 'Reports', key: 'reports', icon: <FiFileText className="w-4 h-4" />, isNew: true },
      { label: 'Settings', key: 'settings', icon: <FiSettings className="w-4 h-4" />, isNew: true },
    ],
    items: [
      { label: 'CRM Dashboard', href: '/crm', icon: <FiGrid className="w-4 h-4" />, moduleKey: 'crm', isNew: true },

      // ── Pipeline ──
      { label: 'Pipeline', href: '#pipeline-divider', icon: <FiTarget className="w-3.5 h-3.5" />, moduleKey: 'crm', isDivider: true },
      { label: 'Leads', href: '/crm/leads', icon: <FiUserPlus className="w-4 h-4" />, moduleKey: 'crm', isNew: true },
      { label: 'Contacts', href: '/crm/contacts', icon: <FiUsers className="w-4 h-4" />, moduleKey: 'crm', isNew: true },
      { label: 'Deals', href: '/crm/deals', icon: <FiBriefcase className="w-4 h-4" />, moduleKey: 'crm', isNew: true },
      { label: 'Activities', href: '/crm/activities', icon: <FiActivity className="w-4 h-4" />, moduleKey: 'crm', isNew: true },

      // ── Settings ──
      { label: 'Settings', href: '#settings-divider', icon: <FiSettings className="w-3.5 h-3.5" />, moduleKey: 'crm', isDivider: true },
      { label: 'CRM Settings', href: '/crm/settings', icon: <FiSettings className="w-4 h-4" />, moduleKey: 'crm', isNew: true },

      // ── Reports ──
      { label: 'Reports', href: '#reports-divider', icon: <FiFileText className="w-3.5 h-3.5" />, moduleKey: 'crm', isDivider: true },
      { label: 'CRM Reports', href: '/crm/reports', icon: <FiFileText className="w-4 h-4" />, moduleKey: 'crm', isNew: true },
    ],
  },

  // ─── 15. EXTERNAL RELATIONS MODULE ───
  // Reports → dashboardTabs
  {
    key: 'external',
    label: 'External Relations',
    sectionIcon: FiGlobe,
    sectionColor: C.external,
    description: 'Clients, vendors & procurement',
    dashboardTabs: [
      { label: 'Overview', key: 'overview', icon: <FiGrid className="w-4 h-4" /> },
      { label: 'Reports', key: 'reports', icon: <FiFileText className="w-4 h-4" />, isNew: true },
    ],
    items: [
      { label: 'External Dashboard', href: '/clients', icon: <FiGrid className="w-4 h-4" />, moduleKey: 'company', isNew: true },

      // ── Clients ──
      { label: 'Clients', href: '#clients-divider', icon: <FiGlobe className="w-3.5 h-3.5" />, moduleKey: 'company', isDivider: true },
      { label: 'Clients', href: '/clients/list', icon: <FiGlobe className="w-4 h-4" />, moduleKey: 'company' },
      { label: 'SOWs', href: '/clients/sow', icon: <FiFileText className="w-4 h-4" />, moduleKey: 'company', isNew: true },
      { label: 'Client Insights', href: '/clients/insights', icon: <FiTrendingUp className="w-4 h-4" />, moduleKey: 'company', isNew: true },

      // ── Vendors ──
      { label: 'Vendors', href: '#vendors-divider', icon: <FiTruck className="w-3.5 h-3.5" />, moduleKey: 'company', isDivider: true },
      { label: 'Vendors', href: '/vendors', icon: <FiTruck className="w-4 h-4" />, moduleKey: 'company' },
      { label: 'Vendor Compliance', href: '/vendors/compliance', icon: <FiShield className="w-4 h-4" />, moduleKey: 'company', isNew: true },
      { label: 'Purchase Orders', href: '/purchase-orders', icon: <FiCreditCard className="w-4 h-4" />, moduleKey: 'company', isNew: true },
      { label: 'Vendor Invoices', href: '/vendor-invoices', icon: <FiDollarSign className="w-4 h-4" />, moduleKey: 'company', isNew: true },

      // ── Settings ──
      { label: 'Settings', href: '#settings-divider', icon: <FiSettings className="w-3.5 h-3.5" />, moduleKey: 'company', isDivider: true },
      { label: 'External Settings', href: '/clients/settings', icon: <FiSettings className="w-4 h-4" />, moduleKey: 'company', isNew: true },

      // ── Reports ──
      { label: 'Reports', href: '#reports-divider', icon: <FiFileText className="w-3.5 h-3.5" />, moduleKey: 'company', isDivider: true },
      { label: 'External Reports', href: '/clients/reports', icon: <FiFileText className="w-4 h-4" />, moduleKey: 'company', isNew: true },
    ],
  },

  // ─── 16. MARKETPLACE & WELLNESS MODULE ───
  {
    key: 'marketplace',
    label: 'Marketplace & Wellness',
    sectionIcon: FiShoppingBag,
    sectionColor: C.marketplace,
    description: 'Benefits, perks & financial wellness',
    dashboardTabs: [
      { label: 'Overview', key: 'overview', icon: <FiGrid className="w-4 h-4" /> },
      { label: 'Reports', key: 'reports', icon: <FiFileText className="w-4 h-4" />, isNew: true },
    ],
    items: [
      { label: 'Marketplace Hub', href: '/marketplace', icon: <FiGrid className="w-4 h-4" />, isNew: true },
      { label: 'My Wallet', href: '/marketplace/wallet', icon: <FiCreditCard className="w-4 h-4" />, isNew: true },
      { label: 'Corporate Catalog', href: '/marketplace/catalog', icon: <FiShoppingCart className="w-4 h-4" />, isNew: true },
      { label: 'Insurance Top-Up', href: '/marketplace/insurance', icon: <FiShield className="w-4 h-4" />, isNew: true },
      { label: 'Earned Wage Access', href: '/marketplace/ewa', icon: <FiDollarSign className="w-4 h-4" />, isNew: true },
      { label: 'Loan Marketplace', href: '/marketplace/loans', icon: <FiBriefcase className="w-4 h-4" />, isNew: true },
      { label: 'Gifting & Rewards', href: '/marketplace/gifting', icon: <FiGift className="w-4 h-4" />, isNew: true },
      { label: 'AI Insights', href: '/marketplace/insights', icon: <FiTrendingUp className="w-4 h-4" />, isNew: true },
    ],
  },

  // ─── 17. SUPPORT & AI MODULE ───
  // Reports → dashboardTabs
  {
    key: 'support',
    label: 'Support & AI',
    sectionIcon: FiHelpCircle,
    sectionColor: C.support,
    description: 'Helpdesk, AI assistant & grievance handling',
    dashboardTabs: [
      { label: 'Overview', key: 'overview', icon: <FiGrid className="w-4 h-4" /> },
      { label: 'Reports', key: 'reports', icon: <FiFileText className="w-4 h-4" />, isNew: true },
    ],
    items: [
      { label: 'Support Dashboard', href: '/helpdesk', icon: <FiGrid className="w-4 h-4" />, moduleKey: 'helpdesk', isNew: true },
      { label: 'Helpdesk', href: '/helpdesk/tickets', icon: <FiHelpCircle className="w-4 h-4" />, moduleKey: 'helpdesk' },
      { label: 'Grievances', href: '/grievances', icon: <FiAlertCircle className="w-4 h-4" />, moduleKey: 'grievances' },
      { label: 'AI Assistant', href: '/ai-assistant', icon: <FiCpu className="w-4 h-4" /> },

      // ── Settings ──
      { label: 'Settings', href: '#settings-divider', icon: <FiSettings className="w-3.5 h-3.5" />, moduleKey: 'helpdesk', isDivider: true },
      { label: 'Support Settings', href: '/helpdesk/settings', icon: <FiSettings className="w-4 h-4" />, moduleKey: 'helpdesk', isNew: true },

      // ── Reports ──
      { label: 'Reports', href: '#reports-divider', icon: <FiFileText className="w-3.5 h-3.5" />, moduleKey: 'helpdesk', isDivider: true },
      { label: 'Support Reports', href: '/helpdesk/reports', icon: <FiFileText className="w-4 h-4" />, moduleKey: 'helpdesk', isNew: true },
    ],
  },

  // ─── 18. COLLABORATION MODULE ───
  {
    key: 'collaboration',
    label: 'Collaboration',
    sectionIcon: FiMessageCircle,
    sectionColor: C.collaboration,
    description: 'Communication, chat & file sharing',
    dashboardTabs: [
      { label: 'Overview', key: 'overview', icon: <FiGrid className="w-4 h-4" /> },
    ],
    items: [
      { label: 'Collaboration Hub', href: '/collaboration', icon: <FiGrid className="w-4 h-4" />, isNew: true },

      // ── Communication ──
      { label: 'Communication', href: '#comm-divider', icon: <FiMessageCircle className="w-3.5 h-3.5" />, isDivider: true },
      { label: 'Chat', href: '/collaboration/chat', icon: <FiMessageCircle className="w-4 h-4" />, isNew: true },
      { label: 'Calls', href: '/collaboration/calls', icon: <FiVideo className="w-4 h-4" />, isNew: true },
      { label: 'Calendar', href: '/calendar', icon: <FiCalendar className="w-4 h-4" />, isNew: true },
      { label: 'Email', href: '/email', icon: <FiMail className="w-4 h-4" />, isNew: true },

      // ── Productivity ──
      { label: 'Productivity', href: '#productivity-divider', icon: <FiCheckSquare className="w-3.5 h-3.5" />, isDivider: true },
      { label: 'To Do', href: '/todo', icon: <FiCheckSquare className="w-4 h-4" />, isNew: true },
      { label: 'Notes', href: '/notes', icon: <FiEdit3 className="w-4 h-4" />, isNew: true },
      { label: 'Social Feed', href: '/social-feed', icon: <FiUsers className="w-4 h-4" />, isNew: true },
      { label: 'File Manager', href: '/file-manager', icon: <FiFolder className="w-4 h-4" />, isNew: true },
      { label: 'Kanban Board', href: '/kanban', icon: <FiLayers className="w-4 h-4" />, isNew: true },

      // ── Settings ──
      { label: 'Settings', href: '#settings-divider', icon: <FiSettings className="w-3.5 h-3.5" />, isDivider: true },
      { label: 'Collaboration Settings', href: '/collaboration/settings', icon: <FiSettings className="w-4 h-4" />, isNew: true },
      { label: 'SMTP Email Config', href: '/settings?tab=smtp', icon: <FiMail className="w-4 h-4" />, isNew: true },

      // ── Reports ──
      { label: 'Reports', href: '#reports-divider', icon: <FiFileText className="w-3.5 h-3.5" />, isDivider: true },
      { label: 'Collaboration Reports', href: '/collaboration/reports', icon: <FiFileText className="w-4 h-4" />, isNew: true },
    ],
  },

  // ─── 19. KNOWLEDGE BASE MODULE ───
  {
    key: 'knowledge',
    label: 'Knowledge Base',
    sectionIcon: FiBookOpen,
    sectionColor: C.knowledge,
    description: 'Documentation & knowledge management',
    dashboardTabs: [
      { label: 'Overview', key: 'overview', icon: <FiGrid className="w-4 h-4" /> },
    ],
    items: [
      { label: 'Documentation Hub', href: '/docs', icon: <FiBookOpen className="w-4 h-4" />, moduleKey: 'docs', isNew: true },

      // ── Settings ──
      { label: 'Settings', href: '#settings-divider', icon: <FiSettings className="w-3.5 h-3.5" />, moduleKey: 'docs', isDivider: true },
      { label: 'Knowledge Settings', href: '/docs/settings', icon: <FiSettings className="w-4 h-4" />, moduleKey: 'docs', isNew: true },

      // ── Reports ──
      { label: 'Reports', href: '#reports-divider', icon: <FiFileText className="w-3.5 h-3.5" />, moduleKey: 'docs', isDivider: true },
      { label: 'Knowledge Reports', href: '/docs/reports', icon: <FiFileText className="w-4 h-4" />, moduleKey: 'docs', isNew: true },
    ],
  },

  // ─── 20. GOVERNANCE MODULE ───
  {
    key: 'governance',
    label: 'Governance',
    sectionIcon: FiSettings,
    sectionColor: C.governance,
    description: 'Workflows, analytics & system configuration',
    dashboardTabs: [
      { label: 'Overview', key: 'overview', icon: <FiGrid className="w-4 h-4" /> },
      { label: 'AI Insights', key: 'ai-insights', icon: <FiCpu className="w-4 h-4" />, isNew: true },
    ],
    items: [
      { label: 'Governance Dashboard', href: '/governance', icon: <FiGrid className="w-4 h-4" />, moduleKey: 'governance', isNew: true },

      // ── Workflows ──
      { label: 'Workflows', href: '#workflows-divider', icon: <FiGitBranch className="w-3.5 h-3.5" />, moduleKey: 'settings', isDivider: true },
      { label: 'Workflows', href: '/workflows', icon: <FiGitBranch className="w-4 h-4" />, moduleKey: 'settings' },
      { label: 'Scheduled Reports', href: '/reports/schedules', icon: <FiClock className="w-4 h-4" />, isNew: true },
      { label: 'Notifications', href: '/notifications', icon: <FiBell className="w-4 h-4" /> },

      // ── Analytics ──
      { label: 'Analytics', href: '#analytics-divider', icon: <FiBarChart2 className="w-3.5 h-3.5" />, moduleKey: 'reports', isDivider: true },
      { label: 'Reports & Analytics', href: '/reports', icon: <FiBarChart2 className="w-4 h-4" />, moduleKey: 'reports' },

      // ── Settings ──
      { label: 'Settings', href: '#settings-divider', icon: <FiSettings className="w-3.5 h-3.5" />, moduleKey: 'settings', isDivider: true },
      { label: 'Settings & Configuration', href: '/settings', icon: <FiSettings className="w-4 h-4" />, moduleKey: 'settings' },

      // ── Reports ──
      { label: 'Reports', href: '#reports-divider', icon: <FiFileText className="w-3.5 h-3.5" />, moduleKey: 'governance', isDivider: true },
      { label: 'Governance Reports', href: '/governance/reports', icon: <FiFileText className="w-4 h-4" />, moduleKey: 'governance', isNew: true },
    ],
  },
];

// ─── Pinned items always visible at the top of the sidebar ───
export const PINNED_ITEMS: NavItem[] = [
  { label: 'Home', href: '/home', icon: <FiHome className="w-5 h-5" />, roles: ['super_admin', 'tenant_admin', 'admin', 'manager', 'employee'] },
  { label: 'Dashboard', href: '/dashboard', icon: <FiGrid className="w-5 h-5" />, moduleKey: 'dashboard' },
  { label: 'Modules', href: '/modules', icon: <FiGrid className="w-5 h-5" />, roles: ['super_admin', 'tenant_admin', 'admin', 'manager', 'employee'] },
];

// Routes where no module is auto-selected in the sidebar
export const PICKER_ROUTES = ['/', '/home', '/dashboard', '/dashboards', '/modules'];

// ─── Module groups for the Modules page ───
export const MODULE_GROUPS: ModuleGroup[] = [
  {
    groupLabel: 'Administration',
    groupDescription: 'Platform & tenant management',
    groupIcon: FiShield,
    sections: navSections.filter(s => ['super-admin', 'tenant'].includes(s.key)),
  },
  {
    groupLabel: 'Organization',
    groupDescription: 'Company & workforce management',
    groupIcon: FiBriefcase,
    sections: navSections.filter(s => ['company', 'employee'].includes(s.key)),
  },
  {
    groupLabel: 'Time & Leave',
    groupDescription: 'Attendance, leave & time tracking',
    groupIcon: FiClock,
    sections: navSections.filter(s => ['attendance', 'leave'].includes(s.key)),
  },
  {
    groupLabel: 'Compensation',
    groupDescription: 'Payroll, appraisal & performance',
    groupIcon: FiDollarSign,
    sections: navSections.filter(s => ['payroll', 'appraisal'].includes(s.key)),
  },
  {
    groupLabel: 'Talent',
    groupDescription: 'Recruitment, onboarding & preboarding',
    groupIcon: FiUserPlus,
    sections: navSections.filter(s => ['recruitment', 'onboarding', 'preboarding'].includes(s.key)),
  },
  {
    groupLabel: 'Operations',
    groupDescription: 'Projects, travel, expenses & assets',
    groupIcon: FiFolder,
    sections: navSections.filter(s => ['project', 'travel-expense', 'assets', 'accounts'].includes(s.key)),
  },
  {
    groupLabel: 'Business',
    groupDescription: 'CRM, sales & external relations',
    groupIcon: FiTarget,
    sections: navSections.filter(s => ['crm', 'external', 'marketplace'].includes(s.key)),
  },
  {
    groupLabel: 'Support & Intelligence',
    groupDescription: 'Helpdesk, AI, collaboration & knowledge',
    groupIcon: FiHelpCircle,
    sections: navSections.filter(s => ['support', 'collaboration', 'knowledge'].includes(s.key)),
  },
  {
    groupLabel: 'Governance',
    groupDescription: 'Workflows, reports & system settings',
    groupIcon: FiSettings,
    sections: navSections.filter(s => ['governance'].includes(s.key)),
  },
];
