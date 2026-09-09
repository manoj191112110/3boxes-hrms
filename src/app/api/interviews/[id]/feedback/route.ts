import { NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';

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

const VALID_SENTIMENTS = new Set(['positive', 'negative', 'neutral', 'concern', 'highlight']);

function clampRating(n: unknown): number | null {
  const v = typeof n === 'number' ? n : Number(n);
  if (!Number.isFinite(v)) return null;
  return Math.max(1, Math.min(5, Math.round(v)));
}

function clampTimestamp(n: unknown): number | null {
  const v = typeof n === 'number' ? n : Number(n);
  if (!Number.isFinite(v) || v < 0) return null;
  return Math.round(v);
}

/**
 * GET /api/interviews/[id]/feedback
 * Returns all InterviewFeedback rows for the given interview, newest first.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) {
      return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    }
    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401, headers: corsHeaders() });
    }

    const { id: interviewId } = await params;
    if (!interviewId) {
      return NextResponse.json({ error: 'Interview id is required' }, { status: 400, headers: corsHeaders() });
    }

    const feedback = await db.interviewFeedback.findMany({
      where: { interviewId },
      orderBy: [{ timestampSec: 'asc' }, { createdAt: 'desc' }],
    });

    return NextResponse.json(
      { feedback: feedback || [] },
      { headers: corsHeaders() },
    );
  } catch (error) {
    console.error('interview feedback GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch interview feedback' },
      { status: 500, headers: corsHeaders() },
    );
  }
}

/**
 * POST /api/interviews/[id]/feedback
 * Body: { interviewerName, interviewerId?, timestampSec?, sentiment, body, rating? }
 * Creates a time-stamped InterviewFeedback row.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) {
      return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    }
    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401, headers: corsHeaders() });
    }

    const { id: interviewId } = await params;
    if (!interviewId) {
      return NextResponse.json({ error: 'Interview id is required' }, { status: 400, headers: corsHeaders() });
    }

    const body = await request.json();
    const {
      interviewerName,
      interviewerId,
      timestampSec,
      sentiment,
      body: feedbackBody,
      rating,
    } = body || {};

    if (!interviewerName || !feedbackBody) {
      return NextResponse.json(
        { error: 'interviewerName and body are required' },
        { status: 400, headers: corsHeaders() },
      );
    }

    const finalSentiment = VALID_SENTIMENTS.has(sentiment) ? sentiment : 'neutral';

    const created = await db.interviewFeedback.create({
      data: {
        interviewId,
        interviewerId: typeof interviewerId === 'string' && interviewerId ? interviewerId : null,
        interviewerName: String(interviewerName).slice(0, 200),
        timestampSec: clampTimestamp(timestampSec),
        sentiment: finalSentiment,
        body: String(feedbackBody),
        rating: clampRating(rating),
      },
    });

    await db.auditLog.create({
      data: {
        userId: decoded.userId as string,
        action: 'CREATE_INTERVIEW_FEEDBACK',
        module: 'ai_interview',
        details: `Time-stamped feedback added to interview ${interviewId} at t=${created.timestampSec ?? 'n/a'}s`,
      },
    }).catch(() => { /* non-critical */ });

    return NextResponse.json(
      { feedback: created },
      { status: 201, headers: corsHeaders() },
    );
  } catch (error) {
    console.error('interview feedback POST error:', error);
    return NextResponse.json(
      { error: 'Failed to create interview feedback' },
      { status: 500, headers: corsHeaders() },
    );
  }
}
