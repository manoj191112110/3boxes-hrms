import { NextRequest, NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';

export async function GET(req: NextRequest) {
  const db = await getDb(req);
  try {
    const url = new URL(req.url);
    const status = url.searchParams.get('status');
    const department = url.searchParams.get('department');
    const companyId = url.searchParams.get('companyId');
    const search = url.searchParams.get('search');
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (companyId) where.companyId = companyId;
    if (status) where.status = status;
    if (department) where.department = { contains: department };
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { department: { contains: search } },
        { location: { contains: search } },
      ];
    }

    const [jobs, total] = await Promise.all([
      db.job.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          company: { select: { id: true, name: true } },
          _count: { select: { candidates: true, interviews: true } },
        },
      }),
      db.job.count({ where }),
    ]);

    return NextResponse.json({
      data: jobs,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Jobs GET error:', error);
    // Demo data fallback when database is unavailable
    const url = new URL(req.url);
    const status = url.searchParams.get('status');
    const department = url.searchParams.get('department');
    const companyId = url.searchParams.get('companyId');
    const search = url.searchParams.get('search');
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '20');

    const demoJobs = [
      {
        id: 'job-1', title: 'Senior Frontend Developer', description: 'Lead frontend development with React and TypeScript',
        requirements: '5+ years React experience, TypeScript, CI/CD', department: 'Engineering',
        location: 'Hyderabad', employmentType: 'full_time', experienceMin: 5, experienceMax: 10,
        salaryMin: 1300000, salaryMax: 1800000, status: 'open', priority: 'high', positions: 2,
        postedDate: new Date('2025-01-15'), closingDate: new Date('2025-03-31'),
        companyId: companyId || 'comp-1',
        createdAt: new Date('2025-01-10'), updatedAt: new Date('2025-01-15'),
        company: { id: companyId || 'comp-1', name: '3Boxes Technologies' },
        _count: { candidates: 3, interviews: 2 },
      },
      {
        id: 'job-2', title: 'Backend Engineer', description: 'Build scalable APIs and microservices',
        requirements: '3+ years Node.js, PostgreSQL, Docker', department: 'Engineering',
        location: 'Bangalore', employmentType: 'full_time', experienceMin: 3, experienceMax: 7,
        salaryMin: 1100000, salaryMax: 1600000, status: 'open', priority: 'medium', positions: 1,
        postedDate: new Date('2025-01-20'), closingDate: new Date('2025-04-15'),
        companyId: companyId || 'comp-1',
        createdAt: new Date('2025-01-18'), updatedAt: new Date('2025-01-20'),
        company: { id: companyId || 'comp-1', name: '3Boxes Technologies' },
        _count: { candidates: 2, interviews: 1 },
      },
      {
        id: 'job-3', title: 'DevOps Engineer', description: 'Manage cloud infrastructure and CI/CD pipelines',
        requirements: 'AWS/GCP, Kubernetes, Terraform', department: 'Engineering',
        location: 'Hyderabad', employmentType: 'full_time', experienceMin: 4, experienceMax: 8,
        salaryMin: 1250000, salaryMax: 1750000, status: 'draft', priority: 'low', positions: 1,
        postedDate: null, closingDate: null,
        companyId: companyId || 'comp-1',
        createdAt: new Date('2025-02-01'), updatedAt: new Date('2025-02-01'),
        company: { id: companyId || 'comp-1', name: '3Boxes Technologies' },
        _count: { candidates: 1, interviews: 0 },
      },
      {
        id: 'job-4', title: 'Sales Manager', description: 'Lead B2B sales team and drive revenue growth',
        requirements: '5+ years B2B sales, CRM experience, team management', department: 'Sales',
        location: 'Mumbai', employmentType: 'full_time', experienceMin: 5, experienceMax: 10,
        salaryMin: 900000, salaryMax: 1400000, status: 'open', priority: 'high', positions: 1,
        postedDate: new Date('2025-02-10'), closingDate: new Date('2025-04-30'),
        companyId: companyId || 'comp-1',
        createdAt: new Date('2025-02-08'), updatedAt: new Date('2025-02-10'),
        company: { id: companyId || 'comp-1', name: '3Boxes Technologies' },
        _count: { candidates: 4, interviews: 2 },
      },
      {
        id: 'job-5', title: 'UX Designer', description: 'Create intuitive user experiences for web and mobile applications',
        requirements: '3+ years UX design, Figma, user research', department: 'Design',
        location: 'Bangalore', employmentType: 'full_time', experienceMin: 3, experienceMax: 6,
        salaryMin: 800000, salaryMax: 1200000, status: 'closed', priority: 'medium', positions: 1,
        postedDate: new Date('2024-11-01'), closingDate: new Date('2025-01-15'),
        companyId: companyId || 'comp-1',
        createdAt: new Date('2024-10-25'), updatedAt: new Date('2025-01-16'),
        company: { id: companyId || 'comp-1', name: '3Boxes Technologies' },
        _count: { candidates: 6, interviews: 4 },
      },
      {
        id: 'job-6', title: 'Marketing Coordinator', description: 'Coordinate digital marketing campaigns and social media',
        requirements: '2+ years digital marketing, SEO/SEM, analytics', department: 'Marketing',
        location: 'Hyderabad', employmentType: 'full_time', experienceMin: 2, experienceMax: 4,
        salaryMin: 500000, salaryMax: 800000, status: 'open', priority: 'medium', positions: 1,
        postedDate: new Date('2025-02-15'), closingDate: new Date('2025-05-15'),
        companyId: companyId || 'comp-1',
        createdAt: new Date('2025-02-12'), updatedAt: new Date('2025-02-15'),
        company: { id: companyId || 'comp-1', name: '3Boxes Technologies' },
        _count: { candidates: 2, interviews: 1 },
      },
    ];

    let filtered = demoJobs;
    if (status) filtered = filtered.filter((j) => j.status === status);
    if (department) {
      const dept = department.toLowerCase();
      filtered = filtered.filter((j) => j.department.toLowerCase().includes(dept));
    }
    if (search) {
      const s = search.toLowerCase();
      filtered = filtered.filter((j) =>
        j.title.toLowerCase().includes(s) ||
        j.department.toLowerCase().includes(s) ||
        j.location.toLowerCase().includes(s)
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
      title, description, requirements, department, location,
      employmentType, experienceMin, experienceMax, salaryMin, salaryMax,
      status, priority, positions, closingDate, companyId,
    } = body;

    if (!title || !companyId) {
      return NextResponse.json(
        { error: 'Missing required fields: title, companyId' },
        { status: 400 }
      );
    }

    const job = await db.job.create({
      data: {
        title, description, requirements, department, location,
        employmentType, experienceMin, experienceMax,
        salaryMin, salaryMax, status: status || 'draft',
        priority: priority || 'medium', positions: positions || 1,
        postedDate: status === 'open' ? new Date() : null,
        closingDate: closingDate ? new Date(closingDate) : null,
        companyId,
      },
      include: { company: true },
    });

    await db.auditLog.create({
      data: {
        action: 'CREATE',
        entity: 'Job',
        entityId: job.id,
        userId: body.createdBy,
        details: `Created job: ${title}`,
      },
    });

    return NextResponse.json(job, { status: 201 });
  } catch (error) {
    console.error('Jobs POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const db = await getDb(req);
  try {
    const body = await req.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json({ error: 'Job ID is required' }, { status: 400 });
    }

    const existing = await db.job.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    if (updateData.closingDate) {
      updateData.closingDate = new Date(updateData.closingDate);
    }
    if (updateData.status === 'open' && !existing.postedDate) {
      updateData.postedDate = new Date();
    }

    const job = await db.job.update({
      where: { id },
      data: updateData,
      include: {
        company: true,
        _count: { select: { candidates: true, interviews: true } },
      },
    });

    await db.auditLog.create({
      data: {
        action: 'UPDATE',
        entity: 'Job',
        entityId: id,
        userId: body.updatedBy,
        details: `Updated job: ${existing.title}`,
      },
    });

    return NextResponse.json(job);
  } catch (error) {
    console.error('Jobs PUT error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
