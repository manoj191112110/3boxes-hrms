import { NextRequest, NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';

/**
 * GET /api/collaboration/legal-holds
 * Returns legal holds. Super Admin sees all; others get 403.
 */
export async function GET(request: NextRequest) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    // REQ-6.1: eDiscovery — Super Admin only
    if (decoded.role !== 'super_admin') {
      return NextResponse.json({ error: 'Only Super Admin can manage legal holds' }, { status: 403 });
    }

    const holds = await db.legalHold.findMany({
      where: { status: 'active' },
      orderBy: { startDate: 'desc' },
      take: 200,
    });

    return NextResponse.json({ holds });
  } catch (error) {
    console.error('GET legal holds error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/collaboration/legal-holds
 * Body: { tenantId, targetUserId?, targetRoomId?, targetFileId?, caseReference?, reason, endDate? }
 *
 * REQ-6.1: eDiscovery & Compliance — Super Admin can place a "Legal Hold"
 * on a specific user across any tenant, freezing their chats and files
 * from deletion.
 */
export async function POST(request: NextRequest) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    if (decoded.role !== 'super_admin') {
      return NextResponse.json({ error: 'Only Super Admin can create legal holds' }, { status: 403 });
    }

    const body = await request.json();
    const { tenantId, targetUserId, targetRoomId, targetFileId, caseReference, reason, endDate } = body;

    if (!tenantId || !reason) return NextResponse.json({ error: 'tenantId and reason are required' }, { status: 400 });
    if (!targetUserId && !targetRoomId && !targetFileId) {
      return NextResponse.json({ error: 'At least one of targetUserId, targetRoomId, targetFileId is required' }, { status: 400 });
    }

    const hold = await db.legalHold.create({
      data: {
        tenantId,
        initiatedBy: decoded.userId,
        targetUserId,
        targetRoomId,
        targetFileId,
        caseReference,
        reason,
        endDate: endDate ? new Date(endDate) : null,
      },
    });

    // Mark the target resources as under legal hold
    if (targetFileId) {
      await db.fileNode.update({
        where: { id: targetFileId },
        data: { isUnderLegalHold: true },
      });
    }

    return NextResponse.json({ hold }, { status: 201 });
  } catch (error) {
    console.error('POST legal holds error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/collaboration/legal-holds
 * Body: { holdId, action: 'release', releaseReason }
 * Releases a legal hold.
 */
export async function PATCH(request: NextRequest) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    if (decoded.role !== 'super_admin') {
      return NextResponse.json({ error: 'Only Super Admin can release legal holds' }, { status: 403 });
    }

    const body = await request.json();
    const { holdId, releaseReason } = body;
    if (!holdId) return NextResponse.json({ error: 'holdId is required' }, { status: 400 });

    const hold = await db.legalHold.findUnique({ where: { id: holdId } });
    if (!hold) return NextResponse.json({ error: 'Hold not found' }, { status: 404 });

    const updated = await db.legalHold.update({
      where: { id: holdId },
      data: {
        status: 'released',
        releasedBy: decoded.userId,
        releasedAt: new Date(),
        releaseReason: releaseReason || 'Released by Super Admin',
        endDate: new Date(),
      },
    });

    // Unfreeze the target file if applicable
    if (hold.targetFileId) {
      await db.fileNode.update({
        where: { id: hold.targetFileId },
        data: { isUnderLegalHold: false },
      });
    }

    return NextResponse.json({ hold: updated });
  } catch (error) {
    console.error('PATCH legal holds error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
