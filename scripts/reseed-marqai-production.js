/**
 * 3Boxes HRMS - Clean & Re-seed MarqAI Tech Group (Production)
 * 
 * This script:
 * 1. Removes ALL MarqAI-specific sample data (employees, users, designations, etc.)
 * 2. Creates fresh tenant with 4 companies (no sample employees)
 * 3. Creates only super_admin + tenant_admin users
 * 4. Sets up basic master data (departments, designations) per company
 */

const { Client } = require('pg');
const crypto = require('crypto');

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_pxZd8woKe4WB@ep-blue-fire-aqk8jxd2-pooler.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require';
const PASSWORD_HASH = '$2b$12$7eWvdTwkl.L3OH8BPcnmz.7mfmM8/zrNUnMaTse4fa.0DvBaVNjbS'; // MarqAI@2026

// Generate cuid2-like IDs
function generateId() {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(8).toString('hex').substring(0, 20);
  return `cmr${timestamp}${random}`.substring(0, 30);
}

// New company structure - Marq AI Tech Group of Companies
const NEW_COMPANIES = [
  { name: 'MARQ AI TECH PVT LTD', code: 'MATPL', city: 'Hyderabad', state: 'TS', email: 'info@marqaitech.com', website: 'https://marqaitech.com' },
  { name: '3 BOXES LUXURY CURATIONS', code: '3BLC', city: 'Hyderabad', state: 'TS', email: 'info@3boxesluxury.com', website: 'https://3boxesluxury.com' },
  { name: '3 BOXES CONSULTING SERVICES', code: '3BCS', city: 'Bangalore', state: 'KA', email: 'info@3boxesconsulting.com', website: 'https://3boxesconsulting.com' },
  { name: '3 BOXES TECHNOLOGIES', code: '3BT', city: 'Chennai', state: 'TN', email: 'info@3boxestechnologies.com', website: 'https://3boxestechnologies.com' },
];

// Basic departments per company (HR will add more)
const BASIC_DEPARTMENTS = ['Human Resources', 'Finance', 'Operations'];

// Basic designations per department
const BASIC_DESIGNATIONS = [
  { title: 'CEO', deptName: 'Human Resources', level: 10 },
  { title: 'HR Manager', deptName: 'Human Resources', level: 5 },
  { title: 'Finance Manager', deptName: 'Finance', level: 5 },
  { title: 'Operations Manager', deptName: 'Operations', level: 5 },
];

async function main() {
  const client = new Client({ connectionString: CONNECTION_STRING });
  await client.connect();
  console.log('🔧 Connected to production database');

  try {
    await client.query('BEGIN');

    // ==================== STEP 1: Get & Clean MarqAI Tenant ====================
    console.log('\n📋 Step 1: Cleaning existing MarqAI data...');
    const tenantRes = await client.query(`SELECT id, slug FROM "Tenant" WHERE slug = 'marqaitechgroup'`);
    
    if (tenantRes.rows.length > 0) {
      const tenantId = tenantRes.rows[0].id;
      console.log(`  Found existing tenant: ${tenantId}`);

      // Get all MarqAI company IDs
      const companyRes = await client.query(`SELECT id FROM "Company" WHERE "companyGroupId" IN (SELECT id FROM "CompanyGroup" WHERE "tenantId" = $1)`, [tenantId]);
      const companyIds = companyRes.rows.map(r => r.id);

      if (companyIds.length > 0) {
        // Delete in dependency order
        await client.query(`DELETE FROM "Employee" WHERE "companyId" = ANY($1)`, [companyIds]);
        console.log('  ✓ Deleted employees');
        
        const deptRes = await client.query(`SELECT id FROM "Department" WHERE "companyId" = ANY($1)`, [companyIds]);
        const deptIds = deptRes.rows.map(r => r.id);
        if (deptIds.length > 0) {
          await client.query(`DELETE FROM "Designation" WHERE "departmentId" = ANY($1)`, [deptIds]);
          await client.query(`DELETE FROM "Department" WHERE "id" = ANY($1)`, [deptIds]);
          console.log('  ✓ Deleted designations & departments');
        }
        
        await client.query(`DELETE FROM "Branch" WHERE "companyId" = ANY($1)`, [companyIds]);
        await client.query(`DELETE FROM "Company" WHERE "id" = ANY($1)`, [companyIds]);
        console.log('  ✓ Deleted branches & companies');
      }

      await client.query(`DELETE FROM "CompanyGroup" WHERE "tenantId" = $1`, [tenantId]);
      await client.query(`DELETE FROM "User" WHERE "tenantId" = $1 AND email != 'superadmin@3boxeshrms.com'`, [tenantId]);
      await client.query(`DELETE FROM "Tenant" WHERE id = $1`, [tenantId]);
      console.log('  ✓ Deleted company groups, users, and tenant');
    }

    // Also clean demo tenants
    const demoTenants = await client.query(`SELECT id FROM "Tenant" WHERE slug IN ('3boxes-hrms-demo', 'demo')`);
    for (const dt of demoTenants.rows) {
      const demoCompanyRes = await client.query(`SELECT id FROM "Company" WHERE "companyGroupId" IN (SELECT id FROM "CompanyGroup" WHERE "tenantId" = $1)`, [dt.id]);
      const demoCompanyIds = demoCompanyRes.rows.map(r => r.id);
      if (demoCompanyIds.length > 0) {
        const demoDeptRes = await client.query(`SELECT id FROM "Department" WHERE "companyId" = ANY($1)`, [demoCompanyIds]);
        const demoDeptIds = demoDeptRes.rows.map(r => r.id);
        if (demoDeptIds.length > 0) {
          await client.query(`DELETE FROM "Employee" WHERE "companyId" = ANY($1)`, [demoCompanyIds]);
          await client.query(`DELETE FROM "Designation" WHERE "departmentId" = ANY($1)`, [demoDeptIds]);
          await client.query(`DELETE FROM "Department" WHERE "id" = ANY($1)`, [demoDeptIds]);
        }
        await client.query(`DELETE FROM "Branch" WHERE "companyId" = ANY($1)`, [demoCompanyIds]);
        await client.query(`DELETE FROM "Company" WHERE "id" = ANY($1)`, [demoCompanyIds]);
      }
      await client.query(`DELETE FROM "CompanyGroup" WHERE "tenantId" = $1`, [dt.id]);
      await client.query(`DELETE FROM "User" WHERE "tenantId" = $1`, [dt.id]);
      await client.query(`DELETE FROM "Tenant" WHERE id = $1`, [dt.id]);
    }
    console.log('  ✓ Cleaned demo tenants');

    // ==================== STEP 2: Create fresh Tenant ====================
    console.log('\n📋 Step 2: Creating fresh tenant...');
    const tenantId = generateId();
    await client.query(`
      INSERT INTO "Tenant" (id, name, slug, domain, plan, status, country, currency, timezone, language, "baseCurrency", "maxCompaniesAllowed", "aiFeedbackEnabled", "resumeScoreThreshold", "talentPoolCrossCompanyEnabled", "videoInterviewRetakeLimit", "videoRetentionDays", "createdAt", "updatedAt")
      VALUES ($1, 'Marq AI Tech Group', 'marqaitechgroup', 'marqaitechgroup.3boxeshrms.com', 'enterprise', 'active', 'IN', 'INR', 'Asia/Kolkata', 'en', 'INR', 10, true, 0, true, 2, 90, NOW(), NOW())
    `, [tenantId]);
    console.log(`  ✓ Tenant: Marq AI Tech Group (${tenantId})`);

    // ==================== STEP 3: Create Super Admin ====================
    console.log('\n📋 Step 3: Creating Super Admin...');
    const existingSuper = await client.query(`SELECT id FROM "User" WHERE email = 'superadmin@3boxeshrms.com'`);
    
    if (existingSuper.rows.length > 0) {
      await client.query(`UPDATE "User" SET "tenantId" = $1, password = $2 WHERE email = 'superadmin@3boxeshrms.com'`, [tenantId, PASSWORD_HASH]);
      console.log('  ✓ Updated existing Super Admin');
    } else {
      await client.query(`
        INSERT INTO "User" (id, email, name, password, role, status, "tenantId", "createdAt", "updatedAt")
        VALUES ($1, 'superadmin@3boxeshrms.com', '3Boxes Super Admin', $2, 'super_admin', 'active', $3, NOW(), NOW())
      `, [generateId(), PASSWORD_HASH, tenantId]);
      console.log('  ✓ Super Admin created');
    }

    // ==================== STEP 4: Create Tenant Admin ====================
    console.log('\n📋 Step 4: Creating Tenant Admin...');
    await client.query(`
      INSERT INTO "User" (id, email, name, password, role, status, "tenantId", "createdAt", "updatedAt")
      VALUES ($1, 'admin@marqaitechgroup.com', 'Marq AI Tech Group Admin', $2, 'tenant_admin', 'active', $3, NOW(), NOW())
    `, [generateId(), PASSWORD_HASH, tenantId]);
    console.log('  ✓ Tenant Admin: admin@marqaitechgroup.com');

    // ==================== STEP 5: Create Company Group ====================
    console.log('\n📋 Step 5: Creating Company Group...');
    const companyGroupId = generateId();
    await client.query(`
      INSERT INTO "CompanyGroup" (id, name, "tenantId", "employeeLimitMode", "maxEmployees", "maxCompanies", "createdAt", "updatedAt")
      VALUES ($1, 'Marq AI Tech Group', $2, 'group_total', 500, 10, NOW(), NOW())
    `, [companyGroupId, tenantId]);
    console.log(`  ✓ Company Group: Marq AI Tech Group`);

    // ==================== STEP 6: Create 4 Companies ====================
    console.log('\n📋 Step 6: Creating 4 Companies...');
    const createdCompanies = [];
    for (const comp of NEW_COMPANIES) {
      const compId = generateId();
      await client.query(`
        INSERT INTO "Company" (id, name, code, "companyGroupId", country, currency, timezone, city, state, email, website, status, "maxEmployees", "createdAt", "updatedAt")
        VALUES ($1, $2, $3, $4, 'IN', 'INR', 'Asia/Kolkata', $5, $6, $7, $8, 'active', 100, NOW(), NOW())
      `, [compId, comp.name, comp.code, companyGroupId, comp.city, comp.state, comp.email, comp.website]);
      createdCompanies.push({ id: compId, name: comp.name, code: comp.code, city: comp.city, state: comp.state });
      console.log(`  ✓ ${comp.name} (${comp.code})`);
    }

    // ==================== STEP 7: Create Branches ====================
    console.log('\n📋 Step 7: Creating Head Office branches...');
    const createdBranches = [];
    for (const comp of createdCompanies) {
      const branchId = generateId();
      await client.query(`
        INSERT INTO "Branch" (id, name, code, "companyId", city, state, country, status, "createdAt", "updatedAt")
        VALUES ($1, $2, $3, $4, $5, $6, 'IN', 'active', NOW(), NOW())
      `, [branchId, `${comp.name} - Head Office`, `${comp.code}-HO`, comp.id, comp.city, comp.state]);
      createdBranches.push({ id: branchId, companyId: comp.id, companyCode: comp.code });
      console.log(`  ✓ ${comp.name} - Head Office`);
    }

    // ==================== STEP 8: Create Basic Departments ====================
    console.log('\n📋 Step 8: Creating basic departments (HR will add more)...');
    const createdDepts = [];
    for (let i = 0; i < createdCompanies.length; i++) {
      const comp = createdCompanies[i];
      const branch = createdBranches[i];
      for (const deptName of BASIC_DEPARTMENTS) {
        const deptId = generateId();
        await client.query(`
          INSERT INTO "Department" (id, name, "companyId", "branchId", status, "createdAt", "updatedAt")
          VALUES ($1, $2, $3, $4, 'active', NOW(), NOW())
        `, [deptId, deptName, comp.id, branch.id]);
        createdDepts.push({ id: deptId, name: deptName, companyId: comp.id, companyCode: comp.code });
      }
      console.log(`  ✓ ${comp.code}: ${BASIC_DEPARTMENTS.join(', ')}`);
    }

    // ==================== STEP 9: Create Basic Designations ====================
    console.log('\n📋 Step 9: Creating basic designations...');
    let desCount = 0;
    for (const template of BASIC_DESIGNATIONS) {
      const matchingDepts = createdDepts.filter(d => d.name === template.deptName);
      for (const dept of matchingDepts) {
        const desId = generateId();
        await client.query(`
          INSERT INTO "Designation" (id, title, "departmentId", level, status, "createdAt", "updatedAt")
          VALUES ($1, $2, $3, $4, 'active', NOW(), NOW())
        `, [desId, template.title, dept.id, template.level]);
        desCount++;
      }
    }
    console.log(`  ✓ Created ${desCount} designations`);

    // ==================== STEP 10: Verify ====================
    console.log('\n📋 Step 10: Final verification...');

    const counts = {};
    for (const table of ['Tenant', 'CompanyGroup', 'Company', 'Branch', 'Department', 'Designation', 'User', 'Employee']) {
      const res = await client.query(`SELECT count(*) FROM "${table}"`);
      counts[table] = parseInt(res.rows[0].count);
    }
    console.log('  Production DB counts:');
    Object.entries(counts).forEach(([k, v]) => console.log(`    ${k}: ${v}`));

    // Verify tenant
    const verifyTenant = await client.query(`SELECT name, slug, domain FROM "Tenant" WHERE slug = 'marqaitechgroup'`);
    console.log(`  Tenant: ${JSON.stringify(verifyTenant.rows[0])}`);

    // Verify companies
    const verifyCompanies = await client.query(`SELECT name, code FROM "Company" WHERE "companyGroupId" = $1 ORDER BY "createdAt"`, [companyGroupId]);
    console.log('  Companies:');
    verifyCompanies.rows.forEach(c => console.log(`    - ${c.name} (${c.code})`));

    // Verify users (should be exactly 2 for MarqAI)
    const verifyUsers = await client.query(`SELECT email, role FROM "User" WHERE "tenantId" = $1`, [tenantId]);
    console.log('  Users (MarqAI only):');
    verifyUsers.rows.forEach(u => console.log(`    - ${u.email} (${u.role})`));

    // Verify NO employees
    const empCheck = await client.query(`SELECT count(*) FROM "Employee" e JOIN "Company" c ON e."companyId" = c.id WHERE c."companyGroupId" = $1`, [companyGroupId]);
    console.log(`  Employees: ${empCheck.rows[0].count} (should be 0 - HR will add)`);

    await client.query('COMMIT');
    console.log('\n✅ All changes committed successfully!');
    console.log('\n========================================');
    console.log('  Marq AI Tech Group - Fresh Setup!');
    console.log('========================================');
    console.log('');
    console.log('  🌐 Domain: marqaitechgroup.3boxeshrms.com');
    console.log('');
    console.log('  📧 Login Credentials (Password: MarqAI@2026):');
    console.log('  🔑 Super Admin: superadmin@3boxeshrms.com');
    console.log('  🔑 Tenant Admin: admin@marqaitechgroup.com');
    console.log('');
    console.log('  🏢 Companies:');
    NEW_COMPANIES.forEach(c => console.log(`     - ${c.name} (${c.code})`));
    console.log('');
    console.log('  ⚠️  No sample employees - HR will add their own data');
    console.log('');

  } catch (e) {
    await client.query('ROLLBACK');
    console.error('❌ Error, rolled back:', e.message);
    throw e;
  } finally {
    await client.end();
  }
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
