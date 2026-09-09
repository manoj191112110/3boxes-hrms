/**
 * Script to clean sample data from the database.
 * 
 * This removes:
 * - Sample employees (keeping only tenant admin employees)
 * - Sample RBAC user assignments (non-admin roles)
 * - Sample user records (non-admin users)
 * 
 * This keeps:
 * - Tenant admin users/employees
 * - Master data (departments, designations, branches, companies)
 * - Tenant records
 */
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function cleanSampleData() {
  console.log('Starting sample data cleanup...');
  
  try {
    // Step 1: Find all tenant admin users to preserve
    const tenantAdmins = await prisma.user.findMany({
      where: { role: 'tenant_admin' },
      select: { id: true, email: true, tenantId: true }
    });
    console.log(`Found ${tenantAdmins.length} tenant admin users to preserve:`);
    tenantAdmins.forEach(u => console.log(`  - ${u.email} (tenant: ${u.tenantId})`));

    // Step 2: Find all super admin users to preserve
    const superAdmins = await prisma.user.findMany({
      where: { role: 'super_admin' },
      select: { id: true, email: true }
    });
    console.log(`Found ${superAdmins.length} super admin users to preserve:`);
    superAdmins.forEach(u => console.log(`  - ${u.email}`));

    const preserveUserIds = [...tenantAdmins.map(u => u.id), ...superAdmins.map(u => u.id)];
    console.log(`Total users to preserve: ${preserveUserIds.length}`);

    // Step 3: Find employee IDs to preserve (tenant admins)
    const employeesToPreserve = await prisma.employee.findMany({
      where: {
        OR: tenantAdmins.map(u => ({ userId: u.id }))
      },
      select: { id: true, userId: true }
    });
    const preserveEmployeeIds = employeesToPreserve.map(e => e.id);
    console.log(`Found ${preserveEmployeeIds.length} tenant admin employees to preserve`);

    // Step 4: Delete UserRoleAssignments for non-admin users
    const deletedRBAC = await prisma.userRoleAssignment.deleteMany({
      where: {
        userId: { notIn: preserveUserIds }
      }
    });
    console.log(`Deleted ${deletedRBAC.count} sample RBAC user assignments`);

    // Step 5: Delete non-admin employees
    // First delete related records that might have FK constraints
    // Delete Attendance records for sample employees
    const deletedAttendance = await prisma.attendance.deleteMany({
      where: {
        employeeId: { notIn: preserveEmployeeIds }
      }
    });
    console.log(`Deleted ${deletedAttendance.count} sample attendance records`);

    // Delete Leave records for sample employees
    const deletedLeave = await prisma.leave.deleteMany({
      where: {
        employeeId: { notIn: preserveEmployeeIds }
      }
    });
    console.log(`Deleted ${deletedLeave.count} sample leave records`);

    // Delete Payslip records for sample employees
    const deletedPayslips = await prisma.payslip.deleteMany({
      where: {
        employeeId: { notIn: preserveEmployeeIds }
      }
    });
    console.log(`Deleted ${deletedPayslips.count} sample payslip records`);

    // Delete BankAccount records for sample employees
    const deletedBankAccounts = await prisma.bankAccount.deleteMany({
      where: {
        employeeId: { notIn: preserveEmployeeIds }
      }
    });
    console.log(`Deleted ${deletedBankAccounts.count} sample bank account records`);

    // Delete Documents for sample employees
    const deletedDocuments = await prisma.document.deleteMany({
      where: {
        employeeId: { notIn: preserveEmployeeIds }
      }
    });
    console.log(`Deleted ${deletedDocuments.count} sample document records`);

    // Delete EmployeeAssets for sample employees
    const deletedAssets = await prisma.employeeAsset.deleteMany({
      where: {
        employeeId: { notIn: preserveEmployeeIds }
      }
    });
    console.log(`Deleted ${deletedAssets.count} sample employee asset records`);

    // Delete Onboarding records for sample employees
    const deletedOnboarding = await prisma.onboarding.deleteMany({
      where: {
        employeeId: { notIn: preserveEmployeeIds }
      }
    });
    console.log(`Deleted ${deletedOnboarding.count} sample onboarding records`);

    // Delete Performance reviews for sample employees
    const deletedPerformance = await prisma.performanceReview.deleteMany({
      where: {
        OR: [
          { employeeId: { notIn: preserveEmployeeIds } },
          { reviewerId: { notIn: preserveEmployeeIds } }
        ]
      }
    });
    console.log(`Deleted ${deletedPerformance.count} sample performance review records`);

    // Delete Training records for sample employees
    const deletedTraining = await prisma.trainingParticipant.deleteMany({
      where: {
        employeeId: { notIn: preserveEmployeeIds }
      }
    });
    console.log(`Deleted ${deletedTraining.count} sample training participant records`);

    // Delete Expense claims for sample employees
    const deletedExpenses = await prisma.expense.deleteMany({
      where: {
        employeeId: { notIn: preserveEmployeeIds }
      }
    });
    console.log(`Deleted ${deletedExpenses.count} sample expense records`);

    // Delete Timesheets for sample employees
    const deletedTimesheets = await prisma.timesheet.deleteMany({
      where: {
        employeeId: { notIn: preserveEmployeeIds }
      }
    });
    console.log(`Deleted ${deletedTimesheets.count} sample timesheet records`);

    // Finally delete the sample employees
    const deletedEmployees = await prisma.employee.deleteMany({
      where: {
        id: { notIn: preserveEmployeeIds }
      }
    });
    console.log(`Deleted ${deletedEmployees.count} sample employee records`);

    // Step 6: Delete non-admin users
    const deletedUsers = await prisma.user.deleteMany({
      where: {
        id: { notIn: preserveUserIds }
      }
    });
    console.log(`Deleted ${deletedUsers.count} sample user records`);

    // Step 7: Clean up sample candidates (if any)
    const deletedCandidates = await prisma.candidate.deleteMany({});
    console.log(`Deleted ${deletedCandidates.count} sample candidate records`);

    // Step 8: Clean up sample job postings (keep structure but remove sample data)
    // We'll keep job categories and job templates as master data

    // Step 9: Clean sample notifications
    const deletedNotifications = await prisma.notification.deleteMany({});
    console.log(`Deleted ${deletedNotifications.count} sample notification records`);

    // Step 10: Clean sample login activities
    const deletedLoginActivities = await prisma.loginActivity.deleteMany({});
    console.log(`Deleted ${deletedLoginActivities.count} sample login activity records`);

    // Step 11: Clean sample audit logs
    const deletedAuditLogs = await prisma.auditLog.deleteMany({});
    console.log(`Deleted ${deletedAuditLogs.count} sample audit log records`);

    console.log('\n=== Cleanup Complete ===');
    console.log('Preserved:');
    console.log(`  - ${superAdmins.length} super admin users`);
    console.log(`  - ${tenantAdmins.length} tenant admin users`);
    console.log(`  - ${preserveEmployeeIds.length} tenant admin employees`);
    console.log(`  - All master data (departments, designations, branches, companies, tenants)`);
    
    console.log('\nRemaining users in database:');
    const remainingUsers = await prisma.user.findMany({
      select: { email: true, role: true, tenant: { select: { name: true } } },
      orderBy: { role: 'asc' }
    });
    remainingUsers.forEach(u => {
      console.log(`  - ${u.email} (${u.role}) - ${u.tenant?.name || 'No tenant'}`);
    });

  } catch (error) {
    console.error('Error during cleanup:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

cleanSampleData()
  .then(() => {
    console.log('Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });