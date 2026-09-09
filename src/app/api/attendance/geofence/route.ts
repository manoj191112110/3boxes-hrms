/**
 * Geofence API — REQ-ATT-04
 *  GET  — list geofences (admin) or check the employee's geofence
 *  POST — create a new geofence (admin only)
 */
import { requireUser, isAdminRole, parseBody, getQuery, ok, fail, OPTIONS } from '@/lib/attendance-leave-api';
import { getDb, getPlatformDb } from '@/lib/tenant-db';

export { OPTIONS };

export async function GET(request: Request) {
  const db = await getDb(request);
  const { user, response } = await requireUser(request);
  if (!user) return response;
  try {
    const q = getQuery(request);
    const where: Record<string, unknown> = {};
    if (q.branchId) where.branchId = q.branchId;
    if (q.active === 'true') where.isActive = true;

    const items = await db.geofence.findMany({
      where,
      include: { branch: { select: { id: true, name: true, city: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return ok({ geofences: items });
  } catch (e: unknown) {
    return fail(e instanceof Error ? e.message : 'Failed to load', 500);
  }
}

export async function POST(request: Request) {
  const db = await getDb(request);
  const { user, response } = await requireUser(request);
  if (!user) return response;
  if (!isAdminRole(user.role)) return fail('Admin only', 403);
  const body = await parseBody(request);
  if (!body) return fail('Invalid JSON');
  try {
    const name = (body.name as string) || '';
    if (!name) return fail('Name is required');
    const polygon = body.polygon as object;
    if (!polygon) return fail('Polygon is required');
    const centerLat = Number(body.centerLat);
    const centerLng = Number(body.centerLng);
    if (!Number.isFinite(centerLat) || !Number.isFinite(centerLng)) return fail('Invalid center');

    const record = await db.geofence.create({
      data: {
        name,
        branchId: (body.branchId as string) || null,
        polygon: polygon as never,
        centerLat,
        centerLng,
        radiusMeters: Number(body.radiusMeters) || 200,
        isActive: body.isActive !== false,
      },
    });
    return ok({ geofence: record }, 201);
  } catch (e: unknown) {
    return fail(e instanceof Error ? e.message : 'Failed to create', 500);
  }
}
