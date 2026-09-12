/**
 * Attendance Regularization API — REQ-REG-01, REQ-REG-02, REQ-REG-03
 *
 *  GET  /api/attendance/regularize          — list (employee's own or all for admins)
 *  POST /api/attendance/regularize          — submit a missed-punch regularization
 *  PATCH /api/attendance/regularize/[id]    — approve / reject (manager or HR)
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
      if (!emp) return ok({ regularizations: [] });
      where.employeeId = emp.id;
    } else if (q.employeeId) {
      where.employeeId = q.employeeId;
    }
    if (q.status) where.status = q.status;

    const items = await db.attendanceRegularization.findMany({
      where,
      include: { employee: { select: { id: true, firstName: true, lastName: true, employeeId: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return ok({ regularizations: items });
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
    const punchType = body.punchType as string;
    const requestedTime = new Date(body.requestedTime as string);
    const reason = sanitizeMultiLineText(body.reason, 2000);
    if (!punchType || !['check_in', 'check_out'].includes(punchType)) return fail('Invalid punchType');
    if (!reason) return fail('Reason is required');

    // ─── Validate dates ───
    if (isNaN(date.getTime())) return fail('Invalid date format');
    if (isNaN(requestedTime.getTime())) return fail('Invalid requested time format');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (date > today) return fail('Cannot regularize a future date');
    if (requestedTime > new Date()) return fail('Requested time cannot be in the future');

    // REQ-REG-03: detect weekend/holiday
    const day = date.getDay();
    const isWeekend = day === 0 || day === 6;
    const holiday = await db.holiday.findFirst({
      where: { date, type: { in: ['public', 'company'] } },
    });
    const isHoliday = !!holiday;

    // ─── Unified Rule Engine enforcement ─────────────────────────────
    // Even though the legacy regularize endpoint writes to its own table
    // (AttendanceRegularization), it must honor the same submission-window
    // and monthly-cap rules configured in the unified AttendanceWorkflowConfig.
    // Rejecting here prevents data that would bypass policy from being created.
    try {
      const { config } = await loadWorkflowConfig(db, emp.companyId || null, 'REGULARIZATION');
      const ctx = await buildRequestContext(db, {
        employeeId: emp.id, requestType: 'REGULARIZATION',
        startDate: date, endDate: date, gatePassType: '', hours: 0,
      });
      const ruleCheck = checkRules(config.rules, ctx, { startDate: date, requestType: 'REGULARIZATION' });
      if (!ruleCheck.ok) return fail(ruleCheck.error!, 422);
    } catch (ruleErr) {
      console.warn('[regularize] rule engine check failed (non-fatal):', ruleErr);
      // Non-fatal — fall through to legacy creation if the rule engine itself errors.
    }

    // REQ-REG-02: AI suggestion based on historical data — find median check-in time
    let aiSuggestedTime: Date | null = null;
    let aiConfidence = 0;
    const historical = await db.attendance.findMany({
      where: { employeeId: emp.id, status: { in: ['present', 'late'] }, checkIn: { not: null } },
      orderBy: { date: 'desc' },
      take: 30,
      select: { checkIn: true },
    });
    if (punchType === 'check_in' && historical.length >= 3) {
      const hours = historical
        .map(h => h.checkIn ? new Date(h.checkIn).getHours() * 60 + new Date(h.checkIn).getMinutes() : null)
        .filter((v): v is number => v !== null)
        .sort((a, b) => a - b);
      const median = hours[Math.floor(hours.length / 2)];
      const suggested = new Date(requestedTime);
      suggested.setHours(Math.floor(median / 60), median % 60, 0, 0);
      aiSuggestedTime = suggested;
      aiConfidence = Math.min(1, historical.length / 30);
    }

    const record = await db.attendanceRegularization.create({
      data: {
        employeeId: emp.id,
        date,
        punchType,
        requestedTime,
        reason,
        aiSuggestedTime,
        aiConfidence,
        isWeekend,
        isHoliday,
        status: 'pending',
      },
    });
    return ok({ regularization: record }, 201);
  } catch (e: unknown) {
    return fail(e instanceof Error ? e.message : 'Failed to create', 500);
  }
}
