import { NextRequest, NextResponse } from 'next/server';
import { getDb, getPlatformDb, getDbForTenant } from '@/lib/tenant-db';
import { getDesignationCompanyFilter, getAuthInfo, getCompanyFilter } from '@/lib/companyScope';
import { checkTenantStatusOrBlock } from '@/lib/tenant-guard';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';
import { isServerLiveSite } from '@/lib/tenant-filter';

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

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const tenantId = url.searchParams.get('tenantId');
    const queryCompanyId = url.searchParams.get('companyId');

    let jwtRole = 'employee';
    try {
      const token = getTokenFromHeaders(req);
      if (token) {
        const decoded = await verifyToken(token);
        if (decoded) jwtRole = (decoded.role as string) || 'employee';
      }
    } catch {}

    // ─── GOLDEN RULE: Super_admin without tenant/company on LIVE = empty ───
    if (jwtRole === 'super_admin' && !tenantId && !queryCompanyId && isServerLiveSite(req)) {
      return NextResponse.json({ data: [], pagination: { page: 1, limit: 100, total: 0, totalPages: 0 } }, { headers: corsHeaders() });
    }

    // ─── For super_admin, resolve the correct tenant DB ───
    let db = await getDb(req);

    if (jwtRole === 'super_admin') {
      if (tenantId) {
        const tenant = await getPlatformDb().tenant.findUnique({
          where: { id: tenantId },
          select: { slug: true },
        });
        if (tenant?.slug) {
          db = await getDbForTenant(tenant.slug);
        }
      } else if (queryCompanyId) {
        let company = await db.company.findUnique({ where: { id: queryCompanyId }, select: { companyGroupId: true } }).catch(() => null);
        if (!company) company = await getPlatformDb().company.findUnique({ where: { id: queryCompanyId }, select: { companyGroupId: true } }).catch(() => null);
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

    const designationFilter = await getDesignationCompanyFilter(req);
    if (designationFilter === null) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders() });
    }

    const departmentId = url.searchParams.get('departmentId');
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '100');

    // getDesignationCompanyFilter() already reads ?companyId= from the URL for admins
    // (via resolveCompanyScope), so no manual queryCompanyId handling needed.
    const where: Record<string, unknown> = { status: 'active' };

    if (departmentId) {
      where.departmentId = departmentId;
    }

    // Apply company scoping via Department relation
    if (Object.keys(designationFilter).length > 0) {
      where.department = { ...designationFilter };
    }

    const designations = await db.designation.findMany({
      where,
      orderBy: [{ level: 'asc' }, { title: 'asc' }],
      skip: (page - 1) * limit,
      take: limit,
      include: {
        department: { select: { id: true, name: true, companyId: true } },
        _count: { select: { employees: true } },
      },
    });

    const total = await db.designation.count({ where });

    return NextResponse.json({
      data: designations,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Designations GET error:', error);
    return NextResponse.json({
      data: [],
      pagination: { page: 1, limit: 100, total: 0, totalPages: 0 },
    }, { headers: corsHeaders() });
  }
}

export async function POST(req: NextRequest) {
  try {
    const db = await getDb(req);

    // ─── Tenant status guard: block writes for suspended/inactive tenants ───
    const tenantBlock = await checkTenantStatusOrBlock(req, corsHeaders);
    if (tenantBlock) return tenantBlock;

    const auth = await getAuthInfo(req);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders() });
    }

    const body = await req.json();
    const { title, departmentId, level, minSalary, maxSalary, status } = body;

    if (!title || !departmentId) {
      return NextResponse.json({ error: 'Title and departmentId are required' }, { status: 400, headers: corsHeaders() });
    }

    // ─── Type-safe conversion ───
    // Frontend form sends strings; Prisma requires Int/Float
    const parsedLevel = level != null && level !== '' ? Number(level) : 1;
    const parsedMinSalary = minSalary != null && minSalary !== '' ? Number(minSalary) : null;
    const parsedMaxSalary = maxSalary != null && maxSalary !== '' ? Number(maxSalary) : null;

    if (isNaN(parsedLevel)) {
      return NextResponse.json({ error: 'Level must be a valid number' }, { status: 400, headers: corsHeaders() });
    }
    if (parsedMinSalary !== null && isNaN(parsedMinSalary)) {
      return NextResponse.json({ error: 'Min Salary must be a valid number' }, { status: 400, headers: corsHeaders() });
    }
    if (parsedMaxSalary !== null && isNaN(parsedMaxSalary)) {
      return NextResponse.json({ error: 'Max Salary must be a valid number' }, { status: 400, headers: corsHeaders() });
    }

    // Verify the department belongs to the user's/company-switcher's company
    const companyFilter = await getCompanyFilter(req);
    if (companyFilter && 'companyId' in companyFilter) {
      const department = await db.department.findFirst({
        where: { id: departmentId, companyId: companyFilter.companyId as string },
      });
      if (!department) {
        return NextResponse.json({ error: 'Department not found in the selected company. Please select a valid department for this company.' }, { status: 403, headers: corsHeaders() });
      }
    } else {
      // No company filter (admin without company selected) — just verify the department exists
      const department = await db.department.findFirst({
        where: { id: departmentId },
      });
      if (!department) {
        return NextResponse.json({ error: 'Department not found' }, { status: 404, headers: corsHeaders() });
      }
    }

    const designation = await db.designation.create({
      data: {
        title,
        departmentId,
        level: parsedLevel,
        minSalary: parsedMinSalary,
        maxSalary: parsedMaxSalary,
        status: status || 'active',
      },
      include: {
        department: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ designation }, { status: 201, headers: corsHeaders() });
  } catch (error) {
    console.error('Designations POST error:', error);
    const message = error instanceof Error ? error.message : 'Failed to create designation';
    return NextResponse.json({ error: 'Failed to create designation', detail: message }, { status: 500, headers: corsHeaders() });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const db = await getDb(req);
    const auth = await getAuthInfo(req);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders() });
    }

    const body = await req.json();
    const { id, level, minSalary, maxSalary, ...restUpdateData } = body;

    if (!id) {
      return NextResponse.json({ error: 'Designation ID is required' }, { status: 400, headers: corsHeaders() });
    }

    // ─── Type-safe conversion for numeric fields ───
    const updateData: Record<string, unknown> = { ...restUpdateData };
    if (level !== undefined) {
      const parsed = level !== '' ? Number(level) : 1;
      if (isNaN(parsed)) {
        return NextResponse.json({ error: 'Level must be a valid number' }, { status: 400, headers: corsHeaders() });
      }
      updateData.level = parsed;
    }
    if (minSalary !== undefined) {
      updateData.minSalary = minSalary !== '' && minSalary !== null ? Number(minSalary) : null;
      if (updateData.minSalary !== null && isNaN(updateData.minSalary as number)) {
        return NextResponse.json({ error: 'Min Salary must be a valid number' }, { status: 400, headers: corsHeaders() });
      }
    }
    if (maxSalary !== undefined) {
      updateData.maxSalary = maxSalary !== '' && maxSalary !== null ? Number(maxSalary) : null;
      if (updateData.maxSalary !== null && isNaN(updateData.maxSalary as number)) {
        return NextResponse.json({ error: 'Max Salary must be a valid number' }, { status: 400, headers: corsHeaders() });
      }
    }

    const existing = await db.designation.findUnique({
      where: { id },
      include: { department: { select: { companyId: true } } },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Designation not found' }, { status: 404, headers: corsHeaders() });
    }

    // Non-admin users can only update designations in their own company
    const companyFilter = await getCompanyFilter(req);
    if (companyFilter && 'companyId' in companyFilter && existing.department.companyId !== companyFilter.companyId) {
      return NextResponse.json({ error: 'Forbidden: cannot modify designation outside your company' }, { status: 403, headers: corsHeaders() });
    }

    const designation = await db.designation.update({
      where: { id },
      data: updateData,
      include: {
        department: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ designation }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Designations PUT error:', error);
    const message = error instanceof Error ? error.message : 'Failed to update designation';
    return NextResponse.json({ error: 'Failed to update designation', detail: message }, { status: 500, headers: corsHeaders() });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const db = await getDb(req);
    const auth = await getAuthInfo(req);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders() });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Designation ID is required' }, { status: 400, headers: corsHeaders() });
    }

    const existing = await db.designation.findUnique({
      where: { id },
      include: { department: { select: { companyId: true } } },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Designation not found' }, { status: 404, headers: corsHeaders() });
    }

    // Non-admin users can only delete designations in their own company
    const companyFilter = await getCompanyFilter(req);
    if (companyFilter && 'companyId' in companyFilter && existing.department.companyId !== companyFilter.companyId) {
      return NextResponse.json({ error: 'Forbidden: cannot delete designation outside your company' }, { status: 403, headers: corsHeaders() });
    }

    await db.designation.delete({ where: { id } });
    return NextResponse.json({ message: 'Designation deleted' }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Designations DELETE error:', error);
    const message = error instanceof Error ? error.message : 'Failed to delete designation';
    return NextResponse.json({ error: 'Failed to delete designation', detail: message }, { status: 500, headers: corsHeaders() });
  }
}
