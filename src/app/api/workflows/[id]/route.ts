import { NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
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

    const workflow = await db.workflowDefinition.findUnique({
      where: { id },
      include: {
        instances: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: {
            approvals: { orderBy: { stepNumber: 'asc' } },
          },
        },
        _count: { select: { instances: true } },
      },
    });

    if (!workflow) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404, headers: corsHeaders() });
    }

    return NextResponse.json({ workflow }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Get workflow error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}

export async function PUT(
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

    const existing = await db.workflowDefinition.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404, headers: corsHeaders() });
    }

    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.module !== undefined) updateData.module = body.module;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.isActive !== undefined) updateData.isActive = body.isActive;
    if (body.steps !== undefined) {
      updateData.steps = typeof body.steps === 'string' ? body.steps : JSON.stringify(body.steps);
      updateData.version = existing.version + 1;
    }

    const workflow = await db.workflowDefinition.update({
      where: { id },
      data: updateData,
    });

    await db.auditLog.create({
      data: {
        userId: decoded.userId as string,
        action: 'UPDATE_WORKFLOW',
        module: 'workflows',
        details: `Updated workflow definition ${id}`,
      },
    });

    return NextResponse.json({ workflow }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Update workflow error:', error);
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

    const existing = await db.workflowDefinition.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404, headers: corsHeaders() });
    }

    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.module !== undefined) updateData.module = body.module;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.isActive !== undefined) updateData.isActive = body.isActive;
    if (body.steps !== undefined) {
      updateData.steps = typeof body.steps === 'string' ? body.steps : JSON.stringify(body.steps);
      updateData.version = existing.version + 1;
    }

    const workflow = await db.workflowDefinition.update({
      where: { id },
      data: updateData,
    });

    await db.auditLog.create({
      data: {
        userId: decoded.userId as string,
        action: 'UPDATE_WORKFLOW',
        module: 'workflows',
        details: `Patched workflow definition ${id}`,
      },
    });

    return NextResponse.json({ workflow }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Patch workflow error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}

export async function DELETE(
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

    const existing = await db.workflowDefinition.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404, headers: corsHeaders() });
    }

    // Delete related approvals, instances, then the workflow
    const instances = await db.workflowInstance.findMany({ where: { workflowDefinitionId: id }, select: { id: true } });
    for (const inst of instances) {
      await db.workflowApproval.deleteMany({ where: { workflowInstanceId: inst.id } });
    }
    await db.workflowInstance.deleteMany({ where: { workflowDefinitionId: id } });
    await db.workflowDefinition.delete({ where: { id } });

    await db.auditLog.create({
      data: {
        userId: decoded.userId as string,
        action: 'DELETE_WORKFLOW',
        module: 'workflows',
        details: `Deleted workflow definition ${existing.name}`,
      },
    });

    return NextResponse.json({ success: true }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Delete workflow error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}
