import { NextRequest, NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';

/**
 * GET /api/employees/[id]/contextual-view?as=hr|manager|peer|self
 *
 * REQ-EMP-03: Contextual Profile Views
 *   - HR sees: Compliance & Compensation data
 *   - Manager sees: Project & Skill data
 *   - Peer sees: Contact & Department data
 *   - Self sees: everything they own
 *
 * Returns a tailored employee object based on the viewer's role.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const viewerRole = (searchParams.get('as') || decoded.role || 'employee').toLowerCase();

    // Always load the base employee record (public-safe fields only)
    const employee = await db.employee.findUnique({
      where: { id },
      select: {
        id: true,
        employeeId: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        avatar: true,
        departmentId: true,
        designationId: true,
        dateOfJoining: true,
        status: true,
        department: { select: { id: true, name: true } },
        designation: { select: { id: true, title: true } },
        // Peer-safe fields
        city: viewerRole === 'peer' || viewerRole === 'manager' || viewerRole === 'hr' || viewerRole === 'self',
        country: viewerRole === 'peer' || viewerRole === 'manager' || viewerRole === 'hr' || viewerRole === 'self',
      },
    });

    if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });

    // Peer view: ONLY contact + department, no compensation, no compliance
    if (viewerRole === 'peer') {
      return NextResponse.json({
        view: 'peer',
        employee: {
          id: employee.id,
          employeeId: employee.employeeId,
          firstName: employee.firstName,
          lastName: employee.lastName,
          email: employee.email,
          phone: employee.phone,
          avatar: employee.avatar,
          department: employee.department,
          designation: employee.designation,
          city: employee.city,
          country: employee.country,
        },
      });
    }

    // Manager view: project allocations + skills + attendance summary
    if (viewerRole === 'manager') {
      const [allocations, skills, dottedLineManagers] = await Promise.all([
        db.projectAllocation.findMany({
          where: { employeeId: id },
          include: { project: { select: { id: true, name: true, status: true } } },
          take: 20,
        }),
        db.employeeSkill.findMany({
          where: { employeeId: id },
          include: { skill: true },
        }),
        db.dottedLineManager.findMany({
          where: { employeeId: id, endDate: null },
          include: { manager: { select: { id: true, firstName: true, lastName: true, email: true } } },
        }),
      ]);
      return NextResponse.json({
        view: 'manager',
        employee,
        projectAllocations: allocations,
        skills,
        managers: dottedLineManagers,
      });
    }

    // HR view: compliance + compensation + custom fields
    if (viewerRole === 'hr' || viewerRole === 'tenant_admin' || viewerRole === 'super_admin') {
      const [documents, customFields, paymentMethods, salaryStructure] = await Promise.all([
        db.document.findMany({ where: { employeeId: id }, take: 50 }),
        db.employeeCustomFieldValue.findMany({
          where: { employeeId: id },
          include: { field: true },
        }),
        db.employeePaymentMethod.findMany({ where: { employeeId: id } }),
        db.salaryStructure.findFirst({ where: { employees: { some: { id } } } }),
      ]);
      const fullEmployee = await db.employee.findUnique({
        where: { id },
        select: {
          ...employee,
          panNumber: true, aadhaarNumber: true, taxId: true,
          bankName: true, bankAccountNo: true, bankIfscCode: true,
          salary: true, salaryCurrency: true,
          salaryStructureId: true, leavePolicyId: true, attendancePolicyId: true,
          dateOfBirth: true, gender: true, maritalStatus: true, nationality: true,
          bloodGroup: true, emergencyContactName: true, emergencyContactPhone: true,
          address: true, state: true, zipCode: true,
        },
      });
      return NextResponse.json({
        view: 'hr',
        employee: fullEmployee,
        documents,
        customFields,
        paymentMethods,
        salaryStructure,
      });
    }

    // Self view: everything the employee can see about themselves
    const self = await db.employee.findUnique({ where: { id } });
    return NextResponse.json({ view: 'self', employee: self });
  } catch (error) {
    console.error('GET contextual-view error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
