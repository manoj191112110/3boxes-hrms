import { NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';
import { ensureSchemaSynced, withSchemaSync } from '@/lib/schema-sync';

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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) {
      return NextResponse.json(
        { error: 'No token provided' },
        { status: 401, headers: corsHeaders() }
      );
    }

    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401, headers: corsHeaders() }
      );
    }

    const { id } = await params;
    await ensureSchemaSynced();
    const candidate = await withSchemaSync(() =>
      db.preboardingCandidate.findUnique({
        where: { id },
      })
    );

    if (!candidate) {
      return NextResponse.json(
        { error: 'Candidate not found' },
        { status: 404, headers: corsHeaders() }
      );
    }

    return NextResponse.json(
      { candidate },
      { headers: corsHeaders() }
    );
  } catch (error) {
    console.error('Get preboarding candidate error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders() }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) {
      return NextResponse.json(
        { error: 'No token provided' },
        { status: 401, headers: corsHeaders() }
      );
    }

    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401, headers: corsHeaders() }
      );
    }

    const { id } = await params;
    const body = await request.json();

    await ensureSchemaSynced();
    const existing = await withSchemaSync(() => db.preboardingCandidate.findUnique({ where: { id } }));
    if (!existing) {
      return NextResponse.json(
        { error: 'Candidate not found' },
        { status: 404, headers: corsHeaders() }
      );
    }

    const updateData: Record<string, unknown> = {};

    if (body.candidateName !== undefined) updateData.candidateName = body.candidateName;
    if (body.candidateEmail !== undefined) updateData.candidateEmail = body.candidateEmail;
    if (body.candidatePhone !== undefined) updateData.candidatePhone = body.candidatePhone;
    if (body.jobTitle !== undefined) updateData.jobTitle = body.jobTitle;
    if (body.departmentId !== undefined) updateData.departmentId = body.departmentId;
    if (body.offeredSalary !== undefined) updateData.offeredSalary = body.offeredSalary ? parseFloat(String(body.offeredSalary)) : null;
    if (body.currency !== undefined) updateData.currency = body.currency;
    if (body.offerDate !== undefined) updateData.offerDate = body.offerDate ? new Date(body.offerDate) : undefined;
    if (body.joiningDate !== undefined) updateData.joiningDate = body.joiningDate ? new Date(body.joiningDate) : null;
    if (body.notes !== undefined) updateData.notes = body.notes;
    if (body.offerId !== undefined) updateData.offerId = body.offerId;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.documentsUploaded !== undefined) updateData.documentsUploaded = body.documentsUploaded;
    if (body.backgroundCheckStatus !== undefined) updateData.backgroundCheckStatus = body.backgroundCheckStatus;
    if (body.backgroundCheckNotes !== undefined) updateData.backgroundCheckNotes = body.backgroundCheckNotes;
    if (body.hrVerified !== undefined) updateData.hrVerified = body.hrVerified;
    if (body.accountProvisioned !== undefined) updateData.accountProvisioned = body.accountProvisioned;

    const candidate = await withSchemaSync(() =>
      db.preboardingCandidate.update({
        where: { id },
        data: updateData,
      })
    );

    await db.auditLog.create({
      data: {
        userId: decoded.userId as string,
        action: 'UPDATE_PREBOARDING_CANDIDATE',
        module: 'preboarding',
        details: `Updated preboarding candidate: ${existing.candidateName} - ${Object.keys(updateData).join(', ')}`,
      },
    });

    return NextResponse.json(
      { candidate },
      { headers: corsHeaders() }
    );
  } catch (error) {
    console.error('Update preboarding candidate error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders() }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const db = await getDb(request);
  // PATCH behaves the same as PUT - partial update
  return PUT(request, { params });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) {
      return NextResponse.json(
        { error: 'No token provided' },
        { status: 401, headers: corsHeaders() }
      );
    }

    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401, headers: corsHeaders() }
      );
    }

    const { id } = await params;
    await ensureSchemaSynced();
    const existing = await withSchemaSync(() => db.preboardingCandidate.findUnique({ where: { id } }));
    if (!existing) {
      return NextResponse.json(
        { error: 'Candidate not found' },
        { status: 404, headers: corsHeaders() }
      );
    }

    await withSchemaSync(() => db.preboardingCandidate.delete({ where: { id } }));

    await db.auditLog.create({
      data: {
        userId: decoded.userId as string,
        action: 'DELETE_PREBOARDING_CANDIDATE',
        module: 'preboarding',
        details: `Deleted preboarding candidate: ${existing.candidateName}`,
      },
    });

    return NextResponse.json(
      { message: 'Candidate deleted successfully' },
      { headers: corsHeaders() }
    );
  } catch (error) {
    console.error('Delete preboarding candidate error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders() }
    );
  }
}
