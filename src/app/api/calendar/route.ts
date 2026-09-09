import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';

/** GET /api/calendar?month=2026-08&companyId=xxx */
export async function GET(request: NextRequest) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month'); // e.g. "2026-08"
    const companyId = searchParams.get('companyId');

    const employee = await db.employee.findFirst({ where: { userId: decoded.userId as string } });
    if (!employee) return NextResponse.json({ events: [] });

    const where: Record<string, unknown> = { isActive: true };
    if (companyId) where.companyId = companyId;

    if (month) {
      const [y, m] = month.split('-').map(Number);
      const start = new Date(y, m - 1, 1);
      const end = new Date(y, m, 0, 23, 59, 59);
      where.startDateTime = { gte: start, lte: end };
    }

    const events = await db.calendarEvent.findMany({
      where,
      orderBy: { startDateTime: 'asc' },
      include: {
        creator: { select: { id: true, firstName: true, lastName: true, avatar: true } },
      },
    });

    return NextResponse.json({ events });
  } catch (error) {
    console.error('GET calendar error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** POST /api/calendar — Create event */
export async function POST(request: NextRequest) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const body = await request.json();
    const { title, description, eventType = 'meeting', startDateTime, endDateTime, isAllDay = false, location, color, companyId, attendees, recurrence, isPublic = true } = body;

    if (!title || !startDateTime || !endDateTime) {
      return NextResponse.json({ error: 'title, startDateTime, and endDateTime are required' }, { status: 400 });
    }

    const employee = await db.employee.findFirst({ where: { userId: decoded.userId as string } });
    if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });

    const event = await db.calendarEvent.create({
      data: {
        title,
        description,
        eventType,
        startDateTime: new Date(startDateTime),
        endDateTime: new Date(endDateTime),
        isAllDay,
        location,
        color,
        createdBy: employee.id,
        companyId: companyId || employee.companyId || null,
        attendees: attendees ? JSON.stringify(attendees) : null,
        recurrence: recurrence ? JSON.stringify(recurrence) : null,
        isPublic,
      },
    });

    return NextResponse.json({ event }, { status: 201 });
  } catch (error) {
    console.error('POST calendar error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** PATCH /api/calendar — Update event */
export async function PATCH(request: NextRequest) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const body = await request.json();
    const { id, ...updates } = body;
    if (!id) return NextResponse.json({ error: 'Event id is required' }, { status: 400 });

    if (updates.startDateTime) updates.startDateTime = new Date(updates.startDateTime);
    if (updates.endDateTime) updates.endDateTime = new Date(updates.endDateTime);
    if (updates.attendees) updates.attendees = JSON.stringify(updates.attendees);
    if (updates.recurrence) updates.recurrence = JSON.stringify(updates.recurrence);

    const event = await db.calendarEvent.update({ where: { id }, data: updates });
    return NextResponse.json({ event });
  } catch (error) {
    console.error('PATCH calendar error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** DELETE /api/calendar?id=xxx */
export async function DELETE(request: NextRequest) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Event id is required' }, { status: 400 });

    const event = await db.calendarEvent.update({ where: { id }, data: { isActive: false } });
    return NextResponse.json({ event });
  } catch (error) {
    console.error('DELETE calendar error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
