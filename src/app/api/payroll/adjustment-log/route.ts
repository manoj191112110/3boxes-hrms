// REQ-SEC-PAY-03: Immutable Audit Trail for Manual Payroll Adjustments
// --------------------------------------------------------------------
// Every manual bonus, tax override, deduction override, etc. writes exactly
// one row to PayrollAdjustmentLog. Rows are IMMUTABLE — no PATCH/DELETE
// route is exposed (the schema itself doesn't even include an updatedAt
// field, only createdAt).
//
// Reason text is MANDATORY — the API refuses to log an adjustment without
// a substantive reason (>=10 chars).
//
// GET endpoint supports rich filtering so auditors can reconstruct any
// period's adjustments and see Who / What / When / Why / Before / After.

import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { getTokenFromHeaders, verifyToken } from '@/lib/auth';
import { NextRequest } from 'next/server';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

// GET /api/payroll/adjustment-log
//   ?payrollRunId=...
//   ?employeeId=...
//   ?componentCode=...
//   ?adjustedBy=...
//   ?adjustmentType=...
//   ?from=2026-01-01  (adjustedAt >=)
//   ?to=2026-12-31    (adjustedAt <=)
export async function GET(request: NextRequest) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    const decoded = await verifyToken(token);
    if (!decoded) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });

    const { searchParams } = new URL(request.url);
    const payrollRunId = searchParams.get('payrollRunId');
    const employeeId = searchParams.get('employeeId');
    const componentCode = searchParams.get('componentCode');
    const adjustedBy = searchParams.get('adjustedBy');
    const adjustmentType = searchParams.get('adjustmentType');
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    const where: Record<string, unknown> = {};
    if (payrollRunId) where.payrollRunId = payrollRunId;
    if (employeeId) where.employeeId = employeeId;
    if (componentCode) where.componentCode = componentCode;
    if (adjustedBy) where.adjustedBy = adjustedBy;
    if (adjustmentType) where.adjustmentType = adjustmentType;

    const adjustedAt: Record<string, unknown> = {};
    if (from) adjustedAt.gte = new Date(from);
    if (to) adjustedAt.lte = new Date(to);
    if (Object.keys(adjustedAt).length > 0) where.adjustedAt = adjustedAt;

    let logs: unknown[] = [];
    try {
      logs = await db.payrollAdjustmentLog.findMany({
        where,
        include: {
          employee: {
            select: { id: true, employeeId: true, firstName: true, lastName: true, email: true },
          },
        },
        orderBy: [{ adjustedAt: 'desc' }],
        take: 500,
      });
    } catch (dbError: unknown) {
      console.error('DB error fetching adjustment logs:', dbError);
    }

    const arr = logs as Array<{ adjustmentType: string; reasonCategory: string; delta?: number | null }>;
    const summary = {
      total: arr.length,
      totalDelta: arr.reduce((s, l) => s + (l.delta || 0), 0),
      byType: arr.reduce((acc, l) => {
        acc[l.adjustmentType] = (acc[l.adjustmentType] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      byCategory: arr.reduce((acc, l) => {
        acc[l.reasonCategory] = (acc[l.reasonCategory] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    };

    return Response.json({ data: logs, summary }, { headers: corsHeaders });
  } catch (error: unknown) {
    console.error('Error in /api/payroll/adjustment-log GET:', error);
    return Response.json({ error: (error instanceof Error ? error.message : String(error)) }, { status: 500, headers: corsHeaders });
  }
}

// POST /api/payroll/adjustment-log
//   body: {
//     payrollRunId?, employeeId, transactionLineId?, componentCode,
//     adjustmentType, beforeValue?, afterValue?, currencyCode?,
//     reasonText (MANDATORY), reasonCategory?, approvedBy?
//   }
// Creates an immutable audit record. The caller (a payroll adjustment
// API) is responsible for ALSO updating the underlying transaction line —
// this endpoint ONLY writes the log row.
//
// delta is auto-computed as (afterValue - beforeValue) when both are provided.
export async function POST(request: NextRequest) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    const decoded = await verifyToken(token);
    if (!decoded) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });

    const body = await request.json();
    if (!body.employeeId) return Response.json({ error: 'employeeId required' }, { status: 400, headers: corsHeaders });
    if (!body.componentCode) return Response.json({ error: 'componentCode required' }, { status: 400, headers: corsHeaders });
    if (!body.adjustmentType || !['MANUAL_BONUS', 'TAX_OVERRIDE', 'DEDUCTION_OVERRIDE', 'RATE_OVERRIDE', 'INPUT_ADJUSTMENT', 'REVERSAL'].includes(body.adjustmentType)) {
      return Response.json({ error: 'Invalid adjustmentType' }, { status: 400, headers: corsHeaders });
    }
    if (!body.reasonText || body.reasonText.trim().length < 10) {
      return Response.json({ error: 'reasonText is MANDATORY and must be at least 10 characters (per REQ-SEC-PAY-03)' }, { status: 400, headers: corsHeaders });
    }

    // Auto-compute delta
    let delta: number | null = null;
    if (typeof body.beforeValue === 'number' && typeof body.afterValue === 'number') {
      delta = body.afterValue - body.beforeValue;
    } else if (typeof body.delta === 'number') {
      delta = body.delta;
    }

    // Capture request metadata for forensic trail
    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null;
    const userAgent = request.headers.get('user-agent') || null;

    const created = await db.payrollAdjustmentLog.create({
      data: {
        payrollRunId: body.payrollRunId || null,
        employeeId: body.employeeId,
        transactionLineId: body.transactionLineId || null,
        componentCode: body.componentCode,
        adjustmentType: body.adjustmentType,
        beforeValue: typeof body.beforeValue === 'number' ? body.beforeValue : null,
        afterValue: typeof body.afterValue === 'number' ? body.afterValue : null,
        delta,
        currencyCode: body.currencyCode || 'INR',
        reasonText: body.reasonText.trim(),
        reasonCategory: body.reasonCategory || 'MANUAL',
        adjustedBy: decoded.userId as string,
        approvedBy: body.approvedBy || null,
        ipAddress,
        userAgent,
      },
    });

    return Response.json({ data: created, message: 'Adjustment logged (immutable)' }, { status: 201, headers: corsHeaders });
  } catch (error: unknown) {
    console.error('Error in /api/payroll/adjustment-log POST:', error);
    return Response.json({ error: (error instanceof Error ? error.message : String(error)) }, { status: 500, headers: corsHeaders });
  }
}

// IMPORTANT: No PATCH or DELETE route is exposed.
// The audit log is IMMUTABLE per REQ-SEC-PAY-03.
