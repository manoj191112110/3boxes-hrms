import { NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { resolveCompanyScope } from '@/lib/companyScope';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() });
}

/**
 * GET /api/leave/balance
 * Returns the authenticated employee's leave balances for the current year.
 * If the user is a manager/HR/admin and an `employeeId` query param is supplied,
 * that employee's balances are returned instead (subject to company scoping).
 *
 * Company scoping rules:
 * - Employees (scope='self'): only see their own balances
 * - Admins with companyId selected: see balances for employees in that company
 * - Admins without companyId: see all balances
 *
 * Response shape:
 * {
 *   balances: Array<{
 *     id, leaveTypeId, leaveType: { id, name, code, color? },
 *     year, total, used, remaining, carryForward
 *   }>,
 *   summary: { totalAllocated, totalUsed, totalRemaining }
 * }
 */
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
    const requestedEmployeeId = searchParams.get('employeeId');
    const yearParam = searchParams.get('year');
    const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear();

    // Resolve target employee
    let employeeId: string | undefined = requestedEmployeeId || undefined;

    if (scope.scope === 'self') {
      // Employees can only see their own balances
      if (requestedEmployeeId) {
        // If they requested a specific employeeId, verify it's their own
        const selfEmployee = await db.employee.findFirst({
          where: { userId: scope.userId, status: 'active' },
          select: { id: true },
        });
        if (!selfEmployee || selfEmployee.id !== requestedEmployeeId) {
          return NextResponse.json(
            { error: 'You can only view your own leave balance' },
            { status: 403, headers: corsHeaders() }
          );
        }
        employeeId = selfEmployee.id;
      } else {
        // No specific employee requested — resolve from authenticated user
        const employee = await db.employee.findFirst({
          where: { userId: scope.userId, status: 'active' },
          select: { id: true },
        });
        if (!employee) {
          return NextResponse.json(
            { balances: [], summary: { totalAllocated: 0, totalUsed: 0, totalRemaining: 0 } },
            { headers: corsHeaders() }
          );
        }
        employeeId = employee.id;
      }
    } else {
      // Admin users
      if (!employeeId) {
        // Admin didn't specify an employee — return balances for their company scope
        // For admins with a specific companyId, filter by that company's employees
        // For admins without companyId, return all
        const employeeWhere: Record<string, unknown> = {};
        if (scope.companyId) {
          employeeWhere.companyId = scope.companyId;
        }

        const employees = await db.employee.findMany({
          where: employeeWhere,
          select: { id: true },
        });

        if (employees.length === 0) {
          return NextResponse.json(
            { balances: [], summary: { totalAllocated: 0, totalUsed: 0, totalRemaining: 0 } },
            { headers: corsHeaders() }
          );
        }

        const employeeIds = employees.map(e => e.id);

        const balances = await db.leaveBalance.findMany({
          where: { employeeId: { in: employeeIds }, year },
          include: {
            leaveType: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
            employee: {
              select: { id: true, firstName: true, lastName: true, employeeId: true },
            },
          },
          orderBy: { leaveType: { name: 'asc' } },
        });

        const summary = balances.reduce(
          (acc, b) => {
            acc.totalAllocated += b.total || 0;
            acc.totalUsed += b.used || 0;
            acc.totalRemaining += b.remaining || 0;
            return acc;
          },
          { totalAllocated: 0, totalUsed: 0, totalRemaining: 0 }
        );

        return NextResponse.json(
          {
            balances: balances.map((b) => ({
              id: b.id,
              leaveTypeId: b.leaveTypeId,
              leaveType: b.leaveType,
              employeeId: b.employeeId,
              employee: b.employee,
              year: b.year,
              total: b.total,
              used: b.used,
              remaining: b.remaining,
              carryForward: b.carryForward,
            })),
            summary,
          },
          { headers: corsHeaders() }
        );
      } else {
        // Admin requested a specific employee's balance — verify company scope
        const targetEmployee = await db.employee.findUnique({
          where: { id: requestedEmployeeId },
          select: { id: true, companyId: true },
        });
        if (!targetEmployee) {
          return NextResponse.json(
            { balances: [], summary: { totalAllocated: 0, totalUsed: 0, totalRemaining: 0 } },
            { headers: corsHeaders() }
          );
        }
        if (scope.companyId && targetEmployee.companyId !== scope.companyId) {
          return NextResponse.json(
            { error: 'Employee does not belong to the selected company' },
            { status: 403, headers: corsHeaders() }
          );
        }
        employeeId = targetEmployee.id;
      }
    }

    const balances = await db.leaveBalance.findMany({
      where: { employeeId, year },
      include: {
        leaveType: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
      orderBy: { leaveType: { name: 'asc' } },
    });

    // If no balance records exist yet for this year, fall back to listing all
    // active leave types with zeroed-out balances. This gives the UI something
    // sensible to render for new employees.
    // Company scoping: for non-admins, only show leave types that belong to
    // their company. LeaveType doesn't have companyId directly, but we filter
    // through the employee's company scope.
    let result = balances;
    if (balances.length === 0) {
      const leaveTypeWhere: Record<string, unknown> = { status: 'active' };
      // For non-admins or admins with a specific company, try to filter leave types
      // by company if the LeaveType model has a companyId relation
      if (scope.companyId) {
        leaveTypeWhere.companyId = scope.companyId;
      }

      const leaveTypes = await db.leaveType.findMany({
        where: leaveTypeWhere,
        select: {
          id: true,
          name: true,
          code: true,
          defaultDays: true,
        },
        orderBy: { name: 'asc' },
      });
      result = leaveTypes.map((lt) => ({
        id: `synthetic-${lt.id}`,
        leaveTypeId: lt.id,
        leaveType: { id: lt.id, name: lt.name, code: lt.code },
        year,
        total: lt.defaultDays || 0,
        used: 0,
        remaining: lt.defaultDays || 0,
        carryForward: 0,
        synthetic: true,
      })) as typeof balances;
    }

    const summary = result.reduce(
      (acc, b) => {
        acc.totalAllocated += b.total || 0;
        acc.totalUsed += b.used || 0;
        acc.totalRemaining += b.remaining || 0;
        return acc;
      },
      { totalAllocated: 0, totalUsed: 0, totalRemaining: 0 }
    );

    return NextResponse.json(
      {
        balances: result.map((b) => ({
          id: b.id,
          leaveTypeId: b.leaveTypeId,
          leaveType: b.leaveType,
          year: b.year,
          total: b.total,
          used: b.used,
          remaining: b.remaining,
          carryForward: b.carryForward,
        })),
        summary,
      },
      { headers: corsHeaders() }
    );
  } catch (error) {
    console.error('GET /api/leave/balance error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch leave balance' },
      { status: 500, headers: corsHeaders() }
    );
  }
}
