import { NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';

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
    if (!token) return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: corsHeaders() });

    const userRole = (decoded as Record<string, unknown>).role as string;
    const userId = (decoded as Record<string, unknown>).id as string;

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const categoryId = searchParams.get('categoryId');
    const search = searchParams.get('search');
    const status = searchParams.get('status');

    const where: Record<string, unknown> = {};

    if (categoryId) where.categoryId = categoryId;
    if (status) where.status = status;

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { summary: { contains: search, mode: 'insensitive' } },
        { tags: { contains: search, mode: 'insensitive' } },
      ];
    }

    // RBAC: non-admin users can only see published docs they have permission for
    if (!['super_admin', 'tenant_admin', 'admin'].includes(userRole)) {
      where.status = 'published';
      where.OR = [
        // Documents with no permissions set (public)
        { permissions: { none: {} } },
        // Documents with role-based permission for this user's role
        { permissions: { some: { targetType: 'role', targetId: userRole, canView: true } } },
        // Documents with user-specific permission
        { permissions: { some: { targetType: 'user', targetId: userId, canView: true } } },
      ];
    }

    const [documents, total] = await Promise.all([
      db.docHubDocument.findMany({
        where,
        include: {
          category: { select: { id: true, name: true, slug: true, icon: true, color: true } },
          permissions: { select: { id: true, targetType: true, targetId: true, canView: true, canEdit: true, canShare: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.docHubDocument.count({ where }),
    ]);

    // Get categories with doc counts
    const categories = await db.docHubCategory.findMany({
      where: { status: 'active' },
      include: { _count: { select: { documents: { where: { status: 'published' } } } } },
      orderBy: { sortOrder: 'asc' },
    });

    return NextResponse.json({
      documents,
      categories,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Get documentation-hub error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}

export async function POST(request: Request) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: corsHeaders() });

    const userRole = (decoded as Record<string, unknown>).role as string;
    const userName = (decoded as Record<string, unknown>).name as string;

    if (!['super_admin', 'tenant_admin', 'admin'].includes(userRole)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403, headers: corsHeaders() });
    }

    const body = await request.json();
    const { title, categoryId, content, summary, tags, version, author, fileUrl, videoUrl, status, isFeatured } = body;

    if (!title || !categoryId || !content) {
      return NextResponse.json({ error: 'Missing required fields: title, categoryId, content' }, { status: 400, headers: corsHeaders() });
    }

    // Generate slug from title
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Date.now().toString(36);

    const document = await db.docHubDocument.create({
      data: {
        title,
        slug,
        categoryId,
        content,
        summary: summary || null,
        tags: tags || null,
        version: version || '1.0',
        author: author || userName || null,
        fileUrl: fileUrl || null,
        videoUrl: videoUrl || null,
        status: status || 'published',
        isFeatured: isFeatured || false,
      },
      include: {
        category: { select: { id: true, name: true, slug: true, icon: true, color: true } },
      },
    });

    return NextResponse.json({ document }, { status: 201, headers: corsHeaders() });
  } catch (error) {
    console.error('Create documentation-hub error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}
