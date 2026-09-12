/**
 * REQ-ENG-04 — Intelligent approval router with on-leave fallback.
 *
 * If the primary approver (manager) is on approved leave for the request date,
 * automatically route the approval to the configured backup approver
 * (ApprovalRoutingRule.alternateManagerId). Falls back to the primary manager
 * if no rule matches or if the backup is also on leave.
 *
 * Used by: leave requests, overtime requests, gatepass requests, hourly permissions.
 */
import prisma from '@/lib/prisma';

/**
 * Compute the approver for a given employee on a given date.
 *
 * @param employeeId  The employee whose request needs approval
 * @param requestType 'leave' | 'overtime' | 'gatepass' | 'permission'
 * @param projectId   Optional project context (used to look up routing rules)
 * @param date        The date of the request (defaults to today)
 * @returns { approverId, primaryApproverId, fallbackApplied, reason }
 */
export async function resolveApprover(
  employeeId: string,
  requestType: 'leave' | 'overtime' | 'gatepass' | 'permission',
  projectId?: string | null,
  date: Date = new Date(),
): Promise<{
  approverId: string | null;
  primaryApproverId: string | null;
  fallbackApplied: boolean;
  reason: string;
}> {
  // 1. Find the employee's primary manager (via department → headId, or dotted line)
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: {
      id: true,
      departmentId: true,
      department: { select: { id: true, name: true, headId: true } },
    },
  });
  if (!employee) {
    return { approverId: null, primaryApproverId: null, fallbackApplied: false, reason: 'Employee not found' };
  }
  const primaryManagerId = employee.department?.headId || null;
  if (!primaryManagerId) {
    return { approverId: null, primaryApproverId: null, fallbackApplied: false, reason: 'No primary manager assigned to department' };
  }

  // 2. Check if the primary manager is on approved leave on the request date
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);
  const primaryOnLeave = await prisma.leaveRequest.findFirst({
    where: {
      employeeId: primaryManagerId,
      status: 'approved',
      startDate: { lte: dayEnd },
      endDate: { gte: dayStart },
    },
    select: { id: true, leaveType: true, endDate: true },
  });

  if (!primaryOnLeave) {
    return {
      approverId: primaryManagerId,
      primaryApproverId: primaryManagerId,
      fallbackApplied: false,
      reason: 'Primary manager available',
    };
  }

  // 3. Primary is on leave — look up the routing rule for this request type + project
  const rule = await prisma.approvalRoutingRule.findFirst({
    where: {
      requestType,
      isActive: true,
      OR: [
        { projectId: projectId || null },
        { projectId: null },  // general fallback rule
      ],
    },
    orderBy: { priority: 'asc' },
  });

  if (!rule || !rule.alternateManagerId) {
    return {
      approverId: primaryManagerId,
      primaryApproverId: primaryManagerId,
      fallbackApplied: false,
      reason: `Primary on leave (${primaryOnLeave.leaveType}) but no backup rule configured — request will queue until manager returns`,
    };
  }

  // 4. Verify the backup is also not on leave
  const backupOnLeave = await prisma.leaveRequest.findFirst({
    where: {
      employeeId: rule.alternateManagerId,
      status: 'approved',
      startDate: { lte: dayEnd },
      endDate: { gte: dayStart },
    },
    select: { id: true, leaveType: true },
  });
  if (backupOnLeave) {
    return {
      approverId: primaryManagerId,
      primaryApproverId: primaryManagerId,
      fallbackApplied: false,
      reason: `Both primary manager and backup (${rule.alternateManagerId}) are on leave — request will queue`,
    };
  }

  // 5. Fallback to backup
  return {
    approverId: rule.alternateManagerId,
    primaryApproverId: primaryManagerId,
    fallbackApplied: true,
    reason: `Primary manager on ${primaryOnLeave.leaveType} leave until ${primaryOnLeave.endDate.toISOString().substring(0, 10)} — auto-routed to backup per rule "${rule.name}"`,
  };
}

/**
 * Resolve an approver and write an audit-log entry. Used by API routes after
 * they have a decoded user.
 */
export async function resolveAndAuditApprover(
  employeeId: string,
  requestType: 'leave' | 'overtime' | 'gatepass' | 'permission',
  requesterUserId: string,
  projectId?: string | null,
  date: Date = new Date(),
) {
  const result = await resolveApprover(employeeId, requestType, projectId, date);
  if (result.fallbackApplied) {
    await prisma.auditLog.create({
      data: {
        userId: requesterUserId,
        action: 'APPROVAL_AUTO_ROUTED',
        module: requestType,
        details: `Employee ${employeeId} ${requestType} request auto-routed to backup approver ${result.approverId}. Reason: ${result.reason}`,
      },
    });
  }
  return result;
}
