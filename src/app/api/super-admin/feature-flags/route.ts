import { NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';
import { ensureSchemaSynced } from '@/lib/schema-sync';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() });
}

/**
 * The platform-wide default feature flag catalogue. When a tenant is queried
 * for the first time, every flag in this list is auto-seeded as a
 * `platform_default` row so the super admin has a complete UI to toggle.
 *
 * SRS REQ-SA-05: "Configure Feature Flags per Parent Company (e.g. enabling/
 * disabling AI modules based on plan)."
 *
 * SRS REQ-SA-12: AI models & parameters (sensitivity etc.) are also exposed
 * here as flags with a `config` payload.
 */
const PLATFORM_FLAG_CATALOGUE: { key: string; label: string; enabled: boolean; notes?: string }[] = [
  { key: 'ai_anomaly_detection',  label: 'AI Anomaly Detection',           enabled: false, notes: 'REQ-SEC-07 — detects suspicious admin behaviour (bulk downloads, geo-anomalies).' },
  { key: 'ai_smart_search',       label: 'AI Smart Search',                enabled: true,  notes: 'REQ-AI-01 — natural-language admin queries.' },
  { key: 'predictive_analytics',  label: 'Predictive Analytics',           enabled: false, notes: 'REQ-AI-02 — budget overrun + attrition prediction (tenant admin).' },
  { key: 'auto_translation',      label: 'Auto-Translation on Context Swap', enabled: false, notes: 'REQ-AI-04 — translate dashboard to super admin\'s preferred language.' },
  { key: 'ghost_tenant_insights', label: 'Ghost Tenant Detection',         enabled: false, notes: 'REQ-AI-03 — flags tenants created but never used.' },
  { key: 'sso_saml',              label: 'SSO (SAML 2.0 / OIDC)',          enabled: false, notes: 'REQ-SEC-02 — SSO for tenant_admin corporate IdP.' },
  { key: 'mfa_required',          label: 'Multi-Factor Auth (MFA)',        enabled: true,  notes: 'REQ-SEC-01 — MFA for admin roles.' },
  { key: 'concurrent_session_limit', label: 'Concurrent Session Limit',    enabled: true,  notes: 'REQ-SEC-09 — max 2 simultaneous admin sessions.' },
];

async function seedDefaults(tenantId: string): Promise<void> {
  const existing = await getPlatformDb().featureFlag.findMany({
    where: { tenantId },
    select: { key: true },
  });
  const existingKeys = new Set(existing.map((f) => f.key));
  const missing = PLATFORM_FLAG_CATALOGUE.filter((f) => !existingKeys.has(f.key));
  if (missing.length === 0) return;
  await getPlatformDb().featureFlag.createMany({
    data: missing.map((f) => ({
      tenantId,
      key: f.key,
      label: f.label,
      enabled: f.enabled,
      source: 'platform_default',
      notes: f.notes,
    })),
    skipDuplicates: true,
  });
}

export async function GET(request: Request) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: corsHeaders() });

    const role = (decoded.role as string) || 'employee';
    if (role !== 'super_admin') {
      return NextResponse.json({ error: 'Only super admins can manage feature flags' }, { status: 403, headers: corsHeaders() });
    }

    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');
    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId query parameter is required' }, { status: 400, headers: corsHeaders() });
    }

    // Ensure the FeatureFlag table exists (idempotent + cached).
    await ensureSchemaSynced();

    try {
      await seedDefaults(tenantId);
    } catch (seedErr) {
      console.error('[feature-flags] seedDefaults failed (non-fatal):', seedErr);
    }

    const flags = await getPlatformDb().featureFlag.findMany({
      where: { tenantId },
      orderBy: [{ source: 'asc' }, { key: 'asc' }],
    });

    return NextResponse.json({ flags, catalogue: PLATFORM_FLAG_CATALOGUE }, { headers: corsHeaders() });
  } catch (error) {
    console.error('[feature-flags] GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}

export async function POST(request: Request) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: corsHeaders() });

    const role = (decoded.role as string) || 'employee';
    if (role !== 'super_admin') {
      return NextResponse.json({ error: 'Only super admins can manage feature flags' }, { status: 403, headers: corsHeaders() });
    }

    const body = await request.json();
    const { tenantId, key, label, enabled, config, notes } = body;
    if (!tenantId || !key) {
      return NextResponse.json({ error: 'tenantId and key are required' }, { status: 400, headers: corsHeaders() });
    }
    if (typeof enabled !== 'boolean') {
      return NextResponse.json({ error: 'enabled must be boolean' }, { status: 400, headers: corsHeaders() });
    }

    const catalogueEntry = PLATFORM_FLAG_CATALOGUE.find((f) => f.key === key);
    const resolvedLabel = label || catalogueEntry?.label || key;

    const flag = await getPlatformDb().featureFlag.upsert({
      where: { tenantId_key: { tenantId, key } },
      create: {
        tenantId,
        key,
        label: resolvedLabel,
        enabled,
        config: config ? (typeof config === 'string' ? config : JSON.stringify(config)) : null,
        notes: notes ?? catalogueEntry?.notes ?? null,
        source: 'override',
      },
      update: {
        enabled,
        label: resolvedLabel,
        config: config !== undefined ? (typeof config === 'string' ? config : JSON.stringify(config)) : undefined,
        notes: notes !== undefined ? notes : undefined,
        source: 'override',
      },
    });

    try {
      await db.auditLog.create({
        data: {
          userId: decoded.userId as string,
          action: 'FEATURE_FLAG_UPDATE',
          module: 'feature_flags',
          details: `Set flag "${key}" = ${enabled} for tenant ${tenantId}.`,
          ip: request.headers.get('x-forwarded-for') || null,
          userAgent: request.headers.get('user-agent') || null,
        },
      });
    } catch (logErr) {
      console.error('[feature-flags] audit log failed (non-fatal):', logErr);
    }

    return NextResponse.json({ flag }, { headers: corsHeaders() });
  } catch (error) {
    console.error('[feature-flags] POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}
