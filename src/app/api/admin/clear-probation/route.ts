import { NextResponse } from 'next/server';
import { getDb, getDbForTenant, getPlatformDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';

/**
 * POST /api/admin/clear-probation?slug=marqaitechgroup
 *
 * Clears ALL probation review data for a tenant.
 * Deletes all PerformanceReview records with reviewCycle='Probation'.
 *
 * Only super_admin can call this endpoint.
 */
export async function POST(request: Request) {
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    if (decoded.role !== 'super_admin') {
      return NextResponse.json({ error: 'Only super admin can clear probation data' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const slug = searchParams.get('slug');

    if (!slug) {
      return NextResponse.json({ error: 'slug query param is required' }, { status: 400 });
    }

    // Resolve the tenant DB
    const db = await getDbForTenant(slug);
    const platformDb = getPlatformDb();

    // Ensure PerformanceReview table exists
    try {
      await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "PerformanceReview" ("id" TEXT NOT NULL, "employeeId" TEXT NOT NULL, "reviewCycle" TEXT NOT NULL, "reviewPeriod" TEXT, "reviewerId" TEXT, "rating" DOUBLE PRECISION NOT NULL DEFAULT 0, "goalsRating" DOUBLE PRECISION NOT NULL DEFAULT 0, "skillsRating" DOUBLE PRECISION NOT NULL DEFAULT 0, "behaviorRating" DOUBLE PRECISION NOT NULL DEFAULT 0, "overallRating" DOUBLE PRECISION NOT NULL DEFAULT 0, "comments" TEXT, "strengths" TEXT, "improvements" TEXT, "status" TEXT NOT NULL DEFAULT 'pending', "reviewDate" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(), "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(), CONSTRAINT "PerformanceReview_pkey" PRIMARY KEY ("id"))`);
    } catch { /* table exists */ }

    // Delete all probation reviews
    let deletedCount = 0;
    try {
      const result = await db.performanceReview.deleteMany({
        where: { reviewCycle: 'Probation' },
      });
      deletedCount = result.count;
    } catch (err) {
      // If the table doesn't exist or query fails, try raw SQL
      try {
        const result = await db.$executeRawUnsafe(`DELETE FROM "PerformanceReview" WHERE "reviewCycle" = 'Probation'`);
        deletedCount = result;
      } catch (rawErr) {
        console.error('[ClearProbation] Raw SQL also failed:', rawErr);
      }
    }

    // Also clear from platform DB ONLY if the tenant doesn't have a dedicated DB
    // (Golden Rule: tenant data should NOT be in the platform DB — but if the
    // tenant hasn't been migrated to a dedicated DB yet, data might still be there)
    let platformDeleted = 0;
    const hasDedicatedDb = await platformDb.tenantDatabase.findFirst({
      where: { tenant: { slug }, isActive: true },
      select: { id: true },
    }).catch(() => null);

    if (!hasDedicatedDb) {
      // No dedicated DB — data is still in platform DB, clear it there
      try {
        const result = await platformDb.performanceReview.deleteMany({
          where: { reviewCycle: 'Probation' },
        }).catch(() => null);
        platformDeleted = result?.count || 0;
      } catch { /* non-critical */ }
    }

    return NextResponse.json({
      success: true,
      message: `Cleared ${deletedCount} probation review(s) from tenant DB + ${platformDeleted} from platform DB.`,
      deletedFromTenantDb: deletedCount,
      deletedFromPlatformDb: platformDeleted,
    });
  } catch (error) {
    console.error('[ClearProbation] Error:', error);
    return NextResponse.json({
      error: 'Failed to clear probation reviews',
      details: error instanceof Error ? error.message : 'Unknown',
    }, { status: 500 });
  }
}
