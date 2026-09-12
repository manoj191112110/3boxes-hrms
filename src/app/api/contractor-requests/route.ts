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
    const projectId = searchParams.get('projectId');
    const vendorId = searchParams.get('vendorId');
    const status = searchParams.get('status');
    const where: Record<string, unknown> = {};
    if (projectId) where.projectId = projectId;
    if (vendorId) where.vendorId = vendorId;
    if (status) where.status = status;
    const requests = await db.contractorRequest.findMany({
      where: where as any,
      include: { project: { select: { id: true, name: true } }, vendor: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ requests }, { headers: corsHeaders() });
  } catch (error) { console.error('Get contractor requests error:', error); return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() }); }
}

export async function POST(request: Request) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: corsHeaders() });

    const body = await request.json();
    const { projectId, vendorId, role, skillTags, headcount, billRateMax, currency, startDate, durationDays, notes } = body;
    if (!projectId || !role) return NextResponse.json({ error: 'Missing projectId or role' }, { status: 400, headers: corsHeaders() });
    const cr = await db.contractorRequest.create({
      data: { projectId, vendorId, role, skillTags, headcount: headcount || 1, billRateMax, currency: currency || 'INR', startDate: startDate ? new Date(startDate) : null, durationDays, notes: notes ?? null, requestedById: decoded.userId as string as string },
    });
    return NextResponse.json({ request: cr }, { status: 201, headers: corsHeaders() });
  } catch (error) { console.error('Create contractor request error:', error); return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() }); }
}
