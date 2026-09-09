import { NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { resolveCompanyScope } from '@/lib/companyScope';
import { createNotification } from '@/lib/notifications';
import { buildContext, evaluateLeaveAutoApproval } from '@/lib/auto-approval-engine';
import { isServerLiveSite } from '@/lib/tenant-filter';

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
    const { employeeId, leaveTypeId, startDate, endDate, reason, halfDay, halfDaySlot } = body;

    if (!employeeId || !leaveTypeId || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'Missing required fields: employeeId, leaveTypeId, startDate, endDate' },
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

        // Audit log for the auto-approval
        await db.auditLog.create({
          data: {
            userId: scope.userId,
            action: 'AI_AUTO_APPROVE_LEAVE',
            module: 'leave',
            details: `Leave request ${leaveRequest.id} auto-approved for employee ${employeeId}. Reason: ${decision.reason}. Confidence: ${decision.confidence}. Rules: ${decision.rulesEvaluated.join(', ')}`,
          },
        });
      }
    } catch (e) {
      console.warn('[leave] Auto-approval evaluation failed (non-fatal):', e);
    }

    // ─── REQ-ENG-04: Intelligent approval router ─────────────────────────
    let approvalRouting: { fallbackApplied: boolean; approverId: string | null; reason: string } | null = null;
    if (!autoApprovalApplied) {
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

    // Notify HR admins about the leave request
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

    await db.auditLog.create({
      data: {
        userId: scope.userId,
        action: 'CREATE_LEAVE_REQUEST',
        module: 'leave',
        details: `Created leave request for employee ${employeeId}`,
      },
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
