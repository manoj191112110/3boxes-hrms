import { NextResponse } from 'next/server';
import { getDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';

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
 * GET /api/employees/probation
 *
 * Returns probation review records. We store probation reviews as
 * PerformanceReview entries with reviewCycle='Probation'. This avoids
 * creating a separate Probation table while keeping the data model clean.
 *
 * Query params:
 *   ?employeeId=<id>  — filter by employee
 *   ?status=<status>  — filter by status (pending, in_progress, completed)
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

    // ─── Inline schema-sync for PerformanceReview table ───
    // Ensures all columns exist (fixes P2022 on tenant DBs that haven't been synced)
    try {
      const syncStatements = [
        `CREATE TABLE IF NOT EXISTS "PerformanceReview" ("id" TEXT NOT NULL, "employeeId" TEXT NOT NULL, "reviewCycle" TEXT NOT NULL, "reviewPeriod" TEXT, "reviewerId" TEXT, "rating" DOUBLE PRECISION NOT NULL DEFAULT 0, "goalsRating" DOUBLE PRECISION NOT NULL DEFAULT 0, "skillsRating" DOUBLE PRECISION NOT NULL DEFAULT 0, "behaviorRating" DOUBLE PRECISION NOT NULL DEFAULT 0, "overallRating" DOUBLE PRECISION NOT NULL DEFAULT 0, "comments" TEXT, "strengths" TEXT, "improvements" TEXT, "status" TEXT NOT NULL DEFAULT 'pending', "reviewDate" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(), "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(), CONSTRAINT "PerformanceReview_pkey" PRIMARY KEY ("id"))`,
        `CREATE INDEX IF NOT EXISTS "PerformanceReview_employeeId_idx" ON "PerformanceReview"("employeeId")`,
      ];
      for (const sql of syncStatements) {
        try { await db.$executeRawUnsafe(sql); } catch { /* already exists */ }
      }
    } catch { /* non-fatal */ }

    const where: Record<string, unknown> = {
      reviewCycle: 'Probation',
    };
    if (employeeId) where.employeeId = employeeId;
    if (status) where.status = status;

    // ─── Use raw SQL for maximum compatibility across tenant DBs ───
    // Previously this used db.performanceReview.findMany() which can fail
    // silently on tenant DBs where the Prisma client hasn't been regenerated
    // with the latest schema. Raw SQL is more reliable.
    let reviews: any[] = [];
    let total = 0;
    try {
      // Build raw SQL query
      const conditions: string[] = [`pr."reviewCycle" = 'Probation'`];
      const params: unknown[] = [];
      if (employeeId) {
        params.push(employeeId);
        conditions.push(`pr."employeeId" = $${params.length}`);
      }
      if (status) {
        params.push(status);
        conditions.push(`pr."status" = $${params.length}`);
      }
      const whereClause = `WHERE ${conditions.join(' AND ')}`;

      // Count total
      try {
        const countRows = await db.$queryRawUnsafe(
          `SELECT COUNT(*)::int AS count FROM "PerformanceReview" pr ${whereClause}`,
          ...params,
        ) as any[];
        total = countRows?.[0]?.count || 0;
      } catch (countErr) {
        console.error('[Probation GET] count failed:', countErr);
        total = 0;
      }

      // Fetch rows with employee join
      const offset = (page - 1) * limit;
      const queryParams = [...params, limit, offset];
      reviews = await db.$queryRawUnsafe(
        `SELECT pr.*,
           e."firstName" AS "empFirstName",
           e."lastName"  AS "empLastName",
           e."employeeId" AS "empCode",
           e."avatar" AS "empAvatar",
           d."name" AS "deptName",
           des."title" AS "desgTitle"
         FROM "PerformanceReview" pr
         LEFT JOIN "Employee" e ON e."id" = pr."employeeId"
         LEFT JOIN "Department" d ON d."id" = e."departmentId"
         LEFT JOIN "Designation" des ON des."id" = e."designationId"
         ${whereClause}
         ORDER BY pr."createdAt" DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        ...queryParams,
      ) as any[];
    } catch (queryErr) {
      const errObj = queryErr as { code?: string; message?: string };
      console.error('[Probation GET] query failed:', errObj);
      // If the table doesn't exist or query fails, return empty list instead of erroring
      return NextResponse.json({
        probations: [],
        pagination: { page, limit, total: 0, totalPages: 0 },
        _debug: { error: errObj.message, code: errObj.code },
      }, { headers: corsHeaders() });
    }

    // Map PerformanceReview records to the probation shape expected by the UI
    const probations = reviews.map(r => {
      const review = (r as any);
      // Parse comments as JSON if it looks like JSON (we store the full form as JSON)
      let probationData: any = {};
      try {
        if (review.comments && review.comments.startsWith('{')) {
          probationData = JSON.parse(review.comments);
        }
      } catch { /* not JSON — treat as plain comment */ }

      // Build employee name from the joined employee columns
      const empFirstName = review.empFirstName || review.employee?.firstName || '';
      const empLastName = review.empLastName || review.employee?.lastName || '';
      const employeeName = `${empFirstName} ${empLastName}`.trim() || 'Unknown';
      const employeeCode = review.empCode || review.employee?.employeeId || '—';
      const departmentName = review.deptName || review.employee?.department?.name || '—';
      const designationTitle = review.desgTitle || review.employee?.designation?.title || '—';

      // Calculate probation end date from start date + period + extension
      let endDate: string | null = null;
      const startDateStr = probationData.probationStartDate || null;
      if (startDateStr && probationData.probationPeriod) {
        try {
          const start = new Date(startDateStr);
          const end = new Date(start);
          end.setMonth(end.getMonth() + Number(probationData.probationPeriod) + Number(probationData.extensionPeriod || 0));
          endDate = end.toISOString();
        } catch { /* invalid date */ }
      }

      return {
        id: review.id,
        employeeId: review.employeeId,
        employee: review.employee || (empFirstName ? {
          id: review.employeeId,
          firstName: empFirstName,
          lastName: empLastName,
          employeeId: employeeCode,
          avatar: review.empAvatar,
          department: { name: departmentName },
          designation: { title: designationTitle },
        } : null),
        // UI-expected fields (ProbationRecord interface)
        employeeName,
        employeeCode,
        startDate: startDateStr,
        endDate,
        probationPeriod: Number(probationData.probationPeriod) || 0,
        // Probation-specific fields (stored in comments JSON)
        probationStartDate: probationData.probationStartDate || null,
        extensionPeriod: probationData.extensionPeriod || 0,
        performanceRating: probationData.performanceRating || review.overallRating || 0,
        reviewComments: probationData.reviewComments || '',
        kpiStatus: probationData.kpiStatus || 'pending',
        decision: probationData.decision || 'pending',
        effectiveDate: probationData.effectiveDate || null,
        confirmationLetter: probationData.confirmationLetter || null,
        // Workflow fields
        workflowStage: probationData.workflowStage || 'hr_review',
        hrDecision: probationData.hrDecision || null,
        hrComments: probationData.hrComments || '',
        hrActionDate: probationData.hrActionDate || null,
        mdAction: probationData.mdAction || null,
        mdComments: probationData.mdComments || '',
        mdActionDate: probationData.mdActionDate || null,
        autoCreated: probationData.autoCreated || false,
        // Extra fields for richer display
        department: departmentName,
        designation: designationTitle,
        // Standard review fields
        status: review.status,
        reviewDate: review.reviewDate,
        createdAt: review.createdAt,
        updatedAt: review.updatedAt,
      };
    });

    return NextResponse.json(
      { probations, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } },
      { headers: corsHeaders() }
    );
  } catch (error) {
    console.error('Get probations error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500, headers: corsHeaders() }
    );
  }
}

/**
 * POST /api/employees/probation
 *
 * Creates a probation review record. We store this as a PerformanceReview
 * with reviewCycle='Probation'. The full probation form data (probationStartDate,
 * probationPeriod, extensionPeriod, performanceRating, reviewComments, kpiStatus,
 * decision, effectiveDate, confirmationLetter) is serialized as JSON in the
 * `comments` field so it can be retrieved later.
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
      probationStartDate,
      probationPeriod,
      extensionPeriod,
      performanceRating,
      reviewComments,
      kpiStatus,
      decision,
      effectiveDate,
      confirmationLetter,
    } = body;

    if (!employeeId) {
      return NextResponse.json(
        { error: 'Employee ID is required' },
        { status: 400, headers: corsHeaders() }
      );
    }

    // ─── Inline schema-sync for PerformanceReview table ───
    try {
      const syncStatements = [
        `CREATE TABLE IF NOT EXISTS "PerformanceReview" ("id" TEXT NOT NULL, "employeeId" TEXT NOT NULL, "reviewCycle" TEXT NOT NULL, "reviewPeriod" TEXT, "reviewerId" TEXT, "rating" DOUBLE PRECISION NOT NULL DEFAULT 0, "goalsRating" DOUBLE PRECISION NOT NULL DEFAULT 0, "skillsRating" DOUBLE PRECISION NOT NULL DEFAULT 0, "behaviorRating" DOUBLE PRECISION NOT NULL DEFAULT 0, "overallRating" DOUBLE PRECISION NOT NULL DEFAULT 0, "comments" TEXT, "strengths" TEXT, "improvements" TEXT, "status" TEXT NOT NULL DEFAULT 'pending', "reviewDate" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(), "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(), CONSTRAINT "PerformanceReview_pkey" PRIMARY KEY ("id"))`,
        `CREATE INDEX IF NOT EXISTS "PerformanceReview_employeeId_idx" ON "PerformanceReview"("employeeId")`,
      ];
      for (const sql of syncStatements) {
        try { await db.$executeRawUnsafe(sql); } catch { /* already exists */ }
      }
    } catch { /* non-fatal */ }

    // Serialize the full probation form data as JSON in the comments field
    // so we can retrieve all probation-specific fields later
    const probationData = JSON.stringify({
      probationStartDate,
      probationPeriod,
      extensionPeriod: extensionPeriod || 0,
      performanceRating: performanceRating || 0,
      reviewComments: reviewComments || '',
      kpiStatus: kpiStatus || 'pending',
      decision: decision || 'pending',
      effectiveDate: effectiveDate || null,
      confirmationLetter: confirmationLetter || null,
    });

    // Map decision → submitted status
    // When an employee/manager submits a probation review, it goes to HR/Admin
    // for approval. The status is always 'pending' on submission.
    // HR/Admin can then approve (confirm), extend, or reject via the [id] route.
    let status = 'pending'; // Always pending on submission — goes to HR for review

    const review = await db.performanceReview.create({
      data: {
        employeeId,
        reviewCycle: 'Probation',
        reviewPeriod: probationPeriod ? `Probation (${probationPeriod} months)` : 'Probation',
        reviewerId: decoded.userId as string,
        rating: performanceRating || 0,
        overallRating: performanceRating || 0,
        comments: probationData,
        strengths: null,
        improvements: null,
        status, // 'pending' — submitted for HR review
        reviewDate: effectiveDate ? new Date(effectiveDate) : new Date(),
      },
      include: {
        employee: {
          select: { firstName: true, lastName: true, employeeId: true },
        },
      },
    }).catch((createErr: { code?: string; message?: string }) => {
      console.error('[Probation POST] create failed:', createErr);
      throw new Error(`Failed to save probation review: ${createErr.message || 'Unknown error'} (Code: ${createErr.code || 'N/A'})`);
    });

    // Log to audit
    try {
      await db.auditLog.create({
        data: {
          userId: decoded.userId as string,
          action: 'CREATE_PROBATION_REVIEW',
          module: 'employees',
          details: `Created probation review for ${(review as any).employee?.firstName} ${(review as any).employee?.lastName} - Decision: ${decision}`,
        },
      });
    } catch { /* non-critical */ }

    return NextResponse.json(
      {
        success: true,
        message: 'Probation review submitted successfully. It has been sent to HR/Admin for approval.',
        probation: {
          id: (review as any).id,
          employeeId,
          probationStartDate,
          probationPeriod,
          extensionPeriod: extensionPeriod || 0,
          performanceRating: performanceRating || 0,
          reviewComments: reviewComments || '',
          kpiStatus: kpiStatus || 'pending',
          decision: decision || 'pending',
          effectiveDate,
          confirmationLetter,
          status: (review as any).status,
          createdAt: (review as any).createdAt,
        },
      },
      { status: 201, headers: corsHeaders() }
    );
  } catch (error) {
    console.error('Create probation error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown',
      },
      { status: 500, headers: corsHeaders() }
    );
  }
}
