import { NextRequest, NextResponse } from 'next/server';
import { getCompanyFilter, getAuthInfo } from '@/lib/companyScope';
import { getDb, getPlatformDb, getDbForTenant } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';
import { validateEmail, validatePhone } from '@/lib/validators';
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

    // Decode JWT to get role
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

    // ─── Resolve tenant DB ───
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

    // ─── Company-scoped data visibility ───
    const companyFilter = await getCompanyFilter(req);
    if (companyFilter === null) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders() });
    }
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '100');
    const search = url.searchParams.get('search');

    // getCompanyFilter() already reads ?companyId= from the URL for admins
    // (via resolveCompanyScope), so no manual queryCompanyId handling needed.
    const where: Record<string, unknown> = { status: 'active', ...companyFilter };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
        { city: { contains: search, mode: 'insensitive' } },
      ];
    }

    const branches = await db.branch.findMany({
      where,
      orderBy: { name: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        company: { select: { id: true, name: true, code: true } },
        _count: { select: { employees: true } },
      },
    });

    const total = await db.branch.count({ where });

    return NextResponse.json({
      data: branches,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Branches GET error:', error);
    return NextResponse.json({
      data: [],
      pagination: { page: 1, limit: 100, total: 0, totalPages: 0 },
    }, { headers: corsHeaders() });
  }
}

export async function POST(req: NextRequest) {
  const db = await getDb(req);
  try {
    // ─── Auth + company scoping for mutations ───
    const authInfo = await getAuthInfo(req);
    if (!authInfo) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders() });
    }

    // Only admins can create branches
    if (!['super_admin', 'tenant_admin', 'admin'].includes(authInfo.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403, headers: corsHeaders() });
    }

    const body = await req.json();
    const { name, code, companyId, country, state, city, address, zipCode, phone, email, status } = body;

    if (!name || !companyId) {
      return NextResponse.json({ error: 'Name and companyId are required' }, { status: 400, headers: corsHeaders() });
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

    // Verify the company exists and belongs to the admin's tenant (for non-super_admin)
    const company = await db.company.findUnique({
      where: { id: companyId },
      select: { id: true, companyGroup: { select: { tenantId: true } } },
    });
    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404, headers: corsHeaders() });
    }
    if (authInfo.role !== 'super_admin' && company.companyGroup.tenantId !== authInfo.tenantId) {
      return NextResponse.json({ error: 'Company does not belong to your tenant' }, { status: 403, headers: corsHeaders() });
    }

    const branch = await db.branch.create({
      data: {
        name,
        code: code || name.substring(0, 3).toUpperCase(),
        companyId,
        country: country || 'India',
        state,
        city,
        address,
        zipCode,
        phone,
        email,
        status: status || 'active',
      },
      include: {
        company: { select: { id: true, name: true, code: true } },
      },
    });

    return NextResponse.json({ branch }, { status: 201, headers: corsHeaders() });
  } catch (error) {
    console.error('Branches POST error:', error);
    return NextResponse.json({ error: 'Failed to create branch' }, { status: 500, headers: corsHeaders() });
  }
}

export async function PUT(req: NextRequest) {
  const db = await getDb(req);
  try {
    const authInfo = await getAuthInfo(req);
    if (!authInfo) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders() });
    }

    // Only admins can update branches
    if (!['super_admin', 'tenant_admin', 'admin'].includes(authInfo.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403, headers: corsHeaders() });
    }

    const body = await req.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json({ error: 'Branch ID is required' }, { status: 400, headers: corsHeaders() });
    }

    const existing = await db.branch.findUnique({
      where: { id },
      include: { company: { select: { id: true, companyGroup: { select: { tenantId: true } } } } },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Branch not found' }, { status: 404, headers: corsHeaders() });
    }

    // Verify ownership for non-super_admin
    if (authInfo.role !== 'super_admin' && existing.company?.companyGroup?.tenantId !== authInfo.tenantId) {
      return NextResponse.json({ error: 'Branch does not belong to your tenant' }, { status: 403, headers: corsHeaders() });
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

    const branch = await db.branch.update({
      where: { id },
      data: updateData,
      include: {
        company: { select: { id: true, name: true, code: true } },
      },
    });

    return NextResponse.json({ branch }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Branches PUT error:', error);
    return NextResponse.json({ error: 'Failed to update branch' }, { status: 500, headers: corsHeaders() });
  }
}

export async function DELETE(req: NextRequest) {
  const db = await getDb(req);
  try {
    const authInfo = await getAuthInfo(req);
    if (!authInfo) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders() });
    }

    // Only admins can delete branches
    if (!['super_admin', 'tenant_admin', 'admin'].includes(authInfo.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403, headers: corsHeaders() });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Branch ID is required' }, { status: 400, headers: corsHeaders() });
    }

    const existing = await db.branch.findUnique({
      where: { id },
      include: { company: { select: { id: true, companyGroup: { select: { tenantId: true } } } } },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Branch not found' }, { status: 404, headers: corsHeaders() });
    }

    // Verify ownership for non-super_admin
    if (authInfo.role !== 'super_admin' && existing.company?.companyGroup?.tenantId !== authInfo.tenantId) {
      return NextResponse.json({ error: 'Branch does not belong to your tenant' }, { status: 403, headers: corsHeaders() });
    }

    await db.branch.delete({ where: { id } });
    return NextResponse.json({ message: 'Branch deleted' }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Branches DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete branch' }, { status: 500, headers: corsHeaders() });
  }
}
