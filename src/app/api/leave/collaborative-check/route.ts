/**
 * AI Collaborative Leave Check API — REQ-LVE-04
 *
 * When an employee applies for leave, this endpoint checks how many
 * other team members are on leave during the requested date range and
 * returns a warning if delivery may be impacted.
 *
 *  POST /api/leave/collaborative-check
 *    body: { employeeId, startDate, endDate, projectId? }
 *    returns: { warning: string | null, teamMembersOnLeave: number, threshold: number }
 */
import { requireUser, parseBody, ok, fail, OPTIONS } from '@/lib/attendance-leave-api';
import { getDb, getPlatformDb } from '@/lib/tenant-db';

export { OPTIONS };

export async function POST(request: Request) {
  const db = await getDb(request);
  const { user, response } = await requireUser(request);
  if (!user) return response;
  const body = await parseBody(request);
  if (!body) return fail('Invalid JSON');
  try {
    const employeeId = body.employeeId as string;
    const startDate = new Date(body.startDate as string);
    const endDate = new Date(body.endDate as string);
    const projectId = body.projectId as string | undefined;
    if (!employeeId || !startDate || !endDate) return fail('Missing required fields');

    // Find the employee's department
    const emp = await db.employee.findUnique({
      where: { id: employeeId },
      select: { id: true, departmentId: true },
    });
    if (!emp) return fail('Employee not found', 404);

    // Find other team members in the same department (or same project if projectId given)
    let teamMemberIds: string[] = [];
    if (projectId) {
      const members = await db.projectMember.findMany({
        where: { projectId, employeeId: { not: employeeId } },
        select: { employeeId: true },
      });
      teamMemberIds = members.map(m => m.employeeId);
    } else {
      const team = await db.employee.findMany({
        where: { departmentId: emp.departmentId, id: { not: employeeId }, status: 'active' },
        select: { id: true },
      });
      teamMemberIds = team.map(e => e.id);
    }

    if (teamMemberIds.length === 0) {
      return ok({ warning: null, teamMembersOnLeave: 0, teamSize: 0 });
    }

    // Count how many of them have approved/pending leave overlapping with [startDate, endDate]
    const overlapping = await db.leaveRequest.findMany({
      where: {
        employeeId: { in: teamMemberIds },
        status: { in: ['approved', 'pending'] },
        // Overlap condition: leave.startDate <= endDate AND leave.endDate >= startDate
        AND: [
          { startDate: { lte: endDate } },
          { endDate: { gte: startDate } },
        ],
      },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, employeeId: true } },
      },
    });

    // De-dupe by employeeId (an employee might have multiple leave requests covering parts of the range)
    const uniqueEmployeesOnLeave = new Map<string, { firstName: string; lastName: string; employeeId: string }>();
    for (const lr of overlapping) {
      if (lr.employee) {
        uniqueEmployeesOnLeave.set(lr.employee.id, {
          firstName: lr.employee.firstName,
          lastName: lr.employee.lastName,
          employeeId: lr.employee.employeeId,
        });
      }
    }

    const teamSize = teamMemberIds.length;
    const onLeave = uniqueEmployeesOnLeave.size;
    // Threshold: 30% of team — warn if exceeded
    const threshold = Math.max(1, Math.floor(teamSize * 0.3));
    let warning: string | null = null;
    if (onLeave >= threshold) {
      const names = Array.from(uniqueEmployeesOnLeave.values()).slice(0, 5)
        .map(e => `${e.firstName} ${e.lastName}`)
        .join(', ');
      warning = `Warning: ${onLeave} other member(s) of your ${projectId ? 'project' : 'department'} team are on leave during these dates (${names}${onLeave > 5 ? ', ...' : ''}). Project delivery may be impacted.`;
    }

    return ok({
      warning,
      teamMembersOnLeave: onLeave,
      teamSize,
      threshold,
      membersOnLeave: Array.from(uniqueEmployeesOnLeave.values()),
    });
  } catch (e: unknown) {
    return fail(e instanceof Error ? e.message : 'Failed to compute', 500);
  }
}
