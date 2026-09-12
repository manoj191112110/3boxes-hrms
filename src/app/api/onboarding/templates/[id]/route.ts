import { NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';
import { ensureSchemaSynced, withSchemaSync } from '@/lib/schema-sync';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() });
}

// PATCH /api/onboarding/templates/[id]
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
    const { name, task, category, dueOffsetDays, appliesToRole, appliesToDepartment, isActive } = body;

    await ensureSchemaSynced();
    const existing = await withSchemaSync(() =>
      db.onboardingTaskTemplate.findUnique({ where: { id } })
    );
    if (!existing) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404, headers: corsHeaders() });
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (task !== undefined) updateData.task = task;
    if (category !== undefined) updateData.category = category;
    if (dueOffsetDays !== undefined) updateData.dueOffsetDays = Number(dueOffsetDays);
    if (appliesToRole !== undefined) updateData.appliesToRole = appliesToRole || null;
    if (appliesToDepartment !== undefined) updateData.appliesToDepartment = appliesToDepartment || null;
    if (isActive !== undefined) updateData.isActive = !!isActive;

    const template = await withSchemaSync(() =>
      db.onboardingTaskTemplate.update({ where: { id }, data: updateData })
    );

    await db.auditLog.create({
      data: {
        userId: decoded.userId as string,
        action: 'UPDATE_ONBOARDING_TEMPLATE',
        module: 'onboarding',
        details: `Updated onboarding task template ${id}: ${Object.keys(updateData).join(', ')}`,
      },
    });

    return NextResponse.json({ template }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Patch onboarding template error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}

// DELETE /api/onboarding/templates/[id]
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
    await ensureSchemaSynced();
    const existing = await withSchemaSync(() =>
      db.onboardingTaskTemplate.findUnique({ where: { id } })
    );
    if (!existing) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404, headers: corsHeaders() });
    }

    await withSchemaSync(() => db.onboardingTaskTemplate.delete({ where: { id } }));

    await db.auditLog.create({
      data: {
        userId: decoded.userId as string,
        action: 'DELETE_ONBOARDING_TEMPLATE',
        module: 'onboarding',
        details: `Deleted onboarding task template ${existing.name} (${existing.id})`,
      },
    });

    return NextResponse.json({ success: true }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Delete onboarding template error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}
