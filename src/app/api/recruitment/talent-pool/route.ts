/**
 * HR-side Talent Pool Management (REQ-STAT-01, REQ-STAT-02, REQ-STAT-04)
 *
 * POST /api/recruitment/talent-pool
 *   body: { applicationId, notes?, skillsSnapshot? }
 *
 * Moves an application to "talent_pool" status AND creates a
 * CandidateTalentPool entry for the (candidateEmail, company) pair.
 * Sends the candidate a positive talent-pool message (REQ-STAT-02).
 *
 * GET /api/recruitment/talent-pool?companyId=X
 *   Lists talent-pool candidates for the caller's tenant.
 *   If tenant.talentPoolCrossCompanyEnabled is true, returns candidates across
 *   all companies in the tenant (REQ-STAT-01 tenant config).
 *
 * DELETE /api/recruitment/talent-pool?id=X
 *   Removes a candidate from the talent pool (sets removedAt).
 */
import { NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';
import { isSuperAdminWithoutScope } from '@/lib/superAdminGuard';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: CORS });
}

export async function POST(request: Request) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: CORS });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401, headers: CORS });
    const decodedRec = decoded as unknown as Record<string, any>;

    const body = await request.json().catch(() => ({}));
    const { applicationId, notes, skillsSnapshot } = body;
    if (!applicationId) {
      return NextResponse.json({ error: 'applicationId is required' }, { status: 400, headers: CORS });
    }

    // Verify the application exists AND belongs to the caller's tenant
    // (super_admin bypasses the tenant filter so they can manage any application)
    const tenantFilter = decodedRec.role === 'super_admin' ? {} : {
      jobPosting: {
        department: {
          company: {
            companyGroup: { tenantId: decodedRec.tenantId as string },
          },
        },
      },
    };
    const application = await db.jobApplication.findFirst({
      where: {
        id: applicationId,
        ...tenantFilter,
      },
      include: {
        jobPosting: {
          select: {
            title: true,
            department: { select: { company: { select: { id: true, name: true } } } },
          },
        },
        resumeParses: { orderBy: { createdAt: 'desc' }, take: 1, select: { parsedData: true } },
      },
    });

    if (!application) {
      return NextResponse.json({ error: 'Application not found in your tenant' }, { status: 404, headers: CORS });
    }

    const companyId = application.jobPosting.department.company.id;
    const companyName = application.jobPosting.department.company.name;

    // Extract skills snapshot from the resume parse if not provided
    let snapshot = skillsSnapshot;
    if (!snapshot && application.resumeParses.length > 0) {
      try {
        const parsed = application.resumeParses[0].parsedData as any;
        if (parsed?.skills && Array.isArray(parsed.skills)) {
          snapshot = JSON.stringify(parsed.skills);
        }
      } catch {}
    }

    // 1. Update the application status to 'talent_pool' (REQ-STAT-01)
    const updated = await db.jobApplication.update({
      where: { id: applicationId },
      data: { status: 'talent_pool' },
    });

    // 2. Upsert the CandidateTalentPool entry (unique per candidateEmail × company)
    const talentPoolEntry = await db.candidateTalentPool.upsert({
      where: {
        candidateEmail_companyId: {
          candidateEmail: application.candidateEmail,
          companyId,
        },
      },
      create: {
        candidateEmail: application.candidateEmail,
        candidateName: application.candidateName,
        companyId,
        jobApplicationId: applicationId,
        skillsSnapshot: snapshot,
        notes: notes || null,
        // Auto-purge after 2 years (configurable per tenant in the future)
        expiresAt: new Date(Date.now() + 2 * 365 * 24 * 60 * 60 * 1000),
      },
      update: {
        notes: notes || undefined,
        skillsSnapshot: snapshot || undefined,
        removedAt: null,
      },
    });

    // 3. Send the candidate a positive talent-pool message (REQ-STAT-02)
    const talentPoolMessage = `Hi ${application.candidateName},

Thank you for applying to ${application.jobPosting.title} at ${companyName}.

Your profile is impressive, but we are moving forward with other candidates for this specific role. We have added you to our talent pool and may reach out for future matching roles.

You can view your talent-pool status and any new job alerts on your candidate dashboard.

Best regards,
The ${companyName} Talent Team`;

    await db.candidateMessage.create({
      data: {
        candidateEmail: application.candidateEmail,
        senderName: `${companyName} Talent Team`,
        senderRole: 'recruiter',
        body: talentPoolMessage,
      },
    }).catch(() => {}); // Non-fatal if message fails

    await db.auditLog.create({
      data: {
        userId: decodedRec.userId as string,
        action: 'MOVE_TO_TALENT_POOL',
        module: 'recruitment',
        details: `Moved ${application.candidateName} to talent pool for ${companyName}`,
      },
    }).catch(() => {});

    return NextResponse.json({
      ok: true,
      application: updated,
      talentPoolEntry,
      message: 'Candidate moved to talent pool',
    }, { headers: CORS });
  } catch (error) {
    console.error('Talent pool move error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: CORS });
  }
}

export async function GET(request: Request) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: CORS });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401, headers: CORS });
    const decodedRec = decoded as unknown as Record<string, any>;

    const url = new URL(request.url);
    const companyId = url.searchParams.get('companyId');
    const tenantId = url.searchParams.get('tenantId');
    const search = url.searchParams.get('search');

    // ─── GOLDEN RULE: No dummy/seed data on LIVE for super_admin ───
    if (isSuperAdminWithoutScope(decoded, companyId, tenantId, request)) {
      return NextResponse.json({ candidates: [], total: 0 }, { headers: CORS });
    }

    // Build where clause
    // If super_admin, no tenant filter; otherwise scope to caller's tenant
    const tenantFilter = decodedRec.role === 'super_admin' ? {} : {
      company: { companyGroup: { tenantId: decodedRec.tenantId as string } },
    };

    const where: any = {
      removedAt: null,
      ...tenantFilter,
    };
    if (companyId) where.companyId = companyId;
    if (search) {
      where.OR = [
        { candidateName: { contains: search, mode: 'insensitive' } },
        { candidateEmail: { contains: search, mode: 'insensitive' } },
      ];
    }

    const talentPool = await db.candidateTalentPool.findMany({
      where,
      include: {
        company: { select: { id: true, name: true } },
      },
      orderBy: { placedAt: 'desc' },
      take: 200,
    });

    return NextResponse.json({ talentPool }, { headers: CORS });
  } catch (error) {
    console.error('Talent pool list error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: CORS });
  }
}

export async function DELETE(request: Request) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: CORS });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401, headers: CORS });
    const decodedRec = decoded as unknown as Record<string, any>;

    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400, headers: CORS });

    // Verify ownership (tenant scope)
    const entry = await db.candidateTalentPool.findFirst({
      where: {
        id,
        ...(decodedRec.role === 'super_admin' ? {} : {
          company: { companyGroup: { tenantId: decodedRec.tenantId as string } },
        }),
      },
    });
    if (!entry) return NextResponse.json({ error: 'Not found' }, { status: 404, headers: CORS });

    await db.candidateTalentPool.update({
      where: { id },
      data: { removedAt: new Date() },
    });

    return NextResponse.json({ ok: true, message: 'Removed from talent pool' }, { headers: CORS });
  } catch (error) {
    console.error('Talent pool delete error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: CORS });
  }
}
