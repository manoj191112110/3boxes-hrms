/**
 * Hourly Permission / Short-Leave API — REQ-PERM-01, REQ-PERM-02, REQ-AI-ATT-04
 *
 *  GET  /api/attendance/permission          — list (own or team)
 *  POST /api/attendance/permission          — submit a new hourly permission request
 *  PATCH /api/attendance/permission/[id]    — approve/reject (managers) OR auto-approve
 */
import { requireUser, findEmployeeByEmail, isAdminRole, parseBody, getQuery, ok, fail, OPTIONS } from '@/lib/attendance-leave-api';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { loadWorkflowConfig, buildRequestContext, checkRules } from '@/lib/attendance-workflow';
import { sanitizeMultiLineText } from '@/lib/sanitize';

export { OPTIONS };

export async function GET(request: Request) {
  const db = await getDb(request);
  const { user, response } = await requireUser(request);
  if (!user) return response;
  try {
    const q = getQuery(request);
    const where: Record<string, unknown> = {};
    if (!isAdminRole(user.role)) {
      const emp = await findEmployeeByEmail(user.email);
      if (!emp) return ok({ permissions: [] });
      where.employeeId = emp.id;
    } else if (q.employeeId) {
      where.employeeId = q.employeeId;
    }
    if (q.status) where.status = q.status;
    if (q.date) where.date = new Date(q.date);

    const items = await db.hourlyPermission.findMany({
      where,
      include: { employee: { select: { id: true, firstName: true, lastName: true, employeeId: true } } },
      orderBy: { date: 'desc' },
      take: 200,
    });
    return ok({ permissions: items });
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
    const emp = await findEmployeeByEmail(user.email, db);
    if (!emp) return fail('Employee record not found. Please ensure your user account is linked to an employee record.', 404);

    const date = new Date(body.date as string);
    const startTime = new Date(body.startTime as string);
    const endTime = new Date(body.endTime as string);
    const reason = sanitizeMultiLineText(body.reason, 2000);

    // ─── Validate inputs ───
    if (isNaN(date.getTime())) return fail('Invalid date format');
    if (isNaN(startTime.getTime())) return fail('Invalid start time format');
    if (isNaN(endTime.getTime())) return fail('Invalid end time format');
    if (!reason) return fail('Reason is required');
    if (startTime >= endTime) return fail('End time must be after start time');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (date < today) return fail('Permission date cannot be in the past');

    // Calculate hours in increments of 15 min (REQ-PERM-01)
    const ms = endTime.getTime() - startTime.getTime();
    const rawHours = ms / (1000 * 60 * 60);
    const hours = Math.max(0.25, Math.round(rawHours * 4) / 4); // round to nearest 15 min
    if (hours > 8) return fail('Permission cannot exceed 8 hours — use a half-day leave instead');

    // ─── Unified Rule Engine enforcement ─────────────────────────────
    // Honor the unified AttendanceWorkflowConfig rules (monthly cap on
    // hourly permissions, geofencing/IP, auto-deduction threshold) even
    // when the legacy endpoint writes to its own HourlyPermission table.
    try {
      const { config } = await loadWorkflowConfig(db, emp.companyId || null, 'HOURLY_PERMISSION');
      const ctx = await buildRequestContext(db, {
        employeeId: emp.id, requestType: 'HOURLY_PERMISSION',
        startDate: date, endDate: date, gatePassType: '', hours,
      });
      const ruleCheck = checkRules(config.rules, ctx, { startDate: date, requestType: 'HOURLY_PERMISSION' });
      if (!ruleCheck.ok) return fail(ruleCheck.error!, 422);
    } catch (ruleErr) {
      console.warn('[permission] rule engine check failed (non-fatal):', ruleErr);
    }

    // REQ-PERM-02: compute adjusted check-out time (target hours = 8; permission extends required check-out)
    // The required check-out shifts by `hours` later in the day.
    const adjustedCheckOut = new Date(startTime);
    adjustedCheckOut.setHours(adjustedCheckOut.getHours() + 8 + Math.floor(hours));
    adjustedCheckOut.setMinutes(adjustedCheckOut.getMinutes() + Math.round((hours % 1) * 60));

    // REQ-AI-ATT-04: auto-approve if employee has >90% attendance AND permission ≤ threshold
    const config = await db.attendancePolicyConfig.findFirst();
    const autoMinutes = config?.autoApprovePermissionMinutes || 0;
    const minAttendancePct = config?.autoApproveMinAttendancePct || 90;

    let autoApproved = false;
    let status: 'pending' | 'approved' = 'pending';
    let approvedBy: string | null = null;
    let approvedAt: Date | null = null;

    if (autoMinutes > 0 && hours * 60 <= autoMinutes) {
      // Check last 30 days attendance percentage
      const since = new Date();
      since.setDate(since.getDate() - 30);
      const records = await db.attendance.findMany({
        where: { employeeId: emp.id, date: { gte: since } },
        select: { status: true },
      });
      const present = records.filter(r => ['present', 'late'].includes(r.status)).length;
      const pct = records.length > 0 ? (present / records.length) * 100 : 0;
      if (pct >= minAttendancePct) {
        autoApproved = true;
        status = 'approved';
        approvedBy = 'ai_auto';
        approvedAt = new Date();
      }
    }

    const record = await db.hourlyPermission.create({
      data: {
        employeeId: emp.id,
        date,
        startTime,
        endTime,
        hours,
        reason,
        adjustedCheckOut,
        status,
        approvedBy,
        approvedAt,
        autoApproved,
      },
    });
    return ok({ permission: record }, 201);
  } catch (e: unknown) {
    return fail(e instanceof Error ? e.message : 'Failed to create', 500);
  }
}
