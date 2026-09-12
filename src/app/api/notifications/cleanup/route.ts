import { NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() });
}

/**
 * POST /api/notifications/cleanup
 *
 * One-time cleanup endpoint that deduplicates "Login Successful" notifications
 * for the calling user. Keeps only the most recent login notification per user
 * as unread; marks all older ones as read.
 *
 * This is safe to call repeatedly — it's idempotent.
 */
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
    const userId = decoded.userId as string;

    // Find all unread login notifications for this user, newest first.
    const unreadLoginNotifs = await db.notification.findMany({
      where: { userId, type: 'login', isRead: false },
      orderBy: { createdAt: 'desc' },
      select: { id: true, createdAt: true },
    });

    if (unreadLoginNotifs.length <= 1) {
      return NextResponse.json({
        message: 'No duplicates to clean up',
        unreadCount: unreadLoginNotifs.length,
        markedAsRead: 0,
      }, { headers: corsHeaders() });
    }

    // Keep the newest one (index 0) as unread; mark the rest as read.
    const idsToMarkRead = unreadLoginNotifs.slice(1).map((n) => n.id);
    const result = await db.notification.updateMany({
      where: { id: { in: idsToMarkRead } },
      data: { isRead: true },
    });

    return NextResponse.json({
      message: `Cleaned up ${result.count} duplicate login notification(s)`,
      unreadCount: 1,
      markedAsRead: result.count,
    }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Notifications cleanup error:', error);
    return NextResponse.json(
      { error: 'Internal server error', detail: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500, headers: corsHeaders() },
    );
  }
}
