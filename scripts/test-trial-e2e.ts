/**
 * Full E2E trial flow test (creates + cleans up a test tenant)
 * Run: npx tsx scripts/test-trial-e2e.ts
 */
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import * as dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config({ path: '.env' });

const BASE = process.env.TRIAL_TEST_BASE_URL || 'http://localhost:3000';
const cs = process.env.DATABASE_URL!;
const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString: cs }) });

const code = `e2e-${crypto.randomBytes(4).toString('hex')}`;
const contactEmail = `${code}@e2e-test.local`;

const results: { step: string; ok: boolean; detail: string }[] = [];
function pass(step: string, detail: string) {
  results.push({ step, ok: true, detail });
  console.log(`✅ ${step}: ${detail}`);
}
function fail(step: string, detail: string) {
  results.push({ step, ok: false, detail });
  console.log(`❌ ${step}: ${detail}`);
}

async function main() {
  console.log('=== E2E TRIAL FLOW TEST ===\n');
  console.log('Test slug:', code);

  let registrationId: string | null = null;
  let tenantId: string | null = null;
  let tempPassword: string | null = null;

  // STEP 1: Register
  try {
    const res = await fetch(`${BASE}/api/trial/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyName: `E2E Trial ${code}`,
        companyCode: code,
        companyEmail: `company-${contactEmail}`,
        contactName: 'E2E Admin',
        contactEmail,
        country: 'IN',
        currency: 'INR',
        employeeCount: 10,
      }),
    });
    const body = await res.json();
    if (res.status === 201 && body.registrationId) {
      registrationId = body.registrationId;
      pass('1. Register', `pending id=${registrationId}`);
    } else {
      fail('1. Register', `${res.status} ${JSON.stringify(body)}`);
      return summary();
    }
  } catch (e) {
    fail('1. Register', String(e));
    return summary();
  }

  // STEP 2: Verify pending in DB
  const pending = await prisma.trialRegistration.findUnique({ where: { id: registrationId! } });
  if (pending?.status === 'pending' && !pending.tenantId) {
    pass('2. DB pending', 'TrialRegistration pending, no tenant yet');
  } else {
    fail('2. DB pending', JSON.stringify(pending));
  }

  // STEP 3: Approve
  try {
    const res = await fetch(`${BASE}/api/trial/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ registrationId, trialDays: 15, reviewedBy: 'e2e-test' }),
    });
    const body = await res.json();
    if (res.ok && body.tenantId && body.tempPassword) {
      tenantId = body.tenantId;
      tempPassword = body.tempPassword;
      pass('3. Approve', `tenant=${tenantId}, trialEnd=${body.trialEnd}`);
    } else {
      fail('3. Approve', `${res.status} ${JSON.stringify(body)}`);
      await cleanup(registrationId, tenantId);
      return summary();
    }
  } catch (e) {
    fail('3. Approve', String(e));
    await cleanup(registrationId, tenantId);
    return summary();
  }

  // STEP 4: Login while trial active
  try {
    const res = await fetch(`${BASE}/api/auth/login?tenant=${code}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: contactEmail, password: tempPassword }),
    });
    const body = await res.json();
    if (res.ok && body.token) {
      pass('4. Login (active trial)', 'token received');
    } else {
      fail('4. Login (active trial)', `${res.status} ${JSON.stringify(body)}`);
    }
  } catch (e) {
    fail('4. Login (active trial)', String(e));
  }

  // STEP 5: Expire trial in DB
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  await prisma.trialRegistration.update({
    where: { id: registrationId! },
    data: { trialEnd: yesterday, status: 'approved' },
  });
  await prisma.tenant.update({ where: { id: tenantId! }, data: { status: 'trial' } });
  pass('5. Expire (DB)', `trialEnd=${yesterday.toISOString()}`);

  // STEP 6: Login blocked
  try {
    const res = await fetch(`${BASE}/api/auth/login?tenant=${code}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: contactEmail, password: tempPassword }),
    });
    const body = await res.json();
    if (res.status === 403 && (body.code === 'TRIAL_EXPIRED' || body.error?.includes('expired'))) {
      pass('6. Login blocked', body.error?.slice(0, 80) ?? 'TRIAL_EXPIRED');
    } else {
      fail('6. Login blocked', `expected 403 TRIAL_EXPIRED got ${res.status} ${JSON.stringify(body)}`);
    }
  } catch (e) {
    fail('6. Login blocked', String(e));
  }

  // STEP 7: Data STILL stored after expiry
  const regAfter = await prisma.trialRegistration.findUnique({ where: { id: registrationId! } });
  const tenantAfter = await prisma.tenant.findUnique({ where: { id: tenantId! } });
  const userCount = await prisma.user.count({ where: { tenantId: tenantId! } });
  const empCount = await prisma.employee.count({ where: { companyId: { not: null }, user: { tenantId: tenantId! } } });
  const companyCount = await prisma.company.count({
    where: { companyGroup: { tenantId: tenantId! } },
  });

  if (regAfter && tenantAfter && userCount > 0 && empCount > 0) {
    pass(
      '7. Data retained',
      `reg status=${regAfter.status}, tenant status=${tenantAfter.status}, users=${userCount}, employees=${empCount}, companies=${companyCount}`,
    );
  } else {
    fail('7. Data retained', `reg=${!!regAfter} tenant=${!!tenantAfter} users=${userCount} emp=${empCount}`);
  }

  // STEP 8: Restore trial + login works again
  const future = new Date();
  future.setDate(future.getDate() + 15);
  await prisma.trialRegistration.update({
    where: { id: registrationId! },
    data: { trialEnd: future, status: 'active' },
  });
  await prisma.tenant.update({ where: { id: tenantId! }, data: { status: 'trial' } });

  const resRestore = await fetch(`${BASE}/api/auth/login?tenant=${code}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: contactEmail, password: tempPassword }),
  });
  if (resRestore.ok) {
    pass('8. Restore trial', 'login works again after extending trialEnd');
  } else {
    const b = await resRestore.json();
    fail('8. Restore trial', `${resRestore.status} ${JSON.stringify(b)}`);
  }

  await cleanup(registrationId, tenantId);
  summary();
}

async function cleanup(registrationId: string | null, tenantId: string | null) {
  if (!tenantId) {
    if (registrationId) {
      await prisma.trialRegistration.delete({ where: { id: registrationId } }).catch(() => {});
    }
    return;
  }
  console.log('\nCleaning up test tenant...');
  try {
    await prisma.$transaction(async (tx) => {
      await tx.userRoleAssignment.deleteMany({ where: { user: { tenantId } } });
      await tx.employee.deleteMany({ where: { company: { companyGroup: { tenantId } } } });
      await tx.user.deleteMany({ where: { tenantId } });
      await tx.branch.deleteMany({ where: { company: { companyGroup: { tenantId } } } });
      await tx.designation.deleteMany({ where: { company: { companyGroup: { tenantId } } } });
      await tx.department.deleteMany({ where: { company: { companyGroup: { tenantId } } } });
      await tx.company.deleteMany({ where: { companyGroup: { tenantId } } });
      await tx.companyGroup.deleteMany({ where: { tenantId } });
      await tx.trialRegistration.deleteMany({ where: { tenantId } });
      await tx.tenant.delete({ where: { id: tenantId } });
    });
    console.log('Cleanup done.');
  } catch (e) {
    console.warn('Cleanup partial:', e);
  }
}

function summary() {
  console.log('\n=== SUMMARY ===');
  const ok = results.filter((r) => r.ok).length;
  const total = results.length;
  console.log(`${ok}/${total} steps passed`);
  if (ok === total) console.log('\n🟢 Trial flow is working end-to-end.');
  else console.log('\n🔴 Some steps failed — see above.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
