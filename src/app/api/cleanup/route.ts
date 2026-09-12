import { NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { getTokenFromHeaders, verifyToken } from '@/lib/auth';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() });
}

/**
 * POST — Remove sample data for specific tenants
 *
 * This endpoint removes sample/demo data from the database for the specified
 * tenant domains. It ONLY affects:
 *   - 3boxeshrms.com
 *   - marqaitechgroup.3boxeshrms.com
 *
 * It does NOT affect the demo login at nexus-hrms-mu.vercel.app/login
 *
 * Only super_admin and tenant_admin can invoke this endpoint.
 *
 * Body: { confirm: boolean }
 */
export async function POST(request: Request) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders() });

    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401, headers: corsHeaders() });

    const role = (decoded.role as string) || 'employee';
    if (!['super_admin', 'tenant_admin'].includes(role)) {
      return NextResponse.json({ error: 'Only super_admin and tenant_admin can clean up sample data' }, { status: 403, headers: corsHeaders() });
    }

    const body = await request.json();
    if (!body.confirm) {
      return NextResponse.json({ error: 'Set confirm: true to proceed with sample data removal' }, { status: 400, headers: corsHeaders() });
    }

    console.log('[CLEANUP] Starting sample data cleanup...');

    // Find the tenants to clean up by their domain/slug
    const tenantsToClean = await getPlatformDb().tenant.findMany({
      where: {
        OR: [
          { domain: '3boxeshrms.com' },
          { domain: 'marqaitechgroup.3boxeshrms.com' },
          { slug: '3boxeshrms' },
          { slug: 'marqaitechgroup' },
        ],
      },
      select: { id: true, name: true, slug: true, domain: true },
    });

    if (tenantsToClean.length === 0) {
      return NextResponse.json({ message: 'No matching tenants found for cleanup', tenants: [] }, { headers: corsHeaders() });
    }

    // Protect the demo tenant — never clean it
    const PROTECTED_SLUGS = ['3boxes-hrms-demo', 'demo'];
    const tenantsToDelete = tenantsToClean.filter(t => !PROTECTED_SLUGS.includes(t.slug));

    if (tenantsToDelete.length === 0) {
      return NextResponse.json({ message: 'All matching tenants are protected (demo tenant)', tenants: tenantsToClean }, { headers: corsHeaders() });
    }

    const results: Array<{ tenant: string; slug: string; deleted: Record<string, number> }> = [];

    for (const tenant of tenantsToDelete) {
      console.log(`[CLEANUP] Cleaning tenant: ${tenant.name} (${tenant.slug})`);
      const deleted: Record<string, number> = {};

      // Get all company IDs in this tenant's company groups
      const companyGroups = await db.companyGroup.findMany({
        where: { tenantId: tenant.id },
        select: { id: true },
      });
      const groupIds = companyGroups.map(g => g.id);

      const companies = await db.company.findMany({
        where: { companyGroupId: { in: groupIds } },
        select: { id: true },
      });
      const companyIds = companies.map(c => c.id);

      // Get all department IDs
      const departments = await db.department.findMany({
        where: { companyId: { in: companyIds } },
        select: { id: true },
      });
      const deptIds = departments.map(d => d.id);

      // Get all branch IDs
      const branches = await db.branch.findMany({
        where: { companyId: { in: companyIds } },
        select: { id: true },
      });
      const branchIds = branches.map(b => b.id);

      // Get all designation IDs
      const designations = await db.designation.findMany({
        where: { departmentId: { in: deptIds } },
        select: { id: true },
      });
      const designationIds = designations.map(d => d.id);

      // Get all employee IDs for this tenant's companies
      const employees = await db.employee.findMany({
        where: { companyId: { in: companyIds } },
        select: { id: true, userId: true },
      });
      const employeeIds = employees.map(e => e.id);
      const userIds = employees.map(e => e.userId).filter(Boolean) as string[];

      // Delete in order of dependency (children first)

      // 1. EmployeeCompanyMappings
      try {
        const r = await db.employeeCompanyMapping.deleteMany({
          where: { employeeId: { in: employeeIds } },
        });
        deleted.employeeCompanyMappings = r.count;
      } catch (e) { console.error('[CLEANUP] Error deleting EmployeeCompanyMappings:', e); }

      // 2. Attendance records
      try {
        const r = await db.attendance.deleteMany({
          where: { employeeId: { in: employeeIds } },
        });
        deleted.attendance = r.count;
      } catch (e) { console.error('[CLEANUP] Error deleting Attendance:', e); }

      // 3. Leave records
      try {
        const r = await db.leave.deleteMany({
          where: { employeeId: { in: employeeIds } },
        });
        deleted.leaves = r.count;
      } catch (e) { console.error('[CLEANUP] Error deleting Leaves:', e); }

      // 4. Leave balances
      try {
        const r = await db.leaveBalance.deleteMany({
          where: { employeeId: { in: employeeIds } },
        });
        deleted.leaveBalances = r.count;
      } catch (e) { console.error('[CLEANUP] Error deleting LeaveBalances:', e); }

      // 5. Payroll records
      try {
        const r = await db.payroll.deleteMany({
          where: { employeeId: { in: employeeIds } },
        });
        deleted.payrolls = r.count;
      } catch (e) { console.error('[CLEANUP] Error deleting Payrolls:', e); }

      // 6. Expense claims
      try {
        const r = await db.expenseClaim.deleteMany({
          where: { employeeId: { in: employeeIds } },
        });
        deleted.expenseClaims = r.count;
      } catch (e) { console.error('[CLEANUP] Error deleting ExpenseClaims:', e); }

      // 7. Travel requests
      try {
        const r = await db.travelRequest.deleteMany({
          where: { employeeId: { in: employeeIds } },
        });
        deleted.travelRequests = r.count;
      } catch (e) { console.error('[CLEANUP] Error deleting TravelRequests:', e); }

      // 8. Notifications
      try {
        const r = await db.notification.deleteMany({
          where: { userId: { in: userIds } },
        });
        deleted.notifications = r.count;
      } catch (e) { console.error('[CLEANUP] Error deleting Notifications:', e); }

      // 9. Audit logs
      try {
        const r = await db.auditLog.deleteMany({
          where: { userId: { in: userIds } },
        });
        deleted.auditLogs = r.count;
      } catch (e) { console.error('[CLEANUP] Error deleting AuditLogs:', e); }

      // 10. UserRoleAssignments
      try {
        const r = await db.userRoleAssignment.deleteMany({
          where: { userId: { in: userIds } },
        });
        deleted.userRoleAssignments = r.count;
      } catch (e) { console.error('[CLEANUP] Error deleting UserRoleAssignments:', e); }

      // 11. Employees
      try {
        const r = await db.employee.deleteMany({
          where: { id: { in: employeeIds } },
        });
        deleted.employees = r.count;
      } catch (e) { console.error('[CLEANUP] Error deleting Employees:', e); }

      // 12. Users (non-admin users in this tenant)
      try {
        // Keep tenant_admin and super_admin users — only delete sample employees
        const r = await db.user.deleteMany({
          where: {
            tenantId: tenant.id,
            role: 'employee',
          },
        });
        deleted.sampleUsers = r.count;
      } catch (e) { console.error('[CLEANUP] Error deleting sample Users:', e); }

      // 13. Designations
      try {
        const r = await db.designation.deleteMany({
          where: { id: { in: designationIds } },
        });
        deleted.designations = r.count;
      } catch (e) { console.error('[CLEANUP] Error deleting Designations:', e); }

      // 14. Departments
      try {
        const r = await db.department.deleteMany({
          where: { id: { in: deptIds } },
        });
        deleted.departments = r.count;
      } catch (e) { console.error('[CLEANUP] Error deleting Departments:', e); }

      // 15. Branches
      try {
        const r = await db.branch.deleteMany({
          where: { id: { in: branchIds } },
        });
        deleted.branches = r.count;
      } catch (e) { console.error('[CLEANUP] Error deleting Branches:', e); }

      // 16. Shifts
      try {
        const r = await db.shift.deleteMany({
          where: { companyId: { in: companyIds } },
        });
        deleted.shifts = r.count;
      } catch (e) { console.error('[CLEANUP] Error deleting Shifts:', e); }

      // 17. Holidays
      try {
        const r = await db.holiday.deleteMany({
          where: { companyId: { in: companyIds } },
        });
        deleted.holidays = r.count;
      } catch (e) { console.error('[CLEANUP] Error deleting Holidays:', e); }

      // 18. Leave types
      try {
        const r = await db.leaveType.deleteMany({
          where: { companyId: { in: companyIds } },
        });
        deleted.leaveTypes = r.count;
      } catch (e) { console.error('[CLEANUP] Error deleting LeaveTypes:', e); }

      // 19. Policies
      try {
        const r = await db.policy.deleteMany({
          where: { companyId: { in: companyIds } },
        });
        deleted.policies = r.count;
      } catch (e) { console.error('[CLEANUP] Error deleting Policies:', e); }

      // 20. Salary structures
      try {
        const r = await db.salaryStructure.deleteMany({
          where: { companyId: { in: companyIds } },
        });
        deleted.salaryStructures = r.count;
      } catch (e) { console.error('[CLEANUP] Error deleting SalaryStructures:', e); }

      // 21. Companies (but keep the company structure — just remove data)
      // NOTE: We do NOT delete companies themselves, only their data.
      // The admin may want to keep the company structure.

      results.push({
        tenant: tenant.name,
        slug: tenant.slug,
        deleted,
      });

      console.log(`[CLEANUP] Completed cleanup for tenant: ${tenant.name}`);
    }

    return NextResponse.json({
      message: `Sample data cleanup completed for ${results.length} tenant(s)`,
      results,
      note: 'Company structures (companies, company groups) were preserved. Only transactional data and employees were removed. Re-seed departments/branches/designations as needed.',
    }, { headers: corsHeaders() });
  } catch (error) {
    console.error('[CLEANUP] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}
