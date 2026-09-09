import { NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';
import { ensureSchemaSynced, withSchemaSync } from '@/lib/schema-sync';
import { convertCurrency } from '@/lib/fx';

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

// ─── POST /api/invoices/[id]/line-items ───────────────────────────
// Add a line item (manual or milestone-linked). Recalculates invoice totals.
//
// Body:
//   { sourceType?, description, date?, hours?, quantity?, unit?, rate?,
//     rateSourceCurrency?, rateSourceAmount?, taxable?, taxRate?,
//     projectId?, employeeId?, milestoneId?, timesheetId? }
//
// If rateSourceCurrency is set and differs from invoice.currency, we use
// convertCurrency to compute the rate in invoice currency.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
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
    const body = await request.json();

    const invoice = await withSchemaSync(() => db.invoice.findUnique({ where: { id } }));
    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404, headers: corsHeaders() });
    }
    if (invoice.status !== 'draft') {
      return NextResponse.json(
        { error: `Cannot add line items to ${invoice.status} invoice (must be draft)` },
        { status: 400, headers: corsHeaders() }
      );
    }

    if (!body.description) {
      return NextResponse.json(
        { error: 'Missing required field: description' },
        { status: 400, headers: corsHeaders() }
      );
    }

    // Compute rate in invoice currency
    let rate = body.rate ?? 0;
    let fxRate: number | null = null;
    if (body.rateSourceCurrency && body.rateSourceAmount && body.rateSourceCurrency !== invoice.currency) {
      const fx = await convertCurrency(body.rateSourceAmount, body.rateSourceCurrency, invoice.currency, {
        rateDate: invoice.issueDate,
      });
      rate = fx.amount;
      fxRate = fx.rate;
    } else if (body.rateSourceAmount && body.rateSourceCurrency === invoice.currency) {
      rate = body.rateSourceAmount;
    }

    const hours = body.hours ?? 0;
    const quantity = body.quantity ?? (hours > 0 ? hours : 1);
    const amount = round(rate * quantity);

    // Base-currency amount (line-level)
    const baseCur = invoice.baseCurrency || invoice.currency;
    const amountBase =
      baseCur === invoice.currency
        ? amount
        : round(amount / (invoice.exchangeRate || 1));

    const lineItem = await withSchemaSync(() =>
      db.invoiceLineItem.create({
        data: {
          invoiceId: id,
          sourceType: body.sourceType || 'manual',
          timesheetId: body.timesheetId || null,
          milestoneId: body.milestoneId || null,
          projectId: body.projectId || invoice.projectId || null,
          projectTaskId: body.projectTaskId || null,
          employeeId: body.employeeId || null,
          description: body.description,
          date: body.date ? new Date(body.date) : null,
          hours,
          quantity,
          unit: body.unit || 'hours',
          rate,
          rateSourceCurrency: body.rateSourceCurrency || null,
          rateSourceAmount: body.rateSourceAmount ?? null,
          fxRate,
          amount,
          amountBase,
          taxable: body.taxable ?? true,
          taxRate: body.taxRate ?? null,
          taxAmount: null,
        },
      })
    );

    // Recalculate invoice totals
    await recalcInvoiceTotals(id);

    await db.auditLog.create({
      data: {
        userId: decoded.userId as string,
        action: 'ADD_INVOICE_LINE',
        module: 'invoices',
        details: `Added line item to ${invoice.invoiceNumber}: ${body.description}`,
      },
    });

    return NextResponse.json({ lineItem }, { status: 201, headers: corsHeaders() });
  } catch (error) {
    console.error('Add line item error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}

// Helper: recalculate invoice subtotal/tax/discount/total + base-currency totals
async function recalcInvoiceTotals(invoiceId: string): Promise<void> {
  const [invoice, lineItems] = await Promise.all([
    db.invoice.findUnique({ where: { id: invoiceId } }),
    db.invoiceLineItem.findMany({ where: { invoiceId } }),
  ]);
  if (!invoice) return;

  const subtotal = lineItems.reduce((s, l) => s + l.amount, 0);
  const taxableSubtotal = lineItems.filter((l) => l.taxable).reduce((s, l) => s + l.amount, 0);
  const taxAmount = round(taxableSubtotal * (invoice.taxRate / 100));
  const discountAmount = round(subtotal * (invoice.discountRate / 100));
  const totalAmount = round(subtotal + taxAmount - discountAmount);

  const baseCur = invoice.baseCurrency || invoice.currency;
  const subtotalBase = baseCur === invoice.currency ? subtotal : round(subtotal / (invoice.exchangeRate || 1));
  const totalAmountBase = baseCur === invoice.currency ? totalAmount : round(totalAmount / (invoice.exchangeRate || 1));

  await db.invoice.update({
    where: { id: invoiceId },
    data: {
      subtotal,
      taxAmount,
      discountAmount,
      totalAmount,
      subtotalBase,
      totalAmountBase,
    },
  });
}

function round(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
