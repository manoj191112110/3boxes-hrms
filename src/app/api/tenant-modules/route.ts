import { NextResponse } from 'next/server';
import { getPlatformDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';
import { ensureSchemaSynced } from '@/lib/schema-sync';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() });
}

/**
 * Public tenant-modules API — any authenticated user can read
 * which modules are enabled for their own tenant. This is used
 * by the Sidebar and Modules page to filter navigation.
 *
 * Only the super-admin API (/api/super-admin/tenant-modules)
 * can write (toggle modules). This endpoint is read-only.
 */
export async function GET(request: Request) {
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: corsHeaders() });

    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');
    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId query parameter is required' }, { status: 400, headers: corsHeaders() });
    }

    // Any authenticated user can read module flags for their own tenant
    // (they can only see which modules are enabled, not toggle them)

    await ensureSchemaSynced();

    const flags = await getPlatformDb().featureFlag.findMany({
      where: { tenantId, key: { startsWith: 'module_' } },
      select: { key: true, enabled: true },
      orderBy: [{ key: 'asc' }],
    });

    // Map to simple module key → enabled
    const modules = flags.map((f) => ({
      key: f.key.startsWith('module_') ? f.key.slice(7) : f.key,
      enabled: f.enabled,
    }));

    return NextResponse.json({ modules }, { headers: corsHeaders() });
  } catch (error) {
    console.error('[tenant-modules/public] GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}
