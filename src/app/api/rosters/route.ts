/**
 * Rotational Roster API — REQ-CFG-02
 *  GET  — list rosters
 *  POST — create a new roster with a pattern of shift IDs
 *  PATCH — update roster
 */
import { requireUser, isAdminRole, parseBody, getQuery, ok, fail, OPTIONS } from '@/lib/attendance-leave-api';
import { getDb, getPlatformDb } from '@/lib/tenant-db';

export { OPTIONS };

export async function GET(request: Request) {
  const db = await getDb(request);
  const { user, response } = await requireUser(request);
  if (!user) return response;
  try {
    const q = getQuery(request);
    const where: Record<string, unknown> = {};
    if (q.active === 'true') where.isActive = true;

    const items = await db.rotationalRoster.findMany({
      where,
      include: { assignments: { include: { employee: { select: { id: true, firstName: true, lastName: true, employeeId: true } } } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return ok({ rosters: items });
  } catch (e: unknown) {
    return fail(e instanceof Error ? e.message : 'Failed to load', 500);
  }
}

export async function POST(request: Request) {
  const db = await getDb(request);
  const { user, response } = await requireUser(request);
  if (!user) return response;
  if (!isAdminRole(user.role)) return fail('Admin only', 403);
  const body = await parseBody(request);
  if (!body) return fail('Invalid JSON');
  try {
    const name = (body.name as string) || '';
    if (!name) return fail('Name is required');
    const pattern = body.pattern;
    if (!Array.isArray(pattern) || pattern.length === 0) return fail('Pattern must be a non-empty array of shift IDs');
    const rotationUnit = body.rotationUnit === 'day' ? 'day' : 'week';
    const startDate = new Date(body.startDate as string);

    const record = await db.rotationalRoster.create({
      data: {
        name,
        description: (body.description as string) || null,
        pattern: pattern as never,
        rotationUnit,
        startDate,
        isActive: body.isActive !== false,
      },
    });
    return ok({ roster: record }, 201);
  } catch (e: unknown) {
    return fail(e instanceof Error ? e.message : 'Failed to create', 500);
  }
}
