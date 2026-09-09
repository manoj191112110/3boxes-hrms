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
    const workflowModule = searchParams.get('module');
    const companyId = searchParams.get('companyId');
    const isActive = searchParams.get('isActive');

    const where: Record<string, unknown> = {};
    if (workflowModule) where.module = workflowModule;
    if (companyId) where.companyId = companyId;
    if (isActive !== null && isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    const workflows = await db.workflowDefinition.findMany({
      where,
      include: {
        _count: { select: { instances: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ workflows }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Get workflows error:', error);
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
    const { name, module, companyId, description, steps } = body;

    if (!name || !module || !steps) {
      return NextResponse.json(
        { error: 'Missing required fields: name, module, steps' },
        { status: 400, headers: corsHeaders() }
      );
    }

    const workflow = await db.workflowDefinition.create({
      data: {
        name,
        module,
        companyId,
        description,
        steps: typeof steps === 'string' ? steps : JSON.stringify(steps),
        isActive: true,
        version: 1,
      },
    });

    await db.auditLog.create({
      data: {
        userId: decoded.userId as string,
        action: 'CREATE_WORKFLOW',
        module: 'workflows',
        details: `Created workflow definition ${name} for module ${module}`,
      },
    });

    return NextResponse.json({ workflow }, { status: 201, headers: corsHeaders() });
  } catch (error) {
    console.error('Create workflow error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}
