import { NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { isLiveMode } from '@/lib/site-mode';

/**
 * GET /api/public/demo-credentials
 *
 * Returns login credentials based on the current domain:
 *
 * - On nexus-hrms-mu.vercel.app (DEMO site): Returns super admins +
 *   tenant admins with company details for auto-fill convenience.
 *   This is the showcase/demo site where users need quick access to
 *   sample accounts with pre-filled credentials.
 *
 * - On 3boxeshrms.com (LIVE platform): Returns ONLY a list of super admins
 *   and tenant admins for reference (email + name + role + tenant).
 *   NO auto-fill passwords are provided — this is a live production
 *   platform with real credentials. Users must know their own passwords.
 *   The response marks `hasAutoFill: false` so the login page doesn't
 *   show a "click to auto-fill" UI.
 *
 * - On tenant subdomains (e.g., marqaitechgroup.3boxeshrms.com):
 *   Returns only the tenant admin for that specific tenant.
 *   NO auto-fill passwords — live production data.
 *
 * Only super_admin and tenant_admin users are returned — no sample/employee users.
 */
export async function GET(request: Request) {
  const db = await getDb(request);
  try {
    const host = request.headers.get('x-tenant-domain') || '';
    const tenantSlug = request.headers.get('x-tenant-slug') || '';
    const hostname = host.split(':')[0];

    // Detect which site we're on
    const isDemoSite = hostname === 'nexus-hrms-mu.vercel.app';
    const isPlatformSite = hostname === '3boxeshrms.com' || hostname === 'www.3boxeshrms.com';
    const isTenantSubdomain = !!tenantSlug;

    if (isDemoSite) {
      // ─── DEMO site: full credentials with auto-fill ───
      // This is the demo/showcase site — users need quick access to
      // sample accounts with pre-filled credentials for easy exploration.
      const superAdmins = await db.user.findMany({
        where: { role: 'super_admin', status: 'active' },
        select: { email: true, name: true, role: true, tenantId: true, tenant: { select: { name: true, slug: true } } },
        orderBy: { name: 'asc' },
      });

      const tenantAdmins = await db.user.findMany({
        where: { role: 'tenant_admin', status: 'active' },
        select: { email: true, name: true, role: true, tenantId: true, tenant: { select: { name: true, slug: true } } },
        orderBy: { tenant: { name: 'asc' } },
      });

      // Employee self-service accounts (2026-09-09) — lets reviewers test the
      // employee experience (apply leave, self-service modules) on the demo.
      // Only accounts that actually have a linked Employee record are returned.
      const employeeUsers = await db.user.findMany({
        where: { role: 'employee', status: 'active', employee: { isNot: null } },
        select: { email: true, name: true, role: true, employee: { select: { employeeId: true, department: { select: { name: true } } } } },
        orderBy: { email: 'asc' },
        take: 6,
      });

      return NextResponse.json({
        site: 'demo',
        hasAutoFill: true,
        // Password NOT included in response — auto-fill still works via click handler
        // which uses the known demo password 'MarqAI@2026'
        superAdmins: superAdmins.map(u => ({
          email: u.email,
          name: u.name,
          role: u.role,
          functionalRole: 'Super Admin',
          tenant: u.tenant.name,
        })),
        tenantAdmins: tenantAdmins.map(u => ({
          email: u.email,
          name: u.name,
          role: u.role,
          functionalRole: 'Tenant Admin',
          tenant: u.tenant.name,
          tenantSlug: u.tenant.slug,
        })),
        employees: employeeUsers.map(u => ({
          email: u.email,
          name: u.name,
          role: u.role,
          functionalRole: 'Employee',
          department: u.employee?.department?.name || null,
          employeeCode: u.employee?.employeeId || null,
        })),
      });
    }

    if (isPlatformSite) {
      // ─── LIVE platform site: credentials for REFERENCE ONLY ───
      // On the production platform (3boxeshrms.com), we return admin
      // accounts for informational purposes (showing who exists), but
      // NO auto-fill is available. Users must know their own passwords.
      // This is the LIVE super admin login — real credentials only.
      const superAdmins = await db.user.findMany({
        where: { role: 'super_admin', status: 'active' },
        select: { email: true, name: true, role: true, tenantId: true, tenant: { select: { name: true, slug: true } } },
        orderBy: { name: 'asc' },
      });

      const tenantAdmins = await db.user.findMany({
        where: { role: 'tenant_admin', status: 'active' },
        select: { email: true, name: true, role: true, tenantId: true, tenant: { select: { name: true, slug: true } } },
        orderBy: { tenant: { name: 'asc' } },
      });

      return NextResponse.json({
        site: 'platform',
        hasAutoFill: false, // LIVE mode — no auto-fill
        superAdmins: superAdmins.map(u => ({
          email: u.email,
          name: u.name,
          role: u.role,
          functionalRole: 'Super Admin',
          tenant: u.tenant.name,
        })),
        tenantAdmins: tenantAdmins.map(u => ({
          email: u.email,
          name: u.name,
          role: u.role,
          functionalRole: 'Tenant Admin',
          tenant: u.tenant.name,
          tenantSlug: u.tenant.slug,
        })),
      });
    }

    if (isTenantSubdomain) {
      // ─── Tenant subdomain: show only that tenant's admin ───
      // NO auto-fill — this is live production data.
      const tenant = await getPlatformDb().tenant.findUnique({
        where: { slug: tenantSlug },
        select: { id: true, name: true, slug: true },
      });

      if (!tenant) {
        return NextResponse.json({ site: 'tenant', hasAutoFill: false, users: [] });
      }

      // Only return tenant_admin for this tenant (no sample users)
      const users = await db.user.findMany({
        where: { tenantId: tenant.id, status: 'active', role: 'tenant_admin' },
        select: { email: true, name: true, role: true },
        orderBy: { name: 'asc' },
      });

      return NextResponse.json({
        site: 'tenant',
        hasAutoFill: false, // LIVE mode — no auto-fill
        tenantName: tenant.name,
        users: users.map(u => ({
          email: u.email,
          name: u.name,
          role: u.role,
          functionalRole: 'Tenant Admin',
        })),
      });
    }

    // Default — fallback
    return NextResponse.json({
      site: 'unknown',
      hasAutoFill: false,
      superAdmins: [],
      tenantAdmins: [],
    });
  } catch (error) {
    console.error('Demo credentials error:', error);
    return NextResponse.json({ error: 'Failed to fetch credentials' }, { status: 500 });
  }
}
