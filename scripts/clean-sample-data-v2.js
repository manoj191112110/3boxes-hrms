/**
 * Clean Sample Data Script
 * Removes all sample employee data, keeping only tenant admin + master data
 */

const { Pool } = require('@neondatabase/serverless');

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_pxZd8woKe4WB@ep-blue-fire-aqk8jxd2-pooler.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function cleanSampleData() {
  const pool = new Pool({ connectionString: CONNECTION_STRING });
  
  console.log('=== Starting Sample Data Cleanup ===\n');
  
  try {
    // Step 1: Get all tenant admin and super admin users to preserve
    console.log('Step 1: Identifying users to preserve...');
    const usersToKeep = await pool.query(`
      SELECT id, email, role, "tenantId" 
      FROM "User" 
      WHERE role IN ('super_admin', 'tenant_admin') AND status = 'active'
    `);
    console.log(`Found ${usersToKeep.rows.length} admin users to preserve`);
    const userIds = usersToKeep.rows.map(u => `'${u.id}'`).join(',');
    usersToKeep.rows.forEach(u => console.log(`  - ${u.email} (${u.role})`));
    
    // Step 2: Get employee IDs to preserve (linked to admin users)
    console.log('\nStep 2: Identifying employees to preserve...');
    const employeesToKeep = await pool.query(`
      SELECT e.id, e."userId", e."firstName", e."lastName", e."employeeId"
      FROM "Employee" e
      WHERE e."userId" IN (${userIds})
    `);
    console.log(`Found ${employeesToKeep.rows.length} admin employees to preserve`);
    const employeeIds = employeesToKeep.rows.map(e => `'${e.id}'`).join(',');
    employeesToKeep.rows.forEach(e => console.log(`  - ${e.firstName} ${e.lastName} (${e.employeeId})`));
    
    // Step 3: Delete UserRoleAssignments for non-admin users
    console.log('\nStep 3: Deleting sample RBAC assignments...');
    const rbacResult = await pool.query(`
      DELETE FROM "UserRoleAssignment" 
      WHERE "userId" NOT IN (${userIds})
    `);
    console.log(`Deleted ${rbacResult.rowCount} RBAC assignments`);
    
    // Step 4: Delete Attendance for sample employees
    console.log('\nStep 4: Deleting sample attendance records...');
    const attResult = await pool.query(`
      DELETE FROM "Attendance" 
      WHERE "employeeId" NOT IN (${employeeIds})
    `);
    console.log(`Deleted ${attResult.rowCount} attendance records`);
    
    // Step 5: Delete LeaveBalance for sample employees
    console.log('\nStep 5: Deleting sample leave balance records...');
    const lbResult = await pool.query(`
      DELETE FROM "LeaveBalance" 
      WHERE "employeeId" NOT IN (${employeeIds})
    `);
    console.log(`Deleted ${lbResult.rowCount} leave balance records`);
    
    // Step 6: Delete LeaveRequest for sample employees
    console.log('\nStep 6: Deleting sample leave request records...');
    const lrResult = await pool.query(`
      DELETE FROM "LeaveRequest" 
      WHERE "employeeId" NOT IN (${employeeIds})
    `);
    console.log(`Deleted ${lrResult.rowCount} leave request records`);
    
    // Step 7: Delete Payroll for sample employees
    console.log('\nStep 7: Deleting sample payroll records...');
    const payrollResult = await pool.query(`
      DELETE FROM "Payroll" 
      WHERE "employeeId" NOT IN (${employeeIds})
    `);
    console.log(`Deleted ${payrollResult.rowCount} payroll records`);
    
    // Step 8: Delete Documents for sample employees
    console.log('\nStep 8: Deleting sample document records...');
    const docResult = await pool.query(`
      DELETE FROM "Document" 
      WHERE "employeeId" NOT IN (${employeeIds})
    `);
    console.log(`Deleted ${docResult.rowCount} document records`);
    
    // Step 9: Delete Dependents for sample employees
    console.log('\nStep 9: Deleting sample dependent records...');
    const depResult = await pool.query(`
      DELETE FROM "Dependent" 
      WHERE "employeeId" NOT IN (${employeeIds})
    `);
    console.log(`Deleted ${depResult.rowCount} dependent records`);
    
    // Step 10: Delete Qualifications for sample employees
    console.log('\nStep 10: Deleting sample qualification records...');
    const qualResult = await pool.query(`
      DELETE FROM "Qualification" 
      WHERE "employeeId" NOT IN (${employeeIds})
    `);
    console.log(`Deleted ${qualResult.rowCount} qualification records`);
    
    // Step 11: Delete Experiences for sample employees
    console.log('\nStep 11: Deleting sample experience records...');
    const expHistResult = await pool.query(`
      DELETE FROM "Experience" 
      WHERE "employeeId" NOT IN (${employeeIds})
    `);
    console.log(`Deleted ${expHistResult.rowCount} experience records`);
    
    // Step 12: Delete EmployeeSkills for sample employees
    console.log('\nStep 12: Deleting sample skill records...');
    const skillResult = await pool.query(`
      DELETE FROM "EmployeeSkill" 
      WHERE "employeeId" NOT IN (${employeeIds})
    `);
    console.log(`Deleted ${skillResult.rowCount} skill records`);
    
    // Step 13: Delete PerformanceReviews for sample employees
    console.log('\nStep 13: Deleting sample performance review records...');
    const perfResult = await pool.query(`
      DELETE FROM "PerformanceReview" 
      WHERE "employeeId" NOT IN (${employeeIds})
    `);
    console.log(`Deleted ${perfResult.rowCount} performance review records`);
    
    // Step 14: Delete Goals for sample employees
    console.log('\nStep 14: Deleting sample goal records...');
    const goalResult = await pool.query(`
      DELETE FROM "Goal" 
      WHERE "employeeId" NOT IN (${employeeIds})
    `);
    console.log(`Deleted ${goalResult.rowCount} goal records`);
    
    // Step 15: Delete TrainingEnrollments for sample employees
    console.log('\nStep 15: Deleting sample training enrollment records...');
    const trainResult = await pool.query(`
      DELETE FROM "TrainingEnrollment" 
      WHERE "employeeId" NOT IN (${employeeIds})
    `);
    console.log(`Deleted ${trainResult.rowCount} training enrollment records`);
    
    // Step 16: Delete AssetAssignments for sample employees
    console.log('\nStep 16: Deleting sample asset assignment records...');
    const assetResult = await pool.query(`
      DELETE FROM "AssetAssignment" 
      WHERE "employeeId" NOT IN (${employeeIds})
    `);
    console.log(`Deleted ${assetResult.rowCount} asset assignment records`);
    
    // Step 17: Delete IncidentReports for sample employees
    console.log('\nStep 17: Deleting sample incident report records...');
    const incResult = await pool.query(`
      DELETE FROM "IncidentReport" 
      WHERE "employeeId" NOT IN (${employeeIds})
    `);
    console.log(`Deleted ${incResult.rowCount} incident report records`);
    
    // Step 18: Delete TravelRequests for sample employees
    console.log('\nStep 18: Deleting sample travel request records...');
    const travResult = await pool.query(`
      DELETE FROM "TravelRequest" 
      WHERE "employeeId" NOT IN (${employeeIds})
    `);
    console.log(`Deleted ${travResult.rowCount} travel request records`);
    
    // Step 19: Delete ExpenseClaims for sample employees
    console.log('\nStep 19: Deleting sample expense claim records...');
    const expClaimResult = await pool.query(`
      DELETE FROM "ExpenseClaim" 
      WHERE "employeeId" NOT IN (${employeeIds})
    `);
    console.log(`Deleted ${expClaimResult.rowCount} expense claim records`);
    
    // Step 20: Delete Timesheets for sample employees
    console.log('\nStep 20: Deleting sample timesheet records...');
    const tsResult = await pool.query(`
      DELETE FROM "Timesheet" 
      WHERE "employeeId" NOT IN (${employeeIds})
    `);
    console.log(`Deleted ${tsResult.rowCount} timesheet records`);
    
    // Step 21: Delete Feedbacks for sample employees
    console.log('\nStep 21: Deleting sample feedback records...');
    const fbResult = await pool.query(`
      DELETE FROM "Feedback" 
      WHERE "toId" NOT IN (${employeeIds}) OR "fromId" NOT IN (${employeeIds})
    `);
    console.log(`Deleted ${fbResult.rowCount} feedback records`);
    
    // Step 22: Delete Promotions for sample employees
    console.log('\nStep 22: Deleting sample promotion records...');
    const promoResult = await pool.query(`
      DELETE FROM "Promotion" 
      WHERE "employeeId" NOT IN (${employeeIds})
    `);
    console.log(`Deleted ${promoResult.rowCount} promotion records`);
    
    // Step 23: Delete Grievances for sample employees
    console.log('\nStep 23: Deleting sample grievance records...');
    const grievResult = await pool.query(`
      DELETE FROM "Grievance" 
      WHERE "employeeId" NOT IN (${employeeIds})
    `);
    console.log(`Deleted ${grievResult.rowCount} grievance records`);
    
    // Step 24: Delete Separations for sample employees
    console.log('\nStep 24: Deleting sample separation records...');
    const sepResult = await pool.query(`
      DELETE FROM "Separation" 
      WHERE "employeeId" NOT IN (${employeeIds})
    `);
    console.log(`Deleted ${sepResult.rowCount} separation records`);
    
    // Step 25: Delete OnboardingTasks for sample employees
    console.log('\nStep 25: Deleting sample onboarding task records...');
    const onboardResult = await pool.query(`
      DELETE FROM "OnboardingTask" 
      WHERE "employeeId" NOT IN (${employeeIds})
    `);
    console.log(`Deleted ${onboardResult.rowCount} onboarding task records`);
    
    // Step 26: Delete Reimbursements for sample employees
    console.log('\nStep 26: Deleting sample reimbursement records...');
    const reimbResult = await pool.query(`
      DELETE FROM "Reimbursement" 
      WHERE "employeeId" NOT IN (${employeeIds})
    `);
    console.log(`Deleted ${reimbResult.rowCount} reimbursement records`);
    
    // Step 27: Delete ProjectAllocations for sample employees
    console.log('\nStep 27: Deleting sample project allocation records...');
    const projAllocResult = await pool.query(`
      DELETE FROM "ProjectAllocation" 
      WHERE "employeeId" NOT IN (${employeeIds})
    `);
    console.log(`Deleted ${projAllocResult.rowCount} project allocation records`);
    
    // Step 28: Delete ProjectMembers for sample employees
    console.log('\nStep 28: Deleting sample project member records...');
    const projMemResult = await pool.query(`
      DELETE FROM "ProjectMember" 
      WHERE "employeeId" NOT IN (${employeeIds})
    `);
    console.log(`Deleted ${projMemResult.rowCount} project member records`);
    
    // Step 29: Delete FNFCalculations for sample employees
    console.log('\nStep 29: Deleting sample FNF calculation records...');
    const fnfResult = await pool.query(`
      DELETE FROM "FNFCalculation" 
      WHERE "employeeId" NOT IN (${employeeIds})
    `);
    console.log(`Deleted ${fnfResult.rowCount} FNF calculation records`);
    
    // Step 30: Delete sample Employees
    console.log('\nStep 30: Deleting sample employee records...');
    const empResult = await pool.query(`
      DELETE FROM "Employee" 
      WHERE id NOT IN (${employeeIds})
    `);
    console.log(`Deleted ${empResult.rowCount} employee records`);
    
    // Step 31: Delete sample Users (non-admin)
    console.log('\nStep 31: Deleting sample user records...');
    const userResult = await pool.query(`
      DELETE FROM "User" 
      WHERE id NOT IN (${userIds})
    `);
    console.log(`Deleted ${userResult.rowCount} user records`);
    
    // Step 32: Delete sample Candidates (if table exists)
    console.log('\nStep 32: Deleting sample candidate records...');
    try {
      const candResult = await pool.query(`DELETE FROM "Candidate"`);
      console.log(`Deleted ${candResult.rowCount} candidate records`);
    } catch (e) {
      console.log('Candidate table does not exist, skipping...');
    }
    
    // Step 33: Delete sample Notifications
    console.log('\nStep 33: Deleting sample notification records...');
    const notifResult = await pool.query(`DELETE FROM "Notification"`);
    console.log(`Deleted ${notifResult.rowCount} notification records`);
    
    // Step 34: Delete sample LoginActivities
    console.log('\nStep 34: Deleting sample login activity records...');
    const loginResult = await pool.query(`DELETE FROM "LoginActivity"`);
    console.log(`Deleted ${loginResult.rowCount} login activity records`);
    
    // Step 35: Delete sample AuditLogs
    console.log('\nStep 35: Deleting sample audit log records...');
    const auditResult = await pool.query(`DELETE FROM "AuditLog"`);
    console.log(`Deleted ${auditResult.rowCount} audit log records`);
    
    // Verify remaining data
    console.log('\n=== Cleanup Complete ===\n');
    console.log('Verifying remaining users...');
    const remainingUsers = await pool.query(`
      SELECT email, role, "tenantId" FROM "User" WHERE status = 'active' ORDER BY role, email
    `);
    console.log(`\nRemaining users (${remainingUsers.rows.length}):`);
    remainingUsers.rows.forEach(u => console.log(`  - ${u.email} (${u.role})`));
    
    console.log('\nVerifying remaining employees...');
    const remainingEmps = await pool.query(`
      SELECT e."firstName", e."lastName", e."employeeId", u.email 
      FROM "Employee" e JOIN "User" u ON e."userId" = u.id
    `);
    console.log(`\nRemaining employees (${remainingEmps.rows.length}):`);
    remainingEmps.rows.forEach(e => console.log(`  - ${e.firstName} ${e.lastName} (${e.employeeId}) - ${e.email}`));
    
    // Count master data
    console.log('\nMaster data preserved:');
    const tenants = await pool.query(`SELECT COUNT(*) as count FROM "Tenant" WHERE status = 'active'`);
    const companies = await pool.query(`SELECT COUNT(*) as count FROM "Company" WHERE status = 'active'`);
    const departments = await pool.query(`SELECT COUNT(*) as count FROM "Department" WHERE status = 'active'`);
    const designations = await pool.query(`SELECT COUNT(*) as count FROM "Designation" WHERE status = 'active'`);
    const branches = await pool.query(`SELECT COUNT(*) as count FROM "Branch" WHERE status = 'active'`);
    
    console.log(`  - Tenants: ${tenants.rows[0].count}`);
    console.log(`  - Companies: ${companies.rows[0].count}`);
    console.log(`  - Departments: ${departments.rows[0].count}`);
    console.log(`  - Designations: ${designations.rows[0].count}`);
    console.log(`  - Branches: ${branches.rows[0].count}`);
    
  } catch (error) {
    console.error('Error during cleanup:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

cleanSampleData()
  .then(() => {
    console.log('\nScript completed successfully!');
    process.exit(0);
  })
  .catch(err => {
    console.error('\nScript failed:', err);
    process.exit(1);
  });