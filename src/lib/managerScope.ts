/**
 * Manager-Reportee Resolution Utility
 *
 * Resolves the list of employee IDs that a manager can see — i.e., their
 * direct reports plus their own employee record (managers see their own
 * data too). Used by all API routes that support the 'team' data scope.
 *
 * Resolution priority:
 *   1. Employee.reportingManagerId (solid-line manager — the primary manager)
 *   2. DottedLineManager junction table where managerType='solid' or 'dotted'
 *
 * Returns an array of employee IDs (including the manager's own employee ID).
 * If the current user has no reportees, returns just their own employee ID
 * (so they still see their own records).
 */

import { getDb } from '@/lib/tenant-db';
import type { PrismaClient } from '@/generated/prisma/client';

export interface ManagerScopeResult {
  /** The current user's ID (from JWT) */
  userId: string;
  /** The current user's own employee ID (may be null if not linked) */
  ownEmployeeId: string | null;
  /**
   * List of employee IDs the manager can see — includes their own employee
   * ID plus all direct reports (solid + dotted line).
   * Empty array if the user has no Employee record.
   */
  visibleEmployeeIds: string[];
  /**
   * Same as visibleEmployeeIds but as a Prisma filter object.
   * Use this directly in where clauses:
   *   where: { id: { in: result.visibleEmployeeIds } }
   * or for relations:
   *   where: { employeeId: { in: result.visibleEmployeeIds } }
   */
  employeeIdFilter: { id: { in: string[] } };
}

/**
 * Resolve the manager scope for a request.
 *
 * @param userId - The authenticated user's ID (from JWT)
 * @param db - Optional PrismaClient. If not provided, uses the platform DB.
 *             Always pass the tenant-resolved DB from getDb(request) for
 *             proper multi-tenant isolation.
 */
export async function resolveManagerScope(
  userId: string,
  db?: PrismaClient
): Promise<ManagerScopeResult> {
  const prisma = db || (await getDb());

  // Find the manager's own Employee record
  const ownEmployee = await prisma.employee.findFirst({
    where: { userId, status: 'active' },
    select: { id: true, companyId: true, departmentId: true },
  });

  const ownEmployeeId = ownEmployee?.id || null;

  if (!ownEmployeeId) {
    // No employee record — return empty scope
    return {
      userId,
      ownEmployeeId: null,
      visibleEmployeeIds: [],
      employeeIdFilter: { id: { in: ['__never__'] } }, // matches nothing
    };
  }

  // ─── 1. Direct reports via Employee.reportingManagerId ───
  const directReportees = await prisma.employee.findMany({
    where: {
      reportingManagerId: ownEmployeeId,
      status: 'active',
    },
    select: { id: true },
  });
  const directReporteeIds = directReportees.map(e => e.id);

  // ─── 2. Dotted-line reports via DottedLineManager table ───
  // Includes all manager types (solid, dotted, project, functional) for visibility.
  let dottedReporteeIds: string[] = [];
  try {
    const dottedManagers = await (prisma as any).dottedLineManager?.findMany({
      where: {
        managerId: ownEmployeeId,
        // No endDate or endDate in the future = active relationship
        OR: [
          { endDate: null },
          { endDate: { gt: new Date() } },
        ],
      },
      select: { employeeId: true },
    });
    if (dottedManagers && Array.isArray(dottedManagers)) {
      dottedReporteeIds = dottedManagers.map((d: { employeeId: string }) => d.employeeId);
    }
  } catch {
    // DottedLineManager table might not exist in some tenant DBs — ignore
  }

  // Combine: own + direct + dotted (deduplicated)
  const visibleEmployeeIds = Array.from(new Set([
    ownEmployeeId,
    ...directReporteeIds,
    ...dottedReporteeIds,
  ]));

  return {
    userId,
    ownEmployeeId,
    visibleEmployeeIds,
    employeeIdFilter: { id: { in: visibleEmployeeIds } },
  };
}

/**
 * Convenience: Build a Prisma where clause for "employeeId IN visible list".
 *
 * For models with a direct `employeeId` field (Attendance, LeaveRequest, etc.):
 *   where: { employeeId: { in: result.visibleEmployeeIds } }
 *
 * For models with a relation `employee` (Payroll, etc.):
 *   where: { employee: result.employeeIdFilter }
 */
export function buildTeamWhereFilter(scope: ManagerScopeResult): {
  /** For models with direct employeeId field */
  byEmployeeId: { employeeId: { in: string[] } };
  /** For models with employee relation */
  byEmployeeRelation: { employee: { id: { in: string[] } } };
  /** Raw ID array */
  ids: string[];
} {
  return {
    byEmployeeId: { employeeId: { in: scope.visibleEmployeeIds } },
    byEmployeeRelation: { employee: { id: { in: scope.visibleEmployeeIds } } },
    ids: scope.visibleEmployeeIds,
  };
}
