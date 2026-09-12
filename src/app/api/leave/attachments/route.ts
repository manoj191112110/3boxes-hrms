/**
 * Leave Attachments API — REQ-LVE-02, REQ-SEC-ATT-03
 *
 * Medical certificates are stored in a restricted container — locked=true.
 * Only Occupational Health officers (admin with health_officer role) can unlock.
 *
 *  GET  — list attachments for a leave request
 *  POST — upload attachment metadata (the actual file upload happens via a separate file API)
 *  DELETE — remove an attachment (admin only)
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
    const leaveRequestId = q.leaveRequestId as string;
    if (!leaveRequestId) return fail('leaveRequestId is required');

    // Verify ownership (employees can only see their own leave attachments)
    const leaveRequest = await db.leaveRequest.findUnique({
      where: { id: leaveRequestId },
      select: { id: true, employeeId: true },
    });
    if (!leaveRequest) return fail('Leave request not found', 404);

    if (!isAdminRole(user.role)) {
      // Find the employee record for the current user
      const emp = await db.employee.findFirst({ where: { email: user.email }, select: { id: true } });
      if (!emp || emp.id !== leaveRequest.employeeId) return fail('Forbidden', 403);
    }

    const items = await db.leaveAttachment.findMany({
      where: { leaveRequestId },
      orderBy: { uploadedAt: 'desc' },
    });

    // Mask locked medical files for non-health-officers
    const isHealthOfficer = user.role === 'health_officer' || user.role === 'super_admin';
    const masked = items.map(a => {
      if (a.locked && a.isMedical && !isHealthOfficer) {
        return { ...a, fileUrl: null, fileName: '🔒 Restricted medical document' };
      }
      return a;
    });

    return ok({ attachments: masked });
  } catch (e: unknown) {
    return fail(e instanceof Error ? e.message : 'Failed to load', 500);
  }
}

export async function POST(request: Request) {
  const db = await getDb(request);
  const { user, response } = await requireUser(request);
  if (!user) return response;
  const body = await parseBody(request);
  if (!body) return fail('Invalid JSON');
  try {
    const leaveRequestId = body.leaveRequestId as string;
    const fileName = (body.fileName as string) || '';
    const fileUrl = (body.fileUrl as string) || '';
    const mimeType = (body.mimeType as string) || '';
    const fileSize = Number(body.fileSize) || 0;
    const isMedical = !!body.isMedical;
    if (!leaveRequestId || !fileName || !fileUrl) return fail('Missing required fields');

    const record = await db.leaveAttachment.create({
      data: {
        leaveRequestId,
        fileName,
        fileUrl,
        fileSize,
        mimeType,
        isMedical,
        locked: isMedical, // REQ-SEC-ATT-03: auto-lock medical
      },
    });
    return ok({ attachment: record }, 201);
  } catch (e: unknown) {
    return fail(e instanceof Error ? e.message : 'Failed to create', 500);
  }
}
