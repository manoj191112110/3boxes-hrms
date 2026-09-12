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

// GET /api/rbac/my-permissions - Get current user's effective permissions
export async function GET(request: Request) {
  const db = await getDb(request);
  try {
    const { user } = await resolveAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404, headers: corsHeaders() }
      );
    }

    // Super admin has full access to everything
    if (user.role === 'super_admin') {
      const allModules = await db.module.findMany({
        include: {
          permissions: true,
        },
        orderBy: { sortOrder: 'asc' },
      });

      const permissionsMap: Record<string, Record<string, boolean>> = {};
      for (const mod of allModules) {
        permissionsMap[mod.key] = {};
        for (const perm of mod.permissions) {
          permissionsMap[mod.key][perm.action] = true;
        }
      }

      return NextResponse.json(
        {
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
          },
          roles: [
            {
              key: 'super_admin',
              name: 'Super Administrator',
              isSystem: true,
              level: 0,
            },
          ],
          permissions: permissionsMap,
          isSuperAdmin: true,
        },
        { headers: corsHeaders() }
      );
    }

    // For non-super-admin, get role assignments and their permissions
    const roleAssignments = await db.userRoleAssignment.findMany({
      where: {
        userId: user.id,
      },
      include: {
        role: {
          include: {
            permissions: {
              where: { granted: true },
              include: {
                permission: {
                  include: {
                    module: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    // Build the effective permissions map
    // Higher-level roles (lower number) take precedence
    // If any granted role grants a permission, it's granted
    const permissionsMap: Record<string, Record<string, boolean>> = {};
    const roles: Array<{
      key: string;
      name: string;
      isSystem: boolean;
      level: number;
      companyId: string | null;
    }> = [];

    // Sort by level (lower level = higher priority) to process most powerful roles first
    const sortedAssignments = roleAssignments.sort(
      (a, b) => a.role.level - b.role.level
    );

    for (const assignment of sortedAssignments) {
      const role = assignment.role;
      roles.push({
        key: role.key,
        name: role.name,
        isSystem: role.isSystem,
        level: role.level,
        companyId: assignment.companyId,
      });

      for (const rp of role.permissions) {
        const moduleKey = rp.permission.module.key;
        const action = rp.permission.action;

        if (!permissionsMap[moduleKey]) {
          permissionsMap[moduleKey] = {};
        }

        // Only grant if not already granted (or if this is an explicit grant)
        // If granted is true, set to true; if granted is false (explicit deny), only apply if not already true
        if (rp.granted) {
          permissionsMap[moduleKey][action] = true;
        } else if (permissionsMap[moduleKey][action] === undefined) {
          // Explicit deny only applies if no higher-level role has already granted it
          permissionsMap[moduleKey][action] = false;
        }
      }
    }

    // Also check if the user has the legacy `role` field set and no role assignments
    // This handles backward compatibility for users who haven't been migrated to the new RBAC system
    if (roles.length === 0 && user.role) {
      // Try to find the system role matching their legacy role
      const systemRole = await db.role.findFirst({
        where: {
          key: user.role,
          OR: [
            { tenantId: user.tenantId },
            { tenantId: null },
          ],
        },
        include: {
          permissions: {
            where: { granted: true },
            include: {
              permission: {
                include: {
                  module: true,
                },
              },
            },
          },
        },
      });

      if (systemRole) {
        roles.push({
          key: systemRole.key,
          name: systemRole.name,
          isSystem: systemRole.isSystem,
          level: systemRole.level,
          companyId: null,
        });

        for (const rp of systemRole.permissions) {
          const moduleKey = rp.permission.module.key;
          const action = rp.permission.action;

          if (!permissionsMap[moduleKey]) {
            permissionsMap[moduleKey] = {};
          }
          permissionsMap[moduleKey][action] = true;
        }
      }
    }

    // Get list of accessible module keys
    const accessibleModules = Object.keys(permissionsMap).filter(
      (key) => Object.values(permissionsMap[key]).some((v) => v === true)
    );

    return NextResponse.json(
      {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          tenantId: user.tenantId,
        },
        roles,
        permissions: permissionsMap,
        isSuperAdmin: false,
        accessibleModules,
        totalModules: accessibleModules.length,
      },
      { headers: corsHeaders() }
    );
  } catch (error) {
    console.error('Get my permissions error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders() }
    );
  }
}
