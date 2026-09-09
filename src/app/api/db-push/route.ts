/**
 * Database Schema Push Endpoint
 *
 * POST /api/db-push — Creates missing database tables using raw SQL
 * This is needed because prisma db push can't run during Vercel build
 * and some newer tables don't exist in the production database.
 *
 * This endpoint uses Prisma's raw SQL execution to create the missing tables.
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
    console.log('[DB Push] Starting database schema push...');

    const results: string[] = [];

    // First, drop and recreate tables that have WRONG schema (old schema from a different model)
    // PayrollRun had old columns: month, year, status, totalAmount, employeeCount
    // Prisma expects: legalEntityId, payrollPeriod, runType, runStatus, etc.
    const dropAndRecreateStatements = [
      // Drop PayrollRun and recreate with correct schema
      `DROP TABLE IF EXISTS "PayrollRun" CASCADE`,
    ];

    for (const sql of dropAndRecreateStatements) {
      try {
        await db.$executeRawUnsafe(sql);
        results.push('✅ Dropped old PayrollRun table');
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        results.push(`⚠️ Drop failed: ${errMsg.substring(0, 100)}`);
      }
    }

    // Define CREATE TABLE statements for missing tables
    // These match the Prisma schema definitions exactly
    const createTableStatements = [
      // PayrollRun (recreated with correct schema matching Prisma)
      `CREATE TABLE IF NOT EXISTS "PayrollRun" (
        "id" TEXT NOT NULL,
        "legalEntityId" TEXT NOT NULL,
        "payrollPeriod" TEXT NOT NULL,
        "periodStartDate" TIMESTAMP(3) NOT NULL,
        "periodEndDate" TIMESTAMP(3) NOT NULL,
        "payDate" TIMESTAMP(3) NOT NULL,
        "runType" TEXT NOT NULL DEFAULT 'REGULAR',
        "runStatus" TEXT NOT NULL DEFAULT 'OPEN',
        "currencyCode" TEXT NOT NULL DEFAULT 'INR',
        "exchangeRateDate" TIMESTAMP(3),
        "taxProjectionMethod" TEXT NOT NULL DEFAULT 'CUMULATIVE',
        "includeStatutory" BOOLEAN NOT NULL DEFAULT true,
        "processingMode" TEXT NOT NULL DEFAULT 'FULL',
        "initiatedBy" TEXT,
        "companyId" TEXT,
        "totalEmployees" INTEGER NOT NULL DEFAULT 0,
        "totalGrossPay" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "totalDeductions" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "totalNetPay" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "totalEmployerContrib" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "PayrollRun_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "PayrollRun_legalEntityId_payrollPeriod_runType_key" UNIQUE ("legalEntityId", "payrollPeriod", "runType")
      )`,

      // PayrollHold
      `CREATE TABLE IF NOT EXISTS "PayrollHold" (
        "id" TEXT NOT NULL,
        "employeeId" TEXT NOT NULL,
        "holdType" TEXT NOT NULL DEFAULT 'FULL_HOLD',
        "reason" TEXT,
        "holdFromPeriod" TEXT,
        "holdToPeriod" TEXT,
        "heldComponents" TEXT,
        "releasedDate" TIMESTAMP(3),
        "releasedBy" TEXT,
        "status" TEXT NOT NULL DEFAULT 'active',
        "createdBy" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "PayrollHold_pkey" PRIMARY KEY ("id")
      )`,

      // BankPaymentFile
      `CREATE TABLE IF NOT EXISTS "BankPaymentFile" (
        "id" TEXT NOT NULL,
        "payrollRunId" TEXT,
        "fileName" TEXT NOT NULL,
        "fileFormat" TEXT NOT NULL DEFAULT 'NACH',
        "bankCode" TEXT,
        "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "totalRecords" INTEGER NOT NULL DEFAULT 0,
        "fileContent" TEXT,
        "generatedBy" TEXT,
        "generatedAt" TIMESTAMP(3),
        "status" TEXT NOT NULL DEFAULT 'generated',
        "companyId" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "BankPaymentFile_pkey" PRIMARY KEY ("id")
      )`,

      // PayrollDefinition
      `CREATE TABLE IF NOT EXISTS "PayrollDefinition" (
        "id" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "companyId" TEXT NOT NULL,
        "payFrequency" TEXT NOT NULL DEFAULT 'MONTHLY',
        "processingCutOff" INTEGER NOT NULL DEFAULT 25,
        "paymentDay" INTEGER NOT NULL DEFAULT 1,
        "currencyCode" TEXT NOT NULL DEFAULT 'INR',
        "countryCode" TEXT,
        "allowDirectDeposit" BOOLEAN NOT NULL DEFAULT true,
        "allowCheque" BOOLEAN NOT NULL DEFAULT false,
        "allowCash" BOOLEAN NOT NULL DEFAULT false,
        "costingSegments" TEXT,
        "status" TEXT NOT NULL DEFAULT 'active',
        "effectiveFrom" TIMESTAMP(3),
        "effectiveTo" TIMESTAMP(3),
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "PayrollDefinition_pkey" PRIMARY KEY ("id")
      )`,

      // EmployeePaymentMethod
      `CREATE TABLE IF NOT EXISTS "EmployeePaymentMethod" (
        "id" TEXT NOT NULL,
        "employeeId" TEXT NOT NULL,
        "paymentType" TEXT NOT NULL DEFAULT 'DIRECT_DEPOSIT',
        "bankName" TEXT,
        "bankAccountNo" TEXT,
        "bankIfscCode" TEXT,
        "bankBranch" TEXT,
        "accountType" TEXT,
        "currencyCode" TEXT NOT NULL DEFAULT 'INR',
        "splitType" TEXT,
        "splitValue" DOUBLE PRECISION,
        "isPrimary" BOOLEAN NOT NULL DEFAULT false,
        "priority" INTEGER NOT NULL DEFAULT 1,
        "effectiveFrom" TIMESTAMP(3),
        "effectiveTo" TIMESTAMP(3),
        "status" TEXT NOT NULL DEFAULT 'active',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "EmployeePaymentMethod_pkey" PRIMARY KEY ("id")
      )`,

      // Loan
      `CREATE TABLE IF NOT EXISTS "Loan" (
        "id" TEXT NOT NULL,
        "employeeId" TEXT NOT NULL,
        "loanType" TEXT NOT NULL DEFAULT 'PERSONAL',
        "loanAmount" DOUBLE PRECISION NOT NULL,
        "interestRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "tenureMonths" INTEGER NOT NULL,
        "emiAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "outstandingBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "disbursedAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "disbursedDate" TIMESTAMP(3),
        "startDate" TIMESTAMP(3),
        "endDate" TIMESTAMP(3),
        "recoveredAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "remainingEmis" INTEGER NOT NULL DEFAULT 0,
        "recoverySchedule" TEXT,
        "status" TEXT NOT NULL DEFAULT 'active',
        "approvedBy" TEXT,
        "approvedAt" TIMESTAMP(3),
        "remarks" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "Loan_pkey" PRIMARY KEY ("id")
      )`,

      // OvertimeRecord
      `CREATE TABLE IF NOT EXISTS "OvertimeRecord" (
        "id" TEXT NOT NULL,
        "employeeId" TEXT NOT NULL,
        "date" TIMESTAMP(3) NOT NULL,
        "hours" DOUBLE PRECISION NOT NULL,
        "rateType" TEXT NOT NULL DEFAULT 'HOURLY_RATE',
        "rate" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "reason" TEXT,
        "project" TEXT,
        "approvedBy" TEXT,
        "approvedAt" TIMESTAMP(3),
        "status" TEXT NOT NULL DEFAULT 'pending',
        "payrollRunId" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "OvertimeRecord_pkey" PRIMARY KEY ("id")
      )`,

      // FNFCalculation (might also be missing)
      `CREATE TABLE IF NOT EXISTS "FNFCalculation" (
        "id" TEXT NOT NULL,
        "employeeId" TEXT,
        "separationId" TEXT,
        "lastWorkingDate" TIMESTAMP(3),
        "basicSalary" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "da" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "hra" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "conveyance" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "medical" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "otherAllowances" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "grossSalary" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "pf" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "esi" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "tax" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "professionalTax" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "otherDeductions" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "totalDeductions" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "netSalary" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "leaveEncashment" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "gratuity" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "bonus" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "noticePay" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "noticeRecovery" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "loanRecovery" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "otherRecoveries" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "totalFnFAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "status" TEXT NOT NULL DEFAULT 'pending',
        "processedBy" TEXT,
        "processedAt" TIMESTAMP(3),
        "approvedBy" TEXT,
        "approvedAt" TIMESTAMP(3),
        "companyId" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "FNFCalculation_pkey" PRIMARY KEY ("id")
      )`,

      // PayrollValidation (might also be missing)
      `CREATE TABLE IF NOT EXISTS "PayrollValidation" (
        "id" TEXT NOT NULL,
        "payrollRunId" TEXT,
        "companyId" TEXT,
        "validationType" TEXT NOT NULL DEFAULT 'PRE_PAYROLL',
        "status" TEXT NOT NULL DEFAULT 'pending',
        "missingPaymentMethods" TEXT,
        "missingSalaryBasis" TEXT,
        "heldEmployees" TEXT,
        "newJoiners" TEXT,
        "terminations" TEXT,
        "errors" TEXT,
        "warnings" TEXT,
        "totalEmployees" INTEGER NOT NULL DEFAULT 0,
        "validEmployees" INTEGER NOT NULL DEFAULT 0,
        "invalidEmployees" INTEGER NOT NULL DEFAULT 0,
        "runBy" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "PayrollValidation_pkey" PRIMARY KEY ("id")
      )`,

      // ComplianceFiling (might also be missing)
      `CREATE TABLE IF NOT EXISTS "ComplianceFiling" (
        "id" TEXT NOT NULL,
        "payrollRunId" TEXT,
        "obligationId" TEXT,
        "filingPeriod" TEXT,
        "dueDate" TIMESTAMP(3),
        "filedDate" TIMESTAMP(3),
        "filedBy" TEXT,
        "status" TEXT NOT NULL DEFAULT 'pending',
        "challanNumber" TEXT,
        "challanDate" TIMESTAMP(3),
        "challanAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "receiptNumber" TEXT,
        "remarks" TEXT,
        "companyId" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "ComplianceFiling_pkey" PRIMARY KEY ("id")
      )`,

      // ─── Employee-related tables that might be missing ───

      // EmployeeSkill
      `CREATE TABLE IF NOT EXISTS "EmployeeSkill" (
        "id" TEXT NOT NULL,
        "employeeId" TEXT NOT NULL,
        "skill" TEXT NOT NULL,
        "level" TEXT NOT NULL DEFAULT 'intermediate',
        "yearsOfExp" INTEGER,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "EmployeeSkill_pkey" PRIMARY KEY ("id")
      )`,

      // Dependent
      `CREATE TABLE IF NOT EXISTS "Dependent" (
        "id" TEXT NOT NULL,
        "employeeId" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "relation" TEXT NOT NULL,
        "dateOfBirth" TIMESTAMP(3),
        "gender" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "Dependent_pkey" PRIMARY KEY ("id")
      )`,

      // Qualification
      `CREATE TABLE IF NOT EXISTS "Qualification" (
        "id" TEXT NOT NULL,
        "employeeId" TEXT NOT NULL,
        "degree" TEXT NOT NULL,
        "institution" TEXT NOT NULL,
        "year" INTEGER NOT NULL,
        "percentage" DOUBLE PRECISION,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "Qualification_pkey" PRIMARY KEY ("id")
      )`,

      // Experience
      `CREATE TABLE IF NOT EXISTS "Experience" (
        "id" TEXT NOT NULL,
        "employeeId" TEXT NOT NULL,
        "company" TEXT NOT NULL,
        "designation" TEXT NOT NULL,
        "startDate" TIMESTAMP(3) NOT NULL,
        "endDate" TIMESTAMP(3),
        "isCurrent" BOOLEAN NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "Experience_pkey" PRIMARY KEY ("id")
      )`,

      // Document (employee documents)
      `CREATE TABLE IF NOT EXISTS "Document" (
        "id" TEXT NOT NULL,
        "employeeId" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "type" TEXT NOT NULL,
        "fileUrl" TEXT,
        "status" TEXT NOT NULL DEFAULT 'pending',
        "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "expiryDate" TIMESTAMP(3),
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
      )`,

      // LeaveBalance
      `CREATE TABLE IF NOT EXISTS "LeaveBalance" (
        "id" TEXT NOT NULL,
        "employeeId" TEXT NOT NULL,
        "leaveTypeId" TEXT NOT NULL,
        "year" INTEGER NOT NULL,
        "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "used" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "remaining" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "carryForward" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "LeaveBalance_pkey" PRIMARY KEY ("id")
      )`,

      // AssetAssignment
      `CREATE TABLE IF NOT EXISTS "AssetAssignment" (
        "id" TEXT NOT NULL,
        "assetId" TEXT NOT NULL,
        "employeeId" TEXT NOT NULL,
        "assignedDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "returnDate" TIMESTAMP(3),
        "expectedReturn" TIMESTAMP(3),
        "condition" TEXT NOT NULL DEFAULT 'good',
        "notes" TEXT,
        "status" TEXT NOT NULL DEFAULT 'assigned',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "AssetAssignment_pkey" PRIMARY KEY ("id")
      )`,

      // EmployeeCompanyMapping
      `CREATE TABLE IF NOT EXISTS "EmployeeCompanyMapping" (
        "id" TEXT NOT NULL,
        "employeeId" TEXT NOT NULL,
        "companyId" TEXT NOT NULL,
        "employeeCode" TEXT NOT NULL,
        "departmentId" TEXT,
        "designationId" TEXT,
        "branchId" TEXT,
        "status" TEXT NOT NULL DEFAULT 'active',
        "isPrimary" BOOLEAN NOT NULL DEFAULT false,
        "dateOfJoining" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "EmployeeCompanyMapping_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "EmployeeCompanyMapping_employeeId_companyId_key" UNIQUE ("employeeId", "companyId")
      )`,

      // ─── Demo Seed Required Tables ───

      // LeaveType
      `CREATE TABLE IF NOT EXISTS "LeaveType" (
        "id" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "code" TEXT NOT NULL,
        "description" TEXT,
        "defaultDays" INTEGER NOT NULL DEFAULT 0,
        "isPaid" BOOLEAN NOT NULL DEFAULT true,
        "carryForward" BOOLEAN NOT NULL DEFAULT false,
        "maxCarryForward" INTEGER,
        "encashmentAllowed" BOOLEAN NOT NULL DEFAULT false,
        "encashmentBasis" TEXT DEFAULT 'basic',
        "maxEncashmentDays" INTEGER DEFAULT 0,
        "attachmentMandatory" BOOLEAN NOT NULL DEFAULT false,
        "attachmentMandatoryAfterDays" INTEGER DEFAULT 0,
        "status" TEXT NOT NULL DEFAULT 'active',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "LeaveType_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "LeaveType_code_key" UNIQUE ("code")
      )`,

      // LeaveRequest
      `CREATE TABLE IF NOT EXISTS "LeaveRequest" (
        "id" TEXT NOT NULL,
        "employeeId" TEXT NOT NULL,
        "leaveTypeId" TEXT NOT NULL,
        "startDate" TIMESTAMP(3) NOT NULL,
        "endDate" TIMESTAMP(3) NOT NULL,
        "numberOfDays" INTEGER NOT NULL,
        "halfDay" BOOLEAN NOT NULL DEFAULT false,
        "reason" TEXT,
        "status" TEXT NOT NULL DEFAULT 'pending',
        "approvedBy" TEXT,
        "approvedAt" TIMESTAMP(3),
        "comments" TEXT,
        "appliedDate" TIMESTAMP(3),
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "LeaveRequest_pkey" PRIMARY KEY ("id")
      )`,

      // Attendance
      `CREATE TABLE IF NOT EXISTS "Attendance" (
        "id" TEXT NOT NULL,
        "employeeId" TEXT NOT NULL,
        "date" TIMESTAMP(3) NOT NULL,
        "checkIn" TIMESTAMP(3),
        "checkOut" TIMESTAMP(3),
        "workHours" DOUBLE PRECISION DEFAULT 0,
        "overtime" DOUBLE PRECISION DEFAULT 0,
        "status" TEXT NOT NULL DEFAULT 'present',
        "location" TEXT,
        "notes" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
      )`,

      // Shift
      `CREATE TABLE IF NOT EXISTS "Shift" (
        "id" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "code" TEXT NOT NULL,
        "startTime" TEXT NOT NULL,
        "endTime" TEXT NOT NULL,
        "companyId" TEXT,
        "graceMinutes" INTEGER DEFAULT 15,
        "isNight" BOOLEAN NOT NULL DEFAULT false,
        "status" TEXT NOT NULL DEFAULT 'active',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "Shift_pkey" PRIMARY KEY ("id")
      )`,

      // Holiday
      `CREATE TABLE IF NOT EXISTS "Holiday" (
        "id" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "date" TIMESTAMP(3) NOT NULL,
        "type" TEXT,
        "country" TEXT,
        "description" TEXT,
        "companyId" TEXT,
        "isOptional" BOOLEAN NOT NULL DEFAULT false,
        "optionalQuota" INTEGER,
        "status" TEXT NOT NULL DEFAULT 'active',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "Holiday_pkey" PRIMARY KEY ("id")
      )`,

      // Policy
      `CREATE TABLE IF NOT EXISTS "Policy" (
        "id" TEXT NOT NULL,
        "title" TEXT NOT NULL,
        "content" TEXT,
        "category" TEXT,
        "companyId" TEXT,
        "version" TEXT DEFAULT '1.0',
        "status" TEXT NOT NULL DEFAULT 'active',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "Policy_pkey" PRIMARY KEY ("id")
      )`,

      // Asset
      `CREATE TABLE IF NOT EXISTS "Asset" (
        "id" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "category" TEXT,
        "serialNumber" TEXT,
        "value" DOUBLE PRECISION,
        "companyId" TEXT,
        "status" TEXT NOT NULL DEFAULT 'available',
        "purchaseDate" TIMESTAMP(3),
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
      )`,

      // Ticket
      `CREATE TABLE IF NOT EXISTS "Ticket" (
        "id" TEXT NOT NULL,
        "employeeId" TEXT,
        "subject" TEXT NOT NULL,
        "category" TEXT,
        "priority" TEXT,
        "description" TEXT,
        "status" TEXT NOT NULL DEFAULT 'open',
        "assignedTo" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
      )`,

      // PerformanceReview
      `CREATE TABLE IF NOT EXISTS "PerformanceReview" (
        "id" TEXT NOT NULL,
        "employeeId" TEXT NOT NULL,
        "reviewerId" TEXT,
        "period" TEXT,
        "status" TEXT NOT NULL DEFAULT 'draft',
        "overallRating" INTEGER,
        "communicationRating" INTEGER,
        "technicalRating" INTEGER,
        "leadershipRating" INTEGER,
        "teamworkRating" INTEGER,
        "comments" TEXT,
        "reviewerComments" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "PerformanceReview_pkey" PRIMARY KEY ("id")
      )`,

      // Goal
      `CREATE TABLE IF NOT EXISTS "Goal" (
        "id" TEXT NOT NULL,
        "employeeId" TEXT NOT NULL,
        "title" TEXT NOT NULL,
        "description" TEXT,
        "category" TEXT,
        "priority" TEXT,
        "startDate" TIMESTAMP(3),
        "targetDate" TIMESTAMP(3),
        "status" TEXT NOT NULL DEFAULT 'not_started',
        "progress" INTEGER DEFAULT 0,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "Goal_pkey" PRIMARY KEY ("id")
      )`,

      // Training
      `CREATE TABLE IF NOT EXISTS "Training" (
        "id" TEXT NOT NULL,
        "title" TEXT NOT NULL,
        "category" TEXT,
        "duration" INTEGER,
        "mode" TEXT,
        "provider" TEXT,
        "level" TEXT,
        "description" TEXT,
        "startDate" TIMESTAMP(3),
        "endDate" TIMESTAMP(3),
        "maxParticipants" INTEGER,
        "status" TEXT NOT NULL DEFAULT 'active',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "Training_pkey" PRIMARY KEY ("id")
      )`,

      // TrainingEnrollment
      `CREATE TABLE IF NOT EXISTS "TrainingEnrollment" (
        "id" TEXT NOT NULL,
        "trainingId" TEXT NOT NULL,
        "employeeId" TEXT NOT NULL,
        "status" TEXT NOT NULL DEFAULT 'enrolled',
        "enrolledDate" TIMESTAMP(3),
        "completedDate" TIMESTAMP(3),
        "rating" INTEGER,
        "feedback" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "TrainingEnrollment_pkey" PRIMARY KEY ("id")
      )`,

      // Project
      `CREATE TABLE IF NOT EXISTS "Project" (
        "id" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "code" TEXT,
        "type" TEXT,
        "priority" TEXT,
        "budget" DOUBLE PRECISION,
        "startDate" TIMESTAMP(3),
        "endDate" TIMESTAMP(3),
        "status" TEXT NOT NULL DEFAULT 'planning',
        "progress" INTEGER DEFAULT 0,
        "companyId" TEXT,
        "clientId" TEXT,
        "description" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
      )`,

      // ProjectMember
      `CREATE TABLE IF NOT EXISTS "ProjectMember" (
        "id" TEXT NOT NULL,
        "projectId" TEXT NOT NULL,
        "employeeId" TEXT NOT NULL,
        "role" TEXT,
        "allocation" INTEGER DEFAULT 100,
        "startDate" TIMESTAMP(3),
        "endDate" TIMESTAMP(3),
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "ProjectMember_pkey" PRIMARY KEY ("id")
      )`,

      // ProjectTask
      `CREATE TABLE IF NOT EXISTS "ProjectTask" (
        "id" TEXT NOT NULL,
        "projectId" TEXT NOT NULL,
        "title" TEXT NOT NULL,
        "description" TEXT,
        "status" TEXT NOT NULL DEFAULT 'todo',
        "priority" TEXT,
        "assigneeId" TEXT,
        "dueDate" TIMESTAMP(3),
        "estimatedHours" INTEGER,
        "actualHours" INTEGER,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "ProjectTask_pkey" PRIMARY KEY ("id")
      )`,

      // ProjectMilestone
      `CREATE TABLE IF NOT EXISTS "ProjectMilestone" (
        "id" TEXT NOT NULL,
        "projectId" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "dueDate" TIMESTAMP(3),
        "status" TEXT NOT NULL DEFAULT 'pending',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "ProjectMilestone_pkey" PRIMARY KEY ("id")
      )`,

      // Client
      `CREATE TABLE IF NOT EXISTS "Client" (
        "id" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "industry" TEXT,
        "email" TEXT,
        "phone" TEXT,
        "city" TEXT,
        "state" TEXT,
        "country" TEXT,
        "companyId" TEXT,
        "status" TEXT NOT NULL DEFAULT 'active',
        "website" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
      )`,

      // Vendor
      `CREATE TABLE IF NOT EXISTS "Vendor" (
        "id" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "category" TEXT,
        "email" TEXT,
        "phone" TEXT,
        "city" TEXT,
        "state" TEXT,
        "country" TEXT,
        "companyId" TEXT,
        "status" TEXT NOT NULL DEFAULT 'active',
        "complianceStatus" TEXT DEFAULT 'pending',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
      )`,

      // SalaryStructure
      `CREATE TABLE IF NOT EXISTS "SalaryStructure" (
        "id" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "companyId" TEXT,
        "effectiveFrom" TIMESTAMP(3),
        "status" TEXT NOT NULL DEFAULT 'active',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "SalaryStructure_pkey" PRIMARY KEY ("id")
      )`,

      // SalaryComponent
      `CREATE TABLE IF NOT EXISTS "SalaryComponent" (
        "id" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "type" TEXT NOT NULL,
        "amount" DOUBLE PRECISION,
        "isFixed" BOOLEAN NOT NULL DEFAULT true,
        "isTaxable" BOOLEAN NOT NULL DEFAULT true,
        "salaryStructureId" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "SalaryComponent_pkey" PRIMARY KEY ("id")
      )`,

      // PayrollComponent
      `CREATE TABLE IF NOT EXISTS "PayrollComponent" (
        "id" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "type" TEXT NOT NULL,
        "calculationType" TEXT,
        "percentageOf" TEXT,
        "percentage" DOUBLE PRECISION,
        "statutory" BOOLEAN NOT NULL DEFAULT false,
        "status" TEXT NOT NULL DEFAULT 'active',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "PayrollComponent_pkey" PRIMARY KEY ("id")
      )`,

      // ExpenseClaim
      `CREATE TABLE IF NOT EXISTS "ExpenseClaim" (
        "id" TEXT NOT NULL,
        "employeeId" TEXT NOT NULL,
        "category" TEXT,
        "description" TEXT,
        "amount" DOUBLE PRECISION NOT NULL,
        "status" TEXT NOT NULL DEFAULT 'pending',
        "submittedDate" TIMESTAMP(3),
        "approvedBy" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "ExpenseClaim_pkey" PRIMARY KEY ("id")
      )`,

      // TravelRequest
      `CREATE TABLE IF NOT EXISTS "TravelRequest" (
        "id" TEXT NOT NULL,
        "employeeId" TEXT NOT NULL,
        "destination" TEXT NOT NULL,
        "purpose" TEXT,
        "type" TEXT,
        "estimatedCost" DOUBLE PRECISION,
        "startDate" TIMESTAMP(3),
        "endDate" TIMESTAMP(3),
        "status" TEXT NOT NULL DEFAULT 'pending',
        "approvedBy" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "TravelRequest_pkey" PRIMARY KEY ("id")
      )`,

      // Recognition
      `CREATE TABLE IF NOT EXISTS "Recognition" (
        "id" TEXT NOT NULL,
        "employeeId" TEXT NOT NULL,
        "title" TEXT NOT NULL,
        "type" TEXT,
        "message" TEXT,
        "givenBy" TEXT,
        "date" TIMESTAMP(3),
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "Recognition_pkey" PRIMARY KEY ("id")
      )`,

      // Notification
      `CREATE TABLE IF NOT EXISTS "Notification" (
        "id" TEXT NOT NULL,
        "tenantId" TEXT,
        "userId" TEXT,
        "title" TEXT NOT NULL,
        "message" TEXT,
        "type" TEXT,
        "category" TEXT,
        "isRead" BOOLEAN NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
      )`,

      // Announcement
      `CREATE TABLE IF NOT EXISTS "Announcement" (
        "id" TEXT NOT NULL,
        "tenantId" TEXT,
        "title" TEXT NOT NULL,
        "message" TEXT,
        "priority" TEXT,
        "type" TEXT,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "startDate" TIMESTAMP(3),
        "endDate" TIMESTAMP(3),
        "createdBy" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
      )`,

      // AuditLog
      `CREATE TABLE IF NOT EXISTS "AuditLog" (
        "id" TEXT NOT NULL,
        "userId" TEXT,
        "action" TEXT NOT NULL,
        "module" TEXT,
        "details" TEXT,
        "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
      )`,

      // Invoice
      `CREATE TABLE IF NOT EXISTS "Invoice" (
        "id" TEXT NOT NULL,
        "invoiceNumber" TEXT NOT NULL,
        "companyId" TEXT,
        "clientId" TEXT,
        "projectId" TEXT,
        "amount" DOUBLE PRECISION DEFAULT 0,
        "tax" DOUBLE PRECISION DEFAULT 0,
        "totalAmount" DOUBLE PRECISION DEFAULT 0,
        "status" TEXT NOT NULL DEFAULT 'draft',
        "issueDate" TIMESTAMP(3),
        "dueDate" TIMESTAMP(3),
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "Invoice_invoiceNumber_key" UNIQUE ("invoiceNumber")
      )`,

      // InvoiceLineItem
      `CREATE TABLE IF NOT EXISTS "InvoiceLineItem" (
        "id" TEXT NOT NULL,
        "invoiceId" TEXT NOT NULL,
        "description" TEXT,
        "quantity" INTEGER DEFAULT 0,
        "rate" DOUBLE PRECISION DEFAULT 0,
        "amount" DOUBLE PRECISION DEFAULT 0,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "InvoiceLineItem_pkey" PRIMARY KEY ("id")
      )`,

      // SubscriptionPlan
      `CREATE TABLE IF NOT EXISTS "SubscriptionPlan" (
        "id" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "planType" TEXT,
        "monthlyPrice" DOUBLE PRECISION DEFAULT 0,
        "annualPrice" DOUBLE PRECISION DEFAULT 0,
        "employeeLimit" INTEGER DEFAULT 0,
        "companyLimit" INTEGER DEFAULT 0,
        "payrollEnabled" BOOLEAN NOT NULL DEFAULT true,
        "recruitmentEnabled" BOOLEAN NOT NULL DEFAULT true,
        "attendanceEnabled" BOOLEAN NOT NULL DEFAULT true,
        "projectEnabled" BOOLEAN NOT NULL DEFAULT true,
        "status" TEXT NOT NULL DEFAULT 'active',
        "description" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "SubscriptionPlan_pkey" PRIMARY KEY ("id")
      )`,

      // Subscription
      `CREATE TABLE IF NOT EXISTS "Subscription" (
        "id" TEXT NOT NULL,
        "tenantId" TEXT NOT NULL,
        "planId" TEXT NOT NULL,
        "startDate" TIMESTAMP(3),
        "endDate" TIMESTAMP(3),
        "billingCycle" TEXT,
        "amount" DOUBLE PRECISION DEFAULT 0,
        "currency" TEXT DEFAULT 'INR',
        "paymentStatus" TEXT DEFAULT 'pending',
        "status" TEXT NOT NULL DEFAULT 'active',
        "autoRenew" BOOLEAN NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
      )`,

      // Feedback
      `CREATE TABLE IF NOT EXISTS "Feedback" (
        "id" TEXT NOT NULL,
        "employeeId" TEXT NOT NULL,
        "fromEmployeeId" TEXT,
        "type" TEXT,
        "rating" INTEGER,
        "comment" TEXT,
        "isAnonymous" BOOLEAN NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
      )`,

      // Timesheet
      `CREATE TABLE IF NOT EXISTS "Timesheet" (
        "id" TEXT NOT NULL,
        "employeeId" TEXT NOT NULL,
        "weekStartDate" TIMESTAMP(3) NOT NULL,
        "weekEndDate" TIMESTAMP(3) NOT NULL,
        "totalHours" DOUBLE PRECISION DEFAULT 0,
        "status" TEXT NOT NULL DEFAULT 'draft',
        "approvedBy" TEXT,
        "projectId" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "Timesheet_pkey" PRIMARY KEY ("id")
      )`,

      // Requisition
      `CREATE TABLE IF NOT EXISTS "Requisition" (
        "id" TEXT NOT NULL,
        "title" TEXT NOT NULL,
        "departmentId" TEXT,
        "position" TEXT,
        "type" TEXT,
        "priority" TEXT,
        "vacancies" INTEGER DEFAULT 1,
        "minSalary" DOUBLE PRECISION,
        "maxSalary" DOUBLE PRECISION,
        "status" TEXT NOT NULL DEFAULT 'pending',
        "requestedBy" TEXT,
        "justification" TEXT,
        "requestedDate" TIMESTAMP(3),
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "Requisition_pkey" PRIMARY KEY ("id")
      )`,

      // Referral
      `CREATE TABLE IF NOT EXISTS "Referral" (
        "id" TEXT NOT NULL,
        "employeeId" TEXT NOT NULL,
        "referralName" TEXT NOT NULL,
        "referralEmail" TEXT,
        "position" TEXT,
        "status" TEXT NOT NULL DEFAULT 'applied',
        "bonus" DOUBLE PRECISION DEFAULT 0,
        "date" TIMESTAMP(3),
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "Referral_pkey" PRIMARY KEY ("id")
      )`,

      // JobPosting
      `CREATE TABLE IF NOT EXISTS "JobPosting" (
        "id" TEXT NOT NULL,
        "title" TEXT NOT NULL,
        "position" TEXT,
        "location" TEXT,
        "type" TEXT,
        "experience" TEXT,
        "salary" TEXT,
        "departmentId" TEXT,
        "description" TEXT,
        "requirements" TEXT,
        "status" TEXT NOT NULL DEFAULT 'draft',
        "postedDate" TIMESTAMP(3),
        "closingDate" TIMESTAMP(3),
        "vacancies" INTEGER DEFAULT 1,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "JobPosting_pkey" PRIMARY KEY ("id")
      )`,

      // JobApplication
      `CREATE TABLE IF NOT EXISTS "JobApplication" (
        "id" TEXT NOT NULL,
        "jobPostingId" TEXT NOT NULL,
        "candidateName" TEXT NOT NULL,
        "candidateEmail" TEXT,
        "candidatePhone" TEXT,
        "source" TEXT,
        "status" TEXT NOT NULL DEFAULT 'applied',
        "appliedDate" TIMESTAMP(3),
        "rating" INTEGER,
        "expectedSalary" TEXT,
        "notes" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "JobApplication_pkey" PRIMARY KEY ("id")
      )`,

      // Interview
      `CREATE TABLE IF NOT EXISTS "Interview" (
        "id" TEXT NOT NULL,
        "jobApplicationId" TEXT NOT NULL,
        "type" TEXT,
        "date" TIMESTAMP(3),
        "time" TEXT,
        "duration" INTEGER,
        "location" TEXT,
        "meetingUrl" TEXT,
        "interviewer" TEXT,
        "status" TEXT NOT NULL DEFAULT 'scheduled',
        "feedback" TEXT,
        "score" INTEGER,
        "aiScore" INTEGER,
        "aiFeedback" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "Interview_pkey" PRIMARY KEY ("id")
      )`,

    ];

    // Create indexes separately
    const indexStatements = [
      `CREATE INDEX IF NOT EXISTS "PayrollRun_runStatus_idx" ON "PayrollRun"("runStatus")`,
      `CREATE INDEX IF NOT EXISTS "PayrollRun_companyId_idx" ON "PayrollRun"("companyId")`,
      `CREATE INDEX IF NOT EXISTS "PayrollRun_payrollPeriod_idx" ON "PayrollRun"("payrollPeriod")`,
      `CREATE INDEX IF NOT EXISTS "PayrollHold_employeeId_idx" ON "PayrollHold"("employeeId")`,
      `CREATE INDEX IF NOT EXISTS "PayrollHold_status_idx" ON "PayrollHold"("status")`,
      `CREATE INDEX IF NOT EXISTS "BankPaymentFile_payrollRunId_idx" ON "BankPaymentFile"("payrollRunId")`,
      `CREATE INDEX IF NOT EXISTS "BankPaymentFile_companyId_idx" ON "BankPaymentFile"("companyId")`,
      `CREATE INDEX IF NOT EXISTS "PayrollDefinition_companyId_idx" ON "PayrollDefinition"("companyId")`,
      `CREATE INDEX IF NOT EXISTS "EmployeePaymentMethod_employeeId_idx" ON "EmployeePaymentMethod"("employeeId")`,
      `CREATE INDEX IF NOT EXISTS "Loan_employeeId_idx" ON "Loan"("employeeId")`,
      `CREATE INDEX IF NOT EXISTS "Loan_status_idx" ON "Loan"("status")`,
      `CREATE INDEX IF NOT EXISTS "OvertimeRecord_employeeId_idx" ON "OvertimeRecord"("employeeId")`,
      `CREATE INDEX IF NOT EXISTS "OvertimeRecord_date_idx" ON "OvertimeRecord"("date")`,
      `CREATE INDEX IF NOT EXISTS "FNFCalculation_employeeId_idx" ON "FNFCalculation"("employeeId")`,
      `CREATE INDEX IF NOT EXISTS "PayrollValidation_payrollRunId_idx" ON "PayrollValidation"("payrollRunId")`,
      `CREATE INDEX IF NOT EXISTS "PayrollValidation_companyId_idx" ON "PayrollValidation"("companyId")`,
      `CREATE INDEX IF NOT EXISTS "ComplianceFiling_payrollRunId_idx" ON "ComplianceFiling"("payrollRunId")`,
      `CREATE INDEX IF NOT EXISTS "ComplianceFiling_obligationId_idx" ON "ComplianceFiling"("obligationId")`,

      // Employee-related table indexes
      `CREATE INDEX IF NOT EXISTS "EmployeeSkill_employeeId_idx" ON "EmployeeSkill"("employeeId")`,
      `CREATE INDEX IF NOT EXISTS "Dependent_employeeId_idx" ON "Dependent"("employeeId")`,
      `CREATE INDEX IF NOT EXISTS "Qualification_employeeId_idx" ON "Qualification"("employeeId")`,
      `CREATE INDEX IF NOT EXISTS "Experience_employeeId_idx" ON "Experience"("employeeId")`,
      `CREATE INDEX IF NOT EXISTS "Document_employeeId_idx" ON "Document"("employeeId")`,
      `CREATE INDEX IF NOT EXISTS "LeaveBalance_employeeId_idx" ON "LeaveBalance"("employeeId")`,
      `CREATE INDEX IF NOT EXISTS "LeaveBalance_leaveTypeId_idx" ON "LeaveBalance"("leaveTypeId")`,
      `CREATE INDEX IF NOT EXISTS "AssetAssignment_employeeId_idx" ON "AssetAssignment"("employeeId")`,
      `CREATE INDEX IF NOT EXISTS "AssetAssignment_assetId_idx" ON "AssetAssignment"("assetId")`,
      `CREATE INDEX IF NOT EXISTS "EmployeeCompanyMapping_employeeId_idx" ON "EmployeeCompanyMapping"("employeeId")`,
      `CREATE INDEX IF NOT EXISTS "EmployeeCompanyMapping_companyId_idx" ON "EmployeeCompanyMapping"("companyId")`,
    ];

    // Add missing columns to existing tables (Prisma db push might have missed these)
    const alterTableStatements = [
      // PayrollTransactionLine - add employee relation if missing
      `ALTER TABLE "PayrollTransactionLine" ADD COLUMN IF NOT EXISTS "ytdAmount" DOUBLE PRECISION`,
      `ALTER TABLE "PayrollTransactionLine" ADD COLUMN IF NOT EXISTS "mtdAmount" DOUBLE PRECISION`,
      // PayrollInput - add missing columns
      `ALTER TABLE "PayrollInput" ADD COLUMN IF NOT EXISTS "source" TEXT`,
      `ALTER TABLE "PayrollInput" ADD COLUMN IF NOT EXISTS "remarks" TEXT`,
      // Add unique constraint for PayrollComponent if missing
      `ALTER TABLE "PayrollComponent" DROP CONSTRAINT IF EXISTS "PayrollComponent_code_countryCode_key"`,
      `ALTER TABLE "PayrollComponent" ADD CONSTRAINT "PayrollComponent_code_countryCode_key" UNIQUE ("code", "countryCode")`,

      // ─── Multi-tenancy quota / employee strength barriers ───
      // Tenant: max companies the tenant_admin can create (0 = unlimited)
      `ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "maxCompaniesAllowed" INTEGER NOT NULL DEFAULT 0`,
      // CompanyGroup: employee strength limits + per-group company cap + notes
      `ALTER TABLE "CompanyGroup" ADD COLUMN IF NOT EXISTS "employeeLimitMode" TEXT NOT NULL DEFAULT 'group_total'`,
      `ALTER TABLE "CompanyGroup" ADD COLUMN IF NOT EXISTS "maxEmployees" INTEGER`,
      `ALTER TABLE "CompanyGroup" ADD COLUMN IF NOT EXISTS "maxCompanies" INTEGER`,
      `ALTER TABLE "CompanyGroup" ADD COLUMN IF NOT EXISTS "notes" TEXT`,
      // Company: per-company employee strength barrier + planned strength (informational)
      `ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "maxEmployees" INTEGER`,
      `ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "plannedEmployeeCount" INTEGER`,

      // ─── Employee table — ensure ALL columns from Prisma schema exist ───
      // This is the CRITICAL fix for P2022 "column does not exist" errors.
      // We add every column the Prisma client expects, with IF NOT EXISTS so
      // re-runs are safe. Nullable columns use plain ADD COLUMN; NOT NULL
      // columns use DEFAULT so existing rows get populated.
      `ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "avatar" TEXT`,
      `ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "maritalStatus" TEXT`,
      `ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "nationality" TEXT`,
      `ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "address" TEXT`,
      `ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "city" TEXT`,
      `ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "state" TEXT`,
      `ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "zipCode" TEXT`,
      `ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "country" TEXT`,
      `ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'active'`,
      `ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()`,
      `ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()`,
      // reportingManagerId (solid-line manager self-relation)
      `ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "reportingManagerId" TEXT`,
      // Index for faster reportee lookups
      `CREATE INDEX IF NOT EXISTS "Employee_reportingManagerId_idx" ON "Employee"("reportingManagerId")`,
      // Self-FK constraint (a manager must be an Employee). Use ON DELETE SET NULL
      // so deleting a manager doesn't cascade-delete their reports.
      `ALTER TABLE "Employee" DROP CONSTRAINT IF EXISTS "Employee_reportingManagerId_fkey"`,
      `ALTER TABLE "Employee" ADD CONSTRAINT "Employee_reportingManagerId_fkey" FOREIGN KEY ("reportingManagerId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE`,
    ];

    let altersExecuted = 0;
    for (const sql of alterTableStatements) {
      try {
        await db.$executeRawUnsafe(sql);
        altersExecuted++;
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        // Column might already exist or constraint might already exist, that's fine
        if (!errMsg.includes('already exists') && !errMsg.includes('already has')) {
          // Log unusual errors
          const desc = sql.substring(0, 80);
          console.log(`[DB Push] ALTER skipped: ${desc} - ${errMsg.substring(0, 100)}`);
        }
      }
    }
    results.push(`✅ Applied ${altersExecuted} ALTER TABLE statements`);

    // Add foreign key constraints separately
    const fkStatements = [
      `ALTER TABLE "PayrollHold" DROP CONSTRAINT IF EXISTS "PayrollHold_employeeId_fkey"`,
      `ALTER TABLE "PayrollHold" ADD CONSTRAINT "PayrollHold_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
      `ALTER TABLE "BankPaymentFile" DROP CONSTRAINT IF EXISTS "BankPaymentFile_payrollRunId_fkey"`,
      `ALTER TABLE "BankPaymentFile" ADD CONSTRAINT "BankPaymentFile_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "PayrollRun"("id") ON DELETE SET NULL ON UPDATE CASCADE`,
      `ALTER TABLE "PayrollDefinition" DROP CONSTRAINT IF EXISTS "PayrollDefinition_companyId_fkey"`,
      `ALTER TABLE "PayrollDefinition" ADD CONSTRAINT "PayrollDefinition_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
      `ALTER TABLE "EmployeePaymentMethod" DROP CONSTRAINT IF EXISTS "EmployeePaymentMethod_employeeId_fkey"`,
      `ALTER TABLE "EmployeePaymentMethod" ADD CONSTRAINT "EmployeePaymentMethod_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
      `ALTER TABLE "Loan" DROP CONSTRAINT IF EXISTS "Loan_employeeId_fkey"`,
      `ALTER TABLE "Loan" ADD CONSTRAINT "Loan_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
      `ALTER TABLE "OvertimeRecord" DROP CONSTRAINT IF EXISTS "OvertimeRecord_employeeId_fkey"`,
      `ALTER TABLE "OvertimeRecord" ADD CONSTRAINT "OvertimeRecord_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE`,

      // Employee-related FK constraints
      `ALTER TABLE "EmployeeSkill" DROP CONSTRAINT IF EXISTS "EmployeeSkill_employeeId_fkey"`,
      `ALTER TABLE "EmployeeSkill" ADD CONSTRAINT "EmployeeSkill_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
      `ALTER TABLE "Dependent" DROP CONSTRAINT IF EXISTS "Dependent_employeeId_fkey"`,
      `ALTER TABLE "Dependent" ADD CONSTRAINT "Dependent_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
      `ALTER TABLE "Qualification" DROP CONSTRAINT IF EXISTS "Qualification_employeeId_fkey"`,
      `ALTER TABLE "Qualification" ADD CONSTRAINT "Qualification_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
      `ALTER TABLE "Experience" DROP CONSTRAINT IF EXISTS "Experience_employeeId_fkey"`,
      `ALTER TABLE "Experience" ADD CONSTRAINT "Experience_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
      `ALTER TABLE "Document" DROP CONSTRAINT IF EXISTS "Document_employeeId_fkey"`,
      `ALTER TABLE "Document" ADD CONSTRAINT "Document_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
      `ALTER TABLE "LeaveBalance" DROP CONSTRAINT IF EXISTS "LeaveBalance_employeeId_fkey"`,
      `ALTER TABLE "LeaveBalance" ADD CONSTRAINT "LeaveBalance_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
      `ALTER TABLE "AssetAssignment" DROP CONSTRAINT IF EXISTS "AssetAssignment_employeeId_fkey"`,
      `ALTER TABLE "AssetAssignment" ADD CONSTRAINT "AssetAssignment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
      `ALTER TABLE "AssetAssignment" DROP CONSTRAINT IF EXISTS "AssetAssignment_assetId_fkey"`,
      `ALTER TABLE "AssetAssignment" ADD CONSTRAINT "AssetAssignment_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
      `ALTER TABLE "EmployeeCompanyMapping" DROP CONSTRAINT IF EXISTS "EmployeeCompanyMapping_employeeId_fkey"`,
      `ALTER TABLE "EmployeeCompanyMapping" ADD CONSTRAINT "EmployeeCompanyMapping_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
      `ALTER TABLE "EmployeeCompanyMapping" DROP CONSTRAINT IF EXISTS "EmployeeCompanyMapping_companyId_fkey"`,
      `ALTER TABLE "EmployeeCompanyMapping" ADD CONSTRAINT "EmployeeCompanyMapping_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    ];

    // Execute CREATE TABLE statements
    let tablesCreated = 0;
    for (const sql of createTableStatements) {
      try {
        const tableName = sql.match(/CREATE TABLE IF NOT EXISTS "(\w+)"/)?.[1] || 'unknown';
        await db.$executeRawUnsafe(sql);
        results.push(`✅ Created table: ${tableName}`);
        tablesCreated++;
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        const tableName = sql.match(/CREATE TABLE IF NOT EXISTS "(\w+)"/)?.[1] || 'unknown';
        if (errMsg.includes('already exists')) {
          results.push(`⏭️ Table already exists: ${tableName}`);
        } else {
          results.push(`❌ Failed to create table: ${tableName} - ${errMsg.substring(0, 200)}`);
        }
      }
    }

    // Execute index statements
    let indexesCreated = 0;
    for (const sql of indexStatements) {
      try {
        await db.$executeRawUnsafe(sql);
        indexesCreated++;
      } catch {
        // Index might already exist, that's fine
      }
    }
    results.push(`✅ Created ${indexesCreated} indexes`);

    // Execute FK statements
    let fksCreated = 0;
    for (const sql of fkStatements) {
      try {
        await db.$executeRawUnsafe(sql);
        fksCreated++;
      } catch (err: unknown) {
        // FK might fail if referenced table doesn't exist, that's OK
        const errMsg = err instanceof Error ? err.message : String(err);
        if (!errMsg.includes('already exists')) {
          // Log but don't fail
        }
      }
    }
    results.push(`✅ Created ${fksCreated} foreign keys`);

    return NextResponse.json({
      success: true,
      tablesCreated,
      totalStatements: createTableStatements.length,
      results,
    }, { headers: corsHeaders });

  } catch (error: unknown) {
    const err = error as Error;
    console.error('[DB Push] Error:', err);
    return NextResponse.json({
      success: false,
      error: err.message || 'Unknown error',
    }, { status: 500, headers: corsHeaders });
  }
}

export async function GET() {
  return POST();
}
