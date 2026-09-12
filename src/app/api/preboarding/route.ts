import { NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';
import { ensureSchemaSynced, withSchemaSync } from '@/lib/schema-sync';
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

    // Ensure the PreboardingCandidate table exists (P0 fix for missing model)
    await ensureSchemaSynced();

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const companyId = searchParams.get('companyId');
    const tenantId = searchParams.get('tenantId');

    // ─── GOLDEN RULE: No dummy/seed data on LIVE for super_admin ───
    if (isSuperAdminWithoutScope(decoded, companyId, tenantId, request)) {
      return NextResponse.json({
        candidates: [],
        pagination: { page, limit, total: 0, totalPages: 0 },
      }, { headers: corsHeaders() });
    }

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { candidateName: { contains: search, mode: 'insensitive' } },
        { candidateEmail: { contains: search, mode: 'insensitive' } },
        { jobTitle: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [candidates, total] = await Promise.all([
      db.preboardingCandidate.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.preboardingCandidate.count({ where }),
    ]);

    // Compute stats
    const allCandidates = await db.preboardingCandidate.findMany({
      select: { status: true },
    });

    const stats = {
      total: allCandidates.length,
      documentCollection: allCandidates.filter(c => c.status === 'document_collection').length,
      bgvInProgress: allCandidates.filter(c => c.status === 'bgv').length,
      readyToJoin: allCandidates.filter(c => c.status === 'provisioning' || c.status === 'asset_request').length,
      joined: allCandidates.filter(c => c.status === 'joined').length,
    };

    return NextResponse.json(
      {
        candidates,
        stats,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
      { headers: corsHeaders() }
    );
  } catch (error) {
    console.error('Get preboarding candidates error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders() }
    );
  }
}

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
    const {
      candidateName,
      candidateEmail,
      candidatePhone,
      jobTitle,
      departmentId,
      offeredSalary,
      currency,
      offerDate,
      joiningDate,
      notes,
      offerId,
      status,
    } = body;

    if (!candidateName || !candidateEmail) {
      return NextResponse.json(
        { error: 'Missing required fields: candidateName, candidateEmail' },
        { status: 400, headers: corsHeaders() }
      );
    }

    // Ensure the PreboardingCandidate table exists before creating
    await ensureSchemaSynced();

    const candidate = await withSchemaSync(() =>
      db.preboardingCandidate.create({
        data: {
          candidateName,
          candidateEmail,
          candidatePhone: candidatePhone || null,
          jobTitle: jobTitle || null,
          departmentId: departmentId || null,
          offeredSalary: offeredSalary ? parseFloat(String(offeredSalary)) : null,
          currency: currency || 'INR',
          offerDate: offerDate ? new Date(offerDate) : new Date(),
          joiningDate: joiningDate ? new Date(joiningDate) : null,
          notes: notes || null,
          offerId: offerId || null,
          status: status || 'offer_accepted',
          documentsUploaded: null,
          backgroundCheckStatus: 'pending',
          backgroundCheckNotes: null,
          hrVerified: false,
          accountProvisioned: false,
        },
      })
    );

    await db.auditLog.create({
      data: {
        userId: decoded.userId as string,
        action: 'CREATE_PREBOARDING_CANDIDATE',
        module: 'preboarding',
        details: `Created preboarding candidate: ${candidateName}`,
      },
    });

    return NextResponse.json(
      { candidate },
      { status: 201, headers: corsHeaders() }
    );
  } catch (error) {
    console.error('Create preboarding candidate error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders() }
    );
  }
}
