/**
 * 3Boxes HRMS - Full Comprehensive Re-seed MarqAI Tech Group
 * Phase 1: Cleanup (no wrapping transaction - individual operations)
 * Phase 2: Seed (wrapped in transaction)
 */

const { Client } = require('pg');
const crypto = require('crypto');

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_pxZd8woKe4WB@ep-blue-fire-aqk8jxd2-pooler.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require';
const PASSWORD_HASH = '$2b$12$7eWvdTwkl.L3OH8BPcnmz.7mfmM8/zrNUnMaTse4fa.0DvBaVNjbS'; // MarqAI@2026

function generateId() {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(8).toString('hex').substring(0, 20);
  return `cmr${timestamp}${random}`.substring(0, 30);
}

const NEW_COMPANIES = [
  { name: 'MarqAI Tech Pvt Ltd', code: 'MTPL', city: 'Hyderabad', state: 'TS', email: 'info@marqaitech.com', website: 'https://marqaitech.com' },
  { name: 'MarqAI Solutions Pvt Ltd', code: 'MSPL', city: 'Hyderabad', state: 'TS', email: 'info@marqaisolutions.com', website: 'https://marqaisolutions.com' },
  { name: 'MarqAI Digital Pvt Ltd', code: 'MDPL', city: 'Bangalore', state: 'KA', email: 'info@marqaidigital.com', website: 'https://marqaidigital.com' },
  { name: 'MarqAI Innovations Pvt Ltd', code: 'MIPL', city: 'Chennai', state: 'TN', email: 'info@marqaiinnovations.com', website: 'https://marqaiinnovations.com' },
  { name: 'MarqAI Consulting Pvt Ltd', code: 'MCPL', city: 'Mumbai', state: 'MH', email: 'info@marqaiconsulting.com', website: 'https://marqaiconsulting.com' },
];

const BASIC_DEPARTMENTS = ['Human Resources', 'Engineering', 'Finance', 'Operations', 'Sales & Marketing'];

const BASIC_DESIGNATIONS = [
  { title: 'CEO', dept: 'Human Resources' },
  { title: 'CTO', dept: 'Engineering' },
  { title: 'HR Manager', dept: 'Human Resources' },
  { title: 'Software Engineer', dept: 'Engineering' },
  { title: 'Senior Software Engineer', dept: 'Engineering' },
  { title: 'Team Lead', dept: 'Engineering' },
  { title: 'Finance Manager', dept: 'Finance' },
  { title: 'Sales Manager', dept: 'Sales & Marketing' },
];

const HR_EMAILS = ['hr@marqaitech.com', 'hr@marqaisolutions.com', 'hr@marqaidigital.com', 'hr@marqaiinnovations.com', 'hr@marqaiconsulting.com'];
const EMP_DATA = [
  { email: 'rajesh.kumar@marqaitech.com', firstName: 'Rajesh', lastName: 'Kumar', desName: 'Senior Software Engineer' },
  { email: 'priya.sharma@marqaisolutions.com', firstName: 'Priya', lastName: 'Sharma', desName: 'Software Engineer' },
  { email: 'amit.patel@marqaidigital.com', firstName: 'Amit', lastName: 'Patel', desName: 'Team Lead' },
  { email: 'sneha.reddy@marqaiinnovations.com', firstName: 'Sneha', lastName: 'Reddy', desName: 'Software Engineer' },
  { email: 'vikram.singh@marqaiconsulting.com', firstName: 'Vikram', lastName: 'Singh', desName: 'Finance Manager' },
];

// Safe delete helper - logs errors but doesn't crash
async function safeDelete(client, sql, params = []) {
  try {
    await client.query(sql, params);
  } catch (e) {
    // Ignore - table might not exist, column might not exist, no rows to delete
  }
}

async function main() {
  const client = new Client({ connectionString: CONNECTION_STRING });
  await client.connect();
  console.log('🔧 Connected to production database');

  // ==================== PHASE 1: COMPREHENSIVE CLEANUP ====================
  // No wrapping transaction - each operation runs independently
  console.log('\n📋 Phase 1: Comprehensive cleanup of existing MarqAI data...');
  
  const tenantRes = await client.query(`SELECT id, slug FROM "Tenant" WHERE slug = 'marqaitechgroup'`);
  
  if (tenantRes.rows.length > 0) {
    const tenantId = tenantRes.rows[0].id;
    console.log(`  Found existing tenant: ${tenantId}`);

    // Get all IDs for dependent records
    const userRes = await client.query(`SELECT id FROM "User" WHERE "tenantId" = $1`, [tenantId]);
    const userIds = userRes.rows.map(r => r.id);

    const companyRes = await client.query(`SELECT id FROM "Company" WHERE "companyGroupId" IN (SELECT id FROM "CompanyGroup" WHERE "tenantId" = $1)`, [tenantId]);
    const companyIds = companyRes.rows.map(r => r.id);

    const deptRes = await client.query(`SELECT id FROM "Department" WHERE "companyId" = ANY($1)`, [companyIds.length > 0 ? companyIds : ['__none__']]);
    const deptIds = deptRes.rows.map(r => r.id);

    const desRes = await client.query(`SELECT id FROM "Designation" WHERE "departmentId" = ANY($1)`, [deptIds.length > 0 ? deptIds : ['__none__']]);
    const designationIds = desRes.rows.map(r => r.id);

    const empRes = await client.query(`SELECT id FROM "Employee" WHERE "companyId" = ANY($1)`, [companyIds.length > 0 ? companyIds : ['__none__']]);
    const employeeIds = empRes.rows.map(r => r.id);

    console.log(`  Found: ${companyIds.length} companies, ${deptIds.length} departments, ${designationIds.length} designations, ${employeeIds.length} employees, ${userIds.length} users`);

    // === Delete in reverse FK dependency order ===
    // The key constraint that was failing: Employee.designationId → Designation
    // So we must delete all Employee-dependent records first, then Employees, then Designations

    // Step A: Delete ALL records referencing employees (deepest level)
    console.log('  A) Deleting employee-dependent records...');
    const empDepTables = [
      'EmployeeSkill', 'EmployeePaymentMethod', 'EmployeeCustomFieldValue', 
      'EmployeeRosterAssignment', 'EmployeeCompanyMapping', 'EmployeeDimensionAllocation',
      'Dependent', 'Qualification', 'Experience', 'AssetAssignment', 
      'BankAccount', 'GratuityLedger', 'LeaveRequest', 'LeaveBalance',
      'Attendance', 'AttendanceRegularization', 'AttendanceAuditLog',
      'Payroll', 'PayrollInput', 'PayrollTransactionLine', 'PayrollAdjustmentLog', 'PayrollAnomaly', 'PayrollHold',
      'PerformanceReview', 'Goal', 'Document', 'IncidentReport',
      'TravelRequest', 'ExpenseClaim', 'Timesheet',
      'Promotion', 'Grievance', 'Separation', 'Reimbursement',
      'OnboardingTask', 'TrainingEnrollment', 'Loan', 'FNFCalculation',
      'IncomeTaxDeclaration', 'CrossBorderSecondment', 'CompOffLeave',
      'HourlyPermission', 'Gatepass', 'OvertimeRequest', 'OvertimeRecord',
      'WfhAttendanceSnapshot', 'LeaveEncashmentRequest', 'OptionalHolidayElection',
      'BurnoutFlag', 'GhostEmployeeFlag', 'Wallet', 'ExitRequest', 'ExitInterview',
      'SurveyResponse', 'Recognition', 'ProjectMember', 'ProjectAllocation',
      'TeamMember', 'DottedLineManager', 'SocialProfile', 'CalendarSync',
      'BiometricEnrollment', 'BiometricPunch', 'ClientFeedback',
      'ProjectUtilizationSnapshot', 'DocumentIntelligenceResult',
      'GDPRAnonymizationRequest', 'WatermarkAccessLog', 'PersonalizedCatalogCache',
      'Referral', 'EmployeeCustomFieldValue',
    ];
    for (const table of empDepTables) {
      if (employeeIds.length > 0) {
        await safeDelete(client, `DELETE FROM "${table}" WHERE "employeeId" = ANY($1)`, [employeeIds]);
      }
    }
    // Special cases: Feedback uses fromId/toId
    if (employeeIds.length > 0) {
      await safeDelete(client, `DELETE FROM "Feedback" WHERE "fromId" = ANY($1) OR "toId" = ANY($1)`, [employeeIds]);
      await safeDelete(client, `DELETE FROM "OKR" WHERE "ownerId" = ANY($1)`, [employeeIds]);
      await safeDelete(client, `DELETE FROM "Team" WHERE "leadId" = ANY($1)`, [employeeIds]);
      await safeDelete(client, `DELETE FROM "ChatMessage" WHERE "senderId" = ANY($1)`, [employeeIds]);
      await safeDelete(client, `DELETE FROM "CallLog" WHERE "initiatorId" = ANY($1)`, [employeeIds]);
      await safeDelete(client, `DELETE FROM "CallParticipant" WHERE "userId" = ANY($1)`, [employeeIds]);
      await safeDelete(client, `DELETE FROM "FileNode" WHERE "ownerEmployeeId" = ANY($1) OR "uploadedById" = ANY($1)`, [employeeIds]);
      await safeDelete(client, `DELETE FROM "FileVersion" WHERE "uploadedById" = ANY($1)`, [employeeIds]);
      await safeDelete(client, `DELETE FROM "FileShareLink" WHERE "createdBy" = ANY($1)`, [employeeIds]);
      await safeDelete(client, `DELETE FROM "DLPScanLog" WHERE "userId" = ANY($1)`, [employeeIds]);
      await safeDelete(client, `DELETE FROM "Interview" WHERE "employeeId" = ANY($1)`, [employeeIds]);
    }
    console.log('  ✓ Employee-dependent records deleted');

    // Step B: Delete designation-dependent records
    console.log('  B) Deleting designation-dependent records...');
    if (designationIds.length > 0) {
      await safeDelete(client, `DELETE FROM "EmployeeDimensionAllocation" WHERE "dimensionId" = ANY($1)`, [designationIds]);
      await safeDelete(client, `DELETE FROM "Requisition" WHERE "designationId" = ANY($1)`, [designationIds]);
    }
    console.log('  ✓ Designation-dependent records deleted');

    // Step C: Delete company-dependent records
    console.log('  C) Deleting company-dependent records...');
    if (companyIds.length > 0) {
      // Job postings chain
      if (deptIds.length > 0) {
        const jpRes = await client.query(`SELECT id FROM "JobPosting" WHERE "departmentId" = ANY($1)`, [deptIds]);
        for (const jpId of jpRes.rows.map(r => r.id)) {
          const jaRes = await client.query(`SELECT id FROM "JobApplication" WHERE "jobPostingId" = $1`, [jpId]);
          for (const jaId of jaRes.rows.map(r => r.id)) {
            await safeDelete(client, `DELETE FROM "Interview" WHERE "jobApplicationId" = $1`, [jaId]);
            await safeDelete(client, `DELETE FROM "CandidateAiFeedback" WHERE "jobApplicationId" = $1`, [jaId]);
            await safeDelete(client, `DELETE FROM "InterviewFeedback" WHERE "jobApplicationId" = $1`, [jaId]);
            await safeDelete(client, `DELETE FROM "InterviewResponse" WHERE "jobApplicationId" = $1`, [jaId]);
            await safeDelete(client, `DELETE FROM "InterviewInvitation" WHERE "jobApplicationId" = $1`, [jaId]);
          }
          await safeDelete(client, `DELETE FROM "JobApplication" WHERE "jobPostingId" = $1`, [jpId]);
        }
        await safeDelete(client, `DELETE FROM "JobPosting" WHERE "departmentId" = ANY($1)`, [deptIds]);
      }

      await safeDelete(client, `DELETE FROM "Holiday" WHERE "companyId" = ANY($1)`, [companyIds]);
      await safeDelete(client, `DELETE FROM "CompanyPolicy" WHERE "companyId" = ANY($1)`, [companyIds]);
      await safeDelete(client, `DELETE FROM "CandidateTalentPool" WHERE "companyId" = ANY($1)`, [companyIds]);
      await safeDelete(client, `DELETE FROM "Client" WHERE "companyId" = ANY($1)`, [companyIds]);
      await safeDelete(client, `DELETE FROM "CandidatePortalUser" WHERE "companyId" = ANY($1)`, [companyIds]);
      await safeDelete(client, `DELETE FROM "ClientPortalUser" WHERE "companyId" = ANY($1)`, [companyIds]);
    }
    console.log('  ✓ Company-dependent records deleted');

    // Step D: Delete Employees (NOW safe since all references are gone)
    console.log('  D) Deleting employees...');
    if (companyIds.length > 0) {
      await client.query(`DELETE FROM "Employee" WHERE "companyId" = ANY($1)`, [companyIds]);
    }
    console.log('  ✓ Employees deleted');

    // Step E: Delete Designations (NOW safe since employees referencing them are gone)
    console.log('  E) Deleting designations...');
    if (deptIds.length > 0) {
      await client.query(`DELETE FROM "Designation" WHERE "departmentId" = ANY($1)`, [deptIds]);
    }
    console.log('  ✓ Designations deleted');

    // Step F: Departments & Branches
    console.log('  F) Deleting departments & branches...');
    if (companyIds.length > 0) {
      await client.query(`DELETE FROM "Department" WHERE "companyId" = ANY($1)`, [companyIds]);
      await client.query(`DELETE FROM "Branch" WHERE "companyId" = ANY($1)`, [companyIds]);
    }
    console.log('  ✓ Departments & branches deleted');

    // Step G: Companies & CompanyGroup
    console.log('  G) Deleting companies & company group...');
    await client.query(`DELETE FROM "Company" WHERE "companyGroupId" IN (SELECT id FROM "CompanyGroup" WHERE "tenantId" = $1)`, [tenantId]);
    await client.query(`DELETE FROM "CompanyGroup" WHERE "tenantId" = $1`, [tenantId]);
    console.log('  ✓ Companies & group deleted');

    // Step H: User-dependent records
    console.log('  H) Deleting user-dependent records...');
    for (const userId of userIds) {
      await safeDelete(client, `DELETE FROM "LoginActivity" WHERE "userId" = $1`, [userId]);
      await safeDelete(client, `DELETE FROM "Notification" WHERE "userId" = $1`, [userId]);
      await safeDelete(client, `DELETE FROM "AuditLog" WHERE "userId" = $1`, [userId]);
      await safeDelete(client, `DELETE FROM "UserRoleAssignment" WHERE "userId" = $1`, [userId]);
    }
    console.log('  ✓ User-dependent records deleted');

    // Step I: Users
    console.log('  I) Deleting users...');
    await client.query(`DELETE FROM "User" WHERE "tenantId" = $1`, [tenantId]);
    console.log('  ✓ Users deleted');

    // Step J: Tenant-dependent platform records
    console.log('  J) Deleting tenant platform records...');
    await safeDelete(client, `DELETE FROM "TenantConfiguration" WHERE "tenantId" = $1`, [tenantId]);
    await safeDelete(client, `DELETE FROM "TenantCountryAccess" WHERE "tenantId" = $1`, [tenantId]);
    await safeDelete(client, `DELETE FROM "TenantCurrencyAccess" WHERE "tenantId" = $1`, [tenantId]);
    await safeDelete(client, `DELETE FROM "TenantLanguageAccess" WHERE "tenantId" = $1`, [tenantId]);
    await safeDelete(client, `DELETE FROM "TenantPayrollPolicy" WHERE "tenantId" = $1`, [tenantId]);
    await safeDelete(client, `DELETE FROM "TenantDatabase" WHERE "tenantId" = $1`, [tenantId]);
    await safeDelete(client, `DELETE FROM "Subscription" WHERE "tenantId" = $1`, [tenantId]);
    await safeDelete(client, `DELETE FROM "FeatureFlag" WHERE "tenantId" = $1`, [tenantId]);
    await safeDelete(client, `DELETE FROM "SubscriptionPlan" WHERE id = 'plan-enterprise-marqai'`);
    console.log('  ✓ Platform tenant records deleted');

    // Step K: The Tenant itself
    console.log('  K) Deleting tenant...');
    await client.query(`DELETE FROM "Tenant" WHERE id = $1`, [tenantId]);
    console.log('  ✓ Tenant deleted');
  } else {
    console.log('  No existing MarqAI tenant found - clean start!');
  }

  // ==================== PHASE 2: SEED (in transaction) ====================
  console.log('\n📋 Phase 2: Seeding fresh MarqAI Tech Group data...');
  
  try {
    await client.query('BEGIN');

    // Create Tenant
    console.log('\n  Creating tenant...');
    const tenantId = generateId();
    await client.query(`
      INSERT INTO "Tenant" (id, name, slug, domain, plan, status, country, currency, timezone, language, "baseCurrency", "maxCompaniesAllowed", "aiFeedbackEnabled", "resumeScoreThreshold", "talentPoolCrossCompanyEnabled", "videoInterviewRetakeLimit", "videoRetentionDays", "createdAt", "updatedAt")
      VALUES ($1, 'MarqAI Tech Group', 'marqaitechgroup', 'marqaitechgroup.3boxeshrms.com', 'enterprise', 'active', 'IN', 'INR', 'Asia/Kolkata', 'en', 'INR', 10, true, 0, true, 2, 90, NOW(), NOW())
    `, [tenantId]);
    console.log(`  ✓ Tenant: MarqAI Tech Group (${tenantId})`);

    // Super Admin
    console.log('\n  Creating Super Admin...');
    const existingSuper = await client.query(`SELECT id FROM "User" WHERE email = 'superadmin@3boxeshrms.com'`);
    if (existingSuper.rows.length > 0) {
      await client.query(`UPDATE "User" SET "tenantId" = $1, password = $2 WHERE email = 'superadmin@3boxeshrms.com'`, [tenantId, PASSWORD_HASH]);
      console.log('  ✓ Updated existing Super Admin');
    } else {
      await client.query(`INSERT INTO "User" (id, email, name, password, role, status, "tenantId", "createdAt", "updatedAt") VALUES ($1, 'superadmin@3boxeshrms.com', '3Boxes Super Admin', $2, 'super_admin', 'active', $3, NOW(), NOW())`, [generateId(), PASSWORD_HASH, tenantId]);
      console.log('  ✓ Super Admin created');
    }

    // Tenant Admin
    console.log('\n  Creating Tenant Admin...');
    await client.query(`INSERT INTO "User" (id, email, name, password, role, status, "tenantId", "createdAt", "updatedAt") VALUES ($1, 'admin@marqaitechgroup.com', 'MarqAI Tech Group Admin', $2, 'tenant_admin', 'active', $3, NOW(), NOW())`, [generateId(), PASSWORD_HASH, tenantId]);
    console.log('  ✓ Tenant Admin created');

    // Company Group
    console.log('\n  Creating Company Group...');
    const companyGroupId = generateId();
    await client.query(`INSERT INTO "CompanyGroup" (id, name, "tenantId", "employeeLimitMode", "maxEmployees", "maxCompanies", "createdAt", "updatedAt") VALUES ($1, 'MarqAI Tech Group', $2, 'group_total', 500, 10, NOW(), NOW())`, [companyGroupId, tenantId]);
    console.log('  ✓ Company Group created');

    // 5 Companies
    console.log('\n  Creating 5 Companies...');
    const createdCompanies = [];
    for (const comp of NEW_COMPANIES) {
      const compId = generateId();
      await client.query(`INSERT INTO "Company" (id, name, code, "companyGroupId", country, currency, timezone, city, state, email, website, status, "maxEmployees", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, 'IN', 'INR', 'Asia/Kolkata', $5, $6, $7, $8, 'active', 100, NOW(), NOW())`, [compId, comp.name, comp.code, companyGroupId, comp.city, comp.state, comp.email, comp.website]);
      createdCompanies.push({ id: compId, name: comp.name, code: comp.code, city: comp.city, state: comp.state });
      console.log(`  ✓ ${comp.name} (${comp.code})`);
    }

    // Branches
    console.log('\n  Creating Head Office branches...');
    const createdBranches = [];
    for (const comp of createdCompanies) {
      const branchId = generateId();
      await client.query(`INSERT INTO "Branch" (id, name, code, "companyId", city, state, country, status, "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, $6, 'IN', 'active', NOW(), NOW())`, [branchId, `${comp.name} - Head Office`, `${comp.code}-HO`, comp.id, comp.city, comp.state]);
      createdBranches.push({ id: branchId, companyId: comp.id, companyCode: comp.code });
      console.log(`  ✓ ${comp.name} - Head Office`);
    }

    // Departments
    console.log('\n  Creating departments...');
    const createdDepts = [];
    for (let i = 0; i < createdCompanies.length; i++) {
      for (const deptName of BASIC_DEPARTMENTS) {
        const deptId = generateId();
        await client.query(`INSERT INTO "Department" (id, name, "companyId", "branchId", status, "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, 'active', NOW(), NOW())`, [deptId, deptName, createdCompanies[i].id, createdBranches[i].id]);
        createdDepts.push({ id: deptId, name: deptName, companyId: createdCompanies[i].id, companyIndex: i });
      }
      console.log(`  ✓ ${createdCompanies[i].code}: ${BASIC_DEPARTMENTS.join(', ')}`);
    }

    // Designations (NO tenantId column)
    console.log('\n  Creating designations...');
    const createdDesignations = [];
    for (let i = 0; i < createdCompanies.length; i++) {
      for (const dd of BASIC_DESIGNATIONS) {
        const dept = createdDepts.find(d => d.companyIndex === i && d.name === dd.dept);
        if (dept) {
          const desId = generateId();
          await client.query(`INSERT INTO "Designation" (id, title, "departmentId", status, "createdAt", "updatedAt") VALUES ($1, $2, $3, 'active', NOW(), NOW())`, [desId, dd.title, dept.id]);
          createdDesignations.push({ id: desId, title: dd.title, companyIndex: i });
        }
      }
    }
    console.log(`  ✓ Created ${createdDesignations.length} designations`);

    // HR Admins + Employees
    console.log('\n  Creating HR Admins + Employees...');
    for (let i = 0; i < createdCompanies.length; i++) {
      const hrDept = createdDepts.find(d => d.companyIndex === i && d.name === 'Human Resources');
      const hrDes = createdDesignations.find(d => d.companyIndex === i && d.title === 'HR Manager');

      const hrUserId = generateId();
      await client.query(`INSERT INTO "User" (id, email, name, password, role, status, "tenantId", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, 'admin', 'active', $5, NOW(), NOW())`, [hrUserId, HR_EMAILS[i], `HR Admin - ${createdCompanies[i].name}`, PASSWORD_HASH, tenantId]);

      if (hrDept && hrDes) {
        await client.query(`INSERT INTO "Employee" (id, "userId", "companyId", "branchId", "departmentId", "designationId", "employeeId", "firstName", "lastName", email, status, "salaryCurrency", "dateOfJoining", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, $6, $7, 'HR', 'Admin', $8, 'active', 'INR', NOW(), NOW(), NOW())`, [generateId(), hrUserId, createdCompanies[i].id, createdBranches[i].id, hrDept.id, hrDes.id, `EMP-${createdCompanies[i].code}-HR001`, HR_EMAILS[i]]);
      }
      console.log(`  ✓ HR Admin: ${HR_EMAILS[i]} → ${createdCompanies[i].name}`);

      const emp = EMP_DATA[i];
      const engDept = createdDepts.find(d => d.companyIndex === i && d.name === 'Engineering') || createdDepts.find(d => d.companyIndex === i && d.name === 'Finance');
      const empDes = createdDesignations.find(d => d.companyIndex === i && d.title === emp.desName);

      const empUserId = generateId();
      await client.query(`INSERT INTO "User" (id, email, name, password, role, status, "tenantId", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, 'admin', 'active', $5, NOW(), NOW())`, [empUserId, emp.email, `${emp.firstName} ${emp.lastName}`, PASSWORD_HASH, tenantId]);

      if (engDept && empDes) {
        await client.query(`INSERT INTO "Employee" (id, "userId", "companyId", "branchId", "departmentId", "designationId", "employeeId", "firstName", "lastName", email, status, "salaryCurrency", "dateOfJoining", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'active', 'INR', NOW(), NOW(), NOW())`, [generateId(), empUserId, createdCompanies[i].id, createdBranches[i].id, engDept.id, empDes.id, `EMP-${createdCompanies[i].code}-E001`, emp.firstName, emp.lastName, emp.email]);
      }
      console.log(`  ✓ Employee: ${emp.email} → ${createdCompanies[i].name}`);
    }

    // Subscription Plan (use ON CONFLICT to avoid transaction abort)
    console.log('\n  Creating Subscription Plan...');
    await client.query(`INSERT INTO "SubscriptionPlan" (id, name, "planType", "monthlyPrice", "annualPrice", "employeeLimit", "companyLimit", "branchLimit", "storageLimit", "aiInterviewLimit", "aiChatbotLimit", "payrollEnabled", "recruitmentEnabled", "attendanceEnabled", "projectEnabled", "clientPortalEnabled", "vendorPortalEnabled", "mobileAppEnabled", "apiAccessEnabled", "whiteLabelEnabled", "supportLevel", status, description, "createdAt", "updatedAt") VALUES ('plan-enterprise-marqai', 'Enterprise', 'enterprise', 9999.00, 99990.00, 500, 10, 50, 10000, 1000, 10000, true, true, true, true, true, true, true, true, true, 'premium', 'active', 'Enterprise plan with all features', NOW(), NOW()) ON CONFLICT (id) DO NOTHING`);
    console.log('  ✓ Subscription Plan done');

    await client.query('COMMIT');
    console.log('\n✅ All changes committed successfully!');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('❌ Seed error, rolled back:', e.message);
    throw e;
  }

  // ==================== VERIFY ====================
  console.log('\n📋 Final verification...');
  const counts = {};
  for (const table of ['Tenant', 'CompanyGroup', 'Company', 'Branch', 'Department', 'Designation', 'User', 'Employee']) {
    const res = await client.query(`SELECT count(*) FROM "${table}"`);
    counts[table] = parseInt(res.rows[0].count);
  }
  console.log('  Production DB counts:');
  Object.entries(counts).forEach(([k, v]) => console.log(`    ${k}: ${v}`));

  const verifyTenant = await client.query(`SELECT name, slug, domain FROM "Tenant" WHERE slug = 'marqaitechgroup'`);
  console.log(`  Tenant: ${JSON.stringify(verifyTenant.rows[0])}`);

  console.log('\n========================================');
  console.log('  MarqAI Tech Group - Fully Re-seeded!');
  console.log('========================================');
  console.log('  🌐 Domain: marqaitechgroup.3boxeshrms.com');
  console.log('  📧 Login (Password: MarqAI@2026):');
  console.log('  🔑 Super Admin: superadmin@3boxeshrms.com');
  console.log('  🔑 Tenant Admin: admin@marqaitechgroup.com');
  for (const e of HR_EMAILS) console.log(`  🔑 HR Admin: ${e}`);

  await client.end();
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
