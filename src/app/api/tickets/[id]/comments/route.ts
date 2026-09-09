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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const comments = await db.ticketComment.findMany({
      where: { ticketId: id },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({ comments }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Get ticket comments error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    // Verify ticket exists
    const ticket = await db.ticket.findUnique({ where: { id } });
    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404, headers: corsHeaders() });
    }

    const body = await request.json();
    const { authorId, authorName, content, isInternal } = body;

    if (!content || !authorId || !authorName) {
      return NextResponse.json(
        { error: 'Missing required fields: content, authorId, authorName' },
        { status: 400, headers: corsHeaders() }
      );
    }

    const comment = await db.ticketComment.create({
      data: {
        ticketId: id,
        authorId,
        authorName,
        content,
        isInternal: isInternal ?? false,
      },
    });

    await db.auditLog.create({
      data: {
        userId: decoded.userId as string,
        action: 'ADD_TICKET_COMMENT',
        module: 'tickets',
        details: `Added comment to ticket ${ticket.ticketId}`,
      },
    });

    return NextResponse.json({ comment }, { status: 201, headers: corsHeaders() });
  } catch (error) {
    console.error('Add ticket comment error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}
