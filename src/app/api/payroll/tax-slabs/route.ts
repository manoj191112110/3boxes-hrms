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
    const countryCode = searchParams.get('countryCode');
    const taxYear = searchParams.get('taxYear');

    const where: Record<string, unknown> = {};
    if (countryCode) where.countryCode = countryCode;
    if (taxYear) where.taxYear = taxYear;

    const data = await db.taxSlabTable.findMany({
      where,
      include: { rateLines: { orderBy: { sequence: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });

    return Response.json({ data }, { headers: corsHeaders });
  } catch (error: unknown) {
    console.error('Error fetching tax slabs:', error);
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
    const { rateLines, ...slabData } = body;

    const data = await db.taxSlabTable.create({
      data: {
        ...slabData,
        rateLines: rateLines
          ? { create: rateLines }
          : undefined,
      },
      include: { rateLines: { orderBy: { sequence: 'asc' } } },
    });

    return Response.json({ data, message: 'Tax slab table created successfully' }, { headers: corsHeaders });
  } catch (error: unknown) {
    console.error('Error creating tax slab table:', error);
    return Response.json({ error: (error instanceof Error ? error.message : String(error)) }, { status: 500, headers: corsHeaders });
  }
}
