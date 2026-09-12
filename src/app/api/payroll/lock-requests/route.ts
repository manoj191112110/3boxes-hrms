// REQ-PAY-07: Payroll Lock Period + Formal Unlock / Re-run requests
// -----------------------------------------------------------------
// Once a PayrollRun is CLOSED, the transaction lines are immutable.
// Any change requires a PayrollLockRequest which must be APPROVED by
// a Super Admin or Tenant Admin. The full request → review → execute
// trail is retained for audit.
//
// Workflow:
//   1. POST /api/payroll/lock-requests  → create a request (status=PENDING)
//   2. PATCH /api/payroll/lock-requests { id, action: 'approve'|'reject' }
//        - On approve: status=APPROVED, then the caller must re-run the
//          payroll (PayrollRun.runType=CORRECTION) and finally PATCH again
//          with action='execute' to mark EXECUTED + lock the run again.

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

// GET /api/payroll/lock-requests
//   ?payrollRunId=...
//   ?status=PENDING
//   ?requestedBy=...
export async function GET(request: NextRequest) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    const decoded = await verifyToken(token);
    if (!decoded) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });

    const { searchParams } = new URL(request.url);
    const payrollRunId = searchParams.get('payrollRunId');
    const status = searchParams.get('status');
    const requestedBy = searchParams.get('requestedBy');

    const where: Record<string, unknown> = {};
    if (payrollRunId) where.payrollRunId = payrollRunId;
    if (status) where.status = status;
    if (requestedBy) where.requestedBy = requestedBy;

    let requests: unknown[] = [];
    try {
      requests = await db.payrollLockRequest.findMany({
        where,
        include: {
          payrollRun: {
            select: {
              id: true, payrollPeriod: true, runType: true, runStatus: true,
              company: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: [{ requestedAt: 'desc' }],
        take: 200,
      });
    } catch (dbError: unknown) {
      console.error('DB error fetching lock requests:', dbError);
    }

    const arr = requests as Array<{ status: string }>;
    const summary = {
      total: arr.length,
      pending: arr.filter((r) => r.status === 'PENDING').length,
      approved: arr.filter((r) => r.status === 'APPROVED').length,
      rejected: arr.filter((r) => r.status === 'REJECTED').length,
      executed: arr.filter((r) => r.status === 'EXECUTED').length,
    };

    return Response.json({ data: requests, summary }, { headers: corsHeaders });
  } catch (error: unknown) {
    console.error('Error in /api/payroll/lock-requests GET:', error);
    return Response.json({ error: (error instanceof Error ? error.message : String(error)) }, { status: 500, headers: corsHeaders });
  }
}

// POST /api/payroll/lock-requests
//   body: { payrollRunId, requestType, reasonCategory, reasonText }
export async function POST(request: NextRequest) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    const decoded = await verifyToken(token);
    if (!decoded) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });

    const body = await request.json();
    if (!body.payrollRunId) return Response.json({ error: 'payrollRunId required' }, { status: 400, headers: corsHeaders });
    if (!body.requestType || !['UNLOCK_FOR_RERUN', 'UNLOCK_FOR_ADJUSTMENT', 'CORRECTION_RERUN'].includes(body.requestType)) {
      return Response.json({ error: 'Invalid requestType' }, { status: 400, headers: corsHeaders });
    }
    if (!body.reasonCategory || !['DATA_ERROR', 'SYSTEM_ERROR', 'STATUTORY_CHANGE', 'OTHER'].includes(body.reasonCategory)) {
      return Response.json({ error: 'Invalid reasonCategory' }, { status: 400, headers: corsHeaders });
    }
    if (!body.reasonText || body.reasonText.trim().length < 10) {
      return Response.json({ error: 'reasonText is required and must be at least 10 characters' }, { status: 400, headers: corsHeaders });
    }

    const run = await db.payrollRun.findUnique({ where: { id: body.payrollRunId } });
    if (!run) return Response.json({ error: 'Payroll run not found' }, { status: 404, headers: corsHeaders });

    if (run.runStatus !== 'CLOSED') {
      return Response.json({
        error: `Payroll run is not yet CLOSED (current status: ${run.runStatus}). Lock requests are only valid for CLOSED runs.`,
      }, { status: 400, headers: corsHeaders });
    }

    // Refuse if there's already a PENDING request for this run
    const existingPending = await db.payrollLockRequest.findFirst({
      where: { payrollRunId: body.payrollRunId, status: 'PENDING' },
    });
    if (existingPending) {
      return Response.json({ error: 'A PENDING lock request already exists for this run', data: existingPending }, { status: 409, headers: corsHeaders });
    }

    const created = await db.payrollLockRequest.create({
      data: {
        payrollRunId: body.payrollRunId,
        requestType: body.requestType,
        reasonCategory: body.reasonCategory,
        reasonText: body.reasonText.trim(),
        requestedBy: decoded.userId as string,
        status: 'PENDING',
      },
    });

    return Response.json({ data: created, message: 'Lock/unlock request submitted for review' }, { headers: corsHeaders });
  } catch (error: unknown) {
    console.error('Error in /api/payroll/lock-requests POST:', error);
    return Response.json({ error: (error instanceof Error ? error.message : String(error)) }, { status: 500, headers: corsHeaders });
  }
}

// PATCH /api/payroll/lock-requests
//   body: { id, action: 'approve'|'reject'|'execute', reviewComments? }
export async function PATCH(request: NextRequest) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    const decoded = await verifyToken(token);
    if (!decoded) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });

    const body = await request.json();
    if (!body.id) return Response.json({ error: 'Lock request id required' }, { status: 400, headers: corsHeaders });
    if (!['approve', 'reject', 'execute'].includes(body.action)) {
      return Response.json({ error: 'Invalid action (must be approve, reject, or execute)' }, { status: 400, headers: corsHeaders });
    }

    const lockReq = await db.payrollLockRequest.findUnique({ where: { id: body.id } });
    if (!lockReq) return Response.json({ error: 'Lock request not found' }, { status: 404, headers: corsHeaders });

    // Permission check — only super_admin / tenant_admin can approve
    if (body.action === 'approve' || body.action === 'reject') {
      if (!['super_admin', 'tenant_admin'].includes(decoded.role as string)) {
        return Response.json({ error: 'Only super_admin or tenant_admin can approve/reject lock requests' }, { status: 403, headers: corsHeaders });
      }
      if (lockReq.status !== 'PENDING') {
        return Response.json({ error: `Lock request is already ${lockReq.status}` }, { status: 409, headers: corsHeaders });
      }
    }

    if (body.action === 'execute' && lockReq.status !== 'APPROVED') {
      return Response.json({ error: 'Cannot execute a request that is not APPROVED' }, { status: 400, headers: corsHeaders });
    }

    let newStatus: string;
    let extraData: Record<string, unknown> = {};

    if (body.action === 'approve') {
      newStatus = 'APPROVED';
      extraData = {
        reviewedBy: decoded.userId as string,
        reviewedAt: new Date(),
        reviewComments: body.reviewComments || null,
      };
      // Re-open the payroll run for correction
      await db.payrollRun.update({
        where: { id: lockReq.payrollRunId },
        data: { runStatus: 'PROCESSING' },
      });
    } else if (body.action === 'reject') {
      newStatus = 'REJECTED';
      extraData = {
        reviewedBy: decoded.userId as string,
        reviewedAt: new Date(),
        reviewComments: body.reviewComments || body.reason || null,
      };
    } else {
      // execute
      newStatus = 'EXECUTED';
      extraData = { executedAt: new Date() };
      // Lock the run again
      await db.payrollRun.update({
        where: { id: lockReq.payrollRunId },
        data: { runStatus: 'CLOSED' },
      });
    }

    const updated = await db.payrollLockRequest.update({
      where: { id: body.id },
      data: { status: newStatus, ...extraData },
    });

    return Response.json({
      data: updated,
      message: `Lock request ${newStatus.toLowerCase()}`,
    }, { headers: corsHeaders });
  } catch (error: unknown) {
    console.error('Error in /api/payroll/lock-requests PATCH:', error);
    return Response.json({ error: (error instanceof Error ? error.message : String(error)) }, { status: 500, headers: corsHeaders });
  }
}
