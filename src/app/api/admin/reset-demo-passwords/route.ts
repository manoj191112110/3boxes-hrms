import { NextResponse } from 'next/server';
import { getDb, getPlatformDb, getDbForTenant } from '@/lib/tenant-db';
import { getTokenFromHeaders, verifyToken, hashPassword } from '@/lib/auth';

/**
 * POST /api/admin/reset-demo-passwords
 *
 * Bulk-reset ALL demo user passwords to a known value (default: 'MarqAI@2026').
 * Updates passwords in BOTH the tenant DB and platform DB so login (which
 * checks platform DB first) always succeeds.
 *
 * Use this when:
 *   - Demo login credentials don't work after a re-seed
 *   - You want to reset all demo users to a known password for testing
 *   - The seed-demo script hasn't been re-run but you need fresh logins
 *
 * Body:
 *   { password?: string }  // optional, defaults to 'MarqAI@2026'
 *
 * Query params (for super_admin):
 *   ?tenantSlug=3boxes-hrms-demo  // or ?tenantId=<uuid>
 *
 * For demo link (non-super-admin), uses x-tenant-slug header from middleware.
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
      return NextResponse.json({ error: 'Only admins can reset demo passwords' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const newPassword = body.password || 'MarqAI@2026';

    const { searchParams } = new URL(request.url);
    const tenantIdParam = searchParams.get('tenantId');
    const tenantSlugParam = searchParams.get('tenantSlug') || '3boxes-hrms-demo';
    const tenantSlugHeader = request.headers.get('x-tenant-slug') || '';

    // ─── Resolve the tenant DB ───
    const platformDb = getPlatformDb();
    let db = await getDb(request);
    const jwtRole = (decoded.role as string) || 'employee';

    let resolvedTenantSlug = tenantSlugParam;

    if (jwtRole === 'super_admin') {
      if (tenantIdParam) {
        const tenant = await platformDb.tenant.findUnique({
          where: { id: tenantIdParam },
          select: { slug: true, name: true },
        });
        if (tenant?.slug) {
          resolvedTenantSlug = tenant.slug;
          db = await getDbForTenant(tenant.slug);
        }
      } else if (tenantSlugParam) {
        const tenant = await platformDb.tenant.findUnique({
          where: { slug: tenantSlugParam },
          select: { slug: true, name: true },
        });
        if (tenant?.slug) {
          resolvedTenantSlug = tenant.slug;
          db = await getDbForTenant(tenant.slug);
        }
      }
    } else if (tenantSlugHeader) {
      // Demo link: use middleware-resolved slug
      const tenant = await platformDb.tenant.findUnique({
        where: { slug: tenantSlugHeader },
        select: { slug: true, name: true },
      });
      if (tenant?.slug) {
        resolvedTenantSlug = tenant.slug;
        db = await getDbForTenant(tenant.slug);
      }
    }

    // Hash the new password
    const hashedPwd = await hashPassword(newPassword);

    // ─── Get all users in the tenant DB ───
    const tenantUsers = await db.user.findMany({
      select: { id: true, email: true, role: true, status: true },
    });

    let tenantUpdated = 0;
    let platformUpdated = 0;
    let platformCreated = 0;
    const errors: string[] = [];

    // ─── 1. Update all users in the tenant DB ───
    for (const u of tenantUsers) {
      try {
        await db.user.update({
          where: { id: u.id },
          data: { password: hashedPwd, status: 'active' },
        });
        tenantUpdated++;
      } catch (err) {
        errors.push(`Failed to update ${u.email} in tenant DB: ${err instanceof Error ? err.message : 'unknown'}`);
      }
    }

    // ─── 2. Sync to platform DB (login checks platform DB first) ───
    for (const u of tenantUsers) {
      try {
        // Try to find by ID first
        const platformUserById = await platformDb.user.findUnique({
          where: { id: u.id },
          select: { id: true },
        }).catch(() => null);

        if (platformUserById) {
          // Update by ID
          await platformDb.user.update({
            where: { id: u.id },
            data: { password: hashedPwd, status: 'active' },
          });
          platformUpdated++;
        } else {
          // Try by email
          const platformUserByEmail = await platformDb.user.findUnique({
            where: { email: u.email },
            select: { id: true },
          }).catch(() => null);

          if (platformUserByEmail) {
            // Update by email (different ID)
            await platformDb.user.update({
              where: { id: platformUserByEmail.id },
              data: { password: hashedPwd, status: 'active' },
            });
            platformUpdated++;
          } else {
            // User doesn't exist in platform DB — create them
            // This is the "missing platform user" case
            const tenant = await platformDb.tenant.findUnique({
              where: { slug: resolvedTenantSlug },
              select: { id: true },
            });
            try {
              await platformDb.user.create({
                data: {
                  id: u.id,
                  email: u.email,
                  password: hashedPwd,
                  name: u.email.split('@')[0],
                  role: u.role,
                  status: 'active',
                  tenantId: tenant?.id || null,
                },
              });
              platformCreated++;
            } catch (createErr) {
              errors.push(`Failed to create ${u.email} in platform DB: ${createErr instanceof Error ? createErr.message : 'unknown'}`);
            }
          }
        }
      } catch (err) {
        errors.push(`Failed to sync ${u.email} to platform DB: ${err instanceof Error ? err.message : 'unknown'}`);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Reset ${tenantUpdated} tenant DB users, synced ${platformUpdated} to platform DB, created ${platformCreated} missing platform users. All passwords set to '${newPassword}'.`,
      summary: {
        tenantDbUpdated: tenantUpdated,
        platformDbUpdated: platformUpdated,
        platformDbCreated: platformCreated,
        totalUsers: tenantUsers.length,
        errors: errors.slice(0, 10), // first 10 errors
        password: newPassword,
      },
    });
  } catch (error) {
    console.error('[reset-demo-passwords] Error:', error);
    return NextResponse.json(
      { error: 'Failed to reset demo passwords', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
