import { NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';
import { ensureSchemaSynced, withSchemaSync } from '@/lib/schema-sync';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() });
}

// ─── POST /api/okrs/key-results ───────────────────────────────────
// Add a key result to an existing OKR.
// Body: { okrId, title, targetValue?, unit?, currentValue? }
export async function POST(request: Request) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401, headers: corsHeaders() });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401, headers: corsHeaders() });

    const body = await request.json();
    const { okrId, title, targetValue, unit, currentValue } = body;

    if (!okrId || !title) {
      return NextResponse.json({ error: 'okrId and title are required' }, { status: 400, headers: corsHeaders() });
    }

    await ensureSchemaSynced();
    const kr = await withSchemaSync(() =>
      db.keyResult.create({
        data: {
          okrId,
          title,
          targetValue: targetValue ?? 100,
          unit: unit || null,
          currentValue: currentValue ?? 0,
        },
      })
    );

    return NextResponse.json({ keyResult: kr }, { status: 201, headers: corsHeaders() });
  } catch (error) {
    console.error('Create key result error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}
