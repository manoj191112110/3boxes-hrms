import { NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';
import type { PrismaClient } from '@prisma/client';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() });
}

// Core includes that are guaranteed to exist in the Employee table
// NOTE: Employee has companyId but NO @relation to Company — it's a bare String field.
// We must NOT include `company` in the Prisma include clause.
// Company info is resolved separately via fetchOptionalRelations → companyMappings.
const coreInclude = {
  department: { include: { company: { select: { id: true, name: true, code: true } } } },
  designation: true,
  branch: { include: { company: { select: { id: true, name: true, code: true } } } },
  user: {
    select: { id: true, email: true, role: true, avatar: true },
  },
};

/**
 * Safely fetch optional relations for an employee.
 * Each relation is fetched independently so one failure doesn't break the rest.
 */
async function fetchOptionalRelations(db: PrismaClient, employeeId: string, companyId?: string | null) {
  const result: Record<string, unknown> = {};

  // Resolve company info from companyId (Employee.companyId is a bare String, not a relation)
  if (companyId) {
    try {
      result.company = await db.company.findUnique({
        where: { id: companyId },
        select: { id: true, name: true, code: true },
      });
    } catch (err) {
      console.warn(`[Employee GET] Failed to fetch company for ${companyId}:`, err instanceof Error ? err.message : err);
      result.company = null;
    }
  } else {
    result.company = null;
  }

  const optionalFetches: [string, () => Promise<unknown>][] = [
    ['leaveBalances', () => db.leaveBalance.findMany({
      where: { employeeId },
      include: { leaveType: true },
    })],
    ['dependents', () => db.dependent.findMany({ where: { employeeId } })],
    ['qualifications', () => db.qualification.findMany({ where: { employeeId } })],
    ['experiences', () => db.experience.findMany({ where: { employeeId } })],
    ['skills', () => {
      try {
        return (db as any).employeeSkill?.findMany?.({ where: { employeeId } }) ?? [];
      } catch { return []; }
    }],
    ['documents', () => db.document.findMany({ where: { employeeId } })],
    ['assetAssignments', () => db.assetAssignment.findMany({
      where: { employeeId },
      include: { asset: true },
    })],
    ['companyMappings', () => db.employeeCompanyMapping.findMany({
      where: { employeeId, status: 'active' },
      include: {
        company: { select: { id: true, name: true, code: true } },
        department: { select: { id: true, name: true } },
        designation: { select: { id: true, title: true } },
        branch: { select: { id: true, name: true } },
      },
      orderBy: { isPrimary: 'desc' },
    })],
  ];

  await Promise.allSettled(
    optionalFetches.map(async ([key, fetchFn]) => {
      try {
        result[key] = await fetchFn();
      } catch (err) {
        console.warn(`[Employee GET] Failed to fetch ${key} for ${employeeId}:`, err instanceof Error ? err.message : err);
        result[key] = []; // Default to empty array
      }
    })
  );

  return result;
}

/**
 * Resolve an employee ID to the actual database record.
 * Tries: 1) by CUID id → 2) by employeeId (e.g. "EMP001") → 3) by email
 */
async function findEmployee(db: PrismaClient, id: string) {
  // Strategy 1: by database id (CUID)
  try {
    const emp = await db.employee.findUnique({
      where: { id },
      include: coreInclude,
    });
    if (emp) return emp;
  } catch (err) {
    console.warn(`[Employee GET] findUnique by id failed, trying fallback:`, err instanceof Error ? err.message : err);
  }

  // Strategy 2: by employeeId (business key like "EMP001")
  try {
    const emp = await db.employee.findUnique({
      where: { employeeId: id },
      include: coreInclude,
    });
    if (emp) return emp;
  } catch {
    // continue
  }

  // Strategy 3: by email
  try {
    const emp = await db.employee.findFirst({
      where: { email: { equals: id, mode: 'insensitive' } },
      include: coreInclude,
    });
    if (emp) return emp;
  } catch {
    // continue
  }

  return null;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const db = await getDb(request);
  try {
    const { id: rawId } = await params;
    const id = decodeURIComponent(rawId);

    console.log(`[Employee GET] Looking up employee: ${id}`);

    try {
      // Step 1: Find the core employee record
      let employee = await findEmployee(db, id);

      if (!employee) {
        console.log(`[Employee GET] Employee not found after all strategies for: ${id}`);
        return NextResponse.json(
          { error: 'Employee not found', code: 'NOT_FOUND', searchedId: id },
          { status: 404, headers: corsHeaders() }
        );
      }

      // Step 2: Fetch optional relations independently (non-fatal if they fail)
      const optionalData = await fetchOptionalRelations(db, employee.id, employee.companyId);
      employee = { ...employee, ...optionalData };

      console.log(`[Employee GET] Found employee: ${employee.employeeId} (${employee.firstName} ${employee.lastName})`);
      return NextResponse.json(
        { employee },
        { headers: corsHeaders() }
      );
    } catch (dbError) {
      console.error('[Employee GET] DB query failed:', dbError);
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNAVAILABLE', details: dbError instanceof Error ? dbError.message : String(dbError) },
        { status: 503, headers: corsHeaders() }
      );
    }
  } catch (error) {
    console.error('[Employee GET] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders() }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const db = await getDb(request);
  try {
    const { id: rawId } = await params;
    const id = decodeURIComponent(rawId);
    const body = await request.json();

    try {
      // Try to find employee by id first, then by employeeId
      let existingEmployee = await db.employee.findUnique({ where: { id } });
      if (!existingEmployee) {
        existingEmployee = await db.employee.findUnique({ where: { employeeId: id } });
      }

      if (!existingEmployee) {
        return NextResponse.json(
          { error: 'Employee not found' },
          { status: 404, headers: corsHeaders() }
        );
      }

      const actualId = existingEmployee.id;

      const {
        firstName, lastName, email, phone, departmentId, designationId,
        branchId, companyId, dateOfJoining, dateOfBirth, gender, maritalStatus,
        nationality, address, city, state, zipCode, country, bloodGroup,
        emergencyContactName, emergencyContactPhone, bankName, bankAccountNo,
        bankIfscCode, panNumber, aadhaarNumber, taxId, salary, salaryCurrency,
        status, role, avatar,
      } = body;

      const updateData: Record<string, unknown> = {};
      if (firstName !== undefined) updateData.firstName = firstName;
      if (lastName !== undefined) updateData.lastName = lastName;
      if (email !== undefined) updateData.email = email;
      if (phone !== undefined) updateData.phone = phone;
      if (departmentId !== undefined) updateData.departmentId = departmentId || undefined;
      if (designationId !== undefined) updateData.designationId = designationId || undefined;
      if (branchId !== undefined) updateData.branchId = branchId || null;
      if (companyId !== undefined) updateData.companyId = companyId || null;
      if (dateOfJoining !== undefined) updateData.dateOfJoining = new Date(dateOfJoining);
      if (dateOfBirth !== undefined) updateData.dateOfBirth = dateOfBirth ? new Date(dateOfBirth) : null;
      if (gender !== undefined) updateData.gender = gender;
      if (maritalStatus !== undefined) updateData.maritalStatus = maritalStatus;
      if (nationality !== undefined) updateData.nationality = nationality;
      if (address !== undefined) updateData.address = address;
      if (city !== undefined) updateData.city = city;
      if (state !== undefined) updateData.state = state;
      if (zipCode !== undefined) updateData.zipCode = zipCode;
      if (country !== undefined) updateData.country = country;
      if (bloodGroup !== undefined) updateData.bloodGroup = bloodGroup;
      if (emergencyContactName !== undefined) updateData.emergencyContactName = emergencyContactName;
      if (emergencyContactPhone !== undefined) updateData.emergencyContactPhone = emergencyContactPhone;
      if (bankName !== undefined) updateData.bankName = bankName;
      if (bankAccountNo !== undefined) updateData.bankAccountNo = bankAccountNo;
      if (bankIfscCode !== undefined) updateData.bankIfscCode = bankIfscCode;
      if (panNumber !== undefined) updateData.panNumber = panNumber;
      if (aadhaarNumber !== undefined) updateData.aadhaarNumber = aadhaarNumber;
      if (taxId !== undefined) updateData.taxId = taxId;
      if (salary !== undefined) updateData.salary = salary;
      if (salaryCurrency !== undefined) updateData.salaryCurrency = salaryCurrency;
      if (avatar !== undefined) updateData.avatar = avatar || null;
      if (status !== undefined) updateData.status = status;

      const employee = await db.employee.update({
        where: { id: actualId },
        data: updateData,
        include: coreInclude,
      });

      // ─── Update User role if provided ───
      if (role !== undefined && employee.userId) {
        try {
          const effectiveRole = role || 'employee';
          console.log(`[Employee PUT] Updating role for user ${employee.userId} to: ${effectiveRole}`);
          await db.user.update({
            where: { id: employee.userId },
            data: { role: effectiveRole },
          });

          // Also update UserRoleAssignment if a Role record exists
          try {
            const roleRecord = await db.role.findFirst({
              where: {
                OR: [
                  { key: effectiveRole },
                  { name: { equals: effectiveRole, mode: 'insensitive' } },
                ],
              },
            });
            if (roleRecord) {
              await db.userRoleAssignment.deleteMany({
                where: { userId: employee.userId },
              });
              await db.userRoleAssignment.create({
                data: {
                  userId: employee.userId,
                  roleId: roleRecord.id,
                  companyId: employee.companyId || null,
                },
              });
            }
          } catch (roleAssignErr) {
            console.warn('[Employee PUT] Role assignment update failed (non-critical):', roleAssignErr);
          }

          // Re-fetch employee with updated user role for the response
          const updatedEmployee = await db.employee.findUnique({
            where: { id: actualId },
            include: coreInclude,
          });
          if (updatedEmployee) {
            // Try audit log (non-critical)
            try {
              const token = getTokenFromHeaders(request);
              if (token) {
                const decoded = await verifyToken(token);
                if (decoded) {
                  await db.auditLog.create({
                    data: {
                      userId: decoded.userId as string,
                      action: 'UPDATE_EMPLOYEE',
                      module: 'employees',
                      details: `Updated employee ${employee.employeeId} (role: ${effectiveRole})`,
                    },
                  });
                }
              }
            } catch { /* non-critical */ }

            return NextResponse.json({ employee: updatedEmployee }, { headers: corsHeaders() });
          }
        } catch (roleUpdateErr) {
          console.error('[Employee PUT] Failed to update user role (non-critical):', roleUpdateErr);
        }
      }

      // Try audit log (non-critical)
      try {
        const token = getTokenFromHeaders(request);
        if (token) {
          const decoded = await verifyToken(token);
          if (decoded) {
            await db.auditLog.create({
              data: {
                userId: decoded.userId as string,
                action: 'UPDATE_EMPLOYEE',
                module: 'employees',
                details: `Updated employee ${employee.employeeId}`,
              },
            });
          }
        }
      } catch { /* non-critical */ }

      return NextResponse.json(
        { employee },
        { headers: corsHeaders() }
      );
    } catch (dbError) {
      console.error('[Employee PUT] DB update failed:', dbError);
      return NextResponse.json(
        { error: 'Failed to update employee' },
        { status: 500, headers: corsHeaders() }
      );
    }
  } catch (error) {
    console.error('[Employee PUT] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders() }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const db = await getDb(request);
  try {
    const { id: rawId } = await params;
    const id = decodeURIComponent(rawId);

    try {
      let existingEmployee = await db.employee.findUnique({ where: { id } });
      if (!existingEmployee) {
        existingEmployee = await db.employee.findUnique({ where: { employeeId: id } });
      }

      if (!existingEmployee) {
        return NextResponse.json(
          { error: 'Employee not found' },
          { status: 404, headers: corsHeaders() }
        );
      }

      const actualId = existingEmployee.id;

      const employee = await db.employee.update({
        where: { id: actualId },
        data: { status: 'terminated' },
      });

      try {
        const token = getTokenFromHeaders(request);
        if (token) {
          const decoded = await verifyToken(token);
          if (decoded) {
            await db.auditLog.create({
              data: {
                userId: decoded.userId as string,
                action: 'DELETE_EMPLOYEE',
                module: 'employees',
                details: `Soft deleted (terminated) employee ${employee.employeeId}`,
              },
            });
          }
        }
      } catch { /* non-critical */ }

      return NextResponse.json(
        { message: 'Employee terminated successfully', employee },
        { headers: corsHeaders() }
      );
    } catch (dbError) {
      console.error('[Employee DELETE] DB delete failed:', dbError);
      return NextResponse.json(
        { error: 'Failed to delete employee' },
        { status: 500, headers: corsHeaders() }
      );
    }
  } catch (error) {
    console.error('[Employee DELETE] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders() }
    );
  }
}
