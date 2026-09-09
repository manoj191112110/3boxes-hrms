/**
 * Production Database Update Script
 * - Updates all company logos with official logos from company websites
 * - Creates admin users for each company
 * - Updates tenant logo
 * 
 * Usage: npx tsx scripts/update-production-logos.ts
 */

import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';

const connectionString = process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL || process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('No database connection string found. Set DATABASE_URL');
}

const adapter = new PrismaNeon({ connectionString });
const prisma = new PrismaClient({ adapter });

const HASHED_PASSWORD = '$2b$12$7eWvdTwkl.L3OH8BPcnmz.7mfmM8/zrNUnMaTse4fa.0DvBaVNjbS'; // MarqAI@2026

async function main() {
  console.log('🔄 Updating production database with logos and admin users...\n');

  // 1. Update Tenant logo
  const tenants = await prisma.tenant.findMany({
    select: { id: true, name: true, slug: true, logo: true }
  });
  console.log('Current tenants:', JSON.stringify(tenants, null, 2));

  for (const tenant of tenants) {
    await prisma.tenant.update({
      where: { id: tenant.id },
      data: { logo: '/logos/marq-ai-group.png' },
    });
    console.log(`✓ Updated Tenant logo: ${tenant.name} → /logos/marq-ai-group.png`);
  }

  // 2. Update Company logos
  const companies = await prisma.company.findMany({
    select: { id: true, name: true, code: true, logo: true }
  });
  console.log('\nCurrent companies:', JSON.stringify(companies, null, 2));

  const logoMapping: Record<string, string> = {
    'MATPL': '/logos/marq-ai-tech.png',
    '3BLC': '/logos/3boxes-luxury.png',
    '3BCS': '/logos/3boxes-consulting.png',
    '3BT': '/logos/3boxes-technologies.png',
  };

  const nameLogoMapping = [
    { pattern: 'marq ai tech', logo: '/logos/marq-ai-tech.png' },
    { pattern: '3 boxes luxury', logo: '/logos/3boxes-luxury.png' },
    { pattern: '3 boxes consulting', logo: '/logos/3boxes-consulting.png' },
    { pattern: '3 boxes technologies', logo: '/logos/3boxes-technologies.png' },
  ];

  for (const company of companies) {
    let logoPath = '/logos/marq-ai-group.png'; // default

    // Match by code first (most reliable)
    if (company.code && logoMapping[company.code.toUpperCase()]) {
      logoPath = logoMapping[company.code.toUpperCase()];
    } else {
      // Match by name
      const nameLower = company.name.toLowerCase();
      for (const { pattern, logo } of nameLogoMapping) {
        if (nameLower.includes(pattern)) {
          logoPath = logo;
          break;
        }
      }
    }

    await prisma.company.update({
      where: { id: company.id },
      data: { logo: logoPath },
    });
    console.log(`✓ Updated Company logo: ${company.name} (${company.code}) → ${logoPath}`);
  }

  // 3. Create admin users for each company
  console.log('\n📋 Creating admin users for each company...');
  const adminUsers = [
    { email: 'admin@marqaitech.com', name: 'Admin - MARQ AI TECH', companyCode: 'MATPL', role: 'company_hr_admin' as const },
    { email: 'admin@3boxesluxury.com', name: 'Admin - 3 BOXES LUXURY', companyCode: '3BLC', role: 'company_hr_admin' as const },
    { email: 'admin@3boxesconsulting.com', name: 'Admin - 3 BOXES CONSULTING', companyCode: '3BCS', role: 'company_hr_admin' as const },
    { email: 'admin@3boxestechnologies.com', name: 'Admin - 3 BOXES TECHNOLOGIES', companyCode: '3BT', role: 'company_hr_admin' as const },
  ];

  const updatedCompanies = await prisma.company.findMany({
    select: { id: true, name: true, code: true }
  });

  for (const adminData of adminUsers) {
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: adminData.email }
    });

    if (existingUser) {
      console.log(`  ⊘ Admin already exists: ${adminData.email}`);
      continue;
    }

    // Find the company for this admin
    const company = updatedCompanies.find(c => c.code === adminData.companyCode);
    if (!company) {
      console.log(`  ⚠ Company not found for code: ${adminData.companyCode}, skipping ${adminData.email}`);
      continue;
    }

    // Get the tenant
    const tenant = tenants[0];
    if (!tenant) {
      console.log('  ⚠ No tenant found, skipping admin creation');
      continue;
    }

    // Create the user
    const user = await prisma.user.create({
      data: {
        email: adminData.email,
        name: adminData.name,
        password: HASHED_PASSWORD,
        role: adminData.role,
        status: 'active',
        tenantId: tenant.id,
      },
    });

    // Find or create employee record
    const branch = await prisma.branch.findFirst({
      where: { companyId: company.id }
    });
    const hrDept = await prisma.department.findFirst({
      where: { companyId: company.id, name: { contains: 'Human Resources' } }
    });
    const hrDes = await prisma.designation.findFirst({
      where: { name: 'HR Manager' }
    });

    if (branch && hrDept && hrDes) {
      await prisma.employee.create({
        data: {
          userId: user.id,
          companyId: company.id,
          branchId: branch.id,
          departmentId: hrDept.id,
          designationId: hrDes.id,
          employeeId: `EMP-${company.code}-HR001`,
          firstName: 'Admin',
          lastName: company.code,
          status: 'active',
          joiningDate: new Date(),
        },
      });
    }

    console.log(`  ✓ Created Admin: ${adminData.email} → ${company.name} (${company.code})`);
  }

  // 4. Print final summary
  console.log('\n=== Final State ===');
  const finalTenant = await prisma.tenant.findFirst({ select: { name: true, logo: true } });
  console.log(`Tenant: ${finalTenant?.name} → ${finalTenant?.logo}`);

  const finalCompanies = await prisma.company.findMany({ select: { name: true, code: true, logo: true } });
  for (const c of finalCompanies) {
    console.log(`Company: ${c.name} (${c.code}) → ${c.logo}`);
  }

  const allUsers = await prisma.user.findMany({
    select: { email: true, name: true, role: true },
    orderBy: { role: 'asc' }
  });
  console.log('\nAll Users:');
  for (const u of allUsers) {
    console.log(`  ${u.role}: ${u.email} (${u.name})`);
  }

  await prisma.$disconnect();
  console.log('\n✅ Production update complete!');
}

main().catch(e => {
  console.error('❌ Failed:', e);
  process.exit(1);
});
