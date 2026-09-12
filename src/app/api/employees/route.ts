import { NextResponse } from 'next/server';
import { getDb, getPlatformDb, getDbForTenant } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';
import { getDataScope } from '@/lib/roleAccess';
import { getEmployeeCompanyFilter, getCompanyFilter, getAuthInfo, resolveCompanyScope } from '@/lib/companyScope';
import { checkTenantStatusOrBlock } from '@/lib/tenant-guard';
import { isServerLiveSite } from '@/lib/tenant-filter';
// Note: isServerLiveSite is used later for the manual guard on normal queries
import { validateEmail, validatePhone, validateAadhaar, validatePAN, validateIFSC, validateBankAccount, validateOfficialEmail } from '@/lib/validators';

function generateRandomPassword(length = 12): string {
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lower = 'abcdefghijklmnopqrstuvwxyz';
  const digits = '0123456789';
  const special = '!@#$%&*';
  const all = upper + lower + digits + special;
  let pwd = '';
  pwd += upper[Math.floor(Math.random() * upper.length)];
  pwd += lower[Math.floor(Math.random() * lower.length)];
  pwd += digits[Math.floor(Math.random() * digits.length)];
  pwd += special[Math.floor(Math.random() * special.length)];
  for (let i = pwd.length; i < length; i++) {
    pwd += all[Math.floor(Math.random() * all.length)];
  }
  return pwd.split('').sort(() => Math.random() - 0.5).join('');
}

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

export async function GET(request: Request) {
  const db = await getDb(request);

  try {
    // ─── Inline schema-sync: ensure ALL Employee columns exist (fixes P2022) ───
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
        `ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()`,
        `ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()`,
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
        // Credential-invite columns (added to schema.prisma 2026-09-07). A
        // tenant DB missing these made EVERY Prisma employee query fail with
        // P2022 -> /api/employees returned 503 -> dashboard showed 0 employees
        // even though the data was intact. Keep this list in sync with the
        // schema whenever new Employee columns are added.
        `ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "credentialsStatus" TEXT DEFAULT 'not_invited'`,
        `ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "credentialsInvitedAt" TIMESTAMP(3)`,
        `ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "credentialsInvitedBy" TEXT`,
      ];
      for (const sql of syncStatements) {
        try {
          await db.$executeRawUnsafe(sql);
        } catch { /* column already exists — safe to ignore */ }
      }
    } catch (syncErr) {
      console.warn('[Employees GET] Inline schema-sync failed (non-fatal):', syncErr);
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const departmentId = searchParams.get('departmentId');
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    // Tenant scope — only meaningful for super_admin (tenant_admin is already
    // scoped to their own tenantId in the JWT).
    const tenantId = searchParams.get('tenantId');
    const queryCompanyId = searchParams.get('companyId');

    // ─── Decode JWT FIRST (before resolveCompanyScope) ───
    // This is the most reliable way to get the user's role — resolveCompanyScope
    // can fail if the employee lookup query throws.
    let jwtRole = 'employee';
    let jwtUserId: string | undefined;
    try {
      const token = getTokenFromHeaders(request);
      if (token) {
        const decoded = await verifyToken(token);
        if (decoded) {
          jwtRole = (decoded.role as string) || 'employee';
          jwtUserId = decoded.userId as string;
        }
      }
    } catch {
      // ignore
    }

    // ─── GOLDEN RULE: Aggregation for super_admin without a company selected ───
    // When super_admin has NO company selected (companyId is null), aggregate
    // employee counts. If tenantId is provided, aggregate from that specific
    // tenant DB. If tenantId is also null, aggregate across ALL visible tenants.
    if (jwtRole === 'super_admin' && !queryCompanyId) {
      try {
        const { getServerHiddenSlugs, PLATFORM_PLACEHOLDER_NAME } = await import('@/lib/tenant-filter');
        const hiddenSlugs = getServerHiddenSlugs(request);

        // Determine which tenants to aggregate from
        let visibleTenants: { id: string; slug: string; name: string }[];
        if (tenantId) {
          const tenant = await getPlatformDb().tenant.findUnique({
            where: { id: tenantId },
            select: { id: true, slug: true, name: true },
          });
          visibleTenants = tenant ? [tenant] : [];
        } else {
          visibleTenants = await getPlatformDb().tenant.findMany({
            where: {
              slug: { notIn: hiddenSlugs },
              NOT: { name: { contains: PLATFORM_PLACEHOLDER_NAME } },
            },
            select: { id: true, slug: true, name: true },
          });
        }
        console.log('[employees] Visible tenants:', visibleTenants.map(t => ({ id: t.id, slug: t.slug, name: t.name })));

        let totalEmployees = 0;
        let activeEmployees = 0;
        let onLeaveEmployees = 0;
        let inactiveEmployees = 0;
        const employees: any[] = [];
        const tenantDebug: any[] = [];

        for (const tenant of visibleTenants) {
          if (!tenant.slug) continue;
          try {
            // Use getDbForTenant which handles both dedicated DBs and
            // platform-DB-with-tenantId-filtering fallback
            const tenantDb = await getDbForTenant(tenant.slug);
            // Check if this tenant has a dedicated DB or is using platform DB (shared mode)
            const hasDedicatedDb = await getPlatformDb().tenantDatabase.findFirst({
              where: { tenant: { slug: tenant.slug }, isActive: true },
              select: { id: true },
            });
            console.log(`[employees] Tenant "${tenant.slug}": hasDedicatedDb=`, !!hasDedicatedDb);

            // If no dedicated DB (shared mode), filter by company IDs belonging to this tenant
            // Employee has companyId -> Company -> CompanyGroup -> Tenant
            let empFilter: Record<string, unknown> = {};
            if (!hasDedicatedDb) {
              // Find all company groups for this tenant
              const groups = await tenantDb.companyGroup.findMany({
                where: { tenantId: tenant.id },
                select: { id: true, name: true },
              });
              const groupIds = groups.map(g => g.id);
              console.log(`[employees] Tenant "${tenant.slug}": groups=`, groups.map(g => ({ id: g.id, name: g.name })));
              if (groupIds.length > 0) {
                // Find all companies in those groups
                const companies = await tenantDb.company.findMany({
                  where: { companyGroupId: { in: groupIds } },
                  select: { id: true, name: true },
                });
                const companyIds = companies.map(c => c.id);
                console.log(`[employees] Tenant "${tenant.slug}": companies=`, companies.map(c => ({ id: c.id, name: c.name })));
                if (companyIds.length > 0) {
                  empFilter = { companyId: { in: companyIds } };
                } else {
                  // No companies for this tenant — skip
                  console.log(`[employees] Tenant "${tenant.slug}": no companies, skipping`);
                  continue;
                }
              } else {
                // No groups — skip this tenant
                console.log(`[employees] Tenant "${tenant.slug}": no groups, skipping`);
                continue;
              }
            }

            const tenantEmps = await tenantDb.employee.findMany({
              where: empFilter,
              include: {
                department: { select: { id: true, name: true } },
                designation: { select: { id: true, title: true } },
                branch: { select: { id: true, name: true } },
              },
              take: 500,
            });
            totalEmployees += tenantEmps.length;
            activeEmployees += tenantEmps.filter((e: any) => e.status === 'active').length;
            onLeaveEmployees += tenantEmps.filter((e: any) => e.status === 'on_leave').length;
            inactiveEmployees += tenantEmps.filter((e: any) => e.status !== 'active' && e.status !== 'on_leave').length;
            // Add tenant info to each employee for display
            employees.push(...tenantEmps.map((e: any) => ({ ...e, tenantName: tenant.name, tenantSlug: tenant.slug })));
            console.log(`[employees] Tenant "${tenant.slug}": found ${tenantEmps.length} employees`);
            tenantDebug.push({ slug: tenant.slug, name: tenant.name, hasDedicatedDb: !!hasDedicatedDb, empCount: tenantEmps.length, filter: empFilter });
          } catch (e) {
            console.error(`[employees] Failed to aggregate for tenant ${tenant.slug}:`, e);
            tenantDebug.push({ slug: tenant.slug, name: tenant.name, error: String(e) });
          }
        }

        console.log('[employees] Aggregation complete:', { totalEmployees, activeEmployees, onLeaveEmployees, inactiveEmployees, totalRecords: employees.length });

        return NextResponse.json({
          employees: employees.slice((page - 1) * limit, page * limit),
          pagination: { page, limit, total: employees.length, totalPages: Math.ceil(employees.length / limit) },
          dataScope: 'all-tenants',
          aggregateStats: { totalEmployees, activeEmployees, onLeaveEmployees, inactiveEmployees },
          _debug: { visibleTenantCount: visibleTenants.length, tenants: tenantDebug },
        }, { headers: corsHeaders() });
      } catch (aggError) {
        console.error('[employees] Aggregation error:', aggError);
        return NextResponse.json({
          employees: [],
          pagination: { page, limit, total: 0, totalPages: 0 },
          dataScope: 'all',
          _debug: { error: String(aggError) },
        }, { headers: corsHeaders() });
      }
    }

    // ─── Resolve company scope (for the normal query path) ───
    const scopeResult = await resolveCompanyScope(request);
    const isAuthed = scopeResult !== null;
    const userRole = scopeResult?.role || jwtRole;
    const userId = scopeResult?.userId || jwtUserId;
    const scope = scopeResult?.scope || 'all';

    // ─── For super_admin with companyId, resolve tenant DB from company ───
    // The company belongs to a CompanyGroup which belongs to a Tenant.
    // We need the tenant DB because employees live there, not in platform DB.
    // Try db first (might already be tenant DB if tenantId was sent),
    // then fall back to platform DB lookup.
    let queryDb = db;
    if (jwtRole === 'super_admin' && queryCompanyId) {
      // Check if db already has the company (it's the tenant DB)
      let company = await db.company.findUnique({
        where: { id: queryCompanyId },
        select: { companyGroupId: true },
      }).catch(() => null);

      // If not found in db, try platform DB
      if (!company) {
        company = await getPlatformDb().company.findUnique({
          where: { id: queryCompanyId },
          select: { companyGroupId: true },
        }).catch(() => null);
      }

      if (company?.companyGroupId) {
        // Find the group's tenant — try db first, then platform DB
        let group = await db.companyGroup.findUnique({
          where: { id: company.companyGroupId },
          select: { tenantId: true },
        }).catch(() => null);

        if (!group) {
          group = await getPlatformDb().companyGroup.findUnique({
            where: { id: company.companyGroupId },
            select: { tenantId: true },
          }).catch(() => null);
        }

        if (group?.tenantId) {
          // Only switch to tenant DB if we're not already on it
          // Check if db is already the tenant DB by seeing if it has the tenant
          const tenant = await getPlatformDb().tenant.findUnique({
            where: { id: group.tenantId },
            select: { slug: true },
          });
          if (tenant?.slug) {
            queryDb = await getDbForTenant(tenant.slug);
          }
        }
      }
    }

    // Try database query
    try {
      const where: Record<string, unknown> = {};
      if (departmentId) where.departmentId = departmentId;
      if (status) where.status = status;
      if (search) {
        where.OR = [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { employeeId: { contains: search, mode: 'insensitive' } },
        ];
      }

      // ─── Company scope filter ───
      // resolveCompanyScope already reads ?companyId= from the URL for admins
      // and enforces own-company for non-admins. scopeResult.companyId is:
      //   - A specific ID when an admin selected a company in CompanySwitcher,
      //     or when a non-admin is scoped to their own company.
      //   - null when an admin has no company selected (sees all).
      // FALLBACK: If resolveCompanyScope failed (returned null), use queryCompanyId
      // from the URL params directly so the company filter still works.
      const effectiveCompanyIdFilter = scopeResult?.companyId || queryCompanyId;
      if (effectiveCompanyIdFilter) {
        // Validate the company exists in THIS database before filtering.
        // A stale companyId (e.g., persisted in localStorage from another DB,
        // a deleted company, or a super-admin cross-tenant selection) used to
        // silently produce an empty list — the classic "employees disappeared"
        // confusion. If the company doesn't exist here, ignore the filter.
        const companyExists = await queryDb.company.findUnique({
          where: { id: effectiveCompanyIdFilter },
          select: { id: true },
        }).catch(() => null);
        if (companyExists) {
          where.companyId = effectiveCompanyIdFilter;
        } else {
          console.warn(`[Employees GET] Ignoring stale/unknown companyId filter: ${effectiveCompanyIdFilter}`);
        }
      }

      // ─── Tenant scope filter (super_admin only) ───
      // For super_admin with no companyId selected, allow narrowing to a
      // specific tenant's companies. Employee has no `company` relation —
      // only a bare companyId field, so we must resolve company IDs first.
      if (!scopeResult?.companyId && tenantId && userRole === 'super_admin') {
        const tenantGroups = await db.companyGroup.findMany({
          where: { tenantId },
          select: { id: true },
        });
        const groupIds = tenantGroups.map(g => g.id);
        if (groupIds.length > 0) {
          const tenantCompanies = await db.company.findMany({
            where: { companyGroupId: { in: groupIds } },
            select: { id: true },
          });
          const companyIds = tenantCompanies.map(c => c.id);
          if (companyIds.length > 0) {
            where.companyId = { in: companyIds };
          } else {
            where.id = '__never__';
          }
        } else {
          where.id = '__never__';
        }
      }

      // ─── Self / team / admin scope enforcement ───
      if (isAuthed) {
        if (scope === 'self' && userId) {
          // Employee: only see their own employee record
          where.userId = userId;
        } else if (scope === 'team' && userId) {
          // Manager: see own + direct reports (resolved via reportingManagerId + DottedLineManager)
          const ownEmp = await db.employee.findFirst({
            where: { userId, status: 'active' },
            select: { id: true },
          });
          if (ownEmp) {
            // 1. Direct reports via Employee.reportingManagerId
            const directReports = await db.employee.findMany({
              where: { reportingManagerId: ownEmp.id, status: 'active' },
              select: { id: true },
            });
            const directIds = directReports.map(e => e.id);

            // 2. Dotted-line reports via DottedLineManager (if table exists)
            let dottedIds: string[] = [];
            try {
              const dotted = await (db as any).dottedLineManager?.findMany({
                where: {
                  managerId: ownEmp.id,
                  OR: [{ endDate: null }, { endDate: { gt: new Date() } }],
                },
                select: { employeeId: true },
              });
              if (Array.isArray(dotted)) {
                dottedIds = dotted.map((d: { employeeId: string }) => d.employeeId);
              }
            } catch { /* DottedLineManager table might not exist */ }

            // Combine: own ID + direct + dotted (deduplicated)
            const visibleIds = Array.from(new Set([ownEmp.id, ...directIds, ...dottedIds]));
            if (visibleIds.length > 0) {
              where.id = { in: visibleIds };
            } else {
              // No reportees — fall back to own record only
              where.id = ownEmp.id;
            }
          } else {
            // No employee record — return nothing
            where.id = '__never__';
          }
        } else if (userRole === 'admin') {
          where.user = { role: { not: 'super_admin' } };
        }
      }

      const [employees, total] = await Promise.all([
        queryDb.employee.findMany({
          where,
          include: {
            department: true,
            designation: true,
            branch: true,
            user: {
              select: { id: true, email: true, role: true, avatar: true },
            },
          },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        queryDb.employee.count({ where }),
      ]);

      if (employees.length > 0 || total > 0) {
        return NextResponse.json(
          {
            employees,
            pagination: {
              page,
              limit,
              total,
              totalPages: Math.ceil(total / limit),
            },
            dataScope: isAuthed ? scope : 'all',
          },
          { headers: corsHeaders() }
        );
      }
      // DB returned 0 results — return empty list (no demo fallback)
      return NextResponse.json(
        {
          employees: [],
          pagination: { page, limit, total: 0, totalPages: 0 },
          dataScope: isAuthed ? scope : 'all',
        },
        { headers: corsHeaders() }
      );
    } catch (dbError) {
      console.error('DB employees query failed:', dbError);
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNAVAILABLE' },
        { status: 503, headers: corsHeaders() }
      );
    }
  } catch (error) {
    console.error('Get employees error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders() }
    );
  }
}

export async function POST(request: Request) {
  const db = await getDb(request);
  try {
    // ─── Tenant status guard: block writes for suspended/inactive tenants ───
    const tenantBlock = await checkTenantStatusOrBlock(request, corsHeaders);
    if (tenantBlock) return tenantBlock;

    // ─── Inline schema-sync: ensure ALL Employee columns exist before any query ───
    // This is a defensive measure to prevent P2022 "column does not exist" errors
    // when the DB schema hasn't been synced yet. We add every column the Prisma
    // client expects, with IF NOT EXISTS so re-runs are safe. This runs on EVERY
    // POST request but is fast (~50ms) because PostgreSQL short-circuits IF NOT EXISTS.
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
        `ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()`,
        `ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()`,
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
        // Credential-invite columns (added to schema.prisma 2026-09-07). A
        // tenant DB missing these made EVERY Prisma employee query fail with
        // P2022 -> /api/employees returned 503 -> dashboard showed 0 employees
        // even though the data was intact. Keep this list in sync with the
        // schema whenever new Employee columns are added.
        `ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "credentialsStatus" TEXT DEFAULT 'not_invited'`,
        `ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "credentialsInvitedAt" TIMESTAMP(3)`,
        `ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "credentialsInvitedBy" TEXT`,
      ];
      for (const sql of syncStatements) {
        try {
          await db.$executeRawUnsafe(sql);
        } catch { /* column already exists — safe to ignore */ }
      }
    } catch (syncErr) {
      // Schema sync failure is non-fatal — the create will fail with a
      // detailed Prisma error if a column is missing, which is fine.
      console.warn('[Employees POST] Inline schema-sync failed (non-fatal):', syncErr);
    }

    // Try auth but allow demo mode
    let isAuthed = false;
    let decodedUserId: string | undefined;

    const token = getTokenFromHeaders(request);
    if (token) {
      try {
        const decoded = await verifyToken(token);
        if (decoded) {
          isAuthed = true;
          decodedUserId = decoded.userId as string;
          const userRole = (decoded.role as string) || 'employee';
          const scope = getDataScope(userRole);
          if (scope === 'self') {
            return NextResponse.json(
              { error: 'You do not have permission to create employees' },
              { status: 403, headers: corsHeaders() }
            );
          }
        }
      } catch {
        // Continue in demo mode
      }
    }

    const body = await request.json();
    // ─── Only pick fields that exist in the Employee schema ───
    // The employee form sends MANY extra fields (pfNumber, pfUAN, esiNumber,
    // professionalTaxNumber, lwfNumber, foreignCitizenship*, previousEmployer*,
    // healthHistory*, etc.) that are NOT in the Prisma schema. If we pass them
    // through to db.employee.create(), Prisma throws P2009: Unknown argument.
    // We explicitly whitelist the known fields to avoid this.
    const {
      employeeId,
      firstName,
      lastName,
      email,
      personalEmail,
      phone,
      departmentId,
      designationId,
      branchId,
      companyId,
      dateOfJoining,
      dateOfBirth,
      gender,
      maritalStatus,
      nationality,
      address,
      city,
      state,
      zipCode,
      country,
      bloodGroup,
      emergencyContactName,
      emergencyContactPhone,
      bankName,
      bankAccountNo,
      bankIfscCode,
      panNumber,
      aadhaarNumber,
      taxId,
      salary,
      salaryCurrency,
      userId,
      role,
      avatar,
      // Employee Status & Type
      employeeStatus,
      employeeType,
      // Probation end date — sent from the form when employeeStatus='probation'.
      // Used to auto-create the probation review with the correct end date.
      probationEndDate,
      // Optional relationship fields (added in newer schema versions)
      reportingManagerId,
      leavePolicyId,
      attendancePolicyId,
      travelPolicyId,
      salaryStructureId,
    } = body;

    if (!employeeId || !firstName || !lastName || !email || !departmentId || !designationId) {
      // Build specific list of missing fields for user-friendly error
      const missingFields: string[] = [];
      if (!employeeId) missingFields.push('Employee ID');
      if (!firstName) missingFields.push('First Name');
      if (!lastName) missingFields.push('Last Name');
      if (!email) missingFields.push('Email');
      if (!departmentId) missingFields.push('Department');
      if (!designationId) missingFields.push('Designation');
      return NextResponse.json(
        { error: `Please fill in the required fields: ${missingFields.join(', ')}`, missingFields },
        { status: 400, headers: corsHeaders() }
      );
    }

    // ─── Server-side validation ───
    if (phone && typeof phone === 'string') {
      const phoneResult = validatePhone(phone);
      if (!phoneResult.valid) {
        return NextResponse.json({ error: phoneResult.error }, { status: 400, headers: corsHeaders() });
      }
    }
    if (email && typeof email === 'string') {
      // Validate email format AND ensure it's an official email (not personal)
      const emailResult = validateOfficialEmail(email);
      if (!emailResult.valid) {
        return NextResponse.json({ error: emailResult.error }, { status: 400, headers: corsHeaders() });
      }
    }
    if (aadhaarNumber && typeof aadhaarNumber === 'string') {
      const aadhaarResult = validateAadhaar(aadhaarNumber);
      if (!aadhaarResult.valid) {
        return NextResponse.json({ error: aadhaarResult.error }, { status: 400, headers: corsHeaders() });
      }
    }
    if (panNumber && typeof panNumber === 'string') {
      const panResult = validatePAN(panNumber);
      if (!panResult.valid) {
        return NextResponse.json({ error: panResult.error }, { status: 400, headers: corsHeaders() });
      }
    }
    if (bankIfscCode && typeof bankIfscCode === 'string') {
      const ifscResult = validateIFSC(bankIfscCode);
      if (!ifscResult.valid) {
        return NextResponse.json({ error: ifscResult.error }, { status: 400, headers: corsHeaders() });
      }
    }
    if (bankAccountNo && typeof bankAccountNo === 'string') {
      const bankResult = validateBankAccount(bankAccountNo);
      if (!bankResult.valid) {
        return NextResponse.json({ error: bankResult.error }, { status: 400, headers: corsHeaders() });
      }
    }

    // Try to create in database
    try {
      // Check for duplicate employeeId
      const existingEmployee = await db.employee.findUnique({
        where: { employeeId },
      });
      if (existingEmployee) {
        return NextResponse.json(
          { error: 'Employee ID already exists' },
          { status: 409, headers: corsHeaders() }
        );
      }

      // Check for duplicate email
      const existingEmail = await db.employee.findFirst({
        where: { email },
      });
      if (existingEmail) {
        return NextResponse.json(
          { error: 'Employee with this email already exists' },
          { status: 409, headers: corsHeaders() }
        );
      }

      // ─── Multi-tenancy: enforce group company employee strength limit ───
      //
      // If the new employee is being attached to a company that belongs to a
      // CompanyGroup with a `maxEmployees` barrier set, we need to verify the
      // barrier won't be breached.
      //
      // Two modes (group.employeeLimitMode):
      //   - 'per_company'  -> maxEmployees applies to EACH company in the group
      //   - 'group_total'  -> maxEmployees applies to the SUM across all companies
      //
      // If the company is not provided but a branch is, we'll resolve the
      // company from the branch.
      let effectiveCompanyId: string | null = companyId || null;
      if (!effectiveCompanyId && branchId) {
        const branch = await db.branch.findUnique({
          where: { id: branchId },
          select: { companyId: true },
        });
        if (branch) effectiveCompanyId = branch.companyId;
      }

      if (effectiveCompanyId) {
        const company = await db.company.findUnique({
          where: { id: effectiveCompanyId },
          select: {
            id: true,
            name: true,
            companyGroupId: true,
            companyGroup: {
              select: {
                id: true,
                name: true,
                employeeLimitMode: true,
                maxEmployees: true,
              },
            },
          },
        });

        if (company?.companyGroup && company.companyGroup.maxEmployees !== null && company.companyGroup.maxEmployees > 0) {
          const grp = company.companyGroup;
          if (grp.employeeLimitMode === 'per_company') {
            const countInCompany = await db.employee.count({
              where: { companyId: effectiveCompanyId, status: 'active' },
            });
            if (countInCompany >= grp.maxEmployees) {
              return NextResponse.json(
                {
                  error: `Employee strength barrier reached. Company "${company.name}" already has ${countInCompany} active employee(s); the group "${grp.name}" caps each company at ${grp.maxEmployees}. Ask the super admin to raise the limit.`,
                  code: 'EMPLOYEE_STRENGTH_LIMIT_REACHED',
                  mode: 'per_company',
                  limit: grp.maxEmployees,
                  current: countInCompany,
                  companyName: company.name,
                  groupName: grp.name,
                },
                { status: 403, headers: corsHeaders() }
              );
            }
          } else {
            // group_total mode
            const groupCompanyIds = await db.company.findMany({
              where: { companyGroupId: grp.id },
              select: { id: true },
            });
            const countInGroup = await db.employee.count({
              where: {
                companyId: { in: groupCompanyIds.map((c) => c.id) },
                status: 'active',
              },
            });
            if (countInGroup >= grp.maxEmployees) {
              return NextResponse.json(
                {
                  error: `Employee strength barrier reached. Group company "${grp.name}" already has ${countInGroup} active employee(s) across all its companies; the cap is ${grp.maxEmployees}. Ask the super admin to raise the limit.`,
                  code: 'EMPLOYEE_STRENGTH_LIMIT_REACHED',
                  mode: 'group_total',
                  limit: grp.maxEmployees,
                  current: countInGroup,
                  groupName: grp.name,
                },
                { status: 403, headers: corsHeaders() }
              );
            }
          }
        }
      }

      // ─── Build the create payload defensively ───
      // We start with the core fields that ALWAYS exist in the Employee table,
      // then conditionally add the optional relationship fields. This way, if
      // the DB is missing a column (e.g., reportingManagerId on a DB that
      // hasn't been schema-synced yet), Prisma won't throw P2009.
      const createData: Record<string, unknown> = {
        employeeId,
        firstName,
        lastName,
        email,
        personalEmail: personalEmail || null,
        phone: phone || null,
        departmentId: departmentId,
        designationId: designationId,
        branchId: branchId || null,
        companyId: companyId || null,
        dateOfJoining: dateOfJoining ? new Date(dateOfJoining) : new Date(),
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        gender: gender || null,
        maritalStatus: maritalStatus || null,
        nationality: nationality || null,
        address: address || null,
        city: city || null,
        state: state || null,
        zipCode: zipCode || null,
        country: country || null,
        bloodGroup: bloodGroup || null,
        emergencyContactName: emergencyContactName || null,
        emergencyContactPhone: emergencyContactPhone || null,
        bankName: bankName || null,
        bankAccountNo: bankAccountNo || null,
        bankIfscCode: bankIfscCode || null,
        panNumber: panNumber || null,
        aadhaarNumber: aadhaarNumber || null,
        taxId: taxId || null,
        salary: salary ? parseFloat(String(salary)) : null,
        salaryCurrency: salaryCurrency || 'INR',
        userId: userId || null,
        avatar: avatar || null,
        // Employee Status & Type
        employeeStatus: employeeStatus || 'confirmed',
        employeeType: employeeType || 'full_time',
        status: 'active',
      };

      // Conditionally add optional relationship fields.
      // These are nullable columns added in newer schema versions. If the
      // underlying DB column doesn't exist yet (schema-sync hasn't run), Prisma
      // will throw P2009. To be safe, we wrap the create in a try/catch and
      // retry without these fields if the first attempt fails with P2009.
      const optionalRelationFields = {
        reportingManagerId: reportingManagerId || null,
        leavePolicyId: leavePolicyId || null,
        attendancePolicyId: attendancePolicyId || null,
        travelPolicyId: travelPolicyId || null,
        salaryStructureId: salaryStructureId || null,
      };

      let employee;
      try {
        // First attempt: include optional relationship fields
        employee = await db.employee.create({
          data: { ...createData, ...optionalRelationFields },
          include: { department: true, designation: true, branch: true },
        });
      } catch (firstErr) {
        const firstErrObj = firstErr as { code?: string; message?: string };
        // If the error is about an unknown argument (P2009) or missing column,
        // retry WITHOUT the optional relationship fields. This handles the case
        // where the DB schema hasn't been synced yet.
        if (
          firstErrObj.code === 'P2009' ||
          (firstErrObj.message && firstErrObj.message.includes('Unknown argument')) ||
          (firstErrObj.message && firstErrObj.message.includes('does not exist'))
        ) {
          console.warn('[Employees POST] First attempt failed, retrying without optional relation fields:', firstErrObj.message);
          employee = await db.employee.create({
            data: createData,
            include: { department: true, designation: true, branch: true },
          });
        } else {
          // Re-throw other errors
          throw firstErr;
        }
      }

      if (isAuthed && decodedUserId) {
        try {
          await db.auditLog.create({
            data: {
              userId: decodedUserId,
              action: 'CREATE_EMPLOYEE',
              module: 'employees',
              details: `Created employee ${employee.employeeId} - ${firstName} ${lastName}`,
            },
          });
        } catch { /* non-critical */ }
      }

      // ─── Role-based User account creation ───
      // IMPORTANT: We do NOT auto-create a User account here. The employee is
      // created with userId = null. The admin must explicitly create login
      // credentials via the "Login Credentials" tab (or invite the employee)
      // to activate their login access. This ensures the "No Account" metric
      // correctly reflects employees who haven't been given login access yet.
      //
      // The role is stored on the Employee record's `role` field (if provided)
      // so it can be used when the admin later creates credentials via
      // /api/employees/credentials POST.
      //
      // If the form explicitly passes a `userId` (e.g., linking an existing
      // user), we honor that. But we don't create a new User automatically.
      if (userId) {
        // An explicit userId was provided — link the existing user to this employee
        try {
          await db.employee.update({
            where: { id: employee.id },
            data: { userId },
          });
        } catch (linkErr) {
          console.error('[Employees POST] Failed to link existing user to employee (non-critical):', linkErr);
        }
      }

      // Store the intended role on the employee record for later use when
      // credentials are created. We use a separate field or audit log.
      if (role && isAuthed && decodedUserId) {
        try {
          await db.auditLog.create({
            data: {
              userId: decodedUserId,
              action: 'EMPLOYEE_ROLE_SET',
              module: 'employees',
              details: `Employee ${employee.employeeId} - ${firstName} ${lastName} intended role: ${role} (credentials not yet created)`,
            },
          });
        } catch { /* non-critical */ }
      }

      // Create EmployeeCompanyMapping for the primary company (if companyId is provided)
      const mappingCompanyId = companyId || null;
      if (mappingCompanyId) {
        try {
          await db.employeeCompanyMapping.create({
            data: {
              employeeId: employee.id,
              companyId: mappingCompanyId,
              employeeCode: employeeId,
              departmentId: departmentId || null,
              designationId: designationId || null,
              branchId: branchId || null,
              isPrimary: true,
              status: 'active',
              dateOfJoining: dateOfJoining ? new Date(dateOfJoining) : new Date(),
            },
          });
        } catch (mappingErr) {
          console.error('Failed to create EmployeeCompanyMapping (non-critical):', mappingErr);
        }
      }

      // ─── Auto-create probation review if employeeStatus is 'probation' ───
      // When a new employee is created with employeeStatus='probation' AND
      // dateOfJoining is provided, we automatically create a PerformanceReview
      // (reviewCycle='Probation') with:
      //   - probationStartDate = dateOfJoining
      //   - probationEndDate = from the form (editable, default = joining + 6 months)
      //   - status = 'pending' (goes to HR/Admin for review)
      if (employeeStatus === 'probation' && dateOfJoining) {
        try {
          // Calculate the probation end date
          // Use the form-provided probationEndDate if available, otherwise default to 6 months
          let endDate: Date;
          if (probationEndDate) {
            endDate = new Date(probationEndDate);
          } else {
            endDate = new Date(dateOfJoining);
            endDate.setMonth(endDate.getMonth() + 6);
          }

          // Calculate the probation period in months (for display)
          const startDate = new Date(dateOfJoining);
          const probPeriodMs = endDate.getTime() - startDate.getTime();
          const probPeriodMonths = Math.round(probPeriodMs / (1000 * 60 * 60 * 24 * 30));

          // Serialize probation data as JSON in comments field
          const probationData = JSON.stringify({
            probationStartDate: dateOfJoining,
            probationEndDate: endDate.toISOString().split('T')[0],
            probationPeriod: probPeriodMonths || 6,
            extensionPeriod: 0,
            performanceRating: 0,
            reviewComments: 'Auto-created from employee onboarding. Employee status: Probation.',
            kpiStatus: 'pending',
            decision: 'pending',
            effectiveDate: endDate.toISOString().split('T')[0],
            confirmationLetter: null,
            autoCreated: true,
            // Workflow tracking
            workflowStage: 'hr_review',
            hrActionDate: null,
            mdActionDate: null,
            // Alert tracking
            alertSent10Day: false,
            alertSent3Day: false,
            alertSent1Day: false,
            alertSentOverdue: false,
          });

          await db.performanceReview.create({
            data: {
              employeeId: employee.id,
              reviewCycle: 'Probation',
              reviewPeriod: `Probation (${probPeriodMonths || 6} months)`,
              reviewerId: decodedUserId || null,
              rating: 0,
              overallRating: 0,
              comments: probationData,
              strengths: null,
              improvements: null,
              status: 'pending',
              reviewDate: endDate,
            },
          }).catch((createErr: { code?: string; message?: string }) => {
            console.error('[Employees POST] Failed to auto-create probation review:', createErr);
          });

          console.log(`[Employees POST] Auto-created probation review for employee ${employee.employeeId} (joining: ${dateOfJoining}, end: ${endDate.toISOString().split('T')[0]})`);
        } catch (probationErr) {
          console.error('[Employees POST] Failed to auto-create probation review (non-critical):', probationErr);
        }
      }

      return NextResponse.json(
        { employee },
        { status: 201, headers: corsHeaders() }
      );
    } catch (dbError) {
      console.error('[Employees POST] DB create employee failed:', JSON.stringify(dbError, Object.getOwnPropertyNames(dbError)));

      // ─── Return DETAILED error so the actual cause is visible ───
      // Previously this returned a generic "Failed to create employee" which
      // hid the real Prisma error. Now we always include the actual error
      // message + code so the user (and we) can diagnose the issue.
      const errObj = dbError as { code?: string; message?: string; meta?: unknown; stack?: string };
      const prismaCode = errObj?.code;
      const rawMessage = errObj?.message || 'Unknown error';

      // Build a user-friendly message for known Prisma codes, but ALWAYS
      // append the raw message so the actual cause is visible.
      let userFriendlyError = 'Failed to create employee.';

      if (prismaCode === 'P2002') {
        // Unique constraint violation
        const meta = errObj?.meta as { target?: string[] } | undefined;
        const targetFields = meta?.target?.join(', ') || 'unknown field';
        userFriendlyError = `A record with this ${targetFields} already exists. Please use a different value.`;
      } else if (prismaCode === 'P2003') {
        // Foreign key constraint violation — the selected Department/Designation/Branch
        // doesn't exist in this tenant DB
        const meta = errObj?.meta as { field_name?: string } | undefined;
        const fieldName = meta?.field_name || 'a related record';
        userFriendlyError = `Invalid "${fieldName}". The selected Department/Designation/Branch does not exist in this tenant database. Please refresh the page and select valid options from the dropdown.`;
      } else if (prismaCode === 'P2014') {
        userFriendlyError = 'Invalid relation in the form data.';
      } else if (prismaCode === 'P2009') {
        userFriendlyError = 'Validation error: a field in the form is not recognized by the database.';
      } else if (prismaCode === 'P2010') {
        userFriendlyError = 'Database query error (P2010).';
      } else if (prismaCode === 'P2016') {
        userFriendlyError = 'Query interpretation error (P2016).';
      } else if (prismaCode === 'P2017') {
        userFriendlyError = 'Record not found (P2017).';
      } else if (prismaCode === 'P2021') {
        userFriendlyError = 'Foreign key constraint failed (P2021).';
      } else if (prismaCode === 'P2025') {
        userFriendlyError = 'Related record not found (P2025). The selected Department/Designation/Branch may not exist.';
      } else if (rawMessage.includes('Unknown argument')) {
        // Prisma client validation — a field in the create payload doesn't exist in the schema
        userFriendlyError = 'Form contains a field the database does not recognize.';
      } else if (rawMessage.includes('does not exist')) {
        // PostgreSQL error — a column doesn't exist in the DB table
        userFriendlyError = 'A required database column is missing. The database schema may need to be synced.';
      } else if (rawMessage.includes('null value') && rawMessage.includes('violates not-null constraint')) {
        // NOT NULL constraint violation
        userFriendlyError = 'A required field is missing. Please fill in all required fields marked with *.';
      }

      // ─── ALWAYS append the raw Prisma message so the actual cause is visible ───
      // This is critical for debugging — the user can copy-paste this to us.
      const fullError = `${userFriendlyError} [Details: ${rawMessage}${prismaCode ? ` (Code: ${prismaCode})` : ''}]`;

      return NextResponse.json(
        {
          error: fullError,
          userMessage: userFriendlyError,
          details: rawMessage,
          code: prismaCode,
          meta: errObj?.meta,
        },
        { status: 500, headers: corsHeaders() }
      );
    }
  } catch (error) {
    console.error('[Employees POST] Create employee error:', error);
    return NextResponse.json(
      {
        error: `Internal server error. [Details: ${error instanceof Error ? error.message : 'Unknown'}]`,
        details: error instanceof Error ? error.message : 'Unknown',
      },
      { status: 500, headers: corsHeaders() }
    );
  }
}
