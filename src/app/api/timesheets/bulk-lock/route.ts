import { NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';
import { ensureSchemaSynced, withSchemaSync } from '@/lib/schema-sync';

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

// ─── POST /api/timesheets/bulk-lock ───────────────────────────────
// Body:
//   { ids: string[], locked: boolean, lockReason?: string }
//
// Lock or unlock multiple timesheets. Locking is allowed for managers+.
// Unlocking is super_admin only.
export async function POST(request: Request) {
  const db = await getDb(request);
  try {
    await ensureSchemaSynced();

    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: corsHeaders() });

    const userRole = decoded.role as string;
    if (!['super_admin', 'tenant_admin', 'admin'].includes(userRole)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403, headers: corsHeaders() });
    }

    const body = await request.json();
    const ids: string[] = body.ids || [];
    const shouldLock: boolean = body.locked !== false; // default true
    const lockReason: string | undefined = body.lockReason;

    if (ids.length === 0) {
      return NextResponse.json({ error: 'No timesheet IDs provided' }, { status: 400, headers: corsHeaders() });
    }

    // Unlocking requires super_admin
    if (!shouldLock && userRole !== 'super_admin') {
      return NextResponse.json(
        { error: 'Only super_admin can unlock timesheets' },
        { status: 403, headers: corsHeaders() }
      );
    }

    const data: Record<string, unknown> = shouldLock
      ? {
          locked: true,
          lockedBy: decoded.userId as string,
          lockedAt: new Date(),
          lockReason: lockReason || null,
          status: 'locked',
        }
      : {
          locked: false,
          lockedBy: null,
          lockedAt: null,
          lockReason: null,
          status: 'approved', // restore
        };

    const result = await withSchemaSync(() =>
      db.timesheet.updateMany({
        where: { id: { in: ids } },
        data,
      })
    );

    await db.auditLog.create({
      data: {
        userId: decoded.userId as string,
        action: shouldLock ? 'BULK_LOCK_TIMESHEETS' : 'BULK_UNLOCK_TIMESHEETS',
        module: 'timesheets',
        details: `${shouldLock ? 'Locked' : 'Unlocked'} ${result.count} timesheet(s)${lockReason ? ` — reason: ${lockReason}` : ''}`,
      },
    });

    return NextResponse.json({
      affected: result.count,
      action: shouldLock ? 'locked' : 'unlocked',
    }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Bulk lock timesheets error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}
