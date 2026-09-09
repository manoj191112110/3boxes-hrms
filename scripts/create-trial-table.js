const { neon } = require('@neondatabase/serverless');

async function run() {
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!connectionString) {
    console.error('No DATABASE_URL set');
    process.exit(1);
  }

  const sql = neon(connectionString);

  try {
    // Check if table exists
    const tables = await sql`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'TrialRegistration'
    `;

    if (tables.length > 0) {
      console.log('TrialRegistration table already exists. Skipping creation.');
      const count = await sql`SELECT count(*)::int as count FROM "TrialRegistration"`;
      console.log(`Row count: ${count[0].count}`);
      return;
    }

    console.log('Creating TrialRegistration table...');

    await sql`
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
      )
    `;

    await sql`CREATE INDEX "TrialRegistration_status_idx" ON "TrialRegistration"("status")`;
    await sql`CREATE INDEX "TrialRegistration_companyEmail_idx" ON "TrialRegistration"("companyEmail")`;
    await sql`CREATE INDEX "TrialRegistration_contactEmail_idx" ON "TrialRegistration"("contactEmail")`;
    await sql`CREATE INDEX "TrialRegistration_tenantId_idx" ON "TrialRegistration"("tenantId")`;

    await sql`
      ALTER TABLE "TrialRegistration"
      ADD CONSTRAINT "TrialRegistration_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE
    `;

    console.log('TrialRegistration table created successfully!');

    // Verify
    const count = await sql`SELECT count(*)::int as count FROM "TrialRegistration"`;
    console.log(`Row count: ${count[0].count}`);

  } catch (err) {
    console.error('Error:', err.message || err);
  }
}

run();
