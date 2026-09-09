/**
 * Generic seed endpoint for demo data across modules.
 * POST /api/admin/seed-demo-data with { module: 'payroll' | 'leave' | 'attendance' }
 */
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';
import { isClientDemoMode } from '@/lib/site-mode';

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
      return NextResponse.json({ error: 'Only admins can seed data' }, { status: 403 });
    }

    const body = await request.json();
    const { module } = body;
    if (!module) return NextResponse.json({ error: 'module is required' }, { status: 400 });

    const db = await getDb(request);
    const results: string[] = [];

    const company = await db.company.findFirst({ select: { id: true, name: true } });
    if (!company) return NextResponse.json({ error: 'No company found' }, { status: 400 });
    const companyId = company.id;
    const employees = await db.employee.findMany({ where: { status: 'active' }, select: { id: true, firstName: true, lastName: true, salary: true, companyId: true, email: true }, take: 50 });
    results.push(`Company: ${company.name}, Employees: ${employees.length}`);

    if (module === 'payroll') {
      // ── 1. Payroll Components (Indian standard) ──
      if ((await db.payrollComponent.count()) === 0) {
        const comps = [
          // Earnings
          { name: 'Basic Salary', code: 'BASIC', type: 'earning', calculationType: 'percentage_of_ctc', value: 40, isActive: true },
          { name: 'House Rent Allowance', code: 'HRA', type: 'earning', calculationType: 'percentage_of_basic', value: 50, isActive: true },
          { name: 'Special Allowance', code: 'SA', type: 'earning', calculationType: 'fixed', value: 0, isActive: true },
          { name: 'Conveyance Allowance', code: 'CA', type: 'earning', calculationType: 'fixed', value: 19200, isActive: true },
          { name: 'Medical Allowance', code: 'MA', type: 'earning', calculationType: 'fixed', value: 15000, isActive: true },
          { name: 'Leave Travel Allowance', code: 'LTA', type: 'earning', calculationType: 'fixed', value: 25000, isActive: true },
          { name: 'Children Education Allowance', code: 'CEA', type: 'earning', calculationType: 'fixed', value: 12000, isActive: true },
          { name: 'Vehicle Allowance', code: 'VA', type: 'earning', calculationType: 'fixed', value: 18000, isActive: true },
          { name: 'Food Allowance', code: 'FA', type: 'earning', calculationType: 'fixed', value: 26400, isActive: true },
          { name: 'Performance Bonus', code: 'PB', type: 'earning', calculationType: 'fixed', value: 0, isActive: true },
          // Deductions
          { name: 'Provident Fund', code: 'PF', type: 'deduction', calculationType: 'percentage_of_basic', value: 12, isActive: true },
          { name: 'Professional Tax', code: 'PT', type: 'deduction', calculationType: 'fixed', value: 2400, isActive: true },
          { name: 'TDS', code: 'TDS', type: 'deduction', calculationType: 'fixed', value: 0, isActive: true },
          { name: 'ESI', code: 'ESI', type: 'deduction', calculationType: 'percentage_of_gross', value: 0.75, isActive: true },
          { name: 'Labour Welfare Fund', code: 'LWF', type: 'deduction', calculationType: 'fixed', value: 1200, isActive: true },
        ];
        for (const c of comps) await db.payrollComponent.create({ data: { ...c, companyId } }).catch(() => {});
        results.push(`Created ${comps.length} payroll components (Indian standard)`);
      }

      // ── 2. Statutory Components (Indian standard) ──
      if ((await db.statutoryComponent.count()) === 0) {
        await db.statutoryComponent.createMany({ data: [
          { name: 'Provident Fund (PF)', type: 'pf', employeeShare: 12, employerShare: 12, isActive: true, companyId },
          { name: 'Employees State Insurance (ESI)', type: 'esi', employeeShare: 0.75, employerShare: 3.25, isActive: true, companyId },
          { name: 'Professional Tax (PT)', type: 'pt', employeeShare: 200, employerShare: 0, isActive: true, companyId },
          { name: 'Labour Welfare Fund (LWF)', type: 'lwf', employeeShare: 100, employerShare: 200, isActive: true, companyId },
          { name: 'TDS - Income Tax', type: 'tds', employeeShare: 0, employerShare: 0, isActive: true, companyId },
        ]}).catch(() => {});
        results.push('Created 5 statutory components (Indian standard)');
      }

      // ── 3. CTC Templates with component mappings ──
      if ((await db.cTCTemplate.count()) === 0) {
        // Indian Standard CTC Template
        const stdCTC = await db.cTCTemplate.create({ data: { name: 'Indian Standard CTC', description: 'Standard Indian CTC structure: Basic 40%, HRA 50% of Basic, PF 12%, PT, TDS', status: 'ACTIVE', companyId } }).catch(() => null as any);
        if (stdCTC) {
          const comps = await db.payrollComponent.findMany({ select: { id: true, code: true } });
          const compMap = new Map(comps.map(c => [c.code, c.id]));
          const mappings = [
            { componentId: compMap.get('BASIC'), sortOrder: 1, percentage: 40, calculationBasis: 'percentage_of_ctc' },
            { componentId: compMap.get('HRA'), sortOrder: 2, percentage: 50, calculationBasis: 'percentage_of_basic' },
            { componentId: compMap.get('SA'), sortOrder: 3, percentage: 0, calculationBasis: 'balancing' },
            { componentId: compMap.get('CA'), sortOrder: 4, percentage: 0, calculationBasis: 'fixed' },
            { componentId: compMap.get('MA'), sortOrder: 5, percentage: 0, calculationBasis: 'fixed' },
            { componentId: compMap.get('LTA'), sortOrder: 6, percentage: 0, calculationBasis: 'fixed' },
            { componentId: compMap.get('PF'), sortOrder: 7, percentage: 12, calculationBasis: 'percentage_of_basic' },
            { componentId: compMap.get('PT'), sortOrder: 8, percentage: 0, calculationBasis: 'fixed' },
            { componentId: compMap.get('TDS'), sortOrder: 9, percentage: 0, calculationBasis: 'tax_slab' },
          ].filter(m => m.componentId);
          for (const m of mappings) {
            await db.cTCComponentMapping.create({ data: { templateId: stdCTC.id, ...m } }).catch(() => {});
          }
        }

        // Senior Management CTC Template
        await db.cTCTemplate.create({ data: { name: 'Senior Management CTC', description: 'CTC for senior management: Basic 50%, HRA 50% of Basic, higher allowances', status: 'ACTIVE', companyId } }).catch(() => {});

        // Intern CTC Template
        await db.cTCTemplate.create({ data: { name: 'Intern Stipend', description: 'Fixed stipend structure for interns', status: 'ACTIVE', companyId } }).catch(() => {});

        results.push('Created 3 CTC templates (Indian Standard with 9 component mappings)');
      }

      // ── 4. Tax Slabs (Indian standard - both regimes) ──
      if ((await db.taxSlabTable.count()) === 0) {
        // New Tax Regime FY 2025-26
        const newRegime = await db.taxSlabTable.create({ data: { name: 'FY 2025-26 New Tax Regime', description: 'New tax regime with standard deduction ₹75,000', isActive: true, companyId } }).catch(() => null as any);
        if (newRegime) {
          await db.taxSlabRateLine.createMany({ data: [
            { tableId: newRegime.id, fromAmount: 0, toAmount: 300000, rate: 0, sortOrder: 1 },
            { tableId: newRegime.id, fromAmount: 300000, toAmount: 700000, rate: 5, sortOrder: 2 },
            { tableId: newRegime.id, fromAmount: 700000, toAmount: 1000000, rate: 10, sortOrder: 3 },
            { tableId: newRegime.id, fromAmount: 1000000, toAmount: 1200000, rate: 15, sortOrder: 4 },
            { tableId: newRegime.id, fromAmount: 1200000, toAmount: 1500000, rate: 20, sortOrder: 5 },
            { tableId: newRegime.id, fromAmount: 1500000, toAmount: 99999999, rate: 30, sortOrder: 6 },
          ]}).catch(() => {});
        }

        // Old Tax Regime FY 2025-26
        const oldRegime = await db.taxSlabTable.create({ data: { name: 'FY 2025-26 Old Tax Regime', description: 'Old tax regime with deductions (80C, 80D, HRA, etc.)', isActive: true, companyId } }).catch(() => null as any);
        if (oldRegime) {
          await db.taxSlabRateLine.createMany({ data: [
            { tableId: oldRegime.id, fromAmount: 0, toAmount: 250000, rate: 0, sortOrder: 1 },
            { tableId: oldRegime.id, fromAmount: 250000, toAmount: 500000, rate: 5, sortOrder: 2 },
            { tableId: oldRegime.id, fromAmount: 500000, toAmount: 1000000, rate: 20, sortOrder: 3 },
            { tableId: oldRegime.id, fromAmount: 1000000, toAmount: 99999999, rate: 30, sortOrder: 4 },
          ]}).catch(() => {});
        }
        results.push('Created 2 tax slab tables (New + Old regime) with 10 slabs');
      }

      // ── 5. Currency Configuration ──
      if ((await db.currencyConfig.count()) === 0) {
        await db.currencyConfig.createMany({ data: [
          { code: 'INR', name: 'Indian Rupee', symbol: '₹', isActive: true, isBase: true, companyId },
          { code: 'USD', name: 'US Dollar', symbol: '$', isActive: true, isBase: false, companyId },
          { code: 'EUR', name: 'Euro', symbol: '€', isActive: true, isBase: false, companyId },
          { code: 'GBP', name: 'British Pound', symbol: '£', isActive: true, isBase: false, companyId },
          { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ', isActive: true, isBase: false, companyId },
          { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$', isActive: true, isBase: false, companyId },
        ]}).catch(() => {});
        results.push('Created 6 currency configs (INR base + 5 foreign)');
      }

      // ── 6. Exchange Rates ──
      if ((await db.exchangeRate.count()) === 0) {
        const now = new Date();
        await db.exchangeRate.createMany({ data: [
          { fromCurrency: 'USD', toCurrency: 'INR', exchangeRate: 83.50, rateDate: now, isActive: true },
          { fromCurrency: 'EUR', toCurrency: 'INR', exchangeRate: 90.25, rateDate: now, isActive: true },
          { fromCurrency: 'GBP', toCurrency: 'INR', exchangeRate: 105.75, rateDate: now, isActive: true },
          { fromCurrency: 'AED', toCurrency: 'INR', exchangeRate: 22.75, rateDate: now, isActive: true },
          { fromCurrency: 'SGD', toCurrency: 'INR', exchangeRate: 62.10, rateDate: now, isActive: true },
          { fromCurrency: 'INR', toCurrency: 'USD', exchangeRate: 0.0120, rateDate: now, isActive: true },
          { fromCurrency: 'INR', toCurrency: 'EUR', exchangeRate: 0.0111, rateDate: now, isActive: true },
        ]}).catch(() => {});
        results.push('Created 7 exchange rates');
      }

      // ── 7. Dimension Definitions ──
      if ((await db.dimensionDefinition.count()) === 0) {
        await db.dimensionDefinition.createMany({ data: [
          { name: 'Department', code: 'DEPT', description: 'Cost center by department', isActive: true, companyId },
          { name: 'Location', code: 'LOC', description: 'Cost center by office location/branch', isActive: true, companyId },
          { name: 'Project', code: 'PROJ', description: 'Cost center by project', isActive: true, companyId },
          { name: 'Cost Center', code: 'CC', description: 'General cost center allocation', isActive: true, companyId },
          { name: 'Business Unit', code: 'BU', description: 'Business unit level allocation', isActive: true, companyId },
        ]}).catch(() => {});
        results.push('Created 5 dimension definitions');
      }

      // ── 8. Payroll Definition (sample for one company) ──
      if ((await db.payrollDefinition.count()) === 0) {
        await db.payrollDefinition.create({ data: {
          name: 'Monthly Payroll - Standard',
          description: 'Standard monthly payroll cycle for all Indian employees',
          companyId,
          payCycle: 'monthly',
          payDay: 5,
          currency: 'INR',
          status: 'active',
        }}).catch(() => {});
        results.push('Created 1 payroll definition (Monthly Standard)');
      }

      // ── 9. Payroll Runs ──
      if ((await db.payrollRun.count()) === 0) {
        const now = new Date();
        for (const [m, st] of [[5,'CLOSED'],[6,'CLOSED'],[7,'APPROVED'],[8,'PROCESSING']] as const) {
          const tg = employees.reduce((s,e) => s + (e.salary||500000), 0);
          await db.payrollRun.create({ data: { payrollPeriod: `${now.getFullYear()}-${String(m).padStart(2,'0')}`, runType: 'regular', runStatus: st, companyId, totalEmployees: employees.length, totalGrossPay: tg, totalDeductions: Math.round(tg*0.15), totalNetPay: Math.round(tg*0.85), totalEmployerContrib: Math.round(tg*0.13), currencyCode: 'INR', periodStartDate: new Date(now.getFullYear(), m-1, 1), periodEndDate: new Date(now.getFullYear(), m, 0), payDate: new Date(now.getFullYear(), m, 5) } }).catch(() => {});
        }
        results.push('Created 4 payroll runs');
      }

      // ── 10. Salary Structure for admin employee ──
      if ((await db.salaryStructure.count()) === 0 && employees.length > 0) {
        // Find the admin employee (first employee or one with userId)
        const adminEmp = employees[0];
        const ctc = adminEmp.salary || 1000000;
        const monthlyGross = Math.round(ctc / 12);
        const basic = Math.round(monthlyGross * 0.4);
        const hra = Math.round(basic * 0.5);
        const sa = monthlyGross - basic - hra - 1600 - 1250 - 2000; // balancing figure
        const pf = Math.round(basic * 0.12);
        const pt = 200;
        const tds = Math.round(monthlyGross * 0.05);
        await db.salaryStructure.create({ data: {
          name: `${adminEmp.firstName} ${adminEmp.lastName} - Salary Structure`,
          employeeId: adminEmp.id,
          companyId: adminEmp.companyId || companyId,
          ctc,
          basicSalary: basic,
          hra,
          specialAllowance: sa > 0 ? sa : 0,
          conveyanceAllowance: 1600,
          medicalAllowance: 1250,
          pfDeduction: pf,
          professionalTax: pt,
          tdsDeduction: tds,
          status: 'active',
        }}).catch(() => {});
        results.push('Created salary structure for admin employee');
      }

      // ── 11. Payslips ──
      if ((await db.payroll.count()) === 0 && employees.length > 0) {
        const now = new Date();
        for (const emp of employees.slice(0, 30)) {
          const mg = Math.round((emp.salary||500000)/12);
          const pf = Math.round(mg*0.04), pt = 200, tds = Math.round(mg*0.05);
          await db.payroll.create({ data: { employeeId: emp.id, companyId: emp.companyId||companyId, month: now.getMonth()+1, year: now.getFullYear(), grossSalary: mg, basicSalary: Math.round(mg*0.4), hra: Math.round(mg*0.2), specialAllowance: Math.round(mg*0.4), totalAllowances: Math.round(mg*0.6), pfDeduction: pf, professionalTax: pt, tdsDeduction: tds, totalDeductions: pf+pt+tds, netSalary: mg-pf-pt-tds, status: 'processed', processedAt: new Date() } }).catch(() => {});
        }
        results.push(`Created 30 payslips`);
      }

      // ── 11. Loans ──
      if ((await db.loan.count()) === 0 && employees.length > 0) {
        for (const emp of employees.slice(0, 8)) {
          await db.loan.create({ data: { employeeId: emp.id, loanType: pick(['personal','vehicle','home','education']), amount: pick([50000,100000,150000,200000]), interestRate: pick([8.5,9.0,10.5]), tenureMonths: pick([12,24,36,48]), status: pick(['approved','active','pending']) } }).catch(() => {});
        }
        results.push('Created 8 loans');
      }

      // ── 12. Overtime ──
      if ((await db.overtimeRecord.count()) === 0 && employees.length > 0) {
        for (const emp of employees.slice(0, 15)) {
          const h = pick([2,3,4,5,6,8]);
          await db.overtimeRecord.create({ data: { employeeId: emp.id, date: new Date(Date.now() - pick([1,2,3,5,7])*86400000), hours: h, rate: 250, amount: h*250, status: pick(['approved','approved','pending','rejected']) } }).catch(() => {});
        }
        results.push('Created 15 overtime records');
      }

      // ── 13. Compliance Filings ──
      if ((await db.complianceFiling.count()) === 0) {
        const now = new Date();
        await db.complianceFiling.createMany({ data: [
          { filingType: 'PF', period: `${now.getFullYear()}-${String(now.getMonth()).padStart(2,'0')}`, filingStatus: 'SUBMITTED', dueDate: new Date(now.getFullYear(), now.getMonth(), 15), submittedDate: new Date(), companyId },
          { filingType: 'ESI', period: `${now.getFullYear()}-${String(now.getMonth()).padStart(2,'0')}`, filingStatus: 'GENERATED', dueDate: new Date(now.getFullYear(), now.getMonth(), 20), companyId },
          { filingType: 'TDS', period: `Q1-${now.getFullYear()}`, filingStatus: 'UNDER_REVIEW', dueDate: new Date(now.getFullYear(), now.getMonth()+1, 31), companyId },
          { filingType: 'PT', period: `${now.getFullYear()}-${String(now.getMonth()).padStart(2,'0')}`, filingStatus: 'SUBMITTED', dueDate: new Date(now.getFullYear(), now.getMonth(), 10), submittedDate: new Date(), companyId },
        ]}).catch(() => {});
        results.push('Created 4 compliance filings');
      }
    }

    else if (module === 'leave') {
      // ── Leave Types ──
      if ((await db.leaveType.count()) === 0) {
        const lts = [
          { name: 'Casual Leave', code: 'CL', defaultDays: 12, isPaid: true, carryForward: true, maxCarryForward: 5, status: 'active', companyId },
          { name: 'Sick Leave', code: 'SL', defaultDays: 10, isPaid: true, carryForward: false, maxCarryForward: 0, status: 'active', companyId },
          { name: 'Earned Leave', code: 'EL', defaultDays: 15, isPaid: true, carryForward: true, maxCarryForward: 10, status: 'active', companyId },
          { name: 'Maternity Leave', code: 'ML', defaultDays: 180, isPaid: true, carryForward: false, maxCarryForward: 0, status: 'active', companyId },
          { name: 'Paternity Leave', code: 'PL', defaultDays: 7, isPaid: true, carryForward: false, maxCarryForward: 0, status: 'active', companyId },
        ];
        for (const lt of lts) await db.leaveType.create({ data: lt }).catch(() => {});
        results.push(`Created ${lts.length} leave types`);
      }
      // ── Leave Balances ──
      const leaveTypes = await db.leaveType.findMany({ select: { id: true, defaultDays: true } });
      if ((await db.leaveBalance.count()) === 0 && employees.length > 0 && leaveTypes.length > 0) {
        const now = new Date();
        for (const emp of employees) {
          for (const lt of leaveTypes) {
            await db.leaveBalance.create({ data: { employeeId: emp.id, leaveTypeId: lt.id, total: lt.defaultDays, used: pick([0,1,2,3,4,5]), carryForward: 0, year: now.getFullYear() } }).catch(() => {});
          }
        }
        results.push(`Created leave balances for ${employees.length} employees`);
      }
      // ── Leave Requests ──
      if ((await db.leaveRequest.count()) === 0 && employees.length > 0 && leaveTypes.length > 0) {
        const now = new Date();
        for (const emp of employees.slice(0, 20)) {
          const lt = pick(leaveTypes);
          const start = new Date(now.getTime() + pick([-30,-20,-10,-5,0,5,10,15,20]) * 86400000);
          const end = new Date(start.getTime() + pick([0,1,2,3]) * 86400000);
          await db.leaveRequest.create({ data: { employeeId: emp.id, leaveTypeId: lt.id, startDate: start, endDate: end, reason: pick(['Personal work', 'Family function', 'Health checkup', 'Festival', 'Vacation', 'Medical emergency']), halfDay: Math.random() > 0.8, status: pick(['approved','approved','pending','pending','rejected']), comments: pick(['Approved', 'Please coordinate with team', 'Pending review', '']) } }).catch(() => {});
        }
        results.push(`Created 20 leave requests`);
      }
    }

    else if (module === 'attendance') {
      // ── Shifts ──
      if ((await db.shift.count()) === 0) {
        const shifts = [
          { name: 'General Shift', startTime: '09:00', endTime: '18:00', breakDuration: 60, graceTime: 15, status: 'active', companyId },
          { name: 'Night Shift', startTime: '22:00', endTime: '06:00', breakDuration: 60, graceTime: 15, status: 'active', companyId },
          { name: 'Morning Shift', startTime: '06:00', endTime: '14:00', breakDuration: 45, graceTime: 10, status: 'active', companyId },
        ];
        for (const s of shifts) await db.shift.create({ data: s }).catch(() => {});
        results.push(`Created ${shifts.length} shifts`);
      }
      // ── Holidays ──
      if ((await db.holiday.count()) === 0) {
        const year = new Date().getFullYear();
        const holidays = [
          { name: 'New Year', date: new Date(year, 0, 1), type: 'public', country: 'India', companyId },
          { name: 'Republic Day', date: new Date(year, 0, 26), type: 'public', country: 'India', companyId },
          { name: 'Holi', date: new Date(year, 2, 14), type: 'public', country: 'India', companyId },
          { name: 'Independence Day', date: new Date(year, 7, 15), type: 'public', country: 'India', companyId },
          { name: 'Gandhi Jayanti', date: new Date(year, 9, 2), type: 'public', country: 'India', companyId },
          { name: 'Diwali', date: new Date(year, 10, 12), type: 'public', country: 'India', companyId },
          { name: 'Christmas', date: new Date(year, 11, 25), type: 'public', country: 'India', companyId },
          { name: 'Company Foundation Day', date: new Date(year, 5, 15), type: 'company', country: 'India', companyId },
        ];
        for (const h of holidays) await db.holiday.create({ data: h }).catch(() => {});
        results.push(`Created ${holidays.length} holidays`);
      }
      // ── Attendance Records ──
      if ((await db.attendance.count()) === 0 && employees.length > 0) {
        const now = new Date();
        for (const emp of employees.slice(0, 30)) {
          for (let d = 1; d <= 20; d++) {
            const date = new Date(now.getFullYear(), now.getMonth(), d);
            if (date.getDay() === 0 || date.getDay() === 6) continue;
            const checkIn = new Date(date);
            checkIn.setHours(8, Math.floor(Math.random() * 45) + 15);
            const checkOut = new Date(date);
            checkOut.setHours(17, Math.floor(Math.random() * 45) + 30);
            await db.attendance.create({ data: { employeeId: emp.id, date, checkIn, checkOut, status: pick(['present','present','present','late','present','present']), workHours: 8.5 + Math.random(), companyId: emp.companyId || companyId } }).catch(() => {});
          }
        }
        results.push(`Created attendance records for 20 days x 30 employees`);
      }
    }

    return NextResponse.json({ success: true, module, results, message: `${module} demo data seeded successfully` });
  } catch (error) {
    console.error('Seed demo data error:', error);
    return NextResponse.json({ error: 'Failed', details: error instanceof Error ? error.message : 'Unknown' }, { status: 500 });
  }
}
