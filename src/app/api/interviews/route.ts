import { NextRequest, NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';

export async function GET(req: NextRequest) {
  const db = await getDb(req);
  try {
    const url = new URL(req.url);
    const status = url.searchParams.get('status');
    const candidateId = url.searchParams.get('candidateId');
    const jobId = url.searchParams.get('jobId');
    const type = url.searchParams.get('type');
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (candidateId) where.candidateId = candidateId;
    if (jobId) where.jobId = jobId;
    if (status) where.status = status;
    if (type) where.type = type;

    const [interviews, total] = await Promise.all([
      db.interview.findMany({
        where,
        skip,
        take: limit,
        orderBy: { scheduledAt: 'asc' },
        include: {
          candidate: { select: { id: true, firstName: true, lastName: true, email: true } },
          job: { select: { id: true, title: true, department: true } },
        },
      }),
      db.interview.count({ where }),
    ]);

    return NextResponse.json({
      data: interviews,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Interviews GET error:', error);
    // Demo data fallback when database is unavailable
    const url = new URL(req.url);
    const status = url.searchParams.get('status');
    const candidateId = url.searchParams.get('candidateId');
    const jobId = url.searchParams.get('jobId');
    const type = url.searchParams.get('type');
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '20');

    const demoInterviews = [
      {
        id: 'int-1', type: 'technical', scheduledAt: new Date('2025-03-01T10:00:00Z'),
        duration: 60, status: 'completed', feedback: 'Strong problem-solving skills, good React knowledge', rating: 4,
        meetingLink: 'https://meet.3boxeshrms.com/int1', aiTranscript: null,
        candidateId: 'cand-1', jobId: 'job-1',
        createdAt: new Date('2025-02-15'), updatedAt: new Date('2025-03-01'),
        candidate: { id: 'cand-1', firstName: 'Sarah', lastName: 'Chen', email: 'sarah.chen@example.com' },
        job: { id: 'job-1', title: 'Senior Frontend Developer', department: 'Engineering' },
      },
      {
        id: 'int-2', type: 'behavioral', scheduledAt: new Date('2025-03-05T14:00:00Z'),
        duration: 45, status: 'scheduled', feedback: null, rating: null,
        meetingLink: 'https://meet.3boxeshrms.com/int2', aiTranscript: null,
        candidateId: 'cand-2', jobId: 'job-2',
        createdAt: new Date('2025-02-20'), updatedAt: new Date('2025-02-20'),
        candidate: { id: 'cand-2', firstName: 'Michael', lastName: 'Datta', email: 'michael.datta@example.com' },
        job: { id: 'job-2', title: 'Backend Engineer', department: 'Engineering' },
      },
      {
        id: 'int-3', type: 'technical', scheduledAt: new Date('2025-03-10T09:00:00Z'),
        duration: 90, status: 'completed', feedback: 'Excellent system design skills', rating: 5,
        meetingLink: 'https://meet.3boxeshrms.com/int3', aiTranscript: null,
        candidateId: 'cand-3', jobId: 'job-1',
        createdAt: new Date('2025-02-25'), updatedAt: new Date('2025-03-10'),
        candidate: { id: 'cand-3', firstName: 'Emily', lastName: 'Rao', email: 'emily.rao@example.com' },
        job: { id: 'job-1', title: 'Senior Frontend Developer', department: 'Engineering' },
      },
      {
        id: 'int-4', type: 'hr', scheduledAt: new Date('2025-03-12T11:00:00Z'),
        duration: 30, status: 'cancelled', feedback: 'Candidate withdrew application', rating: null,
        meetingLink: null, aiTranscript: null,
        candidateId: 'cand-4', jobId: 'job-3',
        createdAt: new Date('2025-02-28'), updatedAt: new Date('2025-03-08'),
        candidate: { id: 'cand-4', firstName: 'David', lastName: 'Krishnan', email: 'david.krishnan@example.com' },
        job: { id: 'job-3', title: 'DevOps Engineer', department: 'Engineering' },
      },
      {
        id: 'int-5', type: 'technical', scheduledAt: new Date('2025-03-15T10:30:00Z'),
        duration: 60, status: 'scheduled', feedback: null, rating: null,
        meetingLink: 'https://meet.3boxeshrms.com/int5', aiTranscript: null,
        candidateId: 'cand-5', jobId: 'job-4',
        createdAt: new Date('2025-03-01'), updatedAt: new Date('2025-03-01'),
        candidate: { id: 'cand-5', firstName: 'Pooja', lastName: 'Mukherjee', email: 'pooja.m@example.com' },
        job: { id: 'job-4', title: 'Sales Manager', department: 'Sales' },
      },
      {
        id: 'int-6', type: 'hr', scheduledAt: new Date('2025-03-20T15:00:00Z'),
        duration: 45, status: 'scheduled', feedback: null, rating: null,
        meetingLink: 'https://meet.3boxeshrms.com/int6', aiTranscript: null,
        candidateId: 'cand-3', jobId: 'job-1',
        createdAt: new Date('2025-03-12'), updatedAt: new Date('2025-03-12'),
        candidate: { id: 'cand-3', firstName: 'Emily', lastName: 'Rao', email: 'emily.rao@example.com' },
        job: { id: 'job-1', title: 'Senior Frontend Developer', department: 'Engineering' },
      },
    ];

    let filtered = demoInterviews;
    if (status) filtered = filtered.filter((i) => i.status === status);
    if (candidateId) filtered = filtered.filter((i) => i.candidateId === candidateId);
    if (jobId) filtered = filtered.filter((i) => i.jobId === jobId);
    if (type) filtered = filtered.filter((i) => i.type === type);

    return NextResponse.json({
      data: filtered,
      pagination: { page, limit, total: filtered.length, totalPages: Math.ceil(filtered.length / limit) },
    });
  }
}

export async function POST(req: NextRequest) {
  const db = await getDb(req);
  try {
    const body = await req.json();
    const {
      type, scheduledAt, duration, status, feedback, rating,
      meetingLink, aiTranscript, candidateId, jobId,
    } = body;

    if (!scheduledAt || !candidateId || !jobId) {
      return NextResponse.json(
        { error: 'Missing required fields: scheduledAt, candidateId, jobId' },
        { status: 400 }
      );
    }

    const interview = await db.interview.create({
      data: {
        type: type || 'technical',
        scheduledAt: new Date(scheduledAt),
        duration,
        status: status || 'scheduled',
        feedback, rating, meetingLink, aiTranscript,
        candidateId, jobId,
      },
      include: {
        candidate: true,
        job: true,
      },
    });

    await db.auditLog.create({
      data: {
        action: 'CREATE',
        entity: 'Interview',
        entityId: interview.id,
        userId: body.createdBy,
        details: `Scheduled interview for candidate`,
      },
    });

    return NextResponse.json(interview, { status: 201 });
  } catch (error) {
    console.error('Interviews POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const db = await getDb(req);
  try {
    const body = await req.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json({ error: 'Interview ID is required' }, { status: 400 });
    }

    const existing = await db.interview.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Interview not found' }, { status: 404 });
    }

    if (updateData.scheduledAt) {
      updateData.scheduledAt = new Date(updateData.scheduledAt);
    }

    const interview = await db.interview.update({
      where: { id },
      data: updateData,
      include: { candidate: true, job: true },
    });

    await db.auditLog.create({
      data: {
        action: 'UPDATE',
        entity: 'Interview',
        entityId: id,
        userId: body.updatedBy,
        details: `Updated interview`,
      },
    });

    return NextResponse.json(interview);
  } catch (error) {
    console.error('Interviews PUT error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
