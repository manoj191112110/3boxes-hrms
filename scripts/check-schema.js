/**
 * Diagnostic: check the actual Tenant table schema in production.
 * Run with: node scripts/check-schema.js
 */
const { neon } = require('@neondatabase/serverless');

async function main() {
  const connectionString =
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL;

  if (!connectionString) {
    console.error('No DATABASE_URL');
    process.exit(1);
  }

  const masked = connectionString.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@');
  console.log('Connecting to:', masked.substring(0, 80));

  const sql = neon(connectionString);

  console.log('\n=== Tenant columns ===');
  const tenantCols = await sql`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = 'Tenant'
    ORDER BY ordinal_position
  `;
  for (const c of tenantCols) {
    console.log(`  ${c.column_name} | ${c.data_type} | nullable=${c.is_nullable} | default=${c.column_default || 'none'}`);
  }

  console.log('\n=== Company columns ===');
  const companyCols = await sql`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'Company'
    ORDER BY ordinal_position
  `;
  for (const c of companyCols) {
    console.log(`  ${c.column_name} | ${c.data_type}`);
  }

  console.log('\n=== FeatureFlag table exists? ===');
  const ffTables = await sql`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_name = 'FeatureFlag'
  `;
  console.log(ffTables.length > 0 ? '  YES — FeatureFlag table exists' : '  NO — FeatureFlag table MISSING');

  console.log('\n=== Tenant count ===');
  const count = await sql`SELECT COUNT(*) as n FROM "Tenant"`;
  console.log('  Tenants:', count[0].n);
}

main().catch((e) => {
  console.error('ERROR:', e.message);
  process.exit(1);
});
