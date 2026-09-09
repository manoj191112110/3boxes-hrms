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
    const companyId = searchParams.get('companyId');
    const status = searchParams.get('status');

    const where: Record<string, unknown> = {};
    if (companyId) where.companyId = companyId;
    if (status) where.status = status;

    const salaryStructures = await db.salaryStructure.findMany({
      where,
      include: {
        company: { select: { id: true, name: true } },
        components: { orderBy: { sortOrder: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ salaryStructures }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Get salary structures error:', error);
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
    const { name, companyId, country, currency, description, components } = body;

    if (!name || !companyId) {
      return NextResponse.json(
        { error: 'Missing required fields: name, companyId' },
        { status: 400, headers: corsHeaders() }
      );
    }

    const salaryStructure = await db.salaryStructure.create({
      data: {
        name,
        companyId,
        country,
        currency: currency || 'INR',
        description,
        status: 'active',
        components: {
          create: (components || []).map((comp: Record<string, unknown>, index: number) => ({
            name: comp.name as string,
            type: (comp.type as string) || 'earning',
            category: (comp.category as string) || 'other',
            calculationType: (comp.calculationType as string) || 'fixed',
            value: (comp.value as number) ?? 0,
            percentageOf: comp.percentageOf as string | null,
            formula: comp.formula as string | null,
            isTaxable: (comp.isTaxable as boolean) ?? true,
            isStatutory: (comp.isStatutory as boolean) ?? false,
            maxLimit: comp.maxLimit as number | null,
            sortOrder: index,
            status: 'active',
          })),
        },
      },
      include: {
        company: { select: { id: true, name: true } },
        components: { orderBy: { sortOrder: 'asc' } },
      },
    });

    await db.auditLog.create({
      data: {
        userId: decoded.userId as string,
        action: 'CREATE_SALARY_STRUCTURE',
        module: 'salary-structures',
        details: `Created salary structure ${name} with ${components?.length || 0} components`,
      },
    });

    return NextResponse.json({ salaryStructure }, { status: 201, headers: corsHeaders() });
  } catch (error) {
    console.error('Create salary structure error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}
