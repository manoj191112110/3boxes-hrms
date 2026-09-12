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

    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get('documentId');

    if (!documentId) {
      return NextResponse.json({ error: 'documentId is required' }, { status: 400, headers: corsHeaders() });
    }

    const permissions = await db.docHubPermission.findMany({
      where: { documentId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ permissions }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Get permissions error:', error);
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
    const userId = (decoded as Record<string, unknown>).id as string;

    if (userRole !== 'super_admin') {
      return NextResponse.json({ error: 'Only super admin can manage permissions' }, { status: 403, headers: corsHeaders() });
    }

    const body = await request.json();
    const { documentId, targetType, targetId, canView, canEdit, canShare } = body;

    if (!documentId || !targetType || !targetId) {
      return NextResponse.json({ error: 'Missing required fields: documentId, targetType, targetId' }, { status: 400, headers: corsHeaders() });
    }

    if (!['role', 'user'].includes(targetType)) {
      return NextResponse.json({ error: 'targetType must be "role" or "user"' }, { status: 400, headers: corsHeaders() });
    }

    // Check if permission already exists
    const existing = await db.docHubPermission.findFirst({
      where: { documentId, targetType, targetId },
    });

    if (existing) {
      // Update existing permission
      const updated = await db.docHubPermission.update({
        where: { id: existing.id },
        data: {
          canView: canView !== undefined ? canView : existing.canView,
          canEdit: canEdit !== undefined ? canEdit : existing.canEdit,
          canShare: canShare !== undefined ? canShare : existing.canShare,
          grantedBy: userId,
        },
      });
      return NextResponse.json({ permission: updated }, { headers: corsHeaders() });
    }

    const permission = await db.docHubPermission.create({
      data: {
        documentId,
        targetType,
        targetId,
        canView: canView !== undefined ? canView : true,
        canEdit: canEdit !== undefined ? canEdit : false,
        canShare: canShare !== undefined ? canShare : false,
        grantedBy: userId,
      },
    });

    return NextResponse.json({ permission }, { status: 201, headers: corsHeaders() });
  } catch (error) {
    console.error('Create permission error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}

export async function DELETE(request: Request) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: corsHeaders() });

    const userRole = (decoded as Record<string, unknown>).role as string;

    if (userRole !== 'super_admin') {
      return NextResponse.json({ error: 'Only super admin can remove permissions' }, { status: 403, headers: corsHeaders() });
    }

    const { searchParams } = new URL(request.url);
    const permissionId = searchParams.get('id');

    if (!permissionId) {
      return NextResponse.json({ error: 'Permission id is required' }, { status: 400, headers: corsHeaders() });
    }

    await db.docHubPermission.delete({ where: { id: permissionId } });

    return NextResponse.json({ message: 'Permission removed successfully' }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Delete permission error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}
