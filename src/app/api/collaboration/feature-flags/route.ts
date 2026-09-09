import { NextRequest, NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';

/**
 * GET /api/collaboration/feature-flags
 * Returns collaboration feature flags for the current tenant.
 *
 * REQ-6.1: Feature Toggles — Enable/Disable Native Calling or AI Translation
 * features for specific tenants to manage server load.
 */
export async function GET(request: NextRequest) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const flags = await db.collaborationFeatureFlag.findMany({
      where: { tenantId: decoded.tenantId },
    });

    // Ensure all default flags exist
    const defaultFlags = [
      'native_calling', 'ai_translation', 'file_preview', 'webrtc_group_calls',
      'sentiment_analysis', 'chat_summarization', 'document_intelligence',
      'dlp_scan', 'watermarking', 'sso_jit',
    ];
    const existingKeys = new Set(flags.map((f) => f.featureKey));
    const missing = defaultFlags.filter((k) => !existingKeys.has(k));

    if (missing.length > 0) {
      await db.collaborationFeatureFlag.createMany({
        data: missing.map((k) => ({ tenantId: decoded.tenantId, featureKey: k, isEnabled: true })),
        skipDuplicates: true,
      });
      const refreshed = await db.collaborationFeatureFlag.findMany({
        where: { tenantId: decoded.tenantId },
      });
      return NextResponse.json({ flags: refreshed });
    }

    return NextResponse.json({ flags });
  } catch (error) {
    console.error('GET feature flags error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/collaboration/feature-flags
 * Body: { featureKey, isEnabled, maxCallDurationMin?, maxFileUploadMB?, maxChatAttachments?, notes? }
 *
 * Super Admin / Tenant Admin only.
 */
export async function PATCH(request: NextRequest) {
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
    const { featureKey, isEnabled, maxCallDurationMin, maxFileUploadMB, maxChatAttachments, notes } = body;
    if (!featureKey) return NextResponse.json({ error: 'featureKey is required' }, { status: 400 });

    const flag = await db.collaborationFeatureFlag.upsert({
      where: { tenantId_featureKey: { tenantId: decoded.tenantId, featureKey } },
      create: {
        tenantId: decoded.tenantId,
        featureKey,
        isEnabled: isEnabled ?? true,
        maxCallDurationMin: maxCallDurationMin ?? 60,
        maxFileUploadMB: maxFileUploadMB ?? 100,
        maxChatAttachments: maxChatAttachments ?? 10,
        configuredBy: decoded.userId,
        notes,
      },
      update: {
        isEnabled,
        maxCallDurationMin,
        maxFileUploadMB,
        maxChatAttachments,
        configuredBy: decoded.userId,
        notes,
      },
    });

    return NextResponse.json({ flag });
  } catch (error) {
    console.error('PATCH feature flags error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
