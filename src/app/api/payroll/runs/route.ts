import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { getTokenFromHeaders, verifyToken } from '@/lib/auth';
import { isSuperAdminWithoutScope } from '@/lib/superAdminGuard';
import { NextRequest } from 'next/server';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function GET(request: NextRequest) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    const decoded = await verifyToken(token);
    if (!decoded) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });

    const { searchParams } = new URL(request.url);
    const runStatus = searchParams.get('runStatus');
    const payrollPeriod = searchParams.get('payrollPeriod');
    const companyId = searchParams.get('companyId');
    const tenantId = searchParams.get('tenantId');

    // ─── GOLDEN RULE: No dummy/seed data on LIVE for super_admin ───
    if (isSuperAdminWithoutScope(decoded, companyId, tenantId, request)) {
      return Response.json({ data: [] }, { headers: corsHeaders });
    }

    const where: Record<string, unknown> = {};
    if (runStatus) where.runStatus = runStatus;
    if (payrollPeriod) where.payrollPeriod = payrollPeriod;
    if (companyId) where.companyId = companyId;

    let data;
    try {
      data = await db.payrollRun.findMany({
        where,
        orderBy: { createdAt: 'desc' },
      });
    } catch (dbError: unknown) {
      console.error('PayrollRun table not available:', dbError);
      data = [];
    }

    return Response.json({ data }, { headers: corsHeaders });
  } catch (error: unknown) {
    console.error('Error fetching payroll runs:', error);
    return Response.json({ error: (error instanceof Error ? error.message : String(error)) }, { status: 500, headers: corsHeaders });
  }
}

export async function POST(request: NextRequest) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    const decoded = await verifyToken(token);
    if (!decoded) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });

    const body = await request.json();
    // Convert date strings to Date objects for Prisma
    const data = {
      ...body,
      periodStartDate: body.periodStartDate ? new Date(body.periodStartDate) : undefined,
      periodEndDate: body.periodEndDate ? new Date(body.periodEndDate) : undefined,
      payDate: body.payDate ? new Date(body.payDate) : undefined,
      exchangeRateDate: body.exchangeRateDate ? new Date(body.exchangeRateDate) : undefined,
    };
    let result;
    try {
      result = await db.payrollRun.create({ data });
    } catch (dbError: unknown) {
      const errMsg = dbError instanceof Error ? dbError.message : String(dbError);
      console.error('PayrollRun create error:', errMsg);
      return Response.json({ error: `Failed to create payroll run: ${errMsg.substring(0, 200)}` }, { status: 503, headers: corsHeaders });
    }

    return Response.json({ data: result, message: 'Payroll run created successfully' }, { headers: corsHeaders });
  } catch (error: unknown) {
    console.error('Error creating payroll run:', error);
    return Response.json({ error: (error instanceof Error ? error.message : String(error)) }, { status: 500, headers: corsHeaders });
  }
}
