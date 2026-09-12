// REQ-AI-PAY-02: Statutory Compliance Change Tracking
// ----------------------------------------------------
// Surfaces upcoming changes scraped / ingested from tax authority websites
// or legal feeds. The Tenant Admin acknowledges / applies each alert so
// the rules engine can be updated before the effective date.
//
// In a production deployment, an external job (cron / Zapier / n8n / custom
// scraper) would POST new alerts into this endpoint. The endpoint also
// ships with a "seed demo alerts" mode (?seed=true) that synthesizes a
// few realistic alerts so the UI has something to render in a fresh tenant.

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

// GET /api/payroll/ai/compliance-alerts
//   ?countryCode=US     → filter by country
//   ?status=NEW         → status filter
//   ?impactLevel=HIGH   → impact filter
//   ?effectiveWithinDays=30 → only alerts effective within N days
export async function GET(request: NextRequest) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    const decoded = await verifyToken(token);
    if (!decoded) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });

    const { searchParams } = new URL(request.url);
    const countryCode = searchParams.get('countryCode');
    const status = searchParams.get('status');
    const impactLevel = searchParams.get('impactLevel');
    const effectiveWithinDays = searchParams.get('effectiveWithinDays');
    const seed = searchParams.get('seed') === 'true';

    // Seed a few realistic demo alerts on first request
    if (seed) {
      await seedDemoAlerts();
    }

    const where: Record<string, unknown> = {};
    if (countryCode) where.countryCode = countryCode.toUpperCase();
    if (status) where.status = status;
    if (impactLevel) where.impactLevel = impactLevel;

    if (effectiveWithinDays) {
      const days = parseInt(effectiveWithinDays, 10);
      const now = new Date();
      const horizon = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
      where.effectiveDate = { gte: now, lte: horizon };
    }

    let alerts: unknown[] = [];
    try {
      alerts = await db.complianceChangeAlert.findMany({
        where,
        orderBy: [{ effectiveDate: 'asc' }, { impactLevel: 'desc' }],
        take: 200,
      });
    } catch (dbError: unknown) {
      console.error('DB error fetching compliance alerts:', dbError);
    }

    const arr = alerts as Array<{ status: string; impactLevel: string; countryCode: string }>;
    const byStatus = {
      new: arr.filter((a) => a.status === 'NEW').length,
      acknowledged: arr.filter((a) => a.status === 'ACKNOWLEDGED').length,
      inReview: arr.filter((a) => a.status === 'IN_REVIEW').length,
      applied: arr.filter((a) => a.status === 'APPLIED').length,
      ignored: arr.filter((a) => a.status === 'IGNORED').length,
    };
    const byImpact = {
      critical: arr.filter((a) => a.impactLevel === 'CRITICAL').length,
      high: arr.filter((a) => a.impactLevel === 'HIGH').length,
      medium: arr.filter((a) => a.impactLevel === 'MEDIUM').length,
      low: arr.filter((a) => a.impactLevel === 'LOW').length,
    };
    const byCountry: Record<string, number> = {};
    for (const a of arr) byCountry[a.countryCode] = (byCountry[a.countryCode] || 0) + 1;

    return Response.json({
      data: alerts,
      summary: { total: arr.length, byStatus, byImpact, byCountry },
    }, { headers: corsHeaders });
  } catch (error: unknown) {
    console.error('Error in /api/payroll/ai/compliance-alerts GET:', error);
    return Response.json({ error: (error instanceof Error ? error.message : String(error)) }, { status: 500, headers: corsHeaders });
  }
}

// POST /api/payroll/ai/compliance-alerts
//   body: { countryCode, authorityName, changeType, title, description,
//           effectiveDate, impactLevel, sourceUrl?, sourceName?,
//           affectedComponents? (array of codes) }
// Creates a new alert (called by the scraper / external job).
export async function POST(request: NextRequest) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    const decoded = await verifyToken(token);
    if (!decoded) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });

    const body = await request.json();
    const required = ['countryCode', 'authorityName', 'changeType', 'title', 'description', 'effectiveDate'];
    for (const f of required) {
      if (!body[f]) return Response.json({ error: `Missing required field: ${f}` }, { status: 400, headers: corsHeaders });
    }

    const created = await db.complianceChangeAlert.create({
      data: {
        countryCode: String(body.countryCode).toUpperCase(),
        authorityName: body.authorityName,
        changeType: body.changeType,
        title: body.title,
        description: body.description,
        sourceUrl: body.sourceUrl || null,
        sourceName: body.sourceName || null,
        effectiveDate: new Date(body.effectiveDate),
        impactLevel: body.impactLevel || 'MEDIUM',
        affectedComponents: Array.isArray(body.affectedComponents) ? JSON.stringify(body.affectedComponents) : null,
        status: 'NEW',
      },
    });

    return Response.json({ data: created, message: 'Compliance change alert created' }, { headers: corsHeaders });
  } catch (error: unknown) {
    console.error('Error in /api/payroll/ai/compliance-alerts POST:', error);
    return Response.json({ error: (error instanceof Error ? error.message : String(error)) }, { status: 500, headers: corsHeaders });
  }
}

// PATCH /api/payroll/ai/compliance-alerts  { id, status, notes }
export async function PATCH(request: NextRequest) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    const decoded = await verifyToken(token);
    if (!decoded) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });

    const body = await request.json();
    if (!body.id) return Response.json({ error: 'Alert id required' }, { status: 400, headers: corsHeaders });
    if (!['NEW', 'ACKNOWLEDGED', 'IN_REVIEW', 'APPLIED', 'IGNORED'].includes(body.status)) {
      return Response.json({ error: 'Invalid status' }, { status: 400, headers: corsHeaders });
    }

    const updateData: Record<string, unknown> = {
      status: body.status,
      notes: body.notes || null,
    };
    if (body.status === 'ACKNOWLEDGED') {
      updateData.acknowledgedBy = decoded.userId as string;
      updateData.acknowledgedAt = new Date();
    } else if (body.status === 'APPLIED') {
      updateData.appliedBy = decoded.userId as string;
      updateData.appliedAt = new Date();
    }

    const updated = await db.complianceChangeAlert.update({
      where: { id: body.id },
      data: updateData,
    });

    return Response.json({ data: updated }, { headers: corsHeaders });
  } catch (error: unknown) {
    console.error('Error in /api/payroll/ai/compliance-alerts PATCH:', error);
    return Response.json({ error: (error instanceof Error ? error.message : String(error)) }, { status: 500, headers: corsHeaders });
  }
}

// ─── Demo seed ───
// Realistic example alerts covering multiple countries and change types.
// Used so the UI has something to render before the scraper is wired up.
async function seedDemoAlerts() {
  const existing = await db.complianceChangeAlert.count();
  if (existing > 0) return; // only seed once

  const now = new Date();
  const inDays = (d: number) => new Date(now.getTime() + d * 24 * 60 * 60 * 1000);

  const demos = [
    {
      countryCode: 'US', authorityName: 'IRS', changeType: 'TAX_SLAB_CHANGE',
      title: '2026 Federal Income Tax Bracket Adjustment',
      description: 'IRS has announced an inflation adjustment to the 2026 federal income tax brackets. The 22% bracket threshold will increase by approximately 5.4%. Employers must update withholding calculations before the first payroll run in January 2026.',
      effectiveDate: inDays(45), impactLevel: 'HIGH',
      sourceUrl: 'https://www.irs.gov/newsroom/irs-provides-tax-inflation-adjustments-for-tax-year-2026',
      sourceName: 'IRS Newsroom',
      affectedComponents: JSON.stringify(['FEDERAL_TAX', 'FWT']),
    },
    {
      countryCode: 'GB', authorityName: 'HMRC', changeType: 'SS_RATE_CHANGE',
      title: 'National Insurance Contribution Rate Change',
      description: 'HMRC has confirmed the employer National Insurance rate will increase from 13.8% to 15.0% effective April 2026. The Secondary Threshold will also be reduced from £12,570 to £9,100. Update StatutoryComponent records for EMPLOYER_NIC.',
      effectiveDate: inDays(90), impactLevel: 'CRITICAL',
      sourceUrl: 'https://www.gov.uk/government/publications/national-insurance-contribution-rates',
      sourceName: 'GOV.UK',
      affectedComponents: JSON.stringify(['EMPLOYER_NIC', 'ECON']),
    },
    {
      countryCode: 'CA', authorityName: 'CRA', changeType: 'WAGE_CAP_CHANGE',
      title: 'Canada Pension Plan (CPP) Yearly Maximum Pensionable Earnings Increase',
      description: 'CPP YMPE will increase to $73,200 for 2026 (from $68,500 in 2024). The basic exemption amount remains at $3,500. Update the wageCeiling field on the CPP StatutoryComponent record.',
      effectiveDate: inDays(30), impactLevel: 'HIGH',
      sourceUrl: 'https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/payroll/calculating-cpp.html',
      sourceName: 'Canada Revenue Agency',
      affectedComponents: JSON.stringify(['CPP_EE', 'CPP_ER']),
    },
    {
      countryCode: 'IN', authorityName: 'EPFO', changeType: 'WAGE_CAP_CHANGE',
      title: 'EPF Wage Ceiling Enhancement Proposal',
      description: 'The Indian government has proposed raising the EPF wage ceiling from ₹15,000 to ₹21,000 per month. If approved in the upcoming budget, this will impact all StatutoryComponent records with componentCode = EPF_EE / EPF_ER. Monitor for budget announcement.',
      effectiveDate: inDays(120), impactLevel: 'MEDIUM',
      sourceUrl: 'https://www.epfindia.gov.in/',
      sourceName: 'EPFO Official Site',
      affectedComponents: JSON.stringify(['EPF_EE', 'EPF_ER', 'EPS_ER']),
    },
    {
      countryCode: 'AE', authorityName: 'Federal Tax Authority', changeType: 'NEW_OBLIGATION',
      title: 'UAE Corporate Tax — Payroll Cost Documentation Requirement',
      description: 'Effective Q1 2026, businesses subject to UAE Corporate Tax must maintain detailed payroll cost documentation by employee for transfer pricing audits. While there is no individual income tax in the UAE, payroll records must be retained for 7 years in the prescribed format.',
      effectiveDate: inDays(60), impactLevel: 'MEDIUM',
      sourceUrl: 'https://tax.gov.ae/',
      sourceName: 'UAE Federal Tax Authority',
      affectedComponents: JSON.stringify([]),
    },
    {
      countryCode: 'DE', authorityName: 'Bundeszentralamt für Steuern', changeType: 'FILING_FORMAT_CHANGE',
      title: 'ELStAM Electronic Wage Tax Deduction Update',
      description: 'The German ELStAM (Elektronische LohnSteuerAbzugsMerkmale) system will introduce a new XML schema version 8.0 effective January 2026. Update the statutory filing format generator for Lohnsteuer.',
      effectiveDate: inDays(75), impactLevel: 'HIGH',
      sourceUrl: 'https://www.bzst.de/',
      sourceName: 'BZSt',
      affectedComponents: JSON.stringify(['LST_DE']),
    },
    {
      countryCode: 'US', authorityName: 'Department of Labor', changeType: 'MINIMUM_WAGE_CHANGE',
      title: 'Federal Minimum Wage Proposed Increase to $17/hour',
      description: 'The Fair Labor Standards Act (FLSA) federal minimum wage is proposed to increase from $7.25 to $17.00 per hour. While the legislation is pending, employers with multi-state operations should prepare for state-level minimum wage increases already scheduled for January 2026. Update MinimumWageConfig records per state.',
      effectiveDate: inDays(180), impactLevel: 'CRITICAL',
      sourceUrl: 'https://www.dol.gov/agencies/whd/minimum-wage',
      sourceName: 'US DOL',
      affectedComponents: JSON.stringify([]),
    },
  ];

  try {
    await db.complianceChangeAlert.createMany({ data: demos });
    console.log(`[compliance-alerts] Seeded ${demos.length} demo alerts`);
  } catch (err) {
    console.error('[compliance-alerts] Seed failed:', err);
  }
}
