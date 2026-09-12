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
    if (body.description !== undefined) data.description = body.description;
    if (body.pattern !== undefined) data.pattern = body.pattern as never;
    if (body.rotationUnit !== undefined) data.rotationUnit = body.rotationUnit;
    if (body.startDate !== undefined) data.startDate = new Date(body.startDate as string);
    if (body.isActive !== undefined) data.isActive = body.isActive;

    const updated = await db.rotationalRoster.update({ where: { id }, data });
    return ok({ roster: updated });
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
    await db.rotationalRoster.delete({ where: { id } });
    return ok({ deleted: true });
  } catch (e: unknown) {
    return fail(e instanceof Error ? e.message : 'Failed to delete', 500);
  }
}

/** POST /api/rosters/[id] — assign an employee to this roster. */
export async function POST(
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
    const employeeId = body.employeeId as string;
    if (!employeeId) return fail('employeeId is required');
    const startDate = new Date(body.startDate as string);

    // Verify roster exists
    const roster = await db.rotationalRoster.findUnique({ where: { id } });
    if (!roster) return fail('Roster not found', 404);

    const assignment = await db.employeeRosterAssignment.upsert({
      where: { employeeId_rosterId: { employeeId, rosterId: id } },
      update: { startDate, endDate: body.endDate ? new Date(body.endDate as string) : null, currentOffset: 0 },
      create: { employeeId, rosterId: id, startDate, currentOffset: 0 },
    });
    return ok({ assignment }, 201);
  } catch (e: unknown) {
    return fail(e instanceof Error ? e.message : 'Failed to assign', 500);
  }
}
