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
    const review = await db.performanceReview.update({
      where: { id },
      data: {
        ...(body.reviewCycle && { reviewCycle: body.reviewCycle }),
        ...(body.reviewPeriod !== undefined && { reviewPeriod: body.reviewPeriod }),
        ...(body.rating !== undefined && { rating: body.rating }),
        ...(body.goalsRating !== undefined && { goalsRating: body.goalsRating }),
        ...(body.skillsRating !== undefined && { skillsRating: body.skillsRating }),
        ...(body.behaviorRating !== undefined && { behaviorRating: body.behaviorRating }),
        ...(body.overallRating !== undefined && { overallRating: body.overallRating }),
        ...(body.comments !== undefined && { comments: body.comments }),
        ...(body.strengths !== undefined && { strengths: body.strengths }),
        ...(body.improvements !== undefined && { improvements: body.improvements }),
        ...(body.status && { status: body.status }),
        ...(body.reviewDate && { reviewDate: new Date(body.reviewDate) }),
      },
      include: { employee: { select: { firstName: true, lastName: true, employeeId: true } } },
    });

    return NextResponse.json({ review }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Update performance review error:', error);
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
    if (body.reviewCycle !== undefined) data.reviewCycle = body.reviewCycle;
    if (body.reviewPeriod !== undefined) data.reviewPeriod = body.reviewPeriod;
    if (body.reviewerId !== undefined) data.reviewerId = body.reviewerId;
    if (body.rating !== undefined) data.rating = body.rating;
    if (body.goalsRating !== undefined) data.goalsRating = body.goalsRating;
    if (body.skillsRating !== undefined) data.skillsRating = body.skillsRating;
    if (body.behaviorRating !== undefined) data.behaviorRating = body.behaviorRating;
    if (body.overallRating !== undefined) data.overallRating = body.overallRating;
    if (body.comments !== undefined) data.comments = body.comments;
    if (body.strengths !== undefined) data.strengths = body.strengths;
    if (body.improvements !== undefined) data.improvements = body.improvements;
    if (body.status !== undefined) data.status = body.status;
    if (body.reviewDate !== undefined) data.reviewDate = body.reviewDate ? new Date(body.reviewDate) : null;

    const review = await db.performanceReview.update({
      where: { id },
      data,
      include: { employee: { select: { firstName: true, lastName: true, employeeId: true } } },
    });

    return NextResponse.json({ review }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Update performance review error:', error);
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

    await db.performanceReview.delete({ where: { id } });

    return NextResponse.json({ success: true }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Delete performance review error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}
