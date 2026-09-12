import { NextRequest, NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';
import { withSchemaSync } from '@/lib/schema-sync';

/** GET /api/collaboration/settings */
export async function GET(request: NextRequest) {
  const db = await getDb(request);
  const platformDb = getPlatformDb();
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    await withSchemaSync(() => Promise.resolve());
    // Get tenant ID from decoded token
    const user = await platformDb.user.findUnique({ where: { id: decoded.userId as string } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const employee = await db.employee.findFirst({ where: { userId: decoded.userId } });
    if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });

    // Find tenant through employee's company
    const tenantSlug = request.headers.get('x-tenant-slug');
    let tenantId: string | null = null;
    if (tenantSlug) {
      const tenant = await platformDb.tenant.findUnique({ where: { slug: tenantSlug } });
      if (tenant) tenantId = tenant.id;
    }
    if (!tenantId && user.tenantId) {
      tenantId = user.tenantId;
    }

    if (!tenantId) {
      // Return defaults if no tenant found
      return NextResponse.json({
        settings: {
          encryptionEnabled: true,
          fileSharingLimitMB: 25,
          messageRetentionDays: 90,
          calendarSyncEnabled: true,
          calendarSyncProvider: 'google',
          emailIntegrationEnabled: false,
          emailProvider: 'smtp',
          autoDeleteMessages: false,
          maxCallDurationMin: 60,
          allowExternalSharing: true,
          watermarkEnabled: false,
        },
      });
    }

    let settings = await db.collaborationSettings.findUnique({ where: { tenantId } });

    if (!settings) {
      // Create default settings
      settings = await db.collaborationSettings.create({
        data: { tenantId, updatedBy: employee.id },
      });
    }

    return NextResponse.json({ settings: {
      ...settings,
      smtpPassword: settings.smtpPassword ? '••••••••' : null,
      resendApiKey: settings.resendApiKey ? '••••••••' : null,
    } });
  } catch (error) {
    console.error('GET collaboration settings error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** PATCH /api/collaboration/settings — Update settings */
export async function PATCH(request: NextRequest) {
  const db = await getDb(request);
  const platformDb = getPlatformDb();
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const employee = await db.employee.findFirst({ where: { userId: decoded.userId } });
    if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });

    const tenantSlug = request.headers.get('x-tenant-slug');
    let tenantId: string | null = null;
    if (tenantSlug) {
      const tenant = await platformDb.tenant.findUnique({ where: { slug: tenantSlug } });
      if (tenant) tenantId = tenant.id;
    }
    const user = await platformDb.user.findUnique({ where: { id: decoded.userId as string } });
    if (!tenantId && user?.tenantId) tenantId = user.tenantId;

    if (!tenantId) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const body = await request.json();
    const {
      encryptionEnabled,
      fileSharingLimitMB,
      messageRetentionDays,
      calendarSyncEnabled,
      calendarSyncProvider,
      emailIntegrationEnabled,
      emailProvider,
      // SMTP fields
      smtpHost, smtpPort, smtpUsername, smtpPassword, smtpEncryption,
      smtpFromName, smtpFromAddress, smtpReplyTo,
      // Resend fields
      resendApiKey, resendFromAddress,
      autoDeleteMessages,
      maxCallDurationMin,
      allowExternalSharing,
      watermarkEnabled,
    } = body;

    // Skip masked passwords
    const smtpPasswordClean = smtpPassword && smtpPassword !== '••••••••' ? smtpPassword : undefined;
    const resendApiKeyClean = resendApiKey && resendApiKey !== '••••••••' ? resendApiKey : undefined;

    const settings = await db.collaborationSettings.upsert({
      where: { tenantId },
      update: {
        ...(encryptionEnabled !== undefined && { encryptionEnabled }),
        ...(fileSharingLimitMB !== undefined && { fileSharingLimitMB }),
        ...(messageRetentionDays !== undefined && { messageRetentionDays }),
        ...(calendarSyncEnabled !== undefined && { calendarSyncEnabled }),
        ...(calendarSyncProvider && { calendarSyncProvider }),
        ...(emailIntegrationEnabled !== undefined && { emailIntegrationEnabled }),
        ...(emailProvider && { emailProvider }),
        ...(smtpHost !== undefined && { smtpHost }),
        ...(smtpPort !== undefined && { smtpPort }),
        ...(smtpUsername !== undefined && { smtpUsername }),
        ...(smtpPasswordClean && { smtpPassword: smtpPasswordClean }),
        ...(smtpEncryption !== undefined && { smtpEncryption }),
        ...(smtpFromName !== undefined && { smtpFromName }),
        ...(smtpFromAddress !== undefined && { smtpFromAddress }),
        ...(smtpReplyTo !== undefined && { smtpReplyTo }),
        ...(resendApiKeyClean && { resendApiKey: resendApiKeyClean }),
        ...(resendFromAddress !== undefined && { resendFromAddress }),
        ...(autoDeleteMessages !== undefined && { autoDeleteMessages }),
        ...(maxCallDurationMin !== undefined && { maxCallDurationMin }),
        ...(allowExternalSharing !== undefined && { allowExternalSharing }),
        ...(watermarkEnabled !== undefined && { watermarkEnabled }),
        updatedBy: employee.id,
      },
      create: {
        tenantId,
        encryptionEnabled: encryptionEnabled ?? true,
        fileSharingLimitMB: fileSharingLimitMB ?? 25,
        messageRetentionDays: messageRetentionDays ?? 90,
        calendarSyncEnabled: calendarSyncEnabled ?? true,
        calendarSyncProvider: calendarSyncProvider ?? 'google',
        emailIntegrationEnabled: emailIntegrationEnabled ?? false,
        emailProvider: emailProvider ?? 'smtp',
        smtpHost: smtpHost ?? null,
        smtpPort: smtpPort ?? 587,
        smtpUsername: smtpUsername ?? null,
        smtpPassword: smtpPasswordClean ?? null,
        smtpEncryption: smtpEncryption ?? 'tls',
        smtpFromName: smtpFromName ?? null,
        smtpFromAddress: smtpFromAddress ?? null,
        smtpReplyTo: smtpReplyTo ?? null,
        resendApiKey: resendApiKeyClean ?? null,
        resendFromAddress: resendFromAddress ?? null,
        autoDeleteMessages: autoDeleteMessages ?? false,
        maxCallDurationMin: maxCallDurationMin ?? 60,
        allowExternalSharing: allowExternalSharing ?? true,
        watermarkEnabled: watermarkEnabled ?? false,
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
    console.error('PATCH collaboration settings error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
