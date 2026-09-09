import { NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { createToken, verifyToken } from '@/lib/auth';
import { getServerHiddenSlugs, LIVE_HIDDEN_SLUGS, DEMO_HIDDEN_SLUGS } from '@/lib/tenant-filter';
import { isLiveMode } from '@/lib/site-mode';

// ─── Hidden Tenant Slugs (GOLDEN RULE — FOOLPROOF) ──────────────────
// Uses tenant-filter.ts as PRIMARY (direct hostname check), then
// isLiveMode() as SECONDARY. A slug is hidden if EITHER says so.
function getHiddenSlugsForRequest(request: Request): string[] {
  const foolproof = getServerHiddenSlugs(request);
  const siteMode = isLiveMode(request) ? LIVE_HIDDEN_SLUGS : DEMO_HIDDEN_SLUGS;
  return [...new Set([...foolproof, ...siteMode])];
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() });
}

export async function POST(request: Request) {
  const db = getPlatformDb();
  try {
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders() });
    }

    // Verify the current user is super_admin
    const decoded = await verifyToken(token);
    if (!decoded || (decoded as any).role !== 'super_admin') {
      return NextResponse.json(
        { error: 'Only super admin can switch tenants' },
        { status: 403, headers: corsHeaders() }
      );
    }

    const body = await request.json();
    const { tenantId } = body;

    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId is required' }, { status: 400, headers: corsHeaders() });
    }

    // Find the tenant_admin user for this tenant
    const targetUser = await db.user.findFirst({
      where: {
        tenantId,
        role: 'tenant_admin',
        status: 'active',
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        avatar: true,
        tenantId: true,
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
            plan: true,
            currency: true,
            timezone: true,
            logo: true,
          },
        },
      },
    });

    if (!targetUser) {
      return NextResponse.json(
        { error: 'No active admin user found for this tenant' },
        { status: 404, headers: corsHeaders() }
      );
    }

    // ─── GOLDEN RULE: Block switching to hidden tenants ───
    const hiddenSlugs = getHiddenSlugsForRequest(request);
    if (targetUser.tenant?.slug && hiddenSlugs.includes(targetUser.tenant.slug)) {
      return NextResponse.json(
        { error: 'Cannot switch to this tenant' },
        { status: 403, headers: corsHeaders() }
      );
    }

    // Create a new token for the target user
    const newToken = await createToken({
      userId: targetUser.id,
      email: targetUser.email,
      role: targetUser.role,
      tenantId: targetUser.tenantId,
    });

    return NextResponse.json({
      token: newToken,
      user: targetUser,
      switchedFrom: (decoded as any).role,
      switchedTenant: tenantId,
    }, { headers: corsHeaders() });
  } catch (error: any) {
    console.error('[Switch Tenant] Error:', error);
    return NextResponse.json(
      { error: 'Failed to switch tenant', details: error.message },
      { status: 500, headers: corsHeaders() }
    );
  }
}
