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

// ─── GET /api/invoices ────────────────────────────────────────────
// List invoices with filters. Supports pagination + search.
export async function GET(request: Request) {
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

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const companyId = searchParams.get('companyId');
    const clientId = searchParams.get('clientId');
    const projectId = searchParams.get('projectId');
    const status = searchParams.get('status');
    const currency = searchParams.get('currency');
    const search = searchParams.get('search');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    const where: Record<string, unknown> = {};
    if (companyId) where.companyId = companyId;
    if (clientId) where.clientId = clientId;
    if (projectId) where.projectId = projectId;
    if (status) where.status = status;
    if (currency) where.currency = currency;
    if (search) {
      where.OR = [
        { invoiceNumber: { contains: search, mode: 'insensitive' } },
        { notes: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (dateFrom || dateTo) {
      const dateFilter: Record<string, unknown> = {};
      if (dateFrom) dateFilter.gte = new Date(dateFrom);
      if (dateTo) dateFilter.lte = new Date(dateTo);
      where.issueDate = dateFilter;
    }

    const [invoices, total] = await Promise.all([
      withSchemaSync(() =>
        db.invoice.findMany({
          where,
          include: {
            client: { select: { id: true, name: true, code: true, billingCurrency: true } },
            project: { select: { id: true, name: true, code: true, currency: true, billingType: true } },
            company: { select: { id: true, name: true, currency: true } },
            _count: { select: { lineItems: true } },
          },
          orderBy: { issueDate: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        })
      ),
      withSchemaSync(() => db.invoice.count({ where })),
    ]);

    return NextResponse.json(
      { invoices, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } },
      { headers: corsHeaders() }
    );
  } catch (error) {
    console.error('Get invoices error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}

// ─── POST /api/invoices ───────────────────────────────────────────
// Create a new draft invoice. Auto-generates invoice number.
// Body:
//   { companyId, clientId?, projectId?, invoiceType?, billingType?, currency?,
//     baseCurrency?, taxRate?, discountRate?, issueDate?, dueDate?,
//     periodStart?, periodEnd?, notes?, internalNotes?, exchangeRate?, fxSource? }
export async function POST(request: Request) {
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

    const body = await request.json();
    const {
      companyId, clientId, projectId, invoiceType, billingType,
      currency, baseCurrency, taxRate, discountRate,
      issueDate, dueDate, periodStart, periodEnd,
      notes, internalNotes, exchangeRate, fxSource,
    } = body;

    if (!companyId) {
      return NextResponse.json(
        { error: 'Missing required field: companyId' },
        { status: 400, headers: corsHeaders() }
      );
    }

    // Resolve currency: prefer body → client.billingCurrency → project.currency → company.currency → INR (platform default)
    let invoiceCurrency = currency;
    let baseCur = baseCurrency;
    if (!invoiceCurrency || !baseCur) {
      if (clientId && !invoiceCurrency) {
        const c = await db.client.findUnique({ where: { id: clientId }, select: { billingCurrency: true } });
        if (c) invoiceCurrency = c.billingCurrency;
      }
      if (projectId && !invoiceCurrency) {
        const p = await db.project.findUnique({ where: { id: projectId }, select: { currency: true } });
        if (p) invoiceCurrency = p.currency;
      }
      if (!invoiceCurrency) {
        const co = await db.company.findUnique({ where: { id: companyId }, select: { currency: true } });
        if (co) invoiceCurrency = co.currency;
      }
      if (!invoiceCurrency) invoiceCurrency = 'INR';

      // Base currency defaults to the company's currency
      if (!baseCur) {
        const co = await db.company.findUnique({ where: { id: companyId }, select: { currency: true } });
        if (co) baseCur = co.currency;
      }
    }

    // FX rate — either explicit (caller supplied) or fetched from rate table
    let fxRate = exchangeRate ?? 1;
    let fxRateDate: Date | null = null;
    let fxSrc = fxSource ?? null;
    if (baseCur && invoiceCurrency !== baseCur && !exchangeRate) {
      const fx = await convertCurrency(1, baseCur, invoiceCurrency, { rateDate: issueDate ? new Date(issueDate) : undefined });
      fxRate = fx.rate;
      fxRateDate = fx.rateDate;
      fxSrc = fx.source;
    } else if (exchangeRate) {
      fxRateDate = new Date();
      fxSrc = fxSource ?? 'MANUAL';
    }

    // Auto-generate invoice number: INV-YYYYMM-XXXX
    const now = issueDate ? new Date(issueDate) : new Date();
    const yyyymm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prefix = `INV-${yyyymm}-`;
    const existing = await withSchemaSync(() =>
      db.invoice.findMany({
        where: { invoiceNumber: { startsWith: prefix } },
        select: { invoiceNumber: true },
      })
    );
    const nextSeq = existing.length + 1;
    const invoiceNumber = `${prefix}${String(nextSeq).padStart(4, '0')}`;

    const invoice = await withSchemaSync(() =>
      db.invoice.create({
        data: {
          invoiceNumber,
          companyId,
          clientId: clientId || null,
          projectId: projectId || null,
          invoiceType: invoiceType || 'timesheet',
          billingType: billingType || 'time_and_material',
          currency: invoiceCurrency,
          baseCurrency: baseCur,
          exchangeRate: fxRate,
          fxRateDate: fxRateDate,
          fxSource: fxSrc,
          taxRate: taxRate ?? 0,
          discountRate: discountRate ?? 0,
          issueDate: now,
          dueDate: dueDate ? new Date(dueDate) : null,
          periodStart: periodStart ? new Date(periodStart) : null,
          periodEnd: periodEnd ? new Date(periodEnd) : null,
          notes: notes || null,
          internalNotes: internalNotes || null,
          createdBy: decoded.userId as string,
          status: 'draft',
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
        action: 'CREATE_INVOICE',
        module: 'invoices',
        details: `Created invoice ${invoiceNumber} (${invoiceCurrency})`,
      },
    });

    return NextResponse.json({ invoice }, { status: 201, headers: corsHeaders() });
  } catch (error) {
    console.error('Create invoice error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}
