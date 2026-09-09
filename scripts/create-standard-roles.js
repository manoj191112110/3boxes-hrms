/**
 * Create Standard Roles for Existing Tenants
 * This script adds predefined tenant-level roles to all existing tenants
 */

const { Pool } = require('@neondatabase/serverless');

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_pxZd8woKe4WB@ep-blue-fire-aqk8jxd2-pooler.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require';

const STANDARD_TENANT_ROLES = [
  { key: 'hr_admin', name: 'HR Administrator', description: 'HR operations - employees, recruitment, onboarding, leave, attendance', level: 3, isSystem: true },
  { key: 'finance_admin', name: 'Finance Administrator', description: 'Finance operations - payroll, salary structures, expenses, invoices', level: 3, isSystem: true },
  { key: 'it_admin', name: 'IT Administrator', description: 'IT operations - assets, helpdesk, system settings', level: 3, isSystem: true },
  { key: 'manager', name: 'Manager', description: 'Team management - team employees, timesheets, performance reviews, leave approvals', level: 4, isSystem: true },
  { key: 'employee', name: 'Employee', description: 'Basic employee access - view own profile, request leave, view payslips, submit timesheets', level: 5, isSystem: true },
  { key: 'recruiter', name: 'Recruiter', description: 'Recruitment operations - job postings, candidate screening, interview scheduling', level: 4, isSystem: true },
];

async function createStandardRolesForExistingTenants() {
  const pool = new Pool({ connectionString: CONNECTION_STRING });
  
  console.log('=== Creating Standard Roles for Existing Tenants ===\n');
  
  try {
    // Get all active tenants
    const tenants = await pool.query(`
      SELECT id, name, slug FROM "Tenant" WHERE status = 'active'
    `);
    console.log(`Found ${tenants.rows.length} active tenants`);
    tenants.rows.forEach(t => console.log(`  - ${t.name} (${t.slug})`));
    
    // For each tenant, create standard roles
    for (const tenant of tenants.rows) {
      console.log(`\n--- Processing tenant: ${tenant.name} ---`);
      
      for (const roleDef of STANDARD_TENANT_ROLES) {
        // Check if role already exists
        const existing = await pool.query(`
          SELECT id FROM "Role" WHERE key = '${roleDef.key}' AND "tenantId" = '${tenant.id}' AND "companyId" IS NULL
        `);
        
        if (existing.rows.length > 0) {
          console.log(`  ✓ Role '${roleDef.key}' already exists`);
        } else {
          // Create the role
          await pool.query(`
            INSERT INTO "Role" (id, name, key, description, level, "isSystem", "tenantId", status, "createdAt", "updatedAt")
            SELECT gen_random_uuid(), '${roleDef.name}', '${roleDef.key}', '${roleDef.description}', ${roleDef.level}, ${roleDef.isSystem}, '${tenant.id}', 'active', NOW(), NOW()
          `);
          console.log(`  + Created role '${roleDef.key}' (${roleDef.name})`);
        }
      }
    }
    
    // Verify created roles
    console.log('\n=== Verification ===');
    const allRoles = await pool.query(`
      SELECT r.key, r.name, r."tenantId", t.name as tenant_name
      FROM "Role" r
      LEFT JOIN "Tenant" t ON r."tenantId" = t.id
      WHERE r.key IN ('hr_admin', 'finance_admin', 'it_admin', 'manager', 'employee', 'recruiter')
      ORDER BY t.name, r.key
    `);
    
    console.log(`\nTotal standard tenant roles: ${allRoles.rows.length}`);
    allRoles.rows.forEach(r => {
      console.log(`  - ${r.key} (${r.name}) - Tenant: ${r.tenant_name || 'Global'}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

createStandardRolesForExistingTenants()
  .then(() => {
    console.log('\nScript completed successfully!');
    process.exit(0);
  })
  .catch(err => {
    console.error('\nScript failed:', err);
    process.exit(1);
  });