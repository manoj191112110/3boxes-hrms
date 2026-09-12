import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';
import { withSchemaSync } from '@/lib/schema-sync';

/** GET /api/todo?status=Pending&priority=High&companyId=xxx */
export async function GET(request: NextRequest) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    await withSchemaSync(() => Promise.resolve());
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const priority = searchParams.get('priority');
    const category = searchParams.get('category');
    const companyId = searchParams.get('companyId');

    const employee = await db.employee.findFirst({ where: { userId: decoded.userId as string } });
    if (!employee) return NextResponse.json({ tasks: [] });

    const where: Record<string, unknown> = {
      isActive: true,
      OR: [{ createdById: employee.id }, { assignedToId: employee.id }],
    };
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (category) where.category = category;
    if (companyId) where.companyId = companyId;

    const tasks = await db.todoTask.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        assignee: { select: { id: true, firstName: true, lastName: true, avatar: true } },
        creator: { select: { id: true, firstName: true, lastName: true, avatar: true } },
      },
    });

    const parsed = tasks.map(t => ({
      ...t,
      subtasks: t.subtasks ? JSON.parse(t.subtasks) : [],
      tags: t.tags ? JSON.parse(t.tags) : [],
    }));

    return NextResponse.json({ tasks: parsed });
  } catch (error) {
    console.error('GET todo error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** POST /api/todo — Create task */
export async function POST(request: NextRequest) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const body = await request.json();
    const { title, description, priority = 'Medium', status = 'Pending', category, dueDate, assignedToId, companyId, subtasks, tags } = body;

    if (!title) return NextResponse.json({ error: 'title is required' }, { status: 400 });

    const employee = await db.employee.findFirst({ where: { userId: decoded.userId as string } });
    if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });

    const task = await db.todoTask.create({
      data: {
        title,
        description,
        priority,
        status,
        category,
        dueDate: dueDate ? new Date(dueDate) : null,
        assignedToId: assignedToId || null,
        createdById: employee.id,
        companyId: companyId || employee.companyId || null,
        subtasks: subtasks ? JSON.stringify(subtasks) : null,
        tags: tags ? JSON.stringify(tags) : null,
      },
      include: {
        assignee: { select: { id: true, firstName: true, lastName: true, avatar: true } },
        creator: { select: { id: true, firstName: true, lastName: true, avatar: true } },
      },
    });

    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    console.error('POST todo error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** PATCH /api/todo — Update task */
export async function PATCH(request: NextRequest) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const body = await request.json();
    const { id, ...updates } = body;
    if (!id) return NextResponse.json({ error: 'Task id is required' }, { status: 400 });

    if (updates.dueDate) updates.dueDate = new Date(updates.dueDate);
    if (updates.status === 'Completed') updates.completedAt = new Date();
    if (updates.subtasks) updates.subtasks = JSON.stringify(updates.subtasks);
    if (updates.tags) updates.tags = JSON.stringify(updates.tags);

    const task = await db.todoTask.update({
      where: { id },
      data: updates,
      include: {
        assignee: { select: { id: true, firstName: true, lastName: true, avatar: true } },
      },
    });

    return NextResponse.json({ task });
  } catch (error) {
    console.error('PATCH todo error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** DELETE /api/todo?id=xxx */
export async function DELETE(request: NextRequest) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Task id is required' }, { status: 400 });

    const task = await db.todoTask.update({ where: { id }, data: { isActive: false } });
    return NextResponse.json({ task });
  } catch (error) {
    console.error('DELETE todo error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
