import { NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';

function corsHeaders() {
  return { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' };
}
export async function OPTIONS() { return NextResponse.json({}, { headers: corsHeaders() }); }

export async function GET(request: Request) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401, headers: corsHeaders() });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401, headers: corsHeaders() });

    const { searchParams } = new URL(request.url);
    const courses = await db.course.findMany({
      include: { _count: { select: { enrollments: true, modules: true } } },
      orderBy: { createdAt: 'desc' },
      take: parseInt(searchParams.get('limit') || '50'),
    });
    return NextResponse.json({ courses }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Courses GET error:', error);
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
    const { title, description, category, trainer, duration, mode, level, skills, status } = body;
    if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400, headers: corsHeaders() });

    const course = await db.course.create({
      data: { title, description, category, trainer, duration, mode: mode || 'online', level: level || 'beginner', skills, status: status || 'draft' },
    });
    return NextResponse.json({ course }, { status: 201, headers: corsHeaders() });
  } catch (error) {
    console.error('Courses POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}
