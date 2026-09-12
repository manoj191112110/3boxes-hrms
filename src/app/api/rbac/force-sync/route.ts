import { NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { neon } from '@neondatabase/serverless';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() });
}

function getNeonClient() {
  const connectionString = process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!connectionString) throw new Error('No database connection string found');
  return neon(connectionString);
}

async function dropAndRecreateRBACTables(): Promise<{ success: boolean; error?: string }> {
  try {
    const sql = getNeonClient();

    // Drop tables in reverse dependency order
    console.log('Dropping existing RBAC tables...');
    await sql`DROP TABLE IF EXISTS "UserRoleAssignment" CASCADE`;
    await sql`DROP TABLE IF EXISTS "RolePermission" CASCADE`;
    await sql`DROP TABLE IF EXISTS "Role" CASCADE`;
    await sql`DROP TABLE IF EXISTS "Permission" CASCADE`;
    await sql`DROP TABLE IF EXISTS "Module" CASCADE`;
    console.log('RBAC tables dropped.');

    // Recreate tables
    console.log('Creating RBAC tables...');
    
    await sql`CREATE TABLE IF NOT EXISTS "Module" (
      "id" TEXT NOT NULL,
      "key" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "description" TEXT,
      "category" TEXT NOT NULL,
      "icon" TEXT,
      "sortOrder" INTEGER NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "Module_pkey" PRIMARY KEY ("id")
    )`;
    
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS "Module_key_key" ON "Module"("key")`;

    await sql`CREATE TABLE IF NOT EXISTS "Permission" (
      "id" TEXT NOT NULL,
      "moduleId" TEXT NOT NULL,
      "action" TEXT NOT NULL,
      "description" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
    )`;

    await sql`CREATE UNIQUE INDEX IF NOT EXISTS "Permission_moduleId_action_key" ON "Permission"("moduleId", "action")`;
    await sql`CREATE INDEX IF NOT EXISTS "Permission_moduleId_idx" ON "Permission"("moduleId")`;

    try {
      await sql`ALTER TABLE "Permission" ADD CONSTRAINT "Permission_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE CASCADE ON UPDATE CASCADE`;
    } catch { /* constraint may already exist */ }

    await sql`CREATE TABLE IF NOT EXISTS "Role" (
      "id" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "key" TEXT NOT NULL,
      "description" TEXT,
      "isSystem" BOOLEAN NOT NULL DEFAULT false,
      "level" INTEGER NOT NULL DEFAULT 0,
      "tenantId" TEXT,
      "companyId" TEXT,
      "status" TEXT NOT NULL DEFAULT 'active',
      "createdBy" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
    )`;

    await sql`CREATE UNIQUE INDEX IF NOT EXISTS "Role_key_tenantId_companyId_key" ON "Role"("key", "tenantId", "companyId")`;
    await sql`CREATE INDEX IF NOT EXISTS "Role_tenantId_idx" ON "Role"("tenantId")`;
    await sql`CREATE INDEX IF NOT EXISTS "Role_companyId_idx" ON "Role"("companyId")`;
    await sql`CREATE INDEX IF NOT EXISTS "Role_key_idx" ON "Role"("key")`;

    try {
      await sql`ALTER TABLE "Role" ADD CONSTRAINT "Role_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE`;
    } catch { /* constraint may already exist */ }

    await sql`CREATE TABLE IF NOT EXISTS "RolePermission" (
      "id" TEXT NOT NULL,
      "roleId" TEXT NOT NULL,
      "permissionId" TEXT NOT NULL,
      "granted" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id")
    )`;

    await sql`CREATE UNIQUE INDEX IF NOT EXISTS "RolePermission_roleId_permissionId_key" ON "RolePermission"("roleId", "permissionId")`;
    await sql`CREATE INDEX IF NOT EXISTS "RolePermission_roleId_idx" ON "RolePermission"("roleId")`;
    await sql`CREATE INDEX IF NOT EXISTS "RolePermission_permissionId_idx" ON "RolePermission"("permissionId")`;

    try {
      await sql`ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE`;
    } catch { /* constraint may already exist */ }
    try {
      await sql`ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE`;
    } catch { /* constraint may already exist */ }

    await sql`CREATE TABLE IF NOT EXISTS "UserRoleAssignment" (
      "id" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "roleId" TEXT NOT NULL,
      "companyId" TEXT,
      "assignedBy" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "UserRoleAssignment_pkey" PRIMARY KEY ("id")
    )`;

    await sql`CREATE UNIQUE INDEX IF NOT EXISTS "UserRoleAssignment_userId_roleId_companyId_key" ON "UserRoleAssignment"("userId", "roleId", "companyId")`;
    await sql`CREATE INDEX IF NOT EXISTS "UserRoleAssignment_userId_idx" ON "UserRoleAssignment"("userId")`;
    await sql`CREATE INDEX IF NOT EXISTS "UserRoleAssignment_roleId_idx" ON "UserRoleAssignment"("roleId")`;
    await sql`CREATE INDEX IF NOT EXISTS "UserRoleAssignment_companyId_idx" ON "UserRoleAssignment"("companyId")`;

    try {
      await sql`ALTER TABLE "UserRoleAssignment" ADD CONSTRAINT "UserRoleAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE`;
    } catch { /* constraint may already exist */ }
    try {
      await sql`ALTER TABLE "UserRoleAssignment" ADD CONSTRAINT "UserRoleAssignment_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE`;
    } catch { /* constraint may already exist */ }

    console.log('RBAC tables created successfully');
    return { success: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Failed to create RBAC tables:', msg);
    return { success: false, error: msg };
  }
}

// Module/role/permission definitions — 3 standard roles only
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
];

const DEFAULT_ACTIONS = ['view', 'create', 'edit', 'delete', 'export', 'approve'];
const LIMITED_ACTION_MODULES = ['dashboard', 'notifications', 'docs'];
const ADMIN_ONLY_MODULES = ['super_admin', 'tenant_admin', 'ai_admin'];

// 3 standard roles only
const SYSTEM_ROLES = [
  { key: 'super_admin', name: 'Super Administrator', description: 'Full system access across all tenants — manages platform configuration, RBAC, audit logs, and all tenant operations', level: 0, isSystem: true, tenantId: null as string | null },
  { key: 'tenant_admin', name: 'Tenant Administrator', description: 'Full access within their tenant — manages company RBAC, organization settings, and all HR operations', level: 1, isSystem: true, tenantId: null as string | null },
  { key: 'admin', name: 'Administrator', description: 'Company-level admin access — manages all employees, HR operations, payroll, recruitment, onboarding, IT assets, finance, and compliance within their company', level: 2, isSystem: true },
];

const ADMIN_MODULES = ['dashboard', 'employees', 'company', 'recruitment', 'requisitions', 'offers', 'job_portal', 'ai_interview', 'onboarding', 'preboarding', 'attendance', 'leave', 'timesheets', 'payroll', 'salary_structures', 'performance', 'training', 'engagement', 'succession', 'documents', 'helpdesk', 'grievances', 'ai_assistant', 'docs', 'workflows', 'reports', 'notifications', 'settings', 'assets', 'projects', 'travel', 'expenses', 'clients', 'vendors', 'invoices', 'accounts', 'crm', 'it_admin_module', 'separation'];

async function seedRBACData(userId?: string) {
  let modulesCreated = 0, permissionsCreated = 0, rolesCreated = 0, rolePermissionsCreated = 0, userRoleAssignmentsCreated = 0;

  // Step 1: Create modules and permissions
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

  // Step 2: Create 3 system roles
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
    for (const moduleKey of moduleKeys) {
      const mod = moduleMap.get(moduleKey);
      if (!mod) continue;
      for (const perm of mod.permissions) {
        if (allowedActions && !allowedActions.includes(perm.action)) continue;
        try {
          const existing = await db.rolePermission.findUnique({ where: { roleId_permissionId: { roleId, permissionId: perm.id } } });
          if (!existing) {
            await db.rolePermission.create({ data: { roleId, permissionId: perm.id, granted: true } });
            rolePermissionsCreated++;
          }
        } catch { /* skip duplicates */ }
      }
    }
  };

  // super_admin: ALL modules, ALL actions
  if (createdRoles.super_admin) await assignPermissions(createdRoles.super_admin, MODULE_DEFINITIONS.map((m) => m.key));
  // tenant_admin: All except super_admin/tenant_admin/ai_admin modules
  if (createdRoles.tenant_admin) await assignPermissions(createdRoles.tenant_admin, MODULE_DEFINITIONS.filter((m) => !ADMIN_ONLY_MODULES.includes(m.key)).map((m) => m.key));
  // admin: Full access to all operational modules
  if (createdRoles.admin) await assignPermissions(createdRoles.admin, ADMIN_MODULES);

  // Step 4: Migrate users to new 3-role system
  const roleKeyMap: Record<string, string> = {
    super_admin: 'super_admin',
    tenant_admin: 'tenant_admin',
    hr_admin: 'admin',
    company_hr_admin: 'admin',
    finance_admin: 'admin',
    finance: 'admin',
    it_admin: 'admin',
    manager: 'admin',
    employee: 'admin',
    recruiter: 'admin',
    candidate: 'admin',
    job_seeker: 'admin',
    admin: 'admin',
    hrhead: 'admin',
    recruitmenthead: 'admin',
  };

  const users = await db.user.findMany();
  for (const user of users) {
    const newRoleKey = roleKeyMap[user.role];
    if (!newRoleKey || !createdRoles[newRoleKey]) continue;
    
    // Update User.role field
    await db.user.update({
      where: { id: user.id },
      data: { role: newRoleKey }
    });

    // Remove old role assignments and create new one
    await db.userRoleAssignment.deleteMany({ where: { userId: user.id } });
    
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

  return { modulesCreated, permissionsCreated, rolesCreated, rolePermissionsCreated, userRoleAssignmentsCreated };
}

export async function GET() {
  try {
    // Step 1: Force drop and recreate RBAC tables
    const tableResult = await dropAndRecreateRBACTables();
    if (!tableResult.success) {
      return NextResponse.json(
        { error: 'Failed to create RBAC tables', details: tableResult.error },
        { status: 500, headers: corsHeaders() }
      );
    }

    // Step 2: Seed data
    const result = await seedRBACData();

    return NextResponse.json(
      { success: true, message: 'RBAC tables created and data seeded successfully with 3 standard roles', data: result },
      { headers: corsHeaders() }
    );
  } catch (error) {
    console.error('RBAC force-sync error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to force-sync RBAC', details: errorMessage },
      { status: 500, headers: corsHeaders() }
    );
  }
}

export async function POST(request: Request) {
  const db = await getDb(request);
  try {
    // Step 1: Force drop and recreate RBAC tables
    const tableResult = await dropAndRecreateRBACTables();
    if (!tableResult.success) {
      return NextResponse.json(
        { error: 'Failed to create RBAC tables', details: tableResult.error },
        { status: 500, headers: corsHeaders() }
      );
    }

    // Step 2: Seed data
    const result = await seedRBACData();

    return NextResponse.json(
      { success: true, message: 'RBAC tables created and data seeded successfully with 3 standard roles', data: result },
      { headers: corsHeaders() }
    );
  } catch (error) {
    console.error('RBAC force-sync error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to force-sync RBAC', details: errorMessage },
      { status: 500, headers: corsHeaders() }
    );
  }
}
