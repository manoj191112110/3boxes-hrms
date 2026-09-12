import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';

/** GET /api/social-feed?type=general&companyId=xxx */
export async function GET(request: NextRequest) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const companyId = searchParams.get('companyId');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);

    const employee = await db.employee.findFirst({ where: { userId: decoded.userId as string } });
    if (!employee) return NextResponse.json({ posts: [] });

    const where: Record<string, unknown> = { isActive: true };
    if (type) where.postType = type;
    if (companyId) where.companyId = companyId;
    else if (employee.companyId) where.companyId = employee.companyId;

    const posts = await db.socialPost.findMany({
      where,
      orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
      take: limit,
      include: {
        author: { select: { id: true, firstName: true, lastName: true, avatar: true, designation: { select: { name: true } } } },
        comments: {
          where: { isActive: true },
          orderBy: { createdAt: 'asc' },
          include: { author: { select: { id: true, firstName: true, lastName: true, avatar: true } } },
          take: 20,
        },
      },
    });

    const parsed = posts.map(p => ({
      ...p,
      attachments: p.attachments ? JSON.parse(p.attachments) : [],
      hashtags: p.hashtags ? JSON.parse(p.hashtags) : [],
    }));

    return NextResponse.json({ posts: parsed });
  } catch (error) {
    console.error('GET social-feed error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** POST /api/social-feed — Create post */
export async function POST(request: NextRequest) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const body = await request.json();
    const { content, postType = 'general', companyId, attachments, hashtags, isPinned = false } = body;

    if (!content) return NextResponse.json({ error: 'content is required' }, { status: 400 });

    const employee = await db.employee.findFirst({ where: { userId: decoded.userId as string } });
    if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });

    const post = await db.socialPost.create({
      data: {
        content,
        postType,
        authorId: employee.id,
        companyId: companyId || employee.companyId || null,
        attachments: attachments ? JSON.stringify(attachments) : null,
        hashtags: hashtags ? JSON.stringify(hashtags) : null,
        isPinned,
      },
      include: {
        author: { select: { id: true, firstName: true, lastName: true, avatar: true } },
      },
    });

    return NextResponse.json({ post }, { status: 201 });
  } catch (error) {
    console.error('POST social-feed error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** PATCH /api/social-feed — Like, comment, or update post */
export async function PATCH(request: NextRequest) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const body = await request.json();
    const { id, action, commentContent, ...updates } = body;
    if (!id) return NextResponse.json({ error: 'Post id is required' }, { status: 400 });

    const employee = await db.employee.findFirst({ where: { userId: decoded.userId as string } });
    if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });

    if (action === 'like') {
      // Toggle like
      const existing = await db.socialLike.findUnique({ where: { postId_userId: { postId: id, userId: employee.id } } });
      if (existing) {
        await db.socialLike.delete({ where: { id: existing.id } });
        await db.socialPost.update({ where: { id }, data: { likesCount: { decrement: 1 } } });
      } else {
        await db.socialLike.create({ data: { postId: id, userId: employee.id } });
        await db.socialPost.update({ where: { id }, data: { likesCount: { increment: 1 } } });
      }
      const post = await db.socialPost.findUnique({ where: { id } });
      return NextResponse.json({ post });
    }

    if (action === 'comment' && commentContent) {
      const comment = await db.socialComment.create({
        data: { postId: id, authorId: employee.id, content: commentContent },
        include: { author: { select: { id: true, firstName: true, lastName: true, avatar: true } } },
      });
      await db.socialPost.update({ where: { id }, data: { commentsCount: { increment: 1 } } });
      return NextResponse.json({ comment });
    }

    // General update
    const post = await db.socialPost.update({ where: { id }, data: updates });
    return NextResponse.json({ post });
  } catch (error) {
    console.error('PATCH social-feed error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** DELETE /api/social-feed?id=xxx */
export async function DELETE(request: NextRequest) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Post id is required' }, { status: 400 });

    const post = await db.socialPost.update({ where: { id }, data: { isActive: false } });
    return NextResponse.json({ post });
  } catch (error) {
    console.error('DELETE social-feed error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
