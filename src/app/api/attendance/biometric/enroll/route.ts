/**
 * Biometric Enrollment API — REQ-ATT-03, REQ-SEC-ATT-02
 *
 * POST /api/attendance/biometric/enroll
 *   Body: { employeeId, deviceId, templateHash, modality?, qualityScore? }
 *
 * Enrolls an employee against a specific biometric device. We NEVER store the
 * raw biometric template — only its SHA-256 hash. The device retains the
 * encrypted template blob and does the matching locally; we use the hash only
 * for audit and dedup.
 *
 * GET /api/attendance/biometric/enroll?deviceId=...&employeeId=...
 *   Lists enrollments, optionally filtered.
 */
import { requireUser, parseBody, getQuery, ok, fail, OPTIONS, isAdminRole } from '@/lib/attendance-leave-api';
import { getDb, getPlatformDb } from '@/lib/tenant-db';

export { OPTIONS };

const MODALITIES = ['fingerprint', 'face', 'palm', 'iris'];

export async function GET(request: Request) {
  const db = await getDb(request);
  const { user, response } = await requireUser(request);
  if (!user) return response;
  try {
    const q = getQuery(request);
    const where: Record<string, unknown> = {};
    if (q.deviceId) where.deviceId = q.deviceId;
    if (q.employeeId) where.employeeId = q.employeeId;
    if (q.isActive !== undefined) where.isActive = q.isActive === 'true';
    if (q.modality) where.modality = q.modality;

    const enrollments = await db.biometricEnrollment.findMany({
      where,
      orderBy: { enrolledAt: 'desc' },
      include: {
        employee: {
          select: { id: true, firstName: true, lastName: true, employeeId: true, email: true },
        },
        device: { select: { id: true, name: true, serialNumber: true, vendor: true } },
      },
      take: 500,
    });
    return ok({ enrollments });
  } catch (e: unknown) {
    return fail(e instanceof Error ? e.message : 'Failed to load enrollments', 500);
  }
}

export async function POST(request: Request) {
  const db = await getDb(request);
  const { user, response } = await requireUser(request);
  if (!user) return response;
  if (!isAdminRole(user.role)) return fail('Only admins can enroll biometric templates', 403);

  const body = await parseBody(request);
  if (!body) return fail('Invalid JSON');

  const employeeId = String(body.employeeId || '').trim();
  const deviceId = String(body.deviceId || '').trim();
  const templateHash = String(body.templateHash || '').trim();
  const modality = body.modality ? String(body.modality) : 'fingerprint';

  if (!employeeId || !deviceId || !templateHash) {
    return fail('Missing required fields: employeeId, deviceId, templateHash');
  }
  if (!MODALITIES.includes(modality)) {
    return fail(`Invalid modality — must be one of: ${MODALITIES.join(', ')}`);
  }
  if (templateHash.length < 16) {
    return fail('templateHash must be at least 16 chars (SHA-256 of encrypted template recommended)');
  }

  try {
    // Verify employee + device exist
    const [emp, device] = await Promise.all([
      db.employee.findUnique({ where: { id: employeeId }, select: { id: true, firstName: true, lastName: true } }),
      db.biometricDevice.findUnique({ where: { id: deviceId }, select: { id: true, name: true, isActive: true } }),
    ]);
    if (!emp) return fail('Employee not found', 404);
    if (!device) return fail('Device not found', 404);
    if (!device.isActive) return fail('Cannot enroll against an inactive device');

    // Unique (employeeId, deviceId) — upsert
    const enrollment = await db.biometricEnrollment.upsert({
      where: { employeeId_deviceId: { employeeId, deviceId } },
      create: {
        employeeId,
        deviceId,
        templateHash,
        modality,
        qualityScore: typeof body.qualityScore === 'number' ? body.qualityScore : null,
      },
      update: {
        // Re-enrollment replaces the hash + reactivates
        templateHash,
        modality,
        qualityScore: typeof body.qualityScore === 'number' ? body.qualityScore : null,
        isActive: true,
      },
    });
    return ok({ enrollment }, 201);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to enroll';
    if (msg.includes('templateHash')) return fail('This template is already registered to another employee', 409);
    return fail(msg, 500);
  }
}
