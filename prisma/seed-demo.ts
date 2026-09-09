/**
 * 3Boxes HRMS — Comprehensive Demo Seed
 * Populates ALL modules with realistic sample data for the demo link.
 *
 * Usage:  npx tsx prisma/seed-demo.ts
 *
 * This script is IDEMPOTENT — it checks for existing data before creating.
 * It clears existing demo data first (by tenant slug) to allow clean re-seeds.
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

// ─── Helper: random pick ───
function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min: number, max: number): number { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randDate(start: Date, end: Date): Date {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

const TENANT_SLUG = '3boxes-hrms-demo';
const DEMO_PASSWORD = 'MarqAI@2026';
const DEMO_ASSET_TAG_PREFIX = 'DEMO-';

const LEGACY_DEMO_ASSET_TAGS = [
  'MBP-2024-001', 'DLL-2024-002', 'TPD-2024-003', 'IPH-2024-001', 'SMG-2024-002',
  'MON-2024-001', 'MON-2024-002', 'PRT-2024-001', 'LAB-2024-001', 'IND-2024-001',
  'FRN-2024-001', 'FRN-2024-002', 'TAB-2024-001', 'AV-2024-001', 'SRV-2024-001',
];

async function cleanupDemoAssets() {
  const demoAssets = await prisma.asset.findMany({
    where: {
      OR: [
        { assetTag: { startsWith: DEMO_ASSET_TAG_PREFIX } },
        { assetTag: { in: LEGACY_DEMO_ASSET_TAGS } },
      ],
    },
    select: { id: true },
  });
  const assetIds = demoAssets.map((a) => a.id);
  if (!assetIds.length) return;
  await prisma.assetAssignment.deleteMany({ where: { assetId: { in: assetIds } } });
  await prisma.asset.deleteMany({ where: { id: { in: assetIds } } });
}

async function main() {
  console.log('🌱 Seeding COMPREHENSIVE DEMO database...');
  console.log('ℹ️  Using connection string prefix:', connectionString?.substring(0, 30) + '...');

  // ── 1. CLEANUP existing demo data ──
  console.log('\n🧹 Cleaning up existing demo data...');
  await cleanupDemoAssets();
  const existingTenant = await prisma.tenant.findUnique({ where: { slug: TENANT_SLUG } });

  if (existingTenant) {
    // Delete in dependency order (children first)
    console.log('  Deleting existing demo tenant and all related data...');

    // Get all company IDs for this tenant
    const companyGroups = await prisma.companyGroup.findMany({ where: { tenantId: existingTenant.id } });
    const companyGroupIds = companyGroups.map(cg => cg.id);

    const companies = await prisma.company.findMany({
      where: { companyGroupId: { in: companyGroupIds } },
      select: { id: true },
    });
    const companyIds = companies.map(c => c.id);

    const branches = await prisma.branch.findMany({ where: { companyId: { in: companyIds } }, select: { id: true } });
    const branchIds = branches.map(b => b.id);

    const departments = await prisma.department.findMany({ where: { companyId: { in: companyIds } }, select: { id: true } });
    const departmentIds = departments.map(d => d.id);

    const designations = await prisma.designation.findMany({ where: { departmentId: { in: departmentIds } }, select: { id: true } });
    const designationIds = designations.map(d => d.id);

    // Get employee IDs
    const employees = await prisma.employee.findMany({ where: { companyId: { in: companyIds } }, select: { id: true, userId: true } });
    const employeeIds = employees.map(e => e.id);
    const userIds = [existingTenant.id, ...employees.filter(e => e.userId).map(e => e.userId!)];

    // Get user IDs for this tenant
    const tenantUsers = await prisma.user.findMany({ where: { tenantId: existingTenant.id }, select: { id: true } });
    const allUserIds = tenantUsers.map(u => u.id);

    // ─── ALSO: catch orphaned records from previous seed runs ───
    // If a previous seed run was interrupted, OR the tenant was deleted and
    // recreated (giving it a NEW tenantId), users/employees from the OLD run
    // would still exist with the same emails but a STALE tenantId. We collect
    // these orphans by email pattern so they get cleaned up too.
    const DEMO_EMAIL_PATTERN = { email: { contains: '@3boxeshrms.com' } };
    const orphanedUsers = await prisma.user.findMany({
      where: DEMO_EMAIL_PATTERN,
      select: { id: true, email: true },
    });
    const orphanedUserIds = orphanedUsers.map(u => u.id);
    const orphanedEmployees = await prisma.employee.findMany({
      where: DEMO_EMAIL_PATTERN,
      select: { id: true, userId: true },
    });
    const orphanedEmployeeIds = orphanedEmployees.map(e => e.id);
    const orphanedEmployeeUserIds = orphanedEmployees.filter(e => e.userId).map(e => e.userId!);

    // Merge orphaned IDs into the main cleanup arrays
    const allCleanupUserIds = [...new Set([...allUserIds, ...orphanedUserIds, ...orphanedEmployeeUserIds])];
    const allCleanupEmployeeIds = [...new Set([...employeeIds, ...orphanedEmployeeIds])];

    console.log(`  Found ${allCleanupEmployeeIds.length} employees (incl. ${orphanedEmployeeIds.length} orphans) and ${allCleanupUserIds.length} users (incl. ${orphanedUserIds.length} orphans) to delete`);

    // Delete in safe order (most dependent first)
    const deleteOps = [
      () => prisma.payrollTransactionLine.deleteMany({ where: { employeeId: { in: allCleanupEmployeeIds } } }),
      () => prisma.payrollInput.deleteMany({ where: { employeeId: { in: allCleanupEmployeeIds } } }),
      () => prisma.payrollRun.deleteMany({ where: { companyId: { in: companyIds } } }),
      () => prisma.attendance.deleteMany({ where: { employeeId: { in: allCleanupEmployeeIds } } }),
      () => prisma.leaveRequest.deleteMany({ where: { employeeId: { in: allCleanupEmployeeIds } } }),
      () => prisma.leaveBalance.deleteMany({ where: { employeeId: { in: allCleanupEmployeeIds } } }),
      () => prisma.expenseClaim.deleteMany({ where: { employeeId: { in: allCleanupEmployeeIds } } }),
      () => prisma.travelRequest.deleteMany({ where: { employeeId: { in: allCleanupEmployeeIds } } }),
      () => prisma.timesheet.deleteMany({ where: { employeeId: { in: allCleanupEmployeeIds } } }),
      () => prisma.assetAssignment.deleteMany({ where: { employeeId: { in: allCleanupEmployeeIds } } }),
      () => prisma.document.deleteMany({ where: { employeeId: { in: allCleanupEmployeeIds } } }),
      () => prisma.dependent.deleteMany({ where: { employeeId: { in: allCleanupEmployeeIds } } }),
      () => prisma.qualification.deleteMany({ where: { employeeId: { in: allCleanupEmployeeIds } } }),
      () => prisma.experience.deleteMany({ where: { employeeId: { in: allCleanupEmployeeIds } } }),
      () => prisma.employeeSkill.deleteMany({ where: { employeeId: { in: allCleanupEmployeeIds } } }),
      () => prisma.employeeCompanyMapping.deleteMany({ where: { employeeId: { in: allCleanupEmployeeIds } } }),
      () => prisma.performanceReview.deleteMany({ where: { employeeId: { in: allCleanupEmployeeIds } } }),
      () => prisma.goal.deleteMany({ where: { employeeId: { in: allCleanupEmployeeIds } } }),
      () => prisma.feedback.deleteMany({ where: { employeeId: { in: allCleanupEmployeeIds } } }),
      () => prisma.recognition.deleteMany({ where: { toId: { in: allCleanupEmployeeIds } } }),
      () => prisma.ticket.deleteMany({ where: { employeeId: { in: allCleanupEmployeeIds } } }),
      () => prisma.loan.deleteMany({ where: { employeeId: { in: allCleanupEmployeeIds } } }),
      () => prisma.trainingEnrollment.deleteMany({ where: { employeeId: { in: allCleanupEmployeeIds } } }),
      () => prisma.overtimeRecord.deleteMany({ where: { employeeId: { in: allCleanupEmployeeIds } } }),
      () => prisma.notification.deleteMany({ where: { tenantId: existingTenant.id } }),
      () => prisma.announcement.deleteMany({ where: { tenantId: existingTenant.id } }),
      () => prisma.auditLog.deleteMany({ where: { userId: { in: allCleanupUserIds } } }),
      () => prisma.loginActivity.deleteMany({ where: { userId: { in: allCleanupUserIds } } }),
      () => prisma.interview.deleteMany({}),
      () => prisma.jobApplication.deleteMany({}),
      () => prisma.jobPosting.deleteMany({ where: { departmentId: { in: departmentIds } } }),
      () => prisma.requisition.deleteMany({ where: { departmentId: { in: departmentIds } } }),
      () => prisma.offer.deleteMany({}),
      () => prisma.referral.deleteMany({ where: { referrerEmployeeId: { in: allCleanupEmployeeIds } } }),
      () => prisma.projectMember.deleteMany({ where: { employeeId: { in: allCleanupEmployeeIds } } }),
      () => prisma.projectAllocation.deleteMany({}),
      () => prisma.projectTask.deleteMany({}),
      () => prisma.projectMilestone.deleteMany({}),
      () => prisma.project.deleteMany({ where: { companyId: { in: companyIds } } }),
      () => prisma.clientContact.deleteMany({}),
      () => prisma.clientBranch.deleteMany({}),
      () => prisma.client.deleteMany({ where: { companyId: { in: companyIds } } }),
      () => prisma.vendorStaff.deleteMany({}),
      () => prisma.vendor.deleteMany({ where: { companyId: { in: companyIds } } }),
      () => prisma.contractor.deleteMany({ where: { companyId: { in: companyIds } } }),
      () => cleanupDemoAssets(),
      () => prisma.course.deleteMany({}),
      () => prisma.salaryStructure.deleteMany({ where: { companyId: { in: companyIds } } }),
      () => prisma.salaryComponent.deleteMany({}),
      () => prisma.employee.deleteMany({ where: { id: { in: allCleanupEmployeeIds } } }),
      () => prisma.userRoleAssignment.deleteMany({ where: { userId: { in: allCleanupUserIds } } }),
      () => prisma.rolePermission.deleteMany({ where: { role: { tenantId: existingTenant.id } } }),
      () => prisma.role.deleteMany({ where: { tenantId: existingTenant.id } }),
      // KEY FIX: delete ALL users (incl. orphans) by ID, not just by tenantId
      () => prisma.user.deleteMany({ where: { id: { in: allCleanupUserIds } } }),
      // Also delete the TenantDatabase record so re-seed creates fresh
      () => prisma.tenantDatabase.deleteMany({ where: { tenantId: existingTenant.id } }).catch(() => {}),
      () => prisma.shift.deleteMany({ where: { companyId: { in: companyIds } } }),
      () => prisma.holiday.deleteMany({ where: { companyId: { in: companyIds } } }),
      () => prisma.policy.deleteMany({ where: { companyId: { in: companyIds } } }),
      () => prisma.leaveType.deleteMany({}),
      () => prisma.designation.deleteMany({ where: { id: { in: designationIds } } }),
      () => prisma.department.deleteMany({ where: { id: { in: departmentIds } } }),
      () => prisma.branch.deleteMany({ where: { id: { in: branchIds } } }),
      () => prisma.company.deleteMany({ where: { id: { in: companyIds } } }),
      () => prisma.companyGroup.deleteMany({ where: { id: { in: companyGroupIds } } }),
      () => prisma.subscription.deleteMany({ where: { tenantId: existingTenant.id } }),
      () => prisma.tenant.delete({ where: { id: existingTenant.id } }),
    ];

    for (const op of deleteOps) {
      try { await op(); } catch (e) { /* skip if table doesn't exist or no records */ }
    }
    console.log('  ✓ Existing demo data cleaned (including orphans)');
  } else {
    // ─── No existing tenant — still clean up orphaned users/employees by email ───
    console.log('  No existing demo tenant — cleaning up orphaned demo records by email pattern...');
    const DEMO_EMAIL_PATTERN = { email: { contains: '@3boxeshrms.com' } };
    const orphanedUsers = await prisma.user.findMany({
      where: DEMO_EMAIL_PATTERN,
      select: { id: true },
    });
    const orphanedEmployees = await prisma.employee.findMany({
      where: DEMO_EMAIL_PATTERN,
      select: { id: true, userId: true },
    });
    const orphanedEmployeeIds = orphanedEmployees.map(e => e.id);
    const allOrphanedUserIds = [
      ...orphanedUsers.map(u => u.id),
      ...orphanedEmployees.filter(e => e.userId).map(e => e.userId!),
    ];

    if (orphanedEmployeeIds.length > 0 || allOrphanedUserIds.length > 0) {
      console.log(`  Cleaning ${orphanedEmployeeIds.length} orphaned employees and ${allOrphanedUserIds.length} orphaned users...`);
      const orphanDeleteOps = [
        () => prisma.payrollTransactionLine.deleteMany({ where: { employeeId: { in: orphanedEmployeeIds } } }).catch(() => {}),
        () => prisma.payrollInput.deleteMany({ where: { employeeId: { in: orphanedEmployeeIds } } }).catch(() => {}),
        () => prisma.attendance.deleteMany({ where: { employeeId: { in: orphanedEmployeeIds } } }).catch(() => {}),
        () => prisma.leaveRequest.deleteMany({ where: { employeeId: { in: orphanedEmployeeIds } } }).catch(() => {}),
        () => prisma.leaveBalance.deleteMany({ where: { employeeId: { in: orphanedEmployeeIds } } }).catch(() => {}),
        () => prisma.expenseClaim.deleteMany({ where: { employeeId: { in: orphanedEmployeeIds } } }).catch(() => {}),
        () => prisma.travelRequest.deleteMany({ where: { employeeId: { in: orphanedEmployeeIds } } }).catch(() => {}),
        () => prisma.timesheet.deleteMany({ where: { employeeId: { in: orphanedEmployeeIds } } }).catch(() => {}),
        () => prisma.assetAssignment.deleteMany({ where: { employeeId: { in: orphanedEmployeeIds } } }).catch(() => {}),
        () => prisma.document.deleteMany({ where: { employeeId: { in: orphanedEmployeeIds } } }).catch(() => {}),
        () => prisma.dependent.deleteMany({ where: { employeeId: { in: orphanedEmployeeIds } } }).catch(() => {}),
        () => prisma.qualification.deleteMany({ where: { employeeId: { in: orphanedEmployeeIds } } }).catch(() => {}),
        () => (prisma as any).experience?.deleteMany?.({ where: { employeeId: { in: orphanedEmployeeIds } } }).catch(() => {}),
        () => (prisma as any).employeeSkill?.deleteMany?.({ where: { employeeId: { in: orphanedEmployeeIds } } }).catch(() => {}),
        () => prisma.employeeCompanyMapping.deleteMany({ where: { employeeId: { in: orphanedEmployeeIds } } }).catch(() => {}),
        () => prisma.performanceReview.deleteMany({ where: { employeeId: { in: orphanedEmployeeIds } } }).catch(() => {}),
        () => prisma.goal.deleteMany({ where: { employeeId: { in: orphanedEmployeeIds } } }).catch(() => {}),
        () => prisma.feedback.deleteMany({ where: { employeeId: { in: orphanedEmployeeIds } } }).catch(() => {}),
        () => prisma.recognition.deleteMany({ where: { employeeId: { in: orphanedEmployeeIds } } }).catch(() => {}),
        () => prisma.ticket.deleteMany({ where: { employeeId: { in: orphanedEmployeeIds } } }).catch(() => {}),
        () => prisma.loan.deleteMany({ where: { employeeId: { in: orphanedEmployeeIds } } }).catch(() => {}),
        () => prisma.trainingEnrollment.deleteMany({ where: { employeeId: { in: orphanedEmployeeIds } } }).catch(() => {}),
        () => prisma.overtimeRecord.deleteMany({ where: { employeeId: { in: orphanedEmployeeIds } } }).catch(() => {}),
        () => prisma.auditLog.deleteMany({ where: { userId: { in: allOrphanedUserIds } } }).catch(() => {}),
        () => prisma.loginActivity.deleteMany({ where: { userId: { in: allOrphanedUserIds } } }).catch(() => {}),
        () => prisma.referral.deleteMany({ where: { employeeId: { in: orphanedEmployeeIds } } }).catch(() => {}),
        () => prisma.projectMember.deleteMany({ where: { employeeId: { in: orphanedEmployeeIds } } }).catch(() => {}),
        () => prisma.employee.deleteMany({ where: { id: { in: orphanedEmployeeIds } } }).catch(() => {}),
        () => prisma.userRoleAssignment.deleteMany({ where: { userId: { in: allOrphanedUserIds } } }).catch(() => {}),
        () => prisma.user.deleteMany({ where: { id: { in: allOrphanedUserIds } } }).catch(() => {}),
      ];
      for (const op of orphanDeleteOps) {
        try { await op(); } catch (e) { /* skip */ }
      }
    }
    console.log('  ✓ Orphaned records cleaned');
  }

  // ── 2. TENANT ──
  console.log('\n📋 Creating Demo Tenant...');
  const tenant = await prisma.tenant.create({
    data: {
      name: '3 Boxes HRMS Demo',
      slug: TENANT_SLUG,
      domain: 'nexus-hrms-mu.vercel.app',
      plan: 'enterprise',
      status: 'active',
      country: 'IN',
      currency: 'INR',
      timezone: 'Asia/Kolkata',
      aiFeedbackEnabled: true,
      resumeScoreThreshold: 0,
      talentPoolCrossCompanyEnabled: true,
      videoInterviewRetakeLimit: 2,
      videoRetentionDays: 90,
    },
  });
  console.log(`  ✓ Tenant: ${tenant.name} (${tenant.id})`);

  // ── 2b. Register the demo tenant DB (so getDbForTenant finds it) ──
  // The seed script writes to the same DB it connects to. We register
  // this DB as the tenant's dedicated DB so that runtime getDbForTenant()
  // resolves to this DB instead of falling back to the platform DB.
  await prisma.tenantDatabase.upsert({
    where: { tenantId: tenant.id },
    update: { isActive: true },
    create: {
      tenantId: tenant.id,
      connectionString: connectionString!,
      directUrl: connectionString,
      databaseName: 'demo_db',
      isActive: true,
    },
  });
  console.log(`  ✓ Registered TenantDatabase for demo tenant`);

  // ── 3. COMPANY GROUP ──
  const companyGroup = await prisma.companyGroup.create({
    data: { name: '3 Boxes Enterprise Group', tenantId: tenant.id },
  });

  // ── 4. COMPANIES (3 demo companies) ──
  const [tcg, mpi, hfs] = await Promise.all([
    prisma.company.create({
      data: {
        name: 'TechCorp Global', code: 'TCG', companyGroupId: companyGroup.id,
        country: 'IN', currency: 'INR', timezone: 'Asia/Kolkata',
        city: 'Hyderabad', state: 'TG', email: 'info@techcorp.com',
        website: 'https://techcorp.com', status: 'active',
        address: 'Cyber Towers, HITEC City', phone: '+91-40-2345-6789',
      },
    }),
    prisma.company.create({
      data: {
        name: 'ManufactPro Industries', code: 'MPI', companyGroupId: companyGroup.id,
        country: 'IN', currency: 'INR', timezone: 'Asia/Kolkata',
        city: 'Mumbai', state: 'MH', email: 'info@manufactpro.com',
        website: 'https://manufactpro.com', status: 'active',
        address: 'MIDC, Andheri East', phone: '+91-22-4567-8901',
      },
    }),
    prisma.company.create({
      data: {
        name: 'HealthFirst Solutions', code: 'HFS', companyGroupId: companyGroup.id,
        country: 'IN', currency: 'INR', timezone: 'Asia/Kolkata',
        city: 'Bengaluru', state: 'KA', email: 'info@healthfirst.com',
        website: 'https://healthfirst.com', status: 'active',
        address: 'Whitefield Main Road', phone: '+91-80-6789-0123',
      },
    }),
  ]);
  console.log(`  ✓ Created 3 companies: TechCorp Global, ManufactPro Industries, HealthFirst Solutions`);

  // ── 5. BRANCHES ──
  const branches = await Promise.all([
    prisma.branch.create({ data: { name: 'Hyderabad HQ', code: 'TCG-HYD', city: 'Hyderabad', state: 'TG', country: 'IN', companyId: tcg.id, status: 'active', address: 'Cyber Towers, HITEC City' } }),
    prisma.branch.create({ data: { name: 'Mumbai Office', code: 'TCG-MUM', city: 'Mumbai', state: 'MH', country: 'IN', companyId: tcg.id, status: 'active', address: 'BKC, Bandra' } }),
    prisma.branch.create({ data: { name: 'Mumbai Factory', code: 'MPI-MUM', city: 'Mumbai', state: 'MH', country: 'IN', companyId: mpi.id, status: 'active', address: 'MIDC, Andheri East' } }),
    prisma.branch.create({ data: { name: 'Pune Plant', code: 'MPI-PUN', city: 'Pune', state: 'MH', country: 'IN', companyId: mpi.id, status: 'active', address: 'Rajiv Gandhi Infotech Park' } }),
    prisma.branch.create({ data: { name: 'Bengaluru HQ', code: 'HFS-BLR', city: 'Bengaluru', state: 'KA', country: 'IN', companyId: hfs.id, status: 'active', address: 'Whitefield Main Road' } }),
    prisma.branch.create({ data: { name: 'Chennai R&D', code: 'HFS-MAA', city: 'Chennai', state: 'TN', country: 'IN', companyId: hfs.id, status: 'active', address: 'OMR, Thoraipakkam' } }),
  ]);
  console.log(`  ✓ Created 6 branches`);

  // ── 6. DEPARTMENTS (8 per company = 24 total) ──
  const DEPT_NAMES = [
    { name: 'Engineering', code: 'ENG' },
    { name: 'Human Resources', code: 'HR' },
    { name: 'Finance', code: 'FIN' },
    { name: 'Operations', code: 'OPS' },
    { name: 'Sales & Marketing', code: 'SAL' },
    { name: 'Quality Assurance', code: 'QA' },
    { name: 'Research & Development', code: 'RND' },
    { name: 'Administration', code: 'ADM' },
  ];

  type DeptRef = { id: string; name: string; companyId: string; branchId: string | null };
  const allDepts: DeptRef[] = [];

  for (const company of [tcg, mpi, hfs]) {
    const companyBranches = branches.filter(b => b.companyId === company.id);
    for (const deptDef of DEPT_NAMES) {
      const branch = pick(companyBranches);
      const dept = await prisma.department.create({
        data: { name: deptDef.name, code: `${company.code}-${deptDef.code}`, companyId: company.id, branchId: branch.id, status: 'active' },
      });
      allDepts.push({ id: dept.id, name: dept.name, companyId: company.id, branchId: branch.id });
    }
  }
  console.log(`  ✓ Created ${allDepts.length} departments`);

  // ── 7. DESIGNATIONS (6 per company = 18) ──
  const DESG_TITLES = [
    { title: 'Vice President', level: 8, minSalary: 3500000, maxSalary: 6000000 },
    { title: 'Senior Manager', level: 7, minSalary: 2500000, maxSalary: 4000000 },
    { title: 'Manager', level: 6, minSalary: 1800000, maxSalary: 3000000 },
    { title: 'Team Lead', level: 5, minSalary: 1200000, maxSalary: 2200000 },
    { title: 'Senior Associate', level: 4, minSalary: 800000, maxSalary: 1500000 },
    { title: 'Associate', level: 3, minSalary: 500000, maxSalary: 1000000 },
  ];

  type DesgRef = { id: string; title: string; departmentId: string };
  const allDesgs: DesgRef[] = [];

  for (const company of [tcg, mpi, hfs]) {
    const companyDepts = allDepts.filter(d => d.companyId === company.id);
    for (const desgDef of DESG_TITLES) {
      const dept = pick(companyDepts);
      const desg = await prisma.designation.create({
        data: { title: desgDef.title, departmentId: dept.id, level: desgDef.level, minSalary: desgDef.minSalary, maxSalary: desgDef.maxSalary, status: 'active' },
      });
      allDesgs.push({ id: desg.id, title: desg.title, departmentId: dept.id });
    }
  }
  console.log(`  ✓ Created ${allDesgs.length} designations`);

  // ── 8. SHIFTS ──
  const shifts = await Promise.all([
    prisma.shift.create({ data: { name: 'General Shift', startTime: '09:00', endTime: '18:00', companyId: tcg.id, status: 'active', graceTime: 15, breakDuration: 60 } }),
    prisma.shift.create({ data: { name: 'Morning Shift', startTime: '06:00', endTime: '14:00', companyId: tcg.id, status: 'active', graceTime: 10, breakDuration: 45 } }),
    prisma.shift.create({ data: { name: 'Factory Shift A', startTime: '07:00', endTime: '15:00', companyId: mpi.id, status: 'active', graceTime: 10, breakDuration: 45 } }),
    prisma.shift.create({ data: { name: 'Factory Shift B (Night)', startTime: '15:00', endTime: '23:00', companyId: mpi.id, status: 'active', graceTime: 10, breakDuration: 45 } }),
    prisma.shift.create({ data: { name: 'Night Shift', startTime: '22:00', endTime: '06:00', companyId: mpi.id, status: 'active', graceTime: 10, breakDuration: 45 } }),
    prisma.shift.create({ data: { name: 'Lab Shift', startTime: '08:00', endTime: '16:30', companyId: hfs.id, status: 'active', graceTime: 15, breakDuration: 60 } }),
  ]);
  console.log(`  ✓ Created ${shifts.length} shifts`);

  // ── 9. HOLIDAYS (India 2025/2026) ──
  const HOLIDAYS_DATA = [
    { name: 'Republic Day', date: new Date('2026-01-26'), type: 'public' },
    { name: 'Holi', date: new Date('2026-03-14'), type: 'company' },
    { name: 'Good Friday', date: new Date('2026-04-03'), type: 'company' },
    { name: 'Eid ul-Fitr', date: new Date('2026-04-02'), type: 'company' },
    { name: 'Independence Day', date: new Date('2026-08-15'), type: 'public' },
    { name: 'Gandhi Jayanti', date: new Date('2026-10-02'), type: 'public' },
    { name: 'Dussehra', date: new Date('2026-10-20'), type: 'company' },
    { name: 'Diwali', date: new Date('2026-11-08'), type: 'company' },
    { name: 'Christmas', date: new Date('2026-12-25'), type: 'company' },
    { name: 'New Year', date: new Date('2027-01-01'), type: 'public' },
  ];

  for (const company of [tcg, mpi, hfs]) {
    for (const h of HOLIDAYS_DATA) {
      await prisma.holiday.create({
        data: { name: h.name, date: h.date, type: h.type, companyId: company.id, country: 'IN' },
      });
    }
  }
  console.log(`  ✓ Created ${HOLIDAYS_DATA.length * 3} holidays`);

  // ── 10. LEAVE TYPES ──
  const LEAVE_TYPE_DEFS = [
    { name: 'Casual Leave', code: 'CL', description: 'Casual leave for personal matters', defaultDays: 12, isPaid: true, carryForward: true, maxCarryForward: 3 },
    { name: 'Sick Leave', code: 'SL', description: 'Sick leave for medical reasons', defaultDays: 10, isPaid: true, carryForward: false, maxCarryForward: 0 },
    { name: 'Earned Leave', code: 'EL', description: 'Earned/privilege leave', defaultDays: 15, isPaid: true, carryForward: true, maxCarryForward: 5 },
    { name: 'Maternity Leave', code: 'ML', description: 'Maternity leave as per policy', defaultDays: 180, isPaid: true, carryForward: false, maxCarryForward: 0 },
    { name: 'Paternity Leave', code: 'PL', description: 'Paternity leave as per policy', defaultDays: 15, isPaid: true, carryForward: false, maxCarryForward: 0 },
    { name: 'Compensatory Off', code: 'CO', description: 'Compensatory off for working on holidays', defaultDays: 1, isPaid: true, carryForward: true, maxCarryForward: 2 },
  ];

  const leaveTypes: Array<{
    id: string;
    code: string;
    companyId: string;
    defaultDays: number;
    carryForward: boolean;
    maxCarryForward: number;
  }> = [];

  for (const company of [tcg, mpi, hfs]) {
    for (const def of LEAVE_TYPE_DEFS) {
      const lt = await prisma.leaveType.create({
        data: {
          name: def.name,
          code: `${company.code}-${def.code}`,
          description: def.description,
          defaultDays: def.defaultDays,
          isPaid: def.isPaid,
          carryForward: def.carryForward,
          maxCarryForward: def.maxCarryForward,
          status: 'active',
          companyId: company.id,
        },
      });
      leaveTypes.push({
        id: lt.id,
        code: def.code,
        companyId: company.id,
        defaultDays: lt.defaultDays,
        carryForward: lt.carryForward,
        maxCarryForward: lt.maxCarryForward,
      });
    }
  }
  console.log(`  ✓ Created ${leaveTypes.length} leave types`);

  // ── 11. GRADES ──
  // Grades are handled via designation levels

  // ── 12. USERS (all roles) ──
  console.log('\n📋 Creating Users...');
  const pwHash = await hashPassword(DEMO_PASSWORD);

  const superAdminUser = await prisma.user.create({
    data: { email: 'superadmin@3boxeshrms.com', password: pwHash, name: 'Super Admin', role: 'super_admin', status: 'active', tenantId: tenant.id },
  });

  const tenantAdminUser = await prisma.user.create({
    data: { email: 'tenantadmin@3boxeshrms.com', password: pwHash, name: 'Tenant Admin', role: 'tenant_admin', status: 'active', tenantId: tenant.id },
  });

  // Company HR Admins (one per company)
  const hrAdminUsers = await Promise.all([
    prisma.user.create({ data: { email: 'hr.tcg@3boxeshrms.com', password: pwHash, name: 'Anitha Reddy', role: 'hr_admin', status: 'active', tenantId: tenant.id } }),
    prisma.user.create({ data: { email: 'hr.mpi@3boxeshrms.com', password: pwHash, name: 'Suresh Iyer', role: 'hr_admin', status: 'active', tenantId: tenant.id } }),
    prisma.user.create({ data: { email: 'hr.hfs@3boxeshrms.com', password: pwHash, name: 'Deepa Nair', role: 'hr_admin', status: 'active', tenantId: tenant.id } }),
  ]);

  // Managers
  const managerUsers = await Promise.all([
    prisma.user.create({ data: { email: 'mgr1@3boxeshrms.com', password: pwHash, name: 'Rajesh Kumar', role: 'manager', status: 'active', tenantId: tenant.id } }),
    prisma.user.create({ data: { email: 'mgr2@3boxeshrms.com', password: pwHash, name: 'Pooja Sharma', role: 'manager', status: 'active', tenantId: tenant.id } }),
    prisma.user.create({ data: { email: 'mgr3@3boxeshrms.com', password: pwHash, name: 'Vikram Patel', role: 'manager', status: 'active', tenantId: tenant.id } }),
    prisma.user.create({ data: { email: 'mgr4@3boxeshrms.com', password: pwHash, name: 'Sunita Joshi', role: 'manager', status: 'active', tenantId: tenant.id } }),
    prisma.user.create({ data: { email: 'mgr5@3boxeshrms.com', password: pwHash, name: 'Arun Menon', role: 'manager', status: 'active', tenantId: tenant.id } }),
    prisma.user.create({ data: { email: 'mgr6@3boxeshrms.com', password: pwHash, name: 'Kavitha Raman', role: 'manager', status: 'active', tenantId: tenant.id } }),
  ]);

  // Employees — 25 per company × 3 companies = 75 regular employees
  const EMPLOYEE_NAMES = [
    { first: 'Amit', last: 'Verma' }, { first: 'Bharathi', last: 'Krishnan' }, { first: 'Chandra', last: 'Shekhar' },
    { first: 'Divya', last: 'Prasad' }, { first: 'Eshwar', last: 'Rao' }, { first: 'Fatima', last: 'Begum' },
    { first: 'Ganesh', last: 'Acharya' }, { first: 'Harini', last: 'Subramanian' }, { first: 'Irfan', last: 'Khan' },
    { first: 'Janaki', last: 'Raman' }, { first: 'Karthik', last: 'Gopal' }, { first: 'Lakshmi', last: 'Devi' },
    { first: 'Manoj', last: 'Tiwari' }, { first: 'Nandini', last: 'Rathore' }, { first: 'Om', last: 'Prakash' },
    { first: 'Padma', last: 'Lakshmi' }, { first: 'Qadir', last: 'Hussain' }, { first: 'Ritu', last: 'Singh' },
    { first: 'Sanjay', last: 'Gupta' }, { first: 'Tanuja', last: 'Mishra' }, { first: 'Uday', last: 'Kiran' },
    { first: 'Vasundhara', last: 'Das' }, { first: 'Wasim', last: 'Akram' }, { first: 'Xena', last: 'Fernandes' },
    { first: 'Yogesh', last: 'Pandey' }, { first: 'Zeenat', last: 'Bano' }, { first: 'Anil', last: 'Kapoor' },
    { first: 'Bhanu', last: 'Pratap' }, { first: 'Chitra', last: 'Venkatesh' }, { first: 'Dinesh', last: 'Kumar' },
    { first: 'Esha', last: 'Agarwal' }, { first: 'Farhan', last: 'Malik' }, { first: 'Gita', last: 'Pillai' },
    { first: 'Hemant', last: 'Joshi' }, { first: 'Indira', last: 'Nair' }, { first: 'Javed', last: 'Sheikh' },
    { first: 'Kavya', last: 'Reddy' }, { first: 'Lokesh', last: 'Bhat' }, { first: 'Meena', last: 'Shetty' },
    { first: 'Naveen', last: 'Chandra' }, { first: 'Omana', last: 'Menon' }, { first: 'Prakash', last: 'Naidu' },
    { first: 'Qamar', last: 'Siddiqui' }, { first: 'Ramesh', last: 'Iyer' }, { first: 'Sneha', last: 'Desai' },
    { first: 'Tarun', last: 'Saxena' }, { first: 'Uma', last: 'Shankar' }, { first: 'Vinod', last: 'Khanna' },
    { first: 'Waheeda', last: 'Rehman' }, { first: 'Yash', last: 'Bhatia' }, { first: 'Zara', last: 'Khan' },
    { first: 'Aditya', last: 'Varma' }, { first: 'Bhavya', last: 'Nair' }, { first: 'Chetan', last: 'Bhagat' },
    { first: 'Deepa', last: 'Menon' }, { first: 'Emran', last: 'Kazi' }, { first: 'Faisal', last: 'Ahmed' },
    { first: 'Gauri', last: 'Deshpande' }, { first: 'Harsh', last: 'Vardhan' }, { first: 'Ila', last: 'Arora' },
    { first: 'Jaspreet', last: 'Singh' }, { first: 'Kunal', last: 'Roy' }, { first: 'Leela', last: 'Rao' },
    { first: 'Mohan', last: 'Lal' }, { first: 'Nisha', last: 'Patel' }, { first: 'Omar', last: 'Sheikh' },
    { first: 'Pooja', last: 'Bhat' }, { first: 'Qutub', last: 'Khan' }, { first: 'Rahul', last: 'Sharma' },
    { first: 'Sahil', last: 'Kapoor' }, { first: 'Tanya', last: 'Jain' }, { first: 'Umar', last: 'Farooque' },
    { first: 'Vikram', last: 'Bhatnagar' }, { first: 'Wahid', last: 'Ali' }, { first: 'Yuvraj', last: 'Singh' },
    { first: 'Zoya', last: 'Akhtar' }, { first: 'Aarav', last: 'Patil' }, { first: 'Bela', last: 'Shah' },
  ];

  const employeeUsers = [];
  for (let i = 0; i < EMPLOYEE_NAMES.length; i++) {
    const name = EMPLOYEE_NAMES[i];
    const email = `${name.first.toLowerCase()}.${name.last.toLowerCase()}@3boxeshrms.com`;
    employeeUsers.push(
      await prisma.user.create({ data: { email, password: pwHash, name: `${name.first} ${name.last}`, role: 'employee', status: 'active', tenantId: tenant.id } })
    );
  }
  console.log(`  ✓ Created ${2 + 3 + 6 + EMPLOYEE_NAMES.length} users across all roles (${EMPLOYEE_NAMES.length} regular employees)`);

  // ── 13. EMPLOYEES ──
  console.log('\n📋 Creating Employees...');

  // HR Admin employees
  const hrAdminEmps = await Promise.all(hrAdminUsers.map((user, i) => {
    const company = [tcg, mpi, hfs][i];
    const companyDepts = allDepts.filter(d => d.companyId === company.id);
    const hrDept = companyDepts.find(d => d.name === 'Human Resources') || companyDepts[0];
    const companyDesgs = allDesgs.filter(d => companyDepts.some(cd => cd.id === d.departmentId));
    const mgrDesg = companyDesgs.find(d => d.title === 'Senior Manager') || companyDesgs[0];
    const companyBranches = branches.filter(b => b.companyId === company.id);
    const names = ['Anitha Reddy', 'Suresh Iyer', 'Deepa Nair'];
    const nameParts = names[i].split(' ');

    return prisma.employee.create({
      data: {
        employeeId: `EMP-${company.code}-HR001`,
        firstName: nameParts[0], lastName: nameParts[1] || '',
        email: user.email, phone: `+91-9876${String(500 + i).padStart(4, '0')}`,
        userId: user.id,
        departmentId: hrDept.id, designationId: mgrDesg.id,
        branchId: companyBranches[0].id, companyId: company.id,
        dateOfJoining: new Date('2020-03-15'), dateOfBirth: new Date('1985-06-20'),
        gender: i % 2 === 0 ? 'female' : 'male', nationality: 'Indian',
        address: `${company.city}, ${company.state}`, city: company.city, state: company.state, country: 'IN',
        bloodGroup: pick(['A+', 'B+', 'O+', 'AB+']),
        emergencyContactName: nameParts[1] ? `${nameParts[1]} Spouse` : 'Emergency Contact',
        emergencyContactPhone: `+91-9876${String(6000 + i).padStart(4, '0')}`,
        bankName: pick(['HDFC Bank', 'ICICI Bank', 'SBI', 'Axis Bank']),
        bankAccountNo: `100${String(10000000 + i).padStart(8, '0')}`,
        bankIfscCode: pick(['HDFC0001234', 'ICIC0005678', 'SBIN0009012', 'UTIB0003456']),
        panNumber: `${String.fromCharCode(65 + i)}BCDE${1000 + i}F`,
        aadhaarNumber: `${String(1000 + i)} 2345 6789`,
        status: 'active',
        salary: 1800000 + i * 200000,
        salaryCurrency: 'INR',
      },
    });
  }));

  // Manager employees
  const managerEmps = [];
  for (let i = 0; i < managerUsers.length; i++) {
    const company = [tcg, tcg, mpi, mpi, hfs, hfs][i];
    const companyDepts = allDepts.filter(d => d.companyId === company.id);
    const dept = companyDepts[i % companyDepts.length];
    const companyDesgs = allDesgs.filter(d => companyDepts.some(cd => cd.id === d.departmentId));
    const desg = companyDesgs.find(d => d.title === 'Manager') || companyDesgs[0];
    const companyBranches = branches.filter(b => b.companyId === company.id);
    const name = managerUsers[i].name.split(' ');

    // Managers report to the HR admin of their company
    const hrAdminEmpForCompany = hrAdminEmps[i % hrAdminEmps.length];

    const emp = await prisma.employee.create({
      data: {
        employeeId: `EMP-${company.code}-MGR${String(i + 1).padStart(3, '0')}`,
        firstName: name[0], lastName: name[1] || '',
        email: managerUsers[i].email, phone: `+91-9988${String(1000 + i).padStart(4, '0')}`,
        userId: managerUsers[i].id,
        departmentId: dept.id, designationId: desg.id,
        branchId: companyBranches[0].id, companyId: company.id,
        reportingManagerId: hrAdminEmpForCompany?.id || null,
        dateOfJoining: randDate(new Date('2019-01-01'), new Date('2022-06-30')),
        dateOfBirth: randDate(new Date('1975-01-01'), new Date('1990-12-31')),
        gender: i % 2 === 0 ? 'male' : 'female', nationality: 'Indian',
        city: company.city, state: company.state, country: 'IN',
        bloodGroup: pick(['A+', 'B+', 'O+']),
        bankName: pick(['HDFC Bank', 'ICICI Bank', 'SBI']),
        bankAccountNo: `200${String(20000000 + i).padStart(8, '0')}`,
        bankIfscCode: 'HDFC0001234',
        panNumber: `${String.fromCharCode(65 + i)}QRST${2000 + i}U`,
        aadhaarNumber: `${String(2000 + i)} 3456 7890`,
        status: 'active',
        salary: 1800000 + i * 150000,
        salaryCurrency: 'INR',
      },
    });
    managerEmps.push(emp);
  }

  // Regular employees (75 across 3 companies — 25 per company)
  // Each regular employee reports to a manager in their company
  const regularEmps = [];
  for (let i = 0; i < EMPLOYEE_NAMES.length; i++) {
    const name = EMPLOYEE_NAMES[i];
    const companyIdx = i % 3;
    const company = [tcg, mpi, hfs][companyIdx];
    const companyDepts = allDepts.filter(d => d.companyId === company.id);
    const dept = companyDepts[i % companyDepts.length];
    const companyDesgs = allDesgs.filter(d => companyDepts.some(cd => cd.id === d.departmentId));
    const desg = companyDesgs[Math.min(Math.floor(i / 5), companyDesgs.length - 1)];
    const companyBranches = branches.filter(b => b.companyId === company.id);
    const branch = companyBranches[i % companyBranches.length];

    // Assign a manager from the same company — managers are at indices [0,1] for TCG, [2,3] for MPI, [4,5] for HFS
    const companyManagerIndices = companyIdx === 0 ? [0, 1] : companyIdx === 1 ? [2, 3] : [4, 5];
    const managerIdx = companyManagerIndices[i % companyManagerIndices.length];
    const manager = managerEmps[managerIdx];

    const emp = await prisma.employee.create({
      data: {
        employeeId: `EMP-${company.code}-${String(i + 1).padStart(3, '0')}`,
        firstName: name.first, lastName: name.last,
        email: employeeUsers[i].email, phone: `+91-9000${String(1000 + i).padStart(4, '0')}`,
        userId: employeeUsers[i].id,
        departmentId: dept.id, designationId: desg.id,
        branchId: branch.id, companyId: company.id,
        reportingManagerId: manager?.id || null,
        dateOfJoining: randDate(new Date('2020-01-01'), new Date('2025-06-30')),
        dateOfBirth: randDate(new Date('1985-01-01'), new Date('2000-12-31')),
        gender: i % 3 === 0 ? 'female' : 'male', nationality: 'Indian',
        address: `${branch.address || branch.city}`, city: branch.city, state: branch.state, country: 'IN',
        bloodGroup: pick(['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-']),
        emergencyContactName: `${name.last} Family`,
        emergencyContactPhone: `+91-9111${String(1000 + i).padStart(4, '0')}`,
        bankName: pick(['HDFC Bank', 'ICICI Bank', 'SBI', 'Axis Bank', 'Kotak Mahindra', 'Yes Bank']),
        bankAccountNo: `${String(30000000 + i).padStart(12, '0')}`,
        bankIfscCode: pick(['HDFC0001234', 'ICIC0005678', 'SBIN0009012', 'UTIB0003456', 'KKBK0007890', 'YESB0001234']),
        panNumber: `${String.fromCharCode(65 + (i % 26))}${String.fromCharCode(65 + ((i + 3) % 26))}PKL${5000 + i}T`,
        aadhaarNumber: `${String(5000 + i)} 6789 0123`,
        status: i < 2 ? 'onboarding' : (i < 4 ? 'probation' : 'active'),
        salary: 500000 + i * 50000,
        salaryCurrency: 'INR',
        maritalStatus: i % 3 === 0 ? 'married' : (i % 5 === 0 ? 'single' : undefined as any),
      },
    });
    regularEmps.push(emp);
  }

  // Super admin employee
  const superAdminEmp = await prisma.employee.create({
    data: {
      employeeId: 'EMP-SYS-SUP001', firstName: 'Super', lastName: 'Admin',
      email: superAdminUser.email, phone: '+91-9999-000001',
      userId: superAdminUser.id,
      departmentId: allDepts[0].id, designationId: allDesgs[0].id,
      branchId: branches[0].id, companyId: tcg.id,
      dateOfJoining: new Date('2020-01-01'), dateOfBirth: new Date('1980-01-01'),
      gender: 'male', nationality: 'Indian', city: 'Hyderabad', state: 'TG', country: 'IN',
      status: 'active', salary: 5000000, salaryCurrency: 'INR',
    },
  });

  // Tenant admin employee
  const tenantAdminEmp = await prisma.employee.create({
    data: {
      employeeId: 'EMP-SYS-TNT001', firstName: 'Tenant', lastName: 'Admin',
      email: tenantAdminUser.email, phone: '+91-9999-000002',
      userId: tenantAdminUser.id,
      departmentId: allDepts[0].id, designationId: allDesgs[1].id,
      branchId: branches[0].id, companyId: tcg.id,
      dateOfJoining: new Date('2020-06-01'), dateOfBirth: new Date('1982-05-15'),
      gender: 'female', nationality: 'Indian', city: 'Hyderabad', state: 'TG', country: 'IN',
      status: 'active', salary: 4000000, salaryCurrency: 'INR',
    },
  });

  const allEmployees = [superAdminEmp, tenantAdminEmp, ...hrAdminEmps, ...managerEmps, ...regularEmps];
  console.log(`  ✓ Created ${allEmployees.length} employees across all roles and companies`);

  // ── 14. EMPLOYEE COMPANY MAPPINGS ──
  console.log('\n📋 Creating Employee Company Mappings...');
  let mappingsCount = 0;
  // Every employee gets a primary mapping to their company
  for (const emp of allEmployees) {
    if (emp.companyId) {
      await prisma.employeeCompanyMapping.create({
        data: {
          employeeId: emp.id, companyId: emp.companyId,
          employeeCode: emp.employeeId,
          departmentId: emp.departmentId, designationId: emp.designationId,
          branchId: emp.branchId, isPrimary: true, status: 'active',
        },
      });
      mappingsCount++;
    }
  }

  // Some employees are cross-mapped to other companies (multi-company scenario)
  const crossMapPairs = [
    { empIdx: 3, targetCompany: mpi }, // Manager 1 also works with MPI
    { empIdx: 5, targetCompany: hfs }, // Manager 3 also works with HFS
    { empIdx: 8, targetCompany: tcg }, // Employee 5 also works with TCG
    { empIdx: 15, targetCompany: hfs }, // Employee 12 also works with HFS
    { empIdx: 20, targetCompany: mpi }, // Employee 17 also works with MPI
  ];

  for (const pair of crossMapPairs) {
    const emp = allEmployees[pair.empIdx];
    if (emp && emp.companyId !== pair.targetCompany.id) {
      const targetDepts = allDepts.filter(d => d.companyId === pair.targetCompany.id);
      const targetDesgs = allDesgs.filter(d => targetDepts.some(td => td.id === d.departmentId));
      await prisma.employeeCompanyMapping.create({
        data: {
          employeeId: emp.id, companyId: pair.targetCompany.id,
          employeeCode: `EMP-${pair.targetCompany.code}-X${String(pair.empIdx).padStart(3, '0')}`,
          departmentId: pick(targetDepts).id, designationId: pick(targetDesgs).id,
          isPrimary: false, status: 'active',
        },
      });
      mappingsCount++;
    }
  }
  console.log(`  ✓ Created ${mappingsCount} company mappings (including ${crossMapPairs.length} cross-company)`);

  // ── 15. DEPENDENTS ──
  console.log('\n📋 Creating Dependents...');
  let dependentsCount = 0;
  for (const emp of allEmployees.slice(0, 20)) { // First 20 employees have dependents
    const numDependents = randInt(1, 3);
    for (let d = 0; d < numDependents; d++) {
      const relation = pick(['spouse', 'son', 'daughter', 'father', 'mother']);
      await prisma.dependent.create({
        data: {
          employeeId: emp.id,
          name: relation === 'spouse'
            ? `${emp.gender === 'female' ? 'Mr.' : 'Ms.'} ${emp.lastName}`
            : `${pick(['Aarav', 'Aditi', 'Vihaan', 'Saanvi', 'Arjun', 'Ananya'])} ${emp.lastName}`,
          relation,
          dateOfBirth: randDate(new Date('1960-01-01'), new Date('2020-12-31')),
          gender: relation === 'spouse' ? (emp.gender === 'female' ? 'male' : 'female') : pick(['male', 'female']),
        },
      });
      dependentsCount++;
    }
  }
  console.log(`  ✓ Created ${dependentsCount} dependents`);

  // ── 16. QUALIFICATIONS ──
  console.log('\n📋 Creating Qualifications...');
  const QUAL_DATA = [
    { degree: 'B.Tech Computer Science', institution: 'IIT Hyderabad', year: 2018, percentage: 85.5 },
    { degree: 'M.Tech Software Engineering', institution: 'IIIT Bangalore', year: 2020, percentage: 88.2 },
    { degree: 'MBA Finance', institution: 'IIM Ahmedabad', year: 2019, percentage: 82.0 },
    { degree: 'B.Com Honours', institution: 'Delhi University', year: 2017, percentage: 78.5 },
    { degree: 'M.Sc Statistics', institution: 'ISI Kolkata', year: 2021, percentage: 90.0 },
    { degree: 'B.Pharmacy', institution: 'JSS College of Pharmacy', year: 2016, percentage: 76.0 },
    { degree: 'MBBS', institution: 'CMC Vellore', year: 2015, percentage: 92.0 },
    { degree: 'CA (Chartered Accountant)', institution: 'ICAI', year: 2020, percentage: 70.5 },
  ];

  let qualsCount = 0;
  for (const emp of allEmployees) {
    const numQuals = randInt(1, 3);
    for (let q = 0; q < numQuals; q++) {
      const qual = QUAL_DATA[(qualsCount) % QUAL_DATA.length];
      await prisma.qualification.create({
        data: {
          employeeId: emp.id, degree: qual.degree,
          institution: qual.institution, year: qual.year,
          percentage: qual.percentage,
        },
      });
      qualsCount++;
    }
  }
  console.log(`  ✓ Created ${qualsCount} qualifications`);

  // ── 17. EXPERIENCES ──
  console.log('\n📋 Creating Experiences...');
  const COMPANIES_EXP = ['TCS', 'Infosys', 'Wipro', 'Cognizant', 'HCL Tech', 'Tech Mahindra', 'Capgemini', 'Deloitte', 'Accenture', 'Amazon India'];
  let expCount = 0;
  for (const emp of allEmployees) {
    const numExp = randInt(1, 3);
    let prevDate = new Date(emp.dateOfJoining);
    for (let e = 0; e < numExp; e++) {
      const startDate = new Date(prevDate.getFullYear() - randInt(1, 3), prevDate.getMonth(), 1);
      const endDate = new Date(prevDate.getFullYear(), prevDate.getMonth(), prevDate.getDate() - 1);
      if (startDate.getFullYear() < 2010) continue;

      await prisma.experience.create({
        data: {
          employeeId: emp.id,
          company: pick(COMPANIES_EXP),
          designation: pick(['Software Engineer', 'Senior Engineer', 'Team Lead', 'Analyst', 'Consultant', 'Associate Manager']),
          startDate, endDate,
          description: `Worked on enterprise projects, delivering quality solutions.`,
        },
      });
      prevDate = startDate;
      expCount++;
    }
  }
  console.log(`  ✓ Created ${expCount} experiences`);

  // ── 18. EMPLOYEE SKILLS ──
  console.log('\n📋 Creating Employee Skills...');
  const SKILLS = ['React', 'Node.js', 'Python', 'Java', 'AWS', 'Azure', 'Docker', 'Kubernetes', 'SQL', 'MongoDB', 'TypeScript', 'GraphQL', 'SAP', 'Tableau', 'Power BI', 'DevOps', 'CI/CD', 'Machine Learning', 'Data Analysis', 'Project Management', 'Agile', 'Scrum', 'Leadership', 'Communication', 'Problem Solving'];
  let skillsCount = 0;
  for (const emp of allEmployees) {
    const numSkills = randInt(3, 8);
    const empSkills = [...SKILLS].sort(() => Math.random() - 0.5).slice(0, numSkills);
    for (const skill of empSkills) {
      try {
        await prisma.employeeSkill.create({
          data: {
            employeeId: emp.id,
            skill,
            level: pick(['beginner', 'intermediate', 'advanced', 'expert']),
            yearsOfExp: randInt(1, 10),
          },
        });
        skillsCount++;
      } catch { /* skip if model doesn't exist */ }
    }
  }
  console.log(`  ✓ Created ${skillsCount} employee skills`);

  // ── 19. LEAVE BALANCES ──
  console.log('\n📋 Creating Leave Balances...');
  const currentYear = new Date().getFullYear();
  let leaveBalCount = 0;
  for (const emp of allEmployees) {
    const empLeaveTypes = leaveTypes.filter((lt) => lt.companyId === emp.companyId);
    for (const lt of empLeaveTypes) {
      if (lt.code === 'ML' && emp.gender !== 'female') continue; // Maternity only for females
      if (lt.code === 'PL' && emp.gender === 'female') continue; // Paternity skip for females (simplified)
      const total = lt.defaultDays;
      const used = randInt(0, Math.min(total, 8));
      await prisma.leaveBalance.create({
        data: {
          employeeId: emp.id, leaveTypeId: lt.id, year: currentYear,
          total, used, remaining: total - used,
          carryForward: lt.carryForward ? randInt(0, lt.maxCarryForward || 0) : 0,
        },
      });
      leaveBalCount++;
    }
  }
  console.log(`  ✓ Created ${leaveBalCount} leave balances`);

  // ── 20. LEAVE REQUESTS ──
  console.log('\n📋 Creating Leave Requests...');
  const LEAVE_STATUSES = ['pending', 'approved', 'approved', 'approved', 'rejected'];
  let leaveReqCount = 0;
  for (const emp of allEmployees.slice(3, 25)) { // 22 employees with leave requests
    const numReqs = randInt(1, 4);
    for (let r = 0; r < numReqs; r++) {
      const empLeaveTypes = leaveTypes.filter((l) => l.companyId === emp.companyId && l.code !== 'ML' && l.code !== 'PL');
      const lt = pick(empLeaveTypes);
      const startDate = randDate(new Date('2026-01-01'), new Date('2026-07-15'));
      const numDays = randInt(1, 5);
      const endDate = new Date(startDate.getTime() + numDays * 86400000);
      await prisma.leaveRequest.create({
        data: {
          employeeId: emp.id, leaveTypeId: lt.id,
          startDate, endDate,
          reason: pick(['Personal work', 'Family function', 'Health checkup', 'Travel', 'Festival', 'Rest day', 'Home maintenance']),
          status: pick(LEAVE_STATUSES),
          approvedBy: pick(managerEmps).id,
        },
      });
      leaveReqCount++;
    }
  }
  console.log(`  ✓ Created ${leaveReqCount} leave requests`);

  // ── 21. ATTENDANCE ──
  console.log('\n📋 Creating Attendance records...');
  let attendanceCount = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Create attendance for last 30 days for all employees
  for (const emp of allEmployees) {
    for (let d = 30; d >= 0; d--) {
      const date = new Date(today.getTime() - d * 86400000);
      // Skip weekends (Saturday=6, Sunday=0)
      if (date.getDay() === 0 || date.getDay() === 6) continue;
      // Random absence
      if (Math.random() < 0.05) continue;

      const isLate = Math.random() < 0.1;
      const checkInHour = isLate ? 9 + Math.floor(Math.random() * 2) + Math.random() * 0.5 : 8 + Math.floor(Math.random() * 1) + Math.random() * 0.5;
      const workHours = 8 + Math.random() * 2;
      const checkIn = new Date(date.getTime() + checkInHour * 3600000);
      const checkOut = new Date(checkIn.getTime() + workHours * 3600000);

      await prisma.attendance.create({
        data: {
          employeeId: emp.id, date,
          checkIn, checkOut,
          workHours: parseFloat(workHours.toFixed(2)),
          status: isLate ? 'late' : 'present',
        },
      });
      attendanceCount++;
    }
  }
  console.log(`  ✓ Created ${attendanceCount} attendance records (30 days × employees)`);

  // ── 22. JOB POSTINGS ──
  console.log('\n📋 Creating Job Postings...');
  const JOB_DATA = [
    { title: 'Senior Full-Stack Developer', position: 'Senior Full-Stack Developer', location: 'Hyderabad, India', type: 'full-time', experience: '5-8 years', salary: '₹18,00,000 - ₹25,00,000', vacancies: 2 },
    { title: 'UX Research Lead', position: 'UX Research Lead', location: 'Mumbai, India', type: 'full-time', experience: '6-9 years', salary: '₹15,00,000 - ₹22,00,000', vacancies: 1 },
    { title: 'Data Scientist', position: 'Data Scientist', location: 'Bengaluru, India', type: 'full-time', experience: '3-5 years', salary: '₹14,00,000 - ₹20,00,000', vacancies: 1 },
    { title: 'HR Business Partner', position: 'HR Business Partner', location: 'Hyderabad, India', type: 'full-time', experience: '7-10 years', salary: '₹12,00,000 - ₹18,00,000', vacancies: 1 },
    { title: 'DevOps Engineer', position: 'DevOps Engineer', location: 'Pune, India', type: 'full-time', experience: '4-7 years', salary: '₹16,00,000 - ₹22,00,000', vacancies: 2 },
    { title: 'Quality Assurance Lead', position: 'QA Lead', location: 'Mumbai, India', type: 'full-time', experience: '5-8 years', salary: '₹12,00,000 - ₹17,00,000', vacancies: 1 },
    { title: 'Financial Analyst', position: 'Financial Analyst', location: 'Bengaluru, India', type: 'full-time', experience: '3-5 years', salary: '₹8,00,000 - ₹14,00,000', vacancies: 2 },
    { title: 'Production Manager', position: 'Production Manager', location: 'Pune, India', type: 'full-time', experience: '8-12 years', salary: '₹20,00,000 - ₹30,00,000', vacancies: 1 },
    { title: 'Marketing Specialist', position: 'Marketing Specialist', location: 'Hyderabad, India', type: 'full-time', experience: '2-4 years', salary: '₹6,00,000 - ₹10,00,000', vacancies: 1 },
    { title: 'Clinical Research Coordinator', position: 'Clinical Research Coordinator', location: 'Chennai, India', type: 'full-time', experience: '3-6 years', salary: '₹9,00,000 - ₹15,00,000', vacancies: 1 },
    { title: 'Sales Executive', position: 'Sales Executive', location: 'Mumbai, India', type: 'full-time', experience: '2-5 years', salary: '₹7,00,000 - ₹12,00,000', vacancies: 3 },
    { title: 'Intern - Software Development', position: 'Software Dev Intern', location: 'Hyderabad, India', type: 'internship', experience: '0-1 years', salary: '₹15,000 - ₹25,000/month', vacancies: 5 },
  ];

  const jobPostings = [];
  for (let i = 0; i < JOB_DATA.length; i++) {
    const j = JOB_DATA[i];
    const company = [tcg, tcg, tcg, tcg, mpi, mpi, mpi, mpi, hfs, hfs, hfs, tcg][i];
    const companyDepts = allDepts.filter(d => d.companyId === company.id);
    const dept = companyDepts[i % companyDepts.length];

    const job = await prisma.jobPosting.create({
      data: {
        title: j.title, position: j.position, location: j.location,
        type: j.type, experience: j.experience, salary: j.salary,
        departmentId: dept.id,
        description: `We are looking for a ${j.position.toLowerCase()} to join our team. This is an exciting opportunity to work on cutting-edge projects in a collaborative environment.`,
        requirements: `${j.experience} experience, strong technical skills, good communication, team player`,
        status: i < 9 ? 'open' : (i < 10 ? 'filled' : 'closed'),
        postedDate: randDate(new Date('2026-01-01'), new Date('2026-06-30')),
        closingDate: new Date('2026-09-30'),
        vacancies: j.vacancies,
      },
    });
    jobPostings.push(job);
  }
  console.log(`  ✓ Created ${jobPostings.length} job postings`);

  // ── 23. JOB APPLICATIONS ──
  console.log('\n📋 Creating Job Applications...');
  const CANDIDATE_NAMES = [
    'Arun Kumar', 'Bhavana Rao', 'Chetan Bhagat', 'Divya Bharathi', 'Ezhil Arasan',
    'Farah Khan', 'Gopal Subramaniam', 'Hema Malini', 'Indira Gandhi', 'Jawahar Nehru',
    'Kamal Hassan', 'Latha Rajinikanth', 'Mohan Lal', 'Nagma Shetty', 'Omar Abdullah',
    'Priyanka Chopra', 'Quadir Ahmed', 'Rashmika Mandanna', 'Samantha Ruth', 'Tarun Kumar',
    'Uttara Baokar', 'Vijay Sethupathi', 'Waheeda Rehman', 'Xavier D\u2019Souza', 'Yash Raj',
  ];

  const APPLICATION_STATUSES = ['applied', 'screening', 'interview', 'interview', 'offered', 'hired', 'rejected'];
  let appCount = 0;
  const jobApplications = [];

  for (const job of jobPostings) {
    const numApps = randInt(3, 7);
    for (let a = 0; a < numApps; a++) {
      const candName = CANDIDATE_NAMES[appCount % CANDIDATE_NAMES.length];
      const email = `${candName.toLowerCase().replace(/[^a-z]/g, '')}${randInt(10, 99)}@gmail.com`;
      const status = pick(APPLICATION_STATUSES);

      const app = await prisma.jobApplication.create({
        data: {
          jobPostingId: job.id, candidateName: candName,
          candidateEmail: email, candidatePhone: `+91-${randInt(7000000000, 9999999999)}`,
          source: pick(['linkedin', 'referral', 'website', 'indeed', 'naukri', 'internal']),
          status, appliedDate: randDate(new Date('2026-01-15'), new Date('2026-07-01')),
          rating: randInt(1, 5),
          expectedSalary: `₹${randInt(6, 25)},00,000`,
          notes: status === 'hired' ? 'Excellent candidate. Offer accepted.' : (status === 'rejected' ? 'Did not meet requirements.' : null),
        },
      });
      jobApplications.push(app);
      appCount++;
    }
  }
  console.log(`  ✓ Created ${appCount} job applications`);

  // ── 24. INTERVIEWS ──
  console.log('\n📋 Creating Interviews...');
  let interviewCount = 0;
  const interviewApps = jobApplications.filter(a => ['interview', 'offered', 'hired'].includes(a.status));

  for (const app of interviewApps) {
    const numInterviews = randInt(1, 3);
    const interviewers = [...managerEmps, ...hrAdminEmps];

    for (let i = 0; i < numInterviews; i++) {
      const type = i === 0 ? 'technical' : (i === 1 ? 'hr' : 'final');
      await prisma.interview.create({
        data: {
          jobApplicationId: app.id, type,
          date: randDate(new Date('2026-02-01'), new Date('2026-07-15')),
          time: pick(['9:00 AM', '10:00 AM', '11:00 AM', '2:00 PM', '3:00 PM', '4:00 PM']),
          duration: pick([30, 45, 60, 90]),
          location: 'Online',
          meetingUrl: `https://meet.3boxeshrms.com/interview-${interviewCount + 1}`,
          interviewer: pick(interviewers).id,
          status: app.status === 'hired' ? 'completed' : (app.status === 'offered' ? 'completed' : pick(['scheduled', 'completed'])),
          feedback: app.status === 'hired' || app.status === 'offered'
            ? pick(['Strong candidate, recommended for offer.', 'Excellent technical skills and culture fit.', 'Good communication and problem-solving ability.'])
            : null,
          score: app.status === 'hired' || app.status === 'offered' ? randInt(75, 98) : null,
          aiScore: app.status === 'hired' || app.status === 'offered' ? randInt(78, 99) : null,
          aiFeedback: app.status === 'hired' || app.status === 'offered'
            ? pick([
              'Candidate demonstrated strong technical proficiency. Communication rated 8/10. Recommended for next stage.',
              'Good problem-solving approach. System design skills are solid. Culture fit assessment: positive.',
              'Expert-level knowledge in domain. Leadership potential identified. Proceed to offer stage.',
            ])
            : null,
        },
      });
      interviewCount++;
    }
  }
  console.log(`  ✓ Created ${interviewCount} interviews`);

  // ── 25. PROJECTS ──
  console.log('\n📋 Creating Projects...');
  const PROJECT_DATA = [
    { name: 'HRMS Portal Redesign', code: 'PRJ-HRMS-001', projectType: 'internal', budgetAmount: 2500000, startDate: new Date('2026-01-15'), endDate: new Date('2026-06-30'), status: 'active', progress: 65, clientId: null, companyId: tcg.id, description: 'Priority: high' },
    { name: 'Manufacturing IoT Dashboard', code: 'PRJ-IOT-001', projectType: 'client', budgetAmount: 4500000, startDate: new Date('2026-02-01'), endDate: new Date('2026-08-31'), status: 'active', progress: 40, clientId: null, companyId: mpi.id, description: 'Priority: critical' },
    { name: 'Patient Management System', code: 'PRJ-PMS-001', projectType: 'client', budgetAmount: 3500000, startDate: new Date('2026-03-01'), endDate: new Date('2026-09-30'), status: 'active', progress: 30, clientId: null, companyId: hfs.id, description: 'Priority: high' },
    { name: 'Employee Self-Service App', code: 'PRJ-ESS-001', projectType: 'internal', budgetAmount: 1200000, startDate: new Date('2026-04-01'), endDate: new Date('2026-07-31'), status: 'active', progress: 55, clientId: null, companyId: tcg.id, description: 'Priority: medium' },
    { name: 'Supply Chain Analytics', code: 'PRJ-SCA-001', projectType: 'internal', budgetAmount: 1800000, startDate: new Date('2026-05-01'), endDate: new Date('2026-10-31'), status: 'draft', progress: 10, clientId: null, companyId: mpi.id, description: 'Priority: medium' },
    { name: 'Telemedicine Platform', code: 'PRJ-TEL-001', projectType: 'client', budgetAmount: 5500000, startDate: new Date('2026-06-01'), endDate: new Date('2026-12-31'), status: 'draft', progress: 5, clientId: null, companyId: hfs.id, description: 'Priority: high' },
    { name: 'AI Chatbot Integration', code: 'PRJ-AI-001', projectType: 'internal', budgetAmount: 900000, startDate: new Date('2026-01-01'), endDate: new Date('2026-04-30'), status: 'completed', progress: 100, clientId: null, companyId: tcg.id, description: 'Priority: high' },
    { name: 'Quality Control Automation', code: 'PRJ-QC-001', projectType: 'internal', budgetAmount: 2000000, startDate: new Date('2026-03-15'), endDate: new Date('2026-08-15'), status: 'active', progress: 50, clientId: null, companyId: mpi.id, description: 'Priority: medium' },
  ];

  const projects = [];
  for (const p of PROJECT_DATA) {
    const project = await prisma.project.create({ data: p });
    projects.push(project);
  }
  console.log(`  ✓ Created ${projects.length} projects`);

  // ── 26. PROJECT MEMBERS ──
  console.log('\n📋 Creating Project Members...');
  let pmCount = 0;
  for (const project of projects) {
    const companyEmps = allEmployees.filter(e => e.companyId === project.companyId);
    const numMembers = Math.min(randInt(4, 8), companyEmps.length);
    const selectedEmps = [...companyEmps].sort(() => Math.random() - 0.5).slice(0, numMembers);

    for (let i = 0; i < selectedEmps.length; i++) {
      await prisma.projectMember.create({
        data: {
          projectId: project.id, employeeId: selectedEmps[i].id,
          role: i === 0 ? 'manager' : 'member',
        },
      });
      pmCount++;
    }
  }
  console.log(`  ✓ Created ${pmCount} project members`);

  // ── 27. PROJECT TASKS ──
  console.log('\n📋 Creating Project Tasks...');
  const TASK_NAMES = [
    'Requirement Analysis', 'System Design', 'Database Schema Design', 'API Development',
    'Frontend Development', 'Unit Testing', 'Integration Testing', 'UAT',
    'Performance Optimization', 'Security Audit', 'Documentation', 'Deployment',
    'Code Review', 'Bug Fixes', 'Sprint Demo', 'Release Preparation',
  ];
  let taskCount = 0;
  for (const project of projects) {
    const numTasks = randInt(5, 12);
    const companyEmps = allEmployees.filter(e => e.companyId === project.companyId);
    for (let t = 0; t < numTasks; t++) {
      const projectMembers = await prisma.projectMember.findMany({ where: { projectId: project.id } });
      const assignee = projectMembers.length > 0 ? pick(projectMembers).employeeId : null;

      await prisma.projectTask.create({
        data: {
          projectId: project.id, name: TASK_NAMES[t % TASK_NAMES.length],
          description: `${TASK_NAMES[t % TASK_NAMES.length]} for ${project.name}`,
          status: t < numTasks * 0.3 ? 'done' : (t < numTasks * 0.7 ? 'in_progress' : 'todo'),
          priority: pick(['low', 'medium', 'high', 'critical']),
          assignedToId: assignee,
          plannedEnd: randDate(new Date('2026-01-15'), new Date('2026-12-31')),
          estimatedHours: randInt(8, 80),
          actualHours: randInt(0, 60),
        },
      });
      taskCount++;
    }
  }
  console.log(`  ✓ Created ${taskCount} project tasks`);

  // ── 28. PROJECT MILESTONES ──
  console.log('\n📋 Creating Project Milestones...');
  const MILESTONE_NAMES = ['Kickoff', 'Design Approval', 'Alpha Release', 'Beta Release', 'UAT Start', 'Go Live', 'Post-Launch Review'];
  let milestoneCount = 0;
  for (const project of projects) {
    const numMilestones = randInt(3, 6);
    for (let m = 0; m < numMilestones; m++) {
      await prisma.projectMilestone.create({
        data: {
          projectId: project.id, name: MILESTONE_NAMES[m % MILESTONE_NAMES.length],
          plannedDate: randDate(project.startDate, project.endDate || project.startDate),
          completionPct: m < numMilestones * 0.4 ? 100 : (m < numMilestones * 0.7 ? 50 : 0),
        },
      });
      milestoneCount++;
    }
  }
  console.log(`  ✓ Created ${milestoneCount} project milestones`);

  // ── 29. CLIENTS ──
  console.log('\n📋 Creating Clients...');
  const CLIENT_DATA = [
    { name: 'Infosys Technologies', industry: 'IT Services', email: 'partner@infosys.com', phone: '+91-80-2852-0261', city: 'Bengaluru', state: 'KA', country: 'IN', companyId: tcg.id },
    { name: 'Reliance Industries', industry: 'Conglomerate', email: 'hr@reliance.com', phone: '+91-22-3555-5000', city: 'Mumbai', state: 'MH', country: 'IN', companyId: mpi.id },
    { name: 'Apollo Hospitals', industry: 'Healthcare', email: 'corporate@apollo.com', phone: '+91-44-2829-0202', city: 'Chennai', state: 'TN', country: 'IN', companyId: hfs.id },
    { name: 'Tata Consultancy Services', industry: 'IT Services', email: 'partner@tcs.com', phone: '+91-22-6778-9999', city: 'Mumbai', state: 'MH', country: 'IN', companyId: tcg.id },
    { name: 'Mahindra & Mahindra', industry: 'Automotive', email: 'procurement@mahindra.com', phone: '+91-22-2490-1234', city: 'Mumbai', state: 'MH', country: 'IN', companyId: mpi.id },
    { name: 'Biocon Limited', industry: 'Biotech', email: 'bd@biocon.com', phone: '+91-80-2808-2808', city: 'Bengaluru', state: 'KA', country: 'IN', companyId: hfs.id },
  ];

  const clients = await Promise.all(CLIENT_DATA.map(c =>
    prisma.client.create({
      data: {
        name: c.name,
        industry: c.industry,
        contactEmail: c.email,
        contactPhone: c.phone,
        city: c.city,
        state: c.state,
        country: c.country,
        companyId: c.companyId,
        status: 'active',
        website: `https://${c.name.toLowerCase().replace(/[^a-z]/g, '')}.com`,
      },
    })
  ));
  console.log(`  ✓ Created ${clients.length} clients`);

  // ── 30. VENDORS ──
  console.log('\n📋 Creating Vendors...');
  const VENDOR_DATA = [
    { name: 'Dell Technologies India', category: 'IT Hardware', email: 'sales@dell.in', phone: '+91-80-2506-8000', city: 'Bengaluru', state: 'KA', country: 'IN', companyId: tcg.id },
    { name: 'Siemens India', category: 'Industrial Equipment', email: 'supply@siemens.in', phone: '+91-22-3967-7000', city: 'Mumbai', state: 'MH', country: 'IN', companyId: mpi.id },
    { name: 'Agilent Technologies', category: 'Lab Equipment', email: 'orders@agilent.com', phone: '+91-80-4155-2000', city: 'Bengaluru', state: 'KA', country: 'IN', companyId: hfs.id },
    { name: 'AWS India', category: 'Cloud Services', email: 'enterprise@aws.in', phone: '+91-80-7100-5000', city: 'Bengaluru', state: 'KA', country: 'IN', companyId: tcg.id },
    { name: 'JCB India', category: 'Construction Equipment', email: 'parts@jcb.in', phone: '+91-124-428-6000', city: 'Pune', state: 'MH', country: 'IN', companyId: mpi.id },
  ];

  const vendors = await Promise.all(VENDOR_DATA.map(v =>
    prisma.vendor.create({
      data: {
        name: v.name,
        specialization: v.category,
        contactEmail: v.email,
        contactPhone: v.phone,
        city: v.city,
        state: v.state,
        country: v.country,
        companyId: v.companyId,
        status: 'active',
      },
    })
  ));
  console.log(`  ✓ Created ${vendors.length} vendors`);

  // ── 31. ASSETS ──
  console.log('\n📋 Creating Assets...');
  const ASSET_DATA = [
    { name: 'MacBook Pro 16"', category: 'Laptop', serialNumber: 'MBP-2024-001', value: 250000, companyId: tcg.id },
    { name: 'Dell Latitude 5540', category: 'Laptop', serialNumber: 'DLL-2024-002', value: 95000, companyId: tcg.id },
    { name: 'ThinkPad X1 Carbon', category: 'Laptop', serialNumber: 'TPD-2024-003', value: 120000, companyId: mpi.id },
    { name: 'iPhone 15 Pro', category: 'Mobile', serialNumber: 'IPH-2024-001', value: 135000, companyId: tcg.id },
    { name: 'Samsung Galaxy S24', category: 'Mobile', serialNumber: 'SMG-2024-002', value: 85000, companyId: mpi.id },
    { name: 'Dell U2723QE Monitor', category: 'Monitor', serialNumber: 'MON-2024-001', value: 55000, companyId: tcg.id },
    { name: 'LG 27UK850 Monitor', category: 'Monitor', serialNumber: 'MON-2024-002', value: 48000, companyId: hfs.id },
    { name: 'HP LaserJet Pro', category: 'Printer', serialNumber: 'PRT-2024-001', value: 35000, companyId: tcg.id },
    { name: 'Lab Microscope X500', category: 'Lab Equipment', serialNumber: 'LAB-2024-001', value: 500000, companyId: hfs.id },
    { name: 'CNC Machine Controller', category: 'Industrial', serialNumber: 'IND-2024-001', value: 1500000, companyId: mpi.id },
    { name: 'Office Desk - Standing', category: 'Furniture', serialNumber: 'FRN-2024-001', value: 25000, companyId: tcg.id },
    { name: 'Ergonomic Chair Pro', category: 'Furniture', serialNumber: 'FRN-2024-002', value: 18000, companyId: tcg.id },
    { name: 'iPad Pro 12.9"', category: 'Tablet', serialNumber: 'TAB-2024-001', value: 110000, companyId: hfs.id },
    { name: 'Projector Epson EB-X51', category: 'AV Equipment', serialNumber: 'AV-2024-001', value: 60000, companyId: mpi.id },
    { name: 'Server Rack Dell R750', category: 'Server', serialNumber: 'SRV-2024-001', value: 800000, companyId: tcg.id },
  ];

  const assets = [];
  for (const a of ASSET_DATA) {
    const asset = await prisma.asset.create({
      data: {
        name: a.name,
        assetTag: `${DEMO_ASSET_TAG_PREFIX}${a.serialNumber}`,
        category: a.category.toLowerCase(),
        serialNumber: a.serialNumber,
        purchaseCost: a.value,
        status: 'available',
        purchaseDate: randDate(new Date('2024-01-01'), new Date('2026-06-30')),
      },
    });
    assets.push({ ...asset, companyId: a.companyId });
  }

  // Assign some assets to employees
  let assetAssignCount = 0;
  for (let i = 0; i < Math.min(12, assets.length); i++) {
    const emp = allEmployees[i + 2]; // skip super admin & tenant admin
    if (emp && assets[i].companyId === emp.companyId) {
      await prisma.assetAssignment.create({
        data: {
          assetId: assets[i].id, employeeId: emp.id,
          assignedDate: randDate(new Date('2025-01-01'), new Date('2026-06-30')),
          returnDate: null, status: 'assigned',
        },
      });
      // Update asset status
      await prisma.asset.update({ where: { id: assets[i].id }, data: { status: 'assigned' } });
      assetAssignCount++;
    }
  }
  console.log(`  ✓ Created ${assets.length} assets with ${assetAssignCount} assignments`);

  // ── 32. SALARY STRUCTURES ──
  console.log('\n📋 Creating Salary Structures...');
  const SAL_STRUCTURES = [
    { name: 'Software Engineer - Standard', companyId: tcg.id, baseSalary: 1200000, hra: 480000, transport: 19200, medical: 15000, specialAllowance: 337800, pf: 144000, esi: 0, tax: 180000 },
    { name: 'Manager - Standard', companyId: tcg.id, baseSalary: 1800000, hra: 720000, transport: 19200, medical: 15000, specialAllowance: 445800, pf: 216000, esi: 0, tax: 360000 },
    { name: 'Factory Worker - Standard', companyId: mpi.id, baseSalary: 500000, hra: 200000, transport: 9600, medical: 15000, specialAllowance: 275400, pf: 60000, esi: 21250, tax: 0 },
    { name: 'Research Scientist - Standard', companyId: hfs.id, baseSalary: 1500000, hra: 600000, transport: 19200, medical: 15000, specialAllowance: 465800, pf: 180000, esi: 0, tax: 225000 },
  ];

  for (const ss of SAL_STRUCTURES) {
    const struct = await prisma.salaryStructure.create({
      data: { name: ss.name, companyId: ss.companyId, status: 'active' },
    });

    const components = [
      { name: 'Basic Salary', type: 'earning', category: 'basic', value: ss.baseSalary, calculationType: 'fixed', isTaxable: true },
      { name: 'House Rent Allowance', type: 'earning', category: 'hra', value: ss.hra, calculationType: 'fixed', isTaxable: true },
      { name: 'Transport Allowance', type: 'earning', category: 'allowance', value: ss.transport, calculationType: 'fixed', isTaxable: true },
      { name: 'Medical Allowance', type: 'earning', category: 'allowance', value: ss.medical, calculationType: 'fixed', isTaxable: true },
      { name: 'Special Allowance', type: 'earning', category: 'allowance', value: ss.specialAllowance, calculationType: 'fixed', isTaxable: true },
      { name: 'Provident Fund', type: 'deduction', category: 'pf', value: ss.pf, calculationType: 'fixed', isTaxable: false },
      { name: 'Professional Tax', type: 'deduction', category: 'tax', value: 2400, calculationType: 'fixed', isTaxable: false },
      { name: 'Income Tax (TDS)', type: 'deduction', category: 'tax', value: ss.tax, calculationType: 'fixed', isTaxable: false },
    ];

    if (ss.esi > 0) {
      components.push({ name: 'Employee State Insurance', type: 'deduction', category: 'esi', value: ss.esi, calculationType: 'fixed', isTaxable: false });
    }

    for (const comp of components) {
      await prisma.salaryComponent.create({
        data: { ...comp, salaryStructureId: struct.id },
      });
    }
  }
  console.log(`  ✓ Created ${SAL_STRUCTURES.length} salary structures with components`);

  // ── 33. PERFORMANCE REVIEWS ──
  console.log('\n📋 Creating Performance Reviews...');
  let reviewCount = 0;
  for (const emp of allEmployees.slice(3, 25)) { // Skip admins
    const reviewer = pick(managerEmps);
    await prisma.performanceReview.create({
      data: {
        employeeId: emp.id, reviewerId: reviewer.id,
        reviewCycle: 'Q1 2026',
        reviewPeriod: 'Q1 2026',
        status: pick(['pending', 'in_progress', 'completed', 'completed', 'completed']),
        rating: randInt(3, 5),
        goalsRating: randInt(3, 5),
        skillsRating: randInt(3, 5),
        behaviorRating: randInt(2, 5),
        overallRating: randInt(3, 5),
        comments: pick([
          'Consistently delivers high-quality work. Good team player.',
          'Strong technical skills. Needs to improve communication.',
          'Excellent problem solver. Takes initiative on complex tasks.',
          'Meets expectations. Room for growth in leadership areas.',
          'Outstanding contributor. Goes above and beyond regularly.',
        ]),
        strengths: pick([
          'Continue to develop domain expertise.',
          'Great progress this quarter. Keep it up!',
        ]),
        improvements: pick([
          'Should focus on cross-functional collaboration.',
          'Ready for more responsibility.',
        ]),
        reviewDate: randDate(new Date('2026-01-01'), new Date('2026-07-15')),
      },
    });
    reviewCount++;
  }
  console.log(`  ✓ Created ${reviewCount} performance reviews`);

  // ── 34. GOALS ──
  console.log('\n📋 Creating Goals...');
  let goalCount = 0;
  const GOAL_DATA = [
    { title: 'Complete AWS Certification', description: 'Obtain AWS Solutions Architect Professional certification by Q2', category: 'development', priority: 'high', progress: 65 },
    { title: 'Improve Code Quality Score', description: 'Achieve 90%+ code quality score in SonarQube', category: 'performance', priority: 'medium', progress: 40 },
    { title: 'Reduce Bug Count by 30%', description: 'Implement better testing practices to reduce production bugs', category: 'performance', priority: 'high', progress: 55 },
    { title: 'Lead Sprint Planning', description: 'Take ownership of sprint planning for 2 consecutive sprints', category: 'behavioral', priority: 'medium', progress: 80 },
    { title: 'Complete Onboarding Documentation', description: 'Create comprehensive onboarding docs for new team members', category: 'performance', priority: 'low', progress: 90 },
    { title: 'Cross-Training with QA Team', description: 'Spend 20 hours cross-training with QA to understand testing better', category: 'development', priority: 'medium', progress: 30 },
  ];

  for (const emp of allEmployees.slice(3, 22)) {
    const numGoals = randInt(2, 4);
    for (let g = 0; g < numGoals; g++) {
      const goalData = GOAL_DATA[g % GOAL_DATA.length];
      await prisma.goal.create({
        data: {
          employeeId: emp.id, title: goalData.title, description: goalData.description,
          category: goalData.category, priority: goalData.priority as any,
          startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31'),
          status: goalData.progress >= 100 ? 'completed' : (goalData.progress > 0 ? 'in_progress' : 'not_started'),
          progress: goalData.progress,
        },
      });
      goalCount++;
    }
  }
  console.log(`  ✓ Created ${goalCount} goals`);

  // ── 35. OKRs ──
  console.log('\n📋 Creating OKRs...');
  const OKR_DATA = [
    {
      objective: 'Improve Customer Satisfaction Score',
      category: 'company',
      status: 'active',
      companyId: tcg.id,
      keyResults: [
        { title: 'Increase NPS to 60', targetValue: 60, currentValue: 50, unit: 'score' },
        { title: 'Reduce support tickets by 20%', targetValue: 20, currentValue: 8, unit: '%' },
      ],
    },
    {
      objective: 'Launch Payroll Automation Module',
      category: 'project',
      status: 'active',
      projectId: projects[0]?.id,
      keyResults: [
        { title: 'Complete UAT sign-off', targetValue: 100, currentValue: 70, unit: '%' },
      ],
    },
    {
      objective: 'Reduce Employee Attrition Below 10%',
      category: 'company',
      status: 'at_risk',
      companyId: hfs.id,
      keyResults: [
        { title: 'Bring attrition rate to 10%', targetValue: 10, currentValue: 12, unit: '%' },
      ],
    },
  ];

  let okrCount = 0;
  for (const okrData of OKR_DATA) {
    const okr = await prisma.oKR.create({
      data: {
        objective: okrData.objective,
        category: okrData.category,
        status: okrData.status,
        companyId: okrData.companyId,
        projectId: okrData.projectId,
        quarter: 'Q1 2026',
        year: 2026,
        createdById: superAdminUser.id,
      },
    });
    for (const kr of okrData.keyResults) {
      await prisma.keyResult.create({
        data: {
          okrId: okr.id,
          title: kr.title,
          targetValue: kr.targetValue,
          currentValue: kr.currentValue,
          unit: kr.unit,
          status: kr.currentValue >= kr.targetValue ? 'completed' : 'in_progress',
        },
      });
    }
    okrCount++;
  }
  console.log(`  ✓ Created ${okrCount} OKRs with key results`);

  // ── 36. TRAINING / COURSES ──
  console.log('\n📋 Creating Training Courses...');
  const COURSE_DATA = [
    { title: 'React Advanced Patterns', category: 'Technical', duration: 40, mode: 'online', provider: 'Udemy Business', level: 'advanced' },
    { title: 'Leadership Essentials', category: 'Soft Skills', duration: 16, mode: 'classroom', provider: 'LinkedIn Learning', level: 'intermediate' },
    { title: 'AWS Cloud Practitioner', category: 'Technical', duration: 20, mode: 'online', provider: 'AWS Training', level: 'beginner' },
    { title: 'Agile Project Management', category: 'Process', duration: 24, mode: 'hybrid', provider: 'Scrum Alliance', level: 'intermediate' },
    { title: 'Workplace Safety - Manufacturing', category: 'Compliance', duration: 8, mode: 'classroom', provider: 'NSC India', level: 'beginner' },
    { title: 'Data Privacy & GDPR', category: 'Compliance', duration: 4, mode: 'online', provider: 'Internal', level: 'beginner' },
    { title: 'Python for Data Science', category: 'Technical', duration: 30, mode: 'online', provider: 'Coursera', level: 'intermediate' },
    { title: 'Effective Communication', category: 'Soft Skills', duration: 12, mode: 'classroom', provider: 'Dale Carnegie', level: 'beginner' },
    { title: 'First Aid & Emergency Response', category: 'Compliance', duration: 6, mode: 'classroom', provider: 'Red Cross', level: 'beginner' },
    { title: 'DevOps CI/CD Pipeline', category: 'Technical', duration: 35, mode: 'online', provider: 'Pluralsight', level: 'advanced' },
  ];

  const courses = [];
  for (const c of COURSE_DATA) {
    const mode = c.mode === 'classroom' ? 'offline' : c.mode;
    const course = await prisma.training.create({
      data: {
        title: c.title, category: c.category,
        mode, trainer: c.provider,
        status: 'ongoing',
        description: `Comprehensive training on ${c.title.toLowerCase()}. Suitable for ${c.level} level participants.`,
        startDate: new Date('2026-02-01'), endDate: new Date('2026-12-31'),
        maxParticipants: randInt(15, 50),
      },
    });
    courses.push(course);
  }
  console.log(`  ✓ Created ${courses.length} training courses`);

  // ── 37. TRAINING ENROLLMENTS ──
  console.log('\n📋 Creating Training Enrollments...');
  let enrollCount = 0;
  for (const course of courses) {
    const numEnroll = randInt(3, 8);
    const selectedEmps = [...allEmployees].sort(() => Math.random() - 0.5).slice(0, numEnroll);
    for (const emp of selectedEmps) {
      await prisma.trainingEnrollment.create({
        data: {
          trainingId: course.id, employeeId: emp.id,
          status: pick(['enrolled', 'completed', 'completed']),
          completedDate: Math.random() > 0.5 ? randDate(new Date('2026-03-01'), new Date('2026-07-15')) : null,
          feedback: pick(['Very informative!', 'Good course structure.', 'Practical examples helped.', 'Could be more interactive.']),
        },
      });
      enrollCount++;
    }
  }
  console.log(`  ✓ Created ${enrollCount} training enrollments`);

  // ── 38. TRAVEL REQUESTS ──
  console.log('\n📋 Creating Travel Requests...');
  const TRAVEL_DATA = [
    { destination: 'Mumbai, India', purpose: 'Client Meeting - TCS Project Review', type: 'domestic', estimatedCost: 25000, status: 'approved' },
    { destination: 'Bengaluru, India', purpose: 'Tech Summit 2026', type: 'domestic', estimatedCost: 15000, status: 'approved' },
    { destination: 'Singapore', purpose: 'APAC Sales Conference', type: 'international', estimatedCost: 150000, status: 'pending' },
    { destination: 'Pune, India', purpose: 'Factory Audit - Quality Review', type: 'domestic', estimatedCost: 12000, status: 'approved' },
    { destination: 'Dubai, UAE', purpose: 'Partner Summit - Middle East', type: 'international', estimatedCost: 200000, status: 'pending' },
    { destination: 'Chennai, India', purpose: 'R&D Collaboration Meeting', type: 'domestic', estimatedCost: 8000, status: 'rejected' },
  ];

  let travelCount = 0;
  for (const t of TRAVEL_DATA) {
    const emp = pick(allEmployees.slice(3, 20));
    await prisma.travelRequest.create({
      data: {
        employeeId: emp.id, destination: t.destination, purpose: t.purpose,
        estimatedCost: t.estimatedCost,
        mode: t.type === 'international' ? 'flight' : 'train',
        startDate: randDate(new Date('2026-03-01'), new Date('2026-09-30')),
        endDate: randDate(new Date('2026-03-03'), new Date('2026-10-02')),
        status: t.status, approvedBy: pick(managerEmps).id,
      },
    });
    travelCount++;
  }
  console.log(`  ✓ Created ${travelCount} travel requests`);

  // ── 39. EXPENSE CLAIMS ──
  console.log('\n📋 Creating Expense Claims...');
  const EXPENSE_DATA = [
    { category: 'Travel', description: 'Flight to Mumbai for client meeting', amount: 8500, status: 'approved' },
    { category: 'Meals', description: 'Team lunch during sprint review', amount: 3200, status: 'approved' },
    { category: 'Software', description: 'JetBrains IDE annual subscription', amount: 15000, status: 'pending' },
    { category: 'Training', description: 'AWS Certification exam fee', amount: 22000, status: 'approved' },
    { category: 'Internet', description: 'Monthly broadband reimbursement', amount: 1500, status: 'approved' },
    { category: 'Office Supplies', description: 'Monitor stand and keyboard', amount: 4500, status: 'pending' },
    { category: 'Travel', description: 'Hotel stay in Bengaluru', amount: 6000, status: 'rejected' },
    { category: 'Phone', description: 'Mobile phone bill reimbursement', amount: 800, status: 'approved' },
    { category: 'Books', description: 'Technical books for team library', amount: 2500, status: 'pending' },
    { category: 'Equipment', description: 'External SSD for project work', amount: 7500, status: 'approved' },
  ];

  let expenseCount = 0;
  for (const e of EXPENSE_DATA) {
    const emp = pick(allEmployees.slice(3, 25));
    await prisma.expenseClaim.create({
      data: {
        employeeId: emp.id, title: e.description, category: e.category.toLowerCase(),
        description: e.description,
        amount: e.amount, date: randDate(new Date('2026-01-01'), new Date('2026-07-15')),
        status: e.status,
        approvedBy: e.status === 'approved' ? pick(managerEmps).id : null,
      },
    });
    expenseCount++;
  }
  console.log(`  ✓ Created ${expenseCount} expense claims`);

  // ── 40. TIMESHEETS ──
  console.log('\n📋 Creating Timesheets...');
  let timesheetCount = 0;
  for (const emp of allEmployees.slice(3, 20)) {
    // Create timesheets for the last 4 weeks (Mon–Fri)
    for (let w = 0; w < 4; w++) {
      const weekStart = new Date(today.getTime() - (w + 1) * 7 * 86400000);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1); // Monday

      for (let d = 0; d < 5; d++) {
        const date = new Date(weekStart.getTime() + d * 86400000);
        await prisma.timesheet.create({
          data: {
            employeeId: emp.id,
            date,
            hours: randInt(6, 9),
            status: w === 0 ? 'submitted' : 'approved',
            approvedBy: w > 0 ? pick(managerEmps).id : null,
            projectId: pick(projects).id,
          },
        });
        timesheetCount++;
      }
    }
  }
  console.log(`  ✓ Created ${timesheetCount} timesheets`);

  // ── 41. HELPDESK TICKETS ──
  console.log('\n📋 Creating Helpdesk Tickets...');
  const TICKET_DATA = [
    { subject: 'VPN Connection Issue', category: 'IT Support', priority: 'high', description: 'Unable to connect to VPN since morning. Getting error code 691.' },
    { subject: 'Email Not Syncing', category: 'IT Support', priority: 'medium', description: 'Outlook emails not syncing on mobile device since yesterday.' },
    { subject: 'New Laptop Request', category: 'Hardware', priority: 'low', description: 'Current laptop is 4 years old and running slow. Requesting upgrade.' },
    { subject: 'Payroll Discrepancy', category: 'HR', priority: 'high', description: 'HRA component missing in this month\'s salary slip.' },
    { subject: 'Access Request - JIRA', category: 'IT Support', priority: 'medium', description: 'Need access to JIRA project PROJ-001 for upcoming sprint.' },
    { subject: 'Cabin AC Not Working', category: 'Facilities', priority: 'medium', description: 'AC in Cabin 204 not cooling properly since last week.' },
    { subject: 'Policy Document Query', category: 'HR', priority: 'low', description: 'Need clarification on the new remote work policy.' },
    { subject: 'Printer Paper Jam', category: 'Hardware', priority: 'low', description: '3rd floor HP printer has paper jam. Need maintenance.' },
    { subject: 'Leave Balance Incorrect', category: 'HR', priority: 'high', description: 'Sick leave balance showing 0 but I haven\'t used any SL this year.' },
    { subject: 'Software License Renewal', category: 'IT Support', priority: 'medium', description: 'Adobe Creative Cloud license expiring next week. Need renewal.' },
    { subject: 'Badge Access Issue', category: 'Security', priority: 'high', description: 'Access badge not working at main entrance after hours.' },
    { subject: 'Reimbursement Delay', category: 'Finance', priority: 'medium', description: 'Travel reimbursement from last month still not processed.' },
  ];

  let ticketCount = 0;
  for (const t of TICKET_DATA) {
    const emp = pick(allEmployees.slice(3, 25));
    const assignee = pick([...managerEmps, ...hrAdminEmps]);
    ticketCount++;
    await prisma.ticket.create({
      data: {
        ticketId: `TKT-DEMO-${String(ticketCount).padStart(4, '0')}`,
        requesterId: emp.id,
        requesterName: `${emp.firstName} ${emp.lastName}`,
        subject: t.subject,
        description: t.description,
        priority: t.priority,
        status: pick(['open', 'in_progress', 'resolved', 'closed', 'closed']),
        assignedAgentId: assignee.id,
        assignedAgentName: `${assignee.firstName} ${assignee.lastName}`,
      },
    });
  }
  console.log(`  ✓ Created ${ticketCount} helpdesk tickets`);

  // ── 42. POLICIES ──
  console.log('\n📋 Creating Policies...');
  const POLICY_DATA = [
    { title: 'Remote Work Policy', content: 'Employees are allowed to work remotely up to 3 days per week with manager approval. Remote work requests must be submitted 24 hours in advance.', category: 'workplace' },
    { title: 'Leave Policy', content: 'All employees are entitled to casual leave, sick leave, and earned leave as per company policy. Leave must be applied through the HRMS portal.', category: 'leave' },
    { title: 'Code of Conduct', content: 'All employees must adhere to professional standards of behavior, respect colleagues, and maintain confidentiality of company information.', category: 'conduct' },
    { title: 'IT Security Policy', content: 'All employees must use company-approved devices and VPN for accessing company resources. Sharing credentials is strictly prohibited.', category: 'security' },
    { title: 'Travel & Expense Policy', content: 'Business travel must be pre-approved by the reporting manager. Expense claims must be submitted within 7 days of travel completion.', category: 'travel' },
    { title: 'Anti-Harassment Policy', content: 'The company maintains zero tolerance towards harassment. All complaints will be investigated within 30 days.', category: 'hr' },
  ];

  for (const p of POLICY_DATA) {
    for (const company of [tcg, mpi, hfs]) {
      await prisma.policy.create({
        data: {
          title: p.title, content: p.content, description: p.content,
          category: p.category, companyId: company.id, status: 'active', version: '1.0',
        },
      });
    }
  }
  console.log(`  ✓ Created ${POLICY_DATA.length * 3} policies`);

  // ── 43. DOCUMENTS ──
  console.log('\n📋 Creating Documents...');
  let docCount = 0;
  for (const emp of allEmployees.slice(3, 20)) {
    const docTypes = ['Aadhaar Card', 'PAN Card', 'Passport', 'Offer Letter', 'Experience Certificate'];
    const numDocs = randInt(2, 4);
    for (let d = 0; d < numDocs; d++) {
      await prisma.document.create({
        data: {
          employeeId: emp.id, name: docTypes[d % docTypes.length],
          type: 'id_proof',
          status: 'active',
          fileUrl: `/uploads/${emp.employeeId}/${docTypes[d % docTypes.length].toLowerCase().replace(/ /g, '-')}.pdf`,
          uploadedAt: randDate(new Date('2024-01-01'), new Date('2026-06-30')),
        },
      });
      docCount++;
    }
  }
  console.log(`  ✓ Created ${docCount} documents`);

  // ── 44. RECOGNITIONS ──
  console.log('\n📋 Creating Recognitions...');
  const REC_DATA = [
    { title: 'Star Performer - Q1 2026', type: 'performance', message: 'Outstanding contribution to the HRMS portal redesign project' },
    { title: 'Innovation Award', type: 'innovation', message: 'Developed an AI-powered resume screening tool that reduced hiring time by 40%' },
    { title: 'Team Player Award', type: 'collaboration', message: 'Excellent collaboration across departments during the product launch' },
    { title: 'Customer Champion', type: 'customer', message: 'Received 5-star client feedback for 3 consecutive months' },
    { title: 'Safety Excellence', type: 'safety', message: '365 days without any safety incident in the factory floor' },
  ];

  let recCount = 0;
  for (const r of REC_DATA) {
    const emp = pick(allEmployees.slice(3, 25));
    const givenBy = pick(managerEmps);
    const fromUserId = givenBy.userId || superAdminUser.id;
    await prisma.recognition.create({
      data: {
        fromId: fromUserId, toId: emp.id,
        title: r.title, type: r.type,
        message: r.message, category: 'general',
      },
    });
    recCount++;
  }
  console.log(`  ✓ Created ${recCount} recognitions`);

  // ── 45. FEEDBACK ──
  console.log('\n📋 Creating Feedback...');
  let feedbackCount = 0;
  for (const emp of allEmployees.slice(3, 20)) {
    const from = pick(allEmployees.filter(e => e.id !== emp.id));
    await prisma.feedback.create({
      data: {
        fromId: from.id, toId: emp.id,
        type: pick(['peer', 'manager', '360']),
        rating: randInt(3, 5),
        comments: pick([
          'Great team player, always willing to help.',
          'Strong technical skills and attention to detail.',
          'Could improve on timely communication.',
          'Excellent problem solver with positive attitude.',
          'Consistent performer, reliable and thorough.',
        ]),
        isAnonymous: Math.random() > 0.8,
      },
    });
    feedbackCount++;
  }
  console.log(`  ✓ Created ${feedbackCount} feedback entries`);

  // ── 46. LOANS ──
  console.log('\n📋 Creating Loans...');
  const LOAN_DATA = [
    { type: 'personal', amount: 200000, interestRate: 8.5, tenure: 24, emi: 9100, status: 'active' },
    { type: 'emergency', amount: 50000, interestRate: 5, tenure: 6, emi: 8550, status: 'active' },
    { type: 'education', amount: 300000, interestRate: 6.5, tenure: 36, emi: 9180, status: 'pending' },
    { type: 'vehicle', amount: 500000, interestRate: 9, tenure: 48, emi: 12450, status: 'approved' },
  ];

  let loanCount = 0;
  for (const l of LOAN_DATA) {
    const emp = pick(allEmployees.slice(5, 25));
    await prisma.loan.create({
      data: {
        employeeId: emp.id,
        loanType: l.type.toUpperCase(),
        loanAmount: l.amount,
        interestRate: l.interestRate,
        tenureMonths: l.tenure,
        emiAmount: l.emi,
        outstandingBalance: l.amount * 0.7,
        disbursedAmount: l.status === 'pending' ? 0 : l.amount,
        recoveredAmount: l.amount * 0.3,
        remainingEmis: Math.max(1, Math.floor(l.tenure * 0.7)),
        startDate: randDate(new Date('2025-06-01'), new Date('2026-06-30')),
        status: l.status === 'approved' ? 'approved' : l.status,
      },
    });
    loanCount++;
  }
  console.log(`  ✓ Created ${loanCount} loans`);

  // ── 47. OVERTIME RECORDS ──
  console.log('\n📋 Creating Overtime Records...');
  let otCount = 0;
  for (const emp of allEmployees.slice(3, 15)) {
    const numOT = randInt(1, 5);
    for (let o = 0; o < numOT; o++) {
      await prisma.overtimeRecord.create({
        data: {
          employeeId: emp.id, date: randDate(new Date('2026-01-01'), new Date('2026-07-15')),
          hours: randInt(1, 4) + Math.random(), rate: 250,
          status: pick(['pending', 'approved', 'approved', 'rejected']),
          approvedBy: pick(managerEmps).id,
          reason: pick(['Project deadline', 'Production issue', 'Client escalation', 'Sprint completion']),
        },
      });
      otCount++;
    }
  }
  console.log(`  ✓ Created ${otCount} overtime records`);

  // ── 48. NOTIFICATIONS ──
  console.log('\n📋 Creating Notifications...');
  const NOTIF_DATA = [
    { title: 'New Job Application', message: 'Arun Kumar has applied for Senior Full-Stack Developer', type: 'info', category: 'recruitment' },
    { title: 'Leave Request Approved', message: 'Your casual leave request for July 10-12 has been approved', type: 'success', category: 'leave' },
    { title: 'Payroll Processed', message: 'June 2026 payroll has been processed successfully', type: 'success', category: 'payroll' },
    { title: 'Interview Scheduled', message: 'Technical interview with Priya Sharma scheduled for tomorrow at 10 AM', type: 'info', category: 'recruitment' },
    { title: 'Expense Rejected', message: 'Your travel expense claim of ₹6,000 has been rejected', type: 'warning', category: 'expense' },
    { title: 'Policy Update', message: 'Remote work policy has been updated. Please review.', type: 'info', category: 'policy' },
    { title: 'Performance Review Due', message: 'Q2 2026 performance review is due by end of this week', type: 'warning', category: 'performance' },
    { title: 'Birthday Celebration', message: 'Happy Birthday! Wishing you a great day ahead!', type: 'info', category: 'social' },
    { title: 'Training Reminder', message: 'AWS Cloud Practitioner training starts tomorrow', type: 'info', category: 'training' },
    { title: 'Ticket Resolved', message: 'Your IT support ticket #005 has been resolved', type: 'success', category: 'helpdesk' },
    { title: 'Attendance Alert', message: 'You were marked late today. Please regularize if incorrect.', type: 'warning', category: 'attendance' },
    { title: 'New Announcement', message: 'Company Town Hall scheduled for next Friday at 3 PM', type: 'info', category: 'announcement' },
    { title: 'Document Verification', message: 'Your PAN card document has been verified successfully', type: 'success', category: 'documents' },
    { title: 'Loan Approved', message: 'Your personal loan of ₹2,00,000 has been approved', type: 'success', category: 'finance' },
    { title: 'Probation Ending', message: 'Your probation period ends on August 15, 2026', type: 'info', category: 'hr' },
  ];

  const allDemoUsers = [superAdminUser, tenantAdminUser, ...hrAdminUsers, ...managerUsers, ...employeeUsers];
  let notifCount = 0;
  for (const notif of NOTIF_DATA) {
    // Send to multiple users
    const numRecipients = randInt(2, 6);
    const recipients = [...allDemoUsers].sort(() => Math.random() - 0.5).slice(0, numRecipients);
    for (const user of recipients) {
      await prisma.notification.create({
        data: {
          tenantId: tenant.id, userId: user.id,
          title: notif.title, message: notif.message,
          type: notif.type as any, category: notif.category as any,
          isRead: Math.random() > 0.5,
        },
      });
      notifCount++;
    }
  }
  console.log(`  ✓ Created ${notifCount} notifications`);

  // ── 49. ANNOUNCEMENTS ──
  console.log('\n📋 Creating Announcements...');
  const ANNOUNCE_DATA = [
    { title: 'Company Town Hall - Q2 2026 Review', message: 'Join us for the quarterly town hall meeting where leadership will share business updates, achievements, and upcoming plans. All employees are encouraged to attend.', priority: 'high', type: 'general' },
    { title: 'New Health Insurance Plan', message: 'We are pleased to announce an upgraded health insurance plan with enhanced coverage effective from August 1, 2026. Details will be shared via email.', priority: 'high', type: 'benefits' },
    { title: 'Office Renovation - Floor 3', message: 'Floor 3 will undergo renovation from July 20 to August 15. Affected teams will be temporarily relocated to Floor 5.', priority: 'medium', type: 'facility' },
    { title: 'Annual Day Celebration', message: 'Mark your calendars! Annual Day celebration is scheduled for September 10, 2026. Cultural programs and team competitions await!', priority: 'medium', type: 'event' },
    { title: 'Mandatory Fire Drill', message: 'A mandatory fire drill will be conducted on July 25, 2026 at 11:00 AM. All employees must participate and follow evacuation procedures.', priority: 'high', type: 'safety' },
  ];

  for (const ann of ANNOUNCE_DATA) {
    await prisma.announcement.create({
      data: {
        title: ann.title,
        content: ann.message,
        priority: ann.priority === 'high' ? 'important' : 'normal',
        isActive: true,
        publishedAt: new Date('2026-07-01'),
        expiresAt: new Date('2026-12-31'),
      },
    });
  }
  console.log(`  ✓ Created ${ANNOUNCE_DATA.length} announcements`);

  // ── 50. RBAC - MODULES, PERMISSIONS, ROLES ──
  console.log('\n📋 Creating RBAC Data...');

  const MODULE_DEFINITIONS = [
    { key: 'dashboard', name: 'Dashboard', category: 'Core HR', icon: 'LayoutDashboard', sortOrder: 1 },
    { key: 'employees', name: 'Employees', category: 'Core HR', icon: 'Users', sortOrder: 2 },
    { key: 'company', name: 'Company', category: 'Core HR', icon: 'Building2', sortOrder: 3 },
    { key: 'recruitment', name: 'Recruitment', category: 'Talent', icon: 'UserPlus', sortOrder: 4 },
    { key: 'requisitions', name: 'Requisitions', category: 'Talent', icon: 'ClipboardList', sortOrder: 5 },
    { key: 'offers', name: 'Offers', category: 'Talent', icon: 'FileText', sortOrder: 6 },
    { key: 'job_portal', name: 'Job Portal', category: 'Talent', icon: 'Globe', sortOrder: 7 },
    { key: 'ai_interview', name: 'AI Interview', category: 'Talent', icon: 'Bot', sortOrder: 8 },
    { key: 'onboarding', name: 'Onboarding', category: 'Lifecycle', icon: 'UserCheck', sortOrder: 9 },
    { key: 'preboarding', name: 'Preboarding', category: 'Lifecycle', icon: 'ClipboardCheck', sortOrder: 10 },
    { key: 'attendance', name: 'Attendance', category: 'Time', icon: 'Clock', sortOrder: 11 },
    { key: 'leave', name: 'Leave', category: 'Time', icon: 'CalendarOff', sortOrder: 12 },
    { key: 'timesheets', name: 'Timesheets', category: 'Time', icon: 'Timer', sortOrder: 13 },
    { key: 'payroll', name: 'Payroll', category: 'Compensation', icon: 'Banknote', sortOrder: 14 },
    { key: 'salary_structures', name: 'Salary Structures', category: 'Compensation', icon: 'Coins', sortOrder: 15 },
    { key: 'performance', name: 'Performance', category: 'Performance', icon: 'TrendingUp', sortOrder: 16 },
    { key: 'training', name: 'Training', category: 'Performance', icon: 'GraduationCap', sortOrder: 17 },
    { key: 'engagement', name: 'Engagement', category: 'Performance', icon: 'Heart', sortOrder: 18 },
    { key: 'projects', name: 'Projects', category: 'Operations', icon: 'FolderKanban', sortOrder: 19 },
    { key: 'travel', name: 'Travel', category: 'Operations', icon: 'Plane', sortOrder: 20 },
    { key: 'expenses', name: 'Expenses', category: 'Operations', icon: 'Receipt', sortOrder: 21 },
    { key: 'assets', name: 'Assets', category: 'Operations', icon: 'Monitor', sortOrder: 22 },
    { key: 'documents', name: 'Documents', category: 'Operations', icon: 'FileStack', sortOrder: 23 },
    { key: 'clients', name: 'Clients', category: 'External', icon: 'Handshake', sortOrder: 24 },
    { key: 'vendors', name: 'Vendors', category: 'External', icon: 'Truck', sortOrder: 25 },
    { key: 'helpdesk', name: 'Helpdesk', category: 'Support', icon: 'Headphones', sortOrder: 26 },
    { key: 'grievances', name: 'Grievances', category: 'Support', icon: 'AlertTriangle', sortOrder: 27 },
    { key: 'ai_assistant', name: 'AI Assistant', category: 'Support', icon: 'Sparkles', sortOrder: 28 },
    { key: 'workflows', name: 'Workflows', category: 'Governance', icon: 'GitBranch', sortOrder: 29 },
    { key: 'reports', name: 'Reports', category: 'Governance', icon: 'BarChart3', sortOrder: 30 },
    { key: 'settings', name: 'Settings', category: 'Governance', icon: 'Settings', sortOrder: 31 },
    { key: 'notifications', name: 'Notifications', category: 'Governance', icon: 'Bell', sortOrder: 32 },
    { key: 'super_admin', name: 'Super Admin', category: 'Admin', icon: 'Shield', sortOrder: 33 },
    { key: 'tenant_admin', name: 'Tenant Admin', category: 'Admin', icon: 'ShieldCheck', sortOrder: 34 },
    { key: 'ai_admin', name: 'AI Admin', category: 'Admin', icon: 'Brain', sortOrder: 35 },
  ];

  const LIMITED_ACTION_MODULES = ['dashboard', 'notifications'];
  const DEFAULT_ACTIONS = ['view', 'create', 'edit', 'delete', 'export', 'approve'];

  const moduleMap = new Map<string, string>();
  const permissionMap = new Map<string, string>();

  for (const modDef of MODULE_DEFINITIONS) {
    const mod = await prisma.module.upsert({
      where: { key: modDef.key },
      update: {
        name: modDef.name,
        category: modDef.category,
        icon: modDef.icon,
        sortOrder: modDef.sortOrder,
      },
      create: modDef,
    });
    moduleMap.set(modDef.key, mod.id);

    const actions = LIMITED_ACTION_MODULES.includes(modDef.key) ? ['view'] : DEFAULT_ACTIONS;
    for (const action of actions) {
      const perm = await prisma.permission.upsert({
        where: { moduleId_action: { moduleId: mod.id, action } },
        update: { description: `${action} ${modDef.name.toLowerCase()}` },
        create: { moduleId: mod.id, action, description: `${action} ${modDef.name.toLowerCase()}` },
      });
      permissionMap.set(`${mod.id}:${action}`, perm.id);
    }
  }

  // Roles
  const SYSTEM_ROLES = [
    { key: 'super_admin', name: 'Super Administrator', description: 'Full system access', level: 0, isSystem: true },
    { key: 'tenant_admin', name: 'Tenant Administrator', description: 'Full tenant access', level: 1, isSystem: true },
    { key: 'hr_admin', name: 'HR Administrator', description: 'HR module access', level: 2, isSystem: true },
    { key: 'manager', name: 'Manager', description: 'Team management', level: 3, isSystem: true },
    { key: 'employee', name: 'Employee', description: 'Self-service access', level: 4, isSystem: true },
    { key: 'recruiter', name: 'Recruiter', description: 'Recruitment access', level: 2, isSystem: true },
  ];

  const roleMap = new Map<string, string>();
  for (const roleDef of SYSTEM_ROLES) {
    const role = await prisma.role.create({
      data: { name: roleDef.name, key: roleDef.key, description: roleDef.description, isSystem: roleDef.isSystem, level: roleDef.level, tenantId: tenant.id, status: 'active', createdBy: superAdminUser.id },
    });
    roleMap.set(roleDef.key, role.id);
  }

  // Role-Permission assignments
  const assignPermissions = async (roleKey: string, moduleKeys: string[], allowedActions?: string[]) => {
    const roleId = roleMap.get(roleKey);
    if (!roleId) return;
    for (const mk of moduleKeys) {
      const moduleId = moduleMap.get(mk);
      if (!moduleId) continue;
      for (const action of allowedActions || DEFAULT_ACTIONS) {
        const permId = permissionMap.get(`${moduleId}:${action}`);
        if (!permId) continue;
        try { await prisma.rolePermission.create({ data: { roleId, permissionId: permId, granted: true } }); } catch { /* skip dup */ }
      }
    }
  };

  await assignPermissions('super_admin', MODULE_DEFINITIONS.map(m => m.key));
  const adminOnly = ['super_admin', 'tenant_admin', 'ai_admin'];
  await assignPermissions('tenant_admin', MODULE_DEFINITIONS.filter(m => !adminOnly.includes(m.key)).map(m => m.key));

  const HR_MODULES = ['dashboard', 'employees', 'company', 'recruitment', 'requisitions', 'offers', 'job_portal', 'ai_interview', 'onboarding', 'attendance', 'leave', 'timesheets', 'payroll', 'salary_structures', 'performance', 'training', 'engagement', 'documents', 'helpdesk', 'grievances', 'ai_assistant', 'workflows', 'reports', 'notifications', 'settings'];
  await assignPermissions('hr_admin', HR_MODULES);

  const MGR_MODULES = ['dashboard', 'employees', 'recruitment', 'onboarding', 'attendance', 'leave', 'timesheets', 'performance', 'training', 'engagement', 'documents', 'helpdesk', 'ai_assistant', 'projects', 'notifications'];
  await assignPermissions('manager', MGR_MODULES, ['view', 'create', 'edit', 'approve']);

  const EMP_MODULES = ['dashboard', 'employees', 'leave', 'attendance', 'timesheets', 'documents', 'helpdesk', 'ai_assistant', 'notifications', 'expenses', 'travel', 'training'];
  await assignPermissions('employee', EMP_MODULES.filter(m => !['leave', 'expenses', 'travel', 'timesheets', 'helpdesk', 'training'].includes(m)), ['view']);
  await assignPermissions('employee', ['leave', 'expenses', 'travel', 'timesheets', 'helpdesk', 'training'], ['view', 'create', 'edit']);

  const REC_MODULES = ['dashboard', 'recruitment', 'requisitions', 'offers', 'job_portal', 'ai_interview', 'employees', 'notifications', 'ai_assistant'];
  await assignPermissions('recruiter', REC_MODULES, ['view', 'create', 'edit', 'export']);

  // User-Role Assignments
  const userRoleMap = [
    { userId: superAdminUser.id, roleKey: 'super_admin' },
    { userId: tenantAdminUser.id, roleKey: 'tenant_admin' },
    ...hrAdminUsers.map((u, i) => ({ userId: u.id, roleKey: 'hr_admin', companyId: [tcg, mpi, hfs][i].id })),
    ...managerUsers.map(u => ({ userId: u.id, roleKey: 'manager', companyId: tcg.id })),
    ...employeeUsers.map(u => ({ userId: u.id, roleKey: 'employee', companyId: tcg.id })),
  ];

  for (const assignment of userRoleMap) {
    const roleId = roleMap.get(assignment.roleKey);
    if (!roleId) continue;
    try {
      await prisma.userRoleAssignment.create({
        data: { userId: assignment.userId, roleId, companyId: (assignment as any).companyId || null, assignedBy: superAdminUser.id },
      });
    } catch { /* skip dup */ }
  }
  console.log(`  ✓ Created RBAC: ${MODULE_DEFINITIONS.length} modules, roles, permissions, and user assignments`);

  // ── 51. SUBSCRIPTION PLAN & SUBSCRIPTION ──
  console.log('\n📋 Creating Subscription Data...');
  const plan = await prisma.subscriptionPlan.create({
    data: {
      name: 'Enterprise Demo', planType: 'enterprise',
      monthlyPrice: 299, annualPrice: 2990,
      employeeLimit: 500, companyLimit: 10, branchLimit: 50, storageLimit: 50000,
      aiInterviewLimit: 500, aiChatbotLimit: 5000,
      payrollEnabled: true, recruitmentEnabled: true, attendanceEnabled: true,
      projectEnabled: true, clientPortalEnabled: true, vendorPortalEnabled: true,
      mobileAppEnabled: true, apiAccessEnabled: true, whiteLabelEnabled: false,
      supportLevel: 'dedicated', status: 'active',
      description: 'Full-featured enterprise plan for demo purposes',
    },
  });

  await prisma.subscription.create({
    data: {
      tenantId: tenant.id, planId: plan.id,
      startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31'),
      billingCycle: 'annual', amount: 2990, currency: 'INR',
      paymentStatus: 'paid', status: 'active', autoRenew: true,
    },
  });
  console.log(`  ✓ Created subscription plan and subscription`);

  // ── 52. REQUISITIONS ──
  console.log('\n📋 Creating Requisitions...');
  try {
    const jobPostingsForReq = await prisma.jobPosting.findMany({ take: 4 });
    const REQ_DATA = [
      { positionType: 'new', priority: 'high', openings: 2, approvalStatus: 'hr_approved', status: 'approved' },
      { positionType: 'replacement', priority: 'medium', openings: 1, approvalStatus: 'hr_approved', status: 'approved' },
      { positionType: 'new', priority: 'high', openings: 1, approvalStatus: 'pending', status: 'open' },
      { positionType: 'new', priority: 'low', openings: 3, approvalStatus: 'hr_approved', status: 'approved' },
    ];

    let reqCount = 0;
    for (let i = 0; i < REQ_DATA.length; i++) {
      const r = REQ_DATA[i];
      const dept = allDepts[i % allDepts.length];
      await prisma.requisition.create({
        data: {
          requisitionId: `REQ-DEMO-${String(i + 1).padStart(3, '0')}`,
          companyId: dept.companyId,
          departmentId: dept.id,
          positionType: r.positionType,
          numberOfOpenings: r.openings,
          priority: r.priority,
          approvalStatus: r.approvalStatus,
          status: r.status,
          salaryBudget: '1000000-2000000',
          skillsRequired: 'Relevant domain experience',
        },
      });
      reqCount++;
    }
    console.log(`  ✓ Created ${reqCount} requisitions`);
  } catch (err) {
    console.log(`  ⚠ Skipped requisitions: ${(err as Error).message}`);
  }

  // ── 53. REFERRALS ──
  console.log('\n📋 Creating Referrals...');
  try {
    const jobPostingsForRef = await prisma.jobPosting.findMany({ take: 4 });
    const REFERRAL_DATA = [
      { candidateName: 'Meera Krishnan', candidateEmail: 'meera.k@gmail.com', status: 'hired', bonus: 25000 },
      { candidateName: 'Rahul Dravid', candidateEmail: 'rahul.d@gmail.com', status: 'interviewed', bonus: 0 },
      { candidateName: 'Anjali Reddy', candidateEmail: 'anjali.r@gmail.com', status: 'applied', bonus: 0 },
      { candidateName: 'Suresh Raina', candidateEmail: 'suresh.r@gmail.com', status: 'pending', bonus: 0 },
    ];

    for (let i = 0; i < REFERRAL_DATA.length; i++) {
      const ref = REFERRAL_DATA[i];
      const job = jobPostingsForRef[i % jobPostingsForRef.length];
      await prisma.referral.create({
        data: {
          jobPostingId: job.id,
          referrerEmployeeId: pick(allEmployees.slice(3, 15)).id,
          candidateName: ref.candidateName,
          candidateEmail: ref.candidateEmail,
          status: ref.status,
          bonusAmount: ref.bonus,
        },
      });
    }
    console.log(`  ✓ Created ${REFERRAL_DATA.length} referrals`);
  } catch (err) {
    console.log(`  ⚠ Skipped referrals: ${(err as Error).message}`);
  }

  // ── 54. AUDIT LOGS ──
  console.log('\n📋 Creating Audit Logs...');
  const AUDIT_ACTIONS = [
    { action: 'LOGIN', module: 'auth', details: 'User logged in successfully' },
    { action: 'CREATE_EMPLOYEE', module: 'employees', details: 'Created new employee record' },
    { action: 'UPDATE_EMPLOYEE', module: 'employees', details: 'Updated employee details' },
    { action: 'APPROVE_LEAVE', module: 'leave', details: 'Approved leave request' },
    { action: 'PROCESS_PAYROLL', module: 'payroll', details: 'Processed monthly payroll' },
    { action: 'CREATE_JOB', module: 'recruitment', details: 'Created new job posting' },
    { action: 'UPDATE_POLICY', module: 'settings', details: 'Updated company policy' },
    { action: 'EXPORT_REPORT', module: 'reports', details: 'Exported attendance report' },
    { action: 'ASSIGN_ASSET', module: 'assets', details: 'Assigned laptop to employee' },
    { action: 'APPROVE_EXPENSE', module: 'expenses', details: 'Approved expense claim' },
  ];

  let auditCount = 0;
  for (let i = 0; i < 50; i++) {
    const audit = AUDIT_ACTIONS[i % AUDIT_ACTIONS.length];
    await prisma.auditLog.create({
      data: {
        userId: pick(allDemoUsers).id,
        action: audit.action, module: audit.module,
        details: audit.details,
      },
    });
    auditCount++;
  }
  console.log(`  ✓ Created ${auditCount} audit logs`);

  // ── 55. INVOICES ──
  console.log('\n📋 Creating Invoices...');
  try {
    const INVOICE_DATA = [
      { invoiceNumber: 'INV-TCG-2026-001', clientId: clients[0].id, projectId: projects[0].id, subtotal: 1500000, status: 'paid', dueDate: new Date('2026-03-31') },
      { invoiceNumber: 'INV-MPI-2026-001', clientId: clients[1].id, projectId: projects[1].id, subtotal: 2500000, status: 'sent', dueDate: new Date('2026-08-31') },
      { invoiceNumber: 'INV-HFS-2026-001', clientId: clients[2].id, projectId: projects[2].id, subtotal: 1800000, status: 'overdue', dueDate: new Date('2026-06-30') },
      { invoiceNumber: 'INV-TCG-2026-002', clientId: clients[3].id, projectId: projects[3].id, subtotal: 900000, status: 'draft', dueDate: new Date('2026-09-30') },
    ];

    for (const inv of INVOICE_DATA) {
      const tax = inv.subtotal * 0.18;
      const invoice = await prisma.invoice.create({
        data: {
          invoiceNumber: inv.invoiceNumber, companyId: tcg.id,
          clientId: inv.clientId, projectId: inv.projectId,
          subtotal: inv.subtotal, taxAmount: tax, totalAmount: inv.subtotal + tax,
          status: inv.status, issueDate: new Date('2026-07-01'), dueDate: inv.dueDate,
        },
      });

      await prisma.invoiceLineItem.create({
        data: {
          invoiceId: invoice.id, description: 'Professional Services - Development',
          quantity: randInt(100, 500), rate: 3000, amount: inv.subtotal,
        },
      });
    }
    console.log(`  ✓ Created ${INVOICE_DATA.length} invoices with line items`);
  } catch (err) {
    console.log(`  ⚠ Skipped invoices: ${(err as Error).message}`);
  }

  // ── 56. SALARY COMPONENTS (Payroll) ──
  console.log('\n📋 Creating Payroll Components...');
  try {
    const PAYROLL_COMPONENTS = [
      { code: 'BASIC', name: 'Basic Salary', componentType: 'EARNING', calculationType: 'FLAT_AMOUNT' },
      { code: 'HRA', name: 'House Rent Allowance', componentType: 'EARNING', calculationType: 'PERCENTAGE' },
      { code: 'DA', name: 'Dearness Allowance', componentType: 'EARNING', calculationType: 'FLAT_AMOUNT' },
      { code: 'CONV', name: 'Conveyance Allowance', componentType: 'EARNING', calculationType: 'FLAT_AMOUNT' },
      { code: 'MED', name: 'Medical Allowance', componentType: 'EARNING', calculationType: 'FLAT_AMOUNT' },
      { code: 'SA', name: 'Special Allowance', componentType: 'EARNING', calculationType: 'FLAT_AMOUNT' },
      { code: 'EPF_EE', name: 'Provident Fund (Employee)', componentType: 'DEDUCTION', calculationType: 'PERCENTAGE' },
      { code: 'PT', name: 'Professional Tax', componentType: 'DEDUCTION', calculationType: 'FLAT_AMOUNT' },
      { code: 'TDS', name: 'TDS', componentType: 'DEDUCTION', calculationType: 'MANUAL_ENTRY' },
    ];

    for (const comp of PAYROLL_COMPONENTS) {
      await prisma.payrollComponent.create({
        data: {
          code: comp.code,
          name: comp.name,
          componentType: comp.componentType,
          componentCategory: 'NORMAL',
          calculationType: comp.calculationType,
          isActive: true,
        },
      });
    }
    console.log(`  ✓ Created ${PAYROLL_COMPONENTS.length} payroll components`);
  } catch (err) {
    console.log(`  ⚠ Skipped payroll components: ${(err as Error).message}`);
  }

  // ── 57. GRATUITY / FNF calculations (a few samples) ──
  console.log('\n📋 Creating FNF Calculations...');
  try {
    const fnfEmp = allEmployees[allEmployees.length - 1]; // last employee
    await prisma.fNFCalculation.create({
      data: {
        employeeId: fnfEmp.id,
        leaveEncashment: 58800,
        totalEarnings: 176300,
        totalDeductions: 0,
        netAmount: 176300,
        status: 'pending',
      },
    });
  } catch { /* model may not exist */ }
  console.log(`  ✓ Created FNF calculations`);

  // ── 58. EMPLOYEE CUSTOM FIELDS ──
  console.log('\n📋 Creating Employee Custom Fields...');
  try {
    const customFields = [
      { name: 'Blood Group', type: 'select', options: 'A+,A-,B+,B-,O+,O-,AB+,AB-', required: true },
      { name: 'Emergency Contact', type: 'text', options: null, required: true },
      { name: 'UAN Number', type: 'text', options: null, required: false },
      { name: 'PAN Category', type: 'select', options: 'Individual,HUF,Company,Trust', required: false },
      { name: 'Previous Employer', type: 'text', options: null, required: false },
    ];

    for (const cf of customFields) {
      const field = await prisma.employeeCustomField.create({
        data: {
          label: cf.name,
          key: cf.name.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
          fieldType: cf.type,
          options: cf.options ? JSON.stringify(cf.options.split(',')) : null,
          isRequired: cf.required,
          scope: 'company',
          companyId: tcg.id,
        },
      });

      // Add values for some employees
      for (const emp of allEmployees.slice(3, 10)) {
        const valueText =
          cf.name === 'Blood Group' ? pick(['A+', 'B+', 'O+', 'O-']) :
          cf.name === 'UAN Number' ? `UAN${randInt(10000000, 99999999)}` :
          cf.name === 'PAN Category' ? 'Individual' : 'Sample Value';
        await prisma.employeeCustomFieldValue.create({
          data: {
            employeeId: emp.id,
            fieldId: field.id,
            valueText,
          },
        });
      }
    }
  } catch { /* model may not exist */ }
  console.log(`  ✓ Created employee custom fields`);

  // ── VERIFICATION ──
  console.log('\n\n🔍 ========== DEMO DATA SUMMARY ==========');
  const counts = {
    users: await prisma.user.count(),
    employees: await prisma.employee.count(),
    companies: await prisma.company.count(),
    branches: await prisma.branch.count(),
    departments: await prisma.department.count(),
    designations: await prisma.designation.count(),
    shifts: await prisma.shift.count(),
    holidays: await prisma.holiday.count(),
    leaveTypes: await prisma.leaveType.count(),
    leaveBalances: await prisma.leaveBalance.count(),
    leaveRequests: await prisma.leaveRequest.count(),
    attendance: await prisma.attendance.count(),
    jobPostings: await prisma.jobPosting.count(),
    jobApplications: await prisma.jobApplication.count(),
    interviews: await prisma.interview.count(),
    projects: await prisma.project.count(),
    clients: await prisma.client.count(),
    vendors: await prisma.vendor.count(),
    assets: await prisma.asset.count(),
    tickets: await prisma.ticket.count(),
    policies: await prisma.policy.count(),
    recognitions: await prisma.recognition.count(),
    loans: await prisma.loan.count(),
    courses: await prisma.training.count(),
  };

  for (const [key, val] of Object.entries(counts)) {
    console.log(`  ✓ ${key}: ${val}`);
  }

  console.log('\n\n📝 ====== DEMO LOGIN CREDENTIALS ======');
  console.log('  ┌──────────────────┬───────────────────────────────┬─────────────────┐');
  console.log('  │ Role             │ Email                         │ Password        │');
  console.log('  ├──────────────────┼───────────────────────────────┼─────────────────┤');
  console.log('  │ Super Admin      │ superadmin@3boxeshrms.com     │ MarqAI@2026     │');
  console.log('  │ Tenant Admin     │ tenantadmin@3boxeshrms.com    │ MarqAI@2026     │');
  console.log('  │ HR Admin (TCG)   │ hr.tcg@3boxeshrms.com         │ MarqAI@2026     │');
  console.log('  │ HR Admin (MPI)   │ hr.mpi@3boxeshrms.com         │ MarqAI@2026     │');
  console.log('  │ HR Admin (HFS)   │ hr.hfs@3boxeshrms.com         │ MarqAI@2026     │');
  console.log('  │ Manager 1        │ mgr1@3boxeshrms.com           │ MarqAI@2026     │');
  console.log('  │ Manager 2        │ mgr2@3boxeshrms.com           │ MarqAI@2026     │');
  console.log('  │ Employee 1       │ amit.verma@3boxeshrms.com     │ MarqAI@2026     │');
  console.log('  │ Employee 2       │ bharathi.krishnan@3boxeshrms.com│ MarqAI@2026   │');
  console.log('  └──────────────────┴───────────────────────────────┴─────────────────┘');
  console.log('\n  💡 All roles use the same password: MarqAI@2026');
  console.log('  💡 75+ employees, 3 companies, 8 projects, 12 job postings');
  console.log('  💡 Full attendance, leave, payroll, recruitment, and training data');
  console.log('\n✅ COMPREHENSIVE DEMO SEEDING COMPLETED SUCCESSFULLY!');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
