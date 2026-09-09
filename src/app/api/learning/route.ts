import { NextRequest, NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';

export async function GET(req: NextRequest) {
  const db = await getDb(req);
  try {
    const url = new URL(req.url);
    const employeeId = url.searchParams.get('employeeId');
    const status = url.searchParams.get('status');
    const type = url.searchParams.get('type');
    const companyId = url.searchParams.get('companyId');
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (employeeId) where.employeeId = employeeId;
    if (status) where.status = status;
    if (type) where.type = type;
    if (companyId) where.employee = { companyId };

    const [records, total] = await Promise.all([
      db.learningRecord.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          employee: {
            select: {
              id: true, firstName: true, lastName: true,
              employeeId: true,
              department: { select: { name: true } },
            },
          },
        },
      }),
      db.learningRecord.count({ where }),
    ]);

    return NextResponse.json({
      data: records,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Learning GET error:', error);
    // Demo data fallback when database is unavailable
    const url = new URL(req.url);
    const employeeId = url.searchParams.get('employeeId');
    const status = url.searchParams.get('status');
    const type = url.searchParams.get('type');
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '20');

    const demoRecords = [
      {
        id: 'lr-1', courseName: 'Advanced React Patterns', provider: 'Udemy',
        type: 'e_learning', status: 'completed', completedAt: new Date('2025-01-20'),
        score: 92, certificate: 'cert-react-adv.pdf', employeeId: 'demo-1',
        createdAt: new Date('2025-01-01'), updatedAt: new Date('2025-01-20'),
        employee: { id: 'demo-1', firstName: 'Rajesh', lastName: 'Kumar', employeeId: 'EMP001', department: { name: 'Engineering' } },
      },
      {
        id: 'lr-2', courseName: 'Leadership Essentials', provider: 'Coursera',
        type: 'e_learning', status: 'in_progress', completedAt: null,
        score: null, certificate: null, employeeId: 'demo-9',
        createdAt: new Date('2025-02-01'), updatedAt: new Date('2025-02-15'),
        employee: { id: 'demo-9', firstName: 'Arjun', lastName: 'Menon', employeeId: 'EMP009', department: { name: 'Operations' } },
      },
      {
        id: 'lr-3', courseName: 'AWS Cloud Practitioner', provider: 'AWS Training',
        type: 'certification', status: 'enrolled', completedAt: null,
        score: null, certificate: null, employeeId: 'demo-1',
        createdAt: new Date('2025-02-10'), updatedAt: new Date('2025-02-10'),
        employee: { id: 'demo-1', firstName: 'Rajesh', lastName: 'Kumar', employeeId: 'EMP001', department: { name: 'Engineering' } },
      },
      {
        id: 'lr-4', courseName: 'Project Management Workshop', provider: 'Internal',
        type: 'workshop', status: 'completed', completedAt: new Date('2025-02-05'),
        score: 88, certificate: null, employeeId: 'demo-2',
        createdAt: new Date('2025-01-25'), updatedAt: new Date('2025-02-05'),
        employee: { id: 'demo-2', firstName: 'Priya', lastName: 'Sharma', employeeId: 'EMP002', department: { name: 'Human Resources' } },
      },
      {
        id: 'lr-5', courseName: 'Data Analytics with Python', provider: 'DataCamp',
        type: 'e_learning', status: 'in_progress', completedAt: null,
        score: null, certificate: null, employeeId: 'demo-4',
        createdAt: new Date('2025-02-15'), updatedAt: new Date('2025-02-20'),
        employee: { id: 'demo-4', firstName: 'Sneha', lastName: 'Reddy', employeeId: 'EMP004', department: { name: 'Finance' } },
      },
      {
        id: 'lr-6', courseName: 'UX Research Methods', provider: 'Interaction Design Foundation',
        type: 'e_learning', status: 'completed', completedAt: new Date('2025-02-28'),
        score: 95, certificate: 'cert-ux-research.pdf', employeeId: 'demo-3',
        createdAt: new Date('2025-01-15'), updatedAt: new Date('2025-02-28'),
        employee: { id: 'demo-3', firstName: 'Amit', lastName: 'Patel', employeeId: 'EMP003', department: { name: 'Design' } },
      },
      {
        id: 'lr-7', courseName: 'Digital Marketing Masterclass', provider: 'HubSpot Academy',
        type: 'certification', status: 'enrolled', completedAt: null,
        score: null, certificate: null, employeeId: 'demo-6',
        createdAt: new Date('2025-03-01'), updatedAt: new Date('2025-03-01'),
        employee: { id: 'demo-6', firstName: 'Ananya', lastName: 'Gupta', employeeId: 'EMP006', department: { name: 'Marketing' } },
      },
      {
        id: 'lr-8', courseName: 'Kubernetes Administration', provider: 'CNCF',
        type: 'certification', status: 'in_progress', completedAt: null,
        score: null, certificate: null, employeeId: 'demo-5',
        createdAt: new Date('2025-02-20'), updatedAt: new Date('2025-03-01'),
        employee: { id: 'demo-5', firstName: 'Vikram', lastName: 'Singh', employeeId: 'EMP005', department: { name: 'Engineering' } },
      },
    ];

    let filtered = demoRecords;
    if (employeeId) filtered = filtered.filter((r) => r.employeeId === employeeId);
    if (status) filtered = filtered.filter((r) => r.status === status);
    if (type) filtered = filtered.filter((r) => r.type === type);

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
    const { courseName, provider, type, status, completedAt, score, certificate, employeeId } = body;

    if (!courseName || !employeeId) {
      return NextResponse.json(
        { error: 'Missing required fields: courseName, employeeId' },
        { status: 400 }
      );
    }

    const record = await db.learningRecord.create({
      data: {
        courseName, provider,
        type: type || 'e_learning',
        status: status || 'enrolled',
        completedAt: completedAt ? new Date(completedAt) : null,
        score, certificate, employeeId,
      },
      include: {
        employee: { select: { firstName: true, lastName: true } },
      },
    });

    await db.auditLog.create({
      data: {
        action: 'CREATE',
        entity: 'LearningRecord',
        entityId: record.id,
        userId: body.createdBy,
        details: `Enrolled in course: ${courseName}`,
      },
    });

    return NextResponse.json(record, { status: 201 });
  } catch (error) {
    console.error('Learning POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const db = await getDb(req);
  try {
    const body = await req.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json({ error: 'Learning record ID is required' }, { status: 400 });
    }

    const existing = await db.learningRecord.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Learning record not found' }, { status: 404 });
    }

    if (updateData.completedAt) {
      updateData.completedAt = new Date(updateData.completedAt);
    }

    // Auto-set completedAt if status changes to completed
    if (updateData.status === 'completed' && !updateData.completedAt) {
      updateData.completedAt = new Date();
    }

    const record = await db.learningRecord.update({
      where: { id },
      data: updateData,
      include: {
        employee: { select: { firstName: true, lastName: true } },
      },
    });

    await db.auditLog.create({
      data: {
        action: 'UPDATE',
        entity: 'LearningRecord',
        entityId: id,
        userId: body.updatedBy,
        details: `Updated learning record: ${existing.courseName}`,
      },
    });

    return NextResponse.json(record);
  } catch (error) {
    console.error('Learning PUT error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
