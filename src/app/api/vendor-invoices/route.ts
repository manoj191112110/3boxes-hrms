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
    const poId = searchParams.get('poId');
    const status = searchParams.get('status');
    const where: Record<string, unknown> = {};
    if (vendorId) where.vendorId = vendorId;
    if (poId) where.poId = poId;
    if (status) where.status = status;
    const vis = await db.vendorInvoice.findMany({
      where: where as any,
      include: { vendor: { select: { id: true, name: true } }, po: { select: { id: true, poNumber: true, totalAmount: true, currency: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ vendorInvoices: vis }, { headers: corsHeaders() });
  } catch (error) { console.error('Get vendor invoices error:', error); return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() }); }
}

export async function POST(request: Request) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: corsHeaders() });

    const body = await request.json();
    const { vendorId, poId, invoiceNumber, invoiceDate, currency, baseCurrency, exchangeRate, totalAmount, notes, autoMatch } = body;
    if (!vendorId || !invoiceNumber || !totalAmount) return NextResponse.json({ error: 'Missing required fields' }, { status: 400, headers: corsHeaders() });

    let matchedJson = null;
    let status = 'draft';
    if (autoMatch && poId) {
      const po = await db.purchaseOrder.findUnique({ where: { id: poId }, include: { lineItems: true, project: { include: { timesheets: { select: { hours: true, status: true } } } } } });
      if (po) {
        const poMatched = Math.abs(po.totalAmount - totalAmount) < 0.01;
        // Timesheet match: hours × costRate ~ totalAmount
        const timesheetHours = po.project?.timesheets.filter(t => t.status === 'approved').reduce((s, t) => s + t.hours, 0) || 0;
        const timesheetMatched = po.project && Math.abs(timesheetHours * (po.project.costRate || 0) - totalAmount) < (totalAmount * 0.1);
        const qtyDelta = po.totalAmount - totalAmount;
        const rateDelta = 0; // simplified
        matchedJson = { poMatched, timesheetMatched, qtyDelta, rateDelta, poAmount: po.totalAmount, invoiceAmount: totalAmount, timesheetHours };
        status = (poMatched && timesheetMatched) ? 'matched' : 'mismatched';
      }
    }

    const vi = await db.vendorInvoice.create({
      data: {
        vendorId, poId, invoiceNumber,
        invoiceDate: invoiceDate ? new Date(invoiceDate) : new Date(),
        currency: currency || 'INR', baseCurrency: baseCurrency || 'INR', exchangeRate: exchangeRate || 1,
        totalAmount, baseAmount: totalAmount * (exchangeRate || 1),
        status, matchedJson, notes,
      },
    });
    return NextResponse.json({ vendorInvoice: vi }, { status: 201, headers: corsHeaders() });
  } catch (error) { console.error('Create vendor invoice error:', error); return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() }); }
}
