import { NextRequest, NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';

/**
 * POST /api/collaboration/calls/[id]/transcript
 * Body: { action: 'request'|'upload', transcriptText?, summaryText? }
 *
 * REQ-COL-07: Call Logging with optional AI transcription.
 *   - 'request': mark transcript as requested (async job will pick it up)
 *   - 'upload': caller provides the transcript text + optional AI summary
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const { id } = await params;
    const body = await request.json();
    const { action, transcriptText, summaryText, transcriptUrl } = body;
    if (!action || !['request', 'upload'].includes(action)) {
      return NextResponse.json({ error: 'action must be request or upload' }, { status: 400 });
    }

    const call = await db.callLog.findUnique({ where: { id } });
    if (!call) return NextResponse.json({ error: 'Call not found' }, { status: 404 });

    // Verify the caller is a participant
    const employee = await db.employee.findFirst({ where: { userId: decoded.userId } });
    if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    if (call.initiatorId !== employee.id) {
      const participant = await db.callParticipant.findUnique({
        where: { callId_userId: { callId: id, userId: employee.id } },
      });
      if (!participant) return NextResponse.json({ error: 'Not a participant' }, { status: 403 });
    }

    // REQ-COL-07: Require consent for recording/transcription
    if (!call.consentForRecording) {
      return NextResponse.json({ error: 'Consent for recording was not granted for this call' }, { status: 403 });
    }

    if (action === 'request') {
      const updated = await db.callLog.update({
        where: { id },
        data: { transcriptStatus: 'requested' },
      });
      return NextResponse.json({ call: updated });
    }

    // action === 'upload'
    const updated = await db.callLog.update({
      where: { id },
      data: {
        transcriptStatus: 'ready',
        transcriptUrl: transcriptUrl || null,
        summaryText: summaryText || null,
      },
    });

    return NextResponse.json({ call: updated });
  } catch (error) {
    console.error('POST call transcript error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
