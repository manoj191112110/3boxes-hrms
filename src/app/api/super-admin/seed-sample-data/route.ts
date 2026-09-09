import { NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders, hashPassword } from '@/lib/auth';
import { createNotification } from '@/lib/notifications';
import { ensureSchemaSynced, withSchemaSync } from '@/lib/schema-sync';
import { isLiveMode } from '@/lib/site-mode';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() });
}

/**
 * POST /api/super-admin/seed-sample-data
 *
 * Super-admin-only endpoint that bootstraps a realistic demo dataset so the
 * user can see how the multi-tenancy hierarchy renders in the UI:
 *
 *   Tenant  ──────►  has a "companies cap"  (maxCompaniesAllowed)
 *     └── Group Company  ──►  has employee-strength barrier
 *           └── Company  ──►  has its own employee cap
 *
 * Per the user's clarified hierarchy: "the group company name and parent
 * tenant are same". So for EACH sample tenant we ALSO create a default group
 * company that shares the tenant's name (e.g. tenant "Acme Global" gets a
 * group company named "Acme Global"). Companies are then inducted under
 * either the default same-name group OR additional named groups.
 *
 * Sample layout created (idempotent — running twice won't duplicate):
 *
 *   1) Acme Global  (slug: acme-global, plan: enterprise, maxCompaniesAllowed: 10)
 *        ├─ Acme Global                 (default group — shares tenant name)
 *        │    ├─ Acme Software India Pvt Ltd      (planned: 200, cap: 250)
 *        │    └─ Acme Cloud Services LLP          (planned: 120, cap: 150)
 *        └─ Acme Manufacturing Group   (per_company cap: 80)
 *             └─ Acme Industrial Tools Ltd        (planned: 60, cap: 80)
 *
 *   2) TechStart Solutions  (slug: techstart, plan: professional, maxCompaniesAllowed: 5)
 *        ├─ TechStart Solutions         (default group — shares tenant name)
 *        │    ├─ TechStart Apps Inc                (planned: 50, cap: 75)
 *        │    └─ TechStart AI Labs                 (planned: 30, cap: 50)
 *
 *   3) GlobalHR Services  (slug: globalhr, plan: starter, maxCompaniesAllowed: 3)
 *        └─ GlobalHR Services          (default group — shares tenant name)
 *             └─ GlobalHR Staffing Pvt Ltd         (planned: 40, cap: 50)
 *
 * Each tenant gets a `tenant_admin` user. Login credentials are returned in
 * the response so the super admin can quickly sign in as that tenant_admin
 * to verify the tenant-scoped view.
 *
 * All created records use upsert semantics keyed on a stable slug so that
 * re-running the endpoint won't fail on uniqueness constraints and won't
 * create duplicates.
 *
 * ⚠️ LIVE MODE GUARD: On the production platform (3boxeshrms.com), this
 * endpoint requires an explicit `confirmLiveSeed: true` in the request body.
 * This prevents accidental sample data creation in production. The demo
 * site has no such restriction.
 */
export async function POST(request: Request) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) {
      return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    }
    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: corsHeaders() });
    }
    const userRole = decoded.role as string;
    if (userRole !== 'super_admin') {
      return NextResponse.json({ error: 'Only super admins can seed sample data' }, { status: 403, headers: corsHeaders() });
    }

    // ─── LIVE MODE GUARD ───
    // On the production platform, sample data seeding requires explicit
    // confirmation to prevent accidental creation of sample/dummy tenants.
    // The demo site has no such restriction.
    if (isLiveMode(request)) {
      let body: { confirmLiveSeed?: boolean } = {};
      try { body = await request.json(); } catch {}
      if (!body.confirmLiveSeed) {
        return NextResponse.json({
          error: 'You are on the LIVE production platform. Seeding sample data will create sample/dummy tenants alongside your real tenants. If you understand this and want to proceed, re-send the request with { confirmLiveSeed: true } in the body.',
          code: 'LIVE_SEED_CONFIRMATION_REQUIRED',
          hint: 'This safeguard only applies on the live platform. The demo site (nexus-hrms-mu.vercel.app) has no such restriction.',
        }, { status: 403, headers: corsHeaders() });
      }
    }

    // Proactively sync the DB schema before any upsert. The build-time
    // scripts/schema-sync.js should have already done this, but if the build
    // env didn't have access to POSTGRES_PRISMA_URL the columns may still be
    // missing. This call is idempotent and cached for 10 minutes in-process.
    await ensureSchemaSynced();

    // A stable password for all sample tenant_admin accounts.
    const SAMPLE_PASSWORD = 'Tenant@123';
    const pwHash = await hashPassword(SAMPLE_PASSWORD);

    // ─── Auto-fix: any existing tenants that were created before the fix
    // (which set them to 'pending_approval' by default) should be flipped to
    // 'active' so they appear in the super admin's header dropdown. This is
    // idempotent and only touches tenants that are stuck in pending_approval.
    try {
      const pendingTenants = await getPlatformDb().tenant.findMany({
        where: { status: 'pending_approval' },
        select: { id: true, name: true },
      });
      if (pendingTenants.length > 0) {
        await getPlatformDb().tenant.updateMany({
          where: { status: 'pending_approval' },
          data: { status: 'active' },
        });
        console.log('[SeedSampleData] Auto-activated', pendingTenants.length, 'pending tenants:', pendingTenants.map(t => t.name).join(', '));
      }
    } catch (e) {
      console.error('[SeedSampleData] Auto-activate pending tenants failed (non-fatal):', e);
    }

    // ── Sample data definition ─────────────────────────────────
    type SampleCompany = {
      name: string;
      code: string;
      city: string;
      state: string;
      country: string;
      currency: string;
      plannedEmployeeCount: number;
      maxEmployees: number; // hard cap
    };
    type SampleGroup = {
      name: string;
      employeeLimitMode: 'per_company' | 'group_total';
      maxEmployees: number | null;
      maxCompanies: number | null;
      notes: string;
      companies: SampleCompany[];
    };
    type SampleTenant = {
      name: string;
      slug: string;
      domain: string;
      plan: string;
      country: string;
      currency: string;
      timezone: string;
      maxCompaniesAllowed: number;
      adminName: string;
      adminEmail: string;
      groups: SampleGroup[];
    };

    const SAMPLE: SampleTenant[] = [
      {
        name: 'Acme Global',
        slug: 'acme-global',
        domain: 'acme-global.example.com',
        plan: 'enterprise',
        country: 'India',
        currency: 'INR',
        timezone: 'Asia/Kolkata',
        maxCompaniesAllowed: 10,
        adminName: 'Acme Tenant Admin',
        adminEmail: 'admin@acme-global.com',
        groups: [
          {
            // This group shares the tenant name (per the user's clarified
            // hierarchy: "the group company name and parent tenant are same").
            name: 'Acme Global',
            employeeLimitMode: 'group_total',
            maxEmployees: 500,
            maxCompanies: 5,
            notes: 'Default group company for Acme Global — shares the tenant name. Software + Cloud cluster capped at 500 employees total.',
            companies: [
              {
                name: 'Acme Software India Pvt Ltd',
                code: 'ACME-SW',
                city: 'Bengaluru',
                state: 'Karnataka',
                country: 'India',
                currency: 'INR',
                plannedEmployeeCount: 200,
                maxEmployees: 250,
              },
              {
                name: 'Acme Cloud Services LLP',
                code: 'ACME-CLD',
                city: 'Hyderabad',
                state: 'Telangana',
                country: 'India',
                currency: 'INR',
                plannedEmployeeCount: 120,
                maxEmployees: 150,
              },
            ],
          },
          {
            name: 'Acme Manufacturing Group',
            employeeLimitMode: 'per_company',
            maxEmployees: 80,
            maxCompanies: 3,
            notes: 'Industrial tools cluster — per-company cap of 80 employees each.',
            companies: [
              {
                name: 'Acme Industrial Tools Ltd',
                code: 'ACME-IND',
                city: 'Pune',
                state: 'Maharashtra',
                country: 'India',
                currency: 'INR',
                plannedEmployeeCount: 60,
                maxEmployees: 80,
              },
            ],
          },
        ],
      },
      {
        name: 'TechStart Solutions',
        slug: 'techstart',
        domain: 'techstart.example.com',
        plan: 'professional',
        country: 'United States',
        currency: 'USD',
        timezone: 'America/New_York',
        maxCompaniesAllowed: 5,
        adminName: 'TechStart Admin',
        adminEmail: 'admin@techstart.com',
        groups: [
          {
            // Default group — shares the tenant name.
            name: 'TechStart Solutions',
            employeeLimitMode: 'group_total',
            maxEmployees: 150,
            maxCompanies: 4,
            notes: 'Default group company for TechStart Solutions — shares the tenant name. Digital products + AI labs capped at 150 employees total.',
            companies: [
              {
                name: 'TechStart Apps Inc',
                code: 'TS-APPS',
                city: 'New York',
                state: 'NY',
                country: 'United States',
                currency: 'USD',
                plannedEmployeeCount: 50,
                maxEmployees: 75,
              },
              {
                name: 'TechStart AI Labs',
                code: 'TS-AI',
                city: 'San Francisco',
                state: 'CA',
                country: 'United States',
                currency: 'USD',
                plannedEmployeeCount: 30,
                maxEmployees: 50,
              },
            ],
          },
        ],
      },
      {
        name: 'GlobalHR Services',
        slug: 'globalhr',
        domain: 'globalhr.example.com',
        plan: 'starter',
        country: 'India',
        currency: 'INR',
        timezone: 'Asia/Kolkata',
        maxCompaniesAllowed: 3,
        adminName: 'GlobalHR Admin',
        adminEmail: 'admin@globalhr.com',
        groups: [
          {
            // Default group — shares the tenant name.
            name: 'GlobalHR Services',
            employeeLimitMode: 'group_total',
            maxEmployees: 50,
            maxCompanies: 2,
            notes: 'Default group company for GlobalHR Services — shares the tenant name. Consulting + staffing capped at 50 employees total.',
            companies: [
              {
                name: 'GlobalHR Staffing Pvt Ltd',
                code: 'GHR-STG',
                city: 'Chennai',
                state: 'Tamil Nadu',
                country: 'India',
                currency: 'INR',
                plannedEmployeeCount: 40,
                maxEmployees: 50,
              },
            ],
          },
        ],
      },
    ];

    const created: {
      tenants: { name: string; slug: string; adminEmail: string; groups: number; companies: number }[];
      adminPassword: string;
    } = { tenants: [], adminPassword: SAMPLE_PASSWORD };

    for (const sample of SAMPLE) {
      // Upsert tenant by slug.
      // Wrapped in withSchemaSync so that if the production DB is missing
      // the new SRS columns (language, baseCurrency, dataRegion,
      // subscriptionSeats, subscriptionStorage) the route self-heals by
      // running ALTER TABLE ADD COLUMN IF NOT EXISTS, then retries.
      const tenant = await withSchemaSync(() =>
        getPlatformDb().tenant.upsert({
          where: { slug: sample.slug },
          update: {
            name: sample.name,
            domain: sample.domain,
            plan: sample.plan,
            country: sample.country,
            currency: sample.currency,
            timezone: sample.timezone,
            maxCompaniesAllowed: sample.maxCompaniesAllowed,
            status: 'active',
          },
          create: {
            name: sample.name,
            slug: sample.slug,
            domain: sample.domain,
            plan: sample.plan,
            country: sample.country,
            currency: sample.currency,
            timezone: sample.timezone,
            maxCompaniesAllowed: sample.maxCompaniesAllowed,
            status: 'active',
          },
        })
      );

      // Upsert tenant_admin user by email
      const adminUser = await db.user.upsert({
        where: { email: sample.adminEmail },
        update: {
          name: sample.adminName,
          role: 'tenant_admin',
          tenantId: tenant.id,
          status: 'active',
        },
        create: {
          email: sample.adminEmail,
          password: pwHash,
          name: sample.adminName,
          role: 'tenant_admin',
          tenantId: tenant.id,
          status: 'active',
        },
      });

      let totalCompaniesForTenant = 0;

      for (const sg of sample.groups) {
        // Find an existing group by (tenantId, name) — Prisma doesn't have a
        // unique constraint on this pair, so we do a findFirst + create/update.
        const existingGroup = await db.companyGroup.findFirst({
          where: { tenantId: tenant.id, name: sg.name },
        });
        const group = existingGroup
          ? await db.companyGroup.update({
              where: { id: existingGroup.id },
              data: {
                employeeLimitMode: sg.employeeLimitMode,
                maxEmployees: sg.maxEmployees,
                maxCompanies: sg.maxCompanies,
                notes: sg.notes,
              },
            })
          : await db.companyGroup.create({
              data: {
                name: sg.name,
                tenantId: tenant.id,
                employeeLimitMode: sg.employeeLimitMode,
                maxEmployees: sg.maxEmployees,
                maxCompanies: sg.maxCompanies,
                notes: sg.notes,
              },
            });

        for (const sc of sg.companies) {
          // Find existing company by (companyGroupId, name)
          const existingCo = await db.company.findFirst({
            where: { companyGroupId: group.id, name: sc.name },
          });
          if (existingCo) {
            // Company update — wrapped because Company now has a `language`
            // column that may not exist on the production DB yet.
            await withSchemaSync(() =>
              db.company.update({
                where: { id: existingCo.id },
                data: {
                  code: sc.code,
                  city: sc.city,
                  state: sc.state,
                  country: sc.country,
                  currency: sc.currency,
                  plannedEmployeeCount: sc.plannedEmployeeCount,
                  maxEmployees: sc.maxEmployees,
                  status: 'active',
                },
              })
            );
          } else {
            // Company create — wrapped for the same reason.
            await withSchemaSync(() =>
              db.company.create({
                data: {
                  name: sc.name,
                  code: sc.code,
                  companyGroupId: group.id,
                  city: sc.city,
                  state: sc.state,
                  country: sc.country,
                  currency: sc.currency,
                  timezone: sample.timezone,
                  plannedEmployeeCount: sc.plannedEmployeeCount,
                  maxEmployees: sc.maxEmployees,
                  status: 'active',
                },
              })
            );
            totalCompaniesForTenant += 1;
          }
        }
      }

      // Send the tenant admin a welcome notification (best-effort — don't fail
      // the seed if the notification module errors out)
      try {
        await createNotification({
          tenantId: tenant.id,
          userId: adminUser.id,
          title: 'Sample data loaded',
          message: `Sample group companies and companies have been loaded under your tenant "${tenant.name}". Log in to the Tenant Admin module to manage them.`,
          type: 'success',
          category: 'system',
          link: '/tenant-admin',
        });
      } catch {
        // ignore — notifications are best-effort
      }

      created.tenants.push({
        name: tenant.name,
        slug: tenant.slug,
        adminEmail: sample.adminEmail,
        groups: sample.groups.length,
        companies: sample.groups.reduce((s, g) => s + g.companies.length, 0),
      });
    }

    // Audit log
    await db.auditLog.create({
      data: {
        userId: decoded.userId as string,
        action: 'SEED_SAMPLE_DATA',
        module: 'super-admin',
        details: `Seeded ${created.tenants.length} sample tenants with group companies and companies.`,
      },
    });

    return NextResponse.json(
      {
        message: `Sample data loaded successfully — ${created.tenants.length} tenants created/updated.`,
        ...created,
      },
      { status: 200, headers: corsHeaders() }
    );
  } catch (error) {
    console.error('Seed sample data error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to seed sample data' },
      { status: 500, headers: corsHeaders() }
    );
  }
}
