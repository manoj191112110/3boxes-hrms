import { NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';
import { ensureSchemaSynced, withSchemaSync } from '@/lib/schema-sync';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() });
}

// ─── POST /api/invoices/[id]/finalize ─────────────────────────────
// Lock a draft invoice: sets status to 'issued', records issuedBy/issuedAt,
// recomputes all totals one final time. After this, line items cannot be
// added/removed and tax/discount/FX cannot change.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const db = await getDb(request);
  try {
    await ensureSchemaSynced();

    const token = getTokenFromHeaders(request);
    if (!token) {
      return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    }
    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: corsHeaders() });
    }

    const { id } = await params;
    const invoice = await withSchemaSync(() => db.invoice.findUnique({ where: { id } }));
    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404, headers: corsHeaders() });
    }
    if (invoice.status !== 'draft') {
      return NextResponse.json(
        { error: `Cannot finalize invoice in status '${invoice.status}' (must be draft)` },
        { status: 400, headers: corsHeaders() }
      );
    }

    // Final totals recalc
    const lineItems = await withSchemaSync(() => db.invoiceLineItem.findMany({ where: { invoiceId: id } }));
    const subtotal = lineItems.reduce((s, l) => s + l.amount, 0);
    const taxableSubtotal = lineItems.filter((l) => l.taxable).reduce((s, l) => s + l.amount, 0);
    const taxAmount = round(taxableSubtotal * (invoice.taxRate / 100));
    const discountAmount = round(subtotal * (invoice.discountRate / 100));
    const totalAmount = round(subtotal + taxAmount - discountAmount);
    const baseCur = invoice.baseCurrency || invoice.currency;
    const subtotalBase = baseCur === invoice.currency ? subtotal : round(subtotal / (invoice.exchangeRate || 1));
    const totalAmountBase = baseCur === invoice.currency ? totalAmount : round(totalAmount / (invoice.exchangeRate || 1));

    const finalized = await withSchemaSync(() =>
      db.invoice.update({
        where: { id },
        data: {
          status: 'issued',
          issuedAt: new Date(),
          issuedBy: decoded.userId as string,
          subtotal,
          taxAmount,
          discountAmount,
          totalAmount,
          subtotalBase,
          totalAmountBase,
        },
        include: {
          client: { select: { id: true, name: true, billingCurrency: true } },
          project: { select: { id: true, name: true, currency: true } },
          company: { select: { id: true, name: true, currency: true } },
          lineItems: true,
        },
      })
    );

    await db.auditLog.create({
      data: {
        userId: decoded.userId as string,
        action: 'FINALIZE_INVOICE',
        module: 'invoices',
        details: `Finalized invoice ${invoice.invoiceNumber} — total ${invoice.currency} ${totalAmount.toFixed(2)}`,
      },
    });

    return NextResponse.json({ invoice: finalized }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Finalize invoice error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}

function round(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
