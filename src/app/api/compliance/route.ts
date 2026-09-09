import { NextRequest, NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';

export async function GET(req: NextRequest) {
  const db = await getDb(req);
  try {
    const url = new URL(req.url);
    const companyId = url.searchParams.get('companyId');
    const status = url.searchParams.get('status');
    const category = url.searchParams.get('category');
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (companyId) where.companyId = companyId;
    if (status) where.status = status;
    if (category) where.category = category;

    const [items, total] = await Promise.all([
      db.complianceItem.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      db.complianceItem.count({ where }),
    ]);

    // Compute overdue count
    const overdueCount = await db.complianceItem.count({
      where: {
        ...where,
        status: 'pending',
        dueDate: { lt: new Date() },
      },
    });

    return NextResponse.json({
      data: items,
      overdueCount,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Compliance GET error:', error);
    // Demo data fallback when database is unavailable
    const url = new URL(req.url);
    const companyId = url.searchParams.get('companyId');
    const status = url.searchParams.get('status');
    const category = url.searchParams.get('category');
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '20');

    const demoItems = [
      {
        id: 'compliance-1', title: 'Annual Safety Training', description: 'Complete mandatory workplace safety training',
        category: 'safety', dueDate: new Date('2025-04-01'), status: 'pending', assignee: 'HR Department',
        companyId: companyId || 'comp-1', createdAt: new Date('2025-01-15'), updatedAt: new Date('2025-01-15'),
      },
      {
        id: 'compliance-2', title: 'Data Privacy Compliance', description: 'Ensure GDPR and data privacy compliance across all systems',
        category: 'legal', dueDate: new Date('2025-03-15'), status: 'completed', assignee: 'Legal Team',
        companyId: companyId || 'comp-1', createdAt: new Date('2025-01-10'), updatedAt: new Date('2025-02-20'),
      },
      {
        id: 'compliance-3', title: 'Fire Drill Certification', description: 'Annual fire drill and evacuation certification for all branches',
        category: 'safety', dueDate: new Date('2025-02-01'), status: 'overdue', assignee: 'Facilities',
        companyId: companyId || 'comp-1', createdAt: new Date('2025-01-01'), updatedAt: new Date('2025-01-01'),
      },
      {
        id: 'compliance-4', title: 'Financial Audit 2025', description: 'Complete annual financial audit requirements for FY2024-25',
        category: 'financial', dueDate: new Date('2025-06-30'), status: 'pending', assignee: 'Finance Team',
        companyId: companyId || 'comp-1', createdAt: new Date('2025-02-01'), updatedAt: new Date('2025-02-01'),
      },
      {
        id: 'compliance-5', title: 'Employee Handbook Update', description: 'Update employee handbook with new policies and benefits',
        category: 'hr', dueDate: new Date('2025-05-01'), status: 'in_progress', assignee: 'HR Department',
        companyId: companyId || 'comp-1', createdAt: new Date('2025-02-10'), updatedAt: new Date('2025-02-15'),
      },
      {
        id: 'compliance-6', title: 'ISO 27001 Recertification', description: 'Information security management system recertification audit',
        category: 'legal', dueDate: new Date('2025-09-30'), status: 'pending', assignee: 'IT Security',
        companyId: companyId || 'comp-1', createdAt: new Date('2025-03-01'), updatedAt: new Date('2025-03-01'),
      },
      {
        id: 'compliance-7', title: 'Sexual Harassment Prevention Training', description: 'Mandatory POSH training for all employees',
        category: 'hr', dueDate: new Date('2025-03-31'), status: 'in_progress', assignee: 'HR Department',
        companyId: companyId || 'comp-1', createdAt: new Date('2025-02-15'), updatedAt: new Date('2025-03-01'),
      },
    ];

    let filtered = demoItems;
    if (status) filtered = filtered.filter((i) => i.status === status);
    if (category) filtered = filtered.filter((i) => i.category === category);

    const overdueCount = filtered.filter((i) => i.status === 'pending' && i.dueDate < new Date()).length;

    return NextResponse.json({
      data: filtered,
      overdueCount,
      pagination: { page, limit, total: filtered.length, totalPages: Math.ceil(filtered.length / limit) },
    });
  }
}

export async function POST(req: NextRequest) {
  const db = await getDb(req);
  try {
    const body = await req.json();
    const { title, description, category, dueDate, status, assignee, companyId } = body;

    if (!title || !category || !companyId) {
      return NextResponse.json(
        { error: 'Missing required fields: title, category, companyId' },
        { status: 400 }
      );
    }

    const item = await db.complianceItem.create({
      data: {
        title, description, category,
        dueDate: dueDate ? new Date(dueDate) : null,
        status: status || 'pending',
        assignee, companyId,
      },
    });

    await db.auditLog.create({
      data: {
        action: 'CREATE',
        entity: 'ComplianceItem',
        entityId: item.id,
        userId: body.createdBy,
        details: `Compliance item created: ${title}`,
      },
    });

    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    console.error('Compliance POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const db = await getDb(req);
  try {
    const body = await req.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json({ error: 'Compliance item ID is required' }, { status: 400 });
    }

    const existing = await db.complianceItem.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Compliance item not found' }, { status: 404 });
    }

    if (updateData.dueDate) {
      updateData.dueDate = new Date(updateData.dueDate);
    }

    const item = await db.complianceItem.update({
      where: { id },
      data: updateData,
    });

    await db.auditLog.create({
      data: {
        action: 'UPDATE',
        entity: 'ComplianceItem',
        entityId: id,
        userId: body.updatedBy,
        details: `Compliance item updated: ${existing.title}`,
      },
    });

    return NextResponse.json(item);
  } catch (error) {
    console.error('Compliance PUT error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
