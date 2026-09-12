/**
 * REQ-CLT-09 — Resource feedback (360° into Performance module).
 *
 * POST /api/client-portal/feedback
 *   Body: { clientId, clientPortalUserId?, projectId?, employeeId, rating (1..5),
 *           communication?, quality?, timeliness?, comments?, wouldReengage? }
 *
 * Stores a ClientFeedback row AND mirrors it into the existing Feedback model
 * with type='360' so it surfaces in the Performance module's 360° review
 * workflows. The client-feedback row keeps the link via feedbackId.
 */
import { NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() });
}

export async function GET(request: Request) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: corsHeaders() });

    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');
    const employeeId = searchParams.get('employeeId');
    const projectId = searchParams.get('projectId');

    const where: Record<string, unknown> = {};
    if (clientId) where.clientId = clientId;
    if (employeeId) where.employeeId = employeeId;
    if (projectId) where.projectId = projectId;

    const feedbacks = await db.clientFeedback.findMany({
      where,
      include: {
        client: { select: { id: true, name: true } },
        employee: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { submittedAt: 'desc' },
      take: 100,
    });
    return NextResponse.json({ feedbacks }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Get client feedback error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}

export async function POST(request: Request) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: corsHeaders() });

    const body = await request.json();
    const {
      clientId, clientPortalUserId, projectId, employeeId,
      rating, communication, quality, timeliness,
      comments, wouldReengage = true,
    } = body;

    if (!clientId || !employeeId || !rating) {
      return NextResponse.json({ error: 'Missing required fields: clientId, employeeId, rating' }, { status: 400, headers: corsHeaders() });
    }
    if (rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'Rating must be between 1 and 5' }, { status: 400, headers: corsHeaders() });
    }

    // Verify the employee exists (don't allow feedback on non-employees)
    const employee = await db.employee.findUnique({
      where: { id: employeeId },
      select: { id: true, firstName: true, lastName: true, email: true },
    });
    if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404, headers: corsHeaders() });

    // 1. Mirror into the existing Feedback model with type='360' so it surfaces in Performance reviews
    // Find the client-portal-user's employee counterpart (if any) to set as `fromId`.
    // Per SRS, client feedback is anonymous-ish from the employee's perspective. We use the
    // employeeId being rated as both fromId and toId if no client-portal-user employee mapping exists.
    // The Feedback model requires a fromId (Employee), so we need an Employee record for the submitter.
    // Strategy: if no employee mapping for the client portal user, fall back to using the rated
    // employee themselves (self-feedback marker) and store the real source in ClientFeedback.
    let mirroredFeedback: any = null;
    try {
      mirroredFeedback = await db.feedback.create({
        data: {
          fromId: employeeId,  // self-marker (client feedback)
          toId: employeeId,
          type: '360',
          rating,
          comments: `[Client Feedback — ${clientId}] ${comments || ''}`.substring(0, 2000),
          isAnonymous: true,
        },
      });
    } catch (mirrorErr) {
      console.warn('Could not mirror feedback to Performance module:', mirrorErr);
    }

    // 2. Create the ClientFeedback record (canonical store)
    const feedback = await db.clientFeedback.create({
      data: {
        clientId,
        clientPortalUserId: clientPortalUserId || null,
        projectId: projectId || null,
        employeeId,
        rating,
        communication: communication || null,
        quality: quality || null,
        timeliness: timeliness || null,
        comments: comments || null,
        wouldReengage,
        feedbackId: mirroredFeedback?.id || null,
        status: mirroredFeedback ? 'mirrored_to_performance' : 'submitted',
      },
      include: {
        client: { select: { id: true, name: true } },
        employee: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    await db.auditLog.create({
      data: {
        userId: (decoded as any).userId as string,
        action: 'CLIENT_FEEDBACK_SUBMITTED',
        module: 'clients',
        details: `Client ${clientId} submitted 360° feedback for employee ${employeeId} (rating: ${rating}/5)`,
      },
    });

    return NextResponse.json({ feedback, mirroredToPerformance: !!mirroredFeedback }, { status: 201, headers: corsHeaders() });
  } catch (error) {
    console.error('Create client feedback error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}
