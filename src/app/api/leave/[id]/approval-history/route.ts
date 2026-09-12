import { NextResponse } from 'next/server';
import { getDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';
import { getApprovalHistory } from '@/lib/leave-workflow';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() });
}

/**
 * GET /api/leave/[id]/approval-history
 *
 * Returns the full approval chain for a leave request, showing each tier's
 * status (pending/approved/rejected), the approver, and their comments.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders() });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401, headers: corsHeaders() });

    const { id } = await params;

    // Get the leave request to find the workflow config snapshot
    const leaveReq = await db.leaveRequest.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        workflowStage: true,
        currentApproverId: true,
        workflowConfigSnapshot: true,
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeId: true,
            userId: true,
          },
        },
        leaveType: { select: { name: true } },
      },
    });

    if (!leaveReq) {
      return NextResponse.json({ error: 'Leave request not found' }, { status: 404, headers: corsHeaders() });
    }

    // Get the approval steps
    const steps = await getApprovalHistory(db, id);

    // Parse the workflow config snapshot (if any) to get tier labels
    let tierLabels: Record<number, string> = {};
    let tierApproverTypes: Record<number, string> = {};
    if (leaveReq.workflowConfigSnapshot) {
      try {
        const snapshot = JSON.parse(leaveReq.workflowConfigSnapshot);
        const config = snapshot.config;
        if (config?.tiers) {
          for (const tier of config.tiers) {
            tierLabels[tier.tier] = tier.label || `Tier ${tier.tier}`;
            tierApproverTypes[tier.tier] = tier.approverType;
          }
        }
      } catch { /* ignore parse errors */ }
    }

    // Enrich steps with tier labels + approver names
    const enrichedSteps = steps.map((step: any) => {
      const tier = step.tier;
      const approverType = step.approvertype || step.approverType;
      const approverUserId = step.approveruserid || step.approverUserId;
      const actionByUserId = step.actionbyuserid || step.actionByUserId;

      return {
        id: step.id,
        tier,
        tierLabel: tierLabels[tier] || `Tier ${tier}`,
        approverType: approverType,
        approverTypeLabel: getApproverTypeLabel(approverType),
        approverUserId,
        action: step.action,
        actionByUserId,
        actionByName: step.actionbyname || step.actionByName || null,
        actionByEmail: step.actionbyemail || step.actionByEmail || null,
        comments: step.comments,
        actionAt: step.actionat || step.actionAt,
        createdAt: step.createdat || step.createdAt,
      };
    });

    return NextResponse.json({
      leaveRequestId: id,
      leaveRequestStatus: leaveReq.status,
      workflowStage: leaveReq.workflowStage,
      currentApproverId: leaveReq.currentApproverId,
      steps: enrichedSteps,
      employee: leaveReq.employee,
      leaveType: leaveReq.leaveType,
    }, { headers: corsHeaders() });
  } catch (error) {
    console.error('[Approval History GET] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500, headers: corsHeaders() },
    );
  }
}

function getApproverTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    reporting_manager: 'Reporting Manager',
    department_head: 'Department Head',
    hr_admin: 'HR Admin',
    tenant_admin: 'Tenant Admin',
    specific_user: 'Specific User',
    specific_employee: 'Specific Employee',
  };
  return labels[type] || type;
}
