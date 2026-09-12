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
    const contacts = await db.clientContact.findMany({ where: { clientId: id }, orderBy: { createdAt: 'desc' } });
    return NextResponse.json({ contacts }, { headers: corsHeaders() });
  } catch (error) { console.error('Get client contacts error:', error); return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() }); }
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
    const { name, email, phone, role, preferredLanguage, isPrimary } = body;
    if (!name) return NextResponse.json({ error: 'Missing name' }, { status: 400, headers: corsHeaders() });
    const contact = await db.clientContact.create({ data: { clientId: id, name, email, phone, role, preferredLanguage: preferredLanguage || 'en', isPrimary: !!isPrimary } });
    return NextResponse.json({ contact }, { status: 201, headers: corsHeaders() });
  } catch (error) { console.error('Create client contact error:', error); return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() }); }
}
