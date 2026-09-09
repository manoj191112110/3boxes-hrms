import { NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import bcryptjs from 'bcryptjs';

/**
 * POST /api/admin/seed-marqai
 *
 * Seeds the database with MarqAI Tech Group data.
 * This endpoint is DISABLED after initial seeding for security.
 *
 * To re-enable temporarily, change SEED_ENABLED to true.
 * SECURITY: Requires a secret key to prevent unauthorized seeding.
 * Pass ?key=MARQAI_SEED_2026 in the URL.
 */

const SEED_ENABLED = false; // DISABLED in production — GOLDEN RULE: no seed data on LIVE

export async function POST(request: Request) {
  const db = await getDb(request);
  try {
    if (!SEED_ENABLED) {
      return NextResponse.json({ error: 'Seed endpoint is disabled. Set SEED_ENABLED=true in source code to re-enable.' }, { status: 403 });
    }

    // Security check - require a secret key
    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');
    if (key !== 'MARQAI_SEED_2026') {
      return NextResponse.json({ error: 'Invalid seed key' }, { status: 403 });
    }

    const force = searchParams.get('force') === 'true';

    // Check if MarqAI tenant already exists
    const existing = await getPlatformDb().tenant.findUnique({
      where: { slug: 'marqaitechgroup' },
    });

    if (existing && !force) {
      return NextResponse.json({
        message: 'MarqAI Tech Group already seeded. Use ?force=true to re-seed.',
        tenantId: existing.id,
      });
    }

    // If force=true and tenant exists, clean up existing data
    if (existing) {
      console.log('[seed-marqai] Force re-seed: cleaning up existing data...');
      const tenantId = existing.id;

      // 1. Delete all dependent records in correct order (reverse FK dependency)
      // Deep dependencies first: records that reference Employee/User/Company/etc.

      // Get all company IDs for this tenant
      const existingGroup = await db.companyGroup.findFirst({
        where: { tenantId },
      });
      const companyIds: string[] = [];
      if (existingGroup) {
        const existingCompanies = await db.company.findMany({
          where: { companyGroupId: existingGroup.id },
          select: { id: true },
        });
        companyIds.push(...existingCompanies.map(c => c.id));
      }

      // Get all employee IDs for this tenant
      const employeeIds: string[] = [];
      for (const companyId of companyIds) {
        const emps = await db.employee.findMany({
          where: { companyId },
          select: { id: true },
        });
        employeeIds.push(...emps.map(e => e.id));
      }

      // Get all user IDs for this tenant
      const existingUsers = await db.user.findMany({
        where: { tenantId },
        select: { id: true },
      });
      const userIds = existingUsers.map(u => u.id);

      // Get all designation IDs for this tenant
      const existingDesignations = await db.designation.findMany({
        where: { tenantId },
        select: { id: true },
      });
      const designationIds = existingDesignations.map(d => d.id);

      // Delete employee-dependent records first
      for (const empId of employeeIds) {
        await db.employeeSkill.deleteMany({ where: { employeeId: empId } }).catch(() => {});
        await db.employeePaymentMethod.deleteMany({ where: { employeeId: empId } }).catch(() => {});
        await db.employeeCustomFieldValue.deleteMany({ where: { employeeId: empId } }).catch(() => {});
        await db.employeeRosterAssignment.deleteMany({ where: { employeeId: empId } }).catch(() => {});
        await db.employeeCompanyMapping.deleteMany({ where: { employeeId: empId } }).catch(() => {});
        await db.employeeDimensionAllocation.deleteMany({ where: { employeeId: empId } }).catch(() => {});
        await db.dependent.deleteMany({ where: { employeeId: empId } }).catch(() => {});
        await db.qualification.deleteMany({ where: { employeeId: empId } }).catch(() => {});
        await db.experience.deleteMany({ where: { employeeId: empId } }).catch(() => {});
        await db.assetAssignment.deleteMany({ where: { employeeId: empId } }).catch(() => {});
        await db.bankAccount.deleteMany({ where: { employeeId: empId } }).catch(() => {});
        await db.gratuityLedger.deleteMany({ where: { employeeId: empId } }).catch(() => {});
      }

      // Delete company-dependent records
      for (const companyId of companyIds) {
        // Job postings → job applications → interviews
        const jobPostings = await db.jobPosting.findMany({
          where: { companyId },
          select: { id: true },
        });
        for (const jpId of jobPostings.map(j => j.id)) {
          const jobApps = await db.jobApplication.findMany({
            where: { jobPostingId: jpId },
            select: { id: true },
          });
          for (const jaId of jobApps.map(j => j.id)) {
            await db.interview.deleteMany({ where: { jobApplicationId: jaId } }).catch(() => {});
            await db.candidateAiFeedback.deleteMany({ where: { jobApplicationId: jaId } }).catch(() => {});
          }
          await db.jobApplication.deleteMany({ where: { jobPostingId: jpId } }).catch(() => {});
        }
        await db.jobPosting.deleteMany({ where: { companyId } }).catch(() => {});

        await db.leaveRequest.deleteMany({ where: { companyId } }).catch(() => {});
        await db.leaveBalance.deleteMany({ where: { companyId } }).catch(() => {});
        await db.attendance.deleteMany({ where: { companyId } }).catch(() => {});
        await db.payroll.deleteMany({ where: { companyId } }).catch(() => {});
        await db.performanceReview.deleteMany({ where: { companyId } }).catch(() => {});
        await db.goal.deleteMany({ where: { companyId } }).catch(() => {});
        await db.training.deleteMany({ where: { companyId } }).catch(() => {});
        await db.trainingEnrollment.deleteMany({ where: { companyId } }).catch(() => {});
        await db.asset.deleteMany({ where: { companyId } }).catch(() => {});
        await db.document.deleteMany({ where: { companyId } }).catch(() => {});
        await db.incidentReport.deleteMany({ where: { companyId } }).catch(() => {});
        await db.travelRequest.deleteMany({ where: { companyId } }).catch(() => {});
        await db.expenseClaim.deleteMany({ where: { companyId } }).catch(() => {});
        await db.timesheet.deleteMany({ where: { companyId } }).catch(() => {});
        await db.feedback.deleteMany({ where: { companyId } }).catch(() => {});
        await db.promotion.deleteMany({ where: { companyId } }).catch(() => {});
        await db.grievance.deleteMany({ where: { companyId } }).catch(() => {});
        await db.separation.deleteMany({ where: { companyId } }).catch(() => {});
        await db.shift.deleteMany({ where: { companyId } }).catch(() => {});
        await db.holiday.deleteMany({ where: { companyId } }).catch(() => {});
        await db.announcement.deleteMany({ where: { companyId } }).catch(() => {});
        await db.companyPolicy.deleteMany({ where: { companyId } }).catch(() => {});
        await db.reimbursement.deleteMany({ where: { companyId } }).catch(() => {});
        await db.onboardingTask.deleteMany({ where: { companyId } }).catch(() => {});
        await db.leaveType.deleteMany({ where: { companyId } }).catch(() => {});
        await db.candidateTalentPool.deleteMany({ where: { companyId } }).catch(() => {});
        await db.client.deleteMany({ where: { companyId } }).catch(() => {});
      }

      // Delete designation-dependent records
      for (const desId of designationIds) {
        await db.employeeDimensionAllocation.deleteMany({ where: { dimensionId: desId } }).catch(() => {});
      }

      // Delete employees (after all employee-dependent records are gone)
      for (const companyId of companyIds) {
        await db.employee.deleteMany({ where: { companyId } }).catch(() => {});
      }

      // Delete departments and branches (after employees)
      for (const companyId of companyIds) {
        await db.department.deleteMany({ where: { companyId } }).catch(() => {});
        await db.branch.deleteMany({ where: { companyId } }).catch(() => {});
      }

      // Delete designations (tenant-level)
      await db.designation.deleteMany({ where: { tenantId } }).catch(() => {});

      // Delete companies
      if (existingGroup) {
        await db.company.deleteMany({ where: { companyGroupId: existingGroup.id } }).catch(() => {});
        await db.companyGroup.deleteMany({ where: { id: existingGroup.id } }).catch(() => {});
      }

      // Delete user-dependent records
      for (const userId of userIds) {
        await db.loginActivity.deleteMany({ where: { userId } }).catch(() => {});
        await db.notification.deleteMany({ where: { userId } }).catch(() => {});
        await db.auditLog.deleteMany({ where: { userId } }).catch(() => {});
      }

      // Delete users
      await db.user.deleteMany({ where: { tenantId } }).catch(() => {});

      // Delete tenant-dependent records on platform DB
      await getPlatformDb().tenantConfiguration.deleteMany({ where: { tenantId } }).catch(() => {});
      await getPlatformDb().tenantCountryAccess.deleteMany({ where: { tenantId } }).catch(() => {});
      await getPlatformDb().tenantCurrencyAccess.deleteMany({ where: { tenantId } }).catch(() => {});
      await getPlatformDb().tenantLanguageAccess.deleteMany({ where: { tenantId } }).catch(() => {});
      await getPlatformDb().tenantPayrollPolicy.deleteMany({ where: { tenantId } }).catch(() => {});
      await getPlatformDb().tenantDatabase.deleteMany({ where: { tenantId } }).catch(() => {});
      await getPlatformDb().subscription.deleteMany({ where: { tenantId } }).catch(() => {});
      await getPlatformDb().featureFlag.deleteMany({ where: { tenantId } }).catch(() => {});

      // Delete the tenant itself
      await getPlatformDb().tenant.delete({ where: { id: tenantId } }).catch(() => {});
      console.log('[seed-marqai] Cleanup complete, re-seeding...');
    }

    const hashedPassword = await bcryptjs.hash('MarqAI@2026', 12);

    // ==================== TENANT ====================
    const tenant = await getPlatformDb().tenant.create({
      data: {
        name: 'MarqAI Tech Group',
        slug: 'marqaitechgroup',
        domain: 'marqaitechgroup.3boxeshrms.com',
        plan: 'enterprise',
        status: 'active',
        country: 'IN',
        currency: 'INR',
        timezone: 'Asia/Kolkata',
        language: 'en',
        baseCurrency: 'INR',
        maxCompaniesAllowed: 10,
        aiFeedbackEnabled: true,
        resumeScoreThreshold: 0,
        talentPoolCrossCompanyEnabled: true,
        videoInterviewRetakeLimit: 2,
        videoRetentionDays: 90,
      },
    });

    // ==================== COMPANY GROUP ====================
    const companyGroup = await db.companyGroup.create({
      data: {
        name: 'MarqAI Tech Group',
        tenantId: tenant.id,
        employeeLimitMode: 'group_total',
        maxEmployees: 500,
        maxCompanies: 10,
      },
    });

    // ==================== COMPANIES (5) ====================
    const companiesData = [
      { name: 'MarqAI Tech Pvt Ltd', code: 'MTPL', city: 'Hyderabad', state: 'TS', email: 'info@marqaitech.com', website: 'https://marqaitech.com' },
      { name: 'MarqAI Solutions Pvt Ltd', code: 'MSPL', city: 'Hyderabad', state: 'TS', email: 'info@marqaisolutions.com', website: 'https://marqaisolutions.com' },
      { name: 'MarqAI Digital Pvt Ltd', code: 'MDPL', city: 'Bangalore', state: 'KA', email: 'info@marqaidigital.com', website: 'https://marqaidigital.com' },
      { name: 'MarqAI Innovations Pvt Ltd', code: 'MIPL', city: 'Chennai', state: 'TN', email: 'info@marqaiinnovations.com', website: 'https://marqaiinnovations.com' },
      { name: 'MarqAI Consulting Pvt Ltd', code: 'MCPL', city: 'Mumbai', state: 'MH', email: 'info@marqaiconsulting.com', website: 'https://marqaiconsulting.com' },
    ];

    const createdCompanies = [];
    const createdBranches = [];
    for (const c of companiesData) {
      const company = await db.company.create({
        data: {
          name: c.name, code: c.code, companyGroupId: companyGroup.id,
          country: 'IN', currency: 'INR', timezone: 'Asia/Kolkata',
          city: c.city, state: c.state, email: c.email, website: c.website,
          status: 'active', maxEmployees: 100,
        },
      });
      createdCompanies.push(company);

      const branch = await db.branch.create({
        data: {
          name: `${c.name} - Head Office`, code: `${c.code}-HO`,
          companyId: company.id, city: c.city, state: c.state, country: 'IN', status: 'active',
        },
      });
      createdBranches.push(branch);
    }

    // ==================== DEPARTMENTS & DESIGNATIONS ====================
    const deptNames = ['Human Resources', 'Engineering', 'Finance', 'Operations', 'Sales & Marketing'];
    const designationDefs = [
      { title: 'CEO', dept: 'Human Resources' },
      { title: 'CTO', dept: 'Engineering' },
      { title: 'HR Manager', dept: 'Human Resources' },
      { title: 'Software Engineer', dept: 'Engineering' },
      { title: 'Senior Software Engineer', dept: 'Engineering' },
      { title: 'Team Lead', dept: 'Engineering' },
      { title: 'Finance Manager', dept: 'Finance' },
      { title: 'Sales Manager', dept: 'Sales & Marketing' },
    ];

    const allDepts: { id: string; name: string; companyIndex: number }[] = [];
    for (let i = 0; i < createdCompanies.length; i++) {
      for (const dn of deptNames) {
        const dept = await db.department.create({
          data: { name: dn, companyId: createdCompanies[i].id, branchId: createdBranches[i].id, status: 'active' },
        });
        allDepts.push({ id: dept.id, name: dept.name, companyIndex: i });
      }
    }

    // Designations require title + departmentId, so create per company
    const allDesignations: { id: string; title: string; companyIndex: number }[] = [];
    for (let i = 0; i < createdCompanies.length; i++) {
      for (const dd of designationDefs) {
        const dept = allDepts.find(d => d.companyIndex === i && d.name === dd.dept);
        if (dept) {
          const des = await db.designation.create({
            data: { title: dd.title, departmentId: dept.id, status: 'active' },
          });
          allDesignations.push({ id: des.id, title: dd.title, companyIndex: i });
        }
      }
    }

    // ==================== SUPER ADMIN ====================
    const superAdmin = await db.user.create({
      data: {
        email: 'superadmin@3boxeshrms.com', name: '3Boxes Super Admin',
        password: hashedPassword, role: 'super_admin', status: 'active', tenantId: tenant.id,
      },
    });

    // ==================== TENANT ADMIN ====================
    const tenantAdmin = await db.user.create({
      data: {
        email: 'admin@marqaitechgroup.com', name: 'MarqAI Tech Group Admin',
        password: hashedPassword, role: 'tenant_admin', status: 'active', tenantId: tenant.id,
      },
    });

    // ==================== HR ADMINS + EMPLOYEES ====================
    const hrEmails = ['hr@marqaitech.com', 'hr@marqaisolutions.com', 'hr@marqaidigital.com', 'hr@marqaiinnovations.com', 'hr@marqaiconsulting.com'];
    const empData = [
      { email: 'rajesh.kumar@marqaitech.com', firstName: 'Rajesh', lastName: 'Kumar', desName: 'Senior Software Engineer' },
      { email: 'priya.sharma@marqaisolutions.com', firstName: 'Priya', lastName: 'Sharma', desName: 'Software Engineer' },
      { email: 'amit.patel@marqaidigital.com', firstName: 'Amit', lastName: 'Patel', desName: 'Team Lead' },
      { email: 'sneha.reddy@marqaiinnovations.com', firstName: 'Sneha', lastName: 'Reddy', desName: 'Software Engineer' },
      { email: 'vikram.singh@marqaiconsulting.com', firstName: 'Vikram', lastName: 'Singh', desName: 'Finance Manager' },
    ];

    const createdUsers = [];
    for (let i = 0; i < createdCompanies.length; i++) {
      // HR Admin
      const hrDept = allDepts.find(d => d.companyIndex === i && d.name === 'Human Resources');
      const hrDes = allDesignations.find(d => d.companyIndex === i && d.title === 'HR Manager');

      const hrUser = await db.user.create({
        data: {
          email: hrEmails[i], name: `HR Admin - ${createdCompanies[i].name}`,
          password: hashedPassword, role: 'admin', status: 'active', tenantId: tenant.id,
        },
      });
      createdUsers.push(hrUser);

      if (hrDept && hrDes) {
        await db.employee.create({
          data: {
            userId: hrUser.id, companyId: createdCompanies[i].id, branchId: createdBranches[i].id,
            departmentId: hrDept.id, designationId: hrDes.id,
            employeeId: `EMP-${createdCompanies[i].code}-HR001`,
            firstName: 'HR', lastName: 'Admin', email: hrEmails[i],
            status: 'active', dateOfJoining: new Date(),
          },
        });
      }

      // Employee
      const emp = empData[i];
      const engDept = allDepts.find(d => d.companyIndex === i && d.name === 'Engineering') || allDepts.find(d => d.companyIndex === i && d.name === 'Finance');
      const empDes = allDesignations.find(d => d.companyIndex === i && d.title === emp.desName);

      const empUser = await db.user.create({
        data: {
          email: emp.email, name: `${emp.firstName} ${emp.lastName}`,
          password: hashedPassword, role: 'admin', status: 'active', tenantId: tenant.id,
        },
      });
      createdUsers.push(empUser);

      if (engDept && empDes) {
        await db.employee.create({
          data: {
            userId: empUser.id, companyId: createdCompanies[i].id, branchId: createdBranches[i].id,
            departmentId: engDept.id, designationId: empDes.id,
            employeeId: `EMP-${createdCompanies[i].code}-E001`,
            firstName: emp.firstName, lastName: emp.lastName, email: emp.email,
            status: 'active', dateOfJoining: new Date(),
          },
        });
      }
    }

    // ==================== SUBSCRIPTION PLAN ====================
    try {
      await getPlatformDb().subscriptionPlan.create({
        data: {
          id: 'plan-enterprise-marqai',
          name: 'Enterprise', price: 9999.00, currency: 'INR', billingCycle: 'monthly',
          features: JSON.stringify(['Unlimited Employees', 'Multi-Company', 'AI Features', 'Priority Support']),
          maxEmployees: 500, maxCompanies: 10,
        },
      });
    } catch { /* ignore if exists */ }

    return NextResponse.json({
      success: true,
      message: 'MarqAI Tech Group seeded successfully!',
      data: {
        tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug, domain: tenant.domain },
        companies: createdCompanies.map(c => ({ name: c.name, code: c.code })),
        users: {
          superAdmin: superAdmin.email,
          tenantAdmin: tenantAdmin.email,
          hrAdmins: hrEmails,
          employees: empData.map(e => e.email),
        },
        password: 'MarqAI@2026 (change after first login!)',
      },
    });
  } catch (error) {
    console.error('Seed error:', error);
    return NextResponse.json(
      { error: 'Seed failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
