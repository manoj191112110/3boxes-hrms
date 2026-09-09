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

const CATEGORY = 'support';

// Default settings
const DEFAULTS = {
  autoAssign: true,
  priorityEscalation: true,
  aiCategorization: true,
  slaCritical: '30',
  slaHigh: '2',
  slaNormal: '8',
  slaLow: '24',
  emailNotifications: true,
  autoCloseResolved: true,
  autoCloseDays: 7,
};

/** Helper: read all support settings for a tenant */
async function readSettings(db: any, tenantId: string) {
  const rows = (await safeQuery(() => db.setting.findMany({
    where: { tenantId, category: CATEGORY, companyId: null },
    select: { key: true, value: true, dataType: true },
  }))) ?? [];

  const map: Record<string, any> = {};
  for (const row of rows) {
    try {
      if (row.dataType === 'json' || row.dataType === 'array') {
        map[row.key] = JSON.parse(row.value);
      } else if (row.dataType === 'boolean') {
        map[row.key] = row.value === 'true';
      } else if (row.dataType === 'number') {
        map[row.key] = Number(row.value);
      } else {
        map[row.key] = row.value;
      }
    } catch {
      map[row.key] = row.value;
    }
  }

  return {
    autoAssign: map.autoAssign ?? DEFAULTS.autoAssign,
    priorityEscalation: map.priorityEscalation ?? DEFAULTS.priorityEscalation,
    aiCategorization: map.aiCategorization ?? DEFAULTS.aiCategorization,
    slaCritical: map.slaCritical ?? DEFAULTS.slaCritical,
    slaHigh: map.slaHigh ?? DEFAULTS.slaHigh,
    slaNormal: map.slaNormal ?? DEFAULTS.slaNormal,
    slaLow: map.slaLow ?? DEFAULTS.slaLow,
    emailNotifications: map.emailNotifications ?? DEFAULTS.emailNotifications,
    autoCloseResolved: map.autoCloseResolved ?? DEFAULTS.autoCloseResolved,
    autoCloseDays: map.autoCloseDays ?? DEFAULTS.autoCloseDays,
  };
}

/** GET /api/support-settings */
export async function GET(request: NextRequest) {
  const db = await getDb(request);
  const platformDb = getPlatformDb();
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: corsHeaders() });

    await withSchemaSync(() => Promise.resolve());

    const user = await platformDb.user.findUnique({ where: { id: decoded.userId as string } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404, headers: corsHeaders() });

    let tenantId: string | null = null;
    const tenantSlug = request.headers.get('x-tenant-slug');
    if (tenantSlug) {
      const tenant = await platformDb.tenant.findUnique({ where: { slug: tenantSlug } });
      if (tenant) tenantId = tenant.id;
    }
    if (!tenantId && user.tenantId) tenantId = user.tenantId;
    if (!tenantId) return NextResponse.json({ settings: DEFAULTS }, { headers: corsHeaders() });

    const settings = await readSettings(db, tenantId);
    return NextResponse.json({ settings }, { headers: corsHeaders() });
  } catch (error) {
    console.error('GET support-settings error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}

/** PUT /api/support-settings */
export async function PUT(request: NextRequest) {
  const db = await getDb(request);
  const platformDb = getPlatformDb();
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: corsHeaders() });

    await withSchemaSync(() => Promise.resolve());

    const employee = await safeQuery(() => db.employee.findFirst({ where: { userId: decoded.userId as string } }));
    if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404, headers: corsHeaders() });

    const user = await platformDb.user.findUnique({ where: { id: decoded.userId as string } });
    let tenantId: string | null = null;
    const tenantSlug = request.headers.get('x-tenant-slug');
    if (tenantSlug) {
      const tenant = await platformDb.tenant.findUnique({ where: { slug: tenantSlug } });
      if (tenant) tenantId = tenant.id;
    }
    if (!tenantId && user?.tenantId) tenantId = user.tenantId;
    if (!tenantId) return NextResponse.json({ error: 'Tenant not found' }, { status: 404, headers: corsHeaders() });

    const body = await request.json();
    const {
      autoAssign,
      priorityEscalation,
      aiCategorization,
      slaCritical,
      slaHigh,
      slaNormal,
      slaLow,
      emailNotifications,
      autoCloseResolved,
      autoCloseDays,
    } = body;

    const upserts: Promise<any>[] = [];

    const upsertSetting = (key: string, value: any, dataType: string) => {
      const serialized = dataType === 'json' || dataType === 'array' ? JSON.stringify(value) : String(value);
      upserts.push(
        safeQuery(() => db.setting.upsert({
          where: { tenantId_companyId_category_key: { tenantId, companyId: null, category: CATEGORY, key } },
          update: { value: serialized, dataType },
          create: { tenantId, companyId: null, category: CATEGORY, key, value: serialized, dataType },
        }))
      );
    };

    if (autoAssign !== undefined) upsertSetting('autoAssign', autoAssign, 'boolean');
    if (priorityEscalation !== undefined) upsertSetting('priorityEscalation', priorityEscalation, 'boolean');
    if (aiCategorization !== undefined) upsertSetting('aiCategorization', aiCategorization, 'boolean');
    if (slaCritical !== undefined) upsertSetting('slaCritical', slaCritical, 'string');
    if (slaHigh !== undefined) upsertSetting('slaHigh', slaHigh, 'string');
    if (slaNormal !== undefined) upsertSetting('slaNormal', slaNormal, 'string');
    if (slaLow !== undefined) upsertSetting('slaLow', slaLow, 'string');
    if (emailNotifications !== undefined) upsertSetting('emailNotifications', emailNotifications, 'boolean');
    if (autoCloseResolved !== undefined) upsertSetting('autoCloseResolved', autoCloseResolved, 'boolean');
    if (autoCloseDays !== undefined) upsertSetting('autoCloseDays', autoCloseDays, 'number');

    const upsertResults = await Promise.all(upserts);
    // Check if any upsert failed
    const failedIndex = upsertResults.findIndex(r => r === null);
    if (failedIndex !== -1) {
      return NextResponse.json({ error: 'Failed to upsert one or more settings' }, { status: 500, headers: corsHeaders() });
    }

    // Audit log
    await safeQuery(() => db.auditLog.create({
      data: {
        userId: decoded.userId as string,
        action: 'UPDATE_SUPPORT_SETTINGS',
        module: 'support',
        details: 'Updated support/helpdesk settings',
      },
    }));

    const settings = await readSettings(db, tenantId);
    return NextResponse.json({ settings }, { headers: corsHeaders() });
  } catch (error) {
    console.error('PUT support-settings error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}
