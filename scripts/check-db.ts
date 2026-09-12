import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';

const connectionString = process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL || process.env.DATABASE_URL;

if (!connectionString) {
  console.error('No connection string found!');
  process.exit(1);
}

console.log('Connecting to:', connectionString.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@').substring(0, 80));

const adapter = new PrismaNeon({ connectionString });
const prisma = new PrismaClient({ adapter });

async function check() {
  const tenants = await prisma.tenant.findMany({ select: { id: true, slug: true, name: true, status: true } });
  console.log('=== TENANTS ===');
  tenants.forEach(t => console.log(JSON.stringify(t)));

  const tenantDbs = await prisma.tenantDatabase.findMany({ include: { tenant: { select: { slug: true, name: true } } } });
  console.log('\n=== TENANT DATABASES ===');
  if (tenantDbs.length === 0) console.log('NONE');
  tenantDbs.forEach(td => console.log(JSON.stringify({ tenantSlug: td.tenant?.slug, isActive: td.isActive })));

  const empCount = await prisma.employee.count();
  console.log('\n=== PLATFORM DB EMPLOYEE COUNT ===', empCount);

  const groups = await prisma.companyGroup.findMany({ select: { id: true, name: true, tenantId: true } });
  console.log('\n=== COMPANY GROUPS ===');
  if (groups.length === 0) console.log('NONE');
  groups.forEach(g => console.log(JSON.stringify(g)));

  const companies = await prisma.company.findMany({ select: { id: true, name: true, companyGroupId: true } });
  console.log('\n=== COMPANIES ===');
  if (companies.length === 0) console.log('NONE');
  companies.forEach(c => console.log(JSON.stringify(c)));

  const sampleEmps = await prisma.employee.findMany({ take: 5, select: { id: true, firstName: true, companyId: true, status: true } });
  console.log('\n=== SAMPLE EMPLOYEES ===');
  if (sampleEmps.length === 0) console.log('NONE');
  sampleEmps.forEach(e => console.log(JSON.stringify(e)));

  await prisma.$disconnect();
}

check().catch(e => { console.error(e); process.exit(1); });
