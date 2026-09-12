import { NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';
import { ensureSchemaSynced, withSchemaSync } from '@/lib/schema-sync';

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

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const db = await getDb(request);
  try {
    const { id } = await params;
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: corsHeaders() });
    await ensureSchemaSynced();

    const interview = await withSchemaSync(() =>
      db.exitInterview.findUnique({
        where: { id },
        include: {
          employee: { select: { id: true, firstName: true, lastName: true, employeeId: true, department: { select: { name: true } }, designation: { select: { title: true } } } },
        },
      })
    );

    if (!interview) {
      return NextResponse.json({ error: 'Exit interview not found' }, { status: 404, headers: corsHeaders() });
    }

    return NextResponse.json({ interview }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Get exit interview error:', error);
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
    if (body.interviewDate) data.interviewDate = new Date(body.interviewDate);
    if (body.interviewer !== undefined) data.interviewer = body.interviewer;
    if (body.reason !== undefined) data.reason = body.reason;
    if (body.feedback !== undefined) data.feedback = body.feedback;
    if (body.rating !== undefined) data.rating = parseInt(body.rating);
    if (body.wouldRehire !== undefined) data.wouldRehire = Boolean(body.wouldRehire);
    if (body.suggestions !== undefined) data.suggestions = body.suggestions;
    if (body.status) data.status = body.status;

    await ensureSchemaSynced();
    const interview = await withSchemaSync(() =>
      db.exitInterview.update({
        where: { id },
        data,
        include: {
          employee: { select: { firstName: true, lastName: true, employeeId: true } },
        },
      })
    );

    return NextResponse.json({ interview }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Update exit interview error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}
