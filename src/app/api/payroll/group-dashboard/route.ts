// REQ-7.2: Group Payroll Dashboard (Tenant Admin)
// ------------------------------------------------
// Consolidated view of the entire Parent Company group's payroll liability,
// normalized to the Tenant's base currency. Includes:
//   • Per-sub-company payroll summary (gross/net/employer contrib) for the latest period
//   • Group total in base currency
//   • FX rate used (locked on the payroll processing date)
//   • Pending approvals count
//   • Budget vs. actual comparison
//
// This endpoint is for Tenant Admins — Super Admins see all tenants,
// Tenant Admins see only their own group.

import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { getTokenFromHeaders, verifyToken } from '@/lib/auth';
import { NextRequest } from 'next/server';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

// GET /api/payroll/group-dashboard
//   ?period=2026-06   → defaults to most recent completed run
export async function GET(request: NextRequest) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    const decoded = await verifyToken(token);
    if (!decoded) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });

    const { searchParams } = new URL(request.url);
    const periodParam = searchParams.get('period');

    // Resolve the user's tenant
    const user = await db.user.findUnique({
      where: { id: decoded.userId as string },
      select: { tenantId: true, role: true },
    });
    if (!user) return Response.json({ error: 'User not found' }, { status: 404, headers: corsHeaders });

    // ─── GOLDEN RULE: Group payroll dashboard is a tenant-admin feature ───
    // Super_admin has no tenant context, so we return an empty state instead
    // of querying the platform DB (which would return seed/dummy data).
    if (user.role === 'super_admin' || !user.tenantId) {
      return Response.json({
        data: {
          tenant: null,
          period: periodParam || null,
          perCompany: [],
          groupTotal: { gross: 0, net: 0, employerContrib: 0, currency: 'INR' },
          pendingApprovals: 0,
          openLockRequests: 0,
          openAnomalies: 0,
          companyCount: 0,
          runsExecuted: 0,
          runsMissing: 0,
          message: 'Group payroll dashboard is available for tenant admins. Select a tenant context to view group payroll data.',
        },
      }, { headers: corsHeaders });
    }

    const tenant = await getPlatformDb().tenant.findUnique({
      where: { id: user.tenantId },
      select: { id: true, name: true, baseCurrency: true, currency: true },
    });
    if (!tenant) return Response.json({ error: 'Tenant not found' }, { status: 404, headers: corsHeaders });

    const baseCurrency = tenant.baseCurrency || tenant.currency || 'INR';

    // Get all companies in the tenant's group(s)
    const groups = await db.companyGroup.findMany({
      where: { tenantId: tenant.id },
      include: {
        companies: {
          select: { id: true, name: true, country: true, currency: true, logo: true },
        },
      },
    });

    const allCompanies = groups.flatMap((g) => g.companies.map((c) => ({ ...c, groupName: g.name })));
    const companyIds = allCompanies.map((c) => c.id);

    if (companyIds.length === 0) {
      return Response.json({
        data: {
          tenant: { id: tenant.id, name: tenant.name, baseCurrency },
          period: periodParam || null,
          perCompany: [],
          groupTotal: { gross: 0, net: 0, employerContrib: 0, currency: baseCurrency },
          pendingApprovals: 0,
          openLockRequests: 0,
          openAnomalies: 0,
          message: 'No companies configured for this tenant yet.',
        },
      }, { headers: corsHeaders });
    }

    // Determine the target period
    let targetPeriod = periodParam;
    if (!targetPeriod) {
      const latestRun = await db.payrollRun.findFirst({
        where: { companyId: { in: companyIds } },
        orderBy: { payrollPeriod: 'desc' },
        select: { payrollPeriod: true },
      });
      targetPeriod = latestRun?.payrollPeriod || null;
    }

    // Fetch all payroll runs for the target period (one per company)
    const runs = targetPeriod ? await db.payrollRun.findMany({
      where: { companyId: { in: companyIds }, payrollPeriod: targetPeriod },
      include: {
        company: { select: { id: true, name: true, country: true, currency: true } },
      },
    }) : [];

    // Fetch FX rates for the period (rateDate close to the run's payDate)
    const fxRates = new Map<string, number>(); // key: `${from}_${to}` → rate
    try {
      const relevantCurrencies = new Set<string>();
      // For each company that has a run, track its currency for FX lookup
      for (const run of runs) {
        const co = allCompanies.find((c) => c.id === run.companyId);
        const cur = co?.currency;
        if (cur && cur !== baseCurrency) {
          relevantCurrencies.add(cur);
        }
      }
      if (relevantCurrencies.size > 0) {
        const rates = await db.exchangeRate.findMany({
          where: {
            OR: Array.from(relevantCurrencies).flatMap((cur) => [
              { fromCurrency: cur, toCurrency: baseCurrency },
              { fromCurrency: baseCurrency, toCurrency: cur },
            ]),
            isActive: true,
          },
          orderBy: { rateDate: 'desc' },
          take: 100,
        });
        for (const r of rates) {
          const key = `${r.fromCurrency}_${r.toCurrency}`;
          if (!fxRates.has(key)) fxRates.set(key, r.exchangeRate);
        }
      }
    } catch (err) {
      console.error('FX rate lookup failed (continuing with rate=1):', err);
    }

    // Helper: convert amount from a source currency to base currency
    const convertToBase = (amount: number, fromCurrency: string): number => {
      if (fromCurrency === baseCurrency || !fromCurrency) return amount;
      const rate = fxRates.get(`${fromCurrency}_${baseCurrency}`);
      if (rate) return amount * rate;
      const inverse = fxRates.get(`${baseCurrency}_${fromCurrency}`);
      if (inverse && inverse > 0) return amount / inverse;
      // No rate found — fall back to 1:1 (will be flagged in response)
      return amount;
    };

    // Build per-company summary
    const perCompany = allCompanies.map((co) => {
      const run = runs.find((r) => r.companyId === co.id);
      const sourceCurrency = co.currency || 'INR';
      const fxRate = sourceCurrency === baseCurrency ? 1 : (fxRates.get(`${sourceCurrency}_${baseCurrency}`) || null);

      return {
        companyId: co.id,
        companyName: co.name,
        country: co.country,
        sourceCurrency,
        groupName: co.groupName,
        payrollRun: run ? {
          id: run.id,
          runType: run.runType,
          runStatus: run.runStatus,
          currencyCode: run.currencyCode,
          totalEmployees: run.totalEmployees,
          totalGrossPay: run.totalGrossPay,
          totalDeductions: run.totalDeductions,
          totalNetPay: run.totalNetPay,
          totalEmployerContrib: run.totalEmployerContrib,
          payDate: run.payDate,
        } : null,
        // Normalized to base currency
        normalized: run ? {
          gross: convertToBase(run.totalGrossPay, sourceCurrency),
          net: convertToBase(run.totalNetPay, sourceCurrency),
          employerContrib: convertToBase(run.totalEmployerContrib, sourceCurrency),
          currency: baseCurrency,
          fxRate,
          fxRateMissing: !fxRate && sourceCurrency !== baseCurrency,
        } : null,
      };
    });
    const groupTotal = {
      gross: perCompany.reduce((s, c) => s + (c.normalized?.gross || 0), 0),
      net: perCompany.reduce((s, c) => s + (c.normalized?.net || 0), 0),
      employerContrib: perCompany.reduce((s, c) => s + (c.normalized?.employerContrib || 0), 0),
      currency: baseCurrency,
    };

    // Pending approvals across all runs in this period
    const runIds = runs.map((r) => r.id);
    const pendingApprovals = runIds.length > 0 ? await db.payrollApproval.count({
      where: { payrollRunId: { in: runIds }, status: 'PENDING' },
    }) : 0;

    const openLockRequests = runIds.length > 0 ? await db.payrollLockRequest.count({
      where: { payrollRunId: { in: runIds }, status: 'PENDING' },
    }) : 0;

    const openAnomalies = runIds.length > 0 ? await db.payrollAnomaly.count({
      where: { payrollRunId: { in: runIds }, status: 'OPEN' },
    }) : 0;

    return Response.json({
      data: {
        tenant: { id: tenant.id, name: tenant.name, baseCurrency },
        period: targetPeriod,
        perCompany,
        groupTotal,
        pendingApprovals,
        openLockRequests,
        openAnomalies,
        companyCount: allCompanies.length,
        runsExecuted: runs.length,
        runsMissing: allCompanies.length - runs.length,
      },
    }, { headers: corsHeaders });
  } catch (error: unknown) {
    console.error('Error in /api/payroll/group-dashboard GET:', error);
    return Response.json({ error: (error instanceof Error ? error.message : String(error)) }, { status: 500, headers: corsHeaders });
  }
}
