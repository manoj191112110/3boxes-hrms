import { NextRequest, NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';

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

// GET /api/rbac/user-roles — List users with their role assignments
export async function GET(req: NextRequest) {
  const db = await getDb(req);
  try {
    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get('tenantId');
    const companyId = searchParams.get('companyId');
    const search = searchParams.get('search');

    const where: Record<string, unknown> = {};
    if (tenantId) where.tenantId = tenantId;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const users = await db.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        avatar: true,
        tenantId: true,
        tenant: { select: { id: true, name: true, slug: true } },
        employee: { select: { id: true, firstName: true, lastName: true, companyId: true } },
        roleAssignments: {
          include: {
            role: { select: { id: true, name: true, key: true, level: true, isSystem: true, companyId: true } },
          },
        },
      },
      orderBy: { name: 'asc' },
      take: 100,
    });

    // Filter by company if specified (check role assignments)
    let filtered: typeof users = users;
    if (companyId) {
      filtered = users.filter((u: typeof users[number]) =>
        u.roleAssignments.some((ra: { companyId: string | null }) => ra.companyId === companyId || ra.companyId === null)
      );
    }

    return NextResponse.json(
      { users: filtered },
      { headers: corsHeaders() }
    );
  } catch (error: unknown) {
    console.error('Get user roles error:', error);
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    // If RBAC tables don't exist yet, return empty array instead of error
    if (errMsg.includes('does not exist') || errMsg.includes('relation')) {
      return NextResponse.json(
        { users: [], needsSeed: true },
        { headers: corsHeaders() }
      );
    }
    return NextResponse.json(
      { error: 'Failed to fetch user roles' },
      { status: 500, headers: corsHeaders() }
    );
  }
}
