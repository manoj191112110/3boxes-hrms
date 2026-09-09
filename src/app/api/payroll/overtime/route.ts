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
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    const where: Record<string, unknown> = {};
    if (employeeId) where.employeeId = employeeId;
    if (status) where.status = status;
    if (dateFrom || dateTo) {
      where.date = {
        ...(dateFrom && { gte: new Date(dateFrom) }),
        ...(dateTo && { lte: new Date(dateTo) }),
      };
    }

    try {
      const data = await db.overtimeRecord.findMany({
        where,
        include: {
          employee: {
            select: { id: true, employeeId: true, firstName: true, lastName: true, email: true, salary: true },
          },
        },
        orderBy: { date: 'desc' },
      });

      return Response.json({ data }, { headers: corsHeaders });
    } catch (dbError: unknown) {
      console.error('Database error fetching overtime records:', dbError);
      return Response.json({ data: [] }, { headers: corsHeaders });
    }
  } catch (error: unknown) {
    console.error('Error fetching overtime records:', error);
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

    // Validate required fields
    if (!body.employeeId) return Response.json({ error: 'Employee ID is required' }, { status: 400, headers: corsHeaders });
    if (!body.date) return Response.json({ error: 'Date is required' }, { status: 400, headers: corsHeaders });
    if (!body.hours || body.hours <= 0) return Response.json({ error: 'Hours must be greater than 0' }, { status: 400, headers: corsHeaders });

    const hours = parseFloat(body.hours);
    const rateType = body.rateType || 'FLAT';
    const rate = parseFloat(body.rate) || 0;

    // Calculate amount based on rateType
    let amount = 0;
    if (rateType === 'FLAT') {
      amount = rate; // Flat amount
    } else if (rateType === 'HOURLY_RATE') {
      amount = hours * rate;
    } else if (rateType === 'PERCENTAGE_OF_BASIC') {
      // Need to get employee salary for percentage calculation
      try {
        const employee = await db.employee.findUnique({
          where: { employeeId: body.employeeId },
          select: { salary: true },
        });
        const basicSalary = employee?.salary || 0;
        amount = (basicSalary * rate) / 100;
      } catch (dbError: unknown) {
        console.error('Database error fetching employee salary for overtime:', dbError);
        amount = 0;
      }
    }

    amount = Math.round(amount * 100) / 100;

    // If amount is provided explicitly, use that instead
    if (body.amount !== undefined && body.amount !== null) {
      amount = parseFloat(body.amount);
    }

    try {
      const data = await db.overtimeRecord.create({
        data: {
          employeeId: body.employeeId,
          date: new Date(body.date),
          hours,
          rateType,
          rate,
          amount,
          reason: body.reason || null,
          project: body.project || null,
          status: body.status || 'pending',
        },
      });

      return Response.json({ data, message: 'Overtime record created successfully' }, { headers: corsHeaders });
    } catch (dbError: unknown) {
      console.error('Database error creating overtime record:', dbError);
      return Response.json({ error: 'Service temporarily unavailable' }, { status: 503, headers: corsHeaders });
    }
  } catch (error: unknown) {
    console.error('Error creating overtime record:', error);
    return Response.json({ error: (error instanceof Error ? error.message : String(error)) }, { status: 500, headers: corsHeaders });
  }
}
