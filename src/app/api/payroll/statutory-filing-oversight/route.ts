// REQ-7.2: Statutory Filing Oversight (Tenant Admin)
// ---------------------------------------------------
// A centralized dashboard showing which sub-companies have completed their
// statutory tax filings for the period and which are overdue. Status is
// computed as a Red/Amber/Green traffic light:
//
//   GREEN    — filing submitted & acknowledged, OR not yet due
//   AMBER    — filing due within the reminder window (default 7 days) but
//               not yet submitted, OR submitted but not acknowledged
//   RED      — filing overdue (past due date + grace days), no submission
//
// The endpoint aggregates across all ComplianceObligation × ComplianceFiling
// rows for the period, grouped by company.

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

const REMINDER_DAYS = 7; // AMBER window before due date

// GET /api/payroll/statutory-filing-oversight
//   ?period=2026-06   → defaults to current month
//   ?countryCode=US   → filter
//   ?status=RED       → filter
export async function GET(request: NextRequest) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    const decoded = await verifyToken(token);
    if (!decoded) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });

    const { searchParams } = new URL(request.url);
    let period = searchParams.get('period');
    const countryCodeFilter = searchParams.get('countryCode');
    const statusFilter = searchParams.get('status');

    if (!period) {
      const now = new Date();
      period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }

    // Resolve user's tenant
    const user = await db.user.findUnique({
      where: { id: decoded.userId as string },
      select: { tenantId: true },
    });
    if (!user) return Response.json({ error: 'User not found' }, { status: 404, headers: corsHeaders });

    const groups = await db.companyGroup.findMany({
      where: { tenantId: user.tenantId },
      include: { companies: { select: { id: true, name: true, country: true, currency: true } } },
    });
    const allCompanies = groups.flatMap((g) => g.companies.map((c) => ({ ...c, groupName: g.name })));
    const companyIds = allCompanies.map((c) => c.id);

    // Active obligations (optionally country-filtered)
    const obligationWhere: Record<string, unknown> = { isActive: true };
    if (countryCodeFilter) obligationWhere.countryCode = countryCodeFilter.toUpperCase();
    const obligations = await db.complianceObligation.findMany({ where: obligationWhere });

    // Filings for the period
    const filingWhere: Record<string, unknown> = { filingPeriod: period };
    if (countryCodeFilter) filingWhere.compliance = { countryCode: countryCodeFilter.toUpperCase() };
    const filings = await db.complianceFiling.findMany({
      where: filingWhere,
      include: { compliance: true, payrollRun: { select: { companyId: true } } },
    });

    // Map: complianceId → filing
    const filingByCompliance = new Map<string, typeof filings>();
    for (const f of filings) {
      const arr = filingByCompliance.get(f.complianceId) || [];
      arr.push(f);
      filingByCompliance.set(f.complianceId, arr);
    }

    // Build per-company rows
    const rows: Array<{
      companyId: string;
      companyName: string;
      country: string | null;
      groupName: string;
      obligations: Array<{
        obligationId: string;
        name: string;
        countryCode: string;
        authorityName: string;
        filingType: string;
        frequency: string;
        dueDateRule: string;
        graceDays: number | null;
        filingStatus: string;
        submittedDate: Date | null;
        acknowledgementRef: string | null;
        filingId: string | null;
        trafficLight: 'GREEN' | 'AMBER' | 'RED';
        daysUntilDue: number | null;
      }>;
      summary: { green: number; amber: number; red: number; total: number };
    }> = [];

    const now = new Date();
    for (const co of allCompanies) {
      const coObligations = obligations.filter((o) => !o.companyId || o.companyId === co.id);
      const coRows: Array<{
        obligationId: string; name: string; countryCode: string; authorityName: string;
        filingType: string; frequency: string; dueDateRule: string; graceDays: number | null;
        filingStatus: string; submittedDate: Date | null; acknowledgementRef: string | null;
        filingId: string | null; trafficLight: 'GREEN' | 'AMBER' | 'RED'; daysUntilDue: number | null;
      }> = [];

      for (const ob of coObligations) {
        const matchingFilings = (filingByCompliance.get(ob.id) || []).filter((f) => f.payrollRun?.companyId === co.id || !f.payrollRunId);
        const filing = matchingFilings[0] || null;

        // Compute the next due date based on dueDateRule (e.g. "D+15" = 15th of next month)
        const { dueDate, daysUntilDue } = computeDueDate(ob.dueDateRule, period, ob.graceDays || 0, now);

        let trafficLight: 'GREEN' | 'AMBER' | 'RED' = 'GREEN';
        let filingStatus = 'NOT_DUE';

        if (!filing) {
          // No filing — check if due
          if (dueDate && daysUntilDue !== null) {
            if (daysUntilDue < 0) {
              trafficLight = 'RED';
              filingStatus = 'OVERDUE';
            } else if (daysUntilDue <= REMINDER_DAYS) {
              trafficLight = 'AMBER';
              filingStatus = 'DUE_SOON';
            } else {
              trafficLight = 'GREEN';
              filingStatus = 'NOT_DUE';
            }
          } else {
            trafficLight = 'AMBER';
            filingStatus = 'PENDING';
          }
        } else if (filing.filingStatus === 'ACKNOWLEDGED') {
          trafficLight = 'GREEN';
          filingStatus = 'ACKNOWLEDGED';
        } else if (filing.filingStatus === 'SUBMITTED') {
          trafficLight = 'AMBER';
          filingStatus = 'SUBMITTED_PENDING_ACK';
        } else if (filing.filingStatus === 'REJECTED') {
          trafficLight = 'RED';
          filingStatus = 'REJECTED';
        } else {
          trafficLight = 'AMBER';
          filingStatus = filing.filingStatus;
        }

        // Filter by status if requested
        if (statusFilter && trafficLight !== statusFilter) continue;

        coRows.push({
          obligationId: ob.id,
          name: ob.name,
          countryCode: ob.countryCode,
          authorityName: ob.authorityName,
          filingType: ob.filingType,
          frequency: ob.frequency,
          dueDateRule: ob.dueDateRule,
          graceDays: ob.graceDays,
          filingStatus,
          submittedDate: filing?.submittedDate || null,
          acknowledgementRef: filing?.acknowledgementRef || null,
          filingId: filing?.id || null,
          trafficLight,
          daysUntilDue,
        });
      }

      const summary = {
        green: coRows.filter((r) => r.trafficLight === 'GREEN').length,
        amber: coRows.filter((r) => r.trafficLight === 'AMBER').length,
        red: coRows.filter((r) => r.trafficLight === 'RED').length,
        total: coRows.length,
      };

      if (coRows.length > 0) {
        rows.push({
          companyId: co.id,
          companyName: co.name,
          country: co.country,
          groupName: co.groupName,
          obligations: coRows,
          summary,
        });
      }
    }

    // Group-level summary
    const groupSummary = {
      totalCompanies: allCompanies.length,
      companiesWithFilings: rows.length,
      companiesRed: rows.filter((r) => r.summary.red > 0).length,
      companiesAmber: rows.filter((r) => r.summary.red === 0 && r.summary.amber > 0).length,
      companiesGreen: rows.filter((r) => r.summary.red === 0 && r.summary.amber === 0 && r.summary.green > 0).length,
      totalGreen: rows.reduce((s, r) => s + r.summary.green, 0),
      totalAmber: rows.reduce((s, r) => s + r.summary.amber, 0),
      totalRed: rows.reduce((s, r) => s + r.summary.red, 0),
    };

    return Response.json({
      data: {
        period,
        perCompany: rows,
        groupSummary,
      },
    }, { headers: corsHeaders });
  } catch (error: unknown) {
    console.error('Error in /api/payroll/statutory-filing-oversight GET:', error);
    return Response.json({ error: (error instanceof Error ? error.message : String(error)) }, { status: 500, headers: corsHeaders });
  }
}

// Parse a due-date rule like "D+15" or "EOM+0" into a concrete date for the period.
function computeDueDate(rule: string, period: string, graceDays: number, now: Date): { dueDate: Date | null; daysUntilDue: number | null } {
  const [yearStr, monthStr] = period.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10); // 1..12
  if (!year || !month) return { dueDate: null, daysUntilDue: null };

  let dueDate: Date | null = null;

  // "D+15" → 15th of the FOLLOWING month
  const dPlusMatch = rule.match(/^D\+(\d+)$/);
  if (dPlusMatch) {
    const day = parseInt(dPlusMatch[1], 10);
    const followMonth = month === 12 ? 1 : month + 1;
    const followYear = month === 12 ? year + 1 : year;
    dueDate = new Date(followYear, followMonth - 1, day);
  } else if (rule === 'EOM' || rule === 'EOM+0') {
    // End of current period month
    dueDate = new Date(year, month, 0); // last day of `month`
  } else if (rule.startsWith('EOM+')) {
    const plusDays = parseInt(rule.substring(4), 10);
    dueDate = new Date(year, month, 0);
    dueDate.setDate(dueDate.getDate() + plusDays);
  } else {
    // Unknown rule — assume end of next month as a safe fallback
    const followMonth = month === 12 ? 1 : month + 1;
    const followYear = month === 12 ? year + 1 : year;
    dueDate = new Date(followYear, followMonth, 0);
  }

  // Add grace days
  if (dueDate && graceDays > 0) {
    dueDate = new Date(dueDate.getTime() + graceDays * 24 * 60 * 60 * 1000);
  }

  const daysUntilDue = dueDate ? Math.ceil((dueDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)) : null;

  return { dueDate, daysUntilDue };
}
