/**
 * Revoke a biometric enrollment (REQ-SEC-ATT-02 — right-to-be-forgotten for biometric data).
 *
 * DELETE /api/attendance/biometric/enrollments/[id]
 *   Soft-deletes the enrollment (sets isActive=false). Historical punch records
 *   are retained because they are tied to Attendance audit logs (REQ-SEC-ATT-04),
 *   but no new punches will match.
 */
import { requireUser, ok, fail, OPTIONS, isAdminRole } from '@/lib/attendance-leave-api';
import { getDb, getPlatformDb } from '@/lib/tenant-db';

export { OPTIONS };

export async function DELETE(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const db = await getDb(request);
  const { user, response } = await requireUser(request);
  if (!user) return response;
  if (!isAdminRole(user.role)) return fail('Only admins can revoke biometric enrollments', 403);

  const { id } = await ctx.params;
  try {
    const enrollment = await db.biometricEnrollment.update({
      where: { id },
      data: { isActive: false },
    });
    return ok({ enrollment });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to revoke enrollment';
    if (msg.includes('RecordNotFound')) return fail('Enrollment not found', 404);
    return fail(msg, 500);
  }
}
