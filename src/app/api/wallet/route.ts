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
    if (!employeeId) return NextResponse.json({ error: 'Missing employeeId' }, { status: 400, headers: corsHeaders() });
    let wallet: any = await db.wallet.findFirst({
      where: { employeeId, currency: 'INR' },
      include: { buckets: { include: { _count: { select: { transactions: true } } } }, transactions: { orderBy: { createdAt: 'desc' }, take: 20 } },
    });
    if (!wallet) {
      // Auto-create wallet with default buckets
      wallet = await db.wallet.create({
        data: {
          employeeId, currency: 'INR',
          buckets: { create: [
            { category: 'meal_allowance', balance: 0, employerCoPayPct: 100 },
            { category: 'learning_development', balance: 0, employerCoPayPct: 80 },
            { category: 'wellness', balance: 0, employerCoPayPct: 100 },
            { category: 'general_rewards', balance: 0, employerCoPayPct: 100 },
            { category: 'kudos', balance: 0, employerCoPayPct: 100 },
          ] },
        },
        include: { buckets: true, transactions: true },
      });
    }
    return NextResponse.json({ wallet }, { headers: corsHeaders() });
  } catch (error) { console.error('Get wallet error:', error); return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() }); }
}

export async function POST(request: Request) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: corsHeaders() });

    // Top-up or debit a bucket (admin only)
    const body = await request.json();
    const { employeeId, bucketId, type, amount, description, reference } = body;
    if (!employeeId || !bucketId || !type || !amount) return NextResponse.json({ error: 'Missing fields' }, { status: 400, headers: corsHeaders() });
    let wallet: any = await db.wallet.findFirst({ where: { employeeId, currency: 'INR' } });
    if (!wallet) {
      wallet = await db.wallet.create({ data: { employeeId, currency: 'INR' } });
    }
    const bucket = await db.walletBucket.findUnique({ where: { id: bucketId } });
    if (!bucket || !bucket.walletId || bucket.walletId !== wallet.id) return NextResponse.json({ error: 'Invalid bucket' }, { status: 400, headers: corsHeaders() });

    const newBalance = type === 'credit' ? bucket.balance + amount : type === 'debit' ? bucket.balance - amount : bucket.balance;
    if (newBalance < 0) return NextResponse.json({ error: 'Insufficient balance' }, { status: 400, headers: corsHeaders() });

    const [updatedBucket, txn] = await db.$transaction([
      db.walletBucket.update({ where: { id: bucketId }, data: { balance: newBalance } }),
      db.walletTransaction.create({ data: { walletId: wallet.id, bucketId, type, amount, currency: wallet.currency, baseAmount: amount, reference, description, initiatedById: decoded.userId as string } }),
    ]);
    return NextResponse.json({ bucket: updatedBucket, transaction: txn }, { headers: corsHeaders() });
  } catch (error) { console.error('Wallet op error:', error); return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() }); }
}
