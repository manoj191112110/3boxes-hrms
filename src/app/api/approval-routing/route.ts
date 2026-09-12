/**
 * Approval Routing Rules API — REQ-CFG-06
 *
 * Matrix routing: route leave/OT/gatepass/permission requests based on
 * the employee's project allocation for the request day.
 *
 *  GET  — list rules
 *  POST — create a rule (admin)
 *  PATCH — update a rule
 *  DELETE — delete a rule
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
    if (q.requestType) where.requestType = q.requestType;
    if (q.projectId) where.projectId = q.projectId;
    if (q.active === 'true') where.isActive = true;

    const items = await db.approvalRoutingRule.findMany({
      where,
      orderBy: { priority: 'asc' },
      take: 100,
    });
    return ok({ rules: items });
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
    const requestType = body.requestType as string;
    if (!name || !['leave', 'overtime', 'gatepass', 'permission'].includes(requestType)) {
      return fail('Valid name and requestType required');
    }

    const record = await db.approvalRoutingRule.create({
      data: {
        name,
        requestType,
        projectId: (body.projectId as string) || null,
        alternateManagerId: (body.alternateManagerId as string) || null,
        priority: Number(body.priority) || 100,
        isActive: body.isActive !== false,
      },
    });
    return ok({ rule: record }, 201);
  } catch (e: unknown) {
    return fail(e instanceof Error ? e.message : 'Failed to create', 500);
  }
}
