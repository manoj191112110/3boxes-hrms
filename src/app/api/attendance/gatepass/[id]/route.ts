/**
 * Two-tier gatepass approval (REQ-GATE-01).
 * PATCH /api/attendance/gatepass/[id]
 *   body: { tier: "manager" | "security", action: "approved" | "rejected", comments? }
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
  if (!isAdminRole(user.role)) return fail('Only managers/security can approve', 403);
  const body = await parseBody(request);
  if (!body) return fail('Invalid JSON');

  const { id } = await params;
  const tier = body.tier as string;
  const action = body.action as string;
  if (!['manager', 'security'].includes(tier)) return fail('Invalid tier');
  if (!['approved', 'rejected'].includes(action)) return fail('Invalid action');

  try {
    const existing = await db.gatepass.findUnique({ where: { id } });
    if (!existing) return fail('Not found', 404);

    const approver = user.id || user.email || 'system';
    const now = new Date();
    const data: Record<string, unknown> = {};
    if (tier === 'manager') {
      data.managerStatus = action;
      data.managerApprovedBy = approver;
      data.managerApprovedAt = now;
    } else {
      data.securityStatus = action;
      data.securityApprovedBy = approver;
      data.securityApprovedAt = now;
    }

    // Compute aggregate status
    const mStatus = tier === 'manager' ? action : existing.managerStatus;
    const sStatus = tier === 'security' ? action : existing.securityStatus;
    if (mStatus === 'rejected' || sStatus === 'rejected') {
      data.status = 'rejected';
    } else if (mStatus === 'approved' && sStatus === 'approved') {
      data.status = 'approved';
      data.gateOpenedAt = now;
    } else {
      data.status = 'pending';
    }

    const updated = await db.gatepass.update({ where: { id }, data });
    return ok({ gatepass: updated });
  } catch (e: unknown) {
    return fail(e instanceof Error ? e.message : 'Failed to update', 500);
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const db = await getDb(request);
  // Mark gatepass as completed (visitor/contractor returned)
  const { user, response } = await requireUser(request);
  if (!user) return response;
  if (!isAdminRole(user.role)) return fail('Only security can complete gatepass', 403);
  const body = await parseBody(request);
  if (!body) return fail('Invalid JSON');
  const { id } = await params;

  try {
    const updated = await db.gatepass.update({
      where: { id },
      data: {
        actualInTime: body.actualInTime ? new Date(body.actualInTime as string) : new Date(),
        status: 'completed',
      },
    });
    return ok({ gatepass: updated });
  } catch (e: unknown) {
    return fail(e instanceof Error ? e.message : 'Failed to update', 500);
  }
}
