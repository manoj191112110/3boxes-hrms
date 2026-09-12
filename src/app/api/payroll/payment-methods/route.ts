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
    const paymentType = searchParams.get('paymentType');
    const isPrimary = searchParams.get('isPrimary');

    const where: Record<string, unknown> = {};
    if (employeeId) where.employeeId = employeeId;
    if (status) where.status = status;
    if (paymentType) where.paymentType = paymentType;
    if (isPrimary !== null && isPrimary !== undefined) where.isPrimary = isPrimary === 'true';

    try {
      const data = await db.employeePaymentMethod.findMany({
        where,
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              employeeId: true,
              email: true,
            },
          },
        },
        orderBy: [{ isPrimary: 'desc' }, { priority: 'asc' }],
      });

      return Response.json({ data }, { headers: corsHeaders });
    } catch (dbError: unknown) {
      console.error('Database error fetching employee payment methods:', dbError);
      return Response.json({ data: [] }, { headers: corsHeaders });
    }
  } catch (error: unknown) {
    console.error('Error fetching employee payment methods:', error);
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

    // If this is set as primary, unset other primary methods for the same employee
    if (body.isPrimary && body.employeeId) {
      try {
        await db.employeePaymentMethod.updateMany({
          where: { employeeId: body.employeeId, isPrimary: true },
          data: { isPrimary: false },
        });
      } catch (dbError: unknown) {
        console.error('Database error clearing primary payment methods:', dbError);
        // Continue with creation even if clearing primary fails
      }
    }

    try {
      const data = await db.employeePaymentMethod.create({ data: body });

      return Response.json({ data, message: 'Employee payment method created successfully' }, { headers: corsHeaders });
    } catch (dbError: unknown) {
      console.error('Database error creating employee payment method:', dbError);
      return Response.json({ error: 'Service temporarily unavailable' }, { status: 503, headers: corsHeaders });
    }
  } catch (error: unknown) {
    console.error('Error creating employee payment method:', error);
    return Response.json({ error: (error instanceof Error ? error.message : String(error)) }, { status: 500, headers: corsHeaders });
  }
}
