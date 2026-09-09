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

// ─── POST /api/timesheets/bulk-approve ────────────────────────────
// Body:
//   { ids: string[], status?: 'approved'|'rejected' }
// Approves/rejects multiple timesheets at once. Skips locked rows (only
// super_admin can approve a locked row).
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
      return NextResponse.json({ error: 'Insufficient permissions to approve timesheets' }, { status: 403, headers: corsHeaders() });
    }

    const body = await request.json();
    const ids: string[] = body.ids || [];
    const newStatus: string = body.status || 'approved';

    if (ids.length === 0) {
      return NextResponse.json({ error: 'No timesheet IDs provided' }, { status: 400, headers: corsHeaders() });
    }

    // Fetch all rows to check locks
    const rows = await withSchemaSync(() =>
      db.timesheet.findMany({
        where: { id: { in: ids } },
        select: { id: true, locked: true, status: true, date: true },
      })
    );

    const lockBlocked: string[] = [];
    const approved: string[] = [];
    for (const row of rows) {
      if (row.locked && userRole !== 'super_admin') {
        lockBlocked.push(row.id);
      } else {
        approved.push(row.id);
      }
    }

    if (approved.length > 0) {
      await withSchemaSync(() =>
        db.timesheet.updateMany({
          where: { id: { in: approved } },
          data: {
            status: newStatus,
            approvedBy: decoded.userId as string,
            approvedAt: new Date(),
          },
        })
      );
    }

    await db.auditLog.create({
      data: {
        userId: decoded.userId as string,
        action: 'BULK_APPROVE_TIMESHEETS',
        module: 'timesheets',
        details: `Bulk ${newStatus} ${approved.length} timesheet(s); ${lockBlocked.length} skipped (locked)`,
      },
    });

    return NextResponse.json({
      approved: approved.length,
      skipped: lockBlocked.length,
      skippedIds: lockBlocked,
      status: newStatus,
    }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Bulk approve timesheets error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}
