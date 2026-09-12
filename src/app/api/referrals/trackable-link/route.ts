import { NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';
import { ensureSchemaSynced, withSchemaSync } from '@/lib/schema-sync';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() });
}

/**
 * POST /api/referrals/trackable-link
 *
 * Body: { jobPostingId: string }
 *
 * Returns a publicly shareable URL the employee can post on
 * WhatsApp / LinkedIn / Twitter / etc. Clicking the URL hits
 * /api/referrals/track/[token], increments clickCount, and
 * redirects the visitor to /careers?ref=<token>&jobId=<jobPostingId>.
 *
 * Idempotent: if the employee already has a Referral row for the
 * given jobPostingId (regardless of candidate details), we reuse it.
 * This lets an employee generate a single per-job link and share it
 * broadly without minting dozens of duplicate tokens.
 *
 * Note: this route does NOT require candidate details — it just mints
 * a trackable link. The candidate's name/email get captured later by
 * /api/public/apply when they actually submit an application. The
 * Referral row created here is a placeholder with status='pending'
 * and stub candidate fields ("Pending — open link"). When the apply
 * route runs, it updates candidateName/Email/Phone and flips status
 * to 'applied'.
 */
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

    await ensureSchemaSynced();

    const body = await request.json().catch(() => ({}));
    const { jobPostingId } = body || {};

    if (!jobPostingId || typeof jobPostingId !== 'string') {
      return NextResponse.json(
        { error: 'jobPostingId is required' },
        { status: 400, headers: corsHeaders() }
      );
    }

    // Resolve the authenticated employee.
    const employee = await db.employee.findFirst({
      where: { userId: decoded.userId as string },
      select: { id: true, firstName: true, lastName: true },
    });
    if (!employee) {
      return NextResponse.json(
        { error: 'No employee profile linked to your user account.' },
        { status: 403, headers: corsHeaders() }
      );
    }

    // Validate the job exists.
    const jobPosting = await db.jobPosting.findUnique({
      where: { id: jobPostingId },
      select: { id: true, title: true, status: true, location: true },
    });
    if (!jobPosting) {
      return NextResponse.json(
        { error: 'Job posting not found' },
        { status: 404, headers: corsHeaders() }
      );
    }

    // Idempotency: reuse an existing pending referral for this employee+job
    // that was created as a "shareable link" (candidateEmail starts with
    // 'pending+' marker). This way employees can re-generate the link for
    // the same job and get the same URL back.
    const PLACEHOLDER_EMAIL_PREFIX = 'pending+';
    const existing = await withSchemaSync(() =>
      db.referral.findFirst({
        where: {
          referrerEmployeeId: employee.id,
          jobPostingId,
          status: 'pending',
          candidateEmail: { startsWith: PLACEHOLDER_EMAIL_PREFIX },
        },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          trackToken: true,
          clickCount: true,
          createdAt: true,
        },
      })
    );

    let referral: { id: string; trackToken: string; clickCount: number; createdAt: Date };

    if (existing) {
      referral = existing;
    } else {
      // Mint a new placeholder referral row. candidateName/Email are stubbed
      // — they get overwritten by /api/public/apply when someone actually
      // applies through this link.
      const created = await withSchemaSync(() =>
        db.referral.create({
          data: {
            jobPostingId,
            referrerEmployeeId: employee.id,
            candidateName: 'Pending — open link',
            candidateEmail: `${PLACEHOLDER_EMAIL_PREFIX}${employee.id.substring(0, 8)}-${jobPostingId.substring(0, 8)}@referral.local`,
            candidatePhone: null,
            candidateResume: null,
            notes: 'Auto-created as a trackable share link. Will be updated when a candidate applies.',
            bonusCurrency: 'INR',
            status: 'pending',
          },
          select: {
            id: true,
            trackToken: true,
            clickCount: true,
            createdAt: true,
          },
        })
      );
      referral = created;
    }

    // Build the public trackable URL. We use the public app URL so this
    // works from outside the tenant dashboard (e.g. when shared on
    // social media).
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const trackableUrl = `${baseUrl}/api/referrals/track/${referral.trackToken}`;

    return NextResponse.json(
      {
        trackableUrl,
        referralId: referral.id,
        trackToken: referral.trackToken,
        clickCount: referral.clickCount,
        createdAt: referral.createdAt,
        jobPosting: {
          id: jobPosting.id,
          title: jobPosting.title,
          location: jobPosting.location,
        },
      },
      { status: existing ? 200 : 201, headers: corsHeaders() }
    );
  } catch (error) {
    console.error('Trackable link POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders() }
    );
  }
}
