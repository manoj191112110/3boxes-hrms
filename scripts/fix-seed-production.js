/**
 * 3Boxes HRMS - MarqAI Tech Group Seed Fix Script
 * 
 * This script fixes the partial seed by:
 * 1. Removing duplicate companies/branches/departments from the second run
 * 2. Creating proper designations (with title + departmentId)  
 * 3. Linking HR admin and employee users to their employee records
 * 4. Creating the subscription plan
 */

const { Client } = require('pg');

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_pxZd8woKe4WB@ep-blue-fire-aqk8jxd2-pooler.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function main() {
  const client = new Client({ connectionString: CONNECTION_STRING });
  await client.connect();
  console.log('🔧 Connected to production database');

  try {
    await client.query('BEGIN');

    // ==================== STEP 1: Clean up duplicate data ====================
    console.log('\n📋 Step 1: Cleaning up duplicate data from second run...');

    // Get the duplicate company IDs (the second batch)
    const dupCompanies = await client.query(`
      SELECT id, name FROM "Company" 
      WHERE name LIKE 'MarqAI%' 
      ORDER BY "createdAt" ASC 
      OFFSET 5
    `);
    const dupCompanyIds = dupCompanies.rows.map(r => r.id);
    console.log(`  Found ${dupCompanyIds.length} duplicate companies to remove`);

    if (dupCompanyIds.length > 0) {
      // Delete in order: Employees (none), Departments, Branches, Companies
      for (const cid of dupCompanyIds) {
        // Delete departments for this company
        const deptRes = await client.query(`DELETE FROM "Department" WHERE "companyId" = $1`, [cid]);
        console.log(`  Deleted ${deptRes.rowCount} departments for ${cid}`);
        
        // Delete branches for this company
        const branchRes = await client.query(`DELETE FROM "Branch" WHERE "companyId" = $1`, [cid]);
        console.log(`  Deleted ${branchRes.rowCount} branches for ${cid}`);
      }
      
      // Delete the duplicate companies
      const compRes = await client.query(`DELETE FROM "Company" WHERE id = ANY($1)`, [dupCompanyIds]);
      console.log(`  ✓ Deleted ${compRes.rowCount} duplicate companies`);
    }

    // ==================== STEP 2: Get existing data references ====================
    console.log('\n📋 Step 2: Getting existing data references...');

    const tenant = await client.query(`SELECT id FROM "Tenant" WHERE slug = 'marqaitechgroup'`);
    const tenantId = tenant.rows[0].id;
    console.log(`  Tenant ID: ${tenantId}`);

    const companies = await client.query(`
      SELECT id, name, code FROM "Company" 
      WHERE name LIKE 'MarqAI%' 
      ORDER BY "createdAt" ASC LIMIT 5
    `);
    console.log(`  Companies: ${companies.rows.map(c => c.code).join(', ')}`);

    // Get the HR departments for each company
    const hrDepts = await client.query(`
      SELECT d.id, d.name, d."companyId", c.code 
      FROM "Department" d 
      JOIN "Company" c ON d."companyId" = c.id 
      WHERE c.name LIKE 'MarqAI%' AND d.name = 'Human Resources'
      ORDER BY c."createdAt" ASC
    `);
    console.log(`  HR Departments: ${hrDepts.rows.length}`);

    const engDepts = await client.query(`
      SELECT d.id, d.name, d."companyId", c.code 
      FROM "Department" d 
      JOIN "Company" c ON d."companyId" = c.id 
      WHERE c.name LIKE 'MarqAI%' AND d.name = 'Engineering'
      ORDER BY c."createdAt" ASC
    `);
    console.log(`  Engineering Departments: ${engDepts.rows.length}`);

    const finDepts = await client.query(`
      SELECT d.id, d.name, d."companyId", c.code 
      FROM "Department" d 
      JOIN "Company" c ON d."companyId" = c.id 
      WHERE c.name LIKE 'MarqAI%' AND d.name = 'Finance'
      ORDER BY c."createdAt" ASC
    `);
    console.log(`  Finance Departments: ${finDepts.rows.length}`);

    const salesDepts = await client.query(`
      SELECT d.id, d.name, d."companyId", c.code 
      FROM "Department" d 
      JOIN "Company" c ON d."companyId" = c.id 
      WHERE c.name LIKE 'MarqAI%' AND d.name = 'Sales & Marketing'
      ORDER BY c."createdAt" ASC
    `);
    console.log(`  Sales Depts: ${salesDepts.rows.length}`);

    // ==================== STEP 3: Create Designations ====================
    console.log('\n📋 Step 3: Creating designations...');

    // Designations need title and departmentId
    // Create designations per department
    const designationTemplates = [
      { title: 'CEO', deptName: 'Human Resources', level: 10 },
      { title: 'CTO', deptName: 'Engineering', level: 10 },
      { title: 'HR Manager', deptName: 'Human Resources', level: 5 },
      { title: 'Software Engineer', deptName: 'Engineering', level: 3 },
      { title: 'Senior Software Engineer', deptName: 'Engineering', level: 5 },
      { title: 'Team Lead', deptName: 'Engineering', level: 6 },
      { title: 'Finance Manager', deptName: 'Finance', level: 5 },
      { title: 'Sales Manager', deptName: 'Sales & Marketing', level: 5 },
    ];

    // Check existing designations for MarqAI
    const existingDes = await client.query(`
      SELECT d.id, d.title, d."departmentId" FROM "Designation" d
      JOIN "Department" dept ON d."departmentId" = dept.id
      JOIN "Company" c ON dept."companyId" = c.id
      WHERE c.name LIKE 'MarqAI%'
    `);
    console.log(`  Existing MarqAI designations: ${existingDes.rows.length}`);

    let desCount = 0;
    const allDepts = [...hrDepts.rows, ...engDepts.rows, ...finDepts.rows, ...salesDepts.rows];

    for (const template of designationTemplates) {
      const matchingDepts = allDepts.filter(d => d.name === template.deptName);
      for (const dept of matchingDepts) {
        // Check if designation already exists
        const exists = existingDes.rows.find(e => e.title === template.title && e.departmentId === dept.id);
        if (!exists) {
          await client.query(`
            INSERT INTO "Designation" (title, "departmentId", level, status, "createdAt", "updatedAt")
            VALUES ($1, $2, $3, 'active', NOW(), NOW())
          `, [template.title, dept.id, template.level]);
          desCount++;
        }
      }
    }
    console.log(`  ✓ Created ${desCount} new designations`);

    // Get all designations for MarqAI companies
    const designations = await client.query(`
      SELECT d.id, d.title, d."departmentId", dept."companyId", c.code
      FROM "Designation" d
      JOIN "Department" dept ON d."departmentId" = dept.id
      JOIN "Company" c ON dept."companyId" = c.id
      WHERE c.name LIKE 'MarqAI%'
      ORDER BY c."createdAt" ASC
    `);

    // ==================== STEP 4: Ensure users have employee records ====================
    console.log('\n📋 Step 4: Creating employee records for users...');

    // Get branches
    const branches = await client.query(`
      SELECT b.id, b.name, b."companyId", c.code 
      FROM "Branch" b 
      JOIN "Company" c ON b."companyId" = c.id 
      WHERE c.name LIKE 'MarqAI%'
      ORDER BY c."createdAt" ASC
    `);

    // HR Admin employee records
    const hrAdminEmails = [
      { email: 'hr@marqaitech.com', companyCode: 'MTPL', firstName: 'HR', lastName: 'Admin', desTitle: 'HR Manager' },
      { email: 'hr@marqaisolutions.com', companyCode: 'MSPL', firstName: 'HR', lastName: 'Admin', desTitle: 'HR Manager' },
      { email: 'hr@marqaidigital.com', companyCode: 'MDPL', firstName: 'HR', lastName: 'Admin', desTitle: 'HR Manager' },
      { email: 'hr@marqaiinnovations.com', companyCode: 'MIPL', firstName: 'HR', lastName: 'Admin', desTitle: 'HR Manager' },
      { email: 'hr@marqaiconsulting.com', companyCode: 'MCPL', firstName: 'HR', lastName: 'Admin', desTitle: 'HR Manager' },
    ];

    for (const hr of hrAdminEmails) {
      // Check if employee record already exists
      const existingEmp = await client.query(`
        SELECT e.id FROM "Employee" e 
        JOIN "User" u ON e."userId" = u.id 
        WHERE u.email = $1
      `, [hr.email]);

      if (existingEmp.rows.length === 0) {
        const user = await client.query(`SELECT id FROM "User" WHERE email = $1`, [hr.email]);
        if (user.rows.length > 0) {
          const company = companies.rows.find(c => c.code === hr.companyCode);
          const branch = branches.rows.find(b => b.code?.includes(hr.companyCode) || b.name?.includes(company?.name?.split(' ')[0] || ''));
          const dept = hrDepts.rows.find(d => d.code === hr.companyCode || d.companyId === company?.id);
          const des = designations.rows.find(d => d.title === hr.desTitle && d.code === hr.companyCode);

          if (company && branch && dept && des) {
            await client.query(`
              INSERT INTO "Employee" ("userId", "companyId", "branchId", "departmentId", "designationId", "employeeId", "firstName", "lastName", status, "joiningDate", "createdAt", "updatedAt")
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active', NOW(), NOW(), NOW())
            `, [user.rows[0].id, company.id, branch.id, dept.id, des.id, `EMP-${hr.companyCode}-HR001`, hr.firstName, hr.lastName]);
            console.log(`  ✓ Employee record: ${hr.email} → ${hr.companyCode}`);
          } else {
            console.log(`  ⚠ Missing ref for ${hr.email}: company=${!!company} branch=${!!branch} dept=${!!dept} des=${!!des}`);
          }
        } else {
          console.log(`  ⚠ User not found: ${hr.email}`);
        }
      } else {
        console.log(`  ✓ Already exists: ${hr.email}`);
      }
    }

    // Regular employee records
    const employeeData = [
      { email: 'rajesh.kumar@marqaitech.com', companyCode: 'MTPL', firstName: 'Rajesh', lastName: 'Kumar', desTitle: 'Senior Software Engineer', deptName: 'Engineering' },
      { email: 'priya.sharma@marqaisolutions.com', companyCode: 'MSPL', firstName: 'Priya', lastName: 'Sharma', desTitle: 'Software Engineer', deptName: 'Engineering' },
      { email: 'amit.patel@marqaidigital.com', companyCode: 'MDPL', firstName: 'Amit', lastName: 'Patel', desTitle: 'Team Lead', deptName: 'Engineering' },
      { email: 'sneha.reddy@marqaiinnovations.com', companyCode: 'MIPL', firstName: 'Sneha', lastName: 'Reddy', desTitle: 'Software Engineer', deptName: 'Engineering' },
      { email: 'vikram.singh@marqaiconsulting.com', companyCode: 'MCPL', firstName: 'Vikram', lastName: 'Singh', desTitle: 'Finance Manager', deptName: 'Finance' },
    ];

    for (const emp of employeeData) {
      const existingEmp = await client.query(`
        SELECT e.id FROM "Employee" e 
        JOIN "User" u ON e."userId" = u.id 
        WHERE u.email = $1
      `, [emp.email]);

      if (existingEmp.rows.length === 0) {
        const user = await client.query(`SELECT id FROM "User" WHERE email = $1`, [emp.email]);
        if (user.rows.length > 0) {
          const company = companies.rows.find(c => c.code === emp.companyCode);
          const branch = branches.rows.find(b => b.companyId === company?.id);
          
          let deptList;
          if (emp.deptName === 'Engineering') deptList = engDepts;
          else if (emp.deptName === 'Finance') deptList = finDepts;
          else deptList = hrDepts;
          const dept = deptList.rows.find(d => d.companyId === company?.id);
          
          const des = designations.rows.find(d => d.title === emp.desTitle && d.companyId === company?.id);

          if (company && branch && dept && des) {
            await client.query(`
              INSERT INTO "Employee" ("userId", "companyId", "branchId", "departmentId", "designationId", "employeeId", "firstName", "lastName", status, "joiningDate", "createdAt", "updatedAt")
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active', NOW(), NOW(), NOW())
            `, [user.rows[0].id, company.id, branch.id, dept.id, des.id, `EMP-${emp.companyCode}-E001`, emp.firstName, emp.lastName]);
            console.log(`  ✓ Employee record: ${emp.email} → ${emp.companyCode}`);
          } else {
            console.log(`  ⚠ Missing ref for ${emp.email}: company=${!!company} branch=${!!branch} dept=${!!dept} des=${!!des}`);
          }
        } else {
          console.log(`  ⚠ User not found: ${emp.email}`);
        }
      } else {
        console.log(`  ✓ Already exists: ${emp.email}`);
      }
    }

    // ==================== STEP 5: Ensure Subscription Plan ====================
    console.log('\n📋 Step 5: Creating subscription plan...');
    
    const existingPlan = await client.query(`SELECT id FROM "SubscriptionPlan" WHERE name = 'Enterprise' AND "planType" = 'enterprise'`);
    if (existingPlan.rows.length === 0) {
      await client.query(`
        INSERT INTO "SubscriptionPlan" (id, name, "planType", "monthlyPrice", "annualPrice", "employeeLimit", "companyLimit", "branchLimit", "storageLimit", "aiInterviewLimit", "aiChatbotLimit", "payrollEnabled", "recruitmentEnabled", "attendanceEnabled", "projectEnabled", "clientPortalEnabled", "vendorPortalEnabled", "mobileAppEnabled", "apiAccessEnabled", "whiteLabelEnabled", "supportLevel", status, description, "createdAt", "updatedAt")
        VALUES ('plan-enterprise-marqai', 'Enterprise', 'enterprise', 9999.00, 99990.00, 500, 10, 50, 10000, 500, 1000, true, true, true, true, true, true, true, true, false, 'priority', 'active', 'Enterprise plan for MarqAI Tech Group with full features', NOW(), NOW())
      `);
      console.log('  ✓ Subscription Plan: Enterprise created');
    } else {
      console.log('  ✓ Subscription Plan already exists');
    }

    // ==================== STEP 6: Verify data ====================
    console.log('\n📋 Step 6: Final verification...');

    const counts = {};
    for (const table of ['Tenant', 'Company', 'Branch', 'Department', 'Designation', 'User', 'Employee', 'SubscriptionPlan']) {
      const res = await client.query(`SELECT count(*) FROM "${table}"`);
      counts[table] = parseInt(res.rows[0].count);
    }
    console.log('  Final counts:');
    Object.entries(counts).forEach(([k, v]) => console.log(`    ${k}: ${v}`));

    // Test tenant-info API query
    const tenantInfo = await client.query(`
      SELECT name, slug, domain FROM "Tenant" WHERE slug = 'marqaitechgroup'
    `);
    console.log(`  Tenant check: ${JSON.stringify(tenantInfo.rows[0])}`);

    await client.query('COMMIT');
    console.log('\n✅ All changes committed successfully!');

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
