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

    const paths = await db.learningPath.findMany({
      include: { _count: { select: { courses: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return NextResponse.json({ learningPaths: paths }, { headers: corsHeaders() });
  } catch (error) {
    console.error('LearningPaths GET error:', error);
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
    const { title, description, category, level, duration, skills, status, courseIds } = body;
    if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400, headers: corsHeaders() });

    const path = await db.learningPath.create({
      data: {
        title, description, category, level, duration, skills, status: status || 'draft',
        courses: courseIds ? { create: courseIds.map((cId: string, idx: number) => ({ courseId: cId, order: idx })) } : undefined,
      },
      include: { courses: true },
    });
    return NextResponse.json({ learningPath: path }, { status: 201, headers: corsHeaders() });
  } catch (error) {
    console.error('LearningPaths POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}
