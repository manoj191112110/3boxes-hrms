import { NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';

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

// GET /api/rbac/modules — List all modules with permissions
export async function GET(request: Request) {
  try {
    const db = await getDb(request);
    const modules = await db.module.findMany({
      include: {
        permissions: { orderBy: { action: 'asc' } },
      },
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
    });

    const categories = [...new Set(modules.map((m) => m.category))];

    return NextResponse.json(
      { modules, totalModules: modules.length, categories },
      { headers: corsHeaders() }
    );
  } catch (error: unknown) {
    console.error('Get modules error:', error);
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    // If RBAC tables don't exist yet, return empty array instead of error
    if (errMsg.includes('does not exist') || errMsg.includes('relation')) {
      return NextResponse.json(
        { modules: [], totalModules: 0, categories: [], needsSeed: true },
        { headers: corsHeaders() }
      );
    }
    return NextResponse.json(
      { error: 'Failed to fetch modules' },
      { status: 500, headers: corsHeaders() }
    );
  }
}
