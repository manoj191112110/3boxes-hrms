export type UserRole = 
  | 'super_admin' 
  | 'tenant_admin'
  | 'admin'
  | 'job_seeker';

export type ModuleKey = 
  | 'dashboard'
  | 'recruitment'
  | 'employees'
  | 'attendance'
  | 'leave'
  | 'payroll'
  | 'performance'
  | 'learning'
  | 'engagement'
  | 'travel_expense'
  | 'assets'
  | 'helpdesk'
  | 'compliance'
  | 'workflow'
  | 'analytics'
  | 'client_portal'
  | 'vendor_portal'
  | 'sub_vendor_portal'
  | 'job_portal'
  | 'ai_interview'
  | 'ai_chatbot'
  | 'alumni'
  | 'settings'
  | 'onboarding'
  | 'companies'
  | 'audit_logs'
  | 'trial_requests'
  | 'help_training';

export interface CompanyInfo {
  id: string;
  name: string;
  code: string;
  industry: string;
  logo?: string;
  country: string;
  currency: string;
  employeeCount: number;
  isActive: boolean;
}

export interface EmployeeInfo {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  avatar?: string;
  designation: string;
  department: string;
  status: string;
  joiningDate: string;
  company: string;
}

export interface DashboardStat {
  label: string;
  value: string | number;
  change?: number;
  icon: string;
  color: string;
}

export interface ChartDataPoint {
  name: string;
  value: number;
  [key: string]: string | number;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'error';
  timestamp: string;
  read: boolean;
}

export interface SidebarItem {
  key: ModuleKey;
  label: string;
  icon: string;
  badge?: number;
  children?: SidebarItem[];
}

export const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: 'Super Admin',
  tenant_admin: 'Tenant Admin',
  admin: 'Admin',
  job_seeker: 'Job Seeker',
};

export const ROLE_COLORS: Record<UserRole, string> = {
  super_admin: 'bg-red-100 text-red-800',
  tenant_admin: 'bg-green-100 text-green-800',
  admin: 'bg-emerald-100 text-emerald-800',
  job_seeker: 'bg-teal-100 text-teal-800',
};

export const EMPLOYMENT_STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  on_leave: 'bg-yellow-100 text-yellow-800',
  probation: 'bg-green-100 text-green-800',
  notice_period: 'bg-orange-100 text-orange-800',
  exited: 'bg-red-100 text-red-800',
};
