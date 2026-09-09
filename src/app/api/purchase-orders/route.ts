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
    const vendorId = searchParams.get('vendorId');
    const companyId = searchParams.get('companyId');
    const status = searchParams.get('status');
    const where: Record<string, unknown> = {};
    if (vendorId) where.vendorId = vendorId;
    if (companyId) where.companyId = companyId;
    if (status) where.status = status;
    const pos = await db.purchaseOrder.findMany({
      where: where as any,
      include: { vendor: { select: { id: true, name: true } }, company: { select: { id: true, name: true } }, project: { select: { id: true, name: true } }, lineItems: true, _count: { select: { vendorInvoices: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ purchaseOrders: pos }, { headers: corsHeaders() });
  } catch (error) { console.error('Get POs error:', error); return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() }); }
}

export async function POST(request: Request) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: corsHeaders() });

    const body = await request.json();
    const { poNumber, vendorId, companyId, projectId, currency, baseCurrency, exchangeRate, lineItems, notes, expectedBy } = body;
    if (!poNumber || !vendorId || !companyId || !lineItems?.length) return NextResponse.json({ error: 'Missing required fields' }, { status: 400, headers: corsHeaders() });
    const totalAmount = lineItems.reduce((s: number, li: any) => s + (li.quantity * li.unitPrice), 0);
    const po = await db.purchaseOrder.create({
      data: {
        poNumber, vendorId, companyId, projectId,
        currency: currency || 'INR', baseCurrency: baseCurrency || 'INR', exchangeRate: exchangeRate || 1,
        totalAmount, baseAmount: totalAmount * (exchangeRate || 1),
        status: 'issued', issuedAt: new Date(),
        expectedBy: expectedBy ? new Date(expectedBy) : null, notes,
        lineItems: { create: lineItems.map((li: any) => ({ description: li.description, quantity: li.quantity, unitPrice: li.unitPrice, currency: li.currency || currency || 'INR', total: li.quantity * li.unitPrice })) },
      },
      include: { lineItems: true },
    });
    await db.auditLog.create({ data: { userId: decoded.userId as string, action: 'CREATE_PO', module: 'vendors', details: `Created PO ${poNumber} for vendor ${vendorId} amount ${totalAmount}` } });
    return NextResponse.json({ purchaseOrder: po }, { status: 201, headers: corsHeaders() });
  } catch (error) { console.error('Create PO error:', error); return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() }); }
}
