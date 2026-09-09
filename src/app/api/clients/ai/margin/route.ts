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
    const clientId = searchParams.get('clientId');

    const clients = await db.client.findMany({
      where: clientId ? { id: clientId } : { status: 'active' },
      include: {
        projects: { include: { timesheets: { select: { hours: true } }, allocations: { select: { employeeId: true, allocationPct: true } } } },
        invoices: { select: { totalAmount: true, currency: true, status: true } },
      },
    });

    const results = [];
    for (const c of clients) {
      // Revenue = sum of paid/sent invoices
      const revenueBase = c.invoices.filter(i => i.status === 'paid' || i.status === 'sent').reduce((s, i) => s + (i.totalAmount || 0), 0);
      // Cost (employee) = sum of project hours × costRate proxy
      let costEmployee = 0;
      for (const p of c.projects) {
        const hrs = p.timesheets.reduce((s, t) => s + (t.hours || 0), 0);
        costEmployee += hrs * (p.costRate || 0);
      }
      // Vendor cost = sum of vendor invoices linked to client's projects (approximation via PO)
      const vendorPOs = await db.purchaseOrder.findMany({
        where: { projectId: { in: c.projects.map(p => p.id) } },
        include: { vendorInvoices: { select: { baseAmount: true, status: true } } },
      });
      const costVendor = vendorPOs.flatMap(po => po.vendorInvoices).filter(vi => vi.status === 'approved' || vi.status === 'paid').reduce((s, vi) => s + (vi.baseAmount || 0), 0);

      const grossMargin = revenueBase - costEmployee - costVendor;
      const marginPct = revenueBase > 0 ? (grossMargin / revenueBase) * 100 : 0;

      const snap = await db.clientMarginSnapshot.create({
        data: { clientId: c.id, revenueBase, costEmployee, costVendor, grossMargin, marginPct, currency: c.billingCurrency || 'INR' },
      });
      results.push({ clientId: c.id, clientName: c.name, revenueBase, costEmployee, costVendor, grossMargin, marginPct: Math.round(marginPct * 100) / 100, snapshotId: snap.id });
    }
    return NextResponse.json({ results, snapshotAt: new Date().toISOString() }, { headers: corsHeaders() });
  } catch (error) { console.error('Margin analysis error:', error); return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() }); }
}
