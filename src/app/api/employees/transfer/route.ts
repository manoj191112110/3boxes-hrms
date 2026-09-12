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
 * GET /api/employees/transfer
 *
 * Returns transfer request records. Stored in the `Transfer` table
 * (auto-created via inline schema-sync on first call).
 *
 * Query params:
 *   ?employeeId=<id>  — filter by employee
 *   ?status=<status>  — filter by status (pending, approved, rejected, cancelled)
 *   ?page=<n>         — pagination (default 1)
 *   ?limit=<n>        — page size (default 20)
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

    // ─── Inline schema-sync for Transfer table ───
    try {
      const syncStatements = [
        `CREATE TABLE IF NOT EXISTS "Transfer" ("id" TEXT NOT NULL, "employeeId" TEXT NOT NULL, "fromDepartmentId" TEXT, "toDepartmentId" TEXT, "fromDesignationId" TEXT, "toDesignationId" TEXT, "fromBranchId" TEXT, "toBranchId" TEXT, "transferDate" TIMESTAMP(3), "transferType" TEXT, "reason" TEXT, "reportingManagerId" TEXT, "comments" TEXT, "status" TEXT NOT NULL DEFAULT 'pending', "submittedById" TEXT, "approvedById" TEXT, "approvedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(), "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(), CONSTRAINT "Transfer_pkey" PRIMARY KEY ("id"))`,
        `CREATE INDEX IF NOT EXISTS "Transfer_employeeId_idx" ON "Transfer"("employeeId")`,
        `CREATE INDEX IF NOT EXISTS "Transfer_status_idx" ON "Transfer"("status")`,
      ];
      for (const sql of syncStatements) {
        try { await db.$executeRawUnsafe(sql); } catch { /* already exists */ }
      }
    } catch { /* non-fatal */ }

    // Build raw SQL query (more reliable than Prisma across tenant DBs that may
    // not have the Transfer model in their generated client)
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (employeeId) {
      params.push(employeeId);
      conditions.push(`"employeeId" = $${params.length}`);
    }
    if (status) {
      params.push(status);
      conditions.push(`"status" = $${params.length}`);
    }
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Count total
    let total = 0;
    try {
      const countRows = await db.$queryRawUnsafe(
        `SELECT COUNT(*)::int AS count FROM "Transfer" ${whereClause}`,
        ...params,
      ) as any[];
      total = countRows?.[0]?.count || 0;
    } catch (err) {
      console.error('[Transfer GET] count failed:', err);
    }

    // Fetch rows with employee + department + designation join
    let rows: any[] = [];
    try {
      const offset = (page - 1) * limit;
      const queryParams = [...params, limit, offset];
      rows = await db.$queryRawUnsafe(
        `SELECT t.*,
           e."firstName" AS "employeeFirstName",
           e."lastName"  AS "employeeLastName",
           e."employeeId" AS "employeeCode",
           fd."name" AS "fromDepartmentName",
           td."name" AS "toDepartmentName",
           fdes."title" AS "fromDesignationTitle",
           tdes."title" AS "toDesignationTitle",
           fb."name" AS "fromBranchName",
           tb."name" AS "toBranchName"
         FROM "Transfer" t
         LEFT JOIN "Employee" e ON e."id" = t."employeeId"
         LEFT JOIN "Department" fd ON fd."id" = t."fromDepartmentId"
         LEFT JOIN "Department" td ON td."id" = t."toDepartmentId"
         LEFT JOIN "Designation" fdes ON fdes."id" = t."fromDesignationId"
         LEFT JOIN "Designation" tdes ON tdes."id" = t."toDesignationId"
         LEFT JOIN "Branch" fb ON fb."id" = t."fromBranchId"
         LEFT JOIN "Branch" tb ON tb."id" = t."toBranchId"
         ${whereClause}
         ORDER BY t."createdAt" DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        ...queryParams,
      ) as any[];
    } catch (err) {
      console.error('[Transfer GET] query failed:', err);
      return NextResponse.json({
        transfers: [],
        pagination: { page, limit, total: 0, totalPages: 0 },
      }, { headers: corsHeaders() });
    }

    // Map rows to the TransferRecord shape expected by the UI
    const transfers = rows.map((r: any) => ({
      id: r.id,
      employeeId: r.employeeId,
      employeeName: `${r.employeeFirstName || ''} ${r.employeeLastName || ''}`.trim() || 'Unknown',
      employeeCode: r.employeeCode || '—',
      fromDepartment: r.fromDepartmentName || '—',
      toDepartment: r.toDepartmentName || '—',
      fromDesignation: r.fromDesignationTitle || '—',
      toDesignation: r.toDesignationTitle || '—',
      fromLocation: r.fromBranchName || '—',
      toLocation: r.toBranchName || '—',
      transferDate: r.transferDate,
      transferType: r.transferType || 'permanent',
      reason: r.reason || '',
      status: r.status,
      comments: r.comments || '',
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));

    return NextResponse.json(
      { transfers, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } },
      { headers: corsHeaders() }
    );
  } catch (error) {
    console.error('Get transfers error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders() }
    );
  }
}

/**
 * POST /api/employees/transfer
 *
 * Creates a transfer request record. Status starts as 'pending' and
 * requires HR/Admin approval before the employee's department/designation/branch
 * are actually updated.
 *
 * Side effects:
 *   1. Insert row into Transfer table
 *   2. Send notification to HR/Admin users in the same tenant
 *   3. Create audit log entry
 */
export async function POST(request: Request) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders() });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401, headers: corsHeaders() });

    const body = await request.json();
    const {
      employeeId,
      currentDepartment,
      currentDesignation,
      currentLocation,
      newDepartment,
      newDesignation,
      newLocation,
      transferDate,
      transferType,
      reason,
      reportingManager,
      comments,
    } = body;

    if (!employeeId) {
      return NextResponse.json(
        { error: 'Employee ID is required' },
        { status: 400, headers: corsHeaders() }
      );
    }
    if (!newDepartment) {
      return NextResponse.json(
        { error: 'New Department is required' },
        { status: 400, headers: corsHeaders() }
      );
    }

    // ─── Inline schema-sync for Transfer table ───
    try {
      const syncStatements = [
        `CREATE TABLE IF NOT EXISTS "Transfer" ("id" TEXT NOT NULL, "employeeId" TEXT NOT NULL, "fromDepartmentId" TEXT, "toDepartmentId" TEXT, "fromDesignationId" TEXT, "toDesignationId" TEXT, "fromBranchId" TEXT, "toBranchId" TEXT, "transferDate" TIMESTAMP(3), "transferType" TEXT, "reason" TEXT, "reportingManagerId" TEXT, "comments" TEXT, "status" TEXT NOT NULL DEFAULT 'pending', "submittedById" TEXT, "approvedById" TEXT, "approvedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(), "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(), CONSTRAINT "Transfer_pkey" PRIMARY KEY ("id"))`,
        `CREATE INDEX IF NOT EXISTS "Transfer_employeeId_idx" ON "Transfer"("employeeId")`,
        `CREATE INDEX IF NOT EXISTS "Transfer_status_idx" ON "Transfer"("status")`,
      ];
      for (const sql of syncStatements) {
        try { await db.$executeRawUnsafe(sql); } catch { /* already exists */ }
      }
    } catch { /* non-fatal */ }

    const transferId = `trf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const submittedById = decoded.userId as string;

    // Insert the transfer record
    try {
      await db.$executeRawUnsafe(
        `INSERT INTO "Transfer"
           ("id", "employeeId", "fromDepartmentId", "toDepartmentId",
            "fromDesignationId", "toDesignationId", "fromBranchId", "toBranchId",
            "transferDate", "transferType", "reason", "reportingManagerId",
            "comments", "status", "submittedById", "createdAt", "updatedAt")
         VALUES
           ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'pending', $14, NOW(), NOW())`,
        transferId,
        employeeId,
        currentDepartment || null,
        newDepartment,
        currentDesignation || null,
        newDesignation || null,
        currentLocation || null,
        newLocation || null,
        transferDate ? new Date(transferDate) : new Date(),
        transferType || 'permanent',
        reason || null,
        reportingManager || null,
        comments || null,
        submittedById,
      );
    } catch (insertErr) {
      console.error('[Transfer POST] insert failed:', insertErr);
      return NextResponse.json(
        { error: 'Failed to create transfer record', details: String(insertErr) },
        { status: 500, headers: corsHeaders() }
      );
    }

    // Fetch the inserted row + employee info for the response
    let transferRow: any = null;
    try {
      const rows = await db.$queryRawUnsafe(
        `SELECT t.*, e."firstName", e."lastName", e."employeeId" AS "employeeCode"
         FROM "Transfer" t
         LEFT JOIN "Employee" e ON e."id" = t."employeeId"
         WHERE t."id" = $1`,
        transferId,
      ) as any[];
      if (rows?.[0]) transferRow = rows[0];
    } catch { /* non-critical */ }

    // Send notifications to HR/Admin users in the tenant
    try {
      // Find HR/Admin users (role: tenant_admin, admin) in the same tenant
      const tenantId = (decoded as any).tenantId;
      if (tenantId) {
        const adminUsers = await db.user.findMany({
          where: {
            tenantId,
            role: { in: ['tenant_admin', 'admin'] },
            status: 'active',
          },
          select: { id: true },
        }).catch(() => []);

        const empName = transferRow ? `${transferRow.firstName || ''} ${transferRow.lastName || ''}`.trim() : 'an employee';
        for (const admin of adminUsers) {
          await createNotification({
            tenantId,
            userId: admin.id,
            title: 'New Transfer Request Submitted',
            message: `A transfer request has been submitted for ${empName}. Please review and approve/reject.`,
            type: 'info',
            category: 'employee_lifecycle',
            link: '/employees/transfer',
          }).catch(() => {});
        }
      }
    } catch (e) {
      console.error('[Transfer POST] notification failed:', e);
    }

    // Notify the employee's reporting manager if specified
    try {
      if (reportingManager) {
        const tenantId = (decoded as any).tenantId;
        if (tenantId) {
          await createNotification({
            tenantId,
            userId: reportingManager,
            title: 'Transfer Request Requires Your Review',
            message: `A transfer request has been submitted for an employee reporting to you. Please review.`,
            type: 'info',
            category: 'employee_lifecycle',
            link: '/employees/transfer',
          }).catch(() => {});
        }
      }
    } catch (e) {
      console.error('[Transfer POST] manager notification failed:', e);
    }

    // Audit log
    try {
      await db.auditLog.create({
        data: {
          userId: submittedById,
          action: 'CREATE_TRANSFER_REQUEST',
          module: 'employees',
          details: `Created transfer request for employee ${employeeId} → dept ${newDepartment}, desg ${newDesignation || 'N/A'}, branch ${newLocation || 'N/A'}`,
        },
      });
    } catch { /* non-critical */ }

    return NextResponse.json(
      {
        success: true,
        message: 'Transfer request submitted successfully. HR/Admin has been notified for approval.',
        transfer: {
          id: transferId,
          employeeId,
          employeeName: transferRow ? `${transferRow.firstName || ''} ${transferRow.lastName || ''}`.trim() : '',
          employeeCode: transferRow?.employeeCode || '',
          fromDepartment: currentDepartment || null,
          toDepartment: newDepartment,
          transferDate,
          transferType: transferType || 'permanent',
          reason: reason || '',
          status: 'pending',
          createdAt: new Date().toISOString(),
        },
      },
      { status: 201, headers: corsHeaders() }
    );
  } catch (error) {
    console.error('Create transfer error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500, headers: corsHeaders() }
    );
  }
}
