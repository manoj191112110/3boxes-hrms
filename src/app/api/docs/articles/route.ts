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

// GET: List articles the current user has access to
export async function GET(request: Request) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders() });
    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401, headers: corsHeaders() });

    const user = await db.user.findUnique({ where: { id: payload.userId as string } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404, headers: corsHeaders() });

    const { searchParams } = new URL(request.url);
    const categorySlug = searchParams.get('category');
    const docType = searchParams.get('docType');
    const moduleKey = searchParams.get('moduleKey');
    const search = searchParams.get('search');

    const isSuperAdmin = user.role === 'super_admin';

    // Build where clause
    const where: Record<string, unknown> = {};

    if (!isSuperAdmin) {
      where.status = 'published';
    }

    // Filter by category slug
    if (categorySlug) {
      try {
        const cat = await db.docCategory.findUnique({ where: { slug: categorySlug } });
        if (cat) where.categoryId = cat.id;
      } catch {
        // Table might not exist yet
      }
    }

    if (docType) where.docType = docType;
    if (moduleKey) where.moduleKey = moduleKey;

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { summary: { contains: search, mode: 'insensitive' } },
        { tags: { contains: search, mode: 'insensitive' } },
      ];
    }

    let articles;
    try {
      articles = await db.docArticle.findMany({
        where,
        include: {
          category: { select: { name: true, slug: true, icon: true, color: true } },
          accessRules: true,
        },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      });
    } catch (dbError) {
      // Table might not exist yet - return empty array to trigger auto-initialization
      const errMsg = dbError instanceof Error ? dbError.message : '';
      if (errMsg.includes('does not exist') || errMsg.includes('relation') || errMsg.includes('table')) {
        return NextResponse.json([], { headers: corsHeaders() });
      }
      throw dbError;
    }

    // Filter by access rules for non-super_admin users
    const filteredArticles = isSuperAdmin
      ? articles
      : articles.filter((article) => {
          // If no access rules, it's public
          if (article.accessRules.length === 0) return true;
          // Check if there's a matching rule
          return article.accessRules.some(
            (rule) =>
              rule.role === user.role ||
              rule.userId === user.id ||
              rule.role === null
          );
        });

    // Map to safe output (don't include full content in list)
    const result = filteredArticles.map((article) => ({
      id: article.id,
      title: article.title,
      slug: article.slug,
      summary: article.summary,
      docType: article.docType,
      moduleKey: article.moduleKey,
      tags: article.tags,
      version: article.version,
      status: article.status,
      viewCount: article.viewCount,
      sortOrder: article.sortOrder,
      category: article.category,
      isRestricted: article.accessRules.length > 0,
      createdAt: article.createdAt,
      updatedAt: article.updatedAt,
    }));

    return NextResponse.json(result, { headers: corsHeaders() });
  } catch (error) {
    console.error('Error fetching doc articles:', error);
    // Return empty array instead of error to allow auto-initialization
    return NextResponse.json([], { headers: corsHeaders() });
  }
}

// POST: Create article (super_admin only)
export async function POST(request: Request) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders() });
    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401, headers: corsHeaders() });

    const user = await db.user.findUnique({ where: { id: payload.userId as string } });
    if (!user || user.role !== 'super_admin') {
      return NextResponse.json({ error: 'Only super admins can create articles' }, { status: 403, headers: corsHeaders() });
    }

    const body = await request.json();
    let { categoryId, title, slug, summary, content, docType, moduleKey, tags, version, status, sortOrder } = body;

    if (!categoryId || !title || !slug || !content) {
      return NextResponse.json({ error: 'categoryId, title, slug, and content are required' }, { status: 400, headers: corsHeaders() });
    }

    // If categoryId looks like a slug (not a cuid), look up the actual ID
    if (!categoryId.startsWith('cl') || categoryId.length < 20) {
      const category = await db.docCategory.findUnique({ where: { slug: categoryId } });
      if (!category) {
        return NextResponse.json({ error: 'Category not found' }, { status: 400, headers: corsHeaders() });
      }
      categoryId = category.id;
    }

    const existing = await db.docArticle.findUnique({ where: { slug } });
    if (existing) {
      return NextResponse.json({ error: 'Article with this slug already exists' }, { status: 409, headers: corsHeaders() });
    }

    const article = await db.docArticle.create({
      data: {
        categoryId,
        title,
        slug,
        summary,
        content,
        docType: docType || 'functional',
        moduleKey,
        tags,
        version: version || '1.0',
        status: status || 'published',
        authorId: user.id,
        sortOrder: sortOrder || 0,
      },
      include: { category: true },
    });

    return NextResponse.json(article, { status: 201, headers: corsHeaders() });
  } catch (error) {
    console.error('Error creating doc article:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500, headers: corsHeaders() }
    );
  }
}
