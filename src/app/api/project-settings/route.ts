/**
 * Project Management Settings API
 *  GET  — Retrieve project settings (key-value pairs from Setting model, category="project")
 *  PUT  — Upsert project settings (admin only)
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
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

const SETTINGS_CATEGORY = 'project';

const DEFAULT_SETTINGS: Record<string, { value: string; dataType: string; description: string }> = {
  sprintDuration:           { value: '2weeks',    dataType: 'string',  description: 'Default sprint duration for new projects' },
  autoAssign:               { value: 'false',     dataType: 'boolean', description: 'Automatically assign tasks based on capacity' },
  requireApproval:          { value: 'false',     dataType: 'boolean', description: 'Require approval for project changes' },
  defaultView:              { value: 'grid',      dataType: 'string',  description: 'Default project list view mode' },
  timeTrackingEnabled:      { value: 'true',      dataType: 'boolean', description: 'Require time tracking on all tasks' },
  overtimeEnabled:          { value: 'false',     dataType: 'boolean', description: 'Enable overtime tracking for projects' },
  notifyOnDeadline:         { value: 'true',      dataType: 'boolean', description: 'Notify team when deadlines are approaching' },
  autoTimesheetApproval:    { value: 'false',     dataType: 'boolean', description: 'Automatically approve submitted timesheets' },
};

/** GET /api/project-settings */
export async function GET(request: NextRequest) {
  const db = await getDb(request);
  const platformDb = getPlatformDb();
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders() });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401, headers: corsHeaders() });

    await withSchemaSync(() => Promise.resolve());

    // Resolve tenant
    const user = await platformDb.user.findUnique({ where: { id: decoded.userId as string } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404, headers: corsHeaders() });

    const tenantSlug = request.headers.get('x-tenant-slug');
    let tenantId: string | null = null;
    if (tenantSlug) {
      const tenant = await platformDb.tenant.findUnique({ where: { slug: tenantSlug } });
      if (tenant) tenantId = tenant.id;
    }
    if (!tenantId && user.tenantId) tenantId = user.tenantId;
    if (!tenantId) return NextResponse.json({ error: 'Tenant not found' }, { status: 404, headers: corsHeaders() });

    // Fetch all project settings for this tenant
    const rows = (await safeQuery(() => db.setting.findMany({
      where: { tenantId, category: SETTINGS_CATEGORY },
    }))) ?? [];

    // Build a merged settings object: defaults overridden by DB values
    const settings: Record<string, unknown> = {};
    for (const [key, def] of Object.entries(DEFAULT_SETTINGS)) {
      const row = rows.find(r => r.key === key);
      if (row) {
        // Parse value based on dataType
        if (row.dataType === 'boolean') settings[key] = row.value === 'true';
        else if (row.dataType === 'number') settings[key] = Number(row.value);
        else settings[key] = row.value;
      } else {
        // Use default
        if (def.dataType === 'boolean') settings[key] = def.value === 'true';
        else if (def.dataType === 'number') settings[key] = Number(def.value);
        else settings[key] = def.value;
      }
    }

    return NextResponse.json({ settings }, { headers: corsHeaders() });
  } catch (error) {
    console.error('GET project-settings error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}

/** PUT /api/project-settings — Upsert project settings (admin only) */
export async function PUT(request: NextRequest) {
  const db = await getDb(request);
  const platformDb = getPlatformDb();
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders() });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401, headers: corsHeaders() });

    await withSchemaSync(() => Promise.resolve());

    // Resolve tenant and employee
    const user = await platformDb.user.findUnique({ where: { id: decoded.userId as string } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404, headers: corsHeaders() });

    const tenantSlug = request.headers.get('x-tenant-slug');
    let tenantId: string | null = null;
    if (tenantSlug) {
      const tenant = await platformDb.tenant.findUnique({ where: { slug: tenantSlug } });
      if (tenant) tenantId = tenant.id;
    }
    if (!tenantId && user.tenantId) tenantId = user.tenantId;
    if (!tenantId) return NextResponse.json({ error: 'Tenant not found' }, { status: 404, headers: corsHeaders() });

    // Get employee for company context
    const employee = await safeQuery(() => db.employee.findFirst({ where: { userId: decoded.userId } }));
    const companyId = employee?.companyId ?? null;

    // Role check: only admins can update settings
    const role = (decoded as any).role ?? user.role;
    const isAdmin = ['super_admin', 'tenant_admin', 'admin'].includes(role);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Admin only' }, { status: 403, headers: corsHeaders() });
    }

    const body = await request.json();

    // Upsert each provided setting key
    const upsertedKeys: string[] = [];
    for (const [key, rawValue] of Object.entries(body)) {
      if (!(key in DEFAULT_SETTINGS)) continue; // ignore unknown keys
      const def = DEFAULT_SETTINGS[key];

      // Serialize value to string
      let strValue: string;
      if (def.dataType === 'boolean') {
        strValue = rawValue ? 'true' : 'false';
      } else if (def.dataType === 'number') {
        strValue = String(Number(rawValue) || 0);
      } else {
        strValue = String(rawValue);
      }

      const result = await safeQuery(() => db.setting.upsert({
        where: {
          tenantId_companyId_category_key: {
            tenantId,
            companyId,
            category: SETTINGS_CATEGORY,
            key,
          },
        },
        create: {
          tenantId,
          companyId,
          category: SETTINGS_CATEGORY,
          key,
          value: strValue,
          dataType: def.dataType,
          description: def.description,
          isEditable: true,
        },
        update: {
          value: strValue,
          previousValue: undefined, // Prisma will keep existing
          version: { increment: 1 },
        },
      }));

      if (!result) {
        return NextResponse.json({ error: `Failed to upsert setting: ${key}` }, { status: 500, headers: corsHeaders() });
      }
      upsertedKeys.push(key);
    }

    // Re-fetch to return latest state
    const rows = (await safeQuery(() => db.setting.findMany({
      where: { tenantId, category: SETTINGS_CATEGORY },
    }))) ?? [];

    const settings: Record<string, unknown> = {};
    for (const [key, def] of Object.entries(DEFAULT_SETTINGS)) {
      const row = rows.find(r => r.key === key);
      if (row) {
        if (row.dataType === 'boolean') settings[key] = row.value === 'true';
        else if (row.dataType === 'number') settings[key] = Number(row.value);
        else settings[key] = row.value;
      } else {
        if (def.dataType === 'boolean') settings[key] = def.value === 'true';
        else if (def.dataType === 'number') settings[key] = Number(def.value);
        else settings[key] = def.value;
      }
    }

    return NextResponse.json({ settings, updatedKeys: upsertedKeys }, { headers: corsHeaders() });
  } catch (error) {
    console.error('PUT project-settings error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}
