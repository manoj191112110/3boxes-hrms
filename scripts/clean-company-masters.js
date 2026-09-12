/**
 * Clean Company Masters for Tenants
 * Removes sample/other-company master data (departments, designations, branches)
 * Keeps only the registered company's master data for each tenant
 */

const { Pool } = require('@neondatabase/serverless');

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_pxZd8woKe4WB@ep-blue-fire-aqk8jxd2-pooler.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function cleanCompanyMasters() {
  const pool = new Pool({ connectionString: CONNECTION_STRING });
  
  console.log('=== Cleaning Company Masters for Tenants ===\n');
  
  try {
    // Get ALL tenants
    const tenants = await pool.query(`
      SELECT id, name, slug FROM "Tenant" WHERE status = 'active'
    `);
    
    // Build a map of all tenant company IDs
    const allTenantCompanyIds = new Set();
    for (const tenant of tenants.rows) {
      const companies = await pool.query(`
        SELECT c.id FROM "Company" c
        JOIN "CompanyGroup" cg ON c."companyGroupId" = cg.id
        WHERE cg."tenantId" = '${tenant.id}' AND c.status = 'active'
      `);
      companies.rows.forEach(c => allTenantCompanyIds.add(c.id));
    }
    
    const validCompanyIds = Array.from(allTenantCompanyIds).map(id => `'${id}'`).join(',');
    console.log(`Total valid company IDs across all tenants: ${allTenantCompanyIds.size}`);
    
    // Get valid department IDs (belonging to valid companies)
    const validDepts = await pool.query(`
      SELECT id FROM "Department" WHERE "companyId" IN (${validCompanyIds})
    `);
    const validDeptIds = validDepts.rows.map(d => `'${d.id}'`).join(',');
    console.log(`Valid department IDs: ${validDepts.rows.length}`);
    
    // Step 1: Delete designations not in valid departments
    console.log('\n--- Cleaning Designations ---');
    const delDesigs = await pool.query(`
      DELETE FROM "Designation" 
      WHERE "departmentId" NOT IN (${validDeptIds})
    `);
    console.log(`Deleted ${delDesigs.rowCount} designations from other companies`);
    
    // Step 2: Delete departments not in valid companies
    console.log('\n--- Cleaning Departments ---');
    const delDepts = await pool.query(`
      DELETE FROM "Department" 
      WHERE "companyId" NOT IN (${validCompanyIds})
    `);
    console.log(`Deleted ${delDepts.rowCount} departments from other companies`);
    
    // Step 3: Delete branches not in valid companies
    console.log('\n--- Cleaning Branches ---');
    const delBranches = await pool.query(`
      DELETE FROM "Branch" 
      WHERE "companyId" NOT IN (${validCompanyIds})
    `);
    console.log(`Deleted ${delBranches.rowCount} branches from other companies`);
    
    // Step 4: Delete companies not in valid company IDs (orphans / non-tenant)
    console.log('\n--- Cleaning Companies ---');
    const delCompanies = await pool.query(`
      DELETE FROM "Company"
      WHERE id NOT IN (${validCompanyIds}) AND status = 'active'
    `);
    console.log(`Deleted ${delCompanies.rowCount} orphan companies`);
    
    console.log('\n=== Cleanup Complete ===');
    
    // Verify remaining for marqaitechgroup
    const mqt = await pool.query(`SELECT id, name FROM "Tenant" WHERE slug = 'marqaitechgroup'`);
    if (mqt.rows.length > 0) {
      const mqtCompanies = await pool.query(`
        SELECT c.id, c.name FROM "Company" c
        JOIN "CompanyGroup" cg ON c."companyGroupId" = cg.id
        WHERE cg."tenantId" = '${mqt.rows[0].id}' AND c.status = 'active'
      `);
      const mqtCompanyIds = mqtCompanies.rows.map(c => `'${c.id}'`).join(',');
      
      console.log('\nRemaining masters for Marq AI Tech Group:');
      mqtCompanies.rows.forEach(c => console.log(`  Company: ${c.name}`));
      
      const mqtDepts = await pool.query(`
        SELECT d.name, c.name as company FROM "Department" d
        JOIN "Company" c ON d."companyId" = c.id
        WHERE c.id IN (${mqtCompanyIds})
      `);
      console.log('\nDepartments:');
      mqtDepts.rows.forEach(d => console.log(`  - ${d.name} (${d.company})`));
      
      const mqtBranches = await pool.query(`
        SELECT b.name, c.name as company FROM "Branch" b
        JOIN "Company" c ON b."companyId" = c.id
        WHERE c.id IN (${mqtCompanyIds})
      `);
      console.log('\nBranches:');
      mqtBranches.rows.forEach(b => console.log(`  - ${b.name} (${b.company})`));
    }
    
  } catch (error) {
    console.error('Error:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

cleanCompanyMasters()
  .then(() => {
    console.log('\nScript completed successfully!');
    process.exit(0);
  })
  .catch(err => {
    console.error('\nScript failed:', err);
    process.exit(1);
  });