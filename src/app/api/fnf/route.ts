import { NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';
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

export async function GET(request: Request) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) {
      return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    }

    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: corsHeaders() });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const employeeId = searchParams.get('employeeId');
    const status = searchParams.get('status');

    const where: Record<string, unknown> = {};
    if (employeeId) where.employeeId = employeeId;
    if (status) where.status = status;

    const [fnfCalculations, total] = await Promise.all([
      db.fNFCalculation.findMany({
        where,
        include: {
          employee: {
            select: {
              id: true, firstName: true, lastName: true, employeeId: true,
              email: true, department: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.fNFCalculation.count({ where }),
    ]);

    return NextResponse.json(
      { fnfCalculations, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } },
      { headers: corsHeaders() }
    );
  } catch (error) {
    console.error('Get FNF calculations error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}

export async function POST(request: Request) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) {
      return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    }

    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: corsHeaders() });
    }

    const body = await request.json();
    const {
      employeeId, separationId, pendingSalary, leaveEncashment,
      bonus, incentives, reimbursements, noticeRecovery, assetRecovery,
      loanRecovery, taxDeduction, otherRecoveries, currency, remarks,
    } = body;

    if (!employeeId) {
      return NextResponse.json(
        { error: 'Missing required field: employeeId' },
        { status: 400, headers: corsHeaders() }
      );
    }

    // Verify employee exists
    const employee = await db.employee.findUnique({ where: { id: employeeId } });
    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404, headers: corsHeaders() });
    }

    // Calculate totals
    const totalEarnings = (pendingSalary ?? 0) + (leaveEncashment ?? 0) + (bonus ?? 0) + (incentives ?? 0) + (reimbursements ?? 0);
    const totalDeductions = (noticeRecovery ?? 0) + (assetRecovery ?? 0) + (loanRecovery ?? 0) + (taxDeduction ?? 0) + (otherRecoveries ?? 0);
    const netAmount = totalEarnings - totalDeductions;

    const fnfCalculation = await db.fNFCalculation.create({
      data: {
        employeeId,
        separationId,
        pendingSalary: pendingSalary ?? 0,
        leaveEncashment: leaveEncashment ?? 0,
        bonus: bonus ?? 0,
        incentives: incentives ?? 0,
        reimbursements: reimbursements ?? 0,
        noticeRecovery: noticeRecovery ?? 0,
        assetRecovery: assetRecovery ?? 0,
        loanRecovery: loanRecovery ?? 0,
        taxDeduction: taxDeduction ?? 0,
        otherRecoveries: otherRecoveries ?? 0,
        totalEarnings,
        totalDeductions,
        netAmount,
        currency: currency || 'INR',
        remarks,
        status: 'pending',
      },
      include: {
        employee: {
          select: { id: true, firstName: true, lastName: true, employeeId: true, email: true },
        },
      },
    });

    // Notify the employee's user if exists
    if (employee.userId) {
      await createNotification({
        tenantId: decoded.tenantId as string,
        userId: employee.userId,
        title: 'FNF Calculation Created',
        message: 'A Full & Final settlement calculation has been initiated for your account.',
        type: 'info',
        category: 'payroll',
        link: `/fnf/${fnfCalculation.id}`,
      });
    }

    await db.auditLog.create({
      data: {
        userId: decoded.userId as string,
        action: 'CREATE_FNF',
        module: 'fnf',
        details: `Created FNF calculation for employee ${employee.employeeId}. Net amount: ${netAmount}`,
      },
    });

    return NextResponse.json({ fnfCalculation }, { status: 201, headers: corsHeaders() });
  } catch (error) {
    console.error('Create FNF calculation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}
