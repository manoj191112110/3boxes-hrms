import { NextRequest, NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { getCompanyFilter, getAuthInfo } from '@/lib/companyScope';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';
import { isSuperAdminWithoutScope } from '@/lib/superAdminGuard';

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
    const db = await getDb(req);
    const companyFilter = await getCompanyFilter(req);
    if (companyFilter === null) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders() });
    }

    const url = new URL(req.url);
    const status = url.searchParams.get('status');
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    // ─── GOLDEN RULE: No dummy/seed data on LIVE for super_admin ───
    // Super_admin with no company selected would see ALL shifts across all
    // tenants (appears as duplicates). Return empty instead.
    const token = getTokenFromHeaders(req);
    const decoded = token ? await verifyToken(token) : null;
    if (decoded && isSuperAdminWithoutScope(decoded, url.searchParams.get('companyId'), url.searchParams.get('tenantId'), req)) {
      return NextResponse.json({
        data: [],
        pagination: { page, limit, total: 0, totalPages: 0 },
      }, { headers: corsHeaders() });
    }

    // getCompanyFilter() already reads ?companyId= from the URL for admins
    // (via resolveCompanyScope), so no manual queryCompanyId handling needed.
    const where: Record<string, unknown> = { ...companyFilter };
    if (status) {
      where.status = status;
    }

    const [shifts, total] = await Promise.all([
      db.shift.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          company: { select: { id: true, name: true } },
        },
      }),
      db.shift.count({ where }),
    ]);

    return NextResponse.json({
      data: shifts,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Shifts GET error:', error);
    return NextResponse.json({
      data: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    }, { headers: corsHeaders() });
  }
}

export async function POST(req: NextRequest) {
  try {
    const db = await getDb(req);
    const auth = await getAuthInfo(req);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders() });
    }

    const body = await req.json();
    const { name, startTime, endTime, breakDuration, graceTime, status, companyId } = body;

    if (!name || !startTime || !endTime) {
      return NextResponse.json(
        { error: 'Missing required fields: name, startTime, endTime' },
        { status: 400, headers: corsHeaders() },
      );
    }

    // ─── Type-safe conversion ───
    const parsedBreakDuration = breakDuration != null && breakDuration !== '' ? Number(breakDuration) : 60;
    const parsedGraceTime = graceTime != null && graceTime !== '' ? Number(graceTime) : 15;
    if (isNaN(parsedBreakDuration) || isNaN(parsedGraceTime)) {
      return NextResponse.json({ error: 'breakDuration and graceTime must be valid numbers' }, { status: 400, headers: corsHeaders() });
    }

    // Resolve companyId: from body, or from user's scope
    let resolvedCompanyId = companyId;
    if (!resolvedCompanyId) {
      const companyFilter = await getCompanyFilter(req);
      if (companyFilter && 'companyId' in companyFilter) {
        resolvedCompanyId = companyFilter.companyId as string;
      }
    }

    if (!resolvedCompanyId) {
      return NextResponse.json(
        { error: 'companyId is required — please select a company first' },
        { status: 400, headers: corsHeaders() },
      );
    }

    // Verify the company exists in the tenant DB before creating
    const companyExists = await db.company.findUnique({ where: { id: resolvedCompanyId }, select: { id: true } });
    if (!companyExists) {
      return NextResponse.json(
        { error: 'Company not found. Please select a valid company.' },
        { status: 400, headers: corsHeaders() },
      );
    }

    const shift = await db.shift.create({
      data: {
        name,
        startTime,
        endTime,
        breakDuration: parsedBreakDuration,
        graceTime: parsedGraceTime,
        status: status || 'active',
        companyId: resolvedCompanyId,
      },
      include: {
        company: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(shift, { status: 201, headers: corsHeaders() });
  } catch (error) {
    console.error('Shifts POST error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: 'Internal server error', detail: message }, { status: 500, headers: corsHeaders() });
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
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json({ error: 'Shift ID is required' }, { status: 400, headers: corsHeaders() });
    }

    const existing = await db.shift.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Shift not found' }, { status: 404, headers: corsHeaders() });
    }

    // Non-admin users can only update shifts in their own company
    const companyFilter = await getCompanyFilter(req);
    if (companyFilter && 'companyId' in companyFilter && existing.companyId !== companyFilter.companyId) {
      return NextResponse.json({ error: 'Forbidden: cannot modify shift outside your company' }, { status: 403, headers: corsHeaders() });
    }

    const shift = await db.shift.update({
      where: { id },
      data: updateData,
      include: {
        company: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(shift, { headers: corsHeaders() });
  } catch (error) {
    console.error('Shifts PUT error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
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
      return NextResponse.json({ error: 'Shift ID is required' }, { status: 400, headers: corsHeaders() });
    }

    const existing = await db.shift.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Shift not found' }, { status: 404, headers: corsHeaders() });
    }

    // Non-admin users can only delete shifts in their own company
    const companyFilter = await getCompanyFilter(req);
    if (companyFilter && 'companyId' in companyFilter && existing.companyId !== companyFilter.companyId) {
      return NextResponse.json({ error: 'Forbidden: cannot delete shift outside your company' }, { status: 403, headers: corsHeaders() });
    }

    await db.shift.delete({ where: { id } });
    return NextResponse.json({ message: 'Shift deleted' }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Shifts DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}
