/**
 * Comp-Off Leave API — REQ-OT-03
 * Lists comp-offs earned by the employee; supports marking as used.
 */
import { requireUser, findEmployeeByEmail, isAdminRole, parseBody, getQuery, ok, fail, OPTIONS } from '@/lib/attendance-leave-api';
import { getDb, getPlatformDb } from '@/lib/tenant-db';

export { OPTIONS };

export async function GET(request: Request) {
  const db = await getDb(request);
  const { user, response } = await requireUser(request);
  if (!user) return response;
  try {
    const q = getQuery(request);
    const where: Record<string, unknown> = {};
    if (!isAdminRole(user.role)) {
      const emp = await findEmployeeByEmail(user.email);
      if (!emp) return ok({ compOffs: [] });
      where.employeeId = emp.id;
    } else if (q.employeeId) {
      where.employeeId = q.employeeId;
    }
    if (q.status) where.status = q.status;

    const items = await db.compOffLeave.findMany({
      where,
      include: { employee: { select: { id: true, firstName: true, lastName: true, employeeId: true } } },
      orderBy: { earnedDate: 'desc' },
      take: 200,
    });
    return ok({ compOffs: items });
  } catch (e: unknown) {
    return fail(e instanceof Error ? e.message : 'Failed to load', 500);
  }
}
