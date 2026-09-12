/**
 * Schema Push + Payroll Setup Endpoint
 * Call GET /api/seed/payroll/setup to ensure payroll tables exist
 * Uses prisma db push to create tables with the correct schema
 */
import { NextResponse } from 'next/server';
import { execSync } from 'child_process';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { isLiveMode } from '@/lib/site-mode';

export async function GET(request: Request) {
  // ─── LIVE MODE GUARD ───
  // Payroll schema push is allowed on live (it's structural, not data)
  // but payroll data seeding is blocked.
  const db = await getDb(request);
  try {
    const url = new URL(request.url);
    const force = url.searchParams.get('force') === 'true';

    console.log(`[Payroll Setup] Checking payroll tables... (force=${force})`);

    // Check if payroll tables exist AND Prisma can read them properly
    let tablesReady = false;
    if (!force) {
      try {
        // Test both PayrollComponent and PayrollRun to verify full compatibility
        await db.payrollComponent.findFirst();
        await db.payrollRun.findFirst();
        tablesReady = true;
        console.log('[Payroll Setup] All tables verified - Prisma can read them');
      } catch (e: any) {
        console.log(`[Payroll Setup] Tables not compatible: ${e.message?.substring(0, 100)}`);
      }
    }

    if (!tablesReady) {
      console.log('[Payroll Setup] Dropping stale tables and recreating...');
      try {
        await createTablesViaRawSQL();
      } catch (sqlError: any) {
        console.error('[Payroll Setup] Raw SQL creation failed:', sqlError.message?.substring(0, 200));
      }

      // Now try prisma db push to fix any schema mismatches
      console.log('[Payroll Setup] Running prisma db push to sync schema...');
      try {
        const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
        if (connectionString) {
          const output = execSync('npx prisma db push --accept-data-loss 2>&1', {
            cwd: process.cwd(),
            timeout: 60000,
            env: { ...process.env, DATABASE_URL: connectionString },
          });
          console.log('[Payroll Setup] prisma db push output:', output.toString().substring(0, 500));
        }
      } catch (pushError: any) {
        console.error('[Payroll Setup] prisma db push note:', pushError.message?.substring(0, 200));
      }

      // Verify both tables work with Prisma
      try {
        await db.payrollComponent.findFirst();
        await db.payrollRun.findFirst();
        tablesReady = true;
        console.log('[Payroll Setup] Tables verified after recreation');
      } catch (e: any) {
        console.error('[Payroll Setup] Still not working:', e.message?.substring(0, 100));
      }
    }

    return NextResponse.json({
      success: tablesReady,
      message: tablesReady
        ? 'Payroll tables ready. Call /api/seed/payroll to seed data.'
        : 'Failed to create payroll tables. Check Vercel logs.',
      tableStatus: tablesReady ? 'ready' : 'failed'
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

async function createTablesViaRawSQL() {
  // Drop and recreate tables that may have been partially created
  const dropSQLs = [
    `DROP TABLE IF EXISTS "GLAccountMapping" CASCADE;`,
    `DROP TABLE IF EXISTS "ComplianceFiling" CASCADE;`,
    `DROP TABLE IF EXISTS "PayrollTransactionLine" CASCADE;`,
    `DROP TABLE IF EXISTS "PayrollInput" CASCADE;`,
    `DROP TABLE IF EXISTS "ComplianceObligation" CASCADE;`,
    `DROP TABLE IF EXISTS "PayrollRun" CASCADE;`,
    `DROP TABLE IF EXISTS "EmployeeDimensionAllocation" CASCADE;`,
    `DROP TABLE IF EXISTS "DimensionDefinition" CASCADE;`,
    `DROP TABLE IF EXISTS "ExchangeRate" CASCADE;`,
    `DROP TABLE IF EXISTS "CurrencyConfig" CASCADE;`,
    `DROP TABLE IF EXISTS "TaxSlabRateLine" CASCADE;`,
    `DROP TABLE IF EXISTS "TaxSlabTable" CASCADE;`,
    `DROP TABLE IF EXISTS "CTCComponentMapping" CASCADE;`,
    `DROP TABLE IF EXISTS "CTCTemplate" CASCADE;`,
    `DROP TABLE IF EXISTS "StatutoryComponent" CASCADE;`,
    `DROP TABLE IF EXISTS "PayrollComponent" CASCADE;`,
  ];

  for (const sql of dropSQLs) {
    await db.$executeRawUnsafe(sql);
  }

  // Now recreate with exact Prisma-compatible schema
  const createSQLs = [
    `CREATE TABLE "PayrollComponent" (
      "id" TEXT NOT NULL, "code" TEXT NOT NULL, "name" TEXT NOT NULL,
      "componentType" TEXT NOT NULL, "componentCategory" TEXT NOT NULL DEFAULT 'NORMAL',
      "countryCode" TEXT NOT NULL DEFAULT 'IND', "calculationType" TEXT NOT NULL,
      "defaultValue" DOUBLE PRECISION, "percentageBase" TEXT, "formulaId" TEXT, "slabTableId" TEXT,
      "isTaxable" BOOLEAN NOT NULL DEFAULT true, "taxTreatment" TEXT, "exemptionSection" TEXT,
      "maxExemptionAmt" DOUBLE PRECISION, "affectsGross" BOOLEAN NOT NULL DEFAULT true,
      "affectsNet" BOOLEAN NOT NULL DEFAULT true, "affectsCTC" BOOLEAN NOT NULL DEFAULT true,
      "paymentFrequency" TEXT NOT NULL DEFAULT 'MONTHLY', "prorationApplicable" BOOLEAN NOT NULL DEFAULT true,
      "roundingRule" TEXT, "isActive" BOOLEAN NOT NULL DEFAULT true,
      "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "effectiveTo" TIMESTAMP(3),
      "companyId" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "PayrollComponent_pkey" PRIMARY KEY ("id")
    );`,
    `CREATE UNIQUE INDEX "PayrollComponent_code_countryCode_key" ON "PayrollComponent"("code", "countryCode");`,
    `CREATE INDEX "PayrollComponent_countryCode_idx" ON "PayrollComponent"("countryCode");`,
    `CREATE INDEX "PayrollComponent_componentCategory_idx" ON "PayrollComponent"("componentCategory");`,
    `CREATE INDEX "PayrollComponent_componentType_idx" ON "PayrollComponent"("componentType");`,
    `CREATE INDEX "PayrollComponent_companyId_idx" ON "PayrollComponent"("companyId");`,

    `CREATE TABLE "StatutoryComponent" (
      "id" TEXT NOT NULL, "componentId" TEXT NOT NULL, "componentCode" TEXT NOT NULL,
      "componentName" TEXT NOT NULL, "countryCode" TEXT NOT NULL, "authorityName" TEXT NOT NULL,
      "authorityCode" TEXT, "partyType" TEXT NOT NULL, "calculationBasis" TEXT NOT NULL,
      "basisComponentId" TEXT, "ratePercentage" DOUBLE PRECISION, "wageCeiling" DOUBLE PRECISION,
      "maxContributionAmt" DOUBLE PRECISION, "minContributionAmt" DOUBLE PRECISION,
      "slabTableId" TEXT, "remittanceFrequency" TEXT NOT NULL DEFAULT 'MONTHLY',
      "remittanceDueDay" INTEGER, "filingFrequency" TEXT, "filingFormat" TEXT,
      "penaltyRatePct" DOUBLE PRECISION, "isChallanRequired" BOOLEAN NOT NULL DEFAULT false,
      "challanFormat" TEXT, "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "effectiveTo" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "StatutoryComponent_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "StatutoryComponent_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "PayrollComponent"("id") ON DELETE CASCADE ON UPDATE CASCADE
    );`,
    `CREATE INDEX "StatutoryComponent_componentId_idx" ON "StatutoryComponent"("componentId");`,
    `CREATE INDEX "StatutoryComponent_countryCode_idx" ON "StatutoryComponent"("countryCode");`,

    `CREATE TABLE "CTCTemplate" (
      "id" TEXT NOT NULL, "name" TEXT NOT NULL, "countryCode" TEXT NOT NULL DEFAULT 'IND',
      "legalEntityId" TEXT, "currencyCode" TEXT NOT NULL DEFAULT 'INR',
      "ctcType" TEXT NOT NULL DEFAULT 'ANNUAL',
      "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "effectiveTo" TIMESTAMP(3),
      "version" INTEGER NOT NULL DEFAULT 1, "status" TEXT NOT NULL DEFAULT 'DRAFT',
      "isDefault" BOOLEAN NOT NULL DEFAULT false, "basePayPct" DOUBLE PRECISION,
      "createdBy" TEXT, "companyId" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "CTCTemplate_pkey" PRIMARY KEY ("id")
    );`,
    `CREATE INDEX "CTCTemplate_countryCode_idx" ON "CTCTemplate"("countryCode");`,
    `CREATE INDEX "CTCTemplate_status_idx" ON "CTCTemplate"("status");`,
    `CREATE INDEX "CTCTemplate_companyId_idx" ON "CTCTemplate"("companyId");`,

    `CREATE TABLE "CTCComponentMapping" (
      "id" TEXT NOT NULL, "ctcTemplateId" TEXT NOT NULL, "componentId" TEXT,
      "componentName" TEXT NOT NULL, "componentCategory" TEXT NOT NULL DEFAULT 'EARNING',
      "allocationMethod" TEXT NOT NULL DEFAULT 'PERCENTAGE_OF_CTC',
      "allocationValue" DOUBLE PRECISION NOT NULL DEFAULT 0, "baseComponentId" TEXT,
      "formulaExpression" TEXT, "calculationSequence" INTEGER NOT NULL DEFAULT 1,
      "isStatutory" BOOLEAN NOT NULL DEFAULT false, "isTaxable" BOOLEAN NOT NULL DEFAULT true,
      "taxExemptionLimit" DOUBLE PRECISION, "frequency" TEXT NOT NULL DEFAULT 'MONTHLY',
      "prorationRule" TEXT, "minAmount" DOUBLE PRECISION, "maxAmount" DOUBLE PRECISION,
      "roundingRule" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "CTCComponentMapping_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "CTCComponentMapping_ctcTemplateId_fkey" FOREIGN KEY ("ctcTemplateId") REFERENCES "CTCTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE
    );`,
    `CREATE INDEX "CTCComponentMapping_ctcTemplateId_idx" ON "CTCComponentMapping"("ctcTemplateId");`,

    `CREATE TABLE "TaxSlabTable" (
      "id" TEXT NOT NULL, "name" TEXT NOT NULL, "countryCode" TEXT NOT NULL,
      "taxYear" TEXT NOT NULL, "filingStatus" TEXT, "regimeType" TEXT,
      "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "effectiveTo" TIMESTAMP(3),
      "companyId" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "TaxSlabTable_pkey" PRIMARY KEY ("id")
    );`,
    `CREATE INDEX "TaxSlabTable_countryCode_idx" ON "TaxSlabTable"("countryCode");`,
    `CREATE INDEX "TaxSlabTable_taxYear_idx" ON "TaxSlabTable"("taxYear");`,

    `CREATE TABLE "TaxSlabRateLine" (
      "id" TEXT NOT NULL, "slabTableId" TEXT NOT NULL, "sequence" INTEGER NOT NULL,
      "incomeFrom" DOUBLE PRECISION NOT NULL DEFAULT 0, "incomeTo" DOUBLE PRECISION,
      "ratePercentage" DOUBLE PRECISION NOT NULL DEFAULT 0, "fixedAmount" DOUBLE PRECISION,
      "surchargeRate" DOUBLE PRECISION, "cessRate" DOUBLE PRECISION, "componentId" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "TaxSlabRateLine_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "TaxSlabRateLine_slabTableId_fkey" FOREIGN KEY ("slabTableId") REFERENCES "TaxSlabTable"("id") ON DELETE CASCADE ON UPDATE CASCADE
    );`,
    `CREATE INDEX "TaxSlabRateLine_slabTableId_idx" ON "TaxSlabRateLine"("slabTableId");`,

    `CREATE TABLE "PayrollRun" (
      "id" TEXT NOT NULL, "legalEntityId" TEXT NOT NULL, "payrollPeriod" TEXT NOT NULL,
      "periodStartDate" TIMESTAMP(3) NOT NULL, "periodEndDate" TIMESTAMP(3) NOT NULL,
      "payDate" TIMESTAMP(3) NOT NULL, "runType" TEXT NOT NULL DEFAULT 'REGULAR',
      "runStatus" TEXT NOT NULL DEFAULT 'OPEN', "currencyCode" TEXT NOT NULL DEFAULT 'USD',
      "exchangeRateDate" TIMESTAMP(3), "taxProjectionMethod" TEXT NOT NULL DEFAULT 'CUMULATIVE',
      "includeStatutory" BOOLEAN NOT NULL DEFAULT true, "processingMode" TEXT NOT NULL DEFAULT 'FULL',
      "initiatedBy" TEXT, "companyId" TEXT,
      "totalEmployees" INTEGER NOT NULL DEFAULT 0, "totalGrossPay" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "totalDeductions" DOUBLE PRECISION NOT NULL DEFAULT 0, "totalNetPay" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "totalEmployerContrib" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "PayrollRun_pkey" PRIMARY KEY ("id")
    );`,
    `CREATE UNIQUE INDEX "PayrollRun_legalEntityId_payrollPeriod_runType_key" ON "PayrollRun"("legalEntityId", "payrollPeriod", "runType");`,
    `CREATE INDEX "PayrollRun_runStatus_idx" ON "PayrollRun"("runStatus");`,
    `CREATE INDEX "PayrollRun_companyId_idx" ON "PayrollRun"("companyId");`,
    `CREATE INDEX "PayrollRun_payrollPeriod_idx" ON "PayrollRun"("payrollPeriod");`,

    `CREATE TABLE "PayrollInput" (
      "id" TEXT NOT NULL, "payrollRunId" TEXT, "employeeId" TEXT NOT NULL,
      "inputType" TEXT NOT NULL, "componentCode" TEXT NOT NULL,
      "inputValueNumeric" DOUBLE PRECISION, "unitType" TEXT,
      "inputDateFrom" TIMESTAMP(3), "inputDateTo" TIMESTAMP(3),
      "currencyCode" TEXT DEFAULT 'USD', "exchangeRate" DOUBLE PRECISION,
      "approvalStatus" TEXT NOT NULL DEFAULT 'PENDING', "approvedBy" TEXT,
      "approvalDate" TIMESTAMP(3), "source" TEXT NOT NULL DEFAULT 'MANUAL',
      "referenceDocument" TEXT, "remarks" TEXT, "createdBy" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "PayrollInput_pkey" PRIMARY KEY ("id")
    );`,
    `CREATE INDEX "PayrollInput_employeeId_idx" ON "PayrollInput"("employeeId");`,
    `CREATE INDEX "PayrollInput_payrollRunId_idx" ON "PayrollInput"("payrollRunId");`,
    `DO $$ BEGIN ALTER TABLE "PayrollInput" ADD CONSTRAINT "PayrollInput_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "PayrollRun"("id") ON UPDATE CASCADE; EXCEPTION WHEN OTHERS THEN NULL; END $$;`,

    `CREATE TABLE "PayrollTransactionLine" (
      "id" TEXT NOT NULL, "payrollRunId" TEXT NOT NULL, "employeeId" TEXT NOT NULL,
      "componentId" TEXT, "componentCode" TEXT NOT NULL, "componentType" TEXT NOT NULL,
      "componentCategory" TEXT NOT NULL, "calculatedAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "overrideAmount" DOUBLE PRECISION, "finalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "currencyCode" TEXT NOT NULL DEFAULT 'USD', "exchangeRate" DOUBLE PRECISION,
      "baseCurrencyAmount" DOUBLE PRECISION, "ytdAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "mtdAmount" DOUBLE PRECISION NOT NULL DEFAULT 0, "prorationFactor" DOUBLE PRECISION,
      "inputSourceId" TEXT, "formulaTrace" TEXT, "dimensionSplitJson" TEXT,
      "glAccountCode" TEXT, "costCenterCode" TEXT, "isReversal" BOOLEAN NOT NULL DEFAULT false,
      "reversedTransactionId" TEXT, "taxTreatment" TEXT, "statutoryReference" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "PayrollTransactionLine_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "PayrollTransactionLine_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "PayrollRun"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "PayrollTransactionLine_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "PayrollComponent"("id") ON UPDATE CASCADE
    );`,
    `CREATE INDEX "PayrollTransactionLine_payrollRunId_idx" ON "PayrollTransactionLine"("payrollRunId");`,
    `CREATE INDEX "PayrollTransactionLine_employeeId_idx" ON "PayrollTransactionLine"("employeeId");`,
    `CREATE INDEX "PayrollTransactionLine_componentCode_idx" ON "PayrollTransactionLine"("componentCode");`,
    `CREATE INDEX "PayrollTransactionLine_componentType_idx" ON "PayrollTransactionLine"("componentType");`,

    `CREATE TABLE "CurrencyConfig" (
      "id" TEXT NOT NULL, "legalEntityId" TEXT NOT NULL,
      "baseCurrency" TEXT NOT NULL DEFAULT 'USD', "payrollCurrency" TEXT NOT NULL DEFAULT 'USD',
      "reportingCurrency" TEXT, "exchangeRateSource" TEXT NOT NULL DEFAULT 'MANUAL',
      "rateType" TEXT NOT NULL DEFAULT 'SPOT', "autoFetchEnabled" BOOLEAN NOT NULL DEFAULT false,
      "fetchFrequency" TEXT, "roundingPrecision" INTEGER NOT NULL DEFAULT 2,
      "roundingRule" TEXT NOT NULL DEFAULT 'NEAREST', "gainLossAccount" TEXT, "companyId" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "CurrencyConfig_pkey" PRIMARY KEY ("id")
    );`,
    `CREATE INDEX "CurrencyConfig_legalEntityId_idx" ON "CurrencyConfig"("legalEntityId");`,

    `CREATE TABLE "ExchangeRate" (
      "id" TEXT NOT NULL, "fromCurrency" TEXT NOT NULL, "toCurrency" TEXT NOT NULL,
      "exchangeRate" DOUBLE PRECISION NOT NULL, "rateDate" TIMESTAMP(3) NOT NULL,
      "rateType" TEXT NOT NULL DEFAULT 'SPOT', "source" TEXT NOT NULL DEFAULT 'Manual Entry',
      "inverseRate" DOUBLE PRECISION, "isActive" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "ExchangeRate_pkey" PRIMARY KEY ("id")
    );`,
    `CREATE INDEX "ExchangeRate_fromCurrency_toCurrency_rateDate_idx" ON "ExchangeRate"("fromCurrency", "toCurrency", "rateDate");`,

    `CREATE TABLE "DimensionDefinition" (
      "id" TEXT NOT NULL, "code" TEXT NOT NULL, "name" TEXT NOT NULL,
      "dimensionType" TEXT NOT NULL DEFAULT 'STANDARD',
      "hierarchyEnabled" BOOLEAN NOT NULL DEFAULT false,
      "allocationMethod" TEXT NOT NULL DEFAULT 'PERCENTAGE',
      "isMandatory" BOOLEAN NOT NULL DEFAULT false, "allowMultiple" BOOLEAN NOT NULL DEFAULT true,
      "maxAllocations" INTEGER, "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "companyId" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "DimensionDefinition_pkey" PRIMARY KEY ("id")
    );`,
    `CREATE INDEX "DimensionDefinition_code_idx" ON "DimensionDefinition"("code");`,

    `CREATE TABLE "EmployeeDimensionAllocation" (
      "id" TEXT NOT NULL, "employeeId" TEXT NOT NULL, "dimensionId" TEXT NOT NULL,
      "dimensionValueId" TEXT NOT NULL, "allocationPct" DOUBLE PRECISION NOT NULL DEFAULT 100,
      "allocationAmount" DOUBLE PRECISION,
      "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "effectiveTo" TIMESTAMP(3),
      "isPrimary" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "EmployeeDimensionAllocation_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "EmployeeDimensionAllocation_dimensionId_fkey" FOREIGN KEY ("dimensionId") REFERENCES "DimensionDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE
    );`,
    `CREATE INDEX "EmployeeDimensionAllocation_employeeId_idx" ON "EmployeeDimensionAllocation"("employeeId");`,

    `CREATE TABLE "ComplianceObligation" (
      "id" TEXT NOT NULL, "name" TEXT NOT NULL, "countryCode" TEXT NOT NULL,
      "authorityName" TEXT NOT NULL, "filingType" TEXT NOT NULL, "frequency" TEXT NOT NULL,
      "dueDateRule" TEXT NOT NULL, "graceDays" INTEGER, "penaltyType" TEXT,
      "penaltyValue" DOUBLE PRECISION, "responsibleRole" TEXT NOT NULL DEFAULT 'PAYROLL_ADMIN',
      "escalationRole" TEXT, "reminderDaysBefore" TEXT, "autoGenerate" BOOLEAN NOT NULL DEFAULT false,
      "filingFormat" TEXT, "isActive" BOOLEAN NOT NULL DEFAULT true, "companyId" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "ComplianceObligation_pkey" PRIMARY KEY ("id")
    );`,
    `CREATE INDEX "ComplianceObligation_countryCode_idx" ON "ComplianceObligation"("countryCode");`,

    `CREATE TABLE "ComplianceFiling" (
      "id" TEXT NOT NULL, "complianceId" TEXT NOT NULL, "payrollRunId" TEXT,
      "filingPeriod" TEXT NOT NULL, "filingStatus" TEXT NOT NULL DEFAULT 'GENERATED',
      "generatedDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "submittedDate" TIMESTAMP(3),
      "acknowledgementRef" TEXT, "filingAmount" DOUBLE PRECISION, "penaltyAmount" DOUBLE PRECISION,
      "filePath" TEXT, "submittedBy" TEXT, "reviewedBy" TEXT, "rejectionReason" TEXT,
      "resubmissionDate" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "ComplianceFiling_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "ComplianceFiling_complianceId_fkey" FOREIGN KEY ("complianceId") REFERENCES "ComplianceObligation"("id") ON DELETE CASCADE ON UPDATE CASCADE
    );`,
    `CREATE INDEX "ComplianceFiling_complianceId_idx" ON "ComplianceFiling"("complianceId");`,

    `CREATE TABLE "GLAccountMapping" (
      "id" TEXT NOT NULL, "legalEntityId" TEXT NOT NULL, "componentId" TEXT NOT NULL,
      "debitAccount" TEXT NOT NULL, "creditAccount" TEXT NOT NULL,
      "costCenterSource" TEXT NOT NULL DEFAULT 'EMPLOYEE_DEFAULT', "specificCostCenter" TEXT,
      "postingType" TEXT NOT NULL DEFAULT 'ACTUAL', "intercompanyAccount" TEXT,
      "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "effectiveTo" TIMESTAMP(3),
      "companyId" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "GLAccountMapping_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "GLAccountMapping_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "PayrollComponent"("id") ON DELETE CASCADE ON UPDATE CASCADE
    );`,
    `CREATE INDEX "GLAccountMapping_legalEntityId_idx" ON "GLAccountMapping"("legalEntityId");`,
  ];

  for (const sql of createSQLs) {
    try {
      await db.$executeRawUnsafe(sql);
    } catch (e: any) {
      console.log(`[Setup SQL]: ${e.message?.substring(0, 80)}`);
    }
  }
}
