import { NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';

/**
 * GET /api/tenant-database/list
 *
 * Lists all tenant databases. Only super_admin can access.
 * Shows which tenants have dedicated databases and which use shared DB.
 */
export async function GET(request: Request) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    const payload = token ? await verifyToken(token) : null;
    if (!payload || payload.role !== 'super_admin') {
      return NextResponse.json({ error: 'Only super admins can list tenant databases' }, { status: 403 });
    }

    // Get all tenants with their database status
    const tenants = await getPlatformDb().tenant.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        domain: true,
        status: true,
        plan: true,
        tenantDatabase: {
          select: {
            id: true,
            databaseName: true,
            isActive: true,
            provisionedAt: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    const result = tenants.map(t => ({
      id: t.id,
      name: t.name,
      slug: t.slug,
      domain: t.domain,
      status: t.status,
      plan: t.plan,
      isIsolated: !!t.tenantDatabase && t.tenantDatabase.isActive,
      database: t.tenantDatabase ? {
        id: t.tenantDatabase.id,
        name: t.tenantDatabase.databaseName,
        active: t.tenantDatabase.isActive,
        provisionedAt: t.tenantDatabase.provisionedAt,
      } : null,
    }));

    return NextResponse.json({ tenants: result });
  } catch (error) {
    console.error('Tenant database list error:', error);
    return NextResponse.json({ error: 'Failed to list tenant databases' }, { status: 500 });
  }
}
