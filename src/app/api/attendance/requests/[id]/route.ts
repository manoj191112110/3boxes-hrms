/**
 * Attendance Request detail + actions API
 *
 *  GET   /api/attendance/requests/[id] — full detail with approval timeline
 *  PATCH /api/attendance/requests/[id] — actions:
 *      { action: 'approve'|'reject', comments }  — current-level approver (or admin)
 *      { action: 'cancel' }                      — request owner, while pending
 */
import { requireUser, isAdminRole, parseBody, ok, fail, OPTIONS } from '@/lib/attendance-leave-api';
import { getDb } from '@/lib/tenant-db';
import {
  advanceWorkflow, notifyApprover, REQUEST_TYPE_LABELS,
  type AttendanceRequestType,
} from '@/lib/attendance-workflow';
import { sanitizeMultiLineText } from '@/lib/sanitize';

export { OPTIONS };

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const db = await getDb(request);
  const { user, response } = await requireUser(request);
  if (!user) return response;
  const { id } = await params;
  try {
    const request_ = await db.attendanceRequest.findUnique({
      where: { id },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, employeeId: true, email: true } },
        approvals: { orderBy: { level: 'asc' } },
      },
    });
    if (!request_) return fail('Request not found', 404);

    // Non-admins may only view their own requests or ones they act on
    if (!isAdminRole(user.role)) {
      const isActor = request_.approvals.some((a: { actorUserId: string | null }) => a.actorUserId === user.id);
      if (request_.employee.email !== user.email && !isActor) return fail('Not authorized to view this request', 403);
    }
    return ok({ request: request_ });
  } catch (e: unknown) {
    return fail(e instanceof Error ? e.message : 'Failed to load request', 500);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const db = await getDb(request);
  const { user, response } = await requireUser(request);
  if (!user) return response;
  const { id } = await params;
  const body = await parseBody(request);
  if (!body) return fail('Invalid JSON');
  try {
    const reqRow = await db.attendanceRequest.findUnique({
      where: { id },
      include: { employee: { select: { id: true, firstName: true, lastName: true, email: true, userId: true } } },
    });
    if (!reqRow) return fail('Request not found', 404);
    const action = String(body.action || '');

    // ─── Cancel (owner only, while pending) ───
    if (action === 'cancel') {
      if (reqRow.employee.email !== user.email && !isAdminRole(user.role)) {
        return fail('Only the requester or an admin can cancel this request', 403);
      }
      if (reqRow.status !== 'pending') return fail(`Cannot cancel a request that is ${reqRow.status}`);
      await (db as any).attendanceRequestApproval.updateMany({
        where: { requestId: id, status: 'pending' },
        data: { status: 'skipped', comments: 'Request cancelled by employee', actedAt: new Date() },
      });
      await db.attendanceRequest.update({ where: { id }, data: { status: 'cancelled', currentLevel: 0 } });
      return ok({ message: 'Request cancelled' });
    }

    // ─── Approve / Reject at the current level ───
    if (!['approve', 'reject'].includes(action)) return fail('Unknown action');

    if (reqRow.status !== 'pending') return fail(`This request is already ${reqRow.status}`);

    // Permission: current-level pending approver, or admin override
    const currentLevel = reqRow.currentLevel || 1;
    const step = await (db as any).attendanceRequestApproval.findFirst({
      where: { requestId: id, level: currentLevel, status: 'pending' },
    });
    const isActor = step && step.actorUserId === user.id;
    if (!isActor && !isAdminRole(user.role)) {
      return fail('You are not the assigned approver at the current level', 403);
    }

    const result = await advanceWorkflow(
      db, id,
      action === 'approve' ? 'approved' : 'rejected',
      user.id,
      sanitizeMultiLineText(body.comments, 2000),
    );

    // Notify the requester of the final outcome
    if (result.finalized) {
      await notifyApprover(
        db, reqRow.employee.userId || null, (user as any).tenantId || null,
        `${REQUEST_TYPE_LABELS[reqRow.requestType as AttendanceRequestType]} ${result.status}`,
        `Your ${REQUEST_TYPE_LABELS[reqRow.requestType as AttendanceRequestType]?.toLowerCase()} request was ${result.status}.`,
        '/attendance/requests',
      );
    }

    const approvals = await (db as any).attendanceRequestApproval.findMany({
      where: { requestId: id }, orderBy: { level: 'asc' },
    });
    const fresh = await db.attendanceRequest.findUnique({ where: { id } });

    return ok({
      request: fresh, approvals, result,
      message: result.finalized
        ? (result.status === 'approved' ? 'Approved — system actions applied' : 'Request rejected')
        : `Approved — moved to Level ${result.currentLevel}`,
    });
  } catch (e: unknown) {
    console.error('[attendance-request PATCH]', e);
    return fail(e instanceof Error ? e.message : 'Failed to process action', 500);
  }
}
