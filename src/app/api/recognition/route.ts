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
    const employeeId = searchParams.get('employeeId');
    const where: Record<string, unknown> = {};
    if (employeeId) where.employeeId = employeeId;
    const ledger = await db.rewardPointsLedger.findMany({ where, orderBy: { createdAt: 'desc' }, take: 50 });
    // Aggregate balance
    const balance = ledger.length > 0 ? ledger[0].balanceAfter : 0;
    return NextResponse.json({ ledger, balance }, { headers: corsHeaders() });
  } catch (error) { console.error('Get recognition error:', error); return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() }); }
}

export async function POST(request: Request) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: corsHeaders() });

    const body = await request.json();
    const { fromId, toId, points, message } = body;
    if (!fromId || !toId || !points) return NextResponse.json({ error: 'Missing fields' }, { status: 400, headers: corsHeaders() });
    if (fromId === toId) return NextResponse.json({ error: 'Cannot give kudos to yourself' }, { status: 400, headers: corsHeaders() });
    if (points > 100) return NextResponse.json({ error: 'Max 100 points per kudos' }, { status: 400, headers: corsHeaders() });

    // Get recipient's current balance
    const lastEntry = await db.rewardPointsLedger.findFirst({ where: { employeeId: toId }, orderBy: { createdAt: 'desc' } });
    const newBalance = (lastEntry?.balanceAfter || 0) + points;

    const entry = await db.rewardPointsLedger.create({
      data: { employeeId: toId, type: 'earn', points, balanceAfter: newBalance, source: 'p2p_kudos', referenceId: fromId },
    });

    // Credit to recipient's kudos wallet bucket
    let wallet = await db.wallet.findFirst({ where: { employeeId: toId, currency: 'INR' } });
    if (!wallet) wallet = await db.wallet.create({ data: { employeeId: toId, currency: 'INR' } });
    let kudosBucket = await db.walletBucket.findFirst({ where: { walletId: wallet.id, category: 'kudos' } });
    if (!kudosBucket) kudosBucket = await db.walletBucket.create({ data: { walletId: wallet.id, category: 'kudos', balance: 0, employerCoPayPct: 100 } });
    await db.$transaction([
      db.walletBucket.update({ where: { id: kudosBucket.id }, data: { balance: { increment: points } } }),
      db.walletTransaction.create({ data: { walletId: wallet.id, bucketId: kudosBucket.id, type: 'credit', amount: points, currency: 'INR', baseAmount: points, reference: entry.id, description: `Kudos from ${fromId}: ${message || ''}` } }),
    ]);
    return NextResponse.json({ entry, newBalance }, { status: 201, headers: corsHeaders() });
  } catch (error) { console.error('Give kudos error:', error); return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() }); }
}
