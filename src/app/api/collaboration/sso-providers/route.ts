import { NextRequest, NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';

/**
 * GET /api/collaboration/sso-providers
 * Returns SSO providers for the current tenant.
 */
export async function GET(request: NextRequest) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const providers = await db.sSOProvider.findMany({
      where: { tenantId: decoded.tenantId },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });

    // Mask client secrets in the response
    const masked = providers.map((p) => ({
      ...p,
      clientSecret: p.clientSecret ? '********' : null,
    }));

    return NextResponse.json({ providers: masked });
  } catch (error) {
    console.error('GET SSO providers error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/collaboration/sso-providers
 * Body: { name, providerType, clientId?, clientSecret?, issuer?, metadataUrl?, redirectUri?, scopes?, jitProvisioningEnabled?, jitDefaultRole?, jitDefaultStatus?, isDefault?, logoUrl? }
 *
 * REQ-SOC-03: Federated Login (SSO)
 * REQ-SOC-04: Just-In-Time (JIT) Provisioning
 *
 * Tenant Admin / Super Admin only.
 */
export async function POST(request: NextRequest) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    if (!['super_admin', 'tenant_admin'].includes(decoded.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const {
      name, providerType, clientId, clientSecret, issuer, metadataUrl, redirectUri, scopes,
      jitProvisioningEnabled = true, jitDefaultRole = 'employee',
      jitDefaultStatus = 'pending_onboarding', isDefault = false, logoUrl,
    } = body;

    if (!name || !providerType) return NextResponse.json({ error: 'name and providerType are required' }, { status: 400 });

    // If marking as default, unset any existing default
    if (isDefault) {
      await db.sSOProvider.updateMany({
        where: { tenantId: decoded.tenantId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const provider = await db.sSOProvider.create({
      data: {
        tenantId: decoded.tenantId,
        name,
        providerType,
        clientId,
        clientSecret,
        issuer,
        metadataUrl,
        redirectUri,
        scopes: scopes ? (typeof scopes === 'string' ? scopes : JSON.stringify(scopes)) : null,
        jitProvisioningEnabled,
        jitDefaultRole,
        jitDefaultStatus,
        isDefault,
        logoUrl,
      },
    });

    return NextResponse.json({ provider: { ...provider, clientSecret: provider.clientSecret ? '********' : null } }, { status: 201 });
  } catch (error) {
    console.error('POST SSO providers error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
