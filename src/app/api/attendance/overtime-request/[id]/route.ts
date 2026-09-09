/**
 * Approve / reject an OT request. When approved with payoutPreference=comp_off,
 * credit a CompOffLeave record (REQ-OT-03).
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
  if (!['approved', 'rejected', 'cancelled'].includes(status)) return fail('Invalid status');

  try {
    const existing = await db.overtimeRequest.findUnique({ where: { id } });
    if (!existing) return fail('Not found', 404);

    let compOffCreditedId: string | null = null;
    let compOffCreditedAt: Date | null = null;

    if (status === 'approved' && existing.payoutPreference === 'comp_off') {
      // Credit a CompOffLeave — expires after 90 days (typical policy)
      const expiry = new Date(existing.date);
      expiry.setDate(expiry.getDate() + 90);
      const compOff = await db.compOffLeave.create({
        data: {
          employeeId: existing.employeeId,
          earnedDate: existing.date,
          hours: existing.estimatedHours,
          source: 'overtime',
          sourceOvertimeRequestId: existing.id,
          expiryDate: expiry,
          status: 'active',
        },
      });
      compOffCreditedId = compOff.id;
      compOffCreditedAt = new Date();
    }

    const updated = await db.overtimeRequest.update({
      where: { id },
      data: {
        status,
        approvedBy: user.id || user.email || 'system',
        approvedAt: new Date(),
        comments: (body.comments as string) || null,
        compOffCreditedId,
        compOffCreditedAt,
      },
    });

    // If approved as payout, also create an OvertimeRecord for payroll processing
    if (status === 'approved' && existing.payoutPreference === 'payout') {
      await db.overtimeRecord.upsert({
        where: { employeeId_date: { employeeId: existing.employeeId, date: existing.date } },
        update: {
          hours: existing.estimatedHours,
          reason: existing.reason,
          status: 'approved',
          approvedBy: user.id || user.email || 'system',
          approvedAt: new Date(),
        },
        create: {
          employeeId: existing.employeeId,
          date: existing.date,
          hours: existing.estimatedHours,
          rateType: 'HOURLY_RATE',
          rate: 0,
          amount: 0,
          reason: existing.reason,
          project: (existing.projectId as string | null) || null,
          status: 'approved',
          approvedBy: user.id || user.email || 'system',
          approvedAt: new Date(),
        },
      });
    }

    return ok({ overtimeRequest: updated });
  } catch (e: unknown) {
    return fail(e instanceof Error ? e.message : 'Failed to update', 500);
  }
}
