import { NextRequest, NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';

export async function GET(req: NextRequest) {
  const db = await getDb(req);
  try {
    const url = new URL(req.url);
    const userId = url.searchParams.get('userId');
    const action = url.searchParams.get('action');
    const entity = url.searchParams.get('entity');
    const entityId = url.searchParams.get('entityId');
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (userId) where.userId = userId;
    if (action) where.action = action;
    if (entity) where.entity = entity;
    if (entityId) where.entityId = entityId;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) (where.createdAt as Record<string, unknown>).gte = new Date(startDate);
      if (endDate) (where.createdAt as Record<string, unknown>).lte = new Date(endDate);
    }

    const [logs, total] = await Promise.all([
      db.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { id: true, name: true, email: true, avatar: true },
          },
        },
      }),
      db.auditLog.count({ where }),
    ]);

    // Action type summary
    const actionSummary = await db.auditLog.groupBy({
      by: ['action'],
      where,
      _count: { id: true },
    });

    // Entity type summary
    const entitySummary = await db.auditLog.groupBy({
      by: ['entity'],
      where,
      _count: { id: true },
    });

    return NextResponse.json({
      data: logs,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      summary: {
        byAction: actionSummary.map((a) => ({ action: a.action, count: a._count.id })),
        byEntity: entitySummary.map((e) => ({ entity: e.entity, count: e._count.id })),
      },
    });
  } catch (error) {
    console.error('Audit GET error:', error);
    // Demo data fallback when database is unavailable
    const url = new URL(req.url);
    const userId = url.searchParams.get('userId');
    const action = url.searchParams.get('action');
    const entity = url.searchParams.get('entity');
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '20');

    const demoLogs = [
      {
        id: 'al-1', action: 'CREATE', entity: 'Leave', entityId: 'leave-1',
        details: 'Leave request submitted: casual for May 20-21', userId: 'demo-user-1', ipAddress: '192.168.1.100',
        createdAt: new Date('2025-02-25T10:00:00Z'), updatedAt: new Date('2025-02-25T10:00:00Z'),
        user: { id: 'demo-user-1', name: 'Rajesh Kumar', email: 'rajesh.kumar@3boxeshrms.com', avatar: null },
      },
      {
        id: 'al-2', action: 'APPROVE', entity: 'ExpenseClaim', entityId: 'exp-2',
        details: 'Expense claim approved: ₹8,500', userId: 'demo-user-9', ipAddress: '192.168.1.101',
        createdAt: new Date('2025-02-24T14:30:00Z'), updatedAt: new Date('2025-02-24T14:30:00Z'),
        user: { id: 'demo-user-9', name: 'Arjun Menon', email: 'arjun.menon@3boxeshrms.com', avatar: null },
      },
      {
        id: 'al-3', action: 'UPDATE', entity: 'Employee', entityId: 'demo-5',
        details: 'Employee profile updated: Vikram Singh', userId: 'demo-user-5', ipAddress: '192.168.1.102',
        createdAt: new Date('2025-02-20T09:15:00Z'), updatedAt: new Date('2025-02-20T09:15:00Z'),
        user: { id: 'demo-user-5', name: 'Vikram Singh', email: 'vikram.singh@3boxeshrms.com', avatar: null },
      },
      {
        id: 'al-4', action: 'REJECT', entity: 'TravelRequest', entityId: 'tr-3',
        details: 'Travel request rejected: Budget constraints for international travel', userId: 'demo-user-10', ipAddress: '192.168.1.103',
        createdAt: new Date('2025-02-18T16:45:00Z'), updatedAt: new Date('2025-02-18T16:45:00Z'),
        user: { id: 'demo-user-10', name: 'Meera Joshi', email: 'meera.joshi@3boxeshrms.com', avatar: null },
      },
      {
        id: 'al-5', action: 'CREATE', entity: 'Ticket', entityId: 'tkt-1',
        details: 'Ticket created: VPN Connection Issues', userId: 'demo-user-1', ipAddress: '192.168.1.100',
        createdAt: new Date('2025-02-15T11:00:00Z'), updatedAt: new Date('2025-02-15T11:00:00Z'),
        user: { id: 'demo-user-1', name: 'Rajesh Kumar', email: 'rajesh.kumar@3boxeshrms.com', avatar: null },
      },
      {
        id: 'al-6', action: 'CREATE', entity: 'Employee', entityId: 'demo-5',
        details: 'New employee onboarded: Vikram Singh - DevOps Engineer', userId: 'demo-user-2', ipAddress: '192.168.1.101',
        createdAt: new Date('2025-01-08T10:00:00Z'), updatedAt: new Date('2025-01-08T10:00:00Z'),
        user: { id: 'demo-user-2', name: 'Priya Sharma', email: 'priya.sharma@3boxeshrms.com', avatar: null },
      },
      {
        id: 'al-7', action: 'UPDATE', entity: 'PayrollRecord', entityId: 'pay-1',
        details: 'Payroll status updated to paid for Rajesh Kumar', userId: 'demo-user-10', ipAddress: '192.168.1.103',
        createdAt: new Date('2025-02-01T06:00:00Z'), updatedAt: new Date('2025-02-01T06:00:00Z'),
        user: { id: 'demo-user-10', name: 'Meera Joshi', email: 'meera.joshi@3boxeshrms.com', avatar: null },
      },
    ];

    let filtered = demoLogs;
    if (userId) filtered = filtered.filter((l) => l.userId === userId);
    if (action) filtered = filtered.filter((l) => l.action === action);
    if (entity) filtered = filtered.filter((l) => l.entity === entity);

    // Build summary from filtered data
    const byAction: Record<string, number> = {};
    const byEntity: Record<string, number> = {};
    for (const log of filtered) {
      byAction[log.action] = (byAction[log.action] || 0) + 1;
      byEntity[log.entity] = (byEntity[log.entity] || 0) + 1;
    }

    return NextResponse.json({
      data: filtered,
      pagination: { page, limit, total: filtered.length, totalPages: Math.ceil(filtered.length / limit) },
      summary: {
        byAction: Object.entries(byAction).map(([a, count]) => ({ action: a, count })),
        byEntity: Object.entries(byEntity).map(([e, count]) => ({ entity: e, count })),
      },
    });
  }
}

export async function POST(req: NextRequest) {
  const db = await getDb(req);
  try {
    const body = await req.json();
    const { action, entity, entityId, details, userId, ipAddress } = body;

    if (!action || !entity) {
      return NextResponse.json(
        { error: 'Missing required fields: action, entity' },
        { status: 400 }
      );
    }

    const log = await db.auditLog.create({
      data: {
        action,
        entity,
        entityId,
        details,
        userId,
        ipAddress,
      },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return NextResponse.json(log, { status: 201 });
  } catch (error) {
    console.error('Audit POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
