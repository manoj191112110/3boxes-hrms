import { NextResponse } from 'next/server';
import { getDb, getPlatformDb, getDbForTenant } from '@/lib/tenant-db';
import { hashPassword, getTokenFromHeaders, verifyToken } from '@/lib/auth';
import { getDataScope } from '@/lib/roleAccess';
import { isServerLiveSite } from '@/lib/tenant-filter';

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

/** Generate a strong random password */
function generateRandomPassword(length = 12): string {
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lower = 'abcdefghijklmnopqrstuvwxyz';
  const digits = '0123456789';
  const special = '!@#$%&*';
  const all = upper + lower + digits + special;

  // Ensure at least one of each category
  let pwd = '';
  pwd += upper[Math.floor(Math.random() * upper.length)];
  pwd += lower[Math.floor(Math.random() * lower.length)];
  pwd += digits[Math.floor(Math.random() * digits.length)];
  pwd += special[Math.floor(Math.random() * special.length)];

  for (let i = pwd.length; i < length; i++) {
    pwd += all[Math.floor(Math.random() * all.length)];
  }

  // Shuffle
  return pwd.split('').sort(() => Math.random() - 0.5).join('');
}

/** GET — list all employees with their login credential status */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const departmentId = searchParams.get('departmentId') || '';
    const companyId = searchParams.get('companyId') || '';
    const tenantId = searchParams.get('tenantId') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders() });

    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401, headers: corsHeaders() });

    // ─── Resolve the correct tenant DB ───
    let db = await getDb(request);

    // ─── Inline schema-sync: ensure ALL Employee + User columns exist (fixes P2022) ───
    // The credentials route does employee.findMany with user: { select: { role, status,
    // lastLogin } }. If ANY of those columns are missing from the DB, the query fails
    // silently and returns no employees. We add them here to be safe.
    try {
      const syncStatements = [
        // Employee columns
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
        // ─── Login credentials status tracking (REQ-EMP-LOGIN) ───
        // Source of truth for "No Account" vs "Active" in the credentials page.
        // Until credentials are explicitly created/invited, this is 'not_invited'
        // — even if a User record exists from the seed.
        `ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "credentialsStatus" TEXT NOT NULL DEFAULT 'not_invited'`,
        `ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "credentialsInvitedAt" TIMESTAMP(3)`,
        `ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "credentialsInvitedBy" TEXT`,
        // User columns (the credentials route selects role, status, lastLogin)
        `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "avatar" TEXT`,
        `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "tenantId" TEXT`,
        `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "role" TEXT NOT NULL DEFAULT 'employee'`,
        `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'active'`,
        `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastLogin" TIMESTAMP(3)`,
        `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastLogout" TIMESTAMP(3)`,
        `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()`,
        `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()`,
      ];
      for (const sql of syncStatements) {
        try {
          await db.$executeRawUnsafe(sql);
        } catch { /* column already exists — safe to ignore */ }
      }
    } catch (syncErr) {
      console.warn('[Credentials GET] Inline schema-sync failed (non-fatal):', syncErr);
    }

    // Decode JWT role
    const jwtRole = (decoded.role as string) || 'employee';

    // For super_admin, resolve tenant DB from tenantId or companyId query param
    if (jwtRole === 'super_admin') {
      if (tenantId) {
        const tenant = await getPlatformDb().tenant.findUnique({
          where: { id: tenantId },
          select: { slug: true },
        });
        if (tenant?.slug) {
          db = await getDbForTenant(tenant.slug);
        }
      } else if (companyId) {
        let company = await db.company.findUnique({ where: { id: companyId }, select: { companyGroupId: true } }).catch(() => null);
        if (!company) company = await getPlatformDb().company.findUnique({ where: { id: companyId }, select: { companyGroupId: true } }).catch(() => null);
        if (company?.companyGroupId) {
          let group = await db.companyGroup.findUnique({ where: { id: company.companyGroupId }, select: { tenantId: true } }).catch(() => null);
          if (!group) group = await getPlatformDb().companyGroup.findUnique({ where: { id: company.companyGroupId }, select: { tenantId: true } }).catch(() => null);
          if (group?.tenantId) {
            const tenant = await getPlatformDb().tenant.findUnique({ where: { id: group.tenantId }, select: { slug: true } });
            if (tenant?.slug) db = await getDbForTenant(tenant.slug);
          }
        }
      }
    }

    // Get user info — try resolved db first, then platform DB
    let user = await db.user.findUnique({
      where: { id: decoded.userId as string },
      select: { id: true, role: true, tenantId: true },
    }).catch(() => null);
    if (!user) {
      // If not found in tenant DB (might be super_admin in platform DB), try platform DB
      user = await getPlatformDb().user.findUnique({
        where: { id: decoded.userId as string },
        select: { id: true, role: true, tenantId: true },
      });
    }
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404, headers: corsHeaders() });

    const userRole = user.role || jwtRole;
    const userId = user.id;
    const effectiveRole = userRole || jwtRole;
    const effectiveScope = getDataScope(effectiveRole);

    // Build where clause — SAME approach as /api/employees (which works)
    const where: Record<string, unknown> = {};

    if (departmentId) where.departmentId = departmentId;

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { employeeId: { contains: search, mode: 'insensitive' } },
      ];
    }

    // ─── Company scope filter (from CompanySwitcher) ───
    if (companyId) {
      where.companyId = companyId;
    }

    // ─── Tenant scope filter (super_admin only, when no companyId) ───
    if (!companyId && tenantId && effectiveRole === 'super_admin') {
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
          // No companies in this tenant → return empty
          where.id = '__never__';
        }
      } else {
        where.id = '__never__';
      }
    }

    // ─── Data scope filtering ───
    if (effectiveScope === 'self' && userId) {
      where.userId = userId;
    } else if (effectiveScope === 'team' && userId) {
      const ownEmp = await db.employee.findFirst({
        where: { userId, status: 'active' },
        select: { departmentId: true },
      });
      if (ownEmp) {
        where.departmentId = ownEmp.departmentId;
      }
    }
    // scope === 'all' → no additional tenant/company filtering (tenant_admin, admin, super_admin)

    console.log('[Credentials GET] where:', JSON.stringify(where, null, 2));
    console.log('[Credentials GET] jwtRole:', jwtRole, 'effectiveRole:', effectiveRole, 'scope:', effectiveScope, 'tenantId:', tenantId, 'companyId:', companyId);

    // Wrap the findMany in a try/catch so we can surface the actual Prisma error
    // instead of silently returning an empty list. Previously, if the query
    // failed (e.g., P2022 column missing), the catch block returned a generic
    // 500 error and the frontend showed "no employees".
    let employeesRaw: any[] = [];
    let total = 0;
    try {
      [employeesRaw, total] = await Promise.all([
        db.employee.findMany({
          where,
          select: {
            id: true,
            employeeId: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            status: true,
            department: { select: { name: true } },
            designation: { select: { title: true } },
            userId: true,
            user: { select: { id: true, email: true, status: true, lastLogin: true, role: true } },
            // Source-of-truth for credentials status — see schema-sync above
            credentialsStatus: true,
            credentialsInvitedAt: true,
          },
          orderBy: { firstName: 'asc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        db.employee.count({ where }),
      ]);
    } catch (queryErr) {
      const errObj = queryErr as { code?: string; message?: string };
      console.error('[Credentials GET] findMany failed:', JSON.stringify(errObj, Object.getOwnPropertyNames(errObj)));
      // Return the detailed error so the frontend can display it
      return NextResponse.json({
        error: `Failed to fetch employee credentials. [Details: ${errObj.message || 'Unknown'} (Code: ${errObj.code || 'N/A'})]`,
        details: errObj.message,
        code: errObj.code,
        _debug: { where, effectiveRole, effectiveScope },
      }, { status: 500, headers: corsHeaders() });
    }

    // ─── Deduplicate by email ───
    // Employee.email is NOT unique in the schema, so a re-seeded DB can have
    // multiple Employee rows with the same email. We dedupe here, keeping the
    // one with a userId (login account) preferred over the one without.
    const seenEmails = new Set<string>();
    const employees = employeesRaw.filter((emp) => {
      const key = (emp.email || '').toLowerCase().trim();
      if (!key) return true; // keep rows with no email (rare)
      if (seenEmails.has(key)) {
        // Duplicate — skip
        return false;
      }
      seenEmails.add(key);
      return true;
    }).sort((a, b) => {
      // Prefer employees with userId (login account) at the top
      if (a.userId && !b.userId) return -1;
      if (!a.userId && b.userId) return 1;
      return 0;
    });

    console.log('[Credentials GET] Found', employeesRaw.length, 'raw, deduped to', employees.length, 'of', total);

    const result = employees.map((emp) => {
      // ─── Auto-sync stale User email ───
      // If the employee has a linked User account AND the User's email differs
      // from the employee's current email, sync the User's email to match.
      // This handles the case where the employee email was updated via the
      // Add/Edit form BEFORE the PUT handler was fixed to sync emails.
      let loginEmail = emp.user?.email || emp.email;
      if (
        emp.userId &&
        emp.user &&
        emp.email &&
        emp.user.email &&
        emp.user.email.toLowerCase() !== emp.email.toLowerCase()
      ) {
        // Sync in the background — don't block the response
        const newEmail = emp.email;
        const userId = emp.userId;
        const oldEmail = emp.user.email;
        // Fire-and-forget sync (tenant DB + platform DB)
        Promise.all([
          db.user.update({ where: { id: userId }, data: { email: newEmail } }).catch(() => null),
          getPlatformDb().user.update({ where: { id: userId }, data: { email: newEmail } }).catch(() => null),
          getPlatformDb().user.findUnique({ where: { email: oldEmail }, select: { id: true } })
            .then(u => u && u.id !== userId
              ? getPlatformDb().user.update({ where: { id: u.id }, data: { email: newEmail } }).catch(() => null)
              : null
            ).catch(() => null),
        ]).then(() => {
          console.log(`[Credentials GET] Auto-synced email for user ${userId}: ${oldEmail} → ${newEmail}`);
        }).catch(() => {});
        loginEmail = newEmail; // Show the updated email immediately
      }

      // ─── Determine hasLoginAccount + loginStatus using credentialsStatus
      // as the source of truth (NOT just emp.userId). ───
      //
      // Previously: hasLoginAccount = !!emp.userId → if the seed created a
      // User record for the employee, the credentials page showed "Active"
      // even though the admin hadn't explicitly created/invited credentials.
      //
      // Now: hasLoginAccount is true ONLY when credentialsStatus is 'invited',
      // 'active', or 'inactive' — meaning the admin has explicitly created
      // login credentials for this employee. When credentialsStatus is
      // 'not_invited' (default), hasLoginAccount is false → shows "No Account".
      //
      // IMPORTANT: Once credentials are created, the User record's status is
      // set to 'active' (see POST handler). So 'invited' maps to 'active'
      // for display purposes — the account IS active, the employee just
      // hasn't logged in for the first time yet. This ensures the "Active"
      // metric count updates immediately after credential creation.
      const credStatus = (emp as any).credentialsStatus || 'not_invited';
      const hasLoginAccount = credStatus !== 'not_invited';
      let loginStatus: string;
      if (credStatus === 'not_invited') {
        loginStatus = 'no_account';
      } else if (credStatus === 'invited') {
        // The User account was created with status='active' when credentials
        // were issued. Show 'active' so the metric updates immediately.
        // (If the user account is inactive/suspended, show 'inactive' instead.)
        loginStatus = emp.user?.status === 'inactive' ? 'inactive' : 'active';
      } else if (credStatus === 'active') {
        loginStatus = 'active';
      } else if (credStatus === 'inactive') {
        loginStatus = 'inactive';
      } else {
        // Fallback: use legacy behavior (user.status)
        loginStatus = emp.user?.status || 'no_account';
      }

      return {
        id: emp.id,
        employeeId: emp.employeeId,
        firstName: emp.firstName,
        lastName: emp.lastName,
        // The official email (always current — the source of truth)
        email: emp.email,
        // The login email is now the SAME as the official email (we auto-sync)
        loginEmail: emp.email, // Always show the official email as the login email
        emailMismatch: false, // Always false now — we auto-sync
        phone: emp.phone,
        status: emp.status,
        department: emp.department?.name || '—',
        designation: emp.designation?.title || '—',
        hasLoginAccount,
        loginStatus,
        credentialsStatus: credStatus,
        credentialsInvitedAt: (emp as any).credentialsInvitedAt || null,
        lastLogin: emp.user?.lastLogin || null,
        userRole: emp.user?.role || null,
      };
    });

    return NextResponse.json({ employees: result, total, page, limit }, { headers: corsHeaders() });
  } catch (error) {
    console.error('[Credentials GET] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}

/** POST — Create/reset passwords for single, multiple, or all employees */
export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantIdParam = searchParams.get('tenantId');
    const companyIdParam = searchParams.get('companyId');

    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders() });

    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401, headers: corsHeaders() });

    // ─── Resolve the correct tenant DB (same as GET) ───
    let db = await getDb(request);
    const jwtRole = (decoded.role as string) || 'employee';

    if (jwtRole === 'super_admin') {
      if (tenantIdParam) {
        const tenant = await getPlatformDb().tenant.findUnique({
          where: { id: tenantIdParam },
          select: { slug: true },
        });
        if (tenant?.slug) db = await getDbForTenant(tenant.slug);
      } else if (companyIdParam) {
        let company = await db.company.findUnique({ where: { id: companyIdParam }, select: { companyGroupId: true } }).catch(() => null);
        if (!company) company = await getPlatformDb().company.findUnique({ where: { id: companyIdParam }, select: { companyGroupId: true } }).catch(() => null);
        if (company?.companyGroupId) {
          let group = await db.companyGroup.findUnique({ where: { id: company.companyGroupId }, select: { tenantId: true } }).catch(() => null);
          if (!group) group = await getPlatformDb().companyGroup.findUnique({ where: { id: company.companyGroupId }, select: { tenantId: true } }).catch(() => null);
          if (group?.tenantId) {
            const tenant = await getPlatformDb().tenant.findUnique({ where: { id: group.tenantId }, select: { slug: true } });
            if (tenant?.slug) db = await getDbForTenant(tenant.slug);
          }
        }
      }
    }

    // For demo link: tenantSlug from middleware x-tenant-slug header
    const tenantSlugHeader = request.headers.get('x-tenant-slug') || '';
    if (tenantSlugHeader && !tenantIdParam && !companyIdParam) {
      // The middleware already resolved the demo tenant slug — use it
      const tenant = await getPlatformDb().tenant.findUnique({
        where: { slug: tenantSlugHeader },
        select: { slug: true },
      });
      if (tenant?.slug) db = await getDbForTenant(tenant.slug);
    }

    const body = await request.json();
    const { mode, employeeIds, password } = body;

    // Validate
    if (!mode || !['single', 'selected', 'all'].includes(mode)) {
      return NextResponse.json({ error: 'mode must be single, selected, or all' }, { status: 400, headers: corsHeaders() });
    }
    if (mode === 'single' && (!employeeIds || employeeIds.length !== 1)) {
      return NextResponse.json({ error: 'single mode requires exactly one employeeId' }, { status: 400, headers: corsHeaders() });
    }
    if (mode === 'selected' && (!employeeIds || employeeIds.length === 0)) {
      return NextResponse.json({ error: 'selected mode requires at least one employeeId' }, { status: 400, headers: corsHeaders() });
    }

    // Get admin user — try resolved db, then platform DB
    let admin = await db.user.findUnique({
      where: { id: decoded.userId as string },
      select: { id: true, role: true, tenantId: true },
    }).catch(() => null);
    if (!admin) {
      admin = await getPlatformDb().user.findUnique({
        where: { id: decoded.userId as string },
        select: { id: true, role: true, tenantId: true },
      });
    }
    if (!admin) return NextResponse.json({ error: 'Admin not found' }, { status: 404, headers: corsHeaders() });

    // Build where clause — same approach as GET (matching /api/employees)
    const where: Record<string, unknown> = {};
    if (mode !== 'all' && employeeIds) {
      where.id = { in: employeeIds };
    }

    const results: Array<{
      employeeId: string;
      name: string;
      email: string;
      password: string;
      action: string;
      success: boolean;
      error?: string;
    }> = [];

    const employees = await db.employee.findMany({
      where,
      select: { id: true, employeeId: true, firstName: true, lastName: true, email: true, userId: true },
    });

    if (employees.length === 0) {
      return NextResponse.json({ error: 'No employees found' }, { status: 404, headers: corsHeaders() });
    }

    const platformDb = getPlatformDb();

    for (const emp of employees) {
      try {
        const pwd = password || generateRandomPassword();
        const hashedPwd = await hashPassword(pwd);

        if (emp.userId) {
          // Update existing user password in tenant DB
          await db.user.update({
            where: { id: emp.userId },
            data: { password: hashedPwd, status: 'active' },
          }).catch(() => null);

          // ─── CRITICAL: Also sync to platform DB ───
          // Login flow checks platform DB FIRST. If the user also exists in
          // platform DB (e.g., from an earlier seed), the platform password
          // would override the tenant DB password. We must update BOTH.
          await platformDb.user.update({
            where: { id: emp.userId },
            data: { password: hashedPwd, status: 'active' },
          }).catch(() => null);

          // Also try to find by email in platform DB (in case ID differs)
          const platformUserByEmail = await platformDb.user.findUnique({
            where: { email: emp.email },
            select: { id: true },
          }).catch(() => null);
          if (platformUserByEmail && platformUserByEmail.id !== emp.userId) {
            await platformDb.user.update({
              where: { id: platformUserByEmail.id },
              data: { password: hashedPwd, status: 'active' },
            }).catch(() => null);
          }

          // ─── Mark credentials as 'invited' on the Employee record ───
          // This is the source-of-truth for the credentials page.
          // Without this, the employee would still show as "No Account"
          // even after the admin explicitly created/reset their password.
          await db.$executeRawUnsafe(
            `UPDATE "Employee" SET "credentialsStatus" = 'invited', "credentialsInvitedAt" = NOW(), "credentialsInvitedBy" = $1, "updatedAt" = NOW() WHERE "id" = $2`,
            decoded.userId,
            emp.id,
          ).catch(() => null);

          results.push({
            employeeId: emp.employeeId,
            name: `${emp.firstName} ${emp.lastName}`,
            email: emp.email,
            password: pwd,
            action: 'password_reset',
            success: true,
          });
        } else {
          // Create new user account
          // Resolve tenantId for the new user — use admin's tenantId,
          // or fall back to the tenant from the x-tenant-slug header
          let userTenantId = admin.tenantId || '';
          if (!userTenantId) {
            const slugHeader = request.headers.get('x-tenant-slug') || '';
            if (slugHeader) {
              const t = await platformDb.tenant.findUnique({
                where: { slug: slugHeader },
                select: { id: true },
              });
              if (t) userTenantId = t.id;
            }
          }
          const newUser = await db.user.create({
            data: {
              email: emp.email,
              password: hashedPwd,
              name: `${emp.firstName} ${emp.lastName}`,
              role: 'employee',
              tenantId: userTenantId,
              status: 'active',
            },
          });
          // Link employee to user AND mark credentials as 'invited'
          await db.employee.update({
            where: { id: emp.id },
            data: {
              userId: newUser.id,
              // @ts-expect-error — credentialsStatus column exists in DB (via schema-sync)
              credentialsStatus: 'invited',
              // @ts-expect-error — credentialsInvitedAt column exists in DB
              credentialsInvitedAt: new Date(),
              // @ts-expect-error — credentialsInvitedBy column exists in DB
              credentialsInvitedBy: decoded.userId,
            },
          }).catch(async () => {
            // Fallback: use raw SQL in case the Prisma client doesn't know about
            // the new columns yet (tenant DBs that haven't been regenerated)
            await db.$executeRawUnsafe(
              `UPDATE "Employee" SET "userId" = $1, "credentialsStatus" = 'invited', "credentialsInvitedAt" = NOW(), "credentialsInvitedBy" = $2, "updatedAt" = NOW() WHERE "id" = $3`,
              newUser.id,
              decoded.userId,
              emp.id,
            ).catch(() => null);
          });
          results.push({
            employeeId: emp.employeeId,
            name: `${emp.firstName} ${emp.lastName}`,
            email: emp.email,
            password: pwd,
            action: 'account_created',
            success: true,
          });
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        // Handle unique email constraint - user might already exist with different employee
        if (errorMsg.includes('Unique constraint') || errorMsg.includes('unique')) {
          // Try to find existing user by email and link
          try {
            const existingUser = await db.user.findUnique({ where: { email: emp.email } });
            if (existingUser) {
              const pwd = password || generateRandomPassword();
              const hashedPwd = await hashPassword(pwd);
              await db.user.update({
                where: { id: existingUser.id },
                data: { password: hashedPwd, status: 'active' },
              });
              // Also sync password to platform DB
              await platformDb.user.update({
                where: { id: existingUser.id },
                data: { password: hashedPwd, status: 'active' },
              }).catch(() => null);
              // Also try by email in case ID differs in platform DB
              const platformUserByEmail = await platformDb.user.findUnique({
                where: { email: emp.email },
                select: { id: true },
              }).catch(() => null);
              if (platformUserByEmail && platformUserByEmail.id !== existingUser.id) {
                await platformDb.user.update({
                  where: { id: platformUserByEmail.id },
                  data: { password: hashedPwd, status: 'active' },
                }).catch(() => null);
              }
              await db.employee.update({
                where: { id: emp.id },
                data: { userId: existingUser.id },
              });
              // Mark credentials as 'invited' (source-of-truth for credentials page)
              await db.$executeRawUnsafe(
                `UPDATE "Employee" SET "credentialsStatus" = 'invited', "credentialsInvitedAt" = NOW(), "credentialsInvitedBy" = $1, "updatedAt" = NOW() WHERE "id" = $2`,
                decoded.userId,
                emp.id,
              ).catch(() => null);
              results.push({
                employeeId: emp.employeeId,
                name: `${emp.firstName} ${emp.lastName}`,
                email: emp.email,
                password: pwd,
                action: 'linked_and_reset',
                success: true,
              });
            } else {
              results.push({
                employeeId: emp.employeeId,
                name: `${emp.firstName} ${emp.lastName}`,
                email: emp.email,
                password: '',
                action: 'failed',
                success: false,
                error: errorMsg,
              });
            }
          } catch (linkErr) {
            results.push({
              employeeId: emp.employeeId,
              name: `${emp.firstName} ${emp.lastName}`,
              email: emp.email,
              password: '',
              action: 'failed',
              success: false,
              error: linkErr instanceof Error ? linkErr.message : 'Link failed',
            });
          }
        } else {
          results.push({
            employeeId: emp.employeeId,
            name: `${emp.firstName} ${emp.lastName}`,
            email: emp.email,
            password: '',
            action: 'failed',
            success: false,
            error: errorMsg,
          });
        }
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    return NextResponse.json({
      message: `Processed ${results.length} employees: ${successCount} succeeded, ${failCount} failed`,
      results,
      summary: { total: results.length, succeeded: successCount, failed: failCount },
    }, { headers: corsHeaders() });
  } catch (error) {
    console.error('[Credentials POST] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}

/** PUT — Update a single employee's login email or password */
export async function PUT(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantIdParam = searchParams.get('tenantId');
    const companyIdParam = searchParams.get('companyId');

    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders() });

    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401, headers: corsHeaders() });

    // ─── Resolve the correct tenant DB (same as GET/POST) ───
    // This is the FIX: previously the PUT handler used only getDb(request),
    // which does NOT honor ?tenantId= and ?companyId= query params for
    // super_admin. This caused password resets to update the wrong DB
    // (platform DB instead of the tenant DB where the user actually lives).
    let db = await getDb(request);
    const jwtRole = (decoded.role as string) || 'employee';
    const platformDb = getPlatformDb();

    if (jwtRole === 'super_admin') {
      if (tenantIdParam) {
        const tenant = await platformDb.tenant.findUnique({
          where: { id: tenantIdParam },
          select: { slug: true },
        });
        if (tenant?.slug) db = await getDbForTenant(tenant.slug);
      } else if (companyIdParam) {
        let company = await db.company.findUnique({ where: { id: companyIdParam }, select: { companyGroupId: true } }).catch(() => null);
        if (!company) company = await platformDb.company.findUnique({ where: { id: companyIdParam }, select: { companyGroupId: true } }).catch(() => null);
        if (company?.companyGroupId) {
          let group = await db.companyGroup.findUnique({ where: { id: company.companyGroupId }, select: { tenantId: true } }).catch(() => null);
          if (!group) group = await platformDb.companyGroup.findUnique({ where: { id: company.companyGroupId }, select: { tenantId: true } }).catch(() => null);
          if (group?.tenantId) {
            const tenant = await platformDb.tenant.findUnique({ where: { id: group.tenantId }, select: { slug: true } });
            if (tenant?.slug) db = await getDbForTenant(tenant.slug);
          }
        }
      }
    }

    // Also honor x-tenant-slug header (set by middleware on demo link)
    const tenantSlugHeader = request.headers.get('x-tenant-slug') || '';
    if (tenantSlugHeader && !tenantIdParam && !companyIdParam) {
      const tenant = await platformDb.tenant.findUnique({
        where: { slug: tenantSlugHeader },
        select: { slug: true },
      });
      if (tenant?.slug) db = await getDbForTenant(tenant.slug);
    }

    const body = await request.json();
    const { employeeId, email, password, action } = body;

    if (!employeeId) {
      return NextResponse.json({ error: 'employeeId is required' }, { status: 400, headers: corsHeaders() });
    }

    const employee = await db.employee.findUnique({
      where: { id: employeeId },
      select: { id: true, employeeId: true, firstName: true, lastName: true, email: true, userId: true },
    });

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404, headers: corsHeaders() });
    }

    if (action === 'update_email' && email) {
      // Update the user's login email in BOTH the tenant DB and platform DB
      // (login flow checks platform DB first, so we must keep them in sync)
      if (employee.userId) {
        await db.user.update({
          where: { id: employee.userId },
          data: { email },
        }).catch(() => null);
        // Also update in platform DB if the user exists there
        await platformDb.user.update({
          where: { id: employee.userId },
          data: { email },
        }).catch(() => null);
        // Also update employee email
        await db.employee.update({
          where: { id: employeeId },
          data: { email },
        });
      }
      return NextResponse.json({ message: 'Email updated successfully' }, { headers: corsHeaders() });
    }

    if (action === 'reset_password') {
      const pwd = password || generateRandomPassword();
      const hashedPwd = await hashPassword(pwd);

      if (employee.userId) {
        // Update password in tenant DB
        await db.user.update({
          where: { id: employee.userId },
          data: { password: hashedPwd, status: 'active' },
        }).catch(() => null);

        // ─── CRITICAL FIX ───
        // Login flow checks platform DB FIRST (Phase 1), then tenant DB (Phase 2).
        // If the user exists in BOTH DBs (which can happen after a re-seed),
        // the login uses the platform DB password. We MUST update the user in
        // BOTH databases to ensure the password reset actually takes effect.
        await platformDb.user.update({
          where: { id: employee.userId },
          data: { password: hashedPwd, status: 'active' },
        }).catch(() => null);

        // Also try to find and update by email in platform DB (in case the
        // user record exists with a different ID in platform DB)
        const platformUserByEmail = await platformDb.user.findUnique({
          where: { email: employee.email },
          select: { id: true },
        }).catch(() => null);
        if (platformUserByEmail && platformUserByEmail.id !== employee.userId) {
          await platformDb.user.update({
            where: { id: platformUserByEmail.id },
            data: { password: hashedPwd, status: 'active' },
          }).catch(() => null);
        }
      } else {
        // Create account if doesn't exist
        let admin = await db.user.findUnique({
          where: { id: decoded.userId as string },
          select: { tenantId: true },
        }).catch(() => null);
        if (!admin) {
          admin = await platformDb.user.findUnique({
            where: { id: decoded.userId as string },
            select: { tenantId: true },
          }).catch(() => null);
        }

        // Resolve the demo tenant ID for the new user
        let userTenantId = admin?.tenantId || '';
        if (!userTenantId && tenantSlugHeader) {
          const t = await platformDb.tenant.findUnique({
            where: { slug: tenantSlugHeader },
            select: { id: true },
          });
          if (t) userTenantId = t.id;
        }

        const newUser = await db.user.create({
          data: {
            email: employee.email,
            password: hashedPwd,
            name: `${employee.firstName} ${employee.lastName}`,
            role: 'employee',
            tenantId: userTenantId,
            status: 'active',
          },
        });
        await db.employee.update({
          where: { id: employeeId },
          data: { userId: newUser.id },
        });
      }

      return NextResponse.json({
        message: 'Password reset successfully',
        password: pwd,
        email: employee.email,
      }, { headers: corsHeaders() });
    }

    if (action === 'toggle_status') {
      if (!employee.userId) {
        return NextResponse.json({ error: 'Employee has no login account' }, { status: 400, headers: corsHeaders() });
      }
      const currentUser = await db.user.findUnique({ where: { id: employee.userId }, select: { status: true } });
      const newStatus = currentUser?.status === 'active' ? 'inactive' : 'active';
      await db.user.update({
        where: { id: employee.userId },
        data: { status: newStatus },
      }).catch(() => null);
      // Also sync to platform DB
      await platformDb.user.update({
        where: { id: employee.userId },
        data: { status: newStatus },
      }).catch(() => null);
      return NextResponse.json({ message: `Account ${newStatus === 'active' ? 'enabled' : 'disabled'}` }, { headers: corsHeaders() });
    }

    if (action === 'delete_account') {
      if (!employee.userId) {
        return NextResponse.json({ error: 'Employee has no login account' }, { status: 400, headers: corsHeaders() });
      }
      // Unlink employee first
      await db.employee.update({
        where: { id: employeeId },
        data: { userId: null },
      });
      // Delete user from tenant DB
      await db.user.delete({
        where: { id: employee.userId },
      }).catch(() => null);
      // Also delete from platform DB if exists
      await platformDb.user.delete({
        where: { id: employee.userId },
      }).catch(() => null);
      return NextResponse.json({ message: 'Login account deleted' }, { headers: corsHeaders() });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400, headers: corsHeaders() });
  } catch (error) {
    console.error('[Credentials PUT] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}
