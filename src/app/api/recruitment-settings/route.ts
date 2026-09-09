import { NextResponse } from 'next/server';
import { getDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';
import { ensureSchemaSynced } from '@/lib/schema-sync';

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

const SETTINGS_CATEGORY = 'recruitment';

/** Default recruitment settings (used when no DB rows exist yet). */
const DEFAULT_SETTINGS: Record<string, { value: string; dataType: string; description: string }> = {
  autoPublish:          { value: 'true',  dataType: 'boolean', description: 'Auto-publish approved requisitions to job boards' },
  requisitionApproval:  { value: 'true',  dataType: 'boolean', description: 'Require manager approval before posting goes live' },
  resumeParsingAI:      { value: 'false', dataType: 'boolean', description: 'Use AI to extract and structure candidate data from resumes' },
  offerTemplate:        { value: 'Standard', dataType: 'string', description: 'Default offer letter template' },
  backgroundCheck:      { value: 'true',  dataType: 'boolean', description: 'Initiate background verification for all new hires' },
  probationPeriod:      { value: '90',    dataType: 'number', description: 'Probation period in days' },
  noticePeriod:         { value: '30',    dataType: 'number', description: 'Notice period in days' },
  referralBonus:        { value: '0',     dataType: 'number', description: 'Referral bonus amount' },
  maxInterviewRounds:   { value: '5',     dataType: 'number', description: 'Maximum interview rounds allowed' },
  skillAssessment:      { value: 'true',  dataType: 'boolean', description: 'Enable skill assessment for candidates' },
  documentVerification: { value: 'true',  dataType: 'boolean', description: 'Require document verification before onboarding' },
  offerExpiry:          { value: '7',     dataType: 'number', description: 'Offer letter expiry in days' },
  aiScreening:          { value: 'false', dataType: 'boolean', description: 'Enable AI-based candidate screening' },
  videoInterview:       { value: 'false', dataType: 'boolean', description: 'Enable video interview scheduling' },
  candidatePortal:      { value: 'true',  dataType: 'boolean', description: 'Enable candidate self-service portal' },
  emailNotifications:   { value: 'true',  dataType: 'boolean', description: 'Send email notifications for recruitment events' },
  smsNotifications:     { value: 'false', dataType: 'boolean', description: 'Send SMS notifications for recruitment events' },
  hiringFreeze:         { value: 'false', dataType: 'boolean', description: 'Hiring freeze active — blocks new postings' },
  piiRetention:         { value: '6',     dataType: 'number', description: 'Months to retain candidate PII data after rejection' },
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() });
}

/**
 * GET — Return all recruitment settings for the authenticated tenant.
 * Merges DB rows with defaults so the client always receives a full set.
 */
export async function GET(request: Request) {
  try {
    await ensureSchemaSynced();

    const token = getTokenFromHeaders(request);
    if (!token) {
      return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    }
    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: corsHeaders() });
    }
    const decodedRec = decoded as unknown as Record<string, any>;

    const db = await getDb(request);

    // Find the tenant ID — either from the token directly or from the employee lookup
    let tenantId = decodedRec.tenantId as string | undefined;
    if (!tenantId && decodedRec.userId) {
      const emp = await safeQuery(() => db.employee.findFirst({
        where: { userId: decodedRec.userId as string },
        select: { company: { select: { companyGroup: { select: { tenantId: true } } } } },
      }));
      tenantId = emp?.company?.companyGroup?.tenantId;
    }
    if (!tenantId) {
      return NextResponse.json({ error: 'Unable to determine tenant' }, { status: 403, headers: corsHeaders() });
    }

    // Fetch existing settings from DB
    const rows = (await safeQuery(() => db.setting.findMany({
      where: { tenantId, category: SETTINGS_CATEGORY, companyId: null },
      select: { key: true, value: true, dataType: true },
    }))) ?? [];

    // Merge with defaults
    const settings: Record<string, any> = {};
    for (const [key, def] of Object.entries(DEFAULT_SETTINGS)) {
      const row = rows.find((r) => r.key === key);
      const raw = row ? row.value : def.value;
      // Deserialize according to dataType
      const dt = (row?.dataType || def.dataType) as string;
      if (dt === 'boolean') settings[key] = raw === 'true';
      else if (dt === 'number') settings[key] = Number(raw);
      else settings[key] = raw;
    }

    return NextResponse.json({ settings }, { headers: corsHeaders() });
  } catch (error) {
    console.error('GET recruitment-settings error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}

/**
 * PUT — Upsert recruitment settings for the authenticated tenant.
 * Body: { settings: { [key: string]: any } }
 * Only keys defined in DEFAULT_SETTINGS are accepted.
 */
export async function PUT(request: Request) {
  try {
    await ensureSchemaSynced();

    const token = getTokenFromHeaders(request);
    if (!token) {
      return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    }
    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: corsHeaders() });
    }
    const decodedRec = decoded as unknown as Record<string, any>;

    // Only admins can update settings
    const allowedRoles = ['super_admin', 'tenant_admin', 'admin'];
    if (!allowedRoles.includes(decodedRec.role as string)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403, headers: corsHeaders() });
    }

    const db = await getDb(request);

    let tenantId = decodedRec.tenantId as string | undefined;
    if (!tenantId && decodedRec.userId) {
      const emp = await safeQuery(() => db.employee.findFirst({
        where: { userId: decodedRec.userId as string },
        select: { company: { select: { companyGroup: { select: { tenantId: true } } } } },
      }));
      tenantId = emp?.company?.companyGroup?.tenantId;
    }
    if (!tenantId) {
      return NextResponse.json({ error: 'Unable to determine tenant' }, { status: 403, headers: corsHeaders() });
    }

    const body = await request.json();
    const incoming = body.settings as Record<string, any> | undefined;
    if (!incoming || typeof incoming !== 'object') {
      return NextResponse.json({ error: 'Missing settings object' }, { status: 400, headers: corsHeaders() });
    }

    // Upsert each recognised key
    const upserts: Promise<unknown>[] = [];
    for (const [key, def] of Object.entries(DEFAULT_SETTINGS)) {
      if (!(key in incoming)) continue;

      const rawVal = incoming[key];
      // Serialize value to string for DB storage
      let serialized: string;
      if (def.dataType === 'boolean') serialized = String(!!rawVal);
      else if (def.dataType === 'number') serialized = String(Number(rawVal) || 0);
      else serialized = String(rawVal);

      upserts.push(
        safeQuery(() => db.setting.upsert({
          where: { tenantId_companyId_category_key: { tenantId, companyId: null, category: SETTINGS_CATEGORY, key } },
          create: {
            tenantId,
            category: SETTINGS_CATEGORY,
            key,
            value: serialized,
            dataType: def.dataType,
            description: def.description,
          },
          update: {
            value: serialized,
            previousValue: undefined, // let Prisma keep current
          },
        }))
      );
    }

    const upsertResults = await Promise.all(upserts);
    // Check if any upsert failed
    const failedIndex = upsertResults.findIndex(r => r === null);
    if (failedIndex !== -1) {
      return NextResponse.json({ error: 'Failed to upsert one or more settings' }, { status: 500, headers: corsHeaders() });
    }

    // Audit log
    if (decodedRec.userId) {
      await safeQuery(() => db.auditLog.create({
        data: {
          userId: decodedRec.userId as string,
          action: 'UPDATE_RECRUITMENT_SETTINGS',
          module: 'recruitment',
          details: 'Updated recruitment settings',
        },
      }));
    }

    // Return fresh settings (same logic as GET)
    const rows = (await safeQuery(() => db.setting.findMany({
      where: { tenantId, category: SETTINGS_CATEGORY, companyId: null },
      select: { key: true, value: true, dataType: true },
    }))) ?? [];

    const settings: Record<string, any> = {};
    for (const [key, def] of Object.entries(DEFAULT_SETTINGS)) {
      const row = rows.find((r) => r.key === key);
      const raw = row ? row.value : def.value;
      const dt = (row?.dataType || def.dataType) as string;
      if (dt === 'boolean') settings[key] = raw === 'true';
      else if (dt === 'number') settings[key] = Number(raw);
      else settings[key] = raw;
    }

    return NextResponse.json({ settings }, { headers: corsHeaders() });
  } catch (error) {
    console.error('PUT recruitment-settings error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}
