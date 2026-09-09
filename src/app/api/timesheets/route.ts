import { NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';
import { ensureSchemaSynced, withSchemaSync } from '@/lib/schema-sync';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() });
}

// ─── GET /api/timesheets ──────────────────────────────────────────
// List timesheets with filters. Supports projectId (FK), status, employeeId,
// date range, invoiced, locked.
export async function GET(request: Request) {
  const db = await getDb(request);
  try {
    await ensureSchemaSynced();

    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: corsHeaders() });

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status');
    const employeeId = searchParams.get('employeeId');
    const projectId = searchParams.get('projectId');
    const projectTaskId = searchParams.get('projectTaskId');
    const invoiced = searchParams.get('invoiced');
    const locked = searchParams.get('locked');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (employeeId) where.employeeId = employeeId;
    if (projectId) where.projectId = projectId;
    if (projectTaskId) where.projectTaskId = projectTaskId;
    if (invoiced !== null && invoiced !== undefined && invoiced !== '') where.invoiced = invoiced === 'true';
    if (locked !== null && locked !== undefined && locked !== '') where.locked = locked === 'true';
    if (dateFrom || dateTo) {
      const d: Record<string, unknown> = {};
      if (dateFrom) d.gte = new Date(dateFrom);
      if (dateTo) d.lte = new Date(dateTo);
      where.date = d;
    }

    const [timesheets, total] = await Promise.all([
      withSchemaSync(() =>
        db.timesheet.findMany({
          where,
          include: {
            employee: { select: { id: true, firstName: true, lastName: true, employeeId: true, avatar: true } },
            project: { select: { id: true, name: true, code: true, currency: true, billingType: true } },
            projectTask: { select: { id: true, name: true, status: true } },
          },
          orderBy: { date: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        })
      ),
      withSchemaSync(() => db.timesheet.count({ where })),
    ]);

    return NextResponse.json({ timesheets, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Get timesheets error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}

// ─── POST /api/timesheets ─────────────────────────────────────────
// Create a timesheet entry. Now accepts projectId / projectTaskId (FKs) and
// keeps backward compat with the old `project` / `task` free-text fields.
// If projectId is provided, we hydrate the legacy `project` text field with
// the project's name automatically.
//
// NOTE: The previous @@unique([employeeId, date]) constraint is GONE —
// employees can now log time against multiple projects on the same day.
export async function POST(request: Request) {
  const db = await getDb(request);
  try {
    await ensureSchemaSynced();

    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: corsHeaders() });

    const body = await request.json();
    const { employeeId, date, projectId, projectTaskId, project, task, hours, description, status } = body;

    if (!employeeId || !date || hours === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400, headers: corsHeaders() });
    }

    // If projectId is provided, look up the project name for the legacy `project` text column
    let projectText = project;
    let taskText = task;
    if (projectId && !projectText) {
      const p = await db.project.findUnique({ where: { id: projectId }, select: { name: true } });
      if (p) projectText = p.name;
    }
    if (projectTaskId && !taskText) {
      const t = await db.projectTask.findUnique({ where: { id: projectTaskId }, select: { name: true } });
      if (t) taskText = t.name;
    }

    const timesheet = await withSchemaSync(() =>
      db.timesheet.create({
        data: {
          employeeId,
          date: new Date(date),
          projectId: projectId || null,
          projectTaskId: projectTaskId || null,
          projectText: projectText || null,
          taskText: taskText || null,
          hours: parseFloat(hours),
          description,
          status: status || 'submitted',
        },
        include: {
          employee: { select: { firstName: true, lastName: true, employeeId: true } },
          project: { select: { id: true, name: true, code: true } },
          projectTask: { select: { id: true, name: true } },
        },
      })
    );

    return NextResponse.json({ timesheet }, { status: 201, headers: corsHeaders() });
  } catch (error) {
    console.error('Create timesheet error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}
