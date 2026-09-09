/**
 * Geofence update/delete (admin).
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
  if (!isAdminRole(user.role)) return fail('Admin only', 403);
  const body = await parseBody(request);
  if (!body) return fail('Invalid JSON');
  const { id } = await params;

  try {
    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.branchId !== undefined) data.branchId = body.branchId;
    if (body.polygon !== undefined) data.polygon = body.polygon as never;
    if (body.centerLat !== undefined) data.centerLat = Number(body.centerLat);
    if (body.centerLng !== undefined) data.centerLng = Number(body.centerLng);
    if (body.radiusMeters !== undefined) data.radiusMeters = Number(body.radiusMeters);
    if (body.isActive !== undefined) data.isActive = body.isActive;

    const updated = await db.geofence.update({ where: { id }, data });
    return ok({ geofence: updated });
  } catch (e: unknown) {
    return fail(e instanceof Error ? e.message : 'Failed to update', 500);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const db = await getDb(request);
  const { user, response } = await requireUser(request);
  if (!user) return response;
  if (!isAdminRole(user.role)) return fail('Admin only', 403);
  const { id } = await params;
  try {
    await db.geofence.delete({ where: { id } });
    return ok({ deleted: true });
  } catch (e: unknown) {
    return fail(e instanceof Error ? e.message : 'Failed to delete', 500);
  }
}
