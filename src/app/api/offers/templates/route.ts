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

// GET /api/offers/templates?country=IN&isActive=true
export async function GET(request: Request) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) {
      return NextResponse.json(
        { error: 'No token provided' },
        { status: 401, headers: corsHeaders() }
      );
    }
    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401, headers: corsHeaders() }
      );
    }

    const { searchParams } = new URL(request.url);
    const country = searchParams.get('country');
    const isActive = searchParams.get('isActive');

    await ensureSchemaSynced();

    const where: Record<string, unknown> = {};
    // Tenant scoping (super_admin sees all)
    if (decoded.role !== 'super_admin') {
      where.tenantId = decoded.tenantId as string;
    } else if (searchParams.get('tenantId')) {
      where.tenantId = searchParams.get('tenantId') as string;
    }
    if (country) where.country = country;
    if (isActive !== null && isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    const templates = await withSchemaSync(() =>
      db.offerTemplate.findMany({
        where,
        orderBy: { createdAt: 'desc' },
      })
    );

    return NextResponse.json(
      { templates: templates || [] },
      { headers: corsHeaders() }
    );
  } catch (error) {
    console.error('Get offer templates error:', error);
    return NextResponse.json(
      { error: 'Internal server error', templates: [] },
      { status: 500, headers: corsHeaders() }
    );
  }
}

// POST /api/offers/templates
export async function POST(request: Request) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) {
      return NextResponse.json(
        { error: 'No token provided' },
        { status: 401, headers: corsHeaders() }
      );
    }
    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401, headers: corsHeaders() }
      );
    }

    const body = await request.json();
    const { name, country, language, body: templateBody, header, footer, clauses, isActive } = body;

    if (!name || !templateBody) {
      return NextResponse.json(
        { error: 'Missing required fields: name, body' },
        { status: 400, headers: corsHeaders() }
      );
    }

    await ensureSchemaSynced();

    const tenantId = (decoded.tenantId as string) || 'default-tenant';

    const template = await withSchemaSync(() =>
      db.offerTemplate.create({
        data: {
          tenantId,
          name,
          country: country || '*',
          language: language || 'en',
          body: templateBody,
          header: header || null,
          footer: footer || null,
          // clauses is stored as JSON string
          clauses: clauses
            ? typeof clauses === 'string'
              ? clauses
              : JSON.stringify(clauses)
            : null,
          isActive: isActive !== undefined ? !!isActive : true,
          createdBy: decoded.userId as string,
        },
      })
    );

    await db.auditLog.create({
      data: {
        userId: decoded.userId as string,
        action: 'CREATE_OFFER_TEMPLATE',
        module: 'offers',
        details: `Created offer template "${name}" (${country || '*'}/${language || 'en'})`,
      },
    });

    return NextResponse.json(
      { template },
      { status: 201, headers: corsHeaders() }
    );
  } catch (error) {
    console.error('Create offer template error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders() }
    );
  }
}
