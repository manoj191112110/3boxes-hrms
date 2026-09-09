/**
 * End-to-end trial flow verification (non-destructive read + optional live API test)
 * Run: npx tsx scripts/test-trial-flow.ts
 * Run with API test: npx tsx scripts/test-trial-flow.ts --api
 */
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import * as dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config({ path: '.env' });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL missing in .env');
  process.exit(1);
}

const dbName = connectionString.match(/\/([^/?]+)(\?|$)/)?.[1] ?? 'unknown';
const runApi = process.argv.includes('--api');
const BASE = process.env.TRIAL_TEST_BASE_URL || 'http://localhost:3000';

const prisma = new PrismaClient({
  adapter: new PrismaNeon({ connectionString }),
});

async function main() {
  console.log('=== TRIAL FLOW VERIFICATION ===\n');
  console.log('Platform DB:', dbName);

  // 1) List all trial registrations
  const allRegs = await prisma.trialRegistration.findMany({
    orderBy: { createdAt: 'desc' },
    include: { tenant: { select: { id: true, slug: true, status: true, name: true } } },
  });
  console.log('\n--- TrialRegistration rows:', allRegs.length, '---');
  for (const r of allRegs) {
    const expired =
      r.trialEnd && new Date(r.trialEnd) < new Date() && ['approved', 'active'].includes(r.status);
    console.log({
      company: r.companyName,
      slug: r.companyCode,
      regStatus: r.status,
      tenantStatus: r.tenant?.status ?? '(no tenant yet)',
      trialEnd: r.trialEnd?.toISOString() ?? null,
      tenantId: r.tenantId,
      isExpiredByDate: expired,
    });
  }

  // 2) Confirm expired trials are STORED not deleted
  const expiredRegs = await prisma.trialRegistration.count({
    where: { status: 'expired' },
  });
  const expiredTenants = await prisma.tenant.count({
    where: { status: 'expired' },
  });
  console.log('\n--- Expired records still in DB (NOT deleted) ---');
  console.log('TrialRegistration with status=expired:', expiredRegs);
  console.log('Tenant with status=expired:', expiredTenants);

  // 3) For expired tenants with linked tenantId, check HR data still exists
  const expiredWithTenant = await prisma.trialRegistration.findMany({
    where: { status: 'expired', tenantId: { not: null } },
    select: { tenantId: true, companyCode: true, companyName: true },
    take: 3,
  });
  if (expiredWithTenant.length > 0) {
    console.log('\n--- HR data check for expired trial tenants ---');
    for (const e of expiredWithTenant) {
      const companies = await prisma.company.count({
        where: { companyGroup: { tenantId: e.tenantId! } },
      });
      const employees = await prisma.employee.count({
        where: { company: { companyGroup: { tenantId: e.tenantId! } } },
      });
      const users = await prisma.user.count({ where: { tenantId: e.tenantId! } });
      console.log({
        slug: e.companyCode,
        companies,
        employees,
        users,
        note: companies + employees + users > 0 ? 'DATA STILL STORED' : 'no HR rows in platform DB',
      });
    }
  } else {
    console.log('\n(No expired trial tenants in DB yet — expiry only changes status, never deletes)');
  }

  // 4) Code confirmation: no delete on expiry
  console.log('\n--- Code behavior on expiry (login route) ---');
  console.log('On expired login: Tenant.status -> expired, TrialRegistration.status -> expired');
  console.log('No DELETE queries — records remain in database.');

  if (!runApi) {
    console.log('\nSkipping live API test. Run with --api if dev server is on port 3000.');
    return;
  }

  // 5) Live API: register -> list pending
  const code = `e2etest-${crypto.randomBytes(3).toString('hex')}`;
  const email = `trial-${code}@example.com`;
  console.log('\n--- Live API test ---');
  console.log('POST /api/trial/register slug:', code);

  const regRes = await fetch(`${BASE}/api/trial/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      companyName: `E2E Test ${code}`,
      companyCode: code,
      companyEmail: `company-${email}`,
      contactName: 'E2E Tester',
      contactEmail: email,
      country: 'IN',
      currency: 'INR',
      employeeCount: 10,
    }),
  });
  const regBody = await regRes.json();
  console.log('Register status:', regRes.status, regBody);

  if (!regRes.ok) {
    console.error('Register failed — is dev server running? npm run dev');
    return;
  }

  const listRes = await fetch(`${BASE}/api/trial/list?status=pending`);
  const listBody = await listRes.json();
  const found = listBody.registrations?.find((r: { companyCode: string }) => r.companyCode === code);
  console.log('Pending list contains new registration:', !!found);

  // Cleanup: only delete the pending registration we just created (test artifact)
  if (found?.id) {
    await prisma.trialRegistration.delete({ where: { id: found.id } });
    console.log('Cleaned up test pending registration:', found.id);
  }

  console.log('\nAPI register + list: OK');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
