import { NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';
import { ensureSchemaSynced, withSchemaSync } from '@/lib/schema-sync';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() });
}

// ─── GET /api/timesheets/[id] ─────────────────────────────────────
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const db = await getDb(request);
  try {
    await ensureSchemaSynced();
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: corsHeaders() });

    const { id } = await params;
    const timesheet = await withSchemaSync(() =>
      db.timesheet.findUnique({
        where: { id },
        include: {
          employee: { select: { id: true, firstName: true, lastName: true, employeeId: true, avatar: true } },
          project: { select: { id: true, name: true, code: true, currency: true, billingType: true } },
          projectTask: { select: { id: true, name: true, status: true } },
        },
      })
    );

    if (!timesheet) {
      return NextResponse.json({ error: 'Timesheet not found' }, { status: 404, headers: corsHeaders() });
    }
    return NextResponse.json({ timesheet }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Get timesheet error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}

// ─── PUT /api/timesheets/[id] ─────────────────────────────────────
// Full edit. Blocked if the row is locked (unless caller is super_admin).
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const db = await getDb(request);
  try {
    await ensureSchemaSynced();
    const { id } = await params;
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: corsHeaders() });

    const userRole = decoded.role as string;
    const existing = await withSchemaSync(() => db.timesheet.findUnique({ where: { id } }));
    if (!existing) {
      return NextResponse.json({ error: 'Timesheet not found' }, { status: 404, headers: corsHeaders() });
    }

    // REQ-SEC-12: Lock enforcement. Only super_admin can edit a locked row.
    if (existing.locked && userRole !== 'super_admin') {
      return NextResponse.json(
        { error: 'Timesheet is locked and cannot be edited. Contact a super admin to unlock.' },
        { status: 423, headers: corsHeaders() }
      );
    }

    const body = await request.json();
    const data: Record<string, unknown> = {};
    if (body.employeeId) data.employeeId = body.employeeId;
    if (body.date) data.date = new Date(body.date);
    if (body.projectId !== undefined) data.projectId = body.projectId || null;
    if (body.projectTaskId !== undefined) data.projectTaskId = body.projectTaskId || null;
    if (body.project !== undefined) data.projectText = body.project;
    if (body.task !== undefined) data.taskText = body.task;
    if (body.hours !== undefined) data.hours = parseFloat(body.hours);
    if (body.description !== undefined) data.description = body.description;
    if (body.status) data.status = body.status;

    // Hydrate project/task text from FK if FK is set but text isn't
    if (body.projectId && !body.project) {
      const p = await db.project.findUnique({ where: { id: body.projectId }, select: { name: true } });
      if (p) data.projectText = p.name;
    }
    if (body.projectTaskId && !body.task) {
      const t = await db.projectTask.findUnique({ where: { id: body.projectTaskId }, select: { name: true } });
      if (t) data.taskText = t.name;
    }

    const timesheet = await withSchemaSync(() =>
      db.timesheet.update({
        where: { id },
        data,
        include: {
          employee: { select: { firstName: true, lastName: true, employeeId: true } },
          project: { select: { id: true, name: true, code: true } },
          projectTask: { select: { id: true, name: true } },
        },
      })
    );

    return NextResponse.json({ timesheet }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Update timesheet error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}

// ─── PATCH /api/timesheets/[id] ───────────────────────────────────
// Status transitions + lock/unlock + mark invoiced.
//
// Body shape:
//   { status?, locked?, lockReason?, invoiced?, invoiceId? }
//
// Lock rules (REQ-SEC-12):
//   - Any manager / hr_admin / tenant_admin can LOCK a row.
//   - Only super_admin can UNLOCK.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const db = await getDb(request);
  try {
    await ensureSchemaSynced();
    const { id } = await params;
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: corsHeaders() });

    const userRole = decoded.role as string;
    const existing = await withSchemaSync(() => db.timesheet.findUnique({ where: { id } }));
    if (!existing) {
      return NextResponse.json({ error: 'Timesheet not found' }, { status: 404, headers: corsHeaders() });
    }

    // If already locked, only super_admin can do anything
    if (existing.locked && userRole !== 'super_admin') {
      return NextResponse.json(
        { error: 'Timesheet is locked. Only a super admin can modify it.' },
        { status: 423, headers: corsHeaders() }
      );
    }

    const body = await request.json();
    const data: Record<string, unknown> = {};

    if (body.status !== undefined) {
      data.status = body.status;
      if (body.status === 'approved') {
        data.approvedBy = decoded.userId as string;
        data.approvedAt = new Date();
      }
    }

    // Lock / unlock (REQ-SEC-12)
    if (body.locked !== undefined) {
      if (body.locked === true) {
        data.locked = true;
        data.lockedBy = decoded.userId as string;
        data.lockedAt = new Date();
        if (body.lockReason) data.lockReason = body.lockReason;
        // Locking also moves status to 'locked' for visibility
        if (existing.status !== 'approved') {
          data.status = 'locked';
        }
      } else {
        // Unlock — only super_admin
        if (userRole !== 'super_admin') {
          return NextResponse.json(
            { error: 'Only super_admin can unlock a timesheet' },
            { status: 403, headers: corsHeaders() }
          );
        }
        data.locked = false;
        data.lockedBy = null;
        data.lockedAt = null;
        data.lockReason = null;
        if (existing.status === 'locked') {
          data.status = 'approved'; // restore to approved after unlock
        }
      }
    }

    // Mark invoiced (set by the invoice generation flow)
    if (body.invoiced !== undefined) {
      data.invoiced = body.invoiced;
      if (body.invoiceId !== undefined) data.invoiceId = body.invoiceId || null;
    }

    const timesheet = await withSchemaSync(() =>
      db.timesheet.update({
        where: { id },
        data,
        include: {
          employee: { select: { firstName: true, lastName: true, employeeId: true } },
          project: { select: { id: true, name: true, code: true } },
          projectTask: { select: { id: true, name: true } },
        },
      })
    );

    // Audit log
    await db.auditLog.create({
      data: {
        userId: decoded.userId as string,
        action: body.locked === true ? 'LOCK_TIMESHEET' : body.locked === false ? 'UNLOCK_TIMESHEET' : 'UPDATE_TIMESHEET',
        module: 'timesheets',
        details: `Timesheet ${id} for ${existing.date.toISOString().split('T')[0]} — fields: ${Object.keys(data).join(', ')}`,
      },
    });

    return NextResponse.json({ timesheet }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Update timesheet error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}

// ─── DELETE /api/timesheets/[id] ──────────────────────────────────
// Blocked if locked (unless super_admin) or if invoiced (any role — invoiced
// timesheets are immutable for audit reasons).
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const db = await getDb(request);
  try {
    await ensureSchemaSynced();
    const { id } = await params;
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: corsHeaders() });

    const userRole = decoded.role as string;
    const existing = await withSchemaSync(() => db.timesheet.findUnique({ where: { id } }));
    if (!existing) {
      return NextResponse.json({ error: 'Timesheet not found' }, { status: 404, headers: corsHeaders() });
    }

    if (existing.invoiced) {
      return NextResponse.json(
        { error: 'Cannot delete an invoiced timesheet — it is linked to an invoice. Cancel the invoice first.' },
        { status: 423, headers: corsHeaders() }
      );
    }
    if (existing.locked && userRole !== 'super_admin') {
      return NextResponse.json(
        { error: 'Timesheet is locked. Only a super admin can delete it.' },
        { status: 423, headers: corsHeaders() }
      );
    }

    await withSchemaSync(() => db.timesheet.delete({ where: { id } }));

    await db.auditLog.create({
      data: {
        userId: decoded.userId as string,
        action: 'DELETE_TIMESHEET',
        module: 'timesheets',
        details: `Deleted timesheet ${id} for ${existing.date.toISOString().split('T')[0]}`,
      },
    });

    return NextResponse.json({ message: 'Timesheet deleted successfully' }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Delete timesheet error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}
