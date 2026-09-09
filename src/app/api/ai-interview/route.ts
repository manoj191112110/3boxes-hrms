import { NextRequest, NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';

// GET /api/ai-interview — List interviews
export async function GET(req: NextRequest) {
  const db = await getDb(req);
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const type = searchParams.get('type');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    const where: Record<string, unknown> = {};
    if (status) where.status = status;

    const [interviews, total] = await Promise.all([
      db.interview.findMany({
        where,
        include: {
          jobApplication: {
            select: {
              id: true,
              candidateName: true,
              candidateEmail: true,
              jobPosting: { select: { id: true, title: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.interview.count({ where }),
    ]);

    return NextResponse.json({
      data: interviews,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error: unknown) {
    console.error('AI Interview GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch interviews' }, { status: 500 });
  }
}

// POST /api/ai-interview — Schedule a new interview
export async function POST(req: NextRequest) {
  const db = await getDb(req);
  try {
    const body = await req.json();
    const {
      jobApplicationId,
      type,
      date,
      time,
      duration,
      meetingUrl,
      interviewer,
    } = body;

    if (!jobApplicationId || !date) {
      return NextResponse.json(
        { error: 'jobApplicationId and date are required' },
        { status: 400 }
      );
    }

    const interview = await db.interview.create({
      data: {
        jobApplicationId,
        type: type || 'technical',
        date: new Date(date),
        time: time || null,
        duration: duration ? parseInt(String(duration), 10) : null,
        meetingUrl: meetingUrl || null,
        interviewer: interviewer || 'AI Interviewer',
        status: 'scheduled',
      },
      include: {
        jobApplication: {
          select: {
            candidateName: true,
            candidateEmail: true,
          },
        },
      },
    });

    return NextResponse.json({ data: interview }, { status: 201 });
  } catch (error: unknown) {
    console.error('AI Interview POST error:', error);
    return NextResponse.json({ error: 'Failed to schedule interview' }, { status: 500 });
  }
}

// PUT /api/ai-interview — Update interview
export async function PUT(req: NextRequest) {
  const db = await getDb(req);
  try {
    const body = await req.json();
    const { id, status, feedback, score, aiScore, aiFeedback, type, date, duration, meetingUrl } = body;

    if (!id) {
      return NextResponse.json({ error: 'Interview ID is required' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    if (status) updateData.status = status;
    if (feedback !== undefined) updateData.feedback = feedback;
    if (score !== undefined) updateData.score = parseInt(String(score), 10);
    if (aiScore !== undefined) updateData.aiScore = parseInt(String(aiScore), 10);
    if (aiFeedback !== undefined) updateData.aiFeedback = aiFeedback;
    if (type) updateData.type = type;
    if (date) updateData.date = new Date(date);
    if (duration !== undefined) updateData.duration = parseInt(String(duration), 10);
    if (meetingUrl !== undefined) updateData.meetingUrl = meetingUrl;

    const interview = await db.interview.update({
      where: { id },
      data: updateData,
      include: {
        jobApplication: {
          select: {
            candidateName: true,
            candidateEmail: true,
          },
        },
      },
    });

    return NextResponse.json({ data: interview });
  } catch (error: unknown) {
    console.error('AI Interview PUT error:', error);
    return NextResponse.json({ error: 'Failed to update interview' }, { status: 500 });
  }
}
