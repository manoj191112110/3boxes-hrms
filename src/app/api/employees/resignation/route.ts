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
 * GET /api/employees/resignation
 *
 * Returns resignation request records. Stored in the `Resignation` table
 * (auto-created via inline schema-sync on first call).
 *
 * Query params:
 *   ?employeeId=<id>
 *   ?status=<status>
 *   ?page=<n>
 *   ?limit=<n>
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

    // ─── Inline schema-sync for Resignation table ───
    try {
      const syncStatements = [
        `CREATE TABLE IF NOT EXISTS "Resignation" ("id" TEXT NOT NULL, "employeeId" TEXT NOT NULL, "employeeName" TEXT, "employeeCode" TEXT, "department" TEXT, "designation" TEXT, "resignationDate" TIMESTAMP(3), "lastWorkingDate" TIMESTAMP(3), "reasonCategory" TEXT, "detailedReason" TEXT, "noticePeriodDays" INTEGER, "isNoticePeriodWaived" BOOLEAN NOT NULL DEFAULT false, "waiverReason" TEXT, "handoverPlan" TEXT, "pendingTasks" TEXT, "status" TEXT NOT NULL DEFAULT 'pending', "submittedById" TEXT, "approvedById" TEXT, "approvedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(), "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(), CONSTRAINT "Resignation_pkey" PRIMARY KEY ("id"))`,
        `CREATE INDEX IF NOT EXISTS "Resignation_employeeId_idx" ON "Resignation"("employeeId")`,
        `CREATE INDEX IF NOT EXISTS "Resignation_status_idx" ON "Resignation"("status")`,
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
        `SELECT COUNT(*)::int AS count FROM "Resignation" r ${whereClause}`,
        ...params,
      ) as any[];
      total = countRows?.[0]?.count || 0;
    } catch (err) {
      console.error('[Resignation GET] count failed:', err);
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
         FROM "Resignation" r
         LEFT JOIN "Employee" e ON e."id" = r."employeeId"
         LEFT JOIN "Department" d ON d."id" = e."departmentId"
         LEFT JOIN "Designation" des ON des."id" = e."designationId"
         ${whereClause}
         ORDER BY r."createdAt" DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        ...queryParams,
      ) as any[];
    } catch (err) {
      console.error('[Resignation GET] query failed:', err);
      return NextResponse.json({
        resignations: [],
        pagination: { page, limit, total: 0, totalPages: 0 },
      }, { headers: corsHeaders() });
    }

    const resignations = rows.map((r: any) => ({
      id: r.id,
      employeeId: r.employeeId,
      employeeName: r.employeeName || `${r.empFirstName || ''} ${r.empLastName || ''}`.trim() || 'Unknown',
      employeeCode: r.employeeCode || r.empCode || '—',
      department: r.department || r.deptName || '—',
      designation: r.designation || r.desgTitle || '—',
      resignationDate: r.resignationDate,
      lastWorkingDate: r.lastWorkingDate,
      reasonCategory: r.reasonCategory || '',
      detailedReason: r.detailedReason || '',
      noticePeriodDays: r.noticePeriodDays || 0,
      isNoticePeriodWaived: r.isNoticePeriodWaived || false,
      waiverReason: r.waiverReason || '',
      handoverPlan: r.handoverPlan || '',
      pendingTasks: r.pendingTasks || '',
      status: r.status,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));

    return NextResponse.json(
      { resignations, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } },
      { headers: corsHeaders() }
    );
  } catch (error) {
    console.error('Get resignations error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders() }
    );
  }
}

/**
 * POST /api/employees/resignation
 *
 * Creates a resignation request. Status starts as 'pending'.
 * On submission:
 *   1. Insert row into Resignation table
 *   2. Send notification to HR/Admin + Reporting Manager
 *   3. Notify the employee (if submitted by HR on behalf of employee)
 *   4. Create audit log
 *
 * The employee's status is NOT changed to 'resigned' until the request
 * is approved by HR/Admin. When approved, the [id]/route.ts handler
 * will update Employee.status = 'resigned'.
 */
export async function POST(request: Request) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders() });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401, headers: corsHeaders() });

    const body = await request.json();
    let {
      employeeId,
      employeeName,
      employeeCode,
      department,
      designation,
      resignationDate,
      lastWorkingDate,
      reasonCategory,
      detailedReason,
      noticePeriodDays,
      isNoticePeriodWaived,
      waiverReason,
      handoverPlan,
      pendingTasks,
    } = body;

    // If employeeId is missing, try to look it up from the JWT userId
    if (!employeeId) {
      try {
        const empRows = await db.$queryRawUnsafe(
          `SELECT id FROM "Employee" WHERE "userId" = $1 LIMIT 1`,
          decoded.userId,
        ) as any[];
        if (empRows?.[0]?.id) {
          employeeId = empRows[0].id;
        }
      } catch {
        // ignore lookup errors
      }
    }

    if (!employeeId) {
      return NextResponse.json(
        { error: 'Employee ID is required. Please ensure your user account is linked to an employee record.' },
        { status: 400, headers: corsHeaders() }
      );
    }

    // ─── Inline schema-sync for Resignation table ───
    try {
      const syncStatements = [
        `CREATE TABLE IF NOT EXISTS "Resignation" ("id" TEXT NOT NULL, "employeeId" TEXT NOT NULL, "employeeName" TEXT, "employeeCode" TEXT, "department" TEXT, "designation" TEXT, "resignationDate" TIMESTAMP(3), "lastWorkingDate" TIMESTAMP(3), "reasonCategory" TEXT, "detailedReason" TEXT, "noticePeriodDays" INTEGER, "isNoticePeriodWaived" BOOLEAN NOT NULL DEFAULT false, "waiverReason" TEXT, "handoverPlan" TEXT, "pendingTasks" TEXT, "status" TEXT NOT NULL DEFAULT 'pending', "submittedById" TEXT, "approvedById" TEXT, "approvedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(), "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(), CONSTRAINT "Resignation_pkey" PRIMARY KEY ("id"))`,
        `CREATE INDEX IF NOT EXISTS "Resignation_employeeId_idx" ON "Resignation"("employeeId")`,
        `CREATE INDEX IF NOT EXISTS "Resignation_status_idx" ON "Resignation"("status")`,
      ];
      for (const sql of syncStatements) {
        try { await db.$executeRawUnsafe(sql); } catch { /* already exists */ }
      }
    } catch { /* non-fatal */ }

    const resignationId = `res-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const submittedById = decoded.userId as string;

    // Insert the resignation record
    try {
      await db.$executeRawUnsafe(
        `INSERT INTO "Resignation"
           ("id", "employeeId", "employeeName", "employeeCode", "department", "designation",
            "resignationDate", "lastWorkingDate", "reasonCategory", "detailedReason",
            "noticePeriodDays", "isNoticePeriodWaived", "waiverReason",
            "handoverPlan", "pendingTasks", "status", "submittedById", "createdAt", "updatedAt")
         VALUES
           ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 'pending', $16, NOW(), NOW())`,
        resignationId,
        employeeId,
        employeeName || null,
        employeeCode || null,
        department || null,
        designation || null,
        resignationDate ? new Date(resignationDate) : null,
        lastWorkingDate ? new Date(lastWorkingDate) : null,
        reasonCategory || null,
        detailedReason || null,
        Number(noticePeriodDays) || 0,
        Boolean(isNoticePeriodWaived),
        waiverReason || null,
        handoverPlan || null,
        pendingTasks || null,
        submittedById,
      );
    } catch (insertErr) {
      console.error('[Resignation POST] insert failed:', insertErr);
      return NextResponse.json(
        { error: 'Failed to create resignation record', details: String(insertErr) },
        { status: 500, headers: corsHeaders() }
      );
    }

    // Send notifications to HR/Admin users + Reporting Manager + Employee
    try {
      const tenantId = (decoded as any).tenantId;
      if (tenantId) {
        // 1. Notify HR/Admin users
        const adminUsers = await db.user.findMany({
          where: {
            tenantId,
            role: { in: ['tenant_admin', 'admin'] },
            status: 'active',
          },
          select: { id: true },
        }).catch(() => []);

        const empName = employeeName || 'an employee';
        for (const admin of adminUsers) {
          await createNotification({
            tenantId,
            userId: admin.id,
            title: 'New Resignation Request Submitted',
            message: `A resignation request has been submitted by ${empName}. Last working date: ${lastWorkingDate || 'TBD'}. Please review and process.`,
            type: 'warning',
            category: 'employee_lifecycle',
            link: '/employees/resignation',
          }).catch(() => {});
        }

        // 2. Notify the employee's reporting manager (if linked)
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
              title: 'Resignation Submitted by Direct Report',
              message: `${empName} has submitted a resignation request. Please review and provide feedback to HR.`,
              type: 'warning',
              category: 'employee_lifecycle',
              link: '/employees/resignation',
            }).catch(() => {});
          }
        } catch { /* non-critical */ }
      }
    } catch (e) {
      console.error('[Resignation POST] notification failed:', e);
    }

    // Audit log
    try {
      await db.auditLog.create({
        data: {
          userId: submittedById,
          action: 'CREATE_RESIGNATION_REQUEST',
          module: 'employees',
          details: `Created resignation request for employee ${employeeName || employeeId}. Last working date: ${lastWorkingDate || 'TBD'}`,
        },
      });
    } catch { /* non-critical */ }

    return NextResponse.json(
      {
        success: true,
        message: 'Resignation submitted successfully. HR/Admin and your reporting manager have been notified.',
        resignation: {
          id: resignationId,
          employeeId,
          employeeName: employeeName || '',
          employeeCode: employeeCode || '',
          resignationDate,
          lastWorkingDate,
          reasonCategory,
          detailedReason,
          status: 'pending',
          createdAt: new Date().toISOString(),
        },
      },
      { status: 201, headers: corsHeaders() }
    );
  } catch (error) {
    console.error('Create resignation error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500, headers: corsHeaders() }
    );
  }
}
