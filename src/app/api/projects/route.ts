import { NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';
import { isSuperAdminWithoutScope } from '@/lib/superAdminGuard';

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
    const companyId = searchParams.get('companyId');
    const tenantId = searchParams.get('tenantId');
    const clientId = searchParams.get('clientId');
    const departmentId = searchParams.get('departmentId');
    const status = searchParams.get('status');
    const projectType = searchParams.get('projectType');
    const search = searchParams.get('search');

    // ─── GOLDEN RULE: No dummy/seed data on LIVE for super_admin ───
    if (isSuperAdminWithoutScope(decoded, companyId, tenantId, request)) {
      return NextResponse.json({
        projects: [],
        pagination: { page, limit, total: 0, totalPages: 0 },
      }, { headers: corsHeaders() });
    }

    const where: Record<string, unknown> = {};
    if (companyId) where.companyId = companyId;
    if (clientId) where.clientId = clientId;
    if (departmentId) where.departmentId = departmentId;
    if (status) where.status = status;
    if (projectType) where.projectType = projectType;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [projects, total] = await Promise.all([
      db.project.findMany({
        where,
        include: {
          client: { select: { id: true, name: true, code: true } },
          department: { select: { id: true, name: true, code: true } },
          company: { select: { id: true, name: true } },
          _count: { select: { tasks: true, allocations: true, milestones: true } },
          tasks: {
            select: { id: true, name: true, status: true, priority: true },
            take: 10,
            orderBy: { createdAt: 'desc' },
          },
          allocations: {
            select: {
              id: true, role: true, allocationPct: true, status: true,
              employee: { select: { id: true, firstName: true, lastName: true, employeeId: true } },
            },
            take: 10,
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.project.count({ where }),
    ]);

    return NextResponse.json(
      { projects, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } },
      { headers: corsHeaders() }
    );
  } catch (error) {
    console.error('Get projects error:', error);
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
    const {
      name, code, companyId, clientId, departmentId,
      projectManagerId, deliveryManagerId, projectType, billingType,
      currency, budgetAmount, estimatedHours, billingRate, costRate,
      startDate, endDate, description,
    } = body;

    if (!name || !companyId || !startDate) {
      return NextResponse.json(
        { error: 'Missing required fields: name, companyId, startDate' },
        { status: 400, headers: corsHeaders() }
      );
    }

    const project = await db.project.create({
      data: {
        name,
        code,
        companyId,
        clientId,
        departmentId,
        projectManagerId,
        deliveryManagerId,
        projectType: projectType || 'internal',
        billingType: billingType || 'non_billable',
        currency: currency || 'INR',
        budgetAmount: budgetAmount ?? 0,
        estimatedHours: estimatedHours ?? 0,
        billingRate: billingRate ?? 0,
        costRate: costRate ?? 0,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        description,
        status: 'draft',
        progress: 0,
      },
      include: {
        client: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
        company: { select: { id: true, name: true } },
      },
    });

    await db.auditLog.create({
      data: {
        userId: decoded.userId as string,
        action: 'CREATE_PROJECT',
        module: 'projects',
        details: `Created project ${name}`,
      },
    });

    return NextResponse.json({ project }, { status: 201, headers: corsHeaders() });
  } catch (error) {
    console.error('Create project error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}
