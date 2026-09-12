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

    // ─── Inline schema-sync: ensure ALL Employee columns exist ───
    try {
      const syncStatements = [
        `ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "avatar" TEXT`,
        `ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "personalEmail" TEXT`,
        `ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "employeeStatus" TEXT NOT NULL DEFAULT 'confirmed'`,
        `ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "employeeType" TEXT NOT NULL DEFAULT 'full_time'`,
        `ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "maritalStatus" TEXT`,
        `ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "nationality" TEXT`,
        `ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "address" TEXT`,
        `ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "city" TEXT`,
        `ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "state" TEXT`,
        `ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "zipCode" TEXT`,
        `ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "country" TEXT`,
        `ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'active'`,
        `ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "reportingManagerId" TEXT`,
        `ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "designationId" TEXT`,
        `ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "dateOfJoining" TIMESTAMP(3)`,
        `ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "bloodGroup" TEXT`,
        `ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "emergencyContactName" TEXT`,
        `ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "emergencyContactPhone" TEXT`,
        `ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "bankName" TEXT`,
        `ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "bankAccountNo" TEXT`,
        `ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "bankIfscCode" TEXT`,
        `ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "panNumber" TEXT`,
        `ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "aadhaarNumber" TEXT`,
        `ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "taxId" TEXT`,
        `ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "salary" DOUBLE PRECISION`,
        `ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "salaryCurrency" TEXT NOT NULL DEFAULT 'INR'`,
        `ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "leavePolicyId" TEXT`,
        `ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "attendancePolicyId" TEXT`,
        `ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "travelPolicyId" TEXT`,
        `ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "salaryStructureId" TEXT`,
      ];
      for (const sql of syncStatements) {
        try { await db.$executeRawUnsafe(sql); } catch { /* column already exists */ }
      }
    } catch (syncErr) {
      console.warn('[Employee GET] Inline schema-sync failed (non-fatal):', syncErr);
    }

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

    // ─── Inline schema-sync: ensure ALL Employee columns exist ───
    try {
      const syncStatements = [
        `ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "avatar" TEXT`,
        `ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "personalEmail" TEXT`,
        `ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "employeeStatus" TEXT NOT NULL DEFAULT 'confirmed'`,
        `ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "employeeType" TEXT NOT NULL DEFAULT 'full_time'`,
        `ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "maritalStatus" TEXT`,
        `ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "reportingManagerId" TEXT`,
        `ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'active'`,
      ];
      for (const sql of syncStatements) {
        try { await db.$executeRawUnsafe(sql); } catch { /* column already exists */ }
      }
    } catch (syncErr) {
      console.warn('[Employee PUT] Inline schema-sync failed (non-fatal):', syncErr);
    }

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
        firstName, lastName, email, personalEmail, phone, departmentId, designationId,
        branchId, companyId, dateOfJoining, dateOfBirth, gender, maritalStatus,
        nationality, address, city, state, zipCode, country, bloodGroup,
        emergencyContactName, emergencyContactPhone, bankName, bankAccountNo,
        bankIfscCode, panNumber, aadhaarNumber, taxId, salary, salaryCurrency,
        status, role, avatar,
        employeeStatus, employeeType,
      } = body;

      const updateData: Record<string, unknown> = {};
      if (firstName !== undefined) updateData.firstName = firstName;
      if (lastName !== undefined) updateData.lastName = lastName;
      if (email !== undefined) updateData.email = email;
      if (personalEmail !== undefined) updateData.personalEmail = personalEmail || null;
      if (phone !== undefined) updateData.phone = phone;
      if (employeeStatus !== undefined) updateData.employeeStatus = employeeStatus;
      if (employeeType !== undefined) updateData.employeeType = employeeType;
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

      // ─── Sync email to the linked User account ───
      // When the employee's official email is updated, also update the linked
      // User record's email so login credentials stay in sync. Without this,
      // the credentials page shows the OLD user.email even after the employee
      // email was updated.
      if (email !== undefined && employee.userId) {
        try {
          // Update the User's email in the tenant DB
          await db.user.update({
            where: { id: employee.userId },
            data: { email },
          }).catch(() => null);

          // Also update in the platform DB (login checks platform DB first)
          const { getPlatformDb } = await import('@/lib/tenant-db');
          const platformDb = getPlatformDb();
          await platformDb.user.update({
            where: { id: employee.userId },
            data: { email },
          }).catch(() => null);

          // Also try to find and update by the OLD email in platform DB
          // (in case the User record exists with a different ID)
          if (existingEmployee.email && existingEmployee.email !== email) {
            const platformUserByEmail = await platformDb.user.findUnique({
              where: { email: existingEmployee.email },
              select: { id: true },
            }).catch(() => null);
            if (platformUserByEmail && platformUserByEmail.id !== employee.userId) {
              await platformDb.user.update({
                where: { id: platformUserByEmail.id },
                data: { email },
              }).catch(() => null);
            }
          }

          console.log(`[Employee PUT] Synced email update for user ${employee.userId}: ${existingEmployee.email} → ${email}`);
        } catch (syncErr) {
          console.error('[Employee PUT] Failed to sync email to User account (non-critical):', syncErr);
        }
      }

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

      // ─── Auto-create/update probation review if employeeStatus changed to 'probation' ───
      if (employeeStatus === 'probation' && existingEmployee.employeeStatus !== 'probation') {
        // Status changed TO probation — create a probation review
        try {
          const doj = dateOfJoining || existingEmployee.dateOfJoining;
          if (doj) {
            // Check if a probation review already exists
            const existingReview = await db.performanceReview.findFirst({
              where: { employeeId: actualId, reviewCycle: 'Probation' },
            });

            if (!existingReview) {
              // Calculate end date from body.probationEndDate or default 6 months
              let endDate: Date;
              if (body.probationEndDate) {
                endDate = new Date(body.probationEndDate);
              } else {
                endDate = new Date(doj);
                endDate.setMonth(endDate.getMonth() + 6);
              }

              const startDate = new Date(doj);
              const probPeriodMs = endDate.getTime() - startDate.getTime();
              const probPeriodMonths = Math.round(probPeriodMs / (1000 * 60 * 60 * 24 * 30));

              const probationData = JSON.stringify({
                probationStartDate: doj instanceof Date ? doj.toISOString().split('T')[0] : doj,
                probationEndDate: endDate.toISOString().split('T')[0],
                probationPeriod: probPeriodMonths || 6,
                extensionPeriod: 0,
                performanceRating: 0,
                reviewComments: 'Auto-created from employee edit. Status changed to Probation.',
                kpiStatus: 'pending',
                decision: 'pending',
                effectiveDate: endDate.toISOString().split('T')[0],
                autoCreated: true,
                workflowStage: 'hr_review',
                alertSent10Day: false,
                alertSent3Day: false,
                alertSent1Day: false,
                alertSentOverdue: false,
              });

              await db.performanceReview.create({
                data: {
                  employeeId: actualId,
                  reviewCycle: 'Probation',
                  reviewPeriod: `Probation (${probPeriodMonths || 6} months)`,
                  rating: 0,
                  overallRating: 0,
                  comments: probationData,
                  status: 'pending',
                  reviewDate: endDate,
                },
              }).catch(() => null);

              console.log(`[Employee PUT] Auto-created probation review for ${actualId} (end: ${endDate.toISOString().split('T')[0]})`);
            }
          }
        } catch (probErr) {
          console.error('[Employee PUT] Auto-probation creation failed (non-critical):', probErr);
        }
      } else if (employeeStatus && employeeStatus !== 'probation' && existingEmployee.employeeStatus === 'probation') {
        // Status changed FROM probation to something else — update the probation review status
        try {
          await db.performanceReview.updateMany({
            where: { employeeId: actualId, reviewCycle: 'Probation', status: 'pending' },
            data: { status: employeeStatus === 'confirmed' ? 'completed' : 'rejected' },
          }).catch(() => null);
        } catch { /* non-critical */ }
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
