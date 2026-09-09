/**
 * Copy MarqAI data from shared platform DB into the separate tenant_marqaitechgroup DB
 */

const { Client } = require('pg');

const PLATFORM_CS = 'postgresql://neondb_owner:npg_pxZd8woKe4WB@ep-blue-fire-aqk8jxd2-pooler.c-8.us-east-1.aws.neon.tech/neondb?channel_binding=require&connect_timeout=15&sslmode=require';
const TENANT_CS = 'postgresql://neondb_owner:npg_pxZd8woKe4WB@ep-blue-fire-aqk8jxd2-pooler.c-8.us-east-1.aws.neon.tech/tenant_marqaitechgroup?channel_binding=require&connect_timeout=15&sslmode=require';

async function main() {
  const platform = new Client({ connectionString: PLATFORM_CS });
  const tenant = new Client({ connectionString: TENANT_CS });
  await platform.connect();
  await tenant.connect();
  console.log('🔧 Connected to both databases');

  const tid = 'cmrmrwc00xwda0d4340861d7291';

  // Phase 1: Clean existing data (no transaction - each operation independent)
  const existingTenant = await tenant.query('SELECT id FROM "Tenant" WHERE slug = \'marqaitechgroup\'');
  if (existingTenant.rows.length > 0) {
    const oldTid = existingTenant.rows[0].id;
    console.log('  Found existing tenant in tenant DB: ' + oldTid + ', cleaning...');
    // Get all company IDs for old tenant
    const oldCompanyIds = (await tenant.query('SELECT id FROM "Company" WHERE "companyGroupId" IN (SELECT id FROM "CompanyGroup" WHERE "tenantId" = $1)', [oldTid])).rows.map(r => r.id);
    const oldDeptIds = (await tenant.query('SELECT id FROM "Department" WHERE "companyId" = ANY($1)', oldCompanyIds.length > 0 ? [oldCompanyIds] : [['__none__']])).rows.map(r => r.id);
    const oldEmployeeIds = (await tenant.query('SELECT id FROM "Employee" WHERE "companyId" = ANY($1)', oldCompanyIds.length > 0 ? [oldCompanyIds] : [['__none__']])).rows.map(r => r.id);
    
    // Deep cleanup: JobPosting chain
    if (oldDeptIds.length > 0) {
      const oldJpIds = (await tenant.query('SELECT id FROM "JobPosting" WHERE "departmentId" = ANY($1)', [oldDeptIds])).rows.map(r => r.id);
      for (const jpId of oldJpIds) {
        const jaIds = (await tenant.query('SELECT id FROM "JobApplication" WHERE "jobPostingId" = $1', [jpId])).rows.map(r => r.id);
        for (const jaId of jaIds) {
          await tenant.query('DELETE FROM "Interview" WHERE "jobApplicationId" = $1', [jaId]);
          await tenant.query('DELETE FROM "CandidateAiFeedback" WHERE "jobApplicationId" = $1', [jaId]);
        }
        await tenant.query('DELETE FROM "JobApplication" WHERE "jobPostingId" = $1', [jpId]);
      }
      await tenant.query('DELETE FROM "JobPosting" WHERE "departmentId" = ANY($1)', [oldDeptIds]);
    }
    // Delete in reverse dependency order
    if (oldEmployeeIds.length > 0) {
      await tenant.query('DELETE FROM "EmployeeSkill" WHERE "employeeId" = ANY($1)', [oldEmployeeIds]);
      await tenant.query('DELETE FROM "EmployeePaymentMethod" WHERE "employeeId" = ANY($1)', [oldEmployeeIds]);
      await tenant.query('DELETE FROM "EmployeeCustomFieldValue" WHERE "employeeId" = ANY($1)', [oldEmployeeIds]);
      await tenant.query('DELETE FROM "EmployeeCompanyMapping" WHERE "employeeId" = ANY($1)', [oldEmployeeIds]);
      await tenant.query('DELETE FROM "Dependent" WHERE "employeeId" = ANY($1)', [oldEmployeeIds]);
      await tenant.query('DELETE FROM "Qualification" WHERE "employeeId" = ANY($1)', [oldEmployeeIds]);
      await tenant.query('DELETE FROM "Experience" WHERE "employeeId" = ANY($1)', [oldEmployeeIds]);
      await tenant.query('DELETE FROM "BankAccount" WHERE "employeeId" = ANY($1)', [oldEmployeeIds]);
      await tenant.query('DELETE FROM "LeaveBalance" WHERE "employeeId" = ANY($1)', [oldEmployeeIds]);
      await tenant.query('DELETE FROM "LeaveRequest" WHERE "employeeId" = ANY($1)', [oldEmployeeIds]);
      await tenant.query('DELETE FROM "Attendance" WHERE "employeeId" = ANY($1)', [oldEmployeeIds]);
      await tenant.query('DELETE FROM "Payroll" WHERE "employeeId" = ANY($1)', [oldEmployeeIds]);
      await tenant.query('DELETE FROM "Document" WHERE "employeeId" = ANY($1)', [oldEmployeeIds]);
      await tenant.query('DELETE FROM "AssetAssignment" WHERE "employeeId" = ANY($1)', [oldEmployeeIds]);
      await tenant.query('DELETE FROM "GratuityLedger" WHERE "employeeId" = ANY($1)', [oldEmployeeIds]);
      await tenant.query('DELETE FROM "OnboardingTask" WHERE "employeeId" = ANY($1)', [oldEmployeeIds]);
      await tenant.query('DELETE FROM "TrainingEnrollment" WHERE "employeeId" = ANY($1)', [oldEmployeeIds]);
      await tenant.query('DELETE FROM "PerformanceReview" WHERE "employeeId" = ANY($1)', [oldEmployeeIds]);
      await tenant.query('DELETE FROM "Goal" WHERE "employeeId" = ANY($1)', [oldEmployeeIds]);
      await tenant.query('DELETE FROM "IncidentReport" WHERE "employeeId" = ANY($1)', [oldEmployeeIds]);
      await tenant.query('DELETE FROM "TravelRequest" WHERE "employeeId" = ANY($1)', [oldEmployeeIds]);
      await tenant.query('DELETE FROM "ExpenseClaim" WHERE "employeeId" = ANY($1)', [oldEmployeeIds]);
      await tenant.query('DELETE FROM "Timesheet" WHERE "employeeId" = ANY($1)', [oldEmployeeIds]);
      await tenant.query('DELETE FROM "Promotion" WHERE "employeeId" = ANY($1)', [oldEmployeeIds]);
      await tenant.query('DELETE FROM "Grievance" WHERE "employeeId" = ANY($1)', [oldEmployeeIds]);
      await tenant.query('DELETE FROM "Separation" WHERE "employeeId" = ANY($1)', [oldEmployeeIds]);
      await tenant.query('DELETE FROM "Reimbursement" WHERE "employeeId" = ANY($1)', [oldEmployeeIds]);
    }
    await tenant.query('DELETE FROM "Employee" WHERE "companyId" IN (SELECT id FROM "Company" WHERE "companyGroupId" IN (SELECT id FROM "CompanyGroup" WHERE "tenantId" = $1))', [oldTid]);
    await tenant.query('DELETE FROM "Designation" WHERE "departmentId" IN (SELECT id FROM "Department" WHERE "companyId" IN (SELECT id FROM "Company" WHERE "companyGroupId" IN (SELECT id FROM "CompanyGroup" WHERE "tenantId" = $1)))', [oldTid]);
    await tenant.query('DELETE FROM "Department" WHERE "companyId" IN (SELECT id FROM "Company" WHERE "companyGroupId" IN (SELECT id FROM "CompanyGroup" WHERE "tenantId" = $1))', [oldTid]);
    await tenant.query('DELETE FROM "Branch" WHERE "companyId" IN (SELECT id FROM "Company" WHERE "companyGroupId" IN (SELECT id FROM "CompanyGroup" WHERE "tenantId" = $1))', [oldTid]);
    await tenant.query('DELETE FROM "Company" WHERE "companyGroupId" IN (SELECT id FROM "CompanyGroup" WHERE "tenantId" = $1)', [oldTid]);
    await tenant.query('DELETE FROM "CompanyGroup" WHERE "tenantId" = $1', [oldTid]);
    await tenant.query('DELETE FROM "User" WHERE "tenantId" = $1', [oldTid]);
    await tenant.query('DELETE FROM "TenantDatabase" WHERE "tenantId" = $1', [oldTid]);
    await tenant.query('DELETE FROM "FeatureFlag" WHERE "tenantId" = $1', [oldTid]);
    await tenant.query('DELETE FROM "Subscription" WHERE "tenantId" = $1', [oldTid]);
    await tenant.query('DELETE FROM "TenantConfiguration" WHERE "tenantId" = $1', [oldTid]);
    await tenant.query('DELETE FROM "SubscriptionPlan" WHERE id = \'plan-enterprise-marqai\'');
    await tenant.query('DELETE FROM "Tenant" WHERE id = $1', [oldTid]);
    console.log('  ✓ Cleaned existing data');
  }

  // Phase 2: Copy data (in transaction)
  try {
    await tenant.query('BEGIN');
    console.log('\n📋 Copying Tenant record...');
    const tenantData = await platform.query('SELECT * FROM "Tenant" WHERE id = $1', [tid]);
    if (tenantData.rows.length > 0) {
      const t = tenantData.rows[0];
      const cols = Object.keys(t).filter(k => t[k] !== null);
      const vals = cols.map(k => t[k]);
      const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
      const colNames = cols.map(k => `"${k}"`).join(', ');
      await tenant.query(`INSERT INTO "Tenant" (${colNames}) VALUES (${placeholders}) ON CONFLICT (id) DO UPDATE SET ${cols.map(k => `"${k}" = EXCLUDED."${k}"`).join(', ')}`, vals);
      console.log('  ✓ Tenant copied');
    }

    // Step 2: Copy TenantDatabase record
    console.log('\n📋 Copying TenantDatabase record...');
    const tdbData = await platform.query('SELECT * FROM "TenantDatabase" WHERE "tenantId" = $1', [tid]);
    for (const td of tdbData.rows) {
      const cols = Object.keys(td).filter(k => td[k] !== null);
      const vals = cols.map(k => td[k]);
      const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
      const colNames = cols.map(k => `"${k}"`).join(', ');
      await tenant.query(`INSERT INTO "TenantDatabase" (${colNames}) VALUES (${placeholders}) ON CONFLICT (id) DO NOTHING`, vals);
    }
    console.log('  ✓ TenantDatabase copied');

    // Step 3: Copy SubscriptionPlan
    console.log('\n📋 Copying SubscriptionPlan...');
    const planData = await platform.query('SELECT * FROM "SubscriptionPlan" WHERE id = \'plan-enterprise-marqai\'');
    for (const p of planData.rows) {
      const cols = Object.keys(p).filter(k => p[k] !== null);
      const vals = cols.map(k => p[k]);
      await tenant.query(`INSERT INTO "SubscriptionPlan" (${cols.map(k => `"${k}"`).join(', ')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')}) ON CONFLICT (id) DO NOTHING`, vals);
    }
    console.log('  ✓ SubscriptionPlan copied');

    // Step 4: Copy CompanyGroup
    console.log('\n📋 Copying CompanyGroup...');
    const cgData = await platform.query('SELECT * FROM "CompanyGroup" WHERE "tenantId" = $1', [tid]);
    for (const cg of cgData.rows) {
      const cols = Object.keys(cg).filter(k => cg[k] !== null);
      const vals = cols.map(k => cg[k]);
      await tenant.query(`INSERT INTO "CompanyGroup" (${cols.map(k => `"${k}"`).join(', ')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')}) ON CONFLICT (id) DO NOTHING`, vals);
    }
    console.log('  ✓ CompanyGroup copied');

    // Step 5: Copy Users
    console.log('\n📋 Copying Users...');
    const userData = await platform.query('SELECT * FROM "User" WHERE "tenantId" = $1', [tid]);
    for (const u of userData.rows) {
      const cols = Object.keys(u).filter(k => u[k] !== null);
      const vals = cols.map(k => u[k]);
      await tenant.query(`INSERT INTO "User" (${cols.map(k => `"${k}"`).join(', ')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')}) ON CONFLICT (id) DO NOTHING`, vals);
    }
    console.log(`  ✓ ${userData.rows.length} Users copied`);

    // Step 6: Copy Companies
    console.log('\n📋 Copying Companies...');
    const companyData = await platform.query('SELECT * FROM "Company" WHERE "companyGroupId" IN (SELECT id FROM "CompanyGroup" WHERE "tenantId" = $1)', [tid]);
    const companyIds = companyData.rows.map(c => c.id);
    for (const c of companyData.rows) {
      const cols = Object.keys(c).filter(k => c[k] !== null);
      const vals = cols.map(k => c[k]);
      await tenant.query(`INSERT INTO "Company" (${cols.map(k => `"${k}"`).join(', ')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')}) ON CONFLICT (id) DO NOTHING`, vals);
    }
    console.log(`  ✓ ${companyData.rows.length} Companies copied`);

    // Step 7: Copy Branches
    console.log('\n📋 Copying Branches...');
    const branchData = await platform.query('SELECT * FROM "Branch" WHERE "companyId" = ANY($1)', [companyIds]);
    const branchIds = branchData.rows.map(b => b.id);
    for (const b of branchData.rows) {
      const cols = Object.keys(b).filter(k => b[k] !== null);
      const vals = cols.map(k => b[k]);
      await tenant.query(`INSERT INTO "Branch" (${cols.map(k => `"${k}"`).join(', ')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')}) ON CONFLICT (id) DO NOTHING`, vals);
    }
    console.log(`  ✓ ${branchData.rows.length} Branches copied`);

    // Step 8: Copy Departments
    console.log('\n📋 Copying Departments...');
    const deptData = await platform.query('SELECT * FROM "Department" WHERE "companyId" = ANY($1)', [companyIds]);
    const deptIds = deptData.rows.map(d => d.id);
    for (const d of deptData.rows) {
      const cols = Object.keys(d).filter(k => d[k] !== null);
      const vals = cols.map(k => d[k]);
      await tenant.query(`INSERT INTO "Department" (${cols.map(k => `"${k}"`).join(', ')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')}) ON CONFLICT (id) DO NOTHING`, vals);
    }
    console.log(`  ✓ ${deptData.rows.length} Departments copied`);

    // Step 9: Copy Designations
    console.log('\n📋 Copying Designations...');
    const desData = await platform.query('SELECT * FROM "Designation" WHERE "departmentId" = ANY($1)', [deptIds]);
    const desIds = desData.rows.map(d => d.id);
    for (const d of desData.rows) {
      const cols = Object.keys(d).filter(k => d[k] !== null);
      const vals = cols.map(k => d[k]);
      await tenant.query(`INSERT INTO "Designation" (${cols.map(k => `"${k}"`).join(', ')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')}) ON CONFLICT (id) DO NOTHING`, vals);
    }
    console.log(`  ✓ ${desData.rows.length} Designations copied`);

    // Step 10: Copy Employees
    console.log('\n📋 Copying Employees...');
    const empData = await platform.query('SELECT * FROM "Employee" WHERE "companyId" = ANY($1)', [companyIds]);
    const empIds = empData.rows.map(e => e.id);
    for (const e of empData.rows) {
      const cols = Object.keys(e).filter(k => e[k] !== null);
      const vals = cols.map(k => e[k]);
      await tenant.query(`INSERT INTO "Employee" (${cols.map(k => `"${k}"`).join(', ')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')}) ON CONFLICT (id) DO NOTHING`, vals);
    }
    console.log(`  ✓ ${empData.rows.length} Employees copied`);

    // Step 11: Copy TenantConfiguration, FeatureFlag, etc.
    console.log('\n📋 Copying tenant config records...');
    // Tables with tenantId column
    const tidTables = ['TenantConfiguration', 'FeatureFlag', 'Subscription'];
    for (const table of tidTables) {
      const data = await platform.query(`SELECT * FROM "${table}" WHERE "tenantId" = $1`, [tid]);
      for (const row of data.rows) {
        const cols = Object.keys(row).filter(k => row[k] !== null);
        const vals = cols.map(k => row[k]);
        await tenant.query(`INSERT INTO "${table}" (${cols.map(k => `"${k}"`).join(', ')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')}) ON CONFLICT (id) DO NOTHING`, vals);
      }
      console.log(`  ✓ ${table}: ${data.rows.length} records`);
    }
    // Tables with tenantConfigId column - need to get the configId first
    const tenantConfig = await platform.query('SELECT id FROM "TenantConfiguration" WHERE "tenantId" = $1', [tid]);
    if (tenantConfig.rows.length > 0) {
      const configId = tenantConfig.rows[0].id;
      const configIdTables = ['TenantCountryAccess', 'TenantCurrencyAccess', 'TenantLanguageAccess', 'TenantPayrollPolicy'];
      for (const table of configIdTables) {
        const data = await platform.query(`SELECT * FROM "${table}" WHERE "tenantConfigId" = $1`, [configId]);
        for (const row of data.rows) {
          const cols = Object.keys(row).filter(k => row[k] !== null);
          const vals = cols.map(k => row[k]);
          await tenant.query(`INSERT INTO "${table}" (${cols.map(k => `"${k}"`).join(', ')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')}) ON CONFLICT (id) DO NOTHING`, vals);
        }
        console.log(`  ✓ ${table}: ${data.rows.length} records`);
      }
    }

    await tenant.query('COMMIT');
    console.log('\n✅ All data copied to tenant_marqaitechgroup database!');

  } catch (e) {
    await tenant.query('ROLLBACK');
    console.error('❌ Error:', e.message);
    throw e;
  }

  // Verify
  console.log('\n📋 Verifying tenant DB data...');
  const verifyTables = ['Tenant', 'User', 'CompanyGroup', 'Company', 'Branch', 'Department', 'Designation', 'Employee'];
  for (const table of verifyTables) {
    const res = await tenant.query(`SELECT count(*) FROM "${table}"`);
    console.log(`  ${table}: ${res.rows[0].count}`);
  }

  const tenantInfo = await tenant.query('SELECT name, slug, domain FROM "Tenant" WHERE slug = \'marqaitechgroup\'');
  console.log('  Tenant info:', JSON.stringify(tenantInfo.rows[0]));

  await platform.end();
  await tenant.end();
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
