/**
 * Script to update logos in the production database
 * Sets logo paths for Tenant and all Companies
 */
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';

const connectionString = process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL || process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('No database connection string found. Set DATABASE_URL');
}

const adapter = new PrismaNeon({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🔄 Updating logos in production database...\n');

  // 1. List current state
  const tenants = await prisma.tenant.findMany({ select: { id: true, name: true, slug: true, logo: true } });
  console.log('Current tenants:', JSON.stringify(tenants, null, 2));
  
  const companies = await prisma.company.findMany({ select: { id: true, name: true, code: true, logo: true } });
  console.log('Current companies:', JSON.stringify(companies, null, 2));

  // 2. Update Tenant logo (MarqAI Tech Group)
  for (const tenant of tenants) {
    await prisma.tenant.update({
      where: { id: tenant.id },
      data: { logo: '/logos/marq-ai-group.png' },
    });
    console.log(`✓ Updated Tenant logo: ${tenant.name} → /logos/marq-ai-group.png`);
  }

  // 3. Update Company logos based on name matching
  const logoMapping: Record<string, string> = {
    'marq ai tech': '/logos/marq-ai-tech.png',
    'marq ai solutions': '/logos/marq-ai-tech.png',
    'marq ai digital': '/logos/marq-ai-tech.png',
    'marq ai innovations': '/logos/marq-ai-tech.png',
    'marq ai consulting': '/logos/3boxes-consulting.png',
    '3 boxes luxury': '/logos/3boxes-luxury.png',
    '3 boxes consulting': '/logos/3boxes-consulting.png',
    '3 boxes technologies': '/logos/3boxes-technologies.png',
  };

  for (const company of companies) {
    const nameLower = company.name.toLowerCase();
    let logoPath = '/logos/marq-ai-group.png'; // default

    for (const [keyword, path] of Object.entries(logoMapping)) {
      if (nameLower.includes(keyword)) {
        logoPath = path;
        break;
      }
    }

    // Also match by company code
    if (company.code) {
      const codeUpper = company.code.toUpperCase();
      if (codeUpper === 'MATPL') logoPath = '/logos/marq-ai-tech.png';
      else if (codeUpper === '3BLC') logoPath = '/logos/3boxes-luxury.png';
      else if (codeUpper === '3BCS') logoPath = '/logos/3boxes-consulting.png';
      else if (codeUpper === '3BT') logoPath = '/logos/3boxes-technologies.png';
    }

    await prisma.company.update({
      where: { id: company.id },
      data: { logo: logoPath },
    });
    console.log(`✓ Updated Company logo: ${company.name} (${company.code}) → ${logoPath}`);
  }

  // 4. Print final summary
  console.log('\n=== Final Logo State ===');
  const updatedTenant = await prisma.tenant.findFirst({ select: { name: true, logo: true } });
  console.log(`Tenant: ${updatedTenant?.name} → ${updatedTenant?.logo}`);
  
  const updatedCompanies = await prisma.company.findMany({ select: { name: true, code: true, logo: true } });
  for (const c of updatedCompanies) {
    console.log(`Company: ${c.name} (${c.code}) → ${c.logo}`);
  }

  await prisma.$disconnect();
  console.log('\n✅ Logo update complete!');
}

main().catch(e => {
  console.error('❌ Failed:', e);
  process.exit(1);
});
