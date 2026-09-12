import { NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { resolveCompanyScope } from '@/lib/companyScope';
import { createNotification } from '@/lib/notifications';
import { buildContext, evaluateLeaveAutoApproval } from '@/lib/auto-approval-engine';
import { isServerLiveSite } from '@/lib/tenant-filter';
import { safeAuditLog } from '@/lib/audit-safe';
import { sanitizeMultiLineText } from '@/lib/sanitize';

/**
 * Deduct leave balance for an approved leave request.
 * Shared helper so every approval path (AI auto-approve, short-leave
 * auto-approve, manual PATCH approve) deducts the balance consistently.
 */
async function deductLeaveBalance(
  db: any,
  params: { employeeId: string; leaveTypeId: string; startDate: string | Date; endDate: string | Date; halfDay?: boolean | null; requestId?: string },
): Promise<{ deducted: boolean; days: number; error?: string }> {
  const { employeeId, leaveTypeId, startDate, endDate, halfDay, requestId } = params;
  const start = new Date(startDate);
  const end = new Date(endDate);
  const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const days = halfDay ? 0.5 : daysDiff;
  const year = start.getFullYear();
  try {
    const result = await db.leaveBalance.updateMany({
      where: { employeeId, leaveTypeId, year },
      data: { used: { increment: days }, remaining: { decrement: days } },
    });
    if (result.count === 0) {
      console.warn(`[leave] No LeaveBalance row found for employee=${employeeId} leaveType=${leaveTypeId} year=${year} — balance not deducted (request ${requestId || 'n/a'})`);
      return { deducted: false, days, error: 'No LeaveBalance row found for this employee + leave type + year' };
    }
    return { deducted: true, days };
  } catch (e) {
    console.warn(`[leave] Balance deduction failed (non-fatal) for request ${requestId || 'n/a'}:`, e);
    return { deducted: false, days, error: e instanceof Error ? e.message : 'Unknown error' };
  }
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() });
}

export async function GET(request: Request) {
  const db = await getDb(request);
  try {
    const scope = await resolveCompanyScope(request);
    if (!scope) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401, headers: corsHeaders() }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status');
    const employeeId = searchParams.get('employeeId');
    const tenantId = searchParams.get('tenantId');

    // ─── GOLDEN RULE: No dummy/seed data on LIVE for super_admin ───
    // When super_admin has NO company or tenant selected, getDb() returns
    // the platform DB which may contain seed/demo leave requests.
    if (scope.role === 'super_admin' && !scope.companyId && !tenantId && isServerLiveSite(request)) {
      return NextResponse.json(
        { leaveRequests: [], pagination: { page, limit, total: 0, totalPages: 0 } },
        { headers: corsHeaders() }
      );
    }

    const where: Record<string, unknown> = {};

    // ─── Company-scoped data visibility ───
    if (scope.scope === 'self') {
      // Employees can only see their own leave requests
      const employee = await db.employee.findFirst({
        where: { userId: scope.userId, status: 'active' },
        select: { id: true },
      });
      if (employee) {
        where.employeeId = employee.id;
      } else {
        // No employee record — return empty
        return NextResponse.json(
          { leaveRequests: [], pagination: { page, limit, total: 0, totalPages: 0 } },
          { headers: corsHeaders() }
        );
      }
    } else if (scope.companyId) {
      // Admin with a specific company selected via CompanySwitcher
      where.employee = { companyId: scope.companyId };
    }
    // scope === 'all' && no companyId → admin sees all companies

    // Apply additional filters on top of company scope
    if (status) where.status = status;
    if (employeeId) where.employeeId = employeeId;

    const [leaveRequests, total] = await Promise.all([
      db.leaveRequest.findMany({
        where,
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              employeeId: true,
              avatar: true,
            },
          },
          leaveType: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.leaveRequest.count({ where }),
    ]);

    return NextResponse.json(
      {
        leaveRequests,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
      { headers: corsHeaders() }
    );
  } catch (error) {
    console.error('Get leave requests error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders() }
    );
  }
}

export async function POST(request: Request) {
  const db = await getDb(request);
  try {
    const scope = await resolveCompanyScope(request);
    if (!scope) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401, headers: corsHeaders() }
      );
    }

    const body = await request.json();
    const { employeeId, leaveTypeId, startDate, endDate, halfDay, halfDaySlot } = body;
    // Sanitize free-text fields to strip HTML/script content before persisting.
    const reason = sanitizeMultiLineText(body.reason, 2000);

    if (!employeeId || !leaveTypeId || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'Missing required fields: employeeId, leaveTypeId, startDate, endDate' },
        { status: 400, headers: corsHeaders() }
      );
    }

    if (!reason || reason.trim().length < 3) {
      return NextResponse.json(
        { error: 'Reason is required (min 3 characters). HTML/script tags are not allowed.' },
        { status: 400, headers: corsHeaders() }
      );
    }

    // ─── Company-scoped data visibility for POST ───
    // Verify the target employee belongs to the same company as the user
    const targetEmployee = await db.employee.findUnique({
      where: { id: employeeId },
      select: { id: true, companyId: true, userId: true },
    });

    if (!targetEmployee) {
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404, headers: corsHeaders() }
      );
    }

    // Validate the leave type BEFORE the create — a stale UI id (or a
    // hardcoded fallback id from an old bundle) used to reach Prisma and die
    // as LeaveRequest_leaveTypeId_fkey → "Internal server error". Fail fast
    // with a clear message instead.
    const leaveType = await db.leaveType.findUnique({
      where: { id: leaveTypeId },
      select: { id: true, companyId: true, name: true },
    });
    if (!leaveType) {
      return NextResponse.json(
        { error: 'Invalid leave type. Please refresh the page and pick a leave type again.' },
        { status: 400, headers: corsHeaders() }
      );
    }
    if (leaveType.companyId !== targetEmployee.companyId) {
      return NextResponse.json(
        { error: "The selected leave type does not belong to the employee's company." },
        { status: 400, headers: corsHeaders() }
      );
    }

    if (scope.scope === 'self') {
      // Employees can only create leave requests for themselves
      if (targetEmployee.userId !== scope.userId) {
        return NextResponse.json(
          { error: 'You can only create leave requests for yourself' },
          { status: 403, headers: corsHeaders() }
        );
      }
    } else if (scope.companyId) {
      // Admin with specific company — employee must belong to that company
      if (targetEmployee.companyId !== scope.companyId) {
        return NextResponse.json(
          { error: 'Employee does not belong to the selected company' },
          { status: 403, headers: corsHeaders() }
        );
      }
    }
    // scope === 'all' && no companyId → admin can access any employee

    // REQ-LVE-04: AI Collaborative Leave Check — compute warning before persisting
    let aiCollaborativeWarning: string | null = null;
    try {
      const team = await db.employee.findUnique({
        where: { id: employeeId },
        select: { id: true, departmentId: true },
      });
      if (team?.departmentId) {
        const teamMembers = await db.employee.findMany({
          where: { departmentId: team.departmentId, id: { not: employeeId }, status: 'active' },
          select: { id: true },
        });
        if (teamMembers.length > 0) {
          const overlapping = await db.leaveRequest.findMany({
            where: {
              employeeId: { in: teamMembers.map(m => m.id) },
              status: { in: ['approved', 'pending'] },
              AND: [
                { startDate: { lte: new Date(endDate) } },
                { endDate: { gte: new Date(startDate) } },
              ],
            },
            include: { employee: { select: { id: true, firstName: true, lastName: true } } },
          });
          const uniqueOnLeave = new Map<string, string>();
          for (const lr of overlapping) {
            if (lr.employee) uniqueOnLeave.set(lr.employee.id, `${lr.employee.firstName} ${lr.employee.lastName}`);
          }
          const threshold = Math.max(1, Math.floor(teamMembers.length * 0.3));
          if (uniqueOnLeave.size >= threshold) {
            const names = Array.from(uniqueOnLeave.values()).slice(0, 5).join(', ');
            aiCollaborativeWarning = `Warning: ${uniqueOnLeave.size} other team member(s) are on leave during these dates (${names}${uniqueOnLeave.size > 5 ? ', ...' : ''}). Project delivery may be impacted.`;
          }
        }
      }
    } catch {
      // Non-fatal — leave request can still proceed without the AI warning
    }

    // ─── Duplicate / Weekend / Holiday validation ────────────────────
    // Bug fixes:
    //  (a) Duplicate: reject if the same employee already has a pending or
    //      approved leave request overlapping these dates.
    //  (b) Weekends: reject if ALL days in the range are weekends (likely
    //      a data-entry mistake — weekends are non-working days). If the
    //      range is a single weekend day, also reject. Multi-day ranges
    //      that include at least one working day are allowed.
    //  (c) Holidays: reject if the entire range falls on configured
    //      holidays (same logic as weekends).
    //
    // These are server-side hard blocks. The frontend also shows warnings,
    // but the server is the source of truth.

    const parsedStart = new Date(startDate);
    const parsedEnd = new Date(endDate);
    if (parsedEnd < parsedStart) {
      return NextResponse.json({ error: 'End date cannot be before start date.' }, { status: 400, headers: corsHeaders() });
    }

    // (a) Duplicate overlap check (same employee)
    try {
      const existing = await db.leaveRequest.findFirst({
        where: {
          employeeId,
          status: { in: ['pending', 'approved'] },
          AND: [
            { startDate: { lte: parsedEnd } },
            { endDate: { gte: parsedStart } },
          ],
        },
        select: { id: true, startDate: true, endDate: true, status: true },
      });
      if (existing) {
        return NextResponse.json({
          error: `Duplicate leave request: you already have a ${existing.status} leave request from ${new Date(existing.startDate).toLocaleDateString()} to ${new Date(existing.endDate).toLocaleDateString()} that overlaps with the selected dates.`,
        }, { status: 409, headers: corsHeaders() });
      }
    } catch (dupErr) {
      console.warn('[leave] Duplicate check failed (non-fatal):', dupErr);
    }

    // (b) + (c) Weekend + Holiday validation
    // Count working days (Mon–Sat, excluding Sundays + configured holidays).
    // If the range contains ZERO working days, reject.
    try {
      // Fetch all holidays in the date range
      const holidaysInRange = await db.holiday.findMany({
        where: {
          date: { gte: parsedStart, lte: parsedEnd },
          type: { in: ['public', 'company', 'national'] },
        },
        select: { date: true, name: true },
      });
      const holidayDates = new Set(
        holidaysInRange.map((h: { date: { toISOString: () => string } }) =>
          new Date(h.date).toISOString().split('T')[0]
        )
      );

      // Walk the date range, count working days
      let workingDayCount = 0;
      const weekendDays: string[] = [];
      const holidayDays: string[] = [];
      const cursor = new Date(parsedStart);
      while (cursor <= parsedEnd) {
        const dayOfWeek = cursor.getDay(); // 0=Sun, 6=Sat
        const dateStr = cursor.toISOString().split('T')[0];
        const isSunday = dayOfWeek === 0;
        const isHoliday = holidayDates.has(dateStr);
        if (isSunday) {
          weekendDays.push(dateStr);
        } else if (isHoliday) {
          holidayDays.push(dateStr);
        } else {
          workingDayCount++;
        }
        cursor.setDate(cursor.getDate() + 1);
      }

      // Reject if there are NO working days in the range at all
      // (means the entire leave is on weekends + holidays — likely a mistake)
      if (workingDayCount === 0) {
        const reasons: string[] = [];
        if (weekendDays.length > 0) reasons.push(`${weekendDays.length} weekend day(s)`);
        if (holidayDays.length > 0) reasons.push(`${holidayDays.length} holiday(s)`);
        return NextResponse.json({
          error: `The selected date range contains only ${reasons.join(' and ')} — no working days. Leave cannot be applied for non-working days only. Please select a range that includes at least one working day.`,
        }, { status: 400, headers: corsHeaders() });
      }

      // If the range is a SINGLE day and it's a Sunday or holiday, reject
      if (parsedStart.getTime() === parsedEnd.getTime()) {
        if (weekendDays.length > 0) {
          return NextResponse.json({
            error: 'The selected date is a Sunday (weekend). Leave cannot be applied for a single weekend day. Please choose a working day.',
          }, { status: 400, headers: corsHeaders() });
        }
        if (holidayDays.length > 0) {
          const holidayName = holidaysInRange[0]?.name || 'a holiday';
          return NextResponse.json({
            error: `The selected date is ${holidayName} (a holiday). Leave cannot be applied for a single holiday. Please choose a working day.`,
          }, { status: 400, headers: corsHeaders() });
        }
      }
    } catch (validErr) {
      console.warn('[leave] Weekend/holiday validation failed (non-fatal):', validErr);
    }

    const leaveRequest = await db.leaveRequest.create({
      data: {
        employeeId,
        leaveTypeId,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        reason,
        halfDay: halfDay || false,
        halfDaySlot: halfDaySlot || null,
        aiCollaborativeWarning,
        status: 'pending',
      },
      include: {
        employee: {
          select: { firstName: true, lastName: true, employeeId: true },
        },
        leaveType: true,
      },
    });

    // ─── REQ-AI-ATT-04: AI Auto-Approval for Leave ────────────────────────
    let autoApprovalApplied = false;
    let autoApprovalReason: string | null = null;
    try {
      const ctx = await buildContext(employeeId);
      const days =
        Math.ceil(
          (new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24),
        ) + 1;
      const decision = await evaluateLeaveAutoApproval(ctx, {
        leaveType: leaveRequest.leaveType?.code || leaveRequest.leaveType?.name || 'unknown',
        days: halfDay ? 0.5 : days,
        hasAttachment: false,
        isMedical: /sick|medical/i.test(leaveRequest.leaveType?.name || ''),
      });
      if (decision.autoApproved) {
        await db.leaveRequest.update({
          where: { id: leaveRequest.id },
          data: {
            status: 'approved',
            approvedBy: 'ai_auto',
            approvedAt: new Date(),
            comments: `AI auto-approved: ${decision.reason} (confidence ${(decision.confidence * 100).toFixed(0)}%)`,
          },
        });
        autoApprovalApplied = true;
        autoApprovalReason = decision.reason;

        // ─── Deduct leave balance on auto-approval ───
        // Bug fix: previously the balance was never deducted when the AI
        // auto-approved, so the employee's leave balance stayed unchanged
        // even though the leave was approved.
        await deductLeaveBalance(db, {
          employeeId, leaveTypeId, startDate, endDate,
          halfDay: halfDay || false, requestId: leaveRequest.id,
        });

        // Audit log for the auto-approval (FK-safe: actor id may belong to
        // the platform DB while this write targets a tenant DB)
        await safeAuditLog(db, {
          userId: scope.userId,
          action: 'AI_AUTO_APPROVE_LEAVE',
          module: 'leave',
          details: `Leave request ${leaveRequest.id} auto-approved for employee ${employeeId}. Reason: ${decision.reason}. Confidence: ${decision.confidence}. Rules: ${decision.rulesEvaluated.join(', ')}`,
        });
      }
    } catch (e) {
      console.warn('[leave] Auto-approval evaluation failed (non-fatal):', e);
    }

    // ─── Dynamic Leave Approval Workflow ──────────────────────────────
    // Load the workflow config for this tenant + leave type, initialize
    // the multi-tier approval chain, and notify the first approver.
    //
    // If auto-approval was already applied (above), we skip the workflow
    // entirely — the request is already approved.
    let workflowResult: { currentApproverId: string | null; firstTier: number } | null = null;
    if (!autoApprovalApplied) {
      try {
        const { loadWorkflowConfig, initializeLeaveWorkflow } = await import('@/lib/leave-workflow');
        const { config: wfConfig, configId: wfConfigId } = await loadWorkflowConfig(
          db,
          scope.tenantId,
          leaveTypeId,
        );

        // Check if auto-approve short leave is enabled AND the leave is short enough
        const leaveDays = Math.ceil(
          (new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24),
        ) + 1;
        const effectiveDays = halfDay ? 0.5 : leaveDays;

        if (wfConfig.autoApproveShortLeave && effectiveDays <= (wfConfig.shortLeaveMaxDays || 1)) {
          // Auto-approve short leave (bypass workflow)
          await db.leaveRequest.update({
            where: { id: leaveRequest.id },
            data: {
              status: 'approved',
              approvedBy: 'ai_auto',
              approvedAt: new Date(),
              comments: `Auto-approved: short leave (${effectiveDays} day(s)) ≤ ${wfConfig.shortLeaveMaxDays} day threshold`,
            },
          });
          autoApprovalApplied = true;
          autoApprovalReason = `Short leave auto-approval (${effectiveDays} day(s))`;

          // ─── Deduct leave balance on short-leave auto-approval ───
          // Bug fix: same as AI auto-approval — balance was never deducted.
          await deductLeaveBalance(db, {
            employeeId, leaveTypeId, startDate, endDate,
            halfDay: halfDay || false, requestId: leaveRequest.id,
          });
        } else {
          // Initialize the multi-tier workflow
          workflowResult = await initializeLeaveWorkflow(
            db,
            leaveRequest.id,
            employeeId,
            scope.tenantId,
            wfConfig,
            wfConfigId,
            leaveRequest.leaveType?.name,
          );

          // Notify the first approver (if resolved)
          if (workflowResult.currentApproverId) {
            await createNotification({
              tenantId: scope.tenantId,
              userId: workflowResult.currentApproverId,
              title: 'Leave Request Requires Your Approval',
              message: `${leaveRequest.employee.firstName} ${leaveRequest.employee.lastName} has submitted a ${leaveRequest.leaveType.name} leave request from ${startDate} to ${endDate}. Please review and approve/reject.`,
              type: 'workflow',
              category: 'leave',
              link: `/leave`,
            }).catch(() => { /* non-fatal */ });
          }
        }
      } catch (wfErr) {
        console.warn('[leave] Workflow initialization failed (non-fatal), falling back to legacy:', wfErr);
      }
    }

    // ─── REQ-ENG-04: Intelligent approval router ─────────────────────────
    // Only run the legacy router if the workflow was NOT initialized
    // (i.e., no workflow config exists, or it failed)
    let approvalRouting: { fallbackApplied: boolean; approverId: string | null; reason: string } | null = null;
    if (!autoApprovalApplied && !workflowResult) {
      try {
        const { resolveAndAuditApprover } = await import('@/lib/approval-router');
        const router = await resolveAndAuditApprover(
          employeeId,
          'leave',
          scope.userId || 'system',
          null,
          new Date(startDate),
        );
        approvalRouting = {
          fallbackApplied: router.fallbackApplied,
          approverId: router.approverId,
          reason: router.reason,
        };
        if (router.fallbackApplied && router.approverId) {
          // Notify the backup approver
          await createNotification({
            tenantId: scope.tenantId,
            userId: router.approverId,
            title: 'Leave Request — Auto-Routed to You (Backup Approver)',
            message: `Primary manager is on leave. ${leaveRequest.employee.firstName} ${leaveRequest.employee.lastName}'s ${leaveRequest.leaveType.name} leave request (${startDate} to ${endDate}) has been auto-routed to you for approval.`,
            type: 'workflow',
            category: 'leave',
            link: `/leave/${leaveRequest.id}`,
          }).catch(() => { /* non-fatal */ });
        }
      } catch (e) {
        console.warn('[leave] Approval router failed (non-fatal):', e);
      }
    }

    // Notify HR admins about the leave request (only if workflow wasn't set up
    // — if it was, the first approver was already notified above, and HR admins
    // will be notified when it's their tier's turn)
    if (!workflowResult) {
      const hrAdmins = await db.user.findMany({
        where: {
          tenantId: scope.tenantId,
          role: { in: ['super_admin', 'tenant_admin', 'admin'] },
        },
      });

      for (const admin of hrAdmins) {
        await createNotification({
          tenantId: scope.tenantId,
          userId: admin.id,
          title: 'New Leave Request',
          message: `${leaveRequest.employee.firstName} ${leaveRequest.employee.lastName} has submitted a ${leaveRequest.leaveType.name} leave request from ${startDate} to ${endDate}.`,
          type: 'workflow',
          category: 'leave',
          link: `/leave/${leaveRequest.id}`,
        });
      }
    }

    // FK-safe audit write — 2026-09-09: this used to be a bare auditLog.create
    // and violated AuditLog_userId_fkey when the token identity came from the
    // platform DB (e.g. demo 'demo-tenantadmin') while the write targeted the
    // tenant DB → the whole apply request 500'd AFTER the leave row was
    // created. Audit must never break the business operation.
    await safeAuditLog(db, {
      userId: scope.userId,
      action: 'CREATE_LEAVE_REQUEST',
      module: 'leave',
      details: `Created leave request for employee ${employeeId}`,
    });

    return NextResponse.json(
      {
        leaveRequest,
        autoApproval: autoApprovalApplied
          ? { applied: true, reason: autoApprovalReason }
          : { applied: false },
        approvalRouting,
      },
      { status: 201, headers: corsHeaders() }
    );
  } catch (error) {
    console.error('Create leave request error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders() }
    );
  }
}
