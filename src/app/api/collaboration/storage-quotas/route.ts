import { NextRequest, NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';

/**
 * GET /api/collaboration/storage-quotas
 * Returns storage quota for the current tenant (or all tenants if super_admin).
 *
 * REQ-6.1: Global Storage Quotas — Super Admin defines per Parent Company.
 */
export async function GET(request: NextRequest) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    if (decoded.role === 'super_admin') {
      const quotas = await db.storageQuota.findMany({
        orderBy: { tenantId: 'asc' },
      });
      return NextResponse.json({ quotas });
    }

    const quota = await db.storageQuota.findUnique({
      where: { tenantId: decoded.tenantId },
    });

    if (!quota) {
      // Auto-create default quota if not exists
      const newQuota = await db.storageQuota.create({
        data: { tenantId: decoded.tenantId },
      });
      return NextResponse.json({ quota: newQuota });
    }

    return NextResponse.json({ quota });
  } catch (error) {
    console.error('GET storage quotas error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/collaboration/storage-quotas
 * Body: { tenantId, totalQuotaBytes?, personalQuotaBytes?, projectQuotaBytes?, companyQuotaBytes?, quotaAlertThreshold?, notes? }
 *
 * Super Admin only.
 */
export async function POST(request: NextRequest) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    if (decoded.role !== 'super_admin') {
      return NextResponse.json({ error: 'Only Super Admin can configure storage quotas' }, { status: 403 });
    }

    const body = await request.json();
    const {
      tenantId, totalQuotaBytes, personalQuotaBytes, projectQuotaBytes,
      companyQuotaBytes, quotaAlertThreshold, notes,
    } = body;
    if (!tenantId) return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });

    const quota = await db.storageQuota.upsert({
      where: { tenantId },
      create: {
        tenantId,
        totalQuotaBytes,
        personalQuotaBytes,
        projectQuotaBytes,
        companyQuotaBytes,
        quotaAlertThreshold,
        notes,
      },
      update: {
        totalQuotaBytes,
        personalQuotaBytes,
        projectQuotaBytes,
        companyQuotaBytes,
        quotaAlertThreshold,
        notes,
      },
    });

    return NextResponse.json({ quota }, { status: 201 });
  } catch (error) {
    console.error('POST storage quotas error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
