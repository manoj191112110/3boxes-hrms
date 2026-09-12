/**
 * Quick script to update logos via direct SQL using @neondatabase/serverless
 */
const { neon } = require('@neondatabase/serverless');

const connectionString = 'postgresql://neondb_owner:npg_pxZd8woKe4WB@ep-blue-fire-aqk8jxd2-pooler.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require';
const sql = neon(connectionString);

async function main() {
  console.log('🔄 Updating logos...\n');

  // Check current state
  const tenants = await sql`SELECT id, name, slug, logo FROM "Tenant"`;
  console.log('Current tenants:', JSON.stringify(tenants, null, 2));
  
  const companies = await sql`SELECT id, name, code, logo FROM "Company"`;
  console.log('Current companies:', JSON.stringify(companies, null, 2));

  // Update Tenant logo
  await sql`UPDATE "Tenant" SET logo = '/logos/marq-ai-group.png'`;
  console.log('✓ Updated all Tenant logos → /logos/marq-ai-group.png');

  // Update Company logos
  for (const company of companies) {
    const nameLower = company.name.toLowerCase();
    let logoPath = '/logos/marq-ai-group.png';

    if (nameLower.includes('marq ai tech') || nameLower.includes('marqaitech')) {
      logoPath = '/logos/marq-ai-tech.png';
    } else if (nameLower.includes('marq ai solutions') || nameLower.includes('marqaisolutions')) {
      logoPath = '/logos/marq-ai-tech.png';
    } else if (nameLower.includes('marq ai digital') || nameLower.includes('marqaidigital')) {
      logoPath = '/logos/marq-ai-tech.png';
    } else if (nameLower.includes('marq ai innovations') || nameLower.includes('marqaiinnovations')) {
      logoPath = '/logos/marq-ai-tech.png';
    } else if (nameLower.includes('luxury') || nameLower.includes('3 boxes luxury') || (company.code && company.code.toUpperCase() === '3BLC')) {
      logoPath = '/logos/3boxes-luxury.png';
    } else if (nameLower.includes('consulting') || nameLower.includes('3 boxes consulting') || (company.code && company.code.toUpperCase() === '3BCS') || nameLower.includes('marq ai consulting')) {
      logoPath = '/logos/3boxes-consulting.png';
    } else if (nameLower.includes('technologies') || nameLower.includes('3 boxes technologies') || (company.code && company.code.toUpperCase() === '3BT')) {
      logoPath = '/logos/3boxes-technologies.png';
    } else if (company.code && company.code.toUpperCase() === 'MATPL') {
      logoPath = '/logos/marq-ai-tech.png';
    }

    await sql`UPDATE "Company" SET logo = ${logoPath} WHERE id = ${company.id}`;
    console.log(`✓ Updated: ${company.name} (${company.code}) → ${logoPath}`);
  }

  // Verify
  console.log('\n=== Verification ===');
  const verifyTenants = await sql`SELECT name, logo FROM "Tenant"`;
  const verifyCompanies = await sql`SELECT name, code, logo FROM "Company"`;
  console.log('Tenants:', JSON.stringify(verifyTenants, null, 2));
  console.log('Companies:', JSON.stringify(verifyCompanies, null, 2));
  
  console.log('\n✅ Logo update complete!');
}

main().catch(e => {
  console.error('❌ Failed:', e);
  process.exit(1);
});
