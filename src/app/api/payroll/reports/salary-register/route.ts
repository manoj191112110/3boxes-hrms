import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { getTokenFromHeaders, verifyToken } from '@/lib/auth';
import { NextRequest } from 'next/server';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Default empty response when data is unavailable
const emptyRegisterResponse = {
  data: [],
  summary: { totalEmployees: 0, totalGrossPay: 0, totalDeductions: 0, totalNetPay: 0, totalEmployerContrib: 0 },
  period: '',
  mode: 'summary',
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
    const month = searchParams.get('month');
    const year = searchParams.get('year');
    const rawCompanyId = searchParams.get('companyId');
    const departmentId = searchParams.get('departmentId');
    const mode = searchParams.get('mode') || 'summary'; // summary | detailed

    if (!month || !year) {
      return Response.json({ error: 'month and year are required' }, { status: 400, headers: corsHeaders });
    }

    // Treat empty string companyId same as null
    const companyId = rawCompanyId && rawCompanyId.trim() !== '' ? rawCompanyId : null;

    const monthNum = parseInt(month);
    const yearNum = parseInt(year);
    const periodStr = `${yearNum}-${String(monthNum).padStart(2, '0')}`;

    // Build employee filter
    const employeeWhere: Record<string, unknown> = {};
    if (departmentId) {
      employeeWhere.departmentId = departmentId;
    } else if (companyId) {
      employeeWhere.department = { companyId };
    }

    // Fetch payroll records for the given period
    let payrolls: any[] = [];
    try {
      payrolls = await db.payroll.findMany({
        where: { month: monthNum, year: yearNum },
        include: {
          employee: {
            include: {
              department: { select: { name: true, id: true, companyId: true } },
              designation: { select: { title: true } },
            },
          },
        },
      });
    } catch (prismaError: unknown) {
      console.warn('Payroll table not available, skipping:', prismaError instanceof Error ? prismaError.message : String(prismaError));
      payrolls = [];
    }

    // Also try payroll run transaction lines for richer data
    let payrollRuns: { id: string }[] = [];
    try {
      payrollRuns = await db.payrollRun.findMany({
        where: {
          payrollPeriod: periodStr,
          ...(companyId ? { companyId } : {}),
        },
        select: { id: true },
      });
    } catch (prismaError: unknown) {
      console.warn('PayrollRun table not available, skipping:', prismaError instanceof Error ? prismaError.message : String(prismaError));
      payrollRuns = [];
    }

    const runIds = payrollRuns.map(r => r.id);

    // Get transaction lines if payroll runs exist
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let transactionLines: any[] = [];
    if (runIds.length > 0) {
      try {
        const tlWhere: Record<string, unknown> = {
          payrollRunId: { in: runIds },
          isReversal: false,
        };
        if (departmentId) {
          tlWhere.employee = { departmentId };
        } else if (companyId) {
          tlWhere.employee = { department: { companyId } };
        }

        transactionLines = await db.payrollTransactionLine.findMany({
          where: tlWhere,
          include: {
            employee: {
              include: {
                department: { select: { name: true, id: true, companyId: true } },
                designation: { select: { title: true } },
              },
            },
            component: { select: { code: true, name: true, componentType: true } },
          },
        });
      } catch (prismaError: unknown) {
        console.warn('PayrollTransactionLine table not available, skipping:', prismaError instanceof Error ? prismaError.message : String(prismaError));
        transactionLines = [];
      }
    }

    // Build salary register data
    const registerMap: Record<string, {
      employeeId: string;
      name: string;
      empCode: string;
      department: string;
      designation: string;
      earnings: Record<string, number>;
      deductions: Record<string, number>;
      employerContrib: Record<string, number>;
      grossPay: number;
      totalDeductions: number;
      netPay: number;
      totalEmployerContrib: number;
    }> = {};

    // If we have transaction lines, use those (more detailed)
    if (transactionLines.length > 0) {
      for (const line of transactionLines) {
        const emp = line.employee;
        if (!emp) continue;

        if (!registerMap[emp.id]) {
          registerMap[emp.id] = {
            employeeId: emp.id,
            name: `${emp.firstName} ${emp.lastName}`,
            empCode: emp.employeeId,
            department: emp.department?.name || '—',
            designation: emp.designation?.title || '—',
            earnings: {},
            deductions: {},
            employerContrib: {},
            grossPay: 0,
            totalDeductions: 0,
            netPay: 0,
            totalEmployerContrib: 0,
          };
        }

        const reg = registerMap[emp.id];
        const compCode = line.componentCode || (line.component?.code) || 'UNKNOWN';
        const compName = line.component?.name || compCode;
        const label = mode === 'detailed' ? `${compName} (${compCode})` : compCode;

        if (line.componentType === 'EARNING') {
          reg.earnings[label] = (reg.earnings[label] || 0) + (line.finalAmount || 0);
          reg.grossPay += line.finalAmount || 0;
        } else if (line.componentType === 'DEDUCTION' || line.componentType === 'EMPLOYEE_CONTRIB') {
          reg.deductions[label] = (reg.deductions[label] || 0) + (line.finalAmount || 0);
          reg.totalDeductions += line.finalAmount || 0;
        } else if (line.componentType === 'EMPLOYER_CONTRIB') {
          reg.employerContrib[label] = (reg.employerContrib[label] || 0) + (line.finalAmount || 0);
          reg.totalEmployerContrib += line.finalAmount || 0;
        }
      }

      // Calculate net pay
      for (const reg of Object.values(registerMap)) {
        reg.netPay = reg.grossPay - reg.totalDeductions;
      }
    } else {
      // Fall back to Payroll model data
      for (const payroll of payrolls) {
        const emp = payroll.employee;
        if (!emp) continue;
        // Apply department/company filter
        if (departmentId && emp.departmentId !== departmentId) continue;
        if (companyId && emp.department?.companyId !== companyId) continue;

        registerMap[emp.id] = {
          employeeId: emp.id,
          name: `${emp.firstName} ${emp.lastName}`,
          empCode: emp.employeeId,
          department: emp.department?.name || '—',
          designation: emp.designation?.title || '—',
          earnings: {
            'Basic Salary': payroll.basicSalary || 0,
            'HRA': payroll.hra || 0,
            'DA': payroll.da || 0,
            'Conveyance': payroll.conveyance || 0,
            'Medical': payroll.medical || 0,
            'Other Allowances': payroll.otherAllowances || 0,
          },
          deductions: {
            'PF': payroll.pf || 0,
            'ESI': payroll.esi || 0,
            'Tax': payroll.tax || 0,
            'Professional Tax': payroll.professionalTax || 0,
            'Other Deductions': payroll.otherDeductions || 0,
          },
          employerContrib: {},
          grossPay: payroll.grossSalary || 0,
          totalDeductions: payroll.totalDeductions || 0,
          netPay: payroll.netSalary || 0,
          totalEmployerContrib: 0,
        };
      }
    }

    const registerData = Object.values(registerMap).sort((a, b) => a.name.localeCompare(b.name));

    // Summary totals
    const summary = {
      totalEmployees: registerData.length,
      totalGrossPay: registerData.reduce((s, r) => s + r.grossPay, 0),
      totalDeductions: registerData.reduce((s, r) => s + r.totalDeductions, 0),
      totalNetPay: registerData.reduce((s, r) => s + r.netPay, 0),
      totalEmployerContrib: registerData.reduce((s, r) => s + r.totalEmployerContrib, 0),
    };

    return Response.json({
      data: registerData,
      summary,
      period: periodStr,
      mode,
    }, { headers: corsHeaders });
  } catch (error: unknown) {
    console.error('Error generating salary register:', error);
    // Return empty data instead of 500 so the reports page can still render
    const errMsg = error instanceof Error ? error.message : String(error);
    if (errMsg.includes('Unauthorized') || errMsg.includes('token')) {
      return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
    }
    return Response.json({
      ...emptyRegisterResponse,
      _warning: 'Salary register data could not be loaded',
    }, { headers: corsHeaders });
  }
}
