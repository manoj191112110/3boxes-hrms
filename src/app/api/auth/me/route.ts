import { NextResponse } from 'next/server';
import { getDb, getPlatformDb, getDbForTenant, getDbForTenantById } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';
import { isLiveMode, isDemoMode } from '@/lib/site-mode';
import { getServerHiddenSlugs, LIVE_HIDDEN_SLUGS, DEMO_HIDDEN_SLUGS } from '@/lib/tenant-filter';
import { withRouteCache } from '@/lib/api-route-cache';

const AUTH_ME_CACHE_MS = 60_000;

// ─── Hidden Tenant Slugs (GOLDEN RULE — FOOLPROOF) ──────────────────
// Uses tenant-filter.ts as PRIMARY (direct hostname check), then
// isLiveMode() as SECONDARY. A slug is hidden if EITHER says so.
function getHiddenSlugsForRequest(request: Request): string[] {
  const foolproof = getServerHiddenSlugs(request);
  const siteMode = isLiveMode(request) ? LIVE_HIDDEN_SLUGS : DEMO_HIDDEN_SLUGS;
  return [...new Set([...foolproof, ...siteMode])];
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
  try {
    const token = getTokenFromHeaders(request);
    if (!token) {
      return NextResponse.json(
        { error: 'No token provided' },
        { status: 401, headers: corsHeaders() }
      );
    }

    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401, headers: corsHeaders() }
      );
    }

    const userId = decoded.userId as string;
    const tenantId = decoded.tenantId as string | undefined;
    const tenantSlug = request.headers.get('x-tenant-slug') || '';

    const cached = await withRouteCache(
      `auth-me:${userId}:${tenantSlug}`,
      AUTH_ME_CACHE_MS,
      async () => loadAuthMeUser(request, userId, tenantId, tenantSlug),
    );
    if (!cached) {
      return NextResponse.json({ error: 'User not found' }, { status: 404, headers: corsHeaders() });
    }
    return NextResponse.json(cached, { headers: corsHeaders() });
  } catch (error) {
    console.error('Get current user error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500, headers: corsHeaders() }
    );
  }
}

async function loadAuthMeUser(
  request: Request,
  userId: string,
  tenantId: string | undefined,
  tenantSlug: string,
) {
    // ─── Two-phase user lookup (same pattern as /api/auth/login) ───
    // Phase 1: Search the platform DB (neondb) for the user.
    // Phase 2: If not found, search the tenant-specific DB.
    const userSelect = {
      id: true,
      name: true,
      email: true,
      role: true,
      avatar: true,
      status: true,
      lastLogin: true,
      createdAt: true,
      tenantId: true,
      tenant: {
        select: {
          id: true,
          name: true,
          slug: true,
          plan: true,
          currency: true,
          timezone: true,
          logo: true,
          status: true,
        },
      },
    };

    let user: any = null;
    let db: any = null;

    // Phase 1: Platform DB lookup
    const platformDb = getPlatformDb();
    const platformUser = await platformDb.user.findUnique({
      where: { id: userId },
      select: userSelect,
    });

    if (platformUser) {
      user = platformUser;
      db = platformDb;
    } else {
      // Phase 2: Tenant-specific DB lookup
      // Try to find the user in their tenant's dedicated database
      try {
        let tenantDb: any = null;
        if (tenantSlug) {
          tenantDb = await getDbForTenant(tenantSlug);
        } else if (tenantId) {
          tenantDb = await getDbForTenantById(tenantId);
        }

        if (tenantDb) {
          const tenantUser = await tenantDb.user.findUnique({
            where: { id: userId },
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              avatar: true,
              status: true,
              lastLogin: true,
              createdAt: true,
              tenantId: true,
            },
          });

          if (tenantUser) {
            user = tenantUser;
            db = tenantDb;
            // Resolve tenant info from platform DB
            if (tenantUser.tenantId) {
              const tenant = await platformDb.tenant.findUnique({
                where: { id: tenantUser.tenantId },
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  plan: true,
                  currency: true,
                  timezone: true,
                  logo: true,
                  status: true,
                },
              });
              user.tenant = tenant;
            }
          }
        }
      } catch (tenantLookupErr) {
        console.error('[Auth/Me] Tenant DB lookup failed:', tenantLookupErr);
      }
    }

    if (!user) {
      return null;
    }

    if (!user.tenant && user.tenantId) {
      try {
        user.tenant = await platformDb.tenant.findUnique({
          where: { id: user.tenantId },
          select: {
            id: true,
            name: true,
            slug: true,
            plan: true,
            currency: true,
            timezone: true,
            logo: true,
            status: true,
          },
        });
      } catch (e) {
        console.error('[Auth/Me] Failed to resolve tenant info:', e);
      }
    }

    // Step 2: Try to fetch employee data separately (graceful fallback)
    // Use the tenant-specific DB for employee/company lookups
    let dataDb = db;
    if (user.role !== 'super_admin' && user.tenantId) {
      try {
        dataDb = await getDbForTenantById(user.tenantId);
      } catch (e) {
        console.error('[Auth/Me] Failed to get tenant DB for employee lookup:', e);
        dataDb = platformDb;
      }
    }

    let employeeData = null;
    try {
      const employee = await dataDb.employee.findUnique({
        where: { userId: user.id },
        include: {
          department: { select: { name: true } },
          designation: { select: { title: true } },
          branch: { select: { name: true } },
        },
      });

      if (employee) {
        // Fetch company info with logo for the employee's company
        let companyData = null;
        try {
          if (employee.companyId) {
            const company = await dataDb.company.findUnique({
              where: { id: employee.companyId },
              select: { id: true, name: true, code: true, logo: true, city: true, state: true, country: true },
            });
            if (company) {
              companyData = {
                id: company.id,
                name: company.name,
                code: company.code,
                logo: company.logo,
                city: company.city,
                state: company.state,
                country: company.country,
              };
            }
          }
        } catch (compErr) {
          console.error('[Auth/Me] Company fetch error (non-fatal):', compErr);
        }

        employeeData = {
          id: employee.id,
          employeeId: employee.employeeId,
          firstName: employee.firstName,
          lastName: employee.lastName,
          department: employee.department?.name || null,
          designation: employee.designation?.title || null,
          branch: employee.branch?.name || null,
          companyId: employee.companyId,
          companyLogo: companyData?.logo || null,
          companyName: companyData?.name || null,
          status: employee.status,
          salary: employee.salary,
          company: companyData,
        };
      }
    } catch (empErr) {
      console.error('[Auth/Me] Employee fetch error (non-fatal):', empErr);
      // Continue without employee data — user can still be authenticated
    }

    // ─── GOLDEN RULE: Scrub hidden tenant from API response ───
    // On the LIVE site, if the user's tenant slug is hidden (e.g., '3boxeshrms'),
    // we null out tenantId and tenant so the client never receives
    // "Marq AI Tech Pvt Ltd". The client-side authStore also scrubs as a
    // second line of defense, but we enforce it server-side too.
    const hiddenSlugs = getHiddenSlugsForRequest(request);
    const isTenantHidden = user.tenant?.slug && hiddenSlugs.includes(user.tenant.slug);
    const safeTenantId = isTenantHidden ? null : user.tenantId;
    const safeTenant = isTenantHidden ? null : (user.tenant ? {
      id: user.tenant.id,
      name: user.tenant.name,
      slug: user.tenant.slug,
      plan: user.tenant.plan,
      currency: user.tenant.currency,
      timezone: user.tenant.timezone,
      logo: user.tenant.logo,
      status: user.tenant.status,
    } : null);

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
      status: user.status,
      tenantId: safeTenantId,
      tenant: safeTenant,
      employee: employeeData,
      lastLogin: user.lastLogin,
      createdAt: user.createdAt,
    };
}
