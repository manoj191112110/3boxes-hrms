import { PrismaClient } from '../src/generated/prisma/client.ts';
import { PrismaNeon } from '@prisma/adapter-neon';

const connectionString = process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL || process.env.DATABASE_URL || '';
const adapter = new PrismaNeon({ connectionString });
const p = new PrismaClient({ adapter });

async function run() {
  try {
    console.log('=== Fixing production data for schema push (all raw SQL) ===\n');

    // 1. Fix Companies with NULL companyGroupId
    const companies = await p.$queryRaw`SELECT id, name FROM "Company" WHERE "companyGroupId" IS NULL`;
    console.log(`Found ${(companies as any[]).length} companies with NULL companyGroupId`);
    if ((companies as any[]).length > 0) {
      // Get first existing group
      const groups = await p.$queryRaw`SELECT id FROM "CompanyGroup" LIMIT 1`;
      let groupId = (groups as any[])[0]?.id;
      if (!groupId) {
        const tenants = await p.$queryRaw`SELECT id FROM "Tenant" LIMIT 1`;
        const tid = (tenants as any[])[0]?.id;
        const newGroup = await p.$queryRaw`INSERT INTO "CompanyGroup" (id, name, "tenantId", "createdAt", "updatedAt") VALUES (gen_random_uuid(), 'Default Group', ${tid}, now(), now()) RETURNING id`;
        groupId = (newGroup as any[])[0]?.id;
      }
      await p.$executeRaw`UPDATE "Company" SET "companyGroupId" = ${groupId} WHERE "companyGroupId" IS NULL`;
      console.log('  All fixed with group: ' + groupId);
    }

    // 2. Fix Employees with NULL designationId  
    const empDesig = await p.$queryRaw`SELECT id, "firstName" FROM "Employee" WHERE "designationId" IS NULL`;
    console.log(`\nFound ${(empDesig as any[]).length} employees with NULL designationId`);
    if ((empDesig as any[]).length > 0) {
      // Create a default designation if needed
      let desigResult = await p.$queryRaw`SELECT id FROM "Designation" LIMIT 1`;
      let desigId = (desigResult as any[])[0]?.id;
      if (!desigId) {
        const newDesig = await p.$queryRaw`INSERT INTO "Designation" (id, title, "createdAt", "updatedAt") VALUES (gen_random_uuid(), 'Employee', now(), now()) RETURNING id`;
        desigId = (newDesig as any[])[0]?.id;
      }
      await p.$executeRaw`UPDATE "Employee" SET "designationId" = ${desigId} WHERE "designationId" IS NULL`;
      console.log('  All fixed with designation: ' + desigId);
    }

    // 3. Fix Employees with NULL dateOfJoining
    const empJoin = await p.$queryRaw`SELECT count(*) as c FROM "Employee" WHERE "dateOfJoining" IS NULL`;
    console.log(`\nFound ${(empJoin as any[])[0]?.c} employees with NULL dateOfJoining`);
    await p.$executeRaw`UPDATE "Employee" SET "dateOfJoining" = '2025-01-01'::timestamp WHERE "dateOfJoining" IS NULL`;
    console.log('  All fixed');

    // 4. Fix Users with NULL tenantId
    const users = await p.$queryRaw`SELECT id, name, email FROM "User" WHERE "tenantId" IS NULL`;
    console.log(`\nFound ${(users as any[]).length} users with NULL tenantId`);
    if ((users as any[]).length > 0) {
      // Use the 3 Boxes Corp tenant or first available
      let tenantResult = await p.$queryRaw`SELECT id, name FROM "Tenant" WHERE slug = '3boxes-corp' LIMIT 1`;
      let tenant = (tenantResult as any[])[0];
      if (!tenant) {
        tenantResult = await p.$queryRaw`SELECT id, name FROM "Tenant" LIMIT 1`;
        tenant = (tenantResult as any[])[0];
      }
      if (tenant) {
        await p.$executeRaw`UPDATE "User" SET "tenantId" = ${tenant.id} WHERE "tenantId" IS NULL`;
        console.log(`  All fixed with tenant: ${tenant.name}`);
      }
    }

    // 5. Fix Surveys with NULL startDate
    const surveyStart = await p.$queryRaw`SELECT count(*) as c FROM "Survey" WHERE "startDate" IS NULL`;
    console.log(`\nFound ${(surveyStart as any[])[0]?.c} surveys with NULL startDate`);
    await p.$executeRaw`UPDATE "Survey" SET "startDate" = '2025-01-01'::timestamp WHERE "startDate" IS NULL`;
    console.log('  All fixed');

    // 6. Fix Surveys with NULL questions
    const surveyQ = await p.$queryRaw`SELECT count(*) as c FROM "Survey" WHERE questions IS NULL`;
    console.log(`Found ${(surveyQ as any[])[0]?.c} surveys with NULL questions`);
    await p.$executeRaw`UPDATE "Survey" SET questions = '[]'::jsonb WHERE questions IS NULL`;
    console.log('  All fixed');

    console.log('\n=== All fixes applied successfully ===');

    // Check TrialRegistration
    try {
      const trialResult = await p.$queryRaw`SELECT count(*) as count FROM "TrialRegistration"`;
      console.log(`\nTrialRegistration table: exists (${(trialResult as any[])[0]?.count} records)`);
    } catch {
      console.log('\nTrialRegistration table: does NOT exist - will be created by prisma db push');
    }

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await p.$disconnect();
  }
}

run();
