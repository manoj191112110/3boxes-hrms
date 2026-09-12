import { NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';
import { isSuperAdminWithoutScope } from '@/lib/superAdminGuard';

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

/** Safely run a Prisma query — returns fallback on error instead of crashing */
async function safeQuery<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

export async function GET(request: Request) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) {
      return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    }

    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: corsHeaders() });
    }

    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const tenantId = searchParams.get('tenantId');
    const effectiveCompanyId = companyId && companyId.trim() !== '' ? companyId : null;

    // ─── GOLDEN RULE: No dummy/seed data on LIVE for super_admin ───
    if (isSuperAdminWithoutScope(decoded, effectiveCompanyId, tenantId, request)) {
      return NextResponse.json({
        stats: {
          totalEmployees: 0,
          activeCTCTemplates: 0,
          pendingPayrollRuns: 0,
          openComplianceItems: 0,
        },
        workflow: {
          hasComponents: false,
          hasStatutory: false,
          hasCTCTemplates: false,
          hasTaxSlabs: false,
          hasPaymentMethods: false,
          hasInputs: false,
          hasValidations: false,
          hasPayrollRuns: false,
          hasApprovedRuns: false,
          hasPayslips: false,
          hasCompliance: false,
          hasClosedRuns: false,
        },
        payrollRuns: [],
        message: 'Select a company from the switcher to view payroll data.',
      }, { headers: corsHeaders() });
    }

    // Run all queries in parallel, each safely wrapped
    const [
      totalEmployees,
      activeCTCTemplates,
      pendingPayrollRuns,
      openComplianceItems,
      componentsCount,
      statutoryCount,
      taxSlabsCount,
      paymentMethodsCount,
      inputsCount,
      validationsCount,
      payslipsCount,
      payrollRuns,
      complianceFilingsCount,
    ] = await Promise.all([
      safeQuery(() => db.employee.count({
        where: { status: 'active' },
      }), 0),
      safeQuery(() => db.cTCTemplate.count({
        where: { status: 'ACTIVE' },
      }), 0),
      safeQuery(() => db.payrollRun.count({
        where: {
          runStatus: { in: ['OPEN', 'INPUT_COLLECTION', 'PROCESSING', 'REVIEW'] },
          ...(effectiveCompanyId ? { companyId: effectiveCompanyId } : {}),
        },
      }), 0),
      safeQuery(() => db.complianceFiling.count({
        where: {
          filingStatus: { in: ['GENERATED', 'UNDER_REVIEW'] },
        },
      }), 0),
      safeQuery(() => db.payrollComponent.count({
        where: { isActive: true },
      }), 0),
      safeQuery(() => db.statutoryComponent.count(), 0),
      safeQuery(() => db.taxSlabTable.count(), 0),
      safeQuery(() => db.employeePaymentMethod.count({
        where: { status: 'active' },
      }), 0),
      safeQuery(() => db.payrollInput.count(), 0),
      safeQuery(() => db.payrollValidation.count(), 0),
      safeQuery(() => db.payroll.count({
        where: { status: 'paid' },
      }), 0),
      safeQuery(() => db.payrollRun.findMany({
        select: { runStatus: true },
        ...(effectiveCompanyId ? { where: { companyId: effectiveCompanyId } } : {}),
      }), [] as { runStatus: string }[]),
      safeQuery(() => db.complianceFiling.count({
        where: {
          filingStatus: { in: ['GENERATED', 'UNDER_REVIEW', 'SUBMITTED'] },
        },
      }), 0),
    ]);

    // Determine workflow booleans from payroll runs
    const hasPayrollRuns = payrollRuns.length > 0;
    const hasApprovedRuns = payrollRuns.some(
      (r) => r.runStatus === 'APPROVED' || r.runStatus === 'ACCOUNTING' || r.runStatus === 'DISBURSED'
    );
    const hasClosedRuns = payrollRuns.some(
      (r) => r.runStatus === 'CLOSED' || r.runStatus === 'DISBURSED'
    );

    return NextResponse.json(
      {
        stats: {
          totalEmployees,
          activeCTCTemplates,
          pendingPayrollRuns,
          openComplianceItems,
        },
        workflow: {
          hasComponents: componentsCount > 0,
          hasStatutory: statutoryCount > 0,
          hasCTCTemplates: activeCTCTemplates > 0,
          hasTaxSlabs: taxSlabsCount > 0,
          hasPaymentMethods: paymentMethodsCount > 0,
          hasInputs: inputsCount > 0,
          hasValidations: validationsCount > 0,
          hasPayrollRuns,
          hasApprovedRuns,
          hasPayslips: payslipsCount > 0,
          hasCompliance: complianceFilingsCount > 0,
          hasClosedRuns,
        },
      },
      { headers: corsHeaders() }
    );
  } catch (error: unknown) {
    console.error('Error fetching payroll summary:', error);
    // Return default data instead of 500 so the page can still render
    return NextResponse.json(
      {
        stats: { totalEmployees: 0, activeCTCTemplates: 0, pendingPayrollRuns: 0, openComplianceItems: 0 },
        workflow: {
          hasComponents: false, hasStatutory: false, hasCTCTemplates: false,
          hasTaxSlabs: false, hasPaymentMethods: false, hasInputs: false,
          hasValidations: false, hasPayrollRuns: false, hasApprovedRuns: false,
          hasPayslips: false, hasCompliance: false, hasClosedRuns: false,
        },
        _warning: 'Some data could not be loaded',
      },
      { headers: corsHeaders() }
    );
  }
}
