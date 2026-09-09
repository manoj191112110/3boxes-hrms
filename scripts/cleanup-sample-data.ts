/**
 * Cleanup Script: Remove all sample data from production DB, keep only live data
 * 
 * LIVE DATA TO KEEP:
 * - Tenant: Marq AI Tech Group (cmrmr3ntfe522ce1f3f1e37c6e7)
 * - Company Group: Marq AI Tech Group (cmrmr3ntg3oc7dad0a4bb8385f7)
 * - 4 Companies: MATPL, 3BLC, 3BCS, 3BT
 * - Platform Super Admins: admin@marqai.com, superadmin@eh2r.com
 * - Live tenant users: superadmin@3boxeshrms.com, admin@marqaitechgroup.com, 
 *   admin@marqaitech.com, admin@3boxesluxury.com, admin@3boxesconsulting.com, admin@3boxestechnologies.com
 * - 4 Admin Employee profiles for company admins
 * - 3 Roles: super_admin, tenant_admin, admin
 * - All Modules and Permissions (system-level, not sample)
 * 
 * SAMPLE DATA TO REMOVE:
 * - Tenants: Nexus Corp, Acme Global, GlobalHR Services, TechStart Solutions, 3 Boxes Corp
 * - All users NOT in live list
 * - All employees NOT in live list
 * - All sample companies, departments, designations, branches
 * - All sample role assignments
 */

import { Pool } from '@neondatabase/serverless';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_pxZd8woKe4WB@ep-blue-fire-aqk8jxd2-pooler.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require';

// IDs to KEEP
const KEEP_TENANT_IDS = [
  'cmrmr3ntfe522ce1f3f1e37c6e7',  // Marq AI Tech Group
];

const KEEP_COMPANY_GROUP_IDS = [
  'cmrmr3ntg3oc7dad0a4bb8385f7',  // Marq AI Tech Group
];

const KEEP_COMPANY_IDS = [
  'cmrmr3ntga2ecb95cccbe4a3e2d',  // MARQ AI TECH PVT LTD
  'cmrmr3ntggiaef373e0086cd965',  // 3 BOXES LUXURY CURATIONS
  'cmrmr3ntgmsee49e9f8864a6b17',  // 3 BOXES CONSULTING SERVICES
  'cmrmr3ntgt3e0bcea09637af7ec',  // 3 BOXES TECHNOLOGIES
];

// Users to keep - platform super admins + live tenant users
const KEEP_USER_IDS = [
  'cm8g6qmrrvtsrykyjd9l2o19',      // admin@marqai.com (super_admin)
  'cms497veoxsc4thgcoukoaqd',      // superadmin@eh2r.com (super_admin)
  'cmrmr3ntfqw14da35c099aca4cd',   // superadmin@3boxeshrms.com (super_admin)
  'cmrmr3ntfxd76084e0ece18a003',   // admin@marqaitechgroup.com (tenant_admin)
  'cmrmr3osxsv140aa8a46ff03cb0',   // admin@marqaitech.com (admin)
  'cmrmr3osyya168d12d904ac8a58',   // admin@3boxesluxury.com (admin)
  'cmrmr3ot036acf4e4774e7385cb',   // admin@3boxesconsulting.com (admin)
  'cmrmr3ot183b00cf69fc0ce35d0',   // admin@3boxestechnologies.com (admin)
];

// Employee profiles to keep (company admin profiles)
const KEEP_EMPLOYEE_IDS = [
  'cmrmr3osym548ec5d41642126d5',   // Admin MARQ AI TECH
  'cmrmr3oszrid7e06fc5b880e77a',   // Admin 3 BOXES LUXURY
  'cmrmr3ot0we991c3c2187d5bd16',   // Admin 3 BOXES CONSULTING
  'cmrmr3ot21ade88508024b15c35',   // Admin 3 BOXES TECH
];

// Role IDs to keep
const KEEP_ROLE_IDS = [
  'cmq5hzasx006s04l80lrw1mml',    // super_admin
  'cmq5hzate006t04l8gupeoeap',    // tenant_admin
  'role-admin-1783064198935',      // admin
];

async function main() {
  const pool = new Pool({ connectionString: CONNECTION_STRING });
  const client = await pool.connect();

  try {
    console.log('🧹 Starting sample data cleanup...\n');

    // First, let's see current counts
    const beforeCounts = await client.query(`
      SELECT 
        (SELECT COUNT(*) FROM "User") as users,
        (SELECT COUNT(*) FROM "Employee") as employees,
        (SELECT COUNT(*) FROM "UserRoleAssignment") as role_assignments,
        (SELECT COUNT(*) FROM "Tenant") as tenants,
        (SELECT COUNT(*) FROM "CompanyGroup") as company_groups,
        (SELECT COUNT(*) FROM "Company") as companies,
        (SELECT COUNT(*) FROM "Department") as departments,
        (SELECT COUNT(*) FROM "Designation") as designations,
        (SELECT COUNT(*) FROM "Branch") as branches
    `);
    console.log('📊 BEFORE CLEANUP:', beforeCounts.rows[0]);

    await client.query('BEGIN');

    // ==========================================
    // STEP 1: Delete sample UserRoleAssignments
    // ==========================================
    const keepUserIdsList = KEEP_USER_IDS.map(id => `'${id}'`).join(',');
    
    const delRoleAssign = await client.query(`
      DELETE FROM "UserRoleAssignment" 
      WHERE "userId" NOT IN (${keepUserIdsList})
    `);
    console.log(`\n✅ Deleted ${delRoleAssign.rowCount} sample user role assignments`);

    // ==========================================
    // STEP 2: Delete sample employees
    // We need to handle cascading deletes for employee-related data
    // ==========================================
    const keepEmpIdsList = KEEP_EMPLOYEE_IDS.map(id => `'${id}'`).join(',');
    
    // First delete employee-related records for sample employees
    const sampleEmpIds = await client.query(`
      SELECT id FROM "Employee" WHERE id NOT IN (${keepEmpIdsList})
    `);
    
    if (sampleEmpIds.rows.length > 0) {
      const sampleEmpIdList = sampleEmpIds.rows.map((r: any) => `'${r.id}'`).join(',');
      
      // Delete dependent records in order
      const dependentTables = [
        'Dependent', 'Qualification', 'Experience', 'EmployeeSkill',
        'LeaveBalance', 'LeaveRequest', 'Attendance', 'Payroll',
        'Document', 'PerformanceReview', 'Goal', 'TrainingEnrollment',
        'AssetAssignment', 'IncidentReport', 'TravelRequest', 'ExpenseClaim',
        'Timesheet', 'Feedback', 'Promotion', 'Grievance', 'Separation',
        'OnboardingTask', 'Reimbursement', 'ProjectAllocation', 'ProjectMember',
        'FNFCalculation', 'EmployeePaymentMethod', 'Loan', 'OvertimeRecord',
        'PayrollHold', 'PayrollTransactionLine', 'PayrollInput',
        'IncomeTaxDeclaration', 'PayrollAdjustmentLog', 'PayrollAnomaly',
        'GhostEmployeeFlag', 'CrossBorderSecondment', 'EmployeeCustomFieldValue',
        'DottedLineManager', 'TeamMember', 'AttendanceRegularization',
        'HourlyPermission', 'Gatepass', 'OvertimeRequest', 'CompOffLeave',
        'WfhAttendanceSnapshot', 'EmployeeRosterAssignment',
        'LeaveEncashmentRequest', 'OptionalHolidayElection', 'BurnoutFlag',
        'AttendanceAuditLog', 'BiometricEnrollment', 'BiometricPunch',
        'Wallet', 'MarketplaceOrder', 'InsurancePolicy', 'InsuranceClaim',
        'EWARequest', 'LoanMarketplaceListing', 'Gift', 'RewardPointsLedger',
        'MarketplaceFraudFlag', 'FinancialStressFlag', 'WalletBudgetAllocation',
        'ClientFeedback', 'PersonalizedCatalogCache', 'ProjectUtilizationSnapshot',
        'Referral', 'SocialProfile', 'CalendarSync', 'ChatMessage', 'CallLog',
        'CallParticipant', 'FileNode', 'FileVersion', 'FileShareLink',
        'DocumentIntelligenceResult', 'GDPRAnonymizationRequest', 'DLPScanLog',
        'WatermarkAccessLog', 'ExitRequest', 'OKR', 'ExitInterview',
        'SurveyResponse', 'Recognition'
      ];
      
      for (const table of dependentTables) {
        try {
          // Check if table has employeeId column
          const colCheck = await client.query(`
            SELECT column_name FROM information_schema.columns 
            WHERE table_name = '${table}' AND column_name IN ('employeeId', '"employeeId"')
            LIMIT 1
          `);
          if (colCheck.rows.length > 0 || true) {  // Just try, ignore if fails
            const result = await client.query(`DELETE FROM "${table}" WHERE "employeeId" IN (${sampleEmpIdList})`).catch(() => null);
            if (result && result.rowCount && result.rowCount > 0) {
              console.log(`  🗑️  Deleted ${result.rowCount} rows from ${table}`);
            }
          }
        } catch (e: any) {
          // Skip tables that don't have employeeId or don't exist
        }
      }
      
      // Now delete the sample employees
      const delEmps = await client.query(`DELETE FROM "Employee" WHERE id NOT IN (${keepEmpIdsList})`);
      console.log(`\n✅ Deleted ${delEmps.rowCount} sample employees`);
    }

    // ==========================================
    // STEP 3: Delete sample users
    // ==========================================
    const delUsers = await client.query(`
      DELETE FROM "User" WHERE id NOT IN (${keepUserIdsList})
    `);
    console.log(`✅ Deleted ${delUsers.rowCount} sample users`);

    // ==========================================
    // STEP 4: Delete sample designations
    // ==========================================
    const keepCompIdsList = KEEP_COMPANY_IDS.map(id => `'${id}'`).join(',');
    const keepDeptIds = await client.query(`SELECT id FROM "Department" WHERE "companyId" IN (${keepCompIdsList})`);
    const keepDeptIdsList = keepDeptIds.rows.map((r: any) => `'${r.id}'`).join(',');
    
    // Delete designations not in live departments
    if (keepDeptIdsList) {
      const delDesigs = await client.query(`DELETE FROM "Designation" WHERE "departmentId" NOT IN (${keepDeptIdsList})`);
      console.log(`✅ Deleted ${delDesigs.rowCount} sample designations`);
    }

    // ==========================================
    // STEP 5: Delete sample departments
    // ==========================================
    const delDepts = await client.query(`DELETE FROM "Department" WHERE "companyId" NOT IN (${keepCompIdsList})`);
    console.log(`✅ Deleted ${delDepts.rowCount} sample departments`);

    // ==========================================
    // STEP 6: Delete sample branches
    // ==========================================
    const delBranches = await client.query(`DELETE FROM "Branch" WHERE "companyId" NOT IN (${keepCompIdsList})`);
    console.log(`✅ Deleted ${delBranches.rowCount} sample branches`);

    // ==========================================
    // STEP 7: Delete sample companies
    // ==========================================
    const delCompanies = await client.query(`DELETE FROM "Company" WHERE id NOT IN (${keepCompIdsList})`);
    console.log(`✅ Deleted ${delCompanies.rowCount} sample companies`);

    // ==========================================
    // STEP 8: Delete sample company groups
    // ==========================================
    const keepGroupIdsList = KEEP_COMPANY_GROUP_IDS.map(id => `'${id}'`).join(',');
    const delGroups = await client.query(`DELETE FROM "CompanyGroup" WHERE id NOT IN (${keepGroupIdsList})`);
    console.log(`✅ Deleted ${delGroups.rowCount} sample company groups`);

    // ==========================================
    // STEP 9: Delete sample tenants (cascade will handle related data)
    // ==========================================
    const keepTenantIdsList = KEEP_TENANT_IDS.map(id => `'${id}'`).join(',');
    const delTenants = await client.query(`DELETE FROM "Tenant" WHERE id NOT IN (${keepTenantIdsList})`);
    console.log(`✅ Deleted ${delTenants.rowCount} sample tenants`);

    // ==========================================
    // STEP 10: Clean up any orphaned data from sample tenants
    // ==========================================
    
    // Delete orphaned FeatureFlags
    const delFF = await client.query(`DELETE FROM "FeatureFlag" WHERE "tenantId" NOT IN (${keepTenantIdsList})`);
    console.log(`✅ Deleted ${delFF.rowCount} orphaned feature flags`);

    // Delete orphaned Subscriptions
    const delSubs = await client.query(`DELETE FROM "Subscription" WHERE "tenantId" NOT IN (${keepTenantIdsList})`);
    console.log(`✅ Deleted ${delSubs.rowCount} orphaned subscriptions`);

    // Delete orphaned Notifications
    const delNotifs = await client.query(`DELETE FROM "Notification" WHERE "tenantId" NOT IN (${keepTenantIdsList})`);
    console.log(`✅ Deleted ${delNotifs.rowCount} orphaned notifications`);

    // Clean up sample Role-related data (roles are system-level, but clean up assignments)
    // Delete duplicate module entries for super_admin_module and tenant_admin_module if they exist
    // Keep the original module entries

    // ==========================================
    // STEP 11: Clean up duplicate modules
    // ==========================================
    // There are duplicate modules: super_admin (cmq5hzapa006704l8qt1zipcw) and super_admin_module (cmr48gmpb0000f0ogkmwc8v5l)
    // and tenant_admin (cmq5hzaqc006e04l8limdfc9m) and tenant_admin_module (cmr48go770007f0og56uaqvux)
    // Keep the original ones and migrate permissions
    const dupeModuleIds = ['cmr48gmpb0000f0ogkmwc8v5l', 'cmr48go770007f0og56uaqvux'];
    const origModuleIds = { 'super_admin_module': 'cmq5hzapa006704l8qt1zipcw', 'tenant_admin_module': 'cmq5hzaqc006e04l8limdfc9m' };
    
    // Migrate permissions from dupe modules to originals
    for (const dupeId of dupeModuleIds) {
      // Get the key of the dupe module
      const dupeMod = await client.query(`SELECT key FROM "Module" WHERE id = '${dupeId}'`);
      if (dupeMod.rows.length > 0) {
        const dupeKey = dupeMod.rows[0].key;
        // Determine the original module to merge into
        let origId = '';
        if (dupeKey === 'super_admin_module') origId = 'cmq5hzapa006704l8qt1zipcw';
        else if (dupeKey === 'tenant_admin_module') origId = 'cmq5hzaqc006e04l8limdfc9m';
        
        if (origId) {
          // Delete permissions that already exist on original module (avoid unique constraint violation)
          await client.query(`
            DELETE FROM "Permission" 
            WHERE "moduleId" = '${dupeId}' 
            AND action IN (SELECT action FROM "Permission" WHERE "moduleId" = '${origId}')
          `);
          // Move remaining permissions to original module
          const moved = await client.query(`
            UPDATE "Permission" SET "moduleId" = '${origId}' WHERE "moduleId" = '${dupeId}'
          `);
          if (moved.rowCount && moved.rowCount > 0) {
            console.log(`  📦 Moved ${moved.rowCount} permissions from dupe module ${dupeKey}`);
          }
          // Delete the dupe module
          await client.query(`DELETE FROM "Module" WHERE id = '${dupeId}'`);
          console.log(`  🗑️  Deleted duplicate module: ${dupeKey}`);
        }
      }
    }

    // ==========================================
    // STEP 12: Set up RolePermissions for the 3 standard roles
    // ==========================================
    // Ensure all permissions are assigned to super_admin role (full access)
    const allPermissions = await client.query(`SELECT id FROM "Permission"`);
    const superAdminRoleId = KEEP_ROLE_IDS[0];
    const tenantAdminRoleId = KEEP_ROLE_IDS[1];
    const adminRoleId = KEEP_ROLE_IDS[2];
    
    // Assign all permissions to super_admin
    let superAdminPermsAdded = 0;
    for (const perm of allPermissions.rows) {
      const existing = await client.query(`
        SELECT id FROM "RolePermission" WHERE "roleId" = '${superAdminRoleId}' AND "permissionId" = '${perm.id}'
      `);
      if (existing.rows.length === 0) {
        await client.query(`
          INSERT INTO "RolePermission" ("id", "roleId", "permissionId", "createdAt", "updatedAt")
          VALUES (gen_random_uuid(), '${superAdminRoleId}', '${perm.id}', NOW(), NOW())
          ON CONFLICT DO NOTHING
        `);
        superAdminPermsAdded++;
      }
    }
    console.log(`\n✅ Added ${superAdminPermsAdded} permissions to super_admin role`);
    
    // Assign most permissions to tenant_admin (all except super_admin module)
    const tenantPerms = await client.query(`
      SELECT p.id FROM "Permission" p 
      JOIN "Module" m ON p."moduleId" = m.id 
      WHERE m.key NOT IN ('super_admin', 'super_admin_module')
    `);
    let tenantAdminPermsAdded = 0;
    for (const perm of tenantPerms.rows) {
      const existing = await client.query(`
        SELECT id FROM "RolePermission" WHERE "roleId" = '${tenantAdminRoleId}' AND "permissionId" = '${perm.id}'
      `);
      if (existing.rows.length === 0) {
        await client.query(`
          INSERT INTO "RolePermission" ("id", "roleId", "permissionId", "createdAt", "updatedAt")
          VALUES (gen_random_uuid(), '${tenantAdminRoleId}', '${perm.id}', NOW(), NOW())
          ON CONFLICT DO NOTHING
        `);
        tenantAdminPermsAdded++;
      }
    }
    console.log(`✅ Added ${tenantAdminPermsAdded} permissions to tenant_admin role`);
    
    // Assign company-level permissions to admin role (exclude tenant_admin and super_admin modules)
    const adminPerms = await client.query(`
      SELECT p.id FROM "Permission" p 
      JOIN "Module" m ON p."moduleId" = m.id 
      WHERE m.key NOT IN ('super_admin', 'super_admin_module', 'tenant_admin', 'tenant_admin_module', 'settings')
    `);
    let adminPermsAdded = 0;
    for (const perm of adminPerms.rows) {
      const existing = await client.query(`
        SELECT id FROM "RolePermission" WHERE "roleId" = '${adminRoleId}' AND "permissionId" = '${perm.id}'
      `);
      if (existing.rows.length === 0) {
        await client.query(`
          INSERT INTO "RolePermission" ("id", "roleId", "permissionId", "createdAt", "updatedAt")
          VALUES (gen_random_uuid(), '${adminRoleId}', '${perm.id}', NOW(), NOW())
          ON CONFLICT DO NOTHING
        `);
        adminPermsAdded++;
      }
    }
    console.log(`✅ Added ${adminPermsAdded} permissions to admin role`);

    // ==========================================
    // STEP 13: Re-create UserRoleAssignments for live users
    // ==========================================
    // Clear and recreate proper role assignments
    await client.query(`DELETE FROM "UserRoleAssignment"`);
    
    // Super Admin users → super_admin role
    const superAdminUsers = [
      'cm8g6qmrrvtsrykyjd9l2o19',      // admin@marqai.com
      'cms497veoxsc4thgcoukoaqd',      // superadmin@eh2r.com
      'cmrmr3ntfqw14da35c099aca4cd',   // superadmin@3boxeshrms.com
    ];
    
    for (const userId of superAdminUsers) {
      await client.query(`
        INSERT INTO "UserRoleAssignment" ("id", "userId", "roleId", "companyId", "assignedBy", "createdAt", "updatedAt")
        VALUES (gen_random_uuid(), '${userId}', '${superAdminRoleId}', NULL, '${cm8g6qmrrvtsrykyjd9l2o19}', NOW(), NOW())
        ON CONFLICT DO NOTHING
      `);
    }
    console.log(`✅ Assigned super_admin role to ${superAdminUsers.length} users`);
    
    // Tenant Admin users → tenant_admin role
    const tenantAdminUsers = [
      'cmrmr3ntfxd76084e0ece18a003',   // admin@marqaitechgroup.com
    ];
    
    for (const userId of tenantAdminUsers) {
      await client.query(`
        INSERT INTO "UserRoleAssignment" ("id", "userId", "roleId", "companyId", "assignedBy", '${cm8g6qmrrvtsrykyjd9l2o19}', NOW(), NOW())
        VALUES (gen_random_uuid(), '${userId}', '${tenantAdminRoleId}', NULL, '${cm8g6qmrrvtsrykyjd9l2o19}', NOW(), NOW())
        ON CONFLICT DO NOTHING
      `);
    }
    console.log(`✅ Assigned tenant_admin role to ${tenantAdminUsers.length} users`);
    
    // Company Admin users → admin role (scoped to their company)
    const companyAdminUsers = [
      { userId: 'cmrmr3osxsv140aa8a46ff03cb0', companyId: 'cmrmr3ntga2ecb95cccbe4a3e2d' },  // admin@marqaitech.com → MATPL
      { userId: 'cmrmr3osyya168d12d904ac8a58', companyId: 'cmrmr3ntggiaef373e0086cd965' },  // admin@3boxesluxury.com → 3BLC
      { userId: 'cmrmr3ot036acf4e4774e7385cb', companyId: 'cmrmr3ntgmsee49e9f8864a6b17' },  // admin@3boxesconsulting.com → 3BCS
      { userId: 'cmrmr3ot183b00cf69fc0ce35d0', companyId: 'cmrmr3ntgt3e0bcea09637af7ec' },  // admin@3boxestechnologies.com → 3BT
    ];
    
    for (const { userId, companyId } of companyAdminUsers) {
      await client.query(`
        INSERT INTO "UserRoleAssignment" ("id", "userId", "roleId", "companyId", "assignedBy", "createdAt", "updatedAt")
        VALUES (gen_random_uuid(), '${userId}', '${adminRoleId}', '${companyId}', '${cm8g6qmrrvtsrykyjd9l2o19}', NOW(), NOW())
        ON CONFLICT DO NOTHING
      `);
    }
    console.log(`✅ Assigned admin role to ${companyAdminUsers.length} company admin users`);

    // ==========================================
    // FINAL: Verify counts
    // ==========================================
    await client.query('COMMIT');
    
    const afterCounts = await client.query(`
      SELECT 
        (SELECT COUNT(*) FROM "User") as users,
        (SELECT COUNT(*) FROM "Employee") as employees,
        (SELECT COUNT(*) FROM "UserRoleAssignment") as role_assignments,
        (SELECT COUNT(*) FROM "Tenant") as tenants,
        (SELECT COUNT(*) FROM "CompanyGroup") as company_groups,
        (SELECT COUNT(*) FROM "Company") as companies,
        (SELECT COUNT(*) FROM "Department") as departments,
        (SELECT COUNT(*) FROM "Designation") as designations,
        (SELECT COUNT(*) FROM "Branch") as branches,
        (SELECT COUNT(*) FROM "RolePermission") as role_permissions
    `);
    console.log('\n📊 AFTER CLEANUP:', afterCounts.rows[0]);
    
    // Verify remaining users
    const remainingUsers = await client.query(`
      SELECT u.id, u.email, u.name, u.role, r.name as assigned_role, r.key as role_key, ura."companyId"
      FROM "User" u
      LEFT JOIN "UserRoleAssignment" ura ON u.id = ura."userId"
      LEFT JOIN "Role" r ON ura."roleId" = r.id
      ORDER BY u.role, u.email
    `);
    console.log('\n👥 REMAINING USERS WITH ROLES:');
    remainingUsers.rows.forEach((r: any) => {
      console.log(`  ${r.email} | user.role=${r.role} | assigned=${r.role_key || 'none'} | company=${r.companyId || 'global'}`);
    });
    
    // Verify remaining employees
    const remainingEmps = await client.query(`
      SELECT e."employeeId", e."firstName", e."lastName", e.email, e."companyId"
      FROM "Employee" e
      ORDER BY e.email
    `);
    console.log('\n👤 REMAINING EMPLOYEES:');
    remainingEmps.rows.forEach((r: any) => {
      console.log(`  ${r.employeeId} | ${r.firstName} ${r.lastName} | ${r.email} | company=${r.companyId}`);
    });

    console.log('\n✅ Sample data cleanup completed successfully!');
    
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('❌ Error during cleanup:', error.message);
    console.error(error.stack);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
