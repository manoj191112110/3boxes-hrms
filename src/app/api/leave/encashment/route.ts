/**
 * Leave Encashment API — REQ-LVE-07
 *
 *  GET  — list encashment requests
 *  POST — submit a new encashment request; amount auto-computed from leave type + salary basis
 *  PATCH — approve/reject (admin)
 */
import { requireUser, findEmployeeByEmail, isAdminRole, parseBody, getQuery, ok, fail, OPTIONS } from '@/lib/attendance-leave-api';
import { getDb, getPlatformDb } from '@/lib/tenant-db';

export { OPTIONS };

export async function GET(request: Request) {
  const db = await getDb(request);
  const { user, response } = await requireUser(request);
  if (!user) return response;
  try {
    const q = getQuery(request);
    const where: Record<string, unknown> = {};
    if (!isAdminRole(user.role)) {
      const emp = await findEmployeeByEmail(user.email);
      if (!emp) return ok({ encashmentRequests: [] });
      where.employeeId = emp.id;
    } else if (q.employeeId) {
      where.employeeId = q.employeeId;
    }
    if (q.status) where.status = q.status;

    const items = await db.leaveEncashmentRequest.findMany({
      where,
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, employeeId: true } },
        leaveType: { select: { id: true, name: true, code: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return ok({ encashmentRequests: items });
  } catch (e: unknown) {
    return fail(e instanceof Error ? e.message : 'Failed to load', 500);
  }
}

export async function POST(request: Request) {
  const db = await getDb(request);
  const { user, response } = await requireUser(request);
  if (!user) return response;
  const body = await parseBody(request);
  if (!body) return fail('Invalid JSON');
  try {
    const emp = await findEmployeeByEmail(user.email);
    if (!emp) return fail('Employee record not found', 404);

    const leaveTypeId = body.leaveTypeId as string;
    const days = Number(body.days);
    if (!leaveTypeId) return fail('Leave type is required');
    if (!Number.isFinite(days) || days <= 0) return fail('Invalid days');

    const leaveType = await db.leaveType.findUnique({ where: { id: leaveTypeId } });
    if (!leaveType) return fail('Leave type not found', 404);
    if (!leaveType.encashmentAllowed) return fail('Encashment not allowed for this leave type');
    if (leaveType.maxEncashmentDays > 0 && days > leaveType.maxEncashmentDays) {
      return fail(`Max ${leaveType.maxEncashmentDays} days allowed for encashment`);
    }

    // Verify the employee has the days available in the current year's balance
    const year = new Date().getFullYear();
    const balance = await db.leaveBalance.findUnique({
      where: { employeeId_leaveTypeId_year: { employeeId: emp.id, leaveTypeId, year } },
    });
    if (!balance || balance.remaining < days) return fail('Insufficient leave balance');

    // Compute amount: based on salary and basis
    const employee = await db.employee.findUnique({ where: { id: emp.id }, select: { salary: true } });
    const monthlySalary = employee?.salary || 0;
    let ratePerDay = 0;
    if (leaveType.encashmentBasis === 'gross') {
      ratePerDay = monthlySalary / 30; // approximate
    } else if (leaveType.encashmentBasis === 'monthly_salary') {
      ratePerDay = monthlySalary / 30;
    } else {
      // basic = ~50% of monthly salary (typical Indian payroll)
      ratePerDay = (monthlySalary * 0.5) / 30;
    }
    const amount = Math.round(ratePerDay * days * 100) / 100;

    // Tax implications — placeholder; in production this would be country-specific
    const taxImplications = { note: 'Tax will be deducted at source as per applicable law', tdsRate: 0.1 };

    const record = await db.leaveEncashmentRequest.create({
      data: {
        employeeId: emp.id,
        leaveTypeId,
        days,
        basis: leaveType.encashmentBasis,
        ratePerDay,
        amount,
        taxImplications: taxImplications as never,
        status: 'pending',
      },
    });
    return ok({ encashmentRequest: record }, 201);
  } catch (e: unknown) {
    return fail(e instanceof Error ? e.message : 'Failed to create', 500);
  }
}
