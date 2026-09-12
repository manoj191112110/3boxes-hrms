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

const CATEGORY = 'preboarding';

// Default settings when none exist in DB
const DEFAULTS = {
  communicationItems: [
    { label: 'Offer Letter Email', description: 'Automatically send offer letter and welcome email to new hires', enabled: true },
    { label: 'Document Collection Portal', description: 'Provide a secure portal for pre-joiners to upload required documents', enabled: true },
    { label: 'Welcome Kit', description: 'Send a digital welcome kit with company info and first-day instructions', enabled: false },
  ],
  documentChecklist: [
    { label: 'ID Proof', requirement: 'Required' },
    { label: 'Address Proof', requirement: 'Required' },
    { label: 'Education Certificates', requirement: 'Optional' },
  ],
  autoAssignBuddy: true,
  sendWelcomeEmail: true,
  autoCreateAccounts: false,
  bgvOnAccept: true,
};

/** Helper: read all preboarding settings for a tenant */
async function readSettings(db: any, tenantId: string) {
  const rows = (await safeQuery(() => db.setting.findMany({
    where: { tenantId, category: CATEGORY, companyId: null },
    select: { key: true, value: true, dataType: true },
  }))) ?? [];

  const map: Record<string, any> = {};
  for (const row of rows) {
    try {
      map[row.key] = row.dataType === 'json' || row.dataType === 'array' ? JSON.parse(row.value) : row.value;
      if (row.dataType === 'boolean') map[row.key] = row.value === 'true';
      if (row.dataType === 'number') map[row.key] = Number(row.value);
    } catch {
      map[row.key] = row.value;
    }
  }

  return {
    communicationItems: map.communicationItems || DEFAULTS.communicationItems,
    documentChecklist: map.documentChecklist || DEFAULTS.documentChecklist,
    autoAssignBuddy: map.autoAssignBuddy ?? DEFAULTS.autoAssignBuddy,
    sendWelcomeEmail: map.sendWelcomeEmail ?? DEFAULTS.sendWelcomeEmail,
    autoCreateAccounts: map.autoCreateAccounts ?? DEFAULTS.autoCreateAccounts,
    bgvOnAccept: map.bgvOnAccept ?? DEFAULTS.bgvOnAccept,
  };
}

/** GET /api/preboarding-settings */
export async function GET(request: NextRequest) {
  const db = await getDb(request);
  const platformDb = getPlatformDb();
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: corsHeaders() });

    await withSchemaSync(() => Promise.resolve());

    // Resolve tenant
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
    console.error('GET preboarding-settings error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}

/** PUT /api/preboarding-settings */
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
      communicationItems,
      documentChecklist,
      autoAssignBuddy,
      sendWelcomeEmail,
      autoCreateAccounts,
      bgvOnAccept,
    } = body as {
      communicationItems?: any[];
      documentChecklist?: any[];
      autoAssignBuddy?: boolean;
      sendWelcomeEmail?: boolean;
      autoCreateAccounts?: boolean;
      bgvOnAccept?: boolean;
    };

    // Upsert each setting key
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

    if (communicationItems !== undefined) upsertSetting('communicationItems', communicationItems, 'json');
    if (documentChecklist !== undefined) upsertSetting('documentChecklist', documentChecklist, 'json');
    if (autoAssignBuddy !== undefined) upsertSetting('autoAssignBuddy', autoAssignBuddy, 'boolean');
    if (sendWelcomeEmail !== undefined) upsertSetting('sendWelcomeEmail', sendWelcomeEmail, 'boolean');
    if (autoCreateAccounts !== undefined) upsertSetting('autoCreateAccounts', autoCreateAccounts, 'boolean');
    if (bgvOnAccept !== undefined) upsertSetting('bgvOnAccept', bgvOnAccept, 'boolean');

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
        action: 'UPDATE_PREBOARDING_SETTINGS',
        module: 'preboarding',
        details: 'Updated preboarding settings',
      },
    }));

    const settings = await readSettings(db, tenantId);
    return NextResponse.json({ settings }, { headers: corsHeaders() });
  } catch (error) {
    console.error('PUT preboarding-settings error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}
