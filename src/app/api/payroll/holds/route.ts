import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { getTokenFromHeaders, verifyToken } from '@/lib/auth';
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
    const employeeId = searchParams.get('employeeId');
    const status = searchParams.get('status');

    const where: Record<string, unknown> = {};
    if (employeeId) where.employeeId = employeeId;
    if (status) where.status = status;

    let data;
    try {
      data = await db.payrollHold.findMany({
        where,
        include: {
          employee: {
            select: {
              id: true,
              employeeId: true,
              firstName: true,
              lastName: true,
              email: true,
              department: { select: { name: true } },
              designation: { select: { title: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    } catch (dbError: unknown) {
      console.error('Database error fetching payroll holds:', dbError);
      return Response.json({ data: [] }, { headers: corsHeaders });
    }

    return Response.json({ data }, { headers: corsHeaders });
  } catch (error: unknown) {
    console.error('Error fetching payroll holds:', error);
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

    if (!body.employeeId) {
      return Response.json({ error: 'Employee ID is required' }, { status: 400, headers: corsHeaders });
    }
    if (!body.holdType) {
      return Response.json({ error: 'Hold type is required' }, { status: 400, headers: corsHeaders });
    }
    if (!body.reason) {
      return Response.json({ error: 'Reason is required' }, { status: 400, headers: corsHeaders });
    }
    if (!body.holdFromPeriod) {
      return Response.json({ error: 'Hold from period is required' }, { status: 400, headers: corsHeaders });
    }

    try {
      const data = await db.payrollHold.create({
        data: {
          employeeId: body.employeeId,
          holdType: body.holdType,
          reason: body.reason,
          holdFromPeriod: body.holdFromPeriod,
          holdToPeriod: body.holdToPeriod || null,
          heldComponents: body.heldComponents || null,
          status: 'active',
          createdBy: decoded.userId as string,
        },
      });

      return Response.json({ data, message: 'Payroll hold created successfully' }, { headers: corsHeaders });
    } catch (dbError: unknown) {
      console.error('Database error creating payroll hold:', dbError);
      return Response.json({ error: 'Service temporarily unavailable' }, { status: 503, headers: corsHeaders });
    }
  } catch (error: unknown) {
    console.error('Error creating payroll hold:', error);
    return Response.json({ error: (error instanceof Error ? error.message : String(error)) }, { status: 500, headers: corsHeaders });
  }
}
