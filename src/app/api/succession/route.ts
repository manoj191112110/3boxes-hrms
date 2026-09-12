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
    const riskLevel = searchParams.get('riskLevel');
    const readinessStatus = searchParams.get('readinessStatus');

    const where: Record<string, unknown> = {};
    if (riskLevel) where.riskLevel = riskLevel;
    if (readinessStatus) where.readinessStatus = readinessStatus;

    const [plans, total] = await Promise.all([
      db.successionPlan.findMany({
        where,
        include: {
          candidates: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      db.successionPlan.count({ where }),
    ]);

    // Enrich with employee data for candidates
    const employeeIds = new Set<string>();
    plans.forEach(p => {
      p.candidates.forEach(c => employeeIds.add(c.employeeId));
      if (p.currentHolderId) employeeIds.add(p.currentHolderId);
    });

    const employees = await db.employee.findMany({
      where: { id: { in: Array.from(employeeIds) } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        avatar: true,
        department: { select: { id: true, name: true } },
        designation: { select: { id: true, title: true } },
      },
    });
    const empMap = new Map(employees.map(e => [e.id, e]));

    // Also get department data
    const deptIds = plans.map(p => p.departmentId).filter(Boolean) as string[];
    const departments = deptIds.length > 0
      ? await db.department.findMany({ where: { id: { in: deptIds } }, select: { id: true, name: true } })
      : [];
    const deptMap = new Map(departments.map(d => [d.id, d]));

    const enriched = plans.map(p => ({
      ...p,
      department: p.departmentId ? deptMap.get(p.departmentId) || null : null,
      currentHolder: p.currentHolderId ? empMap.get(p.currentHolderId) || null : null,
      candidates: p.candidates.map(c => ({
        ...c,
        employee: empMap.get(c.employeeId) || null,
      })),
    }));

    // Compute stats
    const allCandidates = plans.flatMap(p => p.candidates);
    const stats = {
      criticalRoles: plans.filter(p => p.riskLevel === 'critical').length,
      successorsIdentified: allCandidates.length,
      readyNow: allCandidates.filter(c => c.readinessLevel === 'ready_now').length,
      developmentNeeded: allCandidates.filter(c => c.readinessLevel === 'developing' || c.readinessLevel === 'development_needed').length,
    };

    return NextResponse.json({ plans: enriched, total, stats }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Get succession error:', error);
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

    // Handle adding candidate to plan
    if (body.action === 'add_candidate') {
      const { successionPlanId, employeeId, readinessLevel, developmentNeeds, notes } = body;
      if (!successionPlanId || !employeeId) {
        return NextResponse.json({ error: 'Missing required fields: successionPlanId, employeeId' }, { status: 400, headers: corsHeaders() });
      }

      const candidate = await db.successionCandidate.create({
        data: {
          successionPlanId,
          employeeId,
          readinessLevel: readinessLevel || 'developing',
          developmentNeeds: developmentNeeds || null,
          notes: notes || null,
        },
      });

      return NextResponse.json({ candidate }, { status: 201, headers: corsHeaders() });
    }

    // Default: create succession plan
    const { positionTitle, departmentId, currentHolderId, riskLevel, readinessStatus, notes, targetDate } = body;
    if (!positionTitle) {
      return NextResponse.json({ error: 'Missing required field: positionTitle' }, { status: 400, headers: corsHeaders() });
    }

    const plan = await db.successionPlan.create({
      data: {
        positionTitle,
        departmentId: departmentId || null,
        currentHolderId: currentHolderId || null,
        riskLevel: riskLevel || 'medium',
        readinessStatus: readinessStatus || 'identified',
        notes: notes || null,
        targetDate: targetDate ? new Date(targetDate) : null,
      },
      include: { candidates: true },
    });

    return NextResponse.json({ plan }, { status: 201, headers: corsHeaders() });
  } catch (error) {
    console.error('Create succession error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}
