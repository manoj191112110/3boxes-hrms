import { NextResponse } from 'next/server';
import { getDb, getPlatformDb, getDbForTenantById } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';
import { checkTenantStatusOrBlock } from '@/lib/tenant-guard';
import { getServerHiddenSlugs } from '@/lib/tenant-filter';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() });
}

/**
 * Safe wrapper — same pattern as /api/me/context. A single failed prisma
 * call shouldn't break the whole endpoint (the frontend uses this to render
 * the Group Companies tab on both super-admin and tenant-admin pages).
 */
async function safe<T>(
  label: string,
  fn: () => Promise<T>,
  fallback: T,
): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[company-groups] ${label} failed:`, msg);
    return fallback;
  }
}

/**
 * Ensure every tenant returned by this endpoint has at least one default
 * group company (named after the tenant itself, per the user's clarified
 * hierarchy: "the group company name and parent tenant are same").
 *
 * This fixes the "shows empty" issue for tenants created before the
 * auto-group-create feature was added in commit c319fe3.
 *
 * Idempotent: only creates a group if the tenant has zero groups.
 */
async function ensureDefaultGroupsForTenants(tenantIds: string[]): Promise<void> {
  if (tenantIds.length === 0) return;
  await safe('ensureDefaultGroupsForTenants', async () => {
    // Fetch tenant names from the platform DB
    const tenants = await getPlatformDb().tenant.findMany({
      where: { id: { in: tenantIds } },
      select: {
        id: true,
        name: true,
      },
    });
    // FIX: Check group existence in each tenant's OWN database, not the
    // platform DB. CompanyGroup lives in the tenant-specific DB, so
    // getPlatformDb().companyGroup would either fail or always return 0.
    const tenantsNeedingGroup: { id: string; name: string }[] = [];
    for (const t of tenants) {
      try {
        const tenantDb = await getDbForTenantById(t.id);
        const existingGroup = await tenantDb.companyGroup.findFirst({
          where: { tenantId: t.id },
          select: { id: true },
        });
        if (!existingGroup) {
          tenantsNeedingGroup.push(t);
        }
      } catch (e: unknown) {
        // If we can't check, SKIP — don't create a duplicate group.
        // Previously this pushed to tenantsNeedingGroup, causing duplicate
        // CompanyGroup records when the check threw a transient error.
        console.error(`[company-groups] Check for existing groups in tenant ${t.id} failed (skipping to avoid duplicate):`, e);
      }
    }
    if (tenantsNeedingGroup.length === 0) return;
    // Use tenant-specific DB for each tenant when creating default groups
    await Promise.all(tenantsNeedingGroup.map(async (t) => {
      try {
        const tenantDb = await getDbForTenantById(t.id);
        await tenantDb.companyGroup.create({
          data: {
            name: t.name,
            tenantId: t.id,
            employeeLimitMode: 'group_total',
            maxEmployees: null,
            maxCompanies: null,
            notes: `Default group company auto-created for tenant "${t.name}". Shares the tenant name per the parent/child identity rule.`,
          },
        });
      } catch (e: unknown) {
        // Don't let one failure block the others
        console.error(`[company-groups] Auto-create default group for tenant ${t.id} failed:`, e);
      }
    }));
    console.log(`[company-groups] Auto-created default groups for ${tenantsNeedingGroup.length} tenant(s)`);
  }, undefined as unknown as void);
}

/**
 * GET /api/company-groups
 *
 * List company groups (a.k.a. "group companies") with their employee-strength
 * barriers and live counts.
 *
 *  - super_admin: pass ?tenantId=<id> to scope; otherwise returns groups across
 *    ALL tenants (with the parent tenant name attached).
 *  - tenant_admin / hr_admin / manager: scoped to caller's tenant only.
 *  - Other roles: scoped to caller's tenant (read-only).
 *
 * Response shape:
 *   { groups: [{
 *       id, name, tenantId, tenantName, employeeLimitMode, maxEmployees, maxCompanies,
 *       notes, createdAt, updatedAt,
 *       _count: { companies, employees },
 *       companies: [{ id, name, code, _count: { employees } }]
 *   }] }
 */
export async function GET(request: Request) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) {
      return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    }
    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: corsHeaders() });
    }

    const role = (decoded.role as string) || 'employee';
    const callerTenantId = decoded.tenantId as string;

    const { searchParams } = new URL(request.url);
    const requestedTenantId = searchParams.get('tenantId');

    // Super admins can see group companies across ALL tenants (so groups they
    // create for any tenant show up in their view list). Tenant admins are
    // scoped to their own tenant only. The optional `tenantId` query param
    // lets a super admin filter to a single tenant if they want to.
    const where: Record<string, unknown> = {};
    if (role === 'super_admin') {
      if (requestedTenantId) {
        where.tenantId = requestedTenantId;
      }
      // No filter = return groups across ALL tenants
    } else {
      // tenant_admin / others: scoped to their own tenant
      if (callerTenantId) {
        where.tenantId = callerTenantId;
      } else {
        // No tenant on the caller — return nothing rather than leaking all tenants
        where.tenantId = '__none__';
      }
    }

    // ─── AUTO-HEAL: ensure the tenant(s) we're about to query have at least
    // one default group. This fixes the "shows empty" issue for legacy
    // tenants. We resolve the list of tenant IDs that will be queried, then
    // ensure each has a default group before fetching.
    //
    // IMPORTANT: Always exclude hidden tenants (Marq AI Tech Pvt Ltd placeholder
    // + demo tenant) from this list — we don't want to auto-create groups for them.
    const hiddenSlugs = getServerHiddenSlugs(request);
    const hiddenTenantExcludeFilter = { slug: { notIn: hiddenSlugs } };
    if (role === 'super_admin' && !requestedTenantId) {
      // Super admin viewing all tenants — ensure default groups for every VISIBLE tenant
      const allTenantIds = await safe(
        'tenant.findMany(ids)',
        () => getPlatformDb().tenant.findMany({ where: hiddenTenantExcludeFilter, select: { id: true } }),
        [],
      );
      await ensureDefaultGroupsForTenants(allTenantIds.map((t) => t.id));
    } else if (role === 'super_admin' && requestedTenantId) {
      await ensureDefaultGroupsForTenants([requestedTenantId]);
    } else if (callerTenantId) {
      await ensureDefaultGroupsForTenants([callerTenantId]);
    }

    // FIX: For super_admin viewing a specific tenant, or for tenant_admin,
    // use the tenant-specific DB instead of the request's default DB.
    // This ensures we query the correct database in isolated DB mode.
    const effectiveTenantId = (role === 'super_admin' && requestedTenantId) ? requestedTenantId : callerTenantId;
    const groupDb = effectiveTenantId ? await getDbForTenantById(effectiveTenantId) : db;

    const groups = await safe(
      'companyGroup.findMany',
      () => groupDb.companyGroup.findMany({
        where,
        include: {
          tenant: { select: { id: true, name: true, slug: true } },
          companies: {
            select: {
              id: true,
              name: true,
              code: true,
              status: true,
              maxEmployees: true,
              plannedEmployeeCount: true,
              _count: { select: { branches: true, departments: true } },
            },
            orderBy: { name: 'asc' },
          },
          _count: { select: { companies: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      [],
    );

    // Compute aggregate employee count per group by counting employees
    // whose `companyId` matches one of the companies in this group.
    // Employee.companyId is a raw String? (no Prisma relation), so we
    // can't use _count — but we can use a separate findMany with a where
    // filter on the raw companyId column.
    const groupEmployeeCounts: Record<string, number> = {};
    if (groups.length > 0) {
      const allCompanyIds = groups.flatMap((g) => g.companies.map((c) => c.id));
      if (allCompanyIds.length > 0) {
        // Group employee counts by companyId using a single query
        const employeeCounts = await safe(
          'employee.groupBy(companyId)',
          () => groupDb.employee.groupBy({
            by: ['companyId'],
            where: { companyId: { in: allCompanyIds } },
            _count: { _all: true },
          }),
          [],
        );
        for (const row of employeeCounts) {
          if (row.companyId) {
            groupEmployeeCounts[row.companyId] = row._count._all;
          }
        }
      }
    }

    // Compute aggregate employee count per group (sum of employees across all companies)
    // FILTER OUT hidden tenants AND deduplicate by name+tenantId (fixes duplicates
    // from the old auto-heal bug that created multiple groups with the same name).
    const seenGroupKeys = new Set<string>();
    const enriched = groups
      .filter((g) => {
        // Exclude groups belonging to hidden tenants
        const slug = g.tenant?.slug;
        if (!slug) return false; // Exclude orphan groups (no tenant)
        if (hiddenSlugs.includes(slug)) return false;
        // Deduplicate by name+tenantId — keep only the first occurrence
        // (different group IDs but same name = duplicate from auto-heal bug)
        const groupKey = `${g.tenantId}:${g.name}`;
        if (seenGroupKeys.has(groupKey)) return false;
        seenGroupKeys.add(groupKey);
        return true;
      })
      .map((g) => {
      // Deduplicate companies within this group by ID
      const seenCompanyIds = new Set<string>();
      const dedupedCompanies = g.companies.filter((c) => {
        if (seenCompanyIds.has(c.id)) return false;
        seenCompanyIds.add(c.id);
        return true;
      });

      const companiesWithCounts = dedupedCompanies.map((c) => ({
        ...c,
        _count: {
          ...(c._count || {}),
          employees: groupEmployeeCounts[c.id] || 0,
        },
      }));
      const employeesInGroup = companiesWithCounts.reduce((s, c) => s + (c._count?.employees || 0), 0);
      return {
        id: g.id,
        name: g.name,
        tenantId: g.tenantId,
        tenantName: g.tenant?.name || null,
        tenantSlug: g.tenant?.slug || null,
        employeeLimitMode: g.employeeLimitMode,
        maxEmployees: g.maxEmployees,
        maxCompanies: g.maxCompanies,
        notes: g.notes,
        createdAt: g.createdAt,
        updatedAt: g.updatedAt,
        _count: {
          companies: g._count?.companies || 0,
          employees: employeesInGroup,
        },
        companies: companiesWithCounts,
      };
    });
    return NextResponse.json({ groups: enriched }, { headers: corsHeaders() });
  } catch (error) {
    console.error('GET /api/company-groups error:', error);
    // Return 200 with an empty array (instead of 500) so the frontend doesn't
    // show a "Failed to load group companies" toast for transient DB errors.
    // The user sees an empty list with the standard empty-state UI instead.
    return NextResponse.json(
      { groups: [], error: 'Failed to load group companies — please try refreshing' },
      { status: 200, headers: corsHeaders() }
    );
  }
}

/**
 * POST /api/company-groups
 *
 * ─── PERMISSION RULE ───
 * Only SUPER ADMIN can create group companies. Tenant admins CANNOT create
 * group companies — they can only create COMPANIES under an existing group
 * company via /api/companies. This enforces the multi-tenancy hierarchy:
 *   Super admin → creates Tenant (= Group Company parent)
 *   Super admin → creates Group Companies under a tenant
 *   Tenant admin → creates Companies under a group company
 *
 * Body:
 *  - tenantId: string (required — which tenant this group is being created under)
 *  - name: string (required)
 *  - employeeLimitMode: 'per_company' | 'group_total' (default 'group_total')
 *  - maxEmployees: number | null  (null = unlimited)
 *  - maxCompanies: number | null  (null = unlimited)
 *  - notes: string | null
 */
export async function POST(request: Request) {
  const db = await getDb(request);
  try {
    // ─── Tenant status guard: block writes for suspended/inactive tenants ───
    const tenantBlock = await checkTenantStatusOrBlock(request, corsHeaders);
    if (tenantBlock) return tenantBlock;

    const token = getTokenFromHeaders(request);
    if (!token) {
      return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    }
    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: corsHeaders() });
    }

    const role = (decoded.role as string) || 'employee';
    const callerTenantId = decoded.tenantId as string;

    // ─── PERMISSION RULE ───
    // Only SUPER ADMIN can create group companies / tenant companies.
    // Tenant admins can only create COMPANIES under an existing group company
    // (via /api/companies). This keeps the multi-tenancy hierarchy clean:
    //   Super admin → creates Tenant (= Group Company parent)
    //   Super admin → creates Group Companies under a tenant
    //   Tenant admin → creates Companies under a group company
    if (role !== 'super_admin') {
      return NextResponse.json(
        { error: 'Only super admins can create group companies. Tenant admins can create companies under an existing group company via the Companies page.' },
        { status: 403, headers: corsHeaders() }
      );
    }

    const body = await request.json();
    const {
      tenantId: bodyTenantId,
      name,
      employeeLimitMode,
      maxEmployees,
      maxCompanies,
      notes,
    } = body;

    if (!name || !String(name).trim()) {
      return NextResponse.json({ error: 'Group company name is required' }, { status: 400, headers: corsHeaders() });
    }

    // Resolve target tenant — super admin must specify which tenant this group
    // is being created under. Fall back to callerTenantId if they didn't.
    const targetTenantId = bodyTenantId || callerTenantId;
    if (!targetTenantId) {
      return NextResponse.json({ error: 'Could not resolve target tenant' }, { status: 400, headers: corsHeaders() });
    }

    // Verify the tenant exists
    const tenant = await getPlatformDb().tenant.findUnique({ where: { id: targetTenantId } });
    if (!tenant) {
      return NextResponse.json({ error: 'Target tenant not found' }, { status: 404, headers: corsHeaders() });
    }

    // Validate employeeLimitMode
    const mode = employeeLimitMode === 'per_company' ? 'per_company' : 'group_total';

    // Coerce numeric fields
    const maxEmp = typeof maxEmployees === 'number' && maxEmployees >= 0 ? maxEmployees : null;
    const maxComp = typeof maxCompanies === 'number' && maxCompanies >= 0 ? maxCompanies : null;

    // FIX: Use tenant-specific DB for group operations
    const createGroupDb = await getDbForTenantById(targetTenantId);

    // Check for duplicate name within the same tenant
    const existing = await createGroupDb.companyGroup.findFirst({
      where: { tenantId: targetTenantId, name: { equals: String(name).trim(), mode: 'insensitive' } },
    });
    if (existing) {
      return NextResponse.json(
        { error: `A group company named "${name}" already exists under this tenant` },
        { status: 409, headers: corsHeaders() }
      );
    }

    const group = await createGroupDb.companyGroup.create({
      data: {
        name: String(name).trim(),
        tenantId: targetTenantId,
        employeeLimitMode: mode,
        maxEmployees: maxEmp,
        maxCompanies: maxComp,
        notes: notes ? String(notes) : null,
      },
      include: {
        tenant: { select: { id: true, name: true, slug: true } },
        _count: { select: { companies: true } },
      },
    });

    await db.auditLog.create({
      data: {
        userId: decoded.userId as string,
        action: 'CREATE_COMPANY_GROUP',
        module: 'company-groups',
        details: `Created group company "${group.name}" under tenant ${tenant.name} (mode=${mode}, maxEmployees=${maxEmp ?? 'unlimited'}, maxCompanies=${maxComp ?? 'unlimited'})`,
      },
    });

    return NextResponse.json({ group }, { status: 201, headers: corsHeaders() });
  } catch (error) {
    console.error('POST /api/company-groups error:', error);
    return NextResponse.json({ error: 'Failed to create group company' }, { status: 500, headers: corsHeaders() });
  }
}
