/**
 * 3Boxes HRMS - MarqAI Tech Group Seed Script
 *
 * Seeds the database with:
 *   - 1 Tenant: "MarqAI Tech Group" (slug: marqaitechgroup)
 *   - 1 Company Group: "MarqAI Tech Group"
 *   - 4 Companies: MARQ AI TECH PVT LTD, 3 BOXES LUXURY CURATIONS, 3 BOXES CONSULTING SERVICES, 3 BOXES TECHNOLOGIES
 *   - Users: 1 super_admin, 1 tenant_admin, 4 company_hr_admins (no sample employees)
 *   - Each company gets: 1 Head Office branch, 3 departments (HR, Finance, Operations), 4 designations (CEO, HR Manager, Finance Manager, Operations Manager)
 *
 * Usage: npx tsx prisma/seed-marqai.ts
 */

import bcryptjs from 'bcryptjs';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';

const connectionString = process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL || process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('No database connection string found. Set POSTGRES_PRISMA_URL, POSTGRES_URL, or DATABASE_URL');
}

const adapter = new PrismaNeon({ connectionString });
const prisma = new PrismaClient({ adapter });

async function hashPassword(password: string): Promise<string> {
  const salt = await bcryptjs.genSalt(12);
  return bcryptjs.hash(password, salt);
}

async function main() {
  console.log('🌱 Seeding MarqAI Tech Group (4-company structure)...');
  console.log('ℹ️  Using connection string prefix:', connectionString?.substring(0, 30) + '...');

  const hashedPassword = await hashPassword('MarqAI@2026');

  // ==================== TENANT ====================
  console.log('\n📋 Creating Tenant: MarqAI Tech Group...');
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'marqaitechgroup' },
    update: {
      logo: '/logos/marq-ai-group.png',
    },
    create: {
      name: 'MarqAI Tech Group',
      slug: 'marqaitechgroup',
      domain: 'marqaitechgroup.3boxeshrms.com',
      plan: 'enterprise',
      status: 'active',
      country: 'IN',
      currency: 'INR',
      timezone: 'Asia/Kolkata',
      language: 'en',
      logo: '/logos/marq-ai-group.png',
      baseCurrency: 'INR',
      maxCompaniesAllowed: 10,
      aiFeedbackEnabled: true,
      resumeScoreThreshold: 0,
      talentPoolCrossCompanyEnabled: true,
      videoInterviewRetakeLimit: 2,
      videoRetentionDays: 90,
    },
  });
  console.log(`  ✓ Tenant: ${tenant.name} (${tenant.id})`);

  // ==================== COMPANY GROUP ====================
  console.log('\n📋 Creating Company Group...');
  const companyGroup = await prisma.companyGroup.upsert({
    where: { id: `cg-marqai-${tenant.id}` },
    update: {},
    create: {
      id: `cg-marqai-${tenant.id}`,
      name: 'MarqAI Tech Group',
      tenantId: tenant.id,
      employeeLimitMode: 'group_total',
      maxEmployees: 500,
      maxCompanies: 10,
    },
  });
  console.log(`  ✓ CompanyGroup: ${companyGroup.name}`);

  // ==================== COMPANIES (4) ====================
  console.log('\n📋 Creating 4 Companies...');
  const companies = [
    {
      name: 'MARQ AI TECH PVT LTD',
      code: 'MATPL',
      country: 'IN',
      currency: 'INR',
      timezone: 'Asia/Kolkata',
      city: 'Hyderabad',
      state: 'TS',
      email: 'info@marqaitech.com',
      website: 'https://marqaitech.com',
      logo: '/logos/marq-ai-tech.png',
    },
    {
      name: '3 BOXES LUXURY CURATIONS',
      code: '3BLC',
      country: 'IN',
      currency: 'INR',
      timezone: 'Asia/Kolkata',
      city: 'Hyderabad',
      state: 'TS',
      email: 'info@3boxes.in',
      website: 'https://3boxes.in',
      logo: '/logos/3boxes-luxury.png',
    },
    {
      name: '3 BOXES CONSULTING SERVICES',
      code: '3BCS',
      country: 'IN',
      currency: 'INR',
      timezone: 'Asia/Kolkata',
      city: 'Bangalore',
      state: 'KA',
      email: 'info@3boxesconsulting.com',
      website: 'https://3boxesconsulting.com',
      logo: '/logos/3boxes-consulting.png',
    },
    {
      name: '3 BOXES TECHNOLOGIES',
      code: '3BT',
      country: 'IN',
      currency: 'INR',
      timezone: 'Asia/Kolkata',
      city: 'Chennai',
      state: 'TN',
      email: 'info@3boxestechnologies.com',
      website: 'https://3boxestechnologies.com',
      logo: '/logos/3boxes-technologies.png',
    },
  ];

  const createdCompanies = [];
  for (const company of companies) {
    const created = await prisma.company.upsert({
      where: { id: `comp-${company.code}-${tenant.id}` },
      update: {
        logo: company.logo,
      },
      create: {
        id: `comp-${company.code}-${tenant.id}`,
        name: company.name,
        code: company.code,
        companyGroupId: companyGroup.id,
        country: company.country,
        currency: company.currency,
        timezone: company.timezone,
        city: company.city,
        state: company.state,
        email: company.email,
        website: company.website,
        logo: company.logo,
        status: 'active',
        maxEmployees: 100,
      },
    });
    createdCompanies.push(created);
    console.log(`  ✓ Company: ${created.name} (${created.code}) → ${company.logo}`);
  }

  // ==================== BRANCHES ====================
  console.log('\n📋 Creating Branches...');
  const branches = [];
  for (const company of createdCompanies) {
    const branch = await prisma.branch.create({
      data: {
        name: `${company.name} - Head Office`,
        code: `${company.code}-HO`,
        companyId: company.id,
        city: company.city || 'Hyderabad',
        state: company.state || 'TS',
        country: company.country || 'IN',
        status: 'active',
      },
    });
    branches.push(branch);
    console.log(`  ✓ Branch: ${branch.name}`);
  }

  // ==================== DEPARTMENTS ====================
  console.log('\n📋 Creating Departments...');
  const deptNames = ['Human Resources', 'Finance', 'Operations'];
  const departments: Array<{ id: string; name: string; companyIndex: number }> = [];
  for (let i = 0; i < createdCompanies.length; i++) {
    const company = createdCompanies[i];
    const branch = branches[i];
    for (const deptName of deptNames) {
      const dept = await prisma.department.create({
        data: {
          name: deptName,
          companyId: company.id,
          branchId: branch.id,
          status: 'active',
        },
      });
      departments.push({ ...dept, companyIndex: i });
    }
  }
  console.log(`  ✓ ${departments.length} departments created`);

  // ==================== DESIGNATIONS ====================
  console.log('\n📋 Creating Designations...');
  const designationNames = ['CEO', 'HR Manager', 'Finance Manager', 'Operations Manager'];
  const designations = [];
  for (const desName of designationNames) {
    const des = await prisma.designation.create({
      data: {
        name: desName,
        status: 'active',
      },
    });
    designations.push(des);
  }
  console.log(`  ✓ ${designations.length} designations created`);

  // ==================== SUPER ADMIN USER ====================
  console.log('\n📋 Creating Super Admin user...');
  const superAdmin = await prisma.user.upsert({
    where: { email: 'superadmin@3boxeshrms.com' },
    update: {},
    create: {
      email: 'superadmin@3boxeshrms.com',
      name: '3Boxes Super Admin',
      password: hashedPassword,
      role: 'super_admin',
      status: 'active',
      tenantId: tenant.id,
    },
  });
  console.log(`  ✓ Super Admin: ${superAdmin.email}`);

  // ==================== TENANT ADMIN USER ====================
  console.log('\n📋 Creating Tenant Admin user...');
  const tenantAdmin = await prisma.user.upsert({
    where: { email: 'admin@marqaitechgroup.com' },
    update: {},
    create: {
      email: 'admin@marqaitechgroup.com',
      name: 'MarqAI Tech Group Admin',
      password: hashedPassword,
      role: 'tenant_admin',
      status: 'active',
      tenantId: tenant.id,
    },
  });
  console.log(`  ✓ Tenant Admin: ${tenantAdmin.email}`);

  // ==================== COMPANY HR ADMINS ====================
  console.log('\n📋 Creating Company HR Admin users...');
  const hrAdminData = [
    { email: 'admin@marqaitech.com', name: 'Admin - MARQ AI TECH' },
    { email: 'admin@3boxesluxury.com', name: 'Admin - 3 BOXES LUXURY' },
    { email: 'admin@3boxesconsulting.com', name: 'Admin - 3 BOXES CONSULTING' },
    { email: 'admin@3boxestechnologies.com', name: 'Admin - 3 BOXES TECHNOLOGIES' },
  ];
  const hrAdmins = [];
  for (let i = 0; i < createdCompanies.length; i++) {
    const company = createdCompanies[i];
    const branch = branches[i];
    const hrDept = departments.find(d => d.companyIndex === i && d.name === 'Human Resources');
    const hrDes = designations.find(d => d.name === 'HR Manager');

    const hrAdmin = await prisma.user.upsert({
      where: { email: hrAdminData[i].email },
      update: {},
      create: {
        email: hrAdminData[i].email,
        name: hrAdminData[i].name,
        password: hashedPassword,
        role: 'company_hr_admin',
        status: 'active',
        tenantId: tenant.id,
      },
    });
    hrAdmins.push(hrAdmin);

    // Create Employee record for HR admin
    if (hrDept && hrDes) {
      await prisma.employee.upsert({
        where: { userId: hrAdmin.id },
        update: {},
        create: {
          userId: hrAdmin.id,
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
    console.log(`  ✓ HR Admin: ${hrAdmin.email} → ${company.name}`);
  }

  // ==================== SUBSCRIPTION PLAN ====================
  console.log('\n📋 Creating Subscription Plan...');
  await prisma.subscriptionPlan.upsert({
    where: { id: 'plan-enterprise-marqai' },
    update: {},
    create: {
      id: 'plan-enterprise-marqai',
      name: 'Enterprise',
      price: 9999.00,
      currency: 'INR',
      billingCycle: 'monthly',
      features: JSON.stringify(['Unlimited Employees', 'Multi-Company', 'AI Features', 'Priority Support']),
      maxEmployees: 500,
      maxCompanies: 10,
    },
  });
  console.log('  ✓ Subscription Plan: Enterprise');

  // ==================== SUMMARY ====================
  console.log('\n========================================');
  console.log('  ✅ MarqAI Tech Group Seed Complete!');
  console.log('========================================');
  console.log('');
  console.log('  🏢 Tenant: MarqAI Tech Group');
  console.log('  🌐 Domain: marqaitechgroup.3boxeshrms.com');
  console.log('  🖼️  Tenant Logo: /logos/marq-ai-group.png');
  console.log('');
  console.log('  📧 Login Credentials (all passwords: MarqAI@2026):');
  console.log('');
  console.log('  🔑 Super Admin:');
  console.log('     superadmin@3boxeshrms.com');
  console.log('');
  console.log('  🔑 Tenant Admin (access to all 4 companies):');
  console.log('     admin@marqaitechgroup.com');
  console.log('');
  console.log('  🔑 Company HR Admins:');
  for (let i = 0; i < hrAdminData.length; i++) {
    console.log(`     ${hrAdminData[i].email} → ${createdCompanies[i].name}`);
  }
  console.log('');
  console.log('  🏢 Company Logos:');
  for (const c of companies) {
    console.log(`     ${c.name} (${c.code}) → ${c.logo}`);
  }
  console.log('');
  console.log('  ⚠️  IMPORTANT: Change all passwords after first login!');
  console.log('');

  await prisma.$disconnect();
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  });
