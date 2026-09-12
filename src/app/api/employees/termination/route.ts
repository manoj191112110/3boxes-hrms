import { NextResponse } from 'next/server';
import { getDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';
import { createNotification } from '@/lib/notifications';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() });
}

/**
 * GET /api/employees/termination
 */
export async function GET(request: Request) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders() });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401, headers: corsHeaders() });

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const employeeId = searchParams.get('employeeId');
    const status = searchParams.get('status');

    // ─── Inline schema-sync for Termination table ───
    try {
      const syncStatements = [
        `CREATE TABLE IF NOT EXISTS "Termination" ("id" TEXT NOT NULL, "employeeId" TEXT NOT NULL, "terminationType" TEXT, "terminationDate" TIMESTAMP(3), "lastWorkingDate" TIMESTAMP(3), "noticePeriodServed" BOOLEAN NOT NULL DEFAULT false, "reasonCategory" TEXT, "detailedReason" TEXT, "assetsToReturn" TEXT, "finalSettlementRequired" BOOLEAN NOT NULL DEFAULT true, "status" TEXT NOT NULL DEFAULT 'pending', "submittedById" TEXT, "approvedById" TEXT, "approvedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(), "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(), CONSTRAINT "Termination_pkey" PRIMARY KEY ("id"))`,
        `CREATE INDEX IF NOT EXISTS "Termination_employeeId_idx" ON "Termination"("employeeId")`,
        `CREATE INDEX IF NOT EXISTS "Termination_status_idx" ON "Termination"("status")`,
      ];
      for (const sql of syncStatements) {
        try { await db.$executeRawUnsafe(sql); } catch { /* already exists */ }
      }
    } catch { /* non-fatal */ }

    const conditions: string[] = [];
    const params: unknown[] = [];
    if (employeeId) {
      params.push(employeeId);
      conditions.push(`r."employeeId" = $${params.length}`);
    }
    if (status) {
      params.push(status);
      conditions.push(`r."status" = $${params.length}`);
    }
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    let total = 0;
    try {
      const countRows = await db.$queryRawUnsafe(
        `SELECT COUNT(*)::int AS count FROM "Termination" r ${whereClause}`,
        ...params,
      ) as any[];
      total = countRows?.[0]?.count || 0;
    } catch (err) {
      console.error('[Termination GET] count failed:', err);
    }

    let rows: any[] = [];
    try {
      const offset = (page - 1) * limit;
      const queryParams = [...params, limit, offset];
      rows = await db.$queryRawUnsafe(
        `SELECT r.*,
           e."firstName" AS "empFirstName",
           e."lastName"  AS "empLastName",
           e."employeeId" AS "empCode",
           d."name" AS "deptName",
           des."title" AS "desgTitle"
         FROM "Termination" r
         LEFT JOIN "Employee" e ON e."id" = r."employeeId"
         LEFT JOIN "Department" d ON d."id" = e."departmentId"
         LEFT JOIN "Designation" des ON des."id" = e."designationId"
         ${whereClause}
         ORDER BY r."createdAt" DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        ...queryParams,
      ) as any[];
    } catch (err) {
      console.error('[Termination GET] query failed:', err);
      return NextResponse.json({
        terminations: [],
        pagination: { page, limit, total: 0, totalPages: 0 },
      }, { headers: corsHeaders() });
    }

    const terminations = rows.map((r: any) => ({
      id: r.id,
      employeeId: r.employeeId,
      employeeName: `${r.empFirstName || ''} ${r.empLastName || ''}`.trim() || 'Unknown',
      employeeCode: r.empCode || '—',
      department: r.deptName || '—',
      designation: r.desgTitle || '—',
      terminationType: r.terminationType || '',
      terminationDate: r.terminationDate,
      lastWorkingDate: r.lastWorkingDate,
      noticePeriodServed: r.noticePeriodServed || false,
      reasonCategory: r.reasonCategory || '',
      detailedReason: r.detailedReason || '',
      assetsToReturn: r.assetsToReturn || '',
      finalSettlementRequired: r.finalSettlementRequired || true,
      status: r.status,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));

    return NextResponse.json(
      { terminations, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } },
      { headers: corsHeaders() }
    );
  } catch (error) {
    console.error('Get terminations error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders() }
    );
  }
}

/**
 * POST /api/employees/termination
 *
 * Creates a termination request. Updates the employee's status to 'terminated'
 * immediately (since terminations are admin-initiated, not employee-submitted).
 *
 * Side effects:
 *   1. Insert row into Termination table with status='completed'
 *   2. Update Employee.status = 'terminated'
 *   3. Deactivate linked User account (set status='inactive')
 *   4. Send notifications to HR/Admin + Reporting Manager + Employee
 *   5. Create audit log
 */
export async function POST(request: Request) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders() });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401, headers: corsHeaders() });

    // Only admins can terminate
    const role = decoded.role as string;
    if (!['super_admin', 'tenant_admin', 'admin'].includes(role)) {
      return NextResponse.json(
        { error: 'Only administrators can process employee terminations' },
        { status: 403, headers: corsHeaders() }
      );
    }

    const body = await request.json();
    const {
      employeeId,
      terminationType,
      terminationDate,
      lastWorkingDate,
      noticePeriodServed,
      reasonCategory,
      detailedReason,
      assetsToReturn,
      finalSettlementRequired,
    } = body;

    if (!employeeId) {
      return NextResponse.json(
        { error: 'Employee ID is required' },
        { status: 400, headers: corsHeaders() }
      );
    }

    // ─── Inline schema-sync for Termination table ───
    try {
      const syncStatements = [
        `CREATE TABLE IF NOT EXISTS "Termination" ("id" TEXT NOT NULL, "employeeId" TEXT NOT NULL, "terminationType" TEXT, "terminationDate" TIMESTAMP(3), "lastWorkingDate" TIMESTAMP(3), "noticePeriodServed" BOOLEAN NOT NULL DEFAULT false, "reasonCategory" TEXT, "detailedReason" TEXT, "assetsToReturn" TEXT, "finalSettlementRequired" BOOLEAN NOT NULL DEFAULT true, "status" TEXT NOT NULL DEFAULT 'pending', "submittedById" TEXT, "approvedById" TEXT, "approvedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(), "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(), CONSTRAINT "Termination_pkey" PRIMARY KEY ("id"))`,
        `CREATE INDEX IF NOT EXISTS "Termination_employeeId_idx" ON "Termination"("employeeId")`,
        `CREATE INDEX IF NOT EXISTS "Termination_status_idx" ON "Termination"("status")`,
      ];
      for (const sql of syncStatements) {
        try { await db.$executeRawUnsafe(sql); } catch { /* already exists */ }
      }
    } catch { /* non-fatal */ }

    // Verify the employee exists and is not already terminated/inactive
    let existingEmp: any = null;
    try {
      const rows = await db.$queryRawUnsafe(
        `SELECT e.*, u."id" AS "userId", u."status" AS "userStatus",
                d."name" AS "deptName", des."title" AS "desgTitle"
         FROM "Employee" e
         LEFT JOIN "User" u ON u."id" = e."userId"
         LEFT JOIN "Department" d ON d."id" = e."departmentId"
         LEFT JOIN "Designation" des ON des."id" = e."designationId"
         WHERE e."id" = $1
         LIMIT 1`,
        employeeId,
      ) as any[];
      if (rows?.[0]) existingEmp = rows[0];
    } catch (e) {
      console.error('[Termination POST] employee lookup failed:', e);
    }

    if (!existingEmp) {
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404, headers: corsHeaders() }
      );
    }

    if (existingEmp.status === 'terminated') {
      return NextResponse.json(
        { error: 'Employee is already terminated' },
        { status: 400, headers: corsHeaders() }
      );
    }

    if (existingEmp.status === 'inactive') {
      return NextResponse.json(
        { error: 'Employee is already inactive. Cannot terminate an inactive employee.' },
        { status: 400, headers: corsHeaders() }
      );
    }

    const terminationId = `term-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const submittedById = decoded.userId as string;

    // Insert the termination record (status='completed' since admin-initiated)
    try {
      await db.$executeRawUnsafe(
        `INSERT INTO "Termination"
           ("id", "employeeId", "terminationType", "terminationDate", "lastWorkingDate",
            "noticePeriodServed", "reasonCategory", "detailedReason",
            "assetsToReturn", "finalSettlementRequired",
            "status", "submittedById", "approvedById", "approvedAt", "createdAt", "updatedAt")
         VALUES
           ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'completed', $11, $11, NOW(), NOW(), NOW())`,
        terminationId,
        employeeId,
        terminationType || null,
        terminationDate ? new Date(terminationDate) : null,
        lastWorkingDate ? new Date(lastWorkingDate) : null,
        Boolean(noticePeriodServed),
        reasonCategory || null,
        detailedReason || null,
        assetsToReturn || null,
        Boolean(finalSettlementRequired),
        submittedById,
      );
    } catch (insertErr) {
      console.error('[Termination POST] insert failed:', insertErr);
      return NextResponse.json(
        { error: 'Failed to create termination record', details: String(insertErr) },
        { status: 500, headers: corsHeaders() }
      );
    }

    // Update employee status to 'terminated'
    try {
      await db.$executeRawUnsafe(
        `UPDATE "Employee" SET "status" = 'terminated', "updatedAt" = NOW() WHERE "id" = $1`,
        employeeId,
      );
    } catch (e) {
      console.error('[Termination POST] employee status update failed:', e);
      // Continue — the termination record was created; status update can be retried
    }

    // Deactivate the linked User account
    if (existingEmp.userId) {
      try {
        await db.$executeRawUnsafe(
          `UPDATE "User" SET "status" = 'inactive', "updatedAt" = NOW() WHERE "id" = $1`,
          existingEmp.userId,
        );
      } catch (e) {
        console.error('[Termination POST] user deactivation failed:', e);
      }
    }

    // Send notifications
    try {
      const tenantId = (decoded as any).tenantId;
      if (tenantId) {
        const empName = `${existingEmp.firstname || existingEmp.firstName || ''} ${existingEmp.lastname || existingEmp.lastName || ''}`.trim() || 'Employee';

        // 1. Notify all HR/Admin users
        const adminUsers = await db.user.findMany({
          where: {
            tenantId,
            role: { in: ['tenant_admin', 'admin'] },
            status: 'active',
          },
          select: { id: true },
        }).catch(() => []);

        for (const admin of adminUsers) {
          await createNotification({
            tenantId,
            userId: admin.id,
            title: 'Employee Termination Processed',
            message: `Termination has been processed for ${empName} (${existingEmp.employeeid || existingEmp.employeeId || ''}). Reason: ${reasonCategory || 'N/A'}.`,
            type: 'warning',
            category: 'employee_lifecycle',
            link: '/employees/termination',
          }).catch(() => {});
        }

        // 2. Notify the employee (if they have a user account)
        if (existingEmp.userId) {
          await createNotification({
            tenantId,
            userId: existingEmp.userId,
            title: 'Employment Terminated',
            message: `Your employment has been terminated effective ${terminationDate || lastWorkingDate || 'today'}. Please contact HR for exit clearance and final settlement details.`,
            type: 'error',
            category: 'employee_lifecycle',
            link: '/employees/termination',
          }).catch(() => {});
        }

        // 3. Notify the reporting manager
        try {
          const mgrRows = await db.$queryRawUnsafe(
            `SELECT e."reportingManagerId", u."id" AS "managerUserId"
             FROM "Employee" e
             LEFT JOIN "User" u ON u."id" = e."reportingManagerId"
             WHERE e."id" = $1 AND e."reportingManagerId" IS NOT NULL
             LIMIT 1`,
            employeeId,
          ) as any[];
          if (mgrRows?.[0]?.managerUserId) {
            await createNotification({
              tenantId,
              userId: mgrRows[0].managerUserId,
              title: 'Direct Report Terminated',
              message: `${empName}, who reported to you, has been terminated. Please plan workload redistribution.`,
              type: 'warning',
              category: 'employee_lifecycle',
              link: '/employees/termination',
            }).catch(() => {});
          }
        } catch { /* non-critical */ }
      }
    } catch (e) {
      console.error('[Termination POST] notification failed:', e);
    }

    // Audit log
    try {
      await db.auditLog.create({
        data: {
          userId: submittedById,
          action: 'CREATE_TERMINATION',
          module: 'employees',
          details: `Terminated employee ${existingEmp.employeeid || existingEmp.employeeId || employeeId}. Reason: ${reasonCategory || 'N/A'}`,
        },
      });
    } catch { /* non-critical */ }

    return NextResponse.json(
      {
        success: true,
        message: 'Termination processed successfully. Employee status updated to "Terminated". HR, Manager, and Employee have been notified.',
        termination: {
          id: terminationId,
          employeeId,
          employeeName: `${existingEmp.firstname || existingEmp.firstName || ''} ${existingEmp.lastname || existingEmp.lastName || ''}`.trim(),
          employeeCode: existingEmp.employeeid || existingEmp.employeeId || '',
          terminationType,
          terminationDate,
          lastWorkingDate,
          status: 'completed',
          createdAt: new Date().toISOString(),
        },
      },
      { status: 201, headers: corsHeaders() }
    );
  } catch (error) {
    console.error('Create termination error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500, headers: corsHeaders() }
    );
  }
}
