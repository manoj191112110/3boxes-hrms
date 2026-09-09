/**
 * Approve / reject encashment request (admin).
 * On approval, deduct the days from the leave balance.
 */
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
  if (!['approved', 'rejected', 'processed'].includes(status)) return fail('Invalid status');

  try {
    const existing = await db.leaveEncashmentRequest.findUnique({ where: { id } });
    if (!existing) return fail('Not found', 404);

    const updated = await db.leaveEncashmentRequest.update({
      where: { id },
      data: {
        status,
        approvedBy: user.id || user.email || 'system',
        approvedAt: new Date(),
      },
    });

    // If approved, deduct the days from the leave balance (so the encashed days are consumed)
    if (status === 'approved') {
      const year = existing.createdAt.getFullYear();
      await db.leaveBalance.updateMany({
        where: { employeeId: existing.employeeId, leaveTypeId: existing.leaveTypeId, year },
        data: {
          used: { increment: existing.days },
          remaining: { decrement: existing.days },
        },
      });
    }

    return ok({ encashmentRequest: updated });
  } catch (e: unknown) {
    return fail(e instanceof Error ? e.message : 'Failed to update', 500);
  }
}
