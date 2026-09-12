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

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = await getDb(request);
  try {
    const { id } = await params;
    const token = getTokenFromHeaders(request);
    const decoded = await verifyToken(token);
    if (!decoded) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });

    const data = await db.statutoryComponent.findUnique({
      where: { id },
      include: { component: true },
    });

    if (!data) return Response.json({ error: 'Not found' }, { status: 404, headers: corsHeaders });

    return Response.json({ data }, { headers: corsHeaders });
  } catch (error: unknown) {
    console.error('Error fetching statutory component:', error);
    return Response.json({ error: (error instanceof Error ? error.message : String(error)) }, { status: 500, headers: corsHeaders });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = await getDb(request);
  try {
    const { id } = await params;
    const token = getTokenFromHeaders(request);
    const decoded = await verifyToken(token);
    if (!decoded) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });

    const body = await request.json();

    // Get existing statutory component to find the linked PayrollComponent
    const existing = await db.statutoryComponent.findUnique({ where: { id } });
    if (!existing) return Response.json({ error: 'Not found' }, { status: 404, headers: corsHeaders });

    // Update the linked PayrollComponent
    if (existing.componentId) {
      const componentType = body.partyType === 'EMPLOYER' ? 'EMPLOYER_CONTRIB' : body.partyType === 'BOTH' ? 'EMPLOYER_CONTRIB' : 'EMPLOYEE_CONTRIB';
      await db.payrollComponent.update({
        where: { id: existing.componentId },
        data: {
          code: body.componentCode,
          name: body.componentName,
          componentType,
          countryCode: body.countryCode,
          defaultValue: body.ratePercentage || 0,
          percentageBase: body.calculationBasis === 'BASIC_PAY' ? 'BASIC' : body.calculationBasis === 'GROSS_PAY' ? 'GROSS' : null,
          paymentFrequency: body.remittanceFrequency || 'MONTHLY',
          effectiveFrom: body.effectiveFrom ? new Date(body.effectiveFrom) : undefined,
          effectiveTo: body.effectiveTo ? new Date(body.effectiveTo) : null,
        },
      });
    }

    // Update StatutoryComponent
    const data = await db.statutoryComponent.update({
      where: { id },
      data: {
        componentCode: body.componentCode,
        componentName: body.componentName,
        countryCode: body.countryCode,
        authorityName: body.authorityName,
        authorityCode: body.authorityCode || null,
        partyType: body.partyType,
        calculationBasis: body.calculationBasis,
        basisComponentId: body.basisComponentId || null,
        ratePercentage: body.ratePercentage ? parseFloat(body.ratePercentage) : null,
        wageCeiling: body.wageCeiling ? parseFloat(body.wageCeiling) : null,
        maxContributionAmt: body.maxContributionAmt ? parseFloat(body.maxContributionAmt) : null,
        minContributionAmt: body.minContributionAmt ? parseFloat(body.minContributionAmt) : null,
        slabTableId: body.slabTableId || null,
        remittanceFrequency: body.remittanceFrequency,
        remittanceDueDay: body.remittanceDueDay ? parseInt(body.remittanceDueDay) : null,
        filingFrequency: body.filingFrequency || null,
        filingFormat: body.filingFormat || null,
        penaltyRatePct: body.penaltyRatePct ? parseFloat(body.penaltyRatePct) : null,
        isChallanRequired: body.isChallanRequired || false,
        challanFormat: body.challanFormat || null,
        effectiveFrom: body.effectiveFrom ? new Date(body.effectiveFrom) : undefined,
        effectiveTo: body.effectiveTo ? new Date(body.effectiveTo) : null,
      },
      include: { component: true },
    });

    return Response.json({ data, message: 'Statutory component updated successfully' }, { headers: corsHeaders });
  } catch (error: unknown) {
    console.error('Error updating statutory component:', error);
    return Response.json({ error: (error instanceof Error ? error.message : String(error)) }, { status: 500, headers: corsHeaders });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = await getDb(request);
  try {
    const { id } = await params;
    const token = getTokenFromHeaders(request);
    const decoded = await verifyToken(token);
    if (!decoded) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });

    // Get the statutory component to find the linked PayrollComponent
    const existing = await db.statutoryComponent.findUnique({ where: { id } });

    // Delete the statutory component
    await db.statutoryComponent.delete({ where: { id } });

    // Also delete the linked PayrollComponent if it exists
    if (existing?.componentId) {
      try {
        await db.payrollComponent.delete({ where: { id: existing.componentId } });
      } catch {
        // Ignore if component already deleted or has other references
      }
    }

    return Response.json({ message: 'Statutory component deleted successfully' }, { headers: corsHeaders });
  } catch (error: unknown) {
    console.error('Error deleting statutory component:', error);
    return Response.json({ error: (error instanceof Error ? error.message : String(error)) }, { status: 500, headers: corsHeaders });
  }
}
