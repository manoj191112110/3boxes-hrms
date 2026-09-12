/**
 * Delete all employees from the marqaitechgroup tenant DB except the admin user.
 * 
 * Usage: Run this script with the tenant's database connection string.
 * The script will:
 * 1. Connect to the tenant DB
 * 2. Find all employees
 * 3. Delete all except the one linked to the admin user
 */
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';

// The marqaitechgroup tenant's dedicated DB connection string
// This needs to be set via environment variable
const connectionString = process.env.TENANT_DB_URL || process.env.POSTGRES_PRISMA_URL || process.env.DATABASE_URL;

if (!connectionString) {
  console.error('No connection string found! Set TENANT_DB_URL env variable.');
  process.exit(1);
}

console.log('Connecting to:', connectionString.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@').substring(0, 80));

const adapter = new PrismaNeon({ connectionString });
const prisma = new PrismaClient({ adapter });

async function deleteEmployees() {
  // Get all employees
  const allEmployees = await prisma.employee.findMany({
    include: {
      user: { select: { id: true, email: true, role: true } },
    },
  });
  
  console.log(`\nTotal employees in tenant DB: ${allEmployees.length}`);
  allEmployees.forEach(e => {
    console.log(`  - ${e.firstName} ${e.lastName} (${e.email}) | User: ${e.user?.email || 'N/A'} | Role: ${e.user?.role || 'N/A'}`);
  });

  // Find the admin employee (linked to a user with role super_admin or tenant_admin)
  const adminEmployee = allEmployees.find(e => 
    e.user && ['super_admin', 'tenant_admin', 'admin'].includes(e.user.role || '')
  );

  if (adminEmployee) {
    console.log(`\nAdmin employee to KEEP: ${adminEmployee.firstName} ${adminEmployee.lastName} (${adminEmployee.email})`);
  } else {
    console.log('\nNo admin employee found — keeping the first employee as fallback');
  }

  const keepId = adminEmployee?.id || allEmployees[0]?.id;
  
  if (!keepId) {
    console.log('No employees to delete.');
    return;
  }

  // Delete employees to remove
  const toDelete = allEmployees.filter(e => e.id !== keepId);
  console.log(`\nEmployees to DELETE: ${toDelete.length}`);
  
  for (const emp of toDelete) {
    console.log(`  Deleting: ${emp.firstName} ${emp.lastName} (${emp.email})`);
    
    // Delete related records first (to avoid foreign key constraints)
    await prisma.leaveBalance.deleteMany({ where: { employeeId: emp.id } }).catch(() => {});
    await prisma.leaveRequest.deleteMany({ where: { employeeId: emp.id } }).catch(() => {});
    await prisma.attendance.deleteMany({ where: { employeeId: emp.id } }).catch(() => {});
    await prisma.payroll.deleteMany({ where: { employeeId: emp.id } }).catch(() => {});
    await prisma.document.deleteMany({ where: { employeeId: emp.id } }).catch(() => {});
    await prisma.onboardingTask.deleteMany({ where: { employeeId: emp.id } }).catch(() => {});
    await prisma.performanceReview.deleteMany({ where: { employeeId: emp.id } }).catch(() => {});
    await prisma.goal.deleteMany({ where: { employeeId: emp.id } }).catch(() => {});
    await prisma.trainingEnrollment.deleteMany({ where: { employeeId: emp.id } }).catch(() => {});
    await prisma.assetAssignment.deleteMany({ where: { employeeId: emp.id } }).catch(() => {});
    await prisma.incidentReport.deleteMany({ where: { employeeId: emp.id } }).catch(() => {});
    await prisma.travelRequest.deleteMany({ where: { employeeId: emp.id } }).catch(() => {});
    await prisma.expenseClaim.deleteMany({ where: { employeeId: emp.id } }).catch(() => {});
    await prisma.timesheet.deleteMany({ where: { employeeId: emp.id } }).catch(() => {});
    await prisma.grievance.deleteMany({ where: { employeeId: emp.id } }).catch(() => {});
    await prisma.dependent.deleteMany({ where: { employeeId: emp.id } }).catch(() => {});
    await prisma.qualification.deleteMany({ where: { employeeId: emp.id } }).catch(() => {});
    await prisma.experience.deleteMany({ where: { employeeId: emp.id } }).catch(() => {});
    await prisma.employeeSkill.deleteMany({ where: { employeeId: emp.id } }).catch(() => {});
    await prisma.employeePaymentMethod.deleteMany({ where: { employeeId: emp.id } }).catch(() => {});
    await prisma.loan.deleteMany({ where: { employeeId: emp.id } }).catch(() => {});
    await prisma.overtimeRecord.deleteMany({ where: { employeeId: emp.id } }).catch(() => {});
    await prisma.payrollHold.deleteMany({ where: { employeeId: emp.id } }).catch(() => {});
    await prisma.payrollInput.deleteMany({ where: { employeeId: emp.id } }).catch(() => {});
    await prisma.incomeTaxDeclaration.deleteMany({ where: { employeeId: emp.id } }).catch(() => {});
    
    // Finally delete the employee
    await prisma.employee.delete({ where: { id: emp.id } });
    console.log(`    ✓ Deleted`);
  }

  // Verify
  const remaining = await prisma.employee.findMany();
  console.log(`\nRemaining employees: ${remaining.length}`);
  remaining.forEach(e => console.log(`  - ${e.firstName} ${e.lastName} (${e.email})`));

  await prisma.$disconnect();
}

deleteEmployees().catch(e => { console.error(e); process.exit(1); });
