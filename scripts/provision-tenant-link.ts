/**
 * Links platform Tenant to tenant_marqaitechgroup Neon database.
 * Run: npx tsx scripts/provision-tenant-link.ts
 */
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const PLATFORM_TENANT_ID = 'cmth57dxy0000zof2dc8et4jy';

const platformUrl =
  process.env.DATABASE_URL || process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL;

// Tenant can be a completely separate Neon PROJECT (different host).
// Put that URL in TENANT_DATABASE_URL in .env for setup/provisioning.
const tenantUrl =
  process.env.TENANT_DATABASE_URL ||
  process.env.TENANT_DB_URL ||
  '';

if (!platformUrl) {
  console.error('No DATABASE_URL in .env');
  process.exit(1);
}

if (!tenantUrl) {
  console.error(
    'No TENANT_DATABASE_URL in .env.\n' +
      'Add your TENANT Neon project connection string to .env:\n' +
      'TENANT_DATABASE_URL="postgresql://...@ep-XXXX.../neondb?sslmode=require"'
  );
  process.exit(1);
}

function databaseNameFromUrl(url: string): string {
  return url.match(/\/([^/?]+)(\?|$)/)?.[1] ?? 'tenant_db';
}

const TENANT_DB_NAME = databaseNameFromUrl(tenantUrl);

async function testTenantDb(prisma: PrismaClient): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

async function main() {
  console.log('Step 1: Test tenant database connection...');
  const tenantProbe = new PrismaClient({
    adapter: new PrismaNeon({ connectionString: tenantUrl }),
  });

  const tenantReachable = await testTenantDb(tenantProbe);
  if (!tenantReachable) {
    console.error(
      `FAILED: Database "${TENANT_DB_NAME}" does not exist or is not reachable.\n` +
        'Create it in Neon Console first: Project → Databases → Create database → tenant_marqaitechgroup'
    );
    await tenantProbe.$disconnect();
    process.exit(1);
  }
  console.log(`OK: "${TENANT_DB_NAME}" is reachable`);

  const platformPrisma = new PrismaClient({
    adapter: new PrismaNeon({ connectionString: platformUrl }),
  });

  try {
    const tenant = await platformPrisma.tenant.findUnique({
      where: { id: PLATFORM_TENANT_ID },
      select: { id: true, name: true, slug: true },
    });

    if (!tenant) {
      console.error(`Platform tenant not found: ${PLATFORM_TENANT_ID}`);
      process.exit(1);
    }
    console.log(`Step 2: Platform tenant found: ${tenant.name} (${tenant.slug})`);

    const existing = await platformPrisma.tenantDatabase.findUnique({
      where: { tenantId: PLATFORM_TENANT_ID },
    });

    if (existing) {
      console.log('Step 3: TenantDatabase row already exists — updating connection...');
      const updated = await platformPrisma.tenantDatabase.update({
        where: { tenantId: PLATFORM_TENANT_ID },
        data: {
          connectionString: tenantUrl,
          databaseName: TENANT_DB_NAME,
          isActive: true,
        },
      });
      console.log('Updated:', {
        id: updated.id,
        tenantId: updated.tenantId,
        databaseName: updated.databaseName,
        isActive: updated.isActive,
      });
    } else {
      console.log('Step 3: Inserting TenantDatabase row...');
      const created = await platformPrisma.tenantDatabase.create({
        data: {
          tenantId: PLATFORM_TENANT_ID,
          connectionString: tenantUrl,
          databaseName: TENANT_DB_NAME,
          isActive: true,
        },
      });
      console.log('Created:', {
        id: created.id,
        tenantId: created.tenantId,
        databaseName: created.databaseName,
        isActive: created.isActive,
      });
    }

    const verify = await platformPrisma.tenantDatabase.findUnique({
      where: { tenantId: PLATFORM_TENANT_ID },
      select: { id: true, tenantId: true, databaseName: true, isActive: true },
    });
    console.log('\nDone. TenantDatabase row:');
    console.log(JSON.stringify(verify, null, 2));
    console.log(`\nLogin test: http://localhost:3000/login?tenant=${tenant.slug}`);
  } finally {
    await tenantProbe.$disconnect();
    await platformPrisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
