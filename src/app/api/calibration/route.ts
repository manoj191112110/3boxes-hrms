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

    const sessions = await db.calibrationSession.findMany({ orderBy: { createdAt: 'desc' }, take: 50 });
    return NextResponse.json({ sessions }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Calibration GET error:', error);
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
    const { title, departmentId, reviewCycle, facilitator, participants, notes, sessionDate } = body;
    if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400, headers: corsHeaders() });

    const session = await db.calibrationSession.create({
      data: { title, departmentId, reviewCycle: reviewCycle || 'Q1 2026', facilitator, participants, notes, sessionDate: sessionDate ? new Date(sessionDate) : null },
    });
    return NextResponse.json({ session }, { status: 201, headers: corsHeaders() });
  } catch (error) {
    console.error('Calibration POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}
