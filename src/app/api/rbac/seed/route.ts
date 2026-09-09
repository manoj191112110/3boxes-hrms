import { NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { resolveAuthenticatedUser } from '@/lib/auth-resolve';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() });
}

const MODULE_DEFINITIONS = [
  { key: 'dashboard', name: 'Dashboard', category: 'Core HR', icon: 'LayoutDashboard', sortOrder: 1 },
  { key: 'employees', name: 'Employees', category: 'Core HR', icon: 'Users', sortOrder: 2 },
  { key: 'company', name: 'Company', category: 'Core HR', icon: 'Building2', sortOrder: 3 },
  { key: 'recruitment', name: 'Recruitment', category: 'Talent', icon: 'UserPlus', sortOrder: 4 },
  { key: 'requisitions', name: 'Requisitions', category: 'Talent', icon: 'ClipboardList', sortOrder: 5 },
  { key: 'offers', name: 'Offers', category: 'Talent', icon: 'FileText', sortOrder: 6 },
  { key: 'job_portal', name: 'Job Portal', category: 'Talent', icon: 'Globe', sortOrder: 7 },
  { key: 'ai_interview', name: 'AI Interview', category: 'Talent', icon: 'Bot', sortOrder: 8 },
  { key: 'onboarding', name: 'Onboarding', category: 'Lifecycle', icon: 'UserCheck', sortOrder: 9 },
  { key: 'preboarding', name: 'Preboarding', category: 'Lifecycle', icon: 'ClipboardCheck', sortOrder: 10 },
  { key: 'attendance', name: 'Attendance', category: 'Time', icon: 'Clock', sortOrder: 11 },
  { key: 'leave', name: 'Leave', category: 'Time', icon: 'CalendarOff', sortOrder: 12 },
  { key: 'timesheets', name: 'Timesheets', category: 'Time', icon: 'Timer', sortOrder: 13 },
  { key: 'payroll', name: 'Payroll', category: 'Compensation', icon: 'Banknote', sortOrder: 14 },
  { key: 'salary_structures', name: 'Salary Structures', category: 'Compensation', icon: 'Coins', sortOrder: 15 },
  { key: 'performance', name: 'Performance', category: 'Performance', icon: 'TrendingUp', sortOrder: 16 },
  { key: 'training', name: 'Training', category: 'Performance', icon: 'GraduationCap', sortOrder: 17 },
  { key: 'engagement', name: 'Engagement', category: 'Performance', icon: 'Heart', sortOrder: 18 },
  { key: 'succession', name: 'Succession', category: 'Performance', icon: 'ArrowUpRight', sortOrder: 19 },
  { key: 'projects', name: 'Projects', category: 'Operations', icon: 'FolderKanban', sortOrder: 20 },
  { key: 'travel', name: 'Travel', category: 'Operations', icon: 'Plane', sortOrder: 21 },
  { key: 'expenses', name: 'Expenses', category: 'Operations', icon: 'Receipt', sortOrder: 22 },
  { key: 'assets', name: 'Assets', category: 'Operations', icon: 'Monitor', sortOrder: 23 },
  { key: 'documents', name: 'Documents', category: 'Operations', icon: 'FileStack', sortOrder: 24 },
  { key: 'clients', name: 'Clients', category: 'External', icon: 'Handshake', sortOrder: 25 },
  { key: 'vendors', name: 'Vendors', category: 'External', icon: 'Truck', sortOrder: 26 },
  { key: 'helpdesk', name: 'Helpdesk', category: 'Support', icon: 'Headphones', sortOrder: 27 },
  { key: 'grievances', name: 'Grievances', category: 'Support', icon: 'AlertTriangle', sortOrder: 28 },
  { key: 'ai_assistant', name: 'AI Assistant', category: 'Support', icon: 'Sparkles', sortOrder: 29 },
  { key: 'docs', name: 'Documentation', category: 'Knowledge', icon: 'BookOpen', sortOrder: 30 },
  { key: 'workflows', name: 'Workflows', category: 'Governance', icon: 'GitBranch', sortOrder: 31 },
  { key: 'reports', name: 'Reports', category: 'Governance', icon: 'BarChart3', sortOrder: 32 },
  { key: 'settings', name: 'Settings', category: 'Governance', icon: 'Settings', sortOrder: 33 },
  { key: 'notifications', name: 'Notifications', category: 'Governance', icon: 'Bell', sortOrder: 34 },
  { key: 'super_admin', name: 'Super Admin', category: 'Admin', icon: 'Shield', sortOrder: 35 },
  { key: 'tenant_admin', name: 'Tenant Admin', category: 'Admin', icon: 'ShieldCheck', sortOrder: 36 },
  { key: 'ai_admin', name: 'AI Admin', category: 'Admin', icon: 'Brain', sortOrder: 37 },
  { key: 'tenant_configuration', name: 'Tenant Configuration', category: 'Admin', icon: 'Settings', sortOrder: 38 },
  { key: 'subscriptions', name: 'Subscriptions', category: 'Admin', icon: 'CreditCard', sortOrder: 39 },
  { key: 'packages', name: 'Packages', category: 'Admin', icon: 'Package', sortOrder: 40 },
  { key: 'domain_management', name: 'Domain Management', category: 'Admin', icon: 'Globe', sortOrder: 41 },
  { key: 'purchase_transactions', name: 'Purchase Transactions', category: 'Admin', icon: 'DollarSign', sortOrder: 42 },
  { key: 'tenant_usage', name: 'Tenant Usage Metrics', category: 'Admin', icon: 'BarChart2', sortOrder: 43 },
  { key: 'tenant_tickets', name: 'Tenant Support Tickets', category: 'Admin', icon: 'HelpCircle', sortOrder: 44 },
  { key: 'storage_quotas', name: 'Storage Quotas', category: 'Admin', icon: 'HardDrive', sortOrder: 45 },
  { key: 'sso_providers', name: 'SSO Providers', category: 'Admin', icon: 'Lock', sortOrder: 46 },
  { key: 'trial_requests', name: 'Trial Requests', category: 'Admin', icon: 'Briefcase', sortOrder: 47 },
  { key: 'rbac', name: 'RBAC Management', category: 'Admin', icon: 'Shield', sortOrder: 48 },
  { key: 'storage_analytics', name: 'Storage Analytics', category: 'Admin', icon: 'Database', sortOrder: 49 },
  { key: 'comm_governance', name: 'Communication Governance', category: 'Admin', icon: 'MessageCircle', sortOrder: 50 },
  { key: 'invoices', name: 'Invoices', category: 'Finance', icon: 'FileText', sortOrder: 51 },
  { key: 'accounts', name: 'Accounts', category: 'Finance', icon: 'Wallet', sortOrder: 52 },
  { key: 'crm', name: 'CRM', category: 'External', icon: 'Users', sortOrder: 53 },
  { key: 'separation', name: 'Separation', category: 'Lifecycle', icon: 'UserMinus', sortOrder: 54 },
  { key: 'insurance', name: 'Insurance', category: 'Benefits', icon: 'HeartShield', sortOrder: 55 },
  { key: 'loans', name: 'Loans', category: 'Compensation', icon: 'Banknote', sortOrder: 56 },
  { key: 'claims', name: 'Claims', category: 'Compensation', icon: 'FileCheck', sortOrder: 57 },
];

const DEFAULT_ACTIONS = ['view', 'create', 'edit', 'delete', 'export', 'approve'];
const LIMITED_ACTION_MODULES = ['dashboard', 'notifications', 'docs'];
const ADMIN_ONLY_MODULES = ['super_admin', 'ai_admin'];

// 8 predefined roles
const SYSTEM_ROLES = [
  { key: 'super_admin', name: 'Super Administrator', description: 'Full system access across all tenants — manages platform configuration, RBAC, audit logs, and all tenant operations', level: 0, isSystem: true, tenantId: null as string | null },
  { key: 'tenant_admin', name: 'Tenant Administrator', description: 'Full access within their tenant — manages company RBAC, organization settings, and all HR operations', level: 1, isSystem: true, tenantId: null as string | null },
  { key: 'hr_admin', name: 'HR Manager / HR Admin', description: 'Manages all HR operations including recruitment, onboarding, employee lifecycle, leave, attendance, performance, training, and HR policies', level: 2, isSystem: true },
  { key: 'finance_admin', name: 'Finance Manager / Finance Admin', description: 'Manages payroll, salary structures, expenses, invoices, accounts, loans, claims, and financial reporting', level: 2, isSystem: true },
  { key: 'manager', name: 'Manager', description: 'Manages team operations — view employees, approve leaves/expenses/travel, manage performance reviews, and assign tasks', level: 3, isSystem: true },
  { key: 'travel_admin', name: 'Travel Admin', description: 'Manages travel requests, approvals, policies, and travel expense settlements', level: 3, isSystem: true },
  { key: 'crm_admin', name: 'CRM Admin', description: 'Manages clients, vendors, CRM operations, and external relationship management', level: 3, isSystem: true },
  { key: 'employee', name: 'Employee', description: 'Self-service access — view own profile, apply leave/expenses/travel, submit timesheets, access helpdesk and documents', level: 4, isSystem: true },
];

// Role-specific module assignments and actions
const HR_ADMIN_FULL_MODULES = ['dashboard', 'employees', 'company', 'recruitment', 'requisitions', 'offers', 'job_portal', 'ai_interview', 'onboarding', 'preboarding', 'attendance', 'leave', 'performance', 'training', 'engagement', 'succession', 'separation', 'documents', 'helpdesk', 'grievances', 'settings', 'reports', 'notifications', 'workflows', 'insurance'];
const HR_ADMIN_LIMITED_MODULES: Record<string, string[]> = {
  timesheets: ['view', 'create', 'edit', 'export'],
  payroll: ['view', 'create', 'edit', 'export'],
  salary_structures: ['view', 'create', 'edit', 'export'],
  assets: ['view', 'create', 'edit', 'export'],
  ai_assistant: ['view', 'create', 'edit', 'export'],
  docs: ['view', 'create', 'edit', 'export'],
};

const FINANCE_ADMIN_FULL_MODULES = ['dashboard', 'payroll', 'salary_structures', 'expenses', 'invoices', 'accounts', 'loans', 'claims', 'timesheets', 'reports', 'settings'];
const FINANCE_ADMIN_LIMITED_MODULES: Record<string, string[]> = {
  employees: ['view', 'create', 'edit', 'export'],
  company: ['view', 'create', 'edit', 'export'],
  attendance: ['view', 'create', 'edit', 'export'],
  leave: ['view', 'create', 'edit', 'export'],
  documents: ['view', 'create', 'edit', 'export'],
  notifications: ['view', 'create', 'edit', 'export'],
  travel: ['view', 'create', 'edit', 'export'],
};

const MANAGER_FULL_MODULES: string[] = []; // No full-action modules for manager
const MANAGER_LIMITED_MODULES: Record<string, string[]> = {
  dashboard: ['view', 'create', 'edit', 'approve'],
  employees: ['view', 'create', 'edit', 'approve'],
  attendance: ['view', 'create', 'edit', 'approve'],
  leave: ['view', 'create', 'edit', 'approve'],
  timesheets: ['view', 'create', 'edit', 'approve'],
  performance: ['view', 'create', 'edit', 'approve'],
  training: ['view', 'create', 'edit', 'approve'],
  engagement: ['view', 'create', 'edit', 'approve'],
  succession: ['view', 'create', 'edit', 'approve'],
  expenses: ['view', 'create', 'edit', 'approve'],
  travel: ['view', 'create', 'edit', 'approve'],
  projects: ['view', 'create', 'edit', 'approve'],
  reports: ['view', 'create', 'edit', 'approve'],
};
const MANAGER_VIEW_ONLY_MODULES = ['payroll', 'salary_structures', 'company', 'recruitment', 'onboarding', 'documents', 'notifications', 'helpdesk'];

const TRAVEL_ADMIN_FULL_MODULES = ['dashboard', 'travel', 'expenses', 'reports', 'settings', 'docs', 'notifications'];
const TRAVEL_ADMIN_LIMITED_MODULES: Record<string, string[]> = {
  employees: ['view', 'create', 'edit'],
  company: ['view', 'create', 'edit'],
  documents: ['view', 'create', 'edit'],
};

const CRM_ADMIN_FULL_MODULES = ['dashboard', 'clients', 'vendors', 'reports', 'settings', 'docs', 'notifications'];
const CRM_ADMIN_LIMITED_MODULES: Record<string, string[]> = {
  employees: ['view', 'create', 'edit'],
  expenses: ['view', 'create', 'edit'],
  invoices: ['view', 'create', 'edit'],
  accounts: ['view', 'create', 'edit'],
  documents: ['view', 'create', 'edit'],
};

const EMPLOYEE_VIEW_ONLY_MODULES = ['dashboard', 'company', 'insurance', 'helpdesk', 'grievances', 'documents', 'notifications', 'docs'];
const EMPLOYEE_SELF_SERVICE_MODULES: Record<string, string[]> = {
  leave: ['view', 'create'],
  attendance: ['view', 'create'],
  timesheets: ['view', 'create'],
  expenses: ['view', 'create'],
  travel: ['view', 'create'],
  training: ['view', 'create'],
  assets: ['view', 'create'],
  performance: ['view', 'create'],
};

async function seedRBACData(userId?: string) {
  let modulesCreated = 0, permissionsCreated = 0, rolesCreated = 0, rolePermissionsCreated = 0, userRoleAssignmentsCreated = 0;

  // Step 1: Create/update modules and permissions
  for (const modDef of MODULE_DEFINITIONS) {
    const existingModule = await db.module.findUnique({ where: { key: modDef.key } });
    if (!existingModule) {
      const createdModule = await db.module.create({ data: { key: modDef.key, name: modDef.name, category: modDef.category, icon: modDef.icon, sortOrder: modDef.sortOrder } });
      const actions = LIMITED_ACTION_MODULES.includes(modDef.key) ? ['view'] : DEFAULT_ACTIONS;
      for (const action of actions) {
        await db.permission.create({ data: { moduleId: createdModule.id, action, description: `${action} ${modDef.name.toLowerCase()}` } });
        permissionsCreated++;
      }
      modulesCreated++;
    }
  }

  // Step 2: Create standard roles — remove any non-standard roles
  // First, delete all existing roles that are NOT in the standard 8
  const standardKeys = SYSTEM_ROLES.map(r => r.key);
  const nonStandardRoles = await db.role.findMany({
    where: { key: { notIn: standardKeys } }
  });
  for (const role of nonStandardRoles) {
    // Delete role permissions and user assignments first (cascade should handle this)
    await db.rolePermission.deleteMany({ where: { roleId: role.id } });
    await db.userRoleAssignment.deleteMany({ where: { roleId: role.id } });
    await db.role.delete({ where: { id: role.id } });
  }

  const createdRoles: Record<string, string> = {};
  for (const roleDef of SYSTEM_ROLES) {
    let existingRole;
    if (roleDef.tenantId === null) {
      existingRole = await db.role.findFirst({ where: { key: roleDef.key, tenantId: null, companyId: null } });
    } else {
      const tenants = await getPlatformDb().tenant.findMany({ take: 1 });
      if (tenants.length === 0) continue;
      existingRole = await db.role.findFirst({ where: { key: roleDef.key, tenantId: tenants[0].id, companyId: null } });
    }
    if (!existingRole) {
      let roleTenantId = roleDef.tenantId;
      if (roleTenantId === null && roleDef.key !== 'super_admin' && roleDef.key !== 'tenant_admin') {
        const tenants = await getPlatformDb().tenant.findMany({ take: 1 });
        roleTenantId = tenants.length > 0 ? tenants[0].id : null;
      }
      const role = await db.role.create({ data: { name: roleDef.name, key: roleDef.key, description: roleDef.description, isSystem: roleDef.isSystem, level: roleDef.level, tenantId: roleTenantId, status: 'active', createdBy: userId || null } });
      createdRoles[roleDef.key] = role.id;
      rolesCreated++;
    } else {
      // Update existing role with current name/description
      await db.role.update({
        where: { id: existingRole.id },
        data: { name: roleDef.name, description: roleDef.description, level: roleDef.level, isSystem: roleDef.isSystem }
      });
      createdRoles[roleDef.key] = existingRole.id;
    }
  }

  // Step 3: Assign permissions to roles
  const allModules = await db.module.findMany({ include: { permissions: true } });
  const moduleMap = new Map(allModules.map((m) => [m.key, m]));

  const assignPermissions = async (roleId: string, moduleKeys: string[], allowedActions?: string[]) => {
    // Clear existing permissions first for clean slate
    await db.rolePermission.deleteMany({ where: { roleId } });
    
    for (const moduleKey of moduleKeys) {
      const mod = moduleMap.get(moduleKey);
      if (!mod) continue;
      for (const perm of mod.permissions) {
        if (allowedActions && !allowedActions.includes(perm.action)) continue;
        try {
          await db.rolePermission.create({ data: { roleId, permissionId: perm.id, granted: true } });
          rolePermissionsCreated++;
        } catch { /* skip duplicates */ }
      }
    }
  };

  // super_admin: ALL modules, ALL actions (including Admin category)
  if (createdRoles.super_admin) await assignPermissions(createdRoles.super_admin, MODULE_DEFINITIONS.map((m) => m.key));
  
  // tenant_admin: All except super_admin/ai_admin modules
  if (createdRoles.tenant_admin) await assignPermissions(createdRoles.tenant_admin, MODULE_DEFINITIONS.filter((m) => !ADMIN_ONLY_MODULES.includes(m.key)).map((m) => m.key));
  
  // hr_admin: Full actions on HR modules, limited on others
  if (createdRoles.hr_admin) {
    await assignPermissions(createdRoles.hr_admin, HR_ADMIN_FULL_MODULES, ['view', 'create', 'edit', 'delete', 'export', 'approve']);
    for (const [moduleKey, actions] of Object.entries(HR_ADMIN_LIMITED_MODULES)) {
      const mod = moduleMap.get(moduleKey);
      if (!mod) continue;
      for (const perm of mod.permissions) {
        if (!actions.includes(perm.action)) continue;
        try {
          await db.rolePermission.create({ data: { roleId: createdRoles.hr_admin, permissionId: perm.id, granted: true } });
          rolePermissionsCreated++;
        } catch { /* skip duplicates */ }
      }
    }
  }

  // finance_admin: Full actions on finance modules, limited on others
  if (createdRoles.finance_admin) {
    await assignPermissions(createdRoles.finance_admin, FINANCE_ADMIN_FULL_MODULES, ['view', 'create', 'edit', 'delete', 'export', 'approve']);
    for (const [moduleKey, actions] of Object.entries(FINANCE_ADMIN_LIMITED_MODULES)) {
      const mod = moduleMap.get(moduleKey);
      if (!mod) continue;
      for (const perm of mod.permissions) {
        if (!actions.includes(perm.action)) continue;
        try {
          await db.rolePermission.create({ data: { roleId: createdRoles.finance_admin, permissionId: perm.id, granted: true } });
          rolePermissionsCreated++;
        } catch { /* skip duplicates */ }
      }
    }
  }

  // manager: View+create+edit+approve on team modules, view only on others
  if (createdRoles.manager) {
    await assignPermissions(createdRoles.manager, MANAGER_FULL_MODULES, ['view', 'create', 'edit', 'delete', 'export', 'approve']);
    for (const [moduleKey, actions] of Object.entries(MANAGER_LIMITED_MODULES)) {
      const mod = moduleMap.get(moduleKey);
      if (!mod) continue;
      for (const perm of mod.permissions) {
        if (!actions.includes(perm.action)) continue;
        try {
          await db.rolePermission.create({ data: { roleId: createdRoles.manager, permissionId: perm.id, granted: true } });
          rolePermissionsCreated++;
        } catch { /* skip duplicates */ }
      }
    }
    for (const moduleKey of MANAGER_VIEW_ONLY_MODULES) {
      const mod = moduleMap.get(moduleKey);
      if (!mod) continue;
      for (const perm of mod.permissions) {
        if (perm.action !== 'view') continue;
        try {
          await db.rolePermission.create({ data: { roleId: createdRoles.manager, permissionId: perm.id, granted: true } });
          rolePermissionsCreated++;
        } catch { /* skip duplicates */ }
      }
    }
  }

  // travel_admin: Full access on travel modules, limited on others
  if (createdRoles.travel_admin) {
    await assignPermissions(createdRoles.travel_admin, TRAVEL_ADMIN_FULL_MODULES, ['view', 'create', 'edit', 'delete', 'export', 'approve']);
    for (const [moduleKey, actions] of Object.entries(TRAVEL_ADMIN_LIMITED_MODULES)) {
      const mod = moduleMap.get(moduleKey);
      if (!mod) continue;
      for (const perm of mod.permissions) {
        if (!actions.includes(perm.action)) continue;
        try {
          await db.rolePermission.create({ data: { roleId: createdRoles.travel_admin, permissionId: perm.id, granted: true } });
          rolePermissionsCreated++;
        } catch { /* skip duplicates */ }
      }
    }
  }

  // crm_admin: Full access on CRM modules, limited on others
  if (createdRoles.crm_admin) {
    await assignPermissions(createdRoles.crm_admin, CRM_ADMIN_FULL_MODULES, ['view', 'create', 'edit', 'delete', 'export', 'approve']);
    for (const [moduleKey, actions] of Object.entries(CRM_ADMIN_LIMITED_MODULES)) {
      const mod = moduleMap.get(moduleKey);
      if (!mod) continue;
      for (const perm of mod.permissions) {
        if (!actions.includes(perm.action)) continue;
        try {
          await db.rolePermission.create({ data: { roleId: createdRoles.crm_admin, permissionId: perm.id, granted: true } });
          rolePermissionsCreated++;
        } catch { /* skip duplicates */ }
      }
    }
  }

  // employee: View only + self-service create
  if (createdRoles.employee) {
    for (const moduleKey of EMPLOYEE_VIEW_ONLY_MODULES) {
      const mod = moduleMap.get(moduleKey);
      if (!mod) continue;
      for (const perm of mod.permissions) {
        if (perm.action !== 'view') continue;
        try {
          await db.rolePermission.create({ data: { roleId: createdRoles.employee, permissionId: perm.id, granted: true } });
          rolePermissionsCreated++;
        } catch { /* skip duplicates */ }
      }
    }
    for (const [moduleKey, actions] of Object.entries(EMPLOYEE_SELF_SERVICE_MODULES)) {
      const mod = moduleMap.get(moduleKey);
      if (!mod) continue;
      for (const perm of mod.permissions) {
        if (!actions.includes(perm.action)) continue;
        try {
          await db.rolePermission.create({ data: { roleId: createdRoles.employee, permissionId: perm.id, granted: true } });
          rolePermissionsCreated++;
        } catch { /* skip duplicates */ }
      }
    }
  }

  // Step 4: Migrate users to the new 8-role system
  const roleKeyMap: Record<string, string> = {
    super_admin: 'super_admin',
    tenant_admin: 'tenant_admin',
    hr_admin: 'hr_admin',
    company_hr_admin: 'hr_admin',
    hrhead: 'hr_admin',
    recruitmenthead: 'hr_admin',
    finance_admin: 'finance_admin',
    finance: 'finance_admin',
    it_admin: 'hr_admin',
    manager: 'manager',
    travel_admin: 'travel_admin',
    crm_admin: 'crm_admin',
    employee: 'employee',
    recruiter: 'hr_admin',
    candidate: 'employee',
    job_seeker: 'employee',
    admin: 'hr_admin',
  };

  const users = await db.user.findMany();
  for (const user of users) {
    const newRoleKey = roleKeyMap[user.role];
    if (!newRoleKey || !createdRoles[newRoleKey]) continue;
    
    // Update User.role field to new role
    await db.user.update({
      where: { id: user.id },
      data: { role: newRoleKey }
    });

    // Remove existing role assignments
    await db.userRoleAssignment.deleteMany({ where: { userId: user.id } });

    // Create new role assignment
    const companies = await db.company.findMany({ take: 1 });
    try {
      await db.userRoleAssignment.create({
        data: {
          userId: user.id,
          roleId: createdRoles[newRoleKey],
          companyId: companies.length > 0 && newRoleKey !== 'super_admin' && newRoleKey !== 'tenant_admin' ? companies[0].id : null,
          assignedBy: userId || null
        }
      });
      userRoleAssignmentsCreated++;
    } catch { /* skip */ }
  }

  return { modulesCreated, permissionsCreated, rolesCreated, rolePermissionsCreated, userRoleAssignmentsCreated, nonStandardRolesRemoved: nonStandardRoles.length };
}

export async function GET() {
  try {
    const result = await seedRBACData();
    return NextResponse.json({ success: true, message: 'RBAC data seeded successfully with 8 predefined roles', data: result }, { headers: corsHeaders() });
  } catch (error) {
    console.error('RBAC seed error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const isTableMissing = errorMessage.includes('does not exist') || errorMessage.includes('relation') || errorMessage.includes('table') || errorMessage.includes('Invalid');
    return NextResponse.json(
      { 
        error: 'Failed to seed RBAC data', 
        details: errorMessage,
        tableMissing: isTableMissing,
        hint: isTableMissing 
          ? 'RBAC tables are missing from the database. Please redeploy the application (push to main branch) so that "prisma db push" runs during the build and creates the required tables. Also ensure POSTGRES_PRISMA_URL environment variable is set in Vercel.'
          : undefined
      }, 
      { status: 500, headers: corsHeaders() }
    );
  }
}

export async function POST(request: Request) {
  const db = await getDb(request);
  try {
    const { user } = await resolveAuthenticatedUser(request);
    if (!user || (user.role !== 'super_admin' && user.role !== 'tenant_admin')) return NextResponse.json({ error: 'Only administrators can seed RBAC data' }, { status: 403, headers: corsHeaders() });
    
    const result = await seedRBACData(user.id);
    return NextResponse.json({ success: true, message: 'RBAC data seeded successfully with 8 predefined roles', data: result }, { headers: corsHeaders() });
  } catch (error) {
    console.error('RBAC seed error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const isTableMissing = errorMessage.includes('does not exist') || errorMessage.includes('relation') || errorMessage.includes('table') || errorMessage.includes('Invalid');
    return NextResponse.json(
      { 
        error: 'Failed to seed RBAC data', 
        details: errorMessage,
        tableMissing: isTableMissing,
        hint: isTableMissing 
          ? 'RBAC tables are missing from the database. Please redeploy the application (push to main branch) so that "prisma db push" runs during the build and creates the required tables.'
          : undefined
      }, 
      { status: 500, headers: corsHeaders() }
    );
  }
}
