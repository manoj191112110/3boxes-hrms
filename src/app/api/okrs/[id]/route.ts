import { NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';
import { ensureSchemaSynced, withSchemaSync } from '@/lib/schema-sync';

function corsHeaders() {
  return { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' };
}
export async function OPTIONS() { return NextResponse.json({}, { headers: corsHeaders() }); }

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401, headers: corsHeaders() });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401, headers: corsHeaders() });
    const { id } = await params;
    await ensureSchemaSynced();
    const okr = await withSchemaSync(() =>
      db.oKR.findUnique({
        where: { id },
        include: { owner: { select: { firstName: true, lastName: true } }, keyResults: true, childOkrs: { include: { keyResults: true } } },
      })
    );
    if (!okr) return NextResponse.json({ error: 'Not found' }, { status: 404, headers: corsHeaders() });
    return NextResponse.json({ okr }, { headers: corsHeaders() });
  } catch (error) {
    console.error('OKR GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401, headers: corsHeaders() });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401, headers: corsHeaders() });
    const { id } = await params;
    const body = await request.json();
    await ensureSchemaSynced();
    const okr = await withSchemaSync(() => db.oKR.update({ where: { id }, data: body, include: { keyResults: true } }));
    return NextResponse.json({ okr }, { headers: corsHeaders() });
  } catch (error) {
    console.error('OKR PUT error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401, headers: corsHeaders() });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401, headers: corsHeaders() });
    const { id } = await params;
    await ensureSchemaSynced();
    await withSchemaSync(() => db.oKR.delete({ where: { id } }));
    return NextResponse.json({ success: true }, { headers: corsHeaders() });
  } catch (error) {
    console.error('OKR DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}
