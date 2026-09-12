import { PrismaClient } from '../src/generated/prisma/client.ts';
import { PrismaNeon } from '@prisma/adapter-neon';

const connectionString = process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL || process.env.DATABASE_URL || '';
const adapter = new PrismaNeon({ connectionString });
const p = new PrismaClient({ adapter });

async function run() {
  try {
    // Check if TrialRegistration table already exists
    const result = await p.$queryRaw`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'TrialRegistration'
    ` as any[];

    if (result.length > 0) {
      console.log('TrialRegistration table already exists. Skipping creation.');
    } else {
      console.log('Creating TrialRegistration table...');
      await p.$executeRawUnsafe(`
        CREATE TABLE "TrialRegistration" (
          "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
          "companyName" TEXT NOT NULL,
          "companyCode" TEXT NOT NULL UNIQUE,
          "companyEmail" TEXT NOT NULL UNIQUE,
          "companyPhone" TEXT,
          "companyWebsite" TEXT,
          "industry" TEXT,
          "country" TEXT NOT NULL DEFAULT 'IN',
          "currency" TEXT NOT NULL DEFAULT 'INR',
          "employeeCount" INTEGER NOT NULL DEFAULT 10,
          "contactName" TEXT NOT NULL,
          "contactEmail" TEXT NOT NULL UNIQUE,
          "contactPhone" TEXT,
          "designation" TEXT,
          "address" TEXT,
          "city" TEXT,
          "state" TEXT,
          "zipCode" TEXT,
          "status" TEXT NOT NULL DEFAULT 'pending',
          "trialDays" INTEGER NOT NULL DEFAULT 15,
          "trialStart" TIMESTAMP(3),
          "trialEnd" TIMESTAMP(3),
          "tempPassword" TEXT,
          "reviewedBy" TEXT,
          "reviewedAt" TIMESTAMP(3),
          "rejectionReason" TEXT,
          "notes" TEXT,
          "tenantId" TEXT UNIQUE,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX "TrialRegistration_status_idx" ON "TrialRegistration"("status");
        CREATE INDEX "TrialRegistration_companyEmail_idx" ON "TrialRegistration"("companyEmail");
        CREATE INDEX "TrialRegistration_contactEmail_idx" ON "TrialRegistration"("contactEmail");
        CREATE INDEX "TrialRegistration_tenantId_idx" ON "TrialRegistration"("tenantId");

        ALTER TABLE "TrialRegistration"
        ADD CONSTRAINT "TrialRegistration_tenantId_fkey"
        FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
      `);
      console.log('TrialRegistration table created successfully!');
    }

    // Verify
    const count = await p.$queryRaw`SELECT count(*)::int as count FROM "TrialRegistration"` as any[];
    console.log(`TrialRegistration row count: ${count[0]?.count}`);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await p.$disconnect();
  }
}

run();
