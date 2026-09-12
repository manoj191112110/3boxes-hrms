/**
 * 3Boxes HRMS — Seed SAMPLE TENANTS for Super Admin tenant-management testing
 * (DEMO SITE ONLY — platform DB `neondb`, shared-mode tenants)
 *
 * Creates 3 sample tenants with the full management surface:
 *   Tenant row + admin/HR users + company group + companies + departments +
 *   designations + employees + active subscription + per-tenant module flags.
 *
 * ⚠️ GOLDEN RULE: these tenants are for the DEMO site's Super Admin module
 * only. Their slugs are listed in LIVE_HIDDEN_SLUGS (tenant-filter.ts) so
 * they NEVER appear on the LIVE platform. Only run AFTER that code is live.
 *
 * Idempotent: skips tenants whose slug already exists.
 * Usage: node scripts/seed-demo-sample-tenants.mjs
 */
import pg from 'pg';
import crypto from 'crypto';

const HOST = 'ep-blue-fire-aqk8jxd2.c-8.us-east-1.aws.neon.tech';
const USER = 'neondb_owner';
const PASS = 'npg_pxZd8woKe4WB';
const DB = 'neondb'; // ← PLATFORM DB (shared-mode tenants live here)

const DAY = 24 * 60 * 60 * 1000;
const now = Date.now();
const monthsAgo = (m) => new Date(now - m * 30 * DAY);
const monthsAhead = (m) => new Date(now + m * 30 * DAY);

let counter = 0;
function cuid() {
  counter += 1;
  return `cm${now.toString(36)}${counter.toString(36)}${crypto.randomBytes(5).toString('hex')}`;
}
// Sample tenant admin passwords are NOT for login (requests on the demo host
// always route to the demo tenant DB, so a sample-tenant login is not
// supported). Random deterministic hash keeps them un-guessable.
function rndPwd() {
  return bcryptLikePlaceholder();
}
function bcryptLikePlaceholder() {
  return `$2a$12$${crypto.randomBytes(31).toString('base64').slice(0, 53)}`;
}

const conn = new pg.Client({ host: HOST, user: USER, password: PASS, database: DB, ssl: { rejectUnauthorized: false } });
await conn.connect();

// ── 0. Look up plans + the demo tenant's module flag set (as template) ──
const plans = Object.fromEntries(
  (await conn.query(`SELECT id, name FROM "SubscriptionPlan"`)).rows.map((p) => [p.name, p.id])
);
console.log('Plans:', Object.keys(plans));

const demoTenantFlags = (await conn.query(
  `SELECT key, label FROM "FeatureFlag" WHERE "tenantId" = 'cmrmxegjy000604jv9ntgcshh' AND key LIKE 'module_%'`
)).rows;
console.log(`Module flag template: ${demoTenantFlags.length} flags`);

const created = { tenants: 0, users: 0, groups: 0, companies: 0, departments: 0, designations: 0, employees: 0, subscriptions: 0, flags: 0 };

// ═══ Sample tenant definitions ═══
const SAMPLES = [
  {
    name: 'Acme Global Industries', slug: 'acme-global-demo',
    plan: 'Enterprise', planKey: 'Enterprise', status: 'active',
    currency: 'USD', country: 'United States', timezone: 'America/New_York',
    maxCompaniesAllowed: 5, createdMonthsAgo: 8,
    domain: 'acme-global-demo.3boxeshrms.com',
    subscription: { plan: 'Enterprise', billingCycle: 'annual', amount: 29990, currency: 'USD', startMonthsAgo: 7, endMonthsAhead: 5, paymentStatus: 'paid' },
    companies: [
      {
        name: 'Acme Manufacturing Inc', code: 'ACME-MFG', country: 'United States',
        departments: [
          { name: 'Engineering', designations: ['Software Engineer', 'Engineering Manager'], employees: 2 },
          { name: 'Human Resources', designations: ['HR Specialist'], employees: 1 },
        ],
      },
      {
        name: 'Acme Retail LLC', code: 'ACME-RET', country: 'Canada',
        departments: [
          { name: 'Operations', designations: ['Store Supervisor'], employees: 1 },
        ],
      },
    ],
    users: [
      { name: 'Jackie Welles', email: 'jackie.welles@acme-global.demo', role: 'tenant_admin' },
      { name: 'Rosa Diaz', email: 'rosa.diaz@acme-global.demo', role: 'hr_admin' },
    ],
    disabledModules: [],
  },
  {
    name: 'Zenith Retail Group', slug: 'zenith-retail-demo',
    plan: 'Starter', planKey: 'Starter', status: 'active',
    currency: 'INR', country: 'India', timezone: 'Asia/Kolkata',
    maxCompaniesAllowed: 2, createdMonthsAgo: 4,
    domain: 'zenith-retail-demo.3boxeshrms.com',
    subscription: { plan: 'Starter', billingCycle: 'monthly', amount: 4999, currency: 'INR', startMonthsAgo: 3, endMonthsAhead: 1, paymentStatus: 'paid' },
    companies: [
      {
        name: 'Zenith Retail Pvt Ltd', code: 'ZEN-RET', country: 'India',
        departments: [
          { name: 'Sales', designations: ['Sales Executive', 'Store Manager'], employees: 2 },
          { name: 'Finance', designations: ['Accountant'], employees: 1 },
        ],
      },
    ],
    users: [
      { name: 'Meera Kapoor', email: 'meera.kapoor@zenith-retail.demo', role: 'tenant_admin' },
    ],
    // Module control showcase: payroll + CRM disabled on this tenant
    disabledModules: ['module_payroll', 'module_crm'],
  },
  {
    name: 'Nova Tech Solutions', slug: 'nova-tech-demo',
    plan: 'Professional', planKey: 'Professional', status: 'suspended',
    currency: 'EUR', country: 'Germany', timezone: 'Europe/Berlin',
    maxCompaniesAllowed: 3, createdMonthsAgo: 2,
    domain: 'nova-tech-demo.3boxeshrms.com',
    subscription: { plan: 'Professional', billingCycle: 'monthly', amount: 2999, currency: 'EUR', startMonthsAgo: 1, endMonthsAhead: 1, paymentStatus: 'overdue' },
    companies: [
      {
        name: 'Nova Tech GmbH', code: 'NOVA-DE', country: 'Germany',
        departments: [
          { name: 'Engineering', designations: ['Platform Engineer'], employees: 1 },
        ],
      },
    ],
    users: [
      { name: 'Lars Zimmerman', email: 'lars.zimmerman@nova-tech.demo', role: 'tenant_admin' },
    ],
    disabledModules: [],
  },
];

const EMP_FIRST = ['Ava', 'Liam', 'Sofia', 'Noah', 'Mia', 'Ethan'];
const EMP_LAST = ['Turner', 'Brooks', 'Meyer', 'Schmidt', 'Rao', 'Iyer'];

for (const s of SAMPLES) {
  const exists = await conn.query(`SELECT id FROM "Tenant" WHERE slug = $1`, [s.slug]);
  if (exists.rows.length) {
    console.log(`  tenant exists, skip: ${s.slug}`);
    continue;
  }

  // ── Tenant ──
  const tenantId = cuid();
  await conn.query(
    `INSERT INTO "Tenant" (id, name, slug, domain, plan, status, country, currency, timezone, "maxCompaniesAllowed", "createdAt", "updatedAt")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW())`,
    [tenantId, s.name, s.slug, s.domain, s.plan.toLowerCase(), s.status, s.country, s.currency, s.timezone, s.maxCompaniesAllowed, monthsAgo(s.createdMonthsAgo)]
  );
  created.tenants += 1;

  // ── Users (platform-level, shared-mode) ──
  for (const u of s.users) {
    await conn.query(
      `INSERT INTO "User" (id, email, password, name, role, status, "tenantId", "createdAt", "updatedAt")
       VALUES ($1,$2,$3,$4,$5,'active',$6,$7,NOW())`,
      [cuid(), u.email, rndPwd(), u.name, u.role, tenantId, monthsAgo(s.createdMonthsAgo)]
    );
    created.users += 1;
  }

  // ── Module flags (copy demo tenant's template) ──
  for (const f of demoTenantFlags) {
    const enabled = !s.disabledModules.includes(f.key);
    await conn.query(
      `INSERT INTO "FeatureFlag" (id, "tenantId", key, label, enabled, "createdAt", "updatedAt")
       VALUES ($1,$2,$3,$4,$5,NOW(),NOW())`,
      [cuid(), tenantId, f.key, f.label, enabled]
    );
    created.flags += 1;
  }

  // ── Subscription ──
  const planId = plans[s.subscription.plan];
  if (planId) {
    await conn.query(
      `INSERT INTO "Subscription" (id, "tenantId", "planId", "startDate", "endDate", "billingCycle", amount, currency, "paymentStatus", status, "autoRenew", "createdAt", "updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'active',true,NOW(),NOW())`,
      [cuid(), tenantId, planId, monthsAgo(s.subscription.startMonthsAgo), monthsAhead(s.subscription.endMonthsAhead), s.subscription.billingCycle, s.subscription.amount, s.subscription.currency, s.subscription.paymentStatus]
    );
    created.subscriptions += 1;
  } else {
    console.warn(`  ⚠️ plan not found: ${s.subscription.plan}`);
  }

  // ── Company group (shares the tenant name per the hierarchy rule) ──
  const groupId = cuid();
  await conn.query(
    `INSERT INTO "CompanyGroup" (id, name, "tenantId", "employeeLimitMode", notes, "createdAt", "updatedAt")
     VALUES ($1,$2,$3,'group_total',$4,$5,NOW())`,
    [groupId, s.name, tenantId, `Default group company auto-created for tenant "${s.name}".`, monthsAgo(s.createdMonthsAgo)]
  );
  created.groups += 1;

  // ── Companies → departments → designations → employees ──
  let empIdx = 0;
  for (const c of s.companies) {
    const companyId = cuid();
    await conn.query(
      `INSERT INTO "Company" (id, name, code, "companyGroupId", status, country, "createdAt", "updatedAt")
       VALUES ($1,$2,$3,$4,'active',$5,$6,NOW())`,
      [companyId, c.name, c.code, groupId, c.country, monthsAgo(s.createdMonthsAgo)]
    );
    created.companies += 1;

    for (const d of c.departments) {
      const deptId = cuid();
      await conn.query(
        `INSERT INTO "Department" (id, name, "companyId", "createdAt", "updatedAt")
         VALUES ($1,$2,$3,$4,NOW())`,
        [deptId, d.name, companyId, monthsAgo(s.createdMonthsAgo)]
      );
      created.departments += 1;

      const desigIds = [];
      for (const t of d.designations) {
        const desigId = cuid();
        await conn.query(
          `INSERT INTO "Designation" (id, title, "departmentId", "createdAt", "updatedAt")
           VALUES ($1,$2,$3,$4,NOW())`,
          [desigId, t, deptId, monthsAgo(s.createdMonthsAgo)]
        );
        created.designations += 1;
        desigIds.push(desigId);
      }

      for (let i = 0; i < d.employees; i++) {
        const fn = EMP_FIRST[empIdx % EMP_FIRST.length];
        const ln = EMP_LAST[empIdx % EMP_LAST.length];
        empIdx += 1;
        const email = `${fn}.${ln}.${s.slug.split('-')[0]}${empIdx}@emp.demo`.toLowerCase();
        await conn.query(
          `INSERT INTO "Employee" (id, "employeeId", "firstName", "lastName", email, "companyId", "departmentId", "designationId", "dateOfJoining", status, "createdAt", "updatedAt")
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'active',$10,NOW())`,
          [
            cuid(),
            `EMP-${s.slug.split('-')[0].toUpperCase()}-${String(empIdx).padStart(3, '0')}`,
            fn, ln, email, companyId, deptId, desigIds[empIdx % desigIds.length],
            monthsAgo(Math.max(1, s.createdMonthsAgo - 1)),
            monthsAgo(s.createdMonthsAgo),
          ]
        );
        created.employees += 1;
      }
    }
  }
  console.log(`  seeded tenant: ${s.name} (${s.slug}) — status ${s.status}`);
}

console.log('\n=== SAMPLE TENANT SEED SUMMARY (platform DB, shared-mode) ===');
console.log(JSON.stringify(created, null, 2));

// ── Post-check: list what the demo site will now see ──
console.log('\nTenants now in platform DB (excluding placeholder name):');
const rows = (await conn.query(
  `SELECT name, slug, status, plan FROM "Tenant" WHERE name NOT LIKE '%Marq AI Tech%' ORDER BY "createdAt" DESC`
)).rows;
for (const r of rows) console.log(`  - ${r.name} | ${r.slug} | ${r.status} | ${r.plan}`);

await conn.end();
