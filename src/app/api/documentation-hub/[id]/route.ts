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

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: corsHeaders() });

    const { id } = await params;

    const document = await db.docHubDocument.findUnique({
      where: { id },
      include: {
        category: { select: { id: true, name: true, slug: true, icon: true, color: true } },
        permissions: true,
      },
    });

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404, headers: corsHeaders() });
    }

    // Increment view count
    await db.docHubDocument.update({
      where: { id },
      data: { viewCount: { increment: 1 } },
    });

    return NextResponse.json({ document }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Get document error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: corsHeaders() });

    const userRole = (decoded as Record<string, unknown>).role as string;

    if (!['super_admin', 'tenant_admin', 'admin'].includes(userRole)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403, headers: corsHeaders() });
    }

    const { id } = await params;
    const body = await request.json();

    const existing = await db.docHubDocument.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404, headers: corsHeaders() });
    }

    const updateData: Record<string, unknown> = {};
    if (body.title !== undefined) updateData.title = body.title;
    if (body.categoryId !== undefined) updateData.categoryId = body.categoryId;
    if (body.content !== undefined) updateData.content = body.content;
    if (body.summary !== undefined) updateData.summary = body.summary;
    if (body.tags !== undefined) updateData.tags = body.tags;
    if (body.version !== undefined) updateData.version = body.version;
    if (body.author !== undefined) updateData.author = body.author;
    if (body.fileUrl !== undefined) updateData.fileUrl = body.fileUrl;
    if (body.videoUrl !== undefined) updateData.videoUrl = body.videoUrl;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.isFeatured !== undefined) updateData.isFeatured = body.isFeatured;

    const document = await db.docHubDocument.update({
      where: { id },
      data: updateData,
      include: {
        category: { select: { id: true, name: true, slug: true, icon: true, color: true } },
      },
    });

    return NextResponse.json({ document }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Update document error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: corsHeaders() });

    const userRole = (decoded as Record<string, unknown>).role as string;

    if (userRole !== 'super_admin') {
      return NextResponse.json({ error: 'Only super admin can delete documents' }, { status: 403, headers: corsHeaders() });
    }

    const { id } = await params;

    const existing = await db.docHubDocument.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404, headers: corsHeaders() });
    }

    await db.docHubDocument.delete({ where: { id } });

    return NextResponse.json({ message: 'Document deleted successfully' }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Delete document error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}
