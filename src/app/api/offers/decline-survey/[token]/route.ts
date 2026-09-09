import { NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';
import { ensureSchemaSynced, withSchemaSync } from '@/lib/schema-sync';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() });
}

/**
 * GET /api/offers/decline-survey/[token]
 *
 * Candidate-facing — returns the survey + the parent offer (candidateName,
 * position) so the public form can render context. No auth required.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    await ensureSchemaSynced();

    const survey = await withSchemaSync(() =>
      db.offerDeclineSurvey.findUnique({
        where: { token },
        include: { offer: true },
      })
    );

    if (!survey) {
      return NextResponse.json({ error: 'Survey not found' }, { status: 404, headers: corsHeaders() });
    }

    return NextResponse.json(
      {
        survey: {
          id: survey.id,
          token: survey.token,
          primaryReason: survey.primaryReason,
          comments: survey.comments,
          openToFuture: survey.openToFuture,
          submittedAt: survey.submittedAt,
          createdAt: survey.createdAt,
        },
        offer: survey.offer
          ? {
              id: survey.offer.id,
              candidateName: survey.offer.candidateName,
              position: survey.offer.position,
              department: survey.offer.department,
              offeredSalary: survey.offer.offeredSalary,
              offeredCurrency: survey.offer.offeredCurrency,
            }
          : null,
      },
      { headers: corsHeaders() }
    );
  } catch (error) {
    console.error('Get decline survey by token error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}

/**
 * PATCH /api/offers/decline-survey/[token]
 *
 * Candidate submits their survey (no auth). Idempotent: if already
 * submitted, returns the existing record.
 *
 * Body: { primaryReason, comments?, openToFuture? }
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const db = await getDb(request);
  try {
    const { token } = await params;
    const body = await request.json().catch(() => ({}));
    const { primaryReason, comments, openToFuture } = body;

    if (!primaryReason || typeof primaryReason !== 'string') {
      return NextResponse.json(
        { error: 'Missing required field: primaryReason' },
        { status: 400, headers: corsHeaders() }
      );
    }

    const validReasons = [
      'compensation_too_low',
      'accepted_another_offer',
      'location',
      'role_fit',
      'benefits',
      'counter_offer',
      'personal',
      'other',
    ];
    if (!validReasons.includes(primaryReason)) {
      return NextResponse.json(
        { error: `Invalid primaryReason. Must be one of: ${validReasons.join(', ')}` },
        { status: 400, headers: corsHeaders() }
      );
    }

    await ensureSchemaSynced();

    const existing = await withSchemaSync(() =>
      db.offerDeclineSurvey.findUnique({ where: { token } })
    );
    if (!existing) {
      return NextResponse.json({ error: 'Survey not found' }, { status: 404, headers: corsHeaders() });
    }
    if (existing.submittedAt) {
      return NextResponse.json(
        { error: 'Survey already submitted', survey: existing },
        { status: 409, headers: corsHeaders() }
      );
    }

    const survey = await withSchemaSync(() =>
      db.offerDeclineSurvey.update({
        where: { token },
        data: {
          primaryReason,
          comments: comments || null,
          openToFuture: openToFuture === null || openToFuture === undefined ? null : !!openToFuture,
          submittedAt: new Date(),
        },
      })
    );

    // Optionally log to audit (no userId since candidate is anonymous)
    try {
      await db.auditLog.create({
        data: {
          userId: 'candidate',
          action: 'DECLINE_SURVEY_SUBMITTED',
          module: 'offers',
          details: `Survey ${survey.id} for offer ${existing.offerId} submitted (reason=${primaryReason})`,
        },
      });
    } catch {
      // non-critical
    }

    return NextResponse.json({ survey }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Submit decline survey error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}

/**
 * Auth helper to verify a token from the request — unused here because
 * decline-survey submission is anonymous. Kept for symmetry with other
 * routes and to make future admin-only inspection trivial.
 */
export async function _requireAuth(request: Request) {
  const token = getTokenFromHeaders(request);
  if (!token) return null;
  return verifyToken(token);
}
