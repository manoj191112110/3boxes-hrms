import { NextResponse } from 'next/server';
import { getPlatformDb, getDbForTenant } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';

/**
 * POST /api/admin/map-tenant-admin-emp-id
 *
 * Confirms whether the given employee ID (default: "EMP-MTPL-001") is the
 * same as the MarqAI Tech Group tenant admin's employee ID. If NOT, this
 * endpoint creates / links an Employee record with that employeeId and
 * binds it to the tenant admin User record (so the tenant admin's userId
 * points at this Employee).
 *
 * This is needed because:
 *   - The marqai seed (seed-marqai.ts) creates the tenant admin user
 *     `admin@marqaitechgroup.com` WITHOUT a corresponding Employee record.
 *   - The newer seed (seed-tenant-db.ts) creates Employee IDs like
 *     `EMP-MAT-HR001` (tenant admin) and `EMP-MAT-E001` (employees) —
 *     none of them is `EMP-MTPL-001`.
 *
 * Body (all optional — defaults are sensible for marqaitechgroup):
 *   {
 *     "tenantSlug": "marqaitechgroup",
 *     "employeeId":  "EMP-MTPL-001",
 *     "companyCode": "MAT"  | "MTPL"  | null  (null = first company)
 *   }
 *
 * Only super_admin can call this endpoint.
 *
 * Side effects:
 *   1. Tenant admin's userId is written to Employee.userId (one-to-one).
 *   2. Employee.email is synced to match the tenant admin's email.
 *   3. The User record's email is also normalised to the official email.
 *
 * Once linked, the existing GET /api/tenants/[id] endpoint will surface
 * this Employee (and its employeeId) in the super admin "view tenant"
 * panel — no further UI changes needed for visibility.
 */
export async function POST(request: Request) {
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    if (decoded.role !== 'super_admin') {
      return NextResponse.json(
        { error: 'Only super admin can map tenant admin employee IDs' },
        { status: 403 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const tenantSlug: string = body.tenantSlug || 'marqaitechgroup';
    const targetEmpId: string = body.employeeId || 'EMP-MTPL-001';
    const companyCode: string | null = body.companyCode || null;

    const platformDb = getPlatformDb();

    // ─── Step 1: Find the tenant ───────────────────────────────────────
    const tenant = await platformDb.tenant.findUnique({
      where: { slug: tenantSlug },
      select: { id: true, name: true, slug: true, status: true },
    });
    if (!tenant) {
      return NextResponse.json(
        { error: `Tenant "${tenantSlug}" not found` },
        { status: 404 },
      );
    }

    // ─── Step 2: Find the tenant_admin user for this tenant ────────────
    let tenantDb = platformDb;
    let hasTenantDb = false;
    try {
      tenantDb = await getDbForTenant(tenantSlug);
      hasTenantDb = tenantDb !== platformDb;
    } catch (e) {
      console.error('[MapAdminEmpId] Failed to get tenant DB:', e);
    }

    let tenantAdminUser: { id: string; email: string; name: string; role: string } | null = null;
    let adminSourceDb: 'tenant' | 'platform' = 'platform';

    if (hasTenantDb) {
      try {
        const rows = await tenantDb.$queryRawUnsafe(
          `SELECT id, email, name, role FROM "User"
           WHERE "tenantId" = $1 AND "role" = 'tenant_admin'
           ORDER BY "createdAt" ASC LIMIT 1`,
          tenant.id,
        ) as any[];
        if (rows?.[0]) {
          tenantAdminUser = {
            id: rows[0].id,
            email: rows[0].email,
            name: rows[0].name,
            role: rows[0].role,
          };
          adminSourceDb = 'tenant';
        }
      } catch { /* table might not exist yet */ }
    }

    if (!tenantAdminUser) {
      const platformAdmin = await platformDb.user.findFirst({
        where: { tenantId: tenant.id, role: 'tenant_admin' },
        select: { id: true, email: true, name: true, role: true },
      });
      if (platformAdmin) {
        tenantAdminUser = platformAdmin;
        adminSourceDb = 'platform';
      }
    }

    if (!tenantAdminUser) {
      return NextResponse.json(
        {
          error: `No tenant_admin user found for tenant "${tenantSlug}"`,
          suggestion: 'Run /api/admin/seed-tenant-db first to seed the tenant DB.',
        },
        { status: 404 },
      );
    }

    // ─── Step 3: Find the company ─────────────────────────────────────
    let company: { id: string; name: string; code: string | null; city: string | null; state: string | null } | null = null;

    if (hasTenantDb) {
      try {
        let companyRows: any[] = [];
        if (companyCode) {
          companyRows = await tenantDb.$queryRawUnsafe(
            `SELECT id, name, code, city, state FROM "Company"
             WHERE "code" = $1 LIMIT 1`,
            companyCode,
          ) as any[];
        }
        if (!companyRows?.[0]) {
          companyRows = await tenantDb.$queryRawUnsafe(
            `SELECT id, name, code, city, state FROM "Company"
             ORDER BY "createdAt" ASC LIMIT 1`,
          ) as any[];
        }
        if (companyRows?.[0]) {
          company = {
            id: companyRows[0].id,
            name: companyRows[0].name,
            code: companyRows[0].code,
            city: companyRows[0].city,
            state: companyRows[0].state,
          };
        }
      } catch (e) {
        console.error('[MapAdminEmpId] Failed to find company:', e);
      }
    }

    if (!company) {
      return NextResponse.json(
        {
          error: `No company found in tenant DB for slug "${tenantSlug}".`,
          suggestion: 'Run /api/admin/seed-tenant-db first to create companies.',
        },
        { status: 404 },
      );
    }

    // ─── Step 4: Find department + designation + branch ───────────────
    let deptId: string | null = null;
    let desgId: string | null = null;
    let branchId: string | null = null;

    try {
      const deptRows = await tenantDb.$queryRawUnsafe(
        `SELECT id FROM "Department"
         WHERE "companyId" = $1 AND "name" ILIKE '%Human Resources%'
         LIMIT 1`,
        company.id,
      ) as any[];
      if (deptRows?.[0]) deptId = deptRows[0].id;
    } catch { /* ignore */ }

    if (!deptId) {
      try {
        const deptRows = await tenantDb.$queryRawUnsafe(
          `SELECT id FROM "Department" WHERE "companyId" = $1 ORDER BY "createdAt" ASC LIMIT 1`,
          company.id,
        ) as any[];
        if (deptRows?.[0]) deptId = deptRows[0].id;
      } catch { /* ignore */ }
    }

    if (deptId) {
      try {
        const desgRows = await tenantDb.$queryRawUnsafe(
          `SELECT id FROM "Designation" WHERE "departmentId" = $1 ORDER BY "level" DESC LIMIT 1`,
          deptId,
        ) as any[];
        if (desgRows?.[0]) desgId = desgRows[0].id;
      } catch { /* ignore */ }
    }

    try {
      const branchRows = await tenantDb.$queryRawUnsafe(
        `SELECT id FROM "Branch" WHERE "companyId" = $1 ORDER BY "createdAt" ASC LIMIT 1`,
        company.id,
      ) as any[];
      if (branchRows?.[0]) branchId = branchRows[0].id;
    } catch { /* ignore */ }

    // ─── Step 5: Look for existing Employee with target employeeId ────
    let existingEmployee: any = null;
    try {
      const rows = await tenantDb.$queryRawUnsafe(
        `SELECT * FROM "Employee" WHERE "employeeId" = $1 LIMIT 1`,
        targetEmpId,
      ) as any[];
      if (rows?.[0]) existingEmployee = rows[0];
    } catch { /* table might not exist */ }

    let adminEmployee: any = null;
    try {
      const rows = await tenantDb.$queryRawUnsafe(
        `SELECT * FROM "Employee" WHERE "userId" = $1 LIMIT 1`,
        tenantAdminUser.id,
      ) as any[];
      if (rows?.[0]) adminEmployee = rows[0];
    } catch { /* ignore */ }

    let action = '';
    let finalEmployeeId = targetEmpId;
    let finalEmployeeDbId = '';

    if (existingEmployee && adminEmployee && existingEmployee.id === adminEmployee.id) {
      action = 'already_linked';
      finalEmployeeDbId = existingEmployee.id;
    } else if (existingEmployee && !adminEmployee) {
      try {
        await tenantDb.$executeRawUnsafe(
          `UPDATE "Employee"
             SET "userId" = $1,
                 "email" = $2,
                 "updatedAt" = NOW()
           WHERE "id" = $3`,
          tenantAdminUser.id,
          tenantAdminUser.email,
          existingEmployee.id,
        );
        action = 'relinked_existing_employee';
        finalEmployeeDbId = existingEmployee.id;
      } catch (e) {
        return NextResponse.json(
          { error: 'Failed to re-link existing employee', details: String(e) },
          { status: 500 },
        );
      }
    } else if (existingEmployee && adminEmployee && existingEmployee.id !== adminEmployee.id) {
      try {
        await tenantDb.$executeRawUnsafe(
          `DELETE FROM "Employee" WHERE "id" = $1`,
          existingEmployee.id,
        );
        await tenantDb.$executeRawUnsafe(
          `UPDATE "Employee"
             SET "employeeId" = $1,
                 "email" = $2,
                 "userId" = $3,
                 "updatedAt" = NOW()
           WHERE "id" = $4`,
          targetEmpId,
          tenantAdminUser.email,
          tenantAdminUser.id,
          adminEmployee.id,
        );
        action = 'consolidated_admin_employee_id_updated';
        finalEmployeeDbId = adminEmployee.id;
      } catch (e) {
        return NextResponse.json(
          { error: 'Failed to consolidate employee records', details: String(e) },
          { status: 500 },
        );
      }
    } else if (!existingEmployee && adminEmployee) {
      try {
        await tenantDb.$executeRawUnsafe(
          `UPDATE "Employee"
             SET "employeeId" = $1,
                 "email" = $2,
                 "userId" = $3,
                 "updatedAt" = NOW()
           WHERE "id" = $4`,
          targetEmpId,
          tenantAdminUser.email,
          tenantAdminUser.id,
          adminEmployee.id,
        );
        action = 'updated_admin_employee_id';
        finalEmployeeDbId = adminEmployee.id;
      } catch (e) {
        return NextResponse.json(
          { error: 'Failed to update admin employee ID', details: String(e) },
          { status: 500 },
        );
      }
    } else {
      if (!deptId || !desgId) {
        return NextResponse.json(
          {
            error: 'Cannot create employee record — missing Department/Designation',
            company: { id: company.id, name: company.name, code: company.code },
            deptId,
            desgId,
          },
          { status: 500 },
        );
      }
      const newEmpId = `emp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const nameParts = (tenantAdminUser.name || 'Tenant Admin').split(' ');
      const firstName = nameParts[0] || 'Tenant';
      const lastName = nameParts.slice(1).join(' ') || 'Admin';
      try {
        await tenantDb.$executeRawUnsafe(
          `INSERT INTO "Employee"
             ("id", "employeeId", "firstName", "lastName", "email",
              "userId", "departmentId", "designationId", "branchId", "companyId",
              "dateOfJoining", "gender", "nationality", "city", "state", "country",
              "status", "employeeStatus", "employeeType", "salary", "salaryCurrency",
              "createdAt", "updatedAt")
           VALUES
             ($1, $2, $3, $4, $5,
              $6, $7, $8, $9, $10,
              NOW(), 'male', 'Indian', $11, $12, 'IN',
              'active', 'confirmed', 'permanent', 0, 'INR',
              NOW(), NOW())`,
          newEmpId,
          targetEmpId,
          firstName,
          lastName,
          tenantAdminUser.email,
          tenantAdminUser.id,
          deptId,
          desgId,
          branchId,
          company.id,
          company.city || 'Hyderabad',
          company.state || 'TS',
        );
        action = 'created_new_employee';
        finalEmployeeDbId = newEmpId;
      } catch (e) {
        return NextResponse.json(
          { error: 'Failed to create new Employee record', details: String(e) },
          { status: 500 },
        );
      }
    }

    // ─── Step 6: Sync tenant admin's email in the platform DB ─────────
    try {
      await platformDb.$executeRawUnsafe(
        `UPDATE "User" SET "email" = $1, "updatedAt" = NOW() WHERE "id" = $2`,
        tenantAdminUser.email,
        tenantAdminUser.id,
      );
    } catch { /* ignore */ }

    const isSameId = existingEmployee?.employeeid === targetEmpId && adminEmployee?.id === existingEmployee?.id;

    return NextResponse.json({
      success: true,
      confirmation: {
        question: `Is "${targetEmpId}" the same as the MarqAI Tech Group tenant admin's employee ID?`,
        answer: isSameId ? 'YES — already mapped' : `NO — has now been mapped to "${targetEmpId}"`,
        before: adminEmployee?.employeeid
          ? `Tenant admin previously had employeeId="${adminEmployee.employeeid}"`
          : 'Tenant admin had NO employee record',
        after: `Tenant admin now mapped to employeeId="${finalEmployeeId}"`,
      },
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
      },
      tenantAdminUser: {
        id: tenantAdminUser.id,
        email: tenantAdminUser.email,
        name: tenantAdminUser.name,
        role: tenantAdminUser.role,
        sourceDb: adminSourceDb,
      },
      employee: {
        id: finalEmployeeDbId,
        employeeId: finalEmployeeId,
        email: tenantAdminUser.email,
        companyId: company.id,
        companyName: company.name,
        companyCode: company.code,
        departmentId: deptId,
        designationId: desgId,
        branchId,
      },
      action,
      note: 'This employee record will now appear in the super admin "View Tenant" panel under the Employees table — visible from the 3boxeshrms.com/super-admin link.',
    });
  } catch (error) {
    console.error('[MapAdminEmpId] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to map tenant admin employee ID',
        details: error instanceof Error ? error.message : 'Unknown',
      },
      { status: 500 },
    );
  }
}

/**
 * GET /api/admin/map-tenant-admin-emp-id?slug=marqaitechgroup&employeeId=EMP-MTPL-001
 *
 * Read-only inspection: returns whether the given employeeId is the same
 * as the tenant admin's current employee ID, WITHOUT making any changes.
 */
export async function GET(request: Request) {
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    if (decoded.role !== 'super_admin') {
      return NextResponse.json(
        { error: 'Only super admin can inspect tenant admin employee ID mapping' },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(request.url);
    const tenantSlug = searchParams.get('slug') || 'marqaitechgroup';
    const targetEmpId = searchParams.get('employeeId') || 'EMP-MTPL-001';

    const platformDb = getPlatformDb();
    const tenant = await platformDb.tenant.findUnique({
      where: { slug: tenantSlug },
      select: { id: true, name: true, slug: true },
    });
    if (!tenant) {
      return NextResponse.json({ error: `Tenant "${tenantSlug}" not found` }, { status: 404 });
    }

    const admin = await platformDb.user.findFirst({
      where: { tenantId: tenant.id, role: 'tenant_admin' },
      select: { id: true, email: true, name: true, role: true },
    });

    let tenantAdminEmployee: any = null;
    let targetEmployeeExists = false;

    try {
      const tenantDb = await getDbForTenant(tenantSlug);
      if (admin) {
        const rows = await tenantDb.$queryRawUnsafe(
          `SELECT * FROM "Employee" WHERE "userId" = $1 LIMIT 1`,
          admin.id,
        ) as any[];
        if (rows?.[0]) tenantAdminEmployee = rows[0];
      }
      const targetRows = await tenantDb.$queryRawUnsafe(
        `SELECT * FROM "Employee" WHERE "employeeId" = $1 LIMIT 1`,
        targetEmpId,
      ) as any[];
      if (targetRows?.[0]) targetEmployeeExists = true;
    } catch (e) {
      // tenant DB might not exist
    }

    const isSameId =
      tenantAdminEmployee?.employeeid === targetEmpId ||
      tenantAdminEmployee?.employeeId === targetEmpId;

    return NextResponse.json({
      tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug },
      tenantAdminUser: admin,
      tenantAdminEmployee: tenantAdminEmployee
        ? {
            id: tenantAdminEmployee.id,
            employeeId: tenantAdminEmployee.employeeid || tenantAdminEmployee.employeeId,
            email: tenantAdminEmployee.email,
          }
        : null,
      targetEmployeeId: targetEmpId,
      targetEmployeeExists,
      isSameId,
      answer: isSameId
        ? `YES — the tenant admin's employee ID is already "${targetEmpId}"`
        : `NO — the tenant admin's employee ID is "${tenantAdminEmployee?.employeeid || tenantAdminEmployee?.employeeId || '(none)'}", not "${targetEmpId}". Call POST /api/admin/map-tenant-admin-emp-id to map it.`,
    });
  } catch (error) {
    console.error('[MapAdminEmpId] GET Error:', error);
    return NextResponse.json(
      { error: 'Failed to inspect tenant admin employee ID', details: String(error) },
      { status: 500 },
    );
  }
}
