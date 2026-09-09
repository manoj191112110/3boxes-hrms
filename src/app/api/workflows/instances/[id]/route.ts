import { NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) {
      return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    }

    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: corsHeaders() });
    }

    const { id } = await params;

    const instance = await db.workflowInstance.findUnique({
      where: { id },
      include: {
        workflowDefinition: { select: { id: true, name: true, module: true, steps: true } },
        approvals: { orderBy: { stepNumber: 'asc' } },
      },
    });

    if (!instance) {
      return NextResponse.json({ error: 'Workflow instance not found' }, { status: 404, headers: corsHeaders() });
    }

    return NextResponse.json({ instance }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Get workflow instance error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) {
      return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    }

    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: corsHeaders() });
    }

    const { id } = await params;
    const body = await request.json();
    const { stepNumber, action, comments } = body;

    if (!stepNumber || !action) {
      return NextResponse.json(
        { error: 'Missing required fields: stepNumber, action' },
        { status: 400, headers: corsHeaders() }
      );
    }

    const validActions = ['approved', 'rejected'];
    if (!validActions.includes(action)) {
      return NextResponse.json(
        { error: `Invalid action. Must be one of: ${validActions.join(', ')}` },
        { status: 400, headers: corsHeaders() }
      );
    }

    const instance = await db.workflowInstance.findUnique({
      where: { id },
      include: { approvals: { orderBy: { stepNumber: 'asc' } }, workflowDefinition: true },
    });

    if (!instance) {
      return NextResponse.json({ error: 'Workflow instance not found' }, { status: 404, headers: corsHeaders() });
    }

    if (instance.status !== 'pending') {
      return NextResponse.json({ error: 'Workflow instance is no longer pending' }, { status: 400, headers: corsHeaders() });
    }

    // Find the approval for the step
    const approval = instance.approvals.find(a => a.stepNumber === stepNumber);
    if (!approval) {
      return NextResponse.json({ error: 'Approval step not found' }, { status: 404, headers: corsHeaders() });
    }

    if (approval.action) {
      return NextResponse.json({ error: 'This step has already been acted upon' }, { status: 400, headers: corsHeaders() });
    }

    // Update the approval
    await db.workflowApproval.update({
      where: { id: approval.id },
      data: {
        action,
        comments,
        actedAt: new Date(),
      },
    });

    // Determine the next state
    let instanceStatus = instance.status;
    let currentStep = instance.currentStep;

    if (action === 'rejected') {
      instanceStatus = 'rejected';
    } else {
      // Check if there are more steps
      const nextStep = instance.approvals.find(a => a.stepNumber > stepNumber && !a.action);
      if (nextStep) {
        currentStep = nextStep.stepNumber;
        // Notify the next approver
        if (nextStep.approverId) {
          await createNotification({
            tenantId: decoded.tenantId as string,
            userId: nextStep.approverId,
            title: 'Workflow Approval Required',
            message: `You have a pending approval for ${instance.entityType} in workflow "${instance.workflowDefinition.name}".`,
            type: 'info',
            category: 'workflow',
            link: `/workflows/instances/${id}`,
          });
        }
      } else {
        instanceStatus = 'approved';
      }
    }

    // Update the instance
    const updatedInstance = await db.workflowInstance.update({
      where: { id },
      data: {
        status: instanceStatus,
        currentStep,
      },
      include: {
        workflowDefinition: { select: { id: true, name: true, module: true } },
        approvals: { orderBy: { stepNumber: 'asc' } },
      },
    });

    await db.auditLog.create({
      data: {
        userId: decoded.userId as string,
        action: 'WORKFLOW_STEP_ACTION',
        module: 'workflows',
        details: `${action} step ${stepNumber} of workflow instance ${id}`,
      },
    });

    return NextResponse.json({ instance: updatedInstance }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Patch workflow instance error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}
