/**
 * Lightweight schema sync for brand-new tenant databases.
 * Used by trial approve provisioning (works on Vercel — no child_process).
 */
const fs = require('fs');
const path = require('path');
const { neon } = require('@neondatabase/serverless');

// Resolve from project root — relative requires break when bundled into Next.js chunks.
const projectRoot = process.cwd();
const scriptsDir = path.join(projectRoot, 'scripts');
const initMigrationPath = path.join(projectRoot, 'prisma', 'migrations', '0_init', 'migration.sql');
const generatedTables = require(path.join(scriptsDir, '_generated-tables.js'));
const initTableFixes = require(path.join(scriptsDir, '_init-table-fixes.js'));
const timestampFixSql = require(path.join(scriptsDir, '_timestamp-fix.js'));

// Align legacy 0_init columns with the current Prisma schema (run after all tables exist).
const legacySchemaFixes = [
  `ALTER TABLE "Department" ALTER COLUMN "code" DROP NOT NULL`,
  `ALTER TABLE "Employee" ALTER COLUMN "designation" DROP NOT NULL`,
  `ALTER TABLE "Employee" ALTER COLUMN "designation" SET DEFAULT 'Employee'`,
  `ALTER TABLE "Employee" ALTER COLUMN "joiningDate" DROP NOT NULL`,
  `ALTER TABLE "Employee" ALTER COLUMN "joiningDate" SET DEFAULT CURRENT_TIMESTAMP`,
  `ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "designationId" TEXT`,
  `ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "dateOfJoining" TIMESTAMP(3)`,
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "tenantId" TEXT`,
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'active'`,
  `ALTER TABLE "Branch" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'active'`,
  `ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "companyGroupId" TEXT`,
  `ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'active'`,
];

async function applyLegacySchemaFixes(sql) {
  for (const stmt of legacySchemaFixes) {
    try {
      await sql.query(stmt, []);
    } catch (err) {
      const msg = err?.message || String(err);
      if (!/already exists|duplicate|does not exist/i.test(msg)) {
        console.warn(`[schema-sync-runner] legacy fix: ${msg.slice(0, 200)}`);
      }
    }
  }
}

async function assertEmployeeReady(sql) {
  const result = await sql.query(
    `SELECT
       a.attname AS column_name,
       a.attnotnull AS not_null
     FROM pg_attribute a
     JOIN pg_class c ON a.attrelid = c.oid
     JOIN pg_namespace n ON c.relnamespace = n.oid
     WHERE n.nspname = 'public'
       AND c.relname = 'Employee'
       AND a.attname IN ('designation', 'joiningDate', 'designationId', 'dateOfJoining')
       AND a.attnum > 0
       AND NOT a.attisdropped`,
    []
  );
  const rows = Array.isArray(result) ? result : result?.rows ?? [];
  const byName = Object.fromEntries(rows.map((r) => [r.column_name, r.not_null]));
  if (!('designationId' in byName)) {
    throw new Error('Employee.designationId column missing after schema sync');
  }
  if (byName.designation === true || byName.joiningDate === true) {
    throw new Error(
      `Employee legacy columns still NOT NULL (designation=${byName.designation}, joiningDate=${byName.joiningDate})`
    );
  }
}

function parseSqlStatements(sqlText) {
  const withoutLineComments = sqlText.replace(/--[^\n]*/g, '');
  return withoutLineComments
    .split(';')
    .map((stmt) => stmt.trim())
    .filter((stmt) => stmt.length > 0);
}

function loadInitMigrationStatements() {
  if (!fs.existsSync(initMigrationPath)) {
    throw new Error(`Missing Prisma init migration at ${initMigrationPath}`);
  }
  const sql = fs.readFileSync(initMigrationPath, 'utf8');
  return parseSqlStatements(sql);
}

async function assertCoreTablesExist(sql) {
  const result = await sql.query(
    `SELECT to_regclass('public."Tenant"') AS tenant_table,
            to_regclass('public."User"') AS user_table,
            to_regclass('public."Company"') AS company_table`,
    []
  );
  const row = Array.isArray(result) ? result[0] : result?.rows?.[0] ?? result?.[0] ?? result;
  if (!row?.tenant_table || !row?.user_table || !row?.company_table) {
    throw new Error(
      `Schema sync incomplete — core tables missing (Tenant=${row?.tenant_table ?? 'null'}, User=${row?.user_table ?? 'null'}, Company=${row?.company_table ?? 'null'})`
    );
  }
}

async function runSchemaSyncForConnection(connectionString) {
  if (!connectionString) {
    throw new Error('connectionString is required for schema sync');
  }

  const sql = neon(connectionString);
  const initMigrationStatements = loadInitMigrationStatements();
  const statements = [
    ...initMigrationStatements,
    ...generatedTables,
    ...initTableFixes,
    timestampFixSql,
  ];
  let applied = 0;
  let skipped = 0;
  const errors = [];

  for (const stmt of statements) {
    try {
      await sql.query(stmt, []);
      applied++;
    } catch (err) {
      const msg = err?.message || String(err);
      if (/already exists|duplicate/i.test(msg)) {
        skipped++;
      } else {
        if (/CREATE TABLE/i.test(stmt)) {
          console.error(`[schema-sync-runner] CREATE TABLE failed: ${msg.slice(0, 300)}`);
        }
        errors.push(msg.slice(0, 200));
        skipped++;
      }
    }
  }

  console.log(
    `[schema-sync-runner] Done. init=${initMigrationStatements.length} applied=${applied} skipped=${skipped} errors=${errors.length}`
  );

  if (applied === 0 && errors.length > 0) {
    throw new Error(`Schema sync failed: ${errors[0]}`);
  }

  await applyLegacySchemaFixes(sql);
  await assertCoreTablesExist(sql);
  await assertEmployeeReady(sql);
}

module.exports = { runSchemaSyncForConnection };
