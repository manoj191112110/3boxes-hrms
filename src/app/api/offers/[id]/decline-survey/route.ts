import { NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';
import { ensureSchemaSynced, withSchemaSync } from '@/lib/schema-sync';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() });
}

/**
 * GET /api/offers/[id]/decline-survey
 * Returns the OfferDeclineSurvey row for the offer (or null).
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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
    await ensureSchemaSynced();

    const survey = await withSchemaSync(() =>
      db.offerDeclineSurvey.findUnique({ where: { offerId: id } })
    );

    return NextResponse.json({ survey }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Get decline survey error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}

/**
 * POST /api/offers/[id]/decline-survey
 * Create an OfferDeclineSurvey row (idempotent). Usually called automatically
 * by the offer PATCH handler when status transitions to 'rejected', but
 * exposed for manual re-creation.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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
    await ensureSchemaSynced();

    const offer = await withSchemaSync(() => db.offer.findUnique({ where: { id } }));
    if (!offer) {
      return NextResponse.json({ error: 'Offer not found' }, { status: 404, headers: corsHeaders() });
    }

    // Idempotent: if a survey already exists, return it.
    const existing = await withSchemaSync(() =>
      db.offerDeclineSurvey.findUnique({ where: { offerId: id } })
    );
    if (existing) {
      return NextResponse.json({ survey: existing }, { headers: corsHeaders() });
    }

    // Use upsert for extra safety against race conditions.
    const survey = await withSchemaSync(() =>
      db.offerDeclineSurvey.upsert({
        where: { offerId: id },
        create: { offerId: id },
        update: {},
      })
    );

    await db.auditLog.create({
      data: {
        userId: decoded.userId as string,
        action: 'CREATE_DECLINE_SURVEY',
        module: 'offers',
        details: `Created decline survey for offer ${id} (token ${survey.token})`,
      },
    });

    return NextResponse.json(
      {
        survey,
        // Public link the UI can email to the candidate
        surveyUrl: `/candidates/decline-survey/${survey.token}`,
      },
      { status: 201, headers: corsHeaders() }
    );
  } catch (error) {
    console.error('Create decline survey error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}
