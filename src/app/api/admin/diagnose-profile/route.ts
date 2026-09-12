import { NextResponse } from 'next/server';
import { getDb, getPlatformDb, getDbForTenant } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() });
}

/**
 * GET /api/admin/diagnose-profile?slug=marqaitechgroup
 *
 * Diagnostic endpoint that inspects the actual database state for the
 * tenant admin's profile. Returns:
 *   - The tenant admin user record (from both platform + tenant DB)
 *   - All employee records with employeeId='EMP-MTPL-001' (from both DBs)
 *   - All employee records linked to the tenant admin's userId
 *   - All employee records with a NULL userId
 *   - The tenant DB resolution status
 *
 * This helps diagnose why /my-profile shows no data.
 */
export async function GET(request: Request) {
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders() });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401, headers: corsHeaders() });

    if (decoded.role !== 'super_admin' && decoded.role !== 'tenant_admin') {
      return NextResponse.json({ error: 'Only admins can run diagnostics' }, { status: 403, headers: corsHeaders() });
    }

    const { searchParams } = new URL(request.url);
    const slug = searchParams.get('slug') || 'marqaitechgroup';

    const platformDb = getPlatformDb();
    const report: any = {
      timestamp: new Date().toISOString(),
      tenantSlug: slug,
      platformDb: { name: 'neondb (platform)' },
      tenantDb: null,
      tenantAdminUser: null,
      employees: {
        byEmpId: [],
        byUserId: [],
        byEmail: [],
        nullUserId: [],
      },
      diagnosis: '',
      recommendations: [],
    };

    // ─── 1. Find the tenant ───
    const tenant = await platformDb.tenant.findUnique({
      where: { slug },
      select: { id: true, name: true, slug: true, status: true },
    }).catch(() => null);

    if (!tenant) {
      report.diagnosis = `Tenant "${slug}" not found in platform DB`;
      return NextResponse.json(report, { headers: corsHeaders() });
    }
    report.tenant = tenant;

    // ─── 2. Find the tenant admin user in platform DB ───
    const platformAdmin = await platformDb.user.findFirst({
      where: { tenantId: tenant.id, role: 'tenant_admin' },
      select: { id: true, email: true, name: true, role: true, status: true, tenantId: true },
    }).catch(() => null);

    report.tenantAdminUser = {
      platformDb: platformAdmin,
    };

    // ─── 3. Resolve the tenant DB ───
    let tenantDb: any = platformDb;
    let hasTenantDb = false;
    try {
      const tenantDbRecord = await platformDb.tenantDatabase.findFirst({
        where: { tenant: { slug }, isActive: true },
        select: { id: true, databaseName: true, connectionString: true },
      });
      if (tenantDbRecord) {
        report.tenantDb = {
          id: tenantDbRecord.id,
          databaseName: tenantDbRecord.databaseName,
          connectionStringPrefix: tenantDbRecord.connectionString?.substring(0, 60) + '...',
        };
        tenantDb = await getDbForTenant(slug);
        hasTenantDb = tenantDb !== platformDb;
        report.tenantDb.isConnected = hasTenantDb;
        report.tenantDb.isSameAsPlatform = !hasTenantDb;
      } else {
        report.tenantDb = { error: 'No TenantDatabase record found — tenant uses platform DB (shared mode)' };
      }
    } catch (e: any) {
      report.tenantDb = { error: e.message };
    }

    // ─── 4. Find the tenant admin user in tenant DB ───
    let tenantAdminInTenantDb: any = null;
    if (hasTenantDb) {
      try {
        const rows = await tenantDb.$queryRawUnsafe(
          `SELECT id, email, name, role, status, "tenantId" FROM "User"
           WHERE "tenantId" = $1 AND role = 'tenant_admin'
           ORDER BY "createdAt" ASC LIMIT 5`,
          tenant.id,
        ) as any[];
        tenantAdminInTenantDb = rows?.[0] || null;
        report.tenantAdminUser.tenantDb = tenantAdminInTenantDb;
        report.tenantAdminUser.tenantDbAllRows = rows;
      } catch (e: any) {
        report.tenantAdminUser.tenantDbError = e.message;
      }
    }

    // ─── 5. Search for employee records ───
    const targetEmpId = 'EMP-MTPL-001';
    const adminUserId = tenantAdminInTenantDb?.id || platformAdmin?.id;
    const adminEmail = tenantAdminInTenantDb?.email || platformAdmin?.email;

    // Search in tenant DB
    if (hasTenantDb) {
      // 5a. By employeeId = 'EMP-MTPL-001'
      try {
        const rows = await tenantDb.$queryRawUnsafe(
          `SELECT id, "employeeId", "firstName", "lastName", email, "userId",
                  "departmentId", "designationId", "companyId", status
           FROM "Employee" WHERE "employeeId" = $1`,
          targetEmpId,
        ) as any[];
        report.employees.byEmpId.push({ db: 'tenantDb', rows });
      } catch (e: any) {
        report.employees.byEmpId.push({ db: 'tenantDb', error: e.message });
      }

      // 5b. By userId = adminUserId
      if (adminUserId) {
        try {
          const rows = await tenantDb.$queryRawUnsafe(
            `SELECT id, "employeeId", "firstName", "lastName", email, "userId",
                    "departmentId", "designationId", "companyId", status
             FROM "Employee" WHERE "userId" = $1`,
            adminUserId,
          ) as any[];
          report.employees.byUserId.push({ db: 'tenantDb', rows });
        } catch (e: any) {
          report.employees.byUserId.push({ db: 'tenantDb', error: e.message });
        }
      }

      // 5c. By email = adminEmail
      if (adminEmail) {
        try {
          const rows = await tenantDb.$queryRawUnsafe(
            `SELECT id, "employeeId", "firstName", "lastName", email, "userId",
                    "departmentId", "designationId", "companyId", status
             FROM "Employee" WHERE LOWER(TRIM(email)) = LOWER(TRIM($1))`,
            adminEmail,
          ) as any[];
          report.employees.byEmail.push({ db: 'tenantDb', rows });
        } catch (e: any) {
          report.employees.byEmail.push({ db: 'tenantDb', error: e.message });
        }
      }

      // 5d. NULL userId
      try {
        const rows = await tenantDb.$queryRawUnsafe(
          `SELECT id, "employeeId", "firstName", "lastName", email, "userId", status
           FROM "Employee" WHERE "userId" IS NULL ORDER BY "createdAt" ASC LIMIT 10`,
        ) as any[];
        report.employees.nullUserId.push({ db: 'tenantDb', rows });
      } catch (e: any) {
        report.employees.nullUserId.push({ db: 'tenantDb', error: e.message });
      }
    }

    // Search in platform DB (same queries)
    try {
      const rows = await platformDb.$queryRawUnsafe(
        `SELECT id, "employeeId", "firstName", "lastName", email, "userId", status
         FROM "Employee" WHERE "employeeId" = $1`,
        targetEmpId,
      ) as any[];
      report.employees.byEmpId.push({ db: 'platformDb', rows });
    } catch (e: any) {
      report.employees.byEmpId.push({ db: 'platformDb', error: e.message });
    }

    if (adminUserId) {
      try {
        const rows = await platformDb.$queryRawUnsafe(
          `SELECT id, "employeeId", "firstName", "lastName", email, "userId", status
           FROM "Employee" WHERE "userId" = $1`,
          adminUserId,
        ) as any[];
        report.employees.byUserId.push({ db: 'platformDb', rows });
      } catch (e: any) {
        report.employees.byUserId.push({ db: 'platformDb', error: e.message });
      }
    }

    // ─── 6. Generate diagnosis ───
    const empByIdInTenant = report.employees.byEmpId.find((e: any) => e.db === 'tenantDb')?.rows || [];
    const empByUserIdInTenant = report.employees.byUserId.find((e: any) => e.db === 'tenantDb')?.rows || [];
    const empByEmailInTenant = report.employees.byEmail.find((e: any) => e.db === 'tenantDb')?.rows || [];
    const nullUserIdInTenant = report.employees.nullUserId.find((e: any) => e.db === 'tenantDb')?.rows || [];

    if (!hasTenantDb) {
      report.diagnosis = '⚠️ No dedicated tenant DB — tenant uses platform DB (shared mode). Employee records should be in platform DB.';
    } else if (empByUserIdInTenant.length > 0) {
      report.diagnosis = '✅ Employee found by userId in tenant DB. Profile should load. If it still doesn\'t, the issue is in the profile API search logic.';
    } else if (empByIdInTenant.length > 0) {
      const emp = empByIdInTenant[0];
      report.diagnosis = `❌ Employee EMP-MTPL-001 EXISTS in tenant DB but userId is ${emp.userId === null ? 'NULL' : `'${emp.userId}'`} (expected '${adminUserId}'). The Map Admin EMP ID button didn't set the userId correctly.`;
      report.recommendations.push(`Run: UPDATE "Employee" SET "userId" = '${adminUserId}', "email" = '${adminEmail}' WHERE "employeeId" = 'EMP-MTPL-001'`);
    } else if (empByEmailInTenant.length > 0) {
      report.diagnosis = '⚠️ Employee not found by employeeId or userId, but found by email in tenant DB. The employeeId might be different from EMP-MTPL-001.';
      report.recommendations.push('Click "Map Admin EMP ID" again to re-link, OR manually update the employeeId.');
    } else if (nullUserIdInTenant.length > 0) {
      report.diagnosis = `⚠️ No employee found by employeeId/userId/email, but ${nullUserIdInTenant.length} employee(s) with NULL userId exist in tenant DB. The profile API should auto-link one of these.`;
      report.recommendations.push('The profile API has a NULL userId fallback — it should auto-link. If it doesn\'t, there may be a DB connection issue.');
    } else {
      report.diagnosis = '❌ No employee records found in tenant DB at all. The tenant DB might be empty or the Employee table doesn\'t exist.';
      report.recommendations.push('Run /api/admin/seed-tenant-db to seed the tenant DB with companies, employees, etc.');
    }

    return NextResponse.json(report, { headers: corsHeaders() });
  } catch (error) {
    console.error('[DiagnoseProfile] Error:', error);
    return NextResponse.json(
      { error: 'Diagnostic failed', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500, headers: corsHeaders() },
    );
  }
}
