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
    const companyId = searchParams.get('companyId');
    const status = searchParams.get('status');
    const countryCode = searchParams.get('countryCode');
    const payFrequency = searchParams.get('payFrequency');

    const where: Record<string, unknown> = {};
    if (companyId) where.companyId = companyId;
    if (status) where.status = status;
    if (countryCode) where.countryCode = countryCode;
    if (payFrequency) where.payFrequency = payFrequency;

    try {
      const data = await db.payrollDefinition.findMany({
        where,
        orderBy: { createdAt: 'desc' },
      });

      return Response.json({ data }, { headers: corsHeaders });
    } catch (dbError: unknown) {
      console.error('Database error fetching payroll definitions:', dbError);
      return Response.json({ data: [] }, { headers: corsHeaders });
    }
  } catch (error: unknown) {
    console.error('Error fetching payroll definitions:', error);
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

    try {
      const data = await db.payrollDefinition.create({ data: body });

      return Response.json({ data, message: 'Payroll definition created successfully' }, { headers: corsHeaders });
    } catch (dbError: unknown) {
      console.error('Database error creating payroll definition:', dbError);
      return Response.json({ error: 'Service temporarily unavailable' }, { status: 503, headers: corsHeaders });
    }
  } catch (error: unknown) {
    console.error('Error creating payroll definition:', error);
    return Response.json({ error: (error instanceof Error ? error.message : String(error)) }, { status: 500, headers: corsHeaders });
  }
}
