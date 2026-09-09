// REQ-7.2 + REQ-SEC-PAY-02: Payroll Approval Workflow + Segregation of Duties
// ---------------------------------------------------------------------------
// Lifecycle:
//   1. PayrollRun moves OPEN → INPUT_COLLECTION → PROCESSING → REVIEW.
//   2. While in REVIEW, the run is "pending approval". The user who
//      initiated the run (initiatedBy) CANNOT approve it (SoD).
//   3. A Tenant Admin / Super Admin / Finance Controller creates a
//      PayrollApproval row with approvalStage = DISBURSEMENT_APPROVAL.
//   4. On POST /approve, the API:
//        a) Verifies the approver is NOT the same user as requestedBy.
//        b) Verifies the approver's role matches approverRole.
//        c) Sets the approval status to APPROVED.
//        d) Advances the PayrollRun.runStatus to APPROVED → (then DISBURSED
//           once the bank file is generated).
//   5. On POST /reject, the API records the rejection reason and the run
//      goes back to PROCESSING for correction.
//
// SoD is enforced at TWO layers:
//   • sodConflictFlag — set on the PayrollApproval row at approval time
//     (proves the check was performed even if roles change later)
//   • Runtime check — the API refuses to approve if requestedBy == approver

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

// GET /api/payroll/approvals
//   ?payrollRunId=...
//   ?status=PENDING
//   ?approverRole=tenant_admin
//   ?pendingForMe=true  → approvals waiting for the current user's role
export async function GET(request: NextRequest) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    const decoded = await verifyToken(token);
    if (!decoded) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });

    const { searchParams } = new URL(request.url);
    const payrollRunId = searchParams.get('payrollRunId');
    const status = searchParams.get('status');
    const approverRole = searchParams.get('approverRole');
    const pendingForMe = searchParams.get('pendingForMe') === 'true';

    const where: Record<string, unknown> = {};
    if (payrollRunId) where.payrollRunId = payrollRunId;
    if (status) where.status = status;
    if (approverRole) where.approverRole = approverRole;
    if (pendingForMe && decoded.role) {
      where.status = 'PENDING';
      where.approverRole = decoded.role as string;
    }

    let approvals: unknown[] = [];
    try {
      approvals = await db.payrollApproval.findMany({
        where,
        include: {
          payrollRun: {
            select: {
              id: true, payrollPeriod: true, runType: true, runStatus: true,
              totalNetPay: true, totalEmployees: true, currencyCode: true,
              company: { select: { id: true, name: true, country: true } },
            },
          },
        },
        orderBy: [{ requestedAt: 'desc' }],
        take: 200,
      });
    } catch (dbError: unknown) {
      console.error('DB error fetching approvals:', dbError);
    }

    const arr = approvals as Array<{ status: string; approverRole: string; sodConflictFlag: boolean }>;
    const summary = {
      total: arr.length,
      pending: arr.filter((a) => a.status === 'PENDING').length,
      approved: arr.filter((a) => a.status === 'APPROVED').length,
      rejected: arr.filter((a) => a.status === 'REJECTED').length,
      sodConflicts: arr.filter((a) => a.sodConflictFlag).length,
    };

    return Response.json({ data: approvals, summary }, { headers: corsHeaders });
  } catch (error: unknown) {
    console.error('Error in /api/payroll/approvals GET:', error);
    return Response.json({ error: (error instanceof Error ? error.message : String(error)) }, { status: 500, headers: corsHeaders });
  }
}

// POST /api/payroll/approvals
//   body: { payrollRunId, approvalStage, approverRole, approvalNotes? }
// Creates a PENDING approval request for a payroll run.
export async function POST(request: NextRequest) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    const decoded = await verifyToken(token);
    if (!decoded) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });

    const body = await request.json();
    if (!body.payrollRunId) return Response.json({ error: 'payrollRunId required' }, { status: 400, headers: corsHeaders });
    if (!body.approvalStage) return Response.json({ error: 'approvalStage required' }, { status: 400, headers: corsHeaders });
    if (!['CALCULATION_REVIEW', 'DISBURSEMENT_APPROVAL', 'POST_DISBURSEMENT_AUDIT'].includes(body.approvalStage)) {
      return Response.json({ error: 'Invalid approvalStage' }, { status: 400, headers: corsHeaders });
    }

    const run = await db.payrollRun.findUnique({ where: { id: body.payrollRunId } });
    if (!run) return Response.json({ error: 'Payroll run not found' }, { status: 404, headers: corsHeaders });

    // Allow tenant_admin / super_admin / finance_controller as approver roles
    const approverRole = body.approverRole || decoded.role || 'tenant_admin';
    if (!['tenant_admin', 'super_admin', 'finance_controller'].includes(approverRole)) {
      return Response.json({ error: 'Invalid approver role' }, { status: 400, headers: corsHeaders });
    }

    // Check for existing PENDING approval for the same stage
    const existing = await db.payrollApproval.findFirst({
      where: { payrollRunId: body.payrollRunId, approvalStage: body.approvalStage, status: 'PENDING' },
    });
    if (existing) {
      return Response.json({ error: 'A PENDING approval already exists for this stage', data: existing }, { status: 409, headers: corsHeaders });
    }

    const created = await db.payrollApproval.create({
      data: {
        payrollRunId: body.payrollRunId,
        approvalStage: body.approvalStage,
        requestedBy: decoded.userId as string,
        approverRole,
        approvalNotes: body.approvalNotes || null,
        status: 'PENDING',
      },
    });

    // Advance run status to REVIEW if it was PROCESSING
    if (run.runStatus === 'PROCESSING' || run.runStatus === 'INPUT_COLLECTION') {
      await db.payrollRun.update({
        where: { id: body.payrollRunId },
        data: { runStatus: 'REVIEW' },
      });
    }

    return Response.json({ data: created, message: 'Approval request created' }, { headers: corsHeaders });
  } catch (error: unknown) {
    console.error('Error in /api/payroll/approvals POST:', error);
    return Response.json({ error: (error instanceof Error ? error.message : String(error)) }, { status: 500, headers: corsHeaders });
  }
}

// PATCH /api/payroll/approvals
//   body: { id, action: 'approve' | 'reject', notes? }
// Performs the SoD check and applies the decision.
export async function PATCH(request: NextRequest) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    const decoded = await verifyToken(token);
    if (!decoded) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });

    const body = await request.json();
    if (!body.id) return Response.json({ error: 'Approval id required' }, { status: 400, headers: corsHeaders });
    if (!['approve', 'reject'].includes(body.action)) {
      return Response.json({ error: 'Invalid action (must be approve or reject)' }, { status: 400, headers: corsHeaders });
    }

    const approval = await db.payrollApproval.findUnique({ where: { id: body.id } });
    if (!approval) return Response.json({ error: 'Approval not found' }, { status: 404, headers: corsHeaders });
    if (approval.status !== 'PENDING') {
      return Response.json({ error: `Approval already ${approval.status}` }, { status: 409, headers: corsHeaders });
    }

    // ─── SoD ENFORCEMENT (REQ-SEC-PAY-02) ───
    // The user who REQUESTED the approval cannot APPROVE it.
    // The user who INITIATED the payroll run also cannot approve it.
    const run = await db.payrollRun.findUnique({ where: { id: approval.payrollRunId } });
    const sodConflict = approval.requestedBy === (decoded.userId as string) ||
      (run?.initiatedBy && run.initiatedBy === (decoded.userId as string));

    if (sodConflict && body.action === 'approve') {
      // Mark the conflict and refuse
      await db.payrollApproval.update({
        where: { id: body.id },
        data: {
          sodConflictFlag: true,
          sodCheckedAt: new Date(),
        },
      });
      return Response.json({
        error: 'Segregation of Duties violation: the user who requested or initiated this payroll cannot approve it.',
        sodConflict: true,
      }, { status: 403, headers: corsHeaders });
    }

    // Also verify role match
    if (decoded.role && decoded.role !== approval.approverRole && decoded.role !== 'super_admin') {
      return Response.json({
        error: `Role mismatch: this approval requires role '${approval.approverRole}', your role is '${decoded.role}'`,
      }, { status: 403, headers: corsHeaders });
    }

    const newStatus = body.action === 'approve' ? 'APPROVED' : 'REJECTED';
    const updated = await db.payrollApproval.update({
      where: { id: body.id },
      data: {
        status: newStatus,
        approverUserId: decoded.userId as string,
        approvedAt: new Date(),
        approvalNotes: body.notes || null,
        rejectionReason: body.action === 'reject' ? (body.reason || body.notes || 'Rejected by approver') : null,
        sodConflictFlag: false,
        sodCheckedAt: new Date(),
      },
    });

    // Advance / revert the payroll run status
    if (body.action === 'approve') {
      // APPROVED → next stage is ACCOUNTING / DISBURSED
      const nextStatus = approval.approvalStage === 'DISBURSEMENT_APPROVAL' ? 'ACCOUNTING' : 'APPROVED';
      await db.payrollRun.update({
        where: { id: approval.payrollRunId },
        data: { runStatus: nextStatus },
      });
    } else {
      // Rejected → back to PROCESSING for correction
      await db.payrollRun.update({
        where: { id: approval.payrollRunId },
        data: { runStatus: 'PROCESSING' },
      });
    }

    return Response.json({
      data: updated,
      message: body.action === 'approve' ? 'Payroll approved successfully' : 'Payroll rejected — returned for correction',
    }, { headers: corsHeaders });
  } catch (error: unknown) {
    console.error('Error in /api/payroll/approvals PATCH:', error);
    return Response.json({ error: (error instanceof Error ? error.message : String(error)) }, { status: 500, headers: corsHeaders });
  }
}
