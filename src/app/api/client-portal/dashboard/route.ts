/**
 * Client Portal — Dashboard
 * GET /api/client-portal/dashboard
 *   Auth: Bearer <client_portal_token>
 *
 * Returns projects, invoices, and pending-approval count for the logged-in client.
 * (REQ-CLT-07/08)
 */
import { NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: CORS });
}

async function getClientContext(request: Request) {
  const token = getTokenFromHeaders(request);
  if (!token) return null;
  try {
    const decoded = await verifyToken(token) as { kind?: string; clientId?: string; portalUserId?: string } | null;
    if (!decoded || decoded.kind !== 'client_portal' || !decoded.clientId) return null;
    return decoded;
  } catch { return null; }
}

export async function GET(request: Request) {
  const db = await getDb(request);
  try {
    const ctx = await getClientContext(request);
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS });
    const [projects, invoices, pendingTimesheetApprovals] = await Promise.all([
      db.project.findMany({
        where: { clientId: ctx.clientId, status: 'active' },
        include: { _count: { select: { timesheets: true, allocations: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      db.invoice.findMany({
        where: { clientId: ctx.clientId },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: { id: true, invoiceNumber: true, status: true, totalAmount: true, currency: true, dueDate: true, createdAt: true },
      }),
      db.clientTimesheetApproval.count({ where: { clientId: ctx.clientId, status: 'pending' } }),
    ]);
    return NextResponse.json({ projects, invoices, pendingApprovals: pendingTimesheetApprovals }, { headers: CORS });
  } catch (e) {
    console.error('client-portal dashboard error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: CORS });
  }
}
