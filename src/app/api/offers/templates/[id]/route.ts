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

// GET /api/offers/templates/[id]
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
    await ensureSchemaSynced();

    const template = await withSchemaSync(() =>
      db.offerTemplate.findUnique({ where: { id } })
    );

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404, headers: corsHeaders() });
    }

    return NextResponse.json({ template }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Get offer template error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}

// PATCH /api/offers/templates/[id]
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
    const { name, country, language, body: templateBody, header, footer, clauses, isActive } = body;

    await ensureSchemaSynced();
    const existing = await withSchemaSync(() => db.offerTemplate.findUnique({ where: { id } }));
    if (!existing) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404, headers: corsHeaders() });
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (country !== undefined) updateData.country = country;
    if (language !== undefined) updateData.language = language;
    if (templateBody !== undefined) updateData.body = templateBody;
    if (header !== undefined) updateData.header = header || null;
    if (footer !== undefined) updateData.footer = footer || null;
    if (clauses !== undefined) {
      updateData.clauses = clauses
        ? typeof clauses === 'string'
          ? clauses
          : JSON.stringify(clauses)
        : null;
    }
    if (isActive !== undefined) updateData.isActive = !!isActive;

    const template = await withSchemaSync(() =>
      db.offerTemplate.update({ where: { id }, data: updateData })
    );

    await db.auditLog.create({
      data: {
        userId: decoded.userId as string,
        action: 'UPDATE_OFFER_TEMPLATE',
        module: 'offers',
        details: `Updated offer template ${id}: ${Object.keys(updateData).join(', ')}`,
      },
    });

    return NextResponse.json({ template }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Patch offer template error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}

// DELETE /api/offers/templates/[id]
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
    const existing = await withSchemaSync(() => db.offerTemplate.findUnique({ where: { id } }));
    if (!existing) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404, headers: corsHeaders() });
    }

    await withSchemaSync(() => db.offerTemplate.delete({ where: { id } }));

    await db.auditLog.create({
      data: {
        userId: decoded.userId as string,
        action: 'DELETE_OFFER_TEMPLATE',
        module: 'offers',
        details: `Deleted offer template ${existing.name} (${existing.id})`,
      },
    });

    return NextResponse.json({ success: true }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Delete offer template error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}
