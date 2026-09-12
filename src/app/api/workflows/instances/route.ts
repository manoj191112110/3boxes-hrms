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

export async function GET(request: Request) {
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

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const workflowDefinitionId = searchParams.get('workflowDefinitionId');
    const entityType = searchParams.get('entityType');
    const entityId = searchParams.get('entityId');
    const status = searchParams.get('status');

    const where: Record<string, unknown> = {};
    if (workflowDefinitionId) where.workflowDefinitionId = workflowDefinitionId;
    if (entityType) where.entityType = entityType;
    if (entityId) where.entityId = entityId;
    if (status) where.status = status;

    const [instances, total] = await Promise.all([
      db.workflowInstance.findMany({
        where,
        include: {
          workflowDefinition: { select: { id: true, name: true, module: true, steps: true } },
          approvals: { orderBy: { stepNumber: 'asc' } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.workflowInstance.count({ where }),
    ]);

    return NextResponse.json(
      { instances, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } },
      { headers: corsHeaders() }
    );
  } catch (error) {
    console.error('Get workflow instances error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}

export async function POST(request: Request) {
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

    const body = await request.json();
    const { workflowDefinitionId, entityType, entityId } = body;

    if (!workflowDefinitionId || !entityType || !entityId) {
      return NextResponse.json(
        { error: 'Missing required fields: workflowDefinitionId, entityType, entityId' },
        { status: 400, headers: corsHeaders() }
      );
    }

    // Verify workflow definition exists
    const workflowDef = await db.workflowDefinition.findUnique({
      where: { id: workflowDefinitionId },
    });
    if (!workflowDef) {
      return NextResponse.json({ error: 'Workflow definition not found' }, { status: 404, headers: corsHeaders() });
    }

    if (!workflowDef.isActive) {
      return NextResponse.json({ error: 'Workflow definition is not active' }, { status: 400, headers: corsHeaders() });
    }

    // Parse steps to create initial approvals
    const steps = typeof workflowDef.steps === 'string'
      ? JSON.parse(workflowDef.steps)
      : workflowDef.steps;

    const instance = await db.workflowInstance.create({
      data: {
        workflowDefinitionId,
        entityType,
        entityId,
        currentStep: 0,
        status: 'pending',
        approvals: {
          create: (Array.isArray(steps) ? steps : []).map((step: Record<string, unknown>, index: number) => ({
            stepNumber: index,
            approverId: (step.approverId as string) || '',
            approverName: (step.approverName as string) || '',
            approverRole: (step.approverRole as string) || '',
          })),
        },
      },
      include: {
        workflowDefinition: { select: { id: true, name: true, module: true } },
        approvals: { orderBy: { stepNumber: 'asc' } },
      },
    });

    // Notify first step approver
    if (instance.approvals.length > 0 && instance.approvals[0].approverId) {
      await createNotification({
        tenantId: decoded.tenantId as string,
        userId: instance.approvals[0].approverId,
        title: 'Workflow Approval Required',
        message: `You have a pending approval for ${entityType} in workflow "${workflowDef.name}".`,
        type: 'info',
        category: 'workflow',
        link: `/workflows/instances/${instance.id}`,
      });
    }

    await db.auditLog.create({
      data: {
        userId: decoded.userId as string,
        action: 'START_WORKFLOW',
        module: 'workflows',
        details: `Started workflow instance for ${entityType}/${entityId} using definition ${workflowDef.name}`,
      },
    });

    return NextResponse.json({ instance }, { status: 201, headers: corsHeaders() });
  } catch (error) {
    console.error('Create workflow instance error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}
