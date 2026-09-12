/**
 * WFH Request API (legacy endpoint — unified with the workflow engine)
 *
 *  GET  /api/attendance/wfh          — list (own or team)
 *  POST /api/attendance/wfh          — submit a new WFH request
 *
 * NOTE: This endpoint writes to the legacy WfhRequest table (so the existing
 * /attendance/wfh page keeps working) BUT it now enforces the unified rule
 * constraints (weekly cap, geofencing/IP, monthly cap) from the
 * AttendanceWorkflowConfig. Multi-tier approval still happens via the unified
 * /api/attendance/requests endpoint; this endpoint keeps the legacy
 * manager/HR approval fields in sync for backward compatibility.
 */
import { requireUser, findEmployeeByEmail, isAdminRole, parseBody, getQuery, ok, fail, OPTIONS } from '@/lib/attendance-leave-api';
import { getDb } from '@/lib/tenant-db';
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
      const emp = await findEmployeeByEmail(user.email, db);
      if (!emp) return ok({ requests: [] });
      where.employeeId = emp.id;
    } else if (q.employeeId) {
      where.employeeId = q.employeeId;
    }
    if (q.status) where.status = q.status;

    const items = await (db as any).wfhRequest.findMany({
      where,
      include: { employee: { select: { id: true, firstName: true, lastName: true, employeeId: true, department: { select: { name: true } } } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return ok({ requests: items });
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
    if (!emp) return fail('Employee record not found', 404);

    const requestType = String(body.requestType || 'full_day');
    const startDate = new Date(body.startDate as string);
    if (isNaN(startDate.getTime())) return fail('Invalid start date');
    const isPermanentOrHybrid = requestType === 'permanent' || requestType === 'hybrid';
    const endDate = isPermanentOrHybrid
      ? null
      : body.endDate ? new Date(body.endDate as string) : new Date(startDate);
    if (endDate && isNaN(endDate.getTime())) return fail('Invalid end date');
    if (endDate && endDate < startDate) return fail('End date cannot be before start date');

    const reason = sanitizeMultiLineText(body.reason, 2000);
    if (!reason || reason.length < 20) return fail('Reason must be at least 20 characters');

    const reasonCategory = String(body.reasonCategory || 'personal');

    // ─── Unified Rule Engine enforcement ─────────────────────────────
    try {
      const { config } = await loadWorkflowConfig(db, emp.companyId || null, 'WFH');
      const ctx = await buildRequestContext(db, {
        employeeId: emp.id, requestType: 'WFH',
        startDate, endDate: endDate || startDate, gatePassType: '', hours: 0,
      });
      let geoOk: boolean | undefined;
      if (config.rules.geoFencingEnabled && config.rules.allowedIps.length > 0) {
        const fwd = request.headers.get('x-forwarded-for') || '';
        const ip = fwd.split(',')[0].trim();
        geoOk = config.rules.allowedIps.includes(ip);
      }
      const ruleCheck = checkRules(config.rules, ctx, { startDate, requestType: 'WFH', geoOk });
      if (!ruleCheck.ok) return fail(ruleCheck.error!, 422);
    } catch (ruleErr) {
      console.warn('[wfh] rule engine check failed (non-fatal):', ruleErr);
    }

    // Calculate total days (working days, excluding weekends)
    const calcWorkingDays = (s: Date, e: Date | null): number => {
      if (!e) return 1;
      let count = 0;
      const cur = new Date(s);
      while (cur <= e) {
        const day = cur.getDay();
        if (day !== 0 && day !== 6) count++;
        cur.setDate(cur.getDate() + 1);
      }
      return Math.max(1, count);
    };
    const totalDays = isPermanentOrHybrid ? 0 : calcWorkingDays(startDate, endDate);
    const requiresHrApproval = isPermanentOrHybrid || totalDays > 3;

    const record = await (db as any).wfhRequest.create({
      data: {
        employeeId: emp.id,
        requestType,
        startDate,
        endDate: endDate || null,
        reason,
        reasonCategory,
        supportingDoc: (body.supportingDoc as string) || null,
        expectedWorkingHours: Number(body.expectedHours) || 8,
        availableForMeetings: body.availableForMeetings !== false,
        remoteLocation: (body.remoteLocation as string) || null,
        emergencyContact: (body.emergencyContact as string) || null,
        alternateEmail: (body.alternateEmail as string) || null,
        totalDays,
        requiresHrApproval,
        approverComments: (body.approverComments as string) || null,
        status: 'pending',
        managerStatus: 'pending',
        hrStatus: requiresHrApproval ? 'pending' : 'not_required',
      },
    });
    return ok({ request: record }, 201);
  } catch (e: unknown) {
    return fail(e instanceof Error ? e.message : 'Failed to create', 500);
  }
}
