import { NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';
import { ensureSchemaSynced, withSchemaSync } from '@/lib/schema-sync';

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

export async function GET(request: Request) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) {
      return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    }
    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: corsHeaders() });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const category = searchParams.get('category');
    const isActive = searchParams.get('isActive');

    const where: Record<string, unknown> = {};
    if (type) where.type = type;
    if (category) where.category = category;
    if (isActive !== null && isActive !== undefined && isActive !== '') where.isActive = isActive === 'true';

    // Ensure the AIConfig + AIPromptLog tables exist (P0 fix for missing model)
    await ensureSchemaSynced();

    const [configs, promptLogs, configCount, logCount] = await Promise.all([
      withSchemaSync(() =>
        db.aIConfig.findMany({
          where,
          orderBy: { updatedAt: 'desc' },
        })
      ),
      withSchemaSync(() =>
        db.aIPromptLog.findMany({
          take: 20,
          orderBy: { createdAt: 'desc' },
        })
      ),
      withSchemaSync(() => db.aIConfig.count({ where })),
      withSchemaSync(() => db.aIPromptLog.count()),
    ]);

    // Compute monitoring stats
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentLogs = await withSchemaSync(() =>
      db.aIPromptLog.findMany({
        where: { createdAt: { gte: last24h } },
      })
    );

    const totalRequests24h = recentLogs.length;
    const avgLatency = recentLogs.length > 0
      ? Math.round(recentLogs.reduce((sum: number, l: { latencyMs: number }) => sum + l.latencyMs, 0) / recentLogs.length)
      : 0;
    const totalTokens24h = recentLogs.reduce((sum: number, l: { tokensUsed: number }) => sum + l.tokensUsed, 0);
    const errorLogs = recentLogs.filter((l: { status: string }) => l.status === 'error');
    const errorRate = totalRequests24h > 0 ? Math.round((errorLogs.length / totalRequests24h) * 100) : 0;
    const activeModelCount = new Set(configs.filter((c: { isActive: boolean }) => c.isActive).map((c: { model: string }) => c.model)).size;

    // Usage by category
    const categoryUsage: Record<string, number> = {};
    recentLogs.forEach((l: { category: string }) => {
      categoryUsage[l.category] = (categoryUsage[l.category] || 0) + 1;
    });

    // Recent errors
    const recentErrors = errorLogs.slice(0, 10);

    return NextResponse.json({
      configs,
      promptLogs,
      stats: {
        totalConfigs: configCount,
        totalLogs: logCount,
        totalRequests24h,
        avgLatency,
        totalTokens24h,
        errorRate,
        activeModelCount,
        categoryUsage,
        recentErrors,
      },
    }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Get ai-admin error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}

export async function POST(request: Request) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) {
      return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    }
    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: corsHeaders() });
    }

    const body = await request.json();
    const { name, type, category, content, model, temperature, maxTokens, isActive, version, description } = body;

    if (!name || !type || !category || !content) {
      return NextResponse.json(
        { error: 'Missing required fields: name, type, category, content' },
        { status: 400, headers: corsHeaders() }
      );
    }

    await ensureSchemaSynced();

    const config = await withSchemaSync(() =>
      db.aIConfig.create({
        data: {
          name,
          type,
          category,
          content,
          model: model || 'gpt-4',
          temperature: temperature !== undefined ? parseFloat(temperature) : 0.7,
          maxTokens: maxTokens !== undefined ? parseInt(maxTokens) : 2048,
          isActive: isActive !== undefined ? isActive : true,
          version: version || '1.0',
          description: description || null,
        },
      })
    );

    await db.auditLog.create({
      data: {
        userId: decoded.userId as string,
        action: 'CREATE_AI_CONFIG',
        module: 'ai-admin',
        details: `Created AI config: ${name} (${type}/${category})`,
      },
    });

    return NextResponse.json({ config }, { status: 201, headers: corsHeaders() });
  } catch (error) {
    console.error('Create ai-admin error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}
