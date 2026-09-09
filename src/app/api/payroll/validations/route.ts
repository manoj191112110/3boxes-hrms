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
    const companyId = searchParams.get('companyId');
    const validationType = searchParams.get('validationType');
    const status = searchParams.get('status');

    const where: Record<string, unknown> = {};
    if (companyId) where.companyId = companyId;
    if (validationType) where.validationType = validationType;
    if (status) where.status = status;

    try {
      const data = await db.payrollValidation.findMany({
        where,
        orderBy: { createdAt: 'desc' },
      });

      return Response.json({ data }, { headers: corsHeaders });
    } catch (dbError: unknown) {
      console.error('Database error fetching validations:', dbError);
      return Response.json({ data: [] }, { headers: corsHeaders });
    }
  } catch (error: unknown) {
    console.error('Error fetching validations:', error);
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
    const { companyId, payrollRunId, periodStart, periodEnd } = body;

    if (!companyId) {
      return Response.json({ error: 'companyId is required' }, { status: 400, headers: corsHeaders });
    }

    // Determine the period range for checking joiners/terminations
    const periodStartDate = periodStart ? new Date(periodStart) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const periodEndDate = periodEnd ? new Date(periodEnd) : new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);

    // 1. Total active employees for this company
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let allEmployees: any[] = [];
    try {
      allEmployees = await db.employee.findMany({
        where: { department: { companyId } },
        include: {
          department: { select: { name: true, companyId: true } },
          designation: { select: { title: true } },
          employeePaymentMethods: { where: { status: 'active' } },
          payrollHolds: { where: { status: 'active' } },
        },
      });
    } catch (dbError: unknown) {
      console.error('Database error fetching employees for validation:', dbError);
      return Response.json({ error: 'Service temporarily unavailable' }, { status: 503, headers: corsHeaders });
    }

    const totalEmployees = allEmployees.length;

    // 2. Employees missing payment methods (no active EmployeePaymentMethod and no bank details on Employee)
    const missingPaymentMethods = allEmployees.filter(emp =>
      emp.employeePaymentMethods && Array.isArray(emp.employeePaymentMethods) &&
      emp.employeePaymentMethods.length === 0 &&
      (!emp.bankAccountNo || !emp.bankIfscCode)
    ).map(emp => ({
      id: emp.id,
      employeeId: emp.employeeId,
      firstName: emp.firstName,
      lastName: emp.lastName,
      email: emp.email,
      department: emp.department?.name,
      designation: emp.designation?.title,
    }));

    // 3. Employees missing salary basis
    const missingSalaryBasis = allEmployees.filter(emp => emp.salary === null || emp.salary === 0)
      .map(emp => ({
        id: emp.id,
        employeeId: emp.employeeId,
        firstName: emp.firstName,
        lastName: emp.lastName,
        email: emp.email,
        department: emp.department?.name,
        designation: emp.designation?.title,
      }));

    // 4. Employees with active payroll holds
    const heldEmployees = allEmployees.filter(emp =>
      emp.payrollHolds && Array.isArray(emp.payrollHolds) &&
      emp.payrollHolds.length > 0
    ).map(emp => ({
      id: emp.id,
      employeeId: emp.employeeId,
      firstName: emp.firstName,
      lastName: emp.lastName,
      email: emp.email,
      department: emp.department?.name,
      designation: emp.designation?.title,
      holdType: emp.payrollHolds[0]?.holdType,
      holdReason: emp.payrollHolds[0]?.reason,
      holdFromPeriod: emp.payrollHolds[0]?.holdFromPeriod,
    }));

    // 5. New joiners in the period
    const newJoiners = allEmployees.filter(emp => {
      const doj = new Date(emp.dateOfJoining);
      return doj >= periodStartDate && doj <= periodEndDate;
    }).map(emp => ({
      id: emp.id,
      employeeId: emp.employeeId,
      firstName: emp.firstName,
      lastName: emp.lastName,
      email: emp.email,
      department: emp.department?.name,
      designation: emp.designation?.title,
      dateOfJoining: emp.dateOfJoining,
    }));

    // 6. Terminated/resigned employees in the period
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let terminatedInPeriod: any[] = [];
    try {
      terminatedInPeriod = await db.employee.findMany({
        where: {
          department: { companyId },
          status: { in: ['terminated', 'resigned'] },
          updatedAt: { gte: periodStartDate, lte: periodEndDate },
        },
        include: {
          department: { select: { name: true } },
          designation: { select: { title: true } },
          separations: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
      });
    } catch (dbError: unknown) {
      console.error('Database error fetching terminated employees for validation:', dbError);
      terminatedInPeriod = [];
    }

    const terminations = terminatedInPeriod.map(emp => ({
      id: emp.id,
      employeeId: emp.employeeId,
      firstName: emp.firstName,
      lastName: emp.lastName,
      email: emp.email,
      department: emp.department?.name,
      designation: emp.designation?.title,
      status: emp.status,
      separationType: emp.separations?.[0]?.type,
      lastWorkingDate: emp.separations?.[0]?.lastWorkingDate,
    }));

    // 7. Compute errors and warnings
    const errors: { type: string; message: string; employeeIds?: string[] }[] = [];
    const warnings: { type: string; message: string; employeeIds?: string[] }[] = [];

    if (missingPaymentMethods.length > 0) {
      errors.push({
        type: 'MISSING_PAYMENT_METHOD',
        message: `${missingPaymentMethods.length} employee(s) missing bank details / payment method`,
        employeeIds: missingPaymentMethods.map(e => e.employeeId),
      });
    }
    if (missingSalaryBasis.length > 0) {
      errors.push({
        type: 'MISSING_SALARY_BASIS',
        message: `${missingSalaryBasis.length} employee(s) missing salary basis`,
        employeeIds: missingSalaryBasis.map(e => e.employeeId),
      });
    }
    if (heldEmployees.length > 0) {
      warnings.push({
        type: 'PAYROLL_HOLD',
        message: `${heldEmployees.length} employee(s) have active payroll holds`,
        employeeIds: heldEmployees.map(e => e.employeeId),
      });
    }
    if (newJoiners.length > 0) {
      warnings.push({
        type: 'NEW_JOINERS',
        message: `${newJoiners.length} new joiner(s) in this period — verify pro-rata calculation`,
        employeeIds: newJoiners.map(e => e.employeeId),
      });
    }
    if (terminations.length > 0) {
      warnings.push({
        type: 'TERMINATIONS',
        message: `${terminations.length} terminated/resigned employee(s) in this period — verify final settlement`,
        employeeIds: terminations.map(e => e.employeeId),
      });
    }

    // Compute valid vs invalid
    const invalidEmployeeIds = new Set([
      ...missingPaymentMethods.map(e => e.id),
      ...missingSalaryBasis.map(e => e.id),
    ]);
    const validEmployees = totalEmployees - invalidEmployeeIds.size;
    const invalidEmployees = invalidEmployeeIds.size;

    // Create the validation record
    try {
      const validation = await db.payrollValidation.create({
        data: {
          payrollRunId: payrollRunId || null,
          companyId,
          validationType: 'PRE_PAYROLL',
          status: errors.length > 0 ? 'failed' : 'completed',
          missingPaymentMethods: JSON.stringify(missingPaymentMethods),
          missingSalaryBasis: JSON.stringify(missingSalaryBasis),
          heldEmployees: JSON.stringify(heldEmployees),
          newJoiners: JSON.stringify(newJoiners),
          terminations: JSON.stringify(terminations),
          errors: JSON.stringify(errors),
          warnings: JSON.stringify(warnings),
          totalEmployees,
          validEmployees,
          invalidEmployees,
          runBy: decoded.userId as string,
        },
      });

      return Response.json({
        data: validation,
        summary: {
          totalEmployees,
          validEmployees,
          invalidEmployees,
          missingPaymentMethods: missingPaymentMethods.length,
          missingSalaryBasis: missingSalaryBasis.length,
          heldEmployees: heldEmployees.length,
          newJoiners: newJoiners.length,
          terminations: terminations.length,
          errors: errors.length,
          warnings: warnings.length,
        },
        message: 'Pre-payroll validation completed',
      }, { headers: corsHeaders });
    } catch (dbError: unknown) {
      console.error('Database error creating validation record:', dbError);
      // Return computed validation data even if we can't persist it
      return Response.json({
        data: {
          validationType: 'PRE_PAYROLL',
          status: errors.length > 0 ? 'failed' : 'completed',
          totalEmployees,
          validEmployees,
          invalidEmployees,
        },
        summary: {
          totalEmployees,
          validEmployees,
          invalidEmployees,
          missingPaymentMethods: missingPaymentMethods.length,
          missingSalaryBasis: missingSalaryBasis.length,
          heldEmployees: heldEmployees.length,
          newJoiners: newJoiners.length,
          terminations: terminations.length,
          errors: errors.length,
          warnings: warnings.length,
        },
        message: 'Pre-payroll validation completed (results not persisted)',
      }, { headers: corsHeaders });
    }
  } catch (error: unknown) {
    console.error('Error running validation:', error);
    return Response.json({ error: (error instanceof Error ? error.message : String(error)) }, { status: 500, headers: corsHeaders });
  }
}
