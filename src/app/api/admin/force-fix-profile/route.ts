import { NextResponse } from 'next/server';
import { getPlatformDb, getDbForTenant } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() });
}

/**
 * POST /api/admin/force-fix-profile?slug=marqaitechgroup
 *
 * Nuclear option: directly creates or updates an Employee record with
 * employeeId='EMP-MTPL-001' linked to the tenant admin's userId.
 *
 * This bypasses ALL the conditional logic in map-tenant-admin-emp-id
 * and just does a brute-force INSERT ... ON CONFLICT UPDATE.
 *
 * Only super_admin can call this.
 */
export async function POST(request: Request) {
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders() });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401, headers: corsHeaders() });

    if (decoded.role !== 'super_admin') {
      return NextResponse.json(
        { error: 'Only super admin can force-fix the profile' },
        { status: 403, headers: corsHeaders() },
      );
    }

    const { searchParams } = new URL(request.url);
    const slug = searchParams.get('slug') || 'marqaitechgroup';
    const targetEmpId = searchParams.get('employeeId') || 'EMP-MTPL-001';

    const platformDb = getPlatformDb();

    // ─── 1. Find the tenant ───
    const tenant = await platformDb.tenant.findUnique({
      where: { slug },
      select: { id: true, name: true, slug: true },
    });
    if (!tenant) {
      return NextResponse.json({ error: `Tenant "${slug}" not found` }, { status: 404, headers: corsHeaders() });
    }

    // ─── 2. Find the tenant admin user ───
    let tenantDb: any = platformDb;
    let hasTenantDb = false;
    try {
      tenantDb = await getDbForTenant(slug);
      hasTenantDb = tenantDb !== platformDb;
    } catch (e) {
      console.error('[ForceFix] Failed to get tenant DB:', e);
    }

    let adminUser: { id: string; email: string; name: string; role: string } | null = null;
    let adminSourceDb = 'platform';

    if (hasTenantDb) {
      try {
        const rows = await tenantDb.$queryRawUnsafe(
          `SELECT id, email, name, role FROM "User"
           WHERE "tenantId" = $1 AND role = 'tenant_admin'
           ORDER BY "createdAt" ASC LIMIT 1`,
          tenant.id,
        ) as any[];
        if (rows?.[0]) {
          adminUser = { id: rows[0].id, email: rows[0].email, name: rows[0].name, role: rows[0].role };
          adminSourceDb = 'tenant';
        }
      } catch {}
    }

    if (!adminUser) {
      const platformAdmin = await platformDb.user.findFirst({
        where: { tenantId: tenant.id, role: 'tenant_admin' },
        select: { id: true, email: true, name: true, role: true },
      });
      if (platformAdmin) {
        adminUser = platformAdmin;
        adminSourceDb = 'platform';
      }
    }

    if (!adminUser) {
      return NextResponse.json(
        { error: `No tenant_admin user found for tenant "${slug}"` },
        { status: 404, headers: corsHeaders() },
      );
    }

    // ─── 3. Find company + department + designation + branch ───
    let company: any = null;
    let dept: any = null;
    let desg: any = null;
    let branch: any = null;

    if (hasTenantDb) {
      try {
        const rows = await tenantDb.$queryRawUnsafe(
          `SELECT id, name, code, city, state FROM "Company" ORDER BY "createdAt" ASC LIMIT 1`,
        ) as any[];
        if (rows?.[0]) company = rows[0];
      } catch {}

      if (company) {
        try {
          const rows = await tenantDb.$queryRawUnsafe(
            `SELECT id, name FROM "Department"
             WHERE "companyId" = $1 AND ("name" ILIKE '%human%' OR "name" ILIKE '%hr%')
             LIMIT 1`,
            company.id,
          ) as any[];
          if (rows?.[0]) {
            dept = rows[0];
          } else {
            const rows2 = await tenantDb.$queryRawUnsafe(
              `SELECT id, name FROM "Department" WHERE "companyId" = $1 ORDER BY "createdAt" ASC LIMIT 1`,
              company.id,
            ) as any[];
            if (rows2?.[0]) dept = rows2[0];
          }
        } catch {}

        if (dept) {
          try {
            const rows = await tenantDb.$queryRawUnsafe(
              `SELECT id, title FROM "Designation" WHERE "departmentId" = $1 ORDER BY "level" DESC LIMIT 1`,
              dept.id,
            ) as any[];
            if (rows?.[0]) desg = rows[0];
          } catch {}
        }

        try {
          const rows = await tenantDb.$queryRawUnsafe(
            `SELECT id, name FROM "Branch" WHERE "companyId" = $1 ORDER BY "createdAt" ASC LIMIT 1`,
            company.id,
          ) as any[];
          if (rows?.[0]) branch = rows[0];
        } catch {}
      }
    }

    // ─── 4. UPSERT the Employee record ───
    const empDbId = `emp-mtpl-${Date.now()}`;
    const nameParts = (adminUser.name || 'Tenant Admin').split(' ');
    const firstName = nameParts[0] || 'Tenant';
    const lastName = nameParts.slice(1).join(' ') || 'Admin';

    let upsertResult: any = null;
    let upsertError: string | null = null;
    let upsertDb = '';

    // Try tenant DB first
    if (hasTenantDb) {
      try {
        // Ensure the Employee table has the unique index on employeeId
        await tenantDb.$executeRawUnsafe(
          `CREATE UNIQUE INDEX IF NOT EXISTS "Employee_employeeId_key" ON "Employee"("employeeId")`,
        ).catch(() => null);

        // Try INSERT ... ON CONFLICT UPDATE
        const rows = await tenantDb.$queryRawUnsafe(
          `INSERT INTO "Employee" (
            "id", "employeeId", "firstName", "lastName", "email",
            "userId", "departmentId", "designationId", "branchId", "companyId",
            "dateOfJoining", "gender", "nationality", "city", "state", "country",
            "status", "employeeStatus", "employeeType",
            "salary", "salaryCurrency",
            "createdAt", "updatedAt"
          ) VALUES (
            $1, $2, $3, $4, $5,
            $6, $7, $8, $9, $10,
            NOW(), 'male', 'Indian', $11, $12, 'IN',
            'active', 'confirmed', 'full_time',
            0, 'INR',
            NOW(), NOW()
          )
          ON CONFLICT ("employeeId") DO UPDATE SET
            "userId" = EXCLUDED."userId",
            "email" = EXCLUDED."email",
            "firstName" = EXCLUDED."firstName",
            "lastName" = EXCLUDED."lastName",
            "departmentId" = EXCLUDED."departmentId",
            "designationId" = EXCLUDED."designationId",
            "branchId" = EXCLUDED."branchId",
            "companyId" = EXCLUDED."companyId",
            "status" = EXCLUDED."status",
            "employeeStatus" = EXCLUDED."employeeStatus",
            "employeeType" = EXCLUDED."employeeType",
            "updatedAt" = NOW()
          RETURNING id, "employeeId", "userId", email, "firstName", "lastName"`,
          empDbId,
          targetEmpId,
          firstName,
          lastName,
          adminUser.email,
          adminUser.id,
          dept?.id || null,
          desg?.id || null,
          branch?.id || null,
          company?.id || null,
          company?.city || 'Hyderabad',
          company?.state || 'TS',
        ) as any[];
        upsertResult = rows?.[0] || null;
        upsertDb = 'tenantDb';
      } catch (e: any) {
        upsertError = `Tenant DB ON CONFLICT: ${e.message}`;
        console.error('[ForceFix] Tenant DB ON CONFLICT failed:', e);

        // Fallback: try UPDATE first, then INSERT
        try {
          await tenantDb.$executeRawUnsafe(
            `UPDATE "Employee"
               SET "userId" = $1, "email" = $2, "firstName" = $3, "lastName" = $4,
                   "departmentId" = $5, "designationId" = $6, "branchId" = $7, "companyId" = $8,
                   "status" = 'active', "employeeStatus" = 'confirmed', "employeeType" = 'full_time',
                   "updatedAt" = NOW()
             WHERE "employeeId" = $9`,
            adminUser.id,
            adminUser.email,
            firstName,
            lastName,
            dept?.id || null,
            desg?.id || null,
            branch?.id || null,
            company?.id || null,
            targetEmpId,
          );
          const rows = await tenantDb.$queryRawUnsafe(
            `SELECT id, "employeeId", "userId", email, "firstName", "lastName" FROM "Employee" WHERE "employeeId" = $1`,
            targetEmpId,
          ) as any[];
          if (rows?.[0]) {
            upsertResult = rows[0];
            upsertDb = 'tenantDb (UPDATE fallback)';
            upsertError = null;
          } else {
            // UPDATE didn't match any rows — INSERT a new one
            await tenantDb.$executeRawUnsafe(
              `INSERT INTO "Employee" (
                "id", "employeeId", "firstName", "lastName", "email",
                "userId", "departmentId", "designationId", "branchId", "companyId",
                "dateOfJoining", "gender", "nationality", "city", "state", "country",
                "status", "employeeStatus", "employeeType",
                "salary", "salaryCurrency",
                "createdAt", "updatedAt"
              ) VALUES (
                $1, $2, $3, $4, $5,
                $6, $7, $8, $9, $10,
                NOW(), 'male', 'Indian', $11, $12, 'IN',
                'active', 'confirmed', 'full_time',
                0, 'INR',
                NOW(), NOW()
              )`,
              empDbId,
              targetEmpId,
              firstName,
              lastName,
              adminUser.email,
              adminUser.id,
              dept?.id || null,
              desg?.id || null,
              branch?.id || null,
              company?.id || null,
              company?.city || 'Hyderabad',
              company?.state || 'TS',
            );
            const rows2 = await tenantDb.$queryRawUnsafe(
              `SELECT id, "employeeId", "userId", email, "firstName", "lastName" FROM "Employee" WHERE "employeeId" = $1`,
              targetEmpId,
            ) as any[];
            upsertResult = rows2?.[0] || null;
            upsertDb = 'tenantDb (INSERT fallback)';
            upsertError = null;
          }
        } catch (e2: any) {
          upsertError = `${upsertError} | Tenant DB fallback: ${e2.message}`;
        }
      }
    }

    // If tenant DB failed entirely, try platform DB
    if (!upsertResult && upsertError) {
      try {
        await platformDb.$executeRawUnsafe(
          `CREATE UNIQUE INDEX IF NOT EXISTS "Employee_employeeId_key" ON "Employee"("employeeId")`,
        ).catch(() => null);

        const rows = await platformDb.$queryRawUnsafe(
          `INSERT INTO "Employee" (
            "id", "employeeId", "firstName", "lastName", "email",
            "userId", "departmentId", "designationId", "branchId", "companyId",
            "dateOfJoining", "gender", "nationality", "city", "state", "country",
            "status", "employeeStatus", "employeeType",
            "salary", "salaryCurrency",
            "createdAt", "updatedAt"
          ) VALUES (
            $1, $2, $3, $4, $5,
            $6, $7, $8, $9, $10,
            NOW(), 'male', 'Indian', $11, $12, 'IN',
            'active', 'confirmed', 'full_time',
            0, 'INR',
            NOW(), NOW()
          )
          ON CONFLICT ("employeeId") DO UPDATE SET
            "userId" = EXCLUDED."userId",
            "email" = EXCLUDED."email",
            "firstName" = EXCLUDED."firstName",
            "lastName" = EXCLUDED."lastName",
            "status" = EXCLUDED."status",
            "updatedAt" = NOW()
          RETURNING id, "employeeId", "userId", email, "firstName", "lastName"`,
          empDbId,
          targetEmpId,
          firstName,
          lastName,
          adminUser.email,
          adminUser.id,
          dept?.id || null,
          desg?.id || null,
          branch?.id || null,
          company?.id || null,
          company?.city || 'Hyderabad',
          company?.state || 'TS',
        ) as any[];
        upsertResult = rows?.[0] || null;
        upsertDb = 'platformDb';
        upsertError = null;
      } catch (e: any) {
        upsertError = `${upsertError} | Platform DB: ${e.message}`;
      }
    }

    // ─── 5. Sync the User email in both DBs ───
    try {
      await platformDb.$executeRawUnsafe(
        `UPDATE "User" SET "email" = $1, "updatedAt" = NOW() WHERE "id" = $2`,
        adminUser.email,
        adminUser.id,
      ).catch(() => null);
    } catch {}

    if (hasTenantDb) {
      try {
        await tenantDb.$executeRawUnsafe(
          `UPDATE "User" SET "email" = $1, "updatedAt" = NOW() WHERE "id" = $2`,
          adminUser.email,
          adminUser.id,
        ).catch(() => null);
      } catch {}
    }

    // ─── 6. Verify ───
    let verification: any = null;
    if (hasTenantDb) {
      try {
        const rows = await tenantDb.$queryRawUnsafe(
          `SELECT id, "employeeId", "userId", email, "firstName", "lastName", status
           FROM "Employee" WHERE "employeeId" = $1 LIMIT 1`,
          targetEmpId,
        ) as any[];
        verification = {
          db: 'tenantDb',
          found: rows?.length > 0,
          employee: rows?.[0] ? {
            id: rows[0].id,
            employeeId: rows[0].employeeid || rows[0].employeeId,
            userId: rows[0].userid || rows[0].userId,
            email: rows[0].email,
            name: `${rows[0].firstname || rows[0].firstName} ${rows[0].lastname || rows[0].lastName}`,
            status: rows[0].status,
          } : null,
          userIdMatches: (rows?.[0]?.userid || rows?.[0]?.userId) === adminUser.id,
        };
      } catch (e: any) {
        verification = { db: 'tenantDb', error: e.message };
      }
    }

    return NextResponse.json({
      success: !!upsertResult,
      message: upsertResult
        ? `✅ Employee ${targetEmpId} force-linked to ${adminUser.email} in ${upsertDb}. /my-profile should now load.`
        : `❌ Force-fix failed: ${upsertError}`,
      tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug },
      tenantAdminUser: {
        id: adminUser.id,
        email: adminUser.email,
        name: adminUser.name,
        sourceDb: adminSourceDb,
      },
      company: company ? { id: company.id, name: company.name, code: company.code } : null,
      department: dept ? { id: dept.id, name: dept.name } : null,
      designation: desg ? { id: desg.id, title: desg.title } : null,
      branch: branch ? { id: branch.id, name: branch.name } : null,
      upsertResult,
      upsertDb,
      upsertError,
      verification,
      nextSteps: upsertResult
        ? [
            '1. Log out of the tenant admin account',
            '2. Log back in at marqaitechgroup.3boxeshrms.com',
            '3. Go to /my-profile — data should now load',
            '4. If still empty, run: GET /api/admin/diagnose-profile?slug=marqaitechgroup',
          ]
        : [
            'Force-fix failed. Likely causes:',
            '- The Employee table does not exist in the tenant DB (run /api/admin/seed-tenant-db first)',
            '- The tenant DB connection is failing (check the tenantDb error in the response)',
          ],
    }, { headers: corsHeaders() });
  } catch (error) {
    console.error('[ForceFixProfile] Error:', error);
    return NextResponse.json(
      { error: 'Force-fix failed', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500, headers: corsHeaders() },
    );
  }
}

/**
 * GET /api/admin/force-fix-profile?slug=marqaitechgroup
 *
 * Read-only diagnostic — inspects the current state without making changes.
 */
export async function GET(request: Request) {
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders() });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401, headers: corsHeaders() });

    const { searchParams } = new URL(request.url);
    const slug = searchParams.get('slug') || 'marqaitechgroup';
    const targetEmpId = searchParams.get('employeeId') || 'EMP-MTPL-001';

    const platformDb = getPlatformDb();
    const tenant = await platformDb.tenant.findUnique({
      where: { slug },
      select: { id: true, name: true, slug: true },
    });
    if (!tenant) return NextResponse.json({ error: `Tenant "${slug}" not found` }, { status: 404 });

    let tenantDb: any = platformDb;
    let hasTenantDb = false;
    try {
      tenantDb = await getDbForTenant(slug);
      hasTenantDb = tenantDb !== platformDb;
    } catch {}

    const result: any = {
      tenant: { id: tenant.id, name: tenant.name, slug },
      hasTenantDb,
      targetEmpId,
      searches: [],
    };

    let adminUser: any = null;
    if (hasTenantDb) {
      try {
        const rows = await tenantDb.$queryRawUnsafe(
          `SELECT id, email, name, role FROM "User" WHERE "tenantId" = $1 AND role = 'tenant_admin' LIMIT 1`,
          tenant.id,
        ) as any[];
        adminUser = rows?.[0] || null;
      } catch {}
    }
    if (!adminUser) {
      adminUser = await platformDb.user.findFirst({
        where: { tenantId: tenant.id, role: 'tenant_admin' },
        select: { id: true, email: true, name: true, role: true },
      }).catch(() => null);
    }
    result.adminUser = adminUser;

    for (const [dbName, tryDb] of [['tenantDb', tenantDb], ['platformDb', platformDb]] as [string, any][]) {
      if (dbName === 'tenantDb' && !hasTenantDb) continue;
      try {
        const rows = await tryDb.$queryRawUnsafe(
          `SELECT id, "employeeId", "userId", email, "firstName", "lastName", status FROM "Employee" WHERE "employeeId" = $1 LIMIT 5`,
          targetEmpId,
        ) as any[];
        result.searches.push({
          db: dbName,
          search: 'by employeeId',
          found: rows.length > 0,
          rows: rows.map((r: any) => ({
            id: r.id,
            employeeId: r.employeeid || r.employeeId,
            userId: r.userid || r.userId,
            email: r.email,
            name: `${r.firstname || r.firstName} ${r.lastname || r.lastName}`,
            status: r.status,
            userIdMatches: (r.userid || r.userId) === adminUser?.id,
          })),
        });
      } catch (e: any) {
        result.searches.push({ db: dbName, search: 'by employeeId', error: e.message });
      }
    }

    if (adminUser) {
      for (const [dbName, tryDb] of [['tenantDb', tenantDb], ['platformDb', platformDb]] as [string, any][]) {
        if (dbName === 'tenantDb' && !hasTenantDb) continue;
        try {
          const rows = await tryDb.$queryRawUnsafe(
            `SELECT id, "employeeId", "userId", email, "firstName", "lastName", status FROM "Employee" WHERE "userId" = $1 LIMIT 5`,
            adminUser.id,
          ) as any[];
          result.searches.push({
            db: dbName,
            search: 'by userId',
            found: rows.length > 0,
            rows: rows.map((r: any) => ({
              id: r.id,
              employeeId: r.employeeid || r.employeeId,
              email: r.email,
              name: `${r.firstname || r.firstName} ${r.lastname || r.lastName}`,
              status: r.status,
            })),
          });
        } catch (e: any) {
          result.searches.push({ db: dbName, search: 'by userId', error: e.message });
        }
      }
    }

    return NextResponse.json(result, { headers: corsHeaders() });
  } catch (error) {
    console.error('[ForceFixProfile GET] Error:', error);
    return NextResponse.json(
      { error: 'Diagnostic failed', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500, headers: corsHeaders() },
    );
  }
}
