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
    const orders = await db.marketplaceOrder.findMany({
      where: where as any,
      include: { product: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return NextResponse.json({ orders }, { headers: corsHeaders() });
  } catch (error) { console.error('Get orders error:', error); return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() }); }
}

export async function POST(request: Request) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: corsHeaders() });

    const body = await request.json();
    const { employeeId, productId, qty, walletBucketId } = body;
    if (!employeeId || !productId) return NextResponse.json({ error: 'Missing fields' }, { status: 400, headers: corsHeaders() });

    const product = await db.marketplaceProduct.findUnique({ where: { id: productId } });
    if (!product || product.status !== 'active') return NextResponse.json({ error: 'Product unavailable' }, { status: 400, headers: corsHeaders() });

    // REQ-SEC-MKT-05: age verification for restricted products (e.g., wine, tobacco-adjacent, certain insurance)
    if (product.ageRestricted && product.minAge) {
      const employee = await db.employee.findUnique({
        where: { id: employeeId },
        select: { dateOfBirth: true, firstName: true, lastName: true },
      });
      if (!employee?.dateOfBirth) {
        return NextResponse.json({ error: `Cannot verify age — date of birth missing on employee profile. Required for restricted product: ${product.name}` }, { status: 403, headers: corsHeaders() });
      }
      const ageMs = Date.now() - employee.dateOfBirth.getTime();
      const ageYears = Math.floor(ageMs / (365.25 * 24 * 60 * 60 * 1000));
      if (ageYears < product.minAge) {
        await db.auditLog.create({
          data: {
            userId: (decoded as any).userId as string,
            action: 'AGE_GATE_BLOCK',
            module: 'marketplace',
            details: `Blocked underage order: employee ${employeeId} (age ${ageYears}) attempted to buy ${product.name} (minAge ${product.minAge})`,
          },
        });
        return NextResponse.json({ error: `Age verification failed. This product requires age ${product.minAge}+. Employee age: ${ageYears}.` }, { status: 403, headers: corsHeaders() });
      }
    }

    const quantity = qty || 1;
    const totalAmount = product.corporatePrice * quantity;

    // Validate bucket
    if (!walletBucketId) return NextResponse.json({ error: 'Wallet bucket required' }, { status: 400, headers: corsHeaders() });
    const bucket = await db.walletBucket.findUnique({ where: { id: walletBucketId } });
    if (!bucket) return NextResponse.json({ error: 'Invalid bucket' }, { status: 400, headers: corsHeaders() });
    const allowedBuckets = product.allowedBuckets.split(',').map(s => s.trim());
    if (!allowedBuckets.includes(bucket.category)) return NextResponse.json({ error: `Product cannot be bought with ${bucket.category} bucket (REQ-MKT-03)` }, { status: 400, headers: corsHeaders() });
    if (bucket.balance < totalAmount) return NextResponse.json({ error: 'Insufficient balance' }, { status: 400, headers: corsHeaders() });

    // Quarterly quantity limit (REQ-SEC-MKT-04)
    if (product.quantityLimitPerQuarter > 0) {
      const quarterStart = new Date(); quarterStart.setMonth(Math.floor(quarterStart.getMonth() / 3) * 3, 1); quarterStart.setHours(0, 0, 0, 0);
      const quarterCount = await db.marketplaceOrder.count({ where: { employeeId, productId, createdAt: { gte: quarterStart }, status: { not: 'cancelled' } } });
      if (quarterCount + quantity > product.quantityLimitPerQuarter) return NextResponse.json({ error: 'Quarterly quantity limit exceeded (anti-arbitrage)' }, { status: 400, headers: corsHeaders() });
    }

    // Velocity fraud check (REQ-AI-MKT-02)
    const oneMinuteAgo = new Date(Date.now() - 60000);
    const recentOrders = await db.marketplaceOrder.count({ where: { employeeId, createdAt: { gte: oneMinuteAgo } } });
    let blockedByFraud = false;
    let fraudReason = null;
    if (recentOrders >= 3) { blockedByFraud = true; fraudReason = 'velocity'; }
    if (totalAmount > 50000) { blockedByFraud = true; fraudReason = 'bulk_high_value'; }

    if (blockedByFraud) {
      await db.marketplaceFraudFlag.create({ data: { employeeId, reason: fraudReason!, riskScore: 0.9, mfaTriggered: true } });
      return NextResponse.json({ error: 'Order blocked by fraud detection. MFA required.', fraudReason }, { status: 403, headers: corsHeaders() });
    }

    // Co-pay split
    const employerPct = bucket.employerCoPayPct;
    const employerPaid = totalAmount * (employerPct / 100);
    const employeePaid = totalAmount - employerPaid;

    // Create order + debit wallet + record transaction atomically
    // REQ-SEC-MKT-03: append to wallet hash chain for immutability
    const now = new Date();
    const order = await db.marketplaceOrder.create({
      data: { employeeId, productId, qty: quantity, unitPrice: product.corporatePrice, totalAmount, currency: product.currency, walletBucketId: bucket.id!, employerCoPayPct: employerPct, employerPaidAmount: employerPaid, employeePaidAmount: employeePaid, fulfillmentStatus: 'fulfilled', fulfillmentRef: `CODE-${Date.now()}`, status: 'completed' },
    });
    const txRecord = await db.walletTransaction.create({
      data: { walletId: bucket.walletId, bucketId: bucket.id, type: 'debit', amount: totalAmount, currency: product.currency, baseAmount: totalAmount, description: `Order: ${product.name} x${quantity}`, createdAt: now },
    });
    // Append hash chain (separate update because we need the row id + createdAt)
    const { appendHashChain } = await import('@/lib/wallet-ledger');
    const { previousHash, chainHash } = await appendHashChain(prisma, bucket.walletId, { id: txRecord.id, amount: totalAmount, type: 'debit', createdAt: now });
    await db.walletTransaction.update({ where: { id: txRecord.id }, data: { previousHash, chainHash } });
    await db.walletBucket.update({ where: { id: bucket.id }, data: { balance: { decrement: totalAmount } } });
    return NextResponse.json({ order }, { status: 201, headers: corsHeaders() });
  } catch (error) { console.error('Place order error:', error); return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() }); }
}
