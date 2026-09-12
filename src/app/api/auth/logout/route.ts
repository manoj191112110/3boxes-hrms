import { NextResponse } from 'next/server';
import { getPlatformDb, getDbForTenant, getDbForTenantById } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';

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
  try {
    const token = getTokenFromHeaders(request);
    if (!token) {
      return NextResponse.json(
        { error: 'No token provided' },
        { status: 401, headers: corsHeaders() }
      );
    }

    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401, headers: corsHeaders() }
      );
    }

    const userId = decoded.userId as string;
    const tenantId = decoded.tenantId as string | undefined;
    const tenantSlug = request.headers.get('x-tenant-slug') || '';

    // ─── Two-phase user lookup for logout ───
    // Same pattern as login/me: find the user in the correct DB
    // so we can update lastLogout and create loginActivity in the right place.
    const platformDb = getPlatformDb();
    let db = platformDb;

    // Try platform DB first
    const platformUser = await platformDb.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!platformUser) {
      // Try tenant DB
      try {
        let tenantDb: any = null;
        if (tenantSlug) {
          tenantDb = await getDbForTenant(tenantSlug);
        } else if (tenantId) {
          tenantDb = await getDbForTenantById(tenantId);
        }
        if (tenantDb) {
          const tenantUser = await tenantDb.user.findUnique({
            where: { id: userId },
            select: { id: true },
          });
          if (tenantUser) {
            db = tenantDb;
          }
        }
      } catch (e) {
        console.error('[Logout] Tenant DB lookup failed (non-fatal):', e);
      }
    }

    try {
      await db.user.update({
        where: { id: userId },
        data: { lastLogout: new Date() },
      });
    } catch (e) {
      console.error('[Logout] Failed to update lastLogout (non-fatal):', e);
    }

    try {
      await db.loginActivity.create({
        data: {
          userId,
          action: 'logout',
          ip: request.headers.get('x-forwarded-for') || null,
          userAgent: request.headers.get('user-agent') || null,
        },
      });
    } catch (e) {
      console.error('[Logout] Failed to create loginActivity (non-fatal):', e);
    }

    return NextResponse.json(
      { message: 'Logged out successfully' },
      { headers: corsHeaders() }
    );
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders() }
    );
  }
}
