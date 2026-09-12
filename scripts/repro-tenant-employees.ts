/**
 * Local repro of the tenant-detail employee query against the platform DB.
 * Usage: npx tsx scripts/repro-tenant-employees.ts
 */
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';

const connectionString = 'postgresql://neondb_owner:npg_pxZd8woKe4WB@ep-blue-fire-aqk8jxd2.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require';
const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString }) });

async function main() {
  const tenant = await prisma.tenant.findUnique({ where: { slug: 'acme-global-demo' } });
  if (!tenant) throw new Error('tenant not found');
  console.log('tenant:', tenant.name, tenant.id);

  const groups = await prisma.companyGroup.findMany({
    where: { tenantId: tenant.id },
    include: { companies: { select: { id: true, name: true, code: true, status: true } } },
  });
  const companyIds = groups.flatMap((g) => g.companies.map((c) => c.id));
  console.log('groups:', groups.length, '| companyIds:', companyIds);

  try {
    const employees = await prisma.employee.findMany({
      where: { companyId: { in: companyIds }, status: 'active' } as any,
      select: {
        id: true, firstName: true, lastName: true, email: true,
        employeeId: true, status: true, phone: true, createdAt: true,
        companyId: true,
        department: { select: { name: true } },
        designation: { select: { title: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    console.log('employees found (full production select):', employees.length);
    employees.forEach((e) => console.log('  -', e.employeeId, e.firstName, e.lastName, '| dept:', (e as any).department?.name, '| desig:', (e as any).designation?.name));
  } catch (e) {
    const msg = (e as Error).message || '';
    console.error('PRISMA QUERY ERROR (len', msg.length, '):');
    console.error(msg.split('\n').filter((l) => l.trim()).slice(-12).join('\n'));
  }

  // Also raw count for sanity
  const raw = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
    `SELECT count(*)::bigint AS count FROM "Employee" WHERE "companyId" = ANY($1::text[]) AND status = 'active'`,
    companyIds
  );
  console.log('raw SQL count:', raw[0]?.count);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
