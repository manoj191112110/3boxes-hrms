/**
 * Biometric Device Heartbeat — REQ-ATT-03
 *
 * POST /api/attendance/biometric/heartbeat
 *
 * Devices ping this every 60s–5min to signal liveness. We update
 * `lastHeartbeatAt` and `ipAddress`. Devices whose heartbeat is older
 * than 15min are shown as "offline" in the admin UI.
 */
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { NextResponse } from 'next/server';
import { createHash } from 'crypto';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Biometric-Token',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: CORS });
}

export async function POST(request: Request) {
  const db = await getDb(request);
  const token = request.headers.get('x-biometric-token');
  if (!token) {
    return NextResponse.json({ error: 'Missing X-Biometric-Token' }, { status: 401, headers: CORS });
  }
  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch { /* empty body is fine */ }
  const serial = String(body.serialNumber || '').trim();
  if (!serial) {
    return NextResponse.json({ error: 'Missing serialNumber' }, { status: 400, headers: CORS });
  }
  const device = await db.biometricDevice.findUnique({ where: { serialNumber: serial } });
  if (!device) return NextResponse.json({ error: 'Unknown device' }, { status: 404, headers: CORS });
  if (device.apiTokenHash !== createHash('sha256').update(token).digest('hex')) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401, headers: CORS });
  }
  const updated = await db.biometricDevice.update({
    where: { id: device.id },
    data: {
      lastHeartbeatAt: new Date(),
      ipAddress: request.headers.get('x-forwarded-for') || device.ipAddress,
      ...(body.firmwareVersion ? { firmwareVersion: String(body.firmwareVersion) } : {}),
    },
  });
  return NextResponse.json({ ok: true, lastHeartbeatAt: updated.lastHeartbeatAt }, { headers: CORS });
}
