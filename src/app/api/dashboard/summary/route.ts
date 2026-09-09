/**
 * Single BFF endpoint for the ESS dashboard.
 * One webpack compile + one HTTP round-trip instead of 10 separate API routes.
 */
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';
import { resolveCompanyScope } from '@/lib/companyScope';

function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: cors() });
}

async function safe<T>(label: string, fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (e) {
    console.warn(`[dashboard/summary] ${label}:`, e instanceof Error ? e.message : e);
    return null;
  }
}

export async function GET(request: Request) {
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: cors() });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: cors() });

    const scope = await resolveCompanyScope(request);
    if (!scope) return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: cors() });

    const db = await getDb(request);
    const employeeFilter = scope.employeeId
      ? { employeeId: scope.employeeId }
      : scope.companyId
        ? { employee: { companyId: scope.companyId } }
        : {};
    const companyId = scope.companyId || undefined;

    const [
      balances,
      attendance,
      pendingLeaveCount,
      payslips,
      reviews,
      goals,
      trainings,
      timesheets,
      tickets,
      documents,
    ] = await Promise.all([
      safe('leaveBalance', () =>
        db.leaveBalance.findMany({
          where: employeeFilter,
          take: 50,
          include: { leaveType: { select: { id: true, name: true, code: true } } },
        })
      ),
      safe('attendance', () =>
        db.attendance.findMany({
          where: employeeFilter,
          take: 100,
          orderBy: { date: 'desc' },
        })
      ),
      safe('pendingLeaves', () =>
        db.leaveRequest.count({
          where: {
            status: 'pending',
            ...(companyId ? { employee: { companyId } } : {}),
            ...(scope.employeeId ? { employeeId: scope.employeeId } : {}),
          },
        })
      ),
      safe('payslips', () =>
        db.payroll.findMany({
          where: {
            ...(companyId ? { employee: { companyId } } : {}),
            ...(scope.employeeId ? { employeeId: scope.employeeId } : {}),
          },
          take: 5,
          orderBy: [{ year: 'desc' }, { month: 'desc' }],
        })
      ),
      safe('performance', () =>
        db.performanceReview.findMany({
          where: {
            ...(companyId ? { employee: { companyId } } : {}),
            ...(scope.employeeId ? { employeeId: scope.employeeId } : {}),
          },
          take: 1,
          orderBy: { reviewDate: 'desc' },
        })
      ),
      safe('goals', () =>
        db.goal.findMany({
          where: {
            ...(companyId ? { employee: { companyId } } : {}),
            ...(scope.employeeId ? { employeeId: scope.employeeId } : {}),
          },
          take: 5,
          orderBy: { updatedAt: 'desc' },
        })
      ),
      safe('training', () =>
        db.training.findMany({
          take: 10,
          orderBy: { startDate: 'desc' },
        })
      ),
      safe('timesheets', () =>
        db.timesheet.findMany({
          where: {
            ...(companyId ? { employee: { companyId } } : {}),
            ...(scope.employeeId ? { employeeId: scope.employeeId } : {}),
          },
          take: 5,
          orderBy: { date: 'desc' },
        })
      ),
      safe('tickets', () =>
        db.ticket.findMany({
          where: {
            ...(companyId ? { companyId } : {}),
            ...(scope.employeeId ? { employeeId: scope.employeeId } : {}),
          },
          take: 5,
          orderBy: { createdAt: 'desc' },
        })
      ),
      safe('documents', () =>
        db.document.findMany({
          where: {
            ...(companyId ? { companyId } : {}),
            ...(scope.employeeId ? { employeeId: scope.employeeId } : {}),
          },
          take: 5,
          orderBy: { uploadedAt: 'desc' },
        })
      ),
    ]);

    return NextResponse.json(
      {
        leaveBalance: { balances: balances ?? [] },
        attendance: { attendance: attendance ?? [] },
        leavePending: { pagination: { total: pendingLeaveCount ?? 0 } },
        payslips: { payslips: payslips ?? [] },
        performance: { reviews: reviews ?? [] },
        goals: { goals: goals ?? [] },
        training: { trainings: trainings ?? [] },
        timesheets: { timesheets: timesheets ?? [] },
        tickets: { tickets: tickets ?? [] },
        documents: { documents: documents ?? [] },
      },
      { headers: cors() }
    );
  } catch (error) {
    console.error('[dashboard/summary] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: cors() });
  }
}
