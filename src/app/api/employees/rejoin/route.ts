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
 * GET /api/employees/rejoin
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

    // ─── Inline schema-sync for Rejoin table ───
    try {
      const syncStatements = [
        `CREATE TABLE IF NOT EXISTS "Rejoin" ("id" TEXT NOT NULL, "employeeId" TEXT NOT NULL, "previousEmployeeId" TEXT, "rejoinDate" TIMESTAMP(3), "newDepartmentId" TEXT, "newDesignationId" TEXT, "newEmployeeCode" TEXT, "employmentType" TEXT, "reportingManager" TEXT, "serviceContinuity" TEXT, "leaveBalanceCarryForward" BOOLEAN NOT NULL DEFAULT false, "gratuityContinuity" BOOLEAN NOT NULL DEFAULT false, "rejoinReason" TEXT, "hrComments" TEXT, "status" TEXT NOT NULL DEFAULT 'pending', "submittedById" TEXT, "approvedById" TEXT, "approvedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(), "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(), CONSTRAINT "Rejoin_pkey" PRIMARY KEY ("id"))`,
        `CREATE INDEX IF NOT EXISTS "Rejoin_employeeId_idx" ON "Rejoin"("employeeId")`,
        `CREATE INDEX IF NOT EXISTS "Rejoin_status_idx" ON "Rejoin"("status")`,
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
        `SELECT COUNT(*)::int AS count FROM "Rejoin" r ${whereClause}`,
        ...params,
      ) as any[];
      total = countRows?.[0]?.count || 0;
    } catch (err) {
      console.error('[Rejoin GET] count failed:', err);
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
         FROM "Rejoin" r
         LEFT JOIN "Employee" e ON e."id" = r."employeeId"
         LEFT JOIN "Department" d ON d."id" = r."newDepartmentId"
         LEFT JOIN "Designation" des ON des."id" = r."newDesignationId"
         ${whereClause}
         ORDER BY r."createdAt" DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        ...queryParams,
      ) as any[];
    } catch (err) {
      console.error('[Rejoin GET] query failed:', err);
      return NextResponse.json({
        rejoins: [],
        pagination: { page, limit, total: 0, totalPages: 0 },
      }, { headers: corsHeaders() });
    }

    const rejoins = rows.map((r: any) => ({
      id: r.id,
      employeeId: r.employeeId,
      employeeName: `${r.empFirstName || ''} ${r.empLastName || ''}`.trim() || 'Unknown',
      employeeCode: r.empCode || '—',
      previousEmployeeId: r.previousEmployeeId,
      rejoinDate: r.rejoinDate,
      newDepartment: r.deptName || '—',
      newDesignation: r.desgTitle || '—',
      newEmployeeCode: r.newEmployeeCode || '',
      employmentType: r.employmentType || '',
      reportingManager: r.reportingManager || '',
      serviceContinuity: r.serviceContinuity || 'new',
      leaveBalanceCarryForward: r.leaveBalanceCarryForward || false,
      gratuityContinuity: r.gratuityContinuity || false,
      rejoinReason: r.rejoinReason || '',
      hrComments: r.hrComments || '',
      status: r.status,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));

    return NextResponse.json(
      { rejoins, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } },
      { headers: corsHeaders() }
    );
  } catch (error) {
    console.error('Get rejoins error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders() }
    );
  }
}

/**
 * POST /api/employees/rejoin
 *
 * Processes an employee rejoin. Since rejoins are admin-initiated, the
 * employee's status is updated to 'active' immediately.
 *
 * Side effects:
 *   1. Insert row into Rejoin table with status='completed'
 *   2. Update Employee.status = 'active', set new department/designation/DOJ
 *   3. Reactivate the linked User account (set status='active')
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

    // Only admins can process rejoins
    const role = decoded.role as string;
    if (!['super_admin', 'tenant_admin', 'admin'].includes(role)) {
      return NextResponse.json(
        { error: 'Only administrators can process employee rejoins' },
        { status: 403, headers: corsHeaders() }
      );
    }

    const body = await request.json();
    let {
      employeeId,
      previousEmployeeId,
      rejoinDate,
      departmentId,
      designationId,
      newDepartment,
      newDesignation,
      newEmployeeCode,
      employmentType,
      reportingManager,
      serviceContinuity,
      leaveBalanceCarryForward,
      gratuityContinuity,
      rejoinReason,
      hrComments,
    } = body;

    // Use employeeId or fall back to previousEmployeeId
    const targetEmployeeId = employeeId || previousEmployeeId;

    if (!targetEmployeeId) {
      // Try to look it up from JWT
      try {
        const empRows = await db.$queryRawUnsafe(
          `SELECT id FROM "Employee" WHERE "userId" = $1 LIMIT 1`,
          decoded.userId,
        ) as any[];
        if (empRows?.[0]?.id) {
          employeeId = empRows[0].id;
        }
      } catch { /* ignore */ }
    }

    if (!targetEmployeeId) {
      return NextResponse.json(
        { error: 'Employee ID is required' },
        { status: 400, headers: corsHeaders() }
      );
    }

    // Validate reporting manager name (must be alphabetic + spaces only, no special chars/numbers)
    if (reportingManager && typeof reportingManager === 'string' && reportingManager.trim()) {
      const trimmed = reportingManager.trim();
      // Allow letters (any language), spaces, hyphens, apostrophes, periods — block digits and other specials
      if (!/^[A-Za-z\u00C0-\u017F\u0900-\u097F\s.'-]+$/.test(trimmed)) {
        return NextResponse.json(
          { error: 'Reporting Manager name must contain only letters, spaces, hyphens, apostrophes, or periods. Numbers and special characters are not allowed.' },
          { status: 400, headers: corsHeaders() }
        );
      }
    }

    // ─── Inline schema-sync for Rejoin table ───
    try {
      const syncStatements = [
        `CREATE TABLE IF NOT EXISTS "Rejoin" ("id" TEXT NOT NULL, "employeeId" TEXT NOT NULL, "previousEmployeeId" TEXT, "rejoinDate" TIMESTAMP(3), "newDepartmentId" TEXT, "newDesignationId" TEXT, "newEmployeeCode" TEXT, "employmentType" TEXT, "reportingManager" TEXT, "serviceContinuity" TEXT, "leaveBalanceCarryForward" BOOLEAN NOT NULL DEFAULT false, "gratuityContinuity" BOOLEAN NOT NULL DEFAULT false, "rejoinReason" TEXT, "hrComments" TEXT, "status" TEXT NOT NULL DEFAULT 'pending', "submittedById" TEXT, "approvedById" TEXT, "approvedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(), "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(), CONSTRAINT "Rejoin_pkey" PRIMARY KEY ("id"))`,
        `CREATE INDEX IF NOT EXISTS "Rejoin_employeeId_idx" ON "Rejoin"("employeeId")`,
        `CREATE INDEX IF NOT EXISTS "Rejoin_status_idx" ON "Rejoin"("status")`,
      ];
      for (const sql of syncStatements) {
        try { await db.$executeRawUnsafe(sql); } catch { /* already exists */ }
      }
    } catch { /* non-fatal */ }

    // Verify the employee exists and is resigned/terminated
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
        targetEmployeeId,
      ) as any[];
      if (rows?.[0]) existingEmp = rows[0];
    } catch (e) {
      console.error('[Rejoin POST] employee lookup failed:', e);
    }

    if (!existingEmp) {
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404, headers: corsHeaders() }
      );
    }

    if (existingEmp.status === 'active') {
      return NextResponse.json(
        { error: 'Employee is already active. Cannot rejoin an active employee.' },
        { status: 400, headers: corsHeaders() }
      );
    }

    const rejoinId = `rej-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const submittedById = decoded.userId as string;
    const newDeptId = newDepartment || departmentId;
    const newDesgId = newDesignation || designationId;

    // Insert the rejoin record (status='completed' since admin-initiated)
    try {
      await db.$executeRawUnsafe(
        `INSERT INTO "Rejoin"
           ("id", "employeeId", "previousEmployeeId", "rejoinDate",
            "newDepartmentId", "newDesignationId", "newEmployeeCode",
            "employmentType", "reportingManager",
            "serviceContinuity", "leaveBalanceCarryForward", "gratuityContinuity",
            "rejoinReason", "hrComments",
            "status", "submittedById", "approvedById", "approvedAt", "createdAt", "updatedAt")
         VALUES
           ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'completed', $15, $15, NOW(), NOW(), NOW())`,
        rejoinId,
        targetEmployeeId,
        previousEmployeeId || targetEmployeeId,
        rejoinDate ? new Date(rejoinDate) : new Date(),
        newDeptId || null,
        newDesgId || null,
        newEmployeeCode || null,
        employmentType || null,
        reportingManager || null,
        serviceContinuity || 'new',
        Boolean(leaveBalanceCarryForward),
        Boolean(gratuityContinuity),
        rejoinReason || null,
        hrComments || null,
        submittedById,
      );
    } catch (insertErr) {
      console.error('[Rejoin POST] insert failed:', insertErr);
      return NextResponse.json(
        { error: 'Failed to create rejoin record', details: String(insertErr) },
        { status: 500, headers: corsHeaders() }
      );
    }

    // Update employee: status='active', new department/designation/DOJ
    try {
      const setClauses: string[] = [`"status" = 'active'`, `"updatedAt" = NOW()`];
      const updParams: unknown[] = [targetEmployeeId];
      if (newDeptId) {
        updParams.push(newDeptId);
        setClauses.push(`"departmentId" = $${updParams.length}`);
      }
      if (newDesgId) {
        updParams.push(newDesgId);
        setClauses.push(`"designationId" = $${updParams.length}`);
      }
      if (rejoinDate) {
        updParams.push(new Date(rejoinDate));
        setClauses.push(`"dateOfJoining" = $${updParams.length}`);
      }
      if (newEmployeeCode) {
        updParams.push(newEmployeeCode);
        setClauses.push(`"employeeId" = $${updParams.length}`);
      }
      await db.$executeRawUnsafe(
        `UPDATE "Employee" SET ${setClauses.join(', ')} WHERE "id" = $1`,
        ...updParams,
      );
    } catch (e) {
      console.error('[Rejoin POST] employee status update failed:', e);
    }

    // Reactivate the linked User account
    if (existingEmp.userId) {
      try {
        await db.$executeRawUnsafe(
          `UPDATE "User" SET "status" = 'active', "updatedAt" = NOW() WHERE "id" = $1`,
          existingEmp.userId,
        );
      } catch (e) {
        console.error('[Rejoin POST] user reactivation failed:', e);
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
            title: 'Employee Rejoin Processed',
            message: `${empName} has been re-joined effective ${rejoinDate || 'today'}. Employment type: ${employmentType || 'N/A'}.`,
            type: 'success',
            category: 'employee_lifecycle',
            link: '/employees/rejoin',
          }).catch(() => {});
        }

        // 2. Notify the employee
        if (existingEmp.userId) {
          await createNotification({
            tenantId,
            userId: existingEmp.userId,
            title: 'Welcome Back — Rejoin Processed',
            message: `Your rejoin has been processed successfully. Welcome back to the organization! Effective date: ${rejoinDate || 'today'}.`,
            type: 'success',
            category: 'employee_lifecycle',
            link: '/employees/rejoin',
          }).catch(() => {});
        }

        // 3. Notify the new reporting manager (if specified as a User)
        if (reportingManager && typeof reportingManager === 'string') {
          // Try to find a User whose name matches the reporting manager
          try {
            const mgrRows = await db.$queryRawUnsafe(
              `SELECT id FROM "User" WHERE LOWER(name) = LOWER($1) AND "tenantId" = $2 LIMIT 1`,
              reportingManager.trim(),
              tenantId,
            ) as any[];
            if (mgrRows?.[0]?.id) {
              await createNotification({
                tenantId,
                userId: mgrRows[0].id,
                title: 'New Direct Report — Rejoined Employee',
                message: `${empName} has rejoined and will be reporting to you. Please plan their onboarding.`,
                type: 'info',
                category: 'employee_lifecycle',
                link: '/employees/rejoin',
              }).catch(() => {});
            }
          } catch { /* non-critical */ }
        }
      }
    } catch (e) {
      console.error('[Rejoin POST] notification failed:', e);
    }

    // Audit log
    try {
      await db.auditLog.create({
        data: {
          userId: submittedById,
          action: 'CREATE_REJOIN',
          module: 'employees',
          details: `Rejoined employee ${existingEmp.employeeid || existingEmp.employeeId || targetEmployeeId}. Effective: ${rejoinDate || 'today'}`,
        },
      });
    } catch { /* non-critical */ }

    return NextResponse.json(
      {
        success: true,
        message: 'Rejoin processed successfully. Employee status updated to "Active". HR, Manager, and Employee have been notified.',
        rejoin: {
          id: rejoinId,
          employeeId: targetEmployeeId,
          employeeName: `${existingEmp.firstname || existingEmp.firstName || ''} ${existingEmp.lastname || existingEmp.lastName || ''}`.trim(),
          employeeCode: newEmployeeCode || existingEmp.employeeid || existingEmp.employeeId || '',
          rejoinDate,
          newDepartment: newDeptId,
          newDesignation: newDesgId,
          employmentType,
          reportingManager,
          status: 'completed',
          createdAt: new Date().toISOString(),
        },
      },
      { status: 201, headers: corsHeaders() }
    );
  } catch (error) {
    console.error('Create rejoin error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500, headers: corsHeaders() }
    );
  }
}
