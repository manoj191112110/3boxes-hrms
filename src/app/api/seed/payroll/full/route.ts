/**
 * Enhanced Payroll Full Seed API Endpoint
 *
 * POST /api/seed/payroll/full — Seeds comprehensive sample data for ALL payroll sub-menus:
 *   1. Payroll Definitions (per company)
 *   2. Employee Payment Methods (per employee)
 *   3. Loans (sample employee loans)
 *   4. Overtime Records (sample OT entries)
 *   5. Payroll Holds (notice period / disciplinary holds)
 *   6. Payroll Validations (pre-payroll checks)
 *   7. Bank Payment Files (NACH/NEFT format)
 *   8. FNF Calculations (full & final settlement samples)
 *   9. Additional Payroll Inputs (attendance, variable pay, one-time bonus)
 */
import { NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { isLiveMode } from '@/lib/site-mode';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() });
}

export async function POST(request: Request) {
  // ─── LIVE MODE GUARD ───
  if (isLiveMode(request)) {
    return NextResponse.json({ error: 'Seeding is disabled on the live platform.', code: 'LIVE_MODE_BLOCKED' }, { status: 403, headers: corsHeaders() });
  }

  try {
    console.log('[Full Payroll Seed] Starting enhanced payroll seeding...');

    // ─── Fetch existing data ──────────────────────────────────────
    const companies = await db.company.findMany({ include: { branches: true } });
    const employees = await db.employee.findMany();
    let payrollRuns: { id: string; runStatus: string; payrollPeriod: string | null; periodStartDate: Date; periodEndDate: Date; companyId: string; [key: string]: unknown }[] = [];
    try {
      payrollRuns = await db.payrollRun.findMany();
    } catch {
      console.log('[Full Payroll Seed] PayrollRun table not accessible, continuing without it');
    }

    if (companies.length === 0) {
      return NextResponse.json(
        { error: 'No companies found. Run the base seed first via /api/seed' },
        { status: 400, headers: corsHeaders() }
      );
    }

    if (employees.length === 0) {
      return NextResponse.json(
        { error: 'No employees found. Run the base seed first via /api/seed' },
        { status: 400, headers: corsHeaders() }
      );
    }

    const tcg = companies.find(c => c.code === 'TCG') || companies[0];
    const mpi = companies.find(c => c.code === 'MPI') || companies[1];
    const hfs = companies.find(c => c.code === 'HFS') || companies[2];

    const tcgEmployees = employees.filter(e => e.companyId === tcg.id);
    const mpiEmployees = employees.filter(e => e.companyId === mpi?.id);
    const allSeededEmployees = [...tcgEmployees, ...mpiEmployees];

    console.log(`[Full Payroll Seed] Found ${allSeededEmployees.length} employees across companies`);
    console.log(`[Full Payroll Seed] Found ${payrollRuns.length} payroll runs`);

    const results: Record<string, number> = {};

    // ══════════════════════════════════════════════════════════════
    // 1. PAYROLL DEFINITIONS
    // ══════════════════════════════════════════════════════════════
    console.log('\n📋 Creating Payroll Definitions...');

    const payrollDefs = [
      {
        name: 'TCG US Monthly Payroll',
        companyId: tcg.id,
        payFrequency: 'MONTHLY',
        processingCutOff: 25,
        paymentDay: 1,
        currencyCode: 'USD',
        countryCode: 'US',
        allowDirectDeposit: true,
        allowCheque: false,
        allowCash: false,
        costingSegments: JSON.stringify(['department', 'cost_center', 'location']),
        status: 'active',
        effectiveFrom: new Date('2025-01-01'),
      },
      {
        name: 'MPI India Monthly Payroll',
        companyId: mpi?.id || tcg.id,
        payFrequency: 'MONTHLY',
        processingCutOff: 25,
        paymentDay: 1,
        currencyCode: 'INR',
        countryCode: 'IN',
        allowDirectDeposit: true,
        allowCheque: true,
        allowCash: false,
        costingSegments: JSON.stringify(['department', 'location']),
        status: 'active',
        effectiveFrom: new Date('2025-04-01'),
      },
      {
        name: 'HFS UK Monthly Payroll',
        companyId: hfs?.id || tcg.id,
        payFrequency: 'MONTHLY',
        processingCutOff: 25,
        paymentDay: 28,
        currencyCode: 'GBP',
        countryCode: 'GB',
        allowDirectDeposit: true,
        allowCheque: false,
        allowCash: false,
        costingSegments: JSON.stringify(['department', 'cost_center']),
        status: 'active',
        effectiveFrom: new Date('2025-01-01'),
      },
    ];

    let pdCreated = 0;
    for (const pd of payrollDefs) {
      const existing = await db.payrollDefinition.findFirst({
        where: { name: pd.name, companyId: pd.companyId },
      });
      if (existing) continue;
      await db.payrollDefinition.create({ data: pd });
      pdCreated++;
    }
    results.payrollDefinitions = pdCreated;
    console.log(`  ✓ Created ${pdCreated} payroll definitions`);

    // ══════════════════════════════════════════════════════════════
    // 2. EMPLOYEE PAYMENT METHODS
    // ══════════════════════════════════════════════════════════════
    console.log('\n📋 Creating Employee Payment Methods...');

    const bankDetails = [
      { bankName: 'HDFC Bank', branch: 'Mumbai - Andheri', ifsc: 'HDFC0001234', accountType: 'SALARY' },
      { bankName: 'ICICI Bank', branch: 'Bengaluru - MG Road', ifsc: 'ICIC0005678', accountType: 'SALARY' },
      { bankName: 'State Bank of India', branch: 'Hyderabad - Banjara Hills', ifsc: 'SBIN0009012', accountType: 'SAVINGS' },
      { bankName: 'Axis Bank', branch: 'Pune - Hinjewadi', ifsc: 'UTIB0003456', accountType: 'SALARY' },
      { bankName: 'Kotak Mahindra Bank', branch: 'Chennai - OMR', ifsc: 'KKBK0007890', accountType: 'SALARY' },
      { bankName: 'Chase Bank', branch: 'New York - Manhattan', ifsc: 'CHASUS33', accountType: 'CHECKING' },
      { bankName: 'Bank of America', branch: 'San Francisco - Market St', ifsc: 'BOFAUS3N', accountType: 'CHECKING' },
      { bankName: 'Wells Fargo', branch: 'Austin - Congress Ave', ifsc: 'WFBIUS6S', accountType: 'CHECKING' },
      { bankName: 'Barclays', branch: 'London - Canary Wharf', ifsc: 'BARCGB22', accountType: 'CURRENT' },
      { bankName: 'HSBC UK', branch: 'London - Oxford Street', ifsc: 'HBUKGB4B', accountType: 'CURRENT' },
    ];

    let pmCreated = 0;
    for (const emp of allSeededEmployees) {
      // Check if payment method already exists
      const existing = await db.employeePaymentMethod.findFirst({
        where: { employeeId: emp.id, isPrimary: true },
      });
      if (existing) continue;

      // Pick bank details based on employee index
      const bankIdx = pmCreated % bankDetails.length;
      const bank = bankDetails[bankIdx];
      const isIndia = emp.salaryCurrency === 'INR' || emp.country === 'IN' || emp.country === 'India';
      const isUK = emp.salaryCurrency === 'GBP' || emp.country === 'GB' || emp.country === 'UK';

      const currencyCode = isIndia ? 'INR' : isUK ? 'GBP' : 'USD';
      // Generate a plausible account number
      const accountNo = `${1000 + pmCreated}${String(Math.floor(Math.random() * 9000000) + 1000000)}`;

      await db.employeePaymentMethod.create({
        data: {
          employeeId: emp.id,
          paymentType: 'DIRECT_DEPOSIT',
          bankName: bank.bankName,
          bankAccountNo: accountNo,
          bankIfscCode: bank.ifsc,
          bankBranch: bank.branch,
          accountType: bank.accountType,
          currencyCode,
          splitType: null,
          splitValue: null,
          isPrimary: true,
          priority: 1,
          effectiveFrom: emp.dateOfJoining || new Date('2025-01-01'),
          status: 'active',
        },
      });
      pmCreated++;

      // Add a secondary split payment for some employees
      if (pmCreated % 4 === 0) {
        const secondaryBank = bankDetails[(bankIdx + 3) % bankDetails.length];
        const secondaryAccount = `${2000 + pmCreated}${String(Math.floor(Math.random() * 9000000) + 1000000)}`;
        await db.employeePaymentMethod.create({
          data: {
            employeeId: emp.id,
            paymentType: 'DIRECT_DEPOSIT',
            bankName: secondaryBank.bankName,
            bankAccountNo: secondaryAccount,
            bankIfscCode: secondaryBank.ifsc,
            bankBranch: secondaryBank.branch,
            accountType: 'SAVINGS',
            currencyCode,
            splitType: 'PERCENTAGE',
            splitValue: 20,
            isPrimary: false,
            priority: 2,
            effectiveFrom: new Date('2025-06-01'),
            status: 'active',
          },
        });
      }
    }
    results.employeePaymentMethods = pmCreated;
    console.log(`  ✓ Created ${pmCreated} employee payment methods`);

    // ══════════════════════════════════════════════════════════════
    // 3. LOANS
    // ══════════════════════════════════════════════════════════════
    console.log('\n📋 Creating Loans...');

    // Select a few employees for loans
    const loanEmployees = allSeededEmployees.slice(0, Math.min(3, allSeededEmployees.length));
    const loanDefs = [
      {
        loanType: 'PERSONAL',
        loanAmount: 200000,
        interestRate: 10.5,
        tenureMonths: 24,
        emiAmount: 9268,
        outstandingBalance: 175000,
        disbursedAmount: 200000,
        startDate: new Date('2025-10-01'),
        endDate: new Date('2027-09-30'),
        recoveredAmount: 25000,
        remainingEmis: 21,
        status: 'active',
        remarks: 'Personal loan for home renovation',
      },
      {
        loanType: 'EMERGENCY',
        loanAmount: 50000,
        interestRate: 5.0,
        tenureMonths: 12,
        emiAmount: 4280,
        outstandingBalance: 35000,
        disbursedAmount: 50000,
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
        recoveredAmount: 15000,
        remainingEmis: 9,
        status: 'active',
        remarks: 'Emergency medical expense loan',
      },
      {
        loanType: 'HOUSING',
        loanAmount: 500000,
        interestRate: 8.5,
        tenureMonths: 60,
        emiAmount: 10267,
        outstandingBalance: 480000,
        disbursedAmount: 500000,
        startDate: new Date('2026-02-01'),
        endDate: new Date('2031-01-31'),
        recoveredAmount: 20000,
        remainingEmis: 58,
        status: 'active',
        remarks: 'Housing loan for apartment purchase',
        approvedBy: loanEmployees[0]?.id,
        approvedAt: new Date('2026-01-25'),
      },
    ];

    let loanCreated = 0;
    for (let i = 0; i < loanDefs.length; i++) {
      if (i >= loanEmployees.length) break;
      const emp = loanEmployees[i];
      const loan = loanDefs[i];

      const existing = await db.loan.findFirst({
        where: { employeeId: emp.id, loanType: loan.loanType, status: 'active' },
      });
      if (existing) continue;

      // Build a simple recovery schedule JSON
      const schedule = [];
      for (let m = 0; m < Math.min(loan.tenureMonths, 6); m++) {
        const schedDate = new Date(loan.startDate);
        schedDate.setMonth(schedDate.getMonth() + m);
        schedule.push({
          month: schedDate.getMonth() + 1,
          year: schedDate.getFullYear(),
          amount: loan.emiAmount,
          status: m < Math.floor(loan.recoveredAmount / loan.emiAmount) ? 'RECOVERED' : 'PENDING',
        });
      }

      await db.loan.create({
        data: {
          employeeId: emp.id,
          loanType: loan.loanType,
          loanAmount: loan.loanAmount,
          interestRate: loan.interestRate,
          tenureMonths: loan.tenureMonths,
          emiAmount: loan.emiAmount,
          outstandingBalance: loan.outstandingBalance,
          disbursedAmount: loan.disbursedAmount,
          disbursedDate: loan.startDate,
          startDate: loan.startDate,
          endDate: loan.endDate,
          recoveredAmount: loan.recoveredAmount,
          remainingEmis: loan.remainingEmis,
          status: loan.status,
          approvedBy: loan.approvedBy,
          approvedAt: loan.approvedAt,
          recoverySchedule: JSON.stringify(schedule),
          remarks: loan.remarks,
        },
      });
      loanCreated++;
    }
    results.loans = loanCreated;
    console.log(`  ✓ Created ${loanCreated} loans`);

    // ══════════════════════════════════════════════════════════════
    // 4. OVERTIME RECORDS
    // ══════════════════════════════════════════════════════════════
    console.log('\n📋 Creating Overtime Records...');

    const otEmployeePool = allSeededEmployees.slice(0, Math.min(6, allSeededEmployees.length));
    const otRecords = [
      { date: new Date('2026-05-12'), hours: 3, rateType: 'HOURLY_RATE', rate: 50, amount: 150, reason: 'Production deployment - weekend work', project: 'Platform v2.0', status: 'approved' },
      { date: new Date('2026-05-19'), hours: 4, rateType: 'HOURLY_RATE', rate: 50, amount: 200, reason: 'Client deliverable - urgent fix', project: 'Client Portal', status: 'approved' },
      { date: new Date('2026-05-26'), hours: 2, rateType: 'PERCENTAGE_OF_BASIC', rate: 1.5, amount: 0, reason: 'System monitoring after upgrade', project: 'Infra Upgrade', status: 'approved' },
      { date: new Date('2026-06-02'), hours: 5, rateType: 'HOURLY_RATE', rate: 55, amount: 275, reason: 'Sprint deadline - feature completion', project: 'Platform v2.1', status: 'approved' },
      { date: new Date('2026-06-09'), hours: 3, rateType: 'FLAT', rate: 150, amount: 150, reason: 'On-call production support', project: 'SRE Team', status: 'approved' },
      { date: new Date('2026-06-15'), hours: 6, rateType: 'HOURLY_RATE', rate: 50, amount: 300, reason: 'Quarter-end reporting', project: 'Finance Portal', status: 'pending' },
      { date: new Date('2026-06-20'), hours: 2.5, rateType: 'HOURLY_RATE', rate: 60, amount: 150, reason: 'Security patch deployment', project: 'Security', status: 'approved' },
      { date: new Date('2026-06-22'), hours: 4, rateType: 'HOURLY_RATE', rate: 55, amount: 220, reason: 'Data migration task', project: 'Data Migration', status: 'rejected' },
    ];

    let otCreated = 0;
    for (let i = 0; i < otRecords.length; i++) {
      const emp = otEmployeePool[i % otEmployeePool.length];
      const ot = otRecords[i];

      // Calculate amount for PERCENTAGE_OF_BASIC if not pre-set
      const otAmount = ot.amount || (emp.salary ? (emp.salary / 12 / 30 / 8) * ot.hours * ot.rate : 0);

      // Check unique constraint: employeeId + date
      const dateOnly = new Date(ot.date);
      dateOnly.setHours(0, 0, 0, 0);
      const existing = await db.overtimeRecord.findFirst({
        where: { employeeId: emp.id, date: dateOnly },
      });
      if (existing) continue;

      // Find an approver (different employee or use a manager)
      const approver = allSeededEmployees.find(e => e.id !== emp.id);

      await db.overtimeRecord.create({
        data: {
          employeeId: emp.id,
          date: dateOnly,
          hours: ot.hours,
          rateType: ot.rateType,
          rate: ot.rate,
          amount: otAmount,
          reason: ot.reason,
          project: ot.project,
          approvedBy: ot.status === 'approved' ? approver?.id : null,
          approvedAt: ot.status === 'approved' ? new Date(dateOnly.getTime() + 86400000) : null,
          status: ot.status,
          payrollRunId: ot.status === 'approved' && payrollRuns.length > 0
            ? payrollRuns.find(r => r.runStatus === 'CLOSED')?.id || null
            : null,
        },
      });
      otCreated++;
    }
    results.overtimeRecords = otCreated;
    console.log(`  ✓ Created ${otCreated} overtime records`);

    // ══════════════════════════════════════════════════════════════
    // 5. PAYROLL HOLDS
    // ══════════════════════════════════════════════════════════════
    console.log('\n📋 Creating Payroll Holds...');

    const holdEmployees = allSeededEmployees.slice(0, Math.min(2, allSeededEmployees.length));
    const holdDefs = [
      {
        holdType: 'FULL_HOLD',
        reason: 'Employee under notice period - final settlement pending',
        holdFromPeriod: '2026-06',
        holdToPeriod: null,
        heldComponents: null,
        status: 'active',
        createdBy: null,
      },
      {
        holdType: 'PARTIAL_HOLD',
        reason: 'Disciplinary hold - partial hold on bonus and incentives',
        holdFromPeriod: '2026-06',
        holdToPeriod: '2026-09',
        heldComponents: JSON.stringify(['BONUS', 'LTA', 'SA']),
        status: 'active',
        createdBy: null,
      },
    ];

    let holdCreated = 0;
    for (let i = 0; i < holdDefs.length; i++) {
      if (i >= holdEmployees.length) break;
      const emp = holdEmployees[i];
      const hold = holdDefs[i];

      const existing = await db.payrollHold.findFirst({
        where: { employeeId: emp.id, status: 'active' },
      });
      if (existing) continue;

      await db.payrollHold.create({
        data: {
          employeeId: emp.id,
          holdType: hold.holdType,
          reason: hold.reason,
          holdFromPeriod: hold.holdFromPeriod,
          holdToPeriod: hold.holdToPeriod,
          heldComponents: hold.heldComponents,
          releasedDate: null,
          releasedBy: null,
          status: hold.status,
          createdBy: hold.createdBy,
        },
      });
      holdCreated++;
    }
    results.payrollHolds = holdCreated;
    console.log(`  ✓ Created ${holdCreated} payroll holds`);

    // ══════════════════════════════════════════════════════════════
    // 6. PAYROLL VALIDATIONS
    // ══════════════════════════════════════════════════════════════
    console.log('\n📋 Creating Payroll Validations...');

    // Create pre-payroll validations for each payroll run
    let pvCreated = 0;

    for (const run of payrollRuns) {
      const existing = await db.payrollValidation.findFirst({
        where: { payrollRunId: run.id, validationType: 'PRE_PAYROLL' },
      });
      if (existing) continue;

      // Find employees without payment methods
      const employeesWithoutPM: string[] = [];
      const employeesWithHolds: string[] = [];
      const newJoiners: string[] = [];
      const errorsList: { type: string; message: string; employeeId?: string }[] = [];
      const warningsList: { type: string; message: string; employeeId?: string }[] = [];

      for (const emp of allSeededEmployees) {
        const pm = await db.employeePaymentMethod.findFirst({
          where: { employeeId: emp.id, status: 'active' },
        });
        if (!pm) {
          employeesWithoutPM.push(emp.id);
          errorsList.push({
            type: 'MISSING_PAYMENT_METHOD',
            message: `Employee ${emp.firstName} ${emp.lastName} (${emp.employeeId}) has no active payment method`,
            employeeId: emp.id,
          });
        }

        const hold = await db.payrollHold.findFirst({
          where: { employeeId: emp.id, status: 'active' },
        });
        if (hold) {
          employeesWithHolds.push(emp.id);
          warningsList.push({
            type: 'PAYROLL_HOLD',
            message: `Employee ${emp.firstName} ${emp.lastName} (${emp.employeeId}) has an active ${hold.holdType} hold`,
            employeeId: emp.id,
          });
        }

        // Check for new joiners (joined within the payroll period)
        if (emp.dateOfJoining) {
          const joinDate = new Date(emp.dateOfJoining);
          const periodStart = new Date(run.periodStartDate);
          const periodEnd = new Date(run.periodEndDate);
          if (joinDate >= periodStart && joinDate <= periodEnd) {
            newJoiners.push(emp.id);
            warningsList.push({
              type: 'NEW_JOINER',
              message: `Employee ${emp.firstName} ${emp.lastName} (${emp.employeeId}) is a new joiner - pro-rata calculation needed`,
              employeeId: emp.id,
            });
          }
        }

        // Check for incomplete KYC (some employees may lack PAN/Aadhaar)
        if (!emp.panNumber && emp.salaryCurrency === 'INR') {
          errorsList.push({
            type: 'INCOMPLETE_KYC',
            message: `Employee ${emp.firstName} ${emp.lastName} (${emp.employeeId}) is missing PAN number (required for TDS)`,
            employeeId: emp.id,
          });
        }

        // Check for missing salary basis
        if (!emp.salary || emp.salary === 0) {
          errorsList.push({
            type: 'MISSING_SALARY_BASIS',
            message: `Employee ${emp.firstName} ${emp.lastName} (${emp.employeeId}) has no salary basis configured`,
            employeeId: emp.id,
          });
        }
      }

      const totalEmployees = allSeededEmployees.length;
      const invalidEmployees = new Set([...employeesWithoutPM]).size;

      await db.payrollValidation.create({
        data: {
          payrollRunId: run.id,
          companyId: run.companyId,
          validationType: 'PRE_PAYROLL',
          status: errorsList.length > 0 ? 'failed' : 'completed',
          missingPaymentMethods: employeesWithoutPM.length > 0 ? JSON.stringify(employeesWithoutPM) : null,
          missingSalaryBasis: errorsList.filter(e => e.type === 'MISSING_SALARY_BASIS').map(e => e.employeeId!).length > 0
            ? JSON.stringify(errorsList.filter(e => e.type === 'MISSING_SALARY_BASIS').map(e => e.employeeId))
            : null,
          heldEmployees: employeesWithHolds.length > 0 ? JSON.stringify(employeesWithHolds) : null,
          newJoiners: newJoiners.length > 0 ? JSON.stringify(newJoiners) : null,
          terminations: null,
          errors: errorsList.length > 0 ? JSON.stringify(errorsList) : null,
          warnings: warningsList.length > 0 ? JSON.stringify(warningsList) : null,
          totalEmployees,
          validEmployees: totalEmployees - invalidEmployees,
          invalidEmployees,
          runBy: 'system-seed',
        },
      });
      pvCreated++;
    }

    // Also create a standalone validation for the primary company if no runs exist
    if (payrollRuns.length === 0) {
      const existingStandalone = await db.payrollValidation.findFirst({
        where: { companyId: tcg.id, validationType: 'PRE_PAYROLL' },
      });
      if (!existingStandalone) {
        await db.payrollValidation.create({
          data: {
            payrollRunId: null,
            companyId: tcg.id,
            validationType: 'PRE_PAYROLL',
            status: 'completed',
            missingPaymentMethods: null,
            missingSalaryBasis: null,
            heldEmployees: null,
            newJoiners: null,
            terminations: null,
            errors: null,
            warnings: JSON.stringify([
              { type: 'NO_PAYROLL_RUN', message: 'No payroll run exists for the current period' },
            ]),
            totalEmployees: tcgEmployees.length,
            validEmployees: tcgEmployees.length,
            invalidEmployees: 0,
            runBy: 'system-seed',
          },
        });
        pvCreated++;
      }
    }
    results.payrollValidations = pvCreated;
    console.log(`  ✓ Created ${pvCreated} payroll validations`);

    // ══════════════════════════════════════════════════════════════
    // 7. BANK PAYMENT FILES
    // ══════════════════════════════════════════════════════════════
    console.log('\n📋 Creating Bank Payment Files...');

    let bpfCreated = 0;

    // Create bank payment files for completed payroll runs
    const completedRuns = payrollRuns.filter(r => r.runStatus === 'CLOSED' || r.runStatus === 'PAID' || r.runStatus === 'POSTED');

    // Also consider runs in REVIEW status (for which files might have been generated)
    const runsForFiles = completedRuns.length > 0 ? completedRuns : payrollRuns.slice(0, 1);

    for (const run of runsForFiles) {
      // Calculate totals from transaction lines
      const txLines = await db.payrollTransactionLine.findMany({
        where: { payrollRunId: run.id, componentType: 'EARNING' },
      });

      const netPayLines = await db.payrollTransactionLine.findMany({
        where: { payrollRunId: run.id, componentCode: 'BASE_US' },
      });

      const totalAmount = netPayLines.reduce((sum, line) => sum + Math.abs(line.finalAmount), 0);
      const totalRecords = new Set(txLines.map(l => l.employeeId)).size;

      // NACH format file
      const nachExisting = await db.bankPaymentFile.findFirst({
        where: { payrollRunId: run.id, fileFormat: 'NACH' },
      });
      if (!nachExisting) {
        const nachContent = generateNACHContent(run, totalAmount, totalRecords);
        await db.bankPaymentFile.create({
          data: {
            payrollRunId: run.id,
            fileName: `NACH_${run.payrollPeriod || '2026-05'}_${new Date().toISOString().slice(0, 10)}.txt`,
            fileFormat: 'NACH',
            bankCode: 'HDFC',
            totalAmount,
            totalRecords,
            fileContent: nachContent,
            generatedBy: 'system-seed',
            generatedAt: new Date(run.periodEndDate || new Date('2026-05-28')),
            status: 'acknowledged',
            companyId: run.companyId,
          },
        });
        bpfCreated++;
      }

      // NEFT format file
      const neftExisting = await db.bankPaymentFile.findFirst({
        where: { payrollRunId: run.id, fileFormat: 'NEFT' },
      });
      if (!neftExisting) {
        const neftContent = generateNEFTContent(run, totalAmount, totalRecords);
        await db.bankPaymentFile.create({
          data: {
            payrollRunId: run.id,
            fileName: `NEFT_${run.payrollPeriod || '2026-05'}_${new Date().toISOString().slice(0, 10)}.csv`,
            fileFormat: 'NEFT',
            bankCode: 'ICICI',
            totalAmount: totalAmount * 0.3, // NEFT for partial payments
            totalRecords: Math.max(1, Math.floor(totalRecords * 0.3)),
            fileContent: neftContent,
            generatedBy: 'system-seed',
            generatedAt: new Date(run.periodEndDate || new Date('2026-05-28')),
            status: 'submitted',
            companyId: run.companyId,
          },
        });
        bpfCreated++;
      }
    }

    // If no payroll runs exist, create a standalone bank payment file
    if (payrollRuns.length === 0) {
      const standaloneExisting = await db.bankPaymentFile.findFirst({
        where: { companyId: tcg.id },
      });
      if (!standaloneExisting) {
        const totalAmount = tcgEmployees.reduce((sum, emp) => sum + (emp.salary ? emp.salary / 12 : 0), 0);
        await db.bankPaymentFile.create({
          data: {
            payrollRunId: 'standalone-seed',
            fileName: `NACH_2026-05_${new Date().toISOString().slice(0, 10)}.txt`,
            fileFormat: 'NACH',
            bankCode: 'HDFC',
            totalAmount,
            totalRecords: tcgEmployees.length,
            fileContent: generateNACHContent({ payrollPeriod: '2026-05' } as Record<string, unknown>, totalAmount, tcgEmployees.length),
            generatedBy: 'system-seed',
            generatedAt: new Date('2026-05-28'),
            status: 'generated',
            companyId: tcg.id,
          },
        });
        bpfCreated++;
      }
    }
    results.bankPaymentFiles = bpfCreated;
    console.log(`  ✓ Created ${bpfCreated} bank payment files`);

    // ══════════════════════════════════════════════════════════════
    // 8. FNF CALCULATIONS
    // ══════════════════════════════════════════════════════════════
    console.log('\n📋 Creating FNF Calculations...');

    // Use some employees for FNF settlement samples
    const fnfEmployeePool = allSeededEmployees.slice(0, Math.min(3, allSeededEmployees.length));
    const fnfDefs = [
      {
        pendingSalary: 8333,
        leaveEncashment: 15000,
        bonus: 20000,
        incentives: 5000,
        reimbursements: 3200,
        noticeRecovery: 0,
        assetRecovery: 0,
        loanRecovery: 4280,
        taxDeduction: 8500,
        otherRecoveries: 500,
        totalEarnings: 131533,
        totalDeductions: 13280,
        netAmount: 118253,
        currency: 'INR',
        status: 'approved',
        remarks: 'FNF settlement for resigned employee - all dues cleared',
      },
      {
        pendingSalary: 12500,
        leaveEncashment: 10000,
        bonus: 0,
        incentives: 3000,
        reimbursements: 1500,
        noticeRecovery: 25000,
        assetRecovery: 5000,
        loanRecovery: 9268,
        taxDeduction: 12000,
        otherRecoveries: 0,
        totalEarnings: 27000,
        totalDeductions: 51268,
        netAmount: -24268,
        currency: 'USD',
        status: 'pending',
        remarks: 'FNF settlement pending - notice period not served, recovery exceeds dues',
      },
      {
        pendingSalary: 6667,
        leaveEncashment: 8000,
        bonus: 0,
        incentives: 0,
        reimbursements: 0,
        noticeRecovery: 0,
        assetRecovery: 0,
        loanRecovery: 0,
        taxDeduction: 4600,
        otherRecoveries: 0,
        totalEarnings: 14667,
        totalDeductions: 4600,
        netAmount: 10067,
        currency: 'USD',
        status: 'paid',
        paidAt: new Date('2026-05-15'),
        remarks: 'FNF settlement completed - payment disbursed via direct deposit',
      },
    ];

    let fnfCreated = 0;
    for (let i = 0; i < fnfDefs.length; i++) {
      if (i >= fnfEmployeePool.length) break;
      const emp = fnfEmployeePool[i];
      const fnf = fnfDefs[i];

      const existing = await db.fNFCalculation.findFirst({
        where: { employeeId: emp.id },
      });
      if (existing) continue;

      const approver = allSeededEmployees.find(e => e.id !== emp.id);

      await db.fNFCalculation.create({
        data: {
          employeeId: emp.id,
          pendingSalary: fnf.pendingSalary,
          leaveEncashment: fnf.leaveEncashment,
          bonus: fnf.bonus,
          incentives: fnf.incentives,
          reimbursements: fnf.reimbursements,
          noticeRecovery: fnf.noticeRecovery,
          assetRecovery: fnf.assetRecovery,
          loanRecovery: fnf.loanRecovery,
          taxDeduction: fnf.taxDeduction,
          otherRecoveries: fnf.otherRecoveries,
          totalEarnings: fnf.totalEarnings,
          totalDeductions: fnf.totalDeductions,
          netAmount: fnf.netAmount,
          currency: fnf.currency,
          status: fnf.status,
          approvedBy: fnf.status === 'approved' || fnf.status === 'paid' ? approver?.id : null,
          approvedAt: fnf.status === 'approved' || fnf.status === 'paid' ? new Date('2026-05-10') : null,
          paidAt: fnf.paidAt || null,
          remarks: fnf.remarks,
        },
      });
      fnfCreated++;
    }
    results.fnfCalculations = fnfCreated;
    console.log(`  ✓ Created ${fnfCreated} FNF calculations`);

    // ══════════════════════════════════════════════════════════════
    // 9. ADDITIONAL PAYROLL INPUTS (attendance, variable pay, one-time bonus)
    // ══════════════════════════════════════════════════════════════
    console.log('\n📋 Creating Additional Payroll Inputs...');

    let additionalInputCount = 0;

    // Find the latest payroll run for inputs
    const latestRun = payrollRuns.length > 0
      ? payrollRuns.sort((a, b) => new Date(b.periodEndDate).getTime() - new Date(a.periodEndDate).getTime())[0]
      : null;

    if (latestRun && allSeededEmployees.length > 0) {
      // Attendance input - present days for a few employees
      const attendanceEmp1 = allSeededEmployees[0];
      const attendanceEmp2 = allSeededEmployees.length > 1 ? allSeededEmployees[1] : null;

      if (attendanceEmp1) {
        const existingAtt = await db.payrollInput.findFirst({
          where: { payrollRunId: latestRun.id, employeeId: attendanceEmp1.id, inputType: 'ATTENDANCE' },
        });
        if (!existingAtt) {
          await db.payrollInput.create({
            data: {
              payrollRunId: latestRun.id,
              employeeId: attendanceEmp1.id,
              inputType: 'ATTENDANCE',
              componentCode: 'BASE_US',
              inputValueNumeric: 22,
              unitType: 'DAYS',
              inputDateFrom: new Date('2026-06-01'),
              inputDateTo: new Date('2026-06-30'),
              currencyCode: 'USD',
              approvalStatus: 'APPROVED',
              source: 'SYSTEM_GENERATED',
              remarks: 'Present days - June 2026',
            },
          });
          additionalInputCount++;
        }
      }

      if (attendanceEmp2) {
        const existingAtt2 = await db.payrollInput.findFirst({
          where: { payrollRunId: latestRun.id, employeeId: attendanceEmp2.id, inputType: 'ATTENDANCE' },
        });
        if (!existingAtt2) {
          await db.payrollInput.create({
            data: {
              payrollRunId: latestRun.id,
              employeeId: attendanceEmp2.id,
              inputType: 'ATTENDANCE',
              componentCode: 'BASE_US',
              inputValueNumeric: 20,
              unitType: 'DAYS',
              inputDateFrom: new Date('2026-06-01'),
              inputDateTo: new Date('2026-06-30'),
              currencyCode: 'USD',
              approvalStatus: 'APPROVED',
              source: 'SYSTEM_GENERATED',
              remarks: 'Present days - June 2026 (2 days leave)',
            },
          });
          additionalInputCount++;
        }
      }

      // Variable pay input
      const variablePayEmp = allSeededEmployees.length > 2 ? allSeededEmployees[2] : allSeededEmployees[0];
      if (variablePayEmp) {
        const existingVP = await db.payrollInput.findFirst({
          where: { payrollRunId: latestRun.id, employeeId: variablePayEmp.id, inputType: 'VARIABLE_PAY' },
        });
        if (!existingVP) {
          await db.payrollInput.create({
            data: {
              payrollRunId: latestRun.id,
              employeeId: variablePayEmp.id,
              inputType: 'VARIABLE_PAY',
              componentCode: 'BONUS',
              inputValueNumeric: 2500,
              unitType: 'AMOUNT',
              inputDateFrom: new Date('2026-06-01'),
              inputDateTo: new Date('2026-06-30'),
              currencyCode: 'USD',
              approvalStatus: 'APPROVED',
              source: 'MANUAL',
              remarks: 'Quarterly variable pay - Q2 2026',
            },
          });
          additionalInputCount++;
        }
      }

      // One-time bonus input
      const bonusEmp = allSeededEmployees.length > 3 ? allSeededEmployees[3] : allSeededEmployees[0];
      if (bonusEmp) {
        const existingBonus = await db.payrollInput.findFirst({
          where: { payrollRunId: latestRun.id, employeeId: bonusEmp.id, inputType: 'ONE_TIME_BONUS' },
        });
        if (!existingBonus) {
          await db.payrollInput.create({
            data: {
              payrollRunId: latestRun.id,
              employeeId: bonusEmp.id,
              inputType: 'ONE_TIME_BONUS',
              componentCode: 'BONUS',
              inputValueNumeric: 5000,
              unitType: 'AMOUNT',
              inputDateFrom: new Date('2026-06-15'),
              inputDateTo: new Date('2026-06-15'),
              currencyCode: 'USD',
              approvalStatus: 'APPROVED',
              source: 'MANUAL',
              remarks: 'Referral bonus - successful hire referral',
            },
          });
          additionalInputCount++;
        }
      }
    } else {
      console.log('[Full Payroll Seed] No payroll runs found, skipping additional payroll inputs');
    }
    results.additionalPayrollInputs = additionalInputCount;
    console.log(`  ✓ Created ${additionalInputCount} additional payroll inputs`);

    // ══════════════════════════════════════════════════════════════
    // COMPLETE
    // ══════════════════════════════════════════════════════════════
    console.log('\n[Full Payroll Seed] Complete!');

    return NextResponse.json(
      {
        success: true,
        message: 'Enhanced payroll seed completed successfully',
        results,
        summary: {
          companies: companies.length,
          employees: allSeededEmployees.length,
          payrollRuns: payrollRuns.length,
          payrollDefinitions: results.payrollDefinitions,
          employeePaymentMethods: results.employeePaymentMethods,
          loans: results.loans,
          overtimeRecords: results.overtimeRecords,
          payrollHolds: results.payrollHolds,
          payrollValidations: results.payrollValidations,
          bankPaymentFiles: results.bankPaymentFiles,
          fnfCalculations: results.fnfCalculations,
          additionalPayrollInputs: results.additionalPayrollInputs,
        },
      },
      { headers: corsHeaders() }
    );
  } catch (error: unknown) {
    const err = error as Error;
    console.error('[Full Payroll Seed] Error:', err);
    return NextResponse.json(
      {
        success: false,
        error: err.message || 'Unknown error',
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
      },
      { status: 500, headers: corsHeaders() }
    );
  }
}

// Also support GET for convenience
export async function GET(request: Request) {
  // ─── LIVE MODE GUARD ───
  if (isLiveMode(request)) {
    return NextResponse.json({ error: 'Seeding is disabled on the live platform.', code: 'LIVE_MODE_BLOCKED' }, { status: 403, headers: corsHeaders() });
  }
  return POST(request);
}

// ─── Helper: Generate sample NACH file content ──────────────────
function generateNACHContent(run: { payrollPeriod?: string | null }, totalAmount: number, totalRecords: number): string {
  const period = run.payrollPeriod || '2026-05';
  const lines = [
    `NACH_CREDIT_FILE`,
    `HDR|${period}|NACH|HDFC0001234|TECHCORP GLOBAL|${totalAmount.toFixed(2)}|${totalRecords}|${new Date().toISOString().slice(0, 10)}`,
    `DTL|EMP001|SAVINGS|123456789012|HDFC0001234|${(totalAmount / totalRecords).toFixed(2)}|EMPLOYEE 01|SALARY`,
    `DTL|EMP002|SAVINGS|123456789013|ICIC0005678|${(totalAmount / totalRecords).toFixed(2)}|EMPLOYEE 02|SALARY`,
    `DTL|EMP003|CURRENT|123456789014|SBIN0009012|${(totalAmount / totalRecords).toFixed(2)}|EMPLOYEE 03|SALARY`,
    `TRL|${totalRecords}|${totalAmount.toFixed(2)}|END_OF_FILE`,
  ];
  return lines.join('\n');
}

// ─── Helper: Generate sample NEFT file content ──────────────────
function generateNEFTContent(run: { payrollPeriod?: string | null }, totalAmount: number, totalRecords: number): string {
  const period = run.payrollPeriod || '2026-05';
  const lines = [
    `BENE_NAME,ACCOUNT_NO,IFSC_CODE,AMOUNT,PAYMENT_TYPE,REMARKS`,
    `Employee 01,123456789012,HDFC0001234,${(totalAmount / totalRecords).toFixed(2)},NEFT,Salary-${period}`,
    `Employee 02,123456789013,ICIC0005678,${(totalAmount / totalRecords).toFixed(2)},NEFT,Salary-${period}`,
    `Employee 03,123456789014,SBIN0009012,${(totalAmount / totalRecords).toFixed(2)},NEFT,Salary-${period}`,
  ];
  return lines.join('\n');
}
