import * as dotenv from 'dotenv';
dotenv.config();

import { neon } from '@neondatabase/serverless';
import {
  createNeonDatabase,
  buildTenantConnectionString,
  sanitizeTenantDatabaseName,
} from '../src/lib/tenant-provision';
import { runTenantSchemaSync } from '../src/lib/run-tenant-schema-sync';

async function main() {
  const base =
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL;
  if (!base) throw new Error('No DATABASE_URL');

  const slug = `schematest${Date.now().toString().slice(-5)}`;
  const dbName = sanitizeTenantDatabaseName(slug);
  const url = buildTenantConnectionString(base, dbName);

  console.log('Creating database:', dbName);
  await createNeonDatabase(dbName);
  await new Promise((r) => setTimeout(r, 3000));

  console.log('Running schema sync...');
  try {
    await runTenantSchemaSync(url);
  } catch (e) {
    console.error('Schema sync threw:', e);
  }

  const sql = neon(url);
  const tenantCheck = await sql.query(
    `SELECT to_regclass('public."Tenant"') AS tenant_table`,
    []
  );
  console.log('Tenant table:', tenantCheck);

  const count = await sql.query(
    `SELECT count(*)::int AS n FROM pg_tables WHERE schemaname = 'public'`,
    []
  );
  console.log('Public table count:', count);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
