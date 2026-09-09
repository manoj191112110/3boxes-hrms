import { requireUser, isAdminRole, parseBody, ok, fail, OPTIONS } from '@/lib/attendance-leave-api';
import { getDb, getPlatformDb } from '@/lib/tenant-db';

export { OPTIONS };

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const db = await getDb(request);
  const { user, response } = await requireUser(request);
  if (!user) return response;
  if (!isAdminRole(user.role)) return fail('Admin only', 403);
  const body = await parseBody(request);
  if (!body) return fail('Invalid JSON');
  const { id } = await params;
  try {
    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.requestType !== undefined) data.requestType = body.requestType;
    if (body.projectId !== undefined) data.projectId = body.projectId;
    if (body.alternateManagerId !== undefined) data.alternateManagerId = body.alternateManagerId;
    if (body.priority !== undefined) data.priority = Number(body.priority);
    if (body.isActive !== undefined) data.isActive = body.isActive;

    const updated = await db.approvalRoutingRule.update({ where: { id }, data });
    return ok({ rule: updated });
  } catch (e: unknown) {
    return fail(e instanceof Error ? e.message : 'Failed to update', 500);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const db = await getDb(request);
  const { user, response } = await requireUser(request);
  if (!user) return response;
  if (!isAdminRole(user.role)) return fail('Admin only', 403);
  const { id } = await params;
  try {
    await db.approvalRoutingRule.delete({ where: { id } });
    return ok({ deleted: true });
  } catch (e: unknown) {
    return fail(e instanceof Error ? e.message : 'Failed to delete', 500);
  }
}
