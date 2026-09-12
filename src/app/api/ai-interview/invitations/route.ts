import { NextRequest, NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { randomBytes } from 'crypto';

// GET /api/ai-interview/invitations — List invitations
export async function GET(req: NextRequest) {
  const db = await getDb(req);
  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const setId = searchParams.get('setId');
    const status = searchParams.get('status');

    const where: Record<string, unknown> = {};
    if (setId) where.setId = setId;
    if (status) where.status = status;

    const [invitations, total] = await Promise.all([
      db.interviewInvitation.findMany({
        where,
        include: {
          set: { select: { id: true, title: true, roleTitle: true, interviewMode: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.interviewInvitation.count({ where }),
    ]);

    return NextResponse.json({ data: invitations, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (error: unknown) {
    console.error('Invitations GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch invitations' }, { status: 500 });
  }
}

// POST /api/ai-interview/invitations — Create invitation(s), supports bulk
export async function POST(req: NextRequest) {
  const db = await getDb(req);
  try {
    const body = await req.json();
    const { setId, candidates } = body;

    if (!setId) {
      return NextResponse.json({ error: 'setId is required' }, { status: 400 });
    }

    // Verify set exists and is active
    const set = await db.interviewSet.findUnique({ where: { id: setId } });
    if (!set) {
      return NextResponse.json({ error: 'Interview set not found' }, { status: 404 });
    }
    if (set.status !== 'active') {
      return NextResponse.json({ error: 'Interview set must be active to send invitations' }, { status: 400 });
    }

    // Support single or bulk creation
    const candidateList: Array<{ email: string; name: string }> = [];
    if (candidates && Array.isArray(candidates)) {
      candidateList.push(...candidates);
    } else if (body.candidateEmail && body.candidateName) {
      candidateList.push({ email: body.candidateEmail, name: body.candidateName });
    } else {
      return NextResponse.json({ error: 'candidates array or candidateEmail/candidateName is required' }, { status: 400 });
    }

    const invitations = [];
    for (const candidate of candidateList) {
      if (!candidate.email || !candidate.name) continue;

      const token = randomBytes(32).toString('hex');
      const invitationUrl = `/interview/${token}`;
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 day expiry

      const invitation = await db.interviewInvitation.create({
        data: {
          setId,
          candidateEmail: candidate.email,
          candidateName: candidate.name,
          invitationToken: token,
          invitationUrl,
          status: 'pending',
          expiresAt,
        },
      });

      invitations.push(invitation);
    }

    return NextResponse.json({ data: invitations, count: invitations.length }, { status: 201 });
  } catch (error: unknown) {
    console.error('Invitations POST error:', error);
    return NextResponse.json({ error: 'Failed to create invitations' }, { status: 500 });
  }
}
