import { NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';
import { resolveCompanyScope, getEmployeeCompanyFilter } from '@/lib/companyScope';

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
    const token = getTokenFromHeaders(request);
    if (!token) {
      return NextResponse.json(
        { error: 'No token provided' },
        { status: 401, headers: corsHeaders() }
      );
    }

    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401, headers: corsHeaders() }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const employeeId = searchParams.get('employeeId');
    const month = searchParams.get('month');
    const year = searchParams.get('year');
    const status = searchParams.get('status');

    // ─── Company-scoped data visibility ───
    // Non-admin employees should only see their own payroll records.
    // Admins should see payroll records for employees in their selected company.
    const scope = await resolveCompanyScope(request);
    if (!scope) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders() });
    }

    const where: Record<string, unknown> = {};
    if (employeeId) where.employeeId = employeeId;
    if (month) where.month = parseInt(month);
    if (year) where.year = parseInt(year);
    if (status) where.status = status;

    // Apply company scope filter via employee relation
    if (scope.scope === 'self' && scope.userId) {
      where.employee = { userId: scope.userId, status: 'active' };
    } else if (scope.companyId) {
      where.employee = { companyId: scope.companyId, status: 'active' };
    }
    // scope === 'all' with no companyId → admin sees all (no filter)

    const [payrolls, total] = await Promise.all([
      db.payroll.findMany({
        where,
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              employeeId: true,
              salary: true,
              companyId: true,
            },
          },
        },
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.payroll.count({ where }),
    ]);

    return NextResponse.json(
      {
        payrolls,
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
    console.error('Get payroll error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders() }
    );
  }
}

export async function POST(request: Request) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) {
      return NextResponse.json(
        { error: 'No token provided' },
        { status: 401, headers: corsHeaders() }
      );
    }

    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401, headers: corsHeaders() }
      );
    }

    const body = await request.json();
    const { employeeId, month, year } = body;

    if (!employeeId || !month || !year) {
      return NextResponse.json(
        { error: 'Missing required fields: employeeId, month, year' },
        { status: 400, headers: corsHeaders() }
      );
    }

    // Check if payroll already exists for this month/year/employee
    const existingPayroll = await db.payroll.findUnique({
      where: {
        employeeId_month_year: {
          employeeId,
          month,
          year,
        },
      },
    });

    if (existingPayroll) {
      return NextResponse.json(
        { error: 'Payroll already exists for this employee/month/year' },
        { status: 409, headers: corsHeaders() }
      );
    }

    const employee = await db.employee.findUnique({
      where: { id: employeeId },
    });

    if (!employee) {
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404, headers: corsHeaders() }
      );
    }

    const basicSalary = employee.salary || 0;
    const hra = basicSalary * 0.4; // 40% of basic
    const da = basicSalary * 0.1; // 10% of basic
    const conveyance = 1600;
    const medical = 1250;
    const otherAllowances = basicSalary * 0.05;
    const grossSalary = basicSalary + hra + da + conveyance + medical + otherAllowances;

    const pf = basicSalary * 0.12; // 12% of basic
    const esi = grossSalary <= 21000 ? grossSalary * 0.0075 : 0; // 0.75% if gross <= 21000
    const tax = 0; // Placeholder for tax calculation
    const professionalTax = 200;
    const otherDeductions = 0;
    const totalDeductions = pf + esi + tax + professionalTax + otherDeductions;
    const netSalary = grossSalary - totalDeductions;

    const payroll = await db.payroll.create({
      data: {
        employeeId,
        month,
        year,
        basicSalary,
        hra,
        da,
        conveyance,
        medical,
        otherAllowances,
        grossSalary,
        pf,
        esi,
        tax,
        professionalTax,
        otherDeductions,
        totalDeductions,
        netSalary,
        currency: employee.salaryCurrency || 'INR',
        status: 'draft',
      },
      include: {
        employee: {
          select: {
            firstName: true,
            lastName: true,
            employeeId: true,
          },
        },
      },
    });

    await db.auditLog.create({
      data: {
        userId: decoded.userId as string,
        action: 'GENERATE_PAYROLL',
        module: 'payroll',
        details: `Generated payroll for ${payroll.employee.firstName} ${payroll.employee.lastName} - ${month}/${year}`,
      },
    });

    return NextResponse.json(
      { payroll },
      { status: 201, headers: corsHeaders() }
    );
  } catch (error) {
    console.error('Generate payroll error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders() }
    );
  }
}
