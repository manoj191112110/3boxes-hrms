/**
 * WFH Request action API (legacy endpoint)
 *  PATCH /api/attendance/wfh/[id] — approve / reject / cancel
 *
 * Updates manager or HR approval status on the legacy WfhRequest table.
 */
import { requireUser, findEmployeeByEmail, isAdminRole, parseBody, ok, fail, OPTIONS } from '@/lib/attendance-leave-api';
import { getDb } from '@/lib/tenant-db';

export { OPTIONS };

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const db = await getDb(request);
  const { user, response } = await requireUser(request);
  if (!user) return response;
  const { id } = await params;
  const body = await parseBody(request);
  if (!body) return fail('Invalid JSON');
  try {
    const status = String(body.status || '');
    if (!['approved', 'rejected', 'cancelled'].includes(status)) return fail('Invalid status');

    const record = await (db as any).wfhRequest.findUnique({ where: { id } });
    if (!record) return fail('Request not found', 404);

    const patch: Record<string, unknown> = { status };

    if (status === 'cancelled') {
      patch.cancelledAt = new Date();
      // Only the requester or admin may cancel
      const emp = await findEmployeeByEmail(user.email, db);
      if (record.employeeId !== emp?.id && !isAdminRole(user.role)) {
        return fail('Only the requester or an admin can cancel this request', 403);
      }
    } else if (status === 'approved' || status === 'rejected') {
      if (!isAdminRole(user.role)) return fail('Admin only', 403);
      // Manager tier
      if (record.managerStatus === 'pending') {
        patch.managerStatus = status;
        patch.managerApprovedBy = user.id;
        patch.managerApprovedAt = new Date();
      } else if (record.requiresHrApproval && record.hrStatus === 'pending') {
        // HR tier (only when manager already approved)
        patch.hrStatus = status;
        patch.hrApprovedBy = user.id;
        patch.hrApprovedAt = new Date();
      } else {
        return fail('No pending approval tier for this request', 400);
      }
      // If rejected at any tier, overall status = rejected
      if (status === 'rejected') patch.status = 'rejected';
      // If both tiers approved (or HR not required), overall status = approved
      else if (
        (patch.managerStatus === 'approved' || record.managerStatus === 'approved') &&
        (!record.requiresHrApproval || patch.hrStatus === 'approved' || record.hrStatus === 'approved')
      ) {
        patch.status = 'approved';
      } else {
        patch.status = 'pending';
      }
    }

    const updated = await (db as any).wfhRequest.update({ where: { id }, data: patch });
    return ok({ request: updated });
  } catch (e: unknown) {
    return fail(e instanceof Error ? e.message : 'Failed to update', 500);
  }
}
