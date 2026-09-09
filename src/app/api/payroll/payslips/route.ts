import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { getTokenFromHeaders, verifyToken } from '@/lib/auth';
import { isSuperAdminWithoutScope } from '@/lib/superAdminGuard';
import { resolveCompanyScope } from '@/lib/companyScope';
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
    const employeeId = searchParams.get('employeeId');
    const companyId = searchParams.get('companyId');
    const tenantId = searchParams.get('tenantId');
    const month = searchParams.get('month');
    const year = searchParams.get('year');

    // ─── GOLDEN RULE: No dummy/seed data on LIVE for super_admin ───
    if (isSuperAdminWithoutScope(decoded, companyId, tenantId, request)) {
      return Response.json({ data: [] }, { headers: corsHeaders });
    }

    // ─── Resolve scope (employee = own, manager = own + reports, admin = all/company) ───
    const scope = await resolveCompanyScope(request);
    if (!scope) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });

    const where: Record<string, unknown> = {
      status: { in: ['paid', 'processed'] },
    };

    // Apply data-scope filtering
    if (scope.scope === 'self' && scope.ownEmployeeId) {
      // Employee: only their own payslips
      where.employeeId = scope.ownEmployeeId;
    } else if (scope.scope === 'team' && scope.visibleEmployeeIds.length > 0) {
      // Manager: own + direct reports' payslips
      where.employeeId = { in: scope.visibleEmployeeIds };
    } else if (scope.scope === 'all' && scope.companyId) {
      // Admin with company selected
      where.employee = { companyId: scope.companyId };
    }
    // 'all' without companyId → no filter (sees all)

    // Allow employeeId override for admins/managers explicitly viewing one employee
    if (employeeId && scope.scope !== 'self') {
      // For managers, validate the requested employeeId is in their visible list
      if (scope.scope === 'team' && !scope.visibleEmployeeIds.includes(employeeId)) {
        return Response.json({ error: 'Access denied: not your direct report' }, { status: 403, headers: corsHeaders });
      }
      where.employeeId = employeeId;
    }
    if (month) where.month = parseInt(month);
    if (year) where.year = parseInt(year);

    const data = await db.payroll.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            employeeId: true,
            firstName: true,
            lastName: true,
            email: true,
            department: { select: { name: true } },
            designation: { select: { title: true } },
          },
        },
      },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });

    return Response.json({ data }, { headers: corsHeaders });
  } catch (error: unknown) {
    console.error('Error fetching payslips:', error);
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
    const { payrollId } = body;

    if (!payrollId) {
      return Response.json({ error: 'Payroll ID is required' }, { status: 400, headers: corsHeaders });
    }

    const payroll = await db.payroll.findUnique({
      where: { id: payrollId },
      include: {
        employee: {
          select: {
            id: true,
            employeeId: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            dateOfJoining: true,
            panNumber: true,
            aadhaarNumber: true,
            bankName: true,
            bankAccountNo: true,
            bankIfscCode: true,
            department: { select: { name: true } },
            designation: { select: { title: true } },
          },
        },
      },
    });

    if (!payroll) {
      return Response.json({ error: 'Payroll record not found' }, { status: 404, headers: corsHeaders });
    }

    // Generate payslip JSON data (PDF-friendly)
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const payslipData = {
      payrollId: payroll.id,
      payslipNo: `PSL-${payroll.year}${String(payroll.month).padStart(2, '0')}-${payroll.employeeId}`,
      period: {
        month: payroll.month,
        year: payroll.year,
        monthName: monthNames[payroll.month - 1],
      },
      company: {
        name: '3Boxes HRMS',
        address: '123 Business Park, Tech City',
        phone: '+1-800-3BOXES-HR',
        email: 'hr@3boxes-hrms.com',
      },
      employee: {
        employeeId: payroll.employee.employeeId,
        name: `${payroll.employee.firstName} ${payroll.employee.lastName}`,
        email: payroll.employee.email,
        phone: payroll.employee.phone,
        department: payroll.employee.department?.name,
        designation: payroll.employee.designation?.title,
        dateOfJoining: payroll.employee.dateOfJoining,
        panNumber: payroll.employee.panNumber,
        bankName: payroll.employee.bankName,
        bankAccountNo: payroll.employee.bankAccountNo,
        bankIfscCode: payroll.employee.bankIfscCode,
      },
      earnings: {
        basicSalary: payroll.basicSalary,
        hra: payroll.hra,
        da: payroll.da,
        conveyance: payroll.conveyance,
        medical: payroll.medical,
        otherAllowances: payroll.otherAllowances,
        grossSalary: payroll.grossSalary,
      },
      deductions: {
        pf: payroll.pf,
        esi: payroll.esi,
        tax: payroll.tax,
        professionalTax: payroll.professionalTax,
        otherDeductions: payroll.otherDeductions,
        totalDeductions: payroll.totalDeductions,
      },
      netPay: payroll.netSalary,
      currency: payroll.currency,
      paidDate: payroll.paidDate,
      generatedAt: new Date().toISOString(),
    };

    // Update the payroll record with payslip reference
    await db.payroll.update({
      where: { id: payrollId },
      data: { paySlip: JSON.stringify(payslipData) },
    });

    return Response.json({ data: payslipData, message: 'Payslip generated successfully' }, { headers: corsHeaders });
  } catch (error: unknown) {
    console.error('Error generating payslip:', error);
    return Response.json({ error: (error instanceof Error ? error.message : String(error)) }, { status: 500, headers: corsHeaders });
  }
}
