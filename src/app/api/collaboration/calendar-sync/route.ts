import { NextRequest, NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';

/**
 * GET /api/collaboration/calendar-sync
 * Returns the current user's calendar sync configurations.
 */
export async function GET(request: NextRequest) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const employee = await db.employee.findFirst({ where: { userId: decoded.userId } });
    if (!employee) return NextResponse.json({ syncs: [] });

    const syncs = await db.calendarSync.findMany({
      where: { employeeId: employee.id },
    });

    return NextResponse.json({ syncs });
  } catch (error) {
    console.error('GET calendar sync error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/collaboration/calendar-sync
 * Body: { provider: 'outlook'|'google'|'ical', calendarId?, refreshToken?, syncDirection?, syncLeaveApproved?, syncHolidays?, syncFocusTime? }
 *
 * REQ-SOC-05: Bi-directional sync with Outlook/Google Calendars.
 *   HRMS to Calendar: Approved Leave, Public Holidays
 *   Calendar to HRMS: Working hours blocking (Focus Time, external meetings) → capacity planning
 */
export async function POST(request: NextRequest) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const body = await request.json();
    const {
      provider, calendarId, refreshToken,
      syncDirection = 'bidirectional',
      syncLeaveApproved = true, syncHolidays = true, syncFocusTime = true,
    } = body;

    if (!provider || !['outlook', 'google', 'ical'].includes(provider)) {
      return NextResponse.json({ error: 'Invalid provider' }, { status: 400 });
    }

    const employee = await db.employee.findFirst({ where: { userId: decoded.userId } });
    if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });

    const sync = await db.calendarSync.upsert({
      where: { employeeId_provider: { employeeId: employee.id, provider } },
      create: {
        employeeId: employee.id,
        provider,
        calendarId,
        refreshToken,
        syncDirection,
        syncLeaveApproved,
        syncHolidays,
        syncFocusTime,
        lastSyncedAt: new Date(),
        isActive: true,
      },
      update: {
        calendarId,
        refreshToken,
        syncDirection,
        syncLeaveApproved,
        syncHolidays,
        syncFocusTime,
        lastSyncedAt: new Date(),
        isActive: true,
      },
    });

    return NextResponse.json({ sync }, { status: 201 });
  } catch (error) {
    console.error('POST calendar sync error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
