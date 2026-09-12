/**
 * Check tenant status and settings in the platform DB
 * Uses raw SQL via neon's HTTP driver
 */

const PLATFORM_URL = 'postgresql://neondb_owner:npg_pxZd8woKe4WB@ep-blue-fire-aqk8jxd2.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require';
const TENANT_URL = 'postgresql://neondb_owner:npg_pxZd8woKe4WB@ep-blue-fire-aqk8jxd2.c-8.us-east-1.aws.neon.tech/tenant_marqaitechgroup?sslmode=require';

async function query(connectionString, sql) {
  const url = connectionString.replace('postgresql://', 'https://').replace(/\?sslmode=require/, '');
  // Use neon's serverless HTTP driver
  const { neon } = require('@neondatabase/serverless');
  const sql_client = neon(connectionString);
  return sql_client(sql);
}

async function main() {
  const { neon } = require('@neondatabase/serverless');
  const platform = neon(PLATFORM_URL);
  const tenant = neon(TENANT_URL);

  // 1. Tenant info
  const [t] = await platform`SELECT id, name, slug, status, plan, "maxCompaniesAllowed" FROM "Tenant" WHERE slug = 'marqaitechgroup'`;
  console.log('=== TENANT INFO ===');
  console.log('Name:', t.name);
  console.log('Slug:', t.slug);
  console.log('Status:', t.status);
  console.log('Plan:', t.plan);
  console.log('maxCompaniesAllowed:', t.maxCompaniesAllowed);

  // 2. TenantDatabase
  const [td] = await platform`SELECT "databaseName", "isActive" FROM "TenantDatabase" WHERE "tenantId" = ${t.id}`;
  console.log('\n=== TENANT DATABASE ===');
  console.log('Database Name:', td?.databaseName);
  console.log('Active:', td?.isActive);

  // 3. Company groups from tenant DB
  const groups = await tenant`SELECT cg.id, cg.name, cg."employeeLimitMode", cg."maxEmployees", cg."maxCompanies" FROM "CompanyGroup" cg WHERE cg."tenantId" = ${t.id}`;
  console.log('\n=== COMPANY GROUPS (Tenant DB) ===');
  for (const g of groups) {
    const companies = await tenant`SELECT id, name FROM "Company" WHERE "companyGroupId" = ${g.id}`;
    console.log(`Group: ${g.name} | employeeLimitMode: ${g.employeeLimitMode} | maxEmployees: ${g.maxEmployees} | maxCompanies: ${g.maxCompanies} | Companies: ${companies.length}`);
    for (const c of companies) {
      console.log(`  - Company: ${c.name}`);
    }
  }

  // 4. Employees
  const empCount = await tenant`SELECT COUNT(*)::int as count FROM "Employee" WHERE status = 'active'`;
  const employees = await tenant`SELECT id, "firstName", "lastName", email, "employeeId", status FROM "Employee" WHERE status = 'active' LIMIT 10`;
  console.log('\n=== EMPLOYEES (Tenant DB) ===');
  console.log('Total active employees:', empCount[0]?.count || 0);
  for (const e of employees) {
    console.log(`  ${e.employeeId}: ${e.firstName} ${e.lastName} (${e.email}) - ${e.status}`);
  }

  // 5. Users in tenant DB
  const users = await tenant`SELECT name, email, role, status FROM "User" WHERE "tenantId" = ${t.id}`;
  console.log('\n=== USERS (Tenant DB) ===');
  for (const u of users) {
    console.log(`  ${u.name} (${u.email}) - Role: ${u.role} - Status: ${u.status}`);
  }

  // 6. Super admin
  const [sa] = await platform`SELECT name, email, role, status FROM "User" WHERE role = 'super_admin' LIMIT 1`;
  console.log('\n=== SUPER ADMIN ===');
  console.log(`  ${sa.name} (${sa.email}) - Role: ${sa.role} - Status: ${sa.status}`);
}

main().catch(console.error);
