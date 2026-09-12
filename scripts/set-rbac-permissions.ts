/**
 * Set Standard RBAC Permissions for 7 Roles
 * 
 * Usage: npx tsx scripts/set-rbac-permissions.ts
 */

import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';

const connectionString = process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL || process.env.DATABASE_URL;
if (!connectionString) throw new Error('No DATABASE_URL');

const adapter = new PrismaNeon({ connectionString });
const prisma = new PrismaClient({ adapter });

const DEFAULT_ACTIONS = ['view', 'create', 'edit', 'delete', 'export', 'approve'];
const LIMITED_ACTION_MODULES = ['dashboard', 'notifications', 'docs'];
const ADMIN_ONLY_MODULES = ['super_admin', 'tenant_admin', 'ai_admin'];

async function main() {
  console.log('🔐 Setting standard RBAC permissions for 7 roles...\n');
  
  // Get all modules with their permissions
  const allModules = await prisma.module.findMany({ include: { permissions: true } });
  const moduleMap = new Map(allModules.map(m => [m.key, m]));
  const allModuleKeys = allModules.map(m => m.key);
  
  // Get all 7 standard roles
  const roles = await prisma.role.findMany({ orderBy: { level: 'asc' } });
  const roleMap = new Map(roles.map(r => [r.key, r.id]));
  
  console.log('Roles:', roles.map(r => `${r.key}(${r.id.substring(0,8)})`).join(', '));
  console.log(`Modules: ${allModules.length}, Total permissions: ${allModules.reduce((a,m) => a + m.permissions.length, 0)}\n`);
  
  // Helper: Clear and set permissions for a role
  const setPermissions = async (roleKey: string, config: Array<{ moduleKey: string; actions: string[] }>) => {
    const roleId = roleMap.get(roleKey);
    if (!roleId) { console.log(`  ⚠ Role ${roleKey} not found`); return; }
    
    // Clear existing permissions
    await prisma.rolePermission.deleteMany({ where: { roleId } });
    
    let created = 0;
    for (const { moduleKey, actions } of config) {
      const mod = moduleMap.get(moduleKey);
      if (!mod) continue;
      for (const perm of mod.permissions) {
        if (actions.includes(perm.action)) {
          try {
            await prisma.rolePermission.create({ data: { roleId, permissionId: perm.id, granted: true } });
            created++;
          } catch { /* skip */ }
        }
      }
    }
    console.log(`  ✓ ${roleKey}: ${created} permissions set`);
  };
  
  // ===== 1. SUPER ADMIN: ALL modules, ALL actions =====
  const superAdminConfig = allModuleKeys.map(key => ({
    moduleKey: key,
    actions: LIMITED_ACTION_MODULES.includes(key) ? ['view'] : DEFAULT_ACTIONS
  }));
  await setPermissions('super_admin', superAdminConfig);
  
  // ===== 2. TENANT ADMIN: ALL modules except admin-only, ALL actions =====
  const tenantAdminConfig = allModuleKeys
    .filter(key => !ADMIN_ONLY_MODULES.includes(key))
    .map(key => ({
      moduleKey: key,
      actions: LIMITED_ACTION_MODULES.includes(key) ? ['view'] : DEFAULT_ACTIONS
    }));
  await setPermissions('tenant_admin', tenantAdminConfig);
  
  // ===== 3. HR ADMIN: Full HR + Recruitment + Onboarding, view+create+edit+export on secondary =====
  const hrFullModules = ['employees', 'company', 'recruitment', 'requisitions', 'offers', 'onboarding', 'preboarding', 'payroll', 'salary_structures', 'attendance', 'leave', 'performance', 'training', 'engagement', 'helpdesk', 'grievances', 'documents', 'settings', 'job_portal', 'ai_interview', 'succession'];
  const hrViewModules = ['dashboard', 'timesheets', 'ai_assistant', 'docs', 'workflows', 'reports', 'notifications'];
  
  const hrAdminConfig = [
    ...hrFullModules.map(key => ({ moduleKey: key, actions: ['view', 'create', 'edit', 'delete', 'export', 'approve'] })),
    ...hrViewModules.map(key => ({ moduleKey: key, actions: key === 'dashboard' || key === 'docs' || key === 'notifications' ? ['view'] : ['view', 'create', 'edit', 'export'] })),
  ];
  await setPermissions('hr_admin', hrAdminConfig);
  
  // ===== 4. FINANCE ADMIN: Full payroll/finance, view on others =====
  const finFullModules = ['payroll', 'salary_structures', 'expenses', 'travel', 'reports'];
  const finViewModules = ['dashboard', 'employees', 'notifications', 'docs', 'helpdesk', 'ai_assistant', 'settings'];
  
  const financeAdminConfig = [
    ...finFullModules.map(key => ({ moduleKey: key, actions: ['view', 'create', 'edit', 'delete', 'export', 'approve'] })),
    ...finViewModules.map(key => ({ moduleKey: key, actions: ['view'] })),
  ];
  await setPermissions('finance_admin', financeAdminConfig);
  
  // ===== 5. IT ADMIN: Full IT/helpdesk/assets, view on others =====
  const itFullModules = ['helpdesk', 'assets', 'workflows', 'settings'];
  const itViewModules = ['dashboard', 'employees', 'documents', 'notifications', 'ai_assistant', 'docs', 'reports'];
  
  const itAdminConfig = [
    ...itFullModules.map(key => ({ moduleKey: key, actions: ['view', 'create', 'edit', 'delete', 'export'] })),
    ...itViewModules.map(key => ({ moduleKey: key, actions: ['view'] })),
  ];
  await setPermissions('it_admin', itAdminConfig);
  
  // ===== 6. MANAGER: view+create+edit+approve on team modules, view on others =====
  const mgrFullModules = ['employees', 'leave', 'attendance', 'timesheets', 'performance', 'expenses', 'travel', 'recruitment', 'onboarding', 'helpdesk', 'projects'];
  const mgrViewModules = ['dashboard', 'training', 'engagement', 'documents', 'ai_assistant', 'docs', 'notifications'];
  
  const managerConfig = [
    ...mgrFullModules.map(key => ({ moduleKey: key, actions: ['view', 'create', 'edit', 'approve'] })),
    ...mgrViewModules.map(key => ({ moduleKey: key, actions: ['view'] })),
  ];
  await setPermissions('manager', managerConfig);
  
  // ===== 7. EMPLOYEE: view-only on profile/payslips, create+edit on self-service =====
  const empViewOnly = ['employees', 'payroll', 'performance'];
  const empEditModules = ['leave', 'expenses', 'travel', 'timesheets', 'helpdesk', 'training'];
  const empBasicModules = ['dashboard', 'attendance', 'documents', 'ai_assistant', 'docs', 'notifications'];
  
  const employeeConfig = [
    ...empViewOnly.map(key => ({ moduleKey: key, actions: ['view'] })),
    ...empEditModules.map(key => ({ moduleKey: key, actions: ['view', 'create', 'edit'] })),
    ...empBasicModules.map(key => ({ moduleKey: key, actions: ['view'] })),
  ];
  await setPermissions('employee', employeeConfig);
  
  // ===== Summary =====
  console.log('\n========================================');
  console.log('  ✅ Standard RBAC Permissions Set!');
  console.log('========================================');
  
  const finalRoles = await prisma.role.findMany({
    orderBy: { level: 'asc' },
    select: { key: true, name: true, level: true, _count: { select: { userRoles: true, permissions: true } } }
  });
  
  for (const r of finalRoles) {
    console.log(`  ${r.key.padEnd(20)} | ${(r.name||'').padEnd(25)} | level=${r.level} | users=${r._count.userRoles} | perms=${r._count.permissions}`);
  }
  
  await prisma.$disconnect();
}

main().catch(e => { console.error('❌ Failed:', e); process.exit(1); });
