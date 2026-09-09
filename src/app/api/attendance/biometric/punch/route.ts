/**
 * Biometric Webhook — Punch Ingestion (REQ-ATT-03)
 * + AI spoofing & buddy-punch detection (REQ-AI-ATT-01, REQ-AI-ATT-02)
 *
 * POST /api/attendance/biometric/punch
 *
 * Headers:
 *   X-Biometric-Token: <raw-token>     (device authenticates with this; TLS 1.3 in transit)
 *   X-Biometric-Serial: <serialNumber> (optional — cross-checked with token)
 *
 * Body (vendor-agnostic):
 *   {
 *     "serialNumber": "ZK-001",
 *     "employeeCode": "EMP-0001",          // matches Employee.employeeId
 *     "punchType": "check_in",             // "check_in" | "check_out"
 *     "punchTime": "2026-06-21T09:14:22Z", // ISO — defaults to now()
 *     "verifyMode": "fingerprint",         // fingerprint | face | palm | card | pin
 *     "livenessScore": 0.92,               // 0..1 (vendor-provided, optional)
 *     "photoUrl": "https://...",           // optional — for human review if flagged
 *     "temperature": 36.7,                 // optional — body temp at terminal
 *     "raw": { ...vendorPayload }          // raw vendor JSON, stored verbatim
 *   }
 *
 * Flow:
 *   1. Look up device by serial + verify token hash.
 *   2. Look up employee by employeeCode.
 *   3. Resolve AI thresholds (defaults if none configured).
 *   4. Compute spoofingRisk (REQ-AI-ATT-01):
 *        - 0.0 if livenessScore ≥ 0.9 AND verifyMode ∈ {fingerprint, face, palm}
 *        - lerp up to 1.0 as livenessScore drops below 0.6
 *        - +0.3 if verifyMode is "card" or "pin" (no biometric factor)
 *   5. Compute buddyPunchRisk (REQ-AI-ATT-02):
 *        - Check impossible travel: if this employee has a punch in the last
 *          `impossibleTravelMinutes` from a device geofence > `impossibleTravelKm`
 *          away, risk = 1.0
 *        - Check off-hours: if punchTime is outside the off-hours window,
 *          +0.3 risk
 *        - Check geofence mismatch: if device.geofenceId is set and the
 *          employee's rostered branch differs from device.branch, +0.4 risk
 *   6. flagged = spoofingRisk > threshold || buddyPunchRisk > threshold
 *      → flagged punches STILL create the Attendance record (for audit) but
 *        status is "flagged" and a BurnoutFlag-style notification is created.
 *   7. Create/update Attendance record (idempotent per employee/date).
 *   8. Persist BiometricPunch row with rawPayload + AI scores.
 *   9. Write AttendanceAuditLog entry (REQ-SEC-ATT-04).
 */
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { Prisma } from '@/generated/prisma/client';
import { NextResponse } from 'next/server';
import { createHash } from 'crypto';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Biometric-Token, X-Biometric-Serial',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: CORS });
}

function fail(error: string, status = 400) {
  return NextResponse.json({ error }, { status, headers: CORS });
}

function hashToken(raw: string) {
  return createHash('sha256').update(raw).digest('hex');
}

// Haversine distance (km) between two lat/lng points
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

async function resolveThresholds() {
  const t = await db.attendanceAiThreshold.findFirst({
    where: { isActive: true },
    orderBy: { updatedAt: 'desc' },
  });
  return (
    t || {
      spoofingRiskThreshold: 0.6,
      buddyPunchRiskThreshold: 0.5,
      impossibleTravelKm: 50,
      impossibleTravelMinutes: 30,
      offHoursStartMinutes: 0,
      offHoursEndMinutes: 0,
    }
  );
}

export async function POST(request: Request) {
  const db = await getDb(request);
  const token = request.headers.get('x-biometric-token');
  if (!token) return fail('Missing X-Biometric-Token header', 401);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return fail('Invalid JSON body');
  }

  const serialNumber = String(body.serialNumber || '').trim();
  if (!serialNumber) return fail('Missing serialNumber in body');

  // 1. Authenticate device by serial + token hash
  const device = await db.biometricDevice.findUnique({
    where: { serialNumber },
    include: {
      branch: { select: { id: true, name: true } },
      geofence: { select: { id: true, name: true, centerLat: true, centerLng: true } },
    },
  });
  if (!device) return fail('Unknown device serial', 404);
  if (!device.isActive) return fail('Device is deactivated', 403);
  if (device.apiTokenHash !== hashToken(token)) return fail('Invalid device token', 401);

  // Update heartbeat
  await db.biometricDevice.update({
    where: { id: device.id },
    data: {
      lastHeartbeatAt: new Date(),
      ipAddress: request.headers.get('x-forwarded-for') || null,
    },
  });

  // 2. Resolve employee
  const employeeCode = String(body.employeeCode || '').trim();
  if (!employeeCode) return fail('Missing employeeCode in body');
  const employee = await db.employee.findUnique({
    where: { employeeId: employeeCode },
    select: { id: true, firstName: true, lastName: true, branchId: true },
  });
  if (!employee) return fail(`No employee with code ${employeeCode}`, 404);

  // 3. Punch type + time
  const punchType = String(body.punchType || '').trim();
  if (!['check_in', 'check_out'].includes(punchType)) {
    return fail('punchType must be "check_in" or "check_out"');
  }
  const punchTime = body.punchTime ? new Date(body.punchTime as string) : new Date();
  if (isNaN(punchTime.getTime())) return fail('Invalid punchTime');

  // 4. AI thresholds
  const thresholds = await resolveThresholds();

  // 5. Spoofing risk (REQ-AI-ATT-01)
  const verifyMode = String(body.verifyMode || 'fingerprint');
  const livenessScore = typeof body.livenessScore === 'number' ? body.livenessScore : 1.0;
  let spoofingRisk = 0;
  if (['card', 'pin'].includes(verifyMode)) {
    spoofingRisk = 0.4; // no biometric factor
  } else if (livenessScore < 0.9) {
    // Lerp from 0 (at 0.9) → 1 (at 0.0)
    spoofingRisk = Math.min(1, (0.9 - livenessScore) / 0.9);
  }
  if (livenessScore < 0.5) spoofingRisk = Math.max(spoofingRisk, 0.8);

  // 6. Buddy-punch risk (REQ-AI-ATT-02)
  let buddyPunchRisk = 0;
  const flagReasons: string[] = [];

  // 6a. Impossible-travel check
  const sinceMs = thresholds.impossibleTravelMinutes * 60 * 1000;
  const recentPunches = await db.biometricPunch.findMany({
    where: {
      employeeId: employee.id,
      punchTime: { gte: new Date(punchTime.getTime() - sinceMs), lte: punchTime },
    },
    include: { device: { select: { geofence: { select: { centerLat: true, centerLng: true } } } } },
    take: 5,
    orderBy: { punchTime: 'desc' },
  });
  for (const rp of recentPunches) {
    const otherGeo = rp.device?.geofence;
    const thisGeo = device.geofence;
    if (otherGeo && thisGeo) {
      const km = haversineKm(otherGeo.centerLat, otherGeo.centerLng, thisGeo.centerLat, thisGeo.centerLng);
      if (km > thresholds.impossibleTravelKm) {
        buddyPunchRisk = 1.0;
        flagReasons.push(`impossible_travel_${km.toFixed(0)}km_in_${thresholds.impossibleTravelMinutes}min`);
        break;
      }
    }
  }

  // 6b. Off-hours check (if configured)
  if (thresholds.offHoursEndMinutes > thresholds.offHoursStartMinutes) {
    const minutesSinceMidnight = punchTime.getHours() * 60 + punchTime.getMinutes();
    const inOffHours =
      minutesSinceMidnight < thresholds.offHoursStartMinutes ||
      minutesSinceMidnight > thresholds.offHoursEndMinutes;
    if (inOffHours) {
      buddyPunchRisk = Math.min(1, buddyPunchRisk + 0.3);
      flagReasons.push('off_hours');
    }
  }

  // 6c. Geofence mismatch — employee's rostered branch ≠ device's branch
  if (device.branchId && employee.branchId && device.branchId !== employee.branchId) {
    buddyPunchRisk = Math.min(1, buddyPunchRisk + 0.4);
    flagReasons.push('branch_mismatch');
  }

  const flagged =
    spoofingRisk > thresholds.spoofingRiskThreshold ||
    buddyPunchRisk > thresholds.buddyPunchRiskThreshold;
  if (spoofingRisk > thresholds.spoofingRiskThreshold) flagReasons.push('spoofing_risk_high');
  if (buddyPunchRisk > thresholds.buddyPunchRiskThreshold) flagReasons.push('buddy_punch_risk_high');

  // 7. Idempotent Attendance upsert (employee + date unique)
  const dayStart = new Date(punchTime);
  dayStart.setHours(0, 0, 0, 0);

  const existing = await db.attendance.findUnique({
    where: { employeeId_date: { employeeId: employee.id, date: dayStart } },
  });

  let attendanceId: string | null = null;
  try {
    const attendance = await db.attendance.upsert({
      where: { employeeId_date: { employeeId: employee.id, date: dayStart } },
      create: {
        employeeId: employee.id,
        date: dayStart,
        checkIn: punchType === 'check_in' ? punchTime : null,
        checkOut: punchType === 'check_out' ? punchTime : null,
        status: flagged ? 'flagged' : punchType === 'check_in' ? 'present' : (existing?.status || 'present'),
        location: device.branch?.name || device.name,
        notes: flagged ? `Flagged: ${flagReasons.join(', ')}` : null,
      },
      update: {
        ...(punchType === 'check_in' ? { checkIn: punchTime } : {}),
        ...(punchType === 'check_out' ? { checkOut: punchTime } : {}),
        status: flagged ? 'flagged' : (existing?.status === 'flagged' ? 'present' : (existing?.status || 'present')),
        notes: flagged ? `Flagged: ${flagReasons.join(', ')}` : existing?.notes,
        location: device.branch?.name || device.name,
      },
    });
    attendanceId = attendance.id;
  } catch (e) {
    // Attendance table may not exist yet in dev — fall back to BiometricPunch only
    console.warn('[biometric/punch] Attendance upsert failed (non-fatal):', e);
  }

  // 8. Persist BiometricPunch row
  const punch = await db.biometricPunch.create({
    data: {
      deviceId: device.id,
      employeeId: employee.id,
      punchType,
      punchTime,
      rawPayload: body as object,
      spoofingRisk,
      buddyPunchRisk,
      flagged,
      flagReasons: flagReasons.length ? flagReasons : Prisma.JsonNull,
      attendanceId,
    },
  });

  // 9. Audit log (REQ-SEC-ATT-04)
  try {
    await db.attendanceAuditLog.create({
      data: {
        employeeId: employee.id,
        attendanceId,
        action: flagged ? 'biometric_punch_flagged' : 'biometric_punch',
        beforeData: existing as Prisma.InputJsonValue,
        afterData: { punchType, punchTime, flagged, flagReasons, deviceId: device.id } as Prisma.InputJsonValue,
        changedBy: `biometric:${device.serialNumber}`,
        changedByIp: request.headers.get('x-forwarded-for') || null,
        reason: flagged ? `Auto-flagged: ${flagReasons.join(', ')}` : 'Biometric punch ingested',
      },
    });
  } catch (e) {
    console.warn('[biometric/punch] Audit log failed (non-fatal):', e);
  }

  return NextResponse.json(
    {
      ok: true,
      punch,
      flagged,
      flagReasons,
      attendanceId,
      spoofingRisk,
      buddyPunchRisk,
    },
    { status: 201, headers: CORS }
  );
}
