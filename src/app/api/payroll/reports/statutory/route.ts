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
    const type = (searchParams.get('type') || 'PF').toUpperCase(); // PF, ESI, PT, TDS
    const month = searchParams.get('month');
    const year = searchParams.get('year');
    const companyId = searchParams.get('companyId');

    if (!month || !year) {
      return Response.json({ error: 'month and year are required' }, { status: 400, headers: corsHeaders });
    }

    const monthNum = parseInt(month);
    const yearNum = parseInt(year);
    const periodStr = `${yearNum}-${String(monthNum).padStart(2, '0')}`;

    // Find payroll runs for this period
    const runWhere: Record<string, unknown> = { payrollPeriod: periodStr };
    if (companyId) runWhere.companyId = companyId;

    let payrollRuns: { id: string }[] = [];
    try {
      payrollRuns = await db.payrollRun.findMany({
        where: runWhere,
        select: { id: true },
      });
    } catch (prismaError: unknown) {
      console.warn('PayrollRun table not available, skipping:', prismaError instanceof Error ? prismaError.message : String(prismaError));
      payrollRuns = [];
    }

    const runIds = payrollRuns.map(r => r.id);

    // Map statutory component codes to types
    const componentCodeMap: Record<string, string[]> = {
      PF: ['EPF_EE', 'EPF_ER', 'EPF', 'PF_EE', 'PF_ER', 'PF'],
      ESI: ['ESI_EE', 'ESI_ER', 'ESI', 'ESIC_EE', 'ESIC_ER'],
      PT: ['PT', 'PROF_TAX', 'PROFESSIONAL_TAX', 'PIT'],
      TDS: ['TDS', 'INCOME_TAX', 'IT', 'TAX'],
      LWF: ['LWF', 'LABOUR_WELFARE', 'LABOUR_WELFARE_FUND', 'LWF_EE', 'LWF_ER'],
    };

    const relevantCodes = componentCodeMap[type] || [type];

    // Fetch statutory components for reference
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let statutoryComponents: any[] = [];
    try {
      statutoryComponents = await db.statutoryComponent.findMany({
        where: {
          componentCode: { in: relevantCodes },
        },
        include: {
          component: { select: { code: true, name: true, componentType: true } },
        },
      });
    } catch (prismaError: unknown) {
      console.warn('StatutoryComponent table not available, skipping:', prismaError instanceof Error ? prismaError.message : String(prismaError));
      statutoryComponents = [];
    }

    // Fetch transaction lines for these components
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let transactionLines: any[] = [];
    if (runIds.length > 0) {
      try {
        const tlWhere: Record<string, unknown> = {
          payrollRunId: { in: runIds },
          isReversal: false,
          OR: [
            { componentCode: { in: relevantCodes } },
            { componentCategory: 'STATUTORY' },
          ],
        };
        if (companyId) {
          tlWhere.employee = { department: { companyId } };
        }

        transactionLines = await db.payrollTransactionLine.findMany({
          where: tlWhere,
          include: {
            employee: {
              include: {
                department: { select: { name: true } },
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

    // Build report data based on type
    interface StatutoryRow {
      employeeId: string;
      name: string;
      empCode: string;
      department: string;
      [key: string]: unknown;
    }

    const reportData: StatutoryRow[] = [];
    let totals: Record<string, number> = {};

    if (type === 'PF') {
      // PF report: Employee + Employer contributions, UAN numbers
      const empMap: Record<string, StatutoryRow & { employeeContribution: number; employerContribution: number }> = {};

      for (const line of transactionLines) {
        const emp = line.employee;
        if (!emp) continue;

        if (!empMap[emp.id]) {
          empMap[emp.id] = {
            employeeId: emp.id,
            name: `${emp.firstName} ${emp.lastName}`,
            empCode: emp.employeeId,
            department: emp.department?.name || '—',
            uan: emp.aadhaarNumber || '—', // Using aadhaar as UAN fallback
            pan: emp.panNumber || '—',
            employeeContribution: 0,
            employerContribution: 0,
          };
        }

        const compType = line.componentType;
        const compCode = line.componentCode;

        if (compType === 'DEDUCTION' || compType === 'EMPLOYEE_CONTRIB') {
          if (relevantCodes.some(c => compCode.includes(c) || c.includes(compCode))) {
            empMap[emp.id].employeeContribution += line.finalAmount;
          }
        } else if (compType === 'EMPLOYER_CONTRIB') {
          if (relevantCodes.some(c => compCode.includes(c) || c.includes(compCode))) {
            empMap[emp.id].employerContribution += line.finalAmount;
          }
        }
      }

      for (const row of Object.values(empMap)) {
        reportData.push({
          ...row,
          totalContribution: row.employeeContribution + row.employerContribution,
        });
      }

      totals = {
        employeeContribution: reportData.reduce((s, r) => s + (r.employeeContribution as number), 0),
        employerContribution: reportData.reduce((s, r) => s + (r.employerContribution as number), 0),
        totalContribution: reportData.reduce((s, r) => s + (r.totalContribution as number), 0),
      };

    } else if (type === 'ESI') {
      // ESI report: Employee + Employer contributions, IP numbers
      const empMap: Record<string, StatutoryRow & { employeeContribution: number; employerContribution: number; grossPay: number }> = {};

      for (const line of transactionLines) {
        const emp = line.employee;
        if (!emp) continue;

        if (!empMap[emp.id]) {
          empMap[emp.id] = {
            employeeId: emp.id,
            name: `${emp.firstName} ${emp.lastName}`,
            empCode: emp.employeeId,
            department: emp.department?.name || '—',
            ipNumber: emp.aadhaarNumber || '—',
            grossPay: 0,
            employeeContribution: 0,
            employerContribution: 0,
          };
        }

        const compType = line.componentType;
        const compCode = line.componentCode;

        if (compType === 'EARNING') {
          empMap[emp.id].grossPay += line.finalAmount;
        }

        if (compType === 'DEDUCTION' || compType === 'EMPLOYEE_CONTRIB') {
          if (relevantCodes.some(c => compCode.includes(c) || c.includes(compCode))) {
            empMap[emp.id].employeeContribution += line.finalAmount;
          }
        } else if (compType === 'EMPLOYER_CONTRIB') {
          if (relevantCodes.some(c => compCode.includes(c) || c.includes(compCode))) {
            empMap[emp.id].employerContribution += line.finalAmount;
          }
        }
      }

      for (const row of Object.values(empMap)) {
        reportData.push({
          ...row,
          totalContribution: row.employeeContribution + row.employerContribution,
        });
      }

      totals = {
        grossPay: reportData.reduce((s, r) => s + (r.grossPay as number), 0),
        employeeContribution: reportData.reduce((s, r) => s + (r.employeeContribution as number), 0),
        employerContribution: reportData.reduce((s, r) => s + (r.employerContribution as number), 0),
        totalContribution: reportData.reduce((s, r) => s + (r.totalContribution as number), 0),
      };

    } else if (type === 'PT') {
      // Professional Tax: State-wise breakdown
      const empMap: Record<string, StatutoryRow & { ptDeducted: number; state: string }> = {};

      for (const line of transactionLines) {
        const emp = line.employee;
        if (!emp) continue;

        if (!empMap[emp.id]) {
          empMap[emp.id] = {
            employeeId: emp.id,
            name: `${emp.firstName} ${emp.lastName}`,
            empCode: emp.employeeId,
            department: emp.department?.name || '—',
            state: emp.state || '—',
            pan: emp.panNumber || '—',
            ptDeducted: 0,
          };
        }

        const compCode = line.componentCode;
        if (relevantCodes.some(c => compCode.includes(c) || c.includes(compCode))) {
          if (line.componentType === 'DEDUCTION' || line.componentType === 'EMPLOYEE_CONTRIB') {
            empMap[emp.id].ptDeducted += line.finalAmount;
          }
        }
      }

      for (const row of Object.values(empMap)) {
        reportData.push({ ...row });
      }

      totals = {
        ptDeducted: reportData.reduce((s, r) => s + (r.ptDeducted as number), 0),
      };

    } else if (type === 'TDS') {
      // TDS: Tax deducted, PAN-wise
      const empMap: Record<string, StatutoryRow & { taxDeducted: number; grossIncome: number }> = {};

      for (const line of transactionLines) {
        const emp = line.employee;
        if (!emp) continue;

        if (!empMap[emp.id]) {
          empMap[emp.id] = {
            employeeId: emp.id,
            name: `${emp.firstName} ${emp.lastName}`,
            empCode: emp.employeeId,
            department: emp.department?.name || '—',
            pan: emp.panNumber || '—',
            grossIncome: 0,
            taxDeducted: 0,
          };
        }

        const compCode = line.componentCode;
        if (line.componentType === 'EARNING') {
          empMap[emp.id].grossIncome += line.finalAmount;
        }

        if (relevantCodes.some(c => compCode.includes(c) || c.includes(compCode))) {
          if (line.componentType === 'DEDUCTION' || line.componentType === 'EMPLOYEE_CONTRIB') {
            empMap[emp.id].taxDeducted += line.finalAmount;
          }
        }
      }

      for (const row of Object.values(empMap)) {
        reportData.push({ ...row });
      }

      totals = {
        grossIncome: reportData.reduce((s, r) => s + (r.grossIncome as number), 0),
        taxDeducted: reportData.reduce((s, r) => s + (r.taxDeducted as number), 0),
      };

    } else if (type === 'LWF') {
      // Labour Welfare Fund: Employee + Employer contributions, state-wise
      const empMap: Record<string, StatutoryRow & { employeeContribution: number; employerContribution: number; grossPay: number; state: string }> = {};

      for (const line of transactionLines) {
        const emp = line.employee;
        if (!emp) continue;

        if (!empMap[emp.id]) {
          empMap[emp.id] = {
            employeeId: emp.id,
            name: `${emp.firstName} ${emp.lastName}`,
            empCode: emp.employeeId,
            department: emp.department?.name || '—',
            state: emp.state || '—',
            pan: emp.panNumber || '—',
            grossPay: 0,
            employeeContribution: 0,
            employerContribution: 0,
          };
        }

        const compType = line.componentType;
        const compCode = line.componentCode;

        if (compType === 'EARNING') {
          empMap[emp.id].grossPay += line.finalAmount;
        }

        if (compType === 'DEDUCTION' || compType === 'EMPLOYEE_CONTRIB') {
          if (relevantCodes.some(c => compCode.includes(c) || c.includes(compCode))) {
            empMap[emp.id].employeeContribution += line.finalAmount;
          }
        } else if (compType === 'EMPLOYER_CONTRIB') {
          if (relevantCodes.some(c => compCode.includes(c) || c.includes(compCode))) {
            empMap[emp.id].employerContribution += line.finalAmount;
          }
        }
      }

      for (const row of Object.values(empMap)) {
        reportData.push({
          ...row,
          totalContribution: row.employeeContribution + row.employerContribution,
        });
      }

      totals = {
        grossPay: reportData.reduce((s, r) => s + (r.grossPay as number), 0),
        employeeContribution: reportData.reduce((s, r) => s + (r.employeeContribution as number), 0),
        employerContribution: reportData.reduce((s, r) => s + (r.employerContribution as number), 0),
        totalContribution: reportData.reduce((s, r) => s + (r.totalContribution as number), 0),
      };
    }

    return Response.json({
      type,
      period: periodStr,
      data: reportData,
      totals,
      statutoryComponents,
      componentCodes: relevantCodes,
    }, { headers: corsHeaders });
  } catch (error: unknown) {
    console.error('Error generating statutory report:', error);
    return Response.json({ error: (error instanceof Error ? error.message : String(error)) }, { status: 500, headers: corsHeaders });
  }
}
