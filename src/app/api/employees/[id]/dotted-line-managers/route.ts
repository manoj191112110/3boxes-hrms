import { NextRequest, NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';

/**
 * GET /api/employees/[id]/dotted-line-managers
 * Returns all managers (solid + dotted) for an employee.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const { id } = await params;
    const managers = await db.dottedLineManager.findMany({
      where: { employeeId: id, endDate: null },
      include: {
        manager: {
          select: { id: true, firstName: true, lastName: true, email: true, employeeId: true, avatar: true, designation: { select: { title: true } } },
        },
      },
      orderBy: { startDate: 'desc' },
    });

    return NextResponse.json({ managers });
  } catch (error) {
    console.error('GET dotted-line-managers error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/employees/[id]/dotted-line-managers
 * Body: { managerId, managerType, notes? }
 * Adds a manager relationship to an employee.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    if (!['super_admin', 'tenant_admin', 'admin'].includes(decoded.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { managerId, managerType = 'dotted', notes } = body;

    if (!managerId) return NextResponse.json({ error: 'managerId is required' }, { status: 400 });
    if (managerId === id) return NextResponse.json({ error: 'Employee cannot be their own manager' }, { status: 400 });
    if (!['solid', 'dotted', 'project', 'functional'].includes(managerType)) {
      return NextResponse.json({ error: 'Invalid managerType' }, { status: 400 });
    }

    // If adding a solid-line manager, end any existing solid-line
    if (managerType === 'solid') {
      await db.dottedLineManager.updateMany({
        where: { employeeId: id, managerType: 'solid', endDate: null },
        data: { endDate: new Date() },
      });
    }

    const rel = await db.dottedLineManager.create({
      data: { employeeId: id, managerId, managerType, notes },
    });

    return NextResponse.json({ manager: rel }, { status: 201 });
  } catch (error) {
    console.error('POST dotted-line-managers error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
