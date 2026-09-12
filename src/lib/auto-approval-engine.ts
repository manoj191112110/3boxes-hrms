/**
 * AI Auto-Approval Engine — REQ-AI-ATT-04 (expanded)
 *
 * Originally auto-approval was only implemented for HourlyPermission.
 * This module expands the engine to cover all four approval-based
 * attendance workflows:
 *
 *   - HourlyPermission  (short-leave up to N minutes)
 *   - LeaveRequest      (single-day leaves of certain types)
 *   - OvertimeRequest   (OT below threshold hours)
 *   - Gatepass          (early-departure/late-arrival within grace)
 *
 * Each workflow has its own auto-approval rules driven by the
 * AttendancePolicyConfig table. The engine returns a decision:
 *
 *   { autoApproved: boolean, reason: string, confidence: number }
 *
 * The decision is NON-BINDING — the caller decides whether to apply it.
 * This lets us re-use the same engine for batch back-fill jobs and
 * per-request evaluation.
 *
 * Design principles:
 *   1. Conservative — auto-approve only when ALL rule predicates pass.
 *   2. Transparent — every decision includes a human-readable reason.
 *   3. Auditable — caller stamps `approvedBy: 'ai_auto'` and writes an
 *      AttendanceAuditLog entry so admins can review.
 *   4. Reversible — any auto-approved request can be reverted by a
 *      human manager; the engine never bypasses human override.
 */
import prisma from '@/lib/prisma';

export interface AutoApprovalDecision {
  autoApproved: boolean;
  reason: string;
  confidence: number; // 0..1 — how confident the engine is in the decision
  rulesEvaluated: string[];
}

export interface AutoApprovalContext {
  employeeId: string;
  // 30-day attendance percentage — used as a "trust score"
  attendancePct?: number;
  // number of pending requests in last 7 days — anti-abuse
  recentRequestCount?: number;
  // number of past auto-approvals — used for rate-limiting
  recentAutoApprovalCount?: number;
}

/**
 * Compute the 30-day attendance percentage for an employee.
 * Cached at the call site (each engine call reuses the value).
 */
export async function computeAttendancePct(employeeId: string): Promise<number> {
  try {
    const since = new Date();
    since.setDate(since.getDate() - 30);
    const records = await prisma.attendance.findMany({
      where: { employeeId, date: { gte: since } },
      select: { status: true },
    });
    if (records.length === 0) return 0;
    const present = records.filter(r =>
      ['present', 'late', 'work_from_home', 'remote'].includes(r.status)
    ).length;
    return (present / records.length) * 100;
  } catch {
    return 0;
  }
}

/**
 * Count pending requests in last 7 days across all attendance workflows.
 * Used as an anti-abuse signal — if an employee is spamming requests,
 * the engine backs off and routes them to a human.
 */
export async function computeRecentRequestCount(employeeId: string): Promise<number> {
  try {
    const since = new Date();
    since.setDate(since.getDate() - 7);
    const [perm, leave, ot, gatepass] = await Promise.all([
      prisma.hourlyPermission.count({ where: { employeeId, createdAt: { gte: since } } }),
      prisma.leaveRequest.count({ where: { employeeId, createdAt: { gte: since } } }).catch(() => 0),
      prisma.overtimeRequest.count({ where: { employeeId, createdAt: { gte: since } } }),
      prisma.gatepass.count({ where: { employeeId, createdAt: { gte: since } } }),
    ]);
    return perm + leave + ot + gatepass;
  } catch {
    return 0;
  }
}

/**
 * Count auto-approvals in the last 24h for this employee.
 * Rate-limited to prevent abuse of the auto-approval channel.
 */
export async function computeRecentAutoApprovalCount(employeeId: string): Promise<number> {
  try {
    const since = new Date();
    since.setDate(since.getDate() - 1);
    return await prisma.hourlyPermission.count({
      where: { employeeId, autoApproved: true, approvedAt: { gte: since } },
    });
  } catch {
    return 0;
  }
}

/**
 * Build the AutoApprovalContext by running the three lookups in parallel.
 * Returns the context even if individual lookups fail (defaults to 0).
 */
export async function buildContext(employeeId: string): Promise<AutoApprovalContext> {
  const [attendancePct, recentRequestCount, recentAutoApprovalCount] = await Promise.all([
    computeAttendancePct(employeeId),
    computeRecentRequestCount(employeeId),
    computeRecentAutoApprovalCount(employeeId),
  ]);
  return { employeeId, attendancePct, recentRequestCount, recentAutoApprovalCount };
}

/**
 * Resolve the AttendancePolicyConfig — falls back to safe defaults if not configured.
 */
async function getConfig() {
  try {
    const raw = await prisma.attendancePolicyConfig.findFirst();
    if (!raw) {
      return {
        autoApprovePermissionMinutes: 0,
        autoApproveMinAttendancePct: 90,
        autoApproveLeaveSingleDay: false,
        autoApproveLeaveTypes: [] as string[],
        autoApproveOvertimeHours: 0,
        autoApproveGatepassMinutes: 0,
      };
    }
    // autoApproveLeaveTypes is stored as a JSON-encoded string column (the schema
    // uses String @default("[]") rather than Json[] so it works without a migration).
    let leaveTypes: string[] = [];
    try {
      const parsed = JSON.parse((raw as { autoApproveLeaveTypes?: string }).autoApproveLeaveTypes || '[]');
      if (Array.isArray(parsed)) leaveTypes = parsed.filter(x => typeof x === 'string');
    } catch { /* noop */ }
    return {
      autoApprovePermissionMinutes: (raw as { autoApprovePermissionMinutes?: number }).autoApprovePermissionMinutes ?? 0,
      autoApproveMinAttendancePct: (raw as { autoApproveMinAttendancePct?: number }).autoApproveMinAttendancePct ?? 90,
      autoApproveLeaveSingleDay: (raw as { autoApproveLeaveSingleDay?: boolean }).autoApproveLeaveSingleDay ?? false,
      autoApproveLeaveTypes: leaveTypes,
      autoApproveOvertimeHours: (raw as { autoApproveOvertimeHours?: number }).autoApproveOvertimeHours ?? 0,
      autoApproveGatepassMinutes: (raw as { autoApproveGatepassMinutes?: number }).autoApproveGatepassMinutes ?? 0,
    };
  } catch {
    return {
      autoApprovePermissionMinutes: 0,
      autoApproveMinAttendancePct: 90,
      autoApproveLeaveSingleDay: false,
      autoApproveLeaveTypes: [] as string[],
      autoApproveOvertimeHours: 0,
      autoApproveGatepassMinutes: 0,
    };
  }
}

/**
 * Anti-abuse predicate — applies to ALL workflows.
 * If the employee has >5 requests in last 7 days OR >3 auto-approvals in
 * last 24h, the engine refuses to auto-approve (force human review).
 */
function antiAbuseCheck(ctx: AutoApprovalContext): { pass: boolean; reason: string } {
  if ((ctx.recentRequestCount ?? 0) > 5) {
    return { pass: false, reason: 'anti_abuse_recent_requests_exceeded' };
  }
  if ((ctx.recentAutoApprovalCount ?? 0) > 3) {
    return { pass: false, reason: 'anti_abuse_auto_approval_rate_exceeded' };
  }
  return { pass: true, reason: 'ok' };
}

/**
 * Attendance-trust predicate — applies to ALL workflows.
 * Employee must have ≥ minAttendancePct over the last 30 days to qualify.
 */
function trustCheck(ctx: AutoApprovalContext, minPct: number): { pass: boolean; reason: string } {
  if ((ctx.attendancePct ?? 0) < minPct) {
    return { pass: false, reason: `attendance_pct_below_threshold (${(ctx.attendancePct ?? 0).toFixed(0)}% < ${minPct}%)` };
  }
  return { pass: true, reason: 'ok' };
}

// ============================================================================
//  Workflow-specific evaluators
// ============================================================================

/**
 * Hourly Permission / Short-Leave auto-approval.
 * Approves if hours × 60 ≤ autoApprovePermissionMinutes AND trust passes.
 */
export async function evaluatePermissionAutoApproval(
  ctx: AutoApprovalContext,
  hours: number,
): Promise<AutoApprovalDecision> {
  const config = await getConfig();
  const rules: string[] = [];
  const autoMinutes = config.autoApprovePermissionMinutes || 0;

  if (autoMinutes <= 0) {
    return { autoApproved: false, reason: 'auto_approve_disabled_for_permission', confidence: 0, rulesEvaluated: ['disabled'] };
  }
  rules.push(`permission_minutes_${hours * 60}_<=_${autoMinutes}`);

  if (hours * 60 > autoMinutes) {
    return { autoApproved: false, reason: 'permission_exceeds_threshold', confidence: 0.9, rulesEvaluated: rules };
  }

  const antiAbuse = antiAbuseCheck(ctx);
  rules.push(`anti_abuse:${antiAbuse.reason}`);
  if (!antiAbuse.pass) {
    return { autoApproved: false, reason: antiAbuse.reason, confidence: 1.0, rulesEvaluated: rules };
  }

  const trust = trustCheck(ctx, config.autoApproveMinAttendancePct);
  rules.push(`trust:${trust.reason}`);
  if (!trust.pass) {
    return { autoApproved: false, reason: trust.reason, confidence: 0.95, rulesEvaluated: rules };
  }

  return {
    autoApproved: true,
    reason: `permission_${hours}h_within_${autoMinutes}min_trust_${(ctx.attendancePct ?? 0).toFixed(0)}pct`,
    confidence: 0.9,
    rulesEvaluated: rules,
  };
}

/**
 * Leave Request auto-approval.
 * Approves if:
 *   - autoApproveLeaveSingleDay is true
 *   - leave is single-day (or half-day)
 *   - leave type is in autoApproveLeaveTypes
 *   - employee has enough balance (caller's responsibility to check)
 *   - trust passes
 *   - it's not a medical leave (those always need a human + document check)
 */
export async function evaluateLeaveAutoApproval(
  ctx: AutoApprovalContext,
  args: { leaveType: string; days: number; hasAttachment: boolean; isMedical: boolean },
): Promise<AutoApprovalDecision> {
  const config = await getConfig();
  const rules: string[] = [];

  if (!config.autoApproveLeaveSingleDay) {
    return { autoApproved: false, reason: 'auto_approve_disabled_for_leave', confidence: 0, rulesEvaluated: ['disabled'] };
  }
  rules.push(`days_${args.days}_<=_1`);
  if (args.days > 1) {
    return { autoApproved: false, reason: 'leave_exceeds_single_day', confidence: 0.9, rulesEvaluated: rules };
  }

  rules.push(`type_${args.leaveType}_in_${JSON.stringify(config.autoApproveLeaveTypes)}`);
  if (!config.autoApproveLeaveTypes.includes(args.leaveType)) {
    return { autoApproved: false, reason: 'leave_type_not_in_allowlist', confidence: 0.85, rulesEvaluated: rules };
  }

  rules.push(`is_medical_${args.isMedical}`);
  if (args.isMedical) {
    return { autoApproved: false, reason: 'medical_leave_requires_human_review', confidence: 1.0, rulesEvaluated: rules };
  }

  const antiAbuse = antiAbuseCheck(ctx);
  rules.push(`anti_abuse:${antiAbuse.reason}`);
  if (!antiAbuse.pass) {
    return { autoApproved: false, reason: antiAbuse.reason, confidence: 1.0, rulesEvaluated: rules };
  }

  const trust = trustCheck(ctx, config.autoApproveMinAttendancePct);
  rules.push(`trust:${trust.reason}`);
  if (!trust.pass) {
    return { autoApproved: false, reason: trust.reason, confidence: 0.9, rulesEvaluated: rules };
  }

  return {
    autoApproved: true,
    reason: `leave_${args.leaveType}_${args.days}d_trust_${(ctx.attendancePct ?? 0).toFixed(0)}pct`,
    confidence: 0.85,
    rulesEvaluated: rules,
  };
}

/**
 * Overtime Request auto-approval.
 * Approves if estimated hours ≤ autoApproveOvertimeHours AND trust passes.
 * Payout preference is preserved from the request — auto-approval doesn't
 * change whether the OT becomes payout or comp-off.
 */
export async function evaluateOvertimeAutoApproval(
  ctx: AutoApprovalContext,
  args: { estimatedHours: number; payoutPreference: string; isWeekend: boolean },
): Promise<AutoApprovalDecision> {
  const config = await getConfig();
  const rules: string[] = [];
  const autoHours = config.autoApproveOvertimeHours || 0;

  if (autoHours <= 0) {
    return { autoApproved: false, reason: 'auto_approve_disabled_for_overtime', confidence: 0, rulesEvaluated: ['disabled'] };
  }
  rules.push(`hours_${args.estimatedHours}_<=_${autoHours}`);
  if (args.estimatedHours > autoHours) {
    return { autoApproved: false, reason: 'overtime_exceeds_threshold', confidence: 0.9, rulesEvaluated: rules };
  }

  // Weekend OT always needs human approval — different pay rules apply
  rules.push(`is_weekend_${args.isWeekend}`);
  if (args.isWeekend) {
    return { autoApproved: false, reason: 'weekend_overtime_requires_human_review', confidence: 1.0, rulesEvaluated: rules };
  }

  const antiAbuse = antiAbuseCheck(ctx);
  rules.push(`anti_abuse:${antiAbuse.reason}`);
  if (!antiAbuse.pass) {
    return { autoApproved: false, reason: antiAbuse.reason, confidence: 1.0, rulesEvaluated: rules };
  }

  const trust = trustCheck(ctx, config.autoApproveMinAttendancePct);
  rules.push(`trust:${trust.reason}`);
  if (!trust.pass) {
    return { autoApproved: false, reason: trust.reason, confidence: 0.9, rulesEvaluated: rules };
  }

  return {
    autoApproved: true,
    reason: `ot_${args.estimatedHours}h_${args.payoutPreference}_trust_${(ctx.attendancePct ?? 0).toFixed(0)}pct`,
    confidence: 0.85,
    rulesEvaluated: rules,
  };
}

/**
 * Gatepass auto-approval.
 * Approves early-departure / late-arrival gatepasses within the
 * autoApproveGatepassMinutes threshold. Visitor & contractor gatepasses
 * always require human approval (security vetting).
 */
export async function evaluateGatepassAutoApproval(
  ctx: AutoApprovalContext,
  args: { type: string; minutesOffset: number; isVisitor: boolean },
): Promise<AutoApprovalDecision> {
  const config = await getConfig();
  const rules: string[] = [];
  const autoMinutes = config.autoApproveGatepassMinutes || 0;

  if (autoMinutes <= 0) {
    return { autoApproved: false, reason: 'auto_approve_disabled_for_gatepass', confidence: 0, rulesEvaluated: ['disabled'] };
  }

  rules.push(`is_visitor_${args.isVisitor}`);
  if (args.isVisitor) {
    return { autoApproved: false, reason: 'visitor_gatepass_requires_security_review', confidence: 1.0, rulesEvaluated: rules };
  }

  rules.push(`type_${args.type}`);
  if (!['early_departure', 'late_arrival'].includes(args.type)) {
    return { autoApproved: false, reason: 'gatepass_type_not_auto_approvable', confidence: 1.0, rulesEvaluated: rules };
  }

  rules.push(`minutes_${args.minutesOffset}_<=_${autoMinutes}`);
  if (args.minutesOffset > autoMinutes) {
    return { autoApproved: false, reason: 'gatepass_exceeds_threshold', confidence: 0.9, rulesEvaluated: rules };
  }

  const antiAbuse = antiAbuseCheck(ctx);
  rules.push(`anti_abuse:${antiAbuse.reason}`);
  if (!antiAbuse.pass) {
    return { autoApproved: false, reason: antiAbuse.reason, confidence: 1.0, rulesEvaluated: rules };
  }

  const trust = trustCheck(ctx, config.autoApproveMinAttendancePct);
  rules.push(`trust:${trust.reason}`);
  if (!trust.pass) {
    return { autoApproved: false, reason: trust.reason, confidence: 0.9, rulesEvaluated: rules };
  }

  return {
    autoApproved: true,
    reason: `gatepass_${args.type}_${args.minutesOffset}min_trust_${(ctx.attendancePct ?? 0).toFixed(0)}pct`,
    confidence: 0.8,
    rulesEvaluated: rules,
  };
}
