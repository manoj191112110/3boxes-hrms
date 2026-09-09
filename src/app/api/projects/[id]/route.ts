import { NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';
import { createNotification } from '@/lib/notifications';
import { ensureSchemaSynced, withSchemaSync } from '@/lib/schema-sync';
import { resolveProjectAccess, gateProjectFinancials } from '@/lib/project-rbac';

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

// ─── GET /api/projects/[id] ───────────────────────────────────────
// Returns the project. Project-Level RBAC (REQ-SEC-11) applies:
//   - If user has no access → 403
//   - If user can view but not financials → financial fields are stripped
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const db = await getDb(request);
  try {
    await ensureSchemaSynced();

    const token = getTokenFromHeaders(request);
    if (!token) {
      return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    }

    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: corsHeaders() });
    }

    const { id } = await params;

    // RBAC check
    const access = await resolveProjectAccess(decoded, id);
    if (!access.canView) {
      return NextResponse.json(
        { error: 'You do not have access to this project', access: 'denied' },
        { status: 403, headers: corsHeaders() }
      );
    }

    const project = await withSchemaSync(() =>
      db.project.findUnique({
        where: { id },
        include: {
          client: { select: { id: true, name: true, code: true, contactName: true, contactEmail: true, billingCurrency: true } },
          department: { select: { id: true, name: true, code: true } },
          company: { select: { id: true, name: true } },
          tasks: {
            include: {
              milestone: { select: { id: true, name: true } },
            },
            orderBy: { createdAt: 'desc' },
          },
          milestones: {
            include: { _count: { select: { tasks: true } } },
            orderBy: { plannedDate: 'asc' },
          },
          allocations: {
            include: {
              employee: { select: { id: true, firstName: true, lastName: true, employeeId: true, email: true } },
            },
            orderBy: { createdAt: 'desc' },
          },
          members: {
            include: {
              employee: { select: { id: true, firstName: true, lastName: true, employeeId: true, email: true } },
            },
            orderBy: { assignedAt: 'desc' },
          },
        },
      })
    );

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404, headers: corsHeaders() });
    }

    // Apply financial-field gating
    const gatedProject = gateProjectFinancials(
      project as unknown as Record<string, unknown>,
      access
    );

    return NextResponse.json(
      { project: gatedProject, access: { role: access.role, canViewFinancials: access.canViewFinancials, canEdit: access.canEdit, canManageMembers: access.canManageMembers } },
      { headers: corsHeaders() }
    );
  } catch (error) {
    console.error('Get project error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}

// ─── PUT /api/projects/[id] ───────────────────────────────────────
// RBAC: only manager / hr_admin / super_admin / tenant_admin can edit.
// Financial fields (budgetAmount, billingRate, costRate) require canViewFinancials.
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const db = await getDb(request);
  try {
    await ensureSchemaSynced();

    const token = getTokenFromHeaders(request);
    if (!token) {
      return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    }

    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: corsHeaders() });
    }

    const { id } = await params;

    // RBAC check
    const access = await resolveProjectAccess(decoded, id);
    if (!access.canView) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403, headers: corsHeaders() });
    }
    if (!access.canEdit) {
      return NextResponse.json(
        { error: 'You do not have edit permission on this project', access: 'denied' },
        { status: 403, headers: corsHeaders() }
      );
    }

    const body = await request.json();

    const existing = await db.project.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404, headers: corsHeaders() });
    }

    // Financial fields require canViewFinancials (i.e., manager / finance / hr_admin)
    const financialFields = ['budgetAmount', 'billingRate', 'costRate', 'currency', 'billingType'];
    const hasFinancialEdit = body && Object.keys(body).some((k) => financialFields.includes(k));
    if (hasFinancialEdit && !access.canViewFinancials) {
      return NextResponse.json(
        { error: 'You do not have permission to edit financial fields on this project' },
        { status: 403, headers: corsHeaders() }
      );
    }

    const updateData: Record<string, unknown> = {};
    const fields = [
      'name', 'code', 'clientId', 'departmentId', 'projectManagerId',
      'deliveryManagerId', 'projectType', 'billingType', 'currency',
      'budgetAmount', 'estimatedHours', 'actualHours', 'billingRate', 'costRate',
      'description', 'progress',
    ];
    for (const field of fields) {
      if (body[field] !== undefined) updateData[field] = body[field];
    }
    if (body.startDate !== undefined) updateData.startDate = new Date(body.startDate);
    if (body.endDate !== undefined) updateData.endDate = body.endDate ? new Date(body.endDate) : null;

    const project = await withSchemaSync(() =>
      db.project.update({
        where: { id },
        data: updateData,
        include: {
          client: { select: { id: true, name: true } },
          department: { select: { id: true, name: true } },
        },
      })
    );

    await db.auditLog.create({
      data: {
        userId: decoded.userId as string,
        action: 'UPDATE_PROJECT',
        module: 'projects',
        details: `Updated project ${id} (role: ${access.role})`,
      },
    });

    return NextResponse.json({ project }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Update project error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}

// ─── PATCH /api/projects/[id] ─────────────────────────────────────
// Same RBAC as PUT. Used for status changes.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const db = await getDb(request);
  try {
    await ensureSchemaSynced();

    const token = getTokenFromHeaders(request);
    if (!token) {
      return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    }

    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: corsHeaders() });
    }

    const { id } = await params;

    const access = await resolveProjectAccess(decoded, id);
    if (!access.canView) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403, headers: corsHeaders() });
    }
    if (!access.canEdit) {
      return NextResponse.json(
        { error: 'You do not have edit permission on this project' },
        { status: 403, headers: corsHeaders() }
      );
    }

    const body = await request.json();

    const existing = await db.project.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404, headers: corsHeaders() });
    }

    const financialFields = ['budgetAmount', 'billingRate', 'costRate', 'currency', 'billingType'];
    const hasFinancialEdit = body && Object.keys(body).some((k) => financialFields.includes(k));
    if (hasFinancialEdit && !access.canViewFinancials) {
      return NextResponse.json(
        { error: 'You do not have permission to edit financial fields on this project' },
        { status: 403, headers: corsHeaders() }
      );
    }

    const updateData: Record<string, unknown> = {};
    const fields = [
      'name', 'code', 'clientId', 'departmentId', 'projectManagerId',
      'deliveryManagerId', 'projectType', 'billingType', 'currency',
      'budgetAmount', 'estimatedHours', 'actualHours', 'billingRate', 'costRate',
      'description', 'progress', 'status',
    ];
    for (const field of fields) {
      if (body[field] !== undefined) updateData[field] = body[field];
    }
    if (body.startDate !== undefined) updateData.startDate = new Date(body.startDate);
    if (body.endDate !== undefined) updateData.endDate = body.endDate ? new Date(body.endDate) : null;

    const project = await withSchemaSync(() =>
      db.project.update({
        where: { id },
        data: updateData,
        include: {
          client: { select: { id: true, name: true } },
          department: { select: { id: true, name: true } },
        },
      })
    );

    // Notify relevant users on status change
    if (body.status && body.status !== existing.status) {
      const allocations = await db.projectAllocation.findMany({
        where: { projectId: id, status: 'active' },
        include: { employee: { include: { user: true } } },
      });

      for (const allocation of allocations) {
        if (allocation.employee.user) {
          await createNotification({
            tenantId: decoded.tenantId as string,
            userId: allocation.employee.user.id,
            title: 'Project Status Updated',
            message: `Project "${existing.name}" status changed to ${body.status}.`,
            type: body.status === 'active' ? 'success' : body.status === 'on_hold' ? 'warning' : 'info',
            category: 'system',
            link: `/projects/${id}`,
          });
        }
      }
    }

    await db.auditLog.create({
      data: {
        userId: decoded.userId as string,
        action: 'UPDATE_PROJECT',
        module: 'projects',
        details: `Updated project ${id} (role: ${access.role})`,
      },
    });

    return NextResponse.json({ project }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Patch project error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}

// ─── DELETE /api/projects/[id] ────────────────────────────────────
// Only super_admin / tenant_admin can delete. Project managers cannot
// delete their own projects (must escalate).
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const db = await getDb(request);
  try {
    await ensureSchemaSynced();

    const token = getTokenFromHeaders(request);
    if (!token) {
      return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    }

    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: corsHeaders() });
    }

    const { id } = await params;

    const userRole = decoded.role as string;
    if (userRole !== 'super_admin' && userRole !== 'tenant_admin') {
      return NextResponse.json(
        { error: 'Only super_admin or tenant_admin can delete projects' },
        { status: 403, headers: corsHeaders() }
      );
    }

    const existing = await db.project.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404, headers: corsHeaders() });
    }

    // Delete related records first (members, tasks, allocations, milestones)
    await withSchemaSync(() => db.projectMember.deleteMany({ where: { projectId: id } }));
    await db.projectTask.deleteMany({ where: { projectId: id } });
    await db.projectAllocation.deleteMany({ where: { projectId: id } });
    await db.projectMilestone.deleteMany({ where: { projectId: id } });

    // Delete the project
    await db.project.delete({ where: { id } });

    await db.auditLog.create({
      data: {
        userId: decoded.userId as string,
        action: 'DELETE_PROJECT',
        module: 'projects',
        details: `Deleted project ${existing.name} (${id})`,
      },
    });

    return NextResponse.json({ message: 'Project deleted successfully' }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Delete project error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}
