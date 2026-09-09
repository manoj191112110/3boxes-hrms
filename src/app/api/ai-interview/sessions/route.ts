import { NextRequest, NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';

// GET /api/ai-interview/sessions — List sessions with filters
export async function GET(req: NextRequest) {
  const db = await getDb(req);
  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status');
    const setId = searchParams.get('setId');

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (setId) where.setId = setId;

    const [sessions, total] = await Promise.all([
      db.interviewSession.findMany({
        where,
        include: {
          set: { select: { id: true, title: true, roleTitle: true, interviewMode: true } },
          _count: { select: { responses: true, proctoringLogs: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.interviewSession.count({ where }),
    ]);

    return NextResponse.json({ data: sessions, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (error: unknown) {
    console.error('Sessions GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 });
  }
}

// POST /api/ai-interview/sessions — Create session
export async function POST(req: NextRequest) {
  const db = await getDb(req);
  try {
    const body = await req.json();
    const {
      setId, candidateName, candidateEmail, candidatePhone,
      resumeUrl, resumeParsed, language = 'en',
      invitationId,
    } = body;

    if (!setId || !candidateName || !candidateEmail) {
      return NextResponse.json({ error: 'setId, candidateName, and candidateEmail are required' }, { status: 400 });
    }

    // Verify set exists and is active
    const set = await db.interviewSet.findUnique({ where: { id: setId } });
    if (!set) {
      return NextResponse.json({ error: 'Interview set not found' }, { status: 404 });
    }
    if (set.status === 'archived') {
      return NextResponse.json({ error: 'Cannot create session for archived set' }, { status: 400 });
    }

    const sessionData: Record<string, unknown> = {
      setId,
      candidateName,
      candidateEmail,
      candidatePhone: candidatePhone || null,
      resumeUrl: resumeUrl || null,
      resumeParsed: resumeParsed || undefined,
      language,
      status: set.enablePreScreening ? 'pre_screen' : 'invited',
    };

    // If from invitation, link it
    if (invitationId) {
      const invitation = await db.interviewInvitation.findUnique({ where: { id: invitationId } });
      if (invitation) {
        sessionData.candidateName = invitation.candidateName;
        sessionData.candidateEmail = invitation.candidateEmail;
        sessionData.status = set.enablePreScreening ? 'pre_screen' : 'in_progress';
        sessionData.startedAt = new Date();

        await db.interviewInvitation.update({
          where: { id: invitationId },
          data: { status: 'started', openedAt: new Date() },
        });
      }
    }

    const session = await db.interviewSession.create({
      data: sessionData as Parameters<typeof db.interviewSession.create>[0]['data'],
      include: {
        set: { select: { id: true, title: true, roleTitle: true, interviewMode: true, questions: { orderBy: { order: 'asc' } } } },
      },
    });

    return NextResponse.json({ data: session }, { status: 201 });
  } catch (error: unknown) {
    console.error('Sessions POST error:', error);
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
  }
}
