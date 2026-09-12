import { NextResponse } from 'next/server';
import { getDb, getPlatformDb, getDbForTenant } from '@/lib/tenant-db';
import { getTokenFromHeaders, verifyToken } from '@/lib/auth';

/**
 * POST /api/admin/purge-duplicates
 *
 * One-click fix for duplicate employee records and out-of-sync user passwords.
 *
 * What it does:
 *   1. Resolves the correct tenant DB (from query params, header, or JWT)
 *   2. Finds duplicate Employee records (same email, different IDs) in the
 *      tenant DB and deletes the orphans (keeping the one with a userId)
 *   3. Finds User records that exist in BOTH the tenant DB and platform DB
 *      with the same email but different IDs, and syncs the password from
 *      tenant DB → platform DB (so login, which checks platform DB first,
 *      always uses the most recently reset password)
 *   4. Returns a summary of what was cleaned up
 *
 * This endpoint is safe to run multiple times — it's idempotent.
 */
export async function POST(request: Request) {
  try {
    const token = getTokenFromHeaders(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
    if (!['super_admin', 'tenant_admin', 'admin'].includes(decoded.role as string)) {
      return NextResponse.json({ error: 'Only admins can purge duplicates' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const tenantIdParam = searchParams.get('tenantId');
    const tenantSlugParam = searchParams.get('tenantSlug');
    const companyIdParam = searchParams.get('companyId');
    const tenantSlugHeader = request.headers.get('x-tenant-slug') || '';

    // ─── Resolve the tenant DB ───
    const platformDb = getPlatformDb();
    let db = await getDb(request);
    const jwtRole = (decoded.role as string) || 'employee';

    if (jwtRole === 'super_admin') {
      // Priority: tenantId (UUID) > tenantSlug (string) > companyId (resolves via company→group→tenant)
      const effectiveTenantSlug = tenantIdParam || tenantSlugParam;
      if (effectiveTenantSlug && tenantIdParam) {
        // tenantId is a UUID — look up the slug
        const tenant = await platformDb.tenant.findUnique({
          where: { id: tenantIdParam },
          select: { slug: true, name: true },
        });
        if (tenant?.slug) {
          db = await getDbForTenant(tenant.slug);
        }
      } else if (tenantSlugParam) {
        // tenantSlug is the slug itself — use directly
        const tenant = await platformDb.tenant.findUnique({
          where: { slug: tenantSlugParam },
          select: { slug: true, name: true },
        });
        if (tenant?.slug) {
          db = await getDbForTenant(tenant.slug);
        }
      } else if (companyIdParam) {
        let company = await db.company.findUnique({ where: { id: companyIdParam }, select: { companyGroupId: true } }).catch(() => null);
        if (!company) company = await platformDb.company.findUnique({ where: { id: companyIdParam }, select: { companyGroupId: true } }).catch(() => null);
        if (company?.companyGroupId) {
          let group = await db.companyGroup.findUnique({ where: { id: company.companyGroupId }, select: { tenantId: true } }).catch(() => null);
          if (!group) group = await platformDb.companyGroup.findUnique({ where: { id: company.companyGroupId }, select: { tenantId: true } }).catch(() => null);
          if (group?.tenantId) {
            const tenant = await platformDb.tenant.findUnique({ where: { id: group.tenantId }, select: { slug: true, name: true } });
            if (tenant?.slug) db = await getDbForTenant(tenant.slug);
          }
        }
      }
    } else if (tenantSlugHeader) {
      // For demo link (non-super-admin), use the middleware-resolved tenant slug
      const tenant = await platformDb.tenant.findUnique({
        where: { slug: tenantSlugHeader },
        select: { slug: true, name: true },
      });
      if (tenant?.slug) db = await getDbForTenant(tenant.slug);
    }

    // ─── Detect if tenant DB IS the platform DB (same connection) ───
    // If so, we don't need to cross-sync — there's only one DB.
    const isSameAsPlatform = db === platformDb;

    const summary = {
      duplicateEmployeesDeleted: 0,
      duplicateUsersSynced: 0,
      orphanUsersDeleted: 0,
      isSameAsPlatform,
      details: [] as string[],
    };

    // ─── 1. Find and purge duplicate Employee records ───
    // Employee.email is NOT unique in the schema, so re-seeding can leave
    // multiple Employee rows with the same email. We keep the one with a
    // userId (login account) and delete the others.
    const allEmployees = await db.employee.findMany({
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        userId: true,
        companyId: true,
        createdAt: true,
      },
    });

    // Group by email (lowercase)
    const byEmail = new Map<string, typeof allEmployees>();
    for (const emp of allEmployees) {
      const key = (emp.email || '').toLowerCase().trim();
      if (!key) continue;
      if (!byEmail.has(key)) byEmail.set(key, []);
      byEmail.get(key)!.push(emp);
    }

    for (const [email, emps] of byEmail.entries()) {
      if (emps.length <= 1) continue;

      // Sort: prefer ones with userId, then most recently created
      emps.sort((a, b) => {
        if (a.userId && !b.userId) return -1;
        if (!a.userId && b.userId) return 1;
        return (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0);
      });

      const keep = emps[0];
      const dupes = emps.slice(1);

      for (const dup of dupes) {
        // Delete related records first
        const relatedDeletes = [
          () => db.payrollTransactionLine.deleteMany({ where: { employeeId: dup.id } }).catch(() => {}),
          () => db.payrollInput.deleteMany({ where: { employeeId: dup.id } }).catch(() => {}),
          () => db.attendance.deleteMany({ where: { employeeId: dup.id } }).catch(() => {}),
          () => db.leaveRequest.deleteMany({ where: { employeeId: dup.id } }).catch(() => {}),
          () => db.leaveBalance.deleteMany({ where: { employeeId: dup.id } }).catch(() => {}),
          () => db.expenseClaim.deleteMany({ where: { employeeId: dup.id } }).catch(() => {}),
          () => db.travelRequest.deleteMany({ where: { employeeId: dup.id } }).catch(() => {}),
          () => db.timesheet.deleteMany({ where: { employeeId: dup.id } }).catch(() => {}),
          () => db.assetAssignment.deleteMany({ where: { employeeId: dup.id } }).catch(() => {}),
          () => db.document.deleteMany({ where: { employeeId: dup.id } }).catch(() => {}),
          () => db.dependent.deleteMany({ where: { employeeId: dup.id } }).catch(() => {}),
          () => db.qualification.deleteMany({ where: { employeeId: dup.id } }).catch(() => {}),
          () => (db as any).experience?.deleteMany?.({ where: { employeeId: dup.id } }).catch(() => {}),
          () => (db as any).employeeSkill?.deleteMany?.({ where: { employeeId: dup.id } }).catch(() => {}),
          () => db.employeeCompanyMapping.deleteMany({ where: { employeeId: dup.id } }).catch(() => {}),
          () => db.performanceReview.deleteMany({ where: { employeeId: dup.id } }).catch(() => {}),
          () => db.goal.deleteMany({ where: { employeeId: dup.id } }).catch(() => {}),
          () => db.feedback.deleteMany({ where: { employeeId: dup.id } }).catch(() => {}),
          () => db.recognition.deleteMany({ where: { employeeId: dup.id } }).catch(() => {}),
          () => db.ticket.deleteMany({ where: { employeeId: dup.id } }).catch(() => {}),
          () => db.loan.deleteMany({ where: { employeeId: dup.id } }).catch(() => {}),
          () => db.trainingEnrollment.deleteMany({ where: { employeeId: dup.id } }).catch(() => {}),
          () => db.overtimeRecord.deleteMany({ where: { employeeId: dup.id } }).catch(() => {}),
          () => db.referral.deleteMany({ where: { employeeId: dup.id } }).catch(() => {}),
          () => db.projectMember.deleteMany({ where: { employeeId: dup.id } }).catch(() => {}),
        ];
        for (const op of relatedDeletes) {
          try { await op(); } catch {}
        }

        // Delete the duplicate employee
        try {
          await db.employee.delete({ where: { id: dup.id } });
          summary.duplicateEmployeesDeleted++;
          summary.details.push(`Deleted duplicate employee: ${dup.firstName} ${dup.lastName} (${email}) — kept the one with login account`);
        } catch (err) {
          console.error(`[purge-duplicates] Failed to delete employee ${dup.id}:`, err);
        }
      }
    }

    // ─── 2. Cross-DB sync: ensure platform DB users have same password as tenant DB ───
    // Login flow checks platform DB FIRST. If a user exists in both DBs but
    // with different passwords, login uses the platform DB password. We sync
    // the tenant DB password → platform DB so password resets actually take
    // effect for login.
    if (!isSameAsPlatform) {
      const tenantUsers = await db.user.findMany({
        select: { id: true, email: true, password: true, status: true, role: true, tenantId: true },
      });

      for (const tu of tenantUsers) {
        if (!tu.email) continue;

        // Find the matching user in platform DB by email
        const platformUser = await platformDb.user.findUnique({
          where: { email: tu.email },
          select: { id: true, password: true, status: true },
        }).catch(() => null);

        if (platformUser) {
          // User exists in both DBs — sync password and status
          const needsSync =
            platformUser.password !== tu.password ||
            platformUser.status !== tu.status;

          if (needsSync) {
            try {
              await platformDb.user.update({
                where: { id: platformUser.id },
                data: {
                  password: tu.password,
                  status: tu.status,
                },
              });
              summary.duplicateUsersSynced++;
              summary.details.push(`Synced password for ${tu.email} from tenant DB → platform DB`);
            } catch (err) {
              console.error(`[purge-duplicates] Failed to sync ${tu.email}:`, err);
            }
          }
        } else {
          // User only exists in tenant DB — create a copy in platform DB
          // so login Phase 1 can find them. This is the "missing platform user" case.
          try {
            await platformDb.user.create({
              data: {
                id: tu.id,
                email: tu.email,
                password: tu.password,
                name: tu.email.split('@')[0],
                role: tu.role,
                status: tu.status,
                tenantId: tu.tenantId,
              },
            });
            summary.duplicateUsersSynced++;
            summary.details.push(`Copied user ${tu.email} from tenant DB → platform DB (was missing)`);
          } catch (err) {
            // If create fails (e.g., ID conflict), try update by ID
            try {
              await platformDb.user.update({
                where: { id: tu.id },
                data: {
                  password: tu.password,
                  status: tu.status,
                },
              });
              summary.duplicateUsersSynced++;
              summary.details.push(`Updated password for ${tu.email} in platform DB (by ID)`);
            } catch (err2) {
              console.error(`[purge-duplicates] Failed to create/update platform user ${tu.email}:`, err2);
            }
          }
        }
      }
    } else {
      summary.details.push('Tenant DB IS the platform DB — no cross-DB sync needed');
    }

    // ─── 3. Find orphaned users (no matching employee) and report ───
    // We don't auto-delete these because they might be admin/tenant_admin users.
    // Just report them for awareness.
    const allUsers = await db.user.findMany({
      select: { id: true, email: true, role: true, tenantId: true },
    });
    const remainingEmployees = await db.employee.findMany({
      select: { id: true, email: true, userId: true },
    });
    const employeeUserIds = new Set(remainingEmployees.filter(e => e.userId).map(e => e.userId!));
    const orphanUsers = allUsers.filter(u => !employeeUserIds.has(u.id) && !['super_admin', 'tenant_admin', 'admin'].includes(u.role || ''));

    if (orphanUsers.length > 0) {
      summary.details.push(`Found ${orphanUsers.length} orphaned users (no employee record) — these are likely from previous seed runs. To clean them up, use the "Reset Employee Data" feature.`);
    }

    return NextResponse.json({
      success: true,
      message: `Purge complete. Deleted ${summary.duplicateEmployeesDeleted} duplicate employees, synced ${summary.duplicateUsersSynced} users across DBs.`,
      summary,
    });
  } catch (error) {
    console.error('[purge-duplicates] Error:', error);
    return NextResponse.json(
      { error: 'Failed to purge duplicates', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
