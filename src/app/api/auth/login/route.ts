import { NextResponse } from 'next/server';
import { getPlatformDb, getDbForTenant, getDbForTenantById } from '@/lib/tenant-db';
import { verifyPassword, createToken } from '@/lib/auth';
import {
  isLiveMode,
  isDemoMode,
  isDemoTenant,
  isVercelDemoHostname,
  resolveTenantSlugForHost,
} from '@/lib/site-mode';
import { getServerHiddenSlugs, LIVE_HIDDEN_SLUGS, DEMO_HIDDEN_SLUGS } from '@/lib/tenant-filter';

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

export async function POST(request: Request) {
  // ⚠️ IMPORTANT: Authentication uses the platform DB first, then falls
  // back to the tenant-specific DB if the user is not found in the platform DB.
  // This ensures login works for both platform users (super_admin) AND
  // tenant-specific users (like demo users in tenant_demo DB).
  const platformDb = getPlatformDb();
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400, headers: corsHeaders() }
      );
    }

    // ─── Subdomain-based tenant validation ───
    // When the app is accessed via a tenant subdomain (e.g.,
    // marqaitechgroup.3boxeshrms.com), we verify that the user
    // belongs to that specific tenant. Super admins can log in
    // from any domain. All other roles must match the subdomain tenant.
    const tenantSlugHeader = request.headers.get('x-tenant-slug') || '';
    const hostHeader = (request.headers.get('x-tenant-domain') || request.headers.get('host') || '').split(':')[0].toLowerCase();
    const isVercelDemoHost = isVercelDemoHostname(hostHeader);
    // Host is authoritative: Vercel deployment URLs always map to demo tenant
    const tenantSlug = resolveTenantSlugForHost(tenantSlugHeader, hostHeader);
    let subdomainTenantId: string | null = null;

    if (tenantSlug) {
      const subdomainTenant = await getPlatformDb().tenant.findUnique({
        where: { slug: tenantSlug },
        select: { id: true, status: true, name: true },
      });
      if (subdomainTenant) {
        // ─── Tenant status check: block login for non-active tenants ───
        // Super admins can still log in from any domain (they control tenant status).
        // For all other roles, a suspended/inactive/pending_approval tenant
        // means the user cannot log in.
        // Allow login for active (paid) and trial (free trial) tenants.
        // Expired/suspended/inactive/pending are blocked here or below.
        const loginAllowedStatuses = ['active', 'trial'];
        if (!loginAllowedStatuses.includes(subdomainTenant.status)) {
          const statusMessages: Record<string, string> = {
            suspended: `Your tenant "${subdomainTenant.name}" has been suspended. Please contact the super admin to reactivate your account.`,
            inactive: `Your tenant "${subdomainTenant.name}" is inactive. Please contact the super admin.`,
            pending_approval: `Your tenant "${subdomainTenant.name}" is pending approval. You cannot log in until the super admin approves your account.`,
            expired: `Your trial access has expired. Please contact 3Boxes HRMS support to activate your subscription.`,
          };
          // Note: We don't know the user's role yet at this point, but we
          // check the tenant status first. Super admins log in via the
          // platform domain (3boxeshrms.com) which has no tenant slug,
          // so this check won't affect them.
          return NextResponse.json(
            { 
              error: statusMessages[subdomainTenant.status] || `Your tenant "${subdomainTenant.name}" is ${subdomainTenant.status}. Access denied.`,
              code: 'TENANT_BLOCKED',
              tenantStatus: subdomainTenant.status,
            },
            { status: 403, headers: corsHeaders() }
          );
        }
        subdomainTenantId = subdomainTenant.id;
      }
    }

    // ─── Two-phase user lookup ───
    // Phase 1: Search the platform DB (neondb) for the user.
    // This handles super_admin and other platform-level users.
    // Phase 2: If not found, search the tenant-specific DB.
    // This handles tenant users who live in their dedicated database
    // (e.g., demo users in tenant_demo, MarqAI users in tenant_marqaitechgroup).
    // This two-phase approach makes the demo site truly independent — its
    // users don't need to exist in the platform DB.

    // ⚠️ Use explicit `select` (not `include: { tenant: true }`) so we only
    // request columns we know exist on the User and Tenant tables.
    const userSelect = {
      id: true,
      name: true,
      email: true,
      password: true,
      role: true,
      status: true,
      avatar: true,
      tenantId: true,
    };

    const tenantSelect = {
      select: {
        id: true,
        name: true,
        slug: true,
        plan: true,
        currency: true,
        timezone: true,
        logo: true,
      },
    };

    let user: any = null;
    let db: any = platformDb; // The DB that authenticated the user
    let userTenant: any = null; // Tenant info resolved separately

    // Phase 1: Platform DB lookup
    const platformUser = await platformDb.user.findUnique({
      where: { email },
      select: { ...userSelect, tenant: tenantSelect },
    });

    if (platformUser) {
      user = platformUser;
      db = platformDb;
    } else if (tenantSlug) {
      // Phase 2: Tenant-specific DB lookup
      // Only attempt if we have a tenant slug (from middleware subdomain detection).
      // This allows demo users (in tenant_demo) and tenant users (in tenant DBs)
      // to authenticate even if they're not in the platform DB.
      try {
        const tenantDb = await getDbForTenant(tenantSlug);
        const tenantUser = await tenantDb.user.findUnique({
          where: { email },
          select: userSelect,
        });
        if (tenantUser) {
          user = tenantUser;
          db = tenantDb;
          // Resolve tenant info from platform DB (Tenant model is platform-level)
          const tenant = await platformDb.tenant.findUnique({
            where: { id: tenantUser.tenantId },
            select: tenantSelect.select,
          });
          userTenant = tenant;
        }
      } catch (tenantLookupErr) {
        console.error('[Login] Tenant DB lookup failed:', tenantLookupErr);
        // Don't block login if tenant DB is unreachable — just use platform DB result (null)
      }
    }

    // If user was found in tenant DB, attach tenant info
    if (user && !user.tenant && userTenant) {
      user.tenant = userTenant;
    }

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401, headers: corsHeaders() }
      );
    }

    if (user.status !== 'active') {
      return NextResponse.json(
        { error: 'Account is deactivated. Please contact administrator.' },
        { status: 401, headers: corsHeaders() }
      );
    }

    const isValid = await verifyPassword(password, user.password);
    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401, headers: corsHeaders() }
      );
    }

    // Ensure user.tenant is populated (for tenant DB users, we resolved it separately)
    if (!user.tenant && user.tenantId) {
      try {
        user.tenant = await getPlatformDb().tenant.findUnique({
          where: { id: user.tenantId },
          select: {
            id: true, name: true, slug: true, plan: true,
            currency: true, timezone: true, logo: true,
          },
        });
      } catch (e) {
        console.error('[Login] Failed to resolve tenant info:', e);
      }
    }

    // ─── Enforce golden rules for login domains ───
    // Rule 0: On the main domain (3boxeshrms.com, no tenantSlug), ONLY super_admin
    //         can log in. This is the platform control center — tenant_admins and
    //         other roles must log in via their own tenant subdomain
    //         (e.g., marqaitechgroup.3boxeshrms.com/login).
    // Rule 1: Super admin can ONLY log in on the main domain (3boxeshrms.com/login)
    //         OR on the demo domain (nexus-hrms-mu.vercel.app/login).
    //         Tenant subdomains must REJECT super_admin login — each tenant
    //         has only a tenant_admin, and the single platform super admin
    //         controls all tenants from 3boxeshrms.com.
    // Rule 2: On tenant subdomains (e.g., marqaitechgroup.3boxeshrms.com),
    //         only users belonging to that specific tenant can log in.
    // Rule 3: Demo domain (nexus-hrms-mu.vercel.app) is fully independent —
    //         allows ALL roles including super_admin, tenant_admin, hr_admin, etc.
    //         with complete dummy/sample data for every module.
    const isDemoDomain = isDemoMode(request) || isDemoTenant(tenantSlug) || isVercelDemoHost;
    const isMainDomain = !tenantSlug; // No tenant slug = main platform domain

    // Rule 0: Main domain is super_admin ONLY
    if (isMainDomain && user.role !== 'super_admin') {
      // Non-super-admin tried to log in on the main platform domain — reject
      // They need to use their own tenant subdomain
      const tenantSlugForUser = user.tenant?.slug || '';
      const userDomain = tenantSlugForUser
        ? `https://${tenantSlugForUser}.3boxeshrms.com/login`
        : 'your organization\'s login page';
      return NextResponse.json(
        {
          error: `This login page is for platform super admins only. Please log in at ${userDomain}.`,
          code: 'MAIN_DOMAIN_SUPER_ADMIN_ONLY',
          suggestedUrl: tenantSlugForUser ? `https://${tenantSlugForUser}.3boxeshrms.com/login` : null,
        },
        { status: 403, headers: corsHeaders() }
      );
    }

    // Rule 1: Super admin on tenant subdomain (not demo) — reject
    if (user.role === 'super_admin' && tenantSlug && !isDemoDomain) {
      return NextResponse.json(
        { error: 'Super admin login is only available at 3boxeshrms.com/login. Please use the platform login page.' },
        { status: 403, headers: corsHeaders() }
      );
    }

    // Rule 2: Non-super-admin on wrong tenant subdomain — reject
    if (subdomainTenantId && user.role !== 'super_admin' && user.tenantId !== subdomainTenantId) {
      return NextResponse.json(
        { error: 'You do not have access to this organization. Please use your organization\'s login page.' },
        { status: 403, headers: corsHeaders() }
      );
    }

    // ─── Determine the data DB for post-login operations ───
    // Use the tenant-specific DB for employee/company lookups and other
    // tenant-scoped data. This ensures demo users' data comes from tenant_demo,
    // MarqAI users' data from tenant_marqaitechgroup, etc.
    let dataDb: any;
    if (user.role === 'super_admin') {
      // Super admin may be on any domain — route to the domain's tenant DB
      // or platform DB if no tenant context
      dataDb = tenantSlug ? await getDbForTenant(tenantSlug) : platformDb;
    } else {
      // Non-super_admin: route to their own tenant's DB
      dataDb = await getDbForTenantById(user.tenantId);
    }

    // ─── Enforce trial expiry ───
    // If the user's tenant has status 'trial', check if the trial period has expired.
    // Super admins can always log in. Expired trial tenants are blocked.
    if (user.role !== 'super_admin' && user.tenantId) {
      try {
        const tenant = await getPlatformDb().tenant.findUnique({
          where: { id: user.tenantId },
          select: { id: true, status: true, slug: true },
        });
        if (tenant?.status === 'trial') {
          // Check the TrialRegistration for expiry
          const trialReg = await getPlatformDb().trialRegistration.findFirst({
            where: { tenantId: tenant.id },
            select: { trialEnd: true, status: true },
          });
          if (trialReg && trialReg.trialEnd && new Date(trialReg.trialEnd) < new Date()) {
            // Trial has expired
            // Auto-update the tenant and registration status
            try {
              await getPlatformDb().tenant.update({
                where: { id: tenant.id },
                data: { status: 'expired' },
              });
              await getPlatformDb().trialRegistration.update({
                where: { id: trialReg.id },
                data: { status: 'expired' },
              });
            } catch { /* best effort */ }

            return NextResponse.json(
              {
                error: 'Your 15-day free trial has expired. Please contact 3Boxes HRMS support to continue with a subscription plan.',
                code: 'TRIAL_EXPIRED',
                trialEnd: trialReg.trialEnd,
              },
              { status: 403, headers: corsHeaders() }
            );
          }
        } else if (tenant?.status === 'expired') {
          return NextResponse.json(
            {
              error: 'Your trial access has expired. Please contact 3Boxes HRMS support to activate your subscription.',
              code: 'TRIAL_EXPIRED',
            },
            { status: 403, headers: corsHeaders() }
          );
        }
      } catch (tenantCheckErr) {
        console.error('[Login] Trial expiry check failed (non-fatal):', tenantCheckErr);
        // Don't block login if the check fails — it's a safety measure
      }
    }

    const token = await createToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
    });

    // Non-critical operations - don't block login if these fail
    // These should go to the DB that contains the user (platform or tenant)
    try {
      await db.user.update({
        where: { id: user.id },
        data: { lastLogin: new Date() },
      });
    } catch (e) {
      console.error('Failed to update lastLogin:', e);
    }

    try {
      await db.loginActivity.create({
        data: {
          userId: user.id,
          action: 'login',
          ip: request.headers.get('x-forwarded-for') || null,
          userAgent: request.headers.get('user-agent') || null,
        },
      });
    } catch (e) {
      console.error('Failed to create loginActivity:', e);
    }

    try {
      // ─── Clean up ALL previous unread notifications on login ───
      // Mark every previous unread notification as read so the user only sees
      // a single fresh "Welcome" notification — not a wall of stale alerts.
      await dataDb.notification.updateMany({
        where: {
          userId: user.id,
          isRead: false,
        },
        data: { isRead: true },
      });

      // Now create a single consolidated welcome notification
      // Use the tenant-specific DB (dataDb) instead of the platform DB
      // so notifications live in the same database as the user's data.
      await dataDb.notification.create({
        data: {
          tenantId: user.tenantId,
          userId: user.id,
          title: 'Welcome to 3Boxes HRMS',
          message: `Hello ${user.name}! You have successfully logged in. Check your dashboard for updates.`,
          type: 'login',
          category: 'auth',
          isRead: false,
          isEmailSent: false,
        },
      });
    } catch (e) {
      console.error('Failed to create notification:', e);
    }

    try {
      await dataDb.auditLog.create({
        data: {
          userId: user.id,
          action: 'LOGIN',
          module: 'auth',
          details: `User ${user.email} logged in`,
          ip: request.headers.get('x-forwarded-for') || null,
          userAgent: request.headers.get('user-agent') || null,
        },
      });
    } catch (e) {
      console.error('Failed to create auditLog:', e);
    }

    // Multi-tenant mode: return the actual tenant name from the database.
    // The previous branding-lockdown (forcing every tenant to "Marq AI Tech Pvt Ltd")
    // has been removed so each tenant keeps its own name (e.g. "Acme Global",
    // "TechStart Solutions", "GlobalHR Services", "Marq AI Tech Pvt Ltd", etc.).
    
    // Fetch company info with logo for non-super_admin users
    // Use the tenant-specific data DB (dataDb) for employee/company lookups,
    // NOT the auth DB (db). Employee and Company records live in tenant DBs.
    let companyData = null;
    if (user.role !== 'super_admin') {
      try {
        const employee = await dataDb.employee.findUnique({
          where: { userId: user.id },
          select: { companyId: true },
        });
        if (employee?.companyId) {
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
      } catch (e) {
        console.error('Failed to fetch company for login response:', e);
      }
    }

    // Safety: ensure user.tenant exists for non-super_admin users
    // Super admin may have null tenantId (platform-level, not tied to any tenant)
    if (!user.tenant && user.tenantId) {
      try {
        user.tenant = await getPlatformDb().tenant.findUnique({
          where: { id: user.tenantId },
          select: {
            id: true, name: true, slug: true, plan: true,
            currency: true, timezone: true, logo: true,
          },
        });
      } catch (e) {
        console.error('[Login] Final tenant resolution failed:', e);
      }
    }

    // If tenant is still null for a non-super_admin user, return an error
    // Super admin is allowed to have null tenant
    if (!user.tenant && user.role !== 'super_admin') {
      return NextResponse.json(
        { error: 'Unable to resolve tenant information. Please contact support.' },
        { status: 500, headers: corsHeaders() }
      );
    }

    // ─── GOLDEN RULE: Scrub hidden tenant from login response ───
    // On the LIVE site, if the user's tenant slug is hidden (e.g., '3boxeshrms'),
    // we null out tenantId and tenant so the client never receives
    // "Marq AI Tech Pvt Ltd" in the login response.
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
    } : null);

    return NextResponse.json(
      {
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          tenantId: safeTenantId,
          avatar: user.avatar,
          tenant: safeTenant,
          company: companyData,
        },
      },
      { headers: corsHeaders() }
    );
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500, headers: corsHeaders() }
    );
  }
}
