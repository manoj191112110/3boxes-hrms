/**
 * Production DB Cleanup Script — Consolidate RBAC to 3 roles
 * 
 * This script:
 * 1. Migrates all users to 3 standard roles: super_admin, tenant_admin, admin
 * 2. Removes non-standard roles from the Role table
 * 3. Deletes all non-admin employee records (keeps only basic admin profiles)
 * 4. Re-seeds the RBAC tables with 3 standard roles and permissions
 * 
 * Run: npx tsx scripts/cleanup-rbac-production.ts
 */

const { neon } = require('@neondatabase/serverless');
const connectionString = 'postgresql://neondb_owner:npg_pxZd8woKe4WB@ep-blue-fire-aqk8jxd2-pooler.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require';
const sql = neon(connectionString);

// Legacy role → new role mapping
const ROLE_MIGRATION_MAP: Record<string, string> = {
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

const STANDARD_ROLES = ['super_admin', 'tenant_admin', 'admin'];

async function main() {
  console.log('🔧 Starting RBAC Production Cleanup — 3 Role System');
  console.log('=' .repeat(60));

  // Step 1: Check current state
  console.log('\n📊 Step 1: Checking current state...');
  const currentUsers = await sql`SELECT id, email, name, role, "tenantId", status FROM "User" ORDER BY role, email`;
  const currentRoles = await sql`SELECT id, key, name, level, "isSystem" FROM "Role" ORDER BY level, key`;
  const currentEmployees = await sql`SELECT COUNT(*) as count FROM "Employee"`;
  
  console.log(`  Current users: ${currentUsers.length}`);
  console.log(`  Current roles: ${currentRoles.length}`);
  console.log(`  Current employees: ${currentEmployees[0].count}`);
  
  // Show role distribution
  const roleDist: Record<string, number> = {};
  for (const u of currentUsers) {
    roleDist[u.role] = (roleDist[u.role] || 0) + 1;
  }
  console.log('  Role distribution:');
  for (const [role, count] of Object.entries(roleDist).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${role}: ${count}`);
  }

  // Step 2: Migrate User.role field
  console.log('\n🔄 Step 2: Migrating User.role to 3 standard roles...');
  let migratedCount = 0;
  for (const user of currentUsers) {
    const newRole = ROLE_MIGRATION_MAP[user.role];
    if (!newRole) {
      console.log(`  ⚠️  Unknown role '${user.role}' for user ${user.email} → assigning 'admin'`);
      await sql`UPDATE "User" SET role = 'admin' WHERE id = ${user.id}`;
      migratedCount++;
    } else if (newRole !== user.role) {
      await sql`UPDATE "User" SET role = ${newRole} WHERE id = ${user.id}`;
      console.log(`  ✓ ${user.email}: ${user.role} → ${newRole}`);
      migratedCount++;
    }
  }
  console.log(`  Migrated ${migratedCount} users`);

  // Step 3: Delete all UserRoleAssignments (will be re-created by seed)
  console.log('\n🗑️  Step 3: Clearing UserRoleAssignments...');
  const deletedAssignments = await sql`DELETE FROM "UserRoleAssignment"`;
  console.log(`  Cleared all user role assignments`);

  // Step 4: Delete all RolePermissions (will be re-created by seed)
  console.log('\n🗑️  Step 4: Clearing RolePermissions...');
  await sql`DELETE FROM "RolePermission"`;
  console.log(`  Cleared all role permissions`);

  // Step 5: Delete non-standard roles
  console.log('\n🗑️  Step 5: Removing non-standard roles...');
  for (const role of currentRoles) {
    if (!STANDARD_ROLES.includes(role.key)) {
      await sql`DELETE FROM "Role" WHERE id = ${role.id}`;
      console.log(`  ✗ Removed role: ${role.key} (${role.name})`);
    }
  }

  // Step 6: Ensure 3 standard roles exist
  console.log('\n✨ Step 6: Ensuring 3 standard roles exist...');
  const existingRoleKeys = await sql`SELECT key FROM "Role"`;
  const existingKeys = existingRoleKeys.map((r: any) => r.key);
  
  const rolesToCreate = [
    { key: 'super_admin', name: 'Super Administrator', description: 'Full system access across all tenants — manages platform configuration, RBAC, audit logs, and all tenant operations', level: 0, isSystem: true },
    { key: 'tenant_admin', name: 'Tenant Administrator', description: 'Full access within their tenant — manages company RBAC, organization settings, and all HR operations', level: 1, isSystem: true },
    { key: 'admin', name: 'Administrator', description: 'Company-level admin access — manages all employees, HR operations, payroll, recruitment, onboarding, IT assets, finance, and compliance within their company', level: 2, isSystem: true },
  ];

  const roleIds: Record<string, string> = {};
  for (const roleDef of rolesToCreate) {
    if (existingKeys.includes(roleDef.key)) {
      // Update existing role
      const existing = await sql`SELECT id FROM "Role" WHERE key = ${roleDef.key} LIMIT 1`;
      await sql`UPDATE "Role" SET name = ${roleDef.name}, description = ${roleDef.description}, level = ${roleDef.level}, "isSystem" = ${roleDef.isSystem} WHERE key = ${roleDef.key}`;
      roleIds[roleDef.key] = existing[0].id;
      console.log(`  ✓ Updated role: ${roleDef.key} (${roleDef.name})`);
    } else {
      const newId = `role-${roleDef.key}-${Date.now()}`;
      await sql`INSERT INTO "Role" (id, key, name, description, "isSystem", level, "tenantId", "companyId", status, "createdAt", "updatedAt") VALUES (${newId}, ${roleDef.key}, ${roleDef.name}, ${roleDef.description}, ${roleDef.isSystem}, ${roleDef.level}, NULL, NULL, 'active', NOW(), NOW())`;
      roleIds[roleDef.key] = newId;
      console.log(`  ✓ Created role: ${roleDef.key} (${roleDef.name})`);
    }
  }

  // Step 7: Create UserRoleAssignments for all users
  console.log('\n🔗 Step 7: Creating UserRoleAssignments...');
  const updatedUsers = await sql`SELECT id, email, role, "tenantId" FROM "User"`;
  let assignmentsCreated = 0;
  for (const user of updatedUsers) {
    const roleId = roleIds[user.role];
    if (!roleId) {
      console.log(`  ⚠️  No role ID for user ${user.email} with role ${user.role}`);
      continue;
    }
    try {
      await sql`INSERT INTO "UserRoleAssignment" (id, "userId", "roleId", "companyId", "assignedBy", "createdAt", "updatedAt") VALUES (${'ura-' + user.id.substring(0, 20) + '-' + Date.now()}, ${user.id}, ${roleId}, NULL, NULL, NOW(), NOW())`;
      assignmentsCreated++;
    } catch (e: any) {
      if (!e.message?.includes('duplicate') && !e.message?.includes('unique')) {
        console.log(`  ⚠️  Failed to assign role for ${user.email}: ${e.message?.substring(0, 80)}`);
      }
    }
  }
  console.log(`  Created ${assignmentsCreated} role assignments`);

  // Step 8: Delete non-admin employee records
  console.log('\n🗑️  Step 8: Removing non-admin employee records...');
  
  // First, get the list of admin user IDs
  const adminUsers = await sql`SELECT id FROM "User" WHERE role IN ('super_admin', 'tenant_admin', 'admin')`;
  const adminUserIds: string[] = adminUsers.map((u: any) => u.id);
  
  // Delete employees whose userId is NOT an admin
  // Do it one by one since neon tagged template doesn't support sql(array)
  const allEmployees = await sql`SELECT id, "userId" FROM "Employee"`;
  let employeesDeleted = 0;
  for (const emp of allEmployees) {
    if (!adminUserIds.includes(emp.userId)) {
      await sql`DELETE FROM "Employee" WHERE id = ${emp.id}`;
      employeesDeleted++;
    }
  }
  console.log(`  Removed ${employeesDeleted} non-admin employee records`);

  // Step 9: Final verification
  console.log('\n✅ Step 9: Final verification...');
  const finalUsers = await sql`SELECT role, COUNT(*) as count FROM "User" GROUP BY role ORDER BY count DESC`;
  console.log('  Final role distribution:');
  for (const row of finalUsers) {
    console.log(`    ${row.role}: ${row.count}`);
  }
  
  const finalRoles = await sql`SELECT key, name, level FROM "Role" ORDER BY level`;
  console.log('  Final roles:');
  for (const role of finalRoles) {
    console.log(`    ${role.key} (level ${role.level}): ${role.name}`);
  }

  const finalEmployees = await sql`SELECT COUNT(*) as count FROM "Employee"`;
  console.log(`  Remaining employees: ${finalEmployees[0].count}`);

  console.log('\n' + '=' .repeat(60));
  console.log('🎉 RBAC Production Cleanup Complete!');
  console.log('   3 standard roles: super_admin, tenant_admin, admin');
  console.log('   All users migrated to new roles');
  console.log('   Non-admin employees removed');
  console.log('=' .repeat(60));
}

main().catch((e) => {
  console.error('❌ Cleanup failed:', e);
  process.exit(1);
});
