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
    const category = url.searchParams.get('category');
    const status = url.searchParams.get('status');
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '100');

    const where: Record<string, unknown> = { ...companyFilter };
    if (category) where.category = category;
    if (status) where.status = status;

    const policies = await db.policy.findMany({
      where,
      orderBy: { title: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const total = await db.policy.count({ where });

    return NextResponse.json({
      data: policies,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Policies GET error:', error);
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
    const { title, category, description, content, version, status, effectiveDate, expiryDate, companyId } = body;

    if (!title || !category || !description) {
      return NextResponse.json({ error: 'Title, category, and description are required' }, { status: 400, headers: corsHeaders() });
    }

    // Resolve companyId: from body, from user's scope, or from ownCompanyId
    let resolvedCompanyId = companyId;
    if (!resolvedCompanyId) {
      const companyFilter = await getCompanyFilter(req);
      if (companyFilter && 'companyId' in companyFilter) {
        resolvedCompanyId = companyFilter.companyId as string;
      }
    }
    // Fallback: use the caller's own company (for admins without a selection)
    if (!resolvedCompanyId) {
      const scope = await resolveCompanyScope(req);
      if (scope?.ownCompanyId) {
        resolvedCompanyId = scope.ownCompanyId;
      }
    }

    if (!resolvedCompanyId) {
      return NextResponse.json({ error: 'Company ID is required. Please select a company from the switcher.' }, { status: 400, headers: corsHeaders() });
    }

    const policy = await db.policy.create({
      data: {
        title,
        category,
        description,
        content: content || null,
        version: version || '1.0',
        status: status || 'active',
        effectiveDate: effectiveDate ? new Date(effectiveDate) : null,
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        companyId: resolvedCompanyId,
      },
    });

    return NextResponse.json({ policy }, { status: 201, headers: corsHeaders() });
  } catch (error) {
    console.error('Policies POST error:', error);
    return NextResponse.json({ error: 'Failed to create policy' }, { status: 500, headers: corsHeaders() });
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
      return NextResponse.json({ error: 'Policy ID is required' }, { status: 400, headers: corsHeaders() });
    }

    if (updateData.effectiveDate) {
      updateData.effectiveDate = new Date(updateData.effectiveDate);
    }
    if (updateData.expiryDate) {
      updateData.expiryDate = new Date(updateData.expiryDate);
    }

    const existing = await db.policy.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Policy not found' }, { status: 404, headers: corsHeaders() });
    }

    // Non-admin users can only update policies in their own company
    const companyFilter = await getCompanyFilter(req);
    if (companyFilter && 'companyId' in companyFilter && existing.companyId !== companyFilter.companyId) {
      return NextResponse.json({ error: 'Forbidden: cannot modify policy outside your company' }, { status: 403, headers: corsHeaders() });
    }

    const policy = await db.policy.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ policy }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Policies PUT error:', error);
    return NextResponse.json({ error: 'Failed to update policy' }, { status: 500, headers: corsHeaders() });
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
      return NextResponse.json({ error: 'Policy ID is required' }, { status: 400, headers: corsHeaders() });
    }

    const existing = await db.policy.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Policy not found' }, { status: 404, headers: corsHeaders() });
    }

    // Non-admin users can only delete policies in their own company
    const companyFilter = await getCompanyFilter(req);
    if (companyFilter && 'companyId' in companyFilter && existing.companyId !== companyFilter.companyId) {
      return NextResponse.json({ error: 'Forbidden: cannot delete policy outside your company' }, { status: 403, headers: corsHeaders() });
    }

    await db.policy.delete({ where: { id } });
    return NextResponse.json({ message: 'Policy deleted' }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Policies DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete policy' }, { status: 500, headers: corsHeaders() });
  }
}
