import { NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';
import { ensureSchemaSynced, withSchemaSync } from '@/lib/schema-sync';

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

// GET /api/onboarding/templates?isActive=true&category=it_setup
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
    const category = searchParams.get('category');
    const isActive = searchParams.get('isActive');

    await ensureSchemaSynced();

    const where: Record<string, unknown> = {};
    if (decoded.role !== 'super_admin') {
      where.tenantId = decoded.tenantId as string;
    } else if (searchParams.get('tenantId')) {
      where.tenantId = searchParams.get('tenantId') as string;
    }
    if (category) where.category = category;
    if (isActive !== null && isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    const templates = await withSchemaSync(() =>
      db.onboardingTaskTemplate.findMany({
        where,
        orderBy: [{ category: 'asc' }, { createdAt: 'desc' }],
      })
    );

    return NextResponse.json(
      { templates: templates || [] },
      { headers: corsHeaders() }
    );
  } catch (error) {
    console.error('Get onboarding templates error:', error);
    return NextResponse.json(
      { error: 'Internal server error', templates: [] },
      { status: 500, headers: corsHeaders() }
    );
  }
}

// POST /api/onboarding/templates
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
    const { name, task, category, dueOffsetDays, appliesToRole, appliesToDepartment, isActive } = body;

    if (!name || !task) {
      return NextResponse.json(
        { error: 'Missing required fields: name, task' },
        { status: 400, headers: corsHeaders() }
      );
    }

    await ensureSchemaSynced();

    const tenantId = (decoded.tenantId as string) || 'default-tenant';

    const template = await withSchemaSync(() =>
      db.onboardingTaskTemplate.create({
        data: {
          tenantId,
          name,
          task,
          category: category || 'general',
          dueOffsetDays: dueOffsetDays !== undefined ? Number(dueOffsetDays) : 0,
          appliesToRole: appliesToRole || null,
          appliesToDepartment: appliesToDepartment || null,
          isActive: isActive !== undefined ? !!isActive : true,
        },
      })
    );

    await db.auditLog.create({
      data: {
        userId: decoded.userId as string,
        action: 'CREATE_ONBOARDING_TEMPLATE',
        module: 'onboarding',
        details: `Created onboarding task template "${name}" (${category || 'general'})`,
      },
    });

    return NextResponse.json(
      { template },
      { status: 201, headers: corsHeaders() }
    );
  } catch (error) {
    console.error('Create onboarding template error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}
