/**
 * Admin — AI Resume Builder Approval (Super Admin only)
 *
 * GET  /api/admin/candidate-resume-builder-approval
 *   Lists all CandidatePortalUser rows with their approval status, plus
 *   basic profile info (name, email, last login, application count).
 *   Supports `?status=approved|pending|revoked` to filter.
 *
 * POST /api/admin/candidate-resume-builder-approval
 *   body: { candidateEmail, action: 'approve' | 'revoke' }
 *   Sets or clears `aiResumeBuilderApproved` on the candidate's row.
 *   Only Super Admins can call this — the AI Resume Builder is a premium
 *   feature gated by their review.
 *
 * The candidate-portal dashboard will only show the "AI Resume Builder"
 * button when `aiResumeBuilderApproved === true`. Until approved, the
 * feature is hidden and the API endpoint refuses to run.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: CORS });
}

async function requireSuperAdmin(req: NextRequest) {
  const token = getTokenFromHeaders(req);
  if (!token) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS }) };
  const decoded = await verifyToken(token);
  if (!decoded) return { error: NextResponse.json({ error: 'Invalid token' }, { status: 401, headers: CORS }) };
  const role = (decoded.role as string) || '';
  if (role !== 'super_admin') {
    return { error: NextResponse.json({ error: 'Super Admin access required to manage AI Resume Builder approvals' }, { status: 403, headers: CORS }) };
  }
  return { decoded };
}

export async function GET(req: NextRequest) {
  const db = await getDb(req);
  const auth = await requireSuperAdmin(req);
  if ('error' in auth) return auth.error;

  try {
    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get('status'); // 'approved' | 'pending' | 'revoked'
    const search = searchParams.get('search')?.trim().toLowerCase();

    // Build where clause
    const where: Record<string, unknown> = {};
    if (statusFilter === 'approved') {
      where.aiResumeBuilderApproved = true;
    } else if (statusFilter === 'revoked' || statusFilter === 'pending') {
      // "pending" = not approved (null OR false)
      // "revoked" = same as pending — once approved, then revoked, the flag goes back to false
      where.OR = [
        { aiResumeBuilderApproved: null },
        { aiResumeBuilderApproved: false },
      ];
    }
    if (search) {
      where.OR = [
        ...(Array.isArray(where.OR) ? where.OR : []),
        { candidateEmail: { contains: search, mode: 'insensitive' } },
        { candidateName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const candidates = await db.candidatePortalUser.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        id: true,
        candidateEmail: true,
        candidateName: true,
        aiResumeBuilderApproved: true,
        aiResumeBuilderApprovedAt: true,
        aiResumeBuilderApprovedBy: true,
        lastLoginAt: true,
        createdAt: true,
        oauthProvider: true,
      },
    });

    // For each candidate, count how many applications they have submitted
    // so the admin can see how active they are before approving.
    const emails = candidates.map(c => c.candidateEmail);
    const appCounts = await db.jobApplication.groupBy({
      by: ['candidateEmail'],
      where: { candidateEmail: { in: emails } },
      _count: { _all: true },
    });
    const countByEmail: Record<string, number> = {};
    for (const r of appCounts) {
      countByEmail[r.candidateEmail] = r._count._all;
    }

    return NextResponse.json({
      candidates: candidates.map(c => ({
        id: c.id,
        email: c.candidateEmail,
        name: c.candidateName,
        approved: c.aiResumeBuilderApproved === true,
        approvedAt: c.aiResumeBuilderApprovedAt,
        approvedBy: c.aiResumeBuilderApprovedBy,
        lastLoginAt: c.lastLoginAt,
        createdAt: c.createdAt,
        oauthProvider: c.oauthProvider,
        applicationCount: countByEmail[c.candidateEmail] || 0,
      })),
    }, { headers: CORS });
  } catch (err) {
    console.error('[admin/resume-builder-approval] GET error:', err);
    return NextResponse.json({ error: 'Failed to load candidates' }, { status: 500, headers: CORS });
  }
}

export async function POST(req: NextRequest) {
  const db = await getDb(req);
  const auth = await requireSuperAdmin(req);
  if ('error' in auth) return auth.error;

  try {
    const body = await req.json().catch(() => ({}));
    const { candidateEmail, action } = body;
    if (!candidateEmail || typeof candidateEmail !== 'string') {
      return NextResponse.json({ error: 'candidateEmail is required' }, { status: 400, headers: CORS });
    }
    if (action !== 'approve' && action !== 'revoke') {
      return NextResponse.json({ error: 'action must be "approve" or "revoke"' }, { status: 400, headers: CORS });
    }

    const email = candidateEmail.trim().toLowerCase();
    const approverEmail = (auth.decoded.email as string) || 'super-admin';

    const updated = await db.candidatePortalUser.update({
      where: { candidateEmail: email },
      data: {
        aiResumeBuilderApproved: action === 'approve',
        aiResumeBuilderApprovedAt: action === 'approve' ? new Date() : null,
        aiResumeBuilderApprovedBy: action === 'approve' ? approverEmail : null,
      },
      select: {
        candidateEmail: true,
        candidateName: true,
        aiResumeBuilderApproved: true,
        aiResumeBuilderApprovedAt: true,
      },
    });

    // Best-effort audit log
    try {
      await db.auditLog.create({
        data: {
          userId: (auth.decoded.userId as string) || '00000000-0000-0000-0000-000000000000',
          action: action === 'approve' ? 'CANDIDATE_RESUME_BUILDER_APPROVED' : 'CANDIDATE_RESUME_BUILDER_REVOKED',
          module: 'candidate_portal',
          details: `${action === 'approve' ? 'Approved' : 'Revoked'} AI Resume Builder access for ${email} (${updated.candidateName})`,
        },
      });
    } catch {
      /* audit log is best-effort */
    }

    return NextResponse.json({
      success: true,
      candidate: updated,
      message: action === 'approve'
        ? `Approved AI Resume Builder access for ${updated.candidateName || email}`
        : `Revoked AI Resume Builder access for ${updated.candidateName || email}`,
    }, { headers: CORS });
  } catch (err) {
    console.error('[admin/resume-builder-approval] POST error:', err);
    return NextResponse.json({ error: 'Failed to update approval status' }, { status: 500, headers: CORS });
  }
}
