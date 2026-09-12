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

// GET /api/rbac/roles/[id] - Get a role with its permissions
export async function GET(
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

    const { id } = await params;

    const role = await db.role.findUnique({
      where: { id },
      include: {
        permissions: {
          include: {
            permission: {
              include: {
                module: true,
              },
            },
          },
          orderBy: {
            permission: {
              moduleId: 'asc',
            },
          },
        },
        _count: {
          select: {
            userRoles: true,
          },
        },
      },
    });

    if (!role) {
      return NextResponse.json(
        { error: 'Role not found' },
        { status: 404, headers: corsHeaders() }
      );
    }

    // Non-super-admin users can only view roles within their tenant
    if (user.role !== 'super_admin' && role.tenantId && role.tenantId !== user.tenantId) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403, headers: corsHeaders() }
      );
    }

    // Group permissions by module
    const permissionsByModule: Record<string, unknown> = {};
    for (const rp of role.permissions) {
      const moduleKey = rp.permission.module.key;
      if (!permissionsByModule[moduleKey]) {
        permissionsByModule[moduleKey] = {
          moduleId: rp.permission.module.id,
          moduleKey: rp.permission.module.key,
          moduleName: rp.permission.module.name,
          moduleCategory: rp.permission.module.category,
          permissions: [],
        };
      }
      (permissionsByModule[moduleKey] as { permissions: unknown[] }).permissions.push({
        id: rp.permission.id,
        action: rp.permission.action,
        description: rp.permission.description,
        granted: rp.granted,
        rolePermissionId: rp.id,
      });
    }

    return NextResponse.json(
      {
        role: {
          id: role.id,
          name: role.name,
          key: role.key,
          description: role.description,
          isSystem: role.isSystem,
          level: role.level,
          tenantId: role.tenantId,
          companyId: role.companyId,
          status: role.status,
          createdBy: role.createdBy,
          userCount: role._count.userRoles,
          permissionsByModule: Object.values(permissionsByModule),
          createdAt: role.createdAt,
          updatedAt: role.updatedAt,
        },
      },
      { headers: corsHeaders() }
    );
  } catch (error) {
    console.error('Get role error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders() }
    );
  }
}

// PUT /api/rbac/roles/[id] - Update a role
export async function PUT(
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

    // Only super_admin and tenant_admin can update roles
    if (user.role !== 'super_admin' && user.role !== 'tenant_admin') {
      return NextResponse.json(
        { error: 'Insufficient permissions to update roles' },
        { status: 403, headers: corsHeaders() }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { name, description, status } = body;

    const existingRole = await db.role.findUnique({
      where: { id },
    });

    if (!existingRole) {
      return NextResponse.json(
        { error: 'Role not found' },
        { status: 404, headers: corsHeaders() }
      );
    }

    // Tenant admin can only update roles within their tenant
    if (user.role === 'tenant_admin') {
      if (existingRole.tenantId !== user.tenantId && existingRole.tenantId !== null) {
        return NextResponse.json(
          { error: 'Cannot update roles outside your tenant' },
          { status: 403, headers: corsHeaders() }
        );
      }
    }

    // Build update data
    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (status !== undefined) {
      // System roles cannot be deactivated
      if (existingRole.isSystem && status !== 'active') {
        return NextResponse.json(
          { error: 'System roles cannot be deactivated' },
          { status: 400, headers: corsHeaders() }
        );
      }
      updateData.status = status;
    }

    const updatedRole = await db.role.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(
      {
        role: {
          id: updatedRole.id,
          name: updatedRole.name,
          key: updatedRole.key,
          description: updatedRole.description,
          isSystem: updatedRole.isSystem,
          level: updatedRole.level,
          tenantId: updatedRole.tenantId,
          companyId: updatedRole.companyId,
          status: updatedRole.status,
          createdBy: updatedRole.createdBy,
          createdAt: updatedRole.createdAt,
          updatedAt: updatedRole.updatedAt,
        },
      },
      { headers: corsHeaders() }
    );
  } catch (error) {
    console.error('Update role error:', error);
    return NextResponse.json(
      { error: 'Failed to update role', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500, headers: corsHeaders() }
    );
  }
}

// PATCH /api/rbac/roles/[id] - Partial update a role
export async function PATCH(
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

    // Only super_admin and tenant_admin can update roles
    if (user.role !== 'super_admin' && user.role !== 'tenant_admin') {
      return NextResponse.json(
        { error: 'Insufficient permissions to update roles' },
        { status: 403, headers: corsHeaders() }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { name, description, level, status } = body;

    const existingRole = await db.role.findUnique({
      where: { id },
    });

    if (!existingRole) {
      return NextResponse.json(
        { error: 'Role not found' },
        { status: 404, headers: corsHeaders() }
      );
    }

    // Tenant admin can only update roles within their tenant
    if (user.role === 'tenant_admin') {
      if (existingRole.tenantId !== user.tenantId && existingRole.tenantId !== null) {
        return NextResponse.json(
          { error: 'Cannot update roles outside your tenant' },
          { status: 403, headers: corsHeaders() }
        );
      }
    }

    // Build update data
    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (level !== undefined) updateData.level = level;
    if (status !== undefined) {
      if (existingRole.isSystem && status !== 'active') {
        return NextResponse.json(
          { error: 'System roles cannot be deactivated' },
          { status: 400, headers: corsHeaders() }
        );
      }
      updateData.status = status;
    }

    const updatedRole = await db.role.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(
      {
        role: {
          id: updatedRole.id,
          name: updatedRole.name,
          key: updatedRole.key,
          description: updatedRole.description,
          isSystem: updatedRole.isSystem,
          level: updatedRole.level,
          tenantId: updatedRole.tenantId,
          companyId: updatedRole.companyId,
          status: updatedRole.status,
          createdBy: updatedRole.createdBy,
          createdAt: updatedRole.createdAt,
          updatedAt: updatedRole.updatedAt,
        },
      },
      { headers: corsHeaders() }
    );
  } catch (error) {
    console.error('Patch role error:', error);
    return NextResponse.json(
      { error: 'Failed to update role', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500, headers: corsHeaders() }
    );
  }
}

// DELETE /api/rbac/roles/[id] - Delete a role
export async function DELETE(
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

    // Only super_admin and tenant_admin can delete roles
    if (user.role !== 'super_admin' && user.role !== 'tenant_admin') {
      return NextResponse.json(
        { error: 'Insufficient permissions to delete roles' },
        { status: 403, headers: corsHeaders() }
      );
    }

    const { id } = await params;

    const existingRole = await db.role.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            userRoles: true,
          },
        },
      },
    });

    if (!existingRole) {
      return NextResponse.json(
        { error: 'Role not found' },
        { status: 404, headers: corsHeaders() }
      );
    }

    // System roles cannot be deleted
    if (existingRole.isSystem) {
      return NextResponse.json(
        { error: 'System roles cannot be deleted' },
        { status: 400, headers: corsHeaders() }
      );
    }

    // Tenant admin can only delete roles within their tenant
    if (user.role === 'tenant_admin') {
      if (existingRole.tenantId !== user.tenantId && existingRole.tenantId !== null) {
        return NextResponse.json(
          { error: 'Cannot delete roles outside your tenant' },
          { status: 403, headers: corsHeaders() }
        );
      }
    }

    // Check if role is assigned to users
    if (existingRole._count.userRoles > 0) {
      return NextResponse.json(
        { error: `Cannot delete role: it is currently assigned to ${existingRole._count.userRoles} user(s). Remove assignments first.` },
        { status: 400, headers: corsHeaders() }
      );
    }

    // Delete role permissions first, then the role
    await db.rolePermission.deleteMany({
      where: { roleId: id },
    });

    await db.role.delete({
      where: { id },
    });

    return NextResponse.json(
      { success: true, message: 'Role deleted successfully' },
      { headers: corsHeaders() }
    );
  } catch (error) {
    console.error('Delete role error:', error);
    return NextResponse.json(
      { error: 'Failed to delete role', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500, headers: corsHeaders() }
    );
  }
}
