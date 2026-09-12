import { NextResponse } from 'next/server';
import { getDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';
import { withSchemaSync } from '@/lib/schema-sync';

async function safeQuery<T>(fn: () => Promise<T>): Promise<T | null> {
  try { return await fn(); } catch { return null; }
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() });
}

export async function GET(request: Request) {
  await withSchemaSync(() => Promise.resolve());

  try {
    const token = getTokenFromHeaders(request);
    if (!token) {
      return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    }

    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: corsHeaders() });
    }

    const db = await getDb(request);

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');

    const where: Record<string, unknown> = {
      tenantId: decoded.tenantId as string,
      category: category || 'governance',
    };

    const settings = (await safeQuery(() => db.setting.findMany({
      where,
      orderBy: [{ category: 'asc' }, { key: 'asc' }],
    }))) ?? [];

    return NextResponse.json({ settings }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Get governance settings error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}

export async function PUT(request: Request) {
  await withSchemaSync(() => Promise.resolve());

  try {
    const token = getTokenFromHeaders(request);
    if (!token) {
      return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    }

    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: corsHeaders() });
    }

    // Only admins can update settings
    const role = decoded.role as string;
    if (!['super_admin', 'tenant_admin', 'admin'].includes(role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403, headers: corsHeaders() });
    }

    const db = await getDb(request);
    const body = await request.json();
    const { id, key, value, category, companyId, description, dataType } = body;

    if (!key || value === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: key, value' },
        { status: 400, headers: corsHeaders() }
      );
    }

    const tenantId = decoded.tenantId as string;
    const settingCategory = category || 'governance';
    const settingDataType = dataType || 'string';

    if (id) {
      // Update existing setting
      const existing = await safeQuery(() => db.setting.findFirst({
        where: { id, tenantId },
      }));

      if (!existing) {
        return NextResponse.json({ error: 'Setting not found' }, { status: 404, headers: corsHeaders() });
      }

      const updated = await safeQuery(() => db.setting.update({
        where: { id },
        data: {
          value: String(value),
          previousValue: existing.value,
          version: { increment: 1 },
          ...(description !== undefined && { description }),
        },
      }));

      if (!updated) {
        return NextResponse.json({ error: 'Failed to update setting' }, { status: 500, headers: corsHeaders() });
      }

      // Audit log
      await safeQuery(() => db.auditLog.create({
        data: {
          userId: decoded.userId as string,
          action: 'UPDATE_GOVERNANCE_SETTING',
          module: 'governance',
          details: `Updated setting ${existing.key} from "${existing.value}" to "${value}"`,
        },
      }));

      return NextResponse.json({ setting: updated }, { headers: corsHeaders() });
    }

    // Create new setting using upsert (unique constraint on tenantId+companyId+category+key)
    const setting = await safeQuery(() => db.setting.upsert({
      where: {
        tenantId_companyId_category_key: {
          tenantId,
          companyId: companyId || null,
          category: settingCategory,
          key,
        },
      },
      create: {
        tenantId,
        companyId: companyId || null,
        category: settingCategory,
        key,
        value: String(value),
        dataType: settingDataType,
        description: description || null,
      },
      update: {
        value: String(value),
        dataType: settingDataType,
        ...(description !== undefined && { description }),
      },
    }));

    if (!setting) {
      return NextResponse.json({ error: 'Failed to upsert setting' }, { status: 500, headers: corsHeaders() });
    }

    // Audit log
    await safeQuery(() => db.auditLog.create({
      data: {
        userId: decoded.userId as string,
        action: 'CREATE_GOVERNANCE_SETTING',
        module: 'governance',
        details: `Created/updated governance setting ${key} = "${value}"`,
      },
    }));

    return NextResponse.json({ setting }, { status: 201, headers: corsHeaders() });
  } catch (error) {
    console.error('Update governance settings error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}
