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

export async function GET(request: Request) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: corsHeaders() });

    const { searchParams } = new URL(request.url);
    const recipientId = searchParams.get('recipientId');
    const triggerEvent = searchParams.get('trigger');
    const where: Record<string, unknown> = {};
    if (recipientId) where.recipientId = recipientId;
    if (triggerEvent) where.triggerEvent = triggerEvent;
    const gifts = await db.gift.findMany({ where, include: { product: { select: { id: true, name: true, imageUrl: true } }, recipient: { select: { id: true, firstName: true, lastName: true } } }, orderBy: { createdAt: 'desc' }, take: 50 });
    return NextResponse.json({ gifts }, { headers: corsHeaders() });
  } catch (error) { console.error('Get gifts error:', error); return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() }); }
}

export async function POST(request: Request) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: corsHeaders() });

    const body = await request.json();
    const { recipientId, senderId, triggerEvent, productId, voucherCode, message, value, currency } = body;
    if (!recipientId || !triggerEvent) return NextResponse.json({ error: 'Missing fields' }, { status: 400, headers: corsHeaders() });
    const gift = await db.gift.create({
      data: { recipientId, senderId: senderId || decoded.userId, triggerEvent, productId, voucherCode, message, value: value || 0, currency: currency || 'INR' },
    });
    return NextResponse.json({ gift }, { status: 201, headers: corsHeaders() });
  } catch (error) { console.error('Create gift error:', error); return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() }); }
}
