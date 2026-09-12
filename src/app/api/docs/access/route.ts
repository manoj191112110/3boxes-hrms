import { NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { getTokenFromHeaders, verifyToken } from '@/lib/auth';

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

// GET: Get all access rules (super_admin only)
export async function GET(request: Request) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders() });
    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401, headers: corsHeaders() });

    const user = await db.user.findUnique({ where: { id: payload.userId as string } });
    if (!user || user.role !== 'super_admin') {
      return NextResponse.json({ error: 'Only super admins can view access rules' }, { status: 403, headers: corsHeaders() });
    }

    const { searchParams } = new URL(request.url);
    const articleId = searchParams.get('articleId');

    const where: Record<string, unknown> = {};
    if (articleId) where.articleId = articleId;

    const rules = await db.docAccessRule.findMany({
      where,
      include: {
        article: { select: { title: true, slug: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(rules, { headers: corsHeaders() });
  } catch (error) {
    console.error('Error fetching access rules:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500, headers: corsHeaders() }
    );
  }
}

// POST: Create/update access rule (super_admin only)
export async function POST(request: Request) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders() });
    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401, headers: corsHeaders() });

    const user = await db.user.findUnique({ where: { id: payload.userId as string } });
    if (!user || user.role !== 'super_admin') {
      return NextResponse.json({ error: 'Only super admins can manage access rules' }, { status: 403, headers: corsHeaders() });
    }

    const body = await request.json();
    const { articleId, role, userId: targetUserId, accessType } = body;

    if (!articleId) {
      return NextResponse.json({ error: 'articleId is required' }, { status: 400, headers: corsHeaders() });
    }

    if (!role && !targetUserId) {
      return NextResponse.json({ error: 'Either role or userId must be specified' }, { status: 400, headers: corsHeaders() });
    }

    // Check for existing rule
    const existing = await db.docAccessRule.findFirst({
      where: {
        articleId,
        ...(role ? { role } : {}),
        ...(targetUserId ? { userId: targetUserId } : {}),
      },
    });

    if (existing) {
      // Update existing rule
      const updated = await db.docAccessRule.update({
        where: { id: existing.id },
        data: {
          accessType: accessType || existing.accessType,
          grantedBy: user.id,
        },
      });
      return NextResponse.json(updated, { headers: corsHeaders() });
    }

    // Create new rule
    const rule = await db.docAccessRule.create({
      data: {
        articleId,
        role: role || null,
        userId: targetUserId || null,
        accessType: accessType || 'read',
        grantedBy: user.id,
      },
    });

    return NextResponse.json(rule, { status: 201, headers: corsHeaders() });
  } catch (error) {
    console.error('Error creating access rule:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500, headers: corsHeaders() }
    );
  }
}

// DELETE: Remove access rule (super_admin only)
export async function DELETE(request: Request) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders() });
    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401, headers: corsHeaders() });

    const user = await db.user.findUnique({ where: { id: payload.userId as string } });
    if (!user || user.role !== 'super_admin') {
      return NextResponse.json({ error: 'Only super admins can delete access rules' }, { status: 403, headers: corsHeaders() });
    }

    const { searchParams } = new URL(request.url);
    const ruleId = searchParams.get('id');
    const articleId = searchParams.get('articleId');
    const role = searchParams.get('role');
    const targetUserId = searchParams.get('userId');

    if (ruleId) {
      await db.docAccessRule.delete({ where: { id: ruleId } });
    } else if (articleId) {
      const where: Record<string, unknown> = { articleId };
      if (role) where.role = role;
      if (targetUserId) where.userId = targetUserId;
      await db.docAccessRule.deleteMany({ where });
    } else {
      return NextResponse.json({ error: 'Provide either id or articleId with optional role/userId' }, { status: 400, headers: corsHeaders() });
    }

    return NextResponse.json({ message: 'Access rule(s) deleted successfully' }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Error deleting access rule:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500, headers: corsHeaders() }
    );
  }
}
