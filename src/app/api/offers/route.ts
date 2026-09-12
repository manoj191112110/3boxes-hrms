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
    const status = searchParams.get('status');
    const candidateId = searchParams.get('candidateId');
    const jobPostingId = searchParams.get('jobPostingId');
    const companyId = searchParams.get('companyId');
    const tenantId = searchParams.get('tenantId');

    // ─── GOLDEN RULE: No dummy/seed data on LIVE for super_admin ───
    if (isSuperAdminWithoutScope(decoded, companyId, tenantId, request)) {
      return NextResponse.json({
        offers: [],
        pagination: { page, limit, total: 0, totalPages: 0 },
      }, { headers: corsHeaders() });
    }

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (candidateId) where.candidateId = candidateId;
    if (jobPostingId) where.jobPostingId = jobPostingId;

    const [offers, total] = await Promise.all([
      db.offer.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.offer.count({ where }),
    ]);

    return NextResponse.json(
      { offers, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } },
      { headers: corsHeaders() }
    );
  } catch (error) {
    console.error('Get offers error:', error);
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
      candidateId, jobPostingId, candidateName, candidateEmail,
      position, department, offeredSalary, offeredCurrency,
      offeredCTC, salaryBreakdown, joiningDate, probationPeriod,
      reportingTo,
    } = body;

    if (!candidateId || !candidateName || !candidateEmail || !position || !offeredSalary || !joiningDate) {
      return NextResponse.json(
        { error: 'Missing required fields: candidateId, candidateName, candidateEmail, position, offeredSalary, joiningDate' },
        { status: 400, headers: corsHeaders() }
      );
    }

    const offer = await db.offer.create({
      data: {
        candidateId,
        jobPostingId,
        candidateName,
        candidateEmail,
        position,
        department,
        offeredSalary,
        offeredCurrency: offeredCurrency || 'INR',
        offeredCTC,
        salaryBreakdown,
        joiningDate: new Date(joiningDate),
        probationPeriod: probationPeriod ?? 90,
        reportingTo,
        status: 'draft',
      },
    });

    await db.auditLog.create({
      data: {
        userId: decoded.userId as string,
        action: 'CREATE_OFFER',
        module: 'offers',
        details: `Created offer for ${candidateName} - ${position}`,
      },
    });

    return NextResponse.json({ offer }, { status: 201, headers: corsHeaders() });
  } catch (error) {
    console.error('Create offer error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}
