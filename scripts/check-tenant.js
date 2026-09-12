/**
 * Check tenant status and settings in the platform DB
 */
import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaClient } from '../src/generated/prisma/client.js';

const PLATFORM_URL = 'postgresql://neondb_owner:npg_pxZd8woKe4WB@ep-blue-fire-aqk8jxd2.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require';
const TENANT_URL = 'postgresql://neondb_owner:npg_pxZd8woKe4WB@ep-blue-fire-aqk8jxd2.c-8.us-east-1.aws.neon.tech/tenant_marqaitechgroup?sslmode=require';

async function main() {
  // Platform DB
  const platformAdapter = new PrismaNeon({ connectionString: PLATFORM_URL });
  const platformDb = new PrismaClient({ adapter: platformAdapter });

  // Tenant DB
  const tenantAdapter = new PrismaNeon({ connectionString: TENANT_URL });
  const tenantDb = new PrismaClient({ adapter: tenantAdapter });

  // 1. Tenant info from platform DB
  const tenant = await platformDb.tenant.findFirst({ where: { slug: 'marqaitechgroup' } });
  console.log('=== TENANT INFO (Platform DB) ===');
  console.log('Name:', tenant.name);
  console.log('Slug:', tenant.slug);
  console.log('Status:', tenant.status);
  console.log('Plan:', tenant.plan);
  console.log('maxCompaniesAllowed:', tenant.maxCompaniesAllowed);

  // 2. TenantDatabase record
  const tenantDbRecord = await platformDb.tenantDatabase.findFirst({ where: { tenantId: tenant.id } });
  console.log('\n=== TENANT DATABASE ===');
  console.log('Database Name:', tenantDbRecord?.databaseName);
  console.log('Active:', tenantDbRecord?.isActive);

  // 3. Company groups from tenant DB
  const groups = await tenantDb.companyGroup.findMany({
    where: { tenantId: tenant.id },
    include: { companies: { select: { id: true, name: true } } }
  });
  console.log('\n=== COMPANY GROUPS (Tenant DB) ===');
  for (const g of groups) {
    console.log(`Group: ${g.name} | employeeLimitMode: ${g.employeeLimitMode} | maxEmployees: ${g.maxEmployees} | maxCompanies: ${g.maxCompanies} | Companies: ${g.companies.length}`);
    for (const c of g.companies) {
      console.log(`  - Company: ${c.name}`);
    }
  }

  // 4. Employees in tenant DB
  const employeeCount = await tenantDb.employee.count({ where: { status: 'active' } });
  const employees = await tenantDb.employee.findMany({
    where: { status: 'active' },
    select: { id: true, firstName: true, lastName: true, email: true, employeeId: true, status: true },
    take: 10
  });
  console.log('\n=== EMPLOYEES (Tenant DB) ===');
  console.log('Total active employees:', employeeCount);
  for (const e of employees) {
    console.log(`  ${e.employeeId}: ${e.firstName} ${e.lastName} (${e.email}) - ${e.status}`);
  }

  // 5. Users in tenant DB
  const users = await tenantDb.user.findMany({ where: { tenantId: tenant.id } });
  console.log('\n=== USERS (Tenant DB) ===');
  for (const u of users) {
    console.log(`  ${u.name} (${u.email}) - Role: ${u.role} - Status: ${u.status}`);
  }

  // 6. Super admin in platform DB
  const superAdmin = await platformDb.user.findFirst({ where: { role: 'super_admin' } });
  console.log('\n=== SUPER ADMIN (Platform DB) ===');
  console.log(`  ${superAdmin.name} (${superAdmin.email}) - Role: ${superAdmin.role} - Status: ${superAdmin.status}`);

  await platformDb.$disconnect();
  await tenantDb.$disconnect();
}

main().catch(console.error);
