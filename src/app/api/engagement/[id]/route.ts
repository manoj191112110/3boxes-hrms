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

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) {
      return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    }
    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: corsHeaders() });
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // 'survey' or 'recognition'

    await ensureSchemaSynced();

    if (type === 'recognition') {
      const recognition = await withSchemaSync(() => db.recognition.findUnique({ where: { id } }));
      if (!recognition) {
        return NextResponse.json({ error: 'Recognition not found' }, { status: 404, headers: corsHeaders() });
      }
      const [fromEmp, toEmp] = await Promise.all([
        db.employee.findFirst({ where: { userId: recognition.fromId }, select: { id: true, firstName: true, lastName: true, avatar: true } }),
        db.employee.findUnique({ where: { id: recognition.toId }, select: { id: true, firstName: true, lastName: true, avatar: true } }),
      ]);
      return NextResponse.json({ recognition: { ...recognition, fromEmployee: fromEmp, toEmployee: toEmp } }, { headers: corsHeaders() });
    }

    // Default: survey
    const survey = await withSchemaSync(() =>
      db.survey.findUnique({
        where: { id },
        include: {
          responses: true,
          _count: { select: { responses: true } },
        },
      })
    );

    if (!survey) {
      return NextResponse.json({ error: 'Survey not found' }, { status: 404, headers: corsHeaders() });
    }

    return NextResponse.json({ survey }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Get engagement detail error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) {
      return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    }
    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: corsHeaders() });
    }

    const { id } = await params;
    const body = await request.json();
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    await ensureSchemaSynced();

    if (type === 'recognition') {
      const recognition = await withSchemaSync(() =>
        db.recognition.update({
          where: { id },
          data: {
            ...(body.type && { type: body.type }),
            ...(body.title !== undefined && { title: body.title }),
            ...(body.message !== undefined && { message: body.message }),
            ...(body.points !== undefined && { points: body.points }),
            ...(body.isPublic !== undefined && { isPublic: body.isPublic }),
            ...(body.category && { category: body.category }),
          },
        })
      );
      return NextResponse.json({ recognition }, { headers: corsHeaders() });
    }

    // Default: survey update (status change, etc.)
    const survey = await withSchemaSync(() =>
      db.survey.update({
        where: { id },
        data: {
          ...(body.title && { title: body.title }),
          ...(body.description !== undefined && { description: body.description }),
          ...(body.type && { type: body.type }),
          ...(body.status && { status: body.status }),
          ...(body.anonymous !== undefined && { anonymous: body.anonymous }),
          ...(body.targetAudience && { targetAudience: body.targetAudience }),
          ...(body.questions && { questions: typeof body.questions === 'string' ? body.questions : JSON.stringify(body.questions) }),
          ...(body.startDate && { startDate: new Date(body.startDate) }),
          ...(body.endDate !== undefined && { endDate: body.endDate ? new Date(body.endDate) : null }),
        },
        include: {
          _count: { select: { responses: true } },
        },
      })
    );

    return NextResponse.json({ survey }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Update engagement error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) {
      return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    }
    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: corsHeaders() });
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    await ensureSchemaSynced();

    if (type === 'recognition') {
      await withSchemaSync(() => db.recognition.delete({ where: { id } }));
      return NextResponse.json({ success: true }, { headers: corsHeaders() });
    }

    // Default: delete survey (cascades responses)
    await withSchemaSync(() => db.survey.delete({ where: { id } }));
    return NextResponse.json({ success: true }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Delete engagement error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}
