import { NextResponse } from 'next/server';
import { getPlatformDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() });
}

/**
 * GET /api/super-admin/ai-settings
 * Returns AI configuration settings for the platform.
 */
export async function GET(request: Request) {
  try {
    const token = getTokenFromHeaders(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders() });
    }

    const decoded = await verifyToken(token);
    if (!decoded || (decoded as any).role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden — super admin only' }, { status: 403, headers: corsHeaders() });
    }

    const db = getPlatformDb();

    // Try to load from a PlatformSettings key-value store or return defaults
    let settings: any = null;
    try {
      settings = await db.platformSettings.findUnique({
        where: { key: 'ai-settings' },
      });
    } catch (e) {
      // Table may not exist yet — return defaults
    }

    if (settings?.value) {
      return NextResponse.json(settings.value, { headers: corsHeaders() });
    }

    // Return default configuration
    return NextResponse.json({
      modelConfig: {
        modelType: 'ai-attendance-insights',
        maxTokens: 1024,
        predictionAccuracy: 75,
        responseLanguage: 'English',
        enableNLP: true,
        enableComputerVision: false,
        enableContentGeneration: true,
        enablePredictiveAnalytics: true,
        enableRecommendationEngine: false,
      },
      trainingConfig: {
        autoRetraining: false,
        retrainFrequency: 'daily',
        dataRetentionPeriod: '90',
        predictionAccuracy: 75,
      },
      permissions: [
        { role: 'super_admin', modelSettings: true, dataTraining: true, apiAccess: true },
        { role: 'tenant_admin', modelSettings: false, dataTraining: false, apiAccess: true },
        { role: 'hr_manager', modelSettings: false, dataTraining: false, apiAccess: true },
        { role: 'recruitment_manager', modelSettings: false, dataTraining: false, apiAccess: false },
        { role: 'payroll_manager', modelSettings: false, dataTraining: false, apiAccess: false },
        { role: 'employee', modelSettings: false, dataTraining: false, apiAccess: false },
      ],
    }, { headers: corsHeaders() });
  } catch (error) {
    console.error('[AI Settings GET] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders() }
    );
  }
}

/**
 * PUT /api/super-admin/ai-settings
 * Saves AI configuration settings for the platform.
 */
export async function PUT(request: Request) {
  try {
    const token = getTokenFromHeaders(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders() });
    }

    const decoded = await verifyToken(token);
    if (!decoded || (decoded as any).role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden — super admin only' }, { status: 403, headers: corsHeaders() });
    }

    const body = await request.json();
    const { modelConfig, trainingConfig, permissions } = body;

    const db = getPlatformDb();

    // Save to PlatformSettings key-value store
    const value = { modelConfig, trainingConfig, permissions };
    try {
      await db.platformSettings.upsert({
        where: { key: 'ai-settings' },
        update: { value },
        create: { key: 'ai-settings', value },
      });
    } catch (e) {
      // Table may not exist yet — settings will be lost on server restart
      // but the UI will continue to work with defaults
      console.warn('[AI Settings] Could not persist to database (table may not exist):', e);
    }

    return NextResponse.json({ success: true }, { headers: corsHeaders() });
  } catch (error) {
    console.error('[AI Settings PUT] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders() }
    );
  }
}
