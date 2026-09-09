import { getTokenFromHeaders, verifyToken } from '@/lib/auth';
import { NextRequest } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

// GET: Single declaration
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    const decoded = await verifyToken(token);
    if (!decoded) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });

    const { id } = await params;
    const declaration = await db.incomeTaxDeclaration.findUnique({
      where: { id },
      include: {
        employee: {
          select: { id: true, employeeId: true, firstName: true, lastName: true, email: true },
        },
      },
    });

    if (!declaration) {
      return Response.json({ error: 'Declaration not found' }, { status: 404, headers: corsHeaders });
    }

    return Response.json({ data: declaration }, { headers: corsHeaders });
  } catch (error: unknown) {
    console.error('Error fetching declaration:', error);
    return Response.json({ error: (error instanceof Error ? error.message : String(error)) }, { status: 500, headers: corsHeaders });
  }
}

// PUT: Update / approve / reject declaration
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    const decoded = await verifyToken(token);
    if (!decoded) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });

    const { id } = await params;
    const body = await request.json();
    const userRole = (decoded as Record<string, unknown>).role as string;
    const userId = (decoded as Record<string, unknown>).userId || (decoded as Record<string, unknown>).sub;

    const existing = await db.incomeTaxDeclaration.findUnique({ where: { id } });
    if (!existing) {
      return Response.json({ error: 'Declaration not found' }, { status: 404, headers: corsHeaders });
    }

    // Only admin/HR can approve/reject
    if ((body.status === 'APPROVED' || body.status === 'REJECTED') &&
        userRole !== 'super_admin' && userRole !== 'tenant_admin' && userRole !== 'admin') {
      return Response.json({ error: 'Only HR/Admin can approve or reject declarations' }, { status: 403, headers: corsHeaders });
    }

    // Calculate totals
    const section80C_Total = (body.section80C_PPF ?? existing.section80C_PPF) + (body.section80C_ELSS ?? existing.section80C_ELSS) +
      (body.section80C_LIC ?? existing.section80C_LIC) + (body.section80C_HomeLoanPrincipal ?? existing.section80C_HomeLoanPrincipal) +
      (body.section80C_Other ?? existing.section80C_Other);
    const section80D_Total = (body.section80D_Self ?? existing.section80D_Self) + (body.section80D_Parents ?? existing.section80D_Parents);

    const hraExemption = body.hra_ActualHRA !== undefined || body.hra_RentPaid !== undefined
      ? Math.max(0, Math.min(
          body.hra_ActualHRA ?? existing.hra_ActualHRA,
          (body.basicSalary ?? 0) * ((body.hra_IsMetro ?? existing.hra_IsMetro) ? 0.50 : 0.40),
          Math.max(0, (body.hra_RentPaid ?? existing.hra_RentPaid) - (body.basicSalary ?? 0) * 0.10)
        ))
      : existing.hra_ExemptionCalc;

    const totalDeductions = section80C_Total + section80D_Total +
      (body.section80CCD_NPS ?? existing.section80CCD_NPS) +
      (body.section24b_HomeLoanInterest ?? existing.section24b_HomeLoanInterest) + hraExemption +
      (body.section80E_EducationLoan ?? existing.section80E_EducationLoan) +
      (body.section80G_Donations ?? existing.section80G_Donations) +
      (body.section80TTA_SavingsInterest ?? existing.section80TTA_SavingsInterest) +
      (body.otherDeductions ?? existing.otherDeductions);

    const updateData: Record<string, unknown> = {
      section80C_PPF: body.section80C_PPF ?? existing.section80C_PPF,
      section80C_ELSS: body.section80C_ELSS ?? existing.section80C_ELSS,
      section80C_LIC: body.section80C_LIC ?? existing.section80C_LIC,
      section80C_HomeLoanPrincipal: body.section80C_HomeLoanPrincipal ?? existing.section80C_HomeLoanPrincipal,
      section80C_Other: body.section80C_Other ?? existing.section80C_Other,
      section80C_Total: Math.min(section80C_Total, 150000),
      section80D_Self: body.section80D_Self ?? existing.section80D_Self,
      section80D_Parents: body.section80D_Parents ?? existing.section80D_Parents,
      section80D_Total,
      section80CCD_NPS: body.section80CCD_NPS ?? existing.section80CCD_NPS,
      section24b_HomeLoanInterest: body.section24b_HomeLoanInterest ?? existing.section24b_HomeLoanInterest,
      hra_ActualHRA: body.hra_ActualHRA ?? existing.hra_ActualHRA,
      hra_RentPaid: body.hra_RentPaid ?? existing.hra_RentPaid,
      hra_IsMetro: body.hra_IsMetro ?? existing.hra_IsMetro,
      hra_ExemptionCalc: hraExemption,
      section80E_EducationLoan: body.section80E_EducationLoan ?? existing.section80E_EducationLoan,
      section80G_Donations: body.section80G_Donations ?? existing.section80G_Donations,
      section80TTA_SavingsInterest: body.section80TTA_SavingsInterest ?? existing.section80TTA_SavingsInterest,
      otherDeductions: body.otherDeductions ?? existing.otherDeductions,
      totalDeductions,
      taxableIncome: body.taxableIncome ?? existing.taxableIncome,
      estimatedTax: body.estimatedTax ?? existing.estimatedTax,
    };

    if (body.regimeType) updateData.regimeType = body.regimeType;
    if (body.financialYear) updateData.financialYear = body.financialYear;

    // Status transitions
    if (body.status === 'SUBMITTED') {
      updateData.status = 'SUBMITTED';
      updateData.submittedAt = new Date();
    } else if (body.status === 'APPROVED') {
      updateData.status = 'APPROVED';
      updateData.reviewedBy = userId as string;
      updateData.reviewedAt = new Date();
      updateData.reviewComments = body.reviewComments || null;
    } else if (body.status === 'REJECTED') {
      updateData.status = 'REJECTED';
      updateData.reviewedBy = userId as string;
      updateData.reviewedAt = new Date();
      updateData.reviewComments = body.reviewComments || null;
    } else if (body.status === 'DRAFT') {
      updateData.status = 'DRAFT';
    }

    const updated = await db.incomeTaxDeclaration.update({
      where: { id },
      data: updateData,
    });

    return Response.json({ data: updated }, { headers: corsHeaders });
  } catch (error: unknown) {
    console.error('Error updating declaration:', error);
    return Response.json({ error: (error instanceof Error ? error.message : String(error)) }, { status: 500, headers: corsHeaders });
  }
}

// DELETE: Delete declaration (only DRAFT can be deleted)
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    const decoded = await verifyToken(token);
    if (!decoded) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });

    const { id } = await params;
    const existing = await db.incomeTaxDeclaration.findUnique({ where: { id } });
    if (!existing) {
      return Response.json({ error: 'Declaration not found' }, { status: 404, headers: corsHeaders });
    }

    if (existing.status !== 'DRAFT') {
      return Response.json({ error: 'Only DRAFT declarations can be deleted' }, { status: 400, headers: corsHeaders });
    }

    await db.incomeTaxDeclaration.delete({ where: { id } });
    return Response.json({ message: 'Declaration deleted successfully' }, { headers: corsHeaders });
  } catch (error: unknown) {
    console.error('Error deleting declaration:', error);
    return Response.json({ error: (error instanceof Error ? error.message : String(error)) }, { status: 500, headers: corsHeaders });
  }
}
