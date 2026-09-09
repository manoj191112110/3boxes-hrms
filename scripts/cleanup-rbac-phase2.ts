/**
 * Fast RBAC Cleanup - Phase 2
 * Clean up remaining duplicate roles after Phase 1
 * 
 * Usage: npx tsx scripts/cleanup-rbac-phase2.ts
 */

import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';

const connectionString = process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL || process.env.DATABASE_URL;
if (!connectionString) throw new Error('No DATABASE_URL');

const adapter = new PrismaNeon({ connectionString });
const prisma = new PrismaClient({ adapter });

// Standard roles to KEEP (7 roles)
const KEEP_ROLES = new Set(['super_admin', 'tenant_admin', 'hr_admin', 'finance_admin', 'it_admin', 'manager', 'employee']);

// Old key → new standard key mapping
const KEY_MAP: Record<string, string> = {
  'finance': 'finance_admin',
  'recruiter': 'hr_admin',
  'candidate': 'employee',
  'hrhead': 'hr_admin',
  'recruitmenthead': 'hr_admin',
  'hr': 'hr_admin',
};

async function main() {
  console.log('🧹 RBAC Phase 2 — Fast cleanup of remaining duplicates\n');
  
  // Step 1: Get the IDs of standard roles we want to keep
  const standardRoleIds: Record<string, string> = {};
  for (const key of KEEP_ROLES) {
    const role = await prisma.role.findFirst({ where: { key, tenantId: null, companyId: null } });
    if (role) {
      standardRoleIds[key] = role.id;
      console.log(`  Keep: ${key} → ${role.id.substring(0,12)}`);
    } else {
      // Try to find any with this key
      const anyRole = await prisma.role.findFirst({ where: { key } });
      if (anyRole) {
        // Make it the standard one
        await prisma.role.update({ where: { id: anyRole.id }, data: { tenantId: null, companyId: null } });
        standardRoleIds[key] = anyRole.id;
        console.log(`  Keep (adopted): ${key} → ${anyRole.id.substring(0,12)}`);
      } else if (key === 'finance_admin') {
        // Create finance_admin if it doesn't exist
        const newRole = await prisma.role.create({ data: { key: 'finance_admin', name: 'Finance Administrator', description: 'Finance and payroll access', level: 2, isSystem: true, tenantId: null, companyId: null, status: 'active' } });
        standardRoleIds[key] = newRole.id;
        console.log(`  Created: ${key} → ${newRole.id.substring(0,12)}`);
      }
    }
  }
  
  // Step 2: For each non-standard key, migrate users and delete all roles
  console.log('\n📋 Migrating & deleting non-standard roles...');
  
  for (const [oldKey, newKey] of Object.entries(KEY_MAP)) {
    const targetRoleId = standardRoleIds[newKey];
    if (!targetRoleId) {
      console.log(`  ⚠ No target for ${oldKey}, skipping`);
      continue;
    }
    
    const roles = await prisma.role.findMany({ where: { key: oldKey } });
    let totalAssignments = 0;
    
    for (const role of roles) {
      // Migrate user assignments
      const assignments = await prisma.userRoleAssignment.findMany({ where: { roleId: role.id } });
      for (const a of assignments) {
        try {
          await prisma.userRoleAssignment.upsert({
            where: { userId_roleId_companyId: { userId: a.userId, roleId: targetRoleId, companyId: a.companyId } },
            update: {},
            create: { userId: a.userId, roleId: targetRoleId, companyId: a.companyId, assignedBy: a.assignedBy }
          });
          totalAssignments++;
        } catch { /* skip */ }
      }
      // Delete role
      await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
      await prisma.userRoleAssignment.deleteMany({ where: { roleId: role.id } });
      try { await prisma.role.delete({ where: { id: role.id } }); } catch { /* already deleted */ }
    }
    console.log(`  ✓ ${oldKey} → ${newKey}: deleted ${roles.length} roles, migrated ${totalAssignments} assignments`);
  }
  
  // Step 3: Delete roles with NULL keys
  console.log('\n📋 Deleting NULL-key roles...');
  const nullRoles = await prisma.role.findMany({ where: { key: null } });
  for (const role of nullRoles) {
    const targetRoleId = standardRoleIds.hr_admin;
    if (targetRoleId) {
      const assignments = await prisma.userRoleAssignment.findMany({ where: { roleId: role.id } });
      for (const a of assignments) {
        try {
          await prisma.userRoleAssignment.upsert({
            where: { userId_roleId_companyId: { userId: a.userId, roleId: targetRoleId, companyId: a.companyId } },
            update: {},
            create: { userId: a.userId, roleId: targetRoleId, companyId: a.companyId, assignedBy: a.assignedBy }
          });
        } catch { /* skip */ }
      }
    }
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.userRoleAssignment.deleteMany({ where: { roleId: role.id } });
    try { await prisma.role.delete({ where: { id: role.id } }); } catch { /* skip */ }
  }
  console.log(`  ✓ Deleted ${nullRoles.length} NULL-key roles`);
  
  // Step 4: Delete duplicate standard roles (keep only the one in standardRoleIds)
  console.log('\n📋 Deleting duplicate standard roles...');
  for (const [key, keepId] of Object.entries(standardRoleIds)) {
    const duplicates = await prisma.role.findMany({ where: { key, id: { not: keepId } } });
    for (const dup of duplicates) {
      // Migrate assignments first
      const assignments = await prisma.userRoleAssignment.findMany({ where: { roleId: dup.id } });
      for (const a of assignments) {
        try {
          await prisma.userRoleAssignment.upsert({
            where: { userId_roleId_companyId: { userId: a.userId, roleId: keepId, companyId: a.companyId } },
            update: {},
            create: { userId: a.userId, roleId: keepId, companyId: a.companyId, assignedBy: a.assignedBy }
          });
        } catch { /* skip */ }
      }
      await prisma.rolePermission.deleteMany({ where: { roleId: dup.id } });
      await prisma.userRoleAssignment.deleteMany({ where: { roleId: dup.id } });
      try { await prisma.role.delete({ where: { id: dup.id } }); } catch { /* skip */ }
    }
    if (duplicates.length > 0) console.log(`  ✓ Deleted ${duplicates.length} duplicate(s) of ${key}`);
  }
  
  // Step 5: Update User.role legacy field
  console.log('\n📋 Updating User.role legacy field...');
  const roleUpdates: Record<string, string> = {
    'recruiter': 'hr_admin',
    'candidate': 'employee',
    'hr': 'hr_admin',
    'finance': 'finance_admin',
    'company_hr_admin': 'hr_admin',
  };
  
  for (const [oldRole, newRole] of Object.entries(roleUpdates)) {
    const result = await prisma.user.updateMany({ where: { role: oldRole }, data: { role: newRole } });
    if (result.count > 0) console.log(`  ✓ ${result.count} users: ${oldRole} → ${newRole}`);
  }
  
  // Final count
  const finalCount = await prisma.role.count();
  const finalRoles = await prisma.role.findMany({ orderBy: { level: 'asc' }, select: { key: true, name: true, level: true, _count: { select: { userRoles: true, permissions: true } } } });
  
  console.log('\n========================================');
  console.log('  ✅ RBAC Cleanup Phase 2 Complete!');
  console.log('========================================');
  console.log(`  Final role count: ${finalCount}`);
  console.log('\n  Remaining Roles:');
  for (const r of finalRoles) {
    console.log(`    ${r.key.padEnd(20)} | ${(r.name||'').padEnd(25)} | level=${r.level} | users=${r._count.userRoles} | perms=${r._count.permissions}`);
  }
  
  await prisma.$disconnect();
}

main().catch(e => { console.error('❌ Failed:', e); process.exit(1); });
