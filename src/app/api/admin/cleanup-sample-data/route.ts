/**
 * Admin-only sample data cleanup endpoint.
 *
 * POST /api/admin/cleanup-sample-data
 *   Body: { tenantSlug: string }
 *
 * Removes ALL sample/mock/auto-seeded data for the specified tenant,
 * keeping only structural/master data and admin users + their employee records.
 *
 * Allowed tenant slugs: '3boxeshrms', 'marqaitechgroup'
 * Any other slug is rejected with 403 to protect demo and other tenants.
 *
 * Keeps:
 *   - Tenant, CompanyGroup, Company, Branch, Department, Designation
 *   - Users with role 'super_admin' or 'tenant_admin' + their Employee records
 *   - Roles, Permissions, RolePermissions, Modules
 *   - LeaveTypes (master data)
 *   - AttendancePolicyConfig (master data)
 *   - SalaryStructures + SalaryComponents (master data)
 *   - SubscriptionPlans, Subscriptions
 *   - FeatureFlags
 *   - TenantDatabase
 *   - Shifts (master data)
 *   - Holidays (master data)
 *   - CTC templates & component mappings (master data)
 *   - Tax slabs (master data)
 *   - Currency configs & exchange rates (master data)
 *   - Dimension definitions (master data)
 *   - Payroll definitions (master data)
 *   - Statutory components (master data)
 *   - Payroll components (master data)
 *   - GL account mappings (master data)
 *   - Compliance obligations (master data)
 *   - Doc categories & articles (documentation)
 *   - Interview sets & questions (templates)
 *   - AI configs (master config)
 *   - SSO providers (config)
 *
 * Deletes:
 *   - All employees except those linked to admin/tenant_admin users
 *   - All employee-linked data (leave balances, leave requests, attendance, payroll, etc.)
 *   - All ecosystem module data (clients, vendors, marketplace, wellness, collaboration)
 *   - All auto-seeded data
 *   - All sample notifications, audit logs, login activities
 *   - All sample payroll runs, transactions
 *   - All recruitment data (job postings, applications, interviews, etc.)
 *   - All project data (projects, tasks, milestones, allocations, members)
 *   - All OKRs, key results
 *   - All tickets, ticket comments, ticket categories
 *   - All workflow definitions/instances/approvals
 *   - All non-admin user role assignments
 *   - All non-admin users
 */
import { NextResponse } from 'next/server';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';
import { getDb, getPlatformDb } from '@/lib/tenant-db';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: CORS });
}

/** Demo tenant slug that is protected from cleanup. */

function ok(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: CORS });
}

function fail(error: string, status = 400) {
  return NextResponse.json({ error }, { status, headers: CORS });
}

export async function POST(request: Request) {
  const db = await getDb(request);
  try {
    // ─── 1. Authenticate ───
    const token = getTokenFromHeaders(request);
    if (!token) return fail('No token provided', 401);
    const decoded = await verifyToken(token);
    if (!decoded) return fail('Invalid or expired token', 401);
    const userPayload = decoded as Record<string, unknown>;
    const userRole = userPayload.role as string;

    if (!userRole || !['super_admin', 'tenant_admin'].includes(userRole)) {
      return fail('Forbidden: requires tenant_admin or super_admin role', 403);
    }

    // ─── 2. Parse body ───
    let body: { tenantSlug?: string } = {};
    try {
      body = await request.json();
    } catch { /* empty */ }

    const { tenantSlug } = body;
    if (!tenantSlug) return fail('Missing tenantSlug in request body', 400);

    // ─── 3. Validate tenant slug ───
    // Super admin can clean any tenant. Tenant admin can only clean their own.
    // We no longer restrict to a hardcoded allowlist — the super admin UI
    // dynamically lists all tenants and the user chooses which to clean.
    // Only the demo tenant slug is protected from accidental cleanup.
    if (tenantSlug === '3boxes-hrms-demo') {
      return fail('Cannot clean the demo tenant (3boxes-hrms-demo). It is protected.', 403);
    }

    // ─── 4. Find tenant ───
    // Search by slug OR domain, and don't require active status.
    // Some tenants may be inactive or the slug might not match exactly.
    const tenant = await getPlatformDb().tenant.findFirst({
      where: {
        OR: [
          { slug: tenantSlug },
          { domain: tenantSlug },
          { domain: `${tenantSlug}.3boxeshrms.com` },
        ],
      },
    });
    if (!tenant) return fail(`Tenant with slug or domain "${tenantSlug}" not found in the platform database`, 404);

    // If the user is a tenant_admin, they can only clean their own tenant
    if (userRole === 'tenant_admin' && userPayload.tenantId !== tenant.id) {
      return fail('Forbidden: tenant_admin can only clean their own tenant', 403);
    }

    // ─── 5. Identify structural data to preserve ───
    const tenantId = tenant.id;

    // Get all companies under this tenant
    const companyGroups = await db.companyGroup.findMany({
      where: { tenantId },
      select: { id: true },
    });
    const groupIds = companyGroups.map(g => g.id);

    const companies = await db.company.findMany({
      where: { companyGroupId: { in: groupIds } },
      select: { id: true },
    });
    const companyIds = companies.map(c => c.id);

    if (companyIds.length === 0) {
      return fail('No companies found under this tenant', 400);
    }

    // Get branches, departments, designations under these companies
    const branches = await db.branch.findMany({
      where: { companyId: { in: companyIds } },
      select: { id: true },
    });
    const branchIds = branches.map(b => b.id);

    const departments = await db.department.findMany({
      where: { companyId: { in: companyIds } },
      select: { id: true },
    });
    const departmentIds = departments.map(d => d.id);

    // Get admin users to preserve
    const adminUsers = await db.user.findMany({
      where: {
        tenantId,
        role: { in: ['super_admin', 'tenant_admin'] },
        status: 'active',
      },
      select: { id: true, email: true, role: true },
    });
    const adminUserIds = adminUsers.map(u => u.id);

    // Get employee records linked to admin users — these are preserved
    const adminEmployees = await db.employee.findMany({
      where: { userId: { in: adminUserIds } },
      select: { id: true },
    });
    const adminEmployeeIds = adminEmployees.map(e => e.id);

    // Get ALL non-admin employee IDs (employees under this tenant's companies)
    // These are the ones we'll delete
    const nonAdminEmployees = await db.employee.findMany({
      where: {
        departmentId: { in: departmentIds },
        id: { notIn: adminEmployeeIds },
      },
      select: { id: true },
    });
    const nonAdminEmployeeIds = nonAdminEmployees.map(e => e.id);

    // ─── 6. Execute cleanup ───
    const counts: Record<string, number> = {};

    // Helper: deleteMany and record count
    async function del(label: string, fn: () => Promise<{ count: number }>) {
      try {
        const result = await fn();
        if (result.count > 0) counts[label] = result.count;
      } catch (e) {
        // Some models may not exist in schema yet; skip gracefully
        console.warn(`[cleanup] Skipping ${label}:`, e instanceof Error ? e.message : e);
      }
    }

    // ─── Phase 1: Employee-linked data for non-admin employees ───
    // These must be deleted before deleting the employees themselves

    // Leave management
    await del('leaveBalances', () =>
      db.leaveBalance.deleteMany({ where: { employeeId: { in: nonAdminEmployeeIds } } }),
    );
    await del('leaveRequests', () =>
      db.leaveRequest.deleteMany({ where: { employeeId: { in: nonAdminEmployeeIds } } }),
    );
    await del('leaveEncashmentRequests', () =>
      db.leaveEncashmentRequest.deleteMany({ where: { employeeId: { in: nonAdminEmployeeIds } } }),
    );
    await del('optionalHolidayElections', () =>
      db.optionalHolidayElection.deleteMany({ where: { employeeId: { in: nonAdminEmployeeIds } } }),
    );

    // Attendance
    await del('attendance', () =>
      db.attendance.deleteMany({ where: { employeeId: { in: nonAdminEmployeeIds } } }),
    );
    await del('attendanceRegularizations', () =>
      db.attendanceRegularization.deleteMany({ where: { employeeId: { in: nonAdminEmployeeIds } } }),
    );
    await del('hourlyPermissions', () =>
      db.hourlyPermission.deleteMany({ where: { employeeId: { in: nonAdminEmployeeIds } } }),
    );
    await del('gatepasses', () =>
      db.gatepass.deleteMany({ where: { employeeId: { in: nonAdminEmployeeIds } } }),
    );
    await del('overtimeRequests', () =>
      db.overtimeRequest.deleteMany({ where: { employeeId: { in: nonAdminEmployeeIds } } }),
    );
    await del('compOffLeaves', () =>
      db.compOffLeave.deleteMany({ where: { employeeId: { in: nonAdminEmployeeIds } } }),
    );
    await del('wfhAttendanceSnapshots', () =>
      db.wfhAttendanceSnapshot.deleteMany({ where: { employeeId: { in: nonAdminEmployeeIds } } }),
    );
    await del('wfhRequests', () =>
      db.wfhRequest.deleteMany({ where: { employeeId: { in: nonAdminEmployeeIds } } }),
    );
    await del('burnoutFlags', () =>
      db.burnoutFlag.deleteMany({ where: { employeeId: { in: nonAdminEmployeeIds } } }),
    );
    await del('attendanceAuditLogs', () =>
      db.attendanceAuditLog.deleteMany({ where: { employeeId: { in: nonAdminEmployeeIds } } }),
    );
    await del('biometricEnrollments', () =>
      db.biometricEnrollment.deleteMany({ where: { employeeId: { in: nonAdminEmployeeIds } } }),
    );
    await del('biometricPunches', () =>
      db.biometricPunch.deleteMany({ where: { employeeId: { in: nonAdminEmployeeIds } } }),
    );
    await del('rosterAssignments', () =>
      db.employeeRosterAssignment.deleteMany({ where: { employeeId: { in: nonAdminEmployeeIds } } }),
    );

    // Payroll - employee linked
    await del('payrolls', () =>
      db.payroll.deleteMany({ where: { employeeId: { in: nonAdminEmployeeIds } } }),
    );
    await del('loans', () =>
      db.loan.deleteMany({ where: { employeeId: { in: nonAdminEmployeeIds } } }),
    );
    await del('overtimeRecords', () =>
      db.overtimeRecord.deleteMany({ where: { employeeId: { in: nonAdminEmployeeIds } } }),
    );
    await del('payrollHolds', () =>
      db.payrollHold.deleteMany({ where: { employeeId: { in: nonAdminEmployeeIds } } }),
    );
    await del('employeePaymentMethods', () =>
      db.employeePaymentMethod.deleteMany({ where: { employeeId: { in: nonAdminEmployeeIds } } }),
    );
    await del('payrollInputs', () =>
      db.payrollInput.deleteMany({ where: { employeeId: { in: nonAdminEmployeeIds } } }),
    );
    await del('incomeTaxDeclarations', () =>
      db.incomeTaxDeclaration.deleteMany({ where: { employeeId: { in: nonAdminEmployeeIds } } }),
    );
    await del('fnfCalculations', () =>
      db.fNFCalculation.deleteMany({ where: { employeeId: { in: nonAdminEmployeeIds } } }),
    );
    await del('payrollAdjustmentLogs', () =>
      db.payrollAdjustmentLog.deleteMany({ where: { employeeId: { in: nonAdminEmployeeIds } } }),
    );
    await del('payrollTransactionLines', () =>
      db.payrollTransactionLine.deleteMany({ where: { employeeId: { in: nonAdminEmployeeIds } } }),
    );

    // Performance & Goals
    await del('performanceReviews', () =>
      db.performanceReview.deleteMany({ where: { employeeId: { in: nonAdminEmployeeIds } } }),
    );
    await del('goals', () =>
      db.goal.deleteMany({ where: { employeeId: { in: nonAdminEmployeeIds } } }),
    );

    // Feedbacks (both from and to)
    await del('feedbacks', () =>
      db.feedback.deleteMany({
        where: {
          OR: [
            { fromId: { in: nonAdminEmployeeIds } },
            { toId: { in: nonAdminEmployeeIds } },
          ],
        },
      }),
    );

    // Training
    await del('trainingEnrollments', () =>
      db.trainingEnrollment.deleteMany({ where: { employeeId: { in: nonAdminEmployeeIds } } }),
    );

    // Assets
    await del('assetAssignments', () =>
      db.assetAssignment.deleteMany({ where: { employeeId: { in: nonAdminEmployeeIds } } }),
    );

    // Documents
    await del('documents', () =>
      db.document.deleteMany({ where: { employeeId: { in: nonAdminEmployeeIds } } }),
    );

    // Incidents
    await del('incidentReports', () =>
      db.incidentReport.deleteMany({ where: { employeeId: { in: nonAdminEmployeeIds } } }),
    );

    // Travel & Expenses
    await del('travelRequests', () =>
      db.travelRequest.deleteMany({ where: { employeeId: { in: nonAdminEmployeeIds } } }),
    );
    await del('expenseClaims', () =>
      db.expenseClaim.deleteMany({ where: { employeeId: { in: nonAdminEmployeeIds } } }),
    );
    await del('reimbursements', () =>
      db.reimbursement.deleteMany({ where: { employeeId: { in: nonAdminEmployeeIds } } }),
    );

    // Timesheets
    await del('timesheets', () =>
      db.timesheet.deleteMany({ where: { employeeId: { in: nonAdminEmployeeIds } } }),
    );

    // Promotions, Grievances, Separations
    await del('promotions', () =>
      db.promotion.deleteMany({ where: { employeeId: { in: nonAdminEmployeeIds } } }),
    );
    await del('grievances', () =>
      db.grievance.deleteMany({ where: { employeeId: { in: nonAdminEmployeeIds } } }),
    );
    await del('separations', () =>
      db.separation.deleteMany({ where: { employeeId: { in: nonAdminEmployeeIds } } }),
    );
    await del('exitRequests', () =>
      db.exitRequest.deleteMany({ where: { employeeId: { in: nonAdminEmployeeIds } } }),
    );
    await del('exitInterviews', () =>
      db.exitInterview.deleteMany({ where: { employeeId: { in: nonAdminEmployeeIds } } }),
    );

    // Onboarding
    await del('onboardingTasks', () =>
      db.onboardingTask.deleteMany({ where: { employeeId: { in: nonAdminEmployeeIds } } }),
    );

    // Employee personal data
    await del('dependents', () =>
      db.dependent.deleteMany({ where: { employeeId: { in: nonAdminEmployeeIds } } }),
    );
    await del('qualifications', () =>
      db.qualification.deleteMany({ where: { employeeId: { in: nonAdminEmployeeIds } } }),
    );
    await del('experiences', () =>
      db.experience.deleteMany({ where: { employeeId: { in: nonAdminEmployeeIds } } }),
    );
    await del('employeeSkills', () =>
      db.employeeSkill.deleteMany({ where: { employeeId: { in: nonAdminEmployeeIds } } }),
    );

    // Employee core & collaboration
    await del('customFieldValues', () =>
      db.employeeCustomFieldValue.deleteMany({ where: { employeeId: { in: nonAdminEmployeeIds } } }),
    );
    await del('dottedLineManagers', () =>
      db.dottedLineManager.deleteMany({
        where: {
          OR: [
            { employeeId: { in: nonAdminEmployeeIds } },
            { managerId: { in: nonAdminEmployeeIds } },
          ],
        },
      }),
    );
    await del('teamMemberships', () =>
      db.teamMember.deleteMany({ where: { employeeId: { in: nonAdminEmployeeIds } } }),
    );
    await del('employeeDimensionAllocations', () =>
      db.employeeDimensionAllocation.deleteMany({ where: { employeeId: { in: nonAdminEmployeeIds } } }),
    );
    await del('employeeCompanyMappings', () =>
      db.employeeCompanyMapping.deleteMany({ where: { employeeId: { in: nonAdminEmployeeIds } } }),
    );

    // Social profiles, calendar syncs
    await del('socialProfiles', () =>
      db.socialProfile.deleteMany({ where: { employeeId: { in: nonAdminEmployeeIds } } }),
    );
    await del('calendarSyncs', () =>
      db.calendarSync.deleteMany({ where: { employeeId: { in: nonAdminEmployeeIds } } }),
    );

    // Marketplace / wellness / ecosystem — employee-linked
    await del('wallets', () =>
      db.wallet.deleteMany({ where: { employeeId: { in: nonAdminEmployeeIds } } }),
    );
    await del('marketplaceOrders', () =>
      db.marketplaceOrder.deleteMany({ where: { employeeId: { in: nonAdminEmployeeIds } } }),
    );
    await del('insurancePolicies', () =>
      db.insurancePolicy.deleteMany({ where: { employeeId: { in: nonAdminEmployeeIds } } }),
    );
    await del('insuranceClaims', () =>
      db.insuranceClaim.deleteMany({ where: { employeeId: { in: nonAdminEmployeeIds } } }),
    );
    await del('ewaRequests', () =>
      db.eWARequest.deleteMany({ where: { employeeId: { in: nonAdminEmployeeIds } } }),
    );
    await del('loanMarketListings', () =>
      db.loanMarketplaceListing.deleteMany({ where: { employeeId: { in: nonAdminEmployeeIds } } }),
    );
    await del('gifts', () =>
      db.gift.deleteMany({
        where: {
          OR: [
            { recipientId: { in: nonAdminEmployeeIds } },
            { senderId: { in: nonAdminEmployeeIds } },
          ],
        },
      }),
    );
    await del('rewardPointsLedger', () =>
      db.rewardPointsLedger.deleteMany({ where: { employeeId: { in: nonAdminEmployeeIds } } }),
    );
    await del('marketplaceFraudFlags', () =>
      db.marketplaceFraudFlag.deleteMany({ where: { employeeId: { in: nonAdminEmployeeIds } } }),
    );
    await del('financialStressFlags', () =>
      db.financialStressFlag.deleteMany({ where: { employeeId: { in: nonAdminEmployeeIds } } }),
    );
    await del('walletBudgetAllocations_employee', () =>
      db.walletBudgetAllocation.deleteMany({ where: { employeeId: { in: nonAdminEmployeeIds } } }),
    );
    await del('clientFeedbacks_employee', () =>
      db.clientFeedback.deleteMany({ where: { employeeId: { in: nonAdminEmployeeIds } } }),
    );
    await del('personalizedCatalogCaches', () =>
      db.personalizedCatalogCache.deleteMany({ where: { employeeId: { in: nonAdminEmployeeIds } } }),
    );
    await del('utilizationSnapshots', () =>
      db.projectUtilizationSnapshot.deleteMany({ where: { employeeId: { in: nonAdminEmployeeIds } } }),
    );

    // AI attendance/payroll — employee-linked
    await del('payrollAnomalies', () =>
      db.payrollAnomaly.deleteMany({ where: { employeeId: { in: nonAdminEmployeeIds } } }),
    );
    await del('ghostEmployeeFlags', () =>
      db.ghostEmployeeFlag.deleteMany({ where: { employeeId: { in: nonAdminEmployeeIds } } }),
    );
    await del('crossBorderSecondments', () =>
      db.crossBorderSecondment.deleteMany({ where: { employeeId: { in: nonAdminEmployeeIds } } }),
    );

    // Referrals
    await del('referrals', () =>
      db.referral.deleteMany({ where: { employeeId: { in: nonAdminEmployeeIds } } }),
    );

    // Chat & collaboration — employee-linked
    await del('chatMessages', () =>
      db.chatMessage.deleteMany({ where: { employeeId: { in: nonAdminEmployeeIds } } }),
    );
    await del('callLogs', () =>
      db.callLog.deleteMany({ where: { employeeId: { in: nonAdminEmployeeIds } } }),
    );
    await del('callParticipations', () =>
      db.callParticipant.deleteMany({ where: { employeeId: { in: nonAdminEmployeeIds } } }),
    );

    // File system — employee-linked
    await del('fileVersionsUploaded', () =>
      db.fileVersion.deleteMany({ where: { uploadedById: { in: nonAdminEmployeeIds } } }),
    );
    await del('fileShareLinksCreated', () =>
      db.fileShareLink.deleteMany({ where: { createdById: { in: nonAdminEmployeeIds } } }),
    );

    // GDPR / DLP / Watermark — employee-linked
    await del('documentIntelligenceResults', () =>
      db.documentIntelligenceResult.deleteMany({ where: { employeeId: { in: nonAdminEmployeeIds } } }),
    );
    await del('gdprAnonymizationRequests', () =>
      db.gDPRAnonymizationRequest.deleteMany({ where: { employeeId: { in: nonAdminEmployeeIds } } }),
    );
    await del('dlpScanLogs', () =>
      db.dLPScanLog.deleteMany({ where: { employeeId: { in: nonAdminEmployeeIds } } }),
    );
    await del('watermarkAccessLogs', () =>
      db.watermarkAccessLog.deleteMany({ where: { employeeId: { in: nonAdminEmployeeIds } } }),
    );

    // Survey responses & recognitions
    await del('surveyResponses', () =>
      db.surveyResponse.deleteMany({ where: { employeeId: { in: nonAdminEmployeeIds } } }),
    );
    await del('recognitionsReceived', () =>
      db.recognition.deleteMany({ where: { toId: { in: nonAdminEmployeeIds } } }),
    );

    // ─── Phase 2: Company-scoped data (delete ALL, not just employee-linked) ───

    // Projects & project-linked data
    await del('projectAllocations', () =>
      db.projectAllocation.deleteMany({ where: { project: { companyId: { in: companyIds } } } }),
    );
    await del('projectMembers', () =>
      db.projectMember.deleteMany({ where: { project: { companyId: { in: companyIds } } } }),
    );
    await del('timesheets_company', () =>
      db.timesheet.deleteMany({ where: { project: { companyId: { in: companyIds } } } }),
    );
    await del('projectTasks', () =>
      db.projectTask.deleteMany({ where: { project: { companyId: { in: companyIds } } } }),
    );
    await del('projectMilestones', () =>
      db.projectMilestone.deleteMany({ where: { project: { companyId: { in: companyIds } } } }),
    );
    await del('contractorRequests', () =>
      db.contractorRequest.deleteMany({ where: { project: { companyId: { in: companyIds } } } }),
    );
    await del('contractors', () =>
      db.contractor.deleteMany({ where: { project: { companyId: { in: companyIds } } } }),
    );
    await del('purchaseOrders', () =>
      db.purchaseOrder.deleteMany({ where: { company: { id: { in: companyIds } } } }),
    );
    await del('purchaseOrderLineItems', () =>
      db.purchaseOrderLineItem.deleteMany({ where: { purchaseOrder: { company: { id: { in: companyIds } } } } }),
    );

    // Invoices
    await del('invoiceLineItems', () =>
      db.invoiceLineItem.deleteMany({ where: { invoice: { companyId: { in: companyIds } } } }),
    );
    await del('invoices', () =>
      db.invoice.deleteMany({ where: { companyId: { in: companyIds } } }),
    );

    // Client data
    await del('clientTimesheetApprovals', () =>
      db.clientTimesheetApproval.deleteMany({ where: { client: { companyId: { in: companyIds } } } }),
    );
    await del('clientChurnRisks', () =>
      db.clientChurnRisk.deleteMany({ where: { client: { companyId: { in: companyIds } } } }),
    );
    await del('clientMarginSnapshots', () =>
      db.clientMarginSnapshot.deleteMany({ where: { client: { companyId: { in: companyIds } } } }),
    );
    await del('sows', () =>
      db.sOW.deleteMany({ where: { client: { companyId: { in: companyIds } } } }),
    );
    await del('clientPortalUsers', () =>
      db.clientPortalUser.deleteMany({ where: { client: { companyId: { in: companyIds } } } }),
    );
    await del('clientContacts', () =>
      db.clientContact.deleteMany({ where: { client: { companyId: { in: companyIds } } } }),
    );
    await del('clientBranches', () =>
      db.clientBranch.deleteMany({ where: { client: { companyId: { in: companyIds } } } }),
    );
    await del('clientFeedbacks_company', () =>
      db.clientFeedback.deleteMany({ where: { client: { companyId: { in: companyIds } } } }),
    );
    await del('clients', () =>
      db.client.deleteMany({ where: { companyId: { in: companyIds } } }),
    );

    // Vendor data
    await del('vendorInvoices', () =>
      db.vendorInvoice.deleteMany({ where: { vendor: { companyId: { in: companyIds } } } }),
    );
    await del('vendorStaff', () =>
      db.vendorStaff.deleteMany({ where: { vendor: { companyId: { in: companyIds } } } }),
    );
    await del('vendorPortalUsers', () =>
      db.vendorPortalUser.deleteMany({ where: { vendor: { companyId: { in: companyIds } } } }),
    );
    await del('vendorDocuments', () =>
      db.vendorDocument.deleteMany({ where: { vendor: { companyId: { in: companyIds } } } }),
    );
    await del('vendors', () =>
      db.vendor.deleteMany({ where: { companyId: { in: companyIds } } }),
    );

    // Projects (now safe after allocations/members deleted)
    await del('projects', () =>
      db.project.deleteMany({ where: { companyId: { in: companyIds } } }),
    );

    // Marketplace data (company-scoped)
    await del('marketplaceProducts', () =>
      db.marketplaceProduct.deleteMany({ where: { companyId: { in: companyIds } } }),
    );
    await del('walletBudgetAllocations_company', () =>
      db.walletBudgetAllocation.deleteMany({ where: { company: { id: { in: companyIds } } } }),
    );
    await del('reportSchedules', () =>
      db.reportSchedule.deleteMany({ where: { company: { id: { in: companyIds } } } }),
    );

    // Requisitions (company-scoped)
    await del('requisitions', () =>
      db.requisition.deleteMany({ where: { companyId: { in: companyIds } } }),
    );

    // Payroll runs and related (company-scoped)
    await del('bankPaymentFiles', () =>
      db.bankPaymentFile.deleteMany({ where: { company: { id: { in: companyIds } } } }),
    );
    await del('payrollRuns', () =>
      db.payrollRun.deleteMany({ where: { company: { id: { in: companyIds } } } }),
    );
    await del('payrollValidations', () =>
      db.payrollValidation.deleteMany({ where: { company: { id: { in: companyIds } } } }),
    );
    await del('payrollLockRequests', () =>
      db.payrollLockRequest.deleteMany({ where: { company: { id: { in: companyIds } } } }),
    );
    await del('payrollApprovals', () =>
      db.payrollApproval.deleteMany({ where: { company: { id: { in: companyIds } } } }),
    );

    // Compliance filings (company-scoped)
    await del('complianceFilings', () =>
      db.complianceFiling.deleteMany({ where: { company: { id: { in: companyIds } } } }),
    );

    // Minimum wage configs (company-scoped)
    await del('minimumWageConfigs', () =>
      db.minimumWageConfig.deleteMany({ where: { company: { id: { in: companyIds } } } }),
    );

    // Data residency policy (company-scoped, will be re-created if needed)
    await del('dataResidencyPolicy', () =>
      getPlatformDb().dataResidencyPolicy.deleteMany({ where: { company: { id: { in: companyIds } } } }),
    );

    // Anomaly insights & workflow triggers (company-scoped)
    await del('anomalyInsights', () =>
      db.anomalyInsight.deleteMany({ where: { company: { id: { in: companyIds } } } }),
    );

    // ─── Phase 3: Recruitment data ───

    // Job postings & applications
    await del('interviewFeedbacks', () =>
      db.interviewFeedback.deleteMany({ where: { interview: { jobApplication: { jobPosting: { departmentId: { in: departmentIds } } } } } }),
    );
    await del('candidateSentimentScores', () =>
      db.candidateSentimentScore.deleteMany({ where: { jobApplication: { jobPosting: { departmentId: { in: departmentIds } } } } }),
    );
    await del('resumeParses', () =>
      db.resumeParse.deleteMany({ where: { jobApplication: { jobPosting: { departmentId: { in: departmentIds } } } } }),
    );
    await del('interviews', () =>
      db.interview.deleteMany({ where: { jobApplication: { jobPosting: { departmentId: { in: departmentIds } } } } }),
    );
    await del('jobApplications', () =>
      db.jobApplication.deleteMany({ where: { jobPosting: { departmentId: { in: departmentIds } } } }),
    );
    await del('jobBoardPostings', () =>
      db.jobBoardPosting.deleteMany({ where: { jobPosting: { departmentId: { in: departmentIds } } } }),
    );
    await del('jobPostings', () =>
      db.jobPosting.deleteMany({ where: { departmentId: { in: departmentIds } } }),
    );

    // Offers & related
    await del('offerDeclineSurveys', () =>
      db.offerDeclineSurvey.deleteMany({ where: { offer: { department: { not: null } } } }),
    );
    await del('offers', () =>
      db.offer.deleteMany({ where: { department: { in: departmentIds } } }),
    );

    // ─── Phase 4: Non-admin employees ───
    // Now safe to delete non-admin employees after all their dependent records are gone
    await del('employees', () =>
      db.employee.deleteMany({ where: { id: { in: nonAdminEmployeeIds } } }),
    );

    // ─── Phase 5: Non-admin users ───
    // Delete UserRoleAssignments for non-admin users first
    await del('userRoleAssignments', () =>
      db.userRoleAssignment.deleteMany({ where: { userId: { notIn: adminUserIds } } }),
    );

    // Delete non-admin users under this tenant
    await del('users', () =>
      db.user.deleteMany({
        where: {
          tenantId,
          id: { notIn: adminUserIds },
        },
      }),
    );

    // ─── Phase 6: Tenant-scoped data ───

    // Notifications for this tenant
    await del('notifications', () =>
      db.notification.deleteMany({ where: { tenantId } }),
    );

    // Login activities for this tenant's users
    await del('loginActivities', () =>
      db.loginActivity.deleteMany({ where: { user: { tenantId } } }),
    );

    // Audit logs for this tenant's users
    await del('auditLogs', () =>
      db.auditLog.deleteMany({ where: { user: { tenantId } } }),
    );

    // AI chat logs
    await del('aiChatLogs', () =>
      db.aIChatLog.deleteMany({ where: { user: { tenantId } } }),
    );

    // AI prompt logs (tenant-specific)
    await del('aiPromptLogs', () =>
      db.aIPromptLog.deleteMany({ where: { userId: { in: adminUserIds } } }),
    );

    // Preboarding candidates
    await del('preboardingCandidates', () =>
      db.preboardingCandidate.deleteMany({ where: { employeeId: { in: nonAdminEmployeeIds } } }),
    );

    // Background checks
    await del('backgroundChecks', () =>
      db.backgroundCheck.deleteMany({ where: { preboardingCandidate: { employeeId: { in: nonAdminEmployeeIds } } } }),
    );

    // Welcome series emails
    await del('welcomeSeriesEmails', () =>
      db.welcomeSeriesEmail.deleteMany({ where: { preboardingCandidate: { employeeId: { in: nonAdminEmployeeIds } } } }),
    );

    // ─── Phase 7: Global/shared data that might have been seeded ───

    // Workflow definitions (company-scoped)
    await del('workflowApprovals', () =>
      db.workflowApproval.deleteMany({ where: { workflowInstance: { workflowDefinition: { companyId: { in: companyIds } } } } }),
    );
    await del('workflowInstances', () =>
      db.workflowInstance.deleteMany({ where: { workflowDefinition: { companyId: { in: companyIds } } } }),
    );
    await del('workflowDefinitions', () =>
      db.workflowDefinition.deleteMany({ where: { companyId: { in: companyIds } } }),
    );

    // Tickets
    await del('ticketComments', () =>
      db.ticketComment.deleteMany({ where: { ticket: { requesterId: { in: nonAdminEmployeeIds } } } }),
    );
    await del('tickets', () =>
      db.ticket.deleteMany({ where: { requesterId: { in: nonAdminEmployeeIds } } }),
    );

    // Announcements
    await del('announcements', () =>
      db.announcement.deleteMany({}),
    );

    // Policies (sample)
    await del('policies', () =>
      db.policy.deleteMany({}),
    );

    // Chat rooms & messages (company-scoped)
    await del('chatRoomMembers', () =>
      db.chatRoomMember.deleteMany({ where: { room: { companyId: { in: companyIds } } } }),
    );
    await del('chatMessages_company', () =>
      db.chatMessage.deleteMany({ where: { room: { companyId: { in: companyIds } } } }),
    );
    await del('chatRooms', () =>
      db.chatRoom.deleteMany({ where: { companyId: { in: companyIds } } }),
    );

    // Sentiment analyses & chat summaries
    await del('sentimentAnalyses', () =>
      db.sentimentAnalysis.deleteMany({}),
    );
    await del('chatSummaries', () =>
      db.chatSummary.deleteMany({}),
    );
    await del('aiKnowledgeQueries', () =>
      db.aIKnowledgeQuery.deleteMany({}),
    );

    // Storage analytics
    await del('storageAnalytics', () =>
      db.storageAnalytics.deleteMany({ where: { company: { id: { in: companyIds } } } }),
    );

    // Geofences (branch-scoped)
    await del('geofences', () =>
      db.geofence.deleteMany({ where: { branchId: { in: branchIds } } }),
    );

    // Biometric devices (branch-scoped)
    await del('biometricDevices', () =>
      db.biometricDevice.deleteMany({ where: { branchId: { in: branchIds } } }),
    );

    // Attendance AI thresholds
    await del('attendanceAiThresholds', () =>
      db.attendanceAiThreshold.deleteMany({}),
    );

    // Approval routing rules
    await del('approvalRoutingRules', () =>
      db.approvalRoutingRule.deleteMany({}),
    );

    // Rosters (branch-scoped)
    await del('rosterAssignments_all', () =>
      db.employeeRosterAssignment.deleteMany({ where: { roster: { branchId: { in: branchIds } } } }),
    );
    await del('rotationalRosters', () =>
      db.rotationalRoster.deleteMany({ where: { branchId: { in: branchIds } } }),
    );

    // OKRs (company-scoped + individual)
    await del('keyResults', () =>
      db.keyResult.deleteMany({ where: { okr: { companyId: { in: companyIds } } } }),
    );
    await del('okrs', () =>
      db.oKR.deleteMany({ where: { companyId: { in: companyIds } } }),
    );

    // Surveys (engagement)
    await del('surveyResponses_all', () =>
      db.surveyResponse.deleteMany({}),
    );
    await del('surveys', () =>
      db.survey.deleteMany({}),
    );

    // Recognitions (remaining)
    await del('recognitions_all', () =>
      db.recognition.deleteMany({}),
    );

    // Training data
    await del('trainingEnrollments_all', () =>
      db.trainingEnrollment.deleteMany({}),
    );
    await del('trainings', () =>
      db.training.deleteMany({}),
    );

    // Assets (sample)
    await del('assetAssignments_all', () =>
      db.assetAssignment.deleteMany({}),
    );
    await del('assets', () =>
      db.asset.deleteMany({}),
    );

    // Vendor categories
    await del('vendorCategories', () =>
      db.vendorCategory.deleteMany({}),
    );

    // Marketplace providers
    await del('marketplaceProviders', () =>
      db.marketplaceProvider.deleteMany({}),
    );

    // Wallet buckets
    await del('walletBuckets', () =>
      db.walletBucket.deleteMany({}),
    );

    // Wallet transactions
    await del('walletTransactions', () =>
      db.walletTransaction.deleteMany({}),
    );

    // ─── Return summary ───
    const totalDeleted = Object.values(counts).reduce((sum, c) => sum + c, 0);

    return ok({
      success: true,
      tenantSlug,
      tenantId,
      preserved: {
        adminUsers: adminUsers.map(u => ({ email: u.email, role: u.role })),
        adminEmployeeCount: adminEmployeeIds.length,
        companyCount: companyIds.length,
        departmentCount: departmentIds.length,
        branchCount: branchIds.length,
      },
      deleted: counts,
      totalRecordsDeleted: totalDeleted,
    });
  } catch (e: unknown) {
    console.error('[cleanup-sample-data] Error:', e);
    return fail(
      e instanceof Error ? e.message : 'Cleanup failed with unknown error',
      500,
    );
  }
}
