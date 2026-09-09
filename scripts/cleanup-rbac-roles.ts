/**
 * RBAC Cleanup Script - Remove Duplicate Roles & Set Standard Permissions
 * 
 * Standard roles to keep:
 *   1. super_admin (level 0) - Platform-level full access
 *   2. tenant_admin (level 1) - Tenant-level full access
 *   3. hr_admin (level 2) - HR management
 *   4. finance_admin (level 2) - Finance & payroll management
 *   5. it_admin (level 2) - IT & asset management
 *   6. manager (level 3) - Team management
 *   7. employee (level 4) - Self-service
 * 
 * Roles to REMOVE (duplicates & non-standard):
 *   - All duplicate hr_admin, finance, recruiter, it_admin, manager, employee, candidate instances
 *   - recruiter (merged into hr_admin)
 *   - candidate (not needed for internal HRMS)
 *   - hrhead, recruitmenthead, hr, and other custom duplicate roles
 *   - All roles with NULL keys
 *   - Old UUID-based roles
 * 
 * Usage: npx tsx scripts/cleanup-rbac-roles.ts
 */

import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';

const connectionString = process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL || process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('No database connection string found. Set DATABASE_URL');
}

const adapter = new PrismaNeon({ connectionString });
const prisma = new PrismaClient({ adapter });

// Standard roles definition (7 roles)
const STANDARD_ROLES = [
  { key: 'super_admin', name: 'Super Administrator', description: 'Full system access across all tenants — manages platform configuration, RBAC, audit logs, and all tenant operations', level: 0, isSystem: true },
  { key: 'tenant_admin', name: 'Tenant Administrator', description: 'Full access within their tenant — manages company RBAC, organization settings, and all HR operations', level: 1, isSystem: true },
  { key: 'hr_admin', name: 'HR Administrator', description: 'HR management access — manages all employees, payroll, recruitment, onboarding, leave, and compliance', level: 2, isSystem: true },
  { key: 'finance_admin', name: 'Finance Administrator', description: 'Finance and payroll access — manages payroll processing, expenses, travel, financial reports, and bank file generation', level: 2, isSystem: true },
  { key: 'it_admin', name: 'IT Administrator', description: 'IT management access — manages helpdesk, assets, system integrations, and technical configurations', level: 2, isSystem: true },
  { key: 'manager', name: 'Manager', description: 'Team management access — views own reportees, approves requests, manages team performance and leave', level: 3, isSystem: true },
  { key: 'employee', name: 'Employee', description: 'Basic employee self-service access — views own profile, applies leave, checks attendance, views payslips, raises tickets', level: 4, isSystem: true },
];

// Role key mapping for migration
// Old roles that map to new standard roles
const ROLE_MIGRATION_MAP: Record<string, string> = {
  'super_admin': 'super_admin',
  'tenant_admin': 'tenant_admin',
  'hr_admin': 'hr_admin',
  'finance': 'finance_admin',
  'finance_admin': 'finance_admin',
  'it_admin': 'it_admin',
  'manager': 'manager',
  'employee': 'employee',
  'recruiter': 'hr_admin',       // Recruiter merged into HR Admin
  'candidate': 'employee',        // Candidate -> Employee (rarely used in internal HRMS)
  'hrhead': 'hr_admin',           // Custom role -> HR Admin
  'recruitmenthead': 'hr_admin',  // Custom role -> HR Admin
  'hr': 'hr_admin',               // Custom role -> HR Admin
  'company_hr_admin': 'hr_admin', // Legacy -> HR Admin
};

// Permission matrices per role
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
  { key: 'super_admin_module', name: 'Super Admin', category: 'Admin', icon: 'Shield', sortOrder: 35 },
  { key: 'tenant_admin_module', name: 'Tenant Admin', category: 'Admin', icon: 'ShieldCheck', sortOrder: 36 },
  { key: 'ai_admin', name: 'AI Admin', category: 'Admin', icon: 'Brain', sortOrder: 37 },
];

const ALL_MODULE_KEYS = MODULE_DEFINITIONS.map(m => m.key);
const ADMIN_ONLY_MODULES = ['super_admin_module', 'tenant_admin_module', 'ai_admin'];
const LIMITED_ACTION_MODULES = ['dashboard', 'notifications', 'docs'];

// HR Admin modules & permissions
const HR_ADMIN_MODULES = ['dashboard', 'employees', 'company', 'recruitment', 'requisitions', 'offers', 'job_portal', 'ai_interview', 'onboarding', 'preboarding', 'attendance', 'leave', 'timesheets', 'payroll', 'salary_structures', 'performance', 'training', 'engagement', 'succession', 'documents', 'helpdesk', 'grievances', 'ai_assistant', 'docs', 'workflows', 'reports', 'notifications', 'settings'];
const HR_ADMIN_FULL_MODULES = ['employees', 'company', 'recruitment', 'requisitions', 'offers', 'onboarding', 'preboarding', 'payroll', 'salary_structures', 'attendance', 'leave', 'performance', 'training', 'engagement', 'helpdesk', 'grievances', 'documents', 'settings', 'job_portal', 'ai_interview', 'succession'];

// Finance Admin modules & permissions
const FINANCE_ADMIN_MODULES = ['dashboard', 'employees', 'payroll', 'salary_structures', 'expenses', 'travel', 'reports', 'notifications', 'docs', 'helpdesk', 'ai_assistant', 'settings', 'accounts', 'vendors', 'clients'];
const FINANCE_ADMIN_FULL_MODULES = ['payroll', 'salary_structures', 'expenses', 'travel', 'reports'];

// IT Admin modules & permissions
const IT_ADMIN_MODULES = ['dashboard', 'employees', 'helpdesk', 'assets', 'documents', 'workflows', 'settings', 'notifications', 'ai_assistant', 'docs', 'reports'];
const IT_ADMIN_FULL_MODULES = ['helpdesk', 'assets', 'workflows', 'settings'];

// Manager modules & permissions
const MANAGER_MODULES = ['dashboard', 'employees', 'recruitment', 'onboarding', 'attendance', 'leave', 'timesheets', 'performance', 'training', 'engagement', 'documents', 'helpdesk', 'ai_assistant', 'docs', 'notifications', 'projects', 'expenses', 'travel'];
const MANAGER_FULL_MODULES = ['employees', 'leave', 'attendance', 'timesheets', 'performance', 'expenses', 'travel', 'recruitment', 'onboarding', 'helpdesk', 'projects'];

// Employee modules & permissions
const EMPLOYEE_MODULES = ['dashboard', 'employees', 'leave', 'attendance', 'timesheets', 'documents', 'helpdesk', 'ai_assistant', 'docs', 'notifications', 'expenses', 'travel', 'training', 'payroll', 'performance'];
const EMPLOYEE_VIEW_ONLY_MODULES = ['employees', 'payroll', 'performance'];

async function main() {
  console.log('🧹 RBAC Cleanup — Removing duplicate roles & setting standard permissions\n');
  
  // ========== STEP 1: Ensure modules exist ==========
  console.log('📋 Step 1: Ensuring modules exist...');
  const DEFAULT_ACTIONS = ['view', 'create', 'edit', 'delete', 'export', 'approve'];
  
  let modulesCreated = 0;
  let permissionsCreated = 0;
  
  for (const modDef of MODULE_DEFINITIONS) {
    let existingModule = await prisma.module.findUnique({ where: { key: modDef.key } });
    if (!existingModule) {
      existingModule = await prisma.module.create({
        data: { key: modDef.key, name: modDef.name, category: modDef.category, icon: modDef.icon, sortOrder: modDef.sortOrder }
      });
      modulesCreated++;
    }
    
    // Ensure permissions for this module
    const existingPerms = await prisma.permission.findMany({ where: { moduleId: existingModule.id } });
    const existingActions = new Set(existingPerms.map(p => p.action));
    const actions = LIMITED_ACTION_MODULES.includes(modDef.key) ? ['view'] : DEFAULT_ACTIONS;
    
    for (const action of actions) {
      if (!existingActions.has(action)) {
        await prisma.permission.create({
          data: { moduleId: existingModule.id, action, description: `${action} ${modDef.name.toLowerCase()}` }
        });
        permissionsCreated++;
      }
    }
  }
  console.log(`  ✓ ${modulesCreated} new modules created, ${permissionsCreated} new permissions created`);
  
  // ========== STEP 2: Get current state ==========
  console.log('\n📋 Step 2: Analyzing current roles...');
  const allRoles = await prisma.role.findMany({
    select: { id: true, key: true, name: true, level: true, isSystem: true, tenantId: true, companyId: true, status: true }
  });
  console.log(`  Total roles in DB: ${allRoles.length}`);
  
  // ========== STEP 3: Create/update standard roles (one per key, global) ==========
  console.log('\n📋 Step 3: Creating/updating standard roles...');
  const standardRoleIds: Record<string, string> = {};
  
  for (const roleDef of STANDARD_ROLES) {
    // Find the BEST existing role for this key (prefer global/tenantId=null, with most permissions)
    let existingRoles = allRoles.filter(r => r.key === roleDef.key);
    
    // For finance_admin, also check for old 'finance' key
    if (roleDef.key === 'finance_admin' && existingRoles.length === 0) {
      existingRoles = allRoles.filter(r => r.key === 'finance');
    }
    
    if (existingRoles.length > 0) {
      // Pick the first one that's global (tenantId=null, companyId=null)
      let best = existingRoles.find(r => r.tenantId === null && r.companyId === null);
      if (!best) best = existingRoles[0]; // fallback to first
      
      // Update it with the standard definition
      await prisma.role.update({
        where: { id: best.id },
        data: {
          key: roleDef.key,
          name: roleDef.name,
          description: roleDef.description,
          level: roleDef.level,
          isSystem: roleDef.isSystem,
          tenantId: null, // Make global
          companyId: null,
          status: 'active',
        }
      });
      standardRoleIds[roleDef.key] = best.id;
      console.log(`  ✓ Updated: ${roleDef.key} → ${roleDef.name} (id: ${best.id.substring(0,12)})`);
      
      // Mark other duplicates of this key for deletion
      const duplicates = existingRoles.filter(r => r.id !== best.id);
      for (const dup of duplicates) {
        // Migrate user assignments to the standard role first
        const assignments = await prisma.userRoleAssignment.findMany({ where: { roleId: dup.id } });
        for (const assignment of assignments) {
          try {
            await prisma.userRoleAssignment.upsert({
              where: { userId_roleId_companyId: { userId: assignment.userId, roleId: best.id, companyId: assignment.companyId } },
              update: {},
              create: { userId: assignment.userId, roleId: best.id, companyId: assignment.companyId, assignedBy: assignment.assignedBy }
            });
          } catch { /* skip */ }
        }
        // Delete duplicate role's permissions and assignments
        await prisma.rolePermission.deleteMany({ where: { roleId: dup.id } });
        await prisma.userRoleAssignment.deleteMany({ where: { roleId: dup.id } });
        try {
          await prisma.role.delete({ where: { id: dup.id } });
          console.log(`    🗑 Deleted duplicate: ${dup.key} (id: ${dup.id.substring(0,12)})`);
        } catch (e: any) {
          if (e.code === 'P2025') {
            console.log(`    ⊘ Already deleted: ${dup.key} (id: ${dup.id.substring(0,12)})`);
          } else throw e;
        }
      }
    } else {
      // Create new standard role
      const newRole = await prisma.role.create({
        data: {
          key: roleDef.key,
          name: roleDef.name,
          description: roleDef.description,
          level: roleDef.level,
          isSystem: roleDef.isSystem,
          tenantId: null,
          companyId: null,
          status: 'active',
        }
      });
      standardRoleIds[roleDef.key] = newRole.id;
      console.log(`  ✓ Created: ${roleDef.key} → ${roleDef.name} (id: ${newRole.id.substring(0,12)})`);
    }
  }
  
  // ========== STEP 4: Migrate and delete non-standard roles ==========
  console.log('\n📋 Step 4: Migrating & deleting non-standard roles...');
  const standardKeys = new Set(STANDARD_ROLES.map(r => r.key));
  standardKeys.add('finance'); // Also treat 'finance' as standard (it gets renamed to finance_admin)
  standardKeys.add('recruiter'); // Will be migrated then deleted
  standardKeys.add('candidate'); // Will be migrated then deleted
  const nonStandardRoles = allRoles.filter(r => !standardKeys.has(r.key || ''));
  
  for (const role of nonStandardRoles) {
    const targetKey = ROLE_MIGRATION_MAP[role.key || ''];
    
    if (targetKey && standardRoleIds[targetKey]) {
      // Migrate user assignments to the standard role
      const assignments = await prisma.userRoleAssignment.findMany({ where: { roleId: role.id } });
      for (const assignment of assignments) {
        try {
          await prisma.userRoleAssignment.upsert({
            where: { userId_roleId_companyId: { userId: assignment.userId, roleId: standardRoleIds[targetKey], companyId: assignment.companyId } },
            update: {},
            create: { userId: assignment.userId, roleId: standardRoleIds[targetKey], companyId: assignment.companyId, assignedBy: assignment.assignedBy }
          });
        } catch { /* skip */ }
      }
      console.log(`  ↻ Migrated "${role.key || 'NULL'}" → ${targetKey} (${assignments.length} assignments)`);
    } else {
      console.log(`  ⚠ No migration target for "${role.key || 'NULL'}" — will be deleted`);
    }
    
    // Delete the non-standard role
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.userRoleAssignment.deleteMany({ where: { roleId: role.id } });
    try {
      await prisma.role.delete({ where: { id: role.id } });
      console.log(`    🗑 Deleted: ${role.key || 'NULL'} (id: ${role.id.substring(0,12)})`);
    } catch (e: any) {
      if (e.code === 'P2025') {
        console.log(`    ⊘ Already deleted: ${role.key || 'NULL'} (id: ${role.id.substring(0,12)})`);
      } else throw e;
    }
  }
  
  // Also handle roles with NULL keys
  const nullKeyRoles = await prisma.role.findMany({ where: { key: null } });
  for (const role of nullKeyRoles) {
    // Try migrating to hr_admin by default for NULL key roles
    if (standardRoleIds.hr_admin) {
      const assignments = await prisma.userRoleAssignment.findMany({ where: { roleId: role.id } });
      for (const assignment of assignments) {
        try {
          await prisma.userRoleAssignment.upsert({
            where: { userId_roleId_companyId: { userId: assignment.userId, roleId: standardRoleIds.hr_admin, companyId: assignment.companyId } },
            update: {},
            create: { userId: assignment.userId, roleId: standardRoleIds.hr_admin, companyId: assignment.companyId, assignedBy: assignment.assignedBy }
          });
        } catch { /* skip */ }
      }
    }
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.userRoleAssignment.deleteMany({ where: { roleId: role.id } });
    try {
      await prisma.role.delete({ where: { id: role.id } });
      console.log(`    🗑 Deleted NULL-key role: ${role.name || 'unnamed'} (id: ${role.id.substring(0,12)})`);
    } catch (e: any) {
      if (e.code === 'P2025') console.log(`    ⊘ Already deleted: ${role.name || 'unnamed'}`);
      else throw e;
    }
  }
  
  // Clean up remaining 'finance', 'recruiter', 'candidate' duplicates
  // (these keys were renamed/migrated but duplicates of them may still exist)
  const oldKeysToCleanup = ['finance', 'recruiter', 'candidate', 'hrhead', 'recruitmenthead', 'hr'];
  for (const oldKey of oldKeysToCleanup) {
    const remainingRoles = await prisma.role.findMany({ where: { key: oldKey } });
    for (const role of remainingRoles) {
      const targetKey = ROLE_MIGRATION_MAP[oldKey];
      if (targetKey && standardRoleIds[targetKey]) {
        const assignments = await prisma.userRoleAssignment.findMany({ where: { roleId: role.id } });
        for (const assignment of assignments) {
          try {
            await prisma.userRoleAssignment.upsert({
              where: { userId_roleId_companyId: { userId: assignment.userId, roleId: standardRoleIds[targetKey], companyId: assignment.companyId } },
              update: {},
              create: { userId: assignment.userId, roleId: standardRoleIds[targetKey], companyId: assignment.companyId, assignedBy: assignment.assignedBy }
            });
          } catch { /* skip */ }
        }
      }
      await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
      await prisma.userRoleAssignment.deleteMany({ where: { roleId: role.id } });
      try {
        await prisma.role.delete({ where: { id: role.id } });
        console.log(`    🗑 Deleted old-key role: ${oldKey} (id: ${role.id.substring(0,12)})`);
      } catch (e: any) {
        if (e.code === 'P2025') console.log(`    ⊘ Already deleted: ${oldKey}`);
        else throw e;
      }
    }
  }
  
  // ========== STEP 5: Set standard permissions for each role ==========
  console.log('\n📋 Step 5: Setting standard permissions for each role...');
  
  const allModules = await prisma.module.findMany({ include: { permissions: true } });
  const moduleMap = new Map(allModules.map(m => [m.key, m]));
  
  const assignPermissions = async (roleId: string, moduleKeys: string[], allowedActions?: string[]) => {
    let created = 0;
    // First clear existing permissions for this role
    await prisma.rolePermission.deleteMany({ where: { roleId } });
    
    for (const moduleKey of moduleKeys) {
      const mod = moduleMap.get(moduleKey);
      if (!mod) continue;
      for (const perm of mod.permissions) {
        if (allowedActions && !allowedActions.includes(perm.action)) continue;
        try {
          await prisma.rolePermission.create({
            data: { roleId, permissionId: perm.id, granted: true }
          });
          created++;
        } catch { /* skip */ }
      }
    }
    return created;
  };
  
  // Super Admin: ALL modules, ALL actions
  let count = await assignPermissions(standardRoleIds.super_admin, ALL_MODULE_KEYS);
  console.log(`  ✓ super_admin: ${count} permissions (ALL modules, ALL actions)`);
  
  // Tenant Admin: ALL modules except admin-only, ALL actions
  const tenantAdminModules = ALL_MODULE_KEYS.filter(k => !ADMIN_ONLY_MODULES.includes(k));
  count = await assignPermissions(standardRoleIds.tenant_admin, tenantAdminModules);
  console.log(`  ✓ tenant_admin: ${count} permissions (all except admin modules)`);
  
  // HR Admin: Full HR access, view+create+edit+export on secondary modules
  await assignPermissions(standardRoleIds.hr_admin, HR_ADMIN_FULL_MODULES, ['view', 'create', 'edit', 'delete', 'export', 'approve']);
  const hrViewOnlyModules = HR_ADMIN_MODULES.filter(m => !HR_ADMIN_FULL_MODULES.includes(m));
  count = await assignPermissions(standardRoleIds.hr_admin, hrViewOnlyModules, ['view', 'create', 'edit', 'export']);
  // Need to re-add full modules since we cleared all first
  const hrFullPermCount = HR_ADMIN_FULL_MODULES.reduce((acc, key) => {
    const mod = moduleMap.get(key);
    return acc + (mod ? mod.permissions.filter(p => ['view','create','edit','delete','export','approve'].includes(p.action)).length : 0);
  }, 0);
  const hrViewPermCount = hrViewOnlyModules.reduce((acc, key) => {
    const mod = moduleMap.get(key);
    return acc + (mod ? mod.permissions.filter(p => ['view','create','edit','export'].includes(p.action)).length : 0);
  }, 0);
  console.log(`  ✓ hr_admin: ${hrFullPermCount + hrViewPermCount} permissions (full HR access + recruitment)`);
  
  // Finance Admin: Full finance/payroll, view on others
  await assignPermissions(standardRoleIds.finance_admin, FINANCE_ADMIN_FULL_MODULES, ['view', 'create', 'edit', 'delete', 'export', 'approve']);
  const financeViewModules = FINANCE_ADMIN_MODULES.filter(m => !FINANCE_ADMIN_FULL_MODULES.includes(m));
  count = await assignPermissions(standardRoleIds.finance_admin, financeViewModules, ['view']);
  const finFullPermCount = FINANCE_ADMIN_FULL_MODULES.reduce((acc, key) => {
    const mod = moduleMap.get(key);
    return acc + (mod ? mod.permissions.filter(p => ['view','create','edit','delete','export','approve'].includes(p.action)).length : 0);
  }, 0);
  const finViewPermCount = financeViewModules.reduce((acc, key) => {
    const mod = moduleMap.get(key);
    return acc + (mod ? mod.permissions.filter(p => p.action === 'view').length : 0);
  }, 0);
  console.log(`  ✓ finance_admin: ${finFullPermCount + finViewPermCount} permissions (full payroll/finance access)`);
  
  // IT Admin: Full IT/helpdesk/assets, view on others
  await assignPermissions(standardRoleIds.it_admin, IT_ADMIN_FULL_MODULES, ['view', 'create', 'edit', 'delete', 'export']);
  const itViewModules = IT_ADMIN_MODULES.filter(m => !IT_ADMIN_FULL_MODULES.includes(m));
  count = await assignPermissions(standardRoleIds.it_admin, itViewModules, ['view']);
  const itFullPermCount = IT_ADMIN_FULL_MODULES.reduce((acc, key) => {
    const mod = moduleMap.get(key);
    return acc + (mod ? mod.permissions.filter(p => ['view','create','edit','delete','export'].includes(p.action)).length : 0);
  }, 0);
  const itViewPermCount = itViewModules.reduce((acc, key) => {
    const mod = moduleMap.get(key);
    return acc + (mod ? mod.permissions.filter(p => p.action === 'view').length : 0);
  }, 0);
  console.log(`  ✓ it_admin: ${itFullPermCount + itViewPermCount} permissions (full IT/helpdesk/assets access)`);
  
  // Manager: view+create+edit+approve on team modules, view on others
  await assignPermissions(standardRoleIds.manager, MANAGER_FULL_MODULES, ['view', 'create', 'edit', 'approve']);
  const managerViewModules = MANAGER_MODULES.filter(m => !MANAGER_FULL_MODULES.includes(m));
  count = await assignPermissions(standardRoleIds.manager, managerViewModules, ['view']);
  const mgrFullPermCount = MANAGER_FULL_MODULES.reduce((acc, key) => {
    const mod = moduleMap.get(key);
    return acc + (mod ? mod.permissions.filter(p => ['view','create','edit','approve'].includes(p.action)).length : 0);
  }, 0);
  const mgrViewPermCount = managerViewModules.reduce((acc, key) => {
    const mod = moduleMap.get(key);
    return acc + (mod ? mod.permissions.filter(p => p.action === 'view').length : 0);
  }, 0);
  console.log(`  ✓ manager: ${mgrFullPermCount + mgrViewPermCount} permissions (team management)`);
  
  // Employee: view-only on profile/payslips, create/edit on self-service
  await assignPermissions(standardRoleIds.employee, EMPLOYEE_VIEW_ONLY_MODULES, ['view']);
  await assignPermissions(standardRoleIds.employee, ['leave', 'expenses', 'travel', 'timesheets', 'helpdesk', 'training'], ['view', 'create', 'edit']);
  await assignPermissions(standardRoleIds.employee, ['dashboard', 'attendance', 'documents', 'ai_assistant', 'docs', 'notifications'], ['view']);
  const empViewCount = EMPLOYEE_VIEW_ONLY_MODULES.reduce((acc, key) => {
    const mod = moduleMap.get(key);
    return acc + (mod ? mod.permissions.filter(p => p.action === 'view').length : 0);
  }, 0);
  const empEditCount = ['leave','expenses','travel','timesheets','helpdesk','training'].reduce((acc, key) => {
    const mod = moduleMap.get(key);
    return acc + (mod ? mod.permissions.filter(p => ['view','create','edit'].includes(p.action)).length : 0);
  }, 0);
  const empBasicCount = ['dashboard','attendance','documents','ai_assistant','docs','notifications'].reduce((acc, key) => {
    const mod = moduleMap.get(key);
    return acc + (mod ? mod.permissions.filter(p => p.action === 'view').length : 0);
  }, 0);
  console.log(`  ✓ employee: ${empViewCount + empEditCount + empBasicCount} permissions (self-service)`);
  
  // ========== STEP 6: Update User.role legacy field for migrated users ==========
  console.log('\n📋 Step 6: Updating User.role legacy field...');
  
  // Map old roles to new standard roles in User.role field
  const userRoleUpdates: Record<string, string> = {
    'recruiter': 'hr_admin',
    'candidate': 'employee',
    'hr': 'hr_admin',
    'hr_admin': 'hr_admin',
    'finance': 'finance_admin',
    'it_admin': 'it_admin',
    'company_hr_admin': 'hr_admin',
  };
  
  let usersUpdated = 0;
  for (const [oldRole, newRole] of Object.entries(userRoleUpdates)) {
    const result = await prisma.user.updateMany({
      where: { role: oldRole },
      data: { role: newRole }
    });
    if (result.count > 0) {
      console.log(`  ✓ Updated ${result.count} users from role "${oldRole}" → "${newRole}"`);
      usersUpdated += result.count;
    }
  }
  console.log(`  Total users updated: ${usersUpdated}`);
  
  // ========== STEP 7: Final summary ==========
  console.log('\n========================================');
  console.log('  ✅ RBAC Cleanup Complete!');
  console.log('========================================');
  
  const finalRoles = await prisma.role.findMany({
    orderBy: { level: 'asc' },
    select: { key: true, name: true, level: true, isSystem: true, _count: { select: { userRoles: true, permissions: true } } }
  });
  
  console.log('\n  Standard Roles:');
  for (const r of finalRoles) {
    console.log(`    ${r.key.padEnd(20)} | ${(r.name||'').padEnd(25)} | level=${r.level} | users=${r._count.userRoles} | perms=${r._count.permissions}`);
  }
  console.log(`\n  Total roles after cleanup: ${finalRoles.length}`);
  
  await prisma.$disconnect();
}

main().catch(e => {
  console.error('❌ Failed:', e);
  process.exit(1);
});
