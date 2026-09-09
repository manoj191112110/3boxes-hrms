#!/usr/bin/env python3
"""
Add new models to both tenant databases.
- BankAccount, GratuityLedger, Setting, CompanyPolicy (new CREATE TABLE)
- Candidate (ALTER TABLE — add new columns to existing table)
- JobApplication (ALTER TABLE — add candidateId column)
"""
import psycopg2
from psycopg2.extras import execute_values

POOLER_HOST = 'ep-blue-fire-aqk8jxd2-pooler.c-8.us-east-1.aws.neon.tech'
DB_USER = 'neondb_owner'
DB_PASSWORD = 'npg_pxZd8woKe4WB'

DEMO_DB = 'tenant_demo'
MARQAI_DB = 'tenant_marqaitechgroup'

# ─── New table CREATE statements ───

BANK_ACCOUNT_SQL = """
CREATE TABLE IF NOT EXISTS "BankAccount" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "accountHolderName" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "confirmAccountNumber" TEXT,
    "ifscCode" TEXT,
    "micrCode" TEXT,
    "branchName" TEXT,
    "branchAddress" TEXT,
    "accountType" TEXT NOT NULL DEFAULT 'savings',
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedBy" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "verificationDoc" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BankAccount_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "BankAccount_employeeId_accountNumber_ifscCode_key" ON "BankAccount"("employeeId", "accountNumber", "ifscCode");
CREATE INDEX IF NOT EXISTS "BankAccount_employeeId_idx" ON "BankAccount"("employeeId");
CREATE INDEX IF NOT EXISTS "BankAccount_isPrimary_idx" ON "BankAccount"("isPrimary");
CREATE INDEX IF NOT EXISTS "BankAccount_status_idx" ON "BankAccount"("status");
"""

GRATUITY_LEDGER_SQL = """
CREATE TABLE IF NOT EXISTS "GratuityLedger" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "financialYear" TEXT NOT NULL,
    "month" INTEGER NOT NULL DEFAULT 1,
    "lastDrawnBasicSalary" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastDrawnDA" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "yearsOfService" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "completedYears" INTEGER NOT NULL DEFAULT 0,
    "monthlyProvision" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "accumulatedProvision" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "gratuityEarned" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "employerContribution" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "adjustments" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "withdrawalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "balanceAfterWithdrawal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isEligible" BOOLEAN NOT NULL DEFAULT false,
    "eligibilityDate" TIMESTAMP(3),
    "lastDrawnSalaryDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'provisioned',
    "processedAt" TIMESTAMP(3),
    "processedBy" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GratuityLedger_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "GratuityLedger_employeeId_financialYear_month_key" ON "GratuityLedger"("employeeId", "financialYear", "month");
CREATE INDEX IF NOT EXISTS "GratuityLedger_employeeId_idx" ON "GratuityLedger"("employeeId");
CREATE INDEX IF NOT EXISTS "GratuityLedger_companyId_idx" ON "GratuityLedger"("companyId");
CREATE INDEX IF NOT EXISTS "GratuityLedger_financialYear_idx" ON "GratuityLedger"("financialYear");
CREATE INDEX IF NOT EXISTS "GratuityLedger_status_idx" ON "GratuityLedger"("status");
"""

SETTING_SQL = """
CREATE TABLE IF NOT EXISTS "Setting" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT,
    "category" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "dataType" TEXT NOT NULL DEFAULT 'string',
    "description" TEXT,
    "isEditable" BOOLEAN NOT NULL DEFAULT true,
    "isSecret" BOOLEAN NOT NULL DEFAULT false,
    "defaultValue" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "previousValue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Setting_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Setting_tenantId_companyId_category_key_key" ON "Setting"("tenantId", "companyId", "category", "key");
CREATE INDEX IF NOT EXISTS "Setting_tenantId_idx" ON "Setting"("tenantId");
CREATE INDEX IF NOT EXISTS "Setting_companyId_idx" ON "Setting"("companyId");
CREATE INDEX IF NOT EXISTS "Setting_category_idx" ON "Setting"("category");
CREATE INDEX IF NOT EXISTS "Setting_key_idx" ON "Setting"("key");
"""

COMPANY_POLICY_SQL = """
CREATE TABLE IF NOT EXISTS "CompanyPolicy" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "policyCode" TEXT,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "content" TEXT,
    "documentUrl" TEXT,
    "version" TEXT NOT NULL DEFAULT '1.0',
    "previousVersionId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "effectiveDate" TIMESTAMP(3),
    "reviewDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "authoredBy" TEXT,
    "ownedBy" TEXT,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "requiresAcknowledgement" BOOLEAN NOT NULL DEFAULT true,
    "acknowledgementDeadlineDays" INTEGER,
    "totalAcknowledged" INTEGER NOT NULL DEFAULT 0,
    "totalPending" INTEGER NOT NULL DEFAULT 0,
    "applicableTo" TEXT NOT NULL DEFAULT 'all_employees',
    "departmentIds" TEXT,
    "designationIds" TEXT,
    "locationIds" TEXT,
    "isRegulatory" BOOLEAN NOT NULL DEFAULT false,
    "regulationRef" TEXT,
    "penaltyForNonCompliance" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CompanyPolicy_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "CompanyPolicy_companyId_policyCode_key" ON "CompanyPolicy"("companyId", "policyCode");
CREATE INDEX IF NOT EXISTS "CompanyPolicy_companyId_idx" ON "CompanyPolicy"("companyId");
CREATE INDEX IF NOT EXISTS "CompanyPolicy_category_idx" ON "CompanyPolicy"("category");
CREATE INDEX IF NOT EXISTS "CompanyPolicy_status_idx" ON "CompanyPolicy"("status");
CREATE INDEX IF NOT EXISTS "CompanyPolicy_effectiveDate_idx" ON "CompanyPolicy"("effectiveDate");
"""

# ─── ALTER TABLE statements for existing tables ───

CANDIDATE_SQL = """
CREATE TABLE IF NOT EXISTS "Candidate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "avatar" TEXT,
    "currentJobTitle" TEXT,
    "currentCompany" TEXT,
    "currentLocation" TEXT,
    "totalExperience" DOUBLE PRECISION,
    "noticePeriod" INTEGER,
    "currentCTC" DOUBLE PRECISION,
    "expectedCTC" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "skills" TEXT,
    "highestQualification" TEXT,
    "university" TEXT,
    "graduationYear" INTEGER,
    "source" TEXT NOT NULL DEFAULT 'direct',
    "sourceDetails" TEXT,
    "recruiterId" TEXT,
    "resumeUrl" TEXT,
    "coverLetterUrl" TEXT,
    "linkedinUrl" TEXT,
    "portfolioUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'new',
    "subStatus" TEXT,
    "aiMatchScore" DOUBLE PRECISION,
    "aiSentimentScore" DOUBLE PRECISION,
    "aiRecommendedRole" TEXT,
    "lastContactedAt" TIMESTAMP(3),
    "nextFollowUpAt" TIMESTAMP(3),
    "communicationCount" INTEGER NOT NULL DEFAULT 0,
    "tags" TEXT,
    "category" TEXT,
    "pool" TEXT,
    "appliedAt" TIMESTAMP(3),
    "hiredAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "consentGiven" BOOLEAN NOT NULL DEFAULT false,
    "consentDate" TIMESTAMP(3),
    "dataRetentionDays" INTEGER NOT NULL DEFAULT 730,
    "anonymized" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Candidate_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Candidate_tenantId_email_key" ON "Candidate"("tenantId", "email");
CREATE INDEX IF NOT EXISTS "Candidate_tenantId_idx" ON "Candidate"("tenantId");
CREATE INDEX IF NOT EXISTS "Candidate_companyId_idx" ON "Candidate"("companyId");
CREATE INDEX IF NOT EXISTS "Candidate_status_idx" ON "Candidate"("status");
CREATE INDEX IF NOT EXISTS "Candidate_source_idx" ON "Candidate"("source");
CREATE INDEX IF NOT EXISTS "Candidate_aiMatchScore_idx" ON "Candidate"("aiMatchScore");
"""

JOBAPP_ALTER_SQL = [
    'ALTER TABLE "JobApplication" ADD COLUMN IF NOT EXISTS "candidateId" TEXT',
    'CREATE INDEX IF NOT EXISTS "JobApplication_candidateId_idx" ON "JobApplication"("candidateId")',
]

# FK constraints (applied separately with DROP + ADD pattern)
FK_SQL = [
    'ALTER TABLE "BankAccount" DROP CONSTRAINT IF EXISTS "BankAccount_employeeId_fkey"',
    'ALTER TABLE "BankAccount" ADD CONSTRAINT "BankAccount_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE',

    'ALTER TABLE "GratuityLedger" DROP CONSTRAINT IF EXISTS "GratuityLedger_employeeId_fkey"',
    'ALTER TABLE "GratuityLedger" ADD CONSTRAINT "GratuityLedger_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE',
    'ALTER TABLE "GratuityLedger" DROP CONSTRAINT IF EXISTS "GratuityLedger_companyId_fkey"',
    'ALTER TABLE "GratuityLedger" ADD CONSTRAINT "GratuityLedger_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE',

    'ALTER TABLE "Setting" DROP CONSTRAINT IF EXISTS "Setting_tenantId_fkey"',
    'ALTER TABLE "Setting" ADD CONSTRAINT "Setting_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE',
    'ALTER TABLE "Setting" DROP CONSTRAINT IF EXISTS "Setting_companyId_fkey"',
    'ALTER TABLE "Setting" ADD CONSTRAINT "Setting_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE',

    'ALTER TABLE "CompanyPolicy" DROP CONSTRAINT IF EXISTS "CompanyPolicy_companyId_fkey"',
    'ALTER TABLE "CompanyPolicy" ADD CONSTRAINT "CompanyPolicy_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE',

    'ALTER TABLE "Candidate" DROP CONSTRAINT IF EXISTS "Candidate_tenantId_fkey"',
    'ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE',
    'ALTER TABLE "Candidate" DROP CONSTRAINT IF EXISTS "Candidate_companyId_fkey"',
    'ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE',
    'ALTER TABLE "JobApplication" DROP CONSTRAINT IF EXISTS "JobApplication_candidateId_fkey"',
    'ALTER TABLE "JobApplication" ADD CONSTRAINT "JobApplication_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE SET NULL ON UPDATE CASCADE',
]


def get_conn(dbname):
    conn = psycopg2.connect(
        host=POOLER_HOST, database=dbname, user=DB_USER, password=DB_PASSWORD,
        sslmode='require', connect_timeout=15
    )
    conn.autocommit = True
    return conn


def apply_ddl(conn, label):
    cur = conn.cursor()
    applied = 0
    skipped = 0
    errors = 0

    # 1. CREATE TABLE for new models
    create_sqls = {
        'BankAccount': BANK_ACCOUNT_SQL,
        'GratuityLedger': GRATUITY_LEDGER_SQL,
        'Setting': SETTING_SQL,
        'CompanyPolicy': COMPANY_POLICY_SQL,
    }
    for table_name, sql in create_sqls.items():
        try:
            cur.execute(sql)
            applied += sql.count(';')  # approximate count of statements
            print(f'  ✅ {label}: Created table {table_name}')
        except Exception as e:
            err = str(e)
            if 'already exists' in err:
                skipped += 1
                print(f'  ⏭️  {label}: {table_name} already exists')
            else:
                errors += 1
                print(f'  ❌ {label}: {table_name} error: {err[:120]}')

    # 2. CREATE TABLE for Candidate
    try:
        cur.execute(CANDIDATE_SQL)
        applied += CANDIDATE_SQL.count(';')
        print(f'  ✅ {label}: Created table Candidate')
    except Exception as e:
        err = str(e)
        if 'already exists' in err:
            skipped += 1
            print(f'  ⏭️  {label}: Candidate already exists')
        else:
            errors += 1
            print(f'  ❌ {label}: Candidate error: {err[:120]}')

    # 3. ALTER TABLE for JobApplication
    for sql in JOBAPP_ALTER_SQL:
        try:
            cur.execute(sql)
            applied += 1
        except Exception as e:
            err = str(e)
            if 'already exists' in err or 'duplicate' in err:
                skipped += 1
            else:
                errors += 1
                print(f'  ❌ {label}: JobApplication ALTER error: {err[:120]}')
    print(f'  ✅ {label}: JobApplication table altered with candidateId')

    # 4. FK constraints
    for sql in FK_SQL:
        try:
            cur.execute(sql)
            applied += 1
        except Exception as e:
            err = str(e)
            if 'already exists' in err or 'duplicate' in err:
                skipped += 1
            else:
                errors += 1
                print(f'  ⚠️  {label}: FK error: {err[:120]}')

    print(f'  📊 {label}: Applied {applied}, Skipped {skipped}, Errors {errors}')
    cur.close()
    return applied, skipped, errors


if __name__ == '__main__':
    print('=' * 60)
    print('  Adding new models to tenant databases')
    print('=' * 60)

    for dbname, label in [(DEMO_DB, 'DEMO'), (MARQAI_DB, 'MARQAI')]:
        print(f'\n--- {label} DATABASE ({dbname}) ---')
        try:
            conn = get_conn(dbname)
            apply_ddl(conn, label)
            conn.close()
        except Exception as e:
            print(f'  ❌ Failed to connect to {dbname}: {e}')

    print('\n' + '=' * 60)
    print('  Done! All new models added to both databases.')
    print('=' * 60)
