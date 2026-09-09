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

// GET /api/rbac/roles/[id]/permissions - Get all permissions for a role
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

    const { id: roleId } = await params;

    const role = await db.role.findUnique({
      where: { id: roleId },
    });

    if (!role) {
      return NextResponse.json(
        { error: 'Role not found' },
        { status: 404, headers: corsHeaders() }
      );
    }

    // Non-super-admin can only view permissions for roles in their tenant
    if (user.role !== 'super_admin' && role.tenantId && role.tenantId !== user.tenantId) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403, headers: corsHeaders() }
      );
    }

    // Get role permissions with module info
    const rolePermissions = await db.rolePermission.findMany({
      where: { roleId },
      include: {
        permission: {
          include: {
            module: true,
          },
        },
      },
      orderBy: [
        {
          permission: {
            module: {
              category: 'asc',
            },
          },
        },
        {
          permission: {
            module: {
              sortOrder: 'asc',
            },
          },
        },
        {
          permission: {
            action: 'asc',
          },
        },
      ],
    });

    // Also get all available permissions so we can show what's not granted
    const allModules = await db.module.findMany({
      include: {
        permissions: true,
      },
      orderBy: { sortOrder: 'asc' },
    });

    // Build comprehensive permission map
    const grantedPermissionIds = new Set(
      rolePermissions.filter((rp) => rp.granted).map((rp) => rp.permissionId)
    );
    const deniedPermissionIds = new Set(
      rolePermissions.filter((rp) => !rp.granted).map((rp) => rp.permissionId)
    );

    const modulesWithPermissions = allModules.map((mod) => ({
      id: mod.id,
      key: mod.key,
      name: mod.name,
      category: mod.category,
      icon: mod.icon,
      permissions: mod.permissions.map((perm) => ({
        id: perm.id,
        action: perm.action,
        description: perm.description,
        granted: grantedPermissionIds.has(perm.id),
        explicitlyDenied: deniedPermissionIds.has(perm.id),
        rolePermissionId:
          rolePermissions.find((rp) => rp.permissionId === perm.id)?.id || null,
      })),
    }));

    // Get tenant and company info for the role
    const fullRole = await db.role.findUnique({
      where: { id: roleId },
      include: {
        tenant: { select: { id: true, name: true, slug: true } },
        company: { select: { id: true, name: true, code: true } },
        _count: { select: { userRoles: true } },
      },
    });

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
          permissions: rolePermissions.map((rp) => ({
            id: rp.id,
            granted: rp.granted,
            permission: {
              id: rp.permission.id,
              action: rp.permission.action,
              module: {
                id: rp.permission.module.id,
                key: rp.permission.module.key,
                name: rp.permission.module.name,
                category: rp.permission.module.category,
              },
            },
          })),
          tenant: fullRole?.tenant || null,
          company: fullRole?.company || null,
          _count: { userRoles: fullRole?._count.userRoles || 0 },
          createdAt: role.createdAt,
          updatedAt: role.updatedAt,
        },
        modules: modulesWithPermissions,
        summary: {
          totalPermissions: allModules.reduce((acc, m) => acc + m.permissions.length, 0),
          grantedCount: grantedPermissionIds.size,
          deniedCount: deniedPermissionIds.size,
          notSetCount:
            allModules.reduce((acc, m) => acc + m.permissions.length, 0) -
            grantedPermissionIds.size -
            deniedPermissionIds.size,
        },
      },
      { headers: corsHeaders() }
    );
  } catch (error) {
    console.error('Get role permissions error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders() }
    );
  }
}

// PUT /api/rbac/roles/[id]/permissions - Replace all permissions for a role
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

    // Only super_admin and tenant_admin can modify permissions
    if (user.role !== 'super_admin' && user.role !== 'tenant_admin') {
      return NextResponse.json(
        { error: 'Insufficient permissions to modify role permissions' },
        { status: 403, headers: corsHeaders() }
      );
    }

    const { id: roleId } = await params;

    const role = await db.role.findUnique({
      where: { id: roleId },
    });

    if (!role) {
      return NextResponse.json(
        { error: 'Role not found' },
        { status: 404, headers: corsHeaders() }
      );
    }

    // Tenant admin can only modify permissions for roles within their tenant
    if (user.role === 'tenant_admin') {
      if (role.tenantId !== user.tenantId && role.tenantId !== null) {
        return NextResponse.json(
          { error: 'Cannot modify permissions for roles outside your tenant' },
          { status: 403, headers: corsHeaders() }
        );
      }
    }

    const body = await request.json();
    const { permissions } = body as {
      permissions: Array<{ permissionId: string; granted: boolean }>;
    };

    if (!Array.isArray(permissions)) {
      return NextResponse.json(
        { error: 'permissions must be an array of { permissionId, granted } objects' },
        { status: 400, headers: corsHeaders() }
      );
    }

    // Validate that all permissionIds exist
    const permissionIds = permissions.map((p) => p.permissionId);
    const existingPermissions = await db.permission.findMany({
      where: { id: { in: permissionIds } },
    });

    if (existingPermissions.length !== permissionIds.length) {
      const foundIds = new Set(existingPermissions.map((p) => p.id));
      const invalidIds = permissionIds.filter((id) => !foundIds.has(id));
      return NextResponse.json(
        { error: `Invalid permission IDs: ${invalidIds.join(', ')}` },
        { status: 400, headers: corsHeaders() }
      );
    }

    // Use a transaction to atomically replace all permissions
    await db.$transaction(async (tx) => {
      // Delete all existing role permissions
      await tx.rolePermission.deleteMany({
        where: { roleId },
      });

      // Create new role permissions
      if (permissions.length > 0) {
        await tx.rolePermission.createMany({
          data: permissions.map((p) => ({
            roleId,
            permissionId: p.permissionId,
            granted: p.granted,
          })),
          skipDuplicates: true,
        });
      }
    });

    // Fetch updated permissions
    const updatedPermissions = await db.rolePermission.findMany({
      where: { roleId },
      include: {
        permission: {
          include: {
            module: true,
          },
        },
      },
    });

    // Group by module for response
    const permissionsByModule: Record<string, unknown> = {};
    for (const rp of updatedPermissions) {
      const moduleKey = rp.permission.module.key;
      if (!permissionsByModule[moduleKey]) {
        permissionsByModule[moduleKey] = {
          moduleKey,
          moduleName: rp.permission.module.name,
          permissions: [],
        };
      }
      (permissionsByModule[moduleKey] as { permissions: unknown[] }).permissions.push({
        permissionId: rp.permissionId,
        action: rp.permission.action,
        granted: rp.granted,
      });
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Role permissions updated successfully',
        role: {
          id: role.id,
          name: role.name,
          key: role.key,
        },
        permissionsByModule: Object.values(permissionsByModule),
        totalGranted: updatedPermissions.filter((p) => p.granted).length,
        totalDenied: updatedPermissions.filter((p) => !p.granted).length,
      },
      { headers: corsHeaders() }
    );
  } catch (error) {
    console.error('Update role permissions error:', error);
    return NextResponse.json(
      { error: 'Failed to update role permissions', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500, headers: corsHeaders() }
    );
  }
}
