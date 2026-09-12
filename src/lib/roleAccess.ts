// ============================================================================
// Role-Based Access Control Configuration for HRMS Application
// ============================================================================
//
// Standard Roles (5):
//   1. super_admin  (level 0) - Platform-level full access
//   2. tenant_admin (level 1) - Tenant-level full access
//   3. admin        (level 2) - Company-level admin access (HR, Finance, IT combined)
//   4. manager      (level 3) - People-manager access (own + direct reports across all modules)
//   5. employee     (level 4) - Self-service access (own records only)
//
// The 'manager' and 'employee' roles are first-class roles in the RBAC system:
//   - employee: Sees their own records in employee/leave/attendance/payroll modules
//     via the 'self' data scope. Sidebar shows self-service nav items.
//   - manager: Sees their own + their direct reports' records via the 'team' data
//     scope. Resolved via DottedLineManager(solid) + Employee.reportingManagerId.
//
// Legacy roles (hr_admin, finance_admin, it_admin, recruiter, candidate) are
// still mapped to 'admin' via LEGACY_ROLE_MAP for backward compatibility.
//

/**
 * Role hierarchy level — lower number = higher privilege.
 * Used for comparison logic where needed.
 */
export const ROLE_LEVELS: Record<string, number> = {
  super_admin: 0,
  tenant_admin: 1,
  admin: 2,
  manager: 3,
  employee: 4,
};

/**
 * Module access by role — defines which roles can access each module.
 * This is the centralized access control configuration for sidebar and page-level guards.
 *
 * employee: self-service modules (view own data only)
 * manager: same self-service modules + team visibility (own + direct reports)
 */
export const MODULE_ACCESS: Record<string, string[]> = {
  dashboard: ['super_admin', 'tenant_admin', 'admin', 'manager', 'employee'],
  employees: ['super_admin', 'tenant_admin', 'admin', 'manager', 'employee'],
  company: ['super_admin', 'tenant_admin', 'admin'],
  recruitment: ['super_admin', 'tenant_admin', 'admin'],
  onboarding: ['super_admin', 'tenant_admin', 'admin', 'manager'],
  attendance: ['super_admin', 'tenant_admin', 'admin', 'manager', 'employee'],
  leave: ['super_admin', 'tenant_admin', 'admin', 'manager', 'employee'],
  payroll: ['super_admin', 'tenant_admin', 'admin', 'manager', 'employee'],
  salary_structures: ['super_admin', 'tenant_admin', 'admin'],
  performance: ['super_admin', 'tenant_admin', 'admin', 'manager', 'employee'],
  training: ['super_admin', 'tenant_admin', 'admin', 'manager', 'employee'],
  engagement: ['super_admin', 'tenant_admin', 'admin', 'manager', 'employee'],
  reports: ['super_admin', 'tenant_admin', 'admin', 'manager'],
  settings: ['super_admin', 'tenant_admin', 'admin'],
  docs: ['super_admin', 'tenant_admin', 'admin', 'manager', 'employee'],
  helpdesk: ['super_admin', 'tenant_admin', 'admin', 'manager', 'employee'],
  assets: ['super_admin', 'tenant_admin', 'admin', 'manager', 'employee'],
  projects: ['super_admin', 'tenant_admin', 'admin', 'manager', 'employee'],
  invoices: ['super_admin', 'tenant_admin', 'admin'],
  expenses: ['super_admin', 'tenant_admin', 'admin', 'manager', 'employee'],
  travel: ['super_admin', 'tenant_admin', 'admin', 'manager', 'employee'],
  accounts: ['super_admin', 'tenant_admin', 'admin'],
  crm: ['super_admin', 'tenant_admin', 'admin'],
  it_admin_module: ['super_admin', 'tenant_admin', 'admin'],
  separation: ['super_admin', 'tenant_admin', 'admin', 'manager', 'employee'],
  grievances: ['super_admin', 'tenant_admin', 'admin', 'manager', 'employee'],
  super_admin: ['super_admin'],
  tenant_admin_module: ['super_admin', 'tenant_admin'],
  rbac: ['super_admin', 'tenant_admin'],
  workflows: ['super_admin', 'tenant_admin', 'admin'],
  timesheets: ['super_admin', 'tenant_admin', 'admin', 'manager', 'employee'],
  documents: ['super_admin', 'tenant_admin', 'admin', 'manager', 'employee'],
  ai_assistant: ['super_admin', 'tenant_admin', 'admin', 'manager', 'employee'],
  notifications: ['super_admin', 'tenant_admin', 'admin', 'manager', 'employee'],
  requisitions: ['super_admin', 'tenant_admin', 'admin'],
  offers: ['super_admin', 'tenant_admin', 'admin'],
  job_portal: ['super_admin', 'tenant_admin', 'admin'],
  ai_interview: ['super_admin', 'tenant_admin', 'admin'],
  preboarding: ['super_admin', 'tenant_admin', 'admin'],
  succession: ['super_admin', 'tenant_admin', 'admin', 'manager'],
  clients: ['super_admin', 'tenant_admin', 'admin'],
  vendors: ['super_admin', 'tenant_admin', 'admin'],
  ai_admin: ['super_admin'],
  governance: ['super_admin', 'tenant_admin', 'admin'],
};

/**
 * Detailed access specifications per role.
 * Controls what data scope each role can see across modules.
 */
export const ROLE_ACCESS_DETAILS: Record<string, {
  label: string;
  description: string;
  dashboardAccess: 'full' | 'team' | 'self';
  employeeAccess: 'all' | 'team' | 'self';
  reportAccess: 'all' | 'team' | 'self' | 'none';
  settingsAccess: 'all' | 'module' | 'none';
}> = {
  super_admin: {
    label: 'Super Admin',
    description: 'Full system access across all tenants and modules — manages platform configuration, RBAC, audit logs, and all tenant operations',
    dashboardAccess: 'full',
    employeeAccess: 'all',
    reportAccess: 'all',
    settingsAccess: 'all',
  },
  tenant_admin: {
    label: 'Tenant Admin',
    description: 'Full access within their tenant — manages company RBAC, organization settings, and all HR operations',
    dashboardAccess: 'full',
    employeeAccess: 'all',
    reportAccess: 'all',
    settingsAccess: 'all',
  },
  admin: {
    label: 'Admin',
    description: 'Company-level admin access — manages all employees, HR operations, payroll, recruitment, onboarding, IT assets, finance, and compliance within their company',
    dashboardAccess: 'full',
    employeeAccess: 'all',
    reportAccess: 'all',
    settingsAccess: 'module',
  },
  manager: {
    label: 'Manager',
    description: 'People manager — sees own records plus direct reports across employee, leave, attendance, payroll, performance, and travel modules. Can approve/reject team requests.',
    dashboardAccess: 'team',
    employeeAccess: 'team',
    reportAccess: 'team',
    settingsAccess: 'none',
  },
  employee: {
    label: 'Employee',
    description: 'Self-service access — sees own records across employee, leave, attendance, payroll, performance, and travel modules. Can raise requests but cannot view other employees\' data.',
    dashboardAccess: 'self',
    employeeAccess: 'self',
    reportAccess: 'self',
    settingsAccess: 'none',
  },
};

/**
 * Tenant-specific module whitelist.
 * Controls which modules are visible for specific tenants.
 * Keys are tenant slugs (from subdomain), values are arrays of allowed nav section keys.
 * Tenants NOT listed here see ALL modules (default behavior).
 *
 * This is used to gradually roll out modules — only enabled modules appear
 * in the sidebar. Once a module is fully implemented and tested for a tenant,
 * it can be added to their whitelist.
 *
 * To disable tenant filtering for a tenant, simply remove them from this map
 * or add all module keys to their array.
 */
export const TENANT_MODULE_WHITELIST: Record<string, string[]> = {
  'marqaitechgroup': [
    // Tenant / platform management
    'super-admin',
    'tenant',
    // Core HR
    'company',
    'employee',
    // Time & Leave
    'leave',
    'attendance',
    // Compensation
    'payroll',
    // Talent
    'recruitment',
    'onboarding',
    'preboarding',
    // Operations
    'project',
    // Support & Intelligence
    'support',
    'collaboration',
    // Governance
    'governance',
  ],
};

/**
 * Dynamic module overrides from the database (set by super admin UI).
 * This map is populated at runtime by the tenantModuleStore.
 * When a tenant has DB-based module flags, this takes precedence
 * over the hardcoded TENANT_MODULE_WHITELIST.
 *
 * Key = tenantSlug, Value = Set of enabled module keys.
 * If a tenant is in this map, ONLY the modules in the Set are visible.
 * If a tenant is NOT in this map, falls back to TENANT_MODULE_WHITELIST.
 */
let _dbModuleOverrides: Record<string, Set<string>> = {};

/**
 * Update the runtime DB module overrides (called from tenantModuleStore).
 */
export function setDbModuleOverrides(overrides: Record<string, Set<string>>) {
  _dbModuleOverrides = overrides;
}

/**
 * Get the current DB module overrides (for reading in hooks).
 */
export function getDbModuleOverrides(): Record<string, Set<string>> {
  return _dbModuleOverrides;
}

/**
 * Check if a nav section key is enabled for a specific tenant.
 * Resolution order:
 *   1. DB-based overrides (set by super admin via Module Management UI)
 *   2. Hardcoded TENANT_MODULE_WHITELIST (fallback for tenants not yet migrated)
 *   3. No restrictions = all modules visible
 */
export function isModuleEnabledForTenant(tenantSlug: string, moduleKey: string): boolean {
  // 1. Check DB overrides first (dynamic, set by super admin UI)
  const dbOverride = _dbModuleOverrides[tenantSlug];
  if (dbOverride) return dbOverride.has(moduleKey);

  // 2. Fallback to hardcoded whitelist
  const whitelist = TENANT_MODULE_WHITELIST[tenantSlug];
  if (!whitelist) return true; // No whitelist = all modules visible
  return whitelist.includes(moduleKey);
}

/**
 * Check if a role can access a module.
 * Super admin always returns true.
 *
 * IMPORTANT: Also handles legacy role names. If the role isn't directly in
 * the MODULE_ACCESS list, we check the LEGACY_ROLE_MAP migration target.
 * For example, 'company_hr_admin' maps to 'admin', so it inherits the
 * admin's module access.
 */
export function canRoleAccessModule(role: string, moduleKey: string): boolean {
  if (!role) return false;
  if (role === 'super_admin') return true;

  // Direct check
  const allowed = MODULE_ACCESS[moduleKey];
  if (allowed && allowed.includes(role)) return true;

  // Legacy role fallback: check the migrated role
  const migratedRole = LEGACY_ROLE_MAP[role];
  if (migratedRole && migratedRole !== role) {
    if (allowed && allowed.includes(migratedRole)) return true;
  }

  return false;
}

/**
 * Get the data scope for a role — determines how much data a role can see.
 * - 'all': Full access to all records
 * - 'team': Access to own + direct reports (managers)
 * - 'self': Access to own records only (employees)
 *
 * IMPORTANT: This function also handles LEGACY role names that exist in older
 * database rows. Legacy roles like 'company_hr_admin', 'hr_admin',
 * 'finance_admin', 'it_admin', 'hrhead', 'recruitmenthead' are mapped to
 * 'admin' scope ('all') so they retain full company-level access. Without
 * this, a user created with role 'company_hr_admin' would get 'self' scope
 * and only see their own employee record.
 */
export function getDataScope(role: string): 'all' | 'team' | 'self' {
  if (!role) return 'self';

  // Normalize: lowercase the role for comparison
  const r = role.toLowerCase();

  // 'all' scope — full access (includes legacy admin-equivalent roles)
  if ([
    'super_admin', 'tenant_admin', 'admin',
    // Legacy admin-equivalent roles (mapped to 'admin' via LEGACY_ROLE_MAP)
    'company_hr_admin', 'hr_admin', 'finance_admin', 'finance',
    'it_admin', 'hrhead', 'recruitmenthead',
  ].includes(r)) return 'all';

  // 'team' scope — manager + direct reports
  if (r === 'manager') return 'team';

  // Everyone else (employee, recruiter, candidate, etc.) → self only
  return 'self';
}

/**
 * Get the dashboard access level for a role.
 */
export function getDashboardAccess(role: string): 'full' | 'team' | 'self' {
  const details = ROLE_ACCESS_DETAILS[role];
  return details?.dashboardAccess || 'self';
}

/**
 * Get the report access level for a role.
 */
export function getReportAccess(role: string): 'all' | 'team' | 'self' | 'none' {
  const details = ROLE_ACCESS_DETAILS[role];
  return details?.reportAccess || 'self';
}

/**
 * Get the employee access level for a role.
 */
export function getEmployeeAccess(role: string): 'all' | 'team' | 'self' {
  const details = ROLE_ACCESS_DETAILS[role];
  return details?.employeeAccess || 'self';
}

/**
 * Filter sidebar navigation items based on role.
 * Returns the list of module keys the role can see.
 */
export function getAccessibleModules(role: string): string[] {
  if (role === 'super_admin') return Object.keys(MODULE_ACCESS);
  const accessible: string[] = [];
  for (const [moduleKey, allowedRoles] of Object.entries(MODULE_ACCESS)) {
    if (allowedRoles.includes(role)) {
      accessible.push(moduleKey);
    }
  }
  return accessible;
}

/**
 * Check if a role can create/edit content in the docs module.
 */
export function canManageDocs(role: string): boolean {
  return ['super_admin', 'admin', 'tenant_admin'].includes(role);
}

/**
 * Check if a role can access statutory reports.
 */
export function canAccessStatutoryReports(role: string): boolean {
  return ['super_admin', 'tenant_admin', 'admin'].includes(role);
}

/**
 * Check if a role can access AI reports.
 */
export function canAccessAIReports(role: string): boolean {
  return ['super_admin', 'tenant_admin', 'admin'].includes(role);
}

/**
 * Check if a role can see the full employee list (all departments).
 */
export function canSeeAllEmployees(role: string): boolean {
  return ['super_admin', 'tenant_admin', 'admin'].includes(role);
}

/**
 * Legacy role migration map — maps old role keys to the new 5-role system.
 * Used for migrating existing users and role assignments.
 *
 * IMPORTANT: 'manager' and 'employee' are NOT mapped to 'admin' anymore —
 * they are first-class roles in the new RBAC system with their own data scope
 * and module access (see ROLE_ACCESS_DETAILS and MODULE_ACCESS above).
 */
export const LEGACY_ROLE_MAP: Record<string, string> = {
  super_admin: 'super_admin',
  tenant_admin: 'tenant_admin',
  hr_admin: 'admin',
  company_hr_admin: 'admin',
  finance_admin: 'admin',
  finance: 'admin',
  it_admin: 'admin',
  manager: 'manager',
  employee: 'employee',
  recruiter: 'admin',
  candidate: 'employee',
  job_seeker: 'employee',
  admin: 'admin',
  hrhead: 'admin',
  recruitmenthead: 'admin',
};

/**
 * Get the new role for a legacy role key.
 * 'manager' and 'employee' now map to themselves (first-class roles).
 * Unknown legacy roles default to 'employee' (least privilege) for safety.
 */
export function migrateRole(legacyRole: string): string {
  return LEGACY_ROLE_MAP[legacyRole] || 'employee';
}
