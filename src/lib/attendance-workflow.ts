/**
 * 3Boxes HRMS — Attendance Workflow Engine
 * =========================================
 * Separation of concerns (per architecture blueprint):
 *   1. RULE ENGINE  (checkRules + buildRequestContext) — validates whether a
 *      request is allowed at all (submission windows, monthly/weekly caps,
 *      auto-deduction thresholds, geo/IP constraints).
 *   2. WORKFLOW ENGINE (initializeWorkflow + advanceWorkflow + processSlaOverdue)
 *      — executes the dynamic multi-level approval chain.
 *
 * Supported request types:
 *   REGULARIZATION      — missed punch fix (L1 Manager, L2 HR auto-approve unless over monthly cap)
 *   WFH                 — work from home (L1 Manager, L2 HOD if > weekly limit, L3 VP if > 3 days)
 *   HOURLY_PERMISSION   — short leave (L1 Manager auto-approve SLA 24h; cumulative > 4h/mo → 0.5 paid leave)
 *   GATE_PASS           — OUT requests (L1 Manager, L2 HR skipped for Official, L3 Security QR verification)
 *
 * Actor types (roles, never names): reporting_manager, department_head (HOD),
 * hr_admin, project_manager, vp_director, security.
 */

import type { PrismaClient } from '@/generated/prisma/client';

// ─── Types ──────────────────────────────────────────────────────────────

export type AttendanceRequestType =
  | 'REGULARIZATION'
  | 'WFH'
  | 'HOURLY_PERMISSION'
  | 'GATE_PASS';

export const REQUEST_TYPES: AttendanceRequestType[] = [
  'REGULARIZATION',
  'WFH',
  'HOURLY_PERMISSION',
  'GATE_PASS',
];

export const REQUEST_TYPE_LABELS: Record<AttendanceRequestType, string> = {
  REGULARIZATION: 'Attendance Regularization',
  WFH: 'Work From Home',
  HOURLY_PERMISSION: 'Hourly Permission / Short Leave',
  GATE_PASS: 'Gate Pass & OUT Request',
};

export type ActorType =
  | 'reporting_manager'
  | 'department_head'
  | 'hr_admin'
  | 'project_manager'
  | 'vp_director'
  | 'security';

export const ACTOR_TYPES: { value: ActorType; label: string; description: string }[] = [
  { value: 'reporting_manager', label: 'Reporting Manager (L1)', description: 'Employee.reportingManagerId' },
  { value: 'department_head', label: 'Department Head / HOD', description: 'Department.headId' },
  { value: 'hr_admin', label: 'HR Administrator', description: 'Tenant admin/HR user' },
  { value: 'project_manager', label: 'Project Manager', description: 'Active project manager' },
  { value: 'vp_director', label: 'VP / Director', description: 'Escalation authority' },
  { value: 'security', label: 'Security (Turnstile)', description: 'Gate pass QR verification' },
];

export interface RuleCondition {
  field: 'durationDays' | 'monthlyCount' | 'weeklyCount' | 'gatePassType' | 'hours';
  op: 'gt' | 'gte' | 'lt' | 'lte' | 'eq';
  value: number | string;
}

export interface WorkflowLevel {
  level: number;
  actorType: ActorType;
  label: string;
  slaHours: number; // 0 = no SLA
  onSla: 'none' | 'auto_approve' | 'auto_escalate';
  skipIf: RuleCondition | null;         // level never applies when condition matches
  autoApproveIf: RuleCondition | null;  // level self-approves (system) when condition matches
}

export interface RequestRules {
  // ─── Submission-window / cap rules (rule engine) ───
  windowDays: number;                // submissions allowed within N days of the date (0 = no window)
  monthlyCap: number;                // max requests per calendar month (0 = unlimited)
  weeklyCap: number;                 // max WFH days per week (0 = unlimited)
  overCapAction: 'block' | 'review'; // block at submission, or allow + route to HR manual review
  autoDeductThresholdHours: number;  // cumulative hourly-permission hours before deduction (0 = disabled)
  autoDeductLeaveDays: number;       // paid-leave days deducted when threshold exceeded (e.g. 0.5)
  geoFencingEnabled: boolean;        // require WFH/OUT punches inside allowed geo/IP
  allowedIps: string[];              // whitelisted IPs for WFH / OUT requests
  requireQrVerification: boolean;    // gate pass must be scanned at turnstile

  // ─── Shift & Grace policy (absorbed from legacy AttendancePolicyRule) ───
  shiftStartDefault: string;         // '09:00'
  shiftEndDefault: string;           // '17:30'
  breakDurationMinutes: number;      // lunch break minutes
  lateGraceMinutes: number;          // grace before marking late
  earlyGraceMinutes: number;         // grace before marking early-departure

  // ─── Late-mark policy ───
  lateMarkAllowancePerMonth: number; // how many late marks allowed per month
  lateMarkHalfDayOnExceed: boolean;  // half-day deduction when allowance exceeded
  halfDayAfterMinutes: number;       // minutes after shift start that becomes half day
  lateMarkNotApplicableOnTour: boolean;

  // ─── Overtime policy ───
  autoOvertimeEnabled: boolean;
  overtimeThresholdMinutes: number;  // 480 = 8 hours

  // ─── Gate-pass policy ───
  gatePassMaxPerMonth: number;       // 0 = unlimited
  gatePassHalfDayOnExceed: boolean;  // 2nd gate pass in month = half day
  gatePassHalfDayNextDay: boolean;   // half-day gate pass marks next day half day
  gatePassEarlyHours: number;        // gate-pass early-departure hours for full-day consideration
}

export interface WorkflowConfig {
  levels: WorkflowLevel[];
  rules: RequestRules;
}

export interface RequestContext {
  durationDays: number;
  monthlyCount: number;   // same-type requests in this month INCLUDING the current one
  weeklyCount: number;    // same-type requests in this ISO week including the current one
  weeklyDays: number;     // WFH days in this ISO week including the current request
  gatePassType: string;   // 'official' | 'personal' | ''
  hours: number;          // hourly-permission hours or 0
}

const DEFAULT_RULES: RequestRules = {
  // Submission-window / cap rules
  windowDays: 0,
  monthlyCap: 0,
  weeklyCap: 0,
  overCapAction: 'review',
  autoDeductThresholdHours: 0,
  autoDeductLeaveDays: 0.5,
  geoFencingEnabled: false,
  allowedIps: [],
  requireQrVerification: true,

  // Shift & Grace (mirrors legacy AttendancePolicyRule defaults)
  shiftStartDefault: '09:00',
  shiftEndDefault: '17:30',
  breakDurationMinutes: 30,
  lateGraceMinutes: 15,
  earlyGraceMinutes: 10,

  // Late-mark policy
  lateMarkAllowancePerMonth: 4,
  lateMarkHalfDayOnExceed: true,
  halfDayAfterMinutes: 21,
  lateMarkNotApplicableOnTour: true,

  // Overtime
  autoOvertimeEnabled: true,
  overtimeThresholdMinutes: 480,

  // Gate-pass
  gatePassMaxPerMonth: 1,
  gatePassHalfDayOnExceed: true,
  gatePassHalfDayNextDay: true,
  gatePassEarlyHours: 1,
};

function L(
  level: number,
  actorType: ActorType,
  label: string,
  slaHours = 0,
  onSla: WorkflowLevel['onSla'] = 'none',
  skipIf: RuleCondition | null = null,
  autoApproveIf: RuleCondition | null = null,
): WorkflowLevel {
  return { level, actorType, label, slaHours, onSla, skipIf, autoApproveIf };
}

/** Default chains exactly mirror the standard HR blueprint. */
export const DEFAULT_WORKFLOW_CONFIGS: Record<AttendanceRequestType, WorkflowConfig> = {
  // 1. Attendance Regularization
  //    L1 Reporting Manager → L2 HR (auto-approves unless monthly cap exceeded)
  REGULARIZATION: {
    rules: { ...DEFAULT_RULES, windowDays: 5, monthlyCap: 3 },
    levels: [
      L(1, 'reporting_manager', 'Reporting Manager', 48, 'auto_escalate'),
      L(2, 'hr_admin', 'HR Administrator', 24, 'auto_approve', null, { field: 'monthlyCount', op: 'lte', value: 3 }),
    ],
  },
  // 2. Work From Home
  //    L1 Reporting Manager → L2 HOD only if > 2 WFH days this week → L3 VP only if > 3 days
  WFH: {
    rules: { ...DEFAULT_RULES, weeklyCap: 2 },
    levels: [
      L(1, 'reporting_manager', 'Reporting Manager', 48, 'auto_escalate'),
      L(2, 'department_head', 'Department Head (HOD)', 48, 'auto_escalate', { field: 'weeklyDays', op: 'lte', value: 2 }),
      L(3, 'vp_director', 'VP / Director', 48, 'none', { field: 'durationDays', op: 'lte', value: 3 }),
    ],
  },
  // 3. Hourly Permission / Short Leave
  //    L1 Reporting Manager with 24h auto-approve (low-risk); > 4h cumulative/month → 0.5 paid leave
  HOURLY_PERMISSION: {
    rules: { ...DEFAULT_RULES, monthlyCap: 4, autoDeductThresholdHours: 4, autoDeductLeaveDays: 0.5, requireQrVerification: false },
    levels: [
      L(1, 'reporting_manager', 'Reporting Manager', 24, 'auto_approve'),
    ],
  },
  // 4. Gate Pass & OUT Requests
  //    L1 Reporting Manager → L2 HR (skipped for OFFICIAL passes) → L3 Security QR verification
  GATE_PASS: {
    rules: { ...DEFAULT_RULES, requireQrVerification: true },
    levels: [
      L(1, 'reporting_manager', 'Reporting Manager', 48, 'auto_escalate'),
      L(2, 'hr_admin', 'HR Administrator', 24, 'auto_approve', { field: 'gatePassType', op: 'eq', value: 'official' }),
      L(3, 'security', 'Security (Turnstile QR)', 0, 'none'),
    ],
  },
};

// ─── Config loading ─────────────────────────────────────────────────────

/**
 * Load active config for a company + request type; falls back to blueprint defaults.
 *
 * Scope resolution (new — unification pass):
 *   When `employeeScope` is provided, the function tries to find the most
 *   specific config row that matches the employee's employment type /
 *   branch / department / status. Resolution order:
 *     1. Exact match on all 4 scope dimensions
 *     2. Match on employmentType + branchId + departmentId (status='all')
 *     3. Match on employmentType + branchId (department='all')
 *     4. Match on employmentType only
 *     5. Match on scope='all' (employmentType='all', no branch/department)
 *     6. Legacy fallback (any config for this requestType + companyId)
 *     7. Legacy AttendancePolicyRule inheritance
 *     8. Blueprint defaults
 */
export async function loadWorkflowConfig(
  db: PrismaClient,
  companyId: string | null,
  requestType: AttendanceRequestType,
  employeeScope?: {
    employmentType?: string;
    branchId?: string | null;
    departmentId?: string | null;
    employeeStatus?: string;
  },
): Promise<{ config: WorkflowConfig; configId: string | null }> {
  const defaults = DEFAULT_WORKFLOW_CONFIGS[requestType] || DEFAULT_WORKFLOW_CONFIGS.REGULARIZATION;

  // Build a list of scope filters from most-specific to least-specific.
  // Each filter is tried in order; the first match wins.
  const scopeFilters: Record<string, unknown>[] = [];
  if (employeeScope && employeeScope.employmentType && employeeScope.employmentType !== 'all') {
    const et = employeeScope.employmentType;
    const bid = employeeScope.branchId || null;
    const did = employeeScope.departmentId || null;
    // 1. Exact match on all 4
    scopeFilters.push({ employmentType: et, branchId: bid, departmentId: did, employeeStatus: employeeScope.employeeStatus || 'all' });
    // 2. et + branch + dept (status='all')
    scopeFilters.push({ employmentType: et, branchId: bid, departmentId: did, employeeStatus: 'all' });
    // 3. et + branch (dept=null, status='all')
    scopeFilters.push({ employmentType: et, branchId: bid, departmentId: null, employeeStatus: 'all' });
    // 4. et only
    scopeFilters.push({ employmentType: et, branchId: null, departmentId: null, employeeStatus: 'all' });
  }
  // 5. scope='all' (catch-all)
  scopeFilters.push({ employmentType: 'all', branchId: null, departmentId: null, employeeStatus: 'all' });

  for (const scopeFilter of scopeFilters) {
    try {
      const row = await (db as any).attendanceWorkflowConfig?.findFirst({
        where: {
          requestType,
          isActive: true,
          OR: companyId ? [{ companyId }, { companyId: null }] : [{ companyId: null }],
          ...scopeFilter,
        },
        orderBy: { updatedAt: 'desc' },
      });
      if (row) {
        let levels = defaults.levels;
        let rules = defaults.rules;
        try { levels = JSON.parse(row.levels || '[]'); } catch { /* keep defaults */ }
        if (!Array.isArray(levels) || levels.length === 0) levels = defaults.levels;
        try { rules = { ...defaults.rules, ...JSON.parse(row.rules || '{}') }; } catch { /* keep defaults */ }
        return { config: { levels, rules }, configId: row.id };
      }
    } catch (err) {
      // Scope columns may not exist yet on older tenant DBs — try the
      // legacy filter (no scope columns) as a fallback on the first error.
      console.warn('[AttendanceWorkflow] loadWorkflowConfig scoped query failed, trying legacy:', err);
      break;
    }
  }

  // 6. Legacy fallback — any config for this requestType + companyId
  //    (ignores scope columns; used when the new columns don't exist yet)
  try {
    const row = await (db as any).attendanceWorkflowConfig?.findFirst({
      where: { requestType, isActive: true, OR: companyId ? [{ companyId }, { companyId: null }] : [{ companyId: null }] },
      orderBy: { updatedAt: 'desc' },
    });
    if (row) {
      let levels = defaults.levels;
      let rules = defaults.rules;
      try { levels = JSON.parse(row.levels || '[]'); } catch { /* keep defaults */ }
      if (!Array.isArray(levels) || levels.length === 0) levels = defaults.levels;
      try { rules = { ...defaults.rules, ...JSON.parse(row.rules || '{}') }; } catch { /* keep defaults */ }
      return { config: { levels, rules }, configId: row.id };
    }
  } catch (err) {
    console.error('[AttendanceWorkflow] loadWorkflowConfig failed, using defaults:', err);
  }

  // 7. Legacy AttendancePolicyRule fallback (inherited from Task 18)
  try {
    const legacyRule = await (db as any).attendancePolicyRule?.findFirst({
      where: {
        status: 'active',
        OR: companyId ? [{ companyId }, { companyId: null }] : [{ companyId: null }],
      },
      orderBy: [{ priority: 'desc' }, { updatedAt: 'desc' }],
    });
    if (legacyRule) {
      const rules: RequestRules = {
        ...defaults.rules,
        shiftStartDefault: legacyRule.shiftStartDefault || defaults.rules.shiftStartDefault,
        shiftEndDefault: legacyRule.shiftEndDefault || defaults.rules.shiftEndDefault,
        breakDurationMinutes: Number(legacyRule.breakDurationMinutes ?? defaults.rules.breakDurationMinutes),
        lateGraceMinutes: Number(legacyRule.lateGraceMinutes ?? defaults.rules.lateGraceMinutes),
        earlyGraceMinutes: Number(legacyRule.earlyGraceMinutes ?? defaults.rules.earlyGraceMinutes),
        lateMarkAllowancePerMonth: Number(legacyRule.lateMarkAllowancePerMonth ?? defaults.rules.lateMarkAllowancePerMonth),
        lateMarkHalfDayOnExceed: legacyRule.lateMarkHalfDayOnExceed ?? defaults.rules.lateMarkHalfDayOnExceed,
        halfDayAfterMinutes: Number(legacyRule.halfDayAfterMinutes ?? defaults.rules.halfDayAfterMinutes),
        lateMarkNotApplicableOnTour: legacyRule.lateMarkNotApplicableOnTour ?? defaults.rules.lateMarkNotApplicableOnTour,
        autoOvertimeEnabled: legacyRule.autoOvertimeEnabled ?? defaults.rules.autoOvertimeEnabled,
        overtimeThresholdMinutes: Number(legacyRule.overtimeThresholdMinutes ?? defaults.rules.overtimeThresholdMinutes),
        gatePassMaxPerMonth: Number(legacyRule.gatePassMaxPerMonth ?? defaults.rules.gatePassMaxPerMonth),
        gatePassHalfDayOnExceed: legacyRule.gatePassHalfDayOnExceed ?? defaults.rules.gatePassHalfDayOnExceed,
        gatePassHalfDayNextDay: legacyRule.gatePassHalfDayNextDay ?? defaults.rules.gatePassHalfDayNextDay,
        gatePassEarlyHours: Number(legacyRule.gatePassEarlyHours ?? defaults.rules.gatePassEarlyHours),
      };
      if (requestType === 'GATE_PASS' && rules.monthlyCap === 0 && rules.gatePassMaxPerMonth > 0) {
        rules.monthlyCap = rules.gatePassMaxPerMonth;
      }
      return { config: { levels: defaults.levels, rules }, configId: null };
    }
  } catch (err) {
    /* legacy table may not exist — ignore */
  }

  // 8. Blueprint defaults
  return { config: { levels: defaults.levels, rules: defaults.rules }, configId: null };
}

// ─── Rule evaluation helpers ────────────────────────────────────────────

export function evaluateCondition(cond: RuleCondition | null | undefined, ctx: RequestContext): boolean {
  if (!cond) return false;
  const actual = (ctx as any)[cond.field];
  if (actual === undefined || actual === null) return false;
  const target = cond.value;
  switch (cond.op) {
    case 'gt': return Number(actual) > Number(target);
    case 'gte': return Number(actual) >= Number(target);
    case 'lt': return Number(actual) < Number(target);
    case 'lte': return Number(actual) <= Number(target);
    case 'eq': return String(actual).toLowerCase() === String(target).toLowerCase();
    default: return false;
  }
}

function sameDay(d1: Date, d2: Date) {
  return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
}

/** Build the condition-evaluation context for a request (counts from DB). */
export async function buildRequestContext(
  db: PrismaClient,
  params: {
    employeeId: string;
    requestType: AttendanceRequestType;
    startDate: Date;
    endDate?: Date | null;
    gatePassType?: string;
    hours?: number;
    excludeRequestId?: string;
  },
): Promise<RequestContext> {
  const { employeeId, requestType, startDate, endDate, gatePassType = '', hours = 0, excludeRequestId } = params;

  const monthStart = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  const monthEnd = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0, 23, 59, 59);
  // ISO week window (Mon-Sun)
  const weekStart = new Date(startDate);
  const dow = (weekStart.getDay() + 6) % 7; // Mon=0
  weekStart.setDate(weekStart.getDate() - dow);
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const baseWhere: Record<string, unknown> = {
    employeeId,
    requestType,
    status: { in: ['pending', 'approved'] },
    NOT: excludeRequestId ? [{ id: excludeRequestId }] : undefined,
  };

  let otherMonthly = 0;
  let otherWeekly = 0;
  let weeklyRows: { startDate: Date; endDate: Date | null }[] = [];
  try {
    otherMonthly = await (db as any).attendanceRequest.count({
      where: { ...baseWhere, startDate: { gte: monthStart, lte: monthEnd } },
    });
    otherWeekly = await (db as any).attendanceRequest.count({
      where: { ...baseWhere, startDate: { gte: weekStart, lt: weekEnd } },
    });
    if (requestType === 'WFH') {
      weeklyRows = await (db as any).attendanceRequest.findMany({
        where: { ...baseWhere, startDate: { gte: weekStart, lt: weekEnd } },
        select: { startDate: true, endDate: true },
      });
    }
  } catch (err) {
    console.error('[AttendanceWorkflow] count failed (table may not exist yet):', err);
  }

  const end = endDate || startDate;
  let durationDays = 1;
  if (requestType === 'WFH' || requestType === 'REGULARIZATION') {
    durationDays = Math.max(1, Math.round((end.getTime() - startDate.getTime()) / 86400000) + 1);
  }

  // Counts are AFTER this submission (the request itself counts) so that
  // autoApproveIf conditions compare naturally against the cap.
  const monthlyCount = otherMonthly + 1;
  const weeklyCount = otherWeekly + 1;
  let weeklyDays = durationDays;
  if (requestType === 'WFH') {
    weeklyDays += weeklyRows.reduce((sum, r) => {
      const rs = new Date(r.startDate);
      const re = r.endDate ? new Date(r.endDate) : rs;
      return sum + Math.max(1, Math.round((re.getTime() - rs.getTime()) / 86400000) + 1);
    }, 0);
  }

  return { durationDays, monthlyCount, weeklyCount, weeklyDays, gatePassType, hours };
}

/**
 * RULE ENGINE — validate a submission against the configured constraints.
 * Returns { ok: true } or { ok: false, error }.
 */
export function checkRules(
  rules: RequestRules,
  ctx: RequestContext,
  params: { startDate: Date; requestType: AttendanceRequestType; geoOk?: boolean },
): { ok: boolean; error?: string } {
  // Regularization window: must submit within N days of the affected date
  if (rules.windowDays > 0 && params.requestType === 'REGULARIZATION') {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const start = new Date(params.startDate); start.setHours(0, 0, 0, 0);
    const diffDays = Math.floor((today.getTime() - start.getTime()) / 86400000);
    if (diffDays > rules.windowDays) {
      return { ok: false, error: `Regularization window exceeded: requests must be submitted within ${rules.windowDays} day(s) of the missing punch (this one is ${diffDays} days old).` };
    }
    if (start > today) return { ok: false, error: 'Cannot regularize a future date.' };
  }

  // Monthly cap — 'block' rejects outright; 'review' allows submission but the
  // workflow routes it to manual HR review (autoApproveIf won't match).
  if (rules.monthlyCap > 0 && ctx.monthlyCount > rules.monthlyCap && (rules.overCapAction || 'review') === 'block') {
    return { ok: false, error: `Monthly cap reached: policy allows ${rules.monthlyCap} request(s) per month and you have already submitted ${ctx.monthlyCount - 1}. The request cannot be raised this month.` };
  }

  // Weekly cap (WFH days per week)
  if (rules.weeklyCap > 0 && params.requestType === 'WFH' && ctx.weeklyDays > rules.weeklyCap && (rules.overCapAction || 'review') === 'block') {
    return { ok: false, error: `Weekly WFH limit exceeded: policy allows ${rules.weeklyCap} day(s) per week. The request cannot be raised this week.` };
  }

  // Geofencing / IP restriction (validated at the API layer against request data)
  if (rules.geoFencingEnabled && params.geoOk === false) {
    return { ok: false, error: 'Geofencing/IP policy: you are not connecting from an approved IP address or office geofence for this request type.' };
  }

  return { ok: true };
}

// ─── Actor resolution ───────────────────────────────────────────────────

/** Resolve a workflow level's actor type to a concrete userId. */
export async function resolveActorForLevel(
  db: PrismaClient,
  employeeId: string,
  tenantId: string | null,
  actorType: ActorType,
): Promise<string | null> {
  try {
    const emp = await db.employee.findUnique({
      where: { id: employeeId },
      select: {
        id: true, userId: true, reportingManagerId: true, departmentId: true,
        department: { select: { id: true, headId: true } },
      },
    });
    if (!emp) return null;

    switch (actorType) {
      case 'reporting_manager': {
        if (!emp.reportingManagerId) return null;
        const mgr = await db.employee.findUnique({ where: { id: emp.reportingManagerId }, select: { userId: true } });
        return mgr?.userId || null;
      }
      case 'department_head': {
        const headId = emp.department?.headId;
        if (!headId) return null;
        const head = await db.employee.findUnique({ where: { id: headId }, select: { userId: true } });
        return head?.userId || null;
      }
      case 'hr_admin': {
        const roles = ['admin', 'hr_admin', 'tenant_admin'];
        const admin = await db.user.findFirst({
          where: { OR: tenantId ? [{ tenantId }, {}] : [{}], role: { in: roles }, status: 'active' },
          select: { id: true },
        });
        return admin?.id || null;
      }
      case 'project_manager': {
        const membership = await (db as any).projectMember?.findFirst({
          where: { employeeId },
          orderBy: { assignedAt: 'desc' },
          select: { project: { select: { projectManagerId: true } } },
        });
        const pmId = membership?.project?.projectManagerId;
        if (!pmId) return emp.reportingManagerId ? (await db.employee.findUnique({ where: { id: emp.reportingManagerId }, select: { userId: true } }))?.userId || null : null;
        // projectManagerId may reference an Employee OR a User — try both
        const pmEmp = await db.employee.findUnique({ where: { id: pmId }, select: { userId: true } }).catch(() => null);
        if (pmEmp?.userId) return pmEmp.userId;
        return pmId; // assume it's already a user id
      }
      case 'vp_director': {
        // Highest authority available: tenant admin, then any admin
        const vp = await db.user.findFirst({
          where: { role: { in: ['tenant_admin', 'admin', 'super_admin'] }, status: 'active' },
          orderBy: { createdAt: 'asc' },
          select: { id: true },
        });
        return vp?.id || null;
      }
      case 'security': {
        // Security desk user, then IT admin, then any admin (gate verification)
        const sec = await db.user.findFirst({
          where: { role: { in: ['security', 'it_admin', 'admin', 'tenant_admin'] }, status: 'active' },
          orderBy: { createdAt: 'asc' },
          select: { id: true },
        });
        return sec?.id || null;
      }
      default:
        return null;
    }
  } catch (err) {
    console.error('[AttendanceWorkflow] resolveActorForLevel failed:', err);
    return null;
  }
}

function slaDeadline(slaHours: number): Date | null {
  if (!slaHours || slaHours <= 0) return null;
  return new Date(Date.now() + slaHours * 3600 * 1000);
}

/** Issue (once) the gate-pass QR token for turnstile verification. */
export async function ensureQrToken(db: PrismaClient, requestId: string): Promise<string | null> {
  try {
    const row = await db.attendanceRequest.findUnique({ where: { id: requestId }, select: { qrToken: true } });
    if (!row) return null;
    if (row.qrToken) return row.qrToken;
    const token = `GP-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    await db.attendanceRequest.update({ where: { id: requestId }, data: { qrToken: token } });
    return token;
  } catch (err) {
    console.error('[AttendanceWorkflow] ensureQrToken failed:', err);
    return null;
  }
}

// ─── Workflow initialization ────────────────────────────────────────────

/**
 * Build the approval chain for a newly submitted request.
 * Evaluates skipIf / autoApproveIf per level, resolves actors, and creates
 * AttendanceRequestApproval rows. Returns the finalized/next state.
 */
export async function initializeWorkflow(
  db: PrismaClient,
  requestId: string,
  employeeId: string,
  tenantId: string | null,
  config: WorkflowConfig,
  ctx: RequestContext,
): Promise<{ status: string; currentLevel: number | null; nextActorUserId: string | null }> {
  const chain = [...config.levels].sort((a, b) => a.level - b.level);
  let firstPendingLevel: number | null = null;
  let firstPendingActor: string | null = null;

  for (const lvl of chain) {
    // Skipped by condition?
    if (evaluateCondition(lvl.skipIf, ctx)) {
      await (db as any).attendanceRequestApproval.create({ data: {
        requestId, level: lvl.level, actorType: lvl.actorType, actorName: lvl.label,
        status: 'skipped', comments: 'Level skipped by workflow condition',
      } });
      continue;
    }
    // Self-approval rule (e.g. HR auto-approves regularizations within monthly cap)?
    if (evaluateCondition(lvl.autoApproveIf, ctx)) {
      await (db as any).attendanceRequestApproval.create({ data: {
        requestId, level: lvl.level, actorType: lvl.actorType, actorName: lvl.label,
        status: 'auto_approved', comments: 'Auto-approved by workflow rule (condition met)',
        actedAt: new Date(),
      } });
      continue;
    }
    // Real pending approval level — create rows for the WHOLE chain upfront
    const actorUserId = await resolveActorForLevel(db, employeeId, tenantId, lvl.actorType);
    await (db as any).attendanceRequestApproval.create({ data: {
      requestId, level: lvl.level, actorType: lvl.actorType, actorName: lvl.label,
      actorUserId, status: 'pending', slaAt: slaDeadline(lvl.slaHours),
    } });
    if (firstPendingLevel === null) {
      firstPendingLevel = lvl.level;
      firstPendingActor = actorUserId;
    }
  }

  if (firstPendingLevel !== null) {
    await db.attendanceRequest.update({
      where: { id: requestId },
      data: { currentLevel: firstPendingLevel },
    }).catch(() => null);
    return { status: 'pending', currentLevel: firstPendingLevel, nextActorUserId: firstPendingActor };
  }

  // Every level was skipped / auto-approved → finalize immediately
  await db.attendanceRequest.update({ where: { id: requestId }, data: { status: 'approved' } }).catch(() => null);
  return { status: 'approved', currentLevel: null, nextActorUserId: null };
}

// ─── System actions (post-approval automation) ──────────────────────────

async function getShiftDefaults(db: PrismaClient, employeeId: string): Promise<{ start: string; end: string }> {
  try {
    const pol = await (db as any).attendancePolicyConfig?.findFirst({ orderBy: { updatedAt: 'desc' } });
    if (pol) return { start: pol.shiftStartDefault || '09:00', end: pol.shiftEndDefault || '17:30' };
  } catch { /* ignore */ }
  return { start: '09:00', end: '17:30' };
}

function atTime(date: Date, hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date(date);
  d.setHours(h || 0, m || 0, 0, 0);
  return d;
}

/**
 * Apply the "System Action" for a fully approved request.
 * Each action is best-effort and logged into request.systemActions.
 */
export async function runSystemActions(db: PrismaClient, requestId: string): Promise<string> {
  const request = await db.attendanceRequest.findUnique({
    where: { id: requestId },
    include: { employee: { select: { id: true, employeeId: true, firstName: true, lastName: true, userId: true } } },
  });
  if (!request) return 'request not found';
  const actions: string[] = [];
  const payload = (request.payload || {}) as Record<string, unknown>;

  try {
    if (request.requestType === 'REGULARIZATION') {
      // Update the biometric/attendance database for payroll processing
      const date = new Date(request.startDate);
      const reqTime = payload.requestedTime ? new Date(String(payload.requestedTime)) : null;
      const punchType = String(payload.punchType || 'check_in');
      const existing = await db.attendance.findFirst({ where: { employeeId: request.employeeId, date } });
      const patch: Record<string, unknown> = { status: 'present' };
      if (reqTime) {
        if (punchType === 'check_in') { patch.checkIn = reqTime; if (existing?.checkOut) patch.workingHours = (existing.checkOut.getTime() - reqTime.getTime()) / 3600000; }
        else { patch.checkOut = reqTime; if (existing?.checkIn) patch.workingHours = (reqTime.getTime() - existing.checkIn.getTime()) / 3600000; }
      }
      if (existing) await db.attendance.update({ where: { id: existing.id }, data: patch });
      else await db.attendance.create({ data: { employeeId: request.employeeId, date, ...patch } as any });
      actions.push(`Attendance record updated (${punchType} → ${reqTime?.toLocaleString?.() || 'requested time'}) for payroll`);
    } else if (request.requestType === 'WFH') {
      // Mark each covered day as "Present - WFH"
      const shift = await getShiftDefaults(db, request.employeeId);
      let days = 0;
      const end = request.endDate || request.startDate;
      for (const d = new Date(request.startDate); d <= end; d.setDate(d.getDate() + 1)) {
        const date = new Date(d);
        const existing = await db.attendance.findFirst({ where: { employeeId: request.employeeId, date } });
        const data = {
          employeeId: request.employeeId, date,
          checkIn: atTime(date, shift.start), checkOut: atTime(date, shift.end),
          status: 'wfh', notes: 'Work From Home (approved)',
        };
        if (existing) await db.attendance.update({ where: { id: existing.id }, data: { status: 'wfh', notes: 'Work From Home (approved)' } });
        else await db.attendance.create({ data: data as any });
        days++;
        if (days > 90) break; // safety
      }
      actions.push(`${days} day(s) marked "Present - WFH" and pushed to the team calendar`);
    } else if (request.requestType === 'HOURLY_PERMISSION') {
      // Adjust required check-out time + cumulative auto-deduction
      const hours = Number(payload.hours || 0);
      const shift = await getShiftDefaults(db, request.employeeId);
      const date = new Date(request.startDate);
      const existing = await db.attendance.findFirst({ where: { employeeId: request.employeeId, date } });
      const adjusted = atTime(date, shift.end);
      adjusted.setMinutes(adjusted.getMinutes() + Math.round(hours * 60));
      if (existing) await db.attendance.update({ where: { id: existing.id }, data: { notes: `Permission ${hours}h (approved) — adjusted check-out ${adjusted.toLocaleTimeString()}` } });
      // Cumulative monthly hours
      const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
      const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);
      const approvedPerms = await db.attendanceRequest.findMany({
        where: { employeeId: request.employeeId, requestType: 'HOURLY_PERMISSION', status: 'approved', startDate: { gte: monthStart, lte: monthEnd } },
        select: { payload: true },
      });
      const totalHours = approvedPerms.reduce((sum, r) => sum + Number((r.payload as any)?.hours || 0), 0);
      actions.push(`Permission of ${hours}h approved — adjusted check-out ${adjusted.toLocaleTimeString()}. Monthly cumulative: ${totalHours.toFixed(2)}h`);

      // Auto-deduction: exceeds threshold → deduct half-day paid leave
      const rules = request.configSnapshot ? safeParseRules(request.configSnapshot) : null;
      const threshold = rules?.autoDeductThresholdHours ?? DEFAULT_WORKFLOW_CONFIGS.HOURLY_PERMISSION.rules.autoDeductThresholdHours;
      const deductDays = rules?.autoDeductLeaveDays ?? DEFAULT_WORKFLOW_CONFIGS.HOURLY_PERMISSION.rules.autoDeductLeaveDays;
      if (threshold > 0 && totalHours > threshold && deductDays > 0) {
        const bal = await (db as any).leaveBalance?.findFirst({
          where: { employeeId: request.employeeId, year: date.getFullYear() },
          orderBy: { id: 'asc' },
          include: { leaveType: { select: { name: true, code: true, paid: true } } },
        });
        if (bal) {
          await (db as any).leaveBalance.update({
            where: { id: bal.id },
            data: { used: { increment: deductDays }, remaining: { decrement: deductDays } },
          });
          actions.push(`Cumulative ${totalHours.toFixed(2)}h exceeded ${threshold}h → auto-deducted ${deductDays} day(s) from ${bal.leaveType?.name || 'paid leave'} balance`);
        } else {
          actions.push(`Cumulative ${totalHours.toFixed(2)}h exceeded ${threshold}h → no paid-leave balance found to deduct (flagged for HR)`);
        }
      }
    } else if (request.requestType === 'GATE_PASS') {
      // Issue QR token for the turnstile
      if (!request.qrToken) {
        const token = `GP-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
        await db.attendanceRequest.update({ where: { id: request.id }, data: { qrToken: token } });
        actions.push(`Gate pass QR issued (${token}) — scan at the turnstile to log actual exit/entry`);
      } else {
        actions.push(`Gate pass QR already issued (${request.qrToken})`);
      }
    }
  } catch (err) {
    console.error('[AttendanceWorkflow] runSystemActions failed:', err);
    actions.push(`System action error: ${err instanceof Error ? err.message : 'unknown'}`);
  }

  const log = JSON.stringify({ appliedAt: new Date().toISOString(), actions });
  await db.attendanceRequest.update({ where: { id: requestId }, data: { systemActions: log } }).catch(() => null);
  return actions.join(' | ');
}

function safeParseRules(snapshot: string): RequestRules | null {
  try {
    const parsed = JSON.parse(snapshot);
    if (parsed?.rules) return { ...DEFAULT_WORKFLOW_CONFIGS.REGULARIZATION.rules, ...parsed.rules };
  } catch { /* ignore */ }
  return null;
}

// ─── Workflow advancement ───────────────────────────────────────────────

/**
 * Process an action (approve/reject) at the current level, then advance.
 * action: 'approved' | 'rejected'
 */
export async function advanceWorkflow(
  db: PrismaClient,
  requestId: string,
  action: 'approved' | 'rejected',
  actorUserId: string,
  comments?: string,
): Promise<{ status: string; currentLevel: number | null; finalized: boolean }> {
  const request = await db.attendanceRequest.findUnique({ where: { id: requestId } });
  if (!request) throw new Error('Request not found');

  const currentLevel = request.currentLevel || 1;
  await (db as any).attendanceRequestApproval.updateMany({
    where: { requestId, level: currentLevel, status: 'pending' },
    data: { status: action, actorUserId, comments: comments || null, actedAt: new Date() },
  });

  if (action === 'rejected') {
    await db.attendanceRequest.update({ where: { id: requestId }, data: { status: 'rejected', currentLevel: 0 } });
    return { status: 'rejected', currentLevel: null, finalized: true };
  }

  // Find the next PENDING level — levels already resolved at init time
  // (skipped by condition / auto-approved by rule) must never become current.
  const nextPendingSteps = await (db as any).attendanceRequestApproval.findMany({
    where: { requestId, level: { gt: currentLevel }, status: 'pending' },
    orderBy: { level: 'asc' },
    take: 1,
  });
  const nextStep = nextPendingSteps[0];

  if (!nextStep) {
    await db.attendanceRequest.update({ where: { id: requestId }, data: { status: 'approved', currentLevel: 0 } });
    await runSystemActions(db, requestId);
    return { status: 'approved', currentLevel: null, finalized: true };
  }

  // Load the level chain from the snapshot (falls back to live config) to get
  // SLA hours / actor type for the next pending step.
  let chain: WorkflowLevel[] = [];
  if (request.configSnapshot) {
    try { chain = JSON.parse(request.configSnapshot).levels || []; } catch { chain = []; }
  }
  if (!chain.length) {
    const cfg = await loadWorkflowConfig(db, request.companyId, request.requestType as AttendanceRequestType);
    chain = cfg.config.levels;
  }
  const next = chain.find((l: WorkflowLevel) => l.level === nextStep.level);
  const actorUserIdNext = next
    ? await resolveActorForLevel(db, request.employeeId, null, next.actorType)
    : nextStep.actorUserId || null;
  await (db as any).attendanceRequestApproval.update({
    where: { id: nextStep.id },
    data: { actorUserId: actorUserIdNext, slaAt: slaDeadline(next?.slaHours || 0) },
  });
  await db.attendanceRequest.update({ where: { id: requestId }, data: { currentLevel: nextStep.level } });

  // When the workflow reaches the SECURITY level, the pass is human-approved —
  // issue the QR token now so the employee can carry it to the turnstile.
  if (next && next.actorType === 'security') {
    await ensureQrToken(db, requestId);
  }

  return { status: 'pending', currentLevel: nextStep.level, finalized: false };
}

// ─── SLA sweep (auto-approve / auto-escalate) ───────────────────────────

/**
 * Process all overdue pending approvals for a company (or all).
 * - auto_approve → level approved automatically, workflow advances
 * - auto_escalate → level marked auto_escalated, moves to next level (manager's manager / higher tier)
 * Safe to call frequently (lazy sweep on list endpoints).
 */
export async function processSlaOverdue(
  db: PrismaClient,
  companyId?: string | null,
): Promise<{ processed: number; autoApproved: number; autoEscalated: number }> {
  let autoApproved = 0;
  let autoEscalated = 0;
  try {
    const now = new Date();
    const overdue = await (db as any).attendanceRequestApproval.findMany({
      where: { status: 'pending', slaAt: { lt: now } },
      include: { request: { select: { id: true, status: true, companyId: true, employeeId: true } } },
      take: 100,
    });
    for (const step of overdue) {
      if (!step.request || step.request.status !== 'pending') continue;
      if (companyId && step.request.companyId && step.request.companyId !== companyId) continue;

      let chain: WorkflowLevel[] = [];
      const reqRow = await db.attendanceRequest.findUnique({ where: { id: step.request.id } });
      if (reqRow?.configSnapshot) {
        try { chain = JSON.parse(reqRow.configSnapshot).levels || []; } catch { chain = []; }
      }
      const lvl = (chain || []).find((l: WorkflowLevel) => l.level === step.level);
      const onSla = lvl?.onSla || 'none';

      if (onSla === 'auto_approve') {
        await (db as any).attendanceRequestApproval.update({
          where: { id: step.id },
          data: { status: 'auto_approved', comments: 'Auto-approved: SLA elapsed without action', actedAt: now },
        });
        const res = await advanceWorkflow(db, step.request.id, 'approved', step.actorUserId || 'system-sla', 'SLA auto-approval');
        if (res.finalized) autoApproved++;
        else autoApproved++;
      } else if (onSla === 'auto_escalate') {
        await (db as any).attendanceRequestApproval.update({
          where: { id: step.id },
          data: { status: 'auto_escalated', comments: 'Escalated: SLA elapsed without action', actedAt: now },
        });
        // Move to the next level (manager's manager / higher tier)
        const nextLevel = (chain || []).filter((l: WorkflowLevel) => l.level > step.level).sort((a: WorkflowLevel, b: WorkflowLevel) => a.level - b.level)[0];
        if (nextLevel) {
          const actor = await resolveActorForLevel(db, step.request.employeeId, null, nextLevel.actorType);
          await (db as any).attendanceRequestApproval.updateMany({
            where: { requestId: step.request.id, level: nextLevel.level, status: 'pending' },
            data: { actorUserId: actor, slaAt: slaDeadline(nextLevel.slaHours) },
          });
          await db.attendanceRequest.update({ where: { id: step.request.id }, data: { currentLevel: nextLevel.level } });
        } else {
          // Nothing higher — auto-approve to prevent stalling
          const res = await advanceWorkflow(db, step.request.id, 'approved', 'system-sla', 'Escalation chain exhausted — auto-approved');
          void res;
        }
        autoEscalated++;
      } else {
        // No SLA action configured — extend deadline by the SLA window to avoid repeated checks
        await (db as any).attendanceRequestApproval.update({
          where: { id: step.id },
          data: { slaAt: new Date(now.getTime() + 24 * 3600 * 1000) },
        }).catch(() => null);
      }
    }
  } catch (err) {
    console.error('[AttendanceWorkflow] processSlaOverdue failed:', err);
  }
  return { processed: autoApproved + autoEscalated, autoApproved, autoEscalated };
}

// ─── Notifications (best-effort, platform DB) ───────────────────────────

export async function notifyApprover(db: PrismaClient, userId: string | null, tenantId: string | null, title: string, message: string, link?: string) {
  if (!userId || !tenantId) return;
  try {
    const { createNotification } = await import('@/lib/notifications');
    await createNotification({ tenantId, userId, title, message, type: 'workflow', category: 'workflow', link });
  } catch { /* notifications must never break the workflow */ }
}
