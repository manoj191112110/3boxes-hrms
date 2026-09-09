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
  if (!isAdminRole(user.role)) return fail('Only managers/HR can approve', 403);
  const body = await parseBody(request);
  if (!body) return fail('Invalid JSON');

  const { id } = await params;
  const status = body.status as string;
  if (!['approved', 'rejected'].includes(status)) return fail('Invalid status');

  try {
    const updated = await db.hourlyPermission.update({
      where: { id },
      data: {
        status,
        approvedBy: user.id || user.email || 'system',
        approvedAt: new Date(),
      },
    });
    return ok({ permission: updated });
  } catch (e: unknown) {
    return fail(e instanceof Error ? e.message : 'Failed to update', 500);
  }
}
