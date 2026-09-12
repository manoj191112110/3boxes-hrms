import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { getTokenFromHeaders, verifyToken } from '@/lib/auth';
import { NextRequest } from 'next/server';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const FILING_STATUS_TRANSITIONS: Record<string, string[]> = {
  GENERATED: ['UNDER_REVIEW'],
  UNDER_REVIEW: ['SUBMITTED', 'REJECTED'],
  SUBMITTED: ['ACKNOWLEDGED', 'REJECTED'],
  REJECTED: ['UNDER_REVIEW', 'SUBMITTED'],
  ACKNOWLEDGED: [],
  PENALTY_APPLIED: [],
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = await getDb(request);
  try {
    const { id } = await params;
    const token = getTokenFromHeaders(request);
    const decoded = await verifyToken(token);
    if (!decoded) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });

    const body = await request.json();
    const data = await db.complianceFiling.update({
      where: { id },
      data: body,
    });

    return Response.json({ data, message: 'Compliance filing updated successfully' }, { headers: corsHeaders });
  } catch (error: unknown) {
    console.error('Error updating compliance filing:', error);
    return Response.json({ error: (error instanceof Error ? error.message : String(error)) }, { status: 500, headers: corsHeaders });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = await getDb(request);
  try {
    const { id } = await params;
    const token = getTokenFromHeaders(request);
    const decoded = await verifyToken(token);
    if (!decoded) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });

    const body = await request.json();
    const { filingStatus, reviewedBy, submittedBy, rejectionReason } = body;

    if (!filingStatus) {
      return Response.json({ error: 'filingStatus is required' }, { status: 400, headers: corsHeaders });
    }

    const currentFiling = await db.complianceFiling.findUnique({ where: { id } });
    if (!currentFiling) return Response.json({ error: 'Compliance filing not found' }, { status: 404, headers: corsHeaders });

    const allowedTransitions = FILING_STATUS_TRANSITIONS[currentFiling.filingStatus] || [];
    if (!allowedTransitions.includes(filingStatus)) {
      return Response.json(
        { error: `Invalid status transition from ${currentFiling.filingStatus} to ${filingStatus}. Allowed: ${allowedTransitions.join(', ')}` },
        { status: 400, headers: corsHeaders }
      );
    }

    const updateData: Record<string, unknown> = { filingStatus };

    if (filingStatus === 'SUBMITTED') {
      updateData.submittedDate = new Date();
      updateData.submittedBy = submittedBy || (decoded.userId as string);
    }
    if (filingStatus === 'UNDER_REVIEW') {
      updateData.reviewedBy = reviewedBy || (decoded.userId as string);
    }
    if (filingStatus === 'REJECTED') {
      updateData.rejectionReason = rejectionReason;
      updateData.resubmissionDate = null;
    }
    if (filingStatus === 'ACKNOWLEDGED') {
      updateData.acknowledgementRef = body.acknowledgementRef;
    }

    const data = await db.complianceFiling.update({
      where: { id },
      data: updateData,
    });

    return Response.json({ data, message: `Compliance filing status updated to ${filingStatus}` }, { headers: corsHeaders });
  } catch (error: unknown) {
    console.error('Error updating compliance filing status:', error);
    return Response.json({ error: (error instanceof Error ? error.message : String(error)) }, { status: 500, headers: corsHeaders });
  }
}
