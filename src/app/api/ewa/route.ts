import { NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';

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
    if (!token) return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: corsHeaders() });

    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employeeId');
    const where: Record<string, unknown> = {};
    if (employeeId) where.employeeId = employeeId;
    const requests = await db.eWARequest.findMany({ where, orderBy: { createdAt: 'desc' }, take: 50 });
    return NextResponse.json({ requests }, { headers: corsHeaders() });
  } catch (error) { console.error('Get EWA error:', error); return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() }); }
}

export async function POST(request: Request) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: corsHeaders() });

    const body = await request.json();
    const { employeeId, providerName, requestedAmount } = body;
    if (!employeeId || !requestedAmount) return NextResponse.json({ error: 'Missing fields' }, { status: 400, headers: corsHeaders() });

    // Compute earned-to-date (current month): daily salary × days attended
    const employee = await db.employee.findUnique({ select: { salary: true, salaryCurrency: true, dateOfJoining: true }, where: { id: employeeId } });
    if (!employee || !employee.salary) return NextResponse.json({ error: 'Employee salary not configured' }, { status: 400, headers: corsHeaders() });
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const dayOfMonth = now.getDate();
    const dailySalary = employee.salary / daysInMonth;

    const attendances = await db.attendance.findMany({ where: { employeeId, date: { gte: monthStart, lte: now } }, select: { status: true } });
    const presentDays = attendances.filter(a => ['present', 'late', 'wfh'].includes(a.status)).length;
    const earnedToDate = dailySalary * presentDays;
    const maxWithdrawable = earnedToDate * 0.7; // 70% cap

    if (requestedAmount > maxWithdrawable) return NextResponse.json({ error: `Exceeds 70% of earned-to-date (${maxWithdrawable.toFixed(2)} ${employee.salaryCurrency || 'INR'})` }, { status: 400, headers: corsHeaders() });

    const feeAmount = requestedAmount * 0.02; // 2% fee
    const req = await db.eWARequest.create({
      data: { employeeId, providerName: providerName || 'Wagestream', requestedAmount, earnedToDate, feeAmount, currency: employee.salaryCurrency || 'INR', status: 'approved', transferredAt: new Date() },
    });
    return NextResponse.json({ request: req, earnedToDate, maxWithdrawable, feeAmount }, { status: 201, headers: corsHeaders() });
  } catch (error) { console.error('Create EWA error:', error); return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() }); }
}
