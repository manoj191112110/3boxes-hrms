import { NextRequest, NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';

// POST /api/ai-interview/proctoring — Log proctoring events
export async function POST(req: NextRequest) {
  const db = await getDb(req);
  try {
    const body = await req.json();
    const { sessionId, eventType, severity = 'low', details, screenshotUrl } = body;

    if (!sessionId || !eventType) {
      return NextResponse.json({ error: 'sessionId and eventType are required' }, { status: 400 });
    }

    const validEventTypes = ['tab_switch', 'face_not_detected', 'multiple_faces', 'audio_anomaly', 'copy_paste', 'ai_assistant_detected', 'browser_devtools'];
    if (!validEventTypes.includes(eventType)) {
      return NextResponse.json({ error: `Invalid eventType. Must be one of: ${validEventTypes.join(', ')}` }, { status: 400 });
    }

    const log = await db.proctoringLog.create({
      data: {
        sessionId,
        eventType,
        severity,
        details: details || null,
        screenshotUrl: screenshotUrl || null,
      },
    });

    // Check if we should disqualify (critical events)
    const criticalCount = await db.proctoringLog.count({
      where: { sessionId, severity: 'critical' },
    });

    if (criticalCount >= 3) {
      await db.interviewSession.update({
        where: { id: sessionId },
        data: { status: 'disqualified' },
      });
    }

    return NextResponse.json({ data: log }, { status: 201 });
  } catch (error: unknown) {
    console.error('Proctoring POST error:', error);
    return NextResponse.json({ error: 'Failed to log proctoring event' }, { status: 500 });
  }
}

// GET /api/ai-interview/proctoring — Get logs for a session
export async function GET(req: NextRequest) {
  const db = await getDb(req);
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
    }

    const logs = await db.proctoringLog.findMany({
      where: { sessionId },
      orderBy: { timestamp: 'desc' },
    });

    // Summary stats
    const summary = {
      total: logs.length,
      bySeverity: {
        low: logs.filter(l => l.severity === 'low').length,
        medium: logs.filter(l => l.severity === 'medium').length,
        high: logs.filter(l => l.severity === 'high').length,
        critical: logs.filter(l => l.severity === 'critical').length,
      },
      byType: logs.reduce((acc, l) => {
        acc[l.eventType] = (acc[l.eventType] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    };

    return NextResponse.json({ data: logs, summary });
  } catch (error: unknown) {
    console.error('Proctoring GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch proctoring logs' }, { status: 500 });
  }
}
