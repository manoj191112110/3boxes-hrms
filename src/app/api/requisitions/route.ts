import { NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';
import { createNotification } from '@/lib/notifications';
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

async function generateRequisitionId(): Promise<string> {
  const lastReq = await db.requisition.findFirst({
    orderBy: { createdAt: 'desc' },
    select: { requisitionId: true },
  });

  let nextNum = 1;
  if (lastReq && lastReq.requisitionId) {
    const match = lastReq.requisitionId.match(/REQ-(\d+)/);
    if (match) {
      nextNum = parseInt(match[1]) + 1;
    }
  }

  return `REQ-${nextNum.toString().padStart(4, '0')}`;
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
    const departmentId = searchParams.get('departmentId');
    const approvalStatus = searchParams.get('approvalStatus');
    const status = searchParams.get('status');
    const priority = searchParams.get('priority');

    // ─── GOLDEN RULE: No dummy/seed data on LIVE for super_admin ───
    if (isSuperAdminWithoutScope(decoded, companyId, tenantId, request)) {
      return NextResponse.json({
        requisitions: [],
        pagination: { page, limit, total: 0, totalPages: 0 },
      }, { headers: corsHeaders() });
    }

    const where: Record<string, unknown> = {};
    if (companyId) where.companyId = companyId;
    if (departmentId) where.departmentId = departmentId;
    if (approvalStatus) where.approvalStatus = approvalStatus;
    if (status) where.status = status;
    if (priority) where.priority = priority;

    const [requisitions, total] = await Promise.all([
      db.requisition.findMany({
        where,
        include: {
          department: { select: { id: true, name: true, code: true } },
          designation: { select: { id: true, title: true, level: true } },
          company: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.requisition.count({ where }),
    ]);

    return NextResponse.json(
      { requisitions, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } },
      { headers: corsHeaders() }
    );
  } catch (error) {
    console.error('Get requisitions error:', error);
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
      companyId, branchId, departmentId, designationId, hiringManagerId,
      positionType, replacementEmployeeId, numberOfOpenings, employmentType,
      skillsRequired, experienceRequired, qualification, salaryBudget,
      projectId, clientId, priority, expectedJoiningDate,
    } = body;

    if (!companyId || !departmentId) {
      return NextResponse.json(
        { error: 'Missing required fields: companyId, departmentId' },
        { status: 400, headers: corsHeaders() }
      );
    }

    const requisitionId = await generateRequisitionId();

    const requisition = await db.requisition.create({
      data: {
        requisitionId,
        companyId,
        branchId,
        departmentId,
        designationId,
        hiringManagerId,
        positionType: positionType || 'new',
        replacementEmployeeId,
        numberOfOpenings: numberOfOpenings ?? 1,
        employmentType: employmentType || 'full-time',
        skillsRequired,
        experienceRequired,
        qualification,
        salaryBudget,
        projectId,
        clientId,
        priority: priority || 'medium',
        expectedJoiningDate: expectedJoiningDate ? new Date(expectedJoiningDate) : null,
        approvalStatus: 'pending',
        status: 'open',
      },
      include: {
        department: { select: { id: true, name: true } },
        designation: { select: { id: true, title: true } },
      },
    });

    await db.auditLog.create({
      data: {
        userId: decoded.userId as string,
        action: 'CREATE_REQUISITION',
        module: 'requisitions',
        details: `Created requisition ${requisitionId}`,
      },
    });

    // Notify department head / hiring manager
    if (hiringManagerId) {
      await createNotification({
        tenantId: decoded.tenantId as string,
        userId: hiringManagerId,
        title: 'New Requisition Created',
        message: `Requisition ${requisitionId} has been created and requires your approval.`,
        type: 'info',
        category: 'recruitment',
        link: `/requisitions/${requisition.id}`,
      });
    }

    return NextResponse.json({ requisition }, { status: 201, headers: corsHeaders() });
  } catch (error) {
    console.error('Create requisition error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}
