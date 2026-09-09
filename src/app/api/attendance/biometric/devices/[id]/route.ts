/**
 * Biometric Device — single-record CRUD
 *
 * GET    /api/attendance/biometric/devices/[id]   — fetch one device + stats
 * PATCH  /api/attendance/biometric/devices/[id]   — update name/model/branch/geofence/isActive
 * DELETE /api/attendance/biometric/devices/[id]   — deactivate (soft delete)
 */
import { requireUser, parseBody, ok, fail, OPTIONS, isAdminRole } from '@/lib/attendance-leave-api';
import { getDb, getPlatformDb } from '@/lib/tenant-db';

export { OPTIONS };

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const db = await getDb(request);
  const { user, response } = await requireUser(request);
  if (!user) return response;
  const { id } = await ctx.params;
  try {
    const device = await db.biometricDevice.findUnique({
      where: { id },
      include: {
        branch: { select: { id: true, name: true } },
        geofence: { select: { id: true, name: true } },
        _count: { select: { enrollments: true, punches: true } },
      },
    });
    if (!device) return fail('Device not found', 404);
    return ok({ device });
  } catch (e: unknown) {
    return fail(e instanceof Error ? e.message : 'Failed to load device', 500);
  }
}

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const db = await getDb(request);
  const { user, response } = await requireUser(request);
  if (!user) return response;
  if (!isAdminRole(user.role)) return fail('Only admins can edit biometric devices', 403);

  const body = await parseBody(request);
  if (!body) return fail('Invalid JSON');
  const { id } = await ctx.params;

  const data: Record<string, unknown> = {};
  if (typeof body.name === 'string') data.name = body.name.trim();
  if (typeof body.model === 'string') data.model = body.model;
  if (typeof body.firmwareVersion === 'string') data.firmwareVersion = body.firmwareVersion;
  if (body.branchId !== undefined) data.branchId = body.branchId ? String(body.branchId) : null;
  if (body.geofenceId !== undefined) data.geofenceId = body.geofenceId ? String(body.geofenceId) : null;
  if (typeof body.isActive === 'boolean') data.isActive = body.isActive;
  if (typeof body.encryptionKeyId === 'string') data.encryptionKeyId = body.encryptionKeyId;

  try {
    const device = await db.biometricDevice.update({ where: { id }, data });
    return ok({ device });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to update device';
    if (msg.includes('RecordNotFound')) return fail('Device not found', 404);
    return fail(msg, 500);
  }
}

export async function DELETE(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const db = await getDb(request);
  const { user, response } = await requireUser(request);
  if (!user) return response;
  if (!isAdminRole(user.role)) return fail('Only admins can deactivate biometric devices', 403);
  const { id } = await ctx.params;

  // Soft-delete: mark as inactive. Historical punch records are retained for audit (REQ-SEC-ATT-04).
  try {
    const device = await db.biometricDevice.update({
      where: { id },
      data: { isActive: false },
    });
    return ok({ device });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to deactivate device';
    if (msg.includes('RecordNotFound')) return fail('Device not found', 404);
    return fail(msg, 500);
  }
}
