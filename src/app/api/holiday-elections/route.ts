/**
 * Optional Holiday Election API — REQ-CFG-05
 *
 *  GET  — list the employee's elections for the year (and remaining quota)
 *  POST — elect an optional holiday (subject to quota)
 *  DELETE — withdraw an election
 */
import { requireUser, findEmployeeByEmail, getQuery, ok, fail, OPTIONS } from '@/lib/attendance-leave-api';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { withSchemaSync } from '@/lib/schema-sync';

export { OPTIONS };

export async function GET(request: Request) {
  const db = await getDb(request);
  const { user, response } = await requireUser(request);
  if (!user) return response;
  try {
    const q = getQuery(request);
    const year = Number(q.year) || new Date().getFullYear();
    const emp = await findEmployeeByEmail(user.email);
    if (!emp) {
      // Admin users without an employee record still need the full payload shape
      // so the frontend doesn't crash on undefined.optionalHolidays.length
      const optionalHolidays = await withSchemaSync(() => db.holiday.findMany({
        where: { isOptional: true, date: { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) } },
        orderBy: { date: 'asc' },
      }));
      const quota = optionalHolidays.length > 0
        ? Math.min(...optionalHolidays.map(h => h.optionalQuota || 2))
        : 0;
      return ok({
        optionalHolidays,
        elections: [],
        quota,
        used: 0,
        remaining: quota,
      });
    }

    // List all optional holidays for the year
    const optionalHolidays = await withSchemaSync(() => db.holiday.findMany({
      where: { isOptional: true, date: { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) } },
      orderBy: { date: 'asc' },
    }));
    const elections = await db.optionalHolidayElection.findMany({
      where: { employeeId: emp.id, year },
      include: { holiday: true },
    });

    // Quota = min of all optional holidays' optionalQuota (or 2 default)
    const quota = optionalHolidays.length > 0
      ? Math.min(...optionalHolidays.map(h => h.optionalQuota || 2))
      : 0;

    return ok({
      optionalHolidays,
      elections,
      quota,
      used: elections.length,
      remaining: Math.max(0, quota - elections.length),
    });
  } catch (e: unknown) {
    return fail(e instanceof Error ? e.message : 'Failed to load', 500);
  }
}

export async function POST(request: Request) {
  const db = await getDb(request);
  const { user, response } = await requireUser(request);
  if (!user) return response;
  try {
    const { searchParams } = new URL(request.url);
    const holidayId = searchParams.get('holidayId');
    if (!holidayId) return fail('holidayId is required');

    const emp = await findEmployeeByEmail(user.email);
    if (!emp) return fail('Employee record not found', 404);

    const holiday = await withSchemaSync(() => db.holiday.findUnique({ where: { id: holidayId } }));
    if (!holiday || !holiday.isOptional) return fail('Holiday not found or not optional', 404);

    const year = new Date(holiday.date).getFullYear();
    const existingCount = await db.optionalHolidayElection.count({
      where: { employeeId: emp.id, year },
    });
    const quota = holiday.optionalQuota || 2;
    if (existingCount >= quota) return fail(`Quota exceeded — you can only elect ${quota} optional holidays`, 400);

    const election = await db.optionalHolidayElection.create({
      data: { employeeId: emp.id, holidayId, year },
    }).catch(() => null);
    if (!election) return fail('You have already elected this holiday', 400);

    return ok({ election }, 201);
  } catch (e: unknown) {
    return fail(e instanceof Error ? e.message : 'Failed to elect', 500);
  }
}
