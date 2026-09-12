import { NextRequest, NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';
import { verifySmtpConnection } from '@/lib/email-sender';

/**
 * GET /api/settings/smtp
 * Returns SMTP configuration for the current tenant (password masked).
 */
export async function GET(request: NextRequest) {
  const db = await getDb(request);
  const platformDb = getPlatformDb();
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const user = await platformDb.user.findUnique({ where: { id: decoded.userId as string } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    // Resolve tenant
    const tenantSlug = request.headers.get('x-tenant-slug');
    let tenantId: string | null = null;
    if (tenantSlug) {
      const tenant = await platformDb.tenant.findUnique({ where: { slug: tenantSlug } });
      if (tenant) tenantId = tenant.id;
    }
    if (!tenantId && user.tenantId) tenantId = user.tenantId;
    if (!tenantId) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    let settings = await db.collaborationSettings.findUnique({ where: { tenantId } });
    if (!settings) {
      settings = await db.collaborationSettings.create({ data: { tenantId } });
    }

    // Mask password for security
    const masked = {
      ...settings,
      smtpPassword: settings.smtpPassword ? '••••••••' : null,
      resendApiKey: settings.resendApiKey ? '••••••••' : null,
    };

    return NextResponse.json({ settings: masked });
  } catch (error) {
    console.error('GET smtp settings error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/settings/smtp
 * Update SMTP configuration.
 * Body: { emailProvider, smtpHost, smtpPort, smtpUsername, smtpPassword, smtpEncryption, smtpFromName, smtpFromAddress, smtpReplyTo, resendApiKey, resendFromAddress, emailIntegrationEnabled }
 */
export async function PATCH(request: NextRequest) {
  const db = await getDb(request);
  const platformDb = getPlatformDb();
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const employee = await db.employee.findFirst({ where: { userId: decoded.userId as string } });
    if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });

    const user = await platformDb.user.findUnique({ where: { id: decoded.userId as string } });
    const tenantSlug = request.headers.get('x-tenant-slug');
    let tenantId: string | null = null;
    if (tenantSlug) {
      const tenant = await platformDb.tenant.findUnique({ where: { slug: tenantSlug } });
      if (tenant) tenantId = tenant.id;
    }
    if (!tenantId && user?.tenantId) tenantId = user.tenantId;
    if (!tenantId) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const body = await request.json();
    const {
      emailProvider,
      emailIntegrationEnabled,
      smtpHost,
      smtpPort,
      smtpUsername,
      smtpPassword,
      smtpEncryption,
      smtpFromName,
      smtpFromAddress,
      smtpReplyTo,
      resendApiKey,
      resendFromAddress,
    } = body;

    // Build update data — skip password if it's the masked value
    const updateData: Record<string, unknown> = { updatedBy: employee.id };
    if (emailProvider !== undefined) updateData.emailProvider = emailProvider;
    if (emailIntegrationEnabled !== undefined) updateData.emailIntegrationEnabled = emailIntegrationEnabled;
    if (smtpHost !== undefined) updateData.smtpHost = smtpHost;
    if (smtpPort !== undefined) updateData.smtpPort = smtpPort;
    if (smtpUsername !== undefined) updateData.smtpUsername = smtpUsername;
    if (smtpPassword && smtpPassword !== '••••••••') updateData.smtpPassword = smtpPassword;
    if (smtpEncryption !== undefined) updateData.smtpEncryption = smtpEncryption;
    if (smtpFromName !== undefined) updateData.smtpFromName = smtpFromName;
    if (smtpFromAddress !== undefined) updateData.smtpFromAddress = smtpFromAddress;
    if (smtpReplyTo !== undefined) updateData.smtpReplyTo = smtpReplyTo;
    if (resendApiKey && resendApiKey !== '••••••••') updateData.resendApiKey = resendApiKey;
    if (resendFromAddress !== undefined) updateData.resendFromAddress = resendFromAddress;

    const settings = await db.collaborationSettings.upsert({
      where: { tenantId },
      update: updateData,
      create: {
        tenantId,
        ...updateData,
        updatedBy: employee.id,
      },
    });

    // Mask passwords in response
    const masked = {
      ...settings,
      smtpPassword: settings.smtpPassword ? '••••••••' : null,
      resendApiKey: settings.resendApiKey ? '••••••••' : null,
    };

    return NextResponse.json({ settings: masked });
  } catch (error) {
    console.error('PATCH smtp settings error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/settings/smtp
 * Test/verify SMTP connection.
 * Body: { smtpHost, smtpPort, smtpUsername, smtpPassword, smtpEncryption }
 */
export async function POST(request: NextRequest) {
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const body = await request.json();
    const { smtpHost, smtpPort, smtpUsername, smtpPassword, smtpEncryption } = body;

    if (!smtpHost || !smtpUsername || !smtpPassword) {
      return NextResponse.json({ error: 'SMTP host, username, and password are required' }, { status: 400 });
    }

    const result = await verifySmtpConnection({
      host: smtpHost,
      port: smtpPort || 587,
      username: smtpUsername,
      password: smtpPassword,
      encryption: smtpEncryption || 'tls',
    });

    // If verification succeeds, update the verified timestamp in DB
    if (result.success) {
      const db = await getDb(request);
      const platformDb = getPlatformDb();
      const user = await platformDb.user.findUnique({ where: { id: decoded.userId as string } });
      const tenantSlug = request.headers.get('x-tenant-slug');
      let tenantId: string | null = null;
      if (tenantSlug) {
        const tenant = await platformDb.tenant.findUnique({ where: { slug: tenantSlug } });
        if (tenant) tenantId = tenant.id;
      }
      if (!tenantId && user?.tenantId) tenantId = user.tenantId;
      if (tenantId) {
        await db.collaborationSettings.upsert({
          where: { tenantId },
          update: { smtpVerifiedAt: new Date(), smtpVerifyError: null },
          create: { tenantId, smtpVerifiedAt: new Date() },
        });
      }
    } else {
      // Save the error
      const db = await getDb(request);
      const platformDb = getPlatformDb();
      const user = await platformDb.user.findUnique({ where: { id: decoded.userId as string } });
      const tenantSlug = request.headers.get('x-tenant-slug');
      let tenantId: string | null = null;
      if (tenantSlug) {
        const tenant = await platformDb.tenant.findUnique({ where: { slug: tenantSlug } });
        if (tenant) tenantId = tenant.id;
      }
      if (!tenantId && user?.tenantId) tenantId = user.tenantId;
      if (tenantId) {
        await db.collaborationSettings.upsert({
          where: { tenantId },
          update: { smtpVerifyError: result.error?.substring(0, 500) },
          create: { tenantId, smtpVerifyError: result.error?.substring(0, 500) },
        });
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('POST smtp verify error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
