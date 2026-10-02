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

    const tenantSlugHeader = request.headers.get('x-tenant-slug') || '';
    const hostHeader = (request.headers.get('x-tenant-domain') || request.headers.get('host') || '').split(':')[0].toLowerCase();
    const isVercelDemoHost = isVercelDemoHostname(hostHeader);
    const isTestDomain = hostHeader === 'test.3boxeshrms.com';
    const tenantSlug = resolveTenantSlugForHost(tenantSlugHeader, hostHeader);
    let subdomainTenantId: string | null = null;

    if (tenantSlug) {
      const subdomainTenant = await getPlatformDb().tenant.findUnique({
        where: { slug: tenantSlug },
        select: { id: true, status: true, name: true },
      });
      if (subdomainTenant) {
        const loginAllowedStatuses = ['active', 'trial'];
        if (!loginAllowedStatuses.includes(subdomainTenant.status)) {
          const statusMessages: Record<string, string> = {
            suspended: `Your tenant "${subdomainTenant.name}" has been suspended. Please contact the super admin to reactivate your account.`,
            inactive: `Your tenant "${subdomainTenant.name}" is inactive. Please contact the super admin.`,
            pending_approval: `Your tenant "${subdomainTenant.name}" is pending approval. You cannot log in until the super admin approves your account.`,
            expired: `Your trial access has expired. Please contact 3Boxes HRMS support to activate your subscription.`,
          };
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
    let db: any = platformDb;
    let userTenant: any = null;

    const platformUser = await platformDb.user.findUnique({
      where: { email },
      select: { ...userSelect, tenant: tenantSelect },
    });

    if (platformUser) {
      user = platformUser;
      db = platformDb;
    } else if (tenantSlug) {
      try {
        const tenantDb = await getDbForTenant(tenantSlug);
        const tenantUser = await tenantDb.user.findUnique({
          where: { email },
          select: userSelect,
        });
        if (tenantUser) {
          user = tenantUser;
          db = tenantDb;
          const tenant = await platformDb.tenant.findUnique({
            where: { id: tenantUser.tenantId },
            select: tenantSelect.select,
          });
          userTenant = tenant;
        }
      } catch (tenantLookupErr) {
        console.error('[Login] Tenant DB lookup failed:', tenantLookupErr);
      }
    }

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

    // Production root remains super-admin-only. The isolated TEST host is
    // intentionally excluded so super_admin, tenant_admin and employee test
    // accounts can all authenticate through test.3boxeshrms.com.
    const isDemoDomain = isDemoMode(request) || isDemoTenant(tenantSlug) || isVercelDemoHost;
    const isMainDomain = !tenantSlug && !isTestDomain;

    if (isMainDomain && user.role !== 'super_admin') {
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

    if (user.role === 'super_admin' && tenantSlug && !isDemoDomain) {
      return NextResponse.json(
        { error: 'Super admin login is only available at 3boxeshrms.com/login. Please use the platform login page.' },
        { status: 403, headers: corsHeaders() }
      );
    }

    if (subdomainTenantId && user.role !== 'super_admin' && user.tenantId !== subdomainTenantId) {
      return NextResponse.json(
        { error: 'You do not have access to this organization. Please use your organization\'s login page.' },
        { status: 403, headers: corsHeaders() }
      );
    }

    let dataDb: any;
    if (user.role === 'super_admin') {
      dataDb = tenantSlug ? await getDbForTenant(tenantSlug) : platformDb;
    } else {
      dataDb = await getDbForTenantById(user.tenantId);
    }

    if (user.role !== 'super_admin' && user.tenantId) {
      try {
        const tenant = await getPlatformDb().tenant.findUnique({
          where: { id: user.tenantId },
          select: { id: true, status: true, slug: true },
        });
        if (tenant?.status === 'trial') {
          const trialReg = await getPlatformDb().trialRegistration.findFirst({
            where: { tenantId: tenant.id },
            select: { trialEnd: true, status: true },
          });
          if (trialReg && trialReg.trialEnd && new Date(trialReg.trialEnd) < new Date()) {
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
      }
    }

    const token = await createToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
    });

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
      await dataDb.notification.updateMany({
        where: {
          userId: user.id,
          isRead: false,
        },
        data: { isRead: true },
      });

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

    if (!user.tenant && user.role !== 'super_admin') {
      return NextResponse.json(
        { error: 'Unable to resolve tenant information. Please contact support.' },
        { status: 500, headers: corsHeaders() }
      );
    }

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
