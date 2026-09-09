import { NextRequest, NextResponse } from 'next/server';
import { getDb, getPlatformDb, getDbForTenantById } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';
import { checkTenantStatusOrBlock } from '@/lib/tenant-guard';
import { validateEmail, validatePhone } from '@/lib/validators';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() });
}

async function requireAuth(req: NextRequest) {
  const token = getTokenFromHeaders(req);
  if (!token) return null;
  const decoded = await verifyToken(token);
  if (!decoded) return null;
  return decoded;
}

// GET /api/companies — List companies
export async function GET(req: NextRequest) {
  const db = await getDb(req);
  try {
    const decoded = await requireAuth(req);
    if (!decoded) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders() });
    }
    const role = (decoded.role as string) || 'employee';
    const callerTenantId = decoded.tenantId as string;

    const { searchParams } = new URL(req.url);
    const requestedTenantId = searchParams.get('tenantId');
    // Optional: narrow to a specific group company (sent by the header
    // CompanySwitcher when an admin clicks a group header to view "all
    // companies in this group"). This takes precedence over tenantId
    // because the group already implies a tenant.
    const requestedGroupId = searchParams.get('groupId');
    // Optional: narrow to a specific company (sent by the header CompanySwitcher)
    const requestedCompanyId = searchParams.get('companyId');
    const search = searchParams.get('search');

    // Scope by role
    //
    // ─── SUPER ADMIN ───
    //   * If `groupId` is provided → scope to that group (the group's tenant
    //     is implied, so we don't need to also filter by tenantId).
    //   * If `tenantId` is provided → scope companies to that tenant (used by
    //     the header dropdown when a super admin picks a parent company).
    //   * If `companyId` is provided → return only that single company.
    //   * Otherwise → return companies across ALL tenants, so the super admin
    //     can actually see what's in the system. Previously this defaulted to
    //     `callerTenantId`, which for super_admin is the seed/admin tenant
    //     with no real companies — so the page showed nothing.
    //
    // ─── TENANT ADMIN / OTHER ROLES ───
    //   * Always scope to callerTenantId (their own tenant only).
    //     If they pass a groupId, it must belong to their own tenant —
    //     we verify that by filtering through the companyGroup.tenantId
    //     relation in the where clause.
    let effectiveTenantId: string | null = null;
    if (role === 'super_admin') {
      effectiveTenantId = requestedTenantId || null;
    } else {
      effectiveTenantId = callerTenantId;
    }

    // FIX: Resolve the correct tenant-specific DB for data queries.
    // For super_admin, getDb(request) may return the platform DB, which won't
    // have the tenant's CompanyGroup/Company data in isolated DB mode.
    // We resolve the target tenant and use its dedicated DB.
    const dataDb = effectiveTenantId
      ? await getDbForTenantById(effectiveTenantId)
      : db;

    const where: Record<string, unknown> = {};
    if (requestedGroupId) {
      // Group filter takes precedence over tenant filter (a group already
      // belongs to exactly one tenant). For tenant_admin / others, the
      // companyGroup.tenantId check below ensures they can't peek at another
      // tenant's group.
      where.companyGroupId = requestedGroupId;
      if (role !== 'super_admin' && callerTenantId) {
        where.companyGroup = { tenantId: callerTenantId };
      }
    } else if (effectiveTenantId) {
      const companyGroups = await dataDb.companyGroup.findMany({
        where: { tenantId: effectiveTenantId },
        select: { id: true },
      });
      const groupIds = companyGroups.map((g) => g.id);
      where.companyGroupId = { in: groupIds };
    }
    // Single-company filter takes precedence over the tenant/group scope — if the
    // caller passes a companyId we just return that one company (provided the
    // caller is authorized: super_admin can see any; tenant_admin must own it).
    if (requestedCompanyId) {
      if (role === 'super_admin') {
        where.id = requestedCompanyId;
      } else {
        // For tenant_admin / others, ensure the company is in their tenant
        // before returning it. We resolve via the companyGroup relation.
        where.id = requestedCompanyId;
        where.companyGroup = { tenantId: callerTenantId };
      }
    }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
      ];
    }

    const companies = await dataDb.company.findMany({
      where,
      include: {
        companyGroup: {
          select: {
            id: true,
            name: true,
            tenantId: true,
            maxEmployees: true,
            employeeLimitMode: true,
            maxCompanies: true,
            notes: true,
            tenant: { select: { id: true, name: true, slug: true, maxCompaniesAllowed: true } },
          },
        },
        // NOTE: Company has no `employees` Prisma relation (Employee.companyId
        // is a raw String? without a relation field). Count branches +
        // departments here; per-company employee counts are added below via
        // a separate db.employee.groupBy() call.
        _count: { select: { departments: true, branches: true } },
      },
      orderBy: { name: 'asc' },
    });

    // Augment each company with its employee count using a single groupBy
    // query (much more efficient than N+1 separate counts).
    let employeeCountByCompany: Record<string, number> = {};
    if (companies.length > 0) {
      const companyIds = companies.map((c) => c.id);
      try {
        const grouped = await dataDb.employee.groupBy({
          by: ['companyId'],
          where: { companyId: { in: companyIds } },
          _count: { _all: true },
        });
        for (const row of grouped) {
          if (row.companyId) {
            employeeCountByCompany[row.companyId] = row._count._all;
          }
        }
      } catch {
        // Non-fatal — employee counts default to 0
      }
    }

    // Explicitly surface the per-company employee cap + planned strength + live
    // employee count so the UI can render "no of employees" columns without
    // needing a separate fetch.
    const enriched = companies.map((c) => ({
      ...c,
      maxEmployees: c.maxEmployees ?? null,
      plannedEmployeeCount: c.plannedEmployeeCount ?? null,
      _count: {
        ...(c._count || {}),
        employees: employeeCountByCompany[c.id] || 0,
      },
    }));

    return NextResponse.json(
      {
        companies: enriched,
        // Also expose the caller's tenant-level quota so the UI can render
        // "X of Y companies used" without an extra round-trip.
        tenantQuota: effectiveTenantId
          ? await getPlatformDb().tenant.findUnique({
              where: { id: effectiveTenantId },
              select: { id: true, name: true, slug: true, maxCompaniesAllowed: true },
            })
          : null,
      },
      { headers: corsHeaders() }
    );
  } catch (error: unknown) {
    console.error('Get companies error:', error);
    return NextResponse.json({ companies: [] }, { headers: corsHeaders() });
  }
}

// POST /api/companies — Create a company (super_admin or tenant_admin only)
//
// Multi-tenancy rules enforced:
//   1. The target tenant is the caller's tenant for tenant_admin, or any tenant
//      for super_admin (via body.tenantId).
//   2. The company MUST be inducted into an explicit company group (a.k.a. "group
//      company"). If `companyGroupId` is missing we'll try to auto-create a group
//      named after the company, but only if the tenant's quota allows it.
//   3. Enforce tenant.maxCompaniesAllowed — the cap on total companies the
//      tenant_admin can create under this tenant.
//   4. Enforce group.maxCompanies — the per-group company cap set by super_admin.
export async function POST(req: NextRequest) {
  const db = await getDb(req);
  try {
    // ─── Tenant status guard: block writes for suspended/inactive tenants ───
    const tenantBlock = await checkTenantStatusOrBlock(req, corsHeaders);
    if (tenantBlock) return tenantBlock;

    const decoded = await requireAuth(req);
    if (!decoded) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders() });
    }
    const role = (decoded.role as string) || 'employee';
    const callerTenantId = decoded.tenantId as string;

    if (!['super_admin', 'tenant_admin'].includes(role)) {
      return NextResponse.json({ error: 'Only admins can create companies' }, { status: 403, headers: corsHeaders() });
    }

    const body = await req.json();
    const {
      name, code, companyGroupId, companyGroupName,
      registrationNo, taxId, country, currency, timezone,
      address, city, state, zipCode, phone, email, website, status,
      tenantId: bodyTenantId,
      maxEmployees: bodyMaxEmployees,
      plannedEmployeeCount: bodyPlannedEmployeeCount,
    } = body;

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400, headers: corsHeaders() });
    }

    // ─── Server-side validation ───
    if (phone && typeof phone === 'string') {
      const phoneResult = validatePhone(phone);
      if (!phoneResult.valid) {
        return NextResponse.json({ error: phoneResult.error }, { status: 400, headers: corsHeaders() });
      }
    }
    if (email && typeof email === 'string') {
      const emailResult = validateEmail(email);
      if (!emailResult.valid) {
        return NextResponse.json({ error: emailResult.error }, { status: 400, headers: corsHeaders() });
      }
    }

    // Coerce per-company employee cap + planned strength
    const maxEmployees = typeof bodyMaxEmployees === 'number' && bodyMaxEmployees > 0 ? bodyMaxEmployees : null;
    const plannedEmployeeCount = typeof bodyPlannedEmployeeCount === 'number' && bodyPlannedEmployeeCount >= 0 ? bodyPlannedEmployeeCount : null;

    // Resolve target tenant
    const targetTenantId = role === 'super_admin' ? (bodyTenantId || callerTenantId) : callerTenantId;
    if (!targetTenantId) {
      return NextResponse.json({ error: 'Could not resolve target tenant' }, { status: 400, headers: corsHeaders() });
    }

    // FIX: Use tenant-specific DB for all data operations
    const tenantDataDb = await getDbForTenantById(targetTenantId);

    // Fetch the tenant (we need maxCompaniesAllowed + name for the response)
    const targetTenant = await getPlatformDb().tenant.findUnique({
      where: { id: targetTenantId },
      select: {
        id: true,
        name: true,
        slug: true,
        maxCompaniesAllowed: true,
        _count: { select: { companyGroups: true } },
      },
    });
    if (!targetTenant) {
      return NextResponse.json({ error: 'Target tenant not found' }, { status: 404, headers: corsHeaders() });
    }

    // ─── Quota check #1: tenant.maxCompaniesAllowed ───
    // Count current companies across all groups in this tenant
    const groupsInTenant = await tenantDataDb.companyGroup.findMany({
      where: { tenantId: targetTenantId },
      select: { id: true },
    });
    const groupIdsInTenant = groupsInTenant.map((g) => g.id);
    const currentCompanyCount = groupIdsInTenant.length
      ? await tenantDataDb.company.count({ where: { companyGroupId: { in: groupIdsInTenant } } })
      : 0;

    if (targetTenant.maxCompaniesAllowed > 0 && currentCompanyCount >= targetTenant.maxCompaniesAllowed) {
      return NextResponse.json(
        {
          error: `Company limit reached. This tenant ("${targetTenant.name}") is allowed to create ${targetTenant.maxCompaniesAllowed} compan(y/ies) max (currently ${currentCompanyCount}). Contact your super admin to raise the limit.`,
          code: 'TENANT_COMPANY_LIMIT_REACHED',
          limit: targetTenant.maxCompaniesAllowed,
          current: currentCompanyCount,
        },
        { status: 403, headers: corsHeaders() }
      );
    }

    // ─── Resolve the group company (must belong to the target tenant) ───
    let groupId = companyGroupId as string | undefined;
    let groupRecord: { id: string; name: string; tenantId: string; maxCompanies: number | null; employeeLimitMode: string; maxEmployees: number | null } | null = null;

    if (groupId) {
      groupRecord = await tenantDataDb.companyGroup.findUnique({
        where: { id: groupId },
        select: { id: true, name: true, tenantId: true, maxCompanies: true, employeeLimitMode: true, maxEmployees: true },
      });
      if (!groupRecord || groupRecord.tenantId !== targetTenantId) {
        return NextResponse.json(
          { error: 'The selected group company does not belong to the target tenant' },
          { status: 400, headers: corsHeaders() }
        );
      }
    } else {
      // ─── PERMISSION RULE ───
      // Only SUPER ADMIN can create new group companies. Tenant admins MUST
      // select an existing group (created by the super admin) when inducting
      // a company. This enforces the multi-tenancy hierarchy:
      //   Super admin → creates Group Companies under a tenant
      //   Tenant admin → creates Companies under an existing group
      if (role !== 'super_admin') {
        return NextResponse.json(
          {
            error: 'Please select an existing group company. Only super admins can create new group companies — if no group is available, please ask your super admin to create one under your tenant first.',
            code: 'GROUP_COMPANY_REQUIRED',
          },
          { status: 400, headers: corsHeaders() }
        );
      }
      // Super admin: auto-create a group under the target tenant (back-compat)
      const groupName = (companyGroupName && String(companyGroupName).trim()) || `${name} Group`;
      groupRecord = await tenantDataDb.companyGroup.create({
        data: { name: groupName, tenantId: targetTenantId },
        select: { id: true, name: true, tenantId: true, maxCompanies: true, employeeLimitMode: true, maxEmployees: true },
      });
      groupId = groupRecord.id;
    }

    // ─── Quota check #2: group.maxCompanies ───
    if (groupRecord.maxCompanies !== null && groupRecord.maxCompanies > 0) {
      const companiesInThisGroup = await tenantDataDb.company.count({ where: { companyGroupId: groupId } });
      if (companiesInThisGroup >= groupRecord.maxCompanies) {
        return NextResponse.json(
          {
            error: `Group company "${groupRecord.name}" has reached its cap of ${groupRecord.maxCompanies} compan(y/ies). Choose another group or ask the super admin to raise the cap.`,
            code: 'GROUP_COMPANY_LIMIT_REACHED',
            limit: groupRecord.maxCompanies,
            current: companiesInThisGroup,
          },
          { status: 403, headers: corsHeaders() }
        );
      }
    }

    const company = await tenantDataDb.company.create({
      data: {
        name,
        code: code || name.substring(0, 6).toUpperCase().replace(/\s/g, ''),
        companyGroupId: groupId,
        registrationNo,
        taxId,
        country: country || 'India',
        currency: currency || 'INR',
        timezone: timezone || 'Asia/Kolkata',
        address,
        city,
        state,
        zipCode,
        phone,
        email,
        website,
        status: status || 'active',
        maxEmployees,
        plannedEmployeeCount,
      },
      include: {
        companyGroup: {
          select: {
            id: true,
            name: true,
            tenantId: true,
            maxEmployees: true,
            employeeLimitMode: true,
            maxCompanies: true,
            tenant: { select: { id: true, name: true, slug: true } },
          },
        },
        _count: { select: { departments: true, branches: true } },
      },
    });

    return NextResponse.json(
      {
        company,
        // Echo back the parent tenant + group context so the UI can show
        // exactly where this company was inducted.
        context: {
          tenant: { id: targetTenant.id, name: targetTenant.name, slug: targetTenant.slug },
          companyGroup: { id: groupRecord.id, name: groupRecord.name },
          quota: {
            tenantMaxCompanies: targetTenant.maxCompaniesAllowed,
            tenantCompaniesUsed: currentCompanyCount + 1,
            groupMaxCompanies: groupRecord.maxCompanies,
            groupCompaniesUsed: (await tenantDataDb.company.count({ where: { companyGroupId: groupId } })),
          },
        },
      },
      { status: 201, headers: corsHeaders() }
    );
  } catch (error: unknown) {
    console.error('Create company error:', error);
    return NextResponse.json({ error: 'Failed to create company' }, { status: 500, headers: corsHeaders() });
  }
}

// PUT /api/companies — Update a company (admin only)
export async function PUT(req: NextRequest) {
  const db = await getDb(req);
  try {
    // ─── Tenant status guard: block writes for suspended/inactive tenants ───
    const tenantBlock = await checkTenantStatusOrBlock(req, corsHeaders);
    if (tenantBlock) return tenantBlock;

    // ─── Auth check ───
    const decoded = await requireAuth(req);
    if (!decoded) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders() });
    }
    const role = (decoded.role as string) || 'employee';
    const callerTenantId = decoded.tenantId as string;

    if (!['super_admin', 'tenant_admin', 'admin'].includes(role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403, headers: corsHeaders() });
    }

    const body = await req.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json({ error: 'Company ID is required' }, { status: 400, headers: corsHeaders() });
    }

    // FIX: Use tenant-specific DB for company lookup/update
    const updateDb = callerTenantId ? await getDbForTenantById(callerTenantId) : db;

    const existing = await updateDb.company.findUnique({
      where: { id },
      include: { companyGroup: { select: { id: true, name: true, tenantId: true } } },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404, headers: corsHeaders() });
    }

    // Verify ownership for non-super_admin
    if (role !== 'super_admin' && existing.companyGroup?.tenantId !== callerTenantId) {
      return NextResponse.json({ error: 'Company does not belong to your tenant' }, { status: 403, headers: corsHeaders() });
    }

    // ─── Server-side validation ───
    if (updateData.phone && typeof updateData.phone === 'string') {
      const phoneResult = validatePhone(updateData.phone);
      if (!phoneResult.valid) {
        return NextResponse.json({ error: phoneResult.error }, { status: 400, headers: corsHeaders() });
      }
    }
    if (updateData.email && typeof updateData.email === 'string') {
      const emailResult = validateEmail(updateData.email);
      if (!emailResult.valid) {
        return NextResponse.json({ error: emailResult.error }, { status: 400, headers: corsHeaders() });
      }
    }

    const company = await updateDb.company.update({
      where: { id },
      data: updateData,
      include: {
        companyGroup: { select: { id: true, name: true } },
        _count: { select: { departments: true, branches: true } },
      },
    });

    return NextResponse.json({ company }, { headers: corsHeaders() });
  } catch (error: unknown) {
    console.error('Update company error:', error);
    return NextResponse.json({ error: 'Failed to update company' }, { status: 500, headers: corsHeaders() });
  }
}

// DELETE /api/companies — Delete a company (super_admin or tenant_admin only)
export async function DELETE(req: NextRequest) {
  const db = await getDb(req);
  try {
    // ─── Tenant status guard: block writes for suspended/inactive tenants ───
    const tenantBlock = await checkTenantStatusOrBlock(req, corsHeaders);
    if (tenantBlock) return tenantBlock;

    // ─── Auth check ───
    const decoded = await requireAuth(req);
    if (!decoded) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders() });
    }
    const role = (decoded.role as string) || 'employee';
    const callerTenantId = decoded.tenantId as string;

    if (!['super_admin', 'tenant_admin'].includes(role)) {
      return NextResponse.json({ error: 'Only admins can delete companies' }, { status: 403, headers: corsHeaders() });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Company ID is required' }, { status: 400, headers: corsHeaders() });
    }

    // FIX: Use tenant-specific DB for company lookup/delete
    const deleteDb = callerTenantId ? await getDbForTenantById(callerTenantId) : db;

    const existing = await deleteDb.company.findUnique({
      where: { id },
      include: { companyGroup: { select: { id: true, name: true, tenantId: true } } },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404, headers: corsHeaders() });
    }

    // Verify ownership for non-super_admin
    if (role !== 'super_admin' && existing.companyGroup?.tenantId !== callerTenantId) {
      return NextResponse.json({ error: 'Company does not belong to your tenant' }, { status: 403, headers: corsHeaders() });
    }

    await deleteDb.company.delete({ where: { id } });
    return NextResponse.json({ message: 'Company deleted' }, { headers: corsHeaders() });
  } catch (error: unknown) {
    console.error('Delete company error:', error);
    return NextResponse.json({ error: 'Failed to delete company' }, { status: 500, headers: corsHeaders() });
  }
}
