import { NextRequest, NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';

export async function GET(req: NextRequest) {
  const db = await getDb(req);
  try {
    const url = new URL(req.url);
    const status = url.searchParams.get('status');
    const jobId = url.searchParams.get('jobId');
    const search = url.searchParams.get('search');
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (jobId) where.jobId = jobId;
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { firstName: { contains: search } },
        { lastName: { contains: search } },
        { email: { contains: search } },
        { currentCompany: { contains: search } },
      ];
    }

    const [candidates, total] = await Promise.all([
      db.candidate.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          job: { select: { id: true, title: true, department: true } },
          _count: { select: { interviews: true } },
        },
      }),
      db.candidate.count({ where }),
    ]);

    return NextResponse.json({
      data: candidates,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Candidates GET error:', error);
    // Demo data fallback when database is unavailable
    const url = new URL(req.url);
    const status = url.searchParams.get('status');
    const jobId = url.searchParams.get('jobId');
    const search = url.searchParams.get('search');
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '20');

    const demoCandidates = [
      {
        id: 'cand-1', firstName: 'Sarah', lastName: 'Chen', email: 'sarah.chen@example.com',
        phone: '+91-9988776601', resume: null, currentCompany: 'Infosys', currentTitle: 'Senior Developer',
        experience: 8, expectedSalary: 1500000, noticePeriod: 30, status: 'interviewed',
        source: 'linkedin', aiScore: 92, skillMatch: 88, cultureFitScore: 85, notes: 'Strong technical skills',
        jobId: 'job-1', createdAt: new Date('2025-01-10'), updatedAt: new Date('2025-01-15'),
        job: { id: 'job-1', title: 'Senior Frontend Developer', department: 'Engineering' },
        _count: { interviews: 2 },
      },
      {
        id: 'cand-2', firstName: 'Michael', lastName: 'Datta', email: 'michael.datta@example.com',
        phone: '+91-9988776602', resume: null, currentCompany: 'Wipro', currentTitle: 'Backend Engineer',
        experience: 5, expectedSalary: 1200000, noticePeriod: 15, status: 'applied',
        source: 'referral', aiScore: 78, skillMatch: 82, cultureFitScore: 70, notes: 'Good potential',
        jobId: 'job-2', createdAt: new Date('2025-01-12'), updatedAt: new Date('2025-01-12'),
        job: { id: 'job-2', title: 'Backend Engineer', department: 'Engineering' },
        _count: { interviews: 0 },
      },
      {
        id: 'cand-3', firstName: 'Emily', lastName: 'Rao', email: 'emily.rao@example.com',
        phone: '+91-9988776603', resume: null, currentCompany: 'TCS', currentTitle: 'Tech Lead',
        experience: 10, expectedSalary: 1800000, noticePeriod: 60, status: 'offered',
        source: 'headhunter', aiScore: 95, skillMatch: 91, cultureFitScore: 93, notes: 'Excellent fit',
        jobId: 'job-1', createdAt: new Date('2025-01-05'), updatedAt: new Date('2025-01-20'),
        job: { id: 'job-1', title: 'Senior Frontend Developer', department: 'Engineering' },
        _count: { interviews: 3 },
      },
      {
        id: 'cand-4', firstName: 'David', lastName: 'Krishnan', email: 'david.krishnan@example.com',
        phone: '+91-9988776604', resume: null, currentCompany: 'Flipkart', currentTitle: 'DevOps Lead',
        experience: 7, expectedSalary: 1400000, noticePeriod: 30, status: 'shortlisted',
        source: 'website', aiScore: 85, skillMatch: 80, cultureFitScore: 78, notes: 'Strong DevOps background',
        jobId: 'job-3', createdAt: new Date('2025-01-14'), updatedAt: new Date('2025-01-18'),
        job: { id: 'job-3', title: 'DevOps Engineer', department: 'Engineering' },
        _count: { interviews: 1 },
      },
      {
        id: 'cand-5', firstName: 'Pooja', lastName: 'Mukherjee', email: 'pooja.m@example.com',
        phone: '+91-9988776605', resume: null, currentCompany: 'Amazon', currentTitle: 'Sales Lead',
        experience: 6, expectedSalary: 1350000, noticePeriod: 45, status: 'interviewed',
        source: 'linkedin', aiScore: 88, skillMatch: 85, cultureFitScore: 90, notes: 'Great communication skills',
        jobId: 'job-4', createdAt: new Date('2025-02-12'), updatedAt: new Date('2025-02-20'),
        job: { id: 'job-4', title: 'Sales Manager', department: 'Sales' },
        _count: { interviews: 2 },
      },
      {
        id: 'cand-6', firstName: 'Rohan', lastName: 'Desai', email: 'rohan.desai@example.com',
        phone: '+91-9988776606', resume: null, currentCompany: 'Freshworks', currentTitle: 'UX Designer',
        experience: 4, expectedSalary: 950000, noticePeriod: 30, status: 'rejected',
        source: 'website', aiScore: 72, skillMatch: 68, cultureFitScore: 75, notes: 'Portfolio needs improvement',
        jobId: 'job-5', createdAt: new Date('2024-11-10'), updatedAt: new Date('2024-12-05'),
        job: { id: 'job-5', title: 'UX Designer', department: 'Design' },
        _count: { interviews: 1 },
      },
      {
        id: 'cand-7', firstName: 'Nisha', lastName: 'Agarwal', email: 'nisha.a@example.com',
        phone: '+91-9988776607', resume: null, currentCompany: 'Zoho', currentTitle: 'Marketing Specialist',
        experience: 3, expectedSalary: 700000, noticePeriod: 20, status: 'applied',
        source: 'linkedin', aiScore: 80, skillMatch: 76, cultureFitScore: 82, notes: 'Creative approach',
        jobId: 'job-6', createdAt: new Date('2025-02-18'), updatedAt: new Date('2025-02-18'),
        job: { id: 'job-6', title: 'Marketing Coordinator', department: 'Marketing' },
        _count: { interviews: 0 },
      },
    ];

    let filtered = demoCandidates;
    if (status) filtered = filtered.filter((c) => c.status === status);
    if (jobId) filtered = filtered.filter((c) => c.jobId === jobId);
    if (search) {
      const s = search.toLowerCase();
      filtered = filtered.filter((c) =>
        c.firstName.toLowerCase().includes(s) ||
        c.lastName.toLowerCase().includes(s) ||
        c.email.toLowerCase().includes(s) ||
        c.currentCompany.toLowerCase().includes(s)
      );
    }

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
      firstName, lastName, email, phone, resume,
      currentCompany, currentTitle, experience, expectedSalary,
      noticePeriod, status, source, aiScore, skillMatch,
      cultureFitScore, notes, jobId,
    } = body;

    if (!firstName || !lastName || !email || !jobId) {
      return NextResponse.json(
        { error: 'Missing required fields: firstName, lastName, email, jobId' },
        { status: 400 }
      );
    }

    const candidate = await db.candidate.create({
      data: {
        firstName, lastName, email, phone, resume,
        currentCompany, currentTitle, experience, expectedSalary,
        noticePeriod, status: status || 'applied', source,
        aiScore, skillMatch, cultureFitScore, notes, jobId,
      },
      include: { job: true },
    });

    await db.auditLog.create({
      data: {
        action: 'CREATE',
        entity: 'Candidate',
        entityId: candidate.id,
        userId: body.createdBy,
        details: `Added candidate ${firstName} ${lastName} for job`,
      },
    });

    return NextResponse.json(candidate, { status: 201 });
  } catch (error) {
    console.error('Candidates POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const db = await getDb(req);
  try {
    const body = await req.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json({ error: 'Candidate ID is required' }, { status: 400 });
    }

    const existing = await db.candidate.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });
    }

    const candidate = await db.candidate.update({
      where: { id },
      data: updateData,
      include: { job: true, _count: { select: { interviews: true } } },
    });

    await db.auditLog.create({
      data: {
        action: 'UPDATE',
        entity: 'Candidate',
        entityId: id,
        userId: body.updatedBy,
        details: `Updated candidate ${existing.firstName} ${existing.lastName}`,
      },
    });

    return NextResponse.json(candidate);
  } catch (error) {
    console.error('Candidates PUT error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
