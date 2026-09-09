/**
 * Resume MarqAI seed after partial run (designations + users only).
 */
import bcryptjs from 'bcryptjs';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const connectionString = process.env.TENANT_DATABASE_URL || process.env.DATABASE_URL;
if (!connectionString) throw new Error('TENANT_DATABASE_URL missing');

const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString }) });

async function hashPassword(password: string) {
  const salt = await bcryptjs.genSalt(12);
  return bcryptjs.hash(password, salt);
}

async function main() {
  const hashedPassword = await hashPassword('MarqAI@2026');
  const tenant = await prisma.tenant.findUnique({ where: { slug: 'marqaitechgroup' } });
  if (!tenant) throw new Error('Tenant marqaitechgroup not found in tenant DB');

  const companies = await prisma.company.findMany({ orderBy: { createdAt: 'asc' } });
  const branches = await prisma.branch.findMany();
  const departments = await prisma.department.findMany();

  const existingDes = await prisma.designation.count();
  if (existingDes === 0) {
    const designationDefs = [
      { title: 'CEO', deptName: 'Operations', level: 6 },
      { title: 'HR Manager', deptName: 'Human Resources', level: 5 },
      { title: 'Finance Manager', deptName: 'Finance', level: 5 },
      { title: 'Operations Manager', deptName: 'Operations', level: 4 },
    ];
    for (let i = 0; i < companies.length; i++) {
      const company = companies[i];
      const companyDepts = departments.filter((d) => d.companyId === company.id);
      for (const def of designationDefs) {
        const dept = companyDepts.find((d) => d.name === def.deptName);
        if (!dept) continue;
        await prisma.designation.create({
          data: { title: def.title, departmentId: dept.id, level: def.level, status: 'active' },
        });
      }
    }
    console.log('Designations created');
  } else {
    console.log('Designations already exist, skipping');
  }

  const allDesignations = await prisma.designation.findMany({
    include: { department: true },
  });

  await prisma.user.upsert({
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

  await prisma.user.upsert({
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
  console.log('Tenant admin ready: admin@marqaitechgroup.com');

  const hrAdminData = [
    { email: 'admin@marqaitech.com', name: 'Admin - MARQ AI TECH' },
    { email: 'admin@3boxesluxury.com', name: 'Admin - 3 BOXES LUXURY' },
    { email: 'admin@3boxesconsulting.com', name: 'Admin - 3 BOXES CONSULTING' },
    { email: 'admin@3boxestechnologies.com', name: 'Admin - 3 BOXES TECHNOLOGIES' },
  ];

  for (let i = 0; i < companies.length; i++) {
    const company = companies[i];
    const branch = branches.find((b) => b.companyId === company.id);
    const hrDept = departments.find((d) => d.companyId === company.id && d.name === 'Human Resources');
    const hrDes = allDesignations.find(
      (d) => d.department.companyId === company.id && d.title === 'HR Manager'
    );

    const hrAdmin = await prisma.user.upsert({
      where: { email: hrAdminData[i]?.email ?? `hr${i}@example.com` },
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

    if (branch && hrDept && hrDes) {
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
          lastName: company.code ?? 'HR',
          status: 'active',
          joiningDate: new Date(),
        },
      });
    }
    console.log(`HR admin: ${hrAdmin.email}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
