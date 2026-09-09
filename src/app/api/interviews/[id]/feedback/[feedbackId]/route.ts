import { NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() });
}

/**
 * DELETE /api/interviews/[id]/feedback/[feedbackId]
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; feedbackId: string }> },
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

    const { id: interviewId, feedbackId } = await params;
    if (!interviewId || !feedbackId) {
      return NextResponse.json(
        { error: 'interview id and feedbackId are required' },
        { status: 400, headers: corsHeaders() },
      );
    }

    const existing = await db.interviewFeedback.findUnique({
      where: { id: feedbackId },
    });
    if (!existing || existing.interviewId !== interviewId) {
      return NextResponse.json(
        { error: 'Feedback not found for this interview' },
        { status: 404, headers: corsHeaders() },
      );
    }

    await db.interviewFeedback.delete({ where: { id: feedbackId } });

    await db.auditLog.create({
      data: {
        userId: decoded.userId as string,
        action: 'DELETE_INTERVIEW_FEEDBACK',
        module: 'ai_interview',
        details: `Deleted feedback ${feedbackId} from interview ${interviewId}`,
      },
    }).catch(() => { /* non-critical */ });

    return NextResponse.json(
      { ok: true, deleted: feedbackId },
      { headers: corsHeaders() },
    );
  } catch (error) {
    console.error('interview feedback DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to delete feedback' },
      { status: 500, headers: corsHeaders() },
    );
  }
}
