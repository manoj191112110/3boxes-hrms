import { NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';
import { ensureSchemaSynced, withSchemaSync } from '@/lib/schema-sync';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() });
}

// ─── DELETE /api/invoices/[id]/line-items/[lineId] ────────────────
// Remove a line item. Only allowed while invoice is in draft.
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; lineId: string }> }
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

    const { id, lineId } = await params;
    const invoice = await withSchemaSync(() => db.invoice.findUnique({ where: { id } }));
    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404, headers: corsHeaders() });
    }
    if (invoice.status !== 'draft') {
      return NextResponse.json(
        { error: `Cannot remove line items from ${invoice.status} invoice (must be draft)` },
        { status: 400, headers: corsHeaders() }
      );
    }

    await withSchemaSync(() => db.invoiceLineItem.delete({ where: { id: lineId } }));

    // Recalc invoice totals
    const lineItems = await withSchemaSync(() => db.invoiceLineItem.findMany({ where: { invoiceId: id } }));
    const subtotal = lineItems.reduce((s, l) => s + l.amount, 0);
    const taxableSubtotal = lineItems.filter((l) => l.taxable).reduce((s, l) => s + l.amount, 0);
    const taxAmount = round(taxableSubtotal * (invoice.taxRate / 100));
    const discountAmount = round(subtotal * (invoice.discountRate / 100));
    const totalAmount = round(subtotal + taxAmount - discountAmount);
    const baseCur = invoice.baseCurrency || invoice.currency;
    const subtotalBase = baseCur === invoice.currency ? subtotal : round(subtotal / (invoice.exchangeRate || 1));
    const totalAmountBase = baseCur === invoice.currency ? totalAmount : round(totalAmount / (invoice.exchangeRate || 1));

    await db.invoice.update({
      where: { id },
      data: { subtotal, taxAmount, discountAmount, totalAmount, subtotalBase, totalAmountBase },
    });

    await db.auditLog.create({
      data: {
        userId: decoded.userId as string,
        action: 'REMOVE_INVOICE_LINE',
        module: 'invoices',
        details: `Removed line item ${lineId} from ${invoice.invoiceNumber}`,
      },
    });

    return NextResponse.json({ success: true }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Delete line item error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}

function round(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
