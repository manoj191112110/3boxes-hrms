import { NextRequest, NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { getTokenFromHeaders, verifyToken } from '@/lib/auth';
import { resolveCompanyScope } from '@/lib/companyScope';
import { sanitizeMultiLineText } from '@/lib/sanitize';

export async function GET(req: NextRequest) {
  const db = await getDb(req);
  try {
    // ─── Auth + scope resolution ───
    const token = getTokenFromHeaders(req);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const url = new URL(req.url);
    const status = url.searchParams.get('status');
    const employeeId = url.searchParams.get('employeeId');
    const type = url.searchParams.get('type');
    const companyId = url.searchParams.get('companyId');
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    // Resolve scope: employee=own, manager=own+reports, admin=all/company
    const scope = await resolveCompanyScope(req);
    if (!scope) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const where: Record<string, unknown> = {};

    // Apply data-scope filtering
    if (scope.scope === 'self' && scope.ownEmployeeId) {
      // Employee: only their own leaves
      where.employeeId = scope.ownEmployeeId;
    } else if (scope.scope === 'team' && scope.visibleEmployeeIds.length > 0) {
      // Manager: own + direct reports' leaves
      where.employeeId = { in: scope.visibleEmployeeIds };
    } else if (scope.scope === 'all' && companyId) {
      // Admin with company selected (companyId from query)
      where.employee = { companyId };
    } else if (scope.scope === 'all' && scope.companyId) {
      // Admin with company selected via scope (from CompanySwitcher)
      where.employee = { companyId: scope.companyId };
    }
    // 'all' without companyId → no filter (sees all)

    // Allow employeeId override for admins/managers (with validation for managers)
    if (employeeId && scope.scope !== 'self') {
      if (scope.scope === 'team' && !scope.visibleEmployeeIds.includes(employeeId)) {
        return NextResponse.json({ error: 'Access denied: not your direct report' }, { status: 403 });
      }
      where.employeeId = employeeId;
    }
    if (status) where.status = status;
    if (type) where.type = type;
    if (startDate || endDate) {
      where.startDate = {};
      if (startDate) (where.startDate as Record<string, unknown>).gte = new Date(startDate);
      if (endDate) (where.startDate as Record<string, unknown>).lte = new Date(endDate);
    }

    const [leaves, total] = await Promise.all([
      db.leave.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          employee: {
            select: {
              id: true, firstName: true, lastName: true,
              employeeId: true, avatar: true,
              department: { select: { name: true } },
            },
          },
          approver: {
            select: { id: true, firstName: true, lastName: true },
          },
          workflowInstance: {
            include: {
              workflowDef: { select: { name: true } },
              steps: { orderBy: { stepOrder: 'asc' } },
            },
          },
        },
      }),
      db.leave.count({ where }),
    ]);

    return NextResponse.json({
      data: leaves,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Leaves GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch leaves', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const db = await getDb(req);
  try {
    const body = await req.json();
    const {
      type, startDate, endDate, totalDays,
      employeeId, createWorkflow,
    } = body;
    // Sanitize free-text reason to strip HTML/script content before persisting.
    const reason = sanitizeMultiLineText(body.reason, 2000);

    if (!type || !startDate || !endDate || !totalDays || !employeeId) {
      return NextResponse.json(
        { error: 'Missing required fields: type, startDate, endDate, totalDays, employeeId' },
        { status: 400 }
      );
    }

    const leave = await db.leave.create({
      data: {
        type,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        totalDays,
        reason,
        employeeId,
        status: 'pending',
      },
      include: {
        employee: {
          select: { firstName: true, lastName: true, department: { select: { name: true } } },
        },
      },
    });

    // Create workflow instance if requested
    if (createWorkflow) {
      const workflowDef = await db.workflowDefinition.findFirst({
        where: { entity: 'leave', isActive: true },
        include: { steps: { orderBy: { stepOrder: 'asc' } } },
      });

      if (workflowDef && workflowDef.steps.length > 0) {
        const instance = await db.workflowInstance.create({
          data: {
            status: 'pending',
            currentStep: 0,
            initiatedBy: employeeId,
            workflowDefId: workflowDef.id,
            steps: {
              create: workflowDef.steps.map((step) => ({
                stepOrder: step.stepOrder,
                status: step.stepOrder === 0 ? 'pending' : 'pending',
              })),
            },
          },
        });

        await db.leave.update({
          where: { id: leave.id },
          data: { workflowInstanceId: instance.id },
        });

        leave.workflowInstanceId = instance.id;
      }
    }

    // Notify manager
    const employee = await db.employee.findUnique({
      where: { id: employeeId },
      select: { reportingManagerId: true, firstName: true, lastName: true },
    });

    if (employee?.reportingManagerId) {
      const managerUser = await db.user.findFirst({
        where: { employee: { id: employee.reportingManagerId } },
      });
      if (managerUser) {
        await db.notification.create({
          data: {
            title: 'New Leave Request',
            message: `${employee.firstName} ${employee.lastName} requested ${type} leave for ${totalDays} days`,
            type: 'leave',
            category: 'approval',
            userId: managerUser.id,
            actionUrl: `/leaves/${leave.id}`,
          },
        });
      }
    }

    await db.auditLog.create({
      data: {
        action: 'CREATE',
        entity: 'Leave',
        entityId: leave.id,
        userId: body.userId,
        details: `Leave request submitted: ${type} for ${totalDays} days`,
      },
    });

    return NextResponse.json(leave, { status: 201 });
  } catch (error) {
    console.error('Leaves POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const db = await getDb(req);
  try {
    const body = await req.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json({ error: 'Leave ID is required' }, { status: 400 });
    }

    const existing = await db.leave.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Leave not found' }, { status: 404 });
    }

    if (updateData.startDate) updateData.startDate = new Date(updateData.startDate);
    if (updateData.endDate) updateData.endDate = new Date(updateData.endDate);

    const leave = await db.leave.update({
      where: { id },
      data: updateData,
      include: {
        employee: { select: { firstName: true, lastName: true } },
        approver: { select: { firstName: true, lastName: true } },
      },
    });

    return NextResponse.json(leave);
  } catch (error) {
    console.error('Leaves PUT error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const db = await getDb(req);
  try {
    const body = await req.json();
    const { id, action, approverId } = body;
    // Sanitize free-text comment to strip HTML/script content before persisting.
    const comment = sanitizeMultiLineText(body.comment, 2000);

    if (!id || !action || !approverId) {
      return NextResponse.json(
        { error: 'Missing required fields: id, action (approve/reject), approverId' },
        { status: 400 }
      );
    }

    const leave = await db.leave.findUnique({
      where: { id },
      include: { employee: true },
    });

    if (!leave) {
      return NextResponse.json({ error: 'Leave not found' }, { status: 404 });
    }

    if (leave.status !== 'pending') {
      return NextResponse.json(
        { error: 'Leave request is not in pending status' },
        { status: 400 }
      );
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected';

    // Update the leave
    const updatedLeave = await db.leave.update({
      where: { id },
      data: {
        status: newStatus,
        approverId,
        approverComment: comment,
      },
      include: {
        employee: { select: { firstName: true, lastName: true } },
        approver: { select: { firstName: true, lastName: true } },
      },
    });

    // ─── Deduct leave balance on approval ───
    // Bug fix: previously the legacy /api/leaves PATCH never deducted
    // balance when a leave was approved, so the employee's leave balance
    // stayed unchanged.
    if (action === 'approve') {
      try {
        const daysDiff = Math.ceil(
          (new Date(leave.endDate).getTime() - new Date(leave.startDate).getTime()) / (1000 * 60 * 60 * 24),
        ) + 1;
        const year = new Date(leave.startDate).getFullYear();
        await db.leaveBalance.updateMany({
          where: { employeeId: leave.employeeId, year },
          data: {
            used: { increment: daysDiff },
            remaining: { decrement: daysDiff },
          },
        });
      } catch (e) {
        console.warn('[leaves PATCH] Balance deduction failed (non-fatal):', e);
      }
    }

    // Update workflow instance if exists
    if (leave.workflowInstanceId) {
      const instance = await db.workflowInstance.findUnique({
        where: { id: leave.workflowInstanceId },
        include: { steps: { orderBy: { stepOrder: 'asc' } } },
      });

      if (instance) {
        const currentStep = instance.steps.find(
          (s) => s.stepOrder === instance.currentStep
        );

        if (currentStep) {
          await db.workflowStepInstance.update({
            where: { id: currentStep.id },
            data: {
              status: newStatus,
              actionedBy: approverId,
              comments: comment,
              actedAt: new Date(),
            },
          });
        }

        if (action === 'approve') {
          const nextStep = instance.steps.find(
            (s) => s.stepOrder === instance.currentStep + 1
          );
          if (nextStep) {
            await db.workflowInstance.update({
              where: { id: instance.id },
              data: { currentStep: instance.currentStep + 1 },
            });
          } else {
            await db.workflowInstance.update({
              where: { id: instance.id },
              data: { status: 'approved' },
            });
          }
        } else {
          await db.workflowInstance.update({
            where: { id: instance.id },
            data: { status: 'rejected' },
          });
        }
      }
    }

    // Notify the employee
    const empUser = await db.user.findFirst({
      where: { employee: { id: leave.employeeId } },
    });

    if (empUser) {
      await db.notification.create({
        data: {
          title: `Leave ${newStatus}`,
          message: `Your ${leave.type} leave request has been ${newStatus}${comment ? `: ${comment}` : ''}`,
          type: 'leave',
          category: 'status_update',
          userId: empUser.id,
          actionUrl: `/leaves/${id}`,
        },
      });
    }

    await db.auditLog.create({
      data: {
        action: action === 'approve' ? 'APPROVE' : 'REJECT',
        entity: 'Leave',
        entityId: id,
        userId: approverId,
        details: `Leave ${newStatus}: ${comment || 'No comment'}`,
      },
    });

    return NextResponse.json(updatedLeave);
  } catch (error) {
    console.error('Leaves PATCH error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
