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

// GET: Get single article (check access, increment viewCount)
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const db = await getDb(request);
  try {
    const { id } = await params;
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders() });
    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401, headers: corsHeaders() });

    const user = await db.user.findUnique({ where: { id: payload.userId as string } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404, headers: corsHeaders() });

    const article = await db.docArticle.findUnique({
      where: { id },
      include: {
        category: true,
        accessRules: true,
      },
    });

    if (!article) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404, headers: corsHeaders() });
    }

    const isSuperAdmin = user.role === 'super_admin';

    // Check access
    if (!isSuperAdmin) {
      if (article.status !== 'published') {
        return NextResponse.json({ error: 'Article not found' }, { status: 404, headers: corsHeaders() });
      }
      if (article.accessRules.length > 0) {
        const hasAccess = article.accessRules.some(
          (rule) => rule.role === user.role || rule.userId === user.id || rule.role === null
        );
        if (!hasAccess) {
          return NextResponse.json({ error: 'You do not have access to this article' }, { status: 403, headers: corsHeaders() });
        }
      }
    }

    // Increment view count (non-blocking)
    db.docArticle.update({ where: { id }, data: { viewCount: { increment: 1 } } }).catch(() => {});

    const result = {
      ...article,
      isRestricted: article.accessRules.length > 0,
    };

    return NextResponse.json(result, { headers: corsHeaders() });
  } catch (error) {
    console.error('Error fetching doc article:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500, headers: corsHeaders() }
    );
  }
}

// PUT: Update article (super_admin only)
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const db = await getDb(request);
  try {
    const { id } = await params;
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders() });
    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401, headers: corsHeaders() });

    const user = await db.user.findUnique({ where: { id: payload.userId as string } });
    if (!user || user.role !== 'super_admin') {
      return NextResponse.json({ error: 'Only super admins can update articles' }, { status: 403, headers: corsHeaders() });
    }

    const body = await request.json();
    let { categoryId, title, slug, summary, content, docType, moduleKey, tags, version, status, sortOrder } = body;

    const existing = await db.docArticle.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404, headers: corsHeaders() });
    }

    // If categoryId looks like a slug (not a cuid), look up the actual ID
    if (categoryId && !categoryId.startsWith('cl') || categoryId && categoryId.length < 20) {
      const category = await db.docCategory.findUnique({ where: { slug: categoryId } });
      if (category) categoryId = category.id;
    }

    if (slug && slug !== existing.slug) {
      const slugExists = await db.docArticle.findUnique({ where: { slug } });
      if (slugExists) {
        return NextResponse.json({ error: 'Article with this slug already exists' }, { status: 409, headers: corsHeaders() });
      }
    }

    const article = await db.docArticle.update({
      where: { id },
      data: {
        ...(categoryId !== undefined && { categoryId }),
        ...(title !== undefined && { title }),
        ...(slug !== undefined && { slug }),
        ...(summary !== undefined && { summary }),
        ...(content !== undefined && { content }),
        ...(docType !== undefined && { docType }),
        ...(moduleKey !== undefined && { moduleKey }),
        ...(tags !== undefined && { tags }),
        ...(version !== undefined && { version }),
        ...(status !== undefined && { status }),
        ...(sortOrder !== undefined && { sortOrder }),
      },
      include: { category: true, accessRules: true },
    });

    return NextResponse.json(article, { headers: corsHeaders() });
  } catch (error) {
    console.error('Error updating doc article:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500, headers: corsHeaders() }
    );
  }
}

// DELETE: Delete article (super_admin only)
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const db = await getDb(request);
  try {
    const { id } = await params;
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders() });
    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401, headers: corsHeaders() });

    const user = await db.user.findUnique({ where: { id: payload.userId as string } });
    if (!user || user.role !== 'super_admin') {
      return NextResponse.json({ error: 'Only super admins can delete articles' }, { status: 403, headers: corsHeaders() });
    }

    const existing = await db.docArticle.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404, headers: corsHeaders() });
    }

    await db.docArticle.delete({ where: { id } });

    return NextResponse.json({ message: 'Article deleted successfully' }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Error deleting doc article:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500, headers: corsHeaders() }
    );
  }
}
