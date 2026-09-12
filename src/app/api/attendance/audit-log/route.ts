/**
 * Attendance Audit Log API — REQ-SEC-ATT-04
 *  GET — list audit log entries (admin only). Supports filtering by employeeId, action, date range.
 */
import { requireUser, isAdminRole, getQuery, ok, fail, OPTIONS } from '@/lib/attendance-leave-api';
import { getDb, getPlatformDb } from '@/lib/tenant-db';

export { OPTIONS };

export async function GET(request: Request) {
  const db = await getDb(request);
  const { user, response } = await requireUser(request);
  if (!user) return response;
  if (!isAdminRole(user.role)) return fail('Admin only', 403);
  try {
    const q = getQuery(request);
    const where: Record<string, unknown> = {};
    if (q.employeeId) where.employeeId = q.employeeId;
    if (q.action) where.action = q.action;
    if (q.from || q.to) {
      where.createdAt = {};
      if (q.from) (where.createdAt as Record<string, unknown>).gte = new Date(q.from);
      if (q.to) (where.createdAt as Record<string, unknown>).lte = new Date(q.to);
    }

    const items = await db.attendanceAuditLog.findMany({
      where,
      include: { employee: { select: { id: true, firstName: true, lastName: true, employeeId: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return ok({ auditLogs: items });
  } catch (e: unknown) {
    return fail(e instanceof Error ? e.message : 'Failed to load', 500);
  }
}
