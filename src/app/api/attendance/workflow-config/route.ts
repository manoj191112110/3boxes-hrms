/**
 * Attendance Workflow Configuration API — Rule Engine + Workflow Builder settings
 *
 *  GET  /api/attendance/workflow-config?companyId= — resolved config for all 4 request types
 *  PUT  /api/attendance/workflow-config            — upsert config (admin only)
 *  POST /api/attendance/workflow-config            — { action: 'sla-sweep' } process overdue SLAs
 */
import { requireUser, isAdminRole, parseBody, getQuery, ok, fail, OPTIONS } from '@/lib/attendance-leave-api';
import { getDb } from '@/lib/tenant-db';
import {
  REQUEST_TYPES, DEFAULT_WORKFLOW_CONFIGS, processSlaOverdue,
  type AttendanceRequestType,
} from '@/lib/attendance-workflow';

export { OPTIONS };

const VALID = new Set<string>(REQUEST_TYPES);

export async function GET(request: Request) {
  const db = await getDb(request);
  const { user, response } = await requireUser(request);
  if (!user) return response;
  try {
    const q = getQuery(request);
    const companyId = (q.companyId as string) || null;

    const configs: Record<string, unknown> = {};
    for (const type of REQUEST_TYPES) {
      // Resolution order: company-scoped → tenant-wide → blueprint defaults
      let row: Record<string, unknown> | null = null;
      let scope = 'default';
      try {
        row = await (db as any).attendanceWorkflowConfig?.findFirst({
          where: { requestType: type, isActive: true, ...(companyId ? { companyId } : {}) },
          orderBy: { updatedAt: 'desc' },
        });
        if (row) scope = (row as any).companyId ? 'company' : 'tenant';
      } catch { /* table may not exist yet */ }

      const defaults = DEFAULT_WORKFLOW_CONFIGS[type as AttendanceRequestType];
      if (row) {
        let levels = defaults.levels;
        let rules = defaults.rules;
        try { const parsed = JSON.parse((row as any).levels || '[]'); if (Array.isArray(parsed) && parsed.length) levels = parsed; } catch { /* defaults */ }
        try { rules = { ...defaults.rules, ...JSON.parse((row as any).rules || '{}') }; } catch { /* defaults */ }
        configs[type] = {
          levels, rules,
          configId: (row as any).id,
          name: (row as any).name,
          scope,
          updatedAt: (row as any).updatedAt,
          // Scope fields (new — unification pass)
          policyDocumentId: (row as any).policyDocumentId || null,
          employmentType: (row as any).employmentType || 'all',
          branchId: (row as any).branchId || null,
          departmentId: (row as any).departmentId || null,
          employeeStatus: (row as any).employeeStatus || 'all',
        };
      } else {
        configs[type] = {
          levels: defaults.levels, rules: defaults.rules,
          configId: null, name: 'Standard Blueprint', scope: 'default', updatedAt: null,
          policyDocumentId: null, employmentType: 'all', branchId: null, departmentId: null, employeeStatus: 'all',
        };
      }
    }
    return ok({ configs, requestTypes: REQUEST_TYPES });
  } catch (e: unknown) {
    return fail(e instanceof Error ? e.message : 'Failed to load workflow configs', 500);
  }
}

export async function PUT(request: Request) {
  const db = await getDb(request);
  const { user, response } = await requireUser(request);
  if (!user) return response;
  if (!isAdminRole(user.role)) return fail('Admin only', 403);
  const body = await parseBody(request);
  if (!body) return fail('Invalid JSON');
  try {
    const requestType = body.requestType as string;
    if (!VALID.has(requestType)) return fail('Valid requestType is required (REGULARIZATION, WFH, HOURLY_PERMISSION, GATE_PASS)');
    const companyId = (body.companyId as string) || null;
    const levels = Array.isArray(body.levels) ? body.levels : null;
    const rules = body.rules && typeof body.rules === 'object' ? body.rules : null;
    if (!levels || levels.length === 0) return fail('At least one workflow level is required');
    if (!rules) return fail('rules object is required');

    // Sanitize levels
    const cleanLevels = levels.map((l: Record<string, unknown>, i: number) => ({
      level: i + 1,
      actorType: String(l.actorType || 'reporting_manager'),
      label: String(l.label || `Level ${i + 1}`),
      slaHours: Math.max(0, Number(l.slaHours) || 0),
      onSla: ['none', 'auto_approve', 'auto_escalate'].includes(String(l.onSla)) ? String(l.onSla) : 'none',
      skipIf: l.skipIf && (l.skipIf as Record<string, unknown>).field ? l.skipIf : null,
      autoApproveIf: l.autoApproveIf && (l.autoApproveIf as Record<string, unknown>).field ? l.autoApproveIf : null,
    }));

    const cleanRules = {
      // Submission-window / cap rules
      windowDays: Math.max(0, Number(rules.windowDays) || 0),
      monthlyCap: Math.max(0, Number(rules.monthlyCap) || 0),
      weeklyCap: Math.max(0, Number(rules.weeklyCap) || 0),
      overCapAction: rules.overCapAction === 'block' ? 'block' : 'review',
      autoDeductThresholdHours: Math.max(0, Number(rules.autoDeductThresholdHours) || 0),
      autoDeductLeaveDays: Math.max(0, Number(rules.autoDeductLeaveDays) || 0),
      geoFencingEnabled: !!rules.geoFencingEnabled,
      allowedIps: Array.isArray(rules.allowedIps) ? rules.allowedIps.map(String).filter(Boolean) : [],
      requireQrVerification: rules.requireQrVerification !== false,
      // Shift & Grace policy (unified from legacy AttendancePolicyRule)
      shiftStartDefault: typeof rules.shiftStartDefault === 'string' ? rules.shiftStartDefault : '09:00',
      shiftEndDefault: typeof rules.shiftEndDefault === 'string' ? rules.shiftEndDefault : '17:30',
      breakDurationMinutes: Math.max(0, Math.min(180, Number(rules.breakDurationMinutes) || 30)),
      lateGraceMinutes: Math.max(0, Math.min(120, Number(rules.lateGraceMinutes) || 15)),
      earlyGraceMinutes: Math.max(0, Math.min(120, Number(rules.earlyGraceMinutes) || 10)),
      // Late-mark policy
      lateMarkAllowancePerMonth: Math.max(0, Math.min(31, Number(rules.lateMarkAllowancePerMonth) || 0)),
      lateMarkHalfDayOnExceed: !!rules.lateMarkHalfDayOnExceed,
      halfDayAfterMinutes: Math.max(0, Math.min(480, Number(rules.halfDayAfterMinutes) || 0)),
      lateMarkNotApplicableOnTour: rules.lateMarkNotApplicableOnTour !== false,
      // Overtime policy
      autoOvertimeEnabled: rules.autoOvertimeEnabled !== false,
      overtimeThresholdMinutes: Math.max(0, Math.min(1440, Number(rules.overtimeThresholdMinutes) || 480)),
      // Gate-pass policy
      gatePassMaxPerMonth: Math.max(0, Math.min(31, Number(rules.gatePassMaxPerMonth) || 0)),
      gatePassHalfDayOnExceed: rules.gatePassHalfDayOnExceed !== false,
      gatePassHalfDayNextDay: rules.gatePassHalfDayNextDay !== false,
      gatePassEarlyHours: Math.max(0, Math.min(12, Number(rules.gatePassEarlyHours) || 0)),
    };

    const name = (body.name as string) || `Attendance Workflow — ${requestType}`;
    const data = {
      requestType,
      companyId,
      name,
      isActive: true,
      levels: JSON.stringify(cleanLevels),
      rules: JSON.stringify(cleanRules),
      // Policy document linkage + employee scope (new — unification pass)
      policyDocumentId: (body.policyDocumentId as string) || null,
      employmentType: ['all', 'full-time', 'part-time', 'contract', 'internship'].includes(String(body.employmentType))
        ? String(body.employmentType) : 'all',
      branchId: (body.branchId as string) || null,
      departmentId: (body.departmentId as string) || null,
      employeeStatus: ['all', 'active', 'on_leave', 'inactive'].includes(String(body.employeeStatus))
        ? String(body.employeeStatus) : 'all',
    };

    // Find existing config by requestType + companyId + scope (so different
    // scopes can coexist — e.g. one config for full-time, another for contract).
    const existing = await (db as any).attendanceWorkflowConfig?.findFirst({
      where: {
        requestType,
        isActive: true,
        companyId: companyId || null,
        employmentType: data.employmentType,
        branchId: data.branchId,
        departmentId: data.departmentId,
        employeeStatus: data.employeeStatus,
      },
    });
    let saved: unknown;
    if (existing) {
      saved = await (db as any).attendanceWorkflowConfig.update({ where: { id: existing.id }, data });
    } else {
      saved = await (db as any).attendanceWorkflowConfig.create({ data });
    }
    return ok({ config: saved }, 201);
  } catch (e: unknown) {
    return fail(e instanceof Error ? e.message : 'Failed to save workflow config', 500);
  }
}

export async function POST(request: Request) {
  const db = await getDb(request);
  const { user, response } = await requireUser(request);
  if (!user) return response;
  if (!isAdminRole(user.role)) return fail('Admin only', 403);
  const body = await parseBody(request);
  if (!body) return fail('Invalid JSON');
  try {
    if (body.action === 'sla-sweep') {
      const result = await processSlaOverdue(db, null);
      return ok({ message: 'SLA sweep complete', ...result });
    }
    return fail('Unknown action');
  } catch (e: unknown) {
    return fail(e instanceof Error ? e.message : 'SLA sweep failed', 500);
  }
}
