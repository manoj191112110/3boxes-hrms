/**
 * Unified Attendance Requests API — Regularization | WFH | Hourly Permission | Gate Pass
 *
 *  GET  /api/attendance/requests?scope=mine|inbox|all&status=&requestType=
 *       — 'mine'  : the employee's own requests
 *       — 'inbox' : requests waiting for MY approval (current-level actor)
 *       — 'all'   : everything (admin/HR)
 *       Runs a lazy SLA sweep (auto-approve / auto-escalate overdue levels).
 *
 *  POST /api/attendance/requests
 *       — Submit a request. Validates against the RULE ENGINE (submission
 *         window, monthly/weekly caps, geo/IP policy), then initializes the
 *         multi-level WORKFLOW (skip/auto-approve conditions applied).
 */
import { requireUser, findEmployeeByEmail, isAdminRole, parseBody, getQuery, ok, fail, OPTIONS } from '@/lib/attendance-leave-api';
import { getDb } from '@/lib/tenant-db';
import {
  loadWorkflowConfig, buildRequestContext, checkRules, initializeWorkflow,
  runSystemActions, processSlaOverdue, notifyApprover, REQUEST_TYPES,
  REQUEST_TYPE_LABELS,
  type AttendanceRequestType,
} from '@/lib/attendance-workflow';
import { sanitizeMultiLineText } from '@/lib/sanitize';

export { OPTIONS };

const VALID = new Set<string>(REQUEST_TYPES);

/**
 * Normalize the Employee.employeeType value (underscore format:
 * 'full_time', 'part_time', etc.) to the workflow-config employmentType
 * format (hyphen: 'full-time', 'part-time', etc.).
 * Unknown values map to 'all' so the catch-all config is used.
 */
function normalizeEmploymentType(raw: string | undefined | null): string {
  if (!raw) return 'all';
  const map: Record<string, string> = {
    'full_time': 'full-time',
    'part_time': 'part-time',
    'contract': 'contract',
    'temporary': 'contract',
    'consultant': 'contract',
    'internship': 'internship',
    'intern': 'internship',
    // Already-hyphenated values pass through
    'full-time': 'full-time',
    'part-time': 'part-time',
  };
  return map[raw.toLowerCase()] || 'all';
}

export async function GET(request: Request) {
  const db = await getDb(request);
  const { user, response } = await requireUser(request);
  if (!user) return response;
  try {
    const q = getQuery(request);
    const scope = (q.scope as string) || (isAdminRole(user.role) ? 'all' : 'mine');
    const where: Record<string, unknown> = {};

    if (scope === 'inbox') {
      // Requests where I am the pending current-level approver
      const pendingSteps = await (db as any).attendanceRequestApproval.findMany({
        where: { status: 'pending', actorUserId: user.id },
        select: { requestId: true },
        take: 200,
      });
      const ids = [...new Set(pendingSteps.map((s: { requestId: string }) => s.requestId))];
      const items = ids.length ? await db.attendanceRequest.findMany({
        where: { id: { in: ids }, status: 'pending' },
        include: {
          employee: { select: { id: true, firstName: true, lastName: true, employeeId: true, email: true } },
          approvals: { orderBy: { level: 'asc' } },
        },
        orderBy: { createdAt: 'desc' },
        take: 200,
      }) : [];
      return ok({ requests: items, scope });
    }

    if (scope !== 'all' || !isAdminRole(user.role)) {
      const emp = await findEmployeeByEmail(user.email, db);
      if (!emp) return ok({ requests: [], scope: 'mine' });
      where.employeeId = emp.id;
    }
    if (q.status) where.status = q.status;
    if (q.requestType && VALID.has(q.requestType)) where.requestType = q.requestType;

    // Lazy SLA sweep so approvals never stall in a manager's inbox
    processSlaOverdue(db, null).catch(() => null);

    const items = await db.attendanceRequest.findMany({
      where,
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, employeeId: true, email: true } },
        approvals: { orderBy: { level: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return ok({ requests: items, scope });
  } catch (e: unknown) {
    console.error('[attendance-requests GET]', e);
    return fail(e instanceof Error ? e.message : 'Failed to load requests', 500);
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
    if (!emp) return fail('Employee record not found for your account. Please contact HR.', 404);

    const requestType = String(body.requestType || '') as AttendanceRequestType;
    if (!VALID.has(requestType)) {
      return fail(`Invalid requestType. Must be one of: ${REQUEST_TYPES.join(', ')}`);
    }

    // ─── Type-specific payload validation ───
    // Sanitize free-text reason to strip HTML/script content before persisting.
    const reason = sanitizeMultiLineText(body.reason, 2000);
    if (!reason || reason.trim().length < 3) return fail('Reason is required (min 3 characters). HTML/script tags are not allowed.');
    const subtype = (body.subtype as string) || null;

    let startDate: Date;
    let endDate: Date | null = null;
    const payload: Record<string, unknown> = {};

    if (requestType === 'REGULARIZATION') {
      if (!body.date) return fail('Date is required');
      startDate = new Date(String(body.date));
      if (isNaN(startDate.getTime())) return fail('Invalid date format');
      const punchType = String(body.punchType || 'check_in');
      if (!['check_in', 'check_out'].includes(punchType)) return fail('punchType must be check_in or check_out');
      if (!body.requestedTime) return fail('Requested time is required');
      const requestedTime = new Date(String(body.requestedTime));
      if (isNaN(requestedTime.getTime())) return fail('Invalid requested time');
      payload.punchType = punchType;
      payload.requestedTime = requestedTime.toISOString();
    } else if (requestType === 'WFH') {
      if (!body.startDate) return fail('Start date is required');
      startDate = new Date(String(body.startDate));
      if (isNaN(startDate.getTime())) return fail('Invalid start date');
      if (body.endDate) {
        endDate = new Date(String(body.endDate));
        if (isNaN(endDate.getTime())) return fail('Invalid end date');
        if (endDate < startDate) return fail('End date cannot be before start date');
      } else {
        endDate = new Date(startDate);
      }
      payload.remoteLocation = (body.remoteLocation as string) || null;
      payload.availableForMeetings = body.availableForMeetings !== false;
      if (body.supportingDoc) payload.supportingDoc = body.supportingDoc;
    } else if (requestType === 'HOURLY_PERMISSION') {
      if (!body.date) return fail('Date is required');
      startDate = new Date(String(body.date));
      if (isNaN(startDate.getTime())) return fail('Invalid date');
      if (!body.startTime || !body.endTime) return fail('Start and end times are required');
      const startTime = new Date(`${String(body.date)}T${String(body.startTime)}`);
      const endTime = new Date(`${String(body.date)}T${String(body.endTime)}`);
      if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) return fail('Invalid start/end time');
      if (endTime <= startTime) return fail('End time must be after start time');
      const hours = Math.round(((endTime.getTime() - startTime.getTime()) / 3600000) * 100) / 100;
      if (hours > 4) return fail('Hourly permission covers 1–4 hours; for longer absences apply for half-day leave');
      payload.startTime = startTime.toISOString();
      payload.endTime = endTime.toISOString();
      payload.hours = hours;
    } else {
      // GATE_PASS
      if (!['official', 'personal'].includes(String(subtype))) {
        return fail('Gate pass type must be "official" or "personal"');
      }
      if (!body.date) return fail('Date is required');
      startDate = new Date(String(body.date));
      if (isNaN(startDate.getTime())) return fail('Invalid date');
      if (!body.departureTime) return fail('Departure time is required');
      payload.departureTime = new Date(`${String(body.date)}T${String(body.departureTime)}`).toISOString();
      if (body.expectedReturn) {
        payload.expectedReturn = new Date(`${String(body.date)}T${String(body.expectedReturn)}`).toISOString();
      }
      payload.destination = (body.destination as string) || null;
    }

    // ─── RULE ENGINE ───
    // Pass the employee's scope (employmentType / branch / department / status)
    // so loadWorkflowConfig resolves the most specific config row.
    const { config, configId } = await loadWorkflowConfig(db, emp.companyId || null, requestType, {
      employmentType: normalizeEmploymentType((emp as any).employeeType),
      branchId: (emp as any).branchId || null,
      departmentId: (emp as any).departmentId || null,
      employeeStatus: (emp as any).status || 'active',
    });
    const ctx = await buildRequestContext(db, {
      employeeId: emp.id,
      requestType,
      startDate,
      endDate,
      gatePassType: subtype || '',
      hours: Number(payload.hours || 0),
    });

    // Geofencing / IP restriction
    let geoOk: boolean | undefined;
    if (config.rules.geoFencingEnabled && config.rules.allowedIps.length > 0) {
      const fwd = request.headers.get('x-forwarded-for') || '';
      const ip = fwd.split(',')[0].trim();
      geoOk = config.rules.allowedIps.includes(ip);
    }
    const ruleCheck = checkRules(config.rules, ctx, { startDate, requestType, geoOk });
    if (!ruleCheck.ok) return fail(ruleCheck.error!, 422);

    // ─── Create request + initialize WORKFLOW ENGINE ───
    const now = new Date();
    const monthlyKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const created = await db.attendanceRequest.create({
      data: {
        companyId: emp.companyId || null,
        employeeId: emp.id,
        requestType,
        subtype,
        startDate,
        endDate,
        payload: payload as any,
        reason,
        attachmentUrl: (body.attachmentUrl as string) || null,
        status: 'pending',
        currentLevel: 1,
        monthlyKey,
        configSnapshot: JSON.stringify({ levels: config.levels, rules: config.rules, configId }),
      },
    });

    const init = await initializeWorkflow(db, created.id, emp.id, (user as any).tenantId || null, config, ctx);

    let systemMessage: string | null = null;
    if (init.status === 'approved') {
      systemMessage = await runSystemActions(db, created.id);
    } else if (init.nextActorUserId) {
      await notifyApprover(
        db, init.nextActorUserId, (user as any).tenantId || null,
        `New ${REQUEST_TYPE_LABELS[requestType]} request`,
        `${emp.firstName} ${emp.lastName} requested ${REQUEST_TYPE_LABELS[requestType]} — your approval is pending (Level ${init.currentLevel}).`,
        '/attendance/requests?scope=inbox',
      );
    }

    const approvals = await (db as any).attendanceRequestApproval.findMany({
      where: { requestId: created.id }, orderBy: { level: 'asc' },
    });
    const fresh = await db.attendanceRequest.findUnique({ where: { id: created.id } });

    return ok({
      request: fresh, approvals, workflowStatus: init.status,
      systemMessage: systemMessage || undefined,
      message: init.status === 'approved'
        ? 'Request approved automatically by workflow rules'
        : `Request submitted — pending Level ${init.currentLevel} approval`,
    }, 201);
  } catch (e: unknown) {
    console.error('[attendance-requests POST]', e);
    return fail(e instanceof Error ? e.message : 'Failed to submit request', 500);
  }
}
