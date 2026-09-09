import { NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { resolveCompanyScope } from '@/lib/companyScope';
import { createNotification } from '@/lib/notifications';

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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const db = await getDb(request);
  try {
    const scope = await resolveCompanyScope(request);
    if (!scope) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401, headers: corsHeaders() }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { status, comments } = body;

    if (!status || !['approved', 'rejected', 'cancelled'].includes(status)) {
      return NextResponse.json(
        { error: 'Valid status is required: approved, rejected, or cancelled' },
        { status: 400, headers: corsHeaders() }
      );
    }

    const existingLeave = await db.leaveRequest.findUnique({
      where: { id },
      include: {
        employee: {
          select: { firstName: true, lastName: true, userId: true, companyId: true },
        },
        leaveType: true,
      },
    });

    if (!existingLeave) {
      return NextResponse.json(
        { error: 'Leave request not found' },
        { status: 404, headers: corsHeaders() }
      );
    }

    // ─── Company-scoped data visibility for approval/rejection ───
    if (scope.scope === 'self') {
      // Employees can only cancel their own leave requests
      if (status !== 'cancelled') {
        return NextResponse.json(
          { error: 'Only admins can approve or reject leave requests' },
          { status: 403, headers: corsHeaders() }
        );
      }
      // For cancellation, verify it's their own request
      const employee = await db.employee.findFirst({
        where: { userId: scope.userId, status: 'active' },
        select: { id: true },
      });
      if (!employee || employee.id !== existingLeave.employeeId) {
        return NextResponse.json(
          { error: 'You can only cancel your own leave requests' },
          { status: 403, headers: corsHeaders() }
        );
      }
    } else if (scope.companyId) {
      // Admin with specific company — leave request's employee must belong to that company
      if (existingLeave.employee.companyId !== scope.companyId) {
        return NextResponse.json(
          { error: 'Leave request does not belong to the selected company' },
          { status: 403, headers: corsHeaders() }
        );
      }
    }
    // scope === 'all' && no companyId → admin can approve/reject any leave request

    if (existingLeave.status !== 'pending') {
      return NextResponse.json(
        { error: 'Only pending leave requests can be approved/rejected' },
        { status: 400, headers: corsHeaders() }
      );
    }

    const leaveRequest = await db.leaveRequest.update({
      where: { id },
      data: {
        status,
        approvedBy: scope.userId,
        approvedAt: new Date(),
        comments,
      },
      include: {
        employee: {
          select: { firstName: true, lastName: true, userId: true },
        },
        leaveType: true,
      },
    });

    // Update leave balance if approved
    if (status === 'approved') {
      const daysDiff = Math.ceil(
        (new Date(leaveRequest.endDate).getTime() - new Date(leaveRequest.startDate).getTime()) / (1000 * 60 * 60 * 24)
      ) + 1;
      const daysToDeduct = leaveRequest.halfDay ? 0.5 : daysDiff;

      const currentYear = new Date().getFullYear();
      await db.leaveBalance.updateMany({
        where: {
          employeeId: leaveRequest.employeeId,
          leaveTypeId: leaveRequest.leaveTypeId,
          year: currentYear,
        },
        data: {
          used: { increment: daysToDeduct },
          remaining: { decrement: daysToDeduct },
        },
      });
    }

    // Notify the employee about the leave decision
    if (leaveRequest.employee.userId) {
      await createNotification({
        tenantId: scope.tenantId,
        userId: leaveRequest.employee.userId,
        title: `Leave Request ${status === 'approved' ? 'Approved' : 'Rejected'}`,
        message: `Your ${leaveRequest.leaveType.name} leave request from ${existingLeave.startDate.toLocaleDateString()} to ${existingLeave.endDate.toLocaleDateString()} has been ${status}.`,
        type: status === 'approved' ? 'success' : 'warning',
        category: 'leave',
        link: `/leave/${leaveRequest.id}`,
      });
    }

    await db.auditLog.create({
      data: {
        userId: scope.userId,
        action: `${status.toUpperCase()}_LEAVE_REQUEST`,
        module: 'leave',
        details: `${status} leave request ${id} for employee ${leaveRequest.employee.firstName} ${leaveRequest.employee.lastName}`,
      },
    });

    return NextResponse.json(
      { leaveRequest },
      { headers: corsHeaders() }
    );
  } catch (error) {
    console.error('Update leave request error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders() }
    );
  }
}
