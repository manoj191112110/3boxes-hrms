// REQ-PAY-19: Minimum Wage Configuration & Validation
// ----------------------------------------------------
// Per-country (and optionally per-state/region) minimum wage config.
// Used by:
//   • The AI anomaly detection engine to flag MIN_WAGE_BREACH anomalies
//     (see /api/payroll/ai/anomalies)
//   • The pre-payroll validation API to add minimum-wage checks
//
// A "default" entry has regionCode=null (national default). Region-specific
// entries (e.g. regionCode='CA' for California) override the default for
// that region.

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

// GET /api/payroll/minimum-wage
//   ?countryCode=US
//   ?regionCode=CA
//   ?active=true
export async function GET(request: NextRequest) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    const decoded = await verifyToken(token);
    if (!decoded) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });

    const { searchParams } = new URL(request.url);
    const countryCode = searchParams.get('countryCode');
    const regionCode = searchParams.get('regionCode');
    const active = searchParams.get('active');

    const where: Record<string, unknown> = {};
    if (countryCode) where.countryCode = countryCode.toUpperCase();
    if (regionCode) where.regionCode = regionCode.toUpperCase();
    if (active === 'true') where.isActive = true;

    let data: unknown[] = [];
    try {
      data = await db.minimumWageConfig.findMany({
        where,
        orderBy: [{ countryCode: 'asc' }, { regionCode: 'asc' }, { effectiveFrom: 'desc' }],
        take: 200,
      });
    } catch (dbError: unknown) {
      console.error('DB error fetching minimum wage config:', dbError);
    }

    const arr = data as Array<{ countryCode: string; wageType: string; isActive: boolean }>;
    const summary = {
      total: arr.length,
      active: arr.filter((d) => d.isActive).length,
      inactive: arr.filter((d) => !d.isActive).length,
      byCountry: arr.reduce((acc, d) => { acc[d.countryCode] = (acc[d.countryCode] || 0) + 1; return acc; }, {} as Record<string, number>),
      byWageType: arr.reduce((acc, d) => { acc[d.wageType] = (acc[d.wageType] || 0) + 1; return acc; }, {} as Record<string, number>),
    };

    return Response.json({ data, summary }, { headers: corsHeaders });
  } catch (error: unknown) {
    console.error('Error in /api/payroll/minimum-wage GET:', error);
    return Response.json({ error: (error instanceof Error ? error.message : String(error)) }, { status: 500, headers: corsHeaders });
  }
}

// POST /api/payroll/minimum-wage
//   body: { countryCode, regionCode?, wageType?, minimumAmount, currencyCode,
//           effectiveFrom?, effectiveTo?, applicability?, sourceName?, sourceUrl?,
//           companyId? }
export async function POST(request: NextRequest) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    const decoded = await verifyToken(token);
    if (!decoded) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });

    const body = await request.json();
    if (!body.countryCode) return Response.json({ error: 'countryCode required' }, { status: 400, headers: corsHeaders });
    if (typeof body.minimumAmount !== 'number' || body.minimumAmount <= 0) {
      return Response.json({ error: 'minimumAmount must be a positive number' }, { status: 400, headers: corsHeaders });
    }
    if (!body.currencyCode) return Response.json({ error: 'currencyCode required' }, { status: 400, headers: corsHeaders });

    const created = await db.minimumWageConfig.create({
      data: {
        countryCode: String(body.countryCode).toUpperCase(),
        regionCode: body.regionCode ? String(body.regionCode).toUpperCase() : null,
        wageType: body.wageType || 'MONTHLY',
        minimumAmount: body.minimumAmount,
        currencyCode: body.currencyCode,
        effectiveFrom: body.effectiveFrom ? new Date(body.effectiveFrom) : new Date(),
        effectiveTo: body.effectiveTo ? new Date(body.effectiveTo) : null,
        applicability: body.applicability || 'ALL',
        sourceName: body.sourceName || null,
        sourceUrl: body.sourceUrl || null,
        companyId: body.companyId || null,
        isActive: true,
      },
    });

    return Response.json({ data: created, message: 'Minimum wage configuration created' }, { headers: corsHeaders });
  } catch (error: unknown) {
    console.error('Error in /api/payroll/minimum-wage POST:', error);
    return Response.json({ error: (error instanceof Error ? error.message : String(error)) }, { status: 500, headers: corsHeaders });
  }
}

// PATCH /api/payroll/minimum-wage
//   body: { id, isActive?, effectiveTo?, minimumAmount?, ... }
export async function PATCH(request: NextRequest) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    const decoded = await verifyToken(token);
    if (!decoded) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });

    const body = await request.json();
    if (!body.id) return Response.json({ error: 'id required' }, { status: 400, headers: corsHeaders });

    const updateData: Record<string, unknown> = {};
    if (typeof body.isActive === 'boolean') updateData.isActive = body.isActive;
    if (body.effectiveTo) updateData.effectiveTo = new Date(body.effectiveTo);
    if (typeof body.minimumAmount === 'number') updateData.minimumAmount = body.minimumAmount;
    if (body.applicability) updateData.applicability = body.applicability;
    if (typeof body.sourceName === 'string') updateData.sourceName = body.sourceName;
    if (typeof body.sourceUrl === 'string') updateData.sourceUrl = body.sourceUrl;

    const updated = await db.minimumWageConfig.update({
      where: { id: body.id },
      data: updateData,
    });

    return Response.json({ data: updated }, { headers: corsHeaders });
  } catch (error: unknown) {
    console.error('Error in /api/payroll/minimum-wage PATCH:', error);
    return Response.json({ error: (error instanceof Error ? error.message : String(error)) }, { status: 500, headers: corsHeaders });
  }
}
