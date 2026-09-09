/**
 * Cleanup Script V2: Remove all sample data from production DB, keep only live data
 * Uses individual transactions per step to avoid cascading rollback
 */

const { Pool } = require('@neondatabase/serverless');

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_pxZd8woKe4WB@ep-blue-fire-aqk8jxd2-pooler.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require';

const KEEP_TENANT_IDS = ["'cmrmr3ntfe522ce1f3f1e37c6e7'"];
const KEEP_COMPANY_GROUP_IDS = ["'cmrmr3ntg3oc7dad0a4bb8385f7'"];
const KEEP_COMPANY_IDS = [
  "'cmrmr3ntga2ecb95cccbe4a3e2d'", "'cmrmr3ntggiaef373e0086cd965'",
  "'cmrmr3ntgmsee49e9f8864a6b17'", "'cmrmr3ntgt3e0bcea09637af7ec'"
];
const KEEP_USER_IDS = [
  "'cm8g6qmrrvtsrykyjd9l2o19'", "'cms497veoxsc4thgcoukoaqd'",
  "'cmrmr3ntfqw14da35c099aca4cd'", "'cmrmr3ntfxd76084e0ece18a003'",
  "'cmrmr3osxsv140aa8a46ff03cb0'", "'cmrmr3osyya168d12d904ac8a58'",
  "'cmrmr3ot036acf4e4774e7385cb'", "'cmrmr3ot183b00cf69fc0ce35d0'"
];
const KEEP_EMPLOYEE_IDS = [
  "'cmrmr3osym548ec5d41642126d5'", "'cmrmr3oszrid7e06fc5b880e77a'",
  "'cmrmr3ot0we991c3c2187d5bd16'", "'cmrmr3ot21ade88508024b15c35'"
];

const SUPER_ADMIN_ROLE_ID = 'cmq5hzasx006s04l80lrw1mml';
const TENANT_ADMIN_ROLE_ID = 'cmq5hzate006t04l8gupeoeap';
const ADMIN_ROLE_ID = 'role-admin-1783064198935';
const PLATFORM_ADMIN_USER_ID = 'cm8g6qmrrvtsrykyjd9l2o19';

const keepUserIn = KEEP_USER_IDS.join(',');
const keepCompIn = KEEP_COMPANY_IDS.join(',');
const keepTenantIn = KEEP_TENANT_IDS.join(',');
const keepGroupIn = KEEP_COMPANY_GROUP_IDS.join(',');
const keepEmpIn = KEEP_EMPLOYEE_IDS.join(',');

async function runStep(pool, stepName, sql) {
  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(sql);
      await client.query('COMMIT');
      console.log(`✅ ${stepName}: ${result.rowCount} rows affected`);
      return result.rowCount;
    } catch (e) {
      await client.query('ROLLBACK');
      console.log(`⚠️  ${stepName}: skipped (${e.message.split('\n')[0]})`);
      return 0;
    } finally {
      client.release();
    }
  } catch (e) {
    console.log(`⚠️  ${stepName}: connection error (${e.message.split('\n')[0]})`);
    return 0;
  }
}

async function main() {
  const pool = new Pool({ connectionString: CONNECTION_STRING });

  console.log('🧹 Starting sample data cleanup V2...\n');

  // ==========================================
  // PHASE 1: Delete employee-dependent data for sample employees
  // ==========================================
  console.log('--- Phase 1: Employee-dependent data ---');
  
  const sampleEmpIds = await pool.query(`SELECT id FROM "Employee" WHERE id NOT IN (${keepEmpIn})`);
  if (sampleEmpIds.rows.length > 0) {
    const empList = sampleEmpIds.rows.map(r => `'${r.id}'`).join(',');
    
    const empDepTables = [
      'TimesheetEntry', 'TimesheetApproval', 'TimesheetBillingSync', 'TimesheetPayrollSync', 'Timesheet',
      'LeaveAttachment', 'LeaveRequest', 'LeaveBalance', 'CompOff', 'CompOffLeave',
      'AttendanceRegularization', 'AttendanceAuditLog', 'Attendance',
      'PayrollRecord', 'PayrollTransactionLine', 'PayrollTransaction', 'PayrollInput', 
      'PayrollHold', 'PayrollAdjustmentLog', 'Payroll',
      'Document', 'PerformanceReview', 'Goal', 'KeyResult', 'OKR',
      'TrainingEnrollment', 'Training', 'AssetAssignment',
      'IncidentReport', 'TravelRequest', 'ExpenseClaim',
      'Feedback', 'Promotion', 'Grievance', 'Separation',
      'OnboardingTask', 'Reimbursement', 'ProjectAllocation', 'ProjectMember',
      'FNFCalculation', 'EmployeePaymentMethod', 'Loan',
      'OvertimeRecord', 'OvertimeRequest',
      'IncomeTaxDeclaration', 'PayrollAnomaly', 'GhostEmployeeFlag',
      'CrossBorderSecondment', 'EmployeeCustomFieldValue',
      'DottedLineManager', 'TeamMember',
      'HourlyPermission', 'Gatepass',
      'WfhAttendanceSnapshot', 'EmployeeRosterAssignment',
      'LeaveEncashmentRequest', 'OptionalHolidayElection', 'BurnoutFlag',
      'BiometricEnrollment', 'BiometricPunch',
      'Wallet', 'WalletTransaction', 'WalletBucket', 'WalletBudgetAllocation',
      'MarketplaceOrder', 'MarketplaceFraudFlag',
      'InsurancePolicy', 'InsuranceClaim', 'EWARequest', 'LoanMarketplaceListing',
      'Gift', 'RewardPointsLedger', 'FinancialStressFlag',
      'ClientFeedback', 'PersonalizedCatalogCache', 'ProjectUtilizationSnapshot',
      'Referral', 'SocialProfile', 'CalendarSync', 'ChatMessage', 'CallLog', 'CallParticipant',
      'FileVersion', 'FileShareLink', 'FileNode',
      'DocumentIntelligenceResult', 'GDPRAnonymizationRequest', 'DLPScanLog', 'WatermarkAccessLog',
      'ExitRequest', 'ExitInterview', 'SurveyResponse', 'Recognition',
      'Dependent', 'Qualification', 'Experience', 'EmployeeSkill',
      'ReviewCycle', 'HelpdeskTicket', 'HelpdeskTicketComment',
      'PersonalizedCatalogCache',
    ];
    
    for (const table of empDepTables) {
      await runStep(pool, `Delete from ${table}`, `DELETE FROM "${table}" WHERE "employeeId" IN (${empList})`);
    }
  }

  // ==========================================
  // PHASE 2: Delete sample employees
  // ==========================================
  console.log('\n--- Phase 2: Sample employees ---');
  await runStep(pool, 'Delete sample employees', `DELETE FROM "Employee" WHERE id NOT IN (${keepEmpIn})`);

  // ==========================================
  // PHASE 3: Delete user-dependent data for sample users
  // ==========================================
  console.log('\n--- Phase 3: User-dependent data ---');
  await runStep(pool, 'Delete sample UserRoleAssignments', `DELETE FROM "UserRoleAssignment" WHERE "userId" NOT IN (${keepUserIn})`);
  await runStep(pool, 'Delete sample Notifications', `DELETE FROM "Notification" WHERE "userId" NOT IN (${keepUserIn})`);
  await runStep(pool, 'Delete sample AuditLogs', `DELETE FROM "AuditLog" WHERE "userId" NOT IN (${keepUserIn})`);
  await runStep(pool, 'Delete sample LoginActivities', `DELETE FROM "LoginActivity" WHERE "userId" NOT IN (${keepUserIn})`);
  
  // ==========================================
  // PHASE 4: Delete sample users
  // ==========================================
  console.log('\n--- Phase 4: Sample users ---');
  await runStep(pool, 'Delete sample users', `DELETE FROM "User" WHERE id NOT IN (${keepUserIn})`);

  // ==========================================
  // PHASE 5: Delete company-dependent sample data
  // ==========================================
  console.log('\n--- Phase 5: Company-dependent data ---');
  
  // Get sample company IDs
  const sampleCompIds = await pool.query(`SELECT id FROM "Company" WHERE id NOT IN (${keepCompIn})`);
  if (sampleCompIds.rows.length > 0) {
    const compList = sampleCompIds.rows.map(r => `'${r.id}'`).join(',');
    
    // Delete dependent data for sample companies
    const compDepTables = [
      'Requisition', 'JobPosting', 'SalaryStructure', 'SalaryComponent',
      'Invoice', 'InvoiceLineItem', 'PayrollDefinition', 'PayrollRun', 'PayrollCalendar',
      'PayrollComponent', 'PayrollValidation', 'PayrollBankFile', 'PayrollApproval',
      'PayrollStatutory', 'PayrollReport', 'PayrollLockRequest', 'PayrollStructure',
      'BankPaymentFile', 'AccountExpense', 'AccountInvoice', 'AccountJournal',
      'AccountLedger', 'AccountReceipt', 'AccountVendorPayout',
      'PayrollTax', 'TaxSlabTable', 'TaxSlabRateLine', 'StatutoryComponent',
      'CTCComponentMapping', 'CTCTemplate', 'FormulaTemplate',
      'GLAccountMapping', 'FxRate', 'ExchangeRate', 'CurrencyConfig',
      'MinimumWageConfig', 'DataResidencyPolicy',
      'ClientBranch', 'PurchaseOrder', 'PurchaseOrderLineItem',
      'VendorInvoice', 'VendorDocument', 'VendorCategory',
      'WalletBudgetAllocation', 'ReportSchedule',
      'Holiday', 'LeavePolicy', 'LeaveType', 'AttendancePolicy', 'AttendancePolicyConfig',
      'AttendanceAiThreshold', 'WeeklyOffPolicy', 'RotationalRoster', 'Shift', 'ShiftMember',
      'Geofence', 'BiometricDevice',
      'Offer', 'OfferTemplate', 'BackgroundCheck', 'Onboarding', 'OnboardingChecklist',
      'OnboardingTaskTemplate', 'OnboardingRecord', 'PreboardingCandidate',
      'Project', 'ProjectContract', 'ProjectMilestone', 'ProjectTask', 'ProjectCosting',
      'ProjectInvoice', 'Client', 'ClientContact',
      'Interview', 'InterviewFeedback', 'InterviewInvitation', 'InterviewResponse',
      'InterviewSession', 'InterviewSet', 'InterviewSetQuestion',
      'WorkflowDefinition', 'WorkflowStepDef',
      'DocAccessRule', 'DocArticle', 'DocCategory',
      'Announcement', 'Policy', 'CompanyPolicy', 'CompanySubscription',
      'EmailTemplate', 'CommunicationPolicy', 'SecuritySetting',
      'ApprovalRoutingRule', 'ComplianceItem', 'ComplianceFiling',
      'ComplianceObligation', 'ComplianceChangeAlert',
    ];
    
    for (const table of compDepTables) {
      await runStep(pool, `Delete from ${table} (company)`, `DELETE FROM "${table}" WHERE "companyId" IN (${compList})`);
    }
  }

  // ==========================================
  // PHASE 6: Delete sample designations, departments, branches
  // ==========================================
  console.log('\n--- Phase 6: Sample designations/departments/branches ---');
  
  const keepDeptIds = await pool.query(`SELECT id FROM "Department" WHERE "companyId" IN (${keepCompIn})`);
  const keepDeptList = keepDeptIds.rows.map(r => `'${r.id}'`).join(',');
  
  await runStep(pool, 'Delete sample designations', `DELETE FROM "Designation" WHERE "departmentId" NOT IN (${keepDeptList})`);
  await runStep(pool, 'Delete sample designations (master)', `DELETE FROM "DesignationMaster" WHERE "companyId" NOT IN (${keepCompIn})`);
  await runStep(pool, 'Delete sample departments', `DELETE FROM "Department" WHERE "companyId" NOT IN (${keepCompIn})`);
  await runStep(pool, 'Delete sample sub-departments', `DELETE FROM "SubDepartment" WHERE "companyId" NOT IN (${keepCompIn})`);
  await runStep(pool, 'Delete sample branches', `DELETE FROM "Branch" WHERE "companyId" NOT IN (${keepCompIn})`);
  await runStep(pool, 'Delete sample office locations', `DELETE FROM "OfficeLocation" WHERE "companyId" NOT IN (${keepCompIn})`);

  // ==========================================
  // PHASE 7: Delete sample companies and groups
  // ==========================================
  console.log('\n--- Phase 7: Sample companies/groups ---');
  await runStep(pool, 'Delete sample companies', `DELETE FROM "Company" WHERE id NOT IN (${keepCompIn})`);
  await runStep(pool, 'Delete sample company groups', `DELETE FROM "CompanyGroup" WHERE id NOT IN (${keepGroupIn})`);

  // ==========================================
  // PHASE 8: Delete tenant-dependent sample data and tenants
  // ==========================================
  console.log('\n--- Phase 8: Sample tenants ---');
  
  // Clean up tenant-dependent data
  const tenantDepTables = [
    'FeatureFlag', 'Subscription', 'Notification', 'SSOProvider',
    'IntegrationSetting', 'AIConfig', 'AIPromptLog', 'AIChatLog',
    'CollaborationFeatureFlag',
  ];
  
  for (const table of tenantDepTables) {
    await runStep(pool, `Delete from ${table} (tenant)`, `DELETE FROM "${table}" WHERE "tenantId" NOT IN (${keepTenantIn})`);
  }
  
  await runStep(pool, 'Delete sample tenants', `DELETE FROM "Tenant" WHERE id NOT IN (${keepTenantIn})`);

  // ==========================================
  // PHASE 9: Clean up other sample data
  // ==========================================
  console.log('\n--- Phase 9: Other sample data ---');
  
  // Clean up recruitment sample data
  await runStep(pool, 'Delete sample candidates', `DELETE FROM "Candidate" WHERE email LIKE '%@nexushrms.com' OR email LIKE '%@3boxeshrms.com' OR email LIKE '%@marqai.com'`);
  await runStep(pool, 'Delete sample jobs', `DELETE FROM "Job" WHERE 1=1`);
  await runStep(pool, 'Delete sample job applications', `DELETE FROM "JobApplication" WHERE 1=1`);
  await runStep(pool, 'Delete sample candidates (portal)', `DELETE FROM "CandidatePortalUser" WHERE 1=1`);
  await runStep(pool, 'Delete sample candidate resumes', `DELETE FROM "CandidateResumeOptimization" WHERE 1=1`);
  await runStep(pool, 'Delete sample candidate PII', `DELETE FROM "CandidatePiiPolicy" WHERE 1=1`);
  await runStep(pool, 'Delete sample candidate consent', `DELETE FROM "CandidateConsent" WHERE 1=1`);
  await runStep(pool, 'Delete sample candidate erasure', `DELETE FROM "CandidateErasureRequest" WHERE 1=1`);
  await runStep(pool, 'Delete sample candidate alerts', `DELETE FROM "CandidateJobAlert" WHERE 1=1`);
  await runStep(pool, 'Delete sample candidate messages', `DELETE FROM "CandidateMessage" WHERE 1=1`);
  await runStep(pool, 'Delete sample candidate feedback', `DELETE FROM "CandidateAiFeedback" WHERE 1=1`);
  await runStep(pool, 'Delete sample candidate sentiment', `DELETE FROM "CandidateSentimentScore" WHERE 1=1`);
  await runStep(pool, 'Delete sample talent pool', `DELETE FROM "CandidateTalentPool" WHERE 1=1`);
  await runStep(pool, 'Delete sample saved jobs', `DELETE FROM "CandidateSavedJob" WHERE 1=1`);
  await runStep(pool, 'Delete sample candidate passwords', `DELETE FROM "CandidatePasswordReset" WHERE 1=1`);
  
  // Clean up other sample tables
  await runStep(pool, 'Delete sample CRM data', `DELETE FROM "CRMAccount" WHERE 1=1`);
  await runStep(pool, 'Delete sample CRM contacts', `DELETE FROM "CRMContact" WHERE 1=1`);
  await runStep(pool, 'Delete sample CRM contracts', `DELETE FROM "CRMContract" WHERE 1=1`);
  await runStep(pool, 'Delete sample CRM deals', `DELETE FROM "CRMDeal" WHERE 1=1`);
  await runStep(pool, 'Delete sample CRM leads', `DELETE FROM "CRMLead" WHERE 1=1`);
  await runStep(pool, 'Delete sample CRM quotes', `DELETE FROM "CRMQuotation" WHERE 1=1`);
  await runStep(pool, 'Delete sample SaaS data', `DELETE FROM "SaaSTenantUsage" WHERE 1=1`);
  await runStep(pool, 'Delete sample vendors', `DELETE FROM "Vendor" WHERE "companyId" NOT IN (${keepCompIn})`);
  await runStep(pool, 'Delete sample vendor staff', `DELETE FROM "VendorStaff" WHERE 1=1`);
  await runStep(pool, 'Delete sample vendor portal', `DELETE FROM "VendorPortalUser" WHERE 1=1`);
  await runStep(pool, 'Delete sample client portal', `DELETE FROM "ClientPortalUser" WHERE 1=1`);
  await runStep(pool, 'Delete sample contractors', `DELETE FROM "Contractor" WHERE 1=1`);
  await runStep(pool, 'Delete sample contractor requests', `DELETE FROM "ContractorRequest" WHERE 1=1`);
  await runStep(pool, 'Delete sample alumni', `DELETE FROM "AlumniRecord" WHERE 1=1`);
  await runStep(pool, 'Delete sample surveys', `DELETE FROM "Survey" WHERE 1=1`);
  await runStep(pool, 'Delete sample survey questions', `DELETE FROM "SurveyQuestion" WHERE 1=1`);
  await runStep(pool, 'Delete sample survey responses', `DELETE FROM "SurveyResponse" WHERE 1=1`);
  await runStep(pool, 'Delete sample kanban', `DELETE FROM "KanbanCardComment" WHERE 1=1`);
  await runStep(pool, 'Delete sample kanban cards', `DELETE FROM "KanbanCard" WHERE 1=1`);
  await runStep(pool, 'Delete sample kanban columns', `DELETE FROM "KanbanColumn" WHERE 1=1`);
  await runStep(pool, 'Delete sample kanban boards', `DELETE FROM "KanbanBoard" WHERE 1=1`);
  await runStep(pool, 'Delete sample tasks', `DELETE FROM "TaskComment" WHERE 1=1`);
  await runStep(pool, 'Delete sample task assignments', `DELETE FROM "TaskAssignment" WHERE 1=1`);
  await runStep(pool, 'Delete sample tasks', `DELETE FROM "Task" WHERE 1=1`);
  await runStep(pool, 'Delete sample knowledge articles', `DELETE FROM "KnowledgeArticle" WHERE 1=1`);
  await runStep(pool, 'Delete sample learning records', `DELETE FROM "LearningRecord" WHERE 1=1`);
  await runStep(pool, 'Delete sample dimension definitions', `DELETE FROM "DimensionDefinition" WHERE 1=1`);
  await runStep(pool, 'Delete sample employee dimensions', `DELETE FROM "EmployeeDimensionAllocation" WHERE 1=1`);
  await runStep(pool, 'Delete sample skills', `DELETE FROM "Skill" WHERE 1=1`);
  await runStep(pool, 'Delete sample employee types', `DELETE FROM "EmployeeType" WHERE 1=1`);
  await runStep(pool, 'Delete sample grade masters', `DELETE FROM "GradeMaster" WHERE 1=1`);
  await runStep(pool, 'Delete sample WFH requests', `DELETE FROM "WFHRequest" WHERE 1=1`);
  await runStep(pool, 'Delete sample On Duty requests', `DELETE FROM "OnDutyRequest" WHERE 1=1`);
  await runStep(pool, 'Delete sample legal holds', `DELETE FROM "LegalHold" WHERE 1=1`);
  await runStep(pool, 'Delete sample storage analytics', `DELETE FROM "StorageAnalytics" WHERE 1=1`);
  await runStep(pool, 'Delete sample storage quota', `DELETE FROM "StorageQuota" WHERE 1=1`);
  await runStep(pool, 'Delete sample SaaS agents', `DELETE FROM "SaaSAgent" WHERE 1=1`);
  await runStep(pool, 'Delete sample SaaS escalation', `DELETE FROM "SaaSEscalationRule" WHERE 1=1`);
  await runStep(pool, 'Delete sample SaaS SLA', `DELETE FROM "SaaSSubscription" WHERE 1=1`);
  await runStep(pool, 'Delete sample SaaS SLA policy', `DELETE FROM "SaaSSLAPolicy" WHERE 1=1`);
  await runStep(pool, 'Delete sample SaaS tickets', `DELETE FROM "SaaSTicketComment" WHERE 1=1`);
  await runStep(pool, 'Delete sample SaaS tickets', `DELETE FROM "SaaSTicket" WHERE 1=1`);
  await runStep(pool, 'Delete sample SaaS transactions', `DELETE FROM "SaaSTransaction" WHERE 1=1`);
  await runStep(pool, 'Delete sample SaaS packages', `DELETE FROM "SaaSPackage" WHERE 1=1`);
  await runStep(pool, 'Delete sample subscription plans', `DELETE FROM "SubscriptionPlan" WHERE 1=1`);
  await runStep(pool, 'Delete sample document type masters', `DELETE FROM "DocumentTypeMaster" WHERE 1=1`);
  await runStep(pool, 'Delete sample resume parses', `DELETE FROM "ResumeParse" WHERE 1=1`);
  await runStep(pool, 'Delete sample sentiment analyses', `DELETE FROM "SentimentAnalysis" WHERE 1=1`);
  await runStep(pool, 'Delete sample anomaly insights', `DELETE FROM "AnomalyInsight" WHERE 1=1`);
  await runStep(pool, 'Delete sample AI interviews', `DELETE FROM "AIInterview" WHERE 1=1`);
  await runStep(pool, 'Delete sample AI knowledge queries', `DELETE FROM "AIKnowledgeQuery" WHERE 1=1`);
  await runStep(pool, 'Delete sample offer decline surveys', `DELETE FROM "OfferDeclineSurvey" WHERE 1=1`);
  await runStep(pool, 'Delete sample welcome series emails', `DELETE FROM "WelcomeSeriesEmail" WHERE 1=1`);
  await runStep(pool, 'Delete sample client churn risks', `DELETE FROM "ClientChurnRisk" WHERE 1=1`);
  await runStep(pool, 'Delete sample client margin snapshots', `DELETE FROM "ClientMarginSnapshot" WHERE 1=1`);
  await runStep(pool, 'Delete sample client timesheet approvals', `DELETE FROM "ClientTimesheetApproval" WHERE 1=1`);
  await runStep(pool, 'Delete sample sub-vendors', `DELETE FROM "SubVendor" WHERE 1=1`);
  await runStep(pool, 'Delete sample sub-vendor resumes', `DELETE FROM "SubVendorResume" WHERE 1=1`);
  await runStep(pool, 'Delete sample group companies', `DELETE FROM "GroupCompany" WHERE 1=1`);
  await runStep(pool, 'Delete sample manpower requisitions', `DELETE FROM "ManpowerRequisition" WHERE 1=1`);
  await runStep(pool, 'Delete sample SOW', `DELETE FROM "SOW" WHERE 1=1`);
  await runStep(pool, 'Delete sample proctoring logs', `DELETE FROM "ProctoringLog" WHERE 1=1`);
  await runStep(pool, 'Delete sample job board postings', `DELETE FROM "JobBoardPosting" WHERE 1=1`);
  await runStep(pool, 'Delete sample job portal candidates', `DELETE FROM "JobPortalCandidate" WHERE 1=1`);
  await runStep(pool, 'Delete sample job portal resumes', `DELETE FROM "JobPortalResume" WHERE 1=1`);
  await runStep(pool, 'Delete sample job interviews', `DELETE FROM "JobInterview" WHERE 1=1`);
  await runStep(pool, 'Delete sample application interviews', `DELETE FROM "ApplicationInterview" WHERE 1=1`);

  // ==========================================
  // PHASE 10: Clean up duplicate modules
  // ==========================================
  console.log('\n--- Phase 10: Duplicate modules ---');
  const dupeModuleIds = ['cmr48gmpb0000f0ogkmwc8v5l', 'cmr48go770007f0og56uaqvux'];
  
  for (const dupeId of dupeModuleIds) {
    try {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const dupeMod = await client.query(`SELECT key FROM "Module" WHERE id = '${dupeId}'`);
        if (dupeMod.rows.length > 0) {
          const dupeKey = dupeMod.rows[0].key;
          let origId = '';
          if (dupeKey === 'super_admin_module') origId = 'cmq5hzapa006704l8qt1zipcw';
          else if (dupeKey === 'tenant_admin_module') origId = 'cmq5hzaqc006e04l8limdfc9m';
          
          if (origId) {
            await client.query(`DELETE FROM "Permission" WHERE "moduleId" = '${dupeId}' AND action IN (SELECT action FROM "Permission" WHERE "moduleId" = '${origId}')`);
            const moved = await client.query(`UPDATE "Permission" SET "moduleId" = '${origId}' WHERE "moduleId" = '${dupeId}'`);
            await client.query(`DELETE FROM "Module" WHERE id = '${dupeId}'`);
            console.log(`✅ Removed dupe module ${dupeKey} (moved ${moved.rowCount} perms)`);
          }
        }
        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK');
        console.log(`⚠️  Dupe module ${dupeId}: skipped`);
      } finally {
        client.release();
      }
    } catch (e) {}
  }

  // ==========================================
  // PHASE 11: Set up RolePermissions for the 3 standard roles
  // ==========================================
  console.log('\n--- Phase 11: RolePermissions ---');
  
  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      // Clear existing role permissions
      await client.query(`DELETE FROM "RolePermission"`);
      
      // Assign all permissions to super_admin
      const allPerms = await client.query(`SELECT id FROM "Permission"`);
      for (const perm of allPerms.rows) {
        await client.query(`
          INSERT INTO "RolePermission" ("id", "roleId", "permissionId", "createdAt", "updatedAt")
          VALUES (gen_random_uuid(), '${SUPER_ADMIN_ROLE_ID}', '${perm.id}', NOW(), NOW())
        `);
      }
      console.log(`✅ Assigned ${allPerms.rows.length} permissions to super_admin`);
      
      // Assign most permissions to tenant_admin (exclude super_admin module)
      const tenantPerms = await client.query(`
        SELECT p.id FROM "Permission" p 
        JOIN "Module" m ON p."moduleId" = m.id 
        WHERE m.key NOT IN ('super_admin', 'super_admin_module')
      `);
      for (const perm of tenantPerms.rows) {
        await client.query(`
          INSERT INTO "RolePermission" ("id", "roleId", "permissionId", "createdAt", "updatedAt")
          VALUES (gen_random_uuid(), '${TENANT_ADMIN_ROLE_ID}', '${perm.id}', NOW(), NOW())
        `);
      }
      console.log(`✅ Assigned ${tenantPerms.rows.length} permissions to tenant_admin`);
      
      // Assign company-level permissions to admin (exclude super_admin, tenant_admin, settings)
      const adminPerms = await client.query(`
        SELECT p.id FROM "Permission" p 
        JOIN "Module" m ON p."moduleId" = m.id 
        WHERE m.key NOT IN ('super_admin', 'super_admin_module', 'tenant_admin', 'tenant_admin_module', 'settings')
      `);
      for (const perm of adminPerms.rows) {
        await client.query(`
          INSERT INTO "RolePermission" ("id", "roleId", "permissionId", "createdAt", "updatedAt")
          VALUES (gen_random_uuid(), '${ADMIN_ROLE_ID}', '${perm.id}', NOW(), NOW())
        `);
      }
      console.log(`✅ Assigned ${adminPerms.rows.length} permissions to admin`);
      
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      console.error('❌ RolePermissions error:', e.message);
    } finally {
      client.release();
    }
  } catch (e) {}

  // ==========================================
  // PHASE 12: Re-create UserRoleAssignments
  // ==========================================
  console.log('\n--- Phase 12: UserRoleAssignments ---');
  
  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      await client.query(`DELETE FROM "UserRoleAssignment"`);
      
      // Super Admin users
      const superAdminUsers = [
        'cm8g6qmrrvtsrykyjd9l2o19',
        'cms497veoxsc4thgcoukoaqd',
        'cmrmr3ntfqw14da35c099aca4cd',
      ];
      for (const userId of superAdminUsers) {
        await client.query(`
          INSERT INTO "UserRoleAssignment" ("id", "userId", "roleId", "companyId", "assignedBy", "createdAt", "updatedAt")
          VALUES (gen_random_uuid(), '${userId}', '${SUPER_ADMIN_ROLE_ID}', NULL, '${PLATFORM_ADMIN_USER_ID}', NOW(), NOW())
        `);
      }
      console.log(`✅ Assigned super_admin role to ${superAdminUsers.length} users`);
      
      // Tenant Admin users
      const tenantAdminUsers = [
        'cmrmr3ntfxd76084e0ece18a003',
      ];
      for (const userId of tenantAdminUsers) {
        await client.query(`
          INSERT INTO "UserRoleAssignment" ("id", "userId", "roleId", "companyId", "assignedBy", "createdAt", "updatedAt")
          VALUES (gen_random_uuid(), '${userId}', '${TENANT_ADMIN_ROLE_ID}', NULL, '${PLATFORM_ADMIN_USER_ID}', NOW(), NOW())
        `);
      }
      console.log(`✅ Assigned tenant_admin role to ${tenantAdminUsers.length} users`);
      
      // Company Admin users
      const companyAdminUsers = [
        { userId: 'cmrmr3osxsv140aa8a46ff03cb0', companyId: 'cmrmr3ntga2ecb95cccbe4a3e2d' },
        { userId: 'cmrmr3osyya168d12d904ac8a58', companyId: 'cmrmr3ntggiaef373e0086cd965' },
        { userId: 'cmrmr3ot036acf4e4774e7385cb', companyId: 'cmrmr3ntgmsee49e9f8864a6b17' },
        { userId: 'cmrmr3ot183b00cf69fc0ce35d0', companyId: 'cmrmr3ntgt3e0bcea09637af7ec' },
      ];
      for (const { userId, companyId } of companyAdminUsers) {
        await client.query(`
          INSERT INTO "UserRoleAssignment" ("id", "userId", "roleId", "companyId", "assignedBy", "createdAt", "updatedAt")
          VALUES (gen_random_uuid(), '${userId}', '${ADMIN_ROLE_ID}', '${companyId}', '${PLATFORM_ADMIN_USER_ID}', NOW(), NOW())
        `);
      }
      console.log(`✅ Assigned admin role to ${companyAdminUsers.length} company admin users`);
      
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      console.error('❌ UserRoleAssignments error:', e.message);
    } finally {
      client.release();
    }
  } catch (e) {}

  // ==========================================
  // FINAL: Verify counts
  // ==========================================
  console.log('\n--- Verification ---');
  const afterCounts = await client => client.query(`
    SELECT 
      (SELECT COUNT(*) FROM "User") as users,
      (SELECT COUNT(*) FROM "Employee") as employees,
      (SELECT COUNT(*) FROM "UserRoleAssignment") as role_assignments,
      (SELECT COUNT(*) FROM "Tenant") as tenants,
      (SELECT COUNT(*) FROM "CompanyGroup") as company_groups,
      (SELECT COUNT(*) FROM "Company") as companies,
      (SELECT COUNT(*) FROM "Department") as departments,
      (SELECT COUNT(*) FROM "Designation") as designations,
      (SELECT COUNT(*) FROM "Branch") as branches,
      (SELECT COUNT(*) FROM "RolePermission") as role_permissions
  `);
  
  const finalClient = await pool.connect();
  try {
    const counts = await finalClient.query(`
      SELECT 
        (SELECT COUNT(*) FROM "User") as users,
        (SELECT COUNT(*) FROM "Employee") as employees,
        (SELECT COUNT(*) FROM "UserRoleAssignment") as role_assignments,
        (SELECT COUNT(*) FROM "Tenant") as tenants,
        (SELECT COUNT(*) FROM "CompanyGroup") as company_groups,
        (SELECT COUNT(*) FROM "Company") as companies,
        (SELECT COUNT(*) FROM "Department") as departments,
        (SELECT COUNT(*) FROM "Designation") as designations,
        (SELECT COUNT(*) FROM "Branch") as branches,
        (SELECT COUNT(*) FROM "RolePermission") as role_permissions
    `);
    console.log('📊 AFTER CLEANUP:', counts.rows[0]);
    
    const users = await finalClient.query(`
      SELECT u.email, u.name, u.role, r.key as role_key, ura."companyId"
      FROM "User" u
      LEFT JOIN "UserRoleAssignment" ura ON u.id = ura."userId"
      LEFT JOIN "Role" r ON ura."roleId" = r.id
      ORDER BY u.role, u.email
    `);
    console.log('\n👥 USERS WITH ROLES:');
    users.rows.forEach(r => {
      console.log(`  ${r.email} | ${r.role} | assigned=${r.role_key || 'none'} | company=${r.companyId || 'global'}`);
    });
    
    const emps = await finalClient.query(`
      SELECT "employeeId", "firstName", "lastName", email, "companyId" FROM "Employee" ORDER BY email
    `);
    console.log('\n👤 EMPLOYEES:');
    emps.rows.forEach(r => {
      console.log(`  ${r.employeeId} | ${r.firstName} ${r.lastName} | ${r.email}`);
    });
  } finally {
    finalClient.release();
  }

  await pool.end();
  console.log('\n✅ Sample data cleanup completed!');
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
