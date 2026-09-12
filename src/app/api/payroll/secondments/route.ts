// REQ-7.2: Cross-Border Mobility / Secondment Management
// -------------------------------------------------------
// Tracks employees seconded to a host country while keeping their home
// country social security active (e.g. via a Certificate of Coverage /
// A1 certificate / Totalization Agreement). The payroll engine uses
// these records to decide which statutory components apply in the host
// vs. home country.
//
// Lifecycle:
//   ACTIVE → COMPLETED (end date reached) | CANCELLED
//
// Use cases:
//   1. An employee from US sub-company is seconded to UK sub-company for
//      18 months. US Social Security continues (CoC issued). UK PAYE
//      applies to the host portion of pay. homePayPct=30, hostPayPct=70.
//   2. An employee from India is sent on a 6-month assignment to UAE.
//      No social security treaty — home EPF continues, host country has
//      no individual income tax. homePayPct=100, hostPayPct=0.

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

// GET /api/payroll/secondments
//   ?employeeId=...
//   ?homeCompanyId=...
//   ?hostCompanyId=...
//   ?status=ACTIVE
export async function GET(request: NextRequest) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    const decoded = await verifyToken(token);
    if (!decoded) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });

    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employeeId');
    const homeCompanyId = searchParams.get('homeCompanyId');
    const hostCompanyId = searchParams.get('hostCompanyId');
    const status = searchParams.get('status');

    const where: Record<string, unknown> = {};
    if (employeeId) where.employeeId = employeeId;
    if (homeCompanyId) where.homeCompanyId = homeCompanyId;
    if (hostCompanyId) where.hostCompanyId = hostCompanyId;
    if (status) where.status = status;

    let data: unknown[] = [];
    try {
      data = await db.crossBorderSecondment.findMany({
        where,
        include: {
          employee: {
            select: {
              id: true, employeeId: true, firstName: true, lastName: true, email: true,
              department: { select: { name: true } },
            },
          },
        },
        orderBy: [{ startDate: 'desc' }],
        take: 200,
      });
    } catch (dbError: unknown) {
      console.error('DB error fetching secondments:', dbError);
    }

    const arr = data as Array<{ status: string; homeCountry: string; hostCountry: string }>;
    const summary = {
      total: arr.length,
      active: arr.filter((s) => s.status === 'ACTIVE').length,
      completed: arr.filter((s) => s.status === 'COMPLETED').length,
      cancelled: arr.filter((s) => s.status === 'CANCELLED').length,
      byCorridor: arr.reduce((acc, s) => {
        const k = `${s.homeCountry}→${s.hostCountry}`;
        acc[k] = (acc[k] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    };

    return Response.json({ data, summary }, { headers: corsHeaders });
  } catch (error: unknown) {
    console.error('Error in /api/payroll/secondments GET:', error);
    return Response.json({ error: (error instanceof Error ? error.message : String(error)) }, { status: 500, headers: corsHeaders });
  }
}

// POST /api/payroll/secondments
//   body: { employeeId, homeCompanyId, hostCompanyId, homeCountry, hostCountry,
//           startDate, endDate?, certificateRef?, taxResidencyStatus?,
//           ssCoverageCountry?, homePayPct, hostPayPct, homeCurrency, hostCurrency,
//           notes? }
export async function POST(request: NextRequest) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    const decoded = await verifyToken(token);
    if (!decoded) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });

    const body = await request.json();
    const required = ['employeeId', 'homeCompanyId', 'hostCompanyId', 'homeCountry', 'hostCountry', 'startDate', 'homeCurrency', 'hostCurrency'];
    for (const f of required) {
      if (!body[f]) return Response.json({ error: `Missing required field: ${f}` }, { status: 400, headers: corsHeaders });
    }

    if (body.homeCompanyId === body.hostCompanyId) {
      return Response.json({ error: 'Home and host companies must differ for a secondment' }, { status: 400, headers: corsHeaders });
    }

    // Validate pay percentages sum to ~100
    const homePct = typeof body.homePayPct === 'number' ? body.homePayPct : 100;
    const hostPct = typeof body.hostPayPct === 'number' ? body.hostPayPct : 0;
    if (Math.abs(homePct + hostPct - 100) > 0.5) {
      return Response.json({ error: `homePayPct + hostPayPct must equal 100 (got ${homePct + hostPct})` }, { status: 400, headers: corsHeaders });
    }

    // Refuse if there's already an ACTIVE secondment for this employee
    const existing = await db.crossBorderSecondment.findFirst({
      where: { employeeId: body.employeeId, status: 'ACTIVE' },
    });
    if (existing) {
      return Response.json({
        error: 'Employee already has an active secondment. End the existing one before creating a new one.',
        data: existing,
      }, { status: 409, headers: corsHeaders });
    }

    const created = await db.crossBorderSecondment.create({
      data: {
        employeeId: body.employeeId,
        homeCompanyId: body.homeCompanyId,
        hostCompanyId: body.hostCompanyId,
        homeCountry: String(body.homeCountry).toUpperCase(),
        hostCountry: String(body.hostCountry).toUpperCase(),
        startDate: new Date(body.startDate),
        endDate: body.endDate ? new Date(body.endDate) : null,
        certificateRef: body.certificateRef || null,
        taxResidencyStatus: body.taxResidencyStatus || 'HOME',
        ssCoverageCountry: body.ssCoverageCountry || 'HOME',
        homePayPct: homePct,
        hostPayPct: hostPct,
        homeCurrency: body.homeCurrency,
        hostCurrency: body.hostCurrency,
        status: 'ACTIVE',
        notes: body.notes || null,
      },
    });

    return Response.json({ data: created, message: 'Secondment created' }, { headers: corsHeaders });
  } catch (error: unknown) {
    console.error('Error in /api/payroll/secondments POST:', error);
    return Response.json({ error: (error instanceof Error ? error.message : String(error)) }, { status: 500, headers: corsHeaders });
  }
}

// PATCH /api/payroll/secondments
//   body: { id, action: 'complete'|'cancel', endDate?, notes? }
//   OR    { id, homePayPct, hostPayPct, taxResidencyStatus?, ssCoverageCountry?, notes? }
export async function PATCH(request: NextRequest) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    const decoded = await verifyToken(token);
    if (!decoded) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });

    const body = await request.json();
    if (!body.id) return Response.json({ error: 'Secondment id required' }, { status: 400, headers: corsHeaders });

    const sec = await db.crossBorderSecondment.findUnique({ where: { id: body.id } });
    if (!sec) return Response.json({ error: 'Secondment not found' }, { status: 404, headers: corsHeaders });
    if (sec.status !== 'ACTIVE') {
      return Response.json({ error: `Secondment is already ${sec.status}` }, { status: 409, headers: corsHeaders });
    }

    let updateData: Record<string, unknown> = {};

    if (body.action === 'complete') {
      updateData = {
        status: 'COMPLETED',
        endDate: body.endDate ? new Date(body.endDate) : new Date(),
        notes: body.notes || sec.notes,
      };
    } else if (body.action === 'cancel') {
      updateData = {
        status: 'CANCELLED',
        endDate: new Date(),
        notes: body.notes || body.reason || 'Secondment cancelled',
      };
    } else {
      // Update details
      if (typeof body.homePayPct === 'number' && typeof body.hostPayPct === 'number') {
        if (Math.abs(body.homePayPct + body.hostPayPct - 100) > 0.5) {
          return Response.json({ error: 'homePayPct + hostPayPct must equal 100' }, { status: 400, headers: corsHeaders });
        }
        updateData.homePayPct = body.homePayPct;
        updateData.hostPayPct = body.hostPayPct;
      }
      if (body.taxResidencyStatus) updateData.taxResidencyStatus = body.taxResidencyStatus;
      if (body.ssCoverageCountry) updateData.ssCoverageCountry = body.ssCoverageCountry;
      if (typeof body.notes === 'string') updateData.notes = body.notes;
      if (body.endDate) updateData.endDate = new Date(body.endDate);
      if (body.certificateRef) updateData.certificateRef = body.certificateRef;
    }

    const updated = await db.crossBorderSecondment.update({
      where: { id: body.id },
      data: updateData,
    });

    return Response.json({ data: updated }, { headers: corsHeaders });
  } catch (error: unknown) {
    console.error('Error in /api/payroll/secondments PATCH:', error);
    return Response.json({ error: (error instanceof Error ? error.message : String(error)) }, { status: 500, headers: corsHeaders });
  }
}
