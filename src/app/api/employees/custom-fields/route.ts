import { NextRequest, NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';

/**
 * GET /api/employees/custom-fields
 * Query params: ?scope=global|country|company&countryCode=JP&companyId=xxx
 *
 * Returns the list of configured custom fields for the tenant.
 * Tenant Admins can configure these; other roles can read.
 */
export async function GET(request: NextRequest) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const scope = searchParams.get('scope');
    const countryCode = searchParams.get('countryCode');
    const companyId = searchParams.get('companyId');

    const where: Record<string, unknown> = {};
    if (scope) where.scope = scope;
    if (countryCode) where.countryCode = countryCode;
    if (companyId) where.companyId = companyId;

    const fields = await db.employeeCustomField.findMany({
      where,
      orderBy: [{ displayOrder: 'asc' }, { label: 'asc' }],
    });

    return NextResponse.json({ fields });
  } catch (error) {
    console.error('GET /api/employees/custom-fields error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/employees/custom-fields
 * Body: { scope, countryCode?, companyId?, label, key, fieldType, options?, isRequired?, ... }
 *
 * Tenant Admin / Super Admin only.
 */
export async function POST(request: NextRequest) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    if (!['super_admin', 'tenant_admin', 'admin'].includes(decoded.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const { scope = 'global', countryCode, companyId, label, key, fieldType, options, isRequired, isVisibleToManager, isVisibleToPeer, displayOrder } = body;

    if (!label || !key || !fieldType) {
      return NextResponse.json({ error: 'label, key, fieldType are required' }, { status: 400 });
    }
    if (scope === 'country' && !countryCode) {
      return NextResponse.json({ error: 'countryCode is required when scope=country' }, { status: 400 });
    }
    if (scope === 'company' && !companyId) {
      return NextResponse.json({ error: 'companyId is required when scope=company' }, { status: 400 });
    }

    const field = await db.employeeCustomField.create({
      data: {
        scope,
        countryCode: scope === 'country' ? countryCode : null,
        companyId: scope === 'company' ? companyId : null,
        label,
        key: String(key).toLowerCase().replace(/\s+/g, '_'),
        fieldType,
        options: options ? JSON.stringify(options) : null,
        isRequired: !!isRequired,
        isVisibleToManager: !!isVisibleToManager,
        isVisibleToPeer: !!isVisibleToPeer,
        displayOrder: displayOrder || 0,
        createdById: decoded.userId as string,
      },
    });

    return NextResponse.json({ field }, { status: 201 });
  } catch (error) {
    console.error('POST /api/employees/custom-fields error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
