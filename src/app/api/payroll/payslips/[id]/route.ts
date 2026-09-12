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

    const payroll = await db.payroll.findUnique({
      where: { id },
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
            salary: true,
            department: { select: { name: true } },
            designation: { select: { title: true } },
          },
        },
      },
    });

    if (!payroll) return Response.json({ error: 'Payroll record not found' }, { status: 404, headers: corsHeaders });

    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    const payslipDetail = {
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
        aadhaarNumber: payroll.employee.aadhaarNumber,
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
      status: payroll.status,
      paidDate: payroll.paidDate,
      paySlip: payroll.paySlip,
      createdAt: payroll.createdAt,
      updatedAt: payroll.updatedAt,
    };

    return Response.json({ data: payslipDetail }, { headers: corsHeaders });
  } catch (error: unknown) {
    console.error('Error fetching payslip detail:', error);
    return Response.json({ error: (error instanceof Error ? error.message : String(error)) }, { status: 500, headers: corsHeaders });
  }
}
