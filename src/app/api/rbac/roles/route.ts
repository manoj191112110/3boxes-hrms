import { NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';
import { resolveAuthenticatedUser } from '@/lib/auth-resolve';

// Ensure this route is always dynamically rendered (never cached)
export const dynamic = 'force-dynamic';

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

// GET /api/rbac/roles - List roles
export async function GET(request: Request) {
  const db = await getDb(request);
  try {
    const { user, db: dataDb } = await resolveAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404, headers: corsHeaders() }
      );
    }

    const { searchParams } = new URL(request.url);
    const rawTenantId = searchParams.get('tenantId');
    const rawCompanyId = searchParams.get('companyId');
    const search = searchParams.get('search');

    // Treat empty string same as null (no filter)
    const tenantId = rawTenantId && rawTenantId.trim() !== '' ? rawTenantId : null;
    const companyId = rawCompanyId && rawCompanyId.trim() !== '' ? rawCompanyId : null;

    // Build where clause based on user role using AND to combine conditions properly
    const andConditions: Record<string, unknown>[] = [];

    // Tenant filter
    if (user.role === 'super_admin') {
      // Super admin can see all roles, optionally filter by tenantId
      if (tenantId) {
        andConditions.push({
          OR: [
            { tenantId },
            { tenantId: null }, // Include global roles
          ],
        });
      }
      // If no tenantId filter, super_admin sees ALL roles (no condition added)
    } else {
      // Tenant admin and below can only see roles for their tenant
      andConditions.push({
        OR: [
          { tenantId: user.tenantId },
          { tenantId: null }, // Include global roles
        ],
      });
    }

    // Company filter (combined with AND, not overwriting tenant filter)
    if (companyId) {
      andConditions.push({
        OR: [
          { companyId },
          { companyId: null }, // Include tenant-level (non-company-specific) roles
        ],
      });
    }

    // Search filter
    if (search) {
      andConditions.push({
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { key: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ],
      });
    }

    const where: Record<string, unknown> = andConditions.length > 0
      ? { AND: andConditions }
      : {};

    const roles = await db.role.findMany({
      where,
      include: {
        permissions: {
          include: {
            permission: {
              include: {
                module: true,
              },
            },
          },
        },
        tenant: {
          select: { id: true, name: true, slug: true },
        },
        company: {
          select: { id: true, name: true, code: true },
        },
        _count: {
          select: {
            userRoles: true,
          },
        },
      },
      orderBy: [{ level: 'asc' }, { name: 'asc' }],
    });

    const formattedRoles = roles.map((role) => ({
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
      permissions: role.permissions
        .filter((rp) => rp.permission && rp.permission.module)
        .map((rp) => ({
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
      tenant: role.tenant || null,
      company: role.company || null,
      _count: { userRoles: role._count.userRoles },
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    }));

    return NextResponse.json(
      { roles: formattedRoles, total: formattedRoles.length },
      { headers: { ...corsHeaders(), 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate' } }
    );
  } catch (error) {
    console.error('Get roles error:', error);
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    // If RBAC tables don't exist yet, return empty array instead of error
    if (errMsg.includes('does not exist') || errMsg.includes('relation')) {
      return NextResponse.json(
        { roles: [], total: 0, needsSeed: true },
        { headers: corsHeaders() }
      );
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders() }
    );
  }
}

// POST /api/rbac/roles - Create a new role
export async function POST(request: Request) {
  const db = await getDb(request);
  try {
    const { user, db: dataDb } = await resolveAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404, headers: corsHeaders() }
      );
    }

    // Only super_admin and tenant_admin can create roles
    if (user.role !== 'super_admin' && user.role !== 'tenant_admin') {
      return NextResponse.json(
        { error: 'Insufficient permissions to create roles' },
        { status: 403, headers: corsHeaders() }
      );
    }

    const body = await request.json();
    const { name, key, description, tenantId, companyId, level } = body;

    if (!name || !key) {
      return NextResponse.json(
        { error: 'Name and key are required' },
        { status: 400, headers: corsHeaders() }
      );
    }

    // Validate key format (alphanumeric and underscores only)
    if (!/^[a-z][a-z0-9_]*$/.test(key)) {
      return NextResponse.json(
        { error: 'Role key must start with lowercase letter and contain only lowercase letters, numbers, and underscores' },
        { status: 400, headers: corsHeaders() }
      );
    }

    // Determine the tenantId for the new role
    // Treat empty string same as null
    let roleTenantId: string | null = (tenantId && tenantId.trim() !== '') ? tenantId : null;

    if (user.role === 'super_admin') {
      // Super admin can create roles for any tenant (roleTenantId already set above)
    } else {
      // Tenant admin can only create roles for their own tenant
      roleTenantId = user.tenantId;

      // Verify they're not trying to create for a different tenant
      if (tenantId && tenantId !== user.tenantId) {
        return NextResponse.json(
          { error: 'Cannot create roles for a different tenant' },
          { status: 403, headers: corsHeaders() }
        );
      }
    }

    // Check if role key already exists for this tenant/company combination
    const existingRole = await db.role.findFirst({
      where: {
        key,
        tenantId: roleTenantId,
        companyId: companyId || null,
      },
    });

    if (existingRole) {
      return NextResponse.json(
        { error: 'A role with this key already exists for this tenant/company' },
        { status: 409, headers: corsHeaders() }
      );
    }

    const role = await db.role.create({
      data: {
        name,
        key,
        description: description || null,
        tenantId: roleTenantId,
        companyId: companyId || null,
        level: level ?? 5,
        isSystem: false,
        status: 'active',
        createdBy: user.id,
      },
      include: {
        _count: {
          select: {
            userRoles: true,
            permissions: true,
          },
        },
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
          userCount: role._count.userRoles,
          permissionCount: role._count.permissions,
          createdAt: role.createdAt,
          updatedAt: role.updatedAt,
        },
      },
      { status: 201, headers: corsHeaders() }
    );
  } catch (error) {
    console.error('Create role error:', error);
    return NextResponse.json(
      { error: 'Failed to create role', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500, headers: corsHeaders() }
    );
  }
}
