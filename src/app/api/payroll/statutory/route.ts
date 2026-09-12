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

export async function GET(request: NextRequest) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    const decoded = await verifyToken(token);
    if (!decoded) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });

    const { searchParams } = new URL(request.url);
    const countryCode = searchParams.get('countryCode');
    const partyType = searchParams.get('partyType');

    const where: Record<string, unknown> = {};
    if (countryCode) where.countryCode = countryCode;
    if (partyType) where.partyType = partyType;

    const data = await db.statutoryComponent.findMany({
      where,
      include: { component: true },
      orderBy: { createdAt: 'desc' },
    });

    return Response.json({ data }, { headers: corsHeaders });
  } catch (error: unknown) {
    console.error('Error fetching statutory components:', error);
    return Response.json({ error: (error instanceof Error ? error.message : String(error)) }, { status: 500, headers: corsHeaders });
  }
}

export async function POST(request: NextRequest) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    const decoded = await verifyToken(token);
    if (!decoded) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });

    const body = await request.json();

    // Determine component type based on partyType
    const componentType = body.partyType === 'EMPLOYER' ? 'EMPLOYER_CONTRIB' : body.partyType === 'BOTH' ? 'EMPLOYER_CONTRIB' : 'EMPLOYEE_CONTRIB';

    // Auto-create a PayrollComponent first
    const payrollComponent = await db.payrollComponent.create({
      data: {
        code: body.componentCode,
        name: body.componentName,
        componentType,
        componentCategory: 'STATUTORY',
        countryCode: body.countryCode || 'IND',
        calculationType: body.calculationBasis === 'FLAT_RATE' ? 'FLAT_AMOUNT' : body.calculationBasis === 'SLAB_BASED' ? 'SLAB_BASED' : 'PERCENTAGE',
        defaultValue: body.ratePercentage || 0,
        percentageBase: body.calculationBasis === 'BASIC_PAY' ? 'BASIC' : body.calculationBasis === 'GROSS_PAY' ? 'GROSS' : null,
        isTaxable: false,
        taxTreatment: 'EXEMPT',
        affectsGross: false,
        affectsNet: true,
        affectsCTC: body.partyType !== 'EMPLOYEE',
        paymentFrequency: body.remittanceFrequency || 'MONTHLY',
        prorationApplicable: false,
        isActive: true,
        effectiveFrom: body.effectiveFrom ? new Date(body.effectiveFrom) : new Date(),
        effectiveTo: body.effectiveTo ? new Date(body.effectiveTo) : null,
      },
    });

    // Create StatutoryComponent linking to the PayrollComponent
    const data = await db.statutoryComponent.create({
      data: {
        componentId: payrollComponent.id,
        componentCode: body.componentCode,
        componentName: body.componentName,
        countryCode: body.countryCode || 'IND',
        authorityName: body.authorityName,
        authorityCode: body.authorityCode || null,
        partyType: body.partyType || 'EMPLOYEE',
        calculationBasis: body.calculationBasis || 'BASIC_PAY',
        basisComponentId: body.basisComponentId || null,
        ratePercentage: body.ratePercentage ? parseFloat(body.ratePercentage) : null,
        wageCeiling: body.wageCeiling ? parseFloat(body.wageCeiling) : null,
        maxContributionAmt: body.maxContributionAmt ? parseFloat(body.maxContributionAmt) : null,
        minContributionAmt: body.minContributionAmt ? parseFloat(body.minContributionAmt) : null,
        slabTableId: body.slabTableId || null,
        remittanceFrequency: body.remittanceFrequency || 'MONTHLY',
        remittanceDueDay: body.remittanceDueDay ? parseInt(body.remittanceDueDay) : null,
        filingFrequency: body.filingFrequency || null,
        filingFormat: body.filingFormat || null,
        penaltyRatePct: body.penaltyRatePct ? parseFloat(body.penaltyRatePct) : null,
        isChallanRequired: body.isChallanRequired || false,
        challanFormat: body.challanFormat || null,
        effectiveFrom: body.effectiveFrom ? new Date(body.effectiveFrom) : new Date(),
        effectiveTo: body.effectiveTo ? new Date(body.effectiveTo) : null,
      },
      include: { component: true },
    });

    return Response.json({ data, message: 'Statutory component created successfully' }, { headers: corsHeaders });
  } catch (error: unknown) {
    console.error('Error creating statutory component:', error);
    return Response.json({ error: (error instanceof Error ? error.message : String(error)) }, { status: 500, headers: corsHeaders });
  }
}
