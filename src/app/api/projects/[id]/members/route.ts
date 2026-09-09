import { NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';
import { ensureSchemaSynced, withSchemaSync } from '@/lib/schema-sync';
import { resolveProjectAccess } from '@/lib/project-rbac';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() });
}

// ─── GET /api/projects/[id]/members ───────────────────────────────
// List all members on the project. Requires canView access.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const db = await getDb(request);
  try {
    await ensureSchemaSynced();

    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: corsHeaders() });

    const { id } = await params;
    const access = await resolveProjectAccess(decoded, id);
    if (!access.canView) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403, headers: corsHeaders() });
    }

    const members = await withSchemaSync(() =>
      db.projectMember.findMany({
        where: { projectId: id },
        include: {
          employee: {
            select: {
              id: true, firstName: true, lastName: true, employeeId: true, email: true, avatar: true,
              designation: { select: { id: true, name: true } },
              department: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { assignedAt: 'desc' },
      })
    );

    return NextResponse.json({ members, callerRole: access.role }, { headers: corsHeaders() });
  } catch (error) {
    console.error('List project members error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}

// ─── POST /api/projects/[id]/members ──────────────────────────────
// Add a member to the project. Requires canManageMembers.
// Body: { employeeId, role?: 'manager'|'finance'|'member'|'viewer', permissions?: string }
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const db = await getDb(request);
  try {
    await ensureSchemaSynced();

    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: corsHeaders() });

    const { id } = await params;
    const access = await resolveProjectAccess(decoded, id);
    if (!access.canManageMembers) {
      return NextResponse.json(
        { error: 'You do not have permission to manage members on this project' },
        { status: 403, headers: corsHeaders() }
      );
    }

    const body = await request.json();
    const { employeeId, role, permissions, userId } = body;

    if (!employeeId) {
      return NextResponse.json({ error: 'Missing required field: employeeId' }, { status: 400, headers: corsHeaders() });
    }

    const validRoles = ['manager', 'finance', 'member', 'viewer'];
    const finalRole = validRoles.includes(role) ? role : 'member';

    // Upsert (in case the employee is already a member, just update their role)
    const member = await withSchemaSync(() =>
      db.projectMember.upsert({
        where: {
          projectId_employeeId: { projectId: id, employeeId },
        },
        update: {
          role: finalRole,
          permissions: permissions || null,
          userId: userId || null,
        },
        create: {
          projectId: id,
          employeeId,
          userId: userId || null,
          role: finalRole,
          permissions: permissions || null,
          assignedBy: decoded.userId as string,
        },
        include: {
          employee: {
            select: {
              id: true, firstName: true, lastName: true, employeeId: true, email: true,
            },
          },
        },
      })
    );

    await db.auditLog.create({
      data: {
        userId: decoded.userId as string,
        action: 'ADD_PROJECT_MEMBER',
        module: 'projects',
        details: `Added ${employeeId} as ${finalRole} on project ${id}`,
      },
    });

    return NextResponse.json({ member }, { status: 201, headers: corsHeaders() });
  } catch (error) {
    console.error('Add project member error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}
