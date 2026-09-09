import { NextRequest, NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';

/**
 * POST /api/teams/[id]/members
 * Body: { employeeId, role?: 'lead'|'member'|'observer' }
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const { id } = await params;
    const body = await request.json();
    const { employeeId, role = 'member' } = body;
    if (!employeeId) return NextResponse.json({ error: 'employeeId is required' }, { status: 400 });

    const membership = await db.teamMember.upsert({
      where: { teamId_employeeId: { teamId: id, employeeId } },
      create: { teamId: id, employeeId, role, leftAt: null },
      update: { role, leftAt: null },
    });

    return NextResponse.json({ membership }, { status: 201 });
  } catch (error) {
    console.error('POST team members error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/teams/[id]/members?employeeId=xxx
 * Removes a member from the team (sets leftAt).
 */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employeeId');
    if (!employeeId) return NextResponse.json({ error: 'employeeId is required' }, { status: 400 });

    await db.teamMember.updateMany({
      where: { teamId: id, employeeId },
      data: { leftAt: new Date() },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('DELETE team members error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
