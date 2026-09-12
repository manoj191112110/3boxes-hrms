import { NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';

function corsHeaders() {
  return { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' };
}
export async function OPTIONS() { return NextResponse.json({}, { headers: corsHeaders() }); }

export async function GET(request: Request) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401, headers: corsHeaders() });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401, headers: corsHeaders() });

    const feedbacks = await db.feedback.findMany({
      include: {
        from: { select: { id: true, firstName: true, lastName: true, employeeId: true } },
        to: { select: { id: true, firstName: true, lastName: true, employeeId: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return NextResponse.json({ feedbacks }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Feedbacks GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}

export async function POST(request: Request) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401, headers: corsHeaders() });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401, headers: corsHeaders() });

    const body = await request.json();
    const { fromId, toId, type, rating, comments, isAnonymous } = body;
    if (!toId || !comments) return NextResponse.json({ error: 'To employee and comments are required' }, { status: 400, headers: corsHeaders() });

    const feedback = await db.feedback.create({
      data: { fromId: fromId || decoded.userId, toId, type: type || 'peer', rating, comments, isAnonymous: isAnonymous || false },
      include: { from: { select: { firstName: true, lastName: true } }, to: { select: { firstName: true, lastName: true } } },
    });
    return NextResponse.json({ feedback }, { status: 201, headers: corsHeaders() });
  } catch (error) {
    console.error('Feedbacks POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}
