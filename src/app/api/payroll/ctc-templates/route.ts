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
    const status = searchParams.get('status');
    const companyId = searchParams.get('companyId');

    const where: Record<string, unknown> = {};
    if (countryCode) where.countryCode = countryCode;
    if (status) where.status = status;
    if (companyId) where.companyId = companyId;

    const data = await db.cTCTemplate.findMany({
      where,
      include: { componentMappings: { orderBy: { calculationSequence: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });

    return Response.json({ data }, { headers: corsHeaders });
  } catch (error: unknown) {
    console.error('Error fetching CTC templates:', error);
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
    const { componentMappings, ...templateData } = body;

    const data = await db.cTCTemplate.create({
      data: {
        ...templateData,
        createdBy: decoded.userId as string,
        componentMappings: componentMappings
          ? { create: componentMappings }
          : undefined,
      },
      include: { componentMappings: { orderBy: { calculationSequence: 'asc' } } },
    });

    return Response.json({ data, message: 'CTC template created successfully' }, { headers: corsHeaders });
  } catch (error: unknown) {
    console.error('Error creating CTC template:', error);
    return Response.json({ error: (error instanceof Error ? error.message : String(error)) }, { status: 500, headers: corsHeaders });
  }
}
