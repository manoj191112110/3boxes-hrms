'use client';

import { useMemo } from 'react';
import {
  FiUsers, FiBriefcase, FiUserPlus, FiClock, FiCalendar,
  FiDollarSign, FiTrendingUp, FiFolder, FiPackage,
  FiGlobe, FiHelpCircle, FiMessageCircle, FiBookOpen,
  FiSettings, FiShield, FiServer, FiWatch, FiTarget,
  FiShoppingBag,
} from 'react-icons/fi';
import { useAuthStore } from '@/store/authStore';
import { canRoleAccessModule, LEGACY_ROLE_MAP } from '@/lib/roleAccess';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  roles?: string[];
  moduleKey?: string;
  isNew?: boolean;
}

interface NavSection {
  key: string;
  label: string;
  sectionIcon: React.ComponentType<{ className?: string }>;
  items: NavItem[];
}

interface ModuleGroup {
  groupLabel: string;
  sections: NavSection[];
}

// Same navSections as Sidebar — kept in sync
const navSections: NavSection[] = [
  {
    key: 'super-admin',
    sectionIcon: FiShield,
    label: 'Super Admin',
    items: [
      { label: 'Dashboard', href: '/super-admin', icon: <FiShield className="w-5 h-5" />, roles: ['super_admin'] },
      { label: 'Companies', href: '/super-admin', icon: <FiBriefcase className="w-5 h-5" />, roles: ['super_admin'] },
      { label: 'Subscriptions', href: '/super-admin/subscriptions', icon: <FiDollarSign className="w-5 h-5" />, roles: ['super_admin'], isNew: true },
      { label: 'Packages', href: '/super-admin/packages', icon: <FiPackage className="w-5 h-5" />, roles: ['super_admin'], isNew: true },
      { label: 'Domain', href: '/super-admin/domain', icon: <FiGlobe className="w-5 h-5" />, roles: ['super_admin'], isNew: true },
      { label: 'Purchase Transaction', href: '/super-admin/purchase-transactions', icon: <FiDollarSign className="w-5 h-5" />, roles: ['super_admin'], isNew: true },
      { label: 'Tenant Usage', href: '/super-admin/tenant-usage', icon: <FiTrendingUp className="w-5 h-5" />, roles: ['super_admin'], isNew: true },
      { label: 'Tenant Tickets', href: '/super-admin/tenant-tickets', icon: <FiHelpCircle className="w-5 h-5" />, roles: ['super_admin'], isNew: true },
      { label: 'Tickets', href: '/super-admin/tickets', icon: <FiHelpCircle className="w-5 h-5" />, roles: ['super_admin'] },
      { label: 'Feature Flags', href: '/super-admin/feature-flags', icon: <FiSettings className="w-5 h-5" />, roles: ['super_admin'], isNew: true },
      { label: 'Storage Quotas', href: '/super-admin/storage-quotas', icon: <FiPackage className="w-5 h-5" />, roles: ['super_admin'], isNew: true },
      { label: 'SSO Providers', href: '/super-admin/sso-providers', icon: <FiShield className="w-5 h-5" />, roles: ['super_admin'], isNew: true },
      { label: 'Collaboration Features', href: '/super-admin/collab-features', icon: <FiMessageCircle className="w-5 h-5" />, roles: ['super_admin'], isNew: true },
      { label: 'Audit Logs', href: '/super-admin/audit-logs', icon: <FiShield className="w-5 h-5" />, roles: ['super_admin'], isNew: true },
      { label: 'Trial Requests', href: '/super-admin/trial-requests', icon: <FiBriefcase className="w-5 h-5" />, roles: ['super_admin'], isNew: true },
      { label: 'RBAC Management', href: '/super-admin/rbac', icon: <FiShield className="w-5 h-5" />, roles: ['super_admin'] },
      { label: 'AI Admin Console', href: '/ai-admin', icon: <FiSettings className="w-5 h-5" />, roles: ['super_admin'], isNew: true },
    ],
  },
  {
    key: 'tenant-admin',
    sectionIcon: FiServer,
    label: 'Tenant Admin',
    items: [
      { label: 'Admin Dashboard', href: '/dashboards/admin', icon: <FiServer className="w-5 h-5" />, roles: ['tenant_admin'], isNew: true },
      { label: 'Tenant Console', href: '/tenant-admin', icon: <FiServer className="w-5 h-5" />, roles: ['tenant_admin'], isNew: true },
      { label: 'Sub-Companies', href: '/tenant-admin/companies', icon: <FiBriefcase className="w-5 h-5" />, roles: ['tenant_admin'], isNew: true },
      { label: 'Group Companies', href: '/tenant-admin/group-companies', icon: <FiFolder className="w-5 h-5" />, roles: ['tenant_admin'], isNew: true },
      { label: 'Company RBAC', href: '/tenant-admin/rbac', icon: <FiShield className="w-5 h-5" />, roles: ['tenant_admin'], isNew: true },
      { label: 'Profile Config', href: '/tenant-admin/profile-config', icon: <FiSettings className="w-5 h-5" />, roles: ['tenant_admin'], isNew: true },
      { label: 'Storage Analytics', href: '/tenant-admin/storage-analytics', icon: <FiPackage className="w-5 h-5" />, roles: ['tenant_admin'], isNew: true },
      { label: 'Comm Governance', href: '/tenant-admin/comm-governance', icon: <FiMessageCircle className="w-5 h-5" />, roles: ['tenant_admin'], isNew: true },
      { label: 'AI Admin Console', href: '/ai-admin', icon: <FiSettings className="w-5 h-5" />, roles: ['tenant_admin'], isNew: true },
    ],
  },
  {
    key: 'core-hr',
    label: 'Core HR',
    sectionIcon: FiUsers,
    items: [
      { label: 'HR Dashboard', href: '/dashboards/hr', icon: <FiUsers className="w-5 h-5" />, isNew: true },
      { label: 'My Profile', href: '/my-profile', icon: <FiUsers className="w-5 h-5" /> },
      { label: 'Employee Dashboard', href: '/dashboards/employee', icon: <FiUsers className="w-5 h-5" />, isNew: true },
      { label: 'Employees', href: '/employees', icon: <FiUsers className="w-5 h-5" />, moduleKey: 'employees' },
      { label: 'Company Management', href: '/company', icon: <FiGlobe className="w-5 h-5" />, moduleKey: 'company' },
    ],
  },
  {
    key: 'talent-acquisition',
    sectionIcon: FiBriefcase,
    label: 'Talent Acquisition',
    items: [
      { label: 'Recruitment Dashboard', href: '/dashboards/recruitment', icon: <FiBriefcase className="w-5 h-5" />, moduleKey: 'recruitment', isNew: true },
      { label: 'Recruitment', href: '/recruitment', icon: <FiBriefcase className="w-5 h-5" />, moduleKey: 'recruitment' },
      { label: 'Requisitions', href: '/requisitions', icon: <FiBriefcase className="w-5 h-5" />, moduleKey: 'recruitment' },
      { label: 'Offers', href: '/offers', icon: <FiBriefcase className="w-5 h-5" />, moduleKey: 'recruitment' },
      { label: 'Job Portal', href: '/job-portal', icon: <FiBriefcase className="w-5 h-5" />, moduleKey: 'recruitment' },
      { label: 'AI Interview', href: '/ai-interview', icon: <FiBriefcase className="w-5 h-5" />, moduleKey: 'recruitment' },
      { label: 'Candidate Flow', href: '/analytics/candidate-flow', icon: <FiBriefcase className="w-5 h-5" />, moduleKey: 'recruitment', isNew: true },
    ],
  },
  {
    key: 'employee-lifecycle',
    sectionIcon: FiUserPlus,
    label: 'Employee Lifecycle',
    items: [
      { label: 'Onboarding', href: '/onboarding', icon: <FiUserPlus className="w-5 h-5" />, moduleKey: 'onboarding' },
      { label: 'Preboarding', href: '/preboarding', icon: <FiUserPlus className="w-5 h-5" />, moduleKey: 'onboarding', isNew: true },
      { label: 'Separation', href: '/separation', icon: <FiUserPlus className="w-5 h-5" />, moduleKey: 'separation' },
      { label: 'F&F Settlement', href: '/fnf', icon: <FiUserPlus className="w-5 h-5" />, moduleKey: 'separation' },
    ],
  },
  {
    key: 'attendance',
    sectionIcon: FiClock,
    label: 'Attendance',
    items: [
      { label: 'Attendance Dashboard', href: '/dashboards/attendance', icon: <FiClock className="w-5 h-5" />, moduleKey: 'attendance', isNew: true },
      { label: 'Attendance', href: '/attendance', icon: <FiClock className="w-5 h-5" />, moduleKey: 'attendance' },
      { label: 'Regularization', href: '/attendance/regularize', icon: <FiClock className="w-5 h-5" />, moduleKey: 'attendance' },
      { label: 'Permission', href: '/attendance/permission', icon: <FiClock className="w-5 h-5" />, moduleKey: 'attendance' },
      { label: 'Gatepass', href: '/attendance/gatepass', icon: <FiClock className="w-5 h-5" />, moduleKey: 'attendance' },
      { label: 'Overtime', href: '/attendance/overtime', icon: <FiClock className="w-5 h-5" />, moduleKey: 'attendance' },
      { label: 'Comp-Off', href: '/attendance/comp-off', icon: <FiClock className="w-5 h-5" />, moduleKey: 'attendance' },
      { label: 'Geofences', href: '/attendance/geofence', icon: <FiClock className="w-5 h-5" />, moduleKey: 'attendance' },
      { label: 'Biometric', href: '/attendance/biometric', icon: <FiClock className="w-5 h-5" />, moduleKey: 'attendance' },
      { label: 'Burnout', href: '/attendance/burnout', icon: <FiClock className="w-5 h-5" />, moduleKey: 'attendance' },
      { label: 'Audit Trail', href: '/attendance/audit-log', icon: <FiClock className="w-5 h-5" />, moduleKey: 'attendance' },
      { label: 'Policy Config', href: '/attendance/policy-config', icon: <FiClock className="w-5 h-5" />, moduleKey: 'attendance' },
    ],
  },
  {
    key: 'leave',
    sectionIcon: FiCalendar,
    label: 'Leave',
    items: [
      { label: 'Leave Management', href: '/leave', icon: <FiCalendar className="w-5 h-5" />, moduleKey: 'leave' },
      { label: 'Leave Encashment', href: '/leave/encashment', icon: <FiCalendar className="w-5 h-5" />, moduleKey: 'leave' },
      { label: 'Optional Holidays', href: '/leave/optional-holidays', icon: <FiCalendar className="w-5 h-5" />, moduleKey: 'leave' },
    ],
  },
  {
    key: 'timesheet',
    sectionIcon: FiWatch,
    label: 'Timesheets',
    items: [
      { label: 'Timesheets', href: '/timesheets', icon: <FiWatch className="w-5 h-5" />, moduleKey: 'attendance' },
    ],
  },
  {
    key: 'compensation',
    sectionIcon: FiDollarSign,
    label: 'Compensation',
    items: [
      { label: 'Payroll Dashboard', href: '/dashboards/payroll', icon: <FiDollarSign className="w-5 h-5" />, moduleKey: 'payroll', isNew: true },
      { label: 'Payroll', href: '/payroll', icon: <FiDollarSign className="w-5 h-5" />, moduleKey: 'payroll' },
      { label: 'CTC Templates', href: '/payroll/ctc-templates', icon: <FiDollarSign className="w-5 h-5" />, moduleKey: 'payroll', isNew: true },
      { label: 'CTC Calculator', href: '/payroll/ctc-calculator', icon: <FiDollarSign className="w-5 h-5" />, moduleKey: 'payroll', isNew: true },
      { label: 'Component Master', href: '/payroll/components', icon: <FiDollarSign className="w-5 h-5" />, moduleKey: 'payroll', isNew: true },
      { label: 'Salary Settings', href: '/payroll/salary-settings', icon: <FiDollarSign className="w-5 h-5" />, moduleKey: 'payroll', isNew: true },
      { label: 'Payroll Definitions', href: '/payroll/definitions', icon: <FiDollarSign className="w-5 h-5" />, moduleKey: 'payroll', isNew: true },
      { label: 'Income Tax', href: '/payroll/income-tax', icon: <FiDollarSign className="w-5 h-5" />, moduleKey: 'payroll', isNew: true },
      { label: 'Tax Slabs', href: '/payroll/tax-slabs', icon: <FiDollarSign className="w-5 h-5" />, moduleKey: 'payroll', isNew: true },
      { label: 'Statutory', href: '/payroll/statutory', icon: <FiDollarSign className="w-5 h-5" />, moduleKey: 'payroll', isNew: true },
      { label: 'Gratuity', href: '/payroll/gratuity', icon: <FiDollarSign className="w-5 h-5" />, moduleKey: 'payroll', isNew: true },
      { label: 'Payroll Inputs', href: '/payroll/inputs', icon: <FiDollarSign className="w-5 h-5" />, moduleKey: 'payroll', isNew: true },
      { label: 'Validation', href: '/payroll/validations', icon: <FiDollarSign className="w-5 h-5" />, moduleKey: 'payroll', isNew: true },
      { label: 'Processing', href: '/payroll/processing', icon: <FiDollarSign className="w-5 h-5" />, moduleKey: 'payroll' },
      { label: 'Overtime', href: '/payroll/overtime', icon: <FiDollarSign className="w-5 h-5" />, moduleKey: 'payroll', isNew: true },
      { label: 'Loans', href: '/payroll/loans', icon: <FiDollarSign className="w-5 h-5" />, moduleKey: 'payroll', isNew: true },
      { label: 'F&F Settlement', href: '/payroll/fnf', icon: <FiDollarSign className="w-5 h-5" />, moduleKey: 'payroll', isNew: true },
      { label: 'Payroll Holds', href: '/payroll/holds', icon: <FiDollarSign className="w-5 h-5" />, moduleKey: 'payroll', isNew: true },
      { label: 'Currency & FX', href: '/payroll/currency', icon: <FiDollarSign className="w-5 h-5" />, moduleKey: 'payroll', isNew: true },
      { label: 'Dimensions', href: '/payroll/dimensions', icon: <FiDollarSign className="w-5 h-5" />, moduleKey: 'payroll', isNew: true },
      { label: 'Secondment', href: '/payroll/secondment', icon: <FiDollarSign className="w-5 h-5" />, moduleKey: 'payroll', isNew: true },
      { label: 'Group Dashboard', href: '/payroll/group-dashboard', icon: <FiDollarSign className="w-5 h-5" />, moduleKey: 'payroll', isNew: true },
      { label: 'Compliance', href: '/payroll/compliance', icon: <FiDollarSign className="w-5 h-5" />, moduleKey: 'payroll', isNew: true },
      { label: 'GL Mapping', href: '/payroll/gl-mapping', icon: <FiDollarSign className="w-5 h-5" />, moduleKey: 'payroll', isNew: true },
      { label: 'Bank Files', href: '/payroll/bank-files', icon: <FiDollarSign className="w-5 h-5" />, moduleKey: 'payroll', isNew: true },
      { label: 'Reports', href: '/payroll/reports', icon: <FiDollarSign className="w-5 h-5" />, moduleKey: 'payroll', isNew: true },
      { label: 'Payment Methods', href: '/payroll/payment-methods', icon: <FiDollarSign className="w-5 h-5" />, moduleKey: 'payroll', isNew: true },
      { label: 'Payslips', href: '/payroll/payslips', icon: <FiDollarSign className="w-5 h-5" />, moduleKey: 'payroll' },
      { label: 'Approvals', href: '/payroll/approvals', icon: <FiDollarSign className="w-5 h-5" />, moduleKey: 'payroll', isNew: true },
      { label: 'AI Insights', href: '/payroll/ai-insights', icon: <FiDollarSign className="w-5 h-5" />, moduleKey: 'payroll', isNew: true },
    ],
  },
  {
    key: 'performance-growth',
    sectionIcon: FiTrendingUp,
    label: 'Performance',
    items: [
      { label: 'Performance', href: '/performance', icon: <FiTrendingUp className="w-5 h-5" />, moduleKey: 'performance' },
      { label: 'OKR Cascade', href: '/okrs', icon: <FiTrendingUp className="w-5 h-5" />, moduleKey: 'performance', isNew: true },
      { label: 'Training', href: '/training', icon: <FiBookOpen className="w-5 h-5" />, moduleKey: 'training' },
      { label: 'Engagement', href: '/engagement', icon: <FiTrendingUp className="w-5 h-5" />, moduleKey: 'engagement', isNew: true },
      { label: 'Succession', href: '/succession', icon: <FiTrendingUp className="w-5 h-5" />, roles: ['super_admin', 'tenant_admin', 'admin'], isNew: true },
    ],
  },
  {
    key: 'accounts-finance',
    sectionIcon: FiDollarSign,
    label: 'Accounts',
    items: [
      { label: 'Accounts Hub', href: '/accounts', icon: <FiDollarSign className="w-5 h-5" />, moduleKey: 'accounts', isNew: true },
      { label: 'Chart of Accounts', href: '/accounts/chart-of-accounts', icon: <FiDollarSign className="w-5 h-5" />, moduleKey: 'accounts', isNew: true },
      { label: 'Journal Entries', href: '/accounts/journal-entries', icon: <FiDollarSign className="w-5 h-5" />, moduleKey: 'accounts', isNew: true },
      { label: 'Invoices (AR)', href: '/accounts/invoices', icon: <FiDollarSign className="w-5 h-5" />, moduleKey: 'accounts', isNew: true },
      { label: 'Bills (AP)', href: '/accounts/bills', icon: <FiDollarSign className="w-5 h-5" />, moduleKey: 'accounts', isNew: true },
      { label: 'Bank Reconciliation', href: '/accounts/bank-reconciliation', icon: <FiDollarSign className="w-5 h-5" />, moduleKey: 'accounts', isNew: true },
      { label: 'Financial Reports', href: '/accounts/reports', icon: <FiDollarSign className="w-5 h-5" />, moduleKey: 'accounts', isNew: true },
    ],
  },
  {
    key: 'operations',
    sectionIcon: FiFolder,
    label: 'Operations',
    items: [
      { label: 'Travel', href: '/travel', icon: <FiFolder className="w-5 h-5" />, moduleKey: 'travel' },
      { label: 'Expenses', href: '/expenses', icon: <FiFolder className="w-5 h-5" />, moduleKey: 'expenses' },
      { label: 'Documents', href: '/documents', icon: <FiFolder className="w-5 h-5" />, moduleKey: 'docs' },
    ],
  },
  {
    key: 'project-management',
    sectionIcon: FiFolder,
    label: 'Projects',
    items: [
      { label: 'PM Dashboard', href: '/project-management', icon: <FiFolder className="w-5 h-5" />, moduleKey: 'projects', isNew: true },
      { label: 'Projects', href: '/projects', icon: <FiFolder className="w-5 h-5" />, moduleKey: 'projects' },
      { label: 'Utilization', href: '/projects/utilization', icon: <FiFolder className="w-5 h-5" />, isNew: true },
    ],
  },
  {
    key: 'assets-it',
    sectionIcon: FiPackage,
    label: 'Assets & IT',
    items: [
      { label: 'Assets', href: '/assets', icon: <FiPackage className="w-5 h-5" />, moduleKey: 'assets' },
      { label: 'IT Admin Console', href: '/it-admin', icon: <FiPackage className="w-5 h-5" />, moduleKey: 'it_admin_module', isNew: true },
    ],
  },
  {
    key: 'crm',
    sectionIcon: FiTarget,
    label: 'CRM',
    items: [
      { label: 'CRM Dashboard', href: '/crm', icon: <FiTarget className="w-5 h-5" />, moduleKey: 'crm', isNew: true },
      { label: 'Contacts', href: '/crm/contacts', icon: <FiTarget className="w-5 h-5" />, moduleKey: 'crm', isNew: true },
      { label: 'Deals', href: '/crm/deals', icon: <FiTarget className="w-5 h-5" />, moduleKey: 'crm', isNew: true },
      { label: 'Leads', href: '/crm/leads', icon: <FiTarget className="w-5 h-5" />, moduleKey: 'crm', isNew: true },
    ],
  },
  {
    key: 'external-relations',
    sectionIcon: FiGlobe,
    label: 'External Relations',
    items: [
      { label: 'Clients', href: '/clients', icon: <FiGlobe className="w-5 h-5" />, moduleKey: 'company' },
      { label: 'SOWs', href: '/clients/sow', icon: <FiGlobe className="w-5 h-5" />, moduleKey: 'company', isNew: true },
      { label: 'Client Insights', href: '/clients/insights', icon: <FiGlobe className="w-5 h-5" />, moduleKey: 'company', isNew: true },
      { label: 'Vendors', href: '/vendors', icon: <FiGlobe className="w-5 h-5" />, moduleKey: 'company' },
      { label: 'Vendor Compliance', href: '/vendors/compliance', icon: <FiGlobe className="w-5 h-5" />, moduleKey: 'company', isNew: true },
      { label: 'Purchase Orders', href: '/purchase-orders', icon: <FiGlobe className="w-5 h-5" />, moduleKey: 'company', isNew: true },
      { label: 'Vendor Invoices', href: '/vendor-invoices', icon: <FiGlobe className="w-5 h-5" />, moduleKey: 'company', isNew: true },
    ],
  },
  {
    key: 'marketplace',
    sectionIcon: FiShoppingBag,
    label: 'Marketplace',
    items: [
      { label: 'Marketplace Hub', href: '/marketplace', icon: <FiShoppingBag className="w-5 h-5" />, isNew: true },
      { label: 'My Wallet', href: '/marketplace/wallet', icon: <FiShoppingBag className="w-5 h-5" />, isNew: true },
      { label: 'Catalog', href: '/marketplace/catalog', icon: <FiShoppingBag className="w-5 h-5" />, isNew: true },
      { label: 'Insurance', href: '/marketplace/insurance', icon: <FiShoppingBag className="w-5 h-5" />, isNew: true },
      { label: 'EWA', href: '/marketplace/ewa', icon: <FiShoppingBag className="w-5 h-5" />, isNew: true },
      { label: 'Loans', href: '/marketplace/loans', icon: <FiShoppingBag className="w-5 h-5" />, isNew: true },
      { label: 'Gifting', href: '/marketplace/gifting', icon: <FiShoppingBag className="w-5 h-5" />, isNew: true },
      { label: 'AI Insights', href: '/marketplace/insights', icon: <FiShoppingBag className="w-5 h-5" />, isNew: true },
    ],
  },
  {
    key: 'support-intelligence',
    sectionIcon: FiHelpCircle,
    label: 'Support',
    items: [
      { label: 'Helpdesk', href: '/helpdesk', icon: <FiHelpCircle className="w-5 h-5" />, moduleKey: 'helpdesk' },
      { label: 'Grievances', href: '/grievances', icon: <FiHelpCircle className="w-5 h-5" />, moduleKey: 'grievances' },
      { label: 'AI Assistant', href: '/ai-assistant', icon: <FiHelpCircle className="w-5 h-5" /> },
    ],
  },
  {
    key: 'collaboration',
    sectionIcon: FiMessageCircle,
    label: 'Collaboration',
    items: [
      { label: 'Hub Home', href: '/collaboration', icon: <FiMessageCircle className="w-5 h-5" />, isNew: true },
      { label: 'Chat', href: '/collaboration/chat', icon: <FiMessageCircle className="w-5 h-5" />, isNew: true },
      { label: 'Calls', href: '/collaboration/calls', icon: <FiMessageCircle className="w-5 h-5" />, isNew: true },
      { label: 'Calendar', href: '/calendar', icon: <FiCalendar className="w-5 h-5" />, isNew: true },
      { label: 'Email', href: '/email', icon: <FiMessageCircle className="w-5 h-5" />, isNew: true },
      { label: 'To Do', href: '/todo', icon: <FiMessageCircle className="w-5 h-5" />, isNew: true },
      { label: 'Notes', href: '/notes', icon: <FiMessageCircle className="w-5 h-5" />, isNew: true },
      { label: 'Social Feed', href: '/social-feed', icon: <FiMessageCircle className="w-5 h-5" />, isNew: true },
      { label: 'File Manager', href: '/file-manager', icon: <FiMessageCircle className="w-5 h-5" />, isNew: true },
      { label: 'Kanban Board', href: '/kanban', icon: <FiMessageCircle className="w-5 h-5" />, isNew: true },
      { label: 'Invoices', href: '/invoices', icon: <FiMessageCircle className="w-5 h-5" />, isNew: true },
    ],
  },
  {
    key: 'knowledge-base',
    sectionIcon: FiBookOpen,
    label: 'Knowledge',
    items: [
      { label: 'Documentation Hub', href: '/docs', icon: <FiBookOpen className="w-5 h-5" />, moduleKey: 'docs', isNew: true },
    ],
  },
  {
    key: 'governance',
    sectionIcon: FiSettings,
    label: 'Governance',
    items: [
      { label: 'Workflows', href: '/workflows', icon: <FiSettings className="w-5 h-5" />, moduleKey: 'settings' },
      { label: 'Reports & Analytics', href: '/reports', icon: <FiSettings className="w-5 h-5" />, moduleKey: 'reports' },
      { label: 'Scheduled Reports', href: '/reports/schedules', icon: <FiSettings className="w-5 h-5" />, isNew: true },
      { label: 'AI Insights', href: '/insights', icon: <FiSettings className="w-5 h-5" />, isNew: true },
      { label: 'Settings', href: '/settings', icon: <FiSettings className="w-5 h-5" />, moduleKey: 'settings' },
      { label: 'Notifications', href: '/notifications', icon: <FiSettings className="w-5 h-5" /> },
    ],
  },
];

// Module groups for organizing sections on the right strip
const MODULE_GROUPS: ModuleGroup[] = [
  {
    groupLabel: 'Admin',
    sections: navSections.filter(s => ['super-admin', 'tenant-admin'].includes(s.key)),
  },
  {
    groupLabel: 'People',
    sections: navSections.filter(s => ['core-hr', 'talent-acquisition', 'employee-lifecycle'].includes(s.key)),
  },
  {
    groupLabel: 'Time',
    sections: navSections.filter(s => ['attendance', 'leave', 'timesheet'].includes(s.key)),
  },
  {
    groupLabel: 'Money',
    sections: navSections.filter(s => ['compensation', 'performance-growth', 'accounts-finance'].includes(s.key)),
  },
  {
    groupLabel: 'Ops',
    sections: navSections.filter(s => ['operations', 'project-management'].includes(s.key)),
  },
  {
    groupLabel: 'Tech',
    sections: navSections.filter(s => ['assets-it', 'crm'].includes(s.key)),
  },
  {
    groupLabel: 'External',
    sections: navSections.filter(s => ['external-relations', 'marketplace'].includes(s.key)),
  },
  {
    groupLabel: 'Support',
    sections: navSections.filter(s => ['support-intelligence', 'collaboration'].includes(s.key)),
  },
  {
    groupLabel: 'Info',
    sections: navSections.filter(s => ['knowledge-base', 'governance'].includes(s.key)),
  },
];

// Also export navSections for the left sidebar to use
export { navSections };

interface ModuleStripProps {
  currentModuleKey: string | null;
  onModuleSelect: (key: string) => void;
}

export default function ModuleStrip({ currentModuleKey, onModuleSelect }: ModuleStripProps) {
  const { user } = useAuthStore();
  const userRole = user?.role || 'admin';

  // Filter sections based on user role
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
        .map(section => ({
          ...section,
          items: section.items.filter(item => {
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
        .filter(section => section.items.length > 0),
    })).filter(group => group.sections.length > 0);
  }, [userRole, effectiveRoles]);

  return (
    <aside className="fixed right-0 top-0 h-full w-[72px] bg-thb-sidebar-bg border-l border-white/[0.06] flex flex-col z-40">
      {/* Brand mark at top */}
      <div className="flex items-center justify-center h-14 border-b border-white/[0.06]">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 via-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-green-500/20">
          <svg viewBox="0 0 35 11" className="w-4 h-2.5" fill="none">
            <rect x="0" y="0" width="9" height="9" rx="2" fill="white" opacity="0.9"/>
            <rect x="13" y="0" width="9" height="9" rx="2" fill="white" opacity="0.9"/>
            <rect x="26" y="0" width="9" height="9" rx="2" fill="white" opacity="0.9"/>
          </svg>
        </div>
      </div>

      {/* Module Icons organized by section */}
      <nav className="flex-1 overflow-y-auto py-2 px-1 sidebar-scroll">
        {filteredGroups.map((group) => (
          <div key={group.groupLabel} className="mb-2">
            {/* Group label */}
            <div className="text-center mb-1">
              <span className="text-[7px] font-bold uppercase tracking-widest text-thb-sidebar-text/30">
                {group.groupLabel}
              </span>
            </div>
            {/* Section icons */}
            <div className="flex flex-col gap-0.5">
              {group.sections.map((section) => {
                const SectionIcon = section.sectionIcon;
                const isActive = currentModuleKey === section.key;
                return (
                  <button
                    key={section.key}
                    onClick={() => onModuleSelect(section.key)}
                    className={`flex flex-col items-center gap-0.5 py-1.5 px-1 rounded-lg transition-all duration-200 group ${
                      isActive
                        ? 'bg-green-500/15 text-green-400 ring-1 ring-green-500/20'
                        : 'text-thb-sidebar-text hover:bg-thb-sidebar-hover hover:text-slate-200'
                    }`}
                    title={section.label}
                  >
                    <SectionIcon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-green-400' : 'group-hover:text-slate-200'} transition-colors`} />
                    <span className={`text-[7px] font-medium text-center leading-tight line-clamp-2 w-full ${isActive ? 'text-green-400' : ''}`}>
                      {section.label.length > 10 ? section.label.substring(0, 8) + '…' : section.label}
                    </span>
                  </button>
                );
              })}
            </div>
            {/* Group separator */}
            <div className="mx-2 my-1 border-t border-white/[0.04]" />
          </div>
        ))}
      </nav>

      {/* Bottom brand */}
      <div className="border-t border-white/[0.06] py-2 text-center">
        <div className="flex items-center justify-center gap-1 opacity-30 hover:opacity-60 transition-opacity px-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/marq-ai-logo.png" alt="Marq AI" className="w-3 h-3 rounded object-contain" />
          <span className="text-[6px] text-thb-sidebar-text whitespace-nowrap leading-none">Marq AI</span>
        </div>
      </div>
    </aside>
  );
}
