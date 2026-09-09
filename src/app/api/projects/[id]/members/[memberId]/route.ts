import { NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';
import { ensureSchemaSynced, withSchemaSync } from '@/lib/schema-sync';
import { resolveProjectAccess } from '@/lib/project-rbac';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() });
}

// ─── PATCH /api/projects/[id]/members/[memberId] ──────────────────
// Change a member's role. Requires canManageMembers.
// Body: { role?, permissions? }
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  const db = await getDb(request);
  try {
    await ensureSchemaSynced();

    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: corsHeaders() });

    const { id, memberId } = await params;
    const access = await resolveProjectAccess(decoded, id);
    if (!access.canManageMembers) {
      return NextResponse.json(
        { error: 'You do not have permission to manage members on this project' },
        { status: 403, headers: corsHeaders() }
      );
    }

    const body = await request.json();
    const updateData: Record<string, unknown> = {};
    if (body.role) {
      const validRoles = ['manager', 'finance', 'member', 'viewer'];
      if (!validRoles.includes(body.role)) {
        return NextResponse.json({ error: `Invalid role. Must be one of: ${validRoles.join(', ')}` }, { status: 400, headers: corsHeaders() });
      }
      updateData.role = body.role;
    }
    if (body.permissions !== undefined) updateData.permissions = body.permissions || null;

    const member = await withSchemaSync(() =>
      db.projectMember.update({
        where: { id: memberId },
        data: updateData,
        include: {
          employee: { select: { id: true, firstName: true, lastName: true, employeeId: true, email: true } },
        },
      })
    );

    await db.auditLog.create({
      data: {
        userId: decoded.userId as string,
        action: 'UPDATE_PROJECT_MEMBER',
        module: 'projects',
        details: `Updated member ${memberId} on project ${id}: ${Object.keys(updateData).join(', ')}`,
      },
    });

    return NextResponse.json({ member }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Update project member error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}

// ─── DELETE /api/projects/[id]/members/[memberId] ─────────────────
// Remove a member from the project. Requires canManageMembers.
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  const db = await getDb(request);
  try {
    await ensureSchemaSynced();

    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: corsHeaders() });

    const { id, memberId } = await params;
    const access = await resolveProjectAccess(decoded, id);
    if (!access.canManageMembers) {
      return NextResponse.json(
        { error: 'You do not have permission to manage members on this project' },
        { status: 403, headers: corsHeaders() }
      );
    }

    await withSchemaSync(() => db.projectMember.delete({ where: { id: memberId } }));

    await db.auditLog.create({
      data: {
        userId: decoded.userId as string,
        action: 'REMOVE_PROJECT_MEMBER',
        module: 'projects',
        details: `Removed member ${memberId} from project ${id}`,
      },
    });

    return NextResponse.json({ success: true }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Remove project member error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}
