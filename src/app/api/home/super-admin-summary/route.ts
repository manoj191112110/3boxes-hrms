/**
 * Single BFF for Super Admin Home — one compile instead of 5 API routes.
 */
import { NextResponse } from 'next/server';
import { getDb, getPlatformDb, getDbForTenantById } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';

function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: cors() });
}

export async function GET(request: Request) {
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: cors() });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: cors() });
    if (decoded.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: cors() });
    }

    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');
    const companyId = searchParams.get('companyId');

    const db = tenantId ? await getDbForTenantById(tenantId) : await getDb(request);
    const platformDb = getPlatformDb();

    const empWhere = {
      status: 'active' as const,
      ...(companyId ? { companyId } : {}),
    };
    const orgWhere = companyId ? { companyId } : {};

    const [totalEmployees, totalDepartments, totalBranches, auditLogs] = await Promise.all([
      db.employee.count({ where: empWhere }),
      db.department.count({ where: orgWhere }),
      db.branch.count({ where: orgWhere }),
      platformDb.auditLog.findMany({
        take: 8,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { id: true, name: true, email: true } } },
      }),
    ]);

    return NextResponse.json(
      {
        stats: {
          totalEmployees,
          totalUsers: totalEmployees,
          totalDepartments,
          totalBranches,
        },
        auditLogs,
      },
      { headers: cors() }
    );
  } catch (error) {
    console.error('[home/super-admin-summary] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: cors() });
  }
}
