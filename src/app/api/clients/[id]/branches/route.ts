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

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: corsHeaders() });

    const { id } = await params;
    const branches = await db.clientBranch.findMany({
      where: { clientId: id },
      include: { company: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ branches }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Get client branches error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: corsHeaders() });

    const { id } = await params;
    const body = await request.json();
    const { name, companyId, country, billingCurrency, paymentTerms, taxId } = body;
    if (!name || !companyId) return NextResponse.json({ error: 'Missing name or companyId' }, { status: 400, headers: corsHeaders() });
    const branch = await db.clientBranch.create({
      data: { clientId: id, name, companyId, country, billingCurrency: billingCurrency || 'INR', paymentTerms: paymentTerms || 'net_30', taxId },
    });
    await db.auditLog.create({ data: { userId: decoded.userId as string, action: 'CREATE_CLIENT_BRANCH', module: 'clients', details: `Created branch ${name} for client ${id}` } });
    return NextResponse.json({ branch }, { status: 201, headers: corsHeaders() });
  } catch (error) {
    console.error('Create client branch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}
