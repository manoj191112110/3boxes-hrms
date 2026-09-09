import { NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';
import { ensureSchemaSynced, withSchemaSync } from '@/lib/schema-sync';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() });
}

// ─── PATCH /api/okrs/key-results/[krId] ───────────────────────────
// Update a key result — typically used to update currentValue (progress).
// Body: { currentValue?, title?, targetValue?, status?, unit? }
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ krId: string }> }
) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401, headers: corsHeaders() });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401, headers: corsHeaders() });

    const { krId } = await params;
    const body = await request.json();
    const data: Record<string, unknown> = {};
    if (body.title !== undefined) data.title = body.title;
    if (body.targetValue !== undefined) data.targetValue = Number(body.targetValue);
    if (body.currentValue !== undefined) data.currentValue = Number(body.currentValue);
    if (body.unit !== undefined) data.unit = body.unit;

    // Auto-compute status based on progress
    if (data.currentValue !== undefined && data.targetValue !== undefined) {
      const pct = (Number(data.currentValue) / Number(data.targetValue)) * 100;
      data.status = pct >= 100 ? 'completed' : pct > 0 ? 'in_progress' : 'not_started';
    } else if (data.currentValue !== undefined) {
      const kr = await db.keyResult.findUnique({ where: { id: krId }, select: { targetValue: true } });
      if (kr) {
        const pct = (Number(data.currentValue) / kr.targetValue) * 100;
        data.status = pct >= 100 ? 'completed' : pct > 0 ? 'in_progress' : 'not_started';
      }
    }

    await ensureSchemaSynced();
    const updated = await withSchemaSync(() =>
      db.keyResult.update({ where: { id: krId }, data })
    );

    return NextResponse.json({ keyResult: updated }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Update key result error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ krId: string }> }
) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401, headers: corsHeaders() });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401, headers: corsHeaders() });

    const { krId } = await params;
    await ensureSchemaSynced();
    await withSchemaSync(() => db.keyResult.delete({ where: { id: krId } }));
    return NextResponse.json({ success: true }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Delete key result error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}
