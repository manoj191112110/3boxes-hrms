import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const PLATFORM_TENANT_ID = 'cmth57dxy0000zof2dc8et4jy';
const tenantUrl = process.env.TENANT_DATABASE_URL!;
const platformUrl = process.env.DATABASE_URL!;

const tenantPrisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString: tenantUrl }) });
const platformPrisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString: platformUrl }) });

async function main() {
  const platformTenant = await platformPrisma.tenant.findUnique({
    where: { id: PLATFORM_TENANT_ID },
    select: { id: true, slug: true, name: true },
  });
  if (!platformTenant) throw new Error('Platform tenant missing');

  const tenantDbTenant = await tenantPrisma.tenant.findUnique({
    where: { slug: 'marqaitechgroup' },
  });
  if (!tenantDbTenant) throw new Error('Tenant DB marqaitechgroup missing');

  const oldId = tenantDbTenant.id;
  const newId = platformTenant.id;

  if (oldId !== newId) {
    console.log(`Aligning tenant id: ${oldId} -> ${newId}`);

    await tenantPrisma.tenant.update({
      where: { id: oldId },
      data: { slug: `marqaitechgroup-old-${oldId.slice(-4)}` },
    });

    const { id: _id, createdAt, updatedAt, ...tenantData } = tenantDbTenant;
    await tenantPrisma.tenant.create({
      data: {
        ...tenantData,
        id: newId,
        slug: 'marqaitechgroup',
        status: 'active',
        createdAt,
        updatedAt,
      },
    });

    await tenantPrisma.user.updateMany({
      where: { tenantId: oldId },
      data: { tenantId: newId },
    });
    await tenantPrisma.companyGroup.updateMany({
      where: { tenantId: oldId },
      data: { tenantId: newId },
    });
    await tenantPrisma.tenant.delete({ where: { id: oldId } }).catch(() => {});
    console.log('Tenant id aligned to platform');
  } else {
    console.log('Tenant id already aligned');
  }

  const link = await platformPrisma.tenantDatabase.findUnique({
    where: { tenantId: PLATFORM_TENANT_ID },
  });
  console.log('TenantDatabase link:', link ? 'OK' : 'MISSING');

  await platformPrisma.tenant.update({
    where: { id: PLATFORM_TENANT_ID },
    data: { slug: 'marqaitechgroup', name: 'MarqAI Tech Group' },
  });
  console.log('Platform tenant slug updated to marqaitechgroup');

  const admin = await tenantPrisma.user.findUnique({
    where: { email: 'admin@marqaitechgroup.com' },
    select: { email: true, role: true, tenantId: true, status: true },
  });
  console.log('Tenant admin:', admin);
}

main()
  .finally(async () => {
    await tenantPrisma.$disconnect();
    await platformPrisma.$disconnect();
  });
