import { NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() });
}

/**
 * GET /api/ats/parse-resume/[id]
 * Returns the ResumeParse row (and parsed JSON) for the given parse id.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) {
      return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    }
    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401, headers: corsHeaders() });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400, headers: corsHeaders() });
    }

    const parse = await db.resumeParse.findUnique({ where: { id } });
    if (!parse) {
      return NextResponse.json({ error: 'Parse record not found' }, { status: 404, headers: corsHeaders() });
    }

    let parsedData = null;
    try {
      parsedData = parse.parsedData ? JSON.parse(parse.parsedData) : null;
    } catch {
      parsedData = null;
    }

    return NextResponse.json({ parse, parsedData }, { headers: corsHeaders() });
  } catch (error) {
    console.error('parse-resume/[id] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch parse record' },
      { status: 500, headers: corsHeaders() },
    );
  }
}
