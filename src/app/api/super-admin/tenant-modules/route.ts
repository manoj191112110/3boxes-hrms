import { NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';
import { ensureSchemaSynced } from '@/lib/schema-sync';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() });
}

/**
 * Platform-wide module catalogue. Every HRMS module that can be toggled
 * per tenant. When a tenant is queried for the first time, all modules
 * are auto-seeded as FeatureFlag rows with key prefix `module_`.
 *
 * The `enabled` field here is the PLATFORM DEFAULT — individual tenants
 * can override via the super admin UI.
 */
const MODULE_CATALOGUE: { key: string; label: string; description: string; enabled: boolean; group: string }[] = [
  // Administration
  { key: 'super-admin',  label: 'Super Admin',         description: 'Platform management & oversight',                  enabled: true,  group: 'Administration' },
  { key: 'tenant',       label: 'Tenant Management',   description: 'Tenant & multi-company management',               enabled: true,  group: 'Administration' },

  // Organization
  { key: 'company',      label: 'Company',             description: 'Company structure & configuration',               enabled: true,  group: 'Organization' },
  { key: 'employee',     label: 'Employee',            description: 'Employee lifecycle management',                   enabled: true,  group: 'Organization' },

  // Time & Leave
  { key: 'leave',        label: 'Leave',               description: 'Leave management & tracking',                     enabled: true,  group: 'Time & Leave' },
  { key: 'attendance',   label: 'Attendance',          description: 'Attendance, time tracking & compliance',           enabled: true,  group: 'Time & Leave' },

  // Compensation
  { key: 'payroll',      label: 'Payroll',             description: 'Compensation, compliance & processing',           enabled: true,  group: 'Compensation' },

  // Talent
  { key: 'recruitment',  label: 'Recruitment',         description: 'Talent acquisition & hiring pipeline',            enabled: true,  group: 'Talent' },
  { key: 'onboarding',   label: 'Onboarding',          description: 'New hire onboarding & induction',                 enabled: true,  group: 'Talent' },
  { key: 'preboarding',  label: 'Preboarding',         description: 'Pre-hire preparation & documentation',            enabled: true,  group: 'Talent' },
  { key: 'appraisal',    label: 'Appraisal & Performance', description: 'Performance reviews & growth tracking',        enabled: true,  group: 'Talent' },

  // Operations
  { key: 'project',      label: 'Project Management',  description: 'Projects, tasks & time tracking',                enabled: true,  group: 'Operations' },
  { key: 'travel-expense', label: 'Travel & Expense',  description: 'Travel requests & expense claims',               enabled: true,  group: 'Operations' },
  { key: 'assets',       label: 'Assets & IT',         description: 'Asset management & IT administration',            enabled: true,  group: 'Operations' },

  // Business
  { key: 'accounts',     label: 'Accounts & Finance',  description: 'Accounting, invoicing & financial operations',    enabled: true,  group: 'Business' },
  { key: 'crm',          label: 'CRM & Sales',         description: 'Customer relationships & sales pipeline',          enabled: true,  group: 'Business' },
  { key: 'external',     label: 'External Relations',  description: 'Clients, vendors & procurement',                  enabled: true,  group: 'Business' },
  { key: 'marketplace',  label: 'Marketplace & Wellness', description: 'Benefits, perks & financial wellness',         enabled: true,  group: 'Business' },

  // Support & Intelligence
  { key: 'support',      label: 'Support & AI',        description: 'Helpdesk, AI assistant & grievance handling',      enabled: true,  group: 'Support & Intelligence' },
  { key: 'collaboration', label: 'Collaboration Hub',  description: 'Communication, chat & file sharing',              enabled: true,  group: 'Support & Intelligence' },
  { key: 'knowledge',    label: 'Knowledge Base',      description: 'Documentation & knowledge management',             enabled: true,  group: 'Support & Intelligence' },

  // Governance
  { key: 'governance',   label: 'Governance',          description: 'Workflows, analytics & system configuration',     enabled: true,  group: 'Governance' },
];

/**
 * Convert a module key to a FeatureFlag key with `module_` prefix.
 */
function toFlagKey(moduleKey: string): string {
  return `module_${moduleKey}`;
}

/**
 * Convert a FeatureFlag key back to a module key (strip `module_` prefix).
 */
function fromFlagKey(flagKey: string): string | null {
  if (flagKey.startsWith('module_')) return flagKey.slice(7);
  return null;
}

/**
 * Per-tenant defaults — modules that should be DISABLED for specific tenants
 * when they are first seeded. This replaces the old TENANT_MODULE_WHITELIST
 * approach: instead of listing what's enabled, we list what's disabled by default.
 */
const TENANT_DEFAULTS_DISABLED: Record<string, string[]> = {
  'marqaitechgroup': [
    'appraisal', 'travel-expense', 'assets', 'accounts', 'crm', 'external', 'marketplace', 'knowledge',
  ],
};

/**
 * Auto-seed module flags for a tenant that hasn't been set up yet.
 */
async function seedModuleFlags(tenantId: string, tenantSlug?: string): Promise<void> {
  const existing = await getPlatformDb().featureFlag.findMany({
    where: { tenantId, key: { startsWith: 'module_' } },
    select: { key: true },
  });
  const existingKeys = new Set(existing.map((f) => f.key));

  // Determine which modules are disabled by default for this tenant
  const disabledModules = tenantSlug ? (TENANT_DEFAULTS_DISABLED[tenantSlug] || []) : [];

  const missing = MODULE_CATALOGUE.filter((m) => !existingKeys.has(toFlagKey(m.key)));
  if (missing.length === 0) return;

  await getPlatformDb().featureFlag.createMany({
    data: missing.map((m) => ({
      tenantId,
      key: toFlagKey(m.key),
      label: m.label,
      enabled: disabledModules.includes(m.key) ? false : m.enabled,
      source: 'platform_default',
      notes: m.description,
    })),
    skipDuplicates: true,
  });
}

export async function GET(request: Request) {
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: corsHeaders() });

    const role = (decoded.role as string) || 'employee';
    if (role !== 'super_admin') {
      return NextResponse.json({ error: 'Only super admins can manage tenant modules' }, { status: 403, headers: corsHeaders() });
    }

    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');
    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId query parameter is required' }, { status: 400, headers: corsHeaders() });
    }

    await ensureSchemaSynced();

    // Get tenant slug for defaults
    const tenant = await getPlatformDb().tenant.findUnique({
      where: { id: tenantId },
      select: { slug: true },
    });

    try {
      await seedModuleFlags(tenantId, tenant?.slug);
    } catch (seedErr) {
      console.error('[tenant-modules] seedModuleFlags failed (non-fatal):', seedErr);
    }

    // Fetch all module flags for this tenant
    const flags = await getPlatformDb().featureFlag.findMany({
      where: { tenantId, key: { startsWith: 'module_' } },
      orderBy: [{ key: 'asc' }],
    });

    // Map flags back to module info
    const modules = flags.map((f) => {
      const moduleKey = fromFlagKey(f.key) || f.key;
      const catalogueEntry = MODULE_CATALOGUE.find((m) => m.key === moduleKey);
      return {
        id: f.id,
        key: moduleKey,
        label: f.label,
        description: f.notes || catalogueEntry?.description || '',
        enabled: f.enabled,
        source: f.source,
        group: catalogueEntry?.group || 'Other',
        updatedAt: f.updatedAt,
      };
    });

    return NextResponse.json({ modules, catalogue: MODULE_CATALOGUE }, { headers: corsHeaders() });
  } catch (error) {
    console.error('[tenant-modules] GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}

export async function POST(request: Request) {
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: corsHeaders() });

    const role = (decoded.role as string) || 'employee';
    if (role !== 'super_admin') {
      return NextResponse.json({ error: 'Only super admins can manage tenant modules' }, { status: 403, headers: corsHeaders() });
    }

    const body = await request.json();
    const { tenantId, moduleKey, enabled } = body;
    if (!tenantId || !moduleKey) {
      return NextResponse.json({ error: 'tenantId and moduleKey are required' }, { status: 400, headers: corsHeaders() });
    }
    if (typeof enabled !== 'boolean') {
      return NextResponse.json({ error: 'enabled must be boolean' }, { status: 400, headers: corsHeaders() });
    }

    const flagKey = toFlagKey(moduleKey);
    const catalogueEntry = MODULE_CATALOGUE.find((m) => m.key === moduleKey);
    const resolvedLabel = catalogueEntry?.label || moduleKey;

    const flag = await getPlatformDb().featureFlag.upsert({
      where: { tenantId_key: { tenantId, key: flagKey } },
      create: {
        tenantId,
        key: flagKey,
        label: resolvedLabel,
        enabled,
        notes: catalogueEntry?.description || null,
        source: 'override',
      },
      update: {
        enabled,
        label: resolvedLabel,
        source: 'override',
      },
    });

    // Audit log
    try {
      const db = await getDb(request);
      await db.auditLog.create({
        data: {
          userId: decoded.userId as string,
          action: 'TENANT_MODULE_TOGGLE',
          module: 'tenant_modules',
          details: `Set module "${moduleKey}" = ${enabled} for tenant ${tenantId}.`,
          ip: request.headers.get('x-forwarded-for') || null,
          userAgent: request.headers.get('user-agent') || null,
        },
      });
    } catch (logErr) {
      console.error('[tenant-modules] audit log failed (non-fatal):', logErr);
    }

    return NextResponse.json({
      module: {
        id: flag.id,
        key: moduleKey,
        label: flag.label,
        description: flag.notes || catalogueEntry?.description || '',
        enabled: flag.enabled,
        source: flag.source,
        group: catalogueEntry?.group || 'Other',
        updatedAt: flag.updatedAt,
      },
    }, { headers: corsHeaders() });
  } catch (error) {
    console.error('[tenant-modules] POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}
