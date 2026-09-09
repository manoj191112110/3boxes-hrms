/**
 * Database Setup Endpoint
 *
 * POST /api/setup-database — Checks database schema status and identifies missing tables/seed data
 * This is needed because the Vercel build no longer runs prisma db push
 *
 * Call this endpoint after deployment to check database status and identify what needs setup.
 */
import { NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function POST() {
  try {
    console.log('[DB Setup] Starting database schema verification...');

    const results: string[] = [];

    // Test each critical table by attempting a count query
    const tableTests = [
      { name: 'Tenant', test: () => db.tenant.count() },
      { name: 'Company', test: () => db.company.count() },
      { name: 'Employee', test: () => db.employee.count() },
      { name: 'User', test: () => db.user.count() },
      { name: 'PayrollComponent', test: () => db.payrollComponent.count() },
      { name: 'StatutoryComponent', test: () => db.statutoryComponent.count() },
      { name: 'CTCTemplate', test: () => db.cTCTemplate.count() },
      { name: 'TaxSlabTable', test: () => db.taxSlabTable.count() },
      { name: 'SalaryStructure', test: () => db.salaryStructure.count() },
      { name: 'CurrencyConfig', test: () => db.currencyConfig.count() },
      { name: 'ExchangeRate', test: () => db.exchangeRate.count() },
      { name: 'DimensionDefinition', test: () => db.dimensionDefinition.count() },
      { name: 'ComplianceObligation', test: () => db.complianceObligation.count() },
      { name: 'GLAccountMapping', test: () => db.gLAccountMapping.count() },
      { name: 'PayrollRun', test: () => db.payrollRun.count() },
      { name: 'PayrollTransactionLine', test: () => db.payrollTransactionLine.count() },
      { name: 'PayrollInput', test: () => db.payrollInput.count() },
      { name: 'PayrollHold', test: () => db.payrollHold.count() },
      { name: 'PayrollValidation', test: () => db.payrollValidation.count() },
      { name: 'BankPaymentFile', test: () => db.bankPaymentFile.count() },
      { name: 'PayrollDefinition', test: () => db.payrollDefinition.count() },
      { name: 'EmployeePaymentMethod', test: () => db.employeePaymentMethod.count() },
      { name: 'Loan', test: () => db.loan.count() },
      { name: 'OvertimeRecord', test: () => db.overtimeRecord.count() },
      { name: 'FNFCalculation', test: () => db.fNFCalculation.count() },
      { name: 'LeaveType', test: () => db.leaveType.count() },
      { name: 'LeaveBalance', test: () => db.leaveBalance.count() },
      { name: 'Attendance', test: () => db.attendance.count() },
      { name: 'Shift', test: () => db.shift.count() },
    ];

    const tableStatus: Record<string, { exists: boolean; count: number; error?: string }> = {};

    for (const table of tableTests) {
      try {
        const count = await table.test();
        tableStatus[table.name] = { exists: true, count };
        results.push(`✅ ${table.name}: ${count} records`);
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        tableStatus[table.name] = { exists: false, count: 0, error: errMsg.substring(0, 200) };
        results.push(`❌ ${table.name}: NOT ACCESSIBLE`);
      }
    }

    // Count existing vs missing tables
    const existingTables = Object.values(tableStatus).filter(t => t.exists).length;
    const missingTables = Object.values(tableStatus).filter(t => !t.exists).length;

    // Check if seed data exists
    const hasTenants = tableStatus['Tenant']?.exists && tableStatus['Tenant']?.count > 0;
    const hasUsers = tableStatus['User']?.exists && tableStatus['User']?.count > 0;
    const hasEmployees = tableStatus['Employee']?.exists && tableStatus['Employee']?.count > 0;
    const hasPayrollComponents = tableStatus['PayrollComponent']?.exists && tableStatus['PayrollComponent']?.count > 0;

    let seedNeeded = false;
    if (!hasTenants || !hasUsers || !hasEmployees) {
      results.push('📋 Base seed needed: Call GET /api/seed to seed base data');
      seedNeeded = true;
    }
    if (hasEmployees && !hasPayrollComponents) {
      results.push('📋 Payroll seed needed: Call GET /api/seed/payroll to seed payroll data');
      seedNeeded = true;
    }
    if (hasPayrollComponents && tableStatus['PayrollDefinition']?.exists && tableStatus['PayrollDefinition']?.count === 0) {
      results.push('📋 Full payroll seed needed: Call GET /api/seed/payroll/full to seed enhanced payroll data');
      seedNeeded = true;
    }

    if (!seedNeeded && missingTables === 0) {
      results.push('✅ Database is fully set up and seeded!');
    }

    return NextResponse.json({
      success: true,
      tableStatus,
      summary: {
        totalTables: tableTests.length,
        accessibleTables: existingTables,
        missingTables,
        seedNeeded,
      },
      messages: results,
    }, { headers: corsHeaders });

  } catch (error: unknown) {
    const err = error as Error;
    console.error('[DB Setup] Error:', err);
    return NextResponse.json({
      success: false,
      error: err.message || 'Unknown error',
    }, { status: 500, headers: corsHeaders });
  }
}

export async function GET() {
  return POST();
}
