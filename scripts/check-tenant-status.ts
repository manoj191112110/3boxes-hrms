import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const connectionString =
  process.env.DATABASE_URL || process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL;

if (!connectionString) {
  console.error('No DATABASE_URL in .env');
  process.exit(1);
}

const dbName = connectionString.match(/\/([^/?]+)(\?|$)/)?.[1] ?? 'unknown';
console.log('=== PLATFORM DB CHECK ===');
console.log('Database name from URL:', dbName);

const prisma = new PrismaClient({
  adapter: new PrismaNeon({ connectionString }),
});

async function main() {
  const tenants = await prisma.tenant.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      plan: true,
      domain: true,
      createdAt: true,
    },
  });
  console.log('\n--- Tenant table ---');
  console.log('Row count:', tenants.length);
  console.log(JSON.stringify(tenants, null, 2));

  const tenantDbs = await prisma.tenantDatabase.findMany({
    select: {
      id: true,
      tenantId: true,
      databaseName: true,
      isActive: true,
      provisionedAt: true,
      createdAt: true,
    },
  });
  console.log('\n--- TenantDatabase table ---');
  console.log('Row count:', tenantDbs.length);
  console.log(JSON.stringify(tenantDbs, null, 2));

  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      tenantId: true,
    },
    take: 30,
  });
  console.log('\n--- User table (platform) ---');
  console.log('Row count (up to 30):', users.length);
  console.log(JSON.stringify(users, null, 2));

  // If tenant DB link exists, peek at tenant DB
  if (tenantDbs.length > 0 && tenantDbs[0].tenantId) {
    const link = await prisma.tenantDatabase.findFirst({
      where: { isActive: true },
      select: { connectionString: true, databaseName: true },
    });
    if (link?.connectionString) {
      const tenantDbName = link.connectionString.match(/\/([^/?]+)(\?|$)/)?.[1] ?? 'unknown';
      console.log('\n=== TENANT DB CHECK (via TenantDatabase link) ===');
      console.log('Linked database name:', tenantDbName);

      const tenantPrisma = new PrismaClient({
        adapter: new PrismaNeon({ connectionString: link.connectionString }),
      });
      try {
        const tTenants = await tenantPrisma.tenant.findMany({
          select: { id: true, name: true, slug: true, status: true },
        });
        const tUsers = await tenantPrisma.user.findMany({
          select: { email: true, role: true, status: true, tenantId: true },
          take: 10,
        });
        const companyCount = await tenantPrisma.company.count();
        console.log('Tenant rows in tenant DB:', tTenants.length);
        console.log(JSON.stringify(tTenants, null, 2));
        console.log('Users in tenant DB:', tUsers.length);
        console.log(JSON.stringify(tUsers, null, 2));
        console.log('Company count in tenant DB:', companyCount);
      } finally {
        await tenantPrisma.$disconnect();
      }
    }
  } else {
    console.log('\n=== TENANT DB: NOT LINKED (TenantDatabase empty) ===');
    console.log('Cannot check tenant DB until you add a TenantDatabase row.');
    console.log('Trying direct probe: tenant_marqaitechgroup ...');
    const tenantUrl = connectionString.replace(/\/([^/?]+)(\?)/, '/tenant_marqaitechgroup?');
    const tenantPrisma = new PrismaClient({
      adapter: new PrismaNeon({ connectionString: tenantUrl }),
    });
    try {
      const tTenants = await tenantPrisma.tenant.findMany({
        select: { id: true, name: true, slug: true, status: true },
      });
      const tUsers = await tenantPrisma.user.findMany({
        select: { email: true, role: true, status: true },
        take: 10,
      });
      const companyCount = await tenantPrisma.company.count();
      console.log('Direct tenant DB probe: SUCCESS');
      console.log('Tenant rows:', JSON.stringify(tTenants, null, 2));
      console.log('Users:', JSON.stringify(tUsers, null, 2));
      console.log('Company count:', companyCount);
    } catch (e) {
      console.log('Direct tenant DB probe: FAILED');
      console.log(String(e).slice(0, 300));
    } finally {
      await tenantPrisma.$disconnect();
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
