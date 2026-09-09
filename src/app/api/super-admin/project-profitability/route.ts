import { NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';
import { ensureSchemaSynced, withSchemaSync } from '@/lib/schema-sync';
import { convertCurrency } from '@/lib/fx';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() });
}

// ─── GET /api/super-admin/project-profitability ───────────────────
// Aggregate revenue + cost + margin per project across ALL tenants.
// Revenue = sum(Invoice.totalAmountBase) for issued/paid invoices.
// Cost = sum(ProjectAllocation.internalCostRate × estimatedHours) for each
//        project (rough proxy — proper cost accounting needs timesheet-based
//        internal cost which is the timesheet-fix task).
// Margin = revenue - cost, Margin% = margin / revenue.
//
// Query params:
//   ?tenantId=  → restrict to a single tenant (optional, for tenant_admin)
//   ?from=&to=  → invoice issueDate range
//   ?currency=  → report currency (default: INR)
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
    const userRole = decoded.role as string;
    if (userRole !== 'super_admin' && userRole !== 'tenant_admin') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403, headers: corsHeaders() });
    }

    const { searchParams } = new URL(request.url);
    const fromParam = searchParams.get('from');
    const toParam = searchParams.get('to');
    const reportCurrency = searchParams.get('currency') || 'INR';
    const tenantId = searchParams.get('tenantId');

    // Build invoice where clause: only issued/paid/partial count as revenue
    const invoiceWhere: Record<string, unknown> = {
      status: { in: ['issued', 'sent', 'partial', 'paid'] },
    };
    if (fromParam || toParam) {
      const dateFilter: Record<string, unknown> = {};
      if (fromParam) dateFilter.gte = new Date(fromParam);
      if (toParam) dateFilter.lte = new Date(toParam);
      invoiceWhere.issueDate = dateFilter;
    }

    // If tenant_admin is calling, restrict to their tenant's companies
    if (userRole === 'tenant_admin' && decoded.tenantId) {
      const tenantCompanies = await db.company.findMany({
        where: { companyGroup: { tenantId: decoded.tenantId as string } },
        select: { id: true },
      });
      invoiceWhere.companyId = { in: tenantCompanies.map((c) => c.id) };
    }
    if (tenantId && userRole === 'super_admin') {
      const tenantCompanies = await db.company.findMany({
        where: { companyGroup: { tenantId } },
        select: { id: true },
      });
      invoiceWhere.companyId = { in: tenantCompanies.map((c) => c.id) };
    }

    // Get invoices + their projects
    const invoices = await withSchemaSync(() =>
      db.invoice.findMany({
        where: invoiceWhere,
        include: {
          project: {
            select: {
              id: true, name: true, code: true, currency: true, billingType: true,
              budgetAmount: true, estimatedHours: true, actualHours: true,
              companyId: true,
              company: { select: { id: true, name: true, companyGroup: { select: { id: true, name: true, tenantId: true, tenant: { select: { id: true, name: true } } } } } },
              allocations: { select: { id: true, internalCostRate: true, allocationPct: true, startDate: true, endDate: true } },
            },
          },
          client: { select: { id: true, name: true, billingCurrency: true } },
        },
      })
    );

    // Group revenue by project
    const projectMap = new Map<string, {
      projectId: string;
      projectName: string;
      projectCode: string | null;
      projectCurrency: string;
      billingType: string;
      tenantId: string | null;
      tenantName: string | null;
      companyName: string;
      clientName: string | null;
      invoiceCount: number;
      revenueInProjectCurrency: number;
      estimatedHours: number;
      actualHours: number;
      budgetAmount: number;
      allocations: { internalCostRate: number; allocationPct: number }[];
    }>();

    for (const inv of invoices) {
      if (!inv.project) continue;
      const p = inv.project;
      if (!projectMap.has(p.id)) {
        const tenantId = p.company?.companyGroup?.tenantId ?? null;
        const tenantName = p.company?.companyGroup?.tenant?.name ?? null;
        projectMap.set(p.id, {
          projectId: p.id,
          projectName: p.name,
          projectCode: p.code,
          projectCurrency: p.currency,
          billingType: p.billingType,
          tenantId,
          tenantName,
          companyName: p.company?.name ?? 'Unknown',
          clientName: inv.client?.name ?? null,
          invoiceCount: 0,
          revenueInProjectCurrency: 0,
          estimatedHours: p.estimatedHours ?? 0,
          actualHours: p.actualHours ?? 0,
          budgetAmount: p.budgetAmount ?? 0,
          allocations: p.allocations.map((a) => ({ internalCostRate: a.internalCostRate, allocationPct: a.allocationPct })),
        });
      }
      const entry = projectMap.get(p.id)!;
      entry.invoiceCount += 1;

      // Convert invoice total back to project currency for accurate margin calc
      if (inv.currency === p.currency) {
        entry.revenueInProjectCurrency += inv.totalAmount;
      } else if (inv.totalAmountBase && inv.baseCurrency === p.currency) {
        entry.revenueInProjectCurrency += inv.totalAmountBase;
      } else {
        // Convert invoice currency → project currency using latest FX
        const fx = await convertCurrency(inv.totalAmount, inv.currency, p.currency);
        entry.revenueInProjectCurrency += fx.amount;
      }
    }

    // Now compute cost (rough estimate: avg internal cost rate × actual hours)
    // and convert revenue to report currency.
    const rows = [];
    for (const entry of projectMap.values()) {
      const avgCostRate =
        entry.allocations.length > 0
          ? entry.allocations.reduce((s, a) => s + (a.internalCostRate || 0), 0) / entry.allocations.length
          : 0;
      const costInProjectCurrency = avgCostRate * (entry.actualHours || entry.estimatedHours || 0);

      // Convert revenue + cost to report currency
      const [revConv, costConv] = await Promise.all([
        convertCurrency(entry.revenueInProjectCurrency, entry.projectCurrency, reportCurrency),
        convertCurrency(costInProjectCurrency, entry.projectCurrency, reportCurrency),
      ]);

      const revenue = revConv.amount;
      const cost = costConv.amount;
      const margin = revenue - cost;
      const marginPct = revenue > 0 ? (margin / revenue) * 100 : 0;

      rows.push({
        projectId: entry.projectId,
        projectName: entry.projectName,
        projectCode: entry.projectCode,
        tenantId: entry.tenantId,
        tenantName: entry.tenantName,
        companyName: entry.companyName,
        clientName: entry.clientName,
        billingType: entry.billingType,
        currency: reportCurrency,
        invoiceCount: entry.invoiceCount,
        revenue,
        cost,
        margin,
        marginPct: Math.round(marginPct * 100) / 100,
        estimatedHours: entry.estimatedHours,
        actualHours: entry.actualHours,
        budgetAmount: entry.budgetAmount,
        warnings: [revConv.warning, costConv.warning].filter(Boolean),
      });
    }

    // Sort by revenue desc
    rows.sort((a, b) => b.revenue - a.revenue);

    // Compute totals
    const totals = {
      totalRevenue: rows.reduce((s, r) => s + r.revenue, 0),
      totalCost: rows.reduce((s, r) => s + r.cost, 0),
      totalMargin: 0,
      totalMarginPct: 0,
      totalInvoices: rows.reduce((s, r) => s + r.invoiceCount, 0),
      projectCount: rows.length,
      currency: reportCurrency,
    };
    totals.totalMargin = totals.totalRevenue - totals.totalCost;
    totals.totalMarginPct = totals.totalRevenue > 0
      ? Math.round((totals.totalMargin / totals.totalRevenue) * 10000) / 100
      : 0;

    return NextResponse.json({
      reportCurrency,
      from: fromParam || null,
      to: toParam || null,
      totals,
      rows,
    }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Project profitability error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}
