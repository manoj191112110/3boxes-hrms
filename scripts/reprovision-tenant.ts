/**
 * Re-provision a dedicated Neon database for an already-approved trial tenant.
 * Use when a tenant was approved before auto-provisioning existed.
 *
 * Run: npx tsx scripts/reprovision-tenant.ts <tenant-slug>
 */
import * as dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { getPlatformDb } from '../src/lib/tenant-db';
import { provisionDedicatedTenantDatabase } from '../src/lib/tenant-provision';

dotenv.config({ path: '.env' });

async function main() {
  const slug = process.argv[2];
  if (!slug) {
    console.error('Usage: npx tsx scripts/reprovision-tenant.ts <tenant-slug>');
    process.exit(1);
  }

  const platformDb = getPlatformDb();
  const tenant = await platformDb.tenant.findUnique({ where: { slug } });
  if (!tenant) {
    console.error(`Tenant not found: ${slug}`);
    process.exit(1);
  }

  const existingDb = await platformDb.tenantDatabase.findUnique({
    where: { tenantId: tenant.id },
  });
  if (existingDb?.isActive) {
    console.log(`Tenant "${slug}" already has dedicated DB "${existingDb.databaseName}".`);
    process.exit(0);
  }

  const registration = await platformDb.trialRegistration.findFirst({
    where: { tenantId: tenant.id, status: 'approved' },
  });
  if (!registration) {
    console.error(`No approved trial registration found for tenant "${slug}"`);
    process.exit(1);
  }

  const user = await platformDb.user.findFirst({
    where: { tenantId: tenant.id, role: 'tenant_admin' },
  });
  if (!user) {
    console.error(`No tenant_admin user found for tenant "${slug}"`);
    process.exit(1);
  }

  const tempPassword = registration.tempPassword || 'changeme';
  const hashedPassword = user.password.startsWith('$2')
    ? user.password
    : await bcrypt.hash(tempPassword, 12);

  console.log(`Provisioning dedicated DB for tenant "${slug}" (${tenant.id})...`);
  const result = await provisionDedicatedTenantDatabase({
    tenant,
    user,
    registration,
    hashedPassword,
    now: new Date(),
  });

  console.log('Done:', result);
  console.log(`Login: http://localhost:3000/login?tenant=${slug}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
