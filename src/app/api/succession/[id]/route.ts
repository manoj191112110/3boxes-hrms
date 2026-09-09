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

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
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

    const plan = await db.successionPlan.findUnique({
      where: { id },
      include: { candidates: true },
    });

    if (!plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404, headers: corsHeaders() });
    }

    // Enrich
    const employeeIds = new Set<string>();
    plan.candidates.forEach(c => employeeIds.add(c.employeeId));
    if (plan.currentHolderId) employeeIds.add(plan.currentHolderId);

    const employees = await db.employee.findMany({
      where: { id: { in: Array.from(employeeIds) } },
      select: {
        id: true, firstName: true, lastName: true, email: true, avatar: true,
        department: { select: { id: true, name: true } },
        designation: { select: { id: true, title: true } },
      },
    });
    const empMap = new Map(employees.map(e => [e.id, e]));

    let department = null;
    if (plan.departmentId) {
      const dept = await db.department.findUnique({ where: { id: plan.departmentId }, select: { id: true, name: true } });
      department = dept;
    }

    const enriched = {
      ...plan,
      department,
      currentHolder: plan.currentHolderId ? empMap.get(plan.currentHolderId) || null : null,
      candidates: plan.candidates.map(c => ({
        ...c,
        employee: empMap.get(c.employeeId) || null,
      })),
    };

    return NextResponse.json({ plan: enriched }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Get succession detail error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
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

    // Handle candidate update
    if (body.action === 'update_candidate') {
      const { candidateId, readinessLevel, developmentNeeds, notes, aiReadinessScore } = body;
      if (!candidateId) {
        return NextResponse.json({ error: 'Missing candidateId' }, { status: 400, headers: corsHeaders() });
      }
      const candidate = await db.successionCandidate.update({
        where: { id: candidateId },
        data: {
          ...(readinessLevel && { readinessLevel }),
          ...(developmentNeeds !== undefined && { developmentNeeds }),
          ...(notes !== undefined && { notes }),
          ...(aiReadinessScore !== undefined && { aiReadinessScore }),
        },
      });
      return NextResponse.json({ candidate }, { headers: corsHeaders() });
    }

    // Handle candidate removal
    if (body.action === 'remove_candidate') {
      const { candidateId } = body;
      if (!candidateId) {
        return NextResponse.json({ error: 'Missing candidateId' }, { status: 400, headers: corsHeaders() });
      }
      await db.successionCandidate.delete({ where: { id: candidateId } });
      return NextResponse.json({ success: true }, { headers: corsHeaders() });
    }

    // Default: update plan
    const plan = await db.successionPlan.update({
      where: { id },
      data: {
        ...(body.positionTitle && { positionTitle: body.positionTitle }),
        ...(body.departmentId !== undefined && { departmentId: body.departmentId || null }),
        ...(body.currentHolderId !== undefined && { currentHolderId: body.currentHolderId || null }),
        ...(body.riskLevel && { riskLevel: body.riskLevel }),
        ...(body.readinessStatus && { readinessStatus: body.readinessStatus }),
        ...(body.notes !== undefined && { notes: body.notes }),
        ...(body.targetDate !== undefined && { targetDate: body.targetDate ? new Date(body.targetDate) : null }),
      },
      include: { candidates: true },
    });

    return NextResponse.json({ plan }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Update succession error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
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

    // Cascading delete (candidates will be deleted by Prisma)
    await db.successionPlan.delete({ where: { id } });

    return NextResponse.json({ success: true }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Delete succession error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}
