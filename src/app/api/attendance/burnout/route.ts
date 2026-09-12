/**
 * Burnout Analytics API — REQ-AI-ATT-03
 *
 *  GET /api/attendance/burnout  — list recent burnout flags (admin)
 *  POST /api/attendance/burnout/run — compute and persist burnout scores for all
 *                                      employees based on overtime + leave usage +
 *                                      collaboration activity.
 */
import { requireUser, isAdminRole, getQuery, ok, fail, OPTIONS } from '@/lib/attendance-leave-api';
import { getDb, getPlatformDb } from '@/lib/tenant-db';

export { OPTIONS };

export async function GET(request: Request) {
  const db = await getDb(request);
  const { user, response } = await requireUser(request);
  if (!user) return response;
  try {
    const q = getQuery(request);
    if (!isAdminRole(user.role)) return fail('Admin only', 403);

    const where: Record<string, unknown> = {};
    if (q.riskLevel) where.riskLevel = q.riskLevel;
    if (q.employeeId) where.employeeId = q.employeeId;

    const items = await db.burnoutFlag.findMany({
      where,
      include: { employee: { select: { id: true, firstName: true, lastName: true, employeeId: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return ok({ burnoutFlags: items });
  } catch (e: unknown) {
    return fail(e instanceof Error ? e.message : 'Failed to load', 500);
  }
}

/**
 * POST /api/attendance/burnout/run
 *
 * Computes a burnout score (0..1) for every active employee based on:
 *  - Overtime in the last 30 days (weight: 0.4)
 *  - Low leave usage in the last 90 days (weight: 0.3)
 *  - High collaboration activity in last 7 days (weight: 0.3)
 */
export async function POST(request: Request) {
  const db = await getDb(request);
  const { user, response } = await requireUser(request);
  if (!user) return response;
  if (!isAdminRole(user.role)) return fail('Admin only', 403);

  try {
    const employees = await db.employee.findMany({
      where: { status: 'active' },
      select: { id: true, firstName: true, lastName: true, employeeId: true, email: true },
    });

    const now = new Date();
    const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const ninetyDaysAgo = new Date(); ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const flags: unknown[] = [];

    for (const emp of employees) {
      // 1. Overtime sum (last 30 days)
      const otRecords = await db.overtimeRecord.findMany({
        where: { employeeId: emp.id, date: { gte: thirtyDaysAgo }, status: { in: ['approved', 'processed'] } },
        select: { hours: true },
      });
      const otHours = otRecords.reduce((s, r) => s + r.hours, 0);
      // Normalize: 0h → 0, 30h+ → 1
      const otScore = Math.min(1, otHours / 30);

      // 2. Low leave usage (last 90 days)
      const leaveCount = await db.leaveRequest.count({
        where: { employeeId: emp.id, status: 'approved', startDate: { gte: ninetyDaysAgo } },
      });
      // 0 leaves → 1 (high risk), 5+ leaves → 0 (low risk)
      const leaveScore = Math.max(0, 1 - leaveCount / 5);

      // 3. High activity (proxy: timesheet entries in last 7 days)
      const tsCount = await db.timesheet.count({
        where: { employeeId: emp.id, date: { gte: sevenDaysAgo } },
      });
      // 0 entries → 0 (no risk), 35+ → 1 (high risk — overworked)
      const activityScore = Math.min(1, tsCount / 35);

      const riskScore = otScore * 0.4 + leaveScore * 0.3 + activityScore * 0.3;
      const riskLevel = riskScore >= 0.75 ? 'critical'
        : riskScore >= 0.5 ? 'high'
        : riskScore >= 0.25 ? 'moderate'
        : 'low';

      // Only persist if risk is moderate or higher (avoid noise)
      if (riskLevel === 'low') continue;

      const factors = { overtime: otScore, leaveUsage: 1 - leaveScore, activityScore };

      let recommendations = '';
      if (otScore > 0.5) recommendations += 'Reduce overtime allocation. ';
      if (leaveScore > 0.5) recommendations += 'Encourage employee to take accrued leave. ';
      if (activityScore > 0.7) recommendations += 'Re-balance workload across team members. ';

      const flag = await db.burnoutFlag.create({
        data: {
          employeeId: emp.id,
          riskScore: Math.round(riskScore * 100) / 100,
          riskLevel,
          factors: factors as never,
          recommendations: recommendations.trim() || null,
        },
      });
      flags.push(flag);
    }

    return ok({ generated: flags.length, burnoutFlags: flags });
  } catch (e: unknown) {
    return fail(e instanceof Error ? e.message : 'Failed to compute', 500);
  }
}
