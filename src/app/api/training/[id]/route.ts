import { NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const db = await getDb(request);
  try {
    const { id } = await params;
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: corsHeaders() });

    const body = await request.json();

    // Enroll employee
    if (body.action === 'enroll' && body.employeeId) {
      const enrollment = await db.trainingEnrollment.create({
        data: { trainingId: id, employeeId: body.employeeId },
        include: { employee: { select: { firstName: true, lastName: true, employeeId: true } } },
      });
      return NextResponse.json({ enrollment }, { status: 201, headers: corsHeaders() });
    }

    // Update training
    const training = await db.training.update({
      where: { id },
      data: {
        ...(body.title && { title: body.title }),
        ...(body.status && { status: body.status }),
        ...(body.category !== undefined && { category: body.category }),
        ...(body.trainer !== undefined && { trainer: body.trainer }),
        ...(body.mode && { mode: body.mode }),
        ...(body.location !== undefined && { location: body.location }),
        ...(body.maxParticipants !== undefined && { maxParticipants: body.maxParticipants }),
        ...(body.cost !== undefined && { cost: body.cost }),
      },
    });

    return NextResponse.json({ training }, { headers: corsHeaders() });
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && (error as { code: string }).code === 'P2002') {
      return NextResponse.json({ error: 'Employee already enrolled in this training' }, { status: 409, headers: corsHeaders() });
    }
    console.error('Update training error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const db = await getDb(request);
  try {
    const { id } = await params;
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: corsHeaders() });

    const body = await request.json();
    const data: Record<string, unknown> = {};
    if (body.title !== undefined) data.title = body.title;
    if (body.description !== undefined) data.description = body.description;
    if (body.category !== undefined) data.category = body.category;
    if (body.trainer !== undefined) data.trainer = body.trainer;
    if (body.startDate !== undefined) data.startDate = new Date(body.startDate);
    if (body.endDate !== undefined) data.endDate = body.endDate ? new Date(body.endDate) : null;
    if (body.mode !== undefined) data.mode = body.mode;
    if (body.status !== undefined) data.status = body.status;
    if (body.maxParticipants !== undefined) data.maxParticipants = body.maxParticipants;
    if (body.location !== undefined) data.location = body.location;
    if (body.cost !== undefined) data.cost = body.cost;

    const training = await db.training.update({
      where: { id },
      data,
      include: {
        enrollments: {
          include: {
            employee: { select: { id: true, firstName: true, lastName: true, employeeId: true } },
          },
        },
        _count: { select: { enrollments: true } },
      },
    });

    return NextResponse.json({ training }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Update training error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const db = await getDb(request);
  try {
    const { id } = await params;
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: corsHeaders() });

    // Check if user is admin
    const user = await db.user.findUnique({ where: { id: decoded.userId as string } });
    if (!user || !['super_admin', 'tenant_admin', 'admin'].includes(user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403, headers: corsHeaders() });
    }

    // Delete enrollments first (cascade)
    await db.trainingEnrollment.deleteMany({ where: { trainingId: id } });
    await db.training.delete({ where: { id } });

    return NextResponse.json({ success: true }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Delete training error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}
