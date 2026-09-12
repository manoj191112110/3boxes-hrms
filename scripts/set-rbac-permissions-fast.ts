/**
 * Fast RBAC Permission Setter using Raw SQL
 * Deletes all old permissions and bulk-inserts new ones per role
 * 
 * Usage: npx tsx scripts/set-rbac-permissions-fast.ts
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

// Module permission configuration per role
const ROLE_PERMISSIONS: Record<string, Record<string, string[]>> = {
  super_admin: {
    'dashboard': ['view'],
    'employees': DEFAULT_ACTIONS,
    'company': DEFAULT_ACTIONS,
    'recruitment': DEFAULT_ACTIONS,
    'requisitions': DEFAULT_ACTIONS,
    'offers': DEFAULT_ACTIONS,
    'job_portal': DEFAULT_ACTIONS,
    'ai_interview': DEFAULT_ACTIONS,
    'onboarding': DEFAULT_ACTIONS,
    'preboarding': DEFAULT_ACTIONS,
    'attendance': DEFAULT_ACTIONS,
    'leave': DEFAULT_ACTIONS,
    'timesheets': DEFAULT_ACTIONS,
    'payroll': DEFAULT_ACTIONS,
    'salary_structures': DEFAULT_ACTIONS,
    'performance': DEFAULT_ACTIONS,
    'training': DEFAULT_ACTIONS,
    'engagement': DEFAULT_ACTIONS,
    'succession': DEFAULT_ACTIONS,
    'projects': DEFAULT_ACTIONS,
    'travel': DEFAULT_ACTIONS,
    'expenses': DEFAULT_ACTIONS,
    'assets': DEFAULT_ACTIONS,
    'documents': DEFAULT_ACTIONS,
    'clients': DEFAULT_ACTIONS,
    'vendors': DEFAULT_ACTIONS,
    'helpdesk': DEFAULT_ACTIONS,
    'grievances': DEFAULT_ACTIONS,
    'ai_assistant': DEFAULT_ACTIONS,
    'docs': ['view'],
    'workflows': DEFAULT_ACTIONS,
    'reports': DEFAULT_ACTIONS,
    'settings': DEFAULT_ACTIONS,
    'notifications': ['view'],
    'super_admin': DEFAULT_ACTIONS,
    'tenant_admin': DEFAULT_ACTIONS,
    'ai_admin': DEFAULT_ACTIONS,
  },
  tenant_admin: {
    'dashboard': ['view'],
    'employees': DEFAULT_ACTIONS,
    'company': DEFAULT_ACTIONS,
    'recruitment': DEFAULT_ACTIONS,
    'requisitions': DEFAULT_ACTIONS,
    'offers': DEFAULT_ACTIONS,
    'job_portal': DEFAULT_ACTIONS,
    'ai_interview': DEFAULT_ACTIONS,
    'onboarding': DEFAULT_ACTIONS,
    'preboarding': DEFAULT_ACTIONS,
    'attendance': DEFAULT_ACTIONS,
    'leave': DEFAULT_ACTIONS,
    'timesheets': DEFAULT_ACTIONS,
    'payroll': DEFAULT_ACTIONS,
    'salary_structures': DEFAULT_ACTIONS,
    'performance': DEFAULT_ACTIONS,
    'training': DEFAULT_ACTIONS,
    'engagement': DEFAULT_ACTIONS,
    'succession': DEFAULT_ACTIONS,
    'projects': DEFAULT_ACTIONS,
    'travel': DEFAULT_ACTIONS,
    'expenses': DEFAULT_ACTIONS,
    'assets': DEFAULT_ACTIONS,
    'documents': DEFAULT_ACTIONS,
    'clients': DEFAULT_ACTIONS,
    'vendors': DEFAULT_ACTIONS,
    'helpdesk': DEFAULT_ACTIONS,
    'grievances': DEFAULT_ACTIONS,
    'ai_assistant': DEFAULT_ACTIONS,
    'docs': ['view'],
    'workflows': DEFAULT_ACTIONS,
    'reports': DEFAULT_ACTIONS,
    'settings': DEFAULT_ACTIONS,
    'notifications': ['view'],
    // No admin-only modules
  },
  hr_admin: {
    'dashboard': ['view'],
    'employees': DEFAULT_ACTIONS,
    'company': DEFAULT_ACTIONS,
    'recruitment': DEFAULT_ACTIONS,
    'requisitions': DEFAULT_ACTIONS,
    'offers': DEFAULT_ACTIONS,
    'job_portal': DEFAULT_ACTIONS,
    'ai_interview': DEFAULT_ACTIONS,
    'onboarding': DEFAULT_ACTIONS,
    'preboarding': DEFAULT_ACTIONS,
    'attendance': DEFAULT_ACTIONS,
    'leave': DEFAULT_ACTIONS,
    'payroll': DEFAULT_ACTIONS,
    'salary_structures': DEFAULT_ACTIONS,
    'performance': DEFAULT_ACTIONS,
    'training': DEFAULT_ACTIONS,
    'engagement': DEFAULT_ACTIONS,
    'succession': DEFAULT_ACTIONS,
    'helpdesk': DEFAULT_ACTIONS,
    'grievances': DEFAULT_ACTIONS,
    'documents': DEFAULT_ACTIONS,
    'workflows': ['view', 'create', 'edit', 'export'],
    'reports': ['view', 'create', 'edit', 'export'],
    'settings': DEFAULT_ACTIONS,
    'notifications': ['view'],
    'docs': ['view'],
  },
  finance_admin: {
    'dashboard': ['view'],
    'employees': ['view'],
    'payroll': DEFAULT_ACTIONS,
    'salary_structures': DEFAULT_ACTIONS,
    'expenses': DEFAULT_ACTIONS,
    'travel': DEFAULT_ACTIONS,
    'reports': DEFAULT_ACTIONS,
    'notifications': ['view'],
    'docs': ['view'],
    'helpdesk': ['view', 'create'],
    'ai_assistant': ['view'],
    'settings': ['view'],
  },
  it_admin: {
    'dashboard': ['view'],
    'employees': ['view'],
    'helpdesk': DEFAULT_ACTIONS,
    'assets': DEFAULT_ACTIONS,
    'documents': DEFAULT_ACTIONS,
    'workflows': DEFAULT_ACTIONS,
    'settings': DEFAULT_ACTIONS,
    'notifications': ['view'],
    'ai_assistant': ['view'],
    'docs': ['view'],
    'reports': ['view', 'create', 'edit', 'export'],
  },
  manager: {
    'dashboard': ['view'],
    'employees': ['view', 'create', 'edit', 'approve'],
    'recruitment': ['view', 'create', 'edit', 'approve'],
    'onboarding': ['view', 'create', 'edit', 'approve'],
    'attendance': ['view', 'create', 'edit', 'approve'],
    'leave': ['view', 'create', 'edit', 'approve'],
    'timesheets': ['view', 'create', 'edit', 'approve'],
    'performance': ['view', 'create', 'edit', 'approve'],
    'expenses': ['view', 'create', 'edit', 'approve'],
    'travel': ['view', 'create', 'edit', 'approve'],
    'helpdesk': ['view', 'create', 'edit', 'approve'],
    'projects': ['view', 'create', 'edit', 'approve'],
    'training': ['view'],
    'engagement': ['view'],
    'documents': ['view'],
    'ai_assistant': ['view'],
    'docs': ['view'],
    'notifications': ['view'],
  },
  employee: {
    'dashboard': ['view'],
    'employees': ['view'],
    'leave': ['view', 'create', 'edit'],
    'attendance': ['view'],
    'timesheets': ['view', 'create', 'edit'],
    'expenses': ['view', 'create', 'edit'],
    'travel': ['view', 'create', 'edit'],
    'helpdesk': ['view', 'create', 'edit'],
    'training': ['view', 'create', 'edit'],
    'documents': ['view', 'create', 'edit'],
    'payroll': ['view'],
    'performance': ['view'],
    'notifications': ['view'],
    'ai_assistant': ['view'],
    'docs': ['view'],
  },
};

async function main() {
  console.log('🔐 Setting standard RBAC permissions (fast bulk method)...\n');
  
  // Get all modules with permissions
  const allModules = await prisma.module.findMany({ include: { permissions: true } });
  const moduleMap = new Map(allModules.map(m => [m.key, m]));
  
  // Get all 7 standard roles
  const roles = await prisma.role.findMany({ orderBy: { level: 'asc' } });
  console.log('Roles:', roles.map(r => `${r.key}(${r.id.substring(0,8)})`).join(', '));
  console.log('Modules:', allModules.length);
  
  // Step 1: Delete ALL existing role permissions
  console.log('\n📋 Step 1: Clearing all existing role permissions...');
  await prisma.rolePermission.deleteMany({});
  console.log('  ✓ All role permissions cleared');
  
  // Step 2: Bulk insert using raw SQL
  console.log('\n📋 Step 2: Bulk inserting standard permissions...');
  
  let totalInserted = 0;
  
  for (const role of roles) {
    const permConfig = ROLE_PERMISSIONS[role.key];
    if (!permConfig) {
      console.log(`  ⚠ No permission config for ${role.key}, skipping`);
      continue;
    }
    
    // Build values for bulk insert - need to include id (CUID-like)
    const cuid = () => {
      const ts = Date.now().toString(36);
      const rand = Math.random().toString(36).substring(2, 10);
      return `${ts}${rand}`.padEnd(25, '0').substring(0, 25);
    };
    const values: string[] = [];
    
    for (const [moduleKey, actions] of Object.entries(permConfig)) {
      const mod = moduleMap.get(moduleKey);
      if (!mod) continue;
      
      for (const action of actions) {
        const perm = mod.permissions.find(p => p.action === action);
        if (perm) {
          const id = `rp${cuid()}`.substring(0, 25);
          values.push(`('${id}', '${role.id}', '${perm.id}', true, NOW(), NOW())`);
        }
      }
    }
    
    if (values.length === 0) continue;
    
    // Split into batches of 100 to avoid query size limits
    const batchSize = 100;
    for (let i = 0; i < values.length; i += batchSize) {
      const batch = values.slice(i, i + batchSize);
      const sql = `
        INSERT INTO "RolePermission" ("id", "roleId", "permissionId", "granted", "createdAt", "updatedAt")
        VALUES ${batch.join(',\n')}
        ON CONFLICT ("roleId", "permissionId") DO NOTHING
      `;
      
      try {
        await prisma.$executeRawUnsafe(sql);
      } catch (error) {
        console.error(`  ❌ Batch error for ${role.key} (batch ${Math.floor(i/batchSize)+1}):`, error);
      }
    }
    console.log(`  ✓ ${role.key}: ${values.length} permissions inserted`);
  }
  
  console.log(`\n  Total permissions inserted: ${totalInserted}`);
  
  // Final summary
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
