import { NextRequest, NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

/**
 * POST /api/trial/approve
 * Super admin approves a trial registration.
 * Creates: Tenant, CompanyGroup, Company, User (tenant_admin), Role assignments.
 * Sets tempPassword and trialStart/trialEnd on the registration.
 */
export async function POST(request: NextRequest) {
  const db = await getDb(request);
  try {
    const body = await request.json();
    const { registrationId, trialDays, reviewedBy } = body;

    if (!registrationId) {
      return NextResponse.json({ error: 'registrationId is required' }, { status: 400 });
    }

    // Fetch the registration
    const registration = await db.trialRegistration.findUnique({
      where: { id: registrationId },
    });

    if (!registration) {
      return NextResponse.json({ error: 'Registration not found' }, { status: 404 });
    }

    if (registration.status !== 'pending') {
      return NextResponse.json({ error: `Registration is already ${registration.status}` }, { status: 400 });
    }

    const days = trialDays || registration.trialDays || 15;
    const now = new Date();
    const trialEnd = new Date(now);
    trialEnd.setDate(trialEnd.getDate() + days);

    // Generate a secure temp password
    const tempPassword = crypto.randomBytes(4).toString('hex'); // 8-char alphanumeric
    const hashedPassword = await bcrypt.hash(tempPassword, 12);

    // Create the full tenant structure in a transaction
    const result = await db.$transaction(async (tx: any) => {
      // 1. Create Tenant
      const tenant = await tx.tenant.create({
        data: {
          name: registration.companyName,
          slug: registration.companyCode,
          domain: `${registration.companyCode}.3boxeshrms.com`,
          plan: 'starter',
          status: 'trial',
          country: registration.country,
          currency: registration.currency || 'INR',
          language: 'en',
          subscriptionSeats: 10,
        },
      });

      // 2. Create Company Group
      const companyGroup = await tx.companyGroup.create({
        data: {
          name: registration.companyName,
          tenantId: tenant.id,
          maxEmployees: registration.employeeCount || 10,
        },
      });

      // 3. Create Company
      const company = await tx.company.create({
        data: {
          name: registration.companyName,
          code: registration.companyCode.toUpperCase(),
          companyGroupId: companyGroup.id,
          country: registration.country,
          currency: registration.currency || 'INR',
          email: registration.companyEmail,
          phone: registration.companyPhone,
          website: registration.companyWebsite,
          address: registration.address,
          city: registration.city,
          state: registration.state,
          zipCode: registration.zipCode,
          status: 'active',
          maxEmployees: registration.employeeCount || 10,
        },
      });

      // 4. Create Department (default)
      const department = await tx.department.create({
        data: {
          name: 'Administration',
          companyId: company.id,
          status: 'active',
        },
      });

      // 5. Create Designation (default)
      const designation = await tx.designation.create({
        data: {
          title: 'Administrator',
          companyId: company.id,
        },
      });

      // 6. Create Branch (default - HQ)
      const branch = await tx.branch.create({
        data: {
          name: 'Head Office',
          code: 'HO',
          companyId: company.id,
          address: registration.address,
          city: registration.city,
          state: registration.state,
          zipCode: registration.zipCode,
          country: registration.country,
          status: 'active',
        },
      });

      // 7. Create the tenant_admin user
      const user = await tx.user.create({
        data: {
          email: registration.contactEmail,
          password: hashedPassword,
          name: registration.contactName,
          tenantId: tenant.id,
          role: 'tenant_admin',
          status: 'active',
        },
      });

      // 8. Create Employee record for the admin
      await tx.employee.create({
        data: {
          employeeId: `EMP-${registration.companyCode.toUpperCase()}-001`,
          firstName: registration.contactName.split(' ')[0] || registration.contactName,
          lastName: registration.contactName.split(' ').slice(1).join(' ') || '',
          email: registration.contactEmail,
          phone: registration.contactPhone,
          userId: user.id,
          departmentId: department.id,
          designationId: designation.id,
          branchId: branch.id,
          companyId: company.id,
          dateOfJoining: now,
          status: 'active',
        },
      });

      // 8.5. Create standard tenant-level roles for this new tenant
      // These roles will be used for assigning access rights to employees
      const standardTenantRoles = [
        { key: 'hr_admin', name: 'HR Administrator', description: 'HR operations - employees, recruitment, onboarding, leave, attendance', level: 3, isSystem: true },
        { key: 'finance_admin', name: 'Finance Administrator', description: 'Finance operations - payroll, salary structures, expenses, invoices', level: 3, isSystem: true },
        { key: 'it_admin', name: 'IT Administrator', description: 'IT operations - assets, helpdesk, system settings', level: 3, isSystem: true },
        { key: 'manager', name: 'Manager', description: 'Team management - team employees, timesheets, performance reviews, leave approvals', level: 4, isSystem: true },
        { key: 'employee', name: 'Employee', description: 'Basic employee access - view own profile, request leave, view payslips, submit timesheets', level: 5, isSystem: true },
        { key: 'recruiter', name: 'Recruiter', description: 'Recruitment operations - job postings, candidate screening, interview scheduling', level: 4, isSystem: true },
      ];

      const createdRoles: Record<string, string> = {};
      for (const roleDef of standardTenantRoles) {
        // Check if role already exists for this tenant
        const existingRole = await tx.role.findFirst({
          where: { key: roleDef.key, tenantId: tenant.id, companyId: null }
        });
        
        if (!existingRole) {
          const newRole = await tx.role.create({
            data: {
              name: roleDef.name,
              key: roleDef.key,
              description: roleDef.description,
              level: roleDef.level,
              isSystem: roleDef.isSystem,
              tenantId: tenant.id,
              companyId: null,
              status: 'active',
              createdBy: reviewedBy,
            }
          });
          createdRoles[roleDef.key] = newRole.id;
        } else {
          createdRoles[roleDef.key] = existingRole.id;
        }
      }

      // 9. Create tenant-level role assignments
      const superAdminRole = await tx.role.findFirst({ where: { key: 'super_admin' } });
      const tenantAdminRole = await tx.role.findFirst({ where: { key: 'tenant_admin' } });
      const adminRole = await tx.role.findFirst({ where: { key: 'admin' } });

      if (tenantAdminRole) {
        await tx.userRoleAssignment.create({
          data: {
            userId: user.id,
            roleId: tenantAdminRole.id,
            companyId: company.id,
            assignedBy: reviewedBy,
          },
        });
      }

      if (adminRole) {
        await tx.userRoleAssignment.create({
          data: {
            userId: user.id,
            roleId: adminRole.id,
            companyId: company.id,
            assignedBy: reviewedBy,
          },
        });
      }

      // 10. Update the registration
      await tx.trialRegistration.update({
        where: { id: registrationId },
        data: {
          status: 'approved',
          trialDays: days,
          trialStart: now,
          trialEnd: trialEnd,
          tempPassword,
          reviewedBy: reviewedBy || null,
          reviewedAt: now,
          tenantId: tenant.id,
        },
      });

      return { tenant, user, tempPassword, companyCode: registration.companyCode };
    });

    return NextResponse.json({
      message: 'Trial approved successfully. Tenant created.',
      tenantId: result.tenant.id,
      loginEmail: registration.contactEmail,
      tempPassword: result.tempPassword,
      loginUrl: `https://${result.companyCode}.3boxeshrms.com/login`,
      trialDays: days,
      trialEnd: trialEnd.toISOString(),
    }, { status: 200 });

  } catch (error: any) {
    console.error('[Trial Approve] Error:', error);
    return NextResponse.json(
      { error: 'Failed to approve trial. Please try again.', details: error.message },
      { status: 500 }
    );
  }
}
