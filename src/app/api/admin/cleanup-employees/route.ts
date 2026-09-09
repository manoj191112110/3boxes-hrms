import { NextResponse } from 'next/server';
import { getPlatformDb, getDbForTenant } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';

export async function OPTIONS() {
  return NextResponse.json({}, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

export async function POST(request: Request) {
  try {
    // Verify auth — allow both super_admin and tenant_admin
    const token = getTokenFromHeaders(request);
    if (!token) {
      return NextResponse.json({ error: 'No token' }, { status: 401 });
    }
    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
    if (!['super_admin', 'tenant_admin', 'admin'].includes(decoded.role as string)) {
      return NextResponse.json({ error: 'Only admins can run cleanup' }, { status: 403 });
    }

    const body = await request.json();
    const { tenantSlug } = body;

    if (!tenantSlug) {
      return NextResponse.json({ error: 'tenantSlug is required' }, { status: 400 });
    }

    // Get the tenant DB
    const platformDb = getPlatformDb();
    const tenant = await platformDb.tenant.findUnique({
      where: { slug: tenantSlug },
      select: { id: true, slug: true, name: true },
    });

    if (!tenant) {
      return NextResponse.json({ error: `Tenant "${tenantSlug}" not found` }, { status: 404 });
    }

    const tenantDb = await getDbForTenant(tenant.slug);

    // Get all employees
    const allEmployees = await tenantDb.employee.findMany({
      include: {
        user: { select: { id: true, email: true, role: true } },
      },
    });

    console.log(`[cleanup] Tenant "${tenantSlug}": ${allEmployees.length} employees found`);

    // Find the admin employee to keep
    const adminEmployee = allEmployees.find(e =>
      e.user && ['super_admin', 'tenant_admin', 'admin'].includes(e.user.role || '')
    );

    let keepId: string | null = null;
    if (adminEmployee) {
      keepId = adminEmployee.id;
      console.log(`[cleanup] Keeping admin: ${adminEmployee.firstName} ${adminEmployee.lastName} (${adminEmployee.email})`);
    } else if (allEmployees.length > 0) {
      keepId = allEmployees[0].id;
      console.log(`[cleanup] No admin found — keeping first employee as fallback`);
    }

    if (!keepId) {
      return NextResponse.json({ message: 'No employees to delete', deleted: 0, kept: 0 });
    }

    // Delete related records and employees
    const toDelete = allEmployees.filter(e => e.id !== keepId);
    let deletedCount = 0;
    const deletedRecords: string[] = [];

    for (const emp of toDelete) {
      console.log(`[cleanup] Deleting: ${emp.firstName} ${emp.lastName} (${emp.email})`);

      // Delete related records first
      try { await tenantDb.leaveBalance.deleteMany({ where: { employeeId: emp.id } }); } catch {}
      try { await tenantDb.leaveRequest.deleteMany({ where: { employeeId: emp.id } }); } catch {}
      try { await tenantDb.attendance.deleteMany({ where: { employeeId: emp.id } }); } catch {}
      try { await tenantDb.payroll.deleteMany({ where: { employeeId: emp.id } }); } catch {}
      try { await tenantDb.document.deleteMany({ where: { employeeId: emp.id } }); } catch {}
      try { await tenantDb.onboardingTask.deleteMany({ where: { employeeId: emp.id } }); } catch {}
      try { await tenantDb.performanceReview.deleteMany({ where: { employeeId: emp.id } }); } catch {}
      try { await tenantDb.goal.deleteMany({ where: { employeeId: emp.id } }); } catch {}
      try { await tenantDb.trainingEnrollment.deleteMany({ where: { employeeId: emp.id } }); } catch {}
      try { await tenantDb.assetAssignment.deleteMany({ where: { employeeId: emp.id } }); } catch {}
      try { await tenantDb.incidentReport.deleteMany({ where: { employeeId: emp.id } }); } catch {}
      try { await tenantDb.travelRequest.deleteMany({ where: { employeeId: emp.id } }); } catch {}
      try { await tenantDb.expenseClaim.deleteMany({ where: { employeeId: emp.id } }); } catch {}
      try { await tenantDb.timesheet.deleteMany({ where: { employeeId: emp.id } }); } catch {}
      try { await tenantDb.grievance.deleteMany({ where: { employeeId: emp.id } }); } catch {}
      try { await tenantDb.dependent.deleteMany({ where: { employeeId: emp.id } }); } catch {}
      try { await tenantDb.qualification.deleteMany({ where: { employeeId: emp.id } }); } catch {}
      try { await tenantDb.experience.deleteMany({ where: { employeeId: emp.id } }); } catch {}
      try { await tenantDb.employeeSkill.deleteMany({ where: { employeeId: emp.id } }); } catch {}
      try { await tenantDb.employeePaymentMethod.deleteMany({ where: { employeeId: emp.id } }); } catch {}
      try { await tenantDb.loan.deleteMany({ where: { employeeId: emp.id } }); } catch {}
      try { await tenantDb.overtimeRecord.deleteMany({ where: { employeeId: emp.id } }); } catch {}
      try { await tenantDb.payrollHold.deleteMany({ where: { employeeId: emp.id } }); } catch {}
      try { await tenantDb.payrollInput.deleteMany({ where: { employeeId: emp.id } }); } catch {}
      try { await tenantDb.incomeTaxDeclaration.deleteMany({ where: { employeeId: emp.id } }); } catch {}

      // Delete the employee
      try {
        await tenantDb.employee.delete({ where: { id: emp.id } });
        deletedCount++;
        deletedRecords.push(`${emp.firstName} ${emp.lastName} (${emp.email})`);
      } catch (err) {
        console.error(`[cleanup] Failed to delete employee ${emp.id}:`, err);
      }
    }

    // Verify
    const remaining = await tenantDb.employee.findMany();
    console.log(`[cleanup] Done. Deleted: ${deletedCount}, Remaining: ${remaining.length}`);

    return NextResponse.json({
      success: true,
      tenant: tenant.name,
      totalBefore: allEmployees.length,
      deleted: deletedCount,
      kept: remaining.length,
      keptEmployee: adminEmployee ? `${adminEmployee.firstName} ${adminEmployee.lastName} (${adminEmployee.email})` : 'N/A',
      deletedRecords,
    });
  } catch (error) {
    console.error('Cleanup error:', error);
    return NextResponse.json(
      { error: 'Failed to cleanup employees', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
