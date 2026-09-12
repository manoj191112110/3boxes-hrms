import { NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { resolveCompanyScope } from '@/lib/companyScope';
import { withSchemaSync } from '@/lib/schema-sync';

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
    const employeeId = searchParams.get('employeeId');
    const date = searchParams.get('date');
    const status = searchParams.get('status');

    const where: Record<string, unknown> = {};

    // ─── Company-scoped data visibility ───
    if (scope.scope === 'self') {
      // Employees can only see their own attendance records
      const employee = await withSchemaSync(() => db.employee.findFirst({
        where: { userId: scope.userId, status: 'active' },
        select: { id: true },
      }));
      if (employee) {
        where.employeeId = employee.id;
      } else {
        // No employee record — return empty
        return NextResponse.json(
          { attendance: [], pagination: { page, limit, total: 0, totalPages: 0 } },
          { headers: corsHeaders() }
        );
      }
    } else if (scope.companyId) {
      // Admin with a specific company selected via CompanySwitcher
      where.employee = { companyId: scope.companyId };
    }
    // scope === 'all' && no companyId → admin sees all companies

    // Apply additional filters on top of company scope
    if (employeeId) where.employeeId = employeeId;
    if (date) where.date = new Date(date);
    if (status) where.status = status;

    const [attendance, total] = await Promise.all([
      withSchemaSync(() => db.attendance.findMany({
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
        },
        orderBy: { date: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      })),
      withSchemaSync(() => db.attendance.count({ where })),
    ]);

    return NextResponse.json(
      {
        attendance,
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
    console.error('Get attendance error:', error);
    const errMsg = error instanceof Error ? error.message : String(error);
    // If table/column doesn't exist, return empty data instead of 500
    if (/column .* does not exist|does not exist in the current database|table .* does not exist/i.test(errMsg)) {
      return NextResponse.json(
        { attendance: [], pagination: { page, limit, total: 0, totalPages: 0 } },
        { headers: corsHeaders() }
      );
    }
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
    const { employeeId, action, location } = body;

    if (!employeeId || !action) {
      return NextResponse.json(
        { error: 'Missing required fields: employeeId, action (checkin/checkout)' },
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
      // Employees can only create attendance for themselves
      if (targetEmployee.userId !== scope.userId) {
        return NextResponse.json(
          { error: 'You can only check in/out for yourself' },
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

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const existingRecord = await db.attendance.findUnique({
      where: {
        employeeId_date: {
          employeeId,
          date: today,
        },
      },
    });

    if (action === 'checkin') {
      if (existingRecord && existingRecord.checkIn) {
        return NextResponse.json(
          { error: 'Already checked in today' },
          { status: 400, headers: corsHeaders() }
        );
      }

      const now = new Date();
      // Use policy config for late detection instead of hardcoded time
      let isLate = false;
      try {
        const policyConfig = await db.attendancePolicyConfig.findFirst({
          where: { companyId: targetEmployee.companyId },
          select: { shiftStartDefault: true, lateGraceMinutes: true },
        });
        if (policyConfig?.shiftStartDefault) {
          const [shiftH, shiftM] = policyConfig.shiftStartDefault.split(':').map(Number);
          const graceMinutes = policyConfig.lateGraceMinutes || 15;
          const deadlineMinutes = shiftH * 60 + shiftM + graceMinutes;
          const nowMinutes = now.getHours() * 60 + now.getMinutes();
          isLate = nowMinutes > deadlineMinutes;
        } else {
          // Fallback: 9:00 shift + 15 min grace = 9:15
          isLate = now.getHours() > 9 || (now.getHours() === 9 && now.getMinutes() > 15);
        }
      } catch {
        // Fallback if policy config query fails
        isLate = now.getHours() > 9 || (now.getHours() === 9 && now.getMinutes() > 15);
      }

      const attendance = await db.attendance.upsert({
        where: {
          employeeId_date: {
            employeeId,
            date: today,
          },
        },
        create: {
          employeeId,
          date: today,
          checkIn: now,
          status: isLate ? 'late' : 'present',
          location,
        },
        update: {
          checkIn: now,
          status: isLate ? 'late' : 'present',
          location,
        },
      });

      return NextResponse.json(
        { attendance, message: 'Checked in successfully' },
        { status: 201, headers: corsHeaders() }
      );
    } else if (action === 'checkout') {
      if (!existingRecord || !existingRecord.checkIn) {
        return NextResponse.json(
          { error: 'Must check in before checking out' },
          { status: 400, headers: corsHeaders() }
        );
      }

      if (existingRecord.checkOut) {
        return NextResponse.json(
          { error: 'Already checked out today' },
          { status: 400, headers: corsHeaders() }
        );
      }

      const now = new Date();
      const workHours = (now.getTime() - existingRecord.checkIn.getTime()) / (1000 * 60 * 60);
      const overtime = Math.max(0, workHours - 9);

      const attendance = await db.attendance.update({
        where: {
          employeeId_date: {
            employeeId,
            date: today,
          },
        },
        data: {
          checkOut: now,
          workHours: parseFloat(workHours.toFixed(2)),
          overtime: parseFloat(overtime.toFixed(2)),
        },
      });

      return NextResponse.json(
        { attendance, message: 'Checked out successfully' },
        { headers: corsHeaders() }
      );
    } else {
      return NextResponse.json(
        { error: 'Invalid action. Use checkin or checkout' },
        { status: 400, headers: corsHeaders() }
      );
    }
  } catch (error) {
    console.error('Attendance check-in/out error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders() }
    );
  }
}
