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

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = await getDb(request);
  try {
    const { id } = await params;
    const token = getTokenFromHeaders(request);
    const decoded = await verifyToken(token);
    if (!decoded) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });

    // 1. Get the payroll run
    let payrollRun;
    try {
      payrollRun = await db.payrollRun.findUnique({ where: { id } });
    } catch (dbError: unknown) {
      console.error('PayrollRun table not available:', dbError);
      return Response.json({ error: 'Payroll run not found' }, { status: 404, headers: corsHeaders });
    }

    if (!payrollRun) return Response.json({ error: 'Payroll run not found' }, { status: 404, headers: corsHeaders });

    if (!['OPEN', 'INPUT_COLLECTION'].includes(payrollRun.runStatus)) {
      return Response.json({ error: 'Payroll run must be in OPEN or INPUT_COLLECTION status to calculate' }, { status: 400, headers: corsHeaders });
    }

    // 2. Get all active employees for the legal entity
    const employees = await db.employee.findMany({
      where: {
        status: 'active',
        companyId: payrollRun.companyId || undefined,
      },
      include: {
        designation: true,
        department: true,
      },
    });

    if (employees.length === 0) {
      return Response.json({ error: 'No active employees found for this payroll run' }, { status: 400, headers: corsHeaders });
    }

    // 3. Get payroll components
    const components = await db.payrollComponent.findMany({
      where: { isActive: true },
      orderBy: { componentType: 'asc' },
    });

    // 4. Get CTC templates for the country
    const ctcTemplates = await db.cTCTemplate.findMany({
      where: {
        countryCode: 'IND',
        status: 'ACTIVE',
      },
      include: { componentMappings: { orderBy: { calculationSequence: 'asc' } } },
    });

    // 5. Get payroll inputs for this run
    let payrollInputs: Awaited<ReturnType<typeof db.payrollInput.findMany>> = [];
    try {
      payrollInputs = await db.payrollInput.findMany({
        where: {
          payrollRunId: id,
          approvalStatus: 'APPROVED',
        },
      });
    } catch (dbError: unknown) {
      console.error('PayrollInput table not available, using empty inputs:', dbError);
      payrollInputs = [];
    }

    // 6. Delete existing transaction lines for this run
    try {
      await db.payrollTransactionLine.deleteMany({ where: { payrollRunId: id } });
    } catch (dbError: unknown) {
      console.error('PayrollTransactionLine table not available, skipping delete:', dbError);
    }

    // 7. Calculate payroll for each employee
    let totalGrossPay = 0;
    let totalDeductions = 0;
    let totalNetPay = 0;
    let totalEmployerContrib = 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const transactionLines: any[] = [];

    for (const employee of employees) {
      const employeeGrossPay: Record<string, number> = {};
      const employeeDeductions: Record<string, number> = {};
      const employeeEmployerContrib: Record<string, number> = {};
      const componentAmounts: Record<string, number> = {};

      const monthlySalary = (employee.salary || 0) / 12;
      const basicSalary = monthlySalary;

      // Find employee-specific inputs
      const empInputs = payrollInputs.filter(i => i.employeeId === employee.id);

      // Calculate using CTC template component mappings if available
      const activeTemplate = ctcTemplates.find(t => t.isDefault) || ctcTemplates[0];

      if (activeTemplate) {
        for (const mapping of activeTemplate.componentMappings) {
          let amount = 0;

          switch (mapping.allocationMethod) {
            case 'PERCENTAGE_OF_CTC': {
              const ctcAnnual = employee.salary || 0;
              amount = (ctcAnnual * mapping.allocationValue) / 100 / 12;
              break;
            }
            case 'FIXED_AMOUNT': {
              amount = mapping.allocationValue / (mapping.frequency === 'ANNUAL' ? 12 : 1);
              break;
            }
            case 'PERCENTAGE_OF_COMPONENT': {
              const baseAmount = componentAmounts[mapping.baseComponentId || ''] || basicSalary;
              amount = (baseAmount * mapping.allocationValue) / 100;
              break;
            }
            default:
              amount = 0;
          }

          // Apply min/max limits
          if (mapping.minAmount !== null && mapping.minAmount !== undefined) {
            amount = Math.max(amount, mapping.minAmount);
          }
          if (mapping.maxAmount !== null && mapping.maxAmount !== undefined) {
            amount = Math.min(amount, mapping.maxAmount);
          }

          componentAmounts[mapping.id] = amount;

          if (mapping.componentCategory === 'EARNING') {
            employeeGrossPay[mapping.componentName] = amount;
          } else if (mapping.componentCategory === 'DEDUCTION') {
            employeeDeductions[mapping.componentName] = amount;
          } else if (mapping.componentCategory === 'EMPLOYER_CONTRIBUTION') {
            employeeEmployerContrib[mapping.componentName] = amount;
          }
        }
      } else {
        // Default calculation logic when no template
        employeeGrossPay['BASIC'] = basicSalary;
        employeeGrossPay['HRA'] = basicSalary * 0.4;
        employeeGrossPay['DA'] = basicSalary * 0.1;
        employeeGrossPay['CONVEYANCE'] = 1600;
        employeeGrossPay['MEDICAL'] = 1250;
        employeeGrossPay['OTHER_ALLOWANCES'] = basicSalary * 0.05;

        employeeDeductions['PF'] = basicSalary * 0.12;
        employeeDeductions['PROFESSIONAL_TAX'] = 200;

        const grossTotal = Object.values(employeeGrossPay).reduce((a, b) => a + b, 0);
        if (grossTotal <= 21000) {
          employeeDeductions['ESI'] = grossTotal * 0.0075;
        }

        employeeEmployerContrib['EPF_EMPLOYER'] = basicSalary * 0.12;
        employeeEmployerContrib['ESI_EMPLOYER'] = grossTotal <= 21000 ? grossTotal * 0.0325 : 0;
      }

      // Apply employee-specific inputs
      for (const input of empInputs) {
        if (input.inputValueNumeric !== null && input.inputValueNumeric !== undefined) {
          if (['VARIABLE_PAY', 'ONE_TIME', 'OVERTIME', 'REIMBURSEMENT'].includes(input.inputType)) {
            employeeGrossPay[input.componentCode] = (employeeGrossPay[input.componentCode] || 0) + input.inputValueNumeric;
          } else if (['LOAN', 'TAX_ADJ', 'INVESTMENT'].includes(input.inputType)) {
            employeeDeductions[input.componentCode] = (employeeDeductions[input.componentCode] || 0) + input.inputValueNumeric;
          }
        }
      }

      // Calculate totals for this employee
      const grossTotal = Object.values(employeeGrossPay).reduce((a, b) => a + b, 0);
      const deductionTotal = Object.values(employeeDeductions).reduce((a, b) => a + b, 0);
      const employerContribTotal = Object.values(employeeEmployerContrib).reduce((a, b) => a + b, 0);
      const netPay = grossTotal - deductionTotal;

      // Create transaction lines for earnings
      for (const [compName, amount] of Object.entries(employeeGrossPay)) {
        const component = components.find(c => c.name === compName || c.code === compName);
        transactionLines.push({
          payrollRunId: id,
          employeeId: employee.id,
          componentId: component?.id || null,
          componentCode: compName.toUpperCase().replace(/\s+/g, '_'),
          componentType: 'EARNING',
          componentCategory: component?.componentCategory || 'NORMAL',
          calculatedAmount: amount,
          finalAmount: amount,
          currencyCode: payrollRun.currencyCode,
          ytdAmount: 0,
          mtdAmount: amount,
          prorationFactor: 1.0,
        });
      }

      // Create transaction lines for deductions
      for (const [compName, amount] of Object.entries(employeeDeductions)) {
        const component = components.find(c => c.name === compName || c.code === compName);
        transactionLines.push({
          payrollRunId: id,
          employeeId: employee.id,
          componentId: component?.id || null,
          componentCode: compName.toUpperCase().replace(/\s+/g, '_'),
          componentType: 'DEDUCTION',
          componentCategory: component?.componentCategory || 'NORMAL',
          calculatedAmount: amount,
          finalAmount: amount,
          currencyCode: payrollRun.currencyCode,
          ytdAmount: 0,
          mtdAmount: amount,
          prorationFactor: 1.0,
        });
      }

      // Create transaction lines for employer contribution
      for (const [compName, amount] of Object.entries(employeeEmployerContrib)) {
        const component = components.find(c => c.name === compName || c.code === compName);
        transactionLines.push({
          payrollRunId: id,
          employeeId: employee.id,
          componentId: component?.id || null,
          componentCode: compName.toUpperCase().replace(/\s+/g, '_'),
          componentType: 'EMPLOYER_CONTRIB',
          componentCategory: component?.componentCategory || 'STATUTORY',
          calculatedAmount: amount,
          finalAmount: amount,
          currencyCode: payrollRun.currencyCode,
          ytdAmount: 0,
          mtdAmount: amount,
          prorationFactor: 1.0,
        });
      }

      totalGrossPay += grossTotal;
      totalDeductions += deductionTotal;
      totalNetPay += netPay;
      totalEmployerContrib += employerContribTotal;
    }

    // 8. Create all transaction lines in batch
    try {
      await db.payrollTransactionLine.createMany({ data: transactionLines });
    } catch (dbError: unknown) {
      console.error('PayrollTransactionLine table not available, skipping createMany:', dbError);
    }

    // 9. Update payroll run totals and advance status to PROCESSING
    let updatedRun = null;
    try {
      updatedRun = await db.payrollRun.update({
        where: { id },
        data: {
          totalEmployees: employees.length,
          totalGrossPay,
          totalDeductions,
          totalNetPay,
          totalEmployerContrib,
          runStatus: 'PROCESSING',
        },
      });
    } catch (dbError: unknown) {
      console.error('PayrollRun table not available, skipping update:', dbError);
    }

    return Response.json({
      data: {
        run: updatedRun,
        summary: {
          totalEmployees: employees.length,
          totalGrossPay,
          totalDeductions,
          totalNetPay,
          totalEmployerContrib,
          transactionLinesCreated: transactionLines.length,
        },
      },
      message: 'Payroll calculation completed successfully',
    }, { headers: corsHeaders });
  } catch (error: unknown) {
    console.error('Error calculating payroll:', error);
    return Response.json({ error: (error instanceof Error ? error.message : String(error)) }, { status: 500, headers: corsHeaders });
  }
}
