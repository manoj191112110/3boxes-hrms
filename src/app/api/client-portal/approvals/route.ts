/**
 * Client Portal — Timesheet Approvals (REQ-CLT-08)
 * GET  /api/client-portal/approvals        list pending/all approvals for this client
 * POST /api/client-portal/approvals        { approvalId, status: 'approved'|'rejected', comments }
 *
 * Auth: Bearer <client_portal_token>
 */
import { NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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
    const approvals = await db.clientTimesheetApproval.findMany({
      where: { clientId: ctx.clientId },
      include: {
        timesheet: {
          include: {
            employee: { select: { id: true, firstName: true, lastName: true, employeeId: true } },
            project: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return NextResponse.json({ approvals }, { headers: CORS });
  } catch (e) {
    console.error('client-portal approvals GET error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: CORS });
  }
}

export async function POST(request: Request) {
  const db = await getDb(request);
  try {
    const ctx = await getClientContext(request);
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS });
    const body = await request.json().catch(() => ({}));
    const { approvalId, status, comments } = body;
    if (!['approved', 'rejected'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400, headers: CORS });
    }
    const updated = await db.clientTimesheetApproval.update({
      where: { id: approvalId, clientId: ctx.clientId },
      data: { status, comments, approvedById: ctx.portalUserId, approvedAt: new Date() },
    });
    return NextResponse.json({ approval: updated }, { headers: CORS });
  } catch (e) {
    console.error('client-portal approvals POST error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: CORS });
  }
}
