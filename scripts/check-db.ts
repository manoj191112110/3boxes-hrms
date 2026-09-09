import { PrismaClient } from '../src/generated/prisma/client.ts';
import { PrismaNeon } from '@prisma/adapter-neon';

const connectionString = process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL || process.env.DATABASE_URL || '';
const adapter = new PrismaNeon({ connectionString });
const p = new PrismaClient({ adapter });

async function run() {
  try {
    const tenants = await p.tenant.findMany({ select: { id: true, name: true, slug: true, domain: true, status: true, plan: true } });
    console.log('=== TENANTS ===');
    console.log(JSON.stringify(tenants, null, 2));

    const users = await p.user.findMany({ select: { id: true, email: true, name: true, role: true, tenantId: true, status: true } });
    console.log('=== USERS ===');
    console.log(JSON.stringify(users, null, 2));

    const roles = await p.role.findMany({ select: { id: true, name: true, key: true, isSystem: true, level: true, tenantId: true, companyId: true } });
    console.log('=== ROLES ===');
    console.log(JSON.stringify(roles, null, 2));

    const companies = await p.company.findMany({ select: { id: true, name: true, code: true, companyGroupId: true } });
    console.log('=== COMPANIES ===');
    console.log(JSON.stringify(companies, null, 2));

    const empCount = await p.employee.count();
    console.log('EMPLOYEE COUNT: ' + empCount);
  } catch (err) {
    console.error('DB Error:', err);
  } finally {
    await p.$disconnect();
  }
}

run();
