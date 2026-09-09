/**
 * Rotate a biometric device's API token (REQ-SEC-ATT-02).
 *
 * POST /api/attendance/biometric/devices/[id]/rotate-token
 *
 * Returns a NEW raw token (saved once on the device) and a NEW hash stored in DB.
 * The old token immediately stops working.
 */
import { requireUser, ok, fail, OPTIONS, isAdminRole } from '@/lib/attendance-leave-api';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { randomBytes, createHash } from 'crypto';

export { OPTIONS };

function hashToken(raw: string) {
  return createHash('sha256').update(raw).digest('hex');
}

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const db = await getDb(request);
  const { user, response } = await requireUser(request);
  if (!user) return response;
  if (!isAdminRole(user.role)) return fail('Only admins can rotate device tokens', 403);

  const { id } = await ctx.params;
  const rawToken = `bx_${randomBytes(32).toString('hex')}`;
  const apiTokenHash = hashToken(rawToken);

  try {
    const device = await db.biometricDevice.update({
      where: { id },
      data: { apiTokenHash },
    });
    return ok({
      device,
      apiToken: rawToken,
      message: 'New token generated. Update the device immediately — the old token no longer works.',
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to rotate token';
    if (msg.includes('RecordNotFound')) return fail('Device not found', 404);
    return fail(msg, 500);
  }
}
