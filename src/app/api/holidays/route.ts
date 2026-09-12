import { NextRequest, NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { getCompanyFilter, getAuthInfo, resolveCompanyScope } from '@/lib/companyScope';

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
  const db = await getDb(req);
  try {
    const companyFilter = await getCompanyFilter(req);
    if (companyFilter === null) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders() });
    }

    const url = new URL(req.url);
    const type = url.searchParams.get('type');
    const year = url.searchParams.get('year');
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '100');

    const where: Record<string, unknown> = { ...companyFilter };
    if (type) where.type = type;
    if (year) {
      const startOfYear = new Date(parseInt(year), 0, 1);
      const endOfYear = new Date(parseInt(year), 11, 31);
      where.date = { gte: startOfYear, lte: endOfYear };
    }

    const holidays = await db.holiday.findMany({
      where,
      orderBy: { date: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const total = await db.holiday.count({ where });

    return NextResponse.json({
      data: holidays,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Holidays GET error:', error);
    return NextResponse.json({
      data: [],
      pagination: { page: 1, limit: 100, total: 0, totalPages: 0 },
    }, { headers: corsHeaders() });
  }
}

export async function POST(req: NextRequest) {
  const db = await getDb(req);
  try {
    const auth = await getAuthInfo(req);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders() });
    }

    const body = await req.json();
    const { name, date, type, country, description, companyId } = body;

    if (!name || !date) {
      return NextResponse.json({ error: 'Name and date are required' }, { status: 400, headers: corsHeaders() });
    }

    // Resolve companyId: from body, from user's scope, or from ownCompanyId
    let resolvedCompanyId = companyId;
    if (!resolvedCompanyId) {
      const companyFilter = await getCompanyFilter(req);
      if (companyFilter && 'companyId' in companyFilter) {
        resolvedCompanyId = companyFilter.companyId as string;
      }
    }
    // Fallback: use the caller's own company
    if (!resolvedCompanyId) {
      const scope = await resolveCompanyScope(req);
      if (scope?.ownCompanyId) {
        resolvedCompanyId = scope.ownCompanyId;
      }
    }

    if (!resolvedCompanyId) {
      return NextResponse.json({ error: 'Company ID is required. Please select a company from the switcher.' }, { status: 400, headers: corsHeaders() });
    }

    // ─── Validate date ───
    const holidayDate = new Date(date);
    if (isNaN(holidayDate.getTime())) {
      return NextResponse.json({ error: 'Invalid date format' }, { status: 400, headers: corsHeaders() });
    }
    // Past date validation (allow dates up to today)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (holidayDate < today) {
      return NextResponse.json({ error: 'Holiday date cannot be in the past' }, { status: 400, headers: corsHeaders() });
    }
    // Duplicate date check for the same company
    const existingHoliday = await db.holiday.findFirst({
      where: {
        date: holidayDate,
        companyId: resolvedCompanyId,
      },
      select: { id: true, name: true },
    });
    if (existingHoliday) {
      return NextResponse.json(
        { error: `A holiday (${existingHoliday.name}) already exists on this date for the selected company` },
        { status: 409, headers: corsHeaders() }
      );
    }

    const holiday = await db.holiday.create({
      data: {
        name,
        date: holidayDate,
        type: type || 'public',
        country: country || 'India',
        description,
        companyId: resolvedCompanyId,
      },
    });

    return NextResponse.json({ holiday }, { status: 201, headers: corsHeaders() });
  } catch (error) {
    console.error('Holidays POST error:', error);
    return NextResponse.json({ error: 'Failed to create holiday' }, { status: 500, headers: corsHeaders() });
  }
}

export async function PUT(req: NextRequest) {
  const db = await getDb(req);
  try {
    const auth = await getAuthInfo(req);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders() });
    }

    const body = await req.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json({ error: 'Holiday ID is required' }, { status: 400, headers: corsHeaders() });
    }

    if (updateData.date) {
      updateData.date = new Date(updateData.date);
    }

    const existing = await db.holiday.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Holiday not found' }, { status: 404, headers: corsHeaders() });
    }

    // Non-admin users can only update holidays in their own company
    const companyFilter = await getCompanyFilter(req);
    if (companyFilter && 'companyId' in companyFilter && existing.companyId !== companyFilter.companyId) {
      return NextResponse.json({ error: 'Forbidden: cannot modify holiday outside your company' }, { status: 403, headers: corsHeaders() });
    }

    const holiday = await db.holiday.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ holiday }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Holidays PUT error:', error);
    return NextResponse.json({ error: 'Failed to update holiday' }, { status: 500, headers: corsHeaders() });
  }
}

export async function DELETE(req: NextRequest) {
  const db = await getDb(req);
  try {
    const auth = await getAuthInfo(req);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders() });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Holiday ID is required' }, { status: 400, headers: corsHeaders() });
    }

    const existing = await db.holiday.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Holiday not found' }, { status: 404, headers: corsHeaders() });
    }

    // Non-admin users can only delete holidays in their own company
    const companyFilter = await getCompanyFilter(req);
    if (companyFilter && 'companyId' in companyFilter && existing.companyId !== companyFilter.companyId) {
      return NextResponse.json({ error: 'Forbidden: cannot delete holiday outside your company' }, { status: 403, headers: corsHeaders() });
    }

    await db.holiday.delete({ where: { id } });
    return NextResponse.json({ message: 'Holiday deleted' }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Holidays DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete holiday' }, { status: 500, headers: corsHeaders() });
  }
}
