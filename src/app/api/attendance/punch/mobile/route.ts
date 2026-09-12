/**
 * Mobile App GPS Punch Endpoint — REQ-ATT-02, REQ-ATT-06, REQ-SEC-ATT-01
 *
 * POST /api/attendance/punch/mobile
 *
 * This is the unified endpoint the mobile app calls when the employee taps
 * "Check In" / "Check Out" on their phone. It does the following in one shot:
 *
 *   1. Authenticates the user via the standard Bearer JWT (NOT a device token —
 *      the user is the actor here, the phone is just the transport).
 *   2. Resolves the employee record.
 *   3. Validates the GPS coordinates against the employee's expected geofence
 *      (REQ-ATT-04). If the punch is OUTSIDE all active geofences:
 *        - status = "flagged"
 *        - reason = "outside_geofence"
 *        - the punch STILL lands (for audit) but is flagged for review.
 *   4. If a biometric vector is provided (the phone has a fingerprint/face
 *      capture), runs the same spoofing/buddy logic as the device webhook.
 *   5. Persists a WfhAttendanceSnapshot (REQ-ATT-06, REQ-SEC-ATT-01) — ONE GPS
 *      snapshot per punch, no continuous tracking.
 *   6. Upserts the Attendance record.
 *   7. Writes an AttendanceAuditLog entry (REQ-SEC-ATT-04).
 *
 * REQ-SEC-ATT-01 (No Continuous Tracking):
 *   We ONLY store latitude/longitude at the moment of the punch. We never
 *   compute a trajectory, never store the phone's location history, and
 *   never query the device's location outside this endpoint.
 *
 * Body:
 *   {
 *     "punchType": "check_in" | "check_out",
 *     "latitude": 12.9716,
 *     "longitude": 77.5946,
 *     "accuracy": 12,                  // GPS accuracy in meters (optional)
 *     "punchTime": "2026-06-21T09:14Z", // ISO — defaults to now()
 *     "geofenceId": "...",              // optional — if the app knows which geofence it claims to be inside
 *     "biometric": {                    // optional — from phone fingerprint/face capture
 *       "verifyMode": "face",
 *       "livenessScore": 0.95,
 *       "templateHash": "..."          // SHA-256 of the on-device template
 *     },
 *     "activity": {                     // optional — WFH activity snapshot (REQ-ATT-07)
 *       "chats": 12,
 *       "timesheets": 2.5,
 *       "emails": 5
 *     },
 *     "note": "Visitor lot full, parked on street"
 *   }
 */
import { requireUser, findEmployeeByEmail, parseBody, ok, fail, OPTIONS } from '@/lib/attendance-leave-api';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { Prisma } from '@/generated/prisma/client';
import { localDayStartFor, localMinutesSinceMidnight, resolveTimezone } from '@/lib/timezone-utils';

export { OPTIONS };

// Haversine distance (meters)
function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Point-in-polygon (ray casting) for GeoJSON Polygon coordinates
// coords = [[[lat,lng], [lat,lng], ...]] — outer ring only
function isInsidePolygon(lat: number, lng: number, polygon: unknown): boolean {
  try {
    const p = polygon as { coordinates?: number[][][] } | number[][][] | undefined;
    const ring: number[][] = Array.isArray((p as { coordinates?: number[][][] })?.coordinates?.[0])
      ? (p as { coordinates: number[][][] }).coordinates[0]
      : Array.isArray(p as unknown)
        ? (p as number[][][])[0]
        : Array.isArray(p)
          ? (p as unknown as number[][])
          : [];
    if (ring.length < 3) return false;
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      const intersect =
        yi > lat !== yj > lat &&
        lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  } catch {
    return false;
  }
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
  // 1. Authenticate user (NOT device — this is the mobile app)
  const { user, response } = await requireUser(request);
  if (!user) return response;

  const body = await parseBody(request);
  if (!body) return fail('Invalid JSON');

  // 2. Resolve employee
  const emp = await findEmployeeByEmail(user.email);
  if (!emp) return fail('Employee record not found', 404);

  // REQ-ATT-05: Multi-country time sync — resolve the employee's local
  // timezone so the "attendance day" bucket is computed in LOCAL time, not UTC.
  // We look up the employee's branch + company + tenant to find a declared
  // timezone, falling back to UTC if none is set.
  let employeeTz = 'UTC';
  try {
    const [branch, company, tenant] = await Promise.all([
      emp.branchId ? db.branch.findUnique({ where: { id: emp.branchId }, select: { timezone: true, name: true } }) : null,
      emp.companyId ? db.company.findUnique({ where: { id: emp.companyId }, select: { timezone: true, name: true } }) : null,
      null, // tenant lookup would go here if Employee had tenantId
    ]);
    employeeTz = resolveTimezone([branch, company]);
  } catch {
    // If timezone columns don't exist yet, just fall back to UTC.
  }

  // 3. Validate input
  const punchType = String(body.punchType || '').trim();
  if (!['check_in', 'check_out'].includes(punchType)) {
    return fail('punchType must be "check_in" or "check_out"');
  }
  const latitude = Number(body.latitude);
  const longitude = Number(body.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return fail('Invalid latitude/longitude');
  }
  const punchTime = body.punchTime ? new Date(body.punchTime) : new Date();
  if (isNaN(punchTime.getTime())) return fail('Invalid punchTime');

  // 4. Geofence validation (REQ-ATT-04)
  //    Find all active geofences. If body.geofenceId is provided, validate
  //    against that one specifically. Otherwise find the nearest one and
  //    check if the punch is inside it.
  const geofences = await db.geofence.findMany({
    where: { isActive: true },
    include: { branch: { select: { id: true, name: true } } },
  });

  let matchedGeofence: (typeof geofences)[number] | null = null;
  let nearestGeofence: (typeof geofences)[number] | null = null;
  let nearestDistance = Infinity;
  const flagReasons: string[] = [];

  for (const g of geofences) {
    // Try polygon first (more precise), fall back to radius
    let inside = false;
    if (g.polygon && typeof g.polygon === 'object') {
      inside = isInsidePolygon(latitude, longitude, g.polygon);
    }
    if (!inside) {
      const d = haversineMeters(latitude, longitude, g.centerLat, g.centerLng);
      if (d < nearestDistance) {
        nearestDistance = d;
        nearestGeofence = g;
      }
      if (d <= g.radiusMeters) inside = true;
    }
    if (inside) {
      matchedGeofence = g;
      if (body.geofenceId && g.id === body.geofenceId) break;
    }
  }

  if (!matchedGeofence) {
    flagReasons.push('outside_geofence');
    if (nearestGeofence) {
      flagReasons.push(`nearest_${(nearestDistance / 1000).toFixed(2)}km_${nearestGeofence.name}`);
    }
  }

  // 5. AI spoofing / buddy-punch — only if biometric vector provided
  let spoofingRisk = 0;
  let buddyPunchRisk = 0;
  const thresholds = await resolveThresholds();

  if (body.biometric && typeof body.biometric === 'object') {
    const b = body.biometric as Record<string, unknown>;
    const verifyMode = String(b.verifyMode || 'fingerprint');
    const livenessScore = typeof b.livenessScore === 'number' ? b.livenessScore : 1.0;

    if (['card', 'pin'].includes(verifyMode)) {
      spoofingRisk = 0.4;
    } else if (livenessScore < 0.9) {
      spoofingRisk = Math.min(1, (0.9 - livenessScore) / 0.9);
    }
    if (livenessScore < 0.5) spoofingRisk = Math.max(spoofingRisk, 0.8);

    // Optional: cross-check the provided templateHash against the employee's enrollment
    if (b.templateHash) {
      const enrollment = await db.biometricEnrollment.findFirst({
        where: { employeeId: emp.id, isActive: true },
      });
      if (enrollment && enrollment.templateHash !== b.templateHash) {
        buddyPunchRisk = Math.min(1, buddyPunchRisk + 0.8);
        flagReasons.push('template_mismatch');
      }
    }
  }

  // Off-hours check (if configured) — uses LOCAL time-of-day (REQ-ATT-05)
  if (thresholds.offHoursEndMinutes > thresholds.offHoursStartMinutes) {
    const minutesSinceMidnight = localMinutesSinceMidnight(punchTime, employeeTz);
    if (
      minutesSinceMidnight < thresholds.offHoursStartMinutes ||
      minutesSinceMidnight > thresholds.offHoursEndMinutes
    ) {
      buddyPunchRisk = Math.min(1, buddyPunchRisk + 0.2);
      flagReasons.push('off_hours');
    }
  }

  const flagged =
    flagReasons.includes('outside_geofence') ||
    spoofingRisk > thresholds.spoofingRiskThreshold ||
    buddyPunchRisk > thresholds.buddyPunchRiskThreshold;
  if (spoofingRisk > thresholds.spoofingRiskThreshold) flagReasons.push('spoofing_risk_high');
  if (buddyPunchRisk > thresholds.buddyPunchRiskThreshold) flagReasons.push('buddy_punch_risk_high');

  // 6. Persist WfhAttendanceSnapshot (REQ-ATT-06, REQ-SEC-ATT-01)
  //    ONE GPS snapshot per punch — no continuous tracking.
  const snapshot = await db.wfhAttendanceSnapshot.create({
    data: {
      employeeId: emp.id,
      date: new Date(punchTime.getTime()),
      punchType,
      punchTime,
      latitude,
      longitude,
      activityChats: body.activity?.chats ? Number(body.activity.chats) : 0,
      activityTimesheets: body.activity?.timesheets ? Number(body.activity.timesheets) : 0,
      activityEmails: body.activity?.emails ? Number(body.activity.emails) : 0,
      aiBurnoutRisk: null,
    },
  }).catch((e) => {
    console.warn('[punch/mobile] WfhAttendanceSnapshot failed (non-fatal):', e);
    return null;
  });

  // 7. Upsert Attendance record (idempotent per employee + LOCAL date — REQ-ATT-05)
  //    The "day" bucket is computed in the employee's local timezone so that
  //    a 9 AM IST punch on the 21st is recorded on the 21st (not the 20th in UTC).
  const dayStart = localDayStartFor(punchTime, employeeTz);

  let attendanceId: string | null = null;
  let previousStatus: string | null = null;
  try {
    const existing = await db.attendance.findUnique({
      where: { employeeId_date: { employeeId: emp.id, date: dayStart } },
    });
    previousStatus = existing?.status || null;

    const attendance = await db.attendance.upsert({
      where: { employeeId_date: { employeeId: emp.id, date: dayStart } },
      create: {
        employeeId: emp.id,
        date: dayStart,
        checkIn: punchType === 'check_in' ? punchTime : null,
        checkOut: punchType === 'check_out' ? punchTime : null,
        status: flagged ? 'flagged' : 'present',
        location: matchedGeofence?.name || (flagReasons.includes('outside_geofence') ? 'OUTSIDE_GEOFENCE' : 'Mobile'),
        notes: flagReasons.length ? `Flagged: ${flagReasons.join(', ')}` : (body.note || null),
      },
      update: {
        ...(punchType === 'check_in' ? { checkIn: punchTime } : {}),
        ...(punchType === 'check_out' ? { checkOut: punchTime } : {}),
        status: flagged ? 'flagged' : (existing?.status === 'flagged' ? 'present' : (existing?.status || 'present')),
        notes: flagReasons.length ? `Flagged: ${flagReasons.join(', ')}` : (body.note || existing?.notes),
        location: matchedGeofence?.name || (flagReasons.includes('outside_geofence') ? 'OUTSIDE_GEOFENCE' : 'Mobile'),
      },
    });
    attendanceId = attendance.id;
  } catch (e) {
    console.warn('[punch/mobile] Attendance upsert failed (non-fatal):', e);
  }

  // 8. Audit log (REQ-SEC-ATT-04)
  try {
    await db.attendanceAuditLog.create({
      data: {
        employeeId: emp.id,
        attendanceId,
        action: flagged ? 'mobile_punch_flagged' : 'mobile_punch',
        beforeData: { previousStatus } as Prisma.InputJsonValue,
        afterData: {
          punchType,
          punchTime,
          latitude,
          longitude,
          geofenceId: matchedGeofence?.id || null,
          flagged,
          flagReasons,
          spoofingRisk,
          buddyPunchRisk,
        } as Prisma.InputJsonValue,
        changedBy: user.email || 'mobile-app',
        changedByIp: request.headers.get('x-forwarded-for') || null,
        reason: flagged ? `Auto-flagged: ${flagReasons.join(', ')}` : 'Mobile GPS punch',
      },
    });
  } catch (e) {
    console.warn('[punch/mobile] Audit log failed (non-fatal):', e);
  }

  return ok(
    {
      ok: true,
      punchType,
      punchTime,
      // REQ-ATT-05: include the resolved timezone + local-day bucket so the
      // mobile app can confirm which day the punch was recorded under.
      timezone: employeeTz,
      attendanceDay: dayStart,
      flagged,
      flagReasons,
      spoofingRisk,
      buddyPunchRisk,
      geofence: matchedGeofence
        ? { id: matchedGeofence.id, name: matchedGeofence.name, branch: matchedGeofence.branch?.name || null }
        : null,
      nearestGeofence: nearestGeofence
        ? { id: nearestGeofence.id, name: nearestGeofence.name, distanceMeters: Math.round(nearestDistance) }
        : null,
      attendanceId,
      snapshotId: snapshot?.id || null,
    },
    201
  );
}
