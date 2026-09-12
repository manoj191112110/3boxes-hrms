/**
 * Biometric Device Registry API — REQ-ATT-03, REQ-SEC-ATT-02
 *
 * GET  /api/attendance/biometric/devices           — list devices (admin)
 * POST /api/attendance/biometric/devices           — register a new device (admin)
 *
 * The POST returns the raw API token EXACTLY ONCE in the response. We store
 * only its SHA-256 hash. The device then pushes punches to
 *   POST /api/attendance/biometric/punch
 * with header `X-Biometric-Token: <raw-token>` (TLS 1.3 in transit — REQ-SEC-ATT-02).
 */
import { requireUser, parseBody, getQuery, ok, fail, OPTIONS, isAdminRole } from '@/lib/attendance-leave-api';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { randomBytes, createHash } from 'crypto';

export { OPTIONS };

function hashToken(raw: string) {
  return createHash('sha256').update(raw).digest('hex');
}

function generateToken() {
  // 32 bytes of entropy → 64 hex chars. Sufficient for device auth.
  return `bx_${randomBytes(32).toString('hex')}`;
}

export async function GET(request: Request) {
  const db = await getDb(request);
  const { user, response } = await requireUser(request);
  if (!user) return response;
  try {
    const q = getQuery(request);
    const where: Record<string, unknown> = {};
    if (q.branchId) where.branchId = q.branchId;
    if (q.isActive) where.isActive = q.isActive === 'true';
    if (q.vendor) where.vendor = q.vendor;

    const devices = await db.biometricDevice.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        branch: { select: { id: true, name: true } },
        geofence: { select: { id: true, name: true } },
        _count: { select: { enrollments: true, punches: true } },
      },
      take: 200,
    });
    return ok({ devices });
  } catch (e: unknown) {
    return fail(e instanceof Error ? e.message : 'Failed to load devices', 500);
  }
}

export async function POST(request: Request) {
  const db = await getDb(request);
  const { user, response } = await requireUser(request);
  if (!user) return response;
  if (!isAdminRole(user.role)) return fail('Only admins can register biometric devices', 403);

  const body = await parseBody(request);
  if (!body) return fail('Invalid JSON');

  const name = String(body.name || '').trim();
  const serialNumber = String(body.serialNumber || '').trim();
  const vendor = String(body.vendor || '').trim();
  if (!name || !serialNumber || !vendor) {
    return fail('Missing required fields: name, serialNumber, vendor');
  }
  if (!['zkteco', 'mantra', 'secugen', 'suprema', 'custom'].includes(vendor)) {
    return fail('Invalid vendor — must be one of: zkteco, mantra, secugen, suprema, custom');
  }

  // Check serial uniqueness
  const existing = await db.biometricDevice.findUnique({ where: { serialNumber } });
  if (existing) return fail('A device with this serial number is already registered', 409);

  // Generate raw token (returned once) + store hash
  const rawToken = generateToken();
  const apiTokenHash = hashToken(rawToken);

  // Encryption key fingerprint — optional, vendor-provided
  const encryptionKeyId = body.encryptionKeyId ? String(body.encryptionKeyId) : null;

  try {
    const device = await db.biometricDevice.create({
      data: {
        name,
        serialNumber,
        vendor,
        model: body.model ? String(body.model) : null,
        firmwareVersion: body.firmwareVersion ? String(body.firmwareVersion) : null,
        branchId: body.branchId ? String(body.branchId) : null,
        geofenceId: body.geofenceId ? String(body.geofenceId) : null,
        apiTokenHash,
        encryptionKeyId,
        isActive: body.isActive !== false,
      },
    });

    // Return raw token EXACTLY ONCE — caller must persist it on the device.
    return ok({ device, apiToken: rawToken, message: 'Save this token — it will not be shown again.' }, 201);
  } catch (e: unknown) {
    return fail(e instanceof Error ? e.message : 'Failed to register device', 500);
  }
}
