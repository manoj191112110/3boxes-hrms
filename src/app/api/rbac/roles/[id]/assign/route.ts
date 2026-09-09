import { NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { resolveAuthenticatedUser } from '@/lib/auth-resolve';

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

// POST /api/rbac/roles/[id]/assign - Assign role to users
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const db = await getDb(request);
  try {
    const { user } = await resolveAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404, headers: corsHeaders() }
      );
    }

    // Only super_admin and tenant_admin can assign roles
    if (user.role !== 'super_admin' && user.role !== 'tenant_admin') {
      return NextResponse.json(
        { error: 'Insufficient permissions to assign roles' },
        { status: 403, headers: corsHeaders() }
      );
    }

    const { id: roleId } = await params;
    const body = await request.json();
    const { userId, userIds, companyId } = body as {
      userId?: string;
      userIds?: string[];
      companyId?: string;
    };

    // Support both single userId and array of userIds
    let targetUserIds: string[] = [];
    if (userIds && Array.isArray(userIds)) {
      targetUserIds = userIds;
    } else if (userId) {
      targetUserIds = [userId];
    }

    if (targetUserIds.length === 0) {
      return NextResponse.json(
        { error: 'userId or userIds is required' },
        { status: 400, headers: corsHeaders() }
      );
    }

    // Verify the role exists
    const role = await db.role.findUnique({
      where: { id: roleId },
    });

    if (!role) {
      return NextResponse.json(
        { error: 'Role not found' },
        { status: 404, headers: corsHeaders() }
      );
    }

    // Tenant admin can only assign roles within their tenant
    if (user.role === 'tenant_admin') {
      if (role.tenantId !== user.tenantId && role.tenantId !== null) {
        return NextResponse.json(
          { error: 'Cannot assign roles outside your tenant' },
          { status: 403, headers: corsHeaders() }
        );
      }
    }

    // Verify that all users exist and are within the allowed scope
    const targetUsers = await db.user.findMany({
      where: { id: { in: targetUserIds } },
    });

    if (targetUsers.length !== targetUserIds.length) {
      const foundIds = new Set(targetUsers.map((u) => u.id));
      const invalidIds = targetUserIds.filter((id) => !foundIds.has(id));
      return NextResponse.json(
        { error: `Users not found: ${invalidIds.join(', ')}` },
        { status: 400, headers: corsHeaders() }
      );
    }

    // Tenant admin can only assign roles to users in their tenant
    if (user.role === 'tenant_admin') {
      const outsideTenant = targetUsers.filter((u) => u.tenantId !== user.tenantId);
      if (outsideTenant.length > 0) {
        return NextResponse.json(
          { error: 'Cannot assign roles to users outside your tenant' },
          { status: 403, headers: corsHeaders() }
        );
      }
    }

    // Create role assignments (skip duplicates)
    const assignmentsCreated: string[] = [];
    const assignmentsSkipped: string[] = [];

    for (const userId of targetUserIds) {
      try {
        await db.userRoleAssignment.create({
          data: {
            userId,
            roleId,
            companyId: companyId || null,
            assignedBy: user.id,
          },
        });
        assignmentsCreated.push(userId);
      } catch (error) {
        // Unique constraint violation means already assigned
        if (
          error instanceof Error &&
          (error.message.includes('Unique constraint') ||
            error.message.includes('unique'))
        ) {
          assignmentsSkipped.push(userId);
        } else {
          throw error;
        }
      }
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Role assignments processed',
        data: {
          roleId,
          roleKey: role.key,
          roleName: role.name,
          companyId: companyId || null,
          assigned: assignmentsCreated.length,
          skipped: assignmentsSkipped.length,
          assignedUserIds: assignmentsCreated,
          skippedUserIds: assignmentsSkipped,
        },
      },
      { headers: corsHeaders() }
    );
  } catch (error) {
    console.error('Assign role error:', error);
    return NextResponse.json(
      { error: 'Failed to assign role', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500, headers: corsHeaders() }
    );
  }
}
