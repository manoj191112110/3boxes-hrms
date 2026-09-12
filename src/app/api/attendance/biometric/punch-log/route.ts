/**
 * Biometric Punch Log API — REQ-ATT-03, REQ-AI-ATT-01/02 (read side)
 *
 * GET /api/attendance/biometric/punch-log
 *
 * Query params:
 *   deviceId, employeeId, flagged ("true"), from, to, page (default 1), limit (default 50)
 *
 * Returns a paginated list of biometric punch events with AI risk scores and
 * flag reasons. Used by the admin UI to review flagged punches.
 *
 * NOTE: this route is at /punch-log (NOT /punch) because /punch is reserved
 * for the device webhook (POST only).
 */
import { requireUser, getQuery, ok, fail, OPTIONS, isAdminRole } from '@/lib/attendance-leave-api';
import { getDb, getPlatformDb } from '@/lib/tenant-db';

export { OPTIONS };

export async function GET(request: Request) {
  const db = await getDb(request);
  const { user, response } = await requireUser(request);
  if (!user) return response;
  try {
    const q = getQuery(request);
    const page = Math.max(1, parseInt(q.page || '1', 10));
    const limit = Math.min(200, Math.max(1, parseInt(q.limit || '50', 10)));

    const where: Record<string, unknown> = {};
    if (q.deviceId) where.deviceId = q.deviceId;
    if (q.employeeId) where.employeeId = q.employeeId;
    if (q.flagged === 'true') where.flagged = true;
    if (q.from || q.to) {
      where.punchTime = {};
      if (q.from) (where.punchTime as Record<string, unknown>).gte = new Date(q.from);
      if (q.to) (where.punchTime as Record<string, unknown>).lte = new Date(q.to);
    }

    const [punches, total] = await Promise.all([
      db.biometricPunch.findMany({
        where,
        orderBy: { punchTime: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          device: { select: { id: true, name: true, serialNumber: true, vendor: true, branch: { select: { name: true } } } },
          employee: { select: { id: true, firstName: true, lastName: true, employeeId: true, email: true } },
        },
      }),
      db.biometricPunch.count({ where }),
    ]);

    // Summary stats for admins
    let summary: Record<string, number> | null = null;
    if (isAdminRole(user.role) && page === 1) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const [todayTotal, todayFlagged, last7Flagged] = await Promise.all([
        db.biometricPunch.count({ where: { punchTime: { gte: today } } }),
        db.biometricPunch.count({ where: { punchTime: { gte: today }, flagged: true } }),
        db.biometricPunch.count({
          where: {
            flagged: true,
            punchTime: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
          },
        }),
      ]);
      summary = { todayTotal, todayFlagged, last7Flagged };
    }

    return ok({
      punches,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      ...(summary ? { summary } : {}),
    });
  } catch (e: unknown) {
    return fail(e instanceof Error ? e.message : 'Failed to load punches', 500);
  }
}
