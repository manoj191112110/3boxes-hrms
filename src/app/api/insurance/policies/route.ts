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
    const policies = await db.insurancePolicy.findMany({ where, include: { _count: { select: { claims: true } } }, orderBy: { createdAt: 'desc' } });
    return NextResponse.json({ policies }, { headers: corsHeaders() });
  } catch (error) { console.error('Get policies error:', error); return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() }); }
}

export async function POST(request: Request) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: corsHeaders() });

    const body = await request.json();
    const { employeeId, policyType, providerName, policyNumber, coverageAmount, premiumAmount, premiumCurrency, paymentMode, deductionFrequency, startDate, endDate, dependents } = body;
    if (!employeeId || !policyType || !providerName || !coverageAmount) return NextResponse.json({ error: 'Missing fields' }, { status: 400, headers: corsHeaders() });
    const policy = await db.insurancePolicy.create({
      data: { employeeId, policyType, providerName, policyNumber, coverageAmount, premiumAmount: premiumAmount || 0, premiumCurrency: premiumCurrency || 'INR', paymentMode: paymentMode || 'payroll_deduction', deductionFrequency: deductionFrequency || 'monthly', startDate: new Date(startDate), endDate: endDate ? new Date(endDate) : null, dependentsJson: dependents || null },
    });
    return NextResponse.json({ policy }, { status: 201, headers: corsHeaders() });
  } catch (error) { console.error('Create policy error:', error); return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() }); }
}
