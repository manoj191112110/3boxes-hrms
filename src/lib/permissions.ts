// ============================================================================
// SRS-Aligned Permissions Matrix — Super Admin & Tenant Admin
// ============================================================================
//
// This module is the SINGLE SOURCE OF TRUTH for what each admin role is
// allowed to do in the platform. It mirrors the SRS document section 6
// (RBAC Matrix) and is consumed by both server-side API route guards and
// client-side UI gating.
//
// Hierarchy (SRS §2.1):
//   Super Admin  (Platform Level)       — owns the SaaS platform
//     └─ Parent Company / Subscriber    — created by super_admin
//         └─ Tenant Admin (Group Level) — assigned to a Parent Company
//             └─ Sub-Company (Child)    — created by tenant_admin
//                 └─ Branch / Dept / Employee
//
// Mapping to our DB:
//   Super Admin           -> User.role = 'super_admin'   (no tenantId)
//   Parent Company        -> Tenant
//   Tenant Admin          -> User.role = 'tenant_admin'  (tenantId required)
//   Group Company         -> CompanyGroup                (created by super_admin only)
//   Sub-Company           -> Company                     (created by tenant_admin or super_admin)
//
// The "ONE parent company per tenant" rule from the user is enforced by the
// Tenant ↔ CompanyGroup relationship: a Tenant IS the parent company, and
// CompanyGroups live under it. By convention each Tenant auto-creates ONE
// default CompanyGroup whose name matches the Tenant name (the "group
// company name = parent tenant" rule). Additional groups may be added by
// super_admin to model sub-clusters inside the same parent company.
// ============================================================================

export type AdminRole = 'super_admin' | 'tenant_admin' | 'admin';

export interface PermissionRule {
  /** SRS requirement ID, e.g. 'REQ-SA-01'. */
  srsId: string;
  /** Human-readable description (shown in UI tooltips and docs). */
  description: string;
  /** Roles allowed to perform this action. */
  allowedRoles: AdminRole[];
  /** Scope constraint — 'global' = no constraint, 'own_tenant' = only the caller's tenant, 'own_group' = only the caller's group. */
  scope: 'global' | 'own_tenant' | 'own_group';
}

// ----------------------------------------------------------------------------
// SRS §3 — SUPER ADMIN FUNCTIONAL REQUIREMENTS
// ----------------------------------------------------------------------------

export const SUPER_ADMIN_PERMISSIONS = {
  // §3.1 Tenant Lifecycle & Subscription Management
  CREATE_PARENT_COMPANY: {
    srsId: 'REQ-SA-01',
    description: 'Create a new Parent Company (tenant) profile.',
    allowedRoles: ['super_admin'] as AdminRole[],
    scope: 'global' as const,
  },
  MANAGE_SUBSCRIPTION_PLANS: {
    srsId: 'REQ-SA-02',
    description: 'Define subscription plans (Gold, Platinum) including limits on user seats and storage.',
    allowedRoles: ['super_admin'] as AdminRole[],
    scope: 'global' as const,
  },
  SET_SUBSCRIPTION_VALIDITY: {
    srsId: 'REQ-SA-03',
    description: 'Set subscription validity dates and billing cycles.',
    allowedRoles: ['super_admin'] as AdminRole[],
    scope: 'global' as const,
  },
  SUSPEND_DELETE_PARENT_COMPANY: {
    srsId: 'REQ-SA-04',
    description: 'Suspend or delete a Parent Company and all associated sub-companies.',
    allowedRoles: ['super_admin'] as AdminRole[],
    scope: 'global' as const,
  },
  CONFIGURE_FEATURE_FLAGS: {
    srsId: 'REQ-SA-05',
    description: 'Configure feature flags per Parent Company (enable/disable AI modules, beta features).',
    allowedRoles: ['super_admin'] as AdminRole[],
    scope: 'global' as const,
  },
  // §3.2 Global Dashboard
  VIEW_GLOBAL_DASHBOARD: {
    srsId: 'REQ-SA-06',
    description: 'View global platform dashboard: active parent companies, sub-companies, users, MRR/ARR, system health.',
    allowedRoles: ['super_admin'] as AdminRole[],
    scope: 'global' as const,
  },
  // §3.3 Context Swapping (Super Impersonation)
  SWAP_ANY_CONTEXT: {
    srsId: 'REQ-SA-07',
    description: 'Company swap: select any Parent Company or Sub-Company in the global dropdown.',
    allowedRoles: ['super_admin'] as AdminRole[],
    scope: 'global' as const,
  },
  SWITCH_BACK_TO_GLOBAL: {
    srsId: 'REQ-SA-09',
    description: 'Switch back to global platform view at any time.',
    allowedRoles: ['super_admin'] as AdminRole[],
    scope: 'global' as const,
  },
  // §3.4 AI Platform Management
  VIEW_AI_USAGE: {
    srsId: 'REQ-SA-11',
    description: 'View AI usage metrics across tenants (tokens consumed, cost analysis).',
    allowedRoles: ['super_admin'] as AdminRole[],
    scope: 'global' as const,
  },
  CONFIGURE_GLOBAL_AI: {
    srsId: 'REQ-SA-12',
    description: 'Configure global AI models and parameters (e.g. anomaly detection sensitivity).',
    allowedRoles: ['super_admin'] as AdminRole[],
    scope: 'global' as const,
  },
} as const;

// ----------------------------------------------------------------------------
// SRS §4 — TENANT ADMIN FUNCTIONAL REQUIREMENTS
// ----------------------------------------------------------------------------

export const TENANT_ADMIN_PERMISSIONS = {
  // §4.1 Sub-Company Management
  CREATE_SUB_COMPANY: {
    srsId: 'REQ-TA-01',
    description: 'Create new Sub-Companies (child entities) under their Parent Company.',
    allowedRoles: ['super_admin', 'tenant_admin'] as AdminRole[],
    scope: 'own_tenant' as const,
  },
  DEFINE_SUB_COMPANY_ATTRS: {
    srsId: 'REQ-TA-02',
    description: 'Define Country, Time Zone, Default Currency, and Local Language for Sub-Companies.',
    allowedRoles: ['super_admin', 'tenant_admin'] as AdminRole[],
    scope: 'own_tenant' as const,
  },
  ASSIGN_SUB_COMPANY_ADMINS: {
    srsId: 'REQ-TA-03',
    description: 'Assign local administrators (Managers) to specific Sub-Companies.',
    allowedRoles: ['super_admin', 'tenant_admin'] as AdminRole[],
    scope: 'own_tenant' as const,
  },
  // §4.2 Group Dashboard
  VIEW_GROUP_DASHBOARD: {
    srsId: 'REQ-TA-04',
    description: 'View consolidated dashboard for their specific group (headcount, financials, talent density, attrition).',
    allowedRoles: ['super_admin', 'tenant_admin'] as AdminRole[],
    scope: 'own_tenant' as const,
  },
  // §4.3 Context Swapping (Tenant Level)
  SWAP_OWN_CONTEXT: {
    srsId: 'REQ-TA-06',
    description: 'Company swap: dropdown containing the Parent Company and all Sub-Companies they created.',
    allowedRoles: ['super_admin', 'tenant_admin'] as AdminRole[],
    scope: 'own_tenant' as const,
  },
  // §4.4 Localization Configuration
  SET_TENANT_LANGUAGE: {
    srsId: 'REQ-TA-09',
    description: 'Set the Default Language for the Parent Company interface (cascades to sub-companies).',
    allowedRoles: ['super_admin', 'tenant_admin'] as AdminRole[],
    scope: 'own_tenant' as const,
  },
  MAP_SUB_COMPANY_CURRENCIES: {
    srsId: 'REQ-TA-10',
    description: 'Map currencies for Sub-Companies in different countries for financial reporting.',
    allowedRoles: ['super_admin', 'tenant_admin'] as AdminRole[],
    scope: 'own_tenant' as const,
  },
} as const;

// ----------------------------------------------------------------------------
// SRS §6 — RBAC MATRIX (consolidated for server-side guards)
// ----------------------------------------------------------------------------

export const RBAC_MATRIX = {
  // Company Management
  CREATE_PARENT_COMPANY: { super_admin: true,  tenant_admin: false, admin: false, srsId: 'REQ-SA-01' },
  CREATE_GROUP_COMPANY:  { super_admin: true,  tenant_admin: false, admin: false, srsId: 'SA-Group-1' },
  CREATE_SUB_COMPANY:    { super_admin: true,  tenant_admin: true,  admin: true,  srsId: 'REQ-TA-01', scope: 'own_tenant' },
  DELETE_COMPANY:        { super_admin: true,  tenant_admin: true,  admin: false, srsId: 'SA-TA-DEL',  scope: 'own_tenant' },
  EDIT_COMPANY_INFO:     { super_admin: true,  tenant_admin: true,  admin: true,  srsId: 'SA-TA-EDT',  scope: 'own_tenant' },

  // User Management
  CREATE_TENANT_ADMINS:  { super_admin: true,  tenant_admin: false, admin: false, srsId: 'SA-TA-USR-1' },
  VIEW_ALL_USERS:        { super_admin: true,  tenant_admin: true,  admin: true,  srsId: 'SA-TA-USR-2', scope: 'own_tenant' },
  IMPERSONATE_USERS:     { super_admin: true,  tenant_admin: true,  admin: false, srsId: 'SA-TA-USR-3', scope: 'own_tenant' },

  // Subscription
  VIEW_INVOICES:         { super_admin: true,  tenant_admin: true,  admin: true,  srsId: 'SA-TA-SUB-1', scope: 'own_tenant' },
  UPGRADE_PLAN:          { super_admin: true,  tenant_admin: false, admin: false, srsId: 'SA-TA-SUB-2' },

  // Dashboard
  GLOBAL_PLATFORM_STATS: { super_admin: true,  tenant_admin: false, admin: false, srsId: 'REQ-SA-06' },
  GROUP_STATS:           { super_admin: true,  tenant_admin: true,  admin: true,  srsId: 'REQ-TA-04', scope: 'own_tenant' },

  // Settings
  CONFIGURE_LANGUAGES:   { super_admin: true,  tenant_admin: false, admin: false, srsId: 'REQ-GL-01' },
  CONFIGURE_CURRENCIES:  { super_admin: true,  tenant_admin: true,  admin: true,  srsId: 'REQ-GL-04', scope: 'own_tenant' },

  // Security
  VIEW_AUDIT_LOGS:       { super_admin: true,  tenant_admin: true,  admin: true,  srsId: 'REQ-SEC-06', scope: 'own_tenant' },
  MANAGE_API_KEYS:       { super_admin: true,  tenant_admin: true,  admin: false, srsId: 'SA-TA-SEC',  scope: 'own_tenant' },
} as const;

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

/**
 * Returns true if the given role can perform the action. For tenant_admin
 * actions with scope 'own_tenant', the caller MUST also verify the target
 * resource belongs to the caller's tenant (use assertOwnTenant below).
 */
export function can(
  role: string | undefined | null,
  action: keyof typeof RBAC_MATRIX,
): boolean {
  if (!role) return false;
  if (role === 'super_admin') return RBAC_MATRIX[action].super_admin;
  if (role === 'tenant_admin') return RBAC_MATRIX[action].tenant_admin;
  if (role === 'admin') return (RBAC_MATRIX[action] as any).admin ?? false;
  return false;
}

/**
 * Returns true if the caller is allowed to act on a resource that belongs to
 * the given targetTenantId. Super admins can act on any tenant; tenant_admins
 * only on their own.
 */
export function canActOnTenant(
  role: string | undefined | null,
  callerTenantId: string | undefined | null,
  targetTenantId: string | undefined | null,
): boolean {
  if (!role) return false;
  if (role === 'super_admin') return true;
  if (role === 'tenant_admin' || role === 'admin') {
    return !!callerTenantId && !!targetTenantId && callerTenantId === targetTenantId;
  }
  return false;
}

/**
 * Throws a formatted 403 error if the role is not allowed. Useful inside
 * API route handlers.
 */
export function assertCan(
  role: string | undefined | null,
  action: keyof typeof RBAC_MATRIX,
): void {
  if (!can(role, action)) {
    const rule = RBAC_MATRIX[action];
    throw new PermissionError(
      `Action '${action}' (${rule.srsId}) is not permitted for role '${role || 'unknown'}'.`,
    );
  }
}

export class PermissionError extends Error {
  statusCode = 403;
  constructor(message: string) {
    super(message);
    this.name = 'PermissionError';
  }
}

/**
 * Returns the list of SRS requirement IDs that the given role satisfies.
 * Used to render the role's "capabilities" list on the admin pages.
 */
export function listCapabilitiesForRole(role: string): string[] {
  if (role === 'super_admin') {
    return Object.values(SUPER_ADMIN_PERMISSIONS).map((p) => p.srsId);
  }
  if (role === 'tenant_admin') {
    return Object.values(TENANT_ADMIN_PERMISSIONS).map((p) => p.srsId);
  }
  if (role === 'admin') {
    // Admin inherits tenant admin capabilities within their scope
    return Object.values(TENANT_ADMIN_PERMISSIONS).map((p) => p.srsId);
  }
  return [];
}

/**
 * The "platform base currency" used by super_admin for normalized global
 * financial reporting (REQ-GL-03). Default is INR (platform-wide default);
 * tenant-level overrides come from the Tenant.baseCurrency column.
 */
export const PLATFORM_BASE_CURRENCY = 'INR';

/**
 * The list of UI languages currently supported by the platform (REQ-GL-01).
 * Tenant admins can pick from this list; super_admin can add new languages.
 */
export const SUPPORTED_LANGUAGES: { code: string; label: string; nativeLabel: string }[] = [
  { code: 'en', label: 'English', nativeLabel: 'English' },
  { code: 'es', label: 'Spanish', nativeLabel: 'Español' },
  { code: 'fr', label: 'French', nativeLabel: 'Français' },
  { code: 'de', label: 'German', nativeLabel: 'Deutsch' },
  { code: 'pt-BR', label: 'Portuguese (Brazil)', nativeLabel: 'Português (Brasil)' },
  { code: 'hi', label: 'Hindi', nativeLabel: 'हिन्दी' },
  { code: 'zh', label: 'Chinese', nativeLabel: '中文' },
  { code: 'ja', label: 'Japanese', nativeLabel: '日本語' },
];

/**
 * Known cloud regions for data residency (REQ-GL-06).
 */
export const SUPPORTED_DATA_REGIONS: { code: string; label: string; complianceNote?: string }[] = [
  { code: 'us-east-1', label: 'US East (N. Virginia)' },
  { code: 'us-west-2', label: 'US West (Oregon)' },
  { code: 'eu-west-1', label: 'EU West (Ireland)', complianceNote: 'GDPR compliant' },
  { code: 'eu-central-1', label: 'EU Central (Frankfurt)', complianceNote: 'GDPR compliant' },
  { code: 'ap-south-1', label: 'Asia Pacific (Mumbai)' },
  { code: 'ap-southeast-1', label: 'Asia Pacific (Singapore)' },
  { code: 'ap-northeast-1', label: 'Asia Pacific (Tokyo)' },
];
