/**
 * Seed additional payroll data for demo link.
 * Creates: payroll components, CTC templates, payroll runs, payslips, loans,
 * statutory components, tax slabs, payment methods.
 *
 * POST /api/admin/seed-payroll-demo
 */
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';

export async function OPTIONS() {
  return NextResponse.json({}, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

export async function POST(request: Request) {
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    if (!['super_admin', 'tenant_admin', 'admin'].includes(decoded.role as string)) {
      return NextResponse.json({ error: 'Only admins can seed demo data' }, { status: 403 });
    }

    const db = await getDb(request);
    const results: string[] = [];

    // Get first company
    const company = await db.company.findFirst({ select: { id: true, name: true } });
    if (!company) {
      return NextResponse.json({ error: 'No company found. Create a company first.' }, { status: 400 });
    }
    const companyId = company.id;
    results.push(`Company: ${company.name}`);

    // Get all employees
    const employees = await db.employee.findMany({
      where: { status: 'active' },
      select: { id: true, firstName: true, lastName: true, salary: true, companyId: true },
      take: 50,
    });
    results.push(`Employees found: ${employees.length}`);

    // 1. Payroll Components
    const existingComponents = await db.payrollComponent.count();
    if (existingComponents === 0) {
      const components = [
        { name: 'Basic', code: 'BASIC', type: 'earning', calculationType: 'percentage_of_ctc', value: 40, isActive: true },
        { name: 'House Rent Allowance', code: 'HRA', type: 'earning', calculationType: 'percentage_of_basic', value: 50, isActive: true },
        { name: 'Special Allowance', code: 'SA', type: 'earning', calculationType: 'fixed', value: 0, isActive: true },
        { name: 'Conveyance Allowance', code: 'CA', type: 'earning', calculationType: 'fixed', value: 19200, isActive: true },
        { name: 'Medical Allowance', code: 'MA', type: 'earning', calculationType: 'fixed', value: 15000, isActive: true },
        { name: 'Provident Fund', code: 'PF', type: 'deduction', calculationType: 'percentage_of_basic', value: 12, isActive: true },
        { name: 'Professional Tax', code: 'PT', type: 'deduction', calculationType: 'fixed', value: 2400, isActive: true },
        { name: 'TDS', code: 'TDS', type: 'deduction', calculationType: 'fixed', value: 0, isActive: true },
      ];
      for (const c of components) {
        await db.payrollComponent.create({ data: { ...c, companyId } }).catch(() => {});
      }
      results.push(`Created ${components.length} payroll components`);
    } else {
      results.push(`Payroll components already exist: ${existingComponents}`);
    }

    // 2. Statutory Components
    const existingStatutory = await db.statutoryComponent.count();
    if (existingStatutory === 0) {
      await db.statutoryComponent.createMany({
        data: [
          { name: 'PF - Employee', type: 'pf', employeeShare: 12, employerShare: 12, isActive: true, companyId },
          { name: 'ESI - Employee', type: 'esi', employeeShare: 0.75, employerShare: 3.25, isActive: true, companyId },
          { name: 'Professional Tax', type: 'pt', employeeShare: 200, employerShare: 0, isActive: true, companyId },
        ],
      }).catch(() => {});
      results.push('Created 3 statutory components');
    } else {
      results.push(`Statutory components already exist: ${existingStatutory}`);
    }

    // 3. CTC Templates
    const existingCTC = await db.cTCTemplate.count();
    if (existingCTC === 0) {
      await db.cTCTemplate.createMany({
        data: [
          { name: 'Standard CTC', description: 'Standard salary structure', status: 'ACTIVE', companyId },
          { name: 'Senior CTC', description: 'Senior employee structure', status: 'ACTIVE', companyId },
          { name: 'Intern CTC', description: 'Intern stipend structure', status: 'ACTIVE', companyId },
        ],
      }).catch(() => {});
      results.push('Created 3 CTC templates');
    } else {
      results.push(`CTC templates already exist: ${existingCTC}`);
    }

    // 4. Tax Slabs
    const existingTaxSlabs = await db.taxSlabTable.count();
    if (existingTaxSlabs === 0) {
      const taxTable = await db.taxSlabTable.create({
        data: { name: 'FY 2025-26 New Regime', description: 'New tax regime', isActive: true, companyId },
      }).catch(() => null as any);
      if (taxTable) {
        await db.taxSlabRateLine.createMany({
          data: [
            { tableId: taxTable.id, fromAmount: 0, toAmount: 300000, rate: 0, sortOrder: 1 },
            { tableId: taxTable.id, fromAmount: 300000, toAmount: 600000, rate: 5, sortOrder: 2 },
            { tableId: taxTable.id, fromAmount: 600000, toAmount: 900000, rate: 10, sortOrder: 3 },
            { tableId: taxTable.id, fromAmount: 900000, toAmount: 1200000, rate: 15, sortOrder: 4 },
            { tableId: taxTable.id, fromAmount: 1200000, toAmount: 1500000, rate: 20, sortOrder: 5 },
            { tableId: taxTable.id, fromAmount: 1500000, toAmount: 99999999, rate: 30, sortOrder: 6 },
          ],
        }).catch(() => {});
        results.push('Created tax slab table with 6 slabs');
      }
    } else {
      results.push(`Tax slabs already exist: ${existingTaxSlabs}`);
    }

    // 5. Payment Methods
    const existingPM = await db.employeePaymentMethod.count();
    if (existingPM === 0 && employees.length > 0) {
      for (const emp of employees.slice(0, 20)) {
        await db.employeePaymentMethod.create({
          data: {
            employeeId: emp.id,
            bankName: pick(['HDFC Bank', 'ICICI Bank', 'State Bank of India', 'Axis Bank']),
            accountNumber: String(Math.floor(Math.random() * 9000000000) + 1000000000),
            ifscCode: pick(['HDFC0001234', 'ICIC0005678', 'SBIN0009012', 'UTIB0003456']),
            accountType: 'savings',
            status: 'active',
          },
        }).catch(() => {});
      }
      results.push(`Created payment methods for ${Math.min(20, employees.length)} employees`);
    } else {
      results.push(`Payment methods already exist: ${existingPM}`);
    }

    // 6. Payroll Runs
    const existingRuns = await db.payrollRun.count();
    if (existingRuns === 0) {
      const now = new Date();
      const periods = [
        { period: `${now.getFullYear()}-05`, status: 'CLOSED', month: 5 },
        { period: `${now.getFullYear()}-06`, status: 'CLOSED', month: 6 },
        { period: `${now.getFullYear()}-07`, status: 'APPROVED', month: 7 },
        { period: `${now.getFullYear()}-08`, status: 'PROCESSING', month: 8 },
      ];
      for (const p of periods) {
        const totalGross = employees.reduce((s, e) => s + (e.salary || 500000), 0);
        await db.payrollRun.create({
          data: {
            payrollPeriod: p.period, runType: 'regular', runStatus: p.status, companyId,
            totalEmployees: employees.length, totalGrossPay: totalGross,
            totalDeductions: Math.round(totalGross * 0.15), totalNetPay: Math.round(totalGross * 0.85),
            totalEmployerContrib: Math.round(totalGross * 0.13), currencyCode: 'INR',
            periodStartDate: new Date(now.getFullYear(), p.month - 1, 1),
            periodEndDate: new Date(now.getFullYear(), p.month, 0),
            payDate: new Date(now.getFullYear(), p.month, 5),
          },
        }).catch(() => {});
      }
      results.push(`Created ${periods.length} payroll runs`);
    } else {
      results.push(`Payroll runs already exist: ${existingRuns}`);
    }

    // 7. Payslips
    const existingPayslips = await db.payroll.count();
    if (existingPayslips === 0 && employees.length > 0) {
      const now = new Date();
      for (const emp of employees.slice(0, 30)) {
        const monthlyGross = Math.round((emp.salary || 500000) / 12);
        const pf = Math.round(monthlyGross * 0.04);
        const pt = 200;
        const tds = Math.round(monthlyGross * 0.05);
        await db.payroll.create({
          data: {
            employeeId: emp.id, companyId: emp.companyId || companyId,
            month: now.getMonth() + 1, year: now.getFullYear(),
            grossSalary: monthlyGross, basicSalary: Math.round(monthlyGross * 0.4),
            hra: Math.round(monthlyGross * 0.2), specialAllowance: Math.round(monthlyGross * 0.4),
            totalAllowances: Math.round(monthlyGross * 0.6),
            pfDeduction: pf, professionalTax: pt, tdsDeduction: tds,
            totalDeductions: pf + pt + tds, netSalary: monthlyGross - pf - pt - tds,
            status: 'processed', processedAt: new Date(),
          },
        }).catch(() => {});
      }
      results.push(`Created payslips for ${Math.min(30, employees.length)} employees`);
    } else {
      results.push(`Payslips already exist: ${existingPayslips}`);
    }

    // 8. Loans
    const existingLoans = await db.loan.count();
    if (existingLoans === 0 && employees.length > 0) {
      for (const emp of employees.slice(0, 8)) {
        await db.loan.create({
          data: {
            employeeId: emp.id, loanType: pick(['personal', 'vehicle', 'home', 'education']),
            amount: pick([50000, 100000, 150000, 200000, 300000]),
            interestRate: pick([8.5, 9.0, 10.5, 11.0]), tenureMonths: pick([12, 24, 36, 48, 60]),
            status: pick(['approved', 'active', 'active', 'pending']),
          },
        }).catch(() => {});
      }
      results.push(`Created 8 loan records`);
    } else {
      results.push(`Loans already exist: ${existingLoans}`);
    }

    // 9. Overtime Records
    const existingOT = await db.overtimeRecord.count();
    if (existingOT === 0 && employees.length > 0) {
      for (const emp of employees.slice(0, 15)) {
        const hours = pick([2, 3, 4, 5, 6, 8]);
        await db.overtimeRecord.create({
          data: {
            employeeId: emp.id, date: new Date(new Date().setDate(new Date().getDate() - pick([1, 2, 3, 5, 7]))),
            hours, rate: 250, amount: hours * 250, status: pick(['approved', 'approved', 'pending', 'rejected']),
          },
        }).catch(() => {});
      }
      results.push(`Created 15 overtime records`);
    } else {
      results.push(`Overtime records already exist: ${existingOT}`);
    }

    // 10. Compliance Filings
    const existingCF = await db.complianceFiling.count();
    if (existingCF === 0) {
      await db.complianceFiling.createMany({
        data: [
          { filingType: 'PF', period: `${new Date().getFullYear()}-${String(new Date().getMonth()).padStart(2, '0')}`, filingStatus: 'SUBMITTED', dueDate: new Date(new Date().setDate(15)), submittedDate: new Date(), companyId },
          { filingType: 'ESI', period: `${new Date().getFullYear()}-${String(new Date().getMonth()).padStart(2, '0')}`, filingStatus: 'GENERATED', dueDate: new Date(new Date().setDate(20)), companyId },
          { filingType: 'TDS', period: `Q1-${new Date().getFullYear()}`, filingStatus: 'UNDER_REVIEW', dueDate: new Date(new Date().setMonth(new Date().getMonth() + 1)), companyId },
          { filingType: 'PT', period: `${new Date().getFullYear()}-${String(new Date().getMonth()).padStart(2, '0')}`, filingStatus: 'SUBMITTED', dueDate: new Date(new Date().setDate(10)), submittedDate: new Date(), companyId },
        ],
      }).catch(() => {});
      results.push('Created 4 compliance filings');
    } else {
      results.push(`Compliance filings already exist: ${existingCF}`);
    }

    return NextResponse.json({ success: true, results, message: 'Demo payroll data seeded successfully' });
  } catch (error) {
    console.error('Seed payroll demo error:', error);
    return NextResponse.json(
      { error: 'Failed to seed demo payroll data', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
