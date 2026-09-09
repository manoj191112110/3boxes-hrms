import { NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';
import { ensureSchemaSynced, withSchemaSync } from '@/lib/schema-sync';

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

// ─── GET /api/invoices/[id] ───────────────────────────────────────
// Detail view with all line items.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
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

    const invoice = await withSchemaSync(() =>
      db.invoice.findUnique({
        where: { id },
        include: {
          client: true,
          project: { select: { id: true, name: true, code: true, currency: true, billingType: true } },
          company: { select: { id: true, name: true, currency: true } },
          lineItems: {
            orderBy: { date: 'asc' },
          },
        },
      })
    );

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404, headers: corsHeaders() });
    }

    return NextResponse.json({ invoice }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Get invoice error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}

// ─── PATCH /api/invoices/[id] ─────────────────────────────────────
// Update an invoice. Allowed transitions + field updates depend on status.
//   - draft:        can edit any field
//   - issued/sent:  can only change status (sent, paid, partial, disputed, cancelled)
//   - paid:         no edits (only re-open via cancelled)
//   - cancelled:    terminal
//
// Body shape:
//   { status?, taxRate?, discountRate?, dueDate?, notes?, internalNotes?,
//     exchangeRate?, paymentRef?, currency? }
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
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

    const existing = await withSchemaSync(() => db.invoice.findUnique({ where: { id } }));
    if (!existing) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404, headers: corsHeaders() });
    }

    // If invoice is in a terminal/paid state, only allow cancellation
    const isTerminal = ['paid', 'cancelled'].includes(existing.status);
    if (isTerminal && body.status !== 'cancelled') {
      return NextResponse.json(
        { error: `Invoice is in terminal state '${existing.status}' — cannot be edited` },
        { status: 400, headers: corsHeaders() }
      );
    }

    const update: Record<string, unknown> = {};
    if (body.status !== undefined) {
      update.status = body.status;
      if (body.status === 'issued' && !existing.issuedAt) {
        update.issuedAt = new Date();
        update.issuedBy = decoded.userId as string;
      }
      if (body.status === 'paid' && !existing.paidAt) {
        update.paidAt = new Date();
      }
    }
    if (body.paymentRef !== undefined) update.paymentRef = body.paymentRef;
    if (body.notes !== undefined) update.notes = body.notes;
    if (body.internalNotes !== undefined) update.internalNotes = body.internalNotes;
    if (body.dueDate !== undefined) update.dueDate = body.dueDate ? new Date(body.dueDate) : null;

    // Draft-only fields
    if (existing.status === 'draft') {
      if (body.taxRate !== undefined) update.taxRate = body.taxRate;
      if (body.discountRate !== undefined) update.discountRate = body.discountRate;
      if (body.exchangeRate !== undefined) {
        update.exchangeRate = body.exchangeRate;
        update.fxSource = 'MANUAL';
        update.fxRateDate = new Date();
      }
    }

    // If status or draft-only fields changed, recalculate totals
    const recalcFields = ['taxRate', 'discountRate', 'exchangeRate'];
    const needsRecalc =
      body.status !== undefined ||
      Object.keys(body).some((k) => recalcFields.includes(k));

    if (needsRecalc || Object.keys(update).length > 0) {
      // Re-fetch line items to compute totals
      const lineItems = await withSchemaSync(() =>
        db.invoiceLineItem.findMany({ where: { invoiceId: id } })
      );

      const taxRate = update.taxRate !== undefined ? update.taxRate : existing.taxRate;
      const discountRate = update.discountRate !== undefined ? update.discountRate : existing.discountRate;
      const fxRate = update.exchangeRate !== undefined ? update.exchangeRate : existing.exchangeRate;

      const subtotal = lineItems.reduce((s, l) => s + l.amount, 0);
      const taxableSubtotal = lineItems
        .filter((l) => l.taxable)
        .reduce((s, l) => s + l.amount, 0);
      const taxAmount = round(taxableSubtotal * (taxRate / 100));
      const discountAmount = round(subtotal * (discountRate / 100));
      const totalAmount = round(subtotal + taxAmount - discountAmount);

      // Base currency totals (using invoice-level FX rate)
      const baseCurrency = existing.baseCurrency || existing.currency;
      const subtotalBase = baseCurrency === existing.currency
        ? subtotal
        : round(subtotal / (fxRate || 1));
      const totalAmountBase = baseCurrency === existing.currency
        ? totalAmount
        : round(totalAmount / (fxRate || 1));

      update.subtotal = subtotal;
      update.taxAmount = taxAmount;
      update.discountAmount = discountAmount;
      update.totalAmount = totalAmount;
      update.subtotalBase = subtotalBase;
      update.totalAmountBase = totalAmountBase;
    }

    const invoice = await withSchemaSync(() =>
      db.invoice.update({
        where: { id },
        data: update,
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
        action: 'UPDATE_INVOICE',
        module: 'invoices',
        details: `Updated invoice ${existing.invoiceNumber} (fields: ${Object.keys(update).join(', ')})`,
      },
    });

    return NextResponse.json({ invoice }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Update invoice error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}

// ─── DELETE /api/invoices/[id] ────────────────────────────────────
// Only draft invoices can be deleted.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
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
    const existing = await withSchemaSync(() => db.invoice.findUnique({ where: { id } }));
    if (!existing) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404, headers: corsHeaders() });
    }

    if (existing.status !== 'draft') {
      return NextResponse.json(
        { error: `Cannot delete invoice in status '${existing.status}' — cancel it instead` },
        { status: 400, headers: corsHeaders() }
      );
    }

    await withSchemaSync(() => db.invoice.delete({ where: { id } }));

    await db.auditLog.create({
      data: {
        userId: decoded.userId as string,
        action: 'DELETE_INVOICE',
        module: 'invoices',
        details: `Deleted draft invoice ${existing.invoiceNumber}`,
      },
    });

    return NextResponse.json({ success: true }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Delete invoice error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}

function round(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
