import { NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const db = await getDb(request);
  try {
    const { id } = await params;
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: corsHeaders() });

    const body = await request.json();
    const data: Record<string, unknown> = {};
    if (body.employeeId) data.employeeId = body.employeeId;
    if (body.type) data.type = body.type;
    if (body.reason) data.reason = body.reason;
    if (body.noticePeriod !== undefined) data.noticePeriod = parseInt(body.noticePeriod);
    if (body.lastWorkingDate) data.lastWorkingDate = new Date(body.lastWorkingDate);
    if (body.status) {
      data.status = body.status;
      if (body.status === 'notice_period' || body.status === 'completed') {
        data.approvedBy = decoded.userId as string;
        data.approvedAt = new Date();
      }
    }
    if (body.exitInterview !== undefined) data.exitInterview = body.exitInterview;
    if (body.settlementAmount !== undefined) data.settlementAmount = parseFloat(body.settlementAmount);

    const separation = await db.separation.update({
      where: { id },
      data,
      include: { employee: { select: { firstName: true, lastName: true, employeeId: true } } },
    });

    return NextResponse.json({ separation }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Update separation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const db = await getDb(request);
  try {
    const { id } = await params;
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: corsHeaders() });

    const body = await request.json();
    const data: Record<string, unknown> = {};
    if (body.status) {
      data.status = body.status;
      if (body.status === 'notice_period' || body.status === 'completed') {
        data.approvedBy = decoded.userId as string;
        data.approvedAt = new Date();
      }
    }

    const separation = await db.separation.update({
      where: { id },
      data,
      include: { employee: { select: { firstName: true, lastName: true, employeeId: true } } },
    });

    return NextResponse.json({ separation }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Update separation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const db = await getDb(request);
  try {
    const { id } = await params;
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: corsHeaders() });

    await db.separation.delete({ where: { id } });

    return NextResponse.json({ message: 'Separation deleted successfully' }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Delete separation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}
