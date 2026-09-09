import { NextRequest, NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';

/**
 * GET /api/collaboration/calls?status=completed&limit=50
 * Returns call logs for the current user (as initiator or participant).
 */
export async function GET(request: NextRequest) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);

    const employee = await db.employee.findFirst({ where: { userId: decoded.userId } });
    if (!employee) return NextResponse.json({ calls: [] });

    const where: Record<string, unknown> = {
      OR: [
        { initiatorId: employee.id },
        { participants: { some: { userId: employee.id } } },
      ],
    };
    if (status) where.status = status;

    const calls = await db.callLog.findMany({
      where,
      orderBy: { startedAt: 'desc' },
      take: limit,
      include: {
        initiator: { select: { id: true, firstName: true, lastName: true, avatar: true } },
        participants: {
          include: { user: { select: { id: true, firstName: true, lastName: true, avatar: true } } },
        },
      },
    });

    return NextResponse.json({ calls });
  } catch (error) {
    console.error('GET calls error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/collaboration/calls
 * Body: { callType: 'audio'|'video', provider?, participantIds: string[], roomId?, consentForRecording? }
 *
 * REQ-COL-05: WebRTC Native Calling (1:1 audio/video)
 * REQ-COL-06: Deep-Linking — external providers (Zoom, Teams, Webex)
 * REQ-COL-07: Call Logging with optional AI transcription
 * REQ-SEC-EMP-03: E2EE for 1:1 WebRTC calls
 */
export async function POST(request: NextRequest) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const body = await request.json();
    const { callType, provider = 'native_webrtc', participantIds = [], roomId, consentForRecording = false, meetingUrl } = body;

    if (!callType || !['audio', 'video'].includes(callType)) {
      return NextResponse.json({ error: 'Invalid callType' }, { status: 400 });
    }
    if (participantIds.length === 0) {
      return NextResponse.json({ error: 'At least one participant is required' }, { status: 400 });
    }

    const employee = await db.employee.findFirst({ where: { userId: decoded.userId } });
    if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });

    // REQ-SEC-EMP-03: Native WebRTC 1:1 calls are E2EE
    const isE2EE = provider === 'native_webrtc' && participantIds.length === 1;

    const call = await db.callLog.create({
      data: {
        callType,
        provider,
        initiatorId: employee.id,
        roomId: roomId || null,
        meetingUrl: meetingUrl || null,
        consentForRecording,
        isE2EE,
        status: 'initiated',
        participants: {
          create: [
            // Initiator auto-joins
            { userId: employee.id, joinedAt: new Date() },
            // Other participants are pending
            ...participantIds.map((uid: string) => ({ userId: uid })),
          ],
        },
      },
      include: {
        participants: {
          include: { user: { select: { id: true, firstName: true, lastName: true, avatar: true } } },
        },
      },
    });

    return NextResponse.json({ call }, { status: 201 });
  } catch (error) {
    console.error('POST calls error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/collaboration/calls
 * Body: { callId, action: 'end'|'answer', endedAt?, durationSec?, status? }
 */
export async function PATCH(request: NextRequest) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const body = await request.json();
    const { callId, action, status, durationSec } = body;
    if (!callId || !action) return NextResponse.json({ error: 'callId and action are required' }, { status: 400 });

    const updates: Record<string, unknown> = {};
    if (action === 'end') {
      updates.endedAt = new Date();
      updates.status = status || 'completed';
      if (durationSec) updates.durationSec = durationSec;
    } else if (action === 'answer') {
      updates.status = 'answered';
    }

    const call = await db.callLog.update({
      where: { id: callId },
      data: updates,
    });

    return NextResponse.json({ call });
  } catch (error) {
    console.error('PATCH calls error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
