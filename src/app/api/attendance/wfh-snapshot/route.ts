/**
 * WFH Attendance Snapshot API — REQ-ATT-06, REQ-SEC-ATT-01
 *
 * Records a single GPS snapshot at the moment of check-in/out — NO continuous tracking.
 * Optionally accepts an AI activity summary (REQ-ATT-07).
 */
import { requireUser, findEmployeeByEmail, parseBody, getQuery, ok, fail, OPTIONS } from '@/lib/attendance-leave-api';
import { getDb, getPlatformDb } from '@/lib/tenant-db';

export { OPTIONS };

export async function GET(request: Request) {
  const db = await getDb(request);
  const { user, response } = await requireUser(request);
  if (!user) return response;
  try {
    const q = getQuery(request);
    const emp = await findEmployeeByEmail(user.email);
    if (!emp) return ok({ snapshots: [] });

    const where: Record<string, unknown> = { employeeId: emp.id };
    if (q.date) where.date = new Date(q.date);
    if (q.from || q.to) {
      where.date = {};
      if (q.from) (where.date as Record<string, unknown>).gte = new Date(q.from);
      if (q.to) (where.date as Record<string, unknown>).lte = new Date(q.to);
    }

    const items = await db.wfhAttendanceSnapshot.findMany({
      where,
      orderBy: { punchTime: 'desc' },
      take: 200,
    });
    return ok({ snapshots: items });
  } catch (e: unknown) {
    return fail(e instanceof Error ? e.message : 'Failed to load', 500);
  }
}

export async function POST(request: Request) {
  const db = await getDb(request);
  const { user, response } = await requireUser(request);
  if (!user) return response;
  const body = await parseBody(request);
  if (!body) return fail('Invalid JSON');
  try {
    const emp = await findEmployeeByEmail(user.email);
    if (!emp) return fail('Employee record not found', 404);

    const punchType = body.punchType as string;
    if (!['check_in', 'check_out'].includes(punchType)) return fail('Invalid punchType');
    const latitude = Number(body.latitude);
    const longitude = Number(body.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return fail('Invalid coordinates');

    const record = await db.wfhAttendanceSnapshot.create({
      data: {
        employeeId: emp.id,
        date: new Date(body.date as string),
        punchType,
        punchTime: new Date(body.punchTime as string),
        latitude,
        longitude,
        activityChats: Number(body.activityChats) || 0,
        activityTimesheets: Number(body.activityTimesheets) || 0,
        activityEmails: Number(body.activityEmails) || 0,
        aiBurnoutRisk: body.aiBurnoutRisk != null ? Number(body.aiBurnoutRisk) : null,
      },
    });
    return ok({ snapshot: record }, 201);
  } catch (e: unknown) {
    return fail(e instanceof Error ? e.message : 'Failed to create', 500);
  }
}
