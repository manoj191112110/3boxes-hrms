import { NextRequest, NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';

/**
 * GET /api/collaboration/storage-analytics
 * Returns storage usage breakdown per sub-company / project for the current tenant.
 *
 * REQ-6.2: Storage Analytics — Tenant Admin views which sub-company or project
 * is consuming the most file storage and requests cleanup.
 */
export async function GET(request: NextRequest) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    if (!['super_admin', 'tenant_admin', 'admin'].includes(decoded.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Aggregate current usage from FileNode (live calculation, no snapshot table needed)
    // Note: FileNode doesn't have a direct tenantId FK; we filter via companyId → companyGroup.tenantId
    const companies = await db.company.findMany({
      where: { companyGroup: { tenantId: decoded.tenantId } },
      select: { id: true, name: true },
    });
    const companyIds = companies.map((c) => c.id);

    const [personalAgg, projectAgg, companyAgg] = await Promise.all([
      db.fileNode.groupBy({
        by: ['ownerEmployeeId'],
        where: { driveType: 'personal', isActive: true },
        _sum: { sizeBytes: true },
        _count: { id: true },
      }),
      db.fileNode.groupBy({
        by: ['projectId'],
        where: { driveType: 'project', isActive: true },
        _sum: { sizeBytes: true },
        _count: { id: true },
      }),
      db.fileNode.groupBy({
        by: ['companyId'],
        where: { driveType: 'company', isActive: true, companyId: { in: companyIds } },
        _sum: { sizeBytes: true },
        _count: { id: true },
      }),
    ]);

    // Find cleanup candidates (files not accessed in 90+ days)
    // Note: This is a simplification — we'd need a lastAccessedAt field for accurate detection.
    // For now, we use createdAt as a proxy.
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const cleanupCandidates = await db.fileNode.count({
      where: {
        isActive: true,
        createdAt: { lt: ninetyDaysAgo },
        nodeType: 'file',
        companyId: { in: companyIds },
      },
    });

    // Get tenant-wide quota
    const quota = await db.storageQuota.findUnique({
      where: { tenantId: decoded.tenantId },
    });

    // Compute total used
    const totalUsed =
      (personalAgg.reduce((s, g) => s + (g._sum.sizeBytes || 0), 0)) +
      (projectAgg.reduce((s, g) => s + (g._sum.sizeBytes || 0), 0)) +
      (companyAgg.reduce((s, g) => s + (g._sum.sizeBytes || 0), 0));

    return NextResponse.json({
      quota,
      usedBytes: totalUsed,
      usagePercent: quota ? (totalUsed / quota.totalQuotaBytes) * 100 : 0,
      breakdown: {
        personal: personalAgg.map((g) => ({ ownerEmployeeId: g.ownerEmployeeId, bytes: g._sum.sizeBytes || 0, count: g._count.id })),
        project: projectAgg.map((g) => ({ projectId: g.projectId, bytes: g._sum.sizeBytes || 0, count: g._count.id })),
        company: companyAgg.map((g) => ({ companyId: g.companyId, bytes: g._sum.sizeBytes || 0, count: g._count.id })),
      },
      cleanupCandidates,
    });
  } catch (error) {
    console.error('GET storage analytics error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
