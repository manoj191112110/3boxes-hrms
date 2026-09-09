import { NextResponse } from 'next/server';
import { getPlatformDb, getDbForTenant } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';
import { getServerHiddenSlugs, PLATFORM_PLACEHOLDER_NAME } from '@/lib/tenant-filter';

/** In-memory cache — super-admin dashboard loops every tenant DB (slow). */
let dashboardCache: { data: Record<string, unknown>; at: number } | null = null;
const DASHBOARD_CACHE_MS = 60_000;

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
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
      return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    }

    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: corsHeaders() });
    }

    const userRole = decoded.role as string;
    if (userRole !== 'super_admin') {
      return NextResponse.json({ error: 'Only super admins can view platform dashboard' }, { status: 403, headers: corsHeaders() });
    }

    if (dashboardCache && Date.now() - dashboardCache.at < DASHBOARD_CACHE_MS) {
      return NextResponse.json(dashboardCache.data, { headers: corsHeaders() });
    }

    const platformDb = getPlatformDb();
    const hiddenSlugs = getServerHiddenSlugs(request);

    // ALWAYS exclude hidden tenants (Marq AI Tech Pvt Ltd placeholder + demo)
    // regardless of mode detection — foolproof via tenant-filter.ts.
    // Also exclude by NAME — catches any stray tenant (e.g., '3boxes-corp')
    // that was created with the placeholder name but a different slug.
    const tenantFilter = {
      slug: { notIn: hiddenSlugs },
      NOT: { name: { contains: PLATFORM_PLACEHOLDER_NAME } },
    };

    // ─── Tenant counts by status ───
    const [totalTenants, activeTenants, suspendedTenants, inactiveTenants] = await Promise.all([
      platformDb.tenant.count({ where: tenantFilter }),
      platformDb.tenant.count({ where: { ...tenantFilter, status: 'active' } }),
      platformDb.tenant.count({ where: { ...tenantFilter, status: 'suspended' } }),
      platformDb.tenant.count({ where: { ...tenantFilter, status: 'inactive' } }),
    ]);

    // ─── Aggregate counts across ALL tenant databases ───
    const tenants = await platformDb.tenant.findMany({
      where: tenantFilter,
      select: { id: true, slug: true, status: true },
    });

    let totalGroupCompanies = 0;
    let totalCompanies = 0;
    let totalEmployees = 0;

    // FIX: Only aggregate from per-tenant databases that have a dedicated
    // TenantDatabase record. Tenants WITHOUT a dedicated DB (including the
    // hidden placeholder "3boxeshrms" / "3boxes-hrms-demo") fall back to
    // platformDb when queried via getDbForTenant — which would re-count the
    // shared seed rows for every such tenant, inflating totals. We skip those.
    for (const tenant of tenants) {
      if (!tenant.slug) continue;
      try {
        // Only count if this tenant has a dedicated TenantDatabase record
        const tenantDbRecord = await platformDb.tenantDatabase.findFirst({
          where: { tenant: { slug: tenant.slug }, isActive: true },
          select: { id: true },
        });
        if (!tenantDbRecord) {
          console.log(`[SuperAdmin Dashboard] Skipping tenant "${tenant.slug}" — no dedicated DB (would re-count shared platform rows)`);
          continue;
        }

        const tenantDb = await getDbForTenant(tenant.slug);
        const [groupCount, companyCount, employeeCount] = await Promise.all([
          tenantDb.companyGroup.count(),
          tenantDb.company.count(),
          tenantDb.employee.count({ where: { status: 'active' } }),
        ]);

        totalGroupCompanies += groupCount;
        totalCompanies += companyCount;
        totalEmployees += employeeCount;
      } catch (e) {
        console.error(`[SuperAdmin Dashboard] Failed to count data for tenant "${tenant.slug}":`, e);
      }
    }

    // ─── Revenue from active subscriptions (exclude hidden tenants) ───
    // Get list of hidden tenant IDs to filter subscriptions
    const hiddenTenants = await platformDb.tenant.findMany({
      where: { slug: { in: hiddenSlugs } },
      select: { id: true },
    });
    const hiddenTenantIds = hiddenTenants.map(t => t.id);

    const subscriptionFilter: Record<string, unknown> = { status: 'active' };
    if (hiddenTenantIds.length > 0) {
      subscriptionFilter.tenantId = { notIn: hiddenTenantIds };
    }
    const activeSubscriptions = await platformDb.subscription.findMany({
      where: subscriptionFilter,
      select: { amount: true, currency: true },
    });
    const totalRevenue = activeSubscriptions.reduce((sum, sub) => sum + (sub.amount || 0), 0);

    // ─── Companies by Month (last 6 months) ───
    // Derived from tenant creation dates as a proxy for company onboarding
    const now = new Date();
    const companiesByMonth: { month: string; companies: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const nextMonth = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const monthLabel = monthDate.toLocaleString('en', { month: 'short' });
      try {
        const count = await platformDb.tenant.count({
          where: {
            ...tenantFilter,
            createdAt: { gte: monthDate, lt: nextMonth },
          },
        });
        companiesByMonth.push({ month: monthLabel, companies: count });
      } catch {
        companiesByMonth.push({ month: monthLabel, companies: 0 });
      }
    }

    // ─── Revenue by Month (last 6 months) ───
    const revenueByMonth: { month: string; revenue: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const nextMonth = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const monthLabel = monthDate.toLocaleString('en', { month: 'short' });
      try {
        const subs = await platformDb.subscription.findMany({
          where: {
            ...subscriptionFilter,
            createdAt: { gte: monthDate, lt: nextMonth },
          },
          select: { amount: true },
        });
        const monthRevenue = subs.reduce((sum, s) => sum + (s.amount || 0), 0);
        revenueByMonth.push({ month: monthLabel, revenue: monthRevenue });
      } catch {
        revenueByMonth.push({ month: monthLabel, revenue: 0 });
      }
    }

    // ─── Top Plans (from SubscriptionPlan + subscription counts) ───
    let topPlans: { name: string; planType: string; count: number; total: number }[] = [];
    try {
      const allPlans = await platformDb.subscriptionPlan.findMany({
        where: { status: 'active' },
        select: {
          id: true,
          name: true,
          planType: true,
          _count: { select: { subscriptions: { where: { status: 'active' } } } },
        },
        orderBy: { name: 'asc' },
      });
      const maxCount = Math.max(...allPlans.map(p => p._count.subscriptions), 1);
      topPlans = allPlans.map(p => ({
        name: p.name,
        planType: p.planType,
        count: p._count.subscriptions,
        total: maxCount,
      }));
    } catch (e) {
      console.error('[SuperAdmin Dashboard] Top plans query failed:', e);
    }

    // ─── Recent Transactions (from Subscription records) ───
    let recentTransactions: { id: string; company: string; amount: string; status: string; date: string; currency: string }[] = [];
    try {
      const recentSubs = await platformDb.subscription.findMany({
        where: hiddenTenantIds.length > 0 ? { tenantId: { notIn: hiddenTenantIds } } : {},
        take: 6,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          amount: true,
          currency: true,
          paymentStatus: true,
          createdAt: true,
          tenant: { select: { name: true } },
        },
      });
      recentTransactions = recentSubs.map(s => ({
        id: s.id,
        company: s.tenant?.name || 'Unknown',
        amount: String(s.amount || 0),
        status: s.paymentStatus || 'pending',
        date: s.createdAt ? new Date(s.createdAt).toLocaleDateString('en', { month: 'short', day: 'numeric' }) : '',
        currency: s.currency || 'INR',
      }));
    } catch (e) {
      console.error('[SuperAdmin Dashboard] Recent transactions query failed:', e);
    }

    // ─── Recently Registered (from TrialRegistration) ───
    let recentlyRegistered: { id: string; name: string; plan: string; date: string }[] = [];
    try {
      const trialFilter = hiddenTenantIds.length > 0 ? { tenantId: { notIn: hiddenTenantIds } } : {};
      const recentTrials = await platformDb.trialRegistration.findMany({
        where: trialFilter,
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          companyName: true,
          status: true,
          createdAt: true,
        },
      });
      recentlyRegistered = recentTrials.map(t => ({
        id: t.id,
        name: t.companyName,
        plan: t.status === 'approved' ? 'Active' : t.status === 'pending' ? 'Pending' : t.status,
        date: t.createdAt ? new Date(t.createdAt).toLocaleDateString('en', { month: 'short', day: 'numeric' }) : '',
      }));
    } catch (e) {
      console.error('[SuperAdmin Dashboard] Recently registered query failed:', e);
    }

    // ─── Expiring Subscriptions (next 30 days or already expired) ───
    let expiringSubscriptions: { id: string; company: string; plan: string; expiredDate: string; email: string; tenantId: string }[] = [];
    try {
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

      const expiringSubs = await platformDb.subscription.findMany({
        where: {
          status: { in: ['active', 'expired'] },
          endDate: { lte: thirtyDaysFromNow },
          ...(hiddenTenantIds.length > 0 ? { tenantId: { notIn: hiddenTenantIds } } : {}),
        },
        take: 5,
        orderBy: { endDate: 'asc' },
        select: {
          id: true,
          endDate: true,
          tenantId: true,
          plan: { select: { name: true } },
          tenant: { select: { name: true, id: true, users: { take: 1, where: { role: 'tenant_admin' }, select: { email: true } } } },
        },
      });
      expiringSubscriptions = expiringSubs.map(s => ({
        id: s.id,
        company: s.tenant?.name || 'Unknown',
        plan: s.plan?.name || 'Unknown',
        expiredDate: s.endDate ? new Date(s.endDate).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' }) : '',
        email: s.tenant?.users?.[0]?.email || '',
        tenantId: s.tenantId,
      }));
    } catch (e) {
      console.error('[SuperAdmin Dashboard] Expiring subscriptions query failed:', e);
    }

    // ─── Recent Activity ───
    const recentActivity = await platformDb.auditLog.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    // ─── Currency info (always INR for live site) ───
    const currencySymbol = '₹';
    const currencyCode = 'INR';

    const payload = {
      totalTenants,
      activeTenants,
      suspendedTenants,
      inactiveTenants,
      totalGroupCompanies,
      totalCompanies,
      totalEmployees,
      totalRevenue,
      platformHealth: totalTenants > 0 ? Math.round((activeTenants / totalTenants) * 100) : 0,
      recentActivity,
      companiesByMonth,
      revenueByMonth,
      topPlans,
      recentTransactions,
      recentlyRegistered,
      expiringSubscriptions,
      currencySymbol,
      currencyCode,
    };

    dashboardCache = { data: payload, at: Date.now() };

    return NextResponse.json(payload, { headers: corsHeaders() });
  } catch (error) {
    console.error('Super admin dashboard error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}
