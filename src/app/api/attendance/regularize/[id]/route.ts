/**
 * Approve / reject a regularization request (REQ-REG-03).
 * PATCH /api/attendance/regularize/[id]
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
  if (!['approved', 'rejected'].includes(status)) return fail('Invalid status');

  try {
    const existing = await db.attendanceRegularization.findUnique({ where: { id } });
    if (!existing) return fail('Not found', 404);

    const updated = await db.attendanceRegularization.update({
      where: { id },
      data: {
        status,
        approvedBy: user.id || user.email || 'system',
        approvedAt: new Date(),
        comments: (body.comments as string) || null,
      },
    });

    // If approved, apply the punch to the attendance record + write audit log
    if (status === 'approved') {
      const date = existing.date;
      let attendance = await db.attendance.findFirst({ where: { employeeId: existing.employeeId, date } });
      const beforeData = attendance ? {
        checkIn: attendance.checkIn, checkOut: attendance.checkOut, status: attendance.status,
      } : null;

      if (existing.punchType === 'check_in') {
        if (attendance) {
          attendance = await db.attendance.update({
            where: { id: attendance.id },
            data: { checkIn: existing.requestedTime, status: 'present' },
          });
        } else {
          attendance = await db.attendance.create({
            data: {
              employeeId: existing.employeeId,
              date,
              checkIn: existing.requestedTime,
              status: 'present',
            },
          });
        }
      } else {
        // check_out
        if (attendance) {
          attendance = await db.attendance.update({
            where: { id: attendance.id },
            data: { checkOut: existing.requestedTime },
          });
          // Recompute work hours
          if (attendance.checkIn && attendance.checkOut) {
            const hours = (attendance.checkOut.getTime() - attendance.checkIn.getTime()) / (1000 * 60 * 60);
            await db.attendance.update({ where: { id: attendance.id }, data: { workHours: Math.round(hours * 100) / 100 } });
          }
        } else {
          attendance = await db.attendance.create({
            data: { employeeId: existing.employeeId, date, checkOut: existing.requestedTime, status: 'present' },
          });
        }
      }

      // REQ-SEC-ATT-04: audit log
      await db.attendanceAuditLog.create({
        data: {
          employeeId: existing.employeeId,
          attendanceId: attendance?.id || null,
          action: 'regularization_approved',
          beforeData: beforeData as object,
          afterData: {
            checkIn: attendance?.checkIn, checkOut: attendance?.checkOut, status: attendance?.status,
          },
          changedBy: user.id || user.email || 'system',
          reason: `Regularization: ${existing.reason}`,
        },
      });
    }

    return ok({ regularization: updated });
  } catch (e: unknown) {
    return fail(e instanceof Error ? e.message : 'Failed to update', 500);
  }
}
