import { getTokenFromHeaders, verifyToken } from '@/lib/auth';
import { NextRequest } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

// GET: List income tax declarations
export async function GET(request: NextRequest) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    const decoded = await verifyToken(token);
    if (!decoded) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });

    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employeeId');
    const financialYear = searchParams.get('financialYear');
    const status = searchParams.get('status');
    const userRole = (decoded as Record<string, unknown>).role as string;

    const where: Record<string, unknown> = {};
    if (employeeId) where.employeeId = employeeId;
    if (financialYear) where.financialYear = financialYear;
    if (status) where.status = status;

    // Non-admin users can only see their own declarations
    if (userRole !== 'super_admin' && userRole !== 'tenant_admin' && userRole !== 'admin') {
      const userId = (decoded as Record<string, unknown>).userId || (decoded as Record<string, unknown>).sub;
      const emp = await db.employee.findFirst({ where: { userId: userId as string } });
      if (emp) where.employeeId = emp.id;
    }

    const declarations = await db.incomeTaxDeclaration.findMany({
      where,
      include: {
        employee: {
          select: { id: true, employeeId: true, firstName: true, lastName: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return Response.json({ data: declarations }, { headers: corsHeaders });
  } catch (error: unknown) {
    console.error('Error fetching declarations:', error);
    return Response.json({ error: (error instanceof Error ? error.message : String(error)) }, { status: 500, headers: corsHeaders });
  }
}

// POST: Create income tax declaration
export async function POST(request: NextRequest) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    const decoded = await verifyToken(token);
    if (!decoded) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });

    const body = await request.json();
    const userRole = (decoded as Record<string, unknown>).role as string;
    const userId = (decoded as Record<string, unknown>).userId || (decoded as Record<string, unknown>).sub;

    let employeeId = body.employeeId;

    // If employee is creating their own declaration
    if (!employeeId && userRole === 'admin') {
      const emp = await db.employee.findFirst({ where: { userId: userId as string } });
      if (!emp) return Response.json({ error: 'Employee profile not found' }, { status: 404, headers: corsHeaders });
      employeeId = emp.id;
    }

    if (!employeeId) {
      return Response.json({ error: 'Employee ID is required' }, { status: 400, headers: corsHeaders });
    }

    // Calculate totals
    const section80C_Total = (body.section80C_PPF || 0) + (body.section80C_ELSS || 0) +
      (body.section80C_LIC || 0) + (body.section80C_HomeLoanPrincipal || 0) + (body.section80C_Other || 0);
    const section80D_Total = (body.section80D_Self || 0) + (body.section80D_Parents || 0);

    // HRA Exemption calculation
    const hraExemption = body.hra_ActualHRA && body.hra_RentPaid && body.regimeType === 'OLD'
      ? Math.max(0, Math.min(
          body.hra_ActualHRA || 0,
          (body.basicSalary || 0) * (body.hra_IsMetro ? 0.50 : 0.40),
          Math.max(0, (body.hra_RentPaid || 0) - (body.basicSalary || 0) * 0.10)
        ))
      : 0;

    const totalDeductions = section80C_Total + section80D_Total + (body.section80CCD_NPS || 0) +
      (body.section24b_HomeLoanInterest || 0) + hraExemption +
      (body.section80E_EducationLoan || 0) + (body.section80G_Donations || 0) +
      (body.section80TTA_SavingsInterest || 0) + (body.otherDeductions || 0);

    const declaration = await db.incomeTaxDeclaration.create({
      data: {
        employeeId,
        financialYear: body.financialYear || '2024-25',
        regimeType: body.regimeType || 'NEW',
        section80C_PPF: body.section80C_PPF || 0,
        section80C_ELSS: body.section80C_ELSS || 0,
        section80C_LIC: body.section80C_LIC || 0,
        section80C_HomeLoanPrincipal: body.section80C_HomeLoanPrincipal || 0,
        section80C_Other: body.section80C_Other || 0,
        section80C_Total: Math.min(section80C_Total, 150000),
        section80D_Self: body.section80D_Self || 0,
        section80D_Parents: body.section80D_Parents || 0,
        section80D_Total,
        section80CCD_NPS: body.section80CCD_NPS || 0,
        section24b_HomeLoanInterest: body.section24b_HomeLoanInterest || 0,
        hra_ActualHRA: body.hra_ActualHRA || 0,
        hra_RentPaid: body.hra_RentPaid || 0,
        hra_IsMetro: body.hra_IsMetro || false,
        hra_ExemptionCalc: hraExemption,
        section80E_EducationLoan: body.section80E_EducationLoan || 0,
        section80G_Donations: body.section80G_Donations || 0,
        section80TTA_SavingsInterest: body.section80TTA_SavingsInterest || 0,
        otherDeductions: body.otherDeductions || 0,
        totalDeductions,
        taxableIncome: body.taxableIncome || 0,
        estimatedTax: body.estimatedTax || 0,
        status: body.status || 'DRAFT',
        submittedAt: body.status === 'SUBMITTED' ? new Date() : null,
        createdBy: userId as string,
      },
    });

    return Response.json({ data: declaration }, { status: 201, headers: corsHeaders });
  } catch (error: unknown) {
    console.error('Error creating declaration:', error);
    return Response.json({ error: (error instanceof Error ? error.message : String(error)) }, { status: 500, headers: corsHeaders });
  }
}
